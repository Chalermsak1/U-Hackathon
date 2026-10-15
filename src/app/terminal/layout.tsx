import type { Metadata } from "next";
import { EnsureSession } from "@/components/EnsureSession";
import { TerminalShell } from "@/components/TerminalShell";

export const metadata: Metadata = { title: { absolute: "U-Guard Terminal" } };

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <EnsureSession>
      <TerminalShell>{children}</TerminalShell>
    </EnsureSession>
  );
}
