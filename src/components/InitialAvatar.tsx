interface Props {
  name: string;
  size?: number;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#1D9E75", "#E74C3C", "#3498DB", "#F39C12", "#9B59B6",
    "#2ECC71", "#1ABC9C", "#E67E22", "#2980B9", "#8E44AD",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function InitialAvatar({ name, size = 40 }: Props) {
  const initial = name.charAt(0);
  const bg = hashColor(name);

  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
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
