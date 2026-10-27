// Pure helpers used by the pipeline (no network, no state) — kept here so tests can import them.

export const decode = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

// Bing wraps links in a click tracker; the real article URL is its url= parameter.
export const unwrap = link => { try { return new URL(link).searchParams.get("url") || link; } catch { return link; } };

export function parseJson(text) {
  const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return JSON.parse(repairQuotes(raw)); }
}

// Models sometimes leave a bare " inside a string value (e.g. quoted event titles). Inside a string, a quote that is
// not followed by , : } ] is content, so escape it.
export function repairQuotes(s) {
  let out = "", inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && inStr) { out += c + s[++i]; continue; }
    if (c === '"') {
      if (!inStr) inStr = true;
      else if (/^\s*[,:}\]]/.test(s.slice(i + 1, i + 20))) inStr = false;
      else { out += '\\"'; continue; }
    }
    out += c;
  }
  return out;
}

export const norm = s => (s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");

// Same event reported under slightly different names: compare character bigrams (Dice) of name and Thai name.
export function similar(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b || (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)))) return true;
  const grams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) || 0) + 1); return m; };
  const ga = grams(a), gb = grams(b);
  let hit = 0;
  for (const [g, n] of ga) hit += Math.min(n, gb.get(g) || 0);
  return (2 * hit) / (a.length + b.length - 2) >= 0.6;
}

// One missing date may match (a later headline adds it); two missing dates only match on the exact name.
export const near = (a, b) => (!a && !b ? null : !a || !b || Math.abs(new Date(a) - new Date(b)) <= 3 * 864e5);

// Different editions (Comic Con 2026 vs 2027) must not merge.
export const years = s => (String(s || "").match(/20\d\d/g) || []).join();

// Record a date change or cancellation; the old dates are kept in history so the app can show "เดิมกำหนด …".
export const isDate = d => /^\d{4}-\d\d-\d\d$/.test(d || "");

// Same event under very different names (e.g. "งานหนังสือ 2569" vs "มหกรรมหนังสือระดับชาติ ครั้งที่ 31").
// Only pairs with the same dates (±1 day) and the same venue or city are asked about, and the model must be sure:
// big venues host several different events on the same days.
// Looser name match than similar(): shares at least 40% of character pairs. Only used to pick pairs for the AI to judge.
export function similarLoose(a, b) {
  a = norm(a); b = norm(b);
  if (a.length < 4 || b.length < 4) return false;
  const grams = s => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ga = grams(a), gb = grams(b);
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return hit / Math.min(ga.size, gb.size) >= 0.4;
}

export const dayGap = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;

export function extractText(rawHtml) {
  const html = rawHtml
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => decode(m[1])).filter(t => t.length > 30).join("\n");
  const main = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    || html.match(/<div[^>]+class="[^"]*\b(meat|article-body|article__body|entry-content|post-content|content-detail|news-content|detail)\b[^"]*"[\s\S]{0,60000}/i)?.[0]
    || html.match(/<body\b[\s\S]*<\/body>/i)?.[0] || "";
  const block = decode(main);
  return (block.length > paras.length * 1.3 ? block : paras || block).slice(0, 3500);
}
