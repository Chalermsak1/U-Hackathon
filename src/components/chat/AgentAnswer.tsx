"use client";

import type { AgentResult, AnswerMode } from "@/lib/types";
import { Icon } from "../Icon";
import { RichText } from "./bits";
import { Feedback } from "./Feedback";
import { CalendarCard, NewsCard, OddsCard, PulseCard } from "./IntelCards";
import { ProposalCardView } from "./ProposalCardView";
import { RiskCardView } from "./RiskCardView";
import { TraceView } from "./TraceView";
import { VoiceButton } from "./VoiceButton";

const COMPLIANCE_LABEL: Record<AgentResult["compliance"]["status"], string> = {
  pass: "Compliance check passed",
  fixed: "Compliance check passed (sample label added)",
  rewritten: "Rewritten to remove advice",
  replaced: "Replaced by the checked template",
};

export function AgentAnswer({ result, mode, compact = false }: { result: AgentResult; mode: AnswerMode; compact?: boolean }) {
  const engine =
    result.provider === "rules" ? "Rules engine" : `${result.provider === "anthropic" ? "Claude" : "LLM"}${result.model ? ` · ${result.model}` : ""}`;
  const today = result.now.slice(0, 10);
  return (
    <div className="body">
      <div className="bubble">
        <RichText text={result.reply} citations={result.citations} />
      </div>
      <div className="meta-row">
        <span className="row" style={{ gap: 4 }} title={result.compliance.issues.join("\n") || undefined}>
          <Icon name="shield" size={13} /> {COMPLIANCE_LABEL[result.compliance.status]}
        </span>
        <span aria-hidden="true">·</span>
        <span>{engine}</span>
        {result.note ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{result.note}</span>
          </>
        ) : null}
        <span style={{ marginLeft: "auto" }} className="row">
          <VoiceButton text={result.reply} />
          {!compact ? <Feedback requestId={result.requestId} /> : null}
        </span>
      </div>

      {result.cards.length ? (
        <div className={`cards-grid${result.cards.length > 1 && !compact ? " two" : ""}`}>
          {result.cards.map((c) => (
            <RiskCardView key={c.symbol} card={c} mode={mode} />
          ))}
        </div>
      ) : null}
      {result.proposals.map((p) => (
        <ProposalCardView key={p.id} proposal={p} />
      ))}
      <div className={`cards-grid${!compact ? " two" : ""}`}>
        {result.news ? <NewsCard news={result.news} citations={result.citations} /> : null}
        {result.odds ? <OddsCard odds={result.odds} /> : null}
        {result.pulse ? <PulseCard pulse={result.pulse} /> : null}
        {result.calendar ? <CalendarCard events={result.calendar} today={today} /> : null}
      </div>
      <TraceView result={result} />
    </div>
  );
}
