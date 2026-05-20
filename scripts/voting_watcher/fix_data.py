#!/usr/bin/env python3
"""
fix_data.py - DBの不整合を修正するスクリプト

修正内容:
  1. combined_name（名前1君名前2）を正しく2つの名前に分割
  2. 重複投票レコードの削除
  3. 一意制約の追加

使用法:
    python3 fix_data.py [--db path/to/votes.db]
"""

import argparse
import re
import sqlite3
import sys

SCRIPT_DIR = "/Users/openclaw/.openclaw/workspace/voting_watcher"
DEFAULT_DB = "/Users/openclaw/.openclaw/workspace/whosvoted/data/votes.db"

# 合法的に「君」を含む名前（除外リスト）
LEGITIMATE_NAMES_WITH_KUN = {"畑野君枝"}

def get_legitimate_names(conn):
    """membersテーブルに存在する正しい議員名を取得"""
    rows = conn.execute("SELECT member_name FROM members").fetchall()
    return set(r[0] for r in rows)

def find_combined_names(conn, legit_names):
    """
    votesテーブルから結合名を検出。
    結合名のパターン: 「名前1君名前2」の形で、全体がlegit_namesに存在せず、
    「君」で分割すると両方とも名前らしくなるもの。
    """
    # まず「君」を含むmember_nameをすべて取得
    rows = conn.execute(
        "SELECT DISTINCT member_name FROM votes WHERE member_name LIKE '%君%'"
    ).fetchall()

    combined = []
    pattern = re.compile(r'^(.+?)君(.+)$')

    for row in rows:
        name = row[0]
        if name in legit_names:
            continue
        if name in LEGITIMATE_NAMES_WITH_KUN:
            continue

        m = pattern.match(name)
        if m:
            name1 = m.group(1)
            name2 = m.group(2)
            # 「君」で分割した両方の部分が短くて名前っぽい形式か
            if len(name1) >= 2 and len(name2) >= 2:
                combined.append((name, name1, name2))

    return combined

def fix_combined_names(conn, combined_names):
    """結合名を分割してvotesテーブルを更新"""
    total_updated = 0

    for orig_name, name1, name2 in combined_names:
        # この結合名を持つレコードを取得
        rows = conn.execute(
            "SELECT id, bill_name, issue_id, vote FROM votes WHERE member_name = ?",
            (orig_name,)
        ).fetchall()

        for row in rows:
            vid, bill_name, issue_id, vote = row

            # name1の投票としてレコード更新（idをそのまま使う）
            conn.execute(
                "UPDATE votes SET member_name = ? WHERE id = ?",
                (name1, vid)
            )
            total_updated += 1

            # name2の投票として新規レコード追加（重複チェック）
            existing = conn.execute(
                "SELECT id FROM votes WHERE member_name=? AND bill_name=? AND issue_id=? AND vote=?",
                (name2, bill_name, issue_id, vote)
            ).fetchone()

            if not existing:
                conn.execute(
                    "INSERT INTO votes (session_number, date, bill_name, member_name, vote, bill_type, issue_id) "
                    "SELECT session_number, date, bill_name, ?, vote, bill_type, issue_id FROM votes WHERE id=?",
                    (name2, vid)
                )
                total_updated += 1

        conn.commit()

    return total_updated

def deduplicate_votes(conn):
    """完全に重複した投票レコードを削除"""
    # 重複行を特定（同じ issue_id + bill_name + member_name + vote の組み合わせ）
    duplicates = conn.execute("""
        SELECT id FROM votes
        WHERE id NOT IN (
            SELECT MIN(id) FROM votes
            GROUP BY issue_id, bill_name, member_name, vote
        )
    """).fetchall()

    dup_ids = [r[0] for r in duplicates]
    if not dup_ids:
        return 0

    # バッチ削除
    BATCH_SIZE = 500
    deleted = 0
    for i in range(0, len(dup_ids), BATCH_SIZE):
        batch = dup_ids[i:i + BATCH_SIZE]
        placeholders = ",".join("?" for _ in batch)
        conn.execute(f"DELETE FROM votes WHERE id IN ({placeholders})", batch)
        conn.commit()
        deleted += len(batch)

    return deleted

