"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensureSession } from "@/components/EnsureSession";
import { thb } from "@/lib/format";
import { asOfLabelTh } from "@/lib/freshness";
import type { PaperOrder, TradePlan, TradeSide } from "@/lib/types";

export const TRADE_EVENT = "trade:changed";

const VERDICT = {
  ready: { th: "ผ่านการตรวจ", lv: "lv-low" },
  caution: { th: "ควรดูก่อนอนุมัติ", lv: "lv-medium" },
  blocked: { th: "ทำตามแผนนี้ไม่ได้", lv: "lv-high" },
} as const;
const MARK = { ok: "✓", warn: "!", block: "✕" } as const;

const usdP = (p: number) => `$${p.toLocaleString("en-US", { maximumFractionDigits: p < 1 ? 4 : 2 })}`;
const qtyT = (q: number) => q.toLocaleString("en-US", { maximumFractionDigits: q < 1 ? 6 : q < 100 ? 4 : 2 });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${thb(Math.abs(n))}`;

/** The plan U-Bot drafted: summary, numbers, U-Guard checks, what-if rows, and the approval buttons. */
export function TradePlanCard({ plan, onDone }: { plan: TradePlan; onDone?: (order: PaperOrder | null) => void }) {
  const [state, setState] = useState<"pending" | "busy" | "approved" | "declined">(plan.status === "pending" ? "pending" : plan.status);
  const [order, setOrder] = useState<PaperOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = VERDICT[plan.verdict];

  async function decide(decision: "approve" | "decline") {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/trade/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, decision }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      setOrder(body.order ?? null);
      setState(decision === "approve" ? "approved" : "declined");
      window.dispatchEvent(new Event(TRADE_EVENT));
      onDone?.(body.order ?? null);
    } catch (err) {
      setError((err as Error).message);
      setState("pending");
    }
  }

  return (
    <article className={`tp-plan ${v.lv}`} aria-label={`แผน${plan.side === "buy" ? "ซื้อ" : "ขาย"} ${plan.symbol}`}>
      <div className="tp-plan-head">
        <b>แผนที่ U-Bot ร่าง</b>
        <span className="tp-verdict">
          <span className="dot" />
          {v.th}
        </span>
      </div>
      <ul className="tp-summary">
        {plan.summary.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <dl className="tp-nums">
        <div><dt>จำนวน</dt><dd>{qtyT(plan.qty)} {plan.symbol}</dd></div>
        <div><dt>ราคา{plan.orderType === "limit" ? " (limit)" : ""} {asOfLabelTh(plan.priceAsOf, plan.priceStale)}</dt><dd>{usdP(plan.priceUsd)}</dd></div>
        <div><dt>ค่าธรรมเนียม (สมมติ 0.25%)</dt><dd>{thb(plan.feeThb)}</dd></div>
        {plan.side === "buy" && (
          <>
            <div><dt>จุดตัดขาดทุน −{plan.stopLossPct}%</dt><dd>{usdP(plan.stopPriceUsd)}</dd></div>
            <div><dt>เสียสูงสุด (ถ้าถึงจุดตัด)</dt><dd>{thb(plan.maxLossThb)}</dd></div>
            <div><dt>{plan.symbol} หลังซื้อ</dt><dd>{plan.positionPctAfter.toFixed(1)}% ของพอร์ต</dd></div>
          </>
        )}
      </dl>

      <h4 className="tp-sub">U-Guard ตรวจ</h4>
      <ul className="tp-checks">
        {plan.checks.map((c) => (
          <li key={c.id} className={`tp-check ${c.status}`}>
            <span className="tp-mark" aria-hidden="true">{MARK[c.status]}</span>
            <span>
              <b>{c.label}</b>
              {c.detail && <small>{c.detail}</small>}
            </span>
          </li>
        ))}
      </ul>

      <h4 className="tp-sub">ถ้าราคาเป็นแบบนี้</h4>
      <div className="table-scroll">
        <table className="t-table tp-table">
          <thead>
            <tr><th>กรณี</th><th className="num">ราคา</th><th className="num">{plan.side === "buy" ? "กำไร/ขาดทุน" : "ผลต่อคุณ"}</th></tr>
          </thead>
          <tbody>
            {plan.scenarios.map((s) => (
              <tr key={s.label} title={s.basis}>
                <td>
                  {s.label} <span className="note">({s.pct > 0 ? "+" : ""}{s.pct.toFixed(1)}%)</span>
                  <small className="tp-basis">{s.basis}</small>
                </td>
                <td className="num">{usdP(s.priceUsd)}</td>
                <td className={`num ${s.pnlThb >= 0 ? "pos" : "neg"}`}>{signed(s.pnlThb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.agent && (
        <details className="tp-agent">
          <summary>คำอธิบายจาก U-Bot · {plan.agent.engine} · {plan.agent.trace.length} ขั้นตอน</summary>
          <p>{plan.agent.reply}</p>
        </details>
      )}

      {state === "approved" && (
        <p className="receipt">
          อนุมัติแล้ว · คำสั่งจำลอง {order ? `${qtyT(order.qty)} ${order.symbol}` : ""} · บันทึกบน {order?.receipt.chain ?? "Avalanche"}
          {order?.receipt.explorerUrl ? (
            <>
              {" "}·{" "}
              <a href={order.receipt.explorerUrl} target="_blank" rel="noreferrer">ดูธุรกรรม</a>
            </>
          ) : order?.receipt.note ? (
            <> · {order.receipt.note}</>
          ) : null}{" "}
          · <Link href="/terminal/trade">ดูคำสั่งทั้งหมด</Link>
        </p>
      )}
      {state === "declined" && <p className="receipt">ไม่ทำตามแผนนี้ ไม่มีคำสั่งเกิดขึ้น</p>}
      {(state === "pending" || state === "busy") && (
        <div className="tp-actions">
          <button className="btn btn-primary" disabled={state === "busy" || plan.verdict === "blocked"} onClick={() => decide("approve")}>
            {state === "busy" ? "กำลังบันทึก…" : plan.side === "buy" ? "อนุมัติซื้อ (จำลอง)" : "อนุมัติขาย (จำลอง)"}
          </button>
          <button className="btn" disabled={state === "busy"} onClick={() => decide("decline")}>
            ไม่ทำ
          </button>
          {error && <span className="error">{error}</span>}
        </div>
      )}
    </article>
  );
}

/** Order ticket: the user picks side, amount and order type; U-Bot drafts the plan around it. */
export function TradePanel({ symbol, defaultAmount = 5000 }: { symbol: string; defaultAmount?: number }) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [stop, setStop] = useState("10");
  const [budget, setBudget] = useState("2");
  const [plan, setPlan] = useState<TradePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(null);
    setError(null);
  }, [symbol]);

  async function draft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      await ensureSession();
      const res = await fetch("/api/trade/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          amountThb: Number(amount.replace(/,/g, "")),
          orderType,
          limitPriceUsd: orderType === "limit" && limitPrice ? Number(limitPrice) : null,
          stopLossPct: Number(stop),
          riskBudgetPct: Number(budget),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "ร่างแผนไม่สำเร็จ");
      setPlan(body as TradePlan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel tp" aria-label={`เทรด ${symbol}`}>
      <div className="panel-head">
        <h2>เทรด {symbol}</h2>
        <span className="total">paper trading</span>
      </div>
      <form onSubmit={draft} className="tp-form">
        <div className="tp-side" role="radiogroup" aria-label="ซื้อหรือขาย">
          <button type="button" role="radio" aria-checked={side === "buy"} className={side === "buy" ? "on buy" : ""} onClick={() => setSide("buy")}>
            ซื้อ
          </button>
          <button type="button" role="radio" aria-checked={side === "sell"} className={side === "sell" ? "on sell" : ""} onClick={() => setSide("sell")}>
            ขาย
          </button>
        </div>
        <label>
          จำนวนเงิน (บาท)
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="tp-presets">
          {[1000, 5000, 20000].map((n) => (
            <button type="button" key={n} className="chip" onClick={() => setAmount(String(n))}>
              {thb(n)}
            </button>
          ))}
        </div>
        <div className="tp-row">
          <label>
            ประเภทคำสั่ง
            <select value={orderType} onChange={(e) => setOrderType(e.target.value as "market" | "limit")}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </label>
          {orderType === "limit" && (
            <label>
              ราคา limit ($)
              <input inputMode="decimal" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="0.17" />
            </label>
          )}
        </div>
        <details className="tp-adv">
          <summary>ตั้งค่าความเสี่ยง</summary>
          <div className="tp-row">
            <label>
              จุดตัดขาดทุน (%)
              <input inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} />
            </label>
            <label>
              งบความเสี่ยงต่อไม้ (% ของพอร์ต)
              <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
          </div>
        </details>
        <button className="btn btn-primary tp-go" type="submit" disabled={busy}>
          {busy ? "U-Bot กำลังร่างแผน…" : "ให้ AI ร่างแผนและตรวจความเสี่ยง"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      {plan && <TradePlanCard key={plan.id} plan={plan} />}
      <p className="note tp-foot">คุณเลือกเหรียญและจำนวนเอง · U-Bot ร่างแผนและตรวจความเสี่ยง · คำสั่งเป็นแบบจำลอง · ไม่ใช่คำแนะนำการลงทุน</p>
    </section>
  );
}
