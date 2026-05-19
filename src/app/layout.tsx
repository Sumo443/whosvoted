import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "WHO VOTED - 国会議員の投票記録データベース",
    template: "%s | WHO VOTED",
  },
  description:
    "国会議員の記名投票記録を可視化。議員ごとの賛否や法案ごとの採決結果を検索・比較できます。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "WHO VOTED",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-white text-gray-900 min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 pt-14">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
