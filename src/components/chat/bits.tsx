import { Fragment, type ReactNode } from "react";
import { LEVEL_LABEL, longDate, shortDate } from "@/lib/format";
import type { Citation, DataSource, RiskLevel } from "@/lib/types";

const SOURCE_LABEL: Record<DataSource, string> = { live: "Live", snapshot: "Snapshot", sample: "Sample" };

export function LevelBadge({ level, prefix }: { level: RiskLevel; prefix?: string }) {
  return (
    <span className="badge badge-level" data-level={level}>
      <span className="dot" aria-hidden="true" />
      {prefix ? `${prefix} ` : ""}
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function SourceBadge({ source, asOf }: { source: DataSource; asOf?: string }) {
  const when = asOf && source !== "live" ? ` · ${source === "snapshot" ? longDate(asOf) : shortDate(asOf)}` : "";
  return (
    <span
      className="badge badge-source"
      data-source={source}
      title={source === "sample" ? "Illustrative demo data" : source === "snapshot" ? "Real data captured on this date" : "Fetched just now"}
    >
      <span className="dot" aria-hidden="true" />
      {SOURCE_LABEL[source]}
      {when}
    </span>
  );
}

/** Renders **bold** and [n] citation markers (linked to their source). */
export function RichText({ text, citations = [] }: { text: string; citations?: Citation[] }) {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) parts.push(<strong key={i++}>{m[1]}</strong>);
    else {
      const c = citations.find((x) => x.n === Number(m![2]));
      parts.push(
        c ? (
          <a key={i++} className="cite" href={c.url} target="_blank" rel="noopener noreferrer" title={`${c.source}: ${c.title}`}>
            {c.n}
          </a>
        ) : (
          <span key={i++} className="cite">
            {m[2]}
          </span>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  high: "var(--level-high)",
  medium: "var(--level-medium)",
  low: "var(--level-low)",
  none: "var(--level-none)",
};
