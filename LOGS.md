# Development Log

บันทึกการพัฒนา U-Guard (เวลาไทย, UTC+7) · เวลาที่มี "~" เป็นค่าประมาณ
**Runtime log** ของ agent (ทุกคำถาม, tool ที่เรียก, การอนุมัติ, error) อยู่ที่ `logs/YYYY-MM-DD.jsonl` และดูได้ที่หน้า `/logs` ไฟล์เหล่านี้ไม่ถูก commit

---

## 2026-10-15 (พฤ.) วันแรกของ hackathon

### ~10:30–12:30 · วิจัยและวางแผน
- อ่านรายละเอียดงาน (Luma), เกณฑ์ตัดสิน 40/40/10/5/5 และ sponsor (Tokenomist, ElevenLabs, Avalanche)
- สรุปปัญหา: รายย่อยไม่รู้เรื่อง token unlock ตอนกำลังซื้อ ยืนยันด้วยข้อมูลปี 2026 (Tokenomist, Keyrock, ข่าว unlock เดือน ต.ค.)
- ศึกษา U-topia: แอปเปิดตัว 16 ต.ค., U-Bot สร้างบน Visa Intelligent Commerce, Topi AI, UCOIN, U.CENTER
- **การตัดสินใจ:** วางตำแหน่งเป็นข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน (ต้องมีใบอนุญาต ก.ล.ต.)
- เขียน PLAN.md, UI-PLAN.md, SPEC.md · ออกแบบ avatar และโลโก้
- **ปัญหา:** `npm install` ล้มเหลวเพราะ sandbox เขียน `~/.npm` ไม่ได้ → แก้ด้วย `npm_config_cache=$TMPDIR/npm-cache`
- **ปัญหา:** sandbox ห้ามสร้าง `.git` ในโฟลเดอร์ชั่วคราวของ session → ใช้ `GIT_DIR` แยก แล้ว push commit แรก `1f787ba` ขึ้น `main`

### ~13:05 · ย้ายมาทำใน repo จริง
- Clone `nathirad/U-Hackathon` ไปที่ `~/code/U-Hackathon` แล้วสร้าง branch **`feat/app-ui`**
- `tsc` ครั้งแรกพบ error 1 จุด (`source.mode` เป็น `string`) แก้แล้ว

### ~13:10 · ข้อมูล
- เปลี่ยนชุดเหรียญจาก SUI (ไม่ใช่ EVM) เป็น **ARB / WLD / AVAX / USDC**
- ARB ใช้ข้อมูลจริงจาก tokenomist.ai/arbitrum: unlock 92.65M (ทีม 56.13M + นักลงทุน 36.52M) วันที่ 16 ของทุกเดือนจนถึง มี.ค. 2027 · ราคา ~$0.178 · ระดมทุนรวม $123.7M (Series B valuation $1.2B)
- WLD / AVAX ยังเป็นข้อมูลตัวอย่างที่ติดป้ายไว้ จะแทนด้วย `npm run snapshot` เมื่อได้ key

### ~13:15 · Agent และ backend
- `offline.ts`: agent สำรองที่ไม่ใช้ LLM เรียก tools ชุดเดียวกับ Claude Agent Trace จึงเหมือนกัน
- `agent/index.ts`: สลับระหว่าง claude / offline / auto และบันทึก log ทุกครั้งที่รัน
- `log.ts`: บันทึกเป็น JSONL ใน `logs/` + หน้า `/logs`
- รองรับ Vercel AI Gateway (`AI_GATEWAY=vercel`) และปิด beta `fallbacks` เมื่อส่งผ่าน gateway
- API routes: `agent`, `scan`, `protect`, `voice`, `stt`, `portfolio`, `ticker`, `logs`, `ubot/webhook`, `ubot/inbox`
- U-Bot adapter: `mock` (inbox ภายใน) และ `webhook`

### ~13:20 · UI `/app`
- หน้าจอแอป U-topia (กระเป๋า + แชต U-Bot) · การ์ดความเสี่ยง · การ์ดข้อเสนอ · Agent Trace · Live Unlock Ticker · หน้า `/logs` · หน้า `/` ขั้นต่ำ
- ทำ UI review ทั้ง 3 ขนาดจอ แก้ 8 จุด (ดู [UI-REVIEW.md](UI-REVIEW.md)) จุดที่สำคัญที่สุดคือหน้ามือถือล้นแนวนอนและแชตไม่มีพื้นที่

### ~13:30 · ElevenLabs STT + PDF
- ปุ่ม **"พูด"**: อัดเสียงส่ง ElevenLabs Scribe (`/api/stt`) ถ้าไม่มี key ใช้ระบบรู้จำเสียง th-TH ของเบราว์เซอร์
- **รายงาน PDF:** ปุ่ม "สรุปเป็น PDF" เปิด `/report` (A4) แล้วให้เบราว์เซอร์บันทึกเป็น PDF ซึ่งเรียงภาษาไทยได้ถูกต้อง
- **ปัญหา:** รัน `next build` ระหว่างที่ dev server ทำงานอยู่ ทำให้ `.next` ถูกเขียนทับและ dev พัง → restart แล้ว · **ข้อควรระวัง:** อย่ารัน build ขณะ dev ทำงานอยู่

### ~13:40 · เอกสาร
- [ANALYSIS.md](ANALYSIS.md): โมเดล / VLM, เทียบกับ Nansen, กลุ่มผู้ใช้ 3 ระดับ, กฎหมาย, ช่องว่างของ U-topia, roadmap
- [UI-REVIEW.md](UI-REVIEW.md) และไฟล์นี้

### สถานะเมื่อจบรอบนี้
| ส่วน | สถานะ |
|---|---|
| typecheck / production build | ✅ ผ่าน |
| Flow ซื้อ → การ์ด → อนุมัติ (offline agent) | ✅ ทดสอบในเบราว์เซอร์แล้ว |
| Claude agent จริง | ⬜ ยังไม่ได้ทดสอบ (ไม่มี `ANTHROPIC_API_KEY`) |
| ElevenLabs TTS / STT จริง | ⬜ ยังไม่ได้ทดสอบ (ไม่มี key และไม่มีลำโพง/ไมค์ในเบราว์เซอร์ทดสอบ) |
| Avalanche Fuji tx จริง | ⬜ ยังไม่ได้ทดสอบ (ไม่มี `DEMO_PRIVATE_KEY`) ตอนนี้เป็นแบบ simulated |
| Tokenomist live / snapshot | ⬜ ต้องใช้ key |
| `/dashboard`, landing เต็ม, loader, auth | ⬜ ตาม SPEC §14 |

### ขั้นต่อไป
1. ใส่ key ใน `.env` → ทดสอบ Claude, ElevenLabs และ Fuji จริง → `npm run snapshot -- ARB WLD AVAX`
2. `/dashboard` (forecast) → landing ตาม UI-PLAN → loader
3. (ถ้ามีเวลา) tool ข่าวล่าสุดด้วย Claude web search
4. Supabase auth + DB (ถามก่อนสร้าง project)
5. ซ้อม demo 3 รอบ + อัดวิดีโอสำรอง

---

## วิธีเพิ่ม log ครั้งต่อไป
เพิ่มหัวข้อ `### HH:MM · เรื่อง` ใต้วันที่ แล้วบันทึกสิ่งที่ทำ, การตัดสินใจ และปัญหาที่เจอพร้อมวิธีแก้
