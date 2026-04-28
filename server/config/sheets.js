const path = require('path');

// 프로젝트 루트 기준으로 credentials.json 찾기 (CWD 무관)
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const defaultCredPath = path.join(PROJECT_ROOT, 'credentials.json');
const credPath = process.env.GOOGLE_CREDENTIALS_PATH
  ? (path.isAbsolute(process.env.GOOGLE_CREDENTIALS_PATH)
      ? process.env.GOOGLE_CREDENTIALS_PATH
      : path.join(PROJECT_ROOT, process.env.GOOGLE_CREDENTIALS_PATH))
  : defaultCredPath;

module.exports = {
  CREDENTIALS_PATH: credPath,

  // 매출 (월 단위 입력 → 분기/연간 자동 집계)
  SPREADSHEET_ID_SALES: process.env.SHEET_ID_SALES,
  SHEET_RANGE_SALES: process.env.SHEET_RANGE_SALES || '매출현황!A2:F',

  // 시험건수 (Q3)
  SPREADSHEET_ID_TESTCOUNTS: process.env.SHEET_ID_TESTCOUNTS,
  SHEET_RANGE_TESTCOUNTS: process.env.SHEET_RANGE_TESTCOUNTS || '시험건수!A2:G',

  // 시험대상자 인원수 (Q4)
  SPREADSHEET_ID_SUBJECTS: process.env.SHEET_ID_SUBJECTS,
  SHEET_RANGE_SUBJECTS: process.env.SHEET_RANGE_SUBJECTS || '시험대상자현황!A2:G',

  POLLING_INTERVAL_MS: parseInt(process.env.POLLING_INTERVAL) || 30000,
  CACHE_TTL_MS: 25000,

  // 직원 정보 (경조사 - 생일/입사일)
  SPREADSHEET_ID_EMPLOYEES: process.env.SHEET_ID_EMPLOYEES || '1fyBpU7bOIEYgrWmhVkkJu6M9lZ11n6wBk6wBd7pyA-U',
  SHEET_RANGE_EMPLOYEES: process.env.SHEET_RANGE_EMPLOYEES || '인원현황!A2:Q',
  // 경조사 (결혼/부고) - 직원 시트 내 별도 탭
  SHEET_TAB_CELEBRATIONS: process.env.SHEET_TAB_CELEBRATIONS || '경조사',

  // 외부 시험대상자 시트 (자동 동기화)
  EXTERNAL_MJ_SHEET_ID: process.env.EXTERNAL_MJ_SHEET_ID || '1joJpN5F4H4nNCCkd36JuHnHIHzNyyLXwk_Lt07YZXKE',
  EXTERNAL_GS_SHEET_ID: process.env.EXTERNAL_GS_SHEET_ID || '1uCXUi_-stAe0XngwRICoElZjvgT44x8tfNIkw-af8Ow',
  EXTERNAL_GS_TAB_NAME: process.env.EXTERNAL_GS_TAB_NAME || '____________26년 1월부터 시험일정_________________의 사본',
  EXTERNAL_SYNC_INTERVAL_MS: parseInt(process.env.EXTERNAL_SYNC_INTERVAL) || 30 * 60 * 1000,
};
