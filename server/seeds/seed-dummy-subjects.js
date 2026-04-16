/**
 * Q4 시험대상자 더미 데이터 생성
 * 실행: node seeds/seed-dummy-subjects.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'mis.db');
const db = new Database(DB_PATH);

const labDepts = {
  '문정': ['임상1팀', '임상2팀', '비임상팀'],
  '가산': ['시험검사팀', '특수시험팀'],
};

const insert = db.prepare(`
  INSERT OR IGNORE INTO daily_subject_counts (date, lab, department, subject_count, study_name)
  VALUES (?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  const now = new Date();
  // 최근 3개월 데이터 생성
  for (let monthOffset = -2; monthOffset <= 0; monthOffset++) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    const lastDay = monthOffset === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

    for (let day = 1; day <= lastDay; day++) {
      // 주말 건너뛰기
      const dateObj = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
      if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;

      const dateStr = dateObj.toISOString().split('T')[0];

      for (const [lab, departments] of Object.entries(labDepts)) {
        const labCode = lab === '문정' ? 'MJ' : 'GS';
        for (let dIdx = 0; dIdx < departments.length; dIdx++) {
          const dept = departments[dIdx];
          const deptCode = dept.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 4);
          const count = Math.floor(Math.random() * 26) + 5; // 5~30명
          const studyName = `STUDY-${labCode}-${deptCode}-${String(dIdx + 1).padStart(3, '0')}`;
          insert.run(dateStr, lab, dept, count, studyName);
        }
      }
    }
  }
});

insertMany();
console.log('[SEED] Q4 시험대상자 더미 데이터 생성 완료');
db.close();
