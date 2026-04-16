#!/bin/bash
# KDRI MIS - SSL 인증서 생성 (mkcert)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../nginx/ssl"

mkdir -p "$SSL_DIR"

if command -v mkcert &>/dev/null; then
    echo "[SSL] mkcert로 인증서 생성 중..."
    mkcert -install
    mkcert -cert-file "$SSL_DIR/mis.kdri.local.crt" -key-file "$SSL_DIR/mis.kdri.local.key" mis.kdri.local localhost 127.0.0.1
else
    echo "[SSL] mkcert 미설치. openssl로 자체서명 인증서 생성..."
    openssl req -x509 -newkey rsa:2048 -keyout "$SSL_DIR/mis.kdri.local.key" -out "$SSL_DIR/mis.kdri.local.crt" \
        -days 365 -nodes -subj "/CN=mis.kdri.local"
fi

echo "[SSL] 인증서 생성 완료: $SSL_DIR"
