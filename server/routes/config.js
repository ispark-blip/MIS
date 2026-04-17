const express = require('express');
const { labs, departments, testTypes } = require('../config/departments');

const router = express.Router();

// GET /api/config/departments - 부서/연구소/시험유형 공통 config (공개)
router.get('/departments', (req, res) => {
  res.json({
    success: true,
    data: { labs, departments, testTypes },
  });
});

module.exports = router;
