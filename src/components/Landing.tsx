"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp, Reveal, Spotlight } from "./fx";
import { GuardMark } from "./GuardMark";
import { GuardWatch } from "./GuardWatch";

const SECTIONS = [
  { id: "home", th: "หน้าแรก" },
  { id: "problem", th: "ปัญหา" },
  { id: "features", th: "ฟีเจอร์" },
  { id: "demo", th: "Demo" },
  { id: "method", th: "ทำงานอย่างไร" },
  { id: "faq", th: "FAQ" },
];

const ROTATING = ["เงินจะขยับ", "เหรียญจะปลดล็อก", "ตลาดจะเทขาย"];

const PARTNERS = ["Tokenomist", "ElevenLabs", "Avalanche", "U-topia · U-Bot", "Visa Intelligent Commerce", "Claude"];

const FEATURES = [
  { n: "01", title: "เช็กก่อนซื้อ", desc: "พิมพ์ \"ซื้อ ARB 5,000 บาท\" แล้ว agent ดึงตาราง unlock, ผู้รับ และรอบระดมทุน มาคำนวณความเสี่ยงด้วยโค้ดก่อนเงินขยับ", href: "/terminal/agent" },
  { n: "02", title: "ภาษาไทย 3 บรรทัด + เสียง", desc: "สรุปสั้นที่มือใหม่อ่านเข้าใจ พูดถามด้วยเสียง และฟังคำตอบด้วย ElevenLabs พร้อมสรุปเป็น PDF", href: "/terminal/agent" },
  { n: "03", title: "คุณเป็นคนอนุมัติ", desc: "U-Guard เสนอการป้องกันเท่านั้น เมื่อคุณกดอนุมัติ กฎจะถูกบันทึกบน Avalanche ให้ตรวจสอบได้", href: "/terminal/trade" },
  { n: "04", title: "Terminal + Forecast", desc: "screener, ปฏิทินปลดล็อก, supply ล่วงหน้า 6 เดือน, พอร์ต และการแจ้งเตือน ในที่เดียว", href: "/terminal" },
];

const DEMOS = [
  { tag: "Terminal", badge: "ใหม่", title: "U-Guard Terminal", desc: "ภาพรวม, ถาม AI, screener 25 เหรียญ และปฏิทินปลดล็อก", tags: ["Screener", "Unlocks", "⌘K"], href: "/terminal" },
  { tag: "Trade", badge: "U-Bot", title: "เทรดพร้อม AI ร่างแผน", desc: "เลือกเหรียญและงบเอง U-Bot ร่างแผน ตรวจความเสี่ยง แล้วคุณเป็นคนอนุมัติ", tags: ["Plan", "Approval", "Paper trade"], href: "/terminal/trade" },
  { tag: "Token", badge: "Forecast", title: "Supply Mode: ARB", desc: "92.65M ARB ปลดล็อกทุกเดือนจนถึง มี.ค. 2027 พร้อมกราฟแยกผู้รับ", tags: ["Allocation", "Fundraising"], href: "/terminal/tokens/ARB" },
  { tag: "Portfolio", badge: "Dilution", title: "พอร์ตของฉัน", desc: "มูลค่าที่เสี่ยง, การกระจุกตัว และสัดส่วนที่จะลดลงใน 6 เดือน", tags: ["Risk", "PDF"], href: "/terminal/portfolio" },
  { tag: "Alerts", badge: "U-Bot", title: "การแจ้งเตือนอัจฉริยะ", desc: "ตั้งกฎว่าอยากให้เตือนเมื่อไร และดูประวัติการอนุมัติ", tags: ["Rules", "Decisions"], href: "/terminal/alerts" },
  { tag: "Calendar", badge: "30 วัน", title: "ปฏิทินปลดล็อก", desc: "unlock ที่ใกล้ถึงพร้อมคะแนน และเหตุการณ์ในตลาดที่มีแหล่งข้อมูลกำกับทุกแถว", tags: ["Keyrock", "Tokenomist"], href: "/terminal/unlocks" },
];

