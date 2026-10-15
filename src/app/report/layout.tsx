import type { ReactNode } from "react";
import { EnsureSession } from "@/components/EnsureSession";

export default function ReportLayout({ children }: { children: ReactNode }) {
  return <EnsureSession>{children}</EnsureSession>;
}
