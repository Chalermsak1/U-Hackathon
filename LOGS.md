# Development Log

U-Guard development log. Times are Bangkok time (UTC+7); a "~" means approximate.
The agent's **runtime log** (every question with PII redacted, tool call, approval and error) is written to `logs/YYYY-MM-DD.jsonl`. Those files are not committed, and there is no `/logs` page (it was never committed; see UI-REVIEW, "What to show to whom").

---

## 2026-10-15 (Thu) · Hackathon day 1

### ~10:30–12:30 · Research and planning
- Read the event brief (Luma), the judging weights 40/40/10/5/5 and the sponsors (Tokenomist, ElevenLabs, Avalanche).
- Problem: retail buyers don't know about token unlocks at the moment they buy. Confirmed with 2026 data (Tokenomist, Keyrock, October unlock news).
- U-topia: app launches Oct 16, U-Bot is built on Visa Intelligent Commerce, plus Topi AI, UCOIN and U.CENTER.
- **Decision:** position the product as decision support, not investment advice (advice needs a Thai SEC licence).
- Wrote PLAN.md, UI-PLAN.md and SPEC.md. Designed the avatar and logo.
- **Problem:** `npm install` failed because the sandbox can't write `~/.npm` → fixed with `npm_config_cache=$TMPDIR/npm-cache`.
- **Problem:** the sandbox blocks creating `.git` in the session's scratch folder → used a separate `GIT_DIR`, then pushed the first commit `1f787ba` to `main`.

### ~13:05 · Moved into the real repo
- Cloned `nathirad/U-Hackathon` to `~/code/U-Hackathon` and created branch **`feat/app-ui`**.
- First `tsc` run found one error (`source.mode` typed as `string`); fixed.

### ~13:10 · Data
- Switched the token set from SUI (not EVM) to **ARB / WLD / AVAX / USDC**.
- ARB uses real data from tokenomist.ai/arbitrum: a 92.65M unlock (team 56.13M + investors 36.52M) on the 16th of every month until Mar 2027 · price ~$0.178 · $123.7M raised in total (Series B at a $1.2B valuation).
- WLD and AVAX are labelled sample data until `npm run snapshot` runs with a key.

### ~13:15 · Agent and backend
- `offline.ts`: a fallback agent with no LLM that calls the same tools as Claude, so the agent trace looks the same.
- `agent/index.ts`: switches between claude / offline / auto and logs every run.
- `log.ts`: JSONL in `logs/` plus the `/logs` page.
- Supports Vercel AI Gateway (`AI_GATEWAY=vercel`) and turns off the `fallbacks` beta when routed through the gateway.
- API routes: `agent`, `scan`, `protect`, `voice`, `stt`, `portfolio`, `ticker`, `logs`, `ubot/webhook`, `ubot/inbox`.
- U-Bot adapter: `mock` (internal inbox) and `webhook`.

### ~13:20 · `/app` UI
- U-topia phone screen (wallet + U-Bot chat) · risk card · proposal card · agent trace · live unlock ticker · `/logs` · a minimal `/`.
- UI review at three screen sizes, 8 fixes (see [UI-REVIEW.md](UI-REVIEW.md)). The most important: horizontal overflow on mobile and no room left for the chat.

### ~13:30 · ElevenLabs STT + PDF
- **Speak** button: records audio and sends it to ElevenLabs Scribe (`/api/stt`). Without a key it uses the browser's th-TH speech recognition.
- **PDF report:** the "Summarise as PDF" button opens `/report` (A4) and the browser saves it as PDF, which shapes Thai text correctly.
- **Problem:** running `next build` while the dev server was running overwrote `.next` and broke dev → restarted. **Rule:** never build while dev is running.

### ~13:40 · Documents
- [ANALYSIS.md](ANALYSIS.md): models and VLMs, Nansen comparison, three user segments, regulation, U-topia gaps, roadmap.
- [UI-REVIEW.md](UI-REVIEW.md) and this file.

