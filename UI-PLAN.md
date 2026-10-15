# U-Guard Platform Website: แผน UI/UX

> ใช้ zero.ai และ areazeroai.com เป็น**แรงบันดาลใจด้านโครงสร้างและการวางระบบเท่านั้น** เนื้อหา, ชื่อ, สี, โลโก้, ภาพ และ animation ทั้งหมดของ U-Guard ต้องออกแบบเอง

---

## 1. วิเคราะห์เว็บต้นแบบ (หยิบเฉพาะ "รูปแบบ")

| | zero.ai | areazeroai.com |
|---|---|---|
| แนวทาง | Manifesto / storytelling เรียบมาก | เว็บบริษัท/แพลตฟอร์มที่เน้นหลักฐาน |
| โครง | 8 section สูงเต็มจอ (100vh): Hero → Manifesto → 4 แนวคิด (section ละ 1 แนวคิด สีเต็มจอ) → Market (การ์ดมีเลขกำกับ) → Contact | Hero → Partners → About + Stats → Services (01–04) → Portfolio (การ์ด + tag) → Research → Team → Achievements → FAQ → Contact |
| Nav | fixed · โปร่งใสตอนอยู่บนสุด แล้วกลายเป็น glass gradient เมื่อเลื่อน · ลิงก์ตัวพิมพ์ใหญ่ฟอนต์ mono เว้นระยะตัวอักษรกว้าง สีจาง · anchor ไปแต่ละ section | แคปซูล pill ที่ไฮไลต์ section ปัจจุบัน (scrollspy) · ปุ่ม CTA ใน nav · ปุ่มกลับขึ้นบน |
| Typography | Geist + Geist Mono · หัวเรื่องใหญ่มาก (~195px) ไล่สีม่วง · letter-spacing ติดลบ | หัวเรื่องหนา ไล่สี teal→blue · chip เล็กๆ เหนือหัวเรื่อง |
| ลูกเล่น | particle sphere, ข้อความโผล่ทีละบรรทัดเมื่อเลื่อน, การเปลี่ยนสีพื้นทั้ง section | หน้าโหลด "Initializing AI Systems…", node วงโคจรรอบแกนกลาง, โลโก้พาร์ตเนอร์วิ่ง (marquee), ตัวเลขนับขึ้น |

**สิ่งที่ U-Guard จะหยิบมาใช้ (ในแบบของเราเอง):**
- จาก zero.ai: **เล่าเรื่องทีละ section** และ**แต่ละ section มีแค่ 1 แนวคิด** ข้อความน้อย พื้นที่ว่างเยอะ
- จาก areazero: **ส่วนพิสูจน์** (ตัวเลข, demo สด, แหล่งข้อมูล) และ nav แบบมี scrollspy
- **สูตรของเรา:** Story (ทำไม) → Product สด (ทำอะไร) → Proof (เชื่อได้เพราะ)

**สิ่งที่ห้ามทำ:** ห้ามใช้คำว่า "ZERO", ห้ามใช้ wordmark ไล่สีม่วงแบบเดียวกัน, ห้ามใช้ภาพหรือ particle sphere ชุดเดิม และห้ามคัดลอกข้อความ

---

## 2. Identity ของ U-Guard (คิดเอง)

- **แนวคิดภาพ:** "ปลดล็อก" คือเหรียญที่ไหลออกจากกุญแจเข้าสู่ตลาด และ "Guard" คือเส้นขอบที่กันผู้ใช้ไว้ก่อนเงินขยับ
- **Signature visual:** **Unlock Timeline** แสดงเหรียญเป็นจุดที่ถูกปล่อยตามวันจริงบนเส้นเวลา จุดที่เสี่ยงสูงเรืองแสงสีส้มแดง ใช้ข้อมูลจริงจาก Tokenomist
- **สี:** พื้น navy เกือบดำ · สีหลักคือ **teal/cyan สื่อ "ปลอดภัย"** · สีความเสี่ยงคือ amber (กลาง) และ coral-red (สูง) ซึ่ง**มีความหมายในตัว ไม่ใช่แค่ตกแต่ง**
- **ฟอนต์:** Geist / Geist Mono (ภาษาอังกฤษ, ตัวเลข) + **IBM Plex Sans Thai** หรือ Noto Sans Thai (ภาษาไทย)
- **Tagline:** "รู้ก่อน เงินจะขยับ" / *Know before your money moves.*

