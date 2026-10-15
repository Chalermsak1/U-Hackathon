import type { ReactNode } from "react";

// The English app's public pages (/en, /login, /method). `.ug-web` scopes its design system.
export default function WebLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ug-web ug-page" lang="en">
      {children}
    </div>
  );
}
