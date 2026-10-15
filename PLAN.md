# U-Guard: แผนสร้าง Demo (U-Hackathon 2026 · AI Track)

> สถานะ ณ พฤ. 15 ต.ค. 2026 ราว 12:45 น. · demo บ่ายวันศุกร์ 16 ต.ค.

**One-liner:** U-Guard คือ agent ใน U-Bot ที่เตือนผู้ใช้ U-topia เรื่องการปลดล็อกเหรียญ (token unlock) ในจังหวะที่กำลังจะซื้อหรือถือเหรียญนั้นอยู่ แสดงข้อมูลเป็นภาษาไทยที่เข้าใจง่าย มีเสียงอ่าน และผู้ใช้เป็นคนตัดสินใจทุกครั้ง

**Pitch:** *"U-Guard is the safety layer of an agentic bank: it checks supply risk before your money moves. Retail no longer finds out last."*

---

## 1. ปัญหานี้เกิดขึ้นจริงตอนนี้หรือไม่ (ตรวจสอบ ต.ค. 2026)

### หลักฐานว่ายังเกิดอยู่

| เหตุการณ์ | วันที่ | ขนาด | แหล่งที่มา |
|---|---|---|---|
| Ethena (ENA) ปลดล็อกเหรียญนักลงทุนที่เหลือทั้งหมดในวันเดียว | 5 ต.ค. 2026 | ~1.4B ENA | CryptoTicker, StartupFortune |
| Hyperliquid (HYPE) team unlock (ขาย OTC ให้สถาบันรายเดียว) | 6 ต.ค. 2026 | 3.75M HYPE (~$336.75M) | Tokenomist Weekly Digest |
| Cronos (CRO) unlock | 17 ต.ค. 2026 | 1.17B CRO = 2.33% ของ circulating | CoinMarketCap |
| deBridge (DBR) cliff | 17 ต.ค. 2026 | ~10% ของ circulating | Tokenomist Weekly Digest |
| Monad (MON) มีเหรียญหมุนเวียนแค่ ~11.8% ของ supply และมี unlock ใหญ่เดือน พ.ย. | พ.ย. 2026 | float บางมาก | BSCNews อ้างข้อมูล Tokenomist |

ภาพใหญ่: ปี 2025 มีเหรียญถูกปลดล็อกรวม **$97.43B** เป็นส่วนของ insider (ทีม + นักลงทุน) $18.77B (Tokenomist 2025 Review)

### ข้อจำกัดที่ต้องพูดตรงๆ (กรรมการอาจถาม)
- Tokenomist ประเมินว่า supply shock ปี 2026 **เบาลง** กว่าปี 2025 เช่น Aptos จบรอบ unlock 4 ปีในเดือน ต.ค. 2026
- งานวิจัย Tokenomist (มิ.ย. 2026, 236 events): ราคาตกเพราะ unlock **เกิดขึ้นจริงแต่มีเงื่อนไข** กระจุกในเหรียญเกิดใหม่ที่ float บาง และ **ราคามักรับรู้ไปก่อนวัน unlock แล้ว**
- งานวิจัย Keyrock (16,000+ events): 90% ของ unlock สร้างแรงกดราคา เริ่มราว 30 วันก่อนวัน unlock โดย unlock ของทีมแย่สุด (−25%) และ unlock ของกองทุน ecosystem เฉลี่ย +1.18%

**สรุป:** ปัญหามีจริง แต่ไม่ได้เกิดกับทุกเหรียญ ความเสียหายกระจุกอยู่ที่ (1) เหรียญ float บาง/เกิดใหม่ (2) ช่วง ~30 วันก่อนวัน unlock (3) unlock ที่ผู้รับเป็นทีม ซึ่ง U-Guard ออกแบบมาให้คำนวณคะแนนตามเงื่อนไขเหล่านี้อยู่แล้ว แทนที่จะเตือนทุก unlock แบบเหมารวม จุดนี้คือข้อได้เปรียบเมื่อเทียบกับเครื่องมือแจ้งเตือน unlock ทั่วไป

### Problem Statement (ฉบับปรับใหม่)