---

## 3. แยก Platform กับ Application หรือไม่

**ตัดสินใจ: อยู่ในโปรเจกต์ Next.js เดียวกัน แยกกันที่ route** (`/` = Platform, `/app` = Application) ไม่แยกเป็น 2 โปรเจกต์

| ทางเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **โปรเจกต์เดียว แยก route** ★ | ใช้ component ร่วมกัน (การ์ดความเสี่ยง, แชต, กราฟ) · design system ชุดเดียว · deploy และให้ลิงก์กรรมการได้ลิงก์เดียว · ปุ่ม "Launch demo" ไป `/app` ได้ทันที | หน้า landing ต้องไม่ทำให้ app โหลดช้า (แยก bundle ตาม route ได้อยู่แล้ว) |
| 2 โปรเจกต์แยกกัน | ทีม frontend 2 คนทำงานไม่ชนกัน | สร้างและดูแลซ้ำ 2 ชุด · สไตล์เพี้ยนกัน · deploy 2 ที่ · ไม่คุ้มกับเวลาที่เหลือราว 9 ชั่วโมง |
| มีแค่ Application | เร็วที่สุด ตรงกับ Execution 40% | ไม่มีส่วนเล่าเรื่องสำหรับการโหวตของชุมชน DAO |
| มีแค่ Platform | สวยและเล่าเรื่องได้ดี | **ไม่มีของที่ทำงานจริง จะเสียคะแนน Execution 40%** |

**ลำดับความสำคัญ:** `/app` ต้องมีแน่นอน → `/dashboard` → `/` (landing) → `/method`
ถ้าเวลาไม่พอ landing ให้เหลือ Hero + Manifesto + ปุ่ม "Launch demo" ก็พอ

**Flow บนเวที:** เปิด `/` เล่าเรื่อง 30 วินาที (Pitch mode) → กด "Launch demo" → `/app` demo สด → ปิดท้ายด้วย `/dashboard`

**วิธีแบ่งงานโดยไม่ชนกัน (โปรเจกต์เดียว):** คน A ทำ `app/(platform)/*` และคน B ทำ `app/(app)/*` ใช้ `components/shared/*` ร่วมกัน และตกลง design token ใน `globals.css` ให้เสร็จก่อนเริ่ม

## 4. Sitemap

```
/            Landing (story + product + proof)
/app         Demo: หน้าจอแอป U-topia + แชต U-Bot + Agent Trace   ← จุดเก็บคะแนน Execution
/dashboard   Supply Forecast Dashboard                           ← ต่อยอดจากต้นแบบในแชต
/method      วิธีคิดคะแนน + แหล่งข้อมูล + ข้อจำกัด (สำหรับกรรมการ)
```

## 5. โครงหน้า Landing (เนื้อหาของเราเอง)

