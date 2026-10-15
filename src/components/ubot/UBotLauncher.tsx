"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BotFace } from "../brand";
import { ChatPanel } from "../chat/ChatPanel";
import { Icon } from "../Icon";

// The floating U-Bot bubble on every page except the full assistant and sign-in. It opens
// the same agent in a popup: FAQ answers (from the cached knowledge base) for visitors,
// the full wallet-aware agent once signed in.
export function UBotLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const hidden = pathname?.startsWith("/app") || pathname?.startsWith("/login");

  useEffect(() => {
    if (!open || user !== undefined) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((b) => setUser(b.user ?? null))
      .catch(() => setUser(null));
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Full-screen sheet on phones: stop the page behind it from scrolling.
    const small = window.matchMedia("(max-width: 640px)").matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (hidden) return null;

  return (
    <>
      {open ? (
        <div className="ubot-panel" role="dialog" aria-modal="false" aria-label="U-Bot">
          <header>
            <span className="avatar">
              <BotFace />
            </span>
            <div className="title">
              <strong>U-Bot</strong>
              <span>U-topia&apos;s assistant · U-Guard skill on · demo</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close U-Bot"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <Icon name="close" />
            </button>
          </header>
          {user === undefined ? (
            <div className="scroll">
              <p className="dim">Connecting…</p>
            </div>
          ) : (
            <ChatPanel variant="popup" signedIn={!!user} userName={user?.name} autoFocus />
          )}
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={`ubot-launcher${pathname?.startsWith("/dashboard") ? " above-tabbar" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Close U-Bot" : "Ask U-Bot"}
        onClick={() => setOpen((o) => !o)}
      >
        {!open ? <span className="pulse" aria-hidden="true" /> : null}
        {!open ? <span className="label">Ask U-Bot</span> : null}
        {open ? <Icon name="close" size={22} /> : <BotFace size={38} />}
      </button>
    </>
  );
}