### ~13:50 · U-Guard Terminal (`/terminal`), Nansen-style in our own style
- **Why:** the user wanted a web app like app.nansen.ai, restyled as our own.
- **Decision:** Nansen's core is Smart Money, which is its own labelled-wallet data. We use **supply and unlock data** instead, because it is the one market variable that is scheduled in advance and that we can actually get from Tokenomist.
- **New pages:**
  - Overview: AI ask box with typed examples, KPIs, upcoming unlocks, lowest-float tokens.
  - Tokens: a 25-token screener, sortable, with a Float < 50% filter.
  - Token page: KPIs, risk card, 6-month supply chart by recipient, allocations, funding rounds.
  - Unlock calendar, portfolio (6-month dilution and PDF), alerts, AI agent (`?q=`).
- **Sidebar:** collapse with ⌘B, search with ⌘K (a ticker opens its token page; anything else goes to the AI agent).
- **New APIs:** `/api/screener`, `/api/calendar`, `/api/token/{symbol}`, `/api/portfolio/risk`, `/api/alerts`.
- **New lib files:**
  - `forecast.ts` (monthly supply + dilution)
  - `recipient.ts` (shared by server and client)
- **New data:**
  - `screener.json`: 25 real rows from the Tokenomist fundraising screener.
  - `unlock-calendar.json`: market events, each with a source URL.

### ~14:00 · New landing page (`/`)
- Only the **layout and interactions** follow areazeroai.com, as the user asked. All content, data and branding are U-Guard's own.
- **Parts:**
  - First-visit loader and a pill nav that highlights the current section.
  - Hero with a rotating word, an orbit around the avatar, and a marquee.
  - Count-up numbers, features 01–04, demo cards that link to real pages, the agent's 6 steps.
  - FAQ, CTA and a back-to-top button with a progress ring.
- **Effects** (`src/components/fx.tsx`): CountUp, typewriter, pointer spotlight, reveal on scroll, growing bar chart. All of them switch off when the user prefers reduced motion.
- **Removed the duplicate `u-guard/` folder** (copied in when the session moved; identical to commit `1f787ba`).

### ~14:05 · Browser testing and fixes (details in [UI-REVIEW.md](UI-REVIEW.md), round 2)
- The rotating hero word sometimes didn't paint, because the gradient text and the animation were on the same element → split into two layers.
- KPI numbers were as small as their labels, because `.kpi span` also matched CountUp's span → changed to `.kpi > span`.
- **The token page said "no data" when loading failed** → separate error state with a retry button, so a server hiccup never looks like a clean bill of health.
- **Mobile:**
  - The menu wrapped into 3 rows (~300px) → one horizontally scrolling row that keeps the current page in view.
  - Token page tables overflowed by 9px → wrapped them in a scroll container.
  - Unlock rows now put the risk badge under the text.
- Checked: every `/terminal` page and `/` fit a 375px screen · adding an alert rule works · the FAQ opens and closes · typecheck passes.

### ~14:10 · Direction change: agentic workflow first, UI template later
- The team will supply a UI template later. Docs are now written in English (README, LOGS, UI-REVIEW, AGENTIC-WORKFLOW; SPEC, PLAN, UI-PLAN, ANALYSIS are still Thai).
- Wrote [AGENTIC-WORKFLOW.md](AGENTIC-WORKFLOW.md): what is new in v2, models per job, LangGraph or not, RAG types, live market data, alerts and portfolio drift, and an ordered build plan.
- **Decision:** no LangChain / LangGraph for the hackathon; numbers come from tools, not vector RAG; GraphRAG-lite in Postgres for investor links.

### ~14:20 · Hero in our own style + logo motion
- The orbit read as a copy of the reference site, and two of its chips overlapped. Replaced it with **U-Guard Watch** (`GuardWatch.tsx`): a 30-day unlock timeline slides into a scan line, the mark reacts in the risk colour, 3 Thai lines appear, and the proposal is approved.
- New animated mark `GuardMark.tsx`: draw-in, blink, look, risk-colour ripple, "shield up" on high risk. Motion spec and the layers a redesigned logo must keep are in [UI-REVIEW.md](UI-REVIEW.md). The loader uses the draw-in.
- **Problem:** the hero froze in a background browser tab because IntersectionObserver never fired → start after 1.5s if no callback arrives.
- Removed run logs, the GitHub button and the old Run Logs card from user-facing pages (reasons in UI-REVIEW, "What to show to whom"). `/logs` still works by URL.
- Sent the current logo SVGs to the user for the redesign.