| # | Section | เนื้อหา | ลูกเล่น |
|---|---|---|---|
| 0 | Loader (ไม่บังคับ) | "Scanning unlock calendar…" + จำนวน unlock ใน 30 วันนับขึ้น | ตัวเลขนับขึ้น ≤1.2 วินาที |
| 1 | **Hero** | Wordmark U-GUARD + tagline + ปุ่ม "ลองถาม U-Bot" / "ดู Dashboard" | Unlock Timeline แบบเคลื่อนไหว (ข้อมูลจริง) |
| 2 | **Manifesto** | 4 บรรทัดที่โผล่ทีละบรรทัด: "เหรียญถูกปลดล็อกตามตารางที่ประกาศล่วงหน้า / ข้อมูลมีอยู่จริง / แต่รายย่อยรู้เป็นคนสุดท้าย / U-Guard ทำให้คุณรู้ก่อน" | ข้อความ reveal ตามการเลื่อน |
| 3 | **Numbers** | $97.43B ปลดล็อกในปี 2025 · 90% กดราคา (Keyrock) · เริ่มกดราคา ~30 วันก่อน · ARB float 59.52% | ตัวเลขนับขึ้น + อ้างอิงแหล่ง |
| 4–6 | **3 Pillars** (section ละ 1 แนวคิด, เปลี่ยนสีพื้น) | **RIGHT MOMENT** (เช็กก่อนซื้อ) · **RIGHT MEANING** (ภาษาไทย 3 บรรทัด + เสียง) · **YOU DECIDE** (อนุมัติแล้วบันทึกบน Avalanche) | แต่ละอันมี mini-demo เช่น การ์ดความเสี่ยงที่ flip ได้ หรือปุ่มฟังเสียง |
| 7 | **Live Demo** | หน้าจอโทรศัพท์ (U-topia) + แชต U-Bot ที่ลองพิมพ์ได้จริง | chip คำถามสำเร็จรูป, การ์ดค่อยๆ ปรากฏ |
| 8 | **Forecast** | ต้นแบบ dashboard: supply ล่วงหน้า, % ต่อ market cap, ตัวคำนวณ dilution | slider ปรับค่าได้ |
| 9 | **How it works** | Perceive → Plan → Act → Score → Explain → Approve + "Powered by" Tokenomist · ElevenLabs · Avalanche · U-Bot | แผนภาพที่ไฮไลต์ทีละขั้นตามการเลื่อน |
| 10 | **Trust** | "เราไม่ทายราคา เรา forecast supply" · ไม่ใช่คำแนะนำการลงทุน · แหล่งข้อมูลพร้อมวันที่ | ข้อมูลพับเก็บได้ |
| 11 | CTA + footer | "เริ่มใช้กับ U-Bot" · ทีม · ลิงก์ GitHub | — |

> **ถ้าเวลาไม่พอ** ให้ตัดเหลือ 1, 2, 4–6 (รวมเป็น section เดียว), 7 และ 9 แล้วเอาเวลาไปทำ `/app` ก่อน เพราะ UX มีน้ำหนักแค่ 10% แต่ Execution มี 40%

## 6. ลูกเล่นของ Navigation Bar

| ลูกเล่น | รายละเอียด | ความยาก |
|---|---|---|
| **Glass on scroll** | โปร่งใสตอนอยู่บนสุด แล้ว blur + เงาเมื่อเลื่อนเกิน 40px | ง่าย |
| **Scrollspy pill** | แคปซูลไฮไลต์ที่เลื่อนตาม section ปัจจุบันแบบลื่น (Motion `layoutId`) | ง่าย |
| **Scroll progress** | เส้นบางใต้ nav เปลี่ยนสี teal→amber→coral ตามความคืบหน้า | ง่าย |
| **Live Unlock Ticker** ★ | แถบวิ่งใต้ nav แสดง unlock จริงที่กำลังจะมา เช่น "ARB 92.6M · 16 ต.ค. · ทีม+นักลงทุน" กดแล้วเปิดการ์ดความเสี่ยง | กลาง (**จุดเด่นที่เป็นของเราเอง**) |
| **⌘K "ถาม U-Guard…"** | command palette (cmdk) พิมพ์ชื่อเหรียญหรือคำถามแล้วส่งเข้าแชตทันที | กลาง |
| **Risk pulse dot** | จุดกะพริบบอก "วันนี้มี unlock ใหญ่ N รายการ" | ง่าย |
| Hide on scroll down / show on scroll up | ประหยัดพื้นที่บนมือถือ | ง่าย |
| TH / EN toggle | สลับภาษา pitch ไทย/อังกฤษ | กลาง |
| **Pitch mode (ปุ่ม P)** | ฟอนต์ใหญ่ขึ้น กดลูกศรแล้วเลื่อนไปทีละ section เหมาะกับใช้บนเวที | ง่าย |
| Mobile drawer | เมนูแบบ bottom sheet (Vaul) | ง่าย |
| Back-to-top + progress ring | ปุ่มลอยมุมขวาล่าง | ง่าย |

**แนะนำให้ทำ:** Glass + Scrollspy pill + **Live Unlock Ticker** + ⌘K + Pitch mode

---

## 7. AI Gateway: จะเรียกโมเดลจากไหน

