// 인증 미들웨어
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } });
  }
  // idle timeout 30분 체크
  const now = Date.now();
  if (req.session.lastActivity && now - req.session.lastActivity > 30 * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ success: false, error: { code: 'SESSION_EXPIRED', message: '세션이 만료되었습니다. 다시 로그인해주세요.' } });
  }
  req.session.lastActivity = now;
  next();
}

// 역할 기반 접근 제어
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