**TH:** ผู้ใช้ U-topia มีทั้งสัญญาณเทรดและปุ่ม swap อยู่ในกระเป๋าเงินของตัวเอง แต่ไม่มีอะไรบอกเลยว่าเหรียญที่กำลังจะซื้อมีเหรียญก้อนใหญ่รอปลดล็อกเข้าตลาด ในปี 2026 ความเสียหายจาก unlock ไม่ได้เกิดกับทุกเหรียญ แต่กระจุกในเหรียญ float บางในช่วง ~30 วันก่อนวัน unlock ซึ่งเป็นช่วงเดียวกับที่รายย่อยมักไล่ซื้อตามกระแส และเพราะกระเป๋าเป็นแบบ self-custody จึงไม่มีใครคอยกันให้ นอกจาก agent ที่อยู่ข้างผู้ใช้เอง

**EN:** *U-topia users get trade signals and a swap button in their own self-custody wallet, but nothing tells them the token they are buying has a supply unlock coming. In 2026 the damage is not everywhere: it concentrates in thin-float tokens in the ~30 days before an unlock, exactly when retail chases hype. In self-custody nobody stands in between, unless the user's own agent does.*

---

## 2. U-topia คือใคร และ U-Guard ตอบโจทย์บริษัทข้อไหน

### ข้อเท็จจริงเกี่ยวกับ U-topia (จากแหล่งสาธารณะ)
- CEO นิยามแอปว่าเป็น **"non-custodial, agentic banking super app"** แอปอยู่ใน beta บน Apple App Store และใช้จ่ายได้ราว 50 ประเทศ (new-banking.app)
- **แอป U-topia** มี
  - กระเป๋า self-custody แบบ multichain (**เครือข่าย EVM + stablecoin หลัก**) พร้อม swap / send / receive
  - **Crypto-fiat bridge** (BTC, ETH, USDT ↔ fiat) และบัญชี IBAN (coming soon)
  - **U-Card** (Visa, virtual/physical) วางแผนค่าธรรมเนียม top-up ด้วย crypto 0.7% รองรับ Apple/Google Pay
  - **U-Pay** โอนเงินข้ามประเทศ
  - **U.Points** / rewards / Owner Rights
  - **AI banking assistant** ที่ช่วยเรื่อง "spending, saving goals and crypto investments"
  - **UTOPIA Kids** (สอนเรื่องเงินให้เด็ก)
- **ส่วนอื่นใน ecosystem**
  - **Topi AI**: บอท market intelligence บน Telegram ที่ให้สัญญาณแบบ real-time และ**ส่งคำสั่งเทรดอัตโนมัติ**ได้
  - **U-Wallet**: กระเป๋า gasless (ERC-4337)
  - **U-Rewards**
  - **OTC**: ทางเข้าออก fiat ผ่านพาร์ตเนอร์ที่มีใบอนุญาต
  - **UCOIN (U)**: เทรดบน MEXC และ BitMart มี vesting 12–36 เดือน
- **U-Center:** ชุมชนสมาชิก มี DAO, Treasury, U Academy และสโลแกน education-first
- ผู้ใช้ราว 130,000 คนต่อเดือนใน 19 ประเทศ (TheBlock, ส.ค. 2025)

> **"แหล่งตลาด" ที่ผู้ใช้ U-topia เข้าถึงได้** ได้แก่ (1) swap ในกระเป๋า self-custody บนเครือข่าย EVM (2) crypto-fiat bridge และ OTC ผ่านพาร์ตเนอร์ (3) Topi AI บน Telegram ที่ส่งคำสั่งเทรดอัตโนมัติ (4) ตลาด CEX ของ UCOIN (MEXC, BitMart) (5) จ่ายผ่าน Visa ที่ร้านค้าราว 50 ประเทศ
> **สิ่งที่ยังไม่รู้:** รายชื่อเหรียญที่ swap ได้จริง และ DEX/aggregator ที่ใช้ ต้องถาม mentor

### ความต้องการของ U-topia กับสิ่งที่ U-Guard ตอบ

