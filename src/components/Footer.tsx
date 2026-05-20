import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-0.5 text-sm font-bold">
            <span className="text-gray-900">WHO</span>
            <span className="text-[#1D9E75]">VOTED</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
            <Link href="/disclaimer" className="hover:text-gray-600">
              このサイトについて
            </Link>
            <Link href="/disclaimer" className="hover:text-gray-600">
              免責事項
            </Link>
            <Link href="/disclaimer" className="hover:text-gray-600">
              データの出典
            </Link>
          </div>
        </div>
        <p className="text-xs text-gray-300 mt-4">
          データソース：
          <a
            href="https://kokkai.ndl.go.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-500"
          >
            国会会議録検索システム（国立国会図書館）
          </a>
        </p>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 leading-relaxed">
            このサイトは衆議院の記名投票のみを対象としています。
            全ての採決・参議院の投票は含まれません。
          </p>
          <p className="text-xs text-gray-400 mt-2">
            データ更新日：2026年3月13日
          </p>
        </div>
        <p className="text-xs text-gray-300 mt-4">
          © {new Date().getFullYear()} WHO VOTED. This site is not affiliated
          with the Japanese government.
        </p>
      </div>
    </footer>
  );
}
