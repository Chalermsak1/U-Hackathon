// Cache-Augmented Generation (CAG) for the static part of what U-Guard knows: the FAQ,
// glossary and method. The whole knowledge base is small (~2K tokens), so instead of
// retrieving pieces of it, it is preloaded into the system prompt, which providers cache
// (explicit cache_control on Claude; implicit prefix caching on OpenAI/Gemini). Fresh facts
// (news, prices, odds, unlocks) stay in tools: that part is RAG.

import knowledge from "../../data/knowledge/faq.json";

export interface FaqEntry {
  id: string;
  q: string;
  a: string;
  tags: string[];
}

export const FAQ: FaqEntry[] = (knowledge as { entries: FaqEntry[] }).entries;

export const KNOWLEDGE_BLOCK = `Reference knowledge (answer questions about U-Guard, U-Bot, terms and method from this; it is static and does not contain market data):\n\n${FAQ.map(
  (e) => `Q: ${e.q}\nA: ${e.a}`,
).join("\n\n")}`;

const STOP = new Set("a an the is are do does what whats how why can i you it of to in for and or my me this that with".split(" "));

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/u-guard/g, "uguard")
    .replace(/u-bot/g, "ubot")
    .split(/[^a-z0-9฀-๿]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Best FAQ entry for a question, or null when nothing matches well enough. */
export function matchFaq(question: string): FaqEntry | null {
  const q = new Set(words(question));
  if (q.size === 0) return null;
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of FAQ) {
    const tags = new Set(entry.tags.map((t) => t.toLowerCase().replace(/u-guard/, "uguard").replace(/u-bot/, "ubot")));
    const title = new Set(words(entry.q));
    let score = 0;
    for (const w of q) {
      if (tags.has(w)) score += 2;
      if (title.has(w)) score += 1;
    }
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 3 ? best.entry : null;
}

export const FAQ_SUGGESTIONS = [
  "What is U-Guard?",
  "How is the risk score calculated?",
  "Is this investment advice?",
  "What happens when I approve a rule?",
];
