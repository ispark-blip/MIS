const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

// 경조사 데이터를 KIDS 인사관리시스템에서 가져온다.
//   .env 에 KIDS_CELEB_URL 설정 (KIDS 관리자 → 축하 발송 → 🔗 대시보드 연동의 URL, key 포함)
//   예) KIDS_CELEB_URL=https://hr.example.or.kr/api/public/celebrations?key=xxxxxxxx
const KIDS_CELEB_URL = process.env.KIDS_CELEB_URL || '';

// 응답 캐시 (5분) — KIDS 일시 장애 시 마지막 데이터 유지
let _cache = { at: 0, data: null };
const CACHE_MS = 5 * 60 * 1000;

function emptyPayload() {
  const now = new Date();
  return { birthdays: [], newHires: [], anniversaries: [], weddings: [], condolences: [], month: now.getMonth() + 1, year: now.getFullYear() };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const reqq = lib.get(url, { timeout: 8000 }, (r) => {
      let body = '';
      r.on('data', (c) => (body += c));
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON parse 실패: ' + e.message)); } });
    });
    reqq.on('error', reject);
    reqq.on('timeout', () => reqq.destroy(new Error('timeout')));
  });
}

// GET /api/celebrations - 경조사 데이터 (공개) — KIDS 인사관리시스템 연동
router.get('/', async (req, res) => {
  // 1) KIDS 우선 (설정돼 있으면)
  if (KIDS_CELEB_URL) {
    if (_cache.data && Date.now() - _cache.at < CACHE_MS) {
      return res.json({ success: true, data: _cache.data, source: 'kids-cache' });
    }
    try {
      const j = await fetchJson(KIDS_CELEB_URL);
      const data = (j && j.data) ? j.data : emptyPayload();
      _cache = { at: Date.now(), data };
      return res.json({ success: true, data, source: 'kids' });
    } catch (e) {
      console.error('[celebrations] KIDS 조회 실패, 폴백:', e.message);
      if (_cache.data) return res.json({ success: true, data: _cache.data, source: 'kids-cache-stale' });
      // 폴백 계속 ↓ (기존 구글시트 → 빈 데이터)
    }
  }

  // 2) 폴백 — 기존 구글시트 서비스 (KIDS_CELEB_URL 미설정 또는 KIDS 장애 시)
  const sheetsService = req.app.get('sheetsService');
  if (sheetsService) {
    return res.json({ success: true, data: sheetsService.getCachedCelebrations(), source: 'sheets' });
  }
  return res.json({ success: true, data: emptyPayload(), source: 'empty' });
});

module.exports = router;
