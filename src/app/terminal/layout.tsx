import type { Metadata } from "next";
import { TerminalShell } from "@/components/TerminalShell";

export const metadata: Metadata = { title: "U-Guard Terminal" };

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}
