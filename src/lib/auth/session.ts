// Stateless sessions: an HMAC-signed payload in an HttpOnly cookie. No database needed for
// the demo; swap for a session table (or Supabase Auth) to support server-side revocation.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "../config";

export const SESSION_COOKIE = "ug_session";
const NONCE_COOKIE = "ug_nonce";
const SESSION_TTL_SEC = 7 * 24 * 3600;
const NONCE_TTL_SEC = 10 * 60;

export interface Session {
  sub: string; // user id
  name: string;
  email?: string;
  address?: string;
  method: "demo" | "password" | "wallet";
  iat: number;
  exp: number;
}

let warned = false;
function secret(): Buffer {
  if (config.auth.secret) return Buffer.from(config.auth.secret);
  if (config.isProd) throw new Error("AUTH_SECRET must be set in production");
  if (!warned) {
    console.warn("[auth] AUTH_SECRET is not set; using an insecure development secret.");
    warned = true;
  }
  return Buffer.from("u-guard-development-only-secret-do-not-use-in-production");
}

function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function unsign<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    return value.exp > Date.now() / 1000 ? value : null;
  } catch {
    return null;
  }
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return unsign<Session>(jar.get(SESSION_COOKIE)?.value);
}

export async function startSession(user: Omit<Session, "iat" | "exp">): Promise<Session> {
  const iat = Math.floor(Date.now() / 1000);
  const session: Session = { ...user, iat, exp: iat + SESSION_TTL_SEC };
  (await cookies()).set(SESSION_COOKIE, sign(session), cookieOptions(SESSION_TTL_SEC));
  return session;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Sign-in-with-Ethereum nonce, kept in a short-lived signed cookie (no server state). */
export async function issueNonce(nonce: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + NONCE_TTL_SEC;
  (await cookies()).set(NONCE_COOKIE, sign({ nonce, exp }), cookieOptions(NONCE_TTL_SEC));
}

// Nonces already used, until they expire: deleting the cookie alone would not stop a
// replay of a captured cookie + signed message. (One process; use Redis when scaling out.)
const g = globalThis as typeof globalThis & { __uguardNonces?: Map<string, number> };
const usedNonces = (g.__uguardNonces ??= new Map());

export async function takeNonce(): Promise<string | null> {
  const jar = await cookies();
  const value = unsign<{ nonce: string; exp: number }>(jar.get(NONCE_COOKIE)?.value);
  jar.delete(NONCE_COOKIE);
  if (!value) return null;
  const nowSec = Date.now() / 1000;
  for (const [n, exp] of usedNonces) if (exp < nowSec) usedNonces.delete(n);
  if (usedNonces.has(value.nonce)) return null; // single use
  usedNonces.set(value.nonce, value.exp);
  return value.nonce;
}

export function publicUser(s: Session) {
  return { id: s.sub, name: s.name, email: s.email ?? null, address: s.address ?? null, method: s.method };
}
