#!/usr/bin/env python3
"""
scrape_members.py - 衆議院公式サイトから会派別議員一覧をスクレイピングし、
マスタデータ（氏名・よみがな・会派・選挙区・当選回数）をCSV/SQLiteに保存する。

使用法:
    python3 scrape_members.py                              # 全取得 + CSV + DB保存
    python3 scrape_members.py --csv-only                   # CSVのみ出力
    python3 scrape_members.py --db ../votes.db             # DBを指定して保存
    python3 scrape_members.py --dry-run                    # 保存せず件数だけ確認
"""

import argparse
import csv
import os
import re
import sqlite3
import sys
from datetime import datetime

import requests

BASE_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/shiryo/kaiha_m.htm"
FACTION_PAGE_BASE = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(SCRIPT_DIR, "votes.db")
DEFAULT_CSV = os.path.join(SCRIPT_DIR, "members.csv")

# 会派名 → 政党名 の推定マッピング
PARTY_MAP = {
    "自由民主党・無所属の会": "自由民主党",
    "中道改革連合・無所属": "中道改革連合",
    "日本維新の会": "日本維新の会",
    "国民民主党・無所属クラブ": "国民民主党",
    "参政党": "参政党",
    "チームみらい": "チームみらい",
    "日本共産党": "日本共産党",
    "無所属": "無所属",
}


def fetch_faction_list() -> list[tuple[str, str]]:
    """
    会派一覧ページから会派名とURLコードのリストを取得。
    戻り値: [(url_code, faction_name), ...]
    例: [("011kaiha.htm", "自由民主党・無所属の会"), ...]
    """
    resp = requests.get(BASE_URL, timeout=30)
    resp.encoding = "shift_jis"
    html = resp.text

    pattern = re.compile(
        r'<a href\s*=\s*\.\./syu/(\d+kaiha\.htm)[^>]*>([^<]+)</a>'
    )
    factions = []
    for m in pattern.finditer(html):
        url_code = m.group(1)
        faction_name = m.group(2).strip()
        # "<br>" が含まれてたら除去
        faction_name = re.sub(r'<[^>]+>', '', faction_name).strip()
        if faction_name and not faction_name.startswith("<"):
            factions.append((url_code, faction_name))
    return factions


def parse_election_count(raw: str) -> int:
    """
    当選回数の文字列から数値を抽出。
    "14" → 14, "1（参2）" → 1, "" → 0
    """
    raw = raw.strip()
    if not raw:
        return 0
    m = re.match(r'(\d+)', raw)
    return int(m.group(1)) if m else 0


def normalize_name(raw: str) -> str:
    """氏名を正規化: '逢沢　　一郎君' → '逢沢一郎'"""
    name = raw.strip()
    name = re.sub(r'君$', '', name)
    name = re.sub(r'[\s\u3000]+', '', name)
    return name


def normalize_reading(raw: str) -> str:
    """よみがなを正規化: 'あいさわ　いちろう' → 'あいさわ いちろう'"""
    reading = raw.strip()
    # 全角スペースを半角スペースに統一
    reading = re.sub(r'[\u3000]+', ' ', reading)
    return reading


