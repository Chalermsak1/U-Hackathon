"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_TH } from "@/lib/format";
import type { AgentResult } from "@/lib/types";
import { ProposalCardView } from "./Cards";
import { Icon } from "./Icon";

export interface InboxItem {
  id: string;
  at: string;
  kind: "alert" | "reply";
  result: AgentResult;
}

const SEEN_KEY = "ug-inbox-seen";
/** Fire this after anything that may have pushed to U-Bot (scan, alert check) so the bell refreshes. */
export const INBOX_EVENT = "ubot:inbox";

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const load = useCallback(() => {
    fetch("/api/ubot/inbox")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b: { items?: InboxItem[] }) => setItems([...(b.items ?? [])].reverse()))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    window.addEventListener(INBOX_EVENT, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(INBOX_EVENT, load);
    };
  }, [load]);
  return { items, reload: load };
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/** U-Bot messages, newest first: each card's level, score and first reason, plus a link to follow up. */
export function InboxList({ items, onPick }: { items: InboxItem[]; onPick?: () => void }) {
  if (items.length === 0) return <p className="empty">ยังไม่มีข้อความจาก U-Bot · ลองสแกนพอร์ตหรือกด &ldquo;ตรวจตอนนี้&rdquo; ในหน้าการแจ้งเตือน</p>;
  return (
    <ul className="inbox-list">
      {items.map((it) => {
        const cards = it.result.cards.filter((c) => c.level !== "none");
        return (
          <li key={it.id}>
            <div className="inbox-meta">
              <span className="push-tag">{it.kind === "alert" ? "U-BOT แจ้งเตือน" : "U-BOT"}</span>
              <span className="note">{hhmm(it.at)}</span>
            </div>
            {cards.length === 0 && <p className="inbox-text">{it.result.reply.split("\n")[0]}</p>}
            {cards.map((c) => (
              <div key={c.symbol} className={`inbox-card lv-${c.level}`}>
                <b>{c.symbol}</b>
                <span className="inbox-lv">
                  <span className="dot" />
                  {LEVEL_TH[c.level]} {c.score}/100
                </span>
                <p className="inbox-text">{c.reasons[0]}</p>
                <Link href={`/terminal/agent?q=${encodeURIComponent(`เช็ก ${c.symbol} ให้หน่อย`)}`} className="note" onClick={onPick}>
                  ถาม U-Bot ต่อ →
                </Link>
              </div>
            ))}
            {/* Proposals U-Bot made for this user (chat, scan, alerts or MCP): decide right here. */}
            {it.result.proposals.map((p) => (
              <ProposalCardView key={p.id} proposal={p} />
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/** Bell in the terminal header: unread count and a drop-down of U-Bot messages. */
export function UBotInbox() {
  const { items } = useInbox();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY)) || 0);
    } catch {
      // storage blocked: everything counts as unread
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const unread = items.filter((i) => new Date(i.at).getTime() > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const t = Date.now();
      setSeen(t);
      try {
        localStorage.setItem(SEEN_KEY, String(t));
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="inbox" ref={box}>
      <button className="btn btn-sm inbox-bell" onClick={toggle} aria-expanded={open} aria-label={`ข้อความจาก U-Bot${unread ? ` ยังไม่อ่าน ${unread}` : ""}`}>
        <Icon name="bell" size={15} />
        {unread > 0 && <span className="inbox-count">{unread}</span>}
      </button>
      {open && (
        <div className="inbox-pop panel" role="dialog" aria-label="ข้อความจาก U-Bot">
          <div className="panel-head">
            <h2>ข้อความจาก U-Bot</h2>
            <Link href="/terminal/alerts" className="note" onClick={() => setOpen(false)} style={{ marginLeft: "auto" }}>
              ตั้งการแจ้งเตือน
            </Link>
          </div>
          <InboxList items={items.slice(0, 8)} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
