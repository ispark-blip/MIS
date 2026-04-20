require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');

const SQLiteSessionStore = require('./config/sessionStore');
const SSEManager = require('./services/sseManager');
const GoogleSheetsService = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Cloudflare Tunnel/리버스 프록시 뒤에서 동작: X-Forwarded-* 헤더 신뢰
// (원본 클라이언트 IP를 req.ip로 얻기 위함, secure 쿠키 판정에도 필요)
app.set('trust proxy', 1);

// SSE 매니저 초기화
const sseManager = new SSEManager();
app.set('sseManager', sseManager);

// 미들웨어
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// 세션 설정
const isProd = process.env.NODE_ENV === 'production';
app.use(session({
  store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || 'kdri-mis-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // 프로덕션(Cloudflare Tunnel 경유)에서는 항상 secure 쿠키
    secure: isProd || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8시간
  },
}));

// 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/test-counts', require('./routes/testCounts'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/events', require('./routes/events'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/config', require('./routes/config'));

// 업로드 파일 서빙 (로고 등)
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// React 빌드 파일 서빙 (프로덕션)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '경로를 찾을 수 없습니다.' } });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Google Sheets 연동 시작
(async () => {
  const sheetsService = new GoogleSheetsService();
  const connected = await sheetsService.authenticate();
  if (connected) {
    sheetsService.startPolling((event, data) => sseManager.broadcast(event, data));
    app.set('sheetsService', sheetsService);
    console.log('[Sheets] Google Sheets 폴링 시작 (30초 간격)');
  }
})();

// 로컬 네트워크 IP 목록 추출
function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

// HTTPS 인증서가 설정되어 있으면 HTTPS로, 아니면 HTTP로 기동
// (고정 IP 외부 노출 시 자체 서명 인증서 사용 권장 → 비밀번호 암호화 전송)
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT) || 3443;

const useHttps = HTTPS_CERT_PATH && HTTPS_KEY_PATH
  && fs.existsSync(HTTPS_CERT_PATH) && fs.existsSync(HTTPS_KEY_PATH);

function logUrls(protocol, port) {
  console.log(`[서버] KIDS MIS 서버 시작 (${protocol.toUpperCase()} 포트 ${port})`);
  console.log(`  - 로컬:      ${protocol}://localhost:${port}`);
  for (const ip of getLocalIps()) {
    console.log(`  - 네트워크:  ${protocol}://${ip}:${port}`);
  }
}

if (useHttps) {
  const credentials = {
    cert: fs.readFileSync(HTTPS_CERT_PATH),
    key: fs.readFileSync(HTTPS_KEY_PATH),
  };
  https.createServer(credentials, app).listen(HTTPS_PORT, HOST, () => {
    logUrls('https', HTTPS_PORT);
  });

  // HTTP → HTTPS 리다이렉트 서버 (같은 호스트의 다른 포트로 접속 시 HTTPS로 보냄)
  if (process.env.HTTP_REDIRECT === 'true') {
    http.createServer((req, res) => {
      const host = (req.headers.host || '').split(':')[0];
      res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
      res.end();
    }).listen(PORT, HOST, () => {
      console.log(`[서버] HTTP → HTTPS 리다이렉트 (포트 ${PORT} → ${HTTPS_PORT})`);
    });
  }
} else {
  app.listen(PORT, HOST, () => {
    logUrls('http', PORT);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[경고] 프로덕션 환경에서 HTTPS가 비활성화되어 있습니다. HTTPS_CERT_PATH / HTTPS_KEY_PATH 환경변수를 설정하세요.');
    }
  });
}
