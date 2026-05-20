import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoteBar from "@/components/VoteBar";
import InitialAvatar from "@/components/InitialAvatar";
import ShareButton from "@/components/ShareButton";
import AdSlot from "@/components/AdSlot";
import { getBillDetail, getBills } from "@/lib/data-loader";
import type { BillSummary } from "@/lib/data-loader";
import billsData from "@/data/bills.json";

const bills = billsData as BillSummary[];

interface Props {
  params: { id: string };
}

export async function generateStaticParams() {
  return bills.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bill = getBillDetail(params.id);
  if (!bill) return { title: "法案が見つかりません" };

  return {
    title: `${bill.bill_name}の採決結果 | WHO VOTED`,
    description: `${bill.bill_name}（${bill.date}）の記名投票結果。賛成${bill.yea_count}・反対${bill.nay_count}。`,
    openGraph: {
      title: `${bill.bill_name}の採決結果 | WHO VOTED`,
      description: `${bill.bill_name}の記名投票結果。`,
      url: `https://whosvoted.com/bill/${params.id}`,
    },
  };
}

export default function BillDetailPage({ params }: Props) {
  const bill = getBillDetail(params.id);
  if (!bill) notFound();

  const shareText = `【WHO VOTED】${bill.bill_name}\n賛成${bill.yea_count}・反対${bill.nay_count}\n→ https://whosvoted.com/bill/${params.id}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 戻る */}
      <Link
        href="/bills"
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
      >
        ← 採決一覧
      </Link>

      {/* 法案情報 */}
      <h1 className="text-xl font-bold text-gray-900 mb-2">{bill.bill_name}</h1>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
        <span>{bill.date}</span>
        {bill.session_number && <span>第{bill.session_number}回国会</span>}
        <span className="bg-primary-50 text-[#1D9E75] px-2 py-0.5 rounded-full font-medium">
          記名投票
        </span>
      </div>

      {/* 一次情報リンク（必須） */}
      {bill.issue_id && (
        <a
          href={`https://kokkai.ndl.go.jp/txt/${bill.issue_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline inline-block mb-4"
        >
          国会会議録で確認する →
        </a>
      )}

      {/* 賛否バー */}
      <div className="mb-6">
        <VoteBar
          yeaCount={bill.yea_count}
          nayCount={bill.nay_count}
          height={12}
          showLabels
        />
      </div>

      {/* シェア */}
      <div className="mb-6">
        <ShareButton
          text={shareText}
          url={`https://whosvoted.com/bill/${params.id}`}
        />
      </div>

      {/* AdSense */}
      <AdSlot id="bill-top" className="mb-6" />

      {/* 賛成した議員 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          賛成 {bill.yea_count}名
        </h2>
        {Object.entries(bill.yea_groups).map(([faction, members]) => (
          <div key={faction} className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              {faction}
            </h3>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Link
                  key={m.member_name}
                  href={`/member/${m.member_name}`}
                  className="text-sm px-2.5 py-1 bg-green-50 text-gray-700 rounded-md hover:bg-green-100 transition-colors"
                >
                  {m.member_name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <AdSlot id="bill-middle" className="mb-8" />

      {/* 反対した議員 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          反対 {bill.nay_count}名
        </h2>
        {Object.entries(bill.nay_groups).map(([faction, members]) => (
          <div key={faction} className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              {faction}
            </h3>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Link
                  key={m.member_name}
                  href={`/member/${m.member_name}`}
                  className="text-sm px-2.5 py-1 bg-red-50 text-gray-700 rounded-md hover:bg-red-100 transition-colors"
                >
                  {m.member_name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
