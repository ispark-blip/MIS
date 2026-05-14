const express = require('express');

const router = express.Router();

// GET /api/events - SSE 스트림 (공개)
router.get('/', (req, res) => {
  const sseManager = req.app.get('sseManager');
  sseManager.addClient(req, res);
});

module.exports = router;
