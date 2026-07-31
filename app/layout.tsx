import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "线路保护图纸智能解读",
  description: "面向继电保护课程的图纸识别与教学解读工具"
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
