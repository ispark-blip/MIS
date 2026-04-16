require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const os = require('os');

const SQLiteSessionStore = require('./config/sessionStore');
const SSEManager = require('./services/sseManager');
const GoogleSheetsService = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

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
app.use(session({
  store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || 'kdri-mis-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
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

app.listen(PORT, HOST, () => {
  console.log(`[서버] KIDS MIS 서버 시작 (포트 ${PORT})`);
  console.log(`  - 로컬:      http://localhost:${PORT}`);
  for (const ip of getLocalIps()) {
    console.log(`  - 네트워크:  http://${ip}:${PORT}`);
  }
});
