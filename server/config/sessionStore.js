const session = require('express-session');
const db = require('./database');

class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this._getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > datetime(\'now\')');
    this._setStmt = db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, datetime(?, \'unixepoch\'))');
    this._destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._cleanupStmt = db.prepare('DELETE FROM sessions WHERE expired < datetime(\'now\')');

    // 5분마다 만료 세션 정리
    setInterval(() => { try { this._cleanupStmt.run(); } catch {} }, 300000);
  }

  get(sid, cb) {
    try {
      const row = this._getStmt.get(sid);
      if (!row) return cb(null, null);
      const sess = JSON.parse(row.sess);
      if (!sess || typeof sess !== 'object' || !sess.cookie) {
        this._destroyStmt.run(sid);
        return cb(null, null);
      }
      cb(null, sess);
    } catch (err) {
      this._destroyStmt.run(sid);
      cb(null, null);
    }
  }

  set(sid, sess, cb) {
    try {
      const maxAge = sess.cookie?.maxAge || 86400000;
      const expired = Math.floor((Date.now() + maxAge) / 1000);
      this._setStmt.run(sid, JSON.stringify(sess), expired);
      if (cb) cb(null);
    } catch (err) { if (cb) cb(err); }
  }

  destroy(sid, cb) {
    try {
      this._destroyStmt.run(sid);
      if (cb) cb(null);
    } catch (err) { if (cb) cb(err); }
  }
}

module.exports = SQLiteSessionStore;
