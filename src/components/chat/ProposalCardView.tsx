"use client";

import { useState } from "react";
import type { Proposal, ProtectionReceipt } from "@/lib/types";
import { Icon } from "../Icon";

export function ProposalCardView({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState(proposal.status);
  const [receipt, setReceipt] = useState<ProtectionReceipt | null>(null);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "decline") {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch("/api/protect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, decision }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setStatus(body.proposal.status);
      setReceipt(body.receipt ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="proposal" aria-label="Protection rule proposal">
      <div className="row" style={{ gap: 8 }}>
        <span style={{ color: "var(--teal)" }}>
          <Icon name="shield" />
        </span>
        <h4>{proposal.title}</h4>
      </div>
      <p>{proposal.detail}</p>

      {status === "pending" ? (
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={() => decide("approve")} disabled={busy !== null}>
            <Icon name="check" size={16} /> {busy === "approve" ? "Recording…" : "Approve"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => decide("decline")} disabled={busy !== null}>
            Not now
          </button>
          <span className="dim" style={{ fontSize: 12 }}>
            Nothing moves your money.
          </span>
        </div>
      ) : status === "declined" ? (
        <p className="dim">Declined. U-Guard will not apply this rule.</p>
      ) : (
        <div className="receipt" role="status">
          <div className="row" style={{ gap: 6, color: "var(--teal-2)", fontWeight: 600 }}>
            <Icon name="check" size={16} /> Approved
          </div>
          {receipt?.mode === "onchain" && receipt.explorerUrl ? (
            <p style={{ margin: "6px 0 0" }}>
              Recorded on {receipt.chain}:{" "}
              <a href={receipt.explorerUrl} target="_blank" rel="noopener noreferrer">
                {receipt.txHash?.slice(0, 10)}…{receipt.txHash?.slice(-6)} <Icon name="external" size={12} />
              </a>
            </p>
          ) : (
            <p style={{ margin: "6px 0 0" }}>
              Receipt created ({receipt?.chain ?? "simulated"}). {receipt?.note ?? ""}
            </p>
          )}
        </div>
      )}
      {error ? <div className="form-error">{error}</div> : null}
    </article>
  );
}
