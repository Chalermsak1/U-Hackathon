import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "showcase");
const SHOTS_DIR = path.join(process.cwd(), "screenshots", "iphone-15-pro");

async function getBase64Shot(filename) {
  try {
    const buf = await readFile(path.join(SHOTS_DIR, filename));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn(`Could not read ${filename}: ${err.message}`);
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const screenImages = {
    agent: await getBase64Shot("th-agent.png"),
    screener: await getBase64Shot("th-tokens.png") || await getBase64Shot("th-unlocks.png"),
    unlocks: await getBase64Shot("th-unlocks.png"),
    trade: await getBase64Shot("th-trade.png"),
    portfolio: await getBase64Shot("th-portfolio.png"),
    alerts: await getBase64Shot("th-alerts.png"),
    app: await getBase64Shot("th-app.png"),
    terminal: await getBase64Shot("th-terminal.png"),
    token: await getBase64Shot("th-token.png"),
  };

  const browser = await chromium.launch({ headless: true });
  const canvasPage = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const bannerTemplates = [
    {
      filename: "cover-image.jpg",
      screenSrc: screenImages.app,
      altScreenSrc: screenImages.terminal,
      badge: "U-HACKATHON 2026 · AVALANCHE C-CHAIN",
      title: "U-Guard: Pre-Trade Risk Intelligence",
      subtitle: "AI Agent ปกป้องพอร์ตคริปโตจากความเสี่ยง Token Unlock และ Supply Dilution",
      highlights: [
        { label: "Tokenomics Scorer", desc: "วิเคราะห์ตาราง Vesting สดจาก Tokenomist API v5" },
        { label: "Built on Avalanche", desc: "บันทึกผลการตัดสินใจแบบ On-chain บน Fuji C-Chain" },
        { label: "Multi-Modal AI Vision", desc: "สแกนกราฟและสัญญาณเทรด ตรวจจับความเสี่ยงทันที" },
        { label: "Strictly Non-Custodial", desc: "ไม่ชี้นำ ไม่บังคับเทรด ผู้ใช้อนุมัติกฎคุ้มครองเองเสมอ" },
      ],
      tags: ["Avalanche Fuji", "Tokenomist Live API", "U-Bot & MCP", "Next.js 15"],
    },
    {
      filename: "screenshot-1-agent.jpg",
      screenSrc: screenImages.agent || screenImages.app,
      badge: "FEATURE 01 · CONVERSATIONAL RISK AI",
      title: "AI Risk-Intelligence Agent",
      subtitle: "ผู้ช่วยตรวจจับความเสี่ยงก่อนเทรด ตอบคำถาม Tokenomics เชิงลึกแบบเรียลไทม์",
      highlights: [
        { label: "Instant Risk Assessment", desc: "คำนวณคะแนน Risk Score 0–100 ตามปริมาณเหรียญที่กำลังจะปลดล็อค" },
        { label: "Actionable Proposals", desc: "เสนอแผน Pause Buying หรือตั้ง Stop-Loss อัตโนมัติเมื่อเหรียญเสี่ยงสูง" },
        { label: "Voice & Text Interface", desc: "รองรับการสั่งการด้วยเสียงและข้อความภาษาไทยอย่างเป็นธรรมชาติ" },
      ],
      tags: ["Risk Score", "Cliff Unlocks", "AI Agent", "Voice Chat"],
    },
    {
      filename: "screenshot-2-screener.jpg",
      screenSrc: screenImages.unlocks || screenImages.screener,
      badge: "FEATURE 02 · UNLOCK INTELLIGENCE",
      title: "Token Unlock Screener & Calendar",
      subtitle: "สแกนและจับตาเหรียญที่มีกำหนดการปลดล็อคก้อนใหญ่ในตลาด",
      highlights: [
        { label: "Vesting Countdown", desc: "แสดงวันเวลาและนาฬิกานับถอยหลังสู่วัน Cliff Unlock รายเหรียญ" },
        { label: "Dilution Impact", desc: "คำนวณสัดส่วนเหรียญที่จะปลดล็อคเทียบกับ Circulating Supply" },
        { label: "Allocation Transparency", desc: "จำแนกกลุ่มผู้รับเหรียญชัดเจน: Team, Private Investors หรือ Treasury" },
      ],
      tags: ["Tokenomist v5", "ARB Today", "AVAX Schedule", "WLD Emissions"],
    },
    {
      filename: "screenshot-3-onchain.jpg",
      screenSrc: screenImages.alerts,
      badge: "FEATURE 03 · VERIFIABLE PROVENANCE",
      title: "On-Chain Receipts on Avalanche",
      subtitle: "ทุกการตัดสินใจได้รับการบันทึกและตรวจสอบได้จริงบนบล็อกเชน Snowtrace",
      highlights: [
        { label: "Zero-Overhead Calldata", desc: "บันทึก Decision JSON ผ่าน 0-AVAX Self-Transfer รวดเร็วและประหยัด Gas" },
        { label: "Snowtrace Verification", desc: "ตรวจสอบ Transaction Hash และรายละเอียดกฎความเสี่ยงได้แบบ 100% On-Chain" },
        { label: "Avalanche Data API", desc: "ดึงยอด Balance เหรียญ Native และ ERC-20 สดตรงจาก C-Chain Node" },
      ],
      tags: ["Avalanche Fuji", "Snowtrace Explorer", "Viem", "Glacier Data API"],
    },
    {
      filename: "screenshot-4-trade.jpg",
      screenSrc: screenImages.trade,
      badge: "FEATURE 04 · PRE-TRADE SAFETY",
      title: "Pre-Trade Protection & Stop-Loss",
      subtitle: "ระบบตรวจสอบความเสี่ยงก่อนส่งคำสั่งเทรด (Safety Check Suite)",
      highlights: [
        { label: "Risk Budget Sizing", desc: "คำนวณขนาดไม้เทรดให้ไม่เกินงบความเสี่ยงที่กำหนดไว้" },
        { label: "Concentration Guard", desc: "เตือนทันทีหากการซื้อทำให้พอร์ตกระจุกตัวในเหรียญใดเหรียญหนึ่งมากเกินไป" },
        { label: "What-If Scenarios", desc: "จำลองกำไร/ขาดทุนหากเกิดแรงเทขายตามสถิติในอดีต (Keyrock Benchmark)" },
      ],
      tags: ["Concentration Guard", "Risk Budget", "Paper Orders", "Trade Plan"],
    },
    {
      filename: "screenshot-5-portfolio.jpg",
      screenSrc: screenImages.portfolio,
      badge: "FEATURE 05 · PORTFOLIO DEFENSE",
      title: "Portfolio Drift & Stress Testing",
      subtitle: "วัดความเบี่ยงเบนของพอร์ตจากเป้าหมายและทดสอบความทนทานต่อวิกฤต",
      highlights: [
        { label: "Portfolio Drift Tracker", desc: "ตรวจจับสัดส่วนพอร์ตที่เบี่ยงเบนไปจาก Target Mix ที่ผู้ใช้กำหนด" },
        { label: "At-Risk Exposure", desc: "รวมมูลค่าเหรียญที่กำลังเผชิญหน้ากับ Unlock Cliff ในรอบ 30 วัน" },
        { label: "Scenario Simulation", desc: "ทดสอบการรับมือหากตลาดเกิด Drawdown -20% หรือเกิดวิกฤติตามออปชัน" },
      ],
      tags: ["Stress Testing", "Target Mix", "Drift Alert", "Live Balance"],
    },
  ];

  for (const b of bannerTemplates) {
    console.log(`Generating banner for ${b.filename}...`);
    const screenSrc = b.screenSrc || screenImages.app || "";
    const altScreenSrc = b.altScreenSrc || null;

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: #06090e;
    color: #f1f5f9;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 80px 100px;
  }
  
  .bg-glow-1 {
    position: absolute;
    top: -150px;
    left: 20%;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(0, 242, 254, 0.14) 0%, rgba(6, 9, 14, 0) 70%);
    pointer-events: none;
  }
  .bg-glow-2 {
    position: absolute;
    bottom: -150px;
    right: 15%;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(0, 229, 153, 0.12) 0%, rgba(6, 9, 14, 0) 70%);
    pointer-events: none;
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  .info-col {
    width: 820px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 26px;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    box-shadow: 0 0 25px rgba(0, 242, 254, 0.5);
  }
  .brand-name {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .badge-tag {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(0, 242, 254, 0.08);
    border: 1px solid rgba(0, 242, 254, 0.3);
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #00f2fe;
    letter-spacing: 0.5px;
  }
  .title-main {
    font-size: 46px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1px;
    color: #ffffff;
  }
  .subtitle {
    font-size: 20px;
    line-height: 1.5;
    color: #94a3b8;
    font-weight: 400;
  }
  
  .highlights-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 6px;
  }
  .highlight-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px 20px;
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    backdrop-filter: blur(12px);
  }
  .highlight-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #00f2fe;
    box-shadow: 0 0 10px #00f2fe;
    margin-top: 6px;
    flex-shrink: 0;
  }
  .highlight-text h4 {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 4px;
  }
  .highlight-text p {
    font-size: 14px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .tags-row {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
  .tech-tag {
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 13px;
    color: #cbd5e1;
    font-weight: 500;
  }

  /* Right: Realistic Phone Frame */
  .phone-container {
    z-index: 2;
    position: relative;
    width: 440px;
    height: 870px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .phone-bezel {
    width: 410px;
    height: 850px;
    background: #0f172a;
    border-radius: 54px;
    padding: 12px;
    border: 4px solid #334155;
    box-shadow: 
      0 0 0 2px rgba(255, 255, 255, 0.12),
      0 30px 80px rgba(0, 0, 0, 0.95),
      0 0 60px rgba(0, 242, 254, 0.18);
    position: relative;
    overflow: hidden;
  }
  .phone-screen {
    width: 100%;
    height: 100%;
    border-radius: 44px;
    overflow: hidden;
    position: relative;
    background: #06090e;
  }
  .phone-screen img {
    width: 100%;
    height: auto;
    display: block;
  }
  .phone-island {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 110px;
    height: 28px;
    background: #000000;
    border-radius: 20px;
    z-index: 10;
  }
  .phone-reflection {
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 40%);
    pointer-events: none;
    z-index: 5;
  }

  .phone-secondary {
    position: absolute;
    right: 320px;
    top: 140px;
    width: 370px;
    height: 770px;
    opacity: 0.55;
    transform: scale(0.9) rotate(-6deg);
    z-index: 1;
    filter: blur(0.5px);
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="bg-glow-1"></div>
  <div class="bg-glow-2"></div>

  <div class="info-col">
    <div class="brand-row">
      <img class="brand-logo" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 10 L85 24 L85 52 C85 72 50 90 50 90 C50 90 15 72 15 52 L15 24 Z' fill='%23061219' stroke='%2300f2fe' stroke-width='6'/><path d='M50 25 L72 35 L72 52 C72 65 50 78 50 78 C50 78 28 65 28 52 L28 35 Z' fill='none' stroke='%2300e599' stroke-width='4'/></svg>" />
      <span class="brand-name">U-Guard</span>
    </div>

    <div class="badge-tag">${b.badge}</div>
    <h1 class="title-main">${b.title}</h1>
    <p class="subtitle">${b.subtitle}</p>

    <div class="highlights-list">
      ${b.highlights
        .map(
          (h) => `
        <div class="highlight-item">
          <div class="highlight-dot"></div>
          <div class="highlight-text">
            <h4>${h.label}</h4>
            <p>${h.desc}</p>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>

    <div class="tags-row">
      ${b.tags.map((t) => `<div class="tech-tag">${t}</div>`).join("")}
    </div>
  </div>

  <div class="phone-container">
    ${
      altScreenSrc
        ? `
      <div class="phone-secondary phone-bezel">
        <div class="phone-screen">
          <div class="phone-island"></div>
          <img src="${altScreenSrc}" />
        </div>
      </div>
    `
        : ""
    }
    <div class="phone-bezel">
      <div class="phone-reflection"></div>
      <div class="phone-screen">
        <div class="phone-island"></div>
        <img src="${screenSrc}" />
      </div>
    </div>
  </div>
</body>
</html>
    `;

    await canvasPage.setContent(html);
    await canvasPage.waitForTimeout(400);
    const dest = path.join(OUT_DIR, b.filename);
    await canvasPage.screenshot({ path: dest, type: "jpeg", quality: 95 });
    console.log(`Saved: ${dest}`);
  }

  await browser.close();
  console.log("All real app mockup banners generated successfully!");
}

main().catch(console.error);
