import { LEVEL_LABEL, thb, usd } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";
import { LEVEL_COLOR } from "../chat/bits";

/** Portfolio value per holding; the bar colour is the unlock-risk status, always labelled. */
export function ExposureBars({
  rows,
}: {
  rows: { symbol: string; valueUsd: number; valueThb: number; level: RiskLevel | null; note: string | null }[];
}) {
  const max = Math.max(...rows.map((r) => r.valueUsd), 1);
  return (
    <div className="bars" role="list" aria-label="Portfolio value by holding">
      {rows.map((r) => (
        <div key={r.symbol} role="listitem" style={{ display: "grid", gap: 4 }}>
          <div className="spread" style={{ fontSize: 13 }}>
            <span>
              <b>{r.symbol}</b> <span className="dim">{thb(r.valueThb)}</span>
            </span>
            <span className="dim">{r.level ? `${LEVEL_LABEL[r.level]} unlock risk` : r.note}</span>
          </div>
          <div className="track" style={{ height: 10, borderRadius: 4, background: "rgba(148,170,210,0.1)" }}>
            <div
              style={{
                width: `${Math.max(2, (r.valueUsd / max) * 100)}%`,
                height: "100%",
                borderRadius: "0 4px 4px 0",
                background: r.level ? LEVEL_COLOR[r.level] : "var(--slate)",
              }}
              title={`${r.symbol}: ${usd(r.valueUsd)}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Investor profit multiple per token: today's price vs the latest priced round (one series). */
export function InvestorBars({
  rows,
}: {
  rows: { symbol: string; round: string | null; multiple: number | null; raisedUsd: number | null; source: string }[];
}) {
  const withData = rows.filter((r) => r.multiple !== null);
  const max = Math.max(...withData.map((r) => r.multiple ?? 0), 1);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.symbol} style={{ gridTemplateColumns: "minmax(0, 7em) minmax(0, 1fr) 4em" }}>
          <span className="label" title={`${r.round ?? ""} · ${r.source} data`}>
            <b style={{ color: "var(--text)" }}>{r.symbol}</b> {r.source === "sample" ? <span className="dim">sample</span> : r.round ? <span className="dim">{r.round}</span> : null}
          </span>
          <span className="track" aria-hidden="true">
            {r.multiple !== null ? <span className="fill" style={{ display: "block", width: `${Math.max(2, (r.multiple / max) * 100)}%` }} /> : null}
          </span>
          <span className="val">{r.multiple !== null ? `${r.multiple.toFixed(1)}x` : "n/a"}</span>
        </div>
      ))}
    </div>
  );
}
