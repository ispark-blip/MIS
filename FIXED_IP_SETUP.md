# 고정 IP 외부 접속 설정 가이드

도메인 없이 **고정 공인 IP**로 KDRI MIS에 외부 접속하는 방법입니다.

## 보안 구조

```
[외부 사용자] → (HTTPS) → [공유기 포트포워딩] → [MIS 서버 127.0.0.1:3443]
                                                    ↓
                                              [자체 서명 SSL 인증서로 암호화]
                                              [MIS 로그인 + brute-force 방지]
```

## 필요한 것

1. **공인 고정 IP** (ISP에 확인. 유동 IP는 불가 — 재부팅 시 IP 변경됨)
2. **공유기 관리자 접속 권한** (포트포워딩 설정용)
3. **MIS 서버 PC** (Windows 또는 Linux)

## 보안상 주의

- 도메인 방식보다 **보안이 약합니다**. 이유:
  - Cloudflare Access 같은 이메일 인증 장벽이 없음
  - IP가 외부에 직접 노출되어 자동화된 공격(포트 스캔, 취약점 탐지)의 대상
- 반드시 **HTTPS(자체 서명 인증서)** 를 써서 비밀번호가 평문 전송되지 않도록 합니다.
- MIS 자체 로그인 인증 + brute-force 방지(이미 구현됨)로 1차 방어합니다.

## 1단계: 공인 IP 확인

1. MIS 서버 PC에서 브라우저로 https://whatismyip.com 접속
2. 표시되는 IP (예: `123.45.67.89`)가 공인 IP
3. 이 IP가 **고정**인지 ISP에 확인 (일반 가정용은 대부분 유동)
   - 고정 IP가 아니면 DDNS(DuckDNS 등)를 써야 하는데, 그럼 이미 "도메인"을 쓰는 것과 같아집니다
   - 가정용 인터넷의 경우 수개월~수년 동안 IP가 바뀌지 않기도 하지만, 보장 안 됨

## 2단계: 자체 서명 SSL 인증서 생성

### Windows PowerShell (관리자 권한)

PowerShell에서 `openssl` 이 설치되어 있는지 먼저 확인:

```powershell
openssl version
```

**OpenSSL이 있는 경우:**
```powershell
cd D:\MIS_KIDS
mkdir certs
cd certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 3650 -nodes -subj "/CN=mis-server"
```

**OpenSSL이 없는 경우** (Windows 내장 PowerShell 사용):
```powershell
cd D:\MIS_KIDS
New-Item -ItemType Directory -Force -Path certs | Out-Null
cd certs

# 10년짜리 자체 서명 인증서를 LocalMachine\My 에 생성
$cert = New-SelfSignedCertificate `
  -Subject "CN=mis-server" `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -NotAfter (Get-Date).AddYears(10) `
  -CertStoreLocation "Cert:\LocalMachine\My"

# PFX(개인키 포함)로 export
$pwd = ConvertTo-SecureString -String "temp-pfx-pwd" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ".\cert.pfx" -Password $pwd | Out-Null

# PFX → PEM 변환 (OpenSSL 필요 — 없으면 아래 "대안" 참고)
openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem -password pass:temp-pfx-pwd
openssl pkcs12 -in cert.pfx -clcerts -nokeys -out cert.pem -password pass:temp-pfx-pwd
Remove-Item cert.pfx
```

**OpenSSL 설치가 정말 어려운 경우 대안**: Git for Windows를 설치하면 `C:\Program Files\Git\usr\bin\openssl.exe` 가 함께 설치됩니다.

### Linux / Mac

```bash
cd /path/to/MIS
mkdir -p certs
cd certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 3650 -nodes -subj "/CN=mis-server"
chmod 600 key.pem
```

결과: `D:\MIS_KIDS\certs\cert.pem`, `D:\MIS_KIDS\certs\key.pem` 생성됨.

## 3단계: MIS 서버 `.env` 수정

`D:\MIS_KIDS\.env` 파일 (또는 프로젝트 루트의 `.env`):

```ini
NODE_ENV=production
PORT=3000
HTTPS_PORT=3443
HOST=0.0.0.0

# 세션 시크릿 (openssl rand -hex 32 또는 아래 PowerShell로 생성)
SESSION_SECRET=<랜덤 64자 문자열>

# CORS 허용 (자기 공인 IP)
CORS_ORIGIN=https://123.45.67.89:3443

# HTTPS 인증서 경로 (2단계에서 생성한 파일)
HTTPS_CERT_PATH=D:\MIS_KIDS\certs\cert.pem
HTTPS_KEY_PATH=D:\MIS_KIDS\certs\key.pem

# HTTP(3000) 접속을 HTTPS(3443)로 리다이렉트
HTTP_REDIRECT=true
```

**SESSION_SECRET 생성** (Windows PowerShell):
```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

## 4단계: 공유기 포트포워딩

공유기 관리자 페이지 (`http://192.168.0.1` 또는 `http://192.168.1.1`) 로그인 후:

| 외부 포트 | 내부 IP | 내부 포트 | 프로토콜 |
|----------|---------|----------|---------|
| 3443 | MIS 서버의 사설 IP (예: `192.168.20.64`) | 3443 | TCP |
| 3000 | MIS 서버의 사설 IP | 3000 | TCP |

