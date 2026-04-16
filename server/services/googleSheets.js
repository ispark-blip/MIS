const fs = require('fs');
const sheetsConfig = require('../config/sheets');

class GoogleSheetsService {
  constructor(eventEmitter) {
    this.cache = { sales: null, total: null, testCounts: null, subjects: null };
    this.eventEmitter = eventEmitter;
    this.sheets = null;
    this.initialized = false;
  }

  async authenticate() {
    try {
      if (!fs.existsSync(sheetsConfig.CREDENTIALS_PATH)) {
        console.log('[Sheets] credentials.json 없음. Google Sheets 연동 비활성화.');
        return false;
      }
      if (!sheetsConfig.SPREADSHEET_ID_SALES
          && !sheetsConfig.SPREADSHEET_ID_TESTCOUNTS
          && !sheetsConfig.SPREADSHEET_ID_SUBJECTS) {
        console.log('[Sheets] SHEET_ID_* 미설정. Google Sheets 연동 비활성화.');
        return false;
      }

      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        keyFile: sheetsConfig.CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      console.log('[Sheets] Google Sheets 인증 완료');
      return true;
    } catch (err) {
      console.error('[Sheets] 인증 실패:', err.message);
      return false;
    }
  }

  // ============ 매출 ============
  async fetchSalesData() {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_SALES) return null;
    try {
      const [salesRes, totalRes] = await Promise.all([
        this.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsConfig.SPREADSHEET_ID_SALES,
          range: sheetsConfig.SHEET_RANGE_SALES,
        }),
        this.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsConfig.SPREADSHEET_ID_SALES,
          range: sheetsConfig.SHEET_RANGE_TOTAL,
        }),
      ]);
      return { sales: salesRes.data.values || [], total: totalRes.data.values || [] };
    } catch (err) {
      console.error('[Sheets] 매출 조회 실패:', err.message);
      return null;
    }
  }

  transformSalesData() {
    const total = this.cache.total?.[0] || [];
    const totalTarget = parseInt(total[1]) || 0;
    const totalActual = parseInt(total[2]) || 0;

    const departments = (this.cache.sales || []).map(row => ({
      year: parseInt(row[0]),
      quarter: row[1],
      name: row[2],
      lab: row[3],
      target_quarterly: parseInt(row[4]) || 0,
      actual_quarterly: parseInt(row[5]) || 0,
      target_annual: parseInt(row[6]) || 0,
      actual_annual: parseInt(row[7]) || 0,
    }));

    return { totalTarget, totalActual, departments };
  }

  getCachedSalesOverview(lab) {
    if (!this.cache.sales) return null;
    const data = this.transformSalesData();
    // 연간 데이터 중복 제거 (동일 부서가 여러 분기에 등장)
    const deptMap = new Map();
    for (const d of data.departments) {
      if (!deptMap.has(d.name)) deptMap.set(d.name, d);
    }
    const unique = Array.from(deptMap.values());
    const depts = lab === '전체' ? unique : unique.filter(d => d.lab === lab);
    const totalActual = depts.reduce((s, d) => s + d.actual_annual, 0);

    return {
      totalTarget: data.totalTarget,
      totalActual,
      achievementRate: data.totalTarget > 0 ? Math.round((totalActual / data.totalTarget) * 1000) / 10 : 0,
      departments: depts.map(d => ({
        name: d.name, lab: d.lab, actual: d.actual_annual, target: d.target_annual,
        ratio: totalActual > 0 ? Math.round((d.actual_annual / totalActual) * 1000) / 10 : 0,
        achievementRate: d.target_annual > 0 ? Math.round((d.actual_annual / d.target_annual) * 1000) / 10 : 0,
      })),
    };
  }

  getCachedQuarterlySales(quarter, year, lab) {
    if (!this.cache.sales) return null;
    const data = this.transformSalesData();
    let depts = data.departments.filter(d => d.quarter === quarter && d.year === year);
    if (lab !== '전체') depts = depts.filter(d => d.lab === lab);

    return {
      quarter, year,
      departments: depts.map(d => ({
        name: d.name, lab: d.lab, target: d.target_quarterly, actual: d.actual_quarterly,
        achievementRate: d.target_quarterly > 0 ? Math.round((d.actual_quarterly / d.target_quarterly) * 1000) / 10 : 0,
      })),
    };
  }

  // ============ 시험건수 (Q3) ============
  async fetchTestCountsData() {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_TESTCOUNTS) return null;
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_TESTCOUNTS,
        range: sheetsConfig.SHEET_RANGE_TESTCOUNTS,
      });
      return res.data.values || [];
    } catch (err) {
      console.error('[Sheets] 시험건수 조회 실패:', err.message);
      return null;
    }
  }

  transformTestCountsData() {
    // 시트 컬럼: 날짜 | 연구소 | 부서 | 시험유형 | 건수 | 입력자 | 비고
    return (this.cache.testCounts || [])
      .filter(row => row && row[0] && row[4])
      .map((row, idx) => ({
        id: `sheet-${idx + 1}`,
        date: row[0],
        lab: row[1] || '',
        department: row[2] || '',
        test_type: row[3] || '',
        count: parseInt(row[4]) || 0,
        submitted_by: row[5] || '',
        notes: row[6] || null,
      }));
  }

  getCachedTestCounts(month, year, lab, testType) {
    if (!this.cache.testCounts) return null;
    const all = this.transformTestCountsData();
    return all.filter(r => {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) return false;
      if (d.getFullYear() !== year) return false;
      if (d.getMonth() + 1 !== month) return false;
      if (lab && lab !== '전체' && r.lab !== lab) return false;
      if (testType && testType !== '전체' && r.test_type !== testType) return false;
      return true;
    });
  }

  // ============ 시험대상자 인원수 (Q4) ============
  async fetchSubjectsData() {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_SUBJECTS) return null;
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_SUBJECTS,
        range: sheetsConfig.SHEET_RANGE_SUBJECTS,
      });
      return res.data.values || [];
    } catch (err) {
      console.error('[Sheets] 검체수 조회 실패:', err.message);
      return null;
    }
  }

  transformSubjectsData() {
    // 시트 컬럼: 날짜 | 연구소 | 부서 | 인원수 | 과제명 | ...
    return (this.cache.subjects || [])
      .filter(row => row && row[0])
      .map(row => ({
        date: row[0],
        lab: row[1] || '',
        department: row[2] || '',
        subject_count: parseInt(row[3]) || 0,
        study_name: row[4] || null,
      }));
  }

  // ============ 폴링 ============
  async fetchAndUpdate() {
    if (!this.initialized) return;
    try {
      const [salesData, testCountsData, subjectsData] = await Promise.all([
        this.fetchSalesData(),
        this.fetchTestCountsData(),
        this.fetchSubjectsData(),
      ]);

      let changed = false;

      if (salesData) {
        const newHash = JSON.stringify(salesData);
        const oldHash = JSON.stringify({ sales: this.cache.sales, total: this.cache.total });
        if (newHash !== oldHash) {
          this.cache.sales = salesData.sales;
          this.cache.total = salesData.total;
          changed = true;
          if (this.eventEmitter) this.eventEmitter('sales-update', this.transformSalesData());
        }
      }

      if (testCountsData) {
        const newHash = JSON.stringify(testCountsData);
        const oldHash = JSON.stringify(this.cache.testCounts);
        if (newHash !== oldHash) {
          this.cache.testCounts = testCountsData;
          changed = true;
          if (this.eventEmitter) this.eventEmitter('test-count-update', { source: 'sheets' });
        }
      }

      if (subjectsData) {
        const newHash = JSON.stringify(subjectsData);
        const oldHash = JSON.stringify(this.cache.subjects);
        if (newHash !== oldHash) {
          this.cache.subjects = subjectsData;
          changed = true;
          if (this.eventEmitter) this.eventEmitter('subjects-update', { source: 'sheets' });
        }
      }

      if (changed) console.log('[Sheets] 캐시 갱신');
    } catch (err) {
      console.error('[Sheets] 폴링 에러:', err.message);
    }
  }

  startPolling(broadcastFn) {
    this.eventEmitter = broadcastFn;
    setInterval(() => this.fetchAndUpdate(), sheetsConfig.POLLING_INTERVAL_MS);
    this.fetchAndUpdate(); // 즉시 1회 실행
  }
}

module.exports = GoogleSheetsService;
