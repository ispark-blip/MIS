const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');
const { generateToken } = require('../middleware/csrfProtection');

const router = express.Router();

// 로그인 실패 추적: IP + 사번 기준, 15분 내 10회 초과 시 차단
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 10;
const loginAttempts = new Map(); // key → { count, firstAt }

function getAttemptKey(req, employeeId) {
  return `${req.ip}|${employeeId || ''}`;
}

function checkLoginLock(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return { locked: false };
  if (Date.now() - entry.firstAt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
    return { locked: false };
  }
  if (entry.count >= LOGIN_ATTEMPT_MAX) {
    const retryInSec = Math.ceil((LOGIN_ATTEMPT_WINDOW_MS - (Date.now() - entry.firstAt)) / 1000);
    return { locked: true, retryInSec };
  }
  return { locked: false };
}

function recordLoginFailure(key) {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count++;
  }
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

// 1시간마다 만료된 항목 정리
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (now - entry.firstAt > LOGIN_ATTEMPT_WINDOW_MS) loginAttempts.delete(key);
  }
}, 60 * 60 * 1000);

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '사번과 비밀번호를 입력해주세요.' } });
  }

  const attemptKey = getAttemptKey(req, employee_id);
  const lock = checkLoginLock(attemptKey);
  if (lock.locked) {
    logAccess(req, 'login_locked', `사번: ${employee_id} (잠금, ${lock.retryInSec}초 후 재시도)`);
    return res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: `로그인 시도가 너무 많습니다. ${Math.ceil(lock.retryInSec / 60)}분 후 다시 시도해주세요.`,
      },
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE employee_id = ? AND is_active = 1').get(employee_id);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFailure(attemptKey);
    logAccess(req, 'login_failed', `사번: ${employee_id}`);
    return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: '사번 또는 비밀번호가 올바르지 않습니다.' } });
  }

  clearLoginAttempts(attemptKey);

  req.session.user = {
    id: user.id,
    employee_id: user.employee_id,
    name: user.name,
    department: user.department,
    lab: user.lab,
    role: user.role,
    can_input_test_counts: user.can_input_test_counts,
    can_input_subjects: user.can_input_subjects,
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
