// Every external integration is optional: a missing key switches that piece to its
// labelled fallback, so the demo always runs end to end.

function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const config = {
  agent: {
    // auto = OpenAI-compatible LLM if LLM_API_KEY is set, else Anthropic if ANTHROPIC_API_KEY
    // is set, else the deterministic rules engine. Any LLM error falls back to rules.
    provider: env("AGENT_PROVIDER", "auto") as "auto" | "openai" | "anthropic" | "rules",
    maxTurns: 6,
  },
  // Any OpenAI-compatible Chat Completions endpoint: Gemini, OpenAI, Typhoon, Groq,
  // OpenRouter, Vercel AI Gateway, a local Ollama...
  llm: {
    baseUrl: env("LLM_BASE_URL").replace(/\/+$/, ""),
    apiKey: env("LLM_API_KEY"),
    model: env("LLM_MODEL"),
    label: env("LLM_LABEL", "LLM"),
    timeoutMs: Number(env("LLM_TIMEOUT_MS", "25000")),
  },
  anthropic: {
    apiKey: env("ANTHROPIC_API_KEY"),
    model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
    effort: env("AGENT_EFFORT", "low") as "low" | "medium" | "high",
  },
  tokenomist: {
    apiKey: env("TOKENOMIST_API_KEY"),
    baseUrl: env("TOKENOMIST_BASE_URL", "https://api.tokenomist.ai"),
  },
  market: {
    source: env("MARKET_SOURCE", "fixture") as "live" | "fixture",
  },
  intel: {
    news: env("NEWS_SOURCE", "fixture") as "live" | "fixture",
    odds: env("ODDS_SOURCE", "fixture") as "live" | "fixture",
  },
  elevenlabs: {
    apiKey: env("ELEVENLABS_API_KEY"),
    voiceId: env("ELEVENLABS_VOICE_ID"),
    modelId: env("ELEVENLABS_MODEL_ID", "eleven_v3"),
  },
  avalanche: {
    rpcUrl: env("AVALANCHE_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc"),
    walletAddress: env("WALLET_ADDRESS"),
    demoPrivateKey: env("DEMO_PRIVATE_KEY"),
  },
  ubot: {
    adapter: env("UBOT_ADAPTER", "mock") as "mock" | "webhook",
    webhookUrl: env("UBOT_WEBHOOK_URL"),
    apiKey: env("UBOT_API_KEY"),
  },
  auth: {
    secret: env("AUTH_SECRET"),
    demoLogin: env("DEMO_LOGIN", "true") !== "false",
    dataDir: env("DATA_DIR", "data/runtime"),
  },
  mcp: {
    apiKey: env("MCP_API_KEY"),
  },
  // Unlocks further out than this are outside the watch window (Keyrock: price pressure
  // typically starts ~30 days before an unlock).
  watchWindowDays: 30,
  // A cliff that already happened keeps counting for this long (pressure fades ~2 weeks after).
  postUnlockDays: 14,
  isProd: process.env.NODE_ENV === "production",
};

/**
 * Current time. DEMO_NOW (ISO date) freezes the clock, e.g. to rehearse tomorrow's demo
 * today: DEMO_NOW=2026-10-16T07:00:00Z
 */
export function now(): number {
  const fixed = env("DEMO_NOW");
  const t = fixed ? Date.parse(fixed) : NaN;
  return Number.isFinite(t) ? t : Date.now();
}
