# UI Review

Covers `/app`, `/report`, `/logs` (round 1), `/terminal/*` and `/` (round 2), what the site should show to whom, and the logo's motion spec.
A UI template from the team will replace much of the current styling. The findings on content, data honesty and information architecture still apply to it.

---

## Round 1 · `/app`, `/report`, `/logs`

> 15 Oct 2026, ~13:20–13:40, dev server · Screens: 800×600 (small), 1440×900 (projector / laptop), 375×812 (phone)
> Compared with [UI-PLAN.md](UI-PLAN.md) · Agent in offline mode (no API key yet)

### Works
- **Main flow is complete:** "ซื้อ ARB 5,000 บาท" → agent trace with 3 steps (`lookup_token` → `assess_unlock_risk` → `propose_protection`) → ARB card **high risk 67/100** → `pause_buying` proposal → approve → simulated receipt (labelled as needing `DEMO_PRIVATE_KEY`).
- **No alarm fatigue:** AVAX scores **low 8/100** because 100% goes to the ecosystem fund, so there is no proposal.
- The avatar ring takes the risk colour and spins while thinking.
- Fonts load: Geist, Geist Mono, IBM Plex Sans Thai. No console errors.
- `/logs` records every run and approval. `/report` renders Thai correctly as an A4 page with a disclaimer.

### Found and fixed
| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | Vertical wallet list squeezed the chat to ~40px | Cards hidden; the demo shows nothing | Horizontal token chips; tapping one asks U-Guard about it |
| 2 | Ticker said ARB "in 2 days" with ~30 hours left (rounded up) | Wrong number in front of judges | Shared `untilText()`: under 48 hours it shows hours |
| 3 | Fallback note in the trace was a long English error | Looks broken | Plain Thai note that Claude is unavailable and the offline agent answered |
| 4 | Cards sit inside a small phone; right side empty | Hard to read on a projector | **Latest result** spotlight panel on the right (hidden on phones) |
| 5 | "ฟังสรุป" button wrapped to 2 lines | Untidy | `.btn { white-space: nowrap }` |
| 6 | Ticker scrolled away | Key UI element lost | Sticky under the top bar |
| 7 | **Phone: horizontal overflow**, buttons cut off, top bar wrapped | Unusable on phones | `minmax(0,1fr)` grids, hide sub-brand and badges under 640px; page width = screen width (375 = 375) |
| 8 | Chips wrapped to 2 rows | Less room for chat | One horizontally scrolling row |

---

## Round 2 · `/terminal/*` and `/`

> 15 Oct 2026, ~14:00–14:30 · 1440×900 and 375×812 · offline agent

| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | Rotating hero word sometimes didn't paint | Hero headline looked half-empty | Animate a wrapper; keep the gradient text on an inner span (Chromium paint issue with `background-clip: text` + animation) |
| 2 | Hero word wrapped onto 2 lines on phones | Layout jumped every 2.6s | `white-space: nowrap`, smaller minimum heading size |
| 3 | KPI numbers as small as their labels | KPIs unreadable | `.kpi span` also matched CountUp's span → `.kpi > span` |
| 4 | **Token page said "no unlock data" when the request failed** | A server hiccup looked like a clean bill of health | Separate error state with a retry button |
| 5 | Phone menu wrapped into 3 rows (~300px) | Content pushed below the fold | One scrolling row that keeps the current page in view |
| 6 | Token page tables 9px wider than the phone | Horizontal scroll on the whole page | Scroll wrapper around each table |
| 7 | Unlock rows squeezed text into a narrow middle column | Hard to read | Under 560px the risk badge drops under the text |
| 8 | Hero orbit read as a copy of the reference site; two chips overlapped | Not our own style | Replaced with **U-Guard Watch** (below) |
| 9 | Hero scene froze where the browser never reported visibility | Hero stuck on one frame | Fallback start after 1.5s |

### U-Guard Watch (new hero)
The hero now shows the product working instead of decoration:
1. A 30-day unlock timeline slides toward a scan line next to the U-Guard mark. Bars are stacked by recipient in the same colours as the terminal's supply chart (team coral, investors amber, ecosystem teal). Grey bars are other unlocks on the calendar.
2. When an event reaches the line, the mark reacts in the risk colour, and a 3-line Thai explanation appears with a "speaking" indicator.
3. A high-risk proposal flips to "✓ คุณอนุมัติแล้ว · บันทึกบน Avalanche". AVAX shows "no proposal, no alarm fatigue".
4. ARB is real Tokenomist data from 15 Oct; WLD and AVAX are labelled as sample data in the footer.

Verified: loops ARB → WLD → AVAX with correct colours, no label overlap or clipping, fits a 375px screen, pauses off-screen, static under reduced motion.

---

## What to show to whom

The question was: why do run logs, the spec and the GitHub repo appear on the demo pages? They shouldn't. Each page should serve one of three audiences:

