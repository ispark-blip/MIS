const express = require('express');
const db = require('../config/database');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { labs } = require('../config/departments');

const router = express.Router();

// GET /api/test-counts/summary - 대시보드용 (공개)
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  const m = month ? parseInt(month) : undefined;
  const y = year ? parseInt(year) : undefined;
  const sheetsService = req.app.get('sheetsService');
  const sheetSummary = sheetsService ? sheetsService.getCachedTestCountsSummary(m, y) : null;
  if (sheetSummary) {
    return res.json({ success: true, data: sheetSummary, meta: { source: 'google-sheets' } });
  }
  res.json({ success: true, data: [], meta: { source: 'sqlite' } });
});

// GET /api/test-counts - 월간 목록 (공개)
router.get('/', (req, res) => {
  const { month, year, lab = '전체', test_type } = req.query;
  const now = new Date();
  const m = parseInt(month) || (now.getMonth() + 1);
  const y = parseInt(year) || now.getFullYear();

  const sheetsService = req.app.get('sheetsService');
  if (sheetsService) {
    const all = sheetsService.transformTestCountsData();
    const filtered = all.filter(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry !== y || rm !== m) return false;
      if (lab !== '전체' && r.lab !== lab) return false;
      if (test_type && test_type !== '전체' && r.test_type !== test_type) return false;
      return true;
    });
    if (filtered.length > 0) {
      return res.json({
        success: true,
        data: filtered.map(r => ({ id: r.id, sheetRow: r.sheetRow, date: r.date, lab: r.lab, department: r.department, test_type: r.test_type, count: r.count, submitted_by: r.submitted_by, notes: r.notes })),
        meta: { source: 'google-sheets' },
      });
    }
  }

  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  let query = 'SELECT * FROM daily_test_counts WHERE date >= ? AND date < ?';
  const params = [startDate, endDate];
  if (lab !== '전체') { query += ' AND lab = ?'; params.push(lab); }
  if (test_type && test_type !== '전체') { query += ' AND test_type = ?'; params.push(test_type); }
  query += ' ORDER BY date DESC, department';

  res.json({ success: true, data: db.prepare(query).all(...params), meta: { source: 'sqlite' } });
});

