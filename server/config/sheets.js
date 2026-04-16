module.exports = {
  CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',

  // 매출/전사목표
  SPREADSHEET_ID_SALES: process.env.SHEET_ID_SALES,
  SHEET_RANGE_SALES: process.env.SHEET_RANGE_SALES || '매출현황!A2:I',
  SHEET_RANGE_TOTAL: process.env.SHEET_RANGE_TOTAL || '전사목표!A2:C',

  // 시험건수 (Q3)
  SPREADSHEET_ID_TESTCOUNTS: process.env.SHEET_ID_TESTCOUNTS,
  SHEET_RANGE_TESTCOUNTS: process.env.SHEET_RANGE_TESTCOUNTS || '시험건수!A2:G',

  // 시험대상자 인원수 (Q4)
  SPREADSHEET_ID_SUBJECTS: process.env.SHEET_ID_SUBJECTS,
  SHEET_RANGE_SUBJECTS: process.env.SHEET_RANGE_SUBJECTS || '시험대상자현황!A2:G',

  POLLING_INTERVAL_MS: parseInt(process.env.POLLING_INTERVAL) || 30000,
  CACHE_TTL_MS: 25000,
};
