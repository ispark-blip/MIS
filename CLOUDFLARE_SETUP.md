# Cloudflare Tunnel + Access 설정 가이드

KDRI MIS 대시보드를 외부에서 안전하게 접속할 수 있도록 Cloudflare Tunnel과 Cloudflare Access(Zero Trust)를 설정하는 가이드입니다.

## 보안 구조

```
[외부 사용자] → [Cloudflare Access (이메일 OTP 인증)]
              → [Cloudflare Tunnel (암호화 터널)]
              → [사내 MIS 서버 (127.0.0.1:3000)]
```

- **외부 포트 개방 불필요**: 방화벽에 구멍을 뚫지 않음. 서버가 Cloudflare로 아웃바운드 연결만 맺음.
- **이중 인증**: Cloudflare Access(이메일 OTP) + MIS 자체 로그인.
- **IP 은폐**: 서버의 실제 IP가 외부에 노출되지 않음.

## 사전 준비물

1. **도메인 1개** (예: `your-company.com`) — 가비아, 후이즈, Cloudflare Registrar 등 어디서 구입해도 OK
2. **Cloudflare 계정** (무료) — https://dash.cloudflare.com/sign-up
3. **MIS 서버 머신** (Windows/Linux 모두 가능)

## 1단계: 도메인을 Cloudflare에 연결

1. Cloudflare 대시보드 로그인 → **Add a site** 클릭
2. 도메인 입력 → **Free** 플랜 선택
3. Cloudflare가 제공하는 **네임서버 2개**를 도메인 등록업체(가비아 등)의 네임서버 설정에 입력
4. 전파까지 보통 5분~수 시간 (이메일 알림 옴)

## 2단계: Cloudflare Tunnel 생성

1. Cloudflare 대시보드 왼쪽 메뉴에서 **Zero Trust** 클릭
   - 처음 사용 시 팀 이름(Team name) 설정 및 Free 플랜 선택
2. Zero Trust 메뉴 → **Networks** → **Tunnels** → **Create a tunnel** 클릭
3. 커넥터 선택: **Cloudflared**
4. 터널 이름: `mis-tunnel` (자유)
5. 다음 화면에서 **OS에 맞는 설치 명령**이 표시됨. 서버 머신에서 그대로 실행:

### Windows (MIS 서버가 Windows인 경우)

다운로드 URL이 화면에 표시됩니다. 관리자 권한 PowerShell에서:

```powershell
# Cloudflare가 화면에 제공하는 토큰을 포함한 명령을 그대로 복사-붙여넣기
cloudflared.exe service install eyJhIjoi...(긴 토큰)...
```

서비스로 자동 시작되며, PC 재부팅 후에도 유지됩니다.

### Linux (MIS 서버가 Linux인 경우)

```bash
# Cloudflare가 제공하는 명령 그대로
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install eyJhIjoi...(긴 토큰)...
```

6. 설치 후 Cloudflare 대시보드로 돌아가면 **Connector가 Connected 상태**로 표시됨 → **Next**

## 3단계: 공개 라우팅 설정

터널 생성 화면의 **Public Hostname** 탭에서:

| 항목 | 입력값 |
|------|--------|
| Subdomain | `mis` (또는 원하는 이름) |
| Domain | 등록한 도메인 선택 (예: `your-company.com`) |
| Path | (비워둠) |
| Service Type | `HTTP` |
| URL | `localhost:3000` |

저장 후 `https://mis.your-company.com` 으로 접근 가능해집니다.

## 4단계: Cloudflare Access로 이메일 인증 추가 (핵심 보안)

이 단계를 반드시 해야 외부인이 MIS 로그인 페이지조차 볼 수 없습니다.

1. Zero Trust → **Access** → **Applications** → **Add an application**
2. **Self-hosted** 선택
3. 설정:
   - **Application name**: `KDRI MIS`
   - **Session Duration**: `24 hours` (원하는 값)
   - **Application domain**: `mis.your-company.com`
4. **Next** → **Add a policy**:
   - **Policy name**: `Allow KDRI staff`
   - **Action**: `Allow`
   - **Configure rules** → Include → **Emails** 또는 **Emails ending in**
     - 개인 이메일 나열: `user1@naver.com, user2@gmail.com, ...`
     - 또는 회사 도메인: `@your-company.com`
