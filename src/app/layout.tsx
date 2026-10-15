import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { UBotLauncher } from "@/components/ubot/UBotLauncher";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "U-Guard · Know before your money moves", template: "%s · U-Guard" },
  description:
    "U-Guard is the safety skill inside U-Bot: before you buy, it checks token unlocks, the news and what markets are pricing, explains it in plain words, and lets you approve every action.",
  applicationName: "U-Guard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070d1a",
  colorScheme: "dark",
};

// Runs before first paint: skip the splash for visitors who already saw it this session.
const SEEN_SCRIPT = `try{if(sessionStorage.getItem("ug_seen"))document.documentElement.dataset.seen="1"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SEEN_SCRIPT }} />
      </head>
      <body>
        {children}
        <UBotLauncher />
      </body>
    </html>
  );
}
