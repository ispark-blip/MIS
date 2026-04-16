const fs = require('fs');
const sheetsConfig = require('../config/sheets');

class GoogleSheetsService {
  constructor(eventEmitter) {
    this.cache = { sales: null, total: null, subjects: null };
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
      if (!sheetsConfig.SPREADSHEET_ID_SALES) {
        console.log('[Sheets] SHEET_ID_SALES 미설정. Google Sheets 연동 비활성화.');
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

  async fetchSalesData() {
    if (!this.initialized) return null;
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
  }

  async fetchAndUpdate() {
    try {
      const data = await this.fetchSalesData();
      if (!data) return;

      const newHash = JSON.stringify(data);
      const oldHash = JSON.stringify({ sales: this.cache.sales, total: this.cache.total });

      if (newHash !== oldHash) {
        this.cache.sales = data.sales;
        this.cache.total = data.total;
        if (this.eventEmitter) {
          this.eventEmitter('sales-update', this.transformSalesData());
        }
      }
    } catch (err) {
      console.error('[Sheets] 폴링 에러:', err.message);
    }
  }

  transformSalesData() {
    // 시트 데이터 → 프론트엔드용 변환
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
    const depts = lab === '전체' ? data.departments : data.departments.filter(d => d.lab === lab);
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

  startPolling(broadcastFn) {
    this.eventEmitter = broadcastFn;
    setInterval(() => this.fetchAndUpdate(), sheetsConfig.POLLING_INTERVAL_MS);
    this.fetchAndUpdate(); // 즉시 1회 실행
  }
}

module.exports = GoogleSheetsService;
