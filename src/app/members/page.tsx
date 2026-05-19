"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import InitialAvatar from "@/components/InitialAvatar";
import membersData from "@/data/members.json";
import factionsData from "@/data/factions.json";
import type { Member, Faction } from "@/lib/data-loader";

const members = membersData as Member[];
const factionsList = factionsData as Faction[];

export default function MembersPage() {
  const [selectedFaction, setSelectedFaction] = useState("全員");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (selectedFaction !== "全員" && m.faction !== selectedFaction)
        return false;
      if (
        searchQuery &&
        !m.member_name.includes(searchQuery) &&
        !(m.reading && m.reading.includes(searchQuery))
      )
        return false;
      return true;
    });
  }, [selectedFaction, searchQuery]);

  const factionNames = [
    "全員",
    ...factionsList.map((f) => f.name),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-2">議員一覧</h1>
      <p className="text-sm text-gray-500 mb-6">
        全{members.length}名
        {filtered.length < members.length &&
          `（表示中: ${filtered.length}名）`}
      </p>

      {/* 検索 */}
      <input
        type="text"
        placeholder="氏名で検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:border-[#1D9E75]"
      />

      {/* 会派フィルター */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 flex-nowrap min-w-max">
          {factionNames.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFaction(f)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                selectedFaction === f
                  ? "bg-[#1D9E75] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "全員" ? f : `${f}`}
            </button>
          ))}
        </div>
      </div>

      {/* カードグリッド */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((member) => (
          <Link
            key={member.member_name}
            href={`/member/${encodeURIComponent(member.member_name)}`}
            className="border border-gray-100 rounded-lg p-4 hover:border-[#1D9E75] hover:shadow-sm transition-all"
          >
            <InitialAvatar name={member.member_name} size={40} />
            <p className="text-sm font-medium text-gray-800 mt-2 truncate">
              {member.member_name}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {member.faction || member.party || ""}
            </p>
            <p className="text-xs text-gray-300 truncate">
              {member.constituency || ""}
            </p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-12">
          該当する議員が見つかりませんでした
        </p>
      )}
    </div>
  );
}
