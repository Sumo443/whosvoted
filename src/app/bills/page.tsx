"use client";

import { useState, useMemo } from "react";
import BillCard from "@/components/BillCard";
import billsData from "@/data/bills.json";
import type { BillSummary } from "@/lib/data-loader";

const bills = billsData as BillSummary[];

export default function BillsPage() {
  const [yearFilter, setYearFilter] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const b of bills) {
      const y = b.date.slice(0, 4);
      if (y) set.add(y);
    }
    return Array.from(set).sort().reverse();
  }, []);

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      if (yearFilter !== "すべて" && b.date.slice(0, 4) !== yearFilter)
        return false;
      if (searchQuery && !b.bill_name.includes(searchQuery)) return false;
      return true;
    });
  }, [yearFilter, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-2">採決一覧</h1>
      <p className="text-sm text-gray-500 mb-6">
        全{bills.length}件の記名投票（表示中: {filtered.length}件）
      </p>

      {/* 検索 */}
      <input
        type="text"
        placeholder="法案名で検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:border-[#1D9E75]"
      />

      {/* 年フィルター */}
      <div className="flex gap-2 overflow-x-auto mb-6 pb-2">
        <button
          onClick={() => setYearFilter("すべて")}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
            yearFilter === "すべて"
              ? "bg-[#1D9E75] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          すべて
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              yearFilter === y
                ? "bg-[#1D9E75] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {y}年
          </button>
        ))}
      </div>

      {/* リスト */}
      <div className="space-y-3">
        {filtered.map((bill) => (
          <BillCard key={bill.bill_name + bill.issue_id} bill={bill} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-12">
          該当する採決が見つかりませんでした
        </p>
      )}
    </div>
  );
}
