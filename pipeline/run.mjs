// Daily pipeline: fetch news headlines → AI extracts offline events → poster/link enrichment → data/events.json.
// Usage: node pipeline/run.mjs [--fetch-only | --tidy] [--window=7d] [--max-batches=40]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { COUNTRIES, TAGS, EVENT_WORDS, feeds } from "./sources.mjs";
import { extract, hasKeys, ORDERS, BillingStop } from "./tenixe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw.json");
const EVENTS = path.join(ROOT, "data", "events.json");
const arg = (name, def) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const FETCH_ONLY = process.argv.includes("--fetch-only");
const TIDY = process.argv.includes("--tidy"); // no fetch, no AI: only dedupe + enrich
const WINDOW = arg("window", "7d");
const MAX_BATCHES = Number(arg("max-batches", 40));
const BATCH = 20;
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
const today = new Date().toISOString().slice(0, 10);

const load = (f, def) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : def);
const save = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const decode = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };
// Bing wraps links in a click tracker; the real article URL is its url= parameter.
const unwrap = link => { try { return new URL(link).searchParams.get("url") || link; } catch { return link; } };

async function fetchHeadlines(raw) {
  let added = 0, skipped = 0;
  for (const [country, c] of Object.entries(COUNTRIES)) {
    for (const [t, queries] of Object.entries(c.queries)) {
      for (const q of queries) {
        for (const url of feeds(country, q, WINDOW)) {
          try {
            const xml = await (await fetch(url, { headers: UA })).text();
            for (const item of xml.split("<item>").slice(1)) {
              const source = tag(item, "source") || tag(item, "News:Source");
              const title = tag(item, "title").replace(` - ${source}`, "");
              const id = crypto.createHash("sha1").update(country + title).digest("hex").slice(0, 12);
              if (raw[id]) { if (!raw[id].tags.includes(t)) raw[id].tags.push(t); continue; }
              const desc = url.includes("news.google") ? "" : tag(item, "description").slice(0, 200);
              const ok = EVENT_WORDS.test(title + desc);
              raw[id] = { id, country, tags: [t], title, desc, source, link: unwrap(tag(item, "link")), image: tag(item, "News:Image") || null,
                date: new Date(tag(item, "pubDate")).toISOString().slice(0, 10), status: ok ? "new" : "skip" };
              ok ? added++ : skipped++;
            }
          } catch (e) { console.warn(`[fetch] ${country}/${q}: ${e.message}`); }
          await sleep(url.includes("news.google") ? 1500 : 500);
        }
      }
    }
  }
  return `${added} new, ${skipped} skipped (no event words)`;
}

const PROMPT = `You extract real-world, IN-PERSON public events from news headlines (Thailand, Japan, China).
Today is ${today}. Keep only events people can physically attend at a venue: conventions, exhibitions, expos, game shows,
anime/comic/doujin events, cosplay events, fan meetings, concerts, festivals, premieres, tech/AI conferences, car launch
events, motor shows, food festivals, art exhibitions, fairs, pop-ups. SKIP: online/livestream-only events, product/game/anime/
movie releases without a public venue event, sales, general news, and events that already ended before today.
Several headlines about the same event → one entry listing all their indices. Use each headline's date to infer the year.
Tags (pick 1-3): ${Object.entries(TAGS).map(([k, v]) => `${k}=${v}`).join(", ")}.
Reply with valid JSON only. Never put the " character inside a string value (use 「」 or ' instead).
{"events":[{"i":[0,3],"name":"official name (original language)","name_th":"Thai name","start":"YYYY-MM-DD or null",
"end":"YYYY-MM-DD or null","venue":"venue or null","city":"city or null","country":"TH|JP|CN","tags":["anime"],
"summary_th":"one short Thai sentence"}]}`;

function parseJson(text) {
  const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return JSON.parse(repairQuotes(raw)); }
}

// Models sometimes leave a bare " inside a string value (e.g. quoted event titles). Inside a string, a quote that is
// not followed by , : } ] is content, so escape it.
function repairQuotes(s) {
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

const norm = s => (s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");

// Same event reported under slightly different names: compare character bigrams (Dice) of name and Thai name.
function similar(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b || (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)))) return true;
  const grams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) || 0) + 1); return m; };
  const ga = grams(a), gb = grams(b);
  let hit = 0;
  for (const [g, n] of ga) hit += Math.min(n, gb.get(g) || 0);
  return (2 * hit) / (a.length + b.length - 2) >= 0.6;
}

const near = (a, b) => !a || !b || Math.abs(new Date(a) - new Date(b)) <= 3 * 864e5;
const sameEvent = (e, f) => e.country === f.country && near(e.start, f.start)
  && (similar(e.name, f.name) || similar(e.name_th, f.name_th) || similar(e.name, f.name_th) || similar(e.name_th, f.name));