| ตัวเลือก | วิธีต่อกับโค้ดปัจจุบัน (Anthropic SDK) | ข้อดี | ข้อควรระวัง |
|---|---|---|---|
| **Anthropic API ตรง** (ทำไว้แล้ว) | ไม่ต้องแก้อะไร | ง่ายสุด ใช้ฟีเจอร์ได้ครบ (server-side fallback, effort) | key เดียว ไม่มี dashboard ค่าใช้จ่ายรวม |
| **Vercel AI Gateway** ★ | เปลี่ยน `baseURL` เป็น `https://ai-gateway.vercel.sh` ใช้ `AI_GATEWAY_API_KEY` และชื่อโมเดลแบบ `anthropic/<model>` | key เดียวได้หลายผู้ให้บริการ · ดู log/ค่าใช้จ่าย · ตั้งงบประมาณ · fallback ข้ามผู้ให้บริการ · ถ้า deploy บน Vercel ใช้ OIDC แทน key ได้ | ต้องตรวจชื่อ model id ของ Opus 5.5 บน gateway · beta header (เช่น `fallbacks`) อาจไม่ถูกส่งต่อ ต้องปิดได้ผ่าน config |
| Cloudflare AI Gateway | ใช้ endpoint ของผู้ให้บริการ Anthropic ผ่าน Cloudflare | caching / rate limit / log ใช้ฟรี | ต้องตั้ง account และ gateway เพิ่ม |
| OpenRouter | API แบบ OpenAI-compatible | มีโมเดลเยอะ | ไม่เข้ากับ Anthropic SDK ที่ใช้อยู่ ต้องแก้โค้ด |

**แนะนำ:**
- **demo ใช้ Anthropic API ตรงไปก่อน** (ความเสี่ยงต่ำสุด)
- เพิ่ม config `AI_GATEWAY=vercel` ให้สลับไปใช้ Vercel AI Gateway ได้ ข้อนี้ช่วยเล่าเรื่อง production readiness (ตั้งงบ, ดู log, fallback) โดยแก้แค่ env
- ElevenLabs เรียกตรงต่อไป เพราะเป็น sponsor

## 8. ตรวจสัดส่วนคะแนน

**เกณฑ์กรรมการ (จากรูปสไลด์ที่ถ่ายมา)**
- App execution 40% + Practicality 40% + Usability & design 10% + Innovation & ecosystem 5% + U-Bot integration 5% = **100% ✅ ถูกต้อง**
- หน้า Luma ไม่ได้ระบุตัวเลขไว้ จึงยึดตามสไลด์
- กรรมการเลือกไว้ 6 ทีม แล้ว**รางวัลใหญ่ตัดสินด้วยการโหวตสดของ U-Center DAO** แปลว่าหน้าเว็บและ pitch ต้องโน้มน้าว**ชุมชน**ด้วย ไม่ใช่แค่กรรมการ

**น้ำหนักของ Risk Score (สิ่งที่เราตั้งเอง)**
- สูตร: (0.35 × ขนาด + 0.30 × สภาพคล่อง + 0.35 × ประเภทผู้รับ) × ตัวคูณเวลา + โบนัสกำไรนักลงทุน
- อ้างอิงจาก Keyrock แต่**ยังไม่ได้ validate**
- **ควรปรับ:** งานวิจัย Tokenomist ปี 2026 บอกว่าผลกระทบกระจุกในเหรียญ **float บาง** แต่สูตรตอนนี้ยังไม่มีปัจจัย float → เพิ่ม `float factor` (เช่น float < 30% ให้คะแนนเพิ่ม)
- **บนเวที:** เรียกว่า "v0 heuristic" อย่างตรงไปตรงมาในหน้า `/method` และถ้ามีเวลาให้ backtest กับ unlock ARB รายเดือนย้อนหลัง

---

## 9. Resource สำหรับ UI/UX

| ใช้ทำอะไร | Resource |
|---|---|
| Component พื้นฐาน | **shadcn/ui** (ui.shadcn.com) บน Radix + Tailwind |
| Component ที่มี animation | **Magic UI** (magicui.design: marquee, number ticker, shimmer button, border beam) · **Aceternity UI** (ui.aceternity.com: floating navbar, spotlight, background beams) · **React Bits** (reactbits.dev: text animation, background) |
| Motion | **Motion** (motion.dev: layout animation, scroll-linked) · **GSAP + ScrollTrigger** (gsap.com: scroll storytelling) · **Lenis** (smooth scroll) |
| UX ย่อย | **cmdk** (⌘K palette) · **Sonner** (toast) · **Vaul** (drawer บนมือถือ) |
| กราฟ / dashboard | **Recharts** หรือ **Tremor** · Chart.js |
| Icon / ฟอนต์ | Lucide / Tabler icons · Geist (vercel.com/font) · IBM Plex Sans Thai (Google Fonts) |
| 3D / particle (ถ้ามีเวลา) | react-three-fiber · tsParticles · Spline |
| หาไอเดีย | Mobbin (UI แอปจริง) · Dribbble/Behance คำว่า "fintech dashboard dark" |

