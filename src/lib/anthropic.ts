// One Anthropic client for every model call (consultation agent, news search), direct
// or through Vercel AI Gateway.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

export const viaGateway = config.gateway.provider === "vercel";

/** True when some Claude credential is configured; otherwise callers use their fallback. */
export function claudeConfigured(): boolean {
  return viaGateway ? Boolean(config.gateway.apiKey) : Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  client ??= viaGateway
    ? new Anthropic({ apiKey: config.gateway.apiKey, baseURL: config.gateway.baseUrl, timeout: 60_000, maxRetries: 1 })
    : new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}
