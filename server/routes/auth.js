const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { generateToken } = require('../middleware/csrfProtection');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '사번과 비밀번호를 입력해주세요.' } });
  }

  const user = db.prepare('SELECT * FROM users WHERE employee_id = ? AND is_active = 1').get(employee_id);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logAccess(req, 'login_failed', `사번: ${employee_id}`);
    return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '사번 또는 비밀번호가 올바르지 않습니다.' } });
  }

  req.session.user = {
    id: user.id,
    employee_id: user.employee_id,
    name: user.name,
    department: user.department,
    lab: user.lab,
    role: user.role,
  };
  req.session.lastActivity = Date.now();

  logAccess(req, 'login', `${user.name}(${user.employee_id}) 로그인`);

  const csrfToken = generateToken(req, res);

  res.json({
    success: true,
    data: {
      user: req.session.user,
      csrfToken,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  logAccess(req, 'logout', `${req.session.user.name} 로그아웃`);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '로그아웃 실패' } });
    res.clearCookie('connect.sid');
    res.json({ success: true, data: { message: '로그아웃되었습니다.' } });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const csrfToken = generateToken(req, res);
  res.json({
    success: true,
    data: { user: req.session.user, csrfToken },
  });
});

module.exports = router;
