#!/usr/bin/env python3
"""
search_minutes.py - NDL API で「記名投票」を含む衆議院本会議の会議録を検索するスクリプト

使用法:
    python search_minutes.py                              # 全検索
    python search_minutes.py --from 2025-01-01 --until 2026-12-31  # 日付指定
    python search_minutes.py --output results.json         # 出力先指定
"""

import argparse
import json
import sys
import time
import urllib.parse
from datetime import datetime

import requests

API_BASE = "https://kokkai.ndl.go.jp/api/speech"
REQUEST_DELAY = 1.5  # 秒（API利用条件に従い控えめに）


def build_url(params: dict) -> str:
    """検索パラメータからAPI URLを生成"""
    query = urllib.parse.urlencode(params, encoding="utf-8")
    return f"{API_BASE}?{query}"


def fetch_page(params: dict) -> dict:
    """1ページ分のAPIレスポンスを取得"""
    url = build_url(params)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_unique_meetings(data: dict) -> dict:
    """
    発言単位出力のレスポンスから、ユニークな会議録情報を抽出。
    戻り値: {issueID: {date, session, issue, meetingURL}}
    """
    meetings = {}
    for record in data.get("speechRecord", []):
        issue_id = record.get("issueID")
        if not issue_id:
            continue
        if issue_id not in meetings:
            meetings[issue_id] = {
                "issueID": issue_id,
                "date": record.get("date", ""),
                "sessionNumber": record.get("session"),
                "issueNumber": record.get("issue", ""),
                "meetingURL": record.get("meetingURL", ""),
            }
    return meetings


def search_minutes(
    keyword="記名投票",
    name_of_house="衆議院",
    name_of_meeting="本会議",
    date_from=None,
    date_until=None,
    max_results=1000,
) -> list:
    """
    記名投票を含む衆議院本会議の会議録を検索し、ユニークな会議録一覧を返す。

    戻り値: [{issueID, date, sessionNumber, issueNumber, url}, ...]
    """
    all_meetings = {}
    start_record = 1

    while True:
        params = {
            "any": keyword,
            "nameOfHouse": name_of_house,
            "nameOfMeeting": name_of_meeting,
            "maximumRecords": 100,
            "recordPacking": "json",
            "startRecord": start_record,
        }
        if date_from:
            params["from"] = date_from
        if date_until:
            params["until"] = date_until

        print(f"  [API] startRecord={start_record} を取得中...", file=sys.stderr)
        try:
            data = fetch_page(params)
        except requests.RequestException as e:
            print(f"  [ERROR] API取得失敗: {e}", file=sys.stderr)
            break

        total_records = data.get("numberOfRecords", 0)
        returned = data.get("numberOfReturn", 0)
        next_pos = data.get("nextRecordPosition")

        print(
            f"  [API] ヒット件数={total_records}, 取得件数={returned}",
            file=sys.stderr,
        )

        meetings = extract_unique_meetings(data)
        all_meetings.update(meetings)

        print(
            f"  [INFO] ユニーク会議録数: {len(all_meetings)}",
            file=sys.stderr,
        )

        if not next_pos or len(all_meetings) >= max_results:
            break

        start_record = next_pos
        time.sleep(REQUEST_DELAY)

    result = sorted(
        all_meetings.values(),
        key=lambda x: x.get("date", ""),
        reverse=True,
    )

    # 最大件数で切る
    if len(result) > max_results:
        result = result[:max_results]

    return result


def main():
    parser = argparse.ArgumentParser(
        description="NDL API で記名投票を含む衆議院本会議の会議録を検索"
    )
    parser.add_argument(
        "--from", dest="date_from", type=str, default=None,
        help="検索開始日 YYYY-MM-DD",
    )
    parser.add_argument(
        "--until", dest="date_until", type=str, default=None,
        help="検索終了日 YYYY-MM-DD",
    )
    parser.add_argument(
        "-o", "--output", type=str, default=None,
        help="出力JSONファイル (省略時は標準出力)",
    )
    parser.add_argument(
        "--max", type=int, default=1000,
        help="最大取得件数 (デフォルト: 1000)",
    )
    args = parser.parse_args()

    print("記名投票会議録を検索中...", file=sys.stderr)
    results = search_minutes(
        date_from=args.date_from,
        date_until=args.date_until,
        max_results=args.max,
    )

    # URLを付与
    for r in results:
        if not r["meetingURL"] and r["issueID"]:
            r["meetingURL"] = f"https://kokkai.ndl.go.jp/txt/{r['issueID']}"
        r["url"] = r.pop("meetingURL")
        r.pop("issueNumber", None)

    output = json.dumps(results, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"結果を {args.output} に保存しました (全{len(results)}件)", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