function merge(events, found, items) {
  let added = 0;
  for (const f of found) {
    if (!f.name || !["TH", "JP", "CN"].includes(f.country)) continue;
    if (f.end && f.end < today) continue;
    const sources = (f.i || []).map(i => items[i]).filter(Boolean)
      .map(r => ({ title: r.title, link: r.link, source: r.source, date: r.date, image: r.image }));
    const tags = (f.tags || []).filter(t => TAGS[t]);
    const ev = events.find(e => sameEvent(e, f));
    if (ev) {
      for (const k of ["start", "end", "venue", "city", "name_th", "summary_th"]) ev[k] ??= f[k] ?? null;
      ev.tags = [...new Set([...ev.tags, ...tags])];
      for (const s of sources) if (!ev.sources.some(x => x.link === s.link)) { ev.sources.push(s); ev.enriched = false; }
      ev.updated = today;
    } else {
      events.push({ id: crypto.createHash("sha1").update(f.country + norm(f.name) + (f.start || "")).digest("hex").slice(0, 12),
        name: f.name, name_th: f.name_th ?? null, start: f.start ?? null, end: f.end ?? f.start ?? null, venue: f.venue ?? null,
        city: f.city ?? null, country: f.country, tags, summary_th: f.summary_th ?? null, image: null, official: null,
        sources, added: today, updated: today });
      added++;
    }
  }
  return added;
}

// Poster + official link from the news article itself (no AI): og:image, and an outbound link that looks official.
const OFFICIAL_TEXT = /公式|official|เว็บไซต์|รายละเอียดเพิ่มเติม|官网|官方|ticket|チケット|購票|特設サイト|詳細はこちら/i;
// Social links in articles are almost always the news outlet's own pages, not the event's.
const NOT_OFFICIAL = /facebook\.com|twitter\.com|\/\/(www\.)?x\.com|instagram\.com|youtube\.com|tiktok\.com|line\.me|google\.|bing\.|apple\.com|javascript:/i;

async function enrich(ev) {
  for (const s of ev.sources) {
    if (/news\.google\./.test(s.link)) continue;
    try {
      const res = await fetch(s.link, { headers: UA, signal: AbortSignal.timeout(10000) });
      const html = (await res.text()).slice(0, 600000);
      const og = ogImage(html);
      if (og && !ev.image) ev.image = new URL(decode(og), s.link).href;
      if (!ev.official) {
        const host = new URL(s.link).hostname.replace(/^www\./, "");
        const words = (ev.name.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(w => !/2026|2027|event|show|festival/.test(w));
        for (const m of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
          const href = decode(m[1]), text = decode(m[2]);
          let h; try { h = new URL(href).hostname.replace(/^www\./, ""); } catch { continue; }
          if (h === host || h.endsWith("." + host) || NOT_OFFICIAL.test(href)) continue;
          if (OFFICIAL_TEXT.test(text) || words.some(w => h.includes(w))) { ev.official = href; break; }
        }
      }
    } catch {}
    if (ev.image && ev.official) break;
  }
  ev.image ??= ev.sources.find(s => s.image)?.image ?? null;
  ev.enriched = true;
}

const ogImage = html => (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
  || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i))?.[1];

