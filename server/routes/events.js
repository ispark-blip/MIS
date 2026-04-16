const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/events - SSE 스트림
router.get('/', requireAuth, (req, res) => {
  const sseManager = req.app.get('sseManager');
  sseManager.addClient(req, res);
});

module.exports = router;
