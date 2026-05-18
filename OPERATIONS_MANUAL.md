# KDRI MIS 대시보드 운영 매뉴얼

> 관리자용 운영 가이드 — 대시보드 설정 / DB / 배포 / 문제해결

---

## 1. 시스템 개요

### 1.1 구성 요소
| 영역 | 기술 | 위치 |
|---|---|---|
| 프론트엔드 | React 18 + Vite + Zustand | `client/` |
| 백엔드 | Node.js + Express | `server/` |
| DB | SQLite (better-sqlite3) | `data/mis.db` |
| 외부 데이터 | Google Sheets API | 인원현황 / 매출 / 시험건수 등 |
| 프로세스 | PM2 | `ecosystem.config.js` |
| 리버스 프록시 | nginx | `/etc/nginx/sites-available/mis-dashboard` |
| 관리 UI | Cockpit (선택) | `https://서버IP:9090` |

### 1.2 디렉토리 구조 (프로덕션 `~/dashboard/`)
```
~/dashboard/
├── client/                # 프론트엔드 소스
│   └── dist/              # 빌드 산출물 (nginx가 서빙)
├── server/
│   ├── app.js             # Express 진입점
│   ├── routes/            # API 라우트
│   ├── services/          # Google Sheets 등
│   ├── config/            # DB, 부서 설정
│   ├── middleware/        # 인증, 로깅
│   └── seeds/             # 초기 사용자 시드
├── data/
│   ├── mis.db             # SQLite DB
│   └── uploads/           # 로고 등 업로드 파일
├── credentials/           # Google 서비스 계정 키
└── ecosystem.config.js    # PM2 설정
```

---

## 2. 서비스 관리

### 2.1 PM2 (백엔드)
```bash
pm2 status                          # 프로세스 상태
pm2 logs kdri-mis --lines 50   # 최근 로그
pm2 logs kdri-mis --err        # 에러 로그만
pm2 restart kdri-mis           # 재시작
pm2 reload kdri-mis            # 무중단 재시작
pm2 stop kdri-mis              # 정지
pm2 start ecosystem.config.js       # 시작
pm2 save                            # 부팅 자동시작 등록
```

### 2.2 nginx (정적 파일 + 프록시)
```bash
sudo nginx -t                       # 설정 문법 검사
sudo systemctl reload nginx         # 설정 재적용 (무중단)
sudo systemctl restart nginx        # 완전 재시작
sudo systemctl status nginx         # 상태 확인
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

설정 위치: `/etc/nginx/sites-available/mis-dashboard`
활성화 심볼릭링크: `/etc/nginx/sites-enabled/mis-dashboard`

---

## 3. 배포 (코드 업데이트)

### 3.1 일반 배포 절차
```bash
cd ~/dashboard

# 1. 최신 코드 받기
git pull origin main

# 2. 서버 의존성 (package.json 변경 있을 때)
cd server && npm install && cd ..

# 3. 클라이언트 재빌드
cd client && npm install && npm run build && cd ..

# 4. 서버 재시작
pm2 restart kdri-mis

# 5. 상태 확인
pm2 logs kdri-mis --lines 30
```

### 3.2 빠른 배포 (서버 코드만 변경)
```bash
cd ~/dashboard && git pull && pm2 restart kdri-mis
```

### 3.3 빠른 배포 (클라이언트 코드만 변경)
```bash
cd ~/dashboard && git pull && cd client && npm run build
```
nginx는 재시작 불필요 — 빌드 즉시 반영.

---

## 4. 데이터베이스 관리

### 4.1 DB 접속
```bash
sqlite3 ~/dashboard/data/mis.db
```

자주 쓰는 명령:
```sql
.tables                              -- 테이블 목록
.schema users                        -- 테이블 구조
SELECT * FROM users;                 -- 사용자 목록
SELECT key, value FROM app_settings; -- 설정 확인
.quit
```

### 4.2 주요 테이블
| 테이블 | 용도 |
|---|---|
| `users` | 사용자 계정 / 권한 |
| `app_settings` | 시스템 설정 (회사명, 로고, 표시 숨김 등) |
| `daily_test_counts` | 시험건수 (시트 미연동 시 사용) |
| `daily_subject_counts` | 시험대상자 (시트 미연동 시 사용) |
| `access_logs` | 사용자 활동 로그 |
| `test_count_audit_log` | 시험건수 변경 이력 |

### 4.3 백업
```bash
# 수동 백업
cp ~/dashboard/data/mis.db ~/backups/mis-$(date +%Y%m%d-%H%M).db

