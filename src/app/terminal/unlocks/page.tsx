"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import { compact, LEVEL_TH, thaiDate, unlockWhenTh, untilText, usd } from "@/lib/format";
import type { RiskCard } from "@/lib/types";

interface MarketEvent {
  symbol: string;
  date: string;
  summary: string;
  sizeNote: string;
  source: string;
  url: string;
  past?: boolean;
  dateApprox?: boolean;
}

// Unlock calendar: what U-Guard scores in full, plus market events from public reports.
export default function UnlocksPage() {
  const [analysed, setAnalysed] = useState<RiskCard[]>([]);
  const [market, setMarket] = useState<MarketEvent[]>([]);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((b) => {
        setAnalysed(b.analysed ?? []);
        setMarket(b.market ?? []);
      })
      .catch(() => undefined);
  }, []);

  const upcoming = market.filter((e) => !e.past).sort((a, b) => a.date.localeCompare(b.date));
  const past = market.filter((e) => e.past);

  return (
    <>
      <div className="page-title">
        <h1>ปฏิทินปลดล็อก</h1>
        <p>ราคามักเริ่มถูกกดตั้งแต่ ~30 วันก่อนวัน unlock (Keyrock) · U-Guard ให้คะแนนตามขนาด, สภาพคล่อง และผู้รับ</p>
      </div>

      <Spotlight className="panel">
        <div className="panel-head">
          <h2>U-Guard วิเคราะห์เต็ม</h2>
          <span className="total">คะแนนคำนวณด้วยโค้ด</span>
        </div>
        {analysed.map((c) => (
          <Link key={c.symbol} href={`/terminal/tokens/${c.symbol}`} className="event-row" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="event-date">
              <b>{c.unlockDate ? thaiDate(c.unlockDate) : "–"}</b>
              {unlockWhenTh(c)}
            </span>
            <span>
              <b>{c.symbol}</b> · {compact(c.amount)} ({usd(c.valueUsd)}) · {c.pctOfCirculating.toFixed(2)}% ของ circulating ·{" "}
              <span className="note">{c.reasons[2] ?? ""}</span>
            </span>
            <span className={`pill lv-${c.level}`}>
              {LEVEL_TH[c.level]} {c.score}
            </span>
          </Link>
        ))}
      </Spotlight>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>ในตลาดสัปดาห์นี้และเร็วๆ นี้</h2>
            <span className="total">จากรายงานสาธารณะ</span>
          </div>
          {upcoming.map((e) => (
            <div key={e.symbol + e.date} className="event-row">
              <span className="event-date">
                <b>{e.dateApprox ? "พ.ย." : thaiDate(e.date)}</b>
                {e.dateApprox ? "ยังไม่ระบุวัน" : untilText(e.date)}
              </span>
              <span>
                <b>{e.symbol}</b> · {e.summary}
                <br />
                <span className="note">
                  {e.sizeNote} ·{" "}
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.source}
                  </a>
                </span>
              </span>
              <span />
            </div>
          ))}
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>เพิ่งผ่านไป (บทเรียน)</h2>
          </div>
          {past.map((e) => (
            <div key={e.symbol + e.date} className="event-row">
              <span className="event-date">
                <b>{thaiDate(e.date)}</b>
              </span>
              <span>
                <b>{e.symbol}</b> · {e.summary}
                <br />
                <span className="note">
                  {e.sizeNote} ·{" "}
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.source}
                  </a>
                </span>
              </span>
              <span />
            </div>
          ))}
        </Spotlight>
      </div>
    </>
  );
}