## 10. Skill ในเครื่องที่ช่วยได้ (เรียงตามลำดับการใช้)

| ขั้น | Skill | ใช้ทำอะไร |
|---|---|---|
| 1. ตั้ง design system | `design-consultation` | เสนอ type / color / spacing / motion ทั้งชุด พร้อม preview ฟอนต์และสี |
| | `agentic-bundle-web-designer:ui-ux-pro-max` | คลัง pattern UI/UX, palette, คู่ฟอนต์ |
| 2. สำรวจหน้าตา hero | `design-shotgun` | สร้างหลายเวอร์ชันมาเทียบกันบน board แล้วเลือก |
| 3. ลงมือสร้าง | `frontend-design:frontend-design` | กำหนดทิศทางดีไซน์ไม่ให้ดูเป็น template |
| | `agentic-bundle-aas-web-app-builder:shadcn` · `tailwind-patterns` · `nextjs-best-practices` | ตั้ง component และ pattern ของ Next.js |
| | `agentic-bundle-aas-product-design-studio:scroll-experience` · `high-end-visual-design` | ทำ scroll storytelling แบบ section เต็มจอ |
| | `onewave:motion-language-designer` · `onewave:css-animation-creator` | ระบบ motion และ micro-interaction |
| | `onewave:claude-landing-composer` | จัดเรียง section ของ landing |
| 4. Dashboard | `dataviz` | สีกราฟ, stat tile, legend ที่อ่านง่ายทั้ง light/dark |
| 5. ตรวจก่อน demo | `design-review` · `qa` / `webapp-testing` · `agentic-bundle-aas-accessibility-inclusive-ux:ui-a11y` | QA ภาพ, ทดสอบ responsive, ตรวจ accessibility |

**ชุดขั้นต่ำที่แนะนำ:** `design-consultation` → `frontend-design` + `shadcn` + `scroll-experience` → `dataviz` → `design-review`

## 11. Stack ที่จะเพิ่ม
Tailwind v4 · shadcn/ui · Motion · Lenis · cmdk · Recharts · Geist + IBM Plex Sans Thai

## 12. ลำดับงาน UI (ภายในเวลาที่เหลือ)
1. `/app` (หน้าจอแอป + แชต + การ์ด + Agent Trace) **ต้องเสร็จก่อน**
2. Nav (glass + scrollspy + ticker) + Hero + Manifesto
3. 3 Pillars + Live Demo (นำคอมโพเนนต์จาก `/app` มาใช้ซ้ำ)
4. `/dashboard` (ย้ายจากต้นแบบในแชต)
5. How it works + Trust + `/method`
6. Pitch mode + ตรวจ responsive

---

## 13. Avatar และ Brand assets (สร้างแล้ว)
- `public/brand/logo-mark.svg`: shield รูปตัว **U** ที่ล้อมรูกุญแจสีเหลืองอำพันไว้ สื่อว่า "เฝ้าการปลดล็อก"
- `public/brand/avatar.svg`: ตัวละคร U-Guard ใช้ shield รูป U เดียวกัน มีตาสองข้างที่กะพริบได้และรอยยิ้ม
- **ลูกเล่น:** สีกรอบของ avatar ในแชตเปลี่ยนตามระดับความเสี่ยงของคำตอบ teal = ปลอดภัย · amber = ปานกลาง · coral = สูง · กรอบเส้นประหมุน = กำลังคิด
- Palette: `#0B1426` (navy) · `#2DD4BF` / `#5EEAD4` (teal) · `#FBBF24` (amber) · `#FB7151` (coral)

## 14. Authentication + Database

