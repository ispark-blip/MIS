const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/users - 사용자 등록
router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { employee_id, name, department, lab, role = 'staff', password, can_input_test_counts = 0, can_input_subjects = 0 } = req.body;

  if (!employee_id || !name || !department || !lab || !password) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '필수 항목을 모두 입력해주세요.' } });
  }

  const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(employee_id);
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: '이미 등록된 사번입니다.' } });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (employee_id, name, department, lab, role, password_hash, can_input_test_counts, can_input_subjects) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(employee_id, name, department, lab, role, hash, can_input_test_counts ? 1 : 0, can_input_subjects ? 1 : 0);

  res.status(201).json({ success: true, data: { id: result.lastInsertRowid, employee_id, name, department, lab, role, can_input_test_counts: can_input_test_counts ? 1 : 0, can_input_subjects: can_input_subjects ? 1 : 0 } });
});

// GET /api/admin/users - 사용자 목록
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare(
    'SELECT id, employee_id, name, department, lab, role, is_active, can_input_test_counts, can_input_subjects, created_at FROM users ORDER BY created_at'
  ).all();
  res.json({ success: true, data: users });
});

// PUT /api/admin/users/:id - 사용자 수정
router.put('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { name, department, lab, role, is_active, password, can_input_test_counts, can_input_subjects } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } });

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (department !== undefined) updates.department = department;
  if (lab !== undefined) updates.lab = lab;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (can_input_test_counts !== undefined) updates.can_input_test_counts = can_input_test_counts ? 1 : 0;
  if (can_input_subjects !== undefined) updates.can_input_subjects = can_input_subjects ? 1 : 0;
  if (password) updates.password_hash = bcrypt.hashSync(password, 12);
  updates.updated_at = new Date().toISOString();

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  res.json({ success: true, data: { message: '수정 완료' } });
});

// GET /api/admin/logs - 접근 로그 조회
router.get('/logs', requireAuth, requireRole('admin'), (req, res) => {
  const { from, to, limit = 100 } = req.query;
  let query = 'SELECT * FROM access_logs';
  const params = [];

  if (from || to) {
    const conditions = [];
    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to) { conditions.push('created_at <= ?'); params.push(to); }
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  res.json({ success: true, data: db.prepare(query).all(...params) });
});

module.exports = router;
