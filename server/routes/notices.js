const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  const data = sheetsService && sheetsService.getCachedNotices ? sheetsService.getCachedNotices() : [];
  res.json({ success: true, data });
});

module.exports = router;
