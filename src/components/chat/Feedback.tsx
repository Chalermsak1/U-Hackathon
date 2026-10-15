"use client";

import { useState } from "react";
import { Icon } from "../Icon";

export function Feedback({ requestId }: { requestId: string }) {
  const [sent, setSent] = useState<"up" | "down" | null>(null);
  async function rate(rating: "up" | "down") {
    if (sent) return;
    setSent(rating);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, rating }),
      });
    } catch {
      // feedback is best-effort
    }
  }
  return (
    <span className="row" style={{ gap: 0 }}>
      <button type="button" className="icon-btn" aria-label="Helpful" aria-pressed={sent === "up"} onClick={() => rate("up")} disabled={!!sent}>
        <Icon name="thumbsUp" size={16} />
      </button>
      <button type="button" className="icon-btn" aria-label="Not helpful" aria-pressed={sent === "down"} onClick={() => rate("down")} disabled={!!sent}>
        <Icon name="thumbsDown" size={16} />
      </button>
      {sent ? <span className="dim" style={{ fontSize: 12 }}>Thanks</span> : null}
    </span>
  );
}
