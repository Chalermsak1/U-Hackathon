// Responsive check: screenshots every page on iPhone / iPad / desktop and flags layout bugs.
//
//   npm run build && npm start          (or npm run dev)
//   npm run responsive                  # Chromium with iPhone emulation
//   npm run responsive -- --webkit      # Safari's engine (run `npx playwright install webkit` once)
//   BASE_URL=http://localhost:3101 npm run responsive
//
// Output: screenshots/<device>/<page>.png and screenshots/report.json. Exit code 1 when a page
// scrolls sideways (the most common iPhone layout bug).

import { mkdir, writeFile } from "node:fs/promises";
import { chromium, devices, webkit } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const useWebkit = process.argv.includes("--webkit");
const engine = useWebkit ? webkit : chromium;

const DEVICES = [
  ["iphone-se", devices["iPhone SE"]],
  ["iphone-15-pro", devices["iPhone 15 Pro"]],
  ["iphone-15-pro-max", devices["iPhone 15 Pro Max"]],
  ["ipad-mini", devices["iPad Mini"]],
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
];

const PAGES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "method", path: "/method" },
  { name: "assistant", path: "/app", auth: true, ask: "I want to buy ARB with ฿5,000" },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "ubot-popup", path: "/", popup: "Is ARB risky right now?" },
];

async function audit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const inScroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (["auto", "scroll", "hidden"].includes(s.overflowX) && p !== document.body && p !== document.documentElement) return true;
      }
      return false;
    };
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
    const overflowing = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && getComputedStyle(el).position !== "fixed") overflowing.push(describe(el));
    }
    const smallTargets = [...document.querySelectorAll("button, a.btn, a.chip, .chip, input, [role=tab]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32);
      })
      .map(describe);
    const zoomInputs = [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(describe);
    return {
      horizontalScroll: document.documentElement.scrollWidth > vw + 1,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: vw,
      overflowing: [...new Set(overflowing)].slice(0, 8),
      smallTargets: [...new Set(smallTargets)].slice(0, 8),
      zoomInputs,
    };
  });
}

const browser = await engine.launch();
const report = [];
let failures = 0;

for (const [deviceName, descriptor] of DEVICES) {
  const context = await browser.newContext({ ...descriptor, baseURL: BASE });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("ug_seen", "1"); // skip the first-visit splash
    } catch {}
  });
  const signIn = await context.request.post("/api/auth/demo", { headers: { "content-type": "application/json" }, data: {} });
  if (!signIn.ok()) throw new Error(`demo sign-in failed: ${signIn.status()}`);
  await mkdir(`screenshots/${deviceName}`, { recursive: true });

  for (const p of PAGES) {
    const page = await context.newPage();
    await page.goto(p.path, { waitUntil: "networkidle" });
    if (p.ask) {
      await page.fill("#ask-full", p.ask);
      await page.click("form.composer button.send");
      await page.waitForSelector(".msg-bot .risk-card", { timeout: 30_000 });
      await page.waitForTimeout(600);
    }
    if (p.popup) {
      await page.click(".ubot-launcher");
      await page.waitForSelector(".ubot-panel .chip");
      await page.fill("#ask-popup", p.popup);
      await page.click(".ubot-panel button.send");
      await page.waitForSelector(".ubot-panel .msg-bot .bubble", { timeout: 30_000 });
      await page.waitForTimeout(600);
    }
    const result = await audit(page);
    await page.screenshot({ path: `screenshots/${deviceName}/${p.name}.png`, fullPage: !p.popup });
    const bad = result.horizontalScroll || result.zoomInputs.length > 0;
    if (bad) failures++;
    report.push({ device: deviceName, page: p.name, ...result });
    console.log(
      `${bad ? "FAIL" : "ok  "}  ${deviceName.padEnd(18)} ${p.name.padEnd(11)} width ${result.scrollWidth}/${result.viewport}` +
        (result.overflowing.length ? `  overflow: ${result.overflowing.join(", ")}` : "") +
        (result.zoomInputs.length ? `  iOS-zoom inputs: ${result.zoomInputs.join(", ")}` : "") +
        (result.smallTargets.length ? `  small targets: ${result.smallTargets.length}` : ""),
    );
    await page.close();
  }
  await context.close();
}

await browser.close();
await writeFile("screenshots/report.json", JSON.stringify(report, null, 2));
console.log(`\n${failures ? `${failures} page(s) need fixes` : "No horizontal scrolling or iOS input zoom found"} · screenshots/ (${useWebkit ? "WebKit" : "Chromium"})`);
process.exit(failures ? 1 : 0);
