"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-0.5 text-xl font-bold tracking-tight"
        >
          <span className="text-gray-900">WHO</span>
          <span className="text-[#1D9E75]">VOTED</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link
            href="/members"
            className="hover:text-[#1D9E75] transition-colors"
          >
            議員
          </Link>
          <Link
            href="/bills"
            className="hover:text-[#1D9E75] transition-colors"
          >
            法案
          </Link>
          <Link
            href="/maker"
            className="bg-[#1D9E75] text-white px-4 py-1.5 rounded-full hover:bg-[#188a63] transition-colors text-sm font-medium"
          >
            推し議員メーカー
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-gray-600"
          aria-label="メニューを開く"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-3">
          <Link
            href="/members"
            className="block text-sm text-gray-600 hover:text-[#1D9E75]"
            onClick={() => setMenuOpen(false)}
          >
            議員一覧
          </Link>
          <Link
            href="/bills"
            className="block text-sm text-gray-600 hover:text-[#1D9E75]"
            onClick={() => setMenuOpen(false)}
          >
            採決一覧
          </Link>
          <Link
            href="/maker"
            className="block text-sm text-[#1D9E75] font-medium"
            onClick={() => setMenuOpen(false)}
          >
            推し議員メーカー
          </Link>
        </div>
      )}
    </nav>
  );
}
