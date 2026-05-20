#!/usr/bin/env python3
"""
save_to_db.py - パース結果をSQLite DBに保存し、CSVに出力するスクリプト

使用法:
    python save_to_db.py --input votes.json                    # JSONからDB保存
    python save_to_db.py --input votes.json --csv-only          # CSVのみ出力
    python save_to_db.py --input votes.json --db myvotes.db     # DB名指定
"""

import argparse
import csv
import json
import os
import sqlite3
import sys
from datetime import datetime


def create_table(conn: sqlite3.Connection) -> None:
    """votesテーブルを作成"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_number INTEGER,
            date TEXT,
            bill_name TEXT,
            member_name TEXT,
            vote TEXT,
            bill_type TEXT,
            issue_id TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(date)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_votes_member ON votes(member_name)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_votes_bill ON votes(bill_name)
    """)
    conn.commit()


def insert_votes(
    conn: sqlite3.Connection,
    parsed_data: list[dict],
) -> int:
    """パース結果をDBに挿入し、挿入行数を返す"""
    count = 0
    for meeting in parsed_data:
        session_number = meeting.get("sessionNumber")
        date = meeting.get("date", "")
        issue_id = meeting.get("issueID", "")
        for vote_block in meeting.get("votes", []):
            bill_name = vote_block.get("bill_name", "")
            bill_type = vote_block.get("bill_type", "")
            for member in vote_block.get("yeas", []):
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO votes (session_number, date, bill_name, member_name, vote, bill_type, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (session_number, date, bill_name, member, "賛成", bill_type, issue_id),
                    )
                    if conn.total_changes:
                        count += 1
                except sqlite3.IntegrityError:
                    pass
            for member in vote_block.get("nays", []):
                try:
                    conn.execute(
                        "INSERT OR IGNORE INTO votes (session_number, date, bill_name, member_name, vote, bill_type, issue_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (session_number, date, bill_name, member, "反対", bill_type, issue_id),
                    )
                    if conn.total_changes:
                        count += 1
                except sqlite3.IntegrityError:
                    pass
    conn.commit()
    return count


def export_csv(
    parsed_data: list[dict],
    output_path: str,
) -> int:
    """パース結果をCSVに出力"""
    fieldnames = [
        "session_number", "date", "bill_name", "bill_type",
        "member_name", "vote", "issue_id",
    ]
    count = 0
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for meeting in parsed_data:
            session_number = meeting.get("sessionNumber")
            date = meeting.get("date", "")
            issue_id = meeting.get("issueID", "")
            for vote_block in meeting.get("votes", []):
                bill_name = vote_block.get("bill_name", "")
                bill_type = vote_block.get("bill_type", "")
                for member in vote_block.get("yeas", []):
                    writer.writerow({
                        "session_number": session_number,
                        "date": date,
                        "bill_name": bill_name,
                        "bill_type": bill_type,
                        "member_name": member,
                        "vote": "賛成",
                        "issue_id": issue_id,
                    })
                    count += 1
                for member in vote_block.get("nays", []):
                    writer.writerow({
                        "session_number": session_number,
                        "date": date,
                        "bill_name": bill_name,
                        "bill_type": bill_type,
                        "member_name": member,
                        "vote": "反対",
                        "issue_id": issue_id,
                    })
                    count += 1
    return count


def load_parsed_data(input_path: str) -> list[dict]:
    """JSONファイルからパース結果を読み込む"""
    with open(input_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="パース結果をSQLite DBに保存・CSV出力"
    )
    parser.add_argument(
        "--input", type=str, required=True,
        help="parse_votes.py が出力したJSONファイル",
    )
    parser.add_argument(
        "--db", type=str, default="votes.db",
        help="SQLite DBファイル (デフォルト: votes.db)",
    )
    parser.add_argument(
        "--csv", type=str, default=None,
        help="CSV出力先 (デフォルト: {inputファイル名}.csv)",
    )
    parser.add_argument(
        "--csv-only", action="store_true",
        help="CSVのみ出力（DB保存しない）",
    )
    args = parser.parse_args()

    # データ読み込み
    data = load_parsed_data(args.input)

    # CSV出力
    csv_path = args.csv or (os.path.splitext(args.input)[0] + ".csv")
    csv_count = export_csv(data, csv_path)
    print(f"CSV出力: {csv_path} ({csv_count}行)", file=sys.stderr)

    # DB保存
    if not args.csv_only:
        conn = sqlite3.connect(args.db)
        create_table(conn)
        db_count = insert_votes(conn, data)
        conn.close()
        print(f"DB保存: {args.db} ({db_count}行)", file=sys.stderr)
    else:
        print("DB保存: スキップ (--csv-only)", file=sys.stderr)


if __name__ == "__main__":
    main()