**ต้องมี DB หรือไม่: ต้องมี** ระบบ login ต้องเก็บผู้ใช้ และตอนนี้ proposal กับ inbox อยู่ใน memory (`src/lib/store.ts`) ซึ่งหายทุกครั้งที่ restart

**ตัวเลือก**
| ตัวเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **Supabase (Auth + Postgres)** ★ | ได้ทั้ง login และ DB ในที่เดียว · email OTP / Google · **Sign in with Web3 (Ethereum/EVM wallet) ตรงกับแนวคิด self-custody ของ U-topia** · มี Row Level Security · มี Supabase MCP ในเครื่องช่วยสร้างตารางได้ | ต้องสร้าง project (free tier) |
| Clerk + DB แยก | ตั้งค่า login เร็วมาก | มี 2 vendor ต้องต่อ DB เอง |
| Auth.js + Postgres | ยืดหยุ่น | ต้องตั้งค่าเองเยอะ ใช้เวลานาน |

**วิธี login ที่แนะนำ**
1. **Connect wallet** (Core / MetaMask ผ่าน SIWE) เป็นวิธีหลัก ตรงกับกระเป๋า self-custody และยังใช้ address เดียวกันอ่านยอดบน Avalanche ได้
2. **Email OTP** สำหรับผู้ใช้ทั่วไป
3. **"เข้าโหมด demo"** ล็อกอินบัญชี demo ที่เตรียมไว้ในปุ่มเดียว **สำคัญมากบนเวที** จะได้ไม่ต้องพิมพ์รหัสหรือรอ OTP ต่อหน้ากรรมการ

**Schema (Postgres + RLS: ผู้ใช้เห็นเฉพาะข้อมูลของตัวเอง `auth.uid() = user_id`)**
```
profiles             id (= auth.users.id) · display_name · locale · created_at
wallets              id · user_id · chain · address · label
watchlist            user_id · symbol · created_at
risk_checks          id · user_id · symbol · level · score · unlock_date · payload jsonb · data_source · created_at
proposals            id · user_id · symbol · action · risk_level · unlock_date · status · created_at · decided_at
protection_receipts  id · proposal_id · chain · mode · tx_hash · memo · created_at
alerts               id · user_id · symbol · channel (ubot|telegram) · active
chat_messages        id · user_id · role · text · created_at          (ไม่บังคับ)
```

**กติกาความปลอดภัย:** ห้ามเก็บ private key หรือ seed phrase ในทุกกรณี · API key ทั้งหมดอยู่ฝั่ง server · เปิด RLS ทุกตาราง · `DEMO_PRIVATE_KEY` ใช้กับ Fuji testnet เท่านั้น

**ขอบเขตบนเวที:** Auth ไม่มีคะแนนแยก แต่ช่วยเรื่อง Practicality (ใช้ได้จริง ข้อมูลไม่หาย) ใช้เวลาราว 1–1.5 ชั่วโมง ควรทำ**หลังจาก** `/app` ทำงานได้แล้ว

## 15. หน้า Loading ก่อนเข้าเว็บ
- **แสดงเฉพาะตอนเข้า `/` ครั้งแรกของ session** (จำด้วย sessionStorage) **ไม่เกิน ~1.5 วินาที**
- **ไม่ใช้ progress bar ปลอม:** ซ่อนเมื่อโหลดข้อมูล ticker จริงเสร็จ หรือครบ 1.5 วินาที แล้วแต่อย่างไหนถึงก่อน
- **เนื้อหา:**
  - avatar ประกอบตัว: เส้น shield วาดขึ้น → ตากะพริบ → กรอบเปลี่ยนเป็นสี teal
  - ข้อความ "กำลังสแกนปฏิทินปลดล็อก…"
  - ตัวนับ "พบ N unlock ใน 30 วัน" จากข้อมูลจริง
- ถ้าผู้ใช้ตั้ง `prefers-reduced-motion` ให้แสดงโลโก้นิ่งๆ แล้วเข้าเว็บทันที
- **ระหว่างหน้า:** `loading.tsx` แบบ skeleton ใน `/app` และ `/dashboard`
- **ตอน agent ทำงาน:** กรอบ avatar หมุน และขั้นตอนใน Agent Trace ขึ้นทีละบรรทัด