// No poster from the event's own news (e.g. Google-only links): search Bing News by event name and take the
// first thumbnail, or the og:image of the first articles found.
async function searchImage(ev) {
  ev.imageTried = true;
  const cc = { TH: "&cc=TH", JP: "&cc=JP" }[ev.country] || "";
  try {
    const xml = await (await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(ev.name)}&format=rss${cc}`, { headers: UA })).text();
    const items = xml.split("<item>").slice(1, 5);
    ev.article ??= items[0] ? unwrap(tag(items[0], "link")) : null; // used later for the event description
    const withThumb = items.find(i => tag(i, "News:Image"));
    if (withThumb) return (ev.image = tag(withThumb, "News:Image"));
    for (const i of items) {
      const link = unwrap(tag(i, "link"));
      try {
        const og = ogImage((await (await fetch(link, { headers: UA, signal: AbortSignal.timeout(10000) })).text()).slice(0, 300000));
        if (og) return (ev.image = new URL(decode(og), link).href);
      } catch {}
    }
  } catch {}
}

// Readable text of a news article: paragraph contents only, which skips most menus and footers.
async function articleText(url) {
  const html = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) })).text();
  const paras = [...html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decode(m[1])).filter(t => t.length > 30);
  return paras.join("\n").slice(0, 3500);
}

const DESCRIBE = `You write event details for a Thai event calendar app, using ONLY the given news text. Never invent facts.
Reply with valid JSON only (no " inside string values):
{"about_th":"3-4 Thai sentences: what the event is, who it is for, what you can do or see there",
"highlights_th":["up to 5 short Thai bullet points: guests, activities, exhibitors, special items"],
"hours":"opening hours or null","price_th":"ticket price / free entry in Thai, or null","ticket_url":"ticket/official URL found in the text, or null"}`;

// Richer details for the app's event page, from the article text (falls back to the headlines).
async function describe(ev) {
  const urls = [...ev.sources.map(s => s.link).filter(l => !/news\.google\./.test(l)), ev.article].filter(Boolean);
  let text = "";
  for (const u of urls.slice(0, 2)) { try { text = await articleText(u); } catch {} if (text.length > 300) break; }
  const context = `Event: ${ev.name} (${ev.start || "date unknown"}, ${[ev.venue, ev.city].filter(Boolean).join(", ")})\n` +
    `Headlines:\n${ev.sources.slice(0, 5).map(s => "- " + s.title).join("\n")}\n\nArticle:\n${text || "(none)"}`;
  const { text: out } = await extract([{ role: "system", content: DESCRIBE }, { role: "user", content: context }], ORDERS.describe);
  const d = parseJson(out);
  ev.about_th = d.about_th || null;
  ev.highlights_th = Array.isArray(d.highlights_th) ? d.highlights_th.slice(0, 5) : [];
  ev.hours = d.hours || null;
  ev.price_th = d.price_th || null;
  if (d.ticket_url && /^https?:\/\//.test(d.ticket_url) && text.includes(d.ticket_url)) ev.official ??= d.ticket_url;
  ev.described = true;
}

const raw = load(RAW, {});
if (!TIDY) console.log(`[fetch] window=${WINDOW}: ${await fetchHeadlines(raw)}`);
save(RAW, raw);
if (FETCH_ONLY) process.exit(0);

// Broken JSON usually comes from one odd headline; retry as two halves so the rest still gets through.
async function extractBatch(items, label) {
  const user = items.map((r, n) => `${n}. [${r.date}] ${r.title}${r.desc ? ` — ${r.desc}` : ""}`).join("\n");
  const { model, text } = await extract([{ role: "system", content: PROMPT }, { role: "user", content: user }]);
  let found;
  try { found = parseJson(text).events || []; } catch (e) {
    if (items.length < 4) { for (const r of items) r.status = "failed"; throw e; }
    const half = Math.ceil(items.length / 2);
    console.warn(`[extract] ${label}: bad JSON, retrying as two halves`);
    return (await extractBatch(items.slice(0, half), `${label}a`)) + (await extractBatch(items.slice(half), `${label}b`));
  }
  const n = merge(events, found, items);
  for (const r of items) r.status = "done";
  console.log(`[extract] ${label}: ${model} → +${n} events`);
  return n;
}

const events = load(EVENTS, []);
const pending = Object.values(raw).filter(r => r.status === "new");
let batches = 0, added = 0;
for (const country of TIDY ? [] : Object.keys(COUNTRIES)) {
  const list = pending.filter(r => r.country === country);
  for (let i = 0; i < list.length && batches < MAX_BATCHES; i += BATCH, batches++) {
    try {
      added += await extractBatch(list.slice(i, i + BATCH), `${country} batch ${i / BATCH + 1}`);
    } catch (e) {
      if (e instanceof BillingStop) { console.error(e.message); break; }
      console.warn(`[extract] ${country} batch failed: ${e.message.slice(0, 200)}`);
    }
    save(RAW, raw);
    save(EVENTS, events);
  }
}

for (const e of events) if (e.official && NOT_OFFICIAL.test(e.official)) e.official = null;

// Fold duplicates left by earlier runs into the first copy.
for (let i = events.length - 1; i > 0; i--) {
  const keep = events.slice(0, i).find(e => sameEvent(e, events[i]));
  if (!keep) continue;
  const dup = events.splice(i, 1)[0];
  for (const k of ["start", "end", "venue", "city", "name_th", "summary_th", "image", "official"]) keep[k] ??= dup[k];
  keep.tags = [...new Set([...keep.tags, ...dup.tags])];
  for (const s of dup.sources) if (!keep.sources.some(x => x.link === s.link)) keep.sources.push(s);
}

const todo = events.filter(e => !e.enriched);
for (const ev of todo) await enrich(ev);
console.log(`[enrich] ${todo.length} events: ${todo.filter(e => e.image).length} with poster, ${todo.filter(e => e.official).length} with official link`);
const noImage = events.filter(e => !e.image && !e.imageTried);
for (const ev of noImage) { await searchImage(ev); await sleep(400); }
console.log(`[image search] ${noImage.length} events without poster: found ${noImage.filter(e => e.image).length}`);

// Upcoming events first; past ones never need details.
const MAX_DESCRIBE = Number(arg("max-describe", 40));
const toDescribe = events.filter(e => !e.described && (!e.end || e.end >= today)).slice(0, MAX_DESCRIBE);
let described = 0;
if (hasKeys()) for (const ev of toDescribe) {
  try { await describe(ev); described++; } catch (e) {
    if (e instanceof BillingStop) { console.error(e.message); break; }
    console.warn(`[describe] ${ev.name}: ${e.message.slice(0, 120)}`);
  }
  if (described % 10 === 0) save(EVENTS, events);
}
console.log(`[describe] ${described}/${toDescribe.length} events got details`);

events.sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
save(EVENTS, events);
console.log(`[done] +${added} new events, ${events.length} total, ${Object.values(raw).filter(r => r.status === "new").length} headlines still pending`);
