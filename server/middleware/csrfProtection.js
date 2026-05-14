const { doubleCsrf } = require('csrf-csrf');

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'kdri-csrf-secret',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

module.exports = { doubleCsrfProtection, generateToken };
