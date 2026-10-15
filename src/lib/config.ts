// Every external integration is optional: a missing key switches that piece to its
// labelled fallback, so the demo always runs end to end.

function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const config = {
  agent: {
    mode: env("AGENT_MODE", "auto") as "claude" | "offline" | "auto",
    model: env("ANTHROPIC_MODEL", "claude-opus-5-5"),
    effort: env("AGENT_EFFORT", "low") as "low" | "medium" | "high",
    maxTurns: 8,
  },
  // Optional: route Claude through Vercel AI Gateway (Anthropic Messages API compatible).
  gateway: {
    provider: env("AI_GATEWAY", "none") as "none" | "vercel",
    apiKey: env("AI_GATEWAY_API_KEY"),
    baseUrl: "https://ai-gateway.vercel.sh",
    // Gateway model ids look like "anthropic/<model>"; check the exact id in the gateway's model list.
    model: env("AI_GATEWAY_MODEL", "anthropic/claude-opus-5.5"),
  },
  // News search (search_news tool): a small Claude model with the web search server tool.
  // auto = web search when a Claude key is set, else the labelled news fixture.
  news: {
    source: env("NEWS_SOURCE", "auto") as "auto" | "web" | "fixture",
    model: env("NEWS_MODEL", "claude-haiku-5-5"),
    gatewayModel: env("NEWS_GATEWAY_MODEL", "anthropic/claude-haiku-5.5"),
    maxSearches: 3,
  },
  // Alert engine (/api/watch/run). Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
  watch: {
    cronSecret: env("CRON_SECRET"),
    userId: "demo-user",
    quietStartHour: 22, // Bangkok time; only high-severity alerts go out between these hours
    quietEndHour: 7,
    maxPerDay: 5,
  },
  tokenomist: {
    apiKey: env("TOKENOMIST_API_KEY"),
    baseUrl: env("TOKENOMIST_BASE_URL", "https://api.tokenomist.ai"),
  },
  market: {
    source: env("MARKET_SOURCE", "fixture") as "live" | "fixture",
  },
  elevenlabs: {
    apiKey: env("ELEVENLABS_API_KEY"),
    voiceId: env("ELEVENLABS_VOICE_ID"),
    modelId: env("ELEVENLABS_MODEL_ID", "eleven_v3"),
    sttModelId: env("ELEVENLABS_STT_MODEL_ID", "scribe_v1"),
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
  // Unlocks further out than this are "outside the watch window" (Keyrock: price
  // pressure typically starts ~30 days before an unlock).
  watchWindowDays: 30,
};
