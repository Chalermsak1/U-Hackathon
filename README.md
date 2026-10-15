# U-Guard

**Know before your money moves.** (รู้ก่อน เงินจะขยับ)

U-Guard is an agent inside U-Bot that checks supply risk (token unlocks and emissions) before a U-topia user buys or holds a token. It explains the risk in three lines of Thai with voice, and the user approves every protective action themselves. Approvals are recorded on Avalanche.

U-Hackathon 2026 · AI Track · FLOW Summit Bangkok

> Decision support only. Not investment advice.

## Documents

| File | What it covers |
|---|---|
| [SPEC.md](SPEC.md) | **Start here.** The whole system: features, architecture, workflows, agents, data model, API, status (Thai) |
| [AGENTIC-WORKFLOW.md](AGENTIC-WORKFLOW.md) | Agentic AI design v2: what is new, models per job, LangGraph or not, RAG types, live data, alerts, portfolio drift |
| [PLAN.md](PLAN.md) | Problem and evidence, U-topia, timeline, demo script, judging criteria, forecast (Thai) |
| [UI-PLAN.md](UI-PLAN.md) | Pages, navigation, AI gateway, auth and DB, loading page, UI resources (Thai) |
| [ANALYSIS.md](ANALYSIS.md) | Models and VLMs, Nansen comparison, user segments, regulation, U-topia gaps, roadmap (Thai) |
| [UI-REVIEW.md](UI-REVIEW.md) | UI test results, fixes, what to show to whom, logo slots |
| [LOGS.md](LOGS.md) | Development log (the agent's runtime log is at `/logs`) |

## Pages

| Path | Purpose |
|---|---|
| `/` | Landing: loader, pill nav, hero with orbit, problem numbers, features, demo cards, how it works, FAQ |
| `/terminal` | Nansen-style web app in our own style: overview, AI agent, token screener (25 tokens), token page with a 6-month supply forecast, unlock calendar, portfolio, alerts |
| `/app` | U-topia phone screen with U-Bot chat: risk cards, approval with an Avalanche receipt, agent trace, voice in and out, PDF summary |
| `/logs` · `/report` | Agent run log, and an A4 report to save as PDF |

Not yet tested with real keys (Claude, ElevenLabs, Fuji, Tokenomist). Alert rules live in memory. No sign-in yet. See [LOGS.md](LOGS.md).

## Run it

```bash
npm install
cp .env.example .env   # every key is optional; without keys the app uses sample data and fallbacks
npm run dev            # http://localhost:3000 (landing) · /terminal · /app
npm run snapshot -- ARB WLD AVAX   # pull real data from Tokenomist (needs TOKENOMIST_API_KEY)
```

## Stack

Next.js 15 · TypeScript · Claude (Anthropic SDK) · Tokenomist API · ElevenLabs · Avalanche (viem) · Supabase (planned)
