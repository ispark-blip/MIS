const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/form-tokens - 토큰 생성
router.post('/', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const { department, lab, max_uses = 0 } = req.body;

  if (!department || !lab) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '부서와 연구소를 지정해주세요.' } });
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO form_tokens (token, department, lab, created_by, expires_at, max_uses)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, department, lab, req.session.user.employee_id, expiresAt, max_uses);

  res.status(201).json({
    success: true,
    data: { token, url: `/form/${token}`, expires_at: expiresAt, max_uses },
  });
});

// GET /api/form-tokens/:token/validate - 토큰 검증 (public)
router.get('/:token/validate', (req, res) => {
  const { token } = req.params;
  const row = db.prepare('SELECT * FROM form_tokens WHERE token = ?').get(token);

  if (!row) {
    return res.status(404).json({ success: false, error: { code: 'TOKEN_NOT_FOUND', message: '유효하지 않은 토큰입니다.' } });
  }

  if (new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: '만료된 토큰입니다.' } });
  }

  if (row.max_uses > 0 && row.use_count >= row.max_uses) {
    return res.status(410).json({ success: false, error: { code: 'TOKEN_EXHAUSTED', message: '사용 횟수를 초과한 토큰입니다.' } });
  }

  res.json({
    success: true,
    data: { department: row.department, lab: row.lab, expires_at: row.expires_at, use_count: row.use_count, max_uses: row.max_uses },
  });
});

// GET /api/form-tokens - 토큰 목록
router.get('/', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const rows = db.prepare('SELECT id, token, department, lab, created_by, expires_at, use_count, max_uses, created_at FROM form_tokens ORDER BY created_at DESC').all();
  res.json({ success: true, data: rows });
});

// DELETE /api/form-tokens/:id - 토큰 폐기
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), (req, res) => {
  const result = db.prepare('DELETE FROM form_tokens WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '토큰을 찾을 수 없습니다.' } });
  res.json({ success: true, data: { message: '토큰 폐기 완료' } });
});

module.exports = router;
