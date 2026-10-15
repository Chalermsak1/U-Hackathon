import type { AgentResult } from "@/lib/types";
import { Icon } from "../Icon";

const KIND_LABEL: Record<string, string> = { guard: "guard", plan: "plan", tool: "tool", llm: "model", reflect: "check" };

/** The Agent Trace: every step the harness took, so judges and users can see the work. */
export function TraceView({ result }: { result: AgentResult }) {
  const tools = result.trace.filter((s) => s.kind === "tool").length;
  return (
    <details className="trace">
      <summary>
        <Icon name="spark" size={14} />
        How U-Guard checked this · {result.trace.length} steps · {tools} tool call{tools === 1 ? "" : "s"} · {result.ms} ms
      </summary>
      <ol>
        {result.trace.map((s, i) => (
          <li key={i}>
            <span className="kind">{KIND_LABEL[s.kind] ?? s.kind}</span>
            <span>
              <span className={`step-name${s.ok ? "" : " bad"}`}>
                {s.ok ? "" : "✗ "}
                {s.name}
              </span>
              <span className="step-sum">{s.summary}</span>
            </span>
            <span className="ms">{s.ms}ms</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
