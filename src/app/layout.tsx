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
  metadataBase: new URL("https://whosvoted.com"),
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "WHO VOTED",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
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
        <meta name="google-site-verification" content="9TJo8tXl2_FZQyJw7c8hXuScs7RD-EjNdj_VdMXc338" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5129078857293408" crossorigin="anonymous"></script>
      </head>
      <body className="bg-white text-gray-900 min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 pt-14">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
