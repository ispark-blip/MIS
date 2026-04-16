const fs = require('fs');
const sheetsConfig = require('../config/sheets');

// 쉼표 포함 문자열/숫자를 안전하게 숫자로 변환
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// 구글시트 날짜 셀을 YYYY-MM-DD 문자열로 변환
// - UNFORMATTED_VALUE 옵션 사용 시 숫자(1899-12-30 기준 시리얼) 로 돌아옴
// - 문자열이면 Date 파싱 시도 (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD 등)
function parseSheetDate(v) {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'number' && isFinite(v)) {
    // 구글시트 시리얼: 1899-12-30 기준, 소수부는 시각
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  const s = String(v).trim().replace(/[./]/g, '-').replace(/\s+/g, '');
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // 시간대 이슈 방지를 위해 로컬 기준 YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

class GoogleSheetsService {
  constructor(eventEmitter) {
    this.cache = { sales: null, testCounts: null, subjects: null };
    this.eventEmitter = eventEmitter;
    this.sheets = null;
    this.initialized = false;
  }

  async authenticate() {
    try {
      if (!fs.existsSync(sheetsConfig.CREDENTIALS_PATH)) {
        console.log(`[Sheets] credentials.json 없음 (찾는 경로: ${sheetsConfig.CREDENTIALS_PATH}). Google Sheets 연동 비활성화.`);
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
      const salesRes = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_SALES,
        range: sheetsConfig.SHEET_RANGE_SALES,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      return { sales: salesRes.data.values || [] };
    } catch (err) {
      console.error('[Sheets] 매출 조회 실패:', err.message);
      return null;
    }
  }

  // 시트 컬럼: 연도 | 월 | 부서명 | 연구소 | 월목표 | 월실적
  transformSalesData() {
    return (this.cache.sales || [])
      .filter(row => row && row[0] && row[1] && row[2] && row[3])
      .map(row => ({
        year: toNum(row[0]),
        month: toNum(row[1]),
        name: String(row[2]).trim(),
        lab: String(row[3]).trim(),
        target_monthly: toNum(row[4]),
        actual_monthly: toNum(row[5]),
      }))
      .filter(r => r.year > 0 && r.month >= 1 && r.month <= 12);
  }

  getCachedSalesOverview(lab, year) {
    if (!this.cache.sales) return null;
    const targetYear = year || new Date().getFullYear();
    const rows = this.transformSalesData().filter(r => r.year === targetYear);

    // 부서별 연간 합계
    const deptMap = new Map();
    for (const r of rows) {
      if (lab !== '전체' && r.lab !== lab) continue;
      if (!deptMap.has(r.name)) {
        deptMap.set(r.name, { name: r.name, lab: r.lab, target: 0, actual: 0 });
      }
      const d = deptMap.get(r.name);
      d.target += r.target_monthly;
      d.actual += r.actual_monthly;
    }

    const departments = Array.from(deptMap.values());
    const totalTarget = departments.reduce((s, d) => s + d.target, 0);
    const totalActual = departments.reduce((s, d) => s + d.actual, 0);

    return {
      totalTarget,
      totalActual,
      achievementRate: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : 0,
      departments: departments.map(d => ({
        name: d.name,
        lab: d.lab,
        actual: d.actual,
        target: d.target,
        ratio: totalActual > 0 ? Math.round((d.actual / totalActual) * 1000) / 10 : 0,
        achievementRate: d.target > 0 ? Math.round((d.actual / d.target) * 1000) / 10 : 0,
      })),
    };
  }

  getCachedQuarterlySales(quarter, year, lab) {
    if (!this.cache.sales) return null;
    const quarterMonths = { Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12] };
    const months = quarterMonths[quarter] || [];

    const rows = this.transformSalesData().filter(r => r.year === year && months.includes(r.month));

    // 부서별 분기 합계
    const deptMap = new Map();
    for (const r of rows) {
      if (lab !== '전체' && r.lab !== lab) continue;
      if (!deptMap.has(r.name)) {
        deptMap.set(r.name, { name: r.name, lab: r.lab, target: 0, actual: 0 });
      }
      const d = deptMap.get(r.name);
      d.target += r.target_monthly;
      d.actual += r.actual_monthly;
    }

    const departments = Array.from(deptMap.values());
    return {
      quarter,
      year,
      departments: departments.map(d => ({
        name: d.name,
        lab: d.lab,
        target: d.target,
        actual: d.actual,
        achievementRate: d.target > 0 ? Math.round((d.actual / d.target) * 1000) / 10 : 0,
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
        valueRenderOption: 'UNFORMATTED_VALUE',
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
      .filter(row => row && row[0] && (row[4] !== undefined && row[4] !== ''))
      .map((row, idx) => ({
        id: `sheet-${idx + 1}`,
        date: parseSheetDate(row[0]),
        lab: String(row[1] || '').trim(),
        department: String(row[2] || '').trim(),
        test_type: String(row[3] || '').trim(),
        count: toNum(row[4]),
        submitted_by: String(row[5] || '').trim(),
        notes: row[6] ? String(row[6]) : null,
      }))
      .filter(r => r.date); // 날짜 파싱 실패 행 제외
  }

  getCachedTestCounts(month, year, lab, testType) {
    if (!this.cache.testCounts) return null;
    const all = this.transformTestCountsData();
    return all.filter(r => {
      // r.date === 'YYYY-MM-DD'
      const [y, m] = r.date.split('-').map(Number);
      if (y !== year) return false;
      if (m !== month) return false;
      if (lab && lab !== '전체' && r.lab !== lab) return false;
      if (testType && testType !== '전체' && r.test_type !== testType) return false;
      return true;
    });
  }

  // 시험건수 summary (시험대상자 summary 와 동일 형식: 연구소별 today/월/연/최근30일/부서별)
  getCachedTestCountsSummary() {
    if (!this.cache.testCounts) return null;
    const rows = this.transformTestCountsData();
    if (rows.length === 0) return null;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const today = `${y}-${String(m).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const yearStart = `${y}-01-01`;
    const thirtyDaysAgoMs = Date.parse(today) - 30 * 86400 * 1000;

    const labs = ['문정', '가산'];
    return labs.map((lab) => {
      const labRows = rows.filter(r => r.lab === lab);

      const todayCount = labRows.filter(r => r.date === today)
        .reduce((s, r) => s + r.count, 0);

      const monthlyTotal = labRows.filter(r => r.date >= monthStart && r.date <= today)
        .reduce((s, r) => s + r.count, 0);

      const annualTotal = labRows.filter(r => r.date >= yearStart && r.date <= today)
        .reduce((s, r) => s + r.count, 0);

      const dailyMap = new Map();
      labRows
        .filter(r => {
          const t = Date.parse(r.date);
          return !isNaN(t) && t >= thirtyDaysAgoMs && r.date <= today;
        })
        .forEach(r => dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.count));
      const recentDays = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({ date, total }));

      const deptMap = new Map();
      labRows
        .filter(r => r.date >= monthStart && r.date <= today)
        .forEach(r => deptMap.set(r.department, (deptMap.get(r.department) || 0) + r.count));
      const departments = Array.from(deptMap.entries()).map(([department, total]) => ({ department, total }));

      return { lab, today: todayCount, monthlyTotal, annualTotal, recentDays, departments };
    });
  }

  // ============ 시험대상자 인원수 (Q4) ============
  async fetchSubjectsData() {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_SUBJECTS) return null;
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_SUBJECTS,
        range: sheetsConfig.SHEET_RANGE_SUBJECTS,
        valueRenderOption: 'UNFORMATTED_VALUE',
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
        date: parseSheetDate(row[0]),
        lab: String(row[1] || '').trim(),
        department: String(row[2] || '').trim(),
        subject_count: toNum(row[3]),
        study_name: row[4] ? String(row[4]) : null,
      }))
      .filter(r => r.date);
  }

  // 시험대상자 summary 를 시트 기반으로 집계 (연구소별 오늘/월누적/연누적/최근30일/부서별)
  getCachedSubjectsSummary() {
    if (!this.cache.subjects) return null;
    const rows = this.transformSubjectsData();
    if (rows.length === 0) return null;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const today = `${y}-${String(m).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const yearStart = `${y}-01-01`;
    const thirtyDaysAgoMs = Date.parse(today) - 30 * 86400 * 1000;

    const labs = ['문정', '가산'];
    return labs.map((lab) => {
      const labRows = rows.filter(r => r.lab === lab);

      const todayCount = labRows.filter(r => r.date === today)
        .reduce((s, r) => s + r.subject_count, 0);

      const monthlyTotal = labRows.filter(r => r.date >= monthStart && r.date <= today)
        .reduce((s, r) => s + r.subject_count, 0);

      const annualTotal = labRows.filter(r => r.date >= yearStart && r.date <= today)
        .reduce((s, r) => s + r.subject_count, 0);

      // 최근 30일 (날짜별 합계)
      const dailyMap = new Map();
      labRows
        .filter(r => {
          const t = Date.parse(r.date);
          return !isNaN(t) && t >= thirtyDaysAgoMs && r.date <= today;
        })
        .forEach(r => dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.subject_count));
      const recentDays = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({ date, total }));

      // 당월 부서별 누적
      const deptMap = new Map();
      labRows
        .filter(r => r.date >= monthStart && r.date <= today)
        .forEach(r => deptMap.set(r.department, (deptMap.get(r.department) || 0) + r.subject_count));
      const departments = Array.from(deptMap.entries()).map(([department, total]) => ({ department, total }));

      return { lab, today: todayCount, monthlyTotal, annualTotal, recentDays, departments };
    });
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
        const newHash = JSON.stringify(salesData.sales);
        const oldHash = JSON.stringify(this.cache.sales);
        if (newHash !== oldHash) {
          this.cache.sales = salesData.sales;
          changed = true;
          if (this.eventEmitter) this.eventEmitter('sales-update', { source: 'sheets' });
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
