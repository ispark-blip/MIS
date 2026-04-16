# KDRI 경영정보현황시스템(MIS Dashboard) 설계명세서 v1.1

> **문서번호:** KDRI-MIS-2026-001
> **작성일:** 2026-04-16
> **작성자:** 피플지원실
> **대상:** 클로드 코드(Claude Code) 구현용 설계 사양서
> **버전:** v1.1
> **개정일:** 2026-04-16
> **개정 사유:** 보안 패키지 교체(csurf→csrf-csrf), SSE/Nginx 호환 설정 보완, 네트워크 정책 명확화, Rate Limiting 조정, 토큰 사용 정책 확정, UPSERT 감사 추적 추가, SSE 재연결 동기화 전략 추가, 기타 UI/UX 보완

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [보안 설계](#4-보안-설계)
5. [데이터 스키마](#5-데이터-스키마)
6. [화면 설계](#6-화면-설계)
7. [모듈별 상세 명세](#7-모듈별-상세-명세)
8. [API 설계](#8-api-설계)
9. [Google Sheets 연동 명세](#9-google-sheets-연동-명세)
10. [배포 및 운영](#10-배포-및-운영)
11. [구현 일정](#11-구현-일정)
12. [Claude Code 프롬프트](#12-claude-code-프롬프트)

---

## 1. 프로젝트 개요

### 1.1 목적

한국피부과학연구원(KDRI) 경영진 및 팀장급이 전사 매출·시험현황·시험대상자 데이터를 **실시간**으로 모니터링할 수 있는 내부 로컬 대시보드 시스템 구축.

### 1.2 핵심 요구사항

| 구분 | 요구사항 | 데이터 소스 | 갱신 방식 |
|------|---------|------------|----------|
| Q1 (1사분면) | 전사 목표매출액 vs 현재 누적매출액 (부서별 구분) | Google Sheets | 시트 업데이트 → 실시간 반영 |
| Q2 (2사분면) | 부서별 분기 목표매출액 vs 누적매출액 | Google Sheets | 시트 업데이트 → 실시간 반영 |
| Q3 (3사분면) | 부서별 일일 시험건수 현황 (월누적) | 입력폼 → 내부 DB | 담당자 입력폼 제출 |
| Q4 (4사분면) | 연구소별 일일 시험대상자 인원수 (월누적/연누적) | Google Sheets (향후 연동) | 1차: 더미 데이터 / 2차: 시트 연동 |

### 1.3 사용자

| 사용자 | 접근 권한 | 비고 |
|--------|----------|------|
| 경영진 | 전체 대시보드 열람 | 문정/가산 전체 |
| 팀장급 | 해당 연구소 대시보드 열람 | 연구소별 필터 |
| 부서 담당자 | Q3 시험건수 입력폼 접근 | 입력만 가능 |

### 1.4 접속 환경

- **문정연구소** 내부망 PC/모바일 브라우저
- **가산연구소** 내부망 PC/모바일 브라우저
- **클라이언트 접근 제한:** 외부 인터넷에서의 대시보드 접근 차단 (내부 네트워크 전용)
- **서버 외부 통신:** MIS 서버는 Google Sheets API 호출을 위해 `*.googleapis.com` (TCP 443)으로의 아웃바운드 HTTPS 통신 필요. 방화벽에서 해당 도메인/IP 대역만 허용 (화이트리스트 방식 권장)

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    내부 로컬 네트워크                          │
│                                                             │
│  ┌──────────┐     ┌──────────────────────┐     ┌─────────┐ │
│  │ 브라우저  │────▶│   Nginx Reverse Proxy │────▶│ Node.js │ │
│  │ (클라이언트)│     │   (HTTPS / SSL)       │     │ Express │ │
│  └──────────┘     └──────────────────────┘     │ Server  │ │
│                                                 │         │ │
│                                                 │ ┌─────┐ │ │
│                                                 │ │SQLite│ │ │
│                                                 │ └─────┘ │ │
│                                                 └────┬────┘ │
└──────────────────────────────────────────────────────┼──────┘
                                                       │ HTTPS (443)
                                                       │ 아웃바운드만 허용
                                               ┌──────▼─────┐
                                               │Google Sheets│
                                               │   API       │
                                               │ (외부 클라우드)│
                                               └─────────────┘
```

### 2.2 구성 요소

| 구성 요소 | 역할 | 비고 |
|----------|------|------|
| **Nginx** | 리버스 프록시, HTTPS 종단, 정적 파일 서빙 | 자체 서명 SSL 인증서 |
| **Node.js + Express** | API 서버, SSE(Server-Sent Events) 푸시, 세션 관리 | 포트 3000 (내부) |
| **React (Vite)** | SPA 프론트엔드, 대시보드 UI | 빌드 후 Nginx에서 서빙 |
| **SQLite** | 시험건수 입력 데이터 저장, 세션/로그 관리 | 파일 기반 DB |
| **Google Sheets API** | Q1/Q2/Q4 매출·시험대상자 데이터 조회 | 서비스 계정 인증, 서버→외부 아웃바운드 HTTPS 필요 |

### 2.3 데이터 흐름

```
[Q1/Q2 매출 데이터]
  Google Sheets 업데이트
    → Node.js가 주기적 폴링(30초) 또는 수동 새로고침
    → SSE로 프론트엔드에 실시간 푸시
    → 대시보드 차트 자동 갱신

[Q3 시험건수]
  담당자가 입력폼 URL 접속
    → 폼에서 데이터 입력/제출
    → POST /api/test-count → SQLite 저장
    → SSE로 대시보드에 실시간 반영

[Q4 시험대상자]
  1차: 더미 데이터 (SQLite)
  2차: Google Sheets 연동 (Q1/Q2와 동일 방식)
```

---

## 3. 기술 스택

### 3.1 프론트엔드

| 항목 | 선택 | 사유 |
|------|------|------|
| 프레임워크 | React 18 + Vite | 빠른 빌드, HMR |
| 차트 라이브러리 | Recharts | React 네이티브, 가볍고 커스터마이징 용이 |
| CSS | Tailwind CSS | 유틸리티 기반, 빠른 UI 구성 |
| 상태 관리 | Zustand | 경량, 보일러플레이트 최소 |
| 라우팅 | React Router v6 | SPA 내 페이지 전환 |

### 3.2 백엔드

| 항목 | 선택 | 사유 |
|------|------|------|
| 런타임 | Node.js 20 LTS | 안정성, 장기 지원 |
| 프레임워크 | Express.js | 경량, 미들웨어 생태계 |
| DB | SQLite3 (better-sqlite3) | 설치 불요, 파일 기반, 로컬 서버 최적 |
| 인증 | express-session + bcrypt | 세션 기반 인증 |
| 실시간 통신 | SSE (Server-Sent Events) | 단방향 실시간 푸시, WebSocket 대비 단순 |
| Google API | googleapis (npm) | 공식 Node.js 클라이언트 |

### 3.3 인프라

| 항목 | 선택 | 사유 |
|------|------|------|
| 웹 서버 | Nginx | 리버스 프록시, SSL 종단 |
| SSL | 자체 서명 인증서 (mkcert) | 내부망 전용, 공인 인증서 불요 |
| 프로세스 관리 | PM2 | Node.js 프로세스 데몬화, 자동 재시작 |
| OS | Ubuntu Server 또는 Windows Server | 기존 내부 서버 활용 |

---

## 4. 보안 설계

### 4.1 네트워크 보안

```nginx
# nginx.conf - 내부망 IP만 허용
server {
    listen 443 ssl;
    server_name mis.kdri.local;

    # 내부망 IP 대역만 허용
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    # SSL 설정
    ssl_certificate     /etc/nginx/ssl/mis.kdri.local.crt;
    ssl_certificate_key /etc/nginx/ssl/mis.kdri.local.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 보안 헤더
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000" always;
    # CSP: Recharts가 SVG에 인라인 스타일을 사용하므로 style-src에 'unsafe-inline' 필수
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self';";

    # Rate Limiting (대시보드 초기 로드 시 6~8개 API 동시 호출 고려)
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # 로그인 엔드포인트 (브루트포스 방지, 강화된 rate limiting)
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 일반 API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE (Server-Sent Events) 전용 프록시 설정
    location /api/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';           # Connection 헤더 제거 (keep-alive 유지)

        proxy_buffering off;                      # 버퍼링 비활성화 (SSE 필수)
        proxy_cache off;                          # 캐시 비활성화
        proxy_read_timeout 86400s;                # 24시간 (장시간 연결 유지)
        chunked_transfer_encoding off;            # SSE는 chunked 불요

        # Rate limiting 제외 (SSE는 단일 장시간 연결)
    }

    location / {
        root /var/www/mis-dashboard/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### 4.2 인증·인가

| 항목 | 설계 |
|------|------|
| 로그인 | 사번 + 비밀번호 (bcrypt 해싱, salt rounds: 12) |
| 세션 | express-session, httpOnly + secure + sameSite: strict |
| 세션 유효기간 | 8시간 (업무 시간 기준), idle 30분 자동 로그아웃 |
| CSRF 방어 | csrf-csrf 패키지 (Double Submit Cookie 패턴). ~~csurf는 2022년 보안 취약점으로 deprecated.~~ 서버가 CSRF 토큰을 `__csrf` 쿠키로 발급, 클라이언트는 `X-CSRF-Token` 헤더에 포함하여 요청. 쿠키-헤더 값 일치 검증. 입력폼 토큰 기반 엔드포인트는 CSRF 검증 제외. |
| 권한 구분 | admin(경영진), manager(팀장), staff(담당자) |
| 입력폼 접근 | 별도 토큰 기반 URL (로그인 불요, 토큰 유효기간 24시간) |

### 4.3 데이터 보안

| 항목 | 조치 |
|------|------|
| DB 파일 | 파일 시스템 권한 600 (소유자만 읽기/쓰기) |
| 환경 변수 | `.env` 파일에 API 키·시크릿 저장, `.gitignore` 등록 |
| 로깅 | 접근 로그(IP, 사번, 시간, 액션) SQLite 별도 테이블 저장 |
| 백업 | SQLite DB 일일 자동 백업 (cron, 7일 보관) |
| Google 서비스 계정 키 | `credentials.json` 파일 권한 600, `.gitignore` 등록 |

#### .gitignore 필수 항목

```gitignore
# 환경 변수 및 시크릿
.env
credentials.json
*.pem
*.key
*.crt

# 데이터
data/
*.db
*.db-journal
*.db-wal

# 빌드 산출물
client/dist/
node_modules/

# 로그
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

---

## 5. 데이터 스키마

### 5.1 Google Sheets 스키마 (Q1/Q2 매출 데이터)

#### 시트명: `매출현황`

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | year | number | 사업연도 | 2026 |
| B | quarter | text | 분기 | Q1, Q2, Q3, Q4 |
| C | department | text | 부서명 | 임상1팀, 비임상팀, 시험검사팀 |
| D | lab | text | 소속 연구소 | 문정, 가산 |
| E | target_quarterly | number | 분기 목표매출액 (원) | 500000000 |
| F | actual_quarterly | number | 분기 누적매출액 (원) | 320000000 |
| G | target_annual | number | 연간 목표매출액 (원) | 2000000000 |
| H | actual_annual | number | 연간 누적매출액 (원) | 820000000 |
| I | updated_at | datetime | 최종 업데이트 일시 | 2026-04-16 14:30 |

#### 시트명: `전사목표`

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | year | number | 사업연도 | 2026 |
| B | total_target | number | 전사 연간 목표매출액 | 10000000000 |
| C | total_actual | number | 전사 연간 누적매출액 | 3200000000 |

> **참고:** `전사목표` 시트는 연간 단위 전사 목표만 관리한다. Q1 사분면의 "전사 목표 vs 누적"은 연간 기준으로 표시된다. 향후 분기별 전사 목표가 필요할 경우, `quarter` 컬럼(ANNUAL/Q1/Q2/Q3/Q4)을 추가하여 확장 가능하다.

### 5.2 SQLite 스키마 (Q3 시험건수 + 시스템 관리)

```sql
-- 사용자 테이블
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,        -- 사번
    name TEXT NOT NULL,                       -- 이름
    department TEXT NOT NULL,                 -- 부서
    lab TEXT NOT NULL DEFAULT '문정',          -- 소속 연구소 (문정/가산)
    role TEXT NOT NULL DEFAULT 'staff',       -- admin/manager/staff
    password_hash TEXT NOT NULL,              -- bcrypt 해싱
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 일일 시험건수 (Q3)
CREATE TABLE daily_test_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,                       -- 시험일자
    department TEXT NOT NULL,                 -- 부서명
    lab TEXT NOT NULL,                         -- 소속 연구소
    test_type TEXT NOT NULL,                  -- 시험 유형 (예: HET-CAM, 첩포시험, 인체적용시험 등)
    count INTEGER NOT NULL DEFAULT 0,         -- 시험건수
    submitted_by TEXT NOT NULL,               -- 입력자 사번
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,                               -- 비고
    UNIQUE(date, department, lab, test_type)  -- 동일일/부서/연구소/유형 중복 방지
);

-- 시험건수 변경 이력 (감사 추적)
CREATE TABLE test_count_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_count_id INTEGER NOT NULL,           -- daily_test_counts.id
    date DATE NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL,
    test_type TEXT NOT NULL,
    old_count INTEGER,                        -- 변경 전 건수 (신규 입력 시 NULL)
    new_count INTEGER NOT NULL,               -- 변경 후 건수
    action TEXT NOT NULL,                     -- INSERT / UPDATE / DELETE
    changed_by TEXT NOT NULL,                 -- 변경자 사번
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 시험대상자 인원수 (Q4) - 1차 더미, 2차 Google Sheets 연동
CREATE TABLE daily_subject_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    lab TEXT NOT NULL,                         -- 문정/가산
    department TEXT NOT NULL,
    subject_count INTEGER NOT NULL DEFAULT 0,  -- 시험대상자 수
    study_name TEXT,                           -- 시험과제명
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, lab, department, study_name)
);

-- 입력폼 토큰 (Q3 외부 입력용, 유효기간 내 다회 사용 허용)
CREATE TABLE form_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    lab TEXT NOT NULL,
    created_by TEXT NOT NULL,                 -- 발급자 사번
    expires_at DATETIME NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 0,     -- 사용 횟수 (추적용)
    max_uses INTEGER NOT NULL DEFAULT 0,      -- 최대 사용 횟수 (0 = 무제한, 유효기간 내)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 접근 로그
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT,
    ip_address TEXT NOT NULL,
    action TEXT NOT NULL,                     -- login/logout/view/submit/export
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 세션 테이블 (express-session용)
CREATE TABLE sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired DATETIME NOT NULL
);
CREATE INDEX idx_sessions_expired ON sessions(expired);
```

### 5.3 Google Sheets 스키마 (Q4 시험대상자 - 2차 연동용)

#### 시트명: `시험대상자현황`

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | date | date | 시험일자 | 2026-04-16 |
| B | lab | text | 연구소 | 문정, 가산 |
| C | department | text | 부서명 | 임상1팀 |
| D | study_name | text | 시험과제명 | ABC-001 인체적용시험 |
| E | subject_count | number | 시험대상자 수 | 15 |
| F | cumulative_monthly | number | 월 누적 | 230 |
| G | cumulative_annual | number | 연 누적 | 1580 |

---

## 6. 화면 설계

### 6.1 레이아웃 구조

```
┌──────────────────────────────────────────────────────────┐
│ [로고]  경영정보현황시스템    [문정▼] [2026년 4월▼] [🔄] [👤] │  ← 헤더 (64px)
├───────────────────────────┬──────────────────────────────┤
│                           │                              │
│   Q1. 전사 목표 vs 누적    │  Q2. 부서별 분기별 매출       │
│   (도넛차트 + 부서별 바)    │  (그룹 바 차트)              │
│                           │                              │
│   ■ 목표: 100억           │  ┌──┐┌──┐                    │
│   ■ 달성: 32억 (32%)      │  │  ││  │ 임상1팀            │
│                           │  └──┘└──┘                    │
│   [부서별 기여도 스택바]    │  ┌──┐┌──┐                    │
│                           │  │  ││  │ 비임상팀            │
│                           │  └──┘└──┘                    │
│                           │                              │
├───────────────────────────┼──────────────────────────────┤
│                           │                              │
│   Q3. 일일 시험건수        │  Q4. 시험대상자 인원수         │
│   (부서별 월누적 테이블)    │  (연구소별 월누적/연누적)      │
│                           │                              │
│   날짜 | 임상1 | 비임상    │  ┌─────────┬────────┐        │
│   4/1  │  12  │   5      │  │ 문정연구소 │ 가산   │        │
│   4/2  │   8  │   7      │  ├─────────┼────────┤        │
│   ...  │  ... │  ...     │  │ 월: 230명 │ 150명  │        │
│   합계 │ 156  │  89      │  │ 연: 1580  │ 980    │        │
│                           │  └─────────┴────────┘        │
│   [+ 입력폼 열기]          │                              │
│                           │                              │
└───────────────────────────┴──────────────────────────────┘
```

### 6.2 헤더 영역

| 요소 | 설명 |
|------|------|
| 로고 영역 | 좌측 상단 48x48px 이미지, 클릭 시 `/public/logo.png` 교체 가능 |
| 시스템 타이틀 | "경영정보현황시스템" (font-size: 20px, font-weight: bold) |
| 연구소 선택 | 드롭다운: 전체 / 문정 / 가산 |
| 기간 선택 | 연도 + 월 선택기 (기본값: 현재 연/월) |
| 새로고침 버튼 | Google Sheets 데이터 수동 새로고침 |
| 사용자 정보 | 이름 + 로그아웃 버튼 |

### 6.3 Q1 사분면: 전사 목표 vs 누적매출

| 요소 | 설명 |
|------|------|
| 메인 차트 | 도넛 차트 - 중앙에 달성률(%) 표시 |
| 수치 표시 | 목표매출액 / 누적매출액 / 달성률 (큰 숫자) |
| 부서별 스택 바 | 수평 스택 바 차트 - 각 부서 기여 매출 비율 |
| 컬러 코딩 | 달성률 80%↑ 초록, 50~80% 노랑, 50%↓ 빨강 |

### 6.4 Q2 사분면: 부서별 분기 매출

| 요소 | 설명 |
|------|------|
| 차트 유형 | 그룹 바 차트 (목표 vs 실적, 부서별) |
| X축 | 부서명 |
| Y축 | 매출액 (억 원 단위) |
| 분기 선택 | 탭 또는 드롭다운 (Q1/Q2/Q3/Q4) |
| 달성률 라벨 | 각 바 위에 달성률(%) 표시 |
| 툴팁 | 호버 시 상세 수치 (목표/실적/달성률/전분기대비) |

### 6.5 Q3 사분면: 일일 시험건수

| 요소 | 설명 |
|------|------|
| 메인 뷰 | 테이블 형태 - 행: 날짜, 열: 부서별 시험건수 |
| 하단 합계 | 월누적 합계 행 강조 |
| 입력 버튼 | "[+ 시험건수 입력]" 버튼 → 입력폼 모달/새 탭 |
| 필터 | 시험유형별 필터 (전체/유형별) |
| 차트 토글 | 테이블 ↔ 라인 차트 전환 |
| 스크롤 | 테이블 본문 영역 max-height 적용, 세로 스크롤 (overflow-y: auto) |
| 합계행 고정 | 월누적 합계 행은 테이블 하단에 sticky 고정 (position: sticky; bottom: 0) |
| 헤더 고정 | 날짜/부서 헤더는 상단 sticky 고정 (position: sticky; top: 0) |
| 오늘 행 강조 | 현재 날짜 행에 배경색 하이라이트 (#eff6ff) |

### 6.6 Q4 사분면: 시험대상자 인원수

| 요소 | 설명 |
|------|------|
| 메인 뷰 | 연구소별 카드 (문정 / 가산) |
| 카드 내부 | 오늘 인원수, 월 누적, 연 누적 (큰 숫자) |
| 추세 차트 | 소형 라인 차트 (최근 30일 추이) |
| 부서 드릴다운 | 카드 클릭 시 부서별 상세 테이블 표시 |

### 6.7 입력폼 (Q3 전용, 별도 페이지)

```
URL: https://mis.kdri.local/form/{token}

┌──────────────────────────────────────┐
│   KDRI 일일 시험건수 입력폼           │
│                                      │
│   시험일자: [2026-04-16 ▼]           │
│   부서:     [임상1팀     ▼]           │
│   연구소:   [문정        ▼]           │
│                                      │
│   ┌──────────────┬────────┬───────┐  │
│   │ 시험유형      │ 건수   │ 비고  │  │
│   ├──────────────┼────────┼───────┤  │
│   │ HET-CAM      │ [   ] │ [   ] │  │
│   │ 첩포시험      │ [   ] │ [   ] │  │
│   │ 인체적용시험   │ [   ] │ [   ] │  │
│   │ + 유형 추가    │       │       │  │
│   └──────────────┴────────┴───────┘  │
│                                      │
│   입력자: [사번 입력]                  │
│                                      │
│   [취소]              [제출하기]       │
│                                      │
│   ※ 이 링크는 24시간 후 만료됩니다     │
└──────────────────────────────────────┘
```

### 6.8 반응형 설계

| 화면 | 레이아웃 |
|------|---------|
| 데스크톱 (1280px+) | 2x2 그리드 (4분할) |
| 태블릿 (768~1279px) | 2x2 유지, 폰트/여백 축소 |
| 모바일 (768px 미만) | 1열 세로 스택 (Q1→Q2→Q3→Q4) |

---

## 7. 모듈별 상세 명세

### 7.1 모듈 목록

| 모듈 ID | 모듈명 | 설명 |
|---------|--------|------|
| M01 | 인증·세션 관리 | 로그인/로그아웃, 세션, 권한 |
| M02 | Google Sheets 커넥터 | 시트 데이터 폴링·캐싱 |
| M03 | Q1 전사매출 대시보드 | 도넛차트, 부서별 스택바 |
| M04 | Q2 부서별 분기매출 | 그룹 바 차트, 분기 선택 |
| M05 | Q3 시험건수 관리 | 테이블, 입력폼, CRUD |
| M06 | Q4 시험대상자 현황 | 카드 뷰, 추세 차트 |
| M07 | SSE 실시간 푸시 | 데이터 변경 시 클라이언트 통지 |
| M08 | 입력폼 토큰 관리 | 토큰 생성/검증/만료 |
| M09 | 로깅·감사 | 접근 로그, 데이터 변경 이력 |

### 7.2 M01: 인증·세션 관리

#### 기능 목록

| 기능 | 설명 |
|------|------|
| 로그인 | 사번 + 비밀번호 → bcrypt 검증 → 세션 생성 |
| 로그아웃 | 세션 파기, 로그 기록 |
| 세션 관리 | 8시간 만료, idle 30분 자동 로그아웃 |
| 권한 체크 | 미들웨어로 role 기반 접근 제어 |
| 초기 계정 | 시드 스크립트로 관리자 계정 1개 생성 |

#### 미들웨어 체인

```
요청 → cors → helmet → session → csrfProtection(csrf-csrf) → auth → rateLimiter → 라우터
```

### 7.3 M02: Google Sheets 커넥터

#### 설정

```javascript
// config/sheets.js
module.exports = {
  CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
  SPREADSHEET_ID_SALES: process.env.SHEET_ID_SALES,         // Q1/Q2 매출 시트
  SPREADSHEET_ID_SUBJECTS: process.env.SHEET_ID_SUBJECTS,   // Q4 시험대상자 시트
  POLLING_INTERVAL_MS: 30000,                                // 30초 폴링
  CACHE_TTL_MS: 25000,                                       // 25초 캐시 (폴링보다 짧게)
};
```

#### 폴링 로직

```
시작 → Google Sheets API 호출
  → 응답 데이터와 캐시 데이터 비교 (JSON diff)
  → 변경 감지 시:
      1. 내부 캐시 갱신
      2. SSE 채널로 변경 이벤트 브로드캐스트
      3. 로그 기록
  → 변경 없으면: 대기
  → 30초 후 반복
  → 에러 발생 시: 3회 재시도 (exponential backoff), 실패 시 로그 기록 후 다음 주기
```

### 7.4 M03: Q1 전사매출 대시보드

#### 데이터 변환

```javascript
// Google Sheets 원본 → 프론트 표시용 변환
{
  totalTarget: 10000000000,        // 전사 목표 (원)
  totalActual: 3200000000,         // 전사 누적 (원)
  achievementRate: 32.0,           // 달성률 (%)
  departments: [
    {
      name: "임상1팀",
      lab: "문정",
      actual: 800000000,
      ratio: 25.0                  // 전체 대비 기여율
    },
    // ...
  ]
}
```

#### 차트 사양

| 차트 | 라이브러리 | 옵션 |
|------|----------|------|
| 도넛 | Recharts PieChart | innerRadius=60%, outerRadius=80%, 중앙 텍스트: 달성률 |
| 스택바 | Recharts BarChart | layout="vertical", stacked, 부서별 컬러 |

#### 통화 표시 규칙 (client/src/utils/formatCurrency.js)

| 금액 범위 | 표시 형식 | 예시 |
|-----------|----------|------|
| 1억 이상 | `X.X억` (소수점 1자리, 0이면 생략) | 3억 2천만 → `3.2억`, 10억 → `10억` |
| 1천만 ~ 1억 미만 | `X,XXX만` (만 원 단위, 천 단위 콤마) | 5천만 → `5,000만` |
| 1천만 미만 | `X,XXX,XXX원` (원 단위, 천 단위 콤마) | 800만 → `8,000,000원` |
| 0원 | `0원` | |

- 차트 Y축 라벨: 항상 `억` 단위 (0, 5, 10, 15 등)
- 차트 툴팁: `X.XX억` (소수점 2자리)로 정밀 표시
- 테이블 셀: 원 단위까지 표시 (`1,234,567,890원`)

> **참고:** 모든 내부 데이터는 원(KRW) 단위 정수로 저장·전송하며, 표시 단위 변환은 프론트엔드에서만 수행한다.

### 7.5 M04: Q2 부서별 분기매출

#### 데이터 변환

```javascript
{
  quarter: "Q2",
  year: 2026,
  departments: [
    {
      name: "임상1팀",
      lab: "문정",
      target: 500000000,
      actual: 320000000,
      achievementRate: 64.0
    },
    // ...
  ]
}
```

### 7.6 M05: Q3 시험건수 관리

#### 입력폼 플로우

```
[관리자/팀장]
  대시보드 Q3 영역 → "입력폼 링크 생성" 클릭
    → POST /api/form-tokens
    → 토큰 생성 (UUID v4, 유효기간 24시간)
    → URL 복사: https://mis.kdri.local/form/{token}
    → Slack/카톡으로 담당자에게 공유

[담당자]
  URL 접속 → 토큰 검증 → 입력폼 표시
    → 일자/부서/연구소/시험유형/건수 입력
    → 제출 → POST /api/test-counts (토큰 첨부)
    → 서버 검증 → SQLite 저장
    → SSE로 대시보드 갱신
    → 제출 완료 화면 표시
```

#### 입력 검증 규칙

| 필드 | 규칙 |
|------|------|
| 시험일자 | 필수, 오늘 기준 -7일 ~ 오늘 |
| 부서 | 필수, 허용 목록 내 |
| 연구소 | 필수, 문정/가산 |
| 시험유형 | 필수, 텍스트 50자 이내 |
| 건수 | 필수, 정수, 0 이상 9999 이하 |
| 입력자 사번 | 필수, 형식 검증 |

### 7.7 M06: Q4 시험대상자 현황

#### 1차 구현 (더미 데이터)

```javascript
// seeds/dummy-subjects.js
// 문정/가산 연구소별 최근 3개월 더미 데이터 생성
// 일별 5~30명 랜덤, 부서별 분배
```

#### 2차 구현 (Google Sheets 연동)

- M02 Google Sheets 커넥터에 Q4용 시트 ID 추가
- 동일한 폴링/캐싱/SSE 파이프라인 활용
- 전환 시 SQLite 더미 데이터 비활성화, 시트 데이터 우선

### 7.8 M07: SSE 실시간 푸시

#### 이벤트 타입

| 이벤트명 | 트리거 | 데이터 |
|---------|--------|--------|
| `sales-update` | Q1/Q2 시트 데이터 변경 감지 | 전체 매출 데이터 |
| `test-count-update` | Q3 시험건수 입력/수정/삭제 | 해당 월 시험건수 전체 |
| `subject-update` | Q4 시험대상자 데이터 변경 | 해당 연구소 시험대상자 전체 |
| `heartbeat` | 매 15초 | `{ type: "ping" }` |

#### 클라이언트 구현

```javascript
// hooks/useSSE.js
const useSSE = (url) => {
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT = 10;

  // 재연결 성공 시 전체 데이터 재조회 (놓친 이벤트 보상)
  const refreshAllData = async () => {
    try {
      const [sales, quarterly, testCounts, subjects] = await Promise.all([
        api.get('/api/sales/overview'),
        api.get(`/api/sales/quarterly?q=${currentQuarter}&year=${currentYear}`),
        api.get(`/api/test-counts?month=${currentMonth}&year=${currentYear}`),
        api.get('/api/subjects/summary'),
      ]);
      store.setSalesData(sales.data);
      store.setQuarterlyData(quarterly.data);
      store.setTestCountData(testCounts.data);
      store.setSubjectData(subjects.data);
    } catch (err) {
      console.error('[SSE] 데이터 재조회 실패:', err.message);
    }
  };

  const connect = () => {
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.addEventListener('sales-update', (e) => {
      store.setSalesData(JSON.parse(e.data));
    });

    eventSource.addEventListener('test-count-update', (e) => {
      store.setTestCountData(JSON.parse(e.data));
    });

    eventSource.addEventListener('subject-update', (e) => {
      store.setSubjectData(JSON.parse(e.data));
    });

    // 재연결 성공 시 (첫 연결이 아닌 경우) 전체 데이터 재조회
    eventSource.onopen = () => {
      if (reconnectAttempts.current > 0) {
        refreshAllData();
      }
      reconnectAttempts.current = 0;
      store.setConnectionStatus('connected');
    };

    // 재연결 로직 (exponential backoff: 1초→2초→4초...최대 30초, 최대 10회)
    eventSource.onerror = () => {
      eventSource.close();
      store.setConnectionStatus('disconnected');
      if (reconnectAttempts.current < MAX_RECONNECT) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;
        setTimeout(() => connect(), delay);
      }
    };

    return eventSource;
  };

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, []);
};
```

### 7.9 M08: 입력폼 토큰 관리

| 기능 | 설명 |
|------|------|
| 생성 | UUID v4, 유효기간 24시간, 부서/연구소 바인딩, max_uses 설정 (기본 0=무제한) |
| 검증 | 토큰 존재 + 만료 전 + (max_uses == 0 이거나 use_count < max_uses) |
| 사용 | 제출 시 `use_count += 1` 증가. 유효기간 내 다회 제출 허용 (기본). 관리자가 max_uses를 설정하여 횟수 제한 가능. |
| 정리 | 매일 자정 만료 토큰 삭제 (cron) |

### 7.10 M09: 로깅·감사

```javascript
// middleware/logger.js
const logAccess = (req, action, detail) => {
  db.prepare(`
    INSERT INTO access_logs (employee_id, ip_address, action, detail)
    VALUES (?, ?, ?, ?)
  `).run(
    req.session?.user?.employee_id || 'anonymous',
    req.ip,
    action,
    detail
  );
};
```

---

## 8. API 설계

### 8.1 엔드포인트 목록

#### 인증

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/auth/login` | 로그인 | public |
| POST | `/api/auth/logout` | 로그아웃 | authenticated |
| GET | `/api/auth/me` | 현재 사용자 정보 | authenticated |

#### Q1/Q2 매출 (Google Sheets 연동)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/sales/overview` | 전사 목표/누적 + 부서별 | authenticated |
| GET | `/api/sales/quarterly?q=Q2&year=2026` | 부서별 분기 매출 | authenticated |
| POST | `/api/sales/refresh` | 수동 새로고침 | manager+ |

#### Q3 시험건수

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/test-counts?month=4&year=2026&lab=문정` | 월별 시험건수 조회 | authenticated |
| POST | `/api/test-counts` | 시험건수 입력 (폼 토큰 사용) | token/authenticated |
| PUT | `/api/test-counts/:id` | 시험건수 수정 | manager+ |
| DELETE | `/api/test-counts/:id` | 시험건수 삭제 | admin |

#### Q3 입력폼 토큰

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/form-tokens` | 토큰 생성 | manager+ |
| GET | `/api/form-tokens/:token/validate` | 토큰 유효성 검증 | public |
| GET | `/api/form-tokens` | 토큰 목록 조회 | manager+ |
| DELETE | `/api/form-tokens/:id` | 토큰 폐기 | manager+ |

#### Q4 시험대상자

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/subjects?lab=문정&month=4&year=2026` | 시험대상자 조회 | authenticated |
| GET | `/api/subjects/summary` | 연구소별 월/연 누적 요약 | authenticated |

#### SSE

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/events` | SSE 스트림 구독 | authenticated |

#### 시스템 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/admin/users` | 사용자 등록 | admin |
| GET | `/api/admin/users` | 사용자 목록 | admin |
| PUT | `/api/admin/users/:id` | 사용자 수정 | admin |
| GET | `/api/admin/logs?from=&to=` | 접근 로그 조회 | admin |

### 8.2 응답 형식

```javascript
// 성공
{
  "success": true,
  "data": { /* 결과 데이터 */ },
  "meta": {
    "timestamp": "2026-04-16T14:30:00+09:00",
    "cached": false,
    "source": "google-sheets"  // 또는 "sqlite"
  }
}

// 실패
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "시험건수는 0 이상이어야 합니다.",
    "field": "count"
  }
}
```

---

## 9. Google Sheets 연동 명세

### 9.1 사전 준비

```
1. Google Cloud Console에서 프로젝트 생성
2. Google Sheets API 활성화
3. 서비스 계정 생성 → JSON 키 다운로드
4. 대상 Google Sheets에 서비스 계정 이메일 공유 (뷰어 권한)
5. credentials.json을 서버 프로젝트 루트에 배치
```

### 9.2 환경 변수

```env
# .env
GOOGLE_CREDENTIALS_PATH=./credentials.json
SHEET_ID_SALES=1AbCdEfGhIjKlMnOpQrStUvWxYz       # 매출현황 시트 ID
SHEET_ID_SUBJECTS=1ZyXwVuTsRqPoNmLkJiHgFeDcBa     # 시험대상자 시트 ID (2차)
SHEET_RANGE_SALES=매출현황!A2:I                      # 매출 데이터 범위 (헤더 제외)
SHEET_RANGE_TOTAL=전사목표!A2:C                      # 전사목표 범위
SHEET_RANGE_SUBJECTS=시험대상자현황!A2:G              # 시험대상자 범위
POLLING_INTERVAL=30000                               # 폴링 주기 (ms)
```

### 9.3 연동 코드 구조

```javascript
// services/googleSheets.js
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.cache = { sales: null, subjects: null };
    this.lastFetchTime = { sales: 0, subjects: 0 };
  }

  async authenticate() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async fetchSalesData() {
    const [salesRes, totalRes] = await Promise.all([
      this.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID_SALES,
        range: process.env.SHEET_RANGE_SALES,
      }),
      this.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID_SALES,
        range: process.env.SHEET_RANGE_TOTAL,
      }),
    ]);
    return this.transformSalesData(salesRes.data.values, totalRes.data.values);
  }

  hasChanged(newData, cacheKey) {
    return JSON.stringify(newData) !== JSON.stringify(this.cache[cacheKey]);
  }

  startPolling(eventEmitter) {
    setInterval(async () => {
      try {
        const data = await this.fetchSalesData();
        if (this.hasChanged(data, 'sales')) {
          this.cache.sales = data;
          eventEmitter.emit('sales-update', data);
        }
      } catch (err) {
        console.error('[Sheets Polling Error]', err.message);
      }
    }, parseInt(process.env.POLLING_INTERVAL));
  }
}
```

---

## 10. 배포 및 운영

### 10.1 디렉토리 구조

```
kdri-mis-dashboard/
├── client/                      # React 프론트엔드
│   ├── public/
│   │   └── logo.png             # 회사 로고 이미지
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── charts/
│   │   │   │   ├── SalesDonut.jsx        # Q1
│   │   │   │   ├── DepartmentStack.jsx   # Q1 부서별
│   │   │   │   ├── QuarterlyBar.jsx      # Q2
│   │   │   │   ├── TestCountTable.jsx    # Q3
│   │   │   │   └── SubjectCards.jsx      # Q4
│   │   │   └── forms/
│   │   │       └── TestCountForm.jsx     # Q3 입력폼
│   │   ├── hooks/
│   │   │   ├── useSSE.js
│   │   │   └── useAuth.js
│   │   ├── stores/
│   │   │   └── dashboardStore.js
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── FormPage.jsx              # 토큰 기반 입력폼
│   │   │   └── AdminPage.jsx             # 관리자 페이지 (2차 구현)
│   │   ├── utils/
│   │   │   ├── formatCurrency.js
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                      # Node.js 백엔드
│   ├── config/
│   │   ├── sheets.js
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rateLimiter.js
│   │   ├── logger.js
│   │   └── csrfProtection.js          # csrf-csrf (Double Submit Cookie)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── sales.js
│   │   ├── testCounts.js
│   │   ├── formTokens.js
│   │   ├── subjects.js
│   │   ├── events.js              # SSE
│   │   └── admin.js
│   ├── services/
│   │   ├── googleSheets.js
│   │   └── sseManager.js
│   ├── seeds/
│   │   ├── init-db.js             # 테이블 생성
│   │   ├── seed-users.js          # 초기 사용자
│   │   └── seed-dummy-subjects.js # Q4 더미 데이터
│   ├── app.js
│   └── package.json
│
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│       ├── mis.kdri.local.crt
│       └── mis.kdri.local.key
│
├── scripts/
│   ├── setup.sh                 # 초기 설치 스크립트
│   ├── backup-db.sh             # DB 백업 스크립트
│   └── generate-ssl.sh          # SSL 인증서 생성
│
├── data/
│   └── mis.db                   # SQLite DB 파일
│
├── .env.example
├── .gitignore
├── ecosystem.config.js          # PM2 설정
└── README.md
```

### 10.2 설치 스크립트

```bash
#!/bin/bash
# scripts/setup.sh

echo "===== KDRI MIS Dashboard 설치 시작 ====="

# 1. Node.js 20 LTS 확인
node -v || { echo "Node.js 20 LTS를 설치해주세요"; exit 1; }

# 2. 의존성 설치
cd server && npm install
cd ../client && npm install

# 3. SSL 인증서 생성 (mkcert)
bash ../scripts/generate-ssl.sh

# 4. 환경 변수 설정
cp ../.env.example ../.env
echo "⚠️  .env 파일에 Google Sheets ID와 credentials.json 경로를 설정하세요"

# 5. DB 초기화
cd ../server && node seeds/init-db.js && node seeds/seed-users.js

# 6. 프론트엔드 빌드
cd ../client && npm run build

# 7. Nginx 설정 복사
sudo cp ../nginx/nginx.conf /etc/nginx/sites-available/mis-dashboard
sudo ln -sf /etc/nginx/sites-available/mis-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 8. PM2 시작
cd ../ && pm2 start ecosystem.config.js
pm2 save

echo "===== 설치 완료: https://mis.kdri.local ====="
```

### 10.3 PM2 설정

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kdri-mis',
    script: './server/app.js',
    instances: 1,                 // SQLite는 단일 인스턴스 권장
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/access.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    cron_restart: '0 5 * * *',   // 매일 05:00 자동 재시작
  }]
};
```

### 10.4 백업 설정

```bash
#!/bin/bash
# scripts/backup-db.sh
# crontab: 0 2 * * * /path/to/backup-db.sh

BACKUP_DIR="/path/to/backups"
DB_PATH="/path/to/data/mis.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup '${BACKUP_DIR}/mis_${DATE}.db'"

# 7일 이상 된 백업 삭제
find "$BACKUP_DIR" -name "mis_*.db" -mtime +7 -delete

echo "[$(date)] 백업 완료: mis_${DATE}.db"
```

### 10.5 hosts 파일 설정 (클라이언트 PC)

```
# Windows: C:\Windows\System32\drivers\etc\hosts
# Mac/Linux: /etc/hosts
192.168.x.x    mis.kdri.local
```

---

## 11. 구현 일정

### 11.1 전체 일정 (약 6주)

| 주차 | 단계 | 작업 내용 | 산출물 |
|------|------|---------|--------|
| **1주차** | 기반 구축 | 프로젝트 초기화, DB 스키마, 인증 시스템, Nginx/SSL | 서버 기동, 로그인 동작 |
| **2주차** | Q1/Q2 구현 | Google Sheets 연동, 매출 API, 도넛차트·바차트 | Q1/Q2 실시간 대시보드 |
| **3주차** | Q3 구현 | 시험건수 CRUD, 입력폼 페이지, 토큰 시스템 | Q3 입력폼 + 테이블 |
| **4주차** | Q4 + SSE | 시험대상자 카드 뷰 (더미), SSE 실시간 연동 | Q4 표시 + 전체 실시간 |
| **5주차** | 통합·보안 | 4분할 레이아웃, 반응형, 보안 점검, 로깅 | 전체 대시보드 통합 |
| **6주차** | 테스트·배포 | 문정/가산 테스트, 버그 수정, 운영 배포 | 운영 서버 오픈 |

### 11.2 후속 작업 (배포 후)

| 작업 | 시기 | 설명 |
|------|------|------|
| Q4 Google Sheets 연동 | 배포 후 1~2주 | 더미 데이터 → 시트 연동 전환 |
| 데이터 내보내기 | 배포 후 2주 | 엑셀 다운로드 기능 |
| 알림 기능 | 배포 후 3주 | 달성률 기준 Slack 알림 |
| 관리자 UI 페이지 | 배포 후 1~2주 | 사용자 CRUD, 접근 로그 조회, 토큰 관리 화면. 1차 출시 시에는 seed 스크립트 및 API 직접 호출로 대체 |
| 대시보드 확장 | 배포 후 1개월 | 추가 KPI 위젯 |

---

## 12. Claude Code 프롬프트

> 아래 프롬프트를 Claude Code에 순서대로 입력하여 시스템을 구축합니다.
> 각 프롬프트는 독립적으로 실행 가능하며, 이전 단계의 결과물 위에 점진적으로 빌드됩니다.

---

### 프롬프트 1: 프로젝트 초기화 + DB + 인증

```
KDRI 경영정보현황시스템(MIS Dashboard)을 구축합니다.

[프로젝트 구조]
- 모노레포: kdri-mis-dashboard/
- client/: React 18 + Vite + Tailwind CSS + Recharts + Zustand + React Router v6
- server/: Node.js 20 + Express.js + better-sqlite3 + express-session + bcrypt
- nginx/: nginx.conf (리버스 프록시, SSL)

[1단계: 프로젝트 초기화]
1. 위 디렉토리 구조대로 프로젝트 생성
2. server/package.json 의존성: express, better-sqlite3, express-session, connect-sqlite3, bcryptjs, cors, helmet, csrf-csrf, uuid, dotenv, googleapis
3. client/package.json 의존성: react, react-dom, react-router-dom, recharts, zustand, axios, tailwindcss, @tailwindcss/forms, lucide-react

[2단계: SQLite DB 초기화]
seeds/init-db.js에 아래 테이블 생성:
- users (id, employee_id UNIQUE, name, department, lab, role, password_hash, is_active, created_at, updated_at)
- daily_test_counts (id, date, department, lab, test_type, count, submitted_by, submitted_at, notes, UNIQUE(date,department,lab,test_type))
- daily_subject_counts (id, date, lab, department, subject_count, study_name, created_at, UNIQUE(date,lab,department,study_name))
- form_tokens (id, token UNIQUE, department, lab, created_by, expires_at, use_count DEFAULT 0, max_uses DEFAULT 0, created_at)
- test_count_audit_log (id, test_count_id, date, department, lab, test_type, old_count, new_count, action, changed_by, changed_at, notes)
- access_logs (id, employee_id, ip_address, action, detail, created_at)
- sessions (sid PRIMARY KEY, sess, expired + INDEX)

seeds/seed-users.js: admin 계정 1개 생성 (사번: admin, 비밀번호: admin1234, role: admin, lab: 문정)

[3단계: 인증 시스템]
- POST /api/auth/login: 사번+비밀번호 → bcrypt 검증 → 세션 생성
- POST /api/auth/logout: 세션 파기
- GET /api/auth/me: 현재 로그인 사용자 정보
- 미들웨어: auth.js (세션 검증), csrfProtection.js (csrf-csrf, Double Submit Cookie), rateLimiter.js (Nginx에서 일반 API 60req/min, 로그인 5req/min, SSE 제외)
- helmet, cors(origin: 'https://mis.kdri.local'), express-session(httpOnly, secure, sameSite:strict, maxAge:8시간)
- 모든 인증 이벤트 access_logs에 기록

[4단계: Nginx + SSL]
- scripts/generate-ssl.sh: mkcert로 mis.kdri.local 인증서 생성
- nginx/nginx.conf: 443 SSL, 내부망 IP만 allow, /api/ → proxy_pass 127.0.0.1:3000, / → React 빌드 파일 서빙
- 보안 헤더: X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, CSP

.env.example 파일도 생성해주세요.
서버 시작 명령: node server/app.js (포트 3000)
```

---

### 프롬프트 2: Google Sheets 연동 + Q1/Q2 매출 대시보드

```
이전에 만든 KDRI MIS 프로젝트에 Google Sheets 연동과 Q1/Q2 대시보드를 추가합니다.

[Google Sheets 커넥터: server/services/googleSheets.js]
- googleapis npm 패키지 사용
- 서비스 계정 인증 (credentials.json, scopes: spreadsheets.readonly)
- 환경변수: SHEET_ID_SALES, SHEET_RANGE_SALES(매출현황!A2:I), SHEET_RANGE_TOTAL(전사목표!A2:C)
- 30초 간격 폴링, JSON diff로 변경 감지
- 변경 시 EventEmitter로 'sales-update' 이벤트 발행
- 에러 시 3회 재시도 (exponential backoff: 1초→2초→4초)

[매출현황 시트 스키마]
A:year, B:quarter, C:department, D:lab, E:target_quarterly, F:actual_quarterly, G:target_annual, H:actual_annual, I:updated_at

[전사목표 시트 스키마]
A:year, B:total_target, C:total_actual

[API 엔드포인트]
- GET /api/sales/overview: 전사 목표/누적 + 부서별 기여도 (연구소 필터 쿼리파라미터 lab=문정|가산|전체)
- GET /api/sales/quarterly?q=Q1&year=2026&lab=문정: 부서별 분기 매출
- POST /api/sales/refresh: 수동 새로고침 (manager 이상)

[프론트엔드 Q1: 전사 목표 vs 누적매출]
- components/charts/SalesDonut.jsx: Recharts PieChart 도넛형, innerRadius 60%, 중앙에 달성률(%) 큰 숫자 표시
- 아래에 수평 스택바: 부서별 기여 매출 비율
- 컬러: 달성률 80%↑ #22c55e, 50~80% #eab308, 50%↓ #ef4444
- 금액 표시: 억 원 단위 (formatCurrency 유틸)

[프론트엔드 Q2: 부서별 분기 매출]
- components/charts/QuarterlyBar.jsx: Recharts BarChart 그룹형
- X축: 부서명, Y축: 억 원
- 바 2개씩: 목표(회색) vs 실적(파란색), 바 위에 달성률 %
- 분기 선택 탭 (Q1~Q4)
- 툴팁: 목표/실적/달성률/잔여액

데이터가 없을 때 "데이터 연동 대기 중" placeholder 표시.
SSE 연결은 아직 하지 말고, 30초 간격 API 폴링으로 구현.
```

---

### 프롬프트 3: Q3 시험건수 + 입력폼

```
KDRI MIS 프로젝트에 Q3 일일 시험건수 모듈을 추가합니다.

[API 엔드포인트]
- GET /api/test-counts?month=4&year=2026&lab=문정: 해당 월 시험건수 (일별·부서별·유형별)
- POST /api/test-counts: 시험건수 입력 (입력폼 토큰 또는 인증 세션)
  - body: { date, department, lab, test_type, count, submitted_by, notes, token? }
  - 검증: date(오늘-7일~오늘), count(0~9999 정수), department(허용목록), lab(문정/가산)
  - 중복 시 UPSERT (같은 날짜/부서/연구소/유형이면 업데이트)
  - UPSERT 수행 전 기존 레코드가 있으면 test_count_audit_log에 변경 전 값 기록 (action: 'UPDATE')
  - 신규 입력 시에도 audit_log 기록 (action: 'INSERT', old_count: NULL)
- PUT /api/test-counts/:id: 수정 (manager 이상) - audit_log 기록 (action: 'UPDATE')
- DELETE /api/test-counts/:id: 삭제 (admin) - audit_log 기록 (action: 'DELETE')

[입력폼 토큰 API]
- POST /api/form-tokens: 토큰 생성 (UUID v4, 유효 24시간, 부서/연구소 바인딩, max_uses 선택) - manager 이상
  - body: { department, lab, max_uses? } (max_uses 생략 시 0=무제한, 유효기간 내 다회 사용)
  - 응답: { token, url: "https://mis.kdri.local/form/{token}", expires_at, max_uses }
- GET /api/form-tokens/:token/validate: 토큰 검증 (public) - 유효하면 부서/연구소 정보 반환
- GET /api/form-tokens: 토큰 목록 (manager 이상)
- DELETE /api/form-tokens/:id: 토큰 폐기 (manager 이상)

[입력폼 페이지: client/src/pages/FormPage.jsx]
- URL: /form/:token
- 토큰 검증 실패 시 "만료되었거나 유효하지 않은 링크입니다" 표시
- 로그인 불요 (토큰만으로 접근)
- 폼 필드:
  - 시험일자: date picker (기본값 오늘, 7일 전까지 선택 가능)
  - 부서: 토큰에 바인딩된 부서 자동 표시 (변경 불가)
  - 연구소: 토큰에 바인딩된 연구소 자동 표시 (변경 불가)
  - 시험유형 + 건수: 동적 행 추가 가능 (기본 유형: HET-CAM, 첩포시험, 인체적용시험, 기타)
  - 입력자 사번: 텍스트 입력
  - 비고: textarea (선택)
- 제출 성공 시 "입력 완료" 확인 화면 + "추가 입력" 버튼
- 하단에 "이 링크는 {expires_at}에 만료됩니다" 표시

[대시보드 Q3 영역: components/charts/TestCountTable.jsx]
- 테이블 뷰:
  - 행: 날짜 (1일~말일)
  - 열: 부서별 시험건수 합계
  - 마지막 행: 월누적 합계 (bold, 배경색 강조)
- 상단 필터: 시험유형 드롭다운 (전체/유형별)
- 테이블 ↔ 라인차트 토글 버튼
- "[+ 입력폼 링크 생성]" 버튼 (manager 이상만 표시) → 모달로 토큰 생성 + URL 복사
```

---

### 프롬프트 4: Q4 시험대상자 + SSE 실시간

```
KDRI MIS 프로젝트에 Q4 시험대상자 모듈과 SSE 실시간 통신을 추가합니다.

[Q4 더미 데이터 생성: server/seeds/seed-dummy-subjects.js]
- 문정연구소: 임상1팀, 임상2팀, 비임상팀 (3개 부서)
- 가산연구소: 시험검사팀, 특수시험팀 (2개 부서)
- 최근 3개월 (2026년 2월~4월) 일별 데이터 생성
- 일별 시험대상자 수: 부서당 5~30명 랜덤
- study_name: "STUDY-{연구소약자}-{부서약자}-{순번}" 형식

[API]
- GET /api/subjects?lab=문정&month=4&year=2026: 일별 시험대상자 데이터
- GET /api/subjects/summary: 연구소별 요약 { lab, today, monthlyTotal, annualTotal, departments:[...] }

[프론트엔드 Q4: components/charts/SubjectCards.jsx]
- 연구소별 카드 2개 (문정 / 가산)
- 각 카드:
  - 연구소명 (큰 글씨)
  - 오늘 시험대상자 수 (강조 숫자)
  - 월 누적 / 연 누적 (서브 텍스트)
  - 소형 라인차트: 최근 30일 일별 추이 (Recharts LineChart, height 80px)
- 카드 클릭 시 하단에 부서별 상세 테이블 펼침 (Accordion)

[SSE 실시간 통신: server/services/sseManager.js]
- GET /api/events: SSE 스트림 엔드포인트
  - 인증 필수 (세션 쿠키)
  - Connection: keep-alive, Content-Type: text/event-stream
  - 클라이언트별 연결 관리 (Map으로 관리, 연결 해제 시 정리)
- 이벤트 타입:
  - sales-update: Google Sheets 매출 데이터 변경 시
  - test-count-update: Q3 시험건수 입력/수정/삭제 시
  - subject-update: Q4 데이터 변경 시
  - heartbeat: 15초마다 { type: "ping" }
- broadcast 함수: 전체 연결된 클라이언트에 이벤트 전송
- Nginx SSE 전용 설정 필수:
  - location /api/events에 별도 블록 추가
  - proxy_buffering off, proxy_cache off, proxy_read_timeout 86400s
  - Connection 헤더 빈 문자열로 설정, chunked_transfer_encoding off
  - rate limiting에서 제외

[프론트엔드 SSE: client/src/hooks/useSSE.js]
- EventSource로 /api/events 구독 (withCredentials: true)
- 이벤트별 Zustand store 업데이트
- 연결 끊김 시 exponential backoff로 자동 재연결 (1초→2초→4초...최대 30초, 최대 10회)
- 재연결 성공(onopen) 시 모든 사분면 데이터를 REST API로 전체 재조회하여 놓친 이벤트 보상
- 연결 상태 표시: 헤더에 초록/빨간 점 (store.connectionStatus)

[기존 API 폴링 → SSE 전환]
- Q1/Q2의 30초 폴링을 SSE 이벤트 수신으로 변경
- Google Sheets 폴링은 서버 백그라운드에서 유지, 변경 감지 시 SSE broadcast
```

---

### 프롬프트 5: 전체 통합 + 4분할 레이아웃 + 헤더

```
KDRI MIS 대시보드의 전체 레이아웃을 통합합니다.

[헤더: components/layout/Header.jsx]
- 높이 64px, 배경 #1e293b (slate-800)
- 좌측: 로고 이미지 (48x48, src="/logo.png", alt="KDRI") + "경영정보현황시스템" (white, 20px, bold)
- 중앙~우측:
  - 연구소 선택 드롭다운: 전체 / 문정 / 가산 (기본: 전체)
  - 기간 선택: 연도(2024~2026) + 월(1~12) 드롭다운 (기본: 현재)
  - 새로고침 버튼 (RefreshCw 아이콘, lucide-react)
  - SSE 연결 상태 표시 (초록점/빨간점)
  - 사용자명 + 로그아웃 버튼
- 반응형: 모바일에서 햄버거 메뉴로 전환

[4분할 대시보드: pages/DashboardPage.jsx]
- CSS Grid: grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
- 전체 높이: calc(100vh - 64px)
- 각 사분면에 패딩 16px, 구분선 1px solid #e2e8f0
- Q1(좌상): SalesDonut + DepartmentStack
- Q2(우상): QuarterlyBar
- Q3(좌하): TestCountTable
- Q4(우하): SubjectCards
- 각 사분면 상단에 제목 바: 배경 #f1f5f9, 아이콘 + 제목 텍스트

[연구소 필터 동작]
- 헤더에서 연구소 선택 시 전체 사분면 데이터 필터링
- Zustand store의 selectedLab 상태로 관리
- Q1: 해당 연구소 부서만 표시 (전체 선택 시 모든 부서)
- Q2: 해당 연구소 부서만 표시
- Q3: 해당 연구소 시험건수만 표시
- Q4: 해당 연구소 카드만 표시 (전체 시 양쪽 모두)

[로그인 페이지: pages/LoginPage.jsx]
- 중앙 정렬 로그인 카드
- 로고 + 시스템명 + 사번/비밀번호 입력 + 로그인 버튼
- 로그인 성공 → /dashboard 리다이렉트
- React Router ProtectedRoute: 미인증 시 /login 리다이렉트

[반응형]
- 1280px+: 2x2 그리드
- 768~1279px: 2x2 유지, 폰트 축소
- ~767px: 1열 세로 스택, 각 사분면 min-height 300px

[로고 교체 안내]
- public/logo.png에 회사 로고 파일을 넣으면 자동 반영
- 없으면 "KDRI" 텍스트 폴백 표시
```

---

### 프롬프트 6: 보안 강화 + 테스트 + 배포

```
KDRI MIS 프로젝트의 보안 강화, 테스트, 배포 설정을 완료합니다.

[보안 강화]
1. Nginx 최종 설정:
   - allow 10.0.0.0/8; allow 172.16.0.0/12; allow 192.168.0.0/16; deny all;
   - rate limiting: 일반 API zone=api 60r/m, 로그인 zone=login 5r/m, SSE /api/events는 rate limiting 제외
   - SSE 전용 location /api/events: proxy_buffering off, proxy_cache off, proxy_read_timeout 86400s, Connection '' 설정
   - SSL: TLSv1.2 TLSv1.3만 허용, HIGH ciphers
   - 모든 보안 헤더 적용 (X-Frame-Options, HSTS, CSP, X-Content-Type-Options)
   - CSP에 img-src data:, connect-src 'self', font-src 'self' 추가 (Recharts SVG 호환)
2. Express 보안:
   - helmet() 기본 설정
   - CORS origin 제한
   - 세션 쿠키: httpOnly, secure, sameSite: 'strict'
   - CSRF: csrf-csrf 패키지의 doubleCsrf() 미들웨어 적용. csurf는 deprecated이므로 사용하지 않음.
   - API 입력값 전체 sanitize (xss 필터)
   - SQL injection 방지: prepared statements만 사용 (better-sqlite3 기본 지원)
3. 파일 권한:
   - data/mis.db: chmod 600
   - credentials.json: chmod 600
   - .env: chmod 600

[스크립트]
1. scripts/setup.sh: 전체 설치 자동화 (Node.js 확인, npm install, SSL 생성, DB 초기화, 빌드, Nginx 설정, PM2 시작)
2. scripts/generate-ssl.sh: mkcert 설치 확인 → mis.kdri.local 인증서 생성 → nginx/ssl/에 복사
3. scripts/backup-db.sh: SQLite 백업 (.backup 명령), 7일 보관, crontab 등록 안내

[PM2 설정: ecosystem.config.js]
- 단일 인스턴스, 500M 메모리 제한, 자동 재시작
- 로그 파일: logs/error.log, logs/access.log
- 매일 05:00 cron 재시작

[README.md]
- 시스템 소개, 사전 요구사항 (Node.js 20, Nginx, mkcert)
- 설치 방법 (setup.sh 실행)
- Google Sheets 연동 설정 가이드 (Google Cloud Console → 서비스 계정 → 시트 공유)
- 환경 변수 설명
- 사용자 관리 (admin 계정으로 로그인 후 사용자 추가)
- 입력폼 링크 생성 방법
- 백업/복구 방법
- 트러블슈팅 FAQ
- 클라이언트 PC hosts 파일 설정 안내

모든 파일에 한글 주석을 충분히 달아주세요.
```

---

## 부록: 참고 사항

### A. 부서 목록 (기본값)

| 연구소 | 부서명 |
|--------|--------|
| 문정 | 임상1팀, 임상2팀, 비임상팀, 경영지원팀 |
| 가산 | 시험검사팀, 특수시험팀 |

> ⚠️ 실제 부서 구성에 따라 `server/config/departments.js`에서 수정 가능하도록 설계

### B. 시험유형 목록 (기본값)

- HET-CAM
- 첩포시험 (Patch Test)
- 인체적용시험
- 안자극시험
- 광독성시험
- 기타

> ⚠️ 입력폼에서 "기타" 선택 시 직접 입력 가능

### C. 컬러 팔레트

| 용도 | 색상 | HEX |
|------|------|-----|
| Primary | Navy | #1e293b |
| Success | Green | #22c55e |
| Warning | Yellow | #eab308 |
| Danger | Red | #ef4444 |
| Info | Blue | #3b82f6 |
| Background | Light Gray | #f8fafc |
| Card Border | Gray | #e2e8f0 |
| 문정연구소 | Teal | #14b8a6 |
| 가산연구소 | Indigo | #6366f1 |

### D. Q4 Google Sheets 연동 전환 가이드 (2차)

```
1. .env에 SHEET_ID_SUBJECTS 추가
2. server/services/googleSheets.js에 fetchSubjectData() 메서드 추가
3. 폴링 루프에 subjects 데이터 추가
4. GET /api/subjects 라우트에서 데이터 소스를 SQLite → Google Sheets로 전환
5. 전환 플래그: .env의 SUBJECT_DATA_SOURCE=sheets (기본: sqlite)
6. 기존 더미 데이터는 폴백으로 유지
```

---

> **문서 끝** | KDRI 경영정보현황시스템 설계명세서 v1.1
> 본 문서는 Claude Code 구현용으로 작성되었으며, 각 프롬프트를 순서대로 실행하여 시스템을 구축합니다.
> v1.1 개정: csurf→csrf-csrf 교체, SSE Nginx 설정 보완, 네트워크 정책 명확화, Rate Limiting 조정, 토큰 다회사용 확정, UPSERT 감사 추적, SSE 재연결 동기화 외 기타 보완
