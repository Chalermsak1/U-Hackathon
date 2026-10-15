import { asOfTh, isStale } from "@/lib/freshness";
import type { LastRun } from "./useAgentChat";

const MODE_LABEL = { claude: "Claude", offline: "Offline agent", watch: "Watcher" } as const;

/** Every tool the agent called for the last answer, with timings — the "is it really agentic?" proof. */
export function TracePanel({ last }: { last: LastRun | null }) {
  return (
    <section className="panel" aria-label="Agent Trace">
      <div className="panel-head">
        <h2>Agent Trace</h2>
        {last && <span className="pill">{MODE_LABEL[last.mode as keyof typeof MODE_LABEL] ?? last.mode}</span>}
        {last && <span className="total">{last.ms} ms</span>}
      </div>
      {last && last.trace.length > 0 ? (
        <ol className="trace">
          {last.trace.map((t, i) => (
            <li key={`${t.tool}-${i}`} className={t.ok ? undefined : "fail"}>
              <span>
                <span className="tool">{t.tool}</span>
                <br />
                <span className="sum">{t.summary}</span>
                {t.fresh && t.fresh.length > 0 && (
                  <span className="trace-fresh">
                    {t.fresh.map((f) => (
                      <span key={f.provider} className={isStale(f) ? "stale" : undefined} title={f.note}>
                        {f.provider} {asOfTh(f.asOf)}
                        {f.mode === "sample" ? " · ตัวอย่าง" : ""}
                        {isStale(f) ? " · อาจไม่ล่าสุด" : ""}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="ms">{t.ms} ms</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">ถามอะไรสักอย่าง แล้วดูว่า agent วางแผนและเรียก tool อะไรบ้าง</p>
      )}
      {last?.note && (
        <p className="note" style={{ marginTop: 10 }}>
          {last.note}
        </p>
      )}
    </section>
  );
}