| สิ่งที่ U-topia ต้องการ | U-Guard ตอบอย่างไร |
|---|---|
| ผู้ใช้ส่วนใหญ่ไม่ใช่ผู้เชี่ยวชาญ (U-Center: "ไม่เข้าใจว่าเงินทำงานยังไง") | สรุป 3 บรรทัดเป็นภาษาไทยพร้อมเสียงอ่าน และแต่ละการเตือนสอนแนวคิดหนึ่งเรื่อง |
| Self-custody: "your money should remain yours" | ไม่มีฝ่ายบริหารความเสี่ยงส่วนกลางคอยกันให้ การป้องกันจึงต้องเป็น agent ฝั่งผู้ใช้ที่ทำงาน**ก่อน**ธุรกรรม |
| ทิศทางของบริษัทคือ "agentic banking" | U-Guard เป็น agent skill ที่จับต้องได้: perceive → plan → act → รอผู้ใช้อนุมัติ |
| Topi AI ให้สัญญาณและเทรดอัตโนมัติ | เป็นชั้น "Signal + Safety" ที่เช็ก supply risk ก่อนผู้ใช้ทำตามสัญญาณ |
| ความน่าเชื่อถือและการทำตามกฎ (ทำงานผ่านพาร์ตเนอร์ที่มีใบอนุญาต) | ให้ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน และบันทึกการอนุมัติของผู้ใช้ on-chain |
| Education-first (U Academy) | ทุกการ์ดแสดงแหล่งข้อมูลและวันที่ เป็นบทเรียนสั้นๆ ในตัว |

## 3. ควรทำเป็น "Agentic AI ผู้ช่วยวางแผนลงทุน" หรือไม่

**ควรเป็น agentic แต่วางตำแหน่งเป็น "ผู้ช่วยตัดสินใจ / guardrail" ไม่ใช่ "ผู้แนะนำว่าควรซื้ออะไร"** ด้วยเหตุผล 2 ข้อ
1. ในประเทศไทย การให้คำแนะนำเรื่องคุณค่าหรือความเหมาะสมในการลงทุนสินทรัพย์ดิจิทัลเป็นธุรกิจ **"ที่ปรึกษาสินทรัพย์ดิจิทัล" (Digital Asset Advisory Service) ซึ่งต้องได้รับอนุญาตจาก ก.ล.ต.** ถ้า demo บอกว่า "ควรซื้อ/ขาย" จะเสียคะแนน Practicality
2. U-topia เองทำงานผ่านพาร์ตเนอร์ที่มีใบอนุญาต การออกแบบที่ทำตามกฎตั้งแต่แรกจึงขายได้จริง

**คำตอบเรื่อง "วางแผน ณ ช่วงเวลานั้น" คือ Flow C (Unlock-aware Plan):** ผู้ใช้เป็นคนเลือกเหรียญและงบเอง agent ช่วยจัด**จังหวะเวลา**ตาม supply event ที่ประกาศล่วงหน้า (พักซื้อในช่วง 30 วันก่อน unlock แล้วกลับมาซื้อหลังวัน unlock ≥14 วัน ตามงานวิจัย Keyrock) โดยผู้ใช้อนุมัติทุกขั้น ข้อนี้เป็นการวางแผนจริงโดยไม่ข้ามเส้นไปเป็นการแนะนำการลงทุน

---

## 4. Scope

| ระดับ | สิ่งที่ทำ |
|---|---|
| **MVP (ต้องทำงานได้สดบนเวที)** | Flow A pre-trade check · Flow B holding watch แจ้งเตือนผ่าน U-Bot · หน้า Agent Trace · เสียงภาษาไทย · การ์ดอนุมัติ → ใบบันทึกบน Avalanche Fuji · ข้อมูล Tokenomist (live หรือ snapshot) |
| **Stretch** | Flow C Unlock-aware Plan · เชื่อม U-Bot ตัวจริง · คุยด้วยเสียงผ่าน ElevenLabs Agents |
| **ไม่ทำ** | เทรดอัตโนมัติ · แนะนำซื้อ/ขาย · ถือเงินแทนผู้ใช้ · ใช้เงินจริง |

## 5. User Flows

**Flow A: Pre-trade check (หัวใจของ demo)**
ผู้ใช้พิมพ์ใน U-Bot (หรือกด swap) ว่า "ซื้อ ARB 5,000 บาท"
→ agent เรียก `assess_unlock_risk`
→ แสดงการ์ด: คะแนน, ข้อความ 3 บรรทัด, แหล่งข้อมูล
→ ปุ่มฟังเสียงสรุป
→ ถ้าความเสี่ยง medium/high agent จะเสนอ `pause_buying`
→ ผู้ใช้กดอนุมัติ → บันทึก tx บน Fuji → แสดงลิงก์ Snowtrace

**Flow B: Holding watch**
"สแกนรายวัน" → `get_portfolio` → `assess_unlock_risk` ทุกเหรียญพร้อมกัน → ส่งแจ้งเตือนผ่าน U-Bot adapter เฉพาะเหรียญ medium/high → เสนอ `price_alert`
เหรียญอย่าง USDC/ETH จะขึ้นว่า "ไม่มีความเสี่ยงจาก unlock" ซึ่งช่วยแสดงว่า agent ไม่เตือนพร่ำเพรื่อ

