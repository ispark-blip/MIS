#!/usr/bin/env node
/**
 * 가산 과거 시험일정 시트 일회성 임포트
 *
 * 별도 구글시트에 보관된 과거 기간(기본 2026-01-01 ~ 2026-07-31)의
 * 가산 시험건수/시험대상자 데이터를 읽어 data/gs-archive-import.json 으로 저장한다.
 * 서버는 기동/동기화 시 이 스냅샷을 읽어 외부 동기화 결과에 병합한다.
 * (해당 날짜는 라이브 시트 결과를 덮어쓰므로 중복 합산되지 않는다)
 *
 * 사용법:
 *   node server/scripts/import-gs-archive.js
 *   node server/scripts/import-gs-archive.js --start 2026-01-01 --end 2026-07-31
 *   node server/scripts/import-gs-archive.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const sheetsConfig = require('../config/sheets');
const { parseGsRows, GS_ARCHIVE_PATH } = require('../services/googleSheets');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    start: sheetsConfig.IMPORT_GS_DATE_START,
    end: sheetsConfig.IMPORT_GS_DATE_END,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start') opts.start = args[++i];
    else if (args[i] === '--end') opts.end = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const sheetId = sheetsConfig.IMPORT_GS_SHEET_ID;

  if (!fs.existsSync(sheetsConfig.CREDENTIALS_PATH)) {
    console.error(`credentials.json 없음: ${sheetsConfig.CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: sheetsConfig.CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`시트: ${sheetId}`);
  console.log(`기간: ${opts.start} ~ ${opts.end}\n`);

  // 실제 탭 목록 확인 (설정된 이름과 대조)
  let availableTabs = [];
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties.title',
    });
    availableTabs = meta.data.sheets.map(s => s.properties.title);
    console.log(`탭 목록: ${availableTabs.join(' | ')}\n`);
  } catch (err) {
    console.error('탭 목록 조회 실패:', err.message);
    process.exit(1);
  }

  // 일자별 누적 (여러 탭에 걸친 데이터를 합산)
  const totals = new Map(); // date -> { subject_count, test_count }

  for (const configuredTab of sheetsConfig.IMPORT_GS_TAB_NAMES) {
    // 설정된 이름이 정확히 없으면 부분 일치로 탐색 (탭명에 공백/언더바 변형이 잦음)
    let tabName = availableTabs.find(t => t === configuredTab);
    if (!tabName) {
      const key = configuredTab.replace(/[_\s]/g, '');
      tabName = availableTabs.find(t => t.replace(/[_\s]/g, '') === key);
    }
    if (!tabName) {
      console.warn(`  탭을 찾을 수 없음, 건너뜀: "${configuredTab}"`);
      continue;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tabName}'!B:H`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    const { dailyTotals, rowCounts, stats } = parseGsRows(rows);

    let kept = 0;
    for (const [date, subjectCount] of dailyTotals) {
      if (date < opts.start || date > opts.end) continue;
      const prev = totals.get(date) || { subject_count: 0, test_count: 0 };
      prev.subject_count += subjectCount;
      prev.test_count += rowCounts.get(date) || 0;
      totals.set(date, prev);
      kept++;
    }

    console.log(`  "${tabName}"`);
    console.log(`    ${rows.length}행 읽음, ${stats.parsed}행 파싱, D열빈행=${stats.skipped}, 날짜역행=${stats.dateRegression}, 날짜실패=${stats.dateFail}, 인원수없음=${stats.countMissing}`);
    console.log(`    기간 내 ${kept}일 반영`);
  }

  const entries = Array.from(totals.entries())
    .map(([date, v]) => ({ date, subject_count: v.subject_count, test_count: v.test_count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 월별 요약
  const monthly = {};
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!monthly[ym]) monthly[ym] = { days: 0, subjects: 0, tests: 0 };
    monthly[ym].days++;
    monthly[ym].subjects += e.subject_count;
    monthly[ym].tests += e.test_count;
  }

  console.log('\n월별 집계:');
  for (const [ym, v] of Object.entries(monthly)) {
    console.log(`  ${ym}  ${String(v.days).padStart(3)}일  인원 ${String(v.subjects).padStart(6)}명  시험 ${String(v.tests).padStart(5)}건`);
  }
  const totalSubjects = entries.reduce((s, e) => s + e.subject_count, 0);
  const totalTests = entries.reduce((s, e) => s + e.test_count, 0);
  console.log(`  ${'합계'.padEnd(7)} ${String(entries.length).padStart(3)}일  인원 ${String(totalSubjects).padStart(6)}명  시험 ${String(totalTests).padStart(5)}건`);

  if (opts.dryRun) {
    console.log('\n--dry-run: 파일을 저장하지 않았습니다.');
    return;
  }

  const snapshot = {
    lab: '가산',
    sourceSheetId: sheetId,
    range: { start: opts.start, end: opts.end },
    importedAt: new Date().toISOString(),
    entries,
  };

  fs.mkdirSync(path.dirname(GS_ARCHIVE_PATH), { recursive: true });
  fs.writeFileSync(GS_ARCHIVE_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`\n저장 완료: ${GS_ARCHIVE_PATH}`);
  console.log('서버를 재시작하면 대시보드에 반영됩니다.');
}

main().catch(err => {
  console.error('임포트 실패:', err.message);
  process.exit(1);
});
