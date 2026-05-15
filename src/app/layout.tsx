import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI圆桌",
  description: "本地优先的中文 AI 群聊讨论软件"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
