// Input guard: runs before any model or tool sees the user's text.
//   - normalise and cap length
//   - BLOCK secrets: a self-custody wallet's worst failure is a user pasting their seed
//     phrase or private key into a chat. Never forward those anywhere.
//   - REDACT contact/ID data (emails, phone numbers, Thai ID numbers, card numbers)
//   - FLAG prompt-injection attempts (handled as plain text; the system prompt already
//     treats user text as a request, and the output guard still applies)

export const MAX_MESSAGE_CHARS = 600;
export const MAX_HISTORY_TURNS = 8;
export const MAX_HISTORY_CHARS = 1200;

export interface GuardResult {
  text: string;
  blocked: boolean;
  blockReason?: string;
  flags: string[];
  redactions: string[];
}

const INJECTION = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /disregard (your|the|all) (rules|instructions|guidelines)/i,
  /(reveal|print|show|repeat) (your|the) (system )?(prompt|instructions)/i,
  /\byou are now\b|\bact as (a|an|my)\b|\bdeveloper mode\b|\bjailbreak\b|\bDAN\b/i,
  /<\/?(system|assistant|tool)>|\[\/?INST\]|BEGIN SYSTEM PROMPT/i,
  /(ลืม|ไม่ต้องสนใจ|เพิกเฉย)(คำสั่ง|กฎ)/,
];

function looksLikeMnemonic(text: string): boolean {
  // A line (or the part after "seed:") made only of 12/15/18/21/24 short lowercase words:
  // the shape of a BIP-39 recovery phrase. Questions *about* seed phrases pass through.
  return text
    .toLowerCase()
    .split(/[\n:]/)
    .some((line) => {
      const words = line.trim().split(/[\s,]+/).filter(Boolean);
      return [12, 15, 18, 21, 24].includes(words.length) && words.every((w) => /^[a-z]{3,8}$/.test(w));
    });
}

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function sanitize(raw: string, max = MAX_MESSAGE_CHARS): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function guardInput(raw: unknown): GuardResult {
  const flags: string[] = [];
  const redactions: string[] = [];
  if (typeof raw !== "string" || raw.trim() === "") {
    return { text: "", blocked: true, blockReason: "Type a question first.", flags, redactions };
  }
  if (raw.length > MAX_MESSAGE_CHARS) flags.push(`truncated to ${MAX_MESSAGE_CHARS} characters`);
  let text = sanitize(raw);

  if (/\b(0x)?[0-9a-fA-F]{64}\b/.test(text) || looksLikeMnemonic(text)) {
    return {
      text: "",
      blocked: true,
      blockReason:
        "That looks like a seed phrase or private key, so it was not sent anywhere. U-Guard never needs it, and nobody legitimate will ever ask for it. If you shared it elsewhere, move your funds to a new wallet.",
      flags: ["secret detected"],
      redactions,
    };
  }

  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => {
    redactions.push("email");
    return "[email]";
  });
  text = text.replace(/\b\d[\d -]{11,22}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length === 13) {
      redactions.push("ID number");
      return "[id]";
    }
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      redactions.push("card number");
      return "[card]";
    }
    return m;
  });
  text = text.replace(/(\+?66|0)\s?[689]\d(?:[\s-]?\d){7}\b/g, () => {
    redactions.push("phone");
    return "[phone]";
  });

  if (INJECTION.some((re) => re.test(text))) flags.push("possible prompt injection (treated as plain text)");
  return { text, blocked: false, flags, redactions };
}

export function sanitizeHistory(history: unknown): { role: "user" | "assistant"; text: string }[] {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter(
      (t): t is { role: "user" | "assistant"; text: string } =>
        !!t && typeof t === "object" && (t.role === "user" || t.role === "assistant") && typeof t.text === "string",
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, text: sanitize(t.text, MAX_HISTORY_CHARS) }))
    .filter((t) => t.text !== "");
  // Conversations sent to a model must start with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
