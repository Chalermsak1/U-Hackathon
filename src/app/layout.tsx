import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "U-Guard",
  description: "รู้ก่อน เงินจะขยับ: agent ใน U-Bot ที่เช็กความเสี่ยงจากการปลดล็อกเหรียญก่อนคุณซื้อหรือถือ",
  icons: { icon: "/brand/logo-mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
