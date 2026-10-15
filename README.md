# U-Guard

**Know before your money moves.** · *รู้ก่อน เงินจะขยับ*

U-Guard is the pre-trade safety skill inside U-Bot (U-topia's assistant). Before you buy, it checks
**scheduled token unlocks** (Tokenomist), **news and events**, and **what markets are pricing**
(prediction markets, options), explains it in plain words (Beginner/Pro, read aloud by ElevenLabs),
and lets you approve every protection rule (receipt on Avalanche).

U-Hackathon 2026 · AI Track · FLOW Summit Bangkok. Information, not investment advice.

## Run it

```bash
npm install
cp .env.example .env          # every key is optional
npm run dev                   # http://localhost:3000  (add `-- -p 3101` for another port)
```

Stage / production mode:

```bash
npm run build
AUTH_SECRET=$(openssl rand -base64 32) npm start
```

Sign in with **Continue with the demo account**, or email + password, or a browser wallet
(Sign-In with Ethereum). The floating **U-Bot** bubble answers visitors without signing in.

Rehearse tomorrow's view today: `DEMO_NOW=2026-10-16T07:00:00Z npm run dev`.

## Pages

| Path | What |
|---|---|
| `/` | Platform: problem, three signals, how it works, U-Bot/MCP integration, unlock radar, trust |
| `/login` | Demo account · email/password · wallet (SIWE) |
| `/app` | U-Bot chat with the U-Guard skill: risk cards, news with citations, odds, approvals, agent trace, voice |
| `/dashboard` | Holdings by unlock risk, supply forecast + dilution calculator, investor profit pressure, events, market intel |
| `/method` | Score formula, data sources, agent architecture, MCP usage, compliance |

## How the agent works

`src/lib/agent/index.ts` is the harness: **guard → plan + act → reflect → observe**.

- **Model is pluggable** (`AGENT_PROVIDER`): any OpenAI-compatible model (Gemini, OpenAI, Typhoon, Groq,
  OpenRouter, Vercel AI Gateway, Ollama), Claude via the Anthropic SDK, or the deterministic **rules
  engine**, which is also the automatic fallback.
- **11 tools** (`src/lib/agent/tools.ts`), zod-validated, shared by every provider and by MCP.
- **RAG** for fresh facts (unlocks, news ranked by relevance + recency with citations, odds, pulse);
  **CAG** for static knowledge (`data/knowledge/faq.json`, preloaded into the cached system prompt).
- **Guardrails**: input guard (seed phrases/private keys blocked, PII redacted, injection flagged),
  rate limits, output compliance check (no buy/sell/hold advice or price predictions in EN/TH; every
  number must come from a tool result; one rewrite, then a checked template).
- **MCP server** at `/api/mcp` (Streamable HTTP) so U-Bot can call the same tools.

## Checks

```bash
npm run typecheck
npm run eval          # 26 golden cases, offline and deterministic
npm run responsive    # iPhone SE/15 Pro/15 Pro Max/iPad/desktop screenshots + layout audit
npm run responsive -- --webkit   # Safari engine (npx playwright install webkit once)
```

## Data

Offline data lives in `data/fixtures` and is labelled in the UI: **Snapshot** = real data captured on
the date shown (ARB unlocks, news, odds, pulse), **Sample** = illustrative (WLD/AVAX supply, demo
wallet). `npm run snapshot -- ARB WLD AVAX` replaces Tokenomist fixtures with live data.

## Docs

[SPEC.md](SPEC.md) (system spec, Thai) · [PLAN.md](PLAN.md) (problem, pitch, timeline) · [UI-PLAN.md](UI-PLAN.md) (UI notes)

Stack: Next.js 15 · React 19 · TypeScript · plain CSS · zod · viem · @modelcontextprotocol/sdk · Playwright (dev).
