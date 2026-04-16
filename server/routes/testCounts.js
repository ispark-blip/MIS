const express = require('express');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { labs } = require('../config/departments');

const router = express.Router();

// GET /api/test-counts/summary - 연구소별 요약 (시험대상자 summary 와 동일 형식, 공개)
router.get('/summary', (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  const sheetSummary = sheetsService ? sheetsService.getCachedTestCountsSummary() : null;
  if (sheetSummary) {
    return res.json({
      success: true,
      data: sheetSummary,
      meta: { timestamp: new Date().toISOString(), source: 'google-sheets' },
    });
  }
  res.json({ success: true, data: [], meta: { timestamp: new Date().toISOString(), source: 'sqlite' } });
});

// GET /api/test-counts (공개)
router.get('/', (req, res) => {
  const { month, year, lab = '전체', test_type } = req.query;
  const now = new Date();
  const m = parseInt(month) || (now.getMonth() + 1);
  const y = parseInt(year) || now.getFullYear();

  // 1순위: Google Sheets 데이터 (연동된 경우)
  const sheetsService = req.app.get('sheetsService');
  const sheetRows = sheetsService ? sheetsService.getCachedTestCounts(m, y, lab, test_type) : null;

  if (sheetRows && sheetRows.length > 0) {
    return res.json({
      success: true,
      data: sheetRows,
      meta: { timestamp: new Date().toISOString(), source: 'google-sheets' },
    });
  }

  // 2순위: SQLite 데이터 (폼 입력 내역)
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  let query = 'SELECT * FROM daily_test_counts WHERE date >= ? AND date < ?';
  const params = [startDate, endDate];

  if (lab !== '전체') { query += ' AND lab = ?'; params.push(lab); }
  if (test_type && test_type !== '전체') { query += ' AND test_type = ?'; params.push(test_type); }
  query += ' ORDER BY date, department';

  const rows = db.prepare(query).all(...params);

  res.json({ success: true, data: rows, meta: { timestamp: new Date().toISOString(), source: 'sqlite' } });
});

// POST /api/test-counts (세션 인증 필요)
router.post('/', requireAuth, (req, res) => {
  const { date, department, lab, test_type, count, submitted_by, notes } = req.body;

  // 입력 검증
  if (!date || !department || !lab || !test_type || count === undefined || !submitted_by) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '필수 항목을 모두 입력해주세요.' } });
  }

  const countNum = parseInt(count);
  if (isNaN(countNum) || countNum < 0 || countNum > 9999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '건수는 0~9999 사이 정수여야 합니다.' } });
  }

  if (test_type.length > 50) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '시험유형은 50자 이내여야 합니다.' } });
  }

  // 날짜 검증 (오늘 기준 -7일 ~ 오늘)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inputDate = new Date(date);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (inputDate < sevenDaysAgo || inputDate > today) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '시험일자는 오늘 기준 7일 이내여야 합니다.' } });
  }

  if (!labs.includes(lab)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 연구소입니다.' } });
  }

  // 기존 데이터 조회 (감사 추적용)
  const existing = db.prepare(
    'SELECT * FROM daily_test_counts WHERE date = ? AND department = ? AND lab = ? AND test_type = ?'
  ).get(date, department, lab, test_type);

  // UPSERT
  const result = db.prepare(`
    INSERT INTO daily_test_counts (date, department, lab, test_type, count, submitted_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, department, lab, test_type)
    DO UPDATE SET count = excluded.count, submitted_by = excluded.submitted_by, submitted_at = CURRENT_TIMESTAMP, notes = excluded.notes
  `).run(date, department, lab, test_type, countNum, submitted_by, notes || null);

  const recordId = existing ? existing.id : result.lastInsertRowid;

  // 감사 로그 기록
  db.prepare(`
    INSERT INTO test_count_audit_log (test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(recordId, date, department, lab, test_type, existing ? existing.count : null, countNum, existing ? 'UPDATE' : 'INSERT', submitted_by, notes || null);

  // SSE broadcast
  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('test-count-update', { month: new Date(date).getMonth() + 1, year: new Date(date).getFullYear() });

  logAccess(req, 'submit', `시험건수 입력: ${date} ${department} ${test_type} ${countNum}건`);

  res.status(201).json({ success: true, data: { id: recordId, message: '입력 완료' } });
});

// PUT /api/test-counts/:id
router.put('/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { id } = req.params;
  const { count, notes } = req.body;

  const existing = db.prepare('SELECT * FROM daily_test_counts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '데이터를 찾을 수 없습니다.' } });

  const countNum = parseInt(count);
  if (isNaN(countNum) || countNum < 0 || countNum > 9999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '건수는 0~9999 사이 정수여야 합니다.' } });
  }

  db.prepare('UPDATE daily_test_counts SET count = ?, notes = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?').run(countNum, notes || null, id);

  db.prepare(`
    INSERT INTO test_count_audit_log (test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'UPDATE', ?)
  `).run(id, existing.date, existing.department, existing.lab, existing.test_type, existing.count, countNum, req.session.user.employee_id);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('test-count-update', {});

  res.json({ success: true, data: { message: '수정 완료' } });
});

// DELETE /api/test-counts/:id
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM daily_test_counts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '데이터를 찾을 수 없습니다.' } });

  db.prepare(`
    INSERT INTO test_count_audit_log (test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'DELETE', ?)
  `).run(id, existing.date, existing.department, existing.lab, existing.test_type, existing.count, req.session.user.employee_id);

  db.prepare('DELETE FROM daily_test_counts WHERE id = ?').run(id);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('test-count-update', {});

  res.json({ success: true, data: { message: '삭제 완료' } });
});

module.exports = router;
