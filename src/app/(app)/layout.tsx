import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppTabs, SignOut, TabBar } from "@/components/app/AppNav";
import { Logo } from "@/components/brand";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <>
      <header className="app-top">
        <div className="container">
          <Logo href="/app" />
          <AppTabs />
          <div className="user">
            <span className="name" title={session.email ?? session.address ?? session.name}>
              {session.name}
            </span>
            {session.method === "demo" ? <span className="badge">Demo</span> : null}
            <SignOut />
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="container">{children}</div>
      </main>
      <TabBar />
    </>
  );
}
