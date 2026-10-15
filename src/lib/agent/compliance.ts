// Reflect step: every reply is checked before it reaches the user.
//   1. No investment advice or price predictions (Thailand: advising on digital assets
//      needs an SEC licence), in English and Thai.
//   2. Every number in the reply must appear in a tool result or the user's own message.
//   3. Replies built on sample data say so.
// The harness asks an LLM to rewrite once on a failure, then falls back to the
// deterministic template.

const ADVICE_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\b(you|u)\s+(should|must|need to|ought to|have to)\s+(definitely\s+)?(buy|sell|hold|dump|ape|short|long|get out|exit)\b/i, why: "tells the user to trade" },
  { re: /\b(i|we)\s+(would\s+)?(recommend|suggest|advise)\s+(that\s+you\s+)?(to\s+)?(buy|sell|hold|buying|selling|holding|taking profit)/i, why: "recommends a trade" },
  { re: /\b(strong buy|buy now|sell now|buy the dip|sell everything|go all[- ]in|load up)\b/i, why: "trade call" },
  { re: /\bguarantee(d|s)?\b.{0,24}\b(profit|return|gain)s?\b/i, why: "promises returns" },
  { re: /\b(will|is going to|gonna|is set to|is about to)\s+(moon|pump|dump|crash|skyrocket|explode|go up|go down|rise|fall|rally|surge|tank|recover|rebound)\b/i, why: "price prediction" },
  { re: /\bprice target\b/i, why: "price target" },
  { re: /ควร(จะ)?\s*(ซื้อ|ขาย|ถือ|เข้า|ออก|เทขาย)/, why: "tells the user to trade (TH)" },
  { re: /แนะนำ(ให้)?\s*(ซื้อ|ขาย|ถือ|เข้าซื้อ)/, why: "recommends a trade (TH)" },
  { re: /(ซื้อ|ขาย)(เลย|ด่วน|ทันที)/, why: "trade call (TH)" },
  { re: /ราคา(จะ|น่าจะ|คงจะ)\s*(ขึ้น|ลง|พุ่ง|ร่วง|ดีด|ทะยาน)/, why: "price prediction (TH)" },
  { re: /(การันตี|รับประกัน)(ผล)?กำไร/, why: "promises returns (TH)" },
];

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i;

interface NumberToken {
  raw: string;
  value: number;
}

/** Numbers as written in text ("92.65M", "$18.4M", "1.56%", "฿5,000", "3.4x"). */
export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  const re = /[$฿]?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|[kKmMbBtT](?![a-zA-Z])|x\b|×)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 5), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 6);
    let value = Number(`${m[1].replace(/,/g, "")}${m[2] ?? ""}`);
    const unit = m[3]?.toLowerCase();
    if (unit === "k") value *= 1e3;
    else if (unit === "m") value *= 1e6;
    else if (unit === "b") value *= 1e9;
    else if (unit === "t") value *= 1e12;
    // Skip dates, years and citation markers: "Oct 16", "16 Oct", "2026", "[2]".
    if (MONTHS.test(before.trim().split(/\s+/).pop() ?? "") || MONTHS.test(after.trim())) continue;
    if (!unit && value >= 1990 && value <= 2100 && !m[2]) continue;
    if (/\[$/.test(before) && /^\]/.test(after)) continue;
    out.push({ raw: m[0].trim(), value });
  }
  return out;
}

function evidenceNumbers(evidence: string[]): number[] {
  const nums: number[] = [];
  for (const blob of evidence) {
    for (const m of blob.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)) nums.push(Math.abs(Number(m[0])));
    for (const t of extractNumbers(blob)) nums.push(Math.abs(t.value));
  }
  return nums;
}

function grounded(value: number, pool: number[]): boolean {
  const v = Math.abs(value);
  if (v <= 31 && Number.isInteger(v)) return true; // day counts, ranks, small counts
  return pool.some((p) => {
    if (p === 0) return v === 0;
    // Allow rounding ("92.65M" vs 92650000, "1.6%" vs 1.557, "$18M" vs 18437350).
    const scales = [1, 100, 0.01];
    return scales.some((s) => {
      const q = p * s;
      return Math.abs(q - v) / Math.max(Math.abs(q), 1e-9) <= 0.06 || Math.abs(q - v) < 0.051;
    });
  });
}

export interface ComplianceCheck {
  ok: boolean;
  issues: string[];
  reply: string; // possibly auto-fixed (sample label appended)
  fixed: boolean;
}

export function checkReply(reply: string, evidence: string[], opts: { userMessage: string; sampleUsed: boolean }): ComplianceCheck {
  const issues: string[] = [];
  for (const { re, why } of ADVICE_PATTERNS) {
    const hit = re.exec(reply);
    if (hit) issues.push(`Advice language (${why}): "${hit[0]}"`);
  }
  // 100: scores are reported "out of 100".
  const pool = [100, ...evidenceNumbers(evidence), ...extractNumbers(opts.userMessage).map((t) => t.value)];
  for (const t of extractNumbers(reply)) {
    if (!grounded(t.value, pool)) issues.push(`Number not found in tool results: ${t.raw}`);
  }

  let fixed = false;
  let out = reply.trim();
  if (opts.sampleUsed && !/(sample data|illustrative|ข้อมูลตัวอย่าง)/i.test(out)) {
    out = `${out} (sample data)`;
    fixed = true;
  }
  return { ok: issues.length === 0, issues, reply: out, fixed };
}
