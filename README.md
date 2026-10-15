# U-Guard

**Know before your money moves.** (รู้ก่อน เงินจะขยับ)

U-Guard is an agent inside U-Bot that checks supply risk (token unlocks and emissions) before a U-topia user buys or holds a token. It also checks **news and events** and **what markets are pricing** (prediction markets, options). It explains the risk in three plain lines (Thai or English, with voice), and the user approves every protective action themselves. Approvals are recorded on Avalanche.

U-Hackathon 2026 · AI Track · FLOW Summit Bangkok

> Decision support only. Not investment advice. We don't predict price; we forecast supply.

## Documents

| File | What it covers |
|---|---|
| [SPEC.md](SPEC.md) | **Start here.** The whole system: features, architecture, workflows, agents, data model, API, status, decisions (Thai) |
| [DEMO.md](DEMO.md) | **Stage script:** 3-minute run of show (EN + TH lines), fallbacks, judge Q&A, pre-stage checklist |
| [DEMO-DAY-PLAN.md](DEMO-DAY-PLAN.md) | Step-by-step plan for demo day: keys, MCP demo, tests, rehearsal, risks, post-hackathon roadmap |
| [TODO.md](TODO.md) | **What is left:** not done, missing, or still waiting on keys/people, with priorities and a plan for demo day (Thai) |
| [STATUS.md](STATUS.md) | Latest status: every feature built, which flows work, what doesn't fit together yet, Trade/Invest direction, models, integrations, data pipeline (Thai) |
| [AGENTIC-WORKFLOW.md](AGENTIC-WORKFLOW.md) | Agentic AI design v2: what is new, models per job, LangGraph or not, RAG types, live data, alerts, portfolio drift |
| [PLAN.md](PLAN.md) | Problem and evidence, U-topia, timeline, demo script, judging criteria, forecast (Thai) |
| [UI-PLAN.md](UI-PLAN.md) | Pages, navigation, AI gateway, auth and DB, loading page, UI resources (Thai) |
| [ANALYSIS.md](ANALYSIS.md) | Models and VLMs, Nansen comparison, user segments, regulation, U-topia gaps, roadmap (Thai) |
| [UI-REVIEW.md](UI-REVIEW.md) | UI test results, fixes, what to show to whom, logo slots |
| [LOGS.md](LOGS.md) | Development log. The agent's runtime log is written to `logs/YYYY-MM-DD.jsonl` (not served as a page) |

## Pages

Two front-ends share one backend (agent, tools, data, auth).

**Main app** (the stage demo, English UI; the agent answers in Thai when asked in Thai). It signs the browser into the demo account automatically.

| Path | Purpose |
|---|---|
| `/` | Landing: loader, pill nav, GuardWatch hero, problem numbers, features, demo cards, how it works, FAQ |
| `/terminal` | Nansen-style web app in our own style: overview, U-Bot AI agent, token screener (25 tokens), token page with a 6-month supply forecast and a trade ticket, unlock calendar, portfolio, alerts with a U-Bot inbox |
| `/terminal/trade` | Trade: the user picks token, side and amount; U-Bot drafts the plan (size, stop-loss, what-if rows), U-Guard checks it, the user approves a paper order |
| `/terminal/invest` | Invest: five-question risk profile → adjustable model portfolio (sample data) → U-Guard checks the crypto part and DCA dates → approve |
| `/app` | Stage demo only (not in the menus): U-topia phone screen with U-Bot chat |
| `/report` | An A4 report to save as PDF |

