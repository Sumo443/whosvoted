"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import searchIndexData from "@/data/search-index.json";
import type { SearchItem } from "@/lib/data-loader";

const searchIndex = searchIndexData as SearchItem[];

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [show, setShow] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setShow(false);
      return;
    }
    const q = value.toLowerCase();
    const filtered = searchIndex
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.sub.toLowerCase().includes(q)
      )
      .slice(0, 10);
    setResults(filtered);
    setShow(true);
  };

  const handleSelect = (item: SearchItem) => {
    setShow(false);
    setQuery("");
    router.push(item.url);
  };

  return (
    <div ref={ref} className="relative max-w-xl mx-auto">
      <div className="flex items-center border border-gray-200 rounded-full overflow-hidden focus-within:border-[#1D9E75] focus-within:ring-1 focus-within:ring-[#1D9E75] transition-all">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="議員名・法案名で検索..."
          className="flex-1 px-5 py-2.5 text-sm outline-none bg-transparent"
        />
        <button className="bg-[#1D9E75] text-white px-4 py-2.5 hover:bg-[#188a63] transition-colors">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>

      {show && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map((item) => (
            <button
              key={item.url}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3"
            >
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  item.type === "member"
                    ? "bg-blue-50 text-blue-500"
                    : "bg-primary-50 text-[#1D9E75]"
                }`}
              >
                {item.type === "member" ? "議員" : "法案"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{item.label}</p>
                <p className="text-xs text-gray-400 truncate">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
