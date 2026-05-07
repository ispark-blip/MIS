const express = require('express');
const getDepartments = require('../config/getDepartments');

const router = express.Router();

// GET /api/config/departments - 부서/연구소/시험유형 공통 config (공개)
// 매 요청마다 departments.js를 새로 읽어 서버 재시작 없이 변경 반영
router.get('/departments', (req, res) => {
  const { labs, departments, testTypes } = getDepartments();
  res.json({
    success: true,
    data: { labs, departments, testTypes },
  });
});

module.exports = router;
