import type { ReactNode } from "react";
import { EnsureSession } from "@/components/EnsureSession";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <EnsureSession>{children}</EnsureSession>;
}
