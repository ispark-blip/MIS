const express = require('express');
const router = express.Router();

// GET /api/celebrations - 경조사 데이터 (공개)
router.get('/', (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  if (!sheetsService) {
    return res.json({ success: true, data: { birthdays: [], anniversaries: [], weddings: [], condolences: [], month: new Date().getMonth() + 1, year: new Date().getFullYear() } });
  }
  const data = sheetsService.getCachedCelebrations();
  res.json({ success: true, data });
});

module.exports = router;