const STEPS = [
  { k: "Perceive", th: "รับคำสั่ง", d: "คำถามจากแชต, เสียง หรือการสแกนพอร์ต" },
  { k: "Plan", th: "วางแผน", d: "agent เลือกเองว่าต้องใช้ tool ไหน" },
  { k: "Act", th: "ดึงข้อมูล", d: "Tokenomist, ราคา, พอร์ต" },
  { k: "Score", th: "คำนวณ", d: "โค้ดให้คะแนน ไม่ใช่ AI เดา" },
  { k: "Explain", th: "อธิบาย", d: "ไทย 3 บรรทัด + เสียง + PDF" },
  { k: "Approve", th: "คุณอนุมัติ", d: "บันทึกบน Avalanche" },
];

const FAQ = [
  { q: "U-Guard แนะนำให้ซื้อหรือขายไหม?", a: "ไม่ U-Guard ให้ข้อมูลประกอบการตัดสินใจเท่านั้น การแนะนำการลงทุนสินทรัพย์ดิจิทัลในไทยต้องมีใบอนุญาตที่ปรึกษาจาก ก.ล.ต. ทุก action ต้องให้คุณกดอนุมัติเอง" },
  { q: "ข้อมูลมาจากไหน?", a: "ตาราง unlock, allocation และการระดมทุนจาก Tokenomist · ราคาและ volume จาก CoinGecko · ทุกการ์ดแสดงแหล่งข้อมูลและบอกชัดเจนว่าเป็นข้อมูลสดหรือข้อมูลตัวอย่าง" },
  { q: "ทำไมไม่เตือนทุก unlock?", a: "เพราะไม่ใช่ทุก unlock กดราคา งานวิจัยพบว่า unlock ของทีมกดราคาแรงที่สุด ส่วนกองทุน ecosystem มักไม่กด U-Guard จึงให้คะแนนตามขนาด, สภาพคล่อง และผู้รับ" },
  { q: "ทำงานกับ U-Bot อย่างไร?", a: "U-Guard ถูกออกแบบเป็น skill ที่ U-Bot (orchestrator ของ U-topia) เรียกก่อนทำธุรกรรม และส่งแจ้งเตือนกลับผ่าน U-Bot ตอนนี้ต่อผ่าน adapter ที่รองรับ webhook" },
  { q: "ทำไมบันทึกบน Avalanche?", a: "เพื่อให้การอนุมัติของคุณตรวจสอบได้และแก้ไขย้อนหลังไม่ได้ demo ใช้ Fuji testnet เท่านั้น ไม่มีเงินจริง" },
];

