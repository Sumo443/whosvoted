#!/bin/bash
# setup-data.sh - votes.db をプロジェクトにコピー

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DB="$SCRIPT_DIR/../voting_watcher/votes.db"
TARGET_DIR="$SCRIPT_DIR/data"

if [ ! -f "$SOURCE_DB" ]; then
  echo "ERROR: $SOURCE_DB が見つかりません。"
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_DB" "$TARGET_DIR/votes.db"
echo "OK: votes.db を $TARGET_DIR/ にコピーしました"
ls -lh "$TARGET_DIR/votes.db"
