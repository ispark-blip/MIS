const express = require('express');
const db = require('../config/database');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { labs } = require('../config/departments');

const router = express.Router();

// GET /api/subjects - 월간 목록 (공개)
router.get('/', (req, res) => {
  const { lab = '전체', month, year } = req.query;
  const now = new Date();
  const m = parseInt(month) || (now.getMonth() + 1);
  const y = parseInt(year) || now.getFullYear();

  const sheetsService = req.app.get('sheetsService');
  if (sheetsService) {
    const all = sheetsService.transformSubjectsData();
    const filtered = all.filter(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry !== y || rm !== m) return false;
      if (lab !== '전체' && r.lab !== lab) return false;
      return true;
    });
    if (filtered.length > 0) {
      return res.json({
        success: true,
        data: filtered.map(r => ({ id: r.id, sheetRow: r.sheetRow, date: r.date, lab: r.lab, department: r.department, subject_count: r.subject_count, study_name: r.study_name })),
        meta: { source: 'google-sheets' },
      });
    }
  }

  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  let query = 'SELECT * FROM daily_subject_counts WHERE date >= ? AND date < ?';
  const params = [startDate, endDate];
  if (lab !== '전체') { query += ' AND lab = ?'; params.push(lab); }
  query += ' ORDER BY date DESC, lab, department';

  res.json({ success: true, data: db.prepare(query).all(...params), meta: { source: 'sqlite' } });
});

// GET /api/subjects/summary - 대시보드용 (공개)
router.get('/summary', (req, res) => {
  const { month, year, day } = req.query;
  const targetMonth = month ? parseInt(month) : undefined;
  const targetYear = year ? parseInt(year) : undefined;
  const targetDay = day ? parseInt(day) : undefined;
  const sheetsService = req.app.get('sheetsService');
  const sheetSummary = sheetsService ? sheetsService.getCachedSubjectsSummary(targetMonth, targetYear, targetDay) : null;
  if (sheetSummary) {
    return res.json({ success: true, data: sheetSummary, meta: { source: 'google-sheets' } });
  }

  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const y = targetYear || now.getFullYear();
  const m = targetMonth || (now.getMonth() + 1);
  const lastDay = new Date(y, m, 0).getDate();
  let d;
  if (targetDay) {
    d = Math.min(Math.max(1, targetDay), lastDay);
  } else {
    const isCurMonth = (y === now.getFullYear() && m === now.getMonth() + 1);
    d = isCurMonth ? now.getDate() : lastDay;
  }
  const today = `${y}-${pad2(m)}-${pad2(d)}`;
  const monthStart = `${y}-${pad2(m)}-01`;
  const yearStart = `${y}-01-01`;

  // 숨김 연구소는 app_settings의 hidden_summary_labs에서 관리
  let hiddenLabs = new Set();
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hidden_summary_labs');
    if (row?.value) {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) hiddenLabs = new Set(arr);
    }
  } catch {}
  const labsList = labs.filter(l => !hiddenLabs.has(l));
  const summary = labsList.map(lab => {
    const todayCount = db.prepare(
      'SELECT COALESCE(SUM(subject_count), 0) as total FROM daily_subject_counts WHERE date = ? AND lab = ?'
    ).get(today, lab)?.total || 0;
    const monthlyTotal = db.prepare(
      'SELECT COALESCE(SUM(subject_count), 0) as total FROM daily_subject_counts WHERE date >= ? AND date <= ? AND lab = ?'
    ).get(monthStart, today, lab)?.total || 0;
    const annualTotal = db.prepare(
      'SELECT COALESCE(SUM(subject_count), 0) as total FROM daily_subject_counts WHERE date >= ? AND date <= ? AND lab = ?'
    ).get(yearStart, today, lab)?.total || 0;
    const recentDays = db.prepare(`
      SELECT date, SUM(subject_count) as total FROM daily_subject_counts
      WHERE lab = ? AND date >= date(?, '-30 days') AND date <= ?
      GROUP BY date ORDER BY date
    `).all(lab, today, today);
    const departments = db.prepare(`
      SELECT department, SUM(subject_count) as total FROM daily_subject_counts
      WHERE lab = ? AND date >= ? AND date <= ?
      GROUP BY department
    `).all(lab, monthStart, today);
    return { lab, today: todayCount, monthlyTotal, annualTotal, recentDays, departments };
  });

  res.json({ success: true, data: summary, meta: { source: 'sqlite' } });
});