**Flow C (stretch): Unlock-aware Plan**
"อยาก DCA WLD เดือนละ 2,000 บาท 6 เดือน" → agent จัดตารางที่เว้นช่วงเสี่ยง → ผู้ใช้อนุมัติทั้งแผน

## 6. สถาปัตยกรรม (สิ่งที่ทำไปแล้ว ✅ / ยังไม่ได้ทำ ⬜)

```
U-Bot (mock หรือ webhook) ⇄ /api/agent ⇄ Claude agent loop (Opus 5.5, tool use, fallback ฝั่ง server)
                                     └ offline agent สำรอง (กรณีไม่มีเน็ตหรือไม่มี key)
tools → Tokenomist v5 (live → fallback fixture) · ราคา/volume · risk scorer (โค้ด) · portfolio · proposal
อนุมัติ → /api/protect → Avalanche Fuji (0-AVAX tx + memo)   เสียง → /api/voice → ElevenLabs (สำรอง: เสียง th-TH ของเบราว์เซอร์)
```

- ✅ config, types, Tokenomist client, market, **risk scorer**, tools (7 ตัว), system prompt, Claude loop, Avalanche, portfolio, store, สคริปต์ `npm run snapshot`, fixtures
- ⬜ offline agent, API routes, U-Bot adapter, voice, UI (หน้าจอแอป U-topia + แชต + การ์ด + Agent Trace), README, build + smoke test

## 7. เหรียญที่ใช้ demo (ต้องเปลี่ยนจาก fixture ปัจจุบัน)

กระเป๋า U-topia รองรับ **เครือข่าย EVM + stablecoin** แต่ **SUI ไม่ใช่ EVM จึงอาจซื้อในแอปไม่ได้** เลยควรเปลี่ยนชุดเหรียญเป็น

| เหรียญ | บทบาทใน demo | หมายเหตุ |
|---|---|---|
| **ARB** (Arbitrum) | เสี่ยงสูง: ผู้รับเป็นทีมและนักลงทุน | **ข้อมูลจริง: unlock 92.6M ARB (~$16.5M) วันที่ 16 ต.ค. ซึ่งเป็นวัน demo** จาก Investors + Team · float 59.52% · vesting จบปี 2027 |
| **WLD** (Optimism) | เสี่ยงสูง/กลาง: unlock แบบ linear ของทีมและนักลงทุน | ปี 2025 มี linear unlock สูงสุด ($2.11B) |
| **AVAX** (C-Chain) | เสี่ยงต่ำ: unlock เข้ากองทุน ecosystem | แสดงว่า agent ไม่ได้เตือนทุก unlock และเชื่อมกับ sponsor |
| **USDC / ETH** | ไม่มี unlock | แสดงให้เห็นว่าไม่เตือนแบบเหมารวม |
| (ตัวเลือก) **MON** | ตัวอย่างเหรียญ float บาง (~11.8%) | ถ้าแอปรองรับ |

ชุดสุดท้ายเลือกหลังจาก (1) mentor ยืนยันว่าแอปรองรับเหรียญอะไร และ (2) ได้ข้อมูล live จาก Tokenomist

## 8. Timeline

| ช่วงเวลา | งาน |
|---|---|
| **พฤ. 12:45–13:30** | ถาม mentor (ข้อ 12) · ขอ Tokenomist key · สมัคร ElevenLabs key · สร้าง Fuji wallet และขอ AVAX จาก faucet · ล็อกเหรียญที่ใช้ demo |
| **พฤ. 13:30–16:00** | offline agent + API routes · เปลี่ยนชุดเหรียญ · `npm run snapshot` ดึงข้อมูลจริง |
| **พฤ. 16:00–18:00** | UI: หน้าจอแอป U-topia + แชต U-Bot + การ์ดความเสี่ยง + Agent Trace |
| **พฤ. ค่ำ (ถ้าทำต่อนอกงาน)** | เสียง + ใบบันทึก Avalanche + Flow B |
| **ศ. 10:00–12:00** | เชื่อม U-Bot ตัวจริง (ถ้ามี API) · Flow C (ถ้าเหลือเวลา) · เก็บงาน |
| **ศ. 12:00–13:00** | freeze code · **อัดวิดีโอสำรอง** · ซ้อม demo 3 รอบ |