# 자동 백업 (cron 등록)
crontab -e
# 매일 03시 백업
0 3 * * * cp ~/dashboard/data/mis.db ~/backups/mis-$(date +\%Y\%m\%d).db
# 30일 이상 백업 삭제
30 3 * * * find ~/backups -name "mis-*.db" -mtime +30 -delete
```

### 4.4 DB 복원
```bash
pm2 stop kdri-mis
cp ~/backups/mis-20260518.db ~/dashboard/data/mis.db
pm2 start kdri-mis
```

---

## 5. 사용자 관리

### 5.1 초기 사용자 시드 (최초 1회)
```bash
cd ~/dashboard/server
node seeds/seed-users.js
```

기본 계정:
- `admin` / `admin1234` — 관리자
- `M001`~`M003` / `test1234` — 매니저
- `G001`, `G002` / `test1234` — 매니저
- `S001` / `test1234` — 일반사용자

> **즉시 admin 비밀번호 변경 필수**

### 5.2 사용자 추가 (DB 직접)
```bash
node -e "
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('./data/mis.db');
const hash = bcrypt.hashSync('새비밀번호', 12);
db.prepare(\`
  INSERT INTO users (employee_id, name, department, lab, role, password_hash)
  VALUES (?, ?, ?, ?, ?, ?)
\`).run('S002', '홍길동', '임상1팀', '문정', 'staff', hash);
"
```

### 5.3 비밀번호 초기화
```bash
node -e "
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('./data/mis.db');
db.prepare('UPDATE users SET password_hash = ? WHERE employee_id = ?')
  .run(bcrypt.hashSync('새비밀번호', 12), 'admin');
"
```

### 5.4 권한 (role)
| role | 권한 |
|---|---|
| `admin` | 모든 권한 (관리자 페이지 접근, 모든 데이터 입력/수정) |
| `manager` | 본인 소속 부서 데이터 입력/수정 |
| `staff` | 본인 소속 부서 데이터 입력만 |

---

## 6. 대시보드 설정 (관리자 UI)

`/admin` 으로 접속 (admin 계정 필요)

### 6.1 시스템 설정 탭
- **회사명 / 약칭 / 시스템 제목** — 헤더와 로그인 화면에 표시
- **로고 업로드** — PNG/JPG/GIF/WebP/SVG, 최대 2MB
- **기본 연구소 / 기본 연도 / 기본 분기** — 첫 진입 시 선택값

### 6.2 표시 설정 탭 (가시성)
| 설정 | 영향 영역 |
|---|---|
| 매출 부서 숨김 | Q1 도넛 차트, 부서 목록 |
| 시험건수 부서 숨김 | Q3 카드 |
| 인원 연구소 숨김 | Q4 카드 |
| Q1 패널 숨김 (한피연/얼트루) | Q1 좌/우 패널 |

> **중요**: Q1 패널 숨김(`hidden_q1_entities`)과 매출 부서 숨김(`hidden_sales_departments`)은 다릅니다. 부서를 숨겨도 한피연/얼트루 **합계는 유지**됩니다 (66df0d4 수정사항).

### 6.3 설정 키 직접 확인/수정 (SQL)
```sql
-- 전체 설정 확인
SELECT key, value FROM app_settings;

-- 특정 설정 수정
UPDATE app_settings SET value = '문정' WHERE key = 'default_lab';

-- Q1 패널 숨김 초기화
UPDATE app_settings SET value = '[]' WHERE key = 'hidden_q1_entities';
```

---

## 7. Google Sheets 연동

### 7.1 서비스 계정 키 위치
```
~/dashboard/credentials/service-account.json
```
환경변수 `GOOGLE_APPLICATION_CREDENTIALS`로 지정.

### 7.2 시트 ID 환경변수 (`server/.env`)
```bash
SPREADSHEET_ID_SALES=...           # 매출 시트
SPREADSHEET_ID_QUARTERLY=...       # 분기 매출 시트
SPREADSHEET_ID_SUBJECTS=...        # 시험대상자 시트
SPREADSHEET_ID_TEST_COUNTS=...     # 시험건수 시트
SPREADSHEET_ID_HR=...              # 인원현황 (경조사·공지사항·근무지)

SHEET_TAB_NOTICES=공지사항
SHEET_TAB_CELEBRATIONS=경조사
```

### 7.3 시트 탭 구조
**인원현황 (HR)**
- `인원현황` — A: 사번 / B: 이름 / ... / M: 근무지
- `경조사` — A: 사번 / B: 이름 / C: 카테고리 / D: 대상 / E: 근무지 / F: 일자 / G: 상세 / H: 표시여부
- `공지사항` — A: 일자 / B: 카테고리 / C: 제목 / D: 내용 / E: 작성자

**매출** (열 비어도 lab으로 자동 매핑)
- A: 연도 / B: 월 / C: 부서 / D: 연구소 / E: 목표 / F: 실적

### 7.4 시트 데이터 캐시 갱신
시트 데이터는 5분마다 자동 갱신. 즉시 갱신 필요 시:
```bash
pm2 restart kdri-mis
```

### 7.5 데이터 디버그 엔드포인트
- `GET /api/test-counts/debug?lab=문정&month=5&year=2026` — 시험건수 원본 비교
- `GET /api/subjects/debug?lab=문정&month=5&year=2026` — 시험대상자 원본 비교

### 7.6 외부 시트 동기화 (가산 / 문정)

**가산 / 문정 임상팀의 시험건수·인원수는 별도 외부 시트에서 자동 동기화** 합니다.
(내부 `시험대상자현황` 시트와는 분리)

| 항목 | 가산 | 문정 |
|---|---|---|
| 시트 ID 환경변수 | `EXTERNAL_GS_SHEET_ID` | `EXTERNAL_MJ_SHEET_ID` |
| 탭 자동 탐색 키워드 | `시험일정` 포함 | 연도범위 (예: `25년1월~25년12월`) |
| 사용 열 | B~H | (탭마다 다름) |
| 인원수 열 | G열 (row[6]) | — |
| 필수 열 | D열 (row[2]) 비면 스킵 | D열 비면 스킵 |
| 시험건수 제외 조건 | C열에 "재방문" 포함, 또는 날짜 역행 | B열이 "일정변동" |

> **외부 동기화가 있는 연구소는 내부 시트의 데이터를 자동 제외**합니다 (이중 집계 방지).
> 따라서 가산/문정 시험건수가 0이면 외부 시트 문제일 가능성이 큽니다.

### 7.7 가산 시험건수 진단 절차

**Step 1: 환경변수 확인**
```bash
cd ~/dashboard/server
grep EXTERNAL_GS .env
# 출력: EXTERNAL_GS_SHEET_ID=1uCXUi_-stAe0XngwRICoElZjvgT44x8tfNIkw-af8Ow
```
값이 없으면 `.env`에 추가 후 `pm2 restart kdri-mis`.

**Step 2: 서비스 계정 권한 확인**
- 가산 시트를 브라우저로 열기 (시트 ID로 URL 구성)
- `공유` 클릭 → 서비스 계정 이메일(`credentials/service-account.json` 내 `client_email`)이 **뷰어 이상** 권한으로 포함되어 있어야 함
- 권한 없으면 시트 소유자에게 추가 요청

**Step 3: PM2 로그에서 동기화 결과 확인**
```bash
pm2 logs kdri-mis --lines 500 --nostream | grep -i "가산"
```
정상 출력 예시:
```
[Sheets] 가산 탭 목록: 시험일정_2026 | ...
[Sheets] 가산 "시험일정_2026": 250행 읽음, 180행 파싱, D열빈행=30, 날짜역행=5, 날짜실패=0, 인원수없음=35
[Sheets] 가산 월별 분포: {"2026-04":22,"2026-05":18}
[Sheets] 외부 시험대상자 동기화: 문정+가산 198건
```

| 로그 패턴 | 의미 / 조치 |
|---|---|
| `가산 탭 목록 조회 실패` | 시트 ID 오타 또는 권한 없음 → Step 2 |
| `가산 외부동기화 실패: PERMISSION_DENIED` | 서비스 계정 공유 안 됨 → Step 2 |
| `시험일정` 탭이 목록에 없음 | 탭명에 "시험일정" 키워드 포함되어야 자동 탐색됨 |
| `D열빈행=대부분` | D열(부서/구분) 비어있는 데이터 → 시트 입력 확인 |
| `인원수없음=대부분` | G열(인원수) 비어있음 → 시트 입력 확인 |
| `날짜실패=대부분` | A열(날짜) 형식 오류 → YYYY-MM-DD 또는 시리얼 숫자 |
| `월별 분포에 해당 월 없음` | 그 달 데이터 자체가 시트에 없음 |
| 로그 자체가 안 나옴 | sheetsService 초기화 실패 → 인증 점검 |

**Step 4: API 응답 직접 확인**
```bash
# 디버그 엔드포인트
curl "http://localhost:3000/api/test-counts/debug?lab=가산&month=5&year=2026"

# 응답 예시
{
  "lab": "가산",
  "externalSyncLabs": ["문정", "가산"],
  "activeSource": "외부동기화만 사용 (내부 제외)",
  "external_derived": [{ "date": "2026-05-15", "lab": "가산", "test_count": 5, ... }]
}
```
- `externalSyncLabs`에 "가산" 없으면 → 외부 시트 동기화 실패 (로그 확인)
- `external_derived` 비어있으면 → 해당 월 데이터 없음 또는 파싱 실패

**Step 5: 시트 데이터 직접 점검 (구글시트)**
가산 시트에서 다음 사항 확인:
1. **탭명**에 "시험일정" 키워드 포함 (예: `시험일정_2026`, `2026 시험일정` 모두 가능)
2. **A열**: 날짜 (실제로는 B열부터 읽으니 위치 주의 — 코드에서 `range: B:H`로 읽음 → 즉 시트 기준 B열이 row[0]=날짜)
3. **B열(코드 row[0])**: 날짜 — `YYYY-MM-DD` 또는 엑셀 시리얼 숫자
4. **C열(코드 row[1])**: 구분 — "재방문" 포함 시 시험건수 제외
5. **D열(코드 row[2])**: 부서/구분 — **비어있으면 전체 스킵**
6. **H열(코드 row[6])**: 인원수 — 양의 정수

**Step 6: 즉시 갱신**
시트 수정 후 캐시 반영:
```bash
pm2 restart kdri-mis
sleep 30  # 초기 동기화 대기
pm2 logs kdri-mis --lines 500 --nostream | grep "가산"
```

### 7.8 문정 시험건수 진단 절차

문정도 동일한 외부 시트 구조. 위 절차에서 `가산` → `문정`, `EXTERNAL_GS` → `EXTERNAL_MJ`로 치환.
탭 탐색은 `25년1월~25년12월` 같은 **연도범위 패턴**으로 동작.

```bash
pm2 logs kdri-mis --lines 500 --nostream | grep -i "문정"
curl "http://localhost:3000/api/test-counts/debug?lab=문정&month=5&year=2026"
```

---

## 8. 부서·연구소 설정

### 8.1 부서 추가/수정
`server/config/departments.js` 편집:
```js
const DEPARTMENTS = {
  '문정': ['임상1팀', '임상2팀', '비임상팀', ...],
  '가산': ['시험검사팀', '특수시험팀', ...],
  '얼트루': [],
};
const LABS = ['가산', '문정', '얼트루'];
```

> **서버 재시작 불필요** — `getDepartments.js` 헬퍼가 캐시 무효화 처리. 파일 저장 즉시 반영.

---

## 9. 사이니지 모드

### 9.1 URL
- `/signage` — 자동 로테이션 (대시보드 10분 → 경조사 5분 → 공지사항 5분)
- `/signage/combined` — 통합 단일 화면
- `/notices` — 공지사항 전용

### 9.2 로테이션 시간 조정
`client/src/pages/DashboardRotator.jsx`:
```js
const DEFAULT_UNIT_SEC = 300; // 5분 = 1단위
// dashboard: weight 2 → 600초 (10분)
// celebration / notice: weight 1 → 300초 (5분)
```

---

## 10. 로그 확인

### 10.1 애플리케이션 로그
```bash
pm2 logs kdri-mis --lines 100
pm2 logs kdri-mis --err            # 에러만
~/dashboard/logs/access.log       # 로그 파일 직접
~/dashboard/logs/error.log
```

### 10.2 접근 로그 (DB)
```sql
SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 50;
SELECT action, COUNT(*) FROM access_logs
  WHERE created_at >= date('now', '-7 days') GROUP BY action;
```

### 10.3 nginx 로그
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 11. 문제 해결

### 11.1 대시보드 빈 화면
```bash
# 클라이언트 빌드 확인
ls -la ~/dashboard/client/dist/index.html
# 빌드 누락 시
cd ~/dashboard/client && npm run build
```

### 11.2 시험건수/시험대상자 데이터 없음
- 시트 캐시 미초기화 가능성 → `pm2 restart kdri-mis` 후 1~2분 대기
- 시트 API 권한 확인 → 서비스 계정에 시트 공유 권한 있는지
- `/api/test-counts/debug` 로 원본 데이터 확인
- **가산/문정만 안 나옴** → 외부 시트 동기화 문제. **7.7 / 7.8 진단 절차** 참조

### 11.3 한피연 합계가 부서 숨김에 영향받음
- 클라이언트 빌드가 구버전일 가능성 → `npm run build` 다시
- API 응답에 `allDepartments` 필드 있는지 확인: `/api/sales/overview?lab=전체&year=2026`

### 11.4 로그인 실패
```sql
-- 계정 존재 확인
SELECT employee_id, role FROM users WHERE employee_id = 'admin';
-- 비밀번호 초기화 (위 5.3 참조)
```

### 11.5 502 Bad Gateway
- PM2 프로세스 죽음 → `pm2 status` 확인 → `pm2 restart kdri-mis`
- 포트 충돌 → `sudo lsof -i :3000`

### 11.6 git pull "Already up to date" 인데 변경사항 없음
```bash
git branch                 # 현재 브랜치 확인 (main 이어야 함)
git fetch --all
git status
git pull origin main
```

### 11.7 SSE 실시간 업데이트 안됨
- nginx 설정에 `proxy_buffering off;` 있는지 확인
- 브라우저 개발자도구 Network에서 `/api/events` EventStream 확인

---

## 12. 보안 체크리스트

- [ ] admin 기본 비밀번호 변경
- [ ] `server/.env`의 `SESSION_SECRET` 변경 (랜덤 문자열)
- [ ] `credentials/service-account.json` 권한 600
- [ ] DB 파일 백업 자동화 설정
- [ ] HTTPS 인증서 적용 (Let's Encrypt 권장)
- [ ] 방화벽: 3001 포트는 외부 차단, 80/443만 개방
- [ ] Cockpit (9090 포트) 사용 시 강력한 시스템 패스워드 사용

---

## 13. 정기 점검

| 주기 | 항목 |
|---|---|
| 매일 | PM2 상태 (`pm2 status`), 로그 에러 |
| 매주 | DB 백업 확인, 디스크 용량 (`df -h`) |
| 매월 | OS 보안 업데이트 (`sudo apt update && sudo apt upgrade`) |
| 매월 | 사용자 계정 검토, 퇴사자 비활성화 |
| 분기 | 부서/연구소 구성 변경사항 반영 |

---

## 14. 긴급 대응

### 14.1 전체 재시작
```bash
pm2 restart all
sudo systemctl restart nginx
```

### 14.2 완전 롤백
```bash
cd ~/dashboard
git log --oneline -10              # 직전 안정 커밋 확인
git checkout <COMMIT_HASH>
cd client && npm run build && cd ..
pm2 restart kdri-mis
```

### 14.3 DB 손상 시
```bash
# 백업본 복원 (4.4 참조)
# 또는 무결성 검사
sqlite3 ~/dashboard/data/mis.db "PRAGMA integrity_check;"
```

---

## 부록 A. 자주 쓰는 명령 요약

```bash
# === 일상 ===
pm2 status
pm2 logs kdri-mis --lines 50
git pull && cd client && npm run build && cd .. && pm2 restart kdri-mis

# === DB ===
sqlite3 ~/dashboard/data/mis.db

# === 백업 ===
cp ~/dashboard/data/mis.db ~/backups/mis-$(date +%Y%m%d).db

# === 진단 ===
sudo nginx -t
sudo systemctl status nginx
df -h
free -h
sudo lsof -i :3000
```

## 부록 B. 연락처 / 자료

- 설계명세서: `KDRI_MIS_경영정보현황시스템_설계명세서_v1.1.md`
- README: `README.md`
- 저장소: `ispark-blip/MIS`
