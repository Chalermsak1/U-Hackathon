import type { LastRun } from "./useAgentChat";

/** Every tool the agent called for the last answer, with timings — the "is it really agentic?" proof. */
export function TracePanel({ last }: { last: LastRun | null }) {
  return (
    <section className="panel" aria-label="U-Guard agent trace">
      <div className="panel-head">
        <h2>U-Guard agent trace</h2>
        {last && <span className="pill">{last.engine}</span>}
        {last && <span className="total">{last.ms} ms</span>}
      </div>
      {last && last.trace.length > 0 ? (
        <ol className="trace">
          {last.trace.map((t, i) => (
            <li key={`${t.name}-${i}`} className={t.ok ? undefined : "fail"}>
              <span>
                <span className="tool">{t.name}</span>
                <br />
                <span className="sum">{t.summary}</span>
              </span>
              <span className="ms">{t.ms} ms</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">Ask something, then see how the agent plans and which tools it calls</p>
      )}
      {last?.note && (
        <p className="note" style={{ marginTop: 10 }}>
          {last.note}
        </p>
      )}
    </section>
  );
}
