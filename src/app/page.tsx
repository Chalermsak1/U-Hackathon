import Link from "next/link";
import { Ticker } from "@/components/Ticker";
import { TopBar } from "@/components/TopBar";

// Minimal platform page. The full story layout is specified in UI-PLAN.md §5.
export default function Home() {
  return (
    <>
      <TopBar current="home" />
      <Ticker />
      <main className="hero">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/avatar.svg" width={88} height={88} alt="U-Guard" />
          <h1>
            U-<span>GUARD</span>
          </h1>
          <p className="tag">รู้ก่อน เงินจะขยับ</p>
          <p className="sub">KNOW BEFORE YOUR MONEY MOVES</p>
          <div className="row">
            <Link href="/app" className="btn btn-primary">
              เปิด demo
            </Link>
            <a href="https://github.com/nathirad/U-Hackathon/blob/main/SPEC.md" className="btn" target="_blank" rel="noreferrer">
              อ่าน spec
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