- **3443**: HTTPS 실제 서비스 포트
- **3000**: HTTP → HTTPS 리다이렉트용 (선택사항, 없어도 됨)

**보안 Tip**: 외부 포트는 기본값 대신 랜덤한 번호로 바꿔두면 자동 스캔 공격을 크게 줄일 수 있습니다. 예: 외부 `51443` → 내부 `3443`. 접속 시 `https://123.45.67.89:51443` 으로 접근.

## 5단계: 방화벽 설정 (Windows Defender)

```powershell
# 관리자 PowerShell
New-NetFirewallRule -DisplayName "MIS HTTPS" -Direction Inbound -LocalPort 3443 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "MIS HTTP-redirect" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 6단계: 서버 실행

```powershell
cd D:\MIS_KIDS\server
node app.js
```

로그에 아래가 나오면 정상:
```
[서버] KIDS MIS 서버 시작 (HTTPS 포트 3443)
  - 로컬:      https://localhost:3443
  - 네트워크:  https://192.168.20.64:3443
[서버] HTTP → HTTPS 리다이렉트 (포트 3000 → 3443)
```

## 7단계: 접속 테스트

1. **사내에서 먼저 테스트**: 다른 PC 브라우저에서 `https://192.168.20.64:3443`
2. **자체 서명 인증서 경고 뜸** → **"고급" → "안전하지 않음(계속 진행)"** 클릭 (정상. 브라우저가 공인 CA가 아니라고 경고하는 것)
3. MIS 로그인 화면 나오면 성공
4. **외부망에서 접속**: 핫스팟 등 다른 네트워크에서 `https://123.45.67.89:3443` (본인 공인 IP) 테스트

## 브라우저 경고 해결 (선택)

자체 서명 인증서이므로 사용자마다 매번 "안전하지 않음" 경고를 봅니다. 두 가지 해결책:

### A. 사용자 PC에 인증서를 "신뢰" 등록 (번거로움)
각 사용자가 `cert.pem`을 다운로드받아 Windows 인증서 저장소의 "신뢰할 수 있는 루트 인증 기관" 에 설치. 안내 복잡함.

### B. 무료 도메인+Let's Encrypt로 업그레이드 (권장)
`DuckDNS` 등으로 무료 서브도메인 발급 → Let's Encrypt로 공인 SSL 인증서 발급. 경고 없이 접속 가능.
→ 이 방식 원하시면 별도 가이드 드리겠습니다.

## 보안 체크리스트

- [ ] `.env`의 `SESSION_SECRET`이 기본값이 아닌 랜덤 64자
- [ ] `NODE_ENV=production`
- [ ] HTTPS 인증서 파일(`key.pem`)이 일반 사용자 읽기 금지 (Linux: `chmod 600`)
- [ ] 공유기 포트포워딩이 **3443/3000만** 열려있고 다른 포트는 닫혀있음
- [ ] Windows Defender/방화벽이 켜져 있음 (위에서 3443/3000만 허용)
- [ ] 서버 PC의 Windows 업데이트가 최신
- [ ] 서버 PC에 불필요한 프로그램(원격 데스크톱 등)이 외부 노출 안 됨
- [ ] MIS admin 계정 비밀번호가 강력함 (최소 12자, 대소문자+숫자+특수문자)
- [ ] 주기적으로 `data/access-log.db` 의 `login_failed` 기록 확인 → 비정상 시도 모니터링

## 이미 적용된 보안 (서버 코드)

- HTTPS 지원 (cert/key 경로 설정 시 자동 활성화)
- HTTP → HTTPS 자동 리다이렉트
- 프로덕션 모드 `secure` 쿠키 (HTTPS에서만 전송)
- `httpOnly` + `sameSite: lax` 쿠키 (XSS/CSRF 방어)
- `trust proxy` (리버스 프록시 뒤에서도 실제 클라이언트 IP 로깅)
- 로그인 무차별 대입 방지: IP+사번 기준 15분 내 10회 실패 시 15분 잠금
- `helmet`: 기본 보안 HTTP 헤더 자동 추가

## 자주 발생하는 문제

### Q. 외부에서 접속 안 됨
A. 순서대로 확인:
1. 공인 IP가 정확한가? (서버 PC에서 https://whatismyip.com 확인)
2. 공유기 포트포워딩이 제대로 되어 있는가?
3. Windows 방화벽이 허용하는가? (`netsh advfirewall firewall show rule name=all | findstr 3443`)
4. 외부 서비스 https://www.yougetsignal.com/tools/open-ports/ 에서 3443 포트 open 상태로 나오는가?
5. 서버가 실제로 3443을 리스닝 중인가? (`netstat -ano | findstr 3443`)

### Q. 브라우저 경고가 계속 뜸
A. 자체 서명 인증서의 특성상 정상. B방식(무료 도메인+Let's Encrypt) 고려.

### Q. 공인 IP가 바뀌었다
A. 유동 IP입니다. ISP에 고정 IP 요청하거나 DDNS(DuckDNS 등) 사용 필요.

### Q. 밤 사이 누군가 수천 번 로그인 시도한 기록이 있음
A. brute-force 방지가 작동하여 차단된 상태입니다. 로그상 `login_locked` 항목을 주기적으로 확인하세요. 심각하면 공유기 포트포워딩 외부 포트 번호를 바꿔 자동 스캐너를 회피.
