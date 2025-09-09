import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "個別支援計画書作成ツール",
  description: "面談内容から支援内容を自動生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
