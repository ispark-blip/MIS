const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/subjects
router.get('/', requireAuth, (req, res) => {
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

// GET /api/subjects/summary
router.get('/summary', requireAuth, (req, res) => {
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

module.exports = router;
