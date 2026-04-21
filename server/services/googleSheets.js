const fs = require('fs');
const sheetsConfig = require('../config/sheets');
const { labs: LABS_CONFIG } = require('../config/departments');
const db = require('../config/database');

// app_settings에서 숨김 대상 Set 반환 (JSON 배열 디코드)
function getHiddenSet(key) {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (!row || !row.value) return new Set();
    const arr = JSON.parse(row.value);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

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
    this.cache = { sales: null, testCounts: null, subjects: null, externalSubjects: [] };
    this._lastExternalSync = 0;
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
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
    const hiddenDepts = getHiddenSet('hidden_sales_departments');
    const visibleDepts = departments.filter(d => !hiddenDepts.has(d.name));

    return {
      totalTarget,
      totalActual,
      achievementRate: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : 0,
      departments: visibleDepts.map(d => ({
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

    const hiddenDepts = getHiddenSet('hidden_sales_departments');
    const departments = Array.from(deptMap.values()).filter(d => !hiddenDepts.has(d.name));
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
    // sheetRow: 헤더가 1행이므로 데이터 시작은 2행, idx=0 → row 2
    return (this.cache.testCounts || [])
      .map((row, idx) => ({
        _raw: row,
        _idx: idx,
        sheetRow: idx + 2,
        id: `sheet-${idx + 1}`,
        date: parseSheetDate(row[0]),
        lab: String(row[1] || '').trim(),
        department: String(row[2] || '').trim(),
        test_type: String(row[3] || '').trim(),
        count: toNum(row[4]),
        submitted_by: String(row[5] || '').trim(),
        notes: row[6] ? String(row[6]) : null,
      }))
      .filter(r => r.date && r._raw && r._raw[0] && (r._raw[4] !== undefined && r._raw[4] !== ''));
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

  _computeDateBounds(targetMonth, targetYear, targetDay) {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const y = targetYear || now.getFullYear();
    const m = targetMonth || (now.getMonth() + 1);
    const lastDay = new Date(y, m, 0).getDate();
    const actualTodayYMD = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    let day;
    if (targetDay) {
      day = Math.min(Math.max(1, parseInt(targetDay)), lastDay);
    } else {
      const isCurMonth = (y === now.getFullYear() && m === now.getMonth() + 1);
      day = isCurMonth ? now.getDate() : lastDay;
    }

    const today = `${y}-${pad2(m)}-${pad2(day)}`;
    const monthStart = `${y}-${pad2(m)}-01`;
    const yearStart = `${y}-01-01`;
    const thirtyDaysAgoMs = Date.parse(today) - 30 * 86400 * 1000;
    // 기준일이 실제 오늘과 동일한 경우만 backfill 미적용 (해당 날짜의 실제 값을 그대로 표시)
    const isCurrentMonth = (today === actualTodayYMD);
    return { today, monthStart, yearStart, thirtyDaysAgoMs, isCurrentMonth };
  }

  // 매출 데이터에서 부서 목록(이름+연구소) 추출
  _getUniqueSalesDepartments() {
    if (!this.cache.sales) return [];
    const map = new Map();
    for (const r of this.transformSalesData()) {
      if (!r.name) continue;
      if (!map.has(r.name)) map.set(r.name, { name: r.name, lab: r.lab });
    }
    return Array.from(map.values());
  }

  // 시험건수 summary - 시험대상자 자동추출 + 수기 입력 시험건수 병합
  getCachedTestCountsSummary(targetMonth, targetYear, targetDay) {
    const { today, monthStart, yearStart, thirtyDaysAgoMs, isCurrentMonth } = this._computeDateBounds(targetMonth, targetYear, targetDay);

    // --- 소스 1: 시험대상자 → 시험건수 자동 추출 (행 1개 = 건수 1건) ---
    const EXTERNAL_LAB_TO_DEPT = { '가산': '가산 임상팀', '문정': '문정 임상팀' };
    const derivedEntries = []; // { date, department, lab }
    const internalRows = this.cache.subjects ? this.transformSubjectsData() : [];
    const externalRows = this.cache.externalSubjects || [];
    for (const r of internalRows) {
      if (r.subject_count > 0 && r.department) {
        derivedEntries.push({ date: r.date, lab: r.lab, department: r.department });
      }
    }
    for (const r of externalRows) {
      const dept = EXTERNAL_LAB_TO_DEPT[r.lab];
      if (!dept) continue;
      const tc = r.test_count ?? 1;
      for (let i = 0; i < tc; i++) {
        derivedEntries.push({ date: r.date, lab: r.lab, department: dept });
      }
    }

    // --- 소스 2: 수기 입력 시험건수 시트 ---
    const manualRows = this.cache.testCounts ? this.transformTestCountsData() : [];

    if (derivedEntries.length === 0 && manualRows.length === 0) return null;

    // --- 부서 목록 수집 (매출 부서 + 추가 부서) ---
    const salesDepts = this._getUniqueSalesDepartments();
    const known = new Set(salesDepts.map(d => d.name));
    for (const e of derivedEntries) {
      if (e.department && !known.has(e.department)) {
        salesDepts.push({ name: e.department, lab: e.lab });
        known.add(e.department);
      }
    }
    for (const r of manualRows) {
      if (r.department && !known.has(r.department)) {
        salesDepts.push({ name: r.department, lab: r.lab });
        known.add(r.department);
      }
    }

    const hiddenDepts = getHiddenSet('hidden_test_count_departments');
    const visibleDepts = salesDepts.filter(d => !hiddenDepts.has(d.name));

    // --- 부서별 일별 건수 병합 ---
    const result = visibleDepts.map(({ name: department, lab }) => {
      // 일별 건수 집계 (자동추출: 건수=엔트리 수, 수기: 건수=count 합)
      const dailyCounts = new Map(); // date → count
      for (const e of derivedEntries) {
        if (e.department === department) {
          dailyCounts.set(e.date, (dailyCounts.get(e.date) || 0) + 1);
        }
      }
      for (const r of manualRows) {
        if (r.department === department) {
          dailyCounts.set(r.date, (dailyCounts.get(r.date) || 0) + r.count);
        }
      }

      let todayCount = dailyCounts.get(today) || 0;
      let todayDate = today;

      if (!isCurrentMonth && todayCount === 0) {
        let latestDate = '';
        for (const [d, c] of dailyCounts) {
          if (d >= monthStart && d <= today && c > 0 && d > latestDate) latestDate = d;
        }
        if (latestDate) {
          todayDate = latestDate;
          todayCount = dailyCounts.get(latestDate) || 0;
        }
      }

      let monthlyTotal = 0, annualTotal = 0;
      const recentMap = new Map();
      for (const [d, c] of dailyCounts) {
        if (d >= monthStart && d <= today) monthlyTotal += c;
        if (d >= yearStart && d <= today) annualTotal += c;
        const t = Date.parse(d);
        if (!isNaN(t) && t >= thirtyDaysAgoMs && d <= today) {
          recentMap.set(d, c);
        }
      }
      const recentDays = Array.from(recentMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({ date, total }));

      return { department, lab, today: todayCount, todayDate, monthlyTotal, annualTotal, recentDays };
    });

    if (targetMonth) {
      console.log(`[Sheets] 시험건수(부서별) ${targetYear||'?'}년${targetMonth}월: ${result.map(r => `${r.department}=${r.monthlyTotal}건`).join(', ')}`);
    }
    return result;
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
    // sheetRow: 헤더가 1행이므로 데이터 시작은 2행, idx=0 → row 2
    return (this.cache.subjects || [])
      .map((row, idx) => ({
        _raw: row,
        sheetRow: idx + 2,
        id: `sheet-${idx + 1}`,
        date: parseSheetDate(row[0]),
        lab: String(row[1] || '').trim(),
        department: String(row[2] || '').trim(),
        subject_count: toNum(row[3]),
        study_name: row[4] ? String(row[4]).trim() : '',
      }))
      .filter(r => r.date && r._raw && r._raw[0]);
  }

  // 시험대상자 summary (내부 시트 + 외부 동기화 데이터 병합)
  getCachedSubjectsSummary(targetMonth, targetYear, targetDay) {
    const internalRows = this.cache.subjects ? this.transformSubjectsData() : [];
    const externalRows = this.cache.externalSubjects || [];

    if (internalRows.length === 0 && externalRows.length === 0) {
      if (targetMonth) console.log(`[Sheets] 시험대상자 summary 요청 ${targetYear||'?'}년${targetMonth}월${targetDay?`/${targetDay}일`:''}: 내부=${internalRows.length}, 외부=${externalRows.length} → null 반환`);
      return null;
    }

    const allEntries = [
      ...internalRows.map(r => ({ date: r.date, lab: r.lab, department: r.department, count: r.subject_count })),
      ...externalRows.map(r => ({ date: r.date, lab: r.lab, department: '외부동기화', count: r.subject_count })),
    ];

    const { today, monthStart, yearStart, thirtyDaysAgoMs, isCurrentMonth } = this._computeDateBounds(targetMonth, targetYear, targetDay);

    const hiddenLabs = getHiddenSet('hidden_summary_labs');
    const labs = LABS_CONFIG.filter(l => !hiddenLabs.has(l));
    return labs.map(lab => {
      const labRows = allEntries.filter(r => r.lab === lab);

      let todayCount = labRows.filter(r => r.date === today).reduce((s, r) => s + r.count, 0);
      let todayDate = today;

      if (!isCurrentMonth && todayCount === 0) {
        const monthRows = labRows.filter(r => r.date >= monthStart && r.date <= today);
        if (monthRows.length > 0) {
          todayDate = monthRows.reduce((max, r) => r.date > max ? r.date : max, monthRows[0].date);
          todayCount = monthRows.filter(r => r.date === todayDate).reduce((s, r) => s + r.count, 0);
        }
      }

      const monthlyTotal = labRows.filter(r => r.date >= monthStart && r.date <= today).reduce((s, r) => s + r.count, 0);
      const annualTotal = labRows.filter(r => r.date >= yearStart && r.date <= today).reduce((s, r) => s + r.count, 0);

      const dailyMap = new Map();
      labRows
        .filter(r => { const t = Date.parse(r.date); return !isNaN(t) && t >= thirtyDaysAgoMs && r.date <= today; })
        .forEach(r => dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.count));
      const recentDays = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({ date, total }));

      const deptMap = new Map();
      labRows
        .filter(r => r.date >= monthStart && r.date <= today)
        .forEach(r => deptMap.set(r.department, (deptMap.get(r.department) || 0) + r.count));
      const departments = Array.from(deptMap.entries()).map(([department, total]) => ({ department, total }));

      if (targetMonth) {
        console.log(`[Sheets] 시험대상자 summary ${lab} ${targetYear||'?'}년${targetMonth}월: 일=${todayCount}(${todayDate}), 월=${monthlyTotal}, 연=${annualTotal}, 부서=${departments.length}건, 최근=${recentDays.length}일`);
      }
      return { lab, today: todayCount, todayDate, monthlyTotal, annualTotal, recentDays, departments };
    });
  }

  // ============ 외부 시험대상자 동기화 ============
  async syncExternalSubjects() {
    if (!this.initialized) return;
    const now = Date.now();
    if (now - this._lastExternalSync < sheetsConfig.EXTERNAL_SYNC_INTERVAL_MS) return;
    this._lastExternalSync = now;

    const results = [];
    await this._syncMjSubjects(results);
    await this._syncGsSubjects(results);

    const oldHash = JSON.stringify(this.cache.externalSubjects);
    this.cache.externalSubjects = results;
    if (JSON.stringify(results) !== oldHash) {
      console.log(`[Sheets] 외부 시험대상자 동기화: 문정+가산 ${results.length}건`);
      if (this.eventEmitter) this.eventEmitter('subjects-update', { source: 'external' });
    }
  }

  async _syncMjSubjects(results) {
    const sheetId = sheetsConfig.EXTERNAL_MJ_SHEET_ID;
    if (!sheetId) return;

    let sheetTabs;
    try {
      const meta = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties.title',
      });
      sheetTabs = meta.data.sheets.map(s => s.properties.title);
      console.log(`[Sheets] 문정 탭 목록: ${sheetTabs.join(' | ')}`);
    } catch (err) {
      console.warn('[Sheets] 문정 시트 탭 목록 조회 실패:', err.message);
      return;
    }

    const dailyTotals = new Map();
    const rowCounts = new Map();

    for (const tabName of sheetTabs) {
      if (!tabName.includes('배정표')) continue;
      const yearInfo = this._parseMjTabYear(tabName);
      if (!yearInfo) {
        console.log(`[Sheets] 문정 탭 건너뜀 (연도 파싱 불가): "${tabName}"`);
        continue;
      }

      try {
        const res = await this.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${tabName}'!A:C`,
          valueRenderOption: 'FORMATTED_VALUE',
        });
        const rows = res.data.values || [];
        let currentYear = yearInfo.startYear;
        let lastMonth = yearInfo.startMonth;
        let parsed = 0, skipped = 0;

        for (const row of rows) {
          if (!row || row.length < 3) continue;
          const dateCell = String(row[0] || '').trim();
          const divisionCell = String(row[1] || '').trim();
          const countCell = String(row[2] || '').trim();
          if (!dateCell || !countCell) continue;
          if (dateCell === '날짜' || countCell === '인원' || countCell === '미정') continue;

          const md = dateCell.match(/^(\d{1,2})\/(\d{1,2})/);
          if (!md) { skipped++; continue; }
          const month = parseInt(md[1]);
          const day = parseInt(md[2]);
          if (month < 1 || month > 12 || day < 1 || day > 31) continue;

          if (yearInfo.isRange && month < lastMonth && lastMonth >= 10 && month <= 3) {
            currentYear++;
          }
          lastMonth = month;

          const count = parseInt(countCell.replace(/[^0-9]/g, ''));
          if (isNaN(count) || count <= 0) { skipped++; continue; }

          const date = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          dailyTotals.set(date, (dailyTotals.get(date) || 0) + count);
          // 구분열(B)에 '일정변동'이면 시험건수에서만 제외 (인원수는 포함)
          if (divisionCell !== '일정변동') {
            rowCounts.set(date, (rowCounts.get(date) || 0) + 1);
          }
          parsed++;
        }
        console.log(`[Sheets] 문정 "${tabName}": ${rows.length}행 읽음, ${parsed}행 파싱, ${skipped}행 건너뜀, 연도범위=${yearInfo.startYear}~${yearInfo.endYear}`);
      } catch (err) {
        console.warn(`[Sheets] 문정 외부동기화 실패 (${tabName}):`, err.message);
      }
    }

    const monthCounts = {};
    for (const [date] of dailyTotals) {
      const ym = date.slice(0, 7);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    }
    console.log(`[Sheets] 문정 월별 분포:`, JSON.stringify(monthCounts));

    for (const [date, total] of dailyTotals) {
      results.push({ date, lab: '문정', subject_count: total, test_count: rowCounts.get(date) || 0 });
    }
  }

  async _syncGsSubjects(results) {
    const sheetId = sheetsConfig.EXTERNAL_GS_SHEET_ID;
    if (!sheetId) return;

    // 탭 자동 탐색
    let tabName = sheetsConfig.EXTERNAL_GS_TAB_NAME;
    try {
      const meta = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties.title',
      });
      const allTabs = meta.data.sheets.map(s => s.properties.title);
      console.log(`[Sheets] 가산 탭 목록: ${allTabs.join(' | ')}`);
      const found = allTabs.find(t => t.includes('시험일정'));
      if (found) tabName = found;
    } catch (err) {
      console.warn('[Sheets] 가산 탭 목록 조회 실패:', err.message);
    }
    if (!tabName) return;

    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${tabName}'!B:H`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const rows = res.data.values || [];
      const dailyTotals = new Map();
      const rowCounts = new Map();
      let parsed = 0, dateFail = 0, countMissing = 0, skipped = 0, dateRegression = 0;
      let maxDateSeen = '';

      for (const row of rows) {
        if (!row || row.length < 1) continue;
        const dateRaw = row[0];
        if (dateRaw === undefined || dateRaw === null || dateRaw === '') continue;

        const date = parseSheetDate(dateRaw);
        if (!date) { dateFail++; continue; }

        // 날짜 진행 방향 추적: 이전 날짜가 다시 나오면 재방문/추가방문으로 간주
        const isDateRegression = (date < maxDateSeen);
        if (date > maxDateSeen) maxDateSeen = date;
        if (isDateRegression) dateRegression++;

        // D열(row[2])이 비어있으면 시험건수 + 인원수 모두 제외
        const dCol = String(row[2] || '').trim();
        if (!dCol) { skipped++; continue; }

        const countRaw = row.length >= 7 ? row[6] : undefined;
        if (countRaw === undefined || countRaw === null || countRaw === '') {
          countMissing++;
          continue;
        }

        const count = typeof countRaw === 'number' ? Math.round(countRaw) : parseInt(String(countRaw).replace(/[^0-9]/g, ''));
        if (isNaN(count) || count <= 0) { countMissing++; continue; }

        // C열(row[1])에 '재방문' 포함 시 시험건수에서만 제외 (인원수는 포함)
        const cCol = String(row[1] || '');
        const isRevisit = cCol.includes('재방문');

        // 인원수는 항상 포함. 단, 날짜 역행(재방문)은 실제 방문일(maxDateSeen)에 합산
        const targetDate = isDateRegression ? maxDateSeen : date;
        dailyTotals.set(targetDate, (dailyTotals.get(targetDate) || 0) + count);
        // 시험건수: 재방문이거나 날짜가 역행하면 제외
        if (!isRevisit && !isDateRegression) {
          rowCounts.set(date, (rowCounts.get(date) || 0) + 1);
        }
        parsed++;
      }

      // 월별 분포 로그
      const monthCounts = {};
      for (const [date] of dailyTotals) {
        const ym = date.slice(0, 7);
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
      }
      console.log(`[Sheets] 가산 "${tabName}": ${rows.length}행 읽음, ${parsed}행 파싱, D열빈행=${skipped}, 날짜역행=${dateRegression}, 날짜실패=${dateFail}, 인원수없음=${countMissing}`);
      console.log(`[Sheets] 가산 월별 분포:`, JSON.stringify(monthCounts));

      for (const [date, total] of dailyTotals) {
        results.push({ date, lab: '가산', subject_count: total, test_count: rowCounts.get(date) || 0 });
      }
    } catch (err) {
      console.warn('[Sheets] 가산 외부동기화 실패:', err.message);
    }
  }

  _parseMjTabYear(tabName) {
    const range = tabName.match(/(\d{2})년(\d{1,2})월[~\-](\d{2})년(\d{1,2})월/);
    if (range) {
      return {
        startYear: 2000 + parseInt(range[1]), startMonth: parseInt(range[2]),
        endYear: 2000 + parseInt(range[3]), endMonth: parseInt(range[4]),
        isRange: true,
      };
    }
    const single = tabName.match(/(\d{2})년(\d{1,2})월/);
    if (single) {
      const year = 2000 + parseInt(single[1]);
      const month = parseInt(single[2]);
      return { startYear: year, startMonth: month, endYear: year, endMonth: month, isRange: false };
    }
    return null;
  }

  // ============ 쓰기: 시험건수 ============
  // 시트 컬럼: 날짜 | 연구소 | 부서 | 시험유형 | 건수 | 입력자 | 비고
  async appendTestCount({ date, lab, department, test_type, count, submitted_by, notes }) {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_TESTCOUNTS) return false;
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_TESTCOUNTS,
        range: sheetsConfig.SHEET_RANGE_TESTCOUNTS,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[date, lab, department, test_type, count, submitted_by || '', notes || '']],
        },
      });
      await this.fetchAndUpdate();
      return true;
    } catch (err) {
      console.error('[Sheets] 시험건수 추가 실패:', err.message);
      return false;
    }
  }

  async updateTestCountRow(rowIndex, { date, lab, department, test_type, count, submitted_by, notes }) {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_TESTCOUNTS) return false;
    try {
      const sheetName = (sheetsConfig.SHEET_RANGE_TESTCOUNTS || '시험건수!A2:G').split('!')[0];
      const range = `${sheetName}!A${rowIndex}:G${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_TESTCOUNTS,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[date, lab, department, test_type, count, submitted_by || '', notes || '']],
        },
      });
      await this.fetchAndUpdate();
      return true;
    } catch (err) {
      console.error('[Sheets] 시험건수 수정 실패:', err.message);
      return false;
    }
  }

  // ============ 쓰기: 시험대상자 ============
  // 시트 컬럼: 날짜 | 연구소 | 부서 | 인원수 | 과제명
  async appendSubject({ date, lab, department, subject_count, study_name }) {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_SUBJECTS) return false;
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_SUBJECTS,
        range: sheetsConfig.SHEET_RANGE_SUBJECTS,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[date, lab, department, subject_count, study_name || '']],
        },
      });
      await this.fetchAndUpdate();
      return true;
    } catch (err) {
      console.error('[Sheets] 시험대상자 추가 실패:', err.message);
      return false;
    }
  }

  async updateSubjectRow(rowIndex, { date, lab, department, subject_count, study_name }) {
    if (!this.initialized || !sheetsConfig.SPREADSHEET_ID_SUBJECTS) return false;
    try {
      const sheetName = (sheetsConfig.SHEET_RANGE_SUBJECTS || '시험대상자현황!A2:G').split('!')[0];
      const range = `${sheetName}!A${rowIndex}:E${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetsConfig.SPREADSHEET_ID_SUBJECTS,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[date, lab, department, subject_count, study_name || '']],
        },
      });
      await this.fetchAndUpdate();
      return true;
    } catch (err) {
      console.error('[Sheets] 시험대상자 수정 실패:', err.message);
      return false;
    }
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

      await this.syncExternalSubjects();
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
