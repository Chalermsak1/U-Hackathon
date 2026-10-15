"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureSession } from "@/components/EnsureSession";
import { Spotlight } from "@/components/fx";
import { LEVEL_TH, thaiDate, thb } from "@/lib/format";
import type { InvestPlan } from "@/lib/types";

interface Defaults {
  questions: { q: string; a: string[] }[];
  classes: { id: string; th: string; example: string; risk: number; color: string }[];
  plans: InvestPlan[];
}

const PICKS = ["BTC", "ETH", "ARB", "WLD", "AVAX"];
const riskText = (r: number) => (r >= 9 ? "8+" : String(r));

/** Allocation as one stacked bar plus a legend that carries the numbers (colour is never the only cue). */
function AllocationBar({ plan }: { plan: InvestPlan }) {
  const slices = plan.slices.filter((s) => s.pct > 0);
  return (
    <div>
      <div className="inv-bar" role="img" aria-label={slices.map((s) => `${s.th} ${s.pct}%`).join(", ")}>
        {slices.map((s) => (
          <i key={s.id} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.th} ${s.pct}%`} />
        ))}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        {slices.map((s) => (
          <span key={s.id}>
            <i style={{ background: s.color }} />
            {s.th} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// Invest: a short risk profile → a model portfolio the user can adjust → U-Guard checks the crypto
// part and the DCA dates → the user approves. Illustrative data; not personal investment advice.
export default function InvestPage() {
  const [defs, setDefs] = useState<Defaults | null>(null);
  const [answers, setAnswers] = useState<number[]>([0, 0, 0, 0, 0]);
  const [lump, setLump] = useState("50000");
  const [monthly, setMonthly] = useState("5000");
  const [day, setDay] = useState("25");
  const [picks, setPicks] = useState<string[]>(["BTC", "ETH"]);
  const [weights, setWeights] = useState<Record<string, string> | null>(null);
  const [plan, setPlan] = useState<InvestPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"pending" | "busy" | "approved" | "declined">("pending");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/invest")
      .then((r) => r.json())
      .then(setDefs)
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"));
  }, []);
  useEffect(load, [load]);

  const done = answers.every((a) => a > 0);

  async function draft(custom: Record<string, string> | null) {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      const res = await fetch("/api/invest/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          lumpSumThb: Number(lump.replace(/,/g, "")) || 0,
          monthlyThb: Number(monthly.replace(/,/g, "")) || 0,
          dcaDay: Number(day) || 25,
          cryptoPicks: picks,
          weights: custom ? Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, Number(v) || 0])) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "ร่างแผนไม่สำเร็จ");
      const p = body as InvestPlan;
      setPlan(p);
      setState("pending");
      setWeights(Object.fromEntries(p.slices.map((s) => [s.id, String(s.pct)])));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "decline") {
    if (!plan) return;
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/invest/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, decision }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      setPlan(body.plan);
      setState(decision === "approve" ? "approved" : "declined");
      load();
    } catch (err) {
      setError((err as Error).message);
      setState("pending");
    }
  }

  return (
    <>
      <div className="page-title">
        <h1>ลงทุน</h1>
        <p>ตอบ 5 ข้อ → U-Bot ร่างพอร์ตตัวอย่างตามระดับความเสี่ยงของคุณ → ปรับเองได้ → U-Guard ตรวจส่วนคริปโตและวัน DCA → คุณอนุมัติ</p>
      </div>
      <p className="note inv-disclaimer">
        พอร์ตตัวอย่างเพื่อการศึกษา ใช้ข้อมูลตัวอย่าง (ชื่อกองทุนเป็นตัวอย่าง ไม่ใช่สินค้าจริง) · ไม่ใช่คำแนะนำการลงทุนเฉพาะบุคคล · บริการแนะนำการลงทุนจริงต้องผ่านผู้ที่ได้รับใบอนุญาตจาก ก.ล.ต.
      </p>

      <div className="inv-grid">
        <Spotlight className="panel">
          <div className="panel-head"><h2>แบบประเมินความเสี่ยง</h2><span className="total">{answers.filter(Boolean).length}/5</span></div>
          {!defs && <p className="note">กำลังโหลด…</p>}
          <div className="inv-quiz">
            {defs?.questions.map((q, i) => (
              <fieldset key={q.q}>
                <legend>{i + 1}. {q.q}</legend>
                <div className="inv-options">
                  {q.a.map((a, j) => (
                    <label key={a} className={answers[i] === j + 1 ? "on" : ""}>
                      <input
                        type="radio"
                        name={`q${i}`}
                        checked={answers[i] === j + 1}
                        onChange={() => setAnswers((prev) => prev.map((v, k) => (k === i ? j + 1 : v)))}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="panel-head" style={{ marginTop: 16 }}><h2>เงินที่จะลงทุน</h2></div>
          <div className="tp-form">
            <div className="tp-row">
              <label>
                เงินก้อน (บาท)
                <input inputMode="numeric" value={lump} onChange={(e) => setLump(e.target.value)} />
              </label>
              <label>
                DCA ต่อเดือน (บาท)
                <input inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
              </label>
              <label>
                วันที่ DCA (1–28)
                <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
            </div>
            <div>
              <p className="note" style={{ margin: "0 0 6px" }}>คริปโตที่อยากมีในพอร์ต (คุณเลือกเอง)</p>
              <div className="tp-presets">
                {PICKS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`chip ${picks.includes(p) ? "chip-on" : ""}`}
                    aria-pressed={picks.includes(p)}
                    onClick={() => setPicks((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary tp-go" disabled={!done || busy} onClick={() => draft(null)}>
              {busy ? "U-Bot กำลังร่างแผน…" : done ? "ให้ U-Bot ร่างแผนลงทุน" : "ตอบแบบประเมินให้ครบก่อน"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </Spotlight>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {!plan && (
            <Spotlight className="panel">
              <div className="panel-head"><h2>แผนของคุณ</h2></div>
              <p className="empty">ตอบแบบประเมินแล้วกด &ldquo;ให้ U-Bot ร่างแผนลงทุน&rdquo; แผนจะขึ้นตรงนี้</p>
            </Spotlight>
          )}
          {plan && (
            <Spotlight className="panel">
              <div className="panel-head">
                <h2>แผนลงทุนระดับ &ldquo;{plan.profileTh}&rdquo;</h2>
                <span className="total">ข้อมูลตัวอย่าง</span>
              </div>
              <ul className="tp-summary">
                {plan.summary.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div style={{ marginTop: 12 }}>
                <AllocationBar plan={plan} />
              </div>

              <div className="table-scroll" style={{ marginTop: 12 }}>
                <table className="t-table tp-table">
                  <thead>
                    <tr><th>สินทรัพย์</th><th className="num">ความเสี่ยง</th><th className="num">สัดส่วน %</th><th className="num">เงินก้อน</th><th className="num">ต่อเดือน</th></tr>
                  </thead>
                  <tbody>
                    {plan.slices.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="dot" style={{ display: "inline-block", marginRight: 6, background: s.color }} />
                          {s.th}
                          <small className="tp-basis">{s.example}</small>
                        </td>
                        <td className="num">{riskText(s.risk)}</td>
                        <td className="num">
                          <input
                            className="inv-pct"
                            inputMode="decimal"
                            aria-label={`สัดส่วน ${s.th}`}
                            value={weights?.[s.id] ?? String(s.pct)}
                            onChange={(e) => setWeights((w) => ({ ...(w ?? {}), [s.id]: e.target.value }))}
                            disabled={state !== "pending"}
                          />
                        </td>
                        <td className="num">{thb(s.lumpThb)}</td>
                        <td className="num">{thb(s.monthlyThb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state === "pending" && (
                <button className="btn btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => draft(weights)}>
                  คำนวณใหม่ตามสัดส่วนที่ปรับ
                </button>
              )}

              <h4 className="tp-sub" style={{ marginTop: 14 }}>U-Guard ตรวจ</h4>
              <ul className="tp-checks">
                {plan.checks.map((c) => (
                  <li key={c.label} className={`tp-check ${c.status}`}>
                    <span className="tp-mark" aria-hidden="true">{c.status === "ok" ? "✓" : "!"}</span>
                    <span>
                      <b>{c.label}</b>
                      <small>{c.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>

              {plan.crypto.length > 0 && (plan.slices.find((s) => s.id === "crypto")?.pct ?? 0) > 0 && (
                <>
                  <h4 className="tp-sub" style={{ marginTop: 14 }}>ส่วนคริปโต (แบ่งเท่ากันตามที่คุณเลือก)</h4>
                  {plan.crypto.map((c) => (
                    <div key={c.symbol} className={`inbox-card lv-${c.level}`} style={{ marginTop: 6 }}>
                      <b>{c.symbol} · {c.pctOfCrypto}%</b>
                      <span className="inbox-lv">
                        <span className="dot" />
                        {c.level === "none" ? "ไม่มี unlock" : `${LEVEL_TH[c.level]} ${c.score}/100`}
                      </span>
                      <p className="inbox-text">{c.note}</p>
                    </div>
                  ))}
                </>
              )}

              <h4 className="tp-sub" style={{ marginTop: 14 }}>DCA 3 งวดข้างหน้า</h4>
              {plan.dca.map((d) => (
                <div key={d.date} className="event-row" style={{ gridTemplateColumns: "88px 1fr auto" }}>
                  <span>{thaiDate(d.date)}</span>
                  <span>
                    {d.notes.length === 0 ? <span className="note">ปกติ</span> : d.notes.map((n) => <small key={n} className="inv-dca-note">{n}</small>)}
                  </span>
                  <span>{thb(d.amountThb)}</span>
                </div>
              ))}

              {state === "approved" && (
                <p className="receipt" style={{ marginTop: 12 }}>
                  อนุมัติแล้ว · บันทึกบน {plan.receipt?.chain ?? "Avalanche"}
                  {plan.receipt?.explorerUrl ? (
                    <>
                      {" "}·{" "}
                      <a href={plan.receipt.explorerUrl} target="_blank" rel="noreferrer">ดูธุรกรรม</a>
                    </>
                  ) : plan.receipt?.note ? (
                    <> · {plan.receipt.note}</>
                  ) : null}
                </p>
              )}
              {state === "declined" && <p className="receipt" style={{ marginTop: 12 }}>ไม่ใช้แผนนี้</p>}
              {(state === "pending" || state === "busy") && (
                <div className="tp-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={state === "busy"} onClick={() => decide("approve")}>
                    {state === "busy" ? "กำลังบันทึก…" : "อนุมัติแผนนี้"}
                  </button>
                  <button className="btn" disabled={state === "busy"} onClick={() => decide("decline")}>
                    ไม่ใช้
                  </button>
                </div>
              )}
            </Spotlight>
          )}

          {defs && defs.plans.length > 0 && (
            <Spotlight className="panel">
              <div className="panel-head"><h2>แผนที่อนุมัติแล้ว</h2><span className="total">{defs.plans.length}</span></div>
              {defs.plans.map((p) => (
                <div key={p.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>
                    <b>{p.profileTh}</b> · DCA {thb(p.monthlyThb)}/เดือน · {p.slices.filter((s) => s.pct > 0).map((s) => `${s.th} ${s.pct}%`).join(", ")}
                  </span>
                  <span className="pill lv-low">อนุมัติ</span>
                </div>
              ))}
            </Spotlight>
          )}
        </div>
      </div>
    </>
  );
}