// POST /api/subjects - 시험대상자 입력 권한 필요
router.post('/', requireAuth, requirePermission('can_input_subjects'), async (req, res) => {
  const { date, lab, department, subject_count, study_name } = req.body;

  if (!date || !lab || !department || subject_count === undefined) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '필수 항목을 모두 입력해주세요.' } });
  }

  const countNum = parseInt(subject_count);
  if (isNaN(countNum) || countNum < 0 || countNum > 99999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '인원수는 0~99999 사이 정수여야 합니다.' } });
  }

  if (!labs.includes(lab)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 연구소입니다.' } });
  }

  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '일자 형식이 올바르지 않습니다.' } });
  }

  // 소속 부서 외 입력 차단 (admin 제외)
  const sessionUser = req.session.user;
  if (sessionUser.role !== 'admin') {
    if (sessionUser.lab !== lab || sessionUser.department !== department) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '소속된 연구소/부서의 데이터만 입력할 수 있습니다.' } });
    }
  }

  // 구글시트에 기록
  const sheetsService = req.app.get('sheetsService');
  if (sheetsService) {
    const ok = await sheetsService.appendSubject({ date, lab, department, subject_count: countNum, study_name: study_name || '' });
    if (!ok) {
      return res.status(500).json({ success: false, error: { code: 'SHEETS_ERROR', message: 'Google Sheets 기록 실패. 잠시 후 다시 시도해주세요.' } });
    }
    logAccess(req, 'submit', `시험대상자 입력(시트): ${date} ${lab} ${department} ${countNum}명`);
    return res.status(201).json({ success: true, data: { message: '입력 완료 (Google Sheets)' } });
  }

  // SQLite 폴백
  const studyKey = study_name && String(study_name).trim() ? String(study_name).trim() : '';
  db.prepare(`
    INSERT INTO daily_subject_counts (date, lab, department, subject_count, study_name)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, lab, department, study_name)
    DO UPDATE SET subject_count = excluded.subject_count
  `).run(date, lab, department, countNum, studyKey);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('subjects-update', {});
  logAccess(req, 'submit', `시험대상자 입력(DB): ${date} ${lab} ${department} ${countNum}명`);

  res.status(201).json({ success: true, data: { message: '입력 완료 (SQLite)' } });
});

// PUT /api/subjects/:rowOrId - 시험대상자 수정 권한 필요
router.put('/:rowOrId', requireAuth, requirePermission('can_input_subjects'), async (req, res) => {
  const { rowOrId } = req.params;
  const { date, lab, department, subject_count, study_name } = req.body;

  const countNum = parseInt(subject_count);
  if (isNaN(countNum) || countNum < 0 || countNum > 99999) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '인원수는 0~99999 사이 정수여야 합니다.' } });
  }

  // 구글시트 행 수정
  const sheetsService = req.app.get('sheetsService');
  if (sheetsService && rowOrId.startsWith('sheet-')) {
    const all = sheetsService.transformSubjectsData();
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
    const ok = await sheetsService.updateSubjectRow(target.sheetRow, {
      date: date || target.date,
      lab: lab || target.lab,
      department: department || target.department,
      subject_count: countNum,
      study_name: study_name !== undefined ? study_name : target.study_name,
    });
    if (!ok) {
      return res.status(500).json({ success: false, error: { code: 'SHEETS_ERROR', message: 'Google Sheets 수정 실패.' } });
    }
    logAccess(req, 'update', `시험대상자 수정(시트 행${target.sheetRow}): ${countNum}명`);
    return res.json({ success: true, data: { message: '수정 완료 (Google Sheets)' } });
  }

  // SQLite 수정
  const id = parseInt(rowOrId);
  const existing = db.prepare('SELECT * FROM daily_subject_counts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '데이터를 찾을 수 없습니다.' } });

  // 소속 부서 외 수정 차단 (admin 제외)
  const sessionUser = req.session.user;
  if (sessionUser.role !== 'admin') {
    if (sessionUser.lab !== existing.lab || sessionUser.department !== existing.department) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '소속된 연구소/부서의 데이터만 수정할 수 있습니다.' } });
    }
  }

  db.prepare('UPDATE daily_subject_counts SET subject_count = ?, study_name = ? WHERE id = ?').run(countNum, study_name || '', id);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('subjects-update', {});

  res.json({ success: true, data: { message: '수정 완료' } });
});

module.exports = router;