| Audience | Needs | Should see |
|---|---|---|
| U-topia user (retail, 20+) | Should I worry about this token? What do I do? | Risk card, 3 Thai lines, voice, proposal, approve, *their own* approval history with receipts |
| Judges on stage | Does it run? Is it practical? Is it agentic? Does it use U-Bot? | The live flow plus the **agent trace** next to each answer, which already proves the agent picked its own tools |
| Our team | Debugging, demo safety | Raw run logs, spec, repo |

**Run logs (`/logs`)**
- Built for us to debug and to prove execution. The agent trace beside each answer already proves execution to judges, and is easier to read.
- It is server-wide, not per user. In a real deployment it would show every user's questions and wallet data to anyone, which is a privacy leak.
- **Done:** removed from the terminal sidebar, the `/app` top bar (now links to Terminal) and the landing demo grid (now the unlock calendar card). `/logs` still works by URL for the team.
- **Next:** a per-user **Activity** page (my approvals + Avalanche receipts). That is the audit trail users actually want. Put raw logs behind a dev flag before any public deployment.

**Spec sheet and docs**
- SPEC, PLAN, ANALYSIS are internal working documents. The product never links to them.
- "How scores work" is different: it is user-facing transparency (factors, sources, limits, "not advice"). Keep it as an in-product explainer (currently `/#method`).

**GitHub button**
- The repo is public. It holds internal notes, including a gap analysis of the U-topia app and our mentor questions. Linking it from the landing page invites the host team and the DAO voters straight into that.
- A GitHub CTA next to "เข้าสู่ Terminal" splits attention and makes the product look like a prototype, at the moment the community votes.
- **Done:** removed from the landing CTA (replaced with "ลองบนแอปมือถือ").
- If the hackathon needs the repo link, put it in the submission form and the last pitch slide. Whether to make the repo private or move internal docs out before judging is the team's call.

---

## Logo motion (for the redesign)

The current files are `public/brand/logo-mark.svg` (with keyhole) and `public/brand/avatar.svg` (with face), 128×128 viewBox. The animated version is `src/components/GuardMark.tsx`. The chat avatar is `src/components/Avatar.tsx`.

**Motion language** (all CSS, `gm-*` classes in `globals.css`; switched off under reduced motion)
| Motion | When | What happens | Meaning |
|---|---|---|---|
| Draw-in | Loader, first view of the hero | Shield outline traces itself (1s) → fills → eyes open → smile draws (~1.7s total) | "Guard is on" |
| Blink | Idle | Eyes squash every ~5s | Alive, watching |
| Look | While checking | Face shifts up to 4 units toward the event or the pointer | Paying attention |
| React | Result arrives | Ring takes the risk colour + one ripple | The answer, at a glance |
| Shield up | High risk only | Shield lifts 5px with a small overshoot, once | Protecting you |
| Think | Agent working (chat avatar) | Ring turns dashed and spins | Working |

**To keep the motion working, the redesigned logo needs these as separate layers:**
1. Background tile (`gm-bg`)
2. Outer ring (`gm-ring`); it takes the risk colour, so keep it a stroke
3. Main shield shape as **one closed path** (`gm-fill`, reused for the `gm-outline` draw-in)
4. Eyes as two separate shapes (`gm-eye`) for blinking
5. Mouth as an open stroke path (`gm-smile`) for the draw-on

**Colour slots:** idle / low `#2DD4BF` · medium `#FBBF24` · high `#FB7151` · none `#94A3B8` · background `#0B1426`.

**Where the logo appears:** favicon (`layout.tsx`), `/app` and `/logs` top bar (28px), terminal sidebar (30px), `/report` header (44px), loader (72px), hero (104px, 64px on phones), chat avatar (`Avatar.tsx`, 32–84px). It must read at 28px, so keep the face simple.

**More ideas for the new mark**
- Keyhole turn: the keyhole in `logo-mark.svg` rotates 90° like a key when an unlock happens, then the shield closes over it.
- Supply level: while thinking, the shield fills from the bottom like a liquid gauge instead of a spinning ring.
- Voice sync: when ElevenLabs reads the summary, the mouth path scales with the audio level (Web Audio `AnalyserNode`).

---

## Still open
| Priority | Topic | Suggestion |
|---|---|---|
| High | Dark theme may wash out on the projector | Test on the real projector; if faint, add a high-contrast "Presentation mode" |
| High | Real voice (TTS / STT) not tested | The test browser has no speaker or mic; test by hand on the demo machine with an ElevenLabs key |
| Medium | Alerts are in memory | Store in the DB and deliver through the U-Bot inbox |
| Low | Next.js dev indicator (N) sits bottom-left | Not shown in a production build |

## Accessibility (first pass)
- All buttons are `<button>` with a teal `:focus-visible` ring.
- Chat uses `aria-live="polite"` · inputs have `<label>` (sr-only) · the mic button uses `aria-pressed`.
- The hero scene is one `role="img"` with a Thai text summary; its parts are hidden from screen readers.
- Respects `prefers-reduced-motion` (ticker, avatar, trace, mic, hero scene, logo).
- Contrast: secondary (#a9bacb) and muted (#74879c) text on #0e1626 pass AA for normal text.
- Not yet checked: keyboard-only through every flow, and a real screen reader.