// Platform page: loader → story → proof → enter the terminal.
export function Landing() {
  const [active, setActive] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [word, setWord] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<number | null>(null);

  // Loader: first visit of the session only, closes when real data arrives.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("ug-loaded") === "1";
      sessionStorage.setItem("ug-loaded", "1");
    } catch {
      seen = true;
    }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLoading(true);
    // Stay up long enough for the mark to finish drawing itself (~1.4s), never past 1.8s.
    const t0 = performance.now();
    const done = setTimeout(() => setLoading(false), 1800);
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((b) => {
        setFound(b.items?.length ?? 0);
        setTimeout(() => setLoading(false), Math.max(400, 1500 - (performance.now() - t0)));
      })
      .catch(() => setLoading(false));
    return () => clearTimeout(done);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setWord((w) => (w + 1) % ROTATING.length), 2600);
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      clearInterval(t);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="lp">
      {loading && (
        <div className="lp-loader" role="status" aria-live="polite">
          <GuardMark size={72} />
          <p>กำลังสแกนปฏิทินปลดล็อก…</p>
          <small>{found === null ? "เชื่อมต่อ Tokenomist" : `พบ ${found} unlock ใน 30 วัน`}</small>
        </div>
      )}

      <header className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`}>
        <a href="#home" className="lp-logo">
          <span className="lp-logo-dot" aria-hidden="true" />
          U-GUARD
        </a>
        <nav className="lp-pills" aria-label="ส่วนของหน้า">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
              {s.th}
            </a>
          ))}
        </nav>
        <Link href="/en" className="lp-lang" lang="en" title="English version">
          EN
        </Link>
        <Link href="/terminal" className="lp-cta">
          เข้าสู่ Terminal →
        </Link>
      </header>

      <section id="home" className="lp-hero">
        <div className="lp-dots" aria-hidden="true" />
        <div className="lp-hero-copy">
          <span className="lp-chip">
            <i /> Agentic AI ใน U-Bot · U-Hackathon 2026
          </span>
          <h1>
            รู้ก่อน
            <br />
            {/* The wrapper animates; the inner span carries the gradient text. Animating a
                background-clip:text element directly can leave it unpainted in Chromium. */}
            <span key={word} className="lp-rotate">
              <span className="lp-grad">{ROTATING[word]}</span>
            </span>
          </h1>
          <p className="lp-quote">&ldquo;Retail no longer finds out last.&rdquo;</p>
          <p className="lp-lead">
            U-Guard เช็ก <b>ตาราง unlock</b> ของเหรียญก่อนคุณซื้อหรือถือ อธิบายเป็น <b>ภาษาไทย 3 บรรทัด</b> พร้อมเสียง และให้ <b>คุณเป็นคนอนุมัติ</b> ทุกครั้ง
          </p>
          <div className="lp-buttons">
            <Link href="/terminal" className="lp-btn lp-btn-primary">
              เข้าสู่ Terminal →
            </Link>
            <Link href="/terminal/agent" className="lp-btn">
              คุยกับ U-Bot
            </Link>
          </div>
          <div className="lp-tags">
            {["Supply risk", "Thai voice", "Human approval", "On-chain receipt"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="lp-visual">
          <GuardWatch />
        </div>
      </section>

      <div className="lp-marquee" aria-label="ข้อมูลและเทคโนโลยีที่ใช้">
        <p>ข้อมูลและเทคโนโลยีที่ใช้</p>
        <div className="lp-marquee-track">
          {[...PARTNERS, ...PARTNERS, ...PARTNERS].map((p, i) => (
            <span key={i} aria-hidden={i >= PARTNERS.length}>
              {p}
            </span>
          ))}
        </div>
      </div>

      <section id="problem" className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-chip">
            <i /> THE PROBLEM
          </span>
          <h2 className="lp-grad">รายย่อยรู้เป็นคนสุดท้าย</h2>
          <p>เหรียญถูกปลดล็อกตามตารางที่ประกาศไว้ล่วงหน้า ข้อมูลมีอยู่จริง แต่ไม่เคยโผล่มาตอนที่คุณกำลังกดซื้อ</p>
        </Reveal>
        <div className="lp-stats">
          {[
            { v: 97.4, f: (n: number) => `$${n.toFixed(1)}B`, l: "ปลดล็อกทั้งปี 2025", s: "Tokenomist" },
            { v: 90, f: (n: number) => `${Math.round(n)}%`, l: "ของ unlock กดราคา", s: "Keyrock, 16,000+ events" },
            { v: 30, f: (n: number) => `~${Math.round(n)} วัน`, l: "ราคาเริ่มถูกกดก่อน unlock", s: "Keyrock" },
            { v: 92.6, f: (n: number) => `${n.toFixed(1)}M`, l: "ARB ปลดล็อก 16 ต.ค.", s: "Tokenomist" },
          ].map((st, i) => (
            <Reveal key={st.l} delay={i * 80}>
              <Spotlight className="lp-stat">
                <b className="lp-grad">
                  <CountUp value={st.v} format={st.f} />
                </b>
                <span>{st.l}</span>
                <small>{st.s}</small>
              </Spotlight>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="lp-mission">
            <h3>MISSION</h3>
            <p>
              เราสร้าง <b>safety layer ของ agentic banking</b> ที่ทำงาน<b>ก่อนเงินขยับ</b> ไม่ทายราคา แต่ forecast <b>supply</b> ซึ่งเป็นตัวแปรเดียวที่รู้ล่วงหน้าได้จริง
              สำหรับคนไทยอายุ 20 ปีขึ้นไป <b>ตั้งแต่มือใหม่จนถึงมือโปร</b>
            </p>
            <a href="#features">ดูว่าทำอะไรได้บ้าง →</a>
          </div>
        </Reveal>
      </section>

      <section id="features" className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-chip">
            <i /> WHAT IT DOES
          </span>
          <h2 className="lp-grad">ฟีเจอร์หลัก</h2>
          <p>จากคำถามหนึ่งข้อ ไปจนถึงการอนุมัติที่ตรวจสอบได้</p>
        </Reveal>
        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.n} delay={i * 80}>
              <Spotlight className="lp-feature">
                <span className="lp-num">{f.n}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <Link href={f.href}>ลองใน demo →</Link>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="demo" className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-chip">
            <i /> LIVE DEMO
          </span>
          <h2 className="lp-grad">ลองใช้งานจริง</h2>
          <p>ทุกการ์ดเปิดหน้าที่ทำงานได้จริงใน demo นี้</p>
        </Reveal>
        <div className="lp-demos">
          {DEMOS.map((d, i) => (
            <Reveal key={d.title} delay={(i % 3) * 80}>
              <Link href={d.href} className="lp-demo-link">
                <Spotlight className="lp-demo">
                  <div className="lp-demo-top">
                    <span>{d.tag}</span>
                    <em>{d.badge}</em>
                  </div>
                  <h3>{d.title}</h3>
                  <p>{d.desc}</p>
                  <div className="lp-demo-tags">
                    {d.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </Spotlight>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="method" className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-chip">
            <i /> HOW IT WORKS
          </span>
          <h2 className="lp-grad">Agent ทำงานอย่างไร</h2>
          <p>ตัวเลขทุกตัวมาจาก tool และโค้ด · AI ทำหน้าที่วางแผนและอธิบาย · คุณเป็นคนตัดสินใจ</p>
        </Reveal>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.k} delay={i * 70}>
              <div className="lp-step">
                <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
                <b>{s.th}</b>
                <small>{s.k}</small>
                <p>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="lp-score">
            <div>
              <h3>คะแนนความเสี่ยง (v0)</h3>
              <p>เวลา × (0.35 ขนาด + 0.30 สภาพคล่อง + 0.35 ผู้รับ) + โบนัสกำไรนักลงทุน</p>
            </div>
            <ul>
              <li><i style={{ background: "var(--coral)" }} /> ทีม: กดราคาแรงที่สุด (เฉลี่ย −25%)</li>
              <li><i style={{ background: "var(--amber)" }} /> นักลงทุน: มัก hedge / OTC</li>
              <li><i style={{ background: "var(--teal)" }} /> กองทุน ecosystem: มักไม่กดราคา</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section id="faq" className="lp-section">
        <Reveal className="lp-head">
          <span className="lp-chip">
            <i /> FAQ
          </span>
          <h2 className="lp-grad">คำถามที่พบบ่อย</h2>
        </Reveal>
        <div className="lp-faq">
          {FAQ.map((f, i) => (
            <div key={f.q} className={`lp-faq-item ${open === i ? "lp-faq-open" : ""}`}>
              <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {f.q}
                <span aria-hidden="true">{open === i ? "−" : "+"}</span>
              </button>
              <div className="lp-faq-body">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section lp-final">
        <Reveal className="lp-head">
          <h2>
            พร้อม<span className="lp-grad">รู้ก่อน</span>แล้วหรือยัง?
          </h2>
          <p>เปิด Terminal แล้วถามเรื่องเหรียญแรกของคุณ</p>
          <div className="lp-buttons" style={{ justifyContent: "center" }}>
            <Link href="/terminal" className="lp-btn lp-btn-primary">
              เข้าสู่ Terminal →
            </Link>
            <Link href="/terminal/agent" className="lp-btn">
              คุยกับ U-Bot
            </Link>
          </div>
        </Reveal>
        <footer className="lp-footer">
          U-Guard · U-Hackathon 2026 · ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน ·{" "}
          <Link href="/en" lang="en" style={{ color: "var(--teal-2)" }}>
            English version
          </Link>
        </footer>
      </section>

      <a href="#home" className={`lp-top ${scrolled ? "lp-top-show" : ""}`} aria-label="กลับขึ้นบน" style={{ "--p": progress } as React.CSSProperties}>
        ↑
      </a>
    </div>
  );
}
