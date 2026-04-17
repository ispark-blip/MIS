/**
 * KDRI MIS - SQLite 데이터베이스 초기화 스크립트
 * 실행: node seeds/init-db.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'mis.db');
const DB_DIR = path.dirname(DB_PATH);

// data/ 디렉토리가 없으면 자동 생성
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('[DB] 디렉토리 생성:', DB_DIR);
}

const db = new Database(DB_PATH);

// WAL 모드 활성화 (성능 향상)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- 사용자 테이블
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL DEFAULT '문정',
    role TEXT NOT NULL DEFAULT 'staff',
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    can_input_test_counts INTEGER NOT NULL DEFAULT 0,
    can_input_subjects INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 일일 시험건수 (Q3)
  CREATE TABLE IF NOT EXISTS daily_test_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL,
    test_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    submitted_by TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(date, department, lab, test_type)
  );

  -- 시험건수 변경 이력 (감사 추적)
  CREATE TABLE IF NOT EXISTS test_count_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_count_id INTEGER NOT NULL,
    date DATE NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL,
    test_type TEXT NOT NULL,
    old_count INTEGER,
    new_count INTEGER NOT NULL,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  );

  -- 시험대상자 인원수 (Q4)
  CREATE TABLE IF NOT EXISTS daily_subject_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    lab TEXT NOT NULL,
    department TEXT NOT NULL,
    subject_count INTEGER NOT NULL DEFAULT 0,
    study_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, lab, department, study_name)
  );

  -- 입력폼 토큰 (Q3)
  CREATE TABLE IF NOT EXISTS form_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL,
    created_by TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 접근 로그
  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT,
    ip_address TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 세션 테이블
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired DATETIME NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

  -- 앱 설정 (브랜딩/대시보드 기본값 등)
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
  );
`);

// 기본 설정값 시드 (없을 때만 INSERT)
const defaultSettings = [
  ['company_name', '한국피부과학연구원'],
  ['company_abbr', 'KIDS'],
  ['system_title', '경영정보현황시스템'],
  ['logo_url', ''],
  ['default_lab', '전체'],
  ['default_year', String(new Date().getFullYear())],
  ['default_quarter', 'Q' + Math.ceil((new Date().getMonth() + 1) / 3)],
];
const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
for (const [k, v] of defaultSettings) insertSetting.run(k, v);

// 기존 users 테이블에 권한 컬럼이 없으면 추가 (마이그레이션)
const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!cols.includes('can_input_test_counts')) {
  db.exec("ALTER TABLE users ADD COLUMN can_input_test_counts INTEGER NOT NULL DEFAULT 0");
  console.log('[DB] users 테이블에 can_input_test_counts 컬럼 추가');
}
if (!cols.includes('can_input_subjects')) {
  db.exec("ALTER TABLE users ADD COLUMN can_input_subjects INTEGER NOT NULL DEFAULT 0");
  console.log('[DB] users 테이블에 can_input_subjects 컬럼 추가');
}
// admin 역할은 기본 권한 부여
db.prepare("UPDATE users SET can_input_test_counts = 1, can_input_subjects = 1 WHERE role = 'admin' AND can_input_test_counts = 0").run();

console.log('[DB] 데이터베이스 초기화 완료:', DB_PATH);
db.close();
