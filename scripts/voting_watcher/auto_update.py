#!/usr/bin/env python3
"""
auto_update.py - 記名投票データ自動更新スクリプト（cron用）

処理の流れ:
    1. last_fetched.txt を読み込み、最終取得日を確認
    2. その日以降の新規会議録のみをNDL APIから検索
    3. 会議録テキストをパース → 賛否データを抽出
    4. SQLite DBに保存
    5. last_fetched.txt を更新

cron設定例（週1・毎週月曜6:00 JST）:
    0 6 * * 1 cd /path/to/voting_watcher && python3 auto_update.py >> auto_update.log 2>&1
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta

# 同一ディレクトリ内のモジュールをインポート
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from search_minutes import search_minutes
from parse_votes import parse_issue
from save_to_db import create_table, insert_votes, export_csv

# デフォルト設定
DEFAULT_LAST_FETCHED = os.path.join(SCRIPT_DIR, "last_fetched.txt")
DEFAULT_DB = os.path.join(SCRIPT_DIR, "votes.db")
DEFAULT_CSV = os.path.join(SCRIPT_DIR, "votes.csv")
REQUEST_DELAY = 1.5


def read_last_fetched(path: str):
    """最終取得日を読み込む"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            date_str = f.read().strip()
            if date_str:
                # 日付形式の検証
                datetime.strptime(date_str, "%Y-%m-%d")
                return date_str
    except (FileNotFoundError, ValueError):
        pass
    return None


def write_last_fetched(path: str, date_str: str):
    """最終取得日を書き込む"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(date_str.strip())
    print(f"  [STATE] 最終取得日を更新: {date_str}", file=sys.stderr)


def find_max_date(parsed_results):
    """パース結果から最大の日付を取得"""
    max_date = "2000-01-01"
    for meeting in parsed_results:
        d = meeting.get("date", "")
        if d and d > max_date:
            max_date = d
    return max_date


def run_update(
    last_fetched_path=DEFAULT_LAST_FETCHED,
    db_path=DEFAULT_DB,
    csv_path=DEFAULT_CSV,
    force=False,
    days_back=None,
):
    """
    自動更新を実行する。

    Args:
        last_fetched_path: 最終取得日を記録するファイル
        db_path: SQLite DBファイル
        csv_path: CSV出力先
        force: 全件再取得（最終取得日を無視）
        days_back: この日数分さかのぼって取得（force優先、次にlast_fetched）

    Returns:
        新規追加された会議録数
    """
    # --- 最終取得日の確認 ---
    if force:
        date_from = None
        print("[MODE] 全件再取得モード", file=sys.stderr)
    elif days_back is not None:
        date_from = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        print(f"[MODE] {days_back}日遡りモード ({date_from})", file=sys.stderr)
    else:
        last_date = read_last_fetched(last_fetched_path)
        if last_date:
            # 最終取得日の翌日から検索
            dt = datetime.strptime(last_date, "%Y-%m-%d") + timedelta(days=1)
            date_from = dt.strftime("%Y-%m-%d")
            print(
                f"[INFO] 前回取得: {last_date} → {date_from} 以降を検索",
                file=sys.stderr,
            )
        else:
            date_from = None
            print("[INFO] 初回実行: 全期間を検索", file=sys.stderr)

    # --- 検索 ---
    print("[STEP 1/3] 記名投票会議録を検索中...", file=sys.stderr)
    if date_from:
        # untilは当日まで
        date_until = datetime.now().strftime("%Y-%m-%d")
        meetings = search_minutes(
            date_from=date_from,
            date_until=date_until,
            max_results=1000,
        )
    else:
        meetings = search_minutes(max_results=1000)

    if not meetings:
        print("[INFO] 新規会議録は見つかりませんでした", file=sys.stderr)
        return 0

    print(
        f"[STEP 1/3] {len(meetings)}件の会議録を検出",
        file=sys.stderr,
    )

    # --- パース ---
    print("[STEP 2/3] 投票データをパース中...", file=sys.stderr)
    all_parsed = []
    success_count = 0
    for i, meeting in enumerate(meetings):
        issue_id = meeting.get("issueID")
        if not issue_id:
            continue
        print(
            f"  [{i+1}/{len(meetings)}] {meeting.get('date','')} {issue_id}",
            file=sys.stderr,
        )
        try:
            result = parse_issue(issue_id)
            if result.get("votes"):
                all_parsed.append(result)
                success_count += 1
            else:
                print(
                    f"  [SKIP] 投票データなし ({issue_id})",
                    file=sys.stderr,
                )
        except Exception as e:
            print(
                f"  [ERROR] パース失敗: {issue_id}: {e}",
                file=sys.stderr,
            )
        time.sleep(REQUEST_DELAY)

    if not all_parsed:
        print("[INFO] パース成功した投票データはありませんでした", file=sys.stderr)
        # 最終取得日を今日に更新（処理済みとしてマーク）
        today = datetime.now().strftime("%Y-%m-%d")
        write_last_fetched(last_fetched_path, today)
        return 0

    # --- 保存 ---
    print("[STEP 3/3] DB/CSVに保存中...", file=sys.stderr)

    # CSV出力
    try:
        csv_count = export_csv(all_parsed, csv_path)
        print(f"  [CSV] {csv_path} ({csv_count}行)", file=sys.stderr)
    except Exception as e:
        print(f"  [WARN] CSV出力失敗: {e}", file=sys.stderr)

    # DB保存
    try:
        from save_to_db import create_table, insert_votes
        import sqlite3
        conn = sqlite3.connect(db_path)
        create_table(conn)
        db_count = insert_votes(conn, all_parsed)
        conn.close()
        print(f"  [DB] {db_path} ({db_count}行)", file=sys.stderr)
    except Exception as e:
        print(f"  [ERROR] DB保存失敗: {e}", file=sys.stderr)
        return -1

    # --- 最終取得日の更新 ---
    today = datetime.now().strftime("%Y-%m-%d")
    write_last_fetched(last_fetched_path, today)

    print(
        f"\n[DONE] {success_count}件の会議録から投票データを更新しました",
        file=sys.stderr,
    )

    return success_count


def main():
    parser = argparse.ArgumentParser(
        description="記名投票データ自動更新スクリプト（cron用）"
    )
    parser.add_argument(
        "--db", type=str, default=DEFAULT_DB,
        help=f"SQLite DBファイル (デフォルト: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--csv", type=str, default=DEFAULT_CSV,
        help=f"CSV出力先 (デフォルト: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--state", type=str, default=DEFAULT_LAST_FETCHED,
        help=f"最終取得日ファイル (デフォルト: {DEFAULT_LAST_FETCHED})",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="全件再取得",
    )
    parser.add_argument(
        "--days", type=int, default=None,
        help="指定日数分さかのぼって取得（forceより弱い）",
    )
    args = parser.parse_args()

    run_update(
        last_fetched_path=args.state,
        db_path=args.db,
        csv_path=args.csv,
        force=args.force,
        days_back=args.days,
    )


if __name__ == "__main__":
    main()
