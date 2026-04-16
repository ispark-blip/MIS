const db = require('../config/database');

const insertLog = db.prepare(`
  INSERT INTO access_logs (employee_id, ip_address, action, detail)
  VALUES (?, ?, ?, ?)
`);

function logAccess(req, action, detail) {
  try {
    insertLog.run(
      req.session?.user?.employee_id || 'anonymous',
      req.ip || req.connection?.remoteAddress || 'unknown',
      action,
      detail || null
    );
  } catch (err) {
    console.error('[LOG ERROR]', err.message);
  }
}

module.exports = { logAccess };
