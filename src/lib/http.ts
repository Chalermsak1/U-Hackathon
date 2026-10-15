// Small helpers shared by the route handlers: JSON errors, CSRF/origin checks, body
// limits, client IP and rate-limit responses.

import { createHash, timingSafeEqual } from "node:crypto";
import type { RateResult } from "./guard/rate-limit";
import type { Locale } from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, error: string, headers?: Record<string, string>): Response {
  return Response.json({ error }, { status, headers });
}

export function tooMany(r: RateResult): Response {
  return jsonError(429, "Too many requests. Please wait a moment and try again.", { "retry-after": String(r.retryAfterSec) });
}

/** First hop of x-forwarded-for, else x-real-ip. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Short stable hash, so logs and rate-limit keys never hold raw IPs. */
export function anonId(req: Request): string {
  return createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 12);
}

/** When the browser sends Origin, it must match our host (behind a proxy, x-forwarded-host). */
export function checkOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    const host = new URL(origin).host;
    const ours = [req.headers.get("host"), req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()].filter(Boolean);
    if (!ours.includes(host)) return jsonError(403, "Cross-site request blocked.");
  } catch {
    return jsonError(403, "Bad origin.");
  }
  return null;
}

/**
 * CSRF defence for cookie-authenticated POSTs: the body must be JSON (a cross-site form
 * cannot send that without a CORS preflight), and when the browser sends Origin it must
 * match our host. `allowEmptyBody` lets a body-less POST through (it carries no form data;
 * the Origin check and the SameSite=lax cookie still apply).
 */
export function checkPost(req: Request, opts: { allowEmptyBody?: boolean } = {}): Response | null {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const type = req.headers.get("content-type") ?? "";
  const empty = !type && (req.headers.get("content-length") ?? "0") === "0";
  if (opts.allowEmptyBody && empty) return null;
  if (!type.includes("application/json")) return jsonError(415, "Send JSON.");
  return null;
}

/** Constant-time check of `Authorization: Bearer <key>`. */
export function bearerMatches(req: Request, key: string): boolean {
  const got = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(key);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Language for card copy in GET responses: `?lang=en` or `?lang=th`, else the fallback.
// The Thai app's pages read these routes, so their fallback is Thai.
export function langOf(req: Request, fallback: Locale = "th"): Locale {
  const lang = new URL(req.url).searchParams.get("lang");
  return lang === "en" || lang === "th" ? lang : fallback;
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 16_384): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large.");
  try {
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as T;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof HttpError) return jsonError(err.status, err.message);
  console.error(err);
  return jsonError(500, "Something went wrong. Please try again.");
}