### Status at the end of this round
| Area | Status |
|---|---|
| typecheck | ✅ passes (no production build this round, because the dev server is running) |
| Buy → card → approve flow (offline agent) | ✅ tested in the browser |
| All `/terminal` pages + landing `/` | ✅ tested at 1440px and 375px |
| Real Claude agent | ⬜ not tested (no `ANTHROPIC_API_KEY`) |
| Real ElevenLabs TTS / STT | ⬜ not tested (no key, and the test browser has no speaker or mic) |
| Real Avalanche Fuji tx | ⬜ not tested (no `DEMO_PRIVATE_KEY`); simulated for now |
| Tokenomist live / snapshot | ⬜ needs a key (screener and calendar are copied from the website on Oct 15) |
| Alerts | ⚠️ stored in memory, lost on restart · not sent to Telegram / LINE yet |
| Auth + DB | ⬜ plan only (Supabase; ask before creating a project) |

### Next
1. Put keys in `.env` → test Claude, ElevenLabs and Fuji for real → `npm run snapshot -- ARB WLD AVAX`.
2. Build the v2 agent pieces in the order given in [AGENTIC-WORKFLOW.md](AGENTIC-WORKFLOW.md) §10.
3. Stop dev and run `npm run build` to confirm the production build.
4. Supabase auth + DB (ask before creating the project).
5. Rehearse the demo 3 times and record a backup video (test on the real projector).

### 16:22 · English web app and model-agnostic agent (branch `feat/agentic-web-english`, commit `2339b8c`)
Built in a separate session without seeing `feat/app-ui`.
- **Pages:** `/` platform page, `/login`, `/app` chat, `/dashboard`, `/method`, a floating U-Bot bubble and a 404 page.
- **Agent harness:** guard → plan + act → reflect → observe. The model is pluggable: any OpenAI-compatible model, Claude, or a deterministic rules engine that is also the automatic fallback.
- **11 tools.** The new ones are `get_market_news` (GDELT, with [n] citations), `get_event_odds` (Polymarket), `get_market_pulse` (CoinGecko, Fear & Greed, Deribit DVOL) and `get_event_calendar`.
- **RAG and CAG:** fresh facts come through tools; static knowledge (`data/knowledge/faq.json`) sits in the cached system prompt.
- **Guardrails:** an input guard (blocks seed phrases and private keys, redacts PII, flags injection), rate limits, Origin checks, a compliance check in EN and TH, and security headers.
- **Auth:** demo account, email and password (scrypt with lockout), and Sign-In with Ethereum. MCP server at `/api/mcp`.
- **Checks:** `npm run eval` (26 cases) and `npm run responsive` (Playwright: iPhone SE, 15 Pro, 15 Pro Max, iPad, desktop).

### 17:03 · CSS-only restyle (commit `78ecb6d`)
- Inter font, cleaner surfaces and light glass on the English pages. No layout changes.

### Oct 16, ~00:50 · Merged both branches (branch `feat/merge-app-ui-agentic`, commit `f1898d9`)
- **Rule:** don't break either side.
- **Two front-ends, one backend:**
  - The owner's Thai app is unchanged at `/`, `/app`, `/terminal/**` and `/report`.
  - The English app moved to `/en` and `/assistant`; `/dashboard`, `/login` and `/method` keep their paths.