def scrape_faction(
    url_code: str,
    faction_name: str,
) -> list[dict]:
    """
    1つの会派ページをスクレイピングし、議員リストを返す。
    """
    url = f"{FACTION_PAGE_BASE}{url_code}"
    resp = requests.get(url, timeout=30)
    resp.encoding = "shift_jis"
    html = resp.text

    members = []
    # HTMLテーブルの各行をパース
    # <TR VALIGN = top> で各行を区切る（ヘッダー行をスキップ）
    rows = re.findall(
        r'<TR\s+VALIGN\s*=\s*top>(.*?)</TR>',
        html,
        re.IGNORECASE | re.DOTALL,
    )

    for row in rows:
        cells = re.findall(
            r'<TD[^>]*>\s*<TT[^>]*>(.*?)</TT>\s*</TD>',
            row,
            re.IGNORECASE | re.DOTALL,
        )
        if len(cells) < 4:
            continue

        raw_name = cells[0].strip()
        raw_reading = cells[1].strip()
        raw_constituency = cells[2].strip()
        raw_election = cells[3].strip()

        # ヘッダー行をスキップ
        if "氏名" in raw_name or "ふりがな" in raw_name:
            continue

        member_name = normalize_name(raw_name)
        if not member_name:
            continue

        reading = normalize_reading(raw_reading)
        # 選挙区の全角スペース除去
        constituency = re.sub(r'[\s\u3000]+', '', raw_constituency)
        election_count = parse_election_count(raw_election)
        party = PARTY_MAP.get(faction_name, "")

        members.append({
            "member_name": member_name,
            "reading": reading,
            "party": party,
            "faction": faction_name,
            "constituency": constituency,
            "election_count": election_count,
        })

    return members


def scrape_all_members(dry_run: bool = False) -> list[dict]:
    """全会派の議員データを収集"""
    print("会派一覧を取得中...", file=sys.stderr)
    factions = fetch_faction_list()

    if not factions:
        print(
            "[ERROR] 会派一覧ページの解析に失敗しました。ページ構造が変わった可能性があります。",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"  検出された会派 ({len(factions)}):", file=sys.stderr)
    for code, name in factions:
        print(f"    {code}: {name}", file=sys.stderr)

    all_members = []
    seen_names = set()

    for code, name in factions:
        print(f"\n{name} ({code}) を取得中...", file=sys.stderr)
        try:
            members = scrape_faction(code, name)
            # 重複チェック（無所属は他会派と重複する場合あり）
            new_count = 0
            for m in members:
                if m["member_name"] not in seen_names:
                    all_members.append(m)
                    seen_names.add(m["member_name"])
                    new_count += 1
            print(
                f"  取得: {len(members)}名 (新規: {new_count}名)",
                file=sys.stderr,
            )
        except Exception as e:
            print(f"  [ERROR] {name} の取得に失敗: {e}", file=sys.stderr)

    # 議員名（ふりがな）でソート
    all_members.sort(key=lambda x: (x.get("reading", "") or ""))

    return all_members


def save_csv(members: list[dict], csv_path: str) -> int:
    """CSV出力（utf-8-sig / BOM付き）"""
    fieldnames = [
        "member_name", "reading", "party", "faction",
        "constituency", "election_count", "updated_at",
    ]
    today = datetime.now().strftime("%Y-%m-%d")

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in members:
            m["updated_at"] = today
            writer.writerow(m)

    return len(members)


def save_to_db(members: list[dict], db_path: str) -> int:
    """SQLiteにmembersテーブルを作成しデータを保存"""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_name TEXT UNIQUE NOT NULL,
            reading TEXT,
            party TEXT,
            faction TEXT,
            constituency TEXT,
            election_count INTEGER,
            updated_at DATE
        )
    """)
    conn.commit()

    today = datetime.now().strftime("%Y-%m-%d")
    count = 0
    for m in members:
        try:
            conn.execute(
                """INSERT OR REPLACE INTO members
                (member_name, reading, party, faction, constituency, election_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    m["member_name"],
                    m["reading"],
                    m["party"],
                    m["faction"],
                    m["constituency"],
                    m["election_count"],
                    today,
                ),
            )
            count += 1
        except sqlite3.Error as e:
            print(
                f"  [WARN] DB保存失敗: {m['member_name']}: {e}",
                file=sys.stderr,
            )

    conn.commit()
    conn.close()
    return count


