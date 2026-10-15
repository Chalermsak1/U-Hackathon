# Development Log

U-Guard development log. Times are Bangkok time (UTC+7); a "~" means approximate.
The agent's **runtime log** (every question, tool call, approval and error) is written to `logs/YYYY-MM-DD.jsonl` and shown at `/logs`. Those files are not committed.

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

---

## Adding the next entry
Add a `### HH:MM · Topic` heading under the date, then record what was done, the decisions, and any problems with their fixes.
