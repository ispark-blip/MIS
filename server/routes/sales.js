const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/sales/overview - 전사 목표/누적 + 부서별 기여도
router.get('/overview', requireAuth, (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  const lab = req.query.lab || '전체';

  const data = sheetsService ? sheetsService.getCachedSalesOverview(lab) : null;

  if (!data) {
    return res.json({
      success: true,
      data: getDummySalesOverview(lab),
      meta: { timestamp: new Date().toISOString(), cached: true, source: 'dummy' },
    });
  }

  res.json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), cached: true, source: 'google-sheets' },
  });
});

// GET /api/sales/quarterly - 부서별 분기 매출
router.get('/quarterly', requireAuth, (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  const { q = 'Q1', year = new Date().getFullYear(), lab = '전체' } = req.query;

  const data = sheetsService ? sheetsService.getCachedQuarterlySales(q, parseInt(year), lab) : null;

  if (!data) {
    return res.json({
      success: true,
      data: getDummyQuarterlySales(q, parseInt(year), lab),
      meta: { timestamp: new Date().toISOString(), cached: true, source: 'dummy' },
    });
  }

  res.json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), cached: true, source: 'google-sheets' },
  });
});

// POST /api/sales/refresh - 수동 새로고침
router.post('/refresh', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const sheetsService = req.app.get('sheetsService');
  if (!sheetsService) {
    return res.json({ success: true, data: { message: 'Google Sheets 미연동 상태. 더미 데이터 사용 중.' } });
  }

  try {
    await sheetsService.fetchAndUpdate();
    res.json({ success: true, data: { message: '데이터 새로고침 완료' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'REFRESH_ERROR', message: err.message } });
  }
});

// 더미 매출 데이터
function getDummySalesOverview(lab) {
  const allDepts = [
    { name: '임상1팀', lab: '문정', actual: 800000000, target: 2500000000 },
    { name: '임상2팀', lab: '문정', actual: 650000000, target: 2000000000 },
    { name: '비임상팀', lab: '문정', actual: 520000000, target: 1500000000 },
    { name: '경영지원팀', lab: '문정', actual: 180000000, target: 500000000 },
    { name: '시험검사팀', lab: '가산', actual: 720000000, target: 2000000000 },
    { name: '특수시험팀', lab: '가산', actual: 330000000, target: 1500000000 },
  ];

  const departments = lab === '전체' ? allDepts : allDepts.filter(d => d.lab === lab);
  const totalTarget = departments.reduce((s, d) => s + d.target, 0);
  const totalActual = departments.reduce((s, d) => s + d.actual, 0);
  const achievementRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : 0;

  return {
    totalTarget,
    totalActual,
    achievementRate,
    departments: departments.map(d => ({
      ...d,
      ratio: totalActual > 0 ? Math.round((d.actual / totalActual) * 1000) / 10 : 0,
      achievementRate: d.target > 0 ? Math.round((d.actual / d.target) * 1000) / 10 : 0,
    })),
  };
}

function getDummyQuarterlySales(quarter, year, lab) {
  const allDepts = [
    { name: '임상1팀', lab: '문정', target: 625000000, actual: 420000000 },
    { name: '임상2팀', lab: '문정', target: 500000000, actual: 310000000 },
    { name: '비임상팀', lab: '문정', target: 375000000, actual: 280000000 },
    { name: '경영지원팀', lab: '문정', target: 125000000, actual: 95000000 },
    { name: '시험검사팀', lab: '가산', target: 500000000, actual: 380000000 },
    { name: '특수시험팀', lab: '가산', target: 375000000, actual: 190000000 },
  ];

  const departments = lab === '전체' ? allDepts : allDepts.filter(d => d.lab === lab);

  return {
    quarter,
    year,
    departments: departments.map(d => ({
      ...d,
      achievementRate: d.target > 0 ? Math.round((d.actual / d.target) * 1000) / 10 : 0,
    })),
  };
}

module.exports = router;
