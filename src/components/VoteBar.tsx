interface VoteBarProps {
  yeaCount: number;
  nayCount: number;
  height?: number;
  showLabels?: boolean;
}

export default function VoteBar({
  yeaCount,
  nayCount,
  height = 8,
  showLabels = false,
}: VoteBarProps) {
  const total = yeaCount + nayCount;
  const yeaPct = total > 0 ? (yeaCount / total) * 100 : 50;
  const nayPct = total > 0 ? (nayCount / total) * 100 : 50;

  return (
    <div>
      {showLabels && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#1D9E75] font-medium">賛成 {yeaCount}</span>
          <span className="text-red-400 font-medium">反対 {nayCount}</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden flex"
        style={{ height }}
      >
        <div
          className="bg-[#1D9E75] transition-all duration-300"
          style={{ width: `${yeaPct}%` }}
        />
        <div
          className="bg-red-400 transition-all duration-300"
          style={{ width: `${nayPct}%` }}
        />
      </div>
    </div>
  );
}
