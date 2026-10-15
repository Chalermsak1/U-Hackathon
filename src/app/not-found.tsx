import Link from "next/link";
import { SiteNav } from "@/components/site/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="section">
        <div className="container" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2.4rem" }}>Page not found</h1>
          <p className="muted">That page doesn&apos;t exist.</p>
          <Link href="/" className="btn btn-primary">
            Back to U-Guard
          </Link>
        </div>
      </main>
    </>
  );
}
