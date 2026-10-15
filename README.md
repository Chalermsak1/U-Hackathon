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

## สถานะ

กำลังสร้าง: backend core (Tokenomist client, risk scorer, agent tools, Claude loop, Avalanche) เขียนแล้วแต่ยังไม่ได้ build · UI, API routes และ auth ยังไม่ได้ทำ (ดู SPEC.md §14)

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env   # ทุก key ไม่บังคับ ถ้าไม่ใส่จะใช้ข้อมูลตัวอย่าง/โหมดสำรอง
npm run typecheck
npm run snapshot -- ARB WLD AVAX   # ดึงข้อมูลจริงจาก Tokenomist (ต้องมี TOKENOMIST_API_KEY)
```

## Stack

Next.js 15 · TypeScript · Claude (Anthropic SDK) · Tokenomist API · ElevenLabs · Avalanche (viem) · Supabase (แผน)