def add_unique_constraint(conn):
    """一意制約を追加して将来の重複を防止"""
    try:
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique
            ON votes(issue_id, bill_name, member_name, vote)
        """)
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"  [WARN] インデックス作成エラー: {e}", file=sys.stderr)
        return False

def analyze_data(conn):
    """データの状態をレポート"""
    total = conn.execute("SELECT COUNT(*) FROM votes").fetchone()[0]
    unique = conn.execute(
        "SELECT COUNT(*) FROM (SELECT DISTINCT issue_id, bill_name, member_name, vote FROM votes)"
    ).fetchone()[0]
    members_in_votes = conn.execute(
        "SELECT COUNT(DISTINCT member_name) FROM votes"
    ).fetchone()[0]
    members_in_members = conn.execute(
        "SELECT COUNT(*) FROM members"
    ).fetchone()[0]
    combined = conn.execute(
        "SELECT COUNT(DISTINCT member_name) FROM votes WHERE member_name LIKE '%君%'"
    ).fetchone()[0]
    
    # bills stats
    bills_over_465 = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT bill_name, issue_id, 
                   SUM(CASE WHEN vote='賛成' THEN 1 ELSE 0 END) as yea,
                   SUM(CASE WHEN vote='反対' THEN 1 ELSE 0 END) as nay
            FROM votes
            GROUP BY bill_name, issue_id
            HAVING yea + nay > 465
        )
    """).fetchone()[0]

    return {
        "total_rows": total,
        "unique_rows": unique,
        "duplicate_rows": total - unique,
        "members_in_votes": members_in_votes,
        "members_in_members": members_in_members,
        "combined_names": combined,
        "bills_over_465": bills_over_465,
    }

def main():
    parser = argparse.ArgumentParser(description="DBデータの不整合を修正")
    parser.add_argument("--db", default=DEFAULT_DB, help="votes.dbのパス")
    parser.add_argument("--dry-run", action="store_true", help="変更せずにレポートのみ表示")
    args = parser.parse_args()

    print("=" * 60)
    print("DBデータ修正スクリプト")
    print("=" * 60)
    print(f"DB: {args.db}")

    conn = sqlite3.connect(args.db)

    # === Analysis ===
    print("\n📊 修正前の状態:")
    stats = analyze_data(conn)
    for k, v in stats.items():
        print(f"  {k}: {v}")

    if args.dry_run:
        print("\n[dry-run] 変更は行いません")
        conn.close()
        return

    # === Fix 1: Combined names ===
    print("\n🔧 [1/4] 結合名の分割...")
    legit_names = get_legitimate_names(conn)
    combined = find_combined_names(conn, legit_names)
    if combined:
        print(f"  検出された結合名: {len(combined)}種類")
        updated = fix_combined_names(conn, combined)
        print(f"  更新されたレコード: {updated}")
    else:
        print("  結合名は見つかりませんでした")

    # === Fix 2: Deduplication ===
    print("\n🔧 [2/4] 重複レコードの削除...")
    deleted = deduplicate_votes(conn)
    print(f"  削除された重複行: {deleted}")

    # === Fix 3: Add unique index ===
    print("\n🔧 [3/4] 一意制約の追加...")
    if add_unique_constraint(conn):
        print("  一意制約インデックスを作成しました")
    else:
        print("  スキップ（既に存在するかエラー）")

    # === Fix 4: Regenerate members in votes table ===
    print("\n🔧 [4/4] 不在議員の確認...")
    unmatched = conn.execute("""
        SELECT DISTINCT v.member_name
        FROM votes v
        LEFT JOIN members m ON v.member_name = m.member_name
        WHERE m.member_name IS NULL
        ORDER BY v.member_name
    """).fetchall()
    print(f"  membersに存在しない議員名: {len(unmatched)}")
    for u in unmatched[:20]:
        print(f"    {u[0]}")

    # === Final Analysis ===
    print("\n📊 修正後の状態:")
    stats = analyze_data(conn)
    for k, v in stats.items():
        print(f"  {k}: {v}")

    conn.close()
    print("\n✅ 修正完了")

if __name__ == "__main__":
    main()
