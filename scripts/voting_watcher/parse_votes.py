#!/usr/bin/env python3
"""
parse_votes.py - 会議録テキストから記名投票の賛否データをパースするスクリプト

記名投票の結果ブロック（会議録テキスト内）:
    {法案名}を可とする議員の氏名  （または を委員長報告のとおり決するを可と...）
    {賛成者リスト（4人ずつ横並び、複数行）}
    否とする議員の氏名
    {反対者リスト（4人ずつ横並び、複数行）}

使用法:
    python parse_votes.py --issue 122105254X00620260313
    python parse_votes.py --input search_results.json
    python parse_votes.py --issue 122105254X00620260313 --output votes.json
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime

import requests

API_BASE = "https://kokkai.ndl.go.jp/api/speech"
REQUEST_DELAY = 1.0


def build_url(params: dict) -> str:
    query = urllib.parse.urlencode(params, encoding="utf-8")
    return f"{API_BASE}?{query}"


def fetch_all_speeches(issue_id: str) -> str:
    """
    指定された会議録IDの全発言テキストを取得し、1つの文字列に連結する。
    複数ページにまたがる場合はページネーション対応。
    """
    full_text_parts = []
    start_record = 1

    while True:
        params = {
            "issueID": issue_id,
            "maximumRecords": 100,
            "recordPacking": "json",
            "startRecord": start_record,
        }
        url = build_url(params)
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        for record in data.get("speechRecord", []):
            speech_text = record.get("speech", "")
            if speech_text:
                full_text_parts.append(speech_text)

        next_pos = data.get("nextRecordPosition")
        if not next_pos:
            break
        start_record = next_pos
        time.sleep(REQUEST_DELAY)

    return "\n".join(full_text_parts)


def parse_names_from_line(line: str) -> list[str]:
    """
    1行から議員名を抽出する。
    各行は「名前1君　　　名前2君　　　名前3君　　　名前4君」の形式。

    改善点:
    - 「君」で終わらない名前も、名前らしい文字列（4〜6字程度の漢字のみ）を抽出する
    - 「君」の直後に別の名前が続く結合ケース（名前1君名前2君）に対応
    - 会話文やスピーチテキストは除外
    """
    names = []
    line = line.strip()
    if not line:
        return names

    # 会話文・スピーチは除外（「私は」「です」「ます」「、」などが含まれる行）
    speech_markers = ['私は', '私は、', 'ござい', 'ました', 'ます', 'です', '。', '、',
                      '思う', '考える', '申す', '言う', '話す', '質問', '回答']
    marker_count = sum(1 for m in speech_markers if m in line)
    if marker_count >= 3:
        return names

    # 長すぎる行（会話文）は除外
    if len(line) > 80:
        return names

    # 「君」を含む部分を抽出
    # 改善: 「君」が複数含まれる場合も正しく分割
    # 「名前1君名前2君名前3君」→ 「名前1」「名前2」「名前3」
    # 「名前1君　　名前2君」→ 「名前1」「名前2」
    pattern = re.compile(r'([^\s　]+君)')
    matches = list(pattern.finditer(line))
    if matches:
        for match in matches:
            name_with_kun = match.group(1)
            name = name_with_kun.rstrip("君").strip()
            name = re.sub(r'[\s　]+', '', name)
            if name and len(name) >= 2:
                names.append(name)
        # 「君」でパースできた場合、その結果を返す
        # ただし、同じ行に「君」が1つだけで残りの文字列が名前っぽい場合は追加
        if len(matches) == 1:
            # 末尾に「君」の後ろに残ったテキストがないか確認
            last_end = matches[0].end()
            remaining = line[last_end:].strip()
            if remaining and not any(m in remaining for m in speech_markers):
                # 残りが名前っぽいか判定（漢字2〜6字、英字など）
                cleaned = re.sub(r'[\s　]+', '', remaining)
                if re.match(r'^[\u4e00-\u9fffA-Za-zー・]{2,6}$', cleaned):
                    names.append(cleaned)
        return names

    # 「君」がない場合: 全角スペースまたはタブで分割（3スペース以上）
    # 名前らしい部分を抽出（漢字2〜6字）
    parts = re.split(r'[\s　]{3,}|\t+', line)
    for part in parts:
        cleaned = re.sub(r'[\s　]+', '', part)
        if re.match(r'^[\u4e00-\u9fffA-Za-zー・]{2,6}$', cleaned):
            names.append(cleaned)

    return names


# 補完: パターンで拾いきれなかった場合のフォールバックとして、
# 名前が3つ以上の全角スペースで区切られている場合に分割する方法
_ALTERNATIVE_PATTERN = re.compile(r'[^\s　]+[\s　]+[^\s　]+君')


def parse_voting_block(text: str) -> list[dict]:
    """
    会議録全文テキストから記名投票ブロックをすべて抽出し、パースする。

    戻り値: [{
        "bill_name": str,
        "bill_type": str,  # "法案" or "決議案"
        "yeas": [str, ...],
        "nays": [str, ...],
    }, ...]
    """
    results = []
    lines = text.split("\n")

    in_yea_block = False
    in_nay_block = False
    current_bill_name = ""
    current_yeas: list[str] = []
    current_nays: list[str] = []

    # 法案名パターン（「を可とする議員の氏名」を含む行、または予算パターン）
    bill_start_pattern = re.compile(r'(.+?)を(委員長報告のとおり決するを)?可とする議員の氏名')
    nay_pattern = re.compile(r'否とする議員の氏名')
    # ブロック区切りマーカー（次の法案、議題区切り、会議終了など）
    block_end_patterns = [
        re.compile(r'―――+'),
        re.compile(r'◇+'),
        re.compile(r'.+?を(委員長報告のとおり決するを)?可とする議員の氏名'),
    ]

    def is_block_end(line: str) -> bool:
        for pat in block_end_patterns:
            if pat.search(line):
                return True
        # 新しい法案が始まったらブロック終了
        if in_nay_block and bill_start_pattern.search(line):
            return True
        return False

    def save_current_block() -> None:
        """現在のブロックを結果に保存"""
        if current_bill_name and (current_yeas or current_nays):
            # 法案名から「君」を除去
            clean_bill = re.sub(r'君', '', current_bill_name)
            # 決議案か法案かを判定
            if "決議案" in clean_bill:
                bill_type = "決議案"
            else:
                bill_type = "法案"
            results.append({
                "bill_name": clean_bill.strip(),
                "bill_type": bill_type,
                "yeas": current_yeas[:],
                "nays": current_nays[:],
            })

    def reset_state() -> None:
        nonlocal in_yea_block, in_nay_block, current_bill_name
        nonlocal current_yeas, current_nays
        in_yea_block = False
        in_nay_block = False
        current_bill_name = ""
        current_yeas = []
        current_nays = []

    for line in lines:
        stripped = line.strip()

        # 空行はスキップ
        if not stripped:
            continue

        # ブロック終了チェック
        if (in_yea_block or in_nay_block) and is_block_end(stripped):
            # ブロック終了時の区切り行で新しい法案が始まる場合をチェック
            if in_nay_block:
                save_current_block()
                reset_state()
            elif in_yea_block:
                # 賛成者ブロック中に「否とする議員の氏名」が出ていないのに
                # ブロック終了 → 破棄
                reset_state()
            continue

        # 新しい法案ブロックの開始
        bill_match = bill_start_pattern.search(stripped)
        if bill_match:
            # 既にアクティブなブロックがあったら保存してリセット
            if in_nay_block:
                save_current_block()
                reset_state()
            elif in_yea_block:
                reset_state()

            current_bill_name = bill_match.group(1)
            in_yea_block = True
            in_nay_block = False
            current_yeas = []
            current_nays = []
            continue

        # 「否とする議員の氏名」の行
        if in_yea_block and nay_pattern.search(stripped):
            in_yea_block = False
            in_nay_block = True
            # 同じ行に名前が続く可能性は極めて低いが念のため
            remaining = nay_pattern.sub("", stripped).strip()
            if remaining:
                names = parse_names_from_line(remaining)
                current_nays.extend(names)
            continue

        # 名前ブロックの行をパース
        if in_yea_block:
            names = parse_names_from_line(stripped)
            current_yeas.extend(names)
        elif in_nay_block:
            names = parse_names_from_line(stripped)
            current_nays.extend(names)

    # 最終ブロックの保存
    if current_bill_name and (current_yeas or current_nays):
        save_current_block()

    return results


def parse_issue(issue_id: str) -> dict:
    """1つの会議録をパースして結果を返す"""
    print(f"  [FETCH] 会議録 {issue_id} を取得中...", file=sys.stderr)
    text = fetch_all_speeches(issue_id)

    # 会議情報を最初のspeechRecordから取得
    params = {
        "issueID": issue_id,
        "maximumRecords": 1,
        "recordPacking": "json",
    }
    resp = requests.get(build_url(params), timeout=30)
    resp.raise_for_status()
    first_record = resp.json().get("speechRecord", [{}])[0]

    session_number = first_record.get("session")
    date = first_record.get("date", "")
    meeting_url = first_record.get("meetingURL", "")
    if not meeting_url:
        meeting_url = f"https://kokkai.ndl.go.jp/txt/{issue_id}"

    print(f"  [PARSE] 投票データをパース中...", file=sys.stderr)
    voting_blocks = parse_voting_block(text)

    # 会議情報を付与
    for block in voting_blocks:
        block["issueID"] = issue_id
        block["sessionNumber"] = session_number
        block["date"] = date
        block["meetingURL"] = meeting_url

    return {
        "issueID": issue_id,
        "sessionNumber": session_number,
        "date": date,
        "meetingURL": meeting_url,
        "votes": voting_blocks,
    }


def parse_from_search_results(search_file: str) -> list[dict]:
    """search_minutes.pyの出力JSONからまとめてパース"""
    with open(search_file, "r", encoding="utf-8") as f:
        meetings = json.load(f)

    all_results = []
    for i, meeting in enumerate(meetings):
        issue_id = meeting.get("issueID")
        if not issue_id:
            continue
        print(
            f"[{i+1}/{len(meetings)}] {meeting.get('date','')} {issue_id}",
            file=sys.stderr,
        )
        try:
            result = parse_issue(issue_id)
            all_results.append(result)
        except Exception as e:
            print(
                f"  [ERROR] {issue_id} のパースに失敗: {e}",
                file=sys.stderr,
            )
        time.sleep(REQUEST_DELAY)

    return all_results


def main():
    parser = argparse.ArgumentParser(
        description="会議録テキストから記名投票の賛否データをパース"
    )
    parser.add_argument(
        "--issue", type=str, default=None,
        help="単一の会議録IDを指定してパース",
    )
    parser.add_argument(
        "--input", type=str, default=None,
        help="search_minutes.pyの出力JSONファイル",
    )
    parser.add_argument(
        "-o", "--output", type=str, default=None,
        help="出力JSONファイル (省略時は標準出力)",
    )
    args = parser.parse_args()

    if not args.issue and not args.input:
        print("ERROR: --issue か --input のいずれかを指定してください", file=sys.stderr)
        sys.exit(1)

    if args.issue:
        print(f"会議録 {args.issue} をパース中...", file=sys.stderr)
        result = parse_issue(args.issue)
        all_results = [result]
    else:
        all_results = parse_from_search_results(args.input)

    output = json.dumps(all_results, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"結果を {args.output} に保存しました", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