- **Cross-links:** an EN button on the landing page, an English group in the terminal sidebar, and a ไทย link on the English pages.
- **Thai app sign-in:** `EnsureSession` signs the Thai app into the demo account, so approve and scan still work without a login wall.
- **CSS isolation:** the English stylesheet is scoped under `.ug-web`, and the owner's rules on 37 shared class names are guarded, so neither side can restyle the other.
- **Backend:** the owner's Vercel AI Gateway path, `AGENT_MODE` alias, `pause_turn` handling, JSONL run log, U-Bot webhook and inbox, alerts and ElevenLabs STT were ported into the harness.
- **Replies follow the user's language.** Thai pages get Thai card reasons (`?lang=en` for English).
- **Data:** follows the owner's tokenomist.ai copy (ARB unlock 16 Oct 13:00 UTC = 20:00 Bangkok), plus the ETH wallet row and the news/odds/pulse fixtures.
- **Problem:** the merged Thai token page showed English reasons → passed the Thai locale in `/api/token`, `/api/calendar` and `/api/portfolio/risk`.
- **Problem:** the 14px inputs zoomed on iOS → 16px on touch devices. The EN link pushed the CTA off a 320px screen → hidden at ≤380px, with a footer link instead.
- **Checked:** typecheck ✅ · production build ✅ · eval 28/28 ✅ · responsive 60/60 ✅ · every page and API, end to end.
- **Blocked:**
  - Pushing to `main` was refused by the session's permission rules → open a PR and merge it.
  - The Vercel connector is read-only, so the app is not hosted yet.
  - The session's network blocks `api.tokenomist.ai`, so the Tokenomist key is not used yet.

### Oct 16, ~01:00 · Analysis: Trade and Invest pages like Nansen, status review
- The user wants Trade and Invest pages covering crypto, stocks and funds, with an AI that plans, measures risk and proposes trades, and a human approving each one.
- Wrote [STATUS.md](STATUS.md) (Thai):
  - every feature built so far, and which flows work
  - 10 places where the product doesn't flow or contradicts itself
  - the Nansen comparison and the proposed page structure
  - models per job with prices, and integrations ranked by value
  - the pre-processing pipeline for annual reports and world trends
  - Tokenomist key status, and the decisions needed
- **Open decisions:**
  - Scope for today's demo: crypto real (simulated/testnet), stocks and funds as labelled sample data.
  - How the AI phrases things: drafts plans and scenarios that the user approves, or direct buy/sell advice (a licensing risk with the Thai SEC).
  - Whether the Thai terminal becomes the single app.

### Oct 16, ~01:50 · Trade, Invest, alerts that fire, logos
- **Trade:** `/terminal/trade` plus a trade ticket on every token page, laid out like Nansen's Token God Mode.
  - The user picks the token, side and amount.
  - U-Bot drafts the plan: size against a risk budget, stop-loss, and what-if rows.
  - U-Guard checks unlock, balance, size, concentration and chasing.
  - Approval places a paper order recorded on Avalanche (simulated).
- **Invest:** `/terminal/invest`.
  - A five-question risk profile picks a model portfolio, which the user can adjust.
  - U-Guard checks the crypto part and flags DCA dates that land on a big unlock.
  - Sample data, clearly labelled.
- **Alerts actually fire:**
  - "Check now" runs each rule deterministically with a 12h cooldown.
  - A watcher (`src/instrumentation.ts`) checks every rule every `WATCH_INTERVAL_MIN` minutes; `POST /api/watch` is there for crons.
  - Hits land in the U-Bot inbox, a bell in the terminal header.
- **Phone mock-up:** at the user's request, `/app` left the terminal and landing menus; it stays reachable by URL for the stage.
- **Data labels:**
  - The ARB allocation and funding fixtures are real tokenomist.ai copies, now marked snapshot.
  - The header and token page label each section from its own source.
- **"Data and technology" strip:** logos only.
  - U-topia uses the team's own logo file unchanged; only the white area outside the circle is transparent (`public/brand/utopia-logo.png`).
  - Tokenomist stays a wordmark until we have its logo file.
- **Checked:** typecheck ✅ · build ✅ · eval 28/28 ✅ · responsive 80/80 ✅ · trade/invest/alert/watcher flows in the browser and API.

---

## Adding the next entry
Add a `### HH:MM · Topic` heading under the date, then record what was done, the decisions, and any problems with their fixes.
