import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "WHO VOTED - 国会議員の投票記録データベース";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: '"Helvetica Neue", Arial, "Hiragino Sans", sans-serif',
        }}
      >
        {/* 横線 */}
        <div
          style={{
            width: 80,
            height: 4,
            background: "#1D9E75",
            marginBottom: 40,
          }}
        />
        {/* タイトル */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "0.05em",
            display: "flex",
            gap: 12,
          }}
        >
          <span>WHO</span>
          <span style={{ color: "#1D9E75" }}>VOTED</span>
        </div>
        {/* サブテキスト */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            marginTop: 24,
            letterSpacing: "0.1em",
          }}
        >
          だれが賛成した？ 反対した？
        </div>
        {/* 下部ライン */}
        <div
          style={{
            width: 80,
            height: 4,
            background: "#1D9E75",
            marginTop: 40,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