// POST /api/test-counts - 시험건수 입력 권한 필요
router.post('/', requireAuth, requirePermission('can_input_test_counts'), async (req, res) => {
  const { date, department, lab, test_type, count, notes } = req.body;
  const submitted_by = req.session.user.name || req.session.user.employee_id;

  if (!date || !department || !lab || !test_type || count === undefined) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '필수 항목을 모두 입력해주세요.' } });
  }

  const countNum = parseInt(count);
  if (isNaN(countNum) || countNum < 0 || countNum > 9999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '건수는 0~9999 사이 정수여야 합니다.' } });
  }

  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '일자 형식이 올바르지 않습니다.' } });
  }

  if (!labs.includes(lab)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 연구소입니다.' } });
  }

  // 소속 부서 외 입력 차단 (admin 제외)
  const sessionUser = req.session.user;
  if (sessionUser.role !== 'admin') {
    if (sessionUser.lab !== lab || sessionUser.department !== department) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '소속된 연구소/부서의 데이터만 입력할 수 있습니다.' } });
    }
  }

  // 구글시트에 기록 (연동 시)
  const sheetsService = req.app.get('sheetsService');
  if (sheetsService) {
    const ok = await sheetsService.appendTestCount({ date, lab, department, test_type, count: countNum, submitted_by, notes });
    if (!ok) {
      return res.status(500).json({ success: false, error: { code: 'SHEETS_ERROR', message: 'Google Sheets 기록 실패. 잠시 후 다시 시도해주세요.' } });
    }
    logAccess(req, 'submit', `시험건수 입력(시트): ${date} ${department} ${test_type} ${countNum}건`);
    return res.status(201).json({ success: true, data: { message: '입력 완료 (Google Sheets)' } });
  }

  // 구글시트 미연동 → SQLite 폴백
  const existing = db.prepare(
    'SELECT * FROM daily_test_counts WHERE date = ? AND department = ? AND lab = ? AND test_type = ?'
  ).get(date, department, lab, test_type);

  const result = db.prepare(`
    INSERT INTO daily_test_counts (date, department, lab, test_type, count, submitted_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, department, lab, test_type)
    DO UPDATE SET count = excluded.count, submitted_by = excluded.submitted_by, submitted_at = CURRENT_TIMESTAMP, notes = excluded.notes
  `).run(date, department, lab, test_type, countNum, submitted_by, notes || null);

  const recordId = existing ? existing.id : result.lastInsertRowid;

  db.prepare(`
    INSERT INTO test_count_audit_log (test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(recordId, date, department, lab, test_type, existing ? existing.count : null, countNum, existing ? 'UPDATE' : 'INSERT', submitted_by, notes || null);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('test-count-update', {});
  logAccess(req, 'submit', `시험건수 입력(DB): ${date} ${department} ${test_type} ${countNum}건`);

  res.status(201).json({ success: true, data: { id: recordId, message: '입력 완료 (SQLite)' } });
});

// PUT /api/test-counts/:sheetRow - 시험건수 수정 권한 필요
router.put('/:rowOrId', requireAuth, requirePermission('can_input_test_counts'), async (req, res) => {
  const { rowOrId } = req.params;
  const { date, department, lab, test_type, count, notes } = req.body;
  const submitted_by = req.session.user.name || req.session.user.employee_id;

  const countNum = parseInt(count);
  if (isNaN(countNum) || countNum < 0 || countNum > 9999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '건수는 0~9999 사이 정수여야 합니다.' } });
  }

  // 구글시트 행 수정
  const sheetsService = req.app.get('sheetsService');
  if (sheetsService && rowOrId.startsWith('sheet-')) {
    const all = sheetsService.transformTestCountsData();
    const target = all.find(r => r.id === rowOrId);
    if (!target) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 데이터를 찾을 수 없습니다.' } });
    }
    // 소속 부서 외 수정 차단 (admin 제외)
    const sessionUser = req.session.user;
    if (sessionUser.role !== 'admin') {
      if (sessionUser.lab !== target.lab || sessionUser.department !== target.department) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '소속된 연구소/부서의 데이터만 수정할 수 있습니다.' } });
      }
    }
    const ok = await sheetsService.updateTestCountRow(target.sheetRow, {
      date: date || target.date,
      lab: lab || target.lab,
      department: department || target.department,
      test_type: test_type || target.test_type,
      count: countNum,
      submitted_by,
      notes: notes !== undefined ? notes : target.notes,
    });
    if (!ok) {
      return res.status(500).json({ success: false, error: { code: 'SHEETS_ERROR', message: 'Google Sheets 수정 실패.' } });
    }
    logAccess(req, 'update', `시험건수 수정(시트 행${target.sheetRow}): ${countNum}건`);
    return res.json({ success: true, data: { message: '수정 완료 (Google Sheets)' } });
  }

  // SQLite 수정
  const id = parseInt(rowOrId);
  const existing = db.prepare('SELECT * FROM daily_test_counts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '데이터를 찾을 수 없습니다.' } });

  // 소속 부서 외 수정 차단 (admin 제외)
  const sessionUser = req.session.user;
  if (sessionUser.role !== 'admin') {
    if (sessionUser.lab !== existing.lab || sessionUser.department !== existing.department) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '소속된 연구소/부서의 데이터만 수정할 수 있습니다.' } });
    }
  }

  db.prepare('UPDATE daily_test_counts SET count = ?, notes = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?').run(countNum, notes || null, id);

  db.prepare(`
    INSERT INTO test_count_audit_log (test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'UPDATE', ?)
  `).run(id, existing.date, existing.department, existing.lab, existing.test_type, existing.count, countNum, submitted_by);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('test-count-update', {});
  res.json({ success: true, data: { message: '수정 완료' } });
});

module.exports = router;
