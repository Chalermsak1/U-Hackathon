"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import { TRADE_EVENT, TradePanel, TradePlanCard } from "@/components/TradePanel";
import { thb } from "@/lib/format";
import type { PaperOrder, RiskLevel, TradePlan } from "@/lib/types";

const SYMBOLS = ["ARB", "WLD", "AVAX", "ETH", "BTC"];
const LEVEL_SHORT: Record<RiskLevel, string> = { high: "เสี่ยงสูง", medium: "ปานกลาง", low: "ต่ำ", none: "–" };

interface Position {
  symbol: string;
  qty: number;
  costThb: number;
  valueThb: number;
  pnlThb: number;
  priceUsd: number;
}

const qtyT = (q: number) => q.toLocaleString("en-US", { maximumFractionDigits: q < 1 ? 6 : q < 100 ? 4 : 2 });

// Trade: pick a token, let U-Bot draft the plan and check it, approve. Orders are paper orders.
export default function TradePage() {
  const [symbol, setSymbol] = useState("ARB");
  const [levels, setLevels] = useState<Record<string, RiskLevel>>({});
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [pending, setPending] = useState<TradePlan[]>([]);

  const load = useCallback(() => {
    fetch("/api/trade")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b) return;
        setOrders(b.orders ?? []);
        setPositions(b.positions ?? []);
        setPending(b.pending ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(TRADE_EVENT, load);
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((b: { items?: { symbol: string; level: RiskLevel }[] }) => setLevels(Object.fromEntries((b.items ?? []).map((i) => [i.symbol, i.level]))))
      .catch(() => undefined);
    return () => window.removeEventListener(TRADE_EVENT, load);
  }, [load]);

  return (
    <>
      <div className="page-title">
        <h1>เทรด</h1>
        <p>คุณเลือกเหรียญและจำนวนเอง · U-Bot ร่างแผนและตรวจความเสี่ยง · คุณเป็นคนอนุมัติ · คำสั่งเป็นแบบจำลอง (paper trading)</p>
      </div>

      <div className="trade-picker" role="tablist" aria-label="เลือกเหรียญ">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={symbol === s}
            className={`trade-pick ${symbol === s ? "on" : ""} ${levels[s] ? `lv-${levels[s]}` : ""}`}
            onClick={() => setSymbol(s)}
          >
            <b>{s}</b>
            {levels[s] && levels[s] !== "none" && (
              <span>
                <span className="dot" />
                {LEVEL_SHORT[levels[s]]}
              </span>
            )}
          </button>
        ))}
        <Link href={`/terminal/tokens/${symbol}`} className="note trade-more">
          ดูข้อมูลเต็มของ {symbol} →
        </Link>
      </div>

      <div className="trade-grid">
        <TradePanel symbol={symbol} />
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {pending.length > 0 && (
            <Spotlight className="panel">
              <div className="panel-head"><h2>แผนที่รอคุณตัดสินใจ</h2><span className="total">{pending.length} แผน</span></div>
              <div style={{ display: "grid", gap: 10 }}>
                {pending.map((p) => (
                  <TradePlanCard key={p.id} plan={p} />
                ))}
              </div>
            </Spotlight>
          )}
          <Spotlight className="panel">
            <div className="panel-head"><h2>สถานะจำลอง</h2><span className="total">จากคำสั่งที่อนุมัติ</span></div>
            {positions.length === 0 ? (
              <p className="empty">ยังไม่มี ลองให้ U-Bot ร่างแผนแล้วกดอนุมัติ</p>
            ) : (
              <div className="table-scroll">
                <table className="t-table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr><th>เหรียญ</th><th className="num">จำนวน</th><th className="num">ต้นทุน</th><th className="num">มูลค่าตอนนี้</th><th className="num">กำไร/ขาดทุน</th></tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.symbol}>
                        <td><b>{p.symbol}</b></td>
                        <td className="num">{qtyT(p.qty)}</td>
                        <td className="num">{thb(p.costThb)}</td>
                        <td className="num">{thb(p.valueThb)}</td>
                        <td className="num" style={{ color: p.pnlThb >= 0 ? "var(--teal-2)" : "var(--coral)" }}>{p.pnlThb >= 0 ? "+" : "−"}{thb(Math.abs(p.pnlThb))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Spotlight>
          <Spotlight className="panel">
            <div className="panel-head"><h2>คำสั่งจำลองของฉัน</h2><span className="total">{orders.length} รายการ</span></div>
            {orders.length === 0 && <p className="empty">ยังไม่มีคำสั่ง</p>}
            {orders.map((o) => (
              <div key={o.id} className="event-row" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                <span className={`pill ${o.side === "buy" ? "lv-low" : "lv-high"}`}>{o.side === "buy" ? "ซื้อ" : "ขาย"}</span>
                <span>
                  <b>{qtyT(o.qty)} {o.symbol}</b> · {thb(o.amountThb)} ที่ ${o.priceUsd.toLocaleString("en-US", { maximumFractionDigits: o.priceUsd < 1 ? 4 : 2 })}
                  <small className="note" style={{ display: "block" }}>
                    {new Date(o.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })} · บันทึกบน {o.receipt.chain}
                    {o.receipt.explorerUrl && (
                      <>
                        {" "}·{" "}
                        <a href={o.receipt.explorerUrl} target="_blank" rel="noreferrer">ดูธุรกรรม</a>
                      </>
                    )}
                  </small>
                </span>
                <span className="note">จุดตัด ${o.stopPriceUsd.toLocaleString("en-US", { maximumFractionDigits: o.stopPriceUsd < 1 ? 4 : 2 })}</span>
              </div>
            ))}
          </Spotlight>
          <p className="note">
            ยังไม่ได้ส่งคำสั่งจริง: การเทรดจริงต้องผ่านโบรกเกอร์หรือแพลตฟอร์มที่มีใบอนุญาต (เช่น swap ใน U-topia ผ่าน U-Bot) ซึ่งอยู่ใน roadmap
          </p>
        </div>
      </div>
    </>
  );
}
