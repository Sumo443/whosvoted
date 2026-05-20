interface Props {
  name: string;
  size?: number;
  faction?: string | null;
}

// 会派ごとの固定色
const FACTION_COLORS: Record<string, string> = {
  "自由民主党・無所属の会": "#CD7F32", // 銅色（自民党）
  "自由民主党": "#CD7F32",
  "立憲民主党・無所属": "#1D9E75", // 緑
  "立憲民主党": "#1D9E75",
  "公明党": "#E74C3C", // 赤
  "日本維新の会": "#3498DB", // 青
  "日本維新の会・無所属の会": "#3498DB",
  "国民民主党・無所属クラブ": "#F39C12", // 黄色
  "国民民主党": "#F39C12",
  "日本共産党": "#E74C3C", // 赤
  "参政党": "#9B59B6", // 紫
  "れいわ新選組": "#E67E22", // オレンジ
  "中道改革連合・無所属": "#0891B2", // 青緑
  "有志の会": "#2ECC71", // 明るい緑
  "無所属": "#95A5A6", // グレー
};

const FALLBACK_COLORS = [
  "#1D9E75", "#E74C3C", "#3498DB", "#F39C12", "#9B59B6",
  "#2ECC71", "#1ABC9C", "#E67E22", "#2980B9", "#8E44AD",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export default function InitialAvatar({ name, size = 40, faction }: Props) {
  const initial = name.charAt(0);
  const bg = faction ? FACTION_COLORS[faction] || hashColor(name) : hashColor(name);

  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
      title={faction || name}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}
