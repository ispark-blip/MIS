/**
 * KDRI MIS - 초기 사용자 시드 데이터
 * 실행: node seeds/seed-users.js
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'mis.db');
const db = new Database(DB_PATH);

const users = [
  { employee_id: 'admin', name: '관리자', department: '경영지원팀', lab: '문정', role: 'admin', password: 'admin1234' },
  { employee_id: 'M001', name: '김문정', department: '임상1팀', lab: '문정', role: 'manager', password: 'test1234' },
  { employee_id: 'M002', name: '이임상', department: '임상2팀', lab: '문정', role: 'manager', password: 'test1234' },
  { employee_id: 'M003', name: '박비임', department: '비임상팀', lab: '문정', role: 'manager', password: 'test1234' },
  { employee_id: 'G001', name: '최가산', department: '시험검사팀', lab: '가산', role: 'manager', password: 'test1234' },
  { employee_id: 'G002', name: '정특수', department: '특수시험팀', lab: '가산', role: 'manager', password: 'test1234' },
  { employee_id: 'S001', name: '홍길동', department: '임상1팀', lab: '문정', role: 'staff', password: 'test1234' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (employee_id, name, department, lab, role, password_hash)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const user of users) {
    const hash = bcrypt.hashSync(user.password, 12);
    insertUser.run(user.employee_id, user.name, user.department, user.lab, user.role, hash);
  }
});

insertMany();
console.log(`[SEED] ${users.length}명의 사용자 데이터 시드 완료`);
db.close();
