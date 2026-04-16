#!/bin/bash
# KDRI MIS - SQLite DB 백업
# crontab: 0 2 * * * /path/to/scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/../backups"
DB_PATH="$SCRIPT_DIR/../data/mis.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup '${BACKUP_DIR}/mis_${DATE}.db'"

# 7일 이상 된 백업 삭제
find "$BACKUP_DIR" -name "mis_*.db" -mtime +7 -delete

echo "[$(date)] 백업 완료: mis_${DATE}.db"
