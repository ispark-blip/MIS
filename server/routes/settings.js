const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAccess } = require('../middleware/logger');

const router = express.Router();

// 업로드 디렉토리 (data/uploads/)
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 설정 헬퍼
function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

function setSetting(key, value, employee_id) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `).run(key, value == null ? null : String(value), employee_id || null);
}

// 허용된 설정 키
const ALLOWED_KEYS = new Set([
  'company_name', 'company_abbr', 'system_title', 'logo_url',
  'default_lab', 'default_year', 'default_quarter',
  // 표시 숨김 (JSON 배열)
  'hidden_sales_departments', 'hidden_summary_labs', 'hidden_test_count_departments',
]);
// JSON 배열로 저장되는 키 (최대 길이 완화)
const JSON_ARRAY_KEYS = new Set([
  'hidden_sales_departments', 'hidden_summary_labs', 'hidden_test_count_departments',
]);

// GET /api/settings - 공개 (브랜딩 표시용)
router.get('/', (req, res) => {
  res.json({ success: true, data: getAllSettings() });
});

// PUT /api/settings - 관리자만
router.put('/', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const employee_id = req.session.user.employee_id;
  const updated = {};

  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(k)) continue;

    let strVal;
    if (JSON_ARRAY_KEYS.has(k)) {
      // 배열만 허용, JSON 문자열로 저장
      if (!Array.isArray(v)) continue;
      const sanitized = v.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean);
      strVal = JSON.stringify(sanitized);
      if (strVal.length > 2000) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `${k}는 2000자 이내여야 합니다.` } });
      }
    } else {
      if (typeof v !== 'string' && v !== null && typeof v !== 'number') continue;
      strVal = v == null ? '' : String(v);
      if (strVal.length > 200) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `${k}는 200자 이내여야 합니다.` } });
      }
    }
    setSetting(k, strVal, employee_id);
    updated[k] = strVal;
  }

  logAccess(req, 'settings_update', `설정 변경: ${Object.keys(updated).join(', ')}`);
  res.json({ success: true, data: getAllSettings() });
});

// GET /api/settings/filter-options - 관리자만. 가시성 설정 UI용 부서/연구소 목록
router.get('/filter-options', requireAuth, requireRole('admin'), (req, res) => {
  const { labs: LABS } = require('../config/departments');
  const sheetsService = req.app.get('sheetsService');
  let salesDepartments = [];
  if (sheetsService) {
    const set = new Set();
    for (const r of sheetsService.transformSalesData()) {
      if (r.name) set.add(r.name);
    }
    salesDepartments = Array.from(set).sort();
  }
  res.json({ success: true, data: { salesDepartments, labs: LABS } });
});

// 로고 업로드 (multer - memoryStorage 후 직접 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(new Error('이미지 파일만 업로드 가능합니다 (png/jpg/gif/webp/svg).'));
    }
    cb(null, true);
  },
});

// POST /api/settings/logo - 관리자만
router.post('/logo', requireAuth, requireRole('admin'), (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '업로드된 파일이 없습니다.' } });
    }

    const ext = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    }[req.file.mimetype] || '.png';

    const filename = `logo${ext}`;
    const targetPath = path.join(UPLOAD_DIR, filename);

    // 기존 로고 파일 삭제 (다른 확장자 잔존 방지)
    for (const e of ['.png', '.jpg', '.gif', '.webp', '.svg']) {
      const p = path.join(UPLOAD_DIR, 'logo' + e);
      if (p !== targetPath && fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }

    fs.writeFileSync(targetPath, req.file.buffer);
    const logoUrl = `/uploads/${filename}?t=${Date.now()}`;
    setSetting('logo_url', logoUrl, req.session.user.employee_id);

    logAccess(req, 'settings_logo_upload', `로고 업로드 (${req.file.size} bytes)`);
    res.json({ success: true, data: { logo_url: logoUrl } });
  });
});

// DELETE /api/settings/logo - 관리자만
router.delete('/logo', requireAuth, requireRole('admin'), (req, res) => {
  for (const e of ['.png', '.jpg', '.gif', '.webp', '.svg']) {
    const p = path.join(UPLOAD_DIR, 'logo' + e);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
  setSetting('logo_url', '', req.session.user.employee_id);
  logAccess(req, 'settings_logo_delete', '로고 삭제');
  res.json({ success: true, data: { logo_url: '' } });
});

module.exports = router;
