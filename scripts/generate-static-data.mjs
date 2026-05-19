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

// ======== 1. Members ========
console.log("[generate] members...");
const members = db.prepare(
  `SELECT DISTINCT member_name, reading, party, faction, constituency, election_count
   FROM members ORDER BY reading`
).all();
for (const m of members) {
  m.member_name = m.member_name.trim();
  m.id = fileSafeId(m.member_name);
}
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
  searchIndex.push({ type: "member", label: m.member_name, sub: m.party || "", url: `/member/${encodeURIComponent(m.member_name)}` });
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
const makerBills = db.prepare(
  `SELECT bill_name, date, issue_id
   FROM votes GROUP BY bill_name, issue_id
   HAVING SUM(CASE WHEN vote='賛成' THEN 1 ELSE 0 END) > 0
      AND SUM(CASE WHEN vote='反対' THEN 1 ELSE 0 END) > 0
   ORDER BY date DESC LIMIT 8`
).all();
const makerQuestions = makerBills.map((bill) => {
  const rows = db.prepare(`SELECT member_name, vote FROM votes WHERE bill_name=? AND issue_id=?`).all(bill.bill_name, bill.issue_id);
  const yeas = [], nays = [];
  for (const r of rows) { if (r.vote === "賛成") yeas.push(r.member_name); else nays.push(r.member_name); }
  return { bill_name: bill.bill_name, date: bill.date, yeas, nays };
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
    if (r.vote === "賛成") { if (!yeaGroups[f]) yeaGroups[f] = []; yeaGroups[f].push({ member_name: r.member_name, party: r.party }); }
    else { if (!nayGroups[f]) nayGroups[f] = []; nayGroups[f].push({ member_name: r.member_name, party: r.party }); }
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

// ======== 7. Members Detail (merged single file) ========
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
  const similar = scores.slice(0, 3).map(s => ({
    member_name: s.member_name,
    match_rate: s.match_rate,
    party: (members.find(m => m.member_name === s.member_name) || {}).party || null,
    faction: (members.find(m => m.member_name === s.member_name) || {}).faction || null,
  }));

  membersDetail[memberName] = {
    member_name: memberName, reading: mi.reading || null, party: mi.party || null,
    faction: mi.faction || null, constituency: mi.constituency || null,
    election_count: mi.election_count || null,
    total_votes: votes.length, yea_votes: yeaCount, nay_votes: nayCount,
    votes: votes.map(r => ({ bill_name: r.bill_name, date: r.date, vote: r.vote, issue_id: r.issue_id, session_number: r.session_number })),
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
for (const m of members) sitemapUrls.push(`${base}/member/${encodeURIComponent(m.member_name)}`);
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
