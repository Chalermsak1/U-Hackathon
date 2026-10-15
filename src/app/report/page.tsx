"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { compact, LEVEL_TH, pct, thaiDate, usd } from "@/lib/format";
import { readReport, type ReportData } from "@/lib/report";
import type { RecipientClass } from "@/lib/types";

const RECIPIENT_TH: Record<RecipientClass, string> = {
  team: "ทีม",
  investor: "นักลงทุน",
  community: "ชุมชน",
  other: "อื่นๆ",
  reserve: "เงินสำรองโครงการ",
  ecosystem: "กองทุนพัฒนา ecosystem",
};

// Printable A4 summary of one U-Guard answer. Opens the print dialog once fonts are ready.
export default function ReportPage() {
  const [data, setData] = useState<ReportData | null | undefined>(undefined);

  useEffect(() => {
    const d = readReport();
    setData(d);
    const preview = new URLSearchParams(window.location.search).has("preview");
    if (d && !preview) document.fonts.ready.then(() => setTimeout(() => window.print(), 300));
  }, []);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <main className="report-page">
        <p>ยังไม่มีผลให้สรุป เปิดหน้าแอป ถาม U-Guard แล้วกด &ldquo;สรุปเป็น PDF&rdquo; อีกครั้ง</p>
        <Link href="/app">กลับไปหน้าแอป</Link>
      </main>
    );
  }

  const { question, result, at } = data;
  const sample = result.cards.some((c) => c.source.mode === "sample");

  return (
    <main className="report-page">
      <div className="no-print report-actions">
        <button className="btn btn-primary" onClick={() => window.print()}>
          บันทึกเป็น PDF
        </button>
        <Link href="/app" className="btn">
          กลับไปหน้าแอป
        </Link>
      </div>

      <header className="report-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.svg" width={44} height={44} alt="" />
        <div>
          <h1>สรุปการตรวจความเสี่ยงจากการปลดล็อกเหรียญ</h1>
          <p>
            U-Guard ใน U-Bot · {new Date(at).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })} ·{" "}
            {result.mode === "claude" ? "Claude agent" : "Offline agent"}
          </p>
        </div>
      </header>

      <section>
        <h2>คำถาม</h2>
        <p>{question}</p>
        <h2>คำตอบของ U-Guard</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{result.reply}</p>
      </section>

      {result.cards.map((c) => (
        <section key={c.symbol} className="report-card">
          <h2>
            {c.symbol} · {c.name} — {LEVEL_TH[c.level]}
            {c.level !== "none" ? ` (${c.score}/100)` : ""}
          </h2>
          {c.level !== "none" && (
            <table>
              <tbody>
                <tr>
                  <th>วันที่ปลดล็อก</th>
                  <td>{c.unlockDate ? thaiDate(c.unlockDate) : "–"}</td>
                  <th>จำนวน</th>
                  <td>
                    {compact(c.amount)} {c.symbol} (~{usd(c.valueUsd)})
                  </td>
                </tr>
                <tr>
                  <th>% ของเหรียญหมุนเวียน</th>
                  <td>{pct(c.pctOfCirculating)}</td>
                  <th>เทียบ volume ซื้อขาย</th>
                  <td>{c.daysOfVolume === null ? "–" : `${c.daysOfVolume.toFixed(2)} วัน`}</td>
                </tr>
                <tr>
                  <th>กำไรของนักลงทุนรอบล่าสุด</th>
                  <td>{c.investorMultiple === null ? "–" : `~${c.investorMultiple.toFixed(1)} เท่า`}</td>
                  <th>ผู้รับ</th>
                  <td>{c.breakdown.map((b) => `${RECIPIENT_TH[b.recipient]} ${Math.round(b.share * 100)}%`).join(" · ")}</td>
                </tr>
              </tbody>
            </table>
          )}
          <ul>
            {c.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ))}

      {result.proposals.length > 0 && (
        <section>
          <h2>ข้อเสนอการป้องกัน (ต้องให้ผู้ใช้อนุมัติ)</h2>
          <ul>
            {result.proposals.map((p) => (
              <li key={p.id}>
                <b>{p.title}</b> — {p.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.trace.length > 0 && (
        <section>
          <h2>ขั้นตอนที่ agent ทำ</h2>
          <ol className="report-trace">
            {result.trace.map((t, i) => (
              <li key={`${t.tool}-${i}`}>
                <code>{t.tool}</code> — {t.summary}
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="report-foot">
        <p>
          แหล่งข้อมูล: Tokenomist ({sample ? "ข้อมูลตัวอย่างสำหรับ demo" : "ข้อมูลสด"}) · ราคาและ volume: CoinGecko / ข้อมูลตัวอย่าง ·
          วิธีคิดคะแนนอ้างอิงงานวิจัย Keyrock (16,000+ unlock events) คะแนนคำนวณด้วยโค้ด ไม่ใช่ AI
        </p>
        <p>
          เอกสารนี้เป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน U-Guard ไม่ได้แนะนำให้ซื้อ ขาย หรือถือสินทรัพย์ใด
          การลงทุนในสินทรัพย์ดิจิทัลมีความเสี่ยงสูง
        </p>
      </footer>
    </main>
  );
}