def join_test(db_path: str) -> list[dict]:
    """
    votes と members の結合テスト。
    votesに存在してmembersに不在の議員をリストアップ。
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.execute("""
        SELECT v.bill_name, v.member_name, v.vote
        FROM votes v
        LEFT JOIN members m ON v.member_name = m.member_name
        WHERE m.member_name IS NULL
        GROUP BY v.member_name
        ORDER BY v.member_name
    """)
    unmatched = [dict(row) for row in cursor.fetchall()]

    # 全体のマッチ率を計算
    total = conn.execute("SELECT COUNT(DISTINCT member_name) FROM votes").fetchone()[0]
    matched = conn.execute("""
        SELECT COUNT(DISTINCT v.member_name)
        FROM votes v
        INNER JOIN members m ON v.member_name = m.member_name
    """).fetchone()[0]
    conn.close()

    return unmatched, total, matched


def main():
    parser = argparse.ArgumentParser(
        description="衆議院議員マスタデータをスクレイピング"
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
        "--csv-only", action="store_true",
        help="CSVのみ出力（DB保存しない）",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="スクレイピングのみ行い保存しない",
    )
    parser.add_argument(
        "--no-join-test", action="store_true",
        help="結合テストをスキップ",
    )
    args = parser.parse_args()

    # --- スクレイピング ---
    print("=" * 50, file=sys.stderr)
    print("衆議院議員マスタ スクレイピング開始", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    members = scrape_all_members(dry_run=args.dry_run)

    print(f"\n合計: {len(members)}名の議員データを取得", file=sys.stderr)

    if args.dry_run:
        # 会派別の内訳
        faction_counts = {}
        for m in members:
            f = m["faction"]
            faction_counts[f] = faction_counts.get(f, 0) + 1
        print("\n会派別内訳:", file=sys.stderr)
        for f, c in sorted(faction_counts.items(), key=lambda x: -x[1]):
            print(f"  {f}: {c}名", file=sys.stderr)
        return

    # --- CSV保存 ---
    csv_count = save_csv(members, args.csv)
    print(f"\nCSV保存: {args.csv} ({csv_count}名)", file=sys.stderr)

    # --- DB保存 ---
    db_count = 0
    if not args.csv_only:
        db_count = save_to_db(members, args.db)
        print(f"DB保存: {args.db} ({db_count}名)", file=sys.stderr)

    # --- 結合テスト ---
    if not args.csv_only and not args.no_join_test:
        print("\n" + "=" * 50, file=sys.stderr)
        print("votes × members 結合テスト", file=sys.stderr)

        unmatched, total, matched = join_test(args.db)
        match_rate = (matched / total * 100) if total > 0 else 0
        print(
            f"\nvotes ユニーク議員数: {total}名",
            file=sys.stderr,
        )
        print(
            f"members とマッチ: {matched}名 ({match_rate:.1f}%)",
            file=sys.stderr,
        )
        print(
            f"マッチしなかった: {len(unmatched)}名",
            file=sys.stderr,
        )

        if unmatched:
            print(
                "\n--- マッチしなかった議員一覧 ---",
                file=sys.stderr,
            )
            for u in unmatched:
                print(f"  {u['member_name']} ({u['vote']}: {u['bill_name'][:30]}...)", file=sys.stderr)

            # 差分の詳細をファイルに出力
            diff_path = os.path.join(
                os.path.dirname(args.csv) or ".", "join_diff.txt"
            )
            with open(diff_path, "w", encoding="utf-8") as f:
                f.write(f"votes × members 結合テスト 差分レポート\n")
                f.write(f"生成日: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
                f.write(f"votes ユニーク議員数: {total}\n")
                f.write(f"マッチ: {matched} ({match_rate:.1f}%)\n")
                f.write(f"未マッチ: {len(unmatched)}\n")
                f.write("-" * 50 + "\n\n")
                for u in unmatched:
                    f.write(f"{u['member_name']}\t{u['vote']}\t{u['bill_name']}\n")
            print(f"\n差分リストを {diff_path} に保存しました", file=sys.stderr)


if __name__ == "__main__":
    main()
