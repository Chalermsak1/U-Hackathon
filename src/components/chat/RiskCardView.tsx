import { compact, pct, shortDate, usd } from "@/lib/format";
import type { AnswerMode, RecipientClass, RiskCard } from "@/lib/types";
import { LEVEL_COLOR, LevelBadge, SourceBadge } from "./bits";

const RECIPIENT: Record<RecipientClass, string> = {
  team: "Team",
  investor: "Investors",
  community: "Community",
  other: "Other",
  reserve: "Foundation reserve",
  ecosystem: "Ecosystem fund",
};

export function RiskCardView({ card, mode }: { card: RiskCard; mode: AnswerMode }) {
  const none = card.level === "none";
  return (
    <article className="risk-card" data-level={card.level} aria-label={`${card.symbol} unlock risk`}>
      <div className="risk-head">
        <div className="token">
          <span className="sym" aria-hidden="true">
            {card.symbol.slice(0, 4)}
          </span>
          <div style={{ minWidth: 0 }}>
            <strong>{card.name}</strong>
            <span>{card.headline}</span>
          </div>
        </div>
        <div className="score">
          <LevelBadge level={card.level} />
          {!none ? (
            <div>
              <b>{card.score}</b>
              <small>/100</small>
            </div>
          ) : null}
        </div>
      </div>

      {!none ? (
        <>
          <div className="meter" role="meter" aria-label="Unlock risk score" aria-valuenow={card.score} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.max(card.score, 3)}%`, background: LEVEL_COLOR[card.level] }} />
          </div>
          <dl className="stats">
            <div>
              <dt>{card.timing === "continuous" ? "Next 30 days" : "Amount"}</dt>
              <dd>
                {compact(card.amount, 2)} {card.symbol}
              </dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>~{usd(card.valueUsd)}</dd>
            </div>
            <div>
              <dt>Of circulating supply</dt>
              <dd>{pct(card.pctOfCirculating)}</dd>
            </div>
            <div>
              <dt>Days of trading volume</dt>
              <dd>{card.daysOfVolume === null ? "n/a" : card.daysOfVolume.toFixed(2)}</dd>
            </div>
          </dl>
          {card.breakdown.length ? (
            <div className="recipients" aria-label="Who receives the tokens">
              {card.breakdown.map((b) => (
                <span key={b.name} className="badge" title={b.name}>
                  {RECIPIENT[b.recipient]} {Math.round(b.share * 100)}%
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "beginner" ? (
        <p className="plain">{card.plain}</p>
      ) : (
        <ul className="reasons">
          {card.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {mode === "beginner" && card.nextUnlock ? (
        <p className="plain dim">
          Next unlock: {compact(card.nextUnlock.amount, 2)} {card.symbol} on {shortDate(card.nextUnlock.date)}.
        </p>
      ) : null}

      <div className="card-foot">
        <span className="row" style={{ gap: 6 }}>
          Tokenomist <SourceBadge source={card.source.mode} asOf={card.source.asOf} />
        </span>
        <span>U-Guard score v0.2 · computed in code</span>
      </div>
    </article>
  );
}
