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
