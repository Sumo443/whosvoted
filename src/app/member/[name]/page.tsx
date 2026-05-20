import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoteBar from "@/components/VoteBar";
import InitialAvatar from "@/components/InitialAvatar";
import ShareButton from "@/components/ShareButton";
import AdSlot from "@/components/AdSlot";
import { getMemberDetailByName, getMembers } from "@/lib/data-loader";

interface Props {
  params: { name: string };
}

export async function generateStaticParams() {
  const members = getMembers();
  return members.map((m) => ({ name: m.member_name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = params.name;
  const member = getMemberDetailByName(name);
  if (!member) return { title: "議員が見つかりません" };

  return {
    title: `${name}の投票記録 | WHO VOTED`,
    description: `${name}議員（${member.faction || member.party || ""}・${member.constituency || ""}）の記名投票記録。賛成${member.yea_votes}・反対${member.nay_votes}。`,
    openGraph: {
      title: `${name}の投票記録 | WHO VOTED`,
      description: `${name}議員の記名投票記録を確認できます。`,
      url: `https://whosvoted.com/member/${params.name}`,
    },
  };
}

export default function MemberPage({ params }: Props) {
  const name = params.name;
  const member = getMemberDetailByName(name);
  if (!member) notFound();

  const shareText = `【WHO VOTED】${name}議員の投票記録\n→ whosvoted.com/member/${params.name}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 戻る */}
      <Link
        href="/members"
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
      >
        ← 議員一覧
      </Link>

      {/* プロフィール */}
      <div className="flex items-start gap-4 mb-6">
        <InitialAvatar name={name} size={64} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {(member.faction || member.party || "不明") +
              (member.constituency ? ` ／ ${member.constituency}` : "")}
          </p>
          {member.election_count != null && (
            <p className="text-xs text-gray-400">
              当選 {member.election_count}回
            </p>
          )}
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">
            {member.total_votes}
          </p>
          <p className="text-xs text-gray-400">参加した投票</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-[#1D9E75]">
            {member.yea_votes}
          </p>
          <p className="text-xs text-gray-400">賛成</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-500">
            {member.nay_votes}
          </p>
          <p className="text-xs text-gray-400">反対</p>
        </div>
      </div>

      {/* シェア */}
      <div className="mb-6">
        <ShareButton text={shareText} url={`https://whosvoted.com/member/${params.name}`} />
      </div>

      {/* 投票履歴 */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">投票履歴</h2>
      <div className="space-y-1">
        {member.votes.map((vote, i) => (
          <div key={`${vote.issue_id}-${vote.bill_name}`}>
            <Link
              href={`/bill/${vote.issue_id}`}
              className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  {vote.bill_name}
                </p>
                <p className="text-xs text-gray-400">{vote.date}</p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                  vote.vote === "賛成"
                    ? "bg-green-100 text-[#1D9E75]"
                    : "bg-red-100 text-red-500"
                }`}
              >
                {vote.vote}
              </span>
            </Link>
            {/* 10件ごとにAdSense広告枠 */}
            {(i + 1) % 10 === 0 && (
              <div className="py-2">
                <AdSlot id={`member-ad-${Math.floor(i / 10)}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 似た投票行動の議員 */}
      {member.similar_members.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            この議員と似た投票行動
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {member.similar_members.map((sm) => (
              <Link
                key={sm.member_name}
                href={`/member/${sm.member_name}`}
                className="border border-gray-100 rounded-lg p-4 hover:border-[#1D9E75] transition-all"
              >
                <div className="flex items-center gap-3">
                  <InitialAvatar name={sm.member_name} size={32} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {sm.member_name}
                    </p>
                    <p className="text-xs text-gray-400">{sm.faction || ""}</p>
                  </div>
                </div>
                <p className="text-xs text-[#1D9E75] font-medium mt-2">
                  一致率 {sm.match_rate}%
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
