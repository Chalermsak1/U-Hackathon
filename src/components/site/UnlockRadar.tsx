import { shortDate } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { Icon } from "../Icon";

const DAY = 86_400_000;

/** Scheduled events as a list, with a compact 45-day strip on top (dots by date). */
export function UnlockRadar({ events, today, days = 45 }: { events: CalendarEvent[]; today: string; days?: number }) {
  const start = Date.parse(today);
  const pos = (d: string) => Math.min(100, Math.max(0, ((Date.parse(d) - start) / (days * DAY)) * 100));
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="card-title">
        <h3 className="row" style={{ gap: 8 }}>
          <Icon name="calendar" /> Unlock radar
        </h3>
        <span className="dim" style={{ fontSize: 13 }}>
          Next {days} days · scheduled, not predicted
        </span>
      </div>
      <div style={{ position: "relative", height: 46, margin: "4px 6px 14px" }} aria-hidden="true">
        <div style={{ position: "absolute", left: 0, right: 0, top: 9, height: 1, background: "var(--grid)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 27, height: 1, background: "var(--grid)" }} />
        <span style={{ position: "absolute", left: 0, top: 32, fontSize: 11, color: "var(--text-3)" }}>Today</span>
        <span style={{ position: "absolute", right: 0, top: 32, fontSize: 11, color: "var(--text-3)" }}>+{days}d</span>
        {events.map((e) => (
          <span
            key={e.date + e.title}
            title={`${shortDate(e.date)}: ${e.title}`}
            style={{
              position: "absolute",
              left: `calc(${pos(e.date)}% - 5px)`,
              top: e.kind === "macro" ? 4 : 22,
              width: 10,
              height: 10,
              borderRadius: e.kind === "macro" ? 2 : 999,
              transform: e.kind === "macro" ? "rotate(45deg)" : undefined,
              background: e.kind === "macro" ? "var(--text-2)" : "var(--series-1)",
              boxShadow: "0 0 0 2px var(--surface)",
            }}
          />
        ))}
      </div>
      <ul className="radar-list">
        {events.map((e) => {
          const d = new Date(e.date);
          return (
            <li key={e.date + e.title}>
              <span className="date-pill">
                <small>{e.date === today ? "Today" : d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</small>
                <b>{d.getUTCDate()}</b>
              </span>
              <span className="what">
                <strong>{e.title}</strong>
                <span>
                  {e.kind === "macro" ? "Macro event" : "Token unlock"} ·{" "}
                  <a href={e.source.url} target="_blank" rel="noopener noreferrer">
                    {e.source.name}
                  </a>
                </span>
              </span>
              <span className="badge">{e.kind === "macro" ? "Macro" : "Unlock"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
