"use client";

import { useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import { INBOX_EVENT, InboxList, useInbox } from "@/components/UBotInbox";
import type { Proposal } from "@/lib/types";

interface Outcome {
  ruleId: string;
  symbol: string;
  fired: boolean;
  reason: string;
  channelNote?: string;
}

interface Rule {
  id: string;
  createdAt: string;
  symbol: string;
  minLevel: "medium" | "high";
  daysBefore: number;
  channel: "ubot" | "telegram" | "line";
}

const CHANNEL_TH = { ubot: "U-Bot in the app", telegram: "Telegram", line: "LINE" };

// Smart alerts: rules for when U-Guard should speak up, and the protection decisions so far.
export default function AlertsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [decisions, setDecisions] = useState<Proposal[]>([]);
  const [form, setForm] = useState({ symbol: "ARB", minLevel: "medium", daysBefore: 7, channel: "ubot" });
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const inbox = useInbox();
  const [watch, setWatch] = useState<{ enabled: boolean; intervalMin: number; lastRun: string | null; lastFired: number } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () =>
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((b) => {
        setRules(b.rules ?? []);
        setDecisions(b.decisions ?? []);
      })
      .catch(() => undefined);
  useEffect(() => {
    load();
    const loadWatch = () =>
      fetch("/api/watch")
        .then((r) => (r.ok ? r.json() : null))
        .then(setWatch)
        .catch(() => undefined);
    loadWatch();
    const t = setInterval(loadWatch, 30_000);
    return () => clearInterval(t);
  }, []);

  // One tap: a rule for every token in the wallet (stablecoins skipped), then check right away.
  async function watchWallet() {
    setAdding(true);
    setError(null);
    try {
      const b = await fetch("/api/portfolio").then((r) => r.json());
      const have = new Set(rules.map((r) => r.symbol));
      const syms: string[] = (b.holdings ?? []).map((h: { symbol: string }) => h.symbol).filter((x: string) => !["USDC", "USDT", "DAI"].includes(x) && !have.has(x));
      for (const symbol of syms) {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, minLevel: "medium", daysBefore: 7, channel: "ubot" }),
        });
      }
      await load();
      await checkNow();
    } finally {
      setAdding(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't add the rule");
      return;
    }
    load();
  }

  // Check every rule now: the ones that fire are pushed into the U-Bot inbox.
  async function checkNow() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The check failed");
      setOutcomes(body.outcomes ?? []);
      if (body.fired > 0) window.dispatchEvent(new Event(INBOX_EVENT));
      inbox.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="page-title">
        <h1>Alerts</h1>
        <p>U-Guard only speaks up when it matters · delivered through U-Bot (Telegram / LINE on the roadmap)</p>
      </div>
      <div className="grid-2">
        <Spotlight className="panel">
          <div className="watch-bar">
            <span className={`watch-dot ${watch?.enabled ? "on" : ""}`} aria-hidden="true" />
            <span>
              {watch?.enabled
                ? `U-Bot checks automatically every ${watch.intervalMin} min`
                : "Automatic checks are off (set WATCH_INTERVAL_MIN or use a cron)"}
              {watch?.lastRun && (
                <small className="note">
                  {" "}· last check {new Date(watch.lastRun).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · alerts {watch.lastFired}
                </small>
              )}
            </span>
            <button className="btn btn-sm" onClick={watchWallet} disabled={adding || checking}>
              {adding ? "Setting up…" : "Watch every token in my portfolio"}
            </button>
          </div>
          <div className="panel-head"><h2>New alert rule</h2></div>
          <form className="form-row" onSubmit={add}>
            <label>
              Token
              <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} maxLength={20} style={{ width: 90 }} />
            </label>
            <label>
              When risk is at least
              <select value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value })}>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Days ahead
              <input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} style={{ width: 80 }} />
            </label>
            <label>
              Channel
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="ubot">U-Bot in the app</option>
                <option value="telegram">Telegram</option>
                <option value="line">LINE</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
          {error && <p className="error">{error}</p>}
          <div style={{ marginTop: 14 }}>
            {rules.length === 0 && <p className="empty">No rules yet. Try adding ARB above.</p>}
            {rules.map((r) => {
              const o = outcomes?.find((x) => x.ruleId === r.id);
              return (
                <div key={r.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>
                    <b>{r.symbol}</b> · alert at {r.minLevel === "high" ? "high" : "medium or higher"} risk · {r.daysBefore} days before the unlock · {CHANNEL_TH[r.channel]}
                    {o && (
                      <span className={`note alert-outcome ${o.fired ? "fired" : ""}`}>
                        {o.fired ? "✓ sent to U-Bot · " : "no alert · "}
                        {o.reason}
                        {o.channelNote ? ` · ${o.channelNote}` : ""}
                      </span>
                    )}
                  </span>
                  <button className="btn btn-sm" onClick={() => remove(r.id)}>Delete</button>
                </div>
              );
            })}
          </div>
          {rules.length > 0 && (
            <div className="row" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={checkNow} disabled={checking}>
                {checking ? "Checking…" : "Check now"}
              </button>
              <span className="note">Checks every rule against the latest data; matches go to U-Bot (repeats after 12 hours)</span>
            </div>
          )}
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>Messages from U-Bot</h2><span className="total">Newest first</span></div>
          <InboxList items={inbox.items.slice(0, 6)} />
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>Your decisions</h2><span className="total">Approved / declined</span></div>
          {decisions.length === 0 && <p className="empty">None yet. Approve a proposal on the AI Agent, Trade or Invest page.</p>}
          {decisions.map((d) => (
            <div key={d.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <span>
                <b>{d.symbol}</b> · {d.title}
              </span>
              <span className={`pill ${d.status === "approved" ? "lv-low" : "lv-none"}`}>{d.status === "approved" ? "Approved" : "Declined"}</span>
            </div>
          ))}
        </Spotlight>
      </div>
    </>
  );
}