**English app** (linked from the landing's `EN` button and the terminal sidebar).

| Path | Purpose |
|---|---|
| `/en` | Platform: problem, three signals, how it works, U-Bot/MCP integration, unlock radar, trust |
| `/login` | Demo account · email/password · wallet (Sign-In with Ethereum) |
| `/assistant` | U-Bot chat with the U-Guard skill: risk cards, news with citations, odds, approvals, agent trace, voice (sign-in required) |
| `/dashboard` | Holdings by unlock risk, supply forecast + dilution calculator, investor profit pressure, events, market intel (sign-in required) |
| `/method` | Score formula, data sources, agent architecture, MCP usage, compliance |

The floating **U-Bot** bubble on `/en`, `/method` and 404 pages answers visitors without signing in.

Not yet tested with real keys: Claude, ElevenLabs (TTS and STT), Fuji, Tokenomist. Alert rules and proposals live in memory.

## Run it

```bash
npm install
cp .env.example .env   # every key is optional; without keys the app uses sample data and fallbacks
npm run dev            # http://localhost:3000 (Thai landing) · /app · /terminal · /en
npm run snapshot -- ARB WLD AVAX   # pull real data from Tokenomist (needs TOKENOMIST_API_KEY)
```

Stage / production mode (never run `next build` while `next dev` is running):

```bash
npm run build
AUTH_SECRET=$(openssl rand -base64 32) npm start
```

Rehearse demo day today: `DEMO_NOW=2026-10-16T07:00:00Z npm run dev`. The ARB unlock is at 13:00 UTC (20:00 Bangkok), so at 07:00 UTC the card reads "unlocks today"; from 13:00 UTC it reads "just unlocked".

## How the agent works

`src/lib/agent/index.ts` is the harness: **guard → plan + act → reflect → observe**.

- **Model is pluggable**: Claude via the Anthropic SDK (the team's choice; optionally through the Vercel AI Gateway, `AI_GATEWAY=vercel`), any OpenAI-compatible model (`LLM_BASE_URL`), or the deterministic **rules engine** (the offline agent), which is also the automatic fallback. With `AGENT_PROVIDER=auto` the order is OpenAI-compatible (if `LLM_API_KEY` is set), then Claude, then rules; set `AGENT_PROVIDER=anthropic` to force Claude. `AGENT_MODE` (claude/offline/auto) still works as a legacy alias.
- **Language**: replies follow the user's language. Thai input gets Thai replies, card reasons and proposal text; English input gets English.
- **11 tools** (`src/lib/agent/tools.ts`), zod-validated, shared by every provider and by MCP.
- **RAG** for fresh facts (unlocks, news ranked by relevance + recency with citations, odds, pulse); **CAG** for static knowledge (`data/knowledge/faq.json`, preloaded into the cached system prompt).
- **Guardrails**: input guard (seed phrases/private keys blocked, PII redacted, injection flagged), rate limits, Origin checks, output compliance check (no buy/sell/hold advice or price predictions in EN/TH; every number must come from a tool result; one rewrite, then a checked template).
- **U-Bot reaches U-Guard three ways**, all through the same tools: the in-app chat, the webhook adapter (`/api/ubot/webhook` + `/api/ubot/inbox`, Bearer `UBOT_API_KEY`), and the **MCP server** at `/api/mcp` (Streamable HTTP, Bearer `MCP_API_KEY`). A caller with the key may act for a user (`X-UGuard-User`, optional `X-UGuard-Locale: th`): proposals it creates belong to that user and land in their U-Bot inbox (the bell), where they approve them. `npm run ubot` is a stand-in MCP client that plays U-Bot for the stage demo.
- **Watcher**: alert rules are checked on a timer (`WATCH_INTERVAL_MIN`, default 10) in `npm start`; on serverless hosts a cron calls `POST /api/watch` with `Bearer $CRON_SECRET`. Hits go to the U-Bot inbox (bell in the terminal header), with a 12-hour cooldown.
- **Trade and Invest plans**: every number is arithmetic on the user's own choices, the quote and the wallet, or a cited historical average; no model picks assets or predicts prices. Orders are paper orders; approvals are recorded on Avalanche Fuji (simulated without a key).
- **Run log**: every agent run is appended to `logs/YYYY-MM-DD.jsonl` (redacted text, tool trace, timings); `LOG_SILENT=true` turns it off.

## Checks

```bash
npm run typecheck
npm run eval          # 30 golden cases (EN + TH), offline and deterministic (sandboxed shells: node --import tsx evals/run.ts)
npm run ubot          # U-Bot stand-in: MCP client acting for demo-user (needs the server's MCP_API_KEY in .env)
npm run responsive    # 16 pages × iPhone SE/15 Pro/15 Pro Max/iPad/desktop: screenshots + layout audit
npm run responsive -- --webkit   # Safari engine (npx playwright install webkit once)
```

## Data

Offline data lives in `data/fixtures` and is labelled in the UI: **Snapshot** = real data captured on the date shown (ARB, WLD and AVAX unlocks, daily emission, allocations and funding from the Tokenomist API on 16 Oct; news, odds, pulse), **Sample** = illustrative (prices, demo wallet). `npm run snapshot -- ARB WLD AVAX` refreshes the Tokenomist fixtures (in a sandboxed shell, prefix `NODE_USE_ENV_PROXY=1` so Node's fetch uses the proxy).

The v5 unlock-events endpoint lists cliffs only. Continuous releases (WLD ~2.9M a day, AVAX staking rewards, the ARB DAO treasury) come from daily emission, which `getUnlockEvents` folds into one linear event (cliff days are skipped, so nothing is counted twice).

Stack: Next.js 15 · React 19 · TypeScript · plain CSS · zod · Claude (Anthropic SDK, default) or any OpenAI-compatible model · Tokenomist API · ElevenLabs · Avalanche (viem) · @modelcontextprotocol/sdk · Playwright (dev) · Supabase (post-hackathon).
