/**
 * generate-static-data.mjs
 * Next.jsビルド前に実行し、SQLite DBから全データをJSONファイルに書き出す。
 * 出力先: src/data/（直接インポート可能）
 *
 * CI/CD（DBなし）の場合は事前コミット済みJSONを使用するためスキップ。
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "votes.db");
const OUT_DIR = path.join(__dirname, "..", "src", "data");

// DBが存在しない場合はスキップ（CI/CDビルド時）
if (!fs.existsSync(DB_PATH)) {
  console.log("[generate] DB not found, skipping (pre-committed JSONs will be used)");
  process.exit(0);
}

console.log(`[generate] DB: ${DB_PATH}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

// 古いJSONをクリア
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json") || f.endsWith(".ts")) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

function fileSafeId(name) {
  return crypto.createHash("md5").update(name).digest("hex").slice(0, 12);
}

const db = new Database(DB_PATH, { readonly: true });

// ======== 0. Build member name → ID lookup ========
// (built first so everything can use it)
console.log("[generate] building member index...");
const memberRows = db.prepare(
  `SELECT DISTINCT member_name, reading, party, faction, constituency, election_count
   FROM members ORDER BY reading`
).all();
const members = memberRows.map((m) => {
  m.member_name = m.member_name.trim();
  m.id = fileSafeId(m.member_name);
  return m;
});
const memberIdByName = {};
for (const m of members) {
  memberIdByName[m.member_name] = m.id;
}

// ======== 1. Members ========
console.log("[generate] members...");
fs.writeFileSync(path.join(OUT_DIR, "members.json"), JSON.stringify(members), "utf-8");
console.log(`  → ${members.length}`);

// ======== 2. Bills Summary ========
console.log("[generate] bills...");
const bills = db.prepare(
  `SELECT bill_name, date, session_number, issue_id,
          SUM(CASE WHEN vote = '賛成' THEN 1 ELSE 0 END) as yea_count,
          SUM(CASE WHEN vote = '反対' THEN 1 ELSE 0 END) as nay_count
   FROM votes
   GROUP BY bill_name, issue_id
   ORDER BY date DESC, bill_name`
).all().map((r) => ({
  ...r,
  total: r.yea_count + r.nay_count,
  id: fileSafeId(r.bill_name + "|" + r.issue_id),
}));
fs.writeFileSync(path.join(OUT_DIR, "bills.json"), JSON.stringify(bills), "utf-8");
console.log(`  → ${bills.length}`);

// ======== 3. Search Index ========
console.log("[generate] search index...");
const searchIndex = [];
for (const m of members) {
  searchIndex.push({ type: "member", label: m.member_name, sub: m.party || "", url: `/member/${m.id}` });
}
const seenBill = new Set();
for (const b of bills) {
  if (!seenBill.has(b.bill_name)) {
    seenBill.add(b.bill_name);
    searchIndex.push({ type: "bill", label: b.bill_name, sub: b.date, url: `/bill/${b.id}` });
  }
}
fs.writeFileSync(path.join(OUT_DIR, "search-index.json"), JSON.stringify(searchIndex), "utf-8");
console.log(`  → ${searchIndex.length}`);

// ======== 4. Factions ========
console.log("[generate] factions...");
const factionRows = db.prepare(`SELECT faction FROM members WHERE faction IS NOT NULL`).all();
const fc = {};
for (const r of factionRows) {
  const k = r.faction.trim();
  fc[k] = (fc[k] || 0) + 1;
}
const factionList = Object.entries(fc).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
fs.writeFileSync(path.join(OUT_DIR, "factions.json"), JSON.stringify(factionList), "utf-8");
console.log(`  → ${factionList.length}`);

// ======== 5. Maker Questions ========
console.log("[generate] maker questions...");
// 多様なテーマ・賛否拮抗の法案を厳選（予算・解任決議案は3問以内）
const makerBillDefs = [
  ["笠浩史外六名提出財務金融委員長井林辰憲解任決議案", "2025-06-18"],
  ["令和七年度一般会計予算外二案", "2025-03-04"],
  ["臓器の移植に関する法律の一部を改正する法律案（第百六十四回国会、中山太郎外五名提出）", "2009-06-18"],
  ["郵政民営化法案外五案", "2005-07-05"],
  ["国民年金法等の一部を改正する法律を廃止する等の法律案", "2004-08-05"],
  ["国民年金法等の一部を改正する法律案中修正議決した部分を除いたその他の原案", "2004-05-11"],
  ["健康保険法等の一部を改正する法律案外一案", "2000-11-02"],
  ["公職選挙法の一部を改正する法律案", "2000-10-26"],
];
const makerBills = [];
for (const [bn, bd] of makerBillDefs) {
  const issueRows = db.prepare(
    `SELECT issue_id FROM votes WHERE bill_name=? AND date=? GROUP BY issue_id LIMIT 1`
  ).all(bn, bd);
  if (issueRows.length > 0) {
    makerBills.push({ bill_name: bn, date: bd, issue_id: issueRows[0].issue_id });
  }
}
// 法案説明を読み込み
let makerDescriptions = {};
try {
  const descPath = path.join(__dirname, "maker-descriptions.json");
  if (fs.existsSync(descPath)) {
    const descs = JSON.parse(fs.readFileSync(descPath, "utf-8"));
    for (const d of descs) { makerDescriptions[d.index] = d.description; }
  }
} catch (e) {
  console.log("  [WARN] maker-descriptions.json の読み込みに失敗:", e.message);
}
let makerQuestionsText = [];
try {
  const qPath = path.join(__dirname, "maker-questions-text.json");
  if (fs.existsSync(qPath)) {
    makerQuestionsText = JSON.parse(fs.readFileSync(qPath, "utf-8"));
  }
} catch (e) {
  console.log("  [WARN] maker-questions-text.json の読み込みに失敗:", e.message);
}
const makerQuestionTexts = {};
for (const q of makerQuestionsText) { makerQuestionTexts[q.index] = q.question; }

const makerQuestions = makerBills.map((bill, idx) => {
  const rows = db.prepare(`SELECT member_name, vote FROM votes WHERE bill_name=? AND issue_id=?`).all(bill.bill_name, bill.issue_id);
  const yeas = [], nays = [];
  for (const r of rows) { if (r.vote === "賛成") yeas.push({ member_name: r.member_name, id: memberIdByName[r.member_name] || "" }); else nays.push({ member_name: r.member_name, id: memberIdByName[r.member_name] || "" }); }
  return { bill_name: bill.bill_name, date: bill.date, description: makerDescriptions[idx] || "", question: makerQuestionTexts[idx] || "", yeas, nays };
});
fs.writeFileSync(path.join(OUT_DIR, "maker-questions.json"), JSON.stringify(makerQuestions), "utf-8");
console.log(`  → ${makerQuestions.length}`);

// ======== 6. Bills Detail (merged single file) ========
console.log("[generate] bills detail...");
const billsDetail = {};
let bcnt = 0;
for (const bill of bills) {
  const rows = db.prepare(
    `SELECT v.member_name, v.vote, m.faction, m.party FROM votes v
     LEFT JOIN members m ON v.member_name = m.member_name
     WHERE v.bill_name=? AND v.issue_id=?`
  ).all(bill.bill_name, bill.issue_id);
  const yeaGroups = {}, nayGroups = {};
  for (const r of rows) {
    const f = r.faction || "不明";
    // Include member id along with name for linking
    const entry = { member_name: r.member_name, party: r.party, id: memberIdByName[r.member_name] || "" };
    if (r.vote === "賛成") { if (!yeaGroups[f]) yeaGroups[f] = []; yeaGroups[f].push(entry); }
    else { if (!nayGroups[f]) nayGroups[f] = []; nayGroups[f].push(entry); }
  }
  billsDetail[bill.id] = {
    bill_name: bill.bill_name, date: bill.date, session_number: bill.session_number,
    issue_id: bill.issue_id, yea_count: bill.yea_count, nay_count: bill.nay_count,
    yea_groups: yeaGroups, nay_groups: nayGroups,
  };
  bcnt++;
}
fs.writeFileSync(path.join(OUT_DIR, "bills-detail.json"), JSON.stringify(billsDetail), "utf-8");
console.log(`  → ${bcnt}`);

// ======== 7. Members Detail (merged single file, keyed by id) ========
console.log("[generate] members detail...");

// 全投票データからvoteMap構築
const allVotes = db.prepare(`SELECT member_name, bill_name, issue_id, vote FROM votes`).all();
const voteMap = {};
for (const v of allVotes) {
  const key = v.bill_name + "||" + v.issue_id;
  if (!voteMap[v.member_name]) voteMap[v.member_name] = {};
  voteMap[v.member_name][key] = v.vote;
}
// 現職議員のみ詳細生成（members テーブルに存在する議員に限定）
const memberNames = members.map(m => m.member_name);

const membersDetail = {};
let mcnt = 0;
for (const memberName of memberNames) {
  const mi = members.find(m => m.member_name === memberName);
  if (!mi) continue;
  const mid = mi.id;
  const votes = db.prepare(
    `SELECT bill_name, date, vote, issue_id, session_number FROM votes WHERE member_name=? ORDER BY date DESC`
  ).all(memberName);
  const yeaCount = votes.filter(r => r.vote === "賛成").length;
  const nayCount = votes.filter(r => r.vote === "反対").length;

  // 類似議員
  const myVotes = voteMap[memberName] || {};
  const scores = [];
  for (const otherName of memberNames) {
    if (otherName === memberName) continue;
    const ov = voteMap[otherName];
    if (!ov) continue;
    let common = 0, match = 0;
    for (const k in myVotes) {
      if (ov[k]) { common++; if (myVotes[k] === ov[k]) match++; }
    }
    if (common >= 5) scores.push({ member_name: otherName, match_rate: Math.round((match / common) * 100), common_votes: common });
  }
  scores.sort((a, b) => b.match_rate - a.match_rate || b.common_votes - a.common_votes);
  const similar = scores.slice(0, 10).map(s => ({
    member_name: s.member_name,
    id: memberIdByName[s.member_name] || "",
    match_rate: s.match_rate,
    party: (members.find(m => m.member_name === s.member_name) || {}).party || null,
    faction: (members.find(m => m.member_name === s.member_name) || {}).faction || null,
  }));

  membersDetail[mid] = {
    member_name: memberName, id: mid, reading: mi.reading || null, party: mi.party || null,
    faction: mi.faction || null, constituency: mi.constituency || null,
    election_count: mi.election_count || null,
    total_votes: votes.length, yea_votes: yeaCount, nay_votes: nayCount,
    votes: votes.map(r => ({ bill_name: r.bill_name, date: r.date, vote: r.vote, issue_id: r.issue_id, session_number: r.session_number, bill_id: fileSafeId(r.bill_name + '|' + r.issue_id) })),
    similar_members: similar,
  };
  mcnt++;
}
fs.writeFileSync(path.join(OUT_DIR, "members-detail.json"), JSON.stringify(membersDetail), "utf-8");
console.log(`  → ${mcnt}`);

// ======== 8. robots.txt & sitemap.xml ========
console.log("[generate] robots.txt, sitemap.xml...");
const publicDir = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(publicDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://whosvoted.com/sitemap.xml\n`, "utf-8");

const base = "https://whosvoted.com";
const sitemapUrls = [`${base}/`, `${base}/members`, `${base}/bills`, `${base}/maker`, `${base}/disclaimer`];
for (const m of members) sitemapUrls.push(`${base}/member/${m.id}`);
for (const b of bills) sitemapUrls.push(`${base}/bill/${b.id}`);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>`;
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf-8");
console.log(`  → ${sitemapUrls.length} URLs`);

// ======== 9. バレルファイル ========
fs.writeFileSync(path.join(OUT_DIR, "index.ts"), 'export type { BillSummary, Member, SearchItem, Faction, MakerQuestion } from "@/lib/data-loader";\n', "utf-8");

db.close();
console.log("[generate] ✅ 全データ生成完了");
console.log(`  members.json (${members.length}), bills.json (${bills.length}), search-index.json (${searchIndex.length})`);
console.log(`  bills-detail.json (${bcnt}), members-detail.json (${mcnt}), robots.txt, sitemap.xml`);