## 9. แบ่งงานทีม
1. **Agent/Backend:** API routes, offline agent, U-Bot adapter
2. **Frontend:** หน้าจอแอป U-topia, แชต, การ์ด, Agent Trace
3. **Data:** Tokenomist key + snapshot, เลือกเหรียญ, ปรับค่า risk scorer
4. **Pitch/Integrations:** ElevenLabs, Avalanche Fuji, สไลด์, demo script, วิดีโอสำรอง

## 10. Demo Script (3 นาที)
- **0:00 Hook:** "5 ต.ค. ที่ผ่านมา Ethena ปลดล็อกเหรียญนักลงทุนทั้งหมดในวันเดียว 1.4 พันล้าน ENA และพรุ่งนี้ deBridge จะเพิ่มเหรียญหมุนเวียนอีก 10% คนที่ถือเหรียญพวกนี้ในกระเป๋าตัวเองรู้หรือเปล่า?"
- **0:30 Flow A สด:** "ซื้อ ARB 5,000 บาท" → การ์ด + เสียงไทย → อนุมัติ → tx บน Avalanche
- **1:30 ความต่าง:** ถาม AVAX → "เสี่ยงต่ำ เพราะเป็นกองทุน ecosystem" → ชี้ Agent Trace ให้เห็นว่า agent วางแผนและเรียก tools หลายขั้น
- **2:00 Flow B:** แจ้งเตือนเหรียญในพอร์ตผ่าน U-Bot
- **2:30 ปิด:** "Safety layer ของ agentic bank ที่ทำตามกฎ (ไม่ใช่คำแนะนำการลงทุน) และใช้ครบ 3 sponsor"

## 11. เทียบกับเกณฑ์ตัดสิน
| เกณฑ์ | วิธีเก็บคะแนน |
|---|---|
| Execution 40% | flow ครบสด ใช้ข้อมูลจริงจาก snapshot มี fallback ทุกจุด และมีวิดีโอสำรอง |
| Practicality 40% | ปัญหามีหลักฐานปี 2026 · ใช้เหรียญที่แอปรองรับจริง · ทำตามกฎ ก.ล.ต. · ตรงกับทิศทาง agentic banking ของบริษัท |
| UX 10% | การ์ดเดียว ภาษาไทย 3 บรรทัด มีเสียง |
| Innovation 5% | คะแนนแบบมีเงื่อนไข (ประเภทผู้รับ, float) · ใช้ 3 sponsor · บันทึกการอนุมัติ on-chain |
| U-Bot 5% | U-Bot เป็นทั้งช่องทางรับคำสั่งและช่องทางแจ้งเตือน (adapter พร้อมต่อของจริง) |

## 12. คำถามที่ต้องถาม mentor ให้ได้วันนี้
1. U-Bot มี API/webhook/SDK ไหม · อยู่ช่องทางไหน (ในแอป หรือ Telegram) · เกี่ยวข้องกับ Topi AI อย่างไร
2. swap ในแอปรองรับเหรียญและเครือข่ายอะไรบ้าง
3. AI banking assistant ในแอปรับ skill จากภายนอกได้ไหม
4. แสดงตาราง vesting ของ UCOIN ใน demo ได้ไหม (ถ้าได้ ช่วยคะแนน ecosystem มาก)
5. sponsor แต่ละรายมี bounty brief อะไร
6. (บูธ Tokenomist) มี hackathon key ที่เปิดข้อมูล unlock ล่วงหน้าและ fundraising ไหม

## 13. ความเสี่ยงและวิธีรับมือ
| ความเสี่ยง | วิธีรับมือ |
|---|---|
| แอปไม่รองรับเหรียญที่เลือก | ถาม mentor แล้วเลือกเฉพาะเหรียญ EVM |
| free trial ของ Tokenomist ไม่มีข้อมูลล่วงหน้า | ขอ key จากบูธ + ทำ snapshot ไว้ล่วงหน้า |
| ไม่รู้ API ของ U-Bot | ใช้ adapter + mock และเตรียม webhook ไว้ |
| Claude ตอบช้าหรือเน็ตล่ม | ตั้ง effort ต่ำ + offline agent + วิดีโอสำรอง |
| ถูกมองว่าเป็นการแนะนำการลงทุน | ให้แค่ข้อมูล ไม่บอกให้ซื้อ/ขาย และผู้ใช้อนุมัติเองทุกครั้ง |
| เตือนบ่อยเกินไป | ใช้คะแนนแบบมีเงื่อนไข (งานวิจัย Tokenomist 2026) |

