import type { Metadata } from "next";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import BillCard from "@/components/BillCard";
import MemberCard from "@/components/MemberCard";
import AdSlot from "@/components/AdSlot";
import { getBills, getMembers } from "@/lib/data-loader";
import type { BillSummary, Member } from "@/lib/data-loader";

export const metadata: Metadata = {
  title: "WHO VOTED - 国会議員の投票記録データベース",
  description:
    "だれが、賛成した？だれが、反対した？記名投票の全記録から議員個人の行動を調べよう。",
  openGraph: {
    title: "WHO VOTED - 国会議員の投票記録データベース",
    description:
      "だれが、賛成した？だれが、反対した？記名投票の全記録から議員個人の行動を調べよう。",
    url: "https://whosvoted.com/",
  },
};

export default function HomePage() {
  const allBills: BillSummary[] = getBills();
  const bills = allBills.slice(0, 5);
  const allMembers: Member[] = getMembers();
  // 注目の議員（指名リスト）
  const featuredNames = [
    "小泉進次郎", "河野太郎", "高市早苗", "石破茂",
    "泉健太", "鈴木貴子", "鈴木憲和", "馬場伸幸",
    "小川淳也", "田中健", "玉木雄一郎", "茂木敏充",
  ];
  const featured = featuredNames
    .map((name) => allMembers.find((m) => m.member_name === name))
    .filter((m): m is Member => m !== undefined);

  const mkTag = (name: string) => ({ label: name, href: `/member/${allMembers.find(m => m.member_name === name)?.id || ""}` });
  const quickTags = [
    mkTag("高市早苗"),
    mkTag("野田佳彦"),
    { label: "令和8年度予算", href: `/bill/${allBills.find(b => b.bill_name.includes("予算"))?.id || ""}` },
    mkTag("河村たかし"),
  ];

  return (
    <div>
      {/* KV */}
      <section className="bg-gradient-to-b from-white to-primary-50 py-16 px-4 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
          国会議員の投票記録データベース
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
          だれが、
          <span className="text-[#1D9E75]">賛成</span>
          した？ だれが、
          <span className="text-[#1D9E75]">反対</span>
          した？
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          記名投票の全記録から、議員個人の行動を調べよう。
        </p>
        <SearchBar />
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {quickTags.map((tag) => (
            <Link
              key={tag.label}
              href={tag.href}
              className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-500 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
            >
              {tag.label}
            </Link>
          ))}
        </div>
      </section>

      {/* 最近の注目採決 */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-800">最近の注目採決</h2>
          <Link
            href="/bills"
            className="text-sm text-[#1D9E75] font-medium hover:underline"
          >
            すべて見る →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bills.slice(0, 3).map((bill) => (
            <BillCard key={bill.bill_name + bill.issue_id} bill={bill} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          {bills.slice(3, 5).map((bill) => (
            <BillCard key={bill.bill_name + bill.issue_id} bill={bill} />
          ))}
        </div>
      </section>

      {/* AdSense広告枠 */}
      <div className="max-w-5xl mx-auto px-4">
        <AdSlot id="top-banner" />
      </div>

      {/* 推し議員メーカーバナー */}
      <section className="mx-4 my-8 max-w-3xl mx-auto">
        <Link href="/maker">
          <div className="bg-primary-50 rounded-2xl p-6 md:p-8 text-center hover:bg-primary-100 transition-colors">
            <span className="text-2xl">✨</span>
            <h2 className="text-lg font-bold text-gray-800 mt-2">
              推し議員メーカー
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              いくつかの採決に答えるだけ。あなたに近い議員が見つかる。
            </p>
            <span className="inline-block mt-3 bg-[#1D9E75] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#188a63] transition-colors">
              診断してみる →
            </span>
          </div>
        </Link>
      </section>

      {/* 注目の議員 */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">注目の議員</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {featured.map((member) => (
            <MemberCard key={member.member_name} member={member} />
          ))}
        </div>
      </section>
    </div>
  );
}