5. **Next** → **Add application** 저장

이제 `https://mis.your-company.com` 접속 시 **Cloudflare가 먼저 이메일 확인 화면**을 띄우고, 허용된 이메일로 발송되는 **6자리 OTP** 입력 후에만 MIS 로그인 페이지로 진입합니다.

## 5단계: MIS 서버 프로덕션 설정

서버 머신의 `.env` 파일(프로젝트 루트)을 프로덕션용으로 수정:

```bash
NODE_ENV=production
PORT=3000
HOST=127.0.0.1                                    # ← 외부 직접 접속 차단
SESSION_SECRET=<openssl rand -hex 32 결과값>        # ← 반드시 교체
CORS_ORIGIN=https://mis.your-company.com          # ← 본인 도메인
```

### SESSION_SECRET 생성 방법

**Linux/Mac:**
```bash
openssl rand -hex 32
```

**Windows PowerShell:**
```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

생성된 64자 난수 문자열을 `.env`의 `SESSION_SECRET`에 붙여넣기.

## 6단계: 서버 재시작 및 검증

서버 재시작:
```bash
cd D:\MIS_KIDS\server    # Windows
node app.js
```

또는 Linux/Mac:
```bash
cd /path/to/MIS/server
node app.js
```

외부에서 브라우저로 `https://mis.your-company.com` 접속 → Cloudflare 이메일 OTP 화면 → OTP 입력 → MIS 로그인 화면 순으로 나오면 정상.

## 보안 점검 체크리스트

- [ ] 도메인이 Cloudflare에 연결됨 (Active 상태)
- [ ] Cloudflare Tunnel Connector가 Healthy/Connected 상태
- [ ] Cloudflare Access 정책이 활성화되어 있고, 허용 이메일만 등록됨
- [ ] 서버 `.env`의 `NODE_ENV=production`, `HOST=127.0.0.1`
- [ ] 서버 `.env`의 `SESSION_SECRET`이 기본값이 아닌 랜덤 문자열
- [ ] 사내 공유기/방화벽에 외부 포트 포워딩이 **없음** (터널만 사용)
- [ ] 테스트: 등록 안 된 이메일로 접속 시도 → Cloudflare에서 차단됨

## 서버 코드에 이미 적용된 보안

- `trust proxy` 설정: Cloudflare Tunnel의 실제 사용자 IP 로깅 가능
- 프로덕션 모드에서 자동으로 `secure: true` 쿠키 (HTTPS에서만 전송)
- 로그인 무차별 대입 방지: IP+사번 기준 15분 내 10회 실패 시 15분 잠금
- `httpOnly` + `sameSite: lax` 세션 쿠키 (XSS/CSRF 방어)

## 자주 발생하는 문제

### Q. `Error 502 Bad Gateway` 발생
A. MIS 서버가 꺼져있거나 `HOST`가 `127.0.0.1` 이 아닌 다른 IP로 바인딩된 상태. 서버 실행 상태 및 `.env` 확인.

### Q. 로그인 후 곧바로 로그아웃됨
A. `secure` 쿠키 문제. `trust proxy` 설정이 되어있는지 확인 (이미 코드에 반영됨). 브라우저에서 이전 세션 쿠키 삭제 후 재시도.

### Q. Cloudflare Access에 등록되지 않은 사람이 접속 가능함
A. Access 정책 **Action**이 `Allow`가 아닌 `Bypass`로 되어있을 수 있음. 정책을 확인하고 `Bypass` 삭제.

### Q. 실시간 업데이트(SSE)가 100초마다 끊김
A. 정상 동작. `useSSE.js`의 exponential backoff 재연결 로직이 자동으로 재연결하므로 사용자 체감상 문제 없음.

## 비용

- **Cloudflare Free Plan**: 무료
- **Cloudflare Zero Trust Free Plan**: 50명까지 무료 (MIS 사용자 기준 충분)
- **도메인 비용**: 연 1~2만원 내외 (.com 기준)

---

설정 중 문제가 생기면 Cloudflare 대시보드의 **Logs** 메뉴에서 Tunnel/Access 로그를 확인하세요.
