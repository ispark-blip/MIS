const express = require('express');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { labs } = require('../config/departments');

const router = express.Router();

// GET /api/subjects (공개)
router.get('/', (req, res) => {
  const { lab = '전체', month, year } = req.query;
  const now = new Date();
  const m = parseInt(month) || (now.getMonth() + 1);
  const y = parseInt(year) || now.getFullYear();

  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  let query = 'SELECT * FROM daily_subject_counts WHERE date >= ? AND date < ?';
  const params = [startDate, endDate];
  if (lab !== '전체') { query += ' AND lab = ?'; params.push(lab); }
  query += ' ORDER BY date, lab, department';

  res.json({ success: true, data: db.prepare(query).all(...params), meta: { timestamp: new Date().toISOString(), source: 'sqlite' } });
});

// GET /api/subjects/summary (공개)
router.get('/summary', (req, res) => {
  // 1순위: Google Sheets 데이터
  const sheetsService = req.app.get('sheetsService');
  const sheetSummary = sheetsService ? sheetsService.getCachedSubjectsSummary() : null;
  if (sheetSummary) {
    return res.json({
      success: true,
      data: sheetSummary,
      meta: { timestamp: new Date().toISOString(), source: 'google-sheets' },
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;

  const labs = ['문정', '가산'];
  const summary = labs.map(lab => {
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

  res.json({ success: true, data: summary, meta: { timestamp: new Date().toISOString(), source: 'sqlite' } });
});

// POST /api/subjects - 관리자만 (시험대상자 인원수 직접 입력)
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
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
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '일자 형식이 올바르지 않습니다 (YYYY-MM-DD).' } });
  }

  // study_name이 NULL이면 UNIQUE 제약이 작동하지 않으므로 빈 문자열로 정규화
  const studyKey = study_name && String(study_name).trim() ? String(study_name).trim() : '';

  db.prepare(`
    INSERT INTO daily_subject_counts (date, lab, department, subject_count, study_name)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, lab, department, study_name)
    DO UPDATE SET subject_count = excluded.subject_count
  `).run(date, lab, department, countNum, studyKey);

  const sseManager = req.app.get('sseManager');
  if (sseManager) sseManager.broadcast('subjects-update', {});

  logAccess(req, 'submit', `시험대상자 입력: ${date} ${lab} ${department} ${countNum}명`);

  res.status(201).json({ success: true, data: { message: '입력 완료' } });
});

module.exports = router;
