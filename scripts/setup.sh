#!/bin/bash
# KDRI MIS Dashboard 설치 스크립트

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."

echo "===== KDRI MIS Dashboard 설치 시작 ====="

# 1. Node.js 확인
node -v || { echo "Node.js를 설치해주세요 (v20 LTS 권장)"; exit 1; }

# 2. 서버 의존성 설치
echo "[1/6] 서버 의존성 설치..."
cd "$PROJECT_DIR/server" && npm install

# 3. 클라이언트 의존성 설치 + 빌드
echo "[2/6] 클라이언트 의존성 설치 및 빌드..."
cd "$PROJECT_DIR/client" && npm install && npm run build

# 4. 환경 변수
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "[주의] .env 파일에 Google Sheets ID와 SESSION_SECRET를 설정하세요"
fi

# 5. DB 초기화
echo "[3/6] 데이터베이스 초기화..."
cd "$PROJECT_DIR/server"
node seeds/init-db.js
node seeds/seed-users.js
node seeds/seed-dummy-subjects.js

# 6. SSL 인증서 생성
echo "[4/6] SSL 인증서 생성..."
bash "$PROJECT_DIR/scripts/generate-ssl.sh"

# 7. 파일 권한
echo "[5/6] 파일 권한 설정..."
chmod 600 "$PROJECT_DIR/data/mis.db" 2>/dev/null || true
chmod 600 "$PROJECT_DIR/.env" 2>/dev/null || true

echo "[6/6] 설치 완료!"
echo ""
echo "서버 시작: cd server && node app.js"
echo "PM2 사용: pm2 start ecosystem.config.js"
echo "접속: https://mis.kdri.local (hosts 파일 설정 필요)"
echo ""
echo "===== 설치 완료 ====="