## 14. Tokenomist มีข้อมูลอะไร (และไม่มีอะไร)

**มี (500+ เหรียญ รวม BTC และ ETH):**
- supply (circulating, max, locked, **float %**, adjusted market cap, FDV)
- **unlock events** ทั้ง cliff และ linear แยกตามผู้รับ และ**ดูล่วงหน้าได้** (ระยะขึ้นกับแพ็กเกจ)
- **daily emission** (รวมการออกเหรียญจากการขุดของ BTC และ staking rewards ของ ETH)
- allocations
- **fundraising** (รอบ, valuation, ราคาต่อเหรียญ, นักลงทุน) และพอร์ตของนักลงทุน
- **burn**, **buyback**
- **committed claim**: จำนวนที่ถูกเคลมออกจาก vesting contract จริงบน chain
- งานวิจัย/สรุปรายสัปดาห์, บอทแจ้งเตือนใน Telegram, CLI และ MCP server

**ตัวอย่างข้อมูลจริง ณ 15 ต.ค. 2026:**
- **BTC:** ปล่อยแล้ว 95.71% (20.1M จาก 21M) ออกใหม่ ~478.6 BTC/วัน (~$39M) ตารางยาวถึงปี 2050 ไม่มี unlock แบบ vesting
- **ETH:** 122.03M ETH, float 93.31%, supply ไม่มีเพดาน ไม่มี event ที่ตั้งเวลาไว้ ข้อมูล burn (deflation) ต้องใช้แพ็กเกจ Pro
- **ARB:** float 59.52%, unlock 92.6M ทุกเดือนจากทีมและนักลงทุน + DAO treasury แบบ linear ~14.4M/เดือน, ระดมทุน $123.7M

**ไม่มี (ต้องใช้แหล่งอื่น):** ราคาย้อนหลัง/OHLC, volume, order book, อนุพันธ์ (funding, open interest), ETF flow, on-chain activity ทั่วไป และตลาดหุ้น/ทองคำ/FX/มหภาค
→ ถ้าต้องการ "ข้อมูลการลงทุนโลก" ต้องรวม CoinGecko (ราคา/volume) และแหล่งอื่น โดยให้ Tokenomist เป็นข้อมูลฝั่ง **supply**

## 15. ใช้ข้อมูลนี้ forecast อะไรได้บ้าง

| ระดับความแม่น | สิ่งที่ forecast ได้ | ใช้ข้อมูล |
|---|---|---|
| **สูง (กำหนดไว้ล่วงหน้า)** | เส้นทาง circulating supply 30/90/365 วัน | unlock events + daily emission |
| สูง | อัตราเงินเฟ้อของเหรียญ และสัดส่วนของผู้ถือที่จะลดลง (dilution) | emission ÷ circulating |
| สูง | ปฏิทินว่าใครได้เหรียญเมื่อไร (insider เทียบกับ non-insider) | allocation breakdown |
| สูง | **"ตลาดต้องรับเหรียญใหม่เท่าไรต่อเดือน"** (เทียบเป็น % ของ market cap) | emission × ราคา |
| สูง/กลาง | net supply = emission − burn − buyback | burn, buyback (บางส่วนต้องใช้ Pro) |
| กลาง | กำไรของนักลงทุนตอน unlock (ราคาตอนนี้ ÷ ราคารอบระดมทุน) | fundraising |
| กลาง | แรงขายที่จะเกิดจริง: อัตราส่วนที่ถูกเคลมออกจาก contract และมูลค่า unlock ÷ volume | committed claim + volume (CoinGecko) |
| **กลาง/ต่ำ (สถิติ)** | ช่วงผลตอบแทนที่คาดได้และความผันผวนรอบวัน unlock แยกตามขนาด/ผู้รับ/float (event study) | unlock ย้อนหลัง + ราคาย้อนหลัง |
| **ทำไม่ได้ / ไม่ควรอ้าง** | ราคาเป้าหมาย, ทิศทางราคา BTC/ETH, ผลจากมหภาคหรือข่าว | ไม่ใช่สิ่งที่ข้อมูล supply บอกได้ และติดเรื่องใบอนุญาตที่ปรึกษาฯ |

