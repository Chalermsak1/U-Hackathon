# U-Guard

**รู้ก่อน เงินจะขยับ** · *Know before your money moves.*

U-Guard คือ agent ใน U-Bot ที่เช็กความเสี่ยงจาก supply (token unlock / emission) ก่อนที่ผู้ใช้ U-topia จะซื้อหรือถือเหรียญ อธิบายเป็นภาษาไทย 3 บรรทัดพร้อมเสียง และผู้ใช้เป็นคนอนุมัติเองทุกครั้ง (บันทึกการอนุมัติบน Avalanche)

U-Hackathon 2026 · AI Track · Flow Summit Bangkok

> ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| [SPEC.md](SPEC.md) | **เริ่มอ่านที่นี่** ระบบทั้งหมด: features, architecture, workflows, agents, data model, API, สถานะ |
| [PLAN.md](PLAN.md) | ปัญหาและหลักฐาน, U-topia, timeline, demo script, เกณฑ์ตัดสิน, forecast |
| [UI-PLAN.md](UI-PLAN.md) | หน้าเว็บ, navigation, AI Gateway, auth + DB, หน้า loading, resource UI |
| [ANALYSIS.md](ANALYSIS.md) | โมเดล AI / VLM, เทียบกับ Nansen, กลุ่มผู้ใช้, กฎหมาย, ช่องว่างของ U-topia, roadmap |
| [UI-REVIEW.md](UI-REVIEW.md) | ผลตรวจ UI 3 ขนาดจอ, สิ่งที่แก้แล้ว, สิ่งที่ยังเหลือ |
| [LOGS.md](LOGS.md) | บันทึกการพัฒนา (runtime log ของ agent ดูที่ `/logs`) |

## สถานะ

ใช้งานได้แล้ว: `/app` (แชต U-Bot, การ์ดความเสี่ยง, อนุมัติ → บันทึก Avalanche, Agent Trace, Live Unlock Ticker, เสียงเข้า/ออก, สรุปเป็น PDF) · `/logs` · `/report`
ยังไม่ได้ทดสอบกับ key จริง (Claude, ElevenLabs, Fuji, Tokenomist) · ยังไม่มี `/dashboard`, landing เต็ม และ auth (ดู [LOGS.md](LOGS.md))

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env   # ทุก key ไม่บังคับ ถ้าไม่ใส่จะใช้ข้อมูลตัวอย่าง/โหมดสำรอง
npm run dev            # http://localhost:3000/app
npm run snapshot -- ARB WLD AVAX   # ดึงข้อมูลจริงจาก Tokenomist (ต้องมี TOKENOMIST_API_KEY)
```

## Stack

Next.js 15 · TypeScript · Claude (Anthropic SDK) · Tokenomist API · ElevenLabs · Avalanche (viem) · Supabase (แผน)
