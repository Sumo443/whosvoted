import Link from "next/link";
import VoteBar from "./VoteBar";
import type { BillSummary } from "@/lib/data-loader";

interface Props {
  bill: BillSummary;
}

export default function BillCard({ bill }: Props) {
  return (
    <Link
      href={`/bill/${bill.id}`}
      className="block border border-gray-100 rounded-xl p-4 hover:border-[#1D9E75] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-gray-800 leading-relaxed line-clamp-2 flex-1">
          {bill.bill_name}
        </p>
        <span className="text-[10px] text-[#1D9E75] bg-primary-50 px-1.5 py-0.5 rounded-full whitespace-nowrap ml-2 shrink-0">
          記名投票
        </span>
      </div>
      <VoteBar yeaCount={bill.yea_count} nayCount={bill.nay_count} />
      <div className="flex justify-between items-center mt-2">
        <p className="text-xs text-gray-400">
          {bill.date}
          {bill.session_number ? ` 第${bill.session_number}回国会` : ""}
        </p>
        <p className="text-xs text-gray-500">
          <span className="text-[#1D9E75] font-medium">{bill.yea_count}</span>
          {" ／ "}
          <span className="text-red-400 font-medium">{bill.nay_count}</span>
        </p>
      </div>
    </Link>
  );
}