**ข้อความสำหรับ pitch:** U-Guard ไม่ทายราคา แต่ forecast **supply** ซึ่งเป็นตัวแปรเดียวในตลาดคริปโตที่รู้ล่วงหน้าได้จริง

## 16. Dashboard module (ต้นแบบภาพอยู่ในแชต ยังไม่ได้ใส่ในแอป)
- **KPI row:** float %, ออกใหม่ต่อวัน, unlock ถัดไปของแต่ละเหรียญในพอร์ต
- **Supply forecast:** กราฟแท่งซ้อนรายเดือนแยกตามผู้รับ (ARB: 92.6M ทีม + นักลงทุน และ 14.4M DAO)
- **เหรียญใหม่ต่อเดือนเทียบ market cap:** ARB ~1.80% เทียบกับ BTC ~0.07% (แรงกดจาก supply ของ ARB สูงกว่าราว 25 เท่า)
- **ตัวคำนวณ dilution:** "ถือ 1,000 ARB, 6 เดือน สัดส่วนจะลดลง 9.7% ต้องซื้อเพิ่ม ~108 ARB เพื่อรักษาสัดส่วนเท่าเดิม"
- วางเป็นแท็บ "พอร์ต" ในหน้าจอแอป U-topia และเป็นหน้าจอใหญ่สำหรับกรรมการ
- งานที่ต้องเพิ่ม: `/api/forecast` (ใช้ daily emission v5 + unlock events) และคอมโพเนนต์กราฟ

## 17. หน้า Demo ยังขาดอะไร (ณ 15 ต.ค. ~13:00)

| ส่วน | สถานะ |
|---|---|
| Backend core (Tokenomist client, risk scorer, tools, Claude loop, Avalanche, portfolio) | ✅ เขียนแล้ว ยังไม่ได้ build/test |
| API routes: `/api/agent`, `/api/protect`, `/api/voice`, `/api/ubot/webhook`, `/api/forecast` | ⬜ |
| Offline agent สำรอง | ⬜ |
| U-Bot adapter (mock + webhook) | ⬜ |
| UI: หน้าจอแอป U-topia, แชต U-Bot, การ์ดความเสี่ยง, การ์ดอนุมัติ, Agent Trace | ⬜ |
| Dashboard forecast | ⬜ (มีต้นแบบภาพแล้ว) |
| ข้อมูลจริง: เปลี่ยนชุดเหรียญเป็น ARB/WLD/AVAX/USDC + `npm run snapshot` | ⬜ ต้องใช้ Tokenomist key |
| Keys: Anthropic, Tokenomist, ElevenLabs, Fuji wallet + faucet | ⬜ |
| README, สไลด์, วิดีโอสำรอง, ซ้อม demo | ⬜ |
| Avatar + logo (`public/brand/`) | ✅ |
| Auth (Supabase: wallet / email OTP / โหมด demo) + Database + RLS แทน in-memory store | ⬜ ดู UI-PLAN.md §14 |
| หน้า Loading + skeleton | ⬜ ดู UI-PLAN.md §15 |
| Landing `/` ตาม UI-PLAN.md | ⬜ |

## แหล่งข้อมูล
- Luma U-Hackathon: https://luma.com/lqrbtu27
- Tokenomist token pages (15 ต.ค. 2026): https://tokenomist.ai/bitcoin · https://tokenomist.ai/ethereum · https://tokenomist.ai/arbitrum · API docs: https://docs.tokenomist.ai/api-documents/daily-emission/v5
- Tokenomist: 2025 Unlocks Review · When Token Unlocks Actually Move Price (มิ.ย. 2026) · Weekly Unlock Digest 5–11 ต.ค. และ 12–18 ต.ค. 2026 (tokenomist.ai/research)
- Keyrock: https://keyrock.com/from-locked-to-liquidity-what-16000-token-unlocks-teach-us/
- U-topia: https://u-topia.com · https://new-banking.app/en/ · https://the-block.com/blog/2025/08/21/u-topia/ · https://www.coindesk.com/price/ucoin · https://u.center
- ก.ล.ต.: ธุรกิจที่ปรึกษาสินทรัพย์ดิจิทัล (Digital Asset Advisory Service): https://www.sec.or.th/TH/pages/lawandregulations/digitalassetbusiness.aspx
- ข่าว ต.ค. 2026: CoinMarketCap (CRO) · CryptoTicker / StartupFortune (ENA) · Yahoo Finance (Aptos) · BSCNews (Monad)
