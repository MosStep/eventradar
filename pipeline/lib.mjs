// Pure helpers used by the pipeline (no network, no state) — kept here so tests can import them.
import crypto from "node:crypto";

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

// Stable event id: the same country, name and start always give the same id.
export const eventId = (country, name, start) => crypto.createHash("sha1").update(country + norm(name) + (start || "")).digest("hex").slice(0, 12);

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

// What kind of AI error this is: "billing" (stop), "quota" (this key is spent), "rate" (the provider is busy, retry
// later), or "other" (bad request, timeout, bad JSON ...). Quota wording wins over a 429 status.
export function errorKind(msg) {
  const m = String(msg || "");
  if (/unpaid|add credits|wallet/i.test(m)) return "billing";
  if (/quota|insufficient|^402/i.test(m)) return "quota";
  if (/AI_PROVIDER_RATE|too many requests|rate.?limit|^429/i.test(m)) return "rate";
  return "other";
}

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

// Minimal CSV reader (quoted fields, commas and newlines inside quotes, "" escapes) for the Google Sheet export.
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

// Day + month mentions in an article (Thai, English, Japanese). Two or more distinct ones: the article may announce several dated events.
const DATE_MENTION = /\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d{1,2}月\d{1,2}日/gi;
export const dateMentions = text => new Set((String(text || "").match(DATE_MENTION) || []).map(m => m.replace(/\s+/g, "").toLowerCase()));

// The model's answer for a roundup article: {announcement, events}. Keeps entries with a name; drops tags outside the taxonomy.
export function cleanSplit(out, tagKeys) {
  const list = Array.isArray(out?.events) ? out.events : [];
  const str = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  return {
    announcement: out?.announcement === true,
    events: list.filter(e => str(e?.name, 120)).map(e => ({
      name: str(e.name, 120), name_th: str(e.name_th, 120), start: isDate(e.start) ? e.start : null, end: isDate(e.end) ? e.end : null,
      venue: str(e.venue, 80), city: str(e.city, 60), country: str(e.country, 8), summary_th: str(e.summary_th, 200),
      tags: (Array.isArray(e.tags) ? e.tags : []).filter(t => tagKeys.includes(t)),
    })),
  };
}

// Sliding-window rate limit: ms to wait before one more request may start. stamps = start times (ms, ascending) of the
// requests made so far; at most `limit` requests may start in any `windowMs` span.
export function rateWaitMs(stamps, now, limit, windowMs) {
  const recent = stamps.filter(t => t > now - windowMs);
  if (recent.length < limit) return 0;
  return recent[recent.length - limit] + windowMs - now;
}

// Shared limiter: await acquire() before each request. Callers in parallel share one budget; the check and the push
// happen in the same tick, so no two callers can take the same slot.
export function slidingLimiter(limit, windowMs, clock = { now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)) }) {
  const max = Math.max(1, Math.floor(limit));
  const stamps = [];
  return async function acquire() {
    for (;;) {
      const now = clock.now();
      while (stamps.length && stamps[0] <= now - windowMs) stamps.shift();
      const wait = rateWaitMs(stamps, now, max, windowMs);
      if (wait <= 0) { stamps.push(now); return; }
      await clock.sleep(wait);
    }
  };
}
