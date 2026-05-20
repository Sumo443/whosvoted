import { readFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "src", "data");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
}

// ======== Types ========
export type BillSummary = {
  bill_name: string; date: string; session_number: number; issue_id: string;
  yea_count: number; nay_count: number; total: number; id: string;
};
export type Member = {
  member_name: string; reading: string | null; party: string | null;
  faction: string | null; constituency: string | null; election_count: number | null; id?: string;
};
export type SearchItem = { type: "member" | "bill"; label: string; sub: string; url: string };
export type Faction = { name: string; count: number };
export type MakerQuestionMember = { member_name: string; id: string };
export type MakerQuestion = { bill_name: string; date: string; yeas: MakerQuestionMember[]; nays: MakerQuestionMember[] };

export interface BillMemberEntry {
  member_name: string;
  party: string | null;
  id?: string;
}

export type BillDetail = {
  bill_name: string; date: string; session_number: number; issue_id: string;
  yea_count: number; nay_count: number;
  yea_groups: Record<string, BillMemberEntry[]>;
  nay_groups: Record<string, BillMemberEntry[]>;
};

export type SimilarMember = {
  member_name: string;
  id?: string;
  match_rate: number;
  party: string | null;
  faction: string | null;
};

export type MemberDetail = {
  member_name: string; id?: string; reading: string | null; party: string | null;
  faction: string | null; constituency: string | null; election_count: number | null;
  total_votes: number; yea_votes: number; nay_votes: number;
  votes: { bill_name: string; date: string; vote: "賛成" | "反対"; issue_id: string; session_number: number }[];
  similar_members: SimilarMember[];
};

// ======== Loaders ========
export function getBills(): BillSummary[] { return readJson("bills.json"); }
export function getMembers(): Member[] { return readJson("members.json"); }
export function getSearchIndex(): SearchItem[] { return readJson("search-index.json"); }
export function getFactions(): Faction[] { return readJson("factions.json"); }
export function getMakerQuestions(): MakerQuestion[] { return readJson("maker-questions.json"); }

export function getBillDetail(id: string): BillDetail | null {
  const all = readJson<Record<string, BillDetail>>("bills-detail.json");
  return all[id] || null;
}

export function getMemberDetailById(id: string): MemberDetail | null {
  const all = readJson<Record<string, MemberDetail>>("members-detail.json");
  return all[id] || null;
}

/** @deprecated Use getMemberDetailById instead */
export function getMemberDetailByName(name: string): MemberDetail | null {
  const members = getMembers();
  const m = members.find(m => m.member_name === name);
  if (!m || !m.id) return null;
  return getMemberDetailById(m.id);
}

export function getMemberIdByName(name: string): string | null {
  const members = getMembers();
  const m = members.find(m => m.member_name === name);
  return m?.id || null;
}
