// Daily pipeline: fetch news headlines → AI extracts offline events → poster/link enrichment → data/events.json.
// Usage: node pipeline/run.mjs [--fetch-only | --tidy | --no-fetch] [--window=7d] [--max-batches=40]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { COUNTRIES, TAGS, TAXONOMY, EVENT_WORDS, feeds } from "./sources.mjs";
import { extract, hasKeys, nemotronKeys, ORDERS, BillingStop } from "./tenixe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw.json");
const EVENTS = path.join(ROOT, "data", "events.json");
const arg = (name, def) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const FETCH_ONLY = process.argv.includes("--fetch-only");
const TIDY = process.argv.includes("--tidy"); // no fetch, no extraction: only dedupe + enrich
const NO_FETCH = TIDY || process.argv.includes("--no-fetch"); // work through already-fetched headlines only
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

// Press-release feeds straight from organisers: exact dates and real event images, unlike news headlines.
const EXTRA_FEEDS = { JP: [["https://prtimes.jp/index.rdf", "PR TIMES"]] };

// Reads one RSS 2.0 / RSS 1.0 (RDF) feed into raw headlines. Returns [added, skipped].
async function readFeed(raw, country, t, url, sourceName = "") {
  let added = 0, skipped = 0;
  const xml = await (await fetch(url, { headers: UA })).text();
  for (const item of xml.split(/<item[\s>]/).slice(1)) {
    const source = tag(item, "source") || tag(item, "News:Source") || sourceName;
    const title = tag(item, "title").replace(` - ${source}`, "");
    const id = crypto.createHash("sha1").update(country + title).digest("hex").slice(0, 12);
    if (raw[id]) { if (!raw[id].tags.includes(t)) raw[id].tags.push(t); continue; }
    const desc = url.includes("news.google") ? "" : tag(item, "description").slice(0, 200);
    const ok = EVENT_WORDS.test(title + desc);
    const link = unwrap(tag(item, "link"));
    const when = new Date(tag(item, "pubDate") || tag(item, "dc:date"));
    raw[id] = { id, country, tags: [t], title, desc, source, link, image: LOGO_SITES.test(link) ? null : tag(item, "News:Image") || null,
      date: (isNaN(when) ? new Date() : when).toISOString().slice(0, 10), status: ok ? "new" : "skip" };
    ok ? added++ : skipped++;
  }
  return [added, skipped];
}

async function fetchHeadlines(raw) {
  let added = 0, skipped = 0;
  for (const [country, c] of Object.entries(COUNTRIES)) {
    for (const [t, queries] of Object.entries(c.queries)) {
      for (const q of queries) {
        for (const url of feeds(country, q, WINDOW)) {
          try { const [a, s] = await readFeed(raw, country, t, url); added += a; skipped += s; }
          catch (e) { console.warn(`[fetch] ${country}/${q}: ${e.message}`); }
          await sleep(url.includes("news.google") ? 1500 : 500);
        }
      }
    }
    for (const [url, name] of EXTRA_FEEDS[country] || []) {
      try { const [a, s] = await readFeed(raw, country, "expo", url, name); added += a; skipped += s; }
      catch (e) { console.warn(`[fetch] ${name}: ${e.message}`); }
    }
  }
  return `${added} new, ${skipped} skipped (no event words)`;
}

// Regions inside each country (web/regions.json), so the app can filter by ภาค / 地方 / 地区.
const REGIONS = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "regions.json"), "utf8"));
function regionCodes() { return Object.entries(REGIONS).map(([c, r]) => `${c}=${Object.keys(r).join("|")}`).join("; "); }
const validRegion = (country, r) => (r && REGIONS[country]?.[r] ? r : null);

const PROMPT = `You extract public EVENTS from news headlines (Thailand, Japan, China).
Today is ${today}. Keep events people can attend at a venue: conventions, exhibitions, expos, game shows, anime/comic/doujin
events, cosplay, fan meetings, concerts, festivals, stage shows, premieres, tech/AI conferences, car launches, motor shows,
food/drink festivals, art exhibitions, markets, pop-ups, sports, temple/shrine festivals, fireworks, fairs.
Also keep scheduled ONLINE events with a set date/time (online concerts, VTuber live streams/3D lives, online fan meetings,
showcase streams) and mark them "online":true.
If a headline says an event is postponed/rescheduled (延期, 日程変更, เลื่อน, 延期举办) give the NEW dates and status "postponed";
if it is cancelled (中止, ยกเลิก, 取消) give status "cancelled".
SKIP: product/game/anime/movie releases with no event, general news, and events that already ended before today.
Several headlines about the same event → one entry listing all their indices. Use each headline's date to infer the year.
Tags (pick 1-3): ${Object.entries(TAGS).map(([k, v]) => `${k}=${v}`).join(", ")}.
Reply with valid JSON only. Never put the " character inside a string value (use 「」 or ' instead).
{"events":[{"i":[0,3],"name":"official name (original language)","name_th":"Thai name","start":"YYYY-MM-DD or null",
"end":"YYYY-MM-DD or null","venue":"venue or null","city":"city or null","country":"TH|JP|CN","tags":["anime"],
"region":"region code or null","online":false,"status":"scheduled|postponed|cancelled","price_th":"short entry fee in Thai, max 40 characters (เข้าฟรี / 300 บาท / 500–2,500 บาท / ¥2,000), or null — only if stated",
"summary_th":"one short Thai sentence"}]}
Region codes: ${regionCodes()}.`;

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

// One missing date may match (a later headline adds it); two missing dates only match on the exact name.
const near = (a, b) => (!a && !b ? null : !a || !b || Math.abs(new Date(a) - new Date(b)) <= 3 * 864e5);
// Different editions (Comic Con 2026 vs 2027) must not merge.
const years = s => (String(s || "").match(/20\d\d/g) || []).join();
function sameEvent(e, f) {
  if (e.country !== f.country) return false;
  if (years(e.name) && years(f.name) && years(e.name) !== years(f.name)) return false;
  const n = near(e.start, f.start);
  if (n === null) return norm(e.name) === norm(f.name);
  return n && (similar(e.name, f.name) || similar(e.name_th, f.name_th) || similar(e.name, f.name_th) || similar(e.name_th, f.name));
}

// Record a date change or cancellation; the old dates are kept in history so the app can show "เดิมกำหนด …".
const isDate = d => /^\d{4}-\d\d-\d\d$/.test(d || "");
function reschedule(ev, f) {
  if (f.status === "cancelled") { if (ev.status !== "cancelled") { ev.status = "cancelled"; ev.changed = today; } return; }
  if (isDate(f.start) && f.start !== ev.start) {
    (ev.history ||= []).push({ start: ev.start, end: ev.end, until: today });
    ev.start = f.start; ev.end = isDate(f.end) ? f.end : f.start;
    ev.status = "postponed"; ev.changed = today;
  }
}

function merge(events, found, items) {
  let added = 0;
  for (const f of found) {
    if (!f.name || !["TH", "JP", "CN"].includes(f.country)) continue;
    if (f.end && f.end < today) continue;
    const sources = (f.i || []).map(i => items[i]).filter(Boolean)
      .map(r => ({ title: r.title, link: r.link, source: r.source, date: r.date, image: r.image }));
    const tags = (f.tags || []).filter(t => TAGS[t]);
    // A postponed or cancelled event may come back under new dates: match it by name alone (same year), never for
    // ordinary "scheduled" news, so recurring events with the same name (monthly markets) are not merged.
    const changing = f.status === "postponed" || f.status === "cancelled";
    const ev = events.find(e => sameEvent(e, f)) || (changing ? events.find(e => e.country === f.country
      && !(years(e.name) && years(f.name) && years(e.name) !== years(f.name))
      && (similar(e.name, f.name) || similar(e.name_th, f.name_th))) : null);
    if (ev && changing) reschedule(ev, f);
    if (ev) {
      for (const k of ["start", "end", "venue", "city", "name_th", "summary_th"]) ev[k] ??= f[k] ?? null;
      ev.region ??= validRegion(ev.country, f.region);
      ev.online ??= f.online === true;
      ev.price_th ??= f.price_th || null;
      ev.tags = [...new Set([...ev.tags, ...tags])];
      for (const s of sources) if (!ev.sources.some(x => x.link === s.link)) { ev.sources.push(s); ev.enriched = false; }
      ev.updated = today;
    } else {
      events.push({ id: crypto.createHash("sha1").update(f.country + norm(f.name) + (f.start || "")).digest("hex").slice(0, 12),
        name: f.name, name_th: f.name_th ?? null, start: f.start ?? null, end: f.end ?? f.start ?? null, venue: f.venue ?? null,
        city: f.city ?? null, country: f.country, region: validRegion(f.country, f.region), online: f.online === true, price_th: f.price_th || null, tags, summary_th: f.summary_th ?? null, image: null, official: null,
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
      if (og && !ev.image && posterOk(new URL(decode(og), s.link).href)) ev.image = new URL(decode(og), s.link).href;
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
  ev.image ??= ev.sources.find(s => s.image && posterOk(s.image))?.image ?? null;
  ev.enriched = true;
}

const ogImage = html => (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
  || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i))?.[1];

// A news site's default share image (its logo) is not a poster. Caught by name, or by being used for several events.
// Sites whose article thumbnails are their logo (Bing renders the site, not the event), or that sign image URLs
// with a short expiry (exp=…) so the poster disappears within hours.
const LOGO_SITES = /news\.yahoo\.co\.jp|yahoo\.com|msn\.com/i;
const GENERIC_IMAGE = /[?&]exp=\d+|logo|ogp?[_-]?default|default[_-]?(og|ogp|image|share)|noimage|no[_-]image|placeholder|common\/images|\/ogp\.(png|jpg)|share\.(png|jpg)|s\.yimg\.jp\/images\/news/i;
const genericImages = new Set();
const posterOk = url => url && !GENERIC_IMAGE.test(url) && !genericImages.has(url);

// No poster from the event's own news (e.g. Google-only links): search Bing News by event name and take the
// first thumbnail, or the og:image of the first articles found.
async function searchImage(ev) {
  ev.imageTried = true;
  ev.imageTriedAt = today;
  const cc = { TH: "&cc=TH", JP: "&cc=JP" }[ev.country] || "";
  try {
    const xml = await (await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(ev.name)}&format=rss${cc}`, { headers: UA })).text();
    const items = xml.split("<item>").slice(1, 5);
    ev.article ??= items[0] ? unwrap(tag(items[0], "link")) : null; // used later for the event description
    const withThumb = items.find(i => posterOk(tag(i, "News:Image")) && !LOGO_SITES.test(unwrap(tag(i, "link"))));
    if (withThumb) { ev.imageFrom = unwrap(tag(withThumb, "link")); return (ev.image = tag(withThumb, "News:Image")); }
    // A dead or logo-only article is skipped and the next one tried.
    for (const i of items) {
      const link = unwrap(tag(i, "link"));
      try {
        const og = ogImage((await (await fetch(link, { headers: UA, signal: AbortSignal.timeout(10000) })).text()).slice(0, 300000));
        if (og && posterOk(new URL(decode(og), link).href)) { ev.imageFrom = link; return (ev.image = new URL(decode(og), link).href); }
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
"hours":"opening hours or null","price_th":"short entry fee in Thai, max 40 characters (เข้าฟรี / 300 บาท / 500–2,500 บาท / ¥2,000), or null","ticket_url":"ticket/official URL found in the text, or null"}`;

// Richer details for the app's event page, from the article text (falls back to the headlines).
async function describe(ev, key = null) {
  const urls = [...ev.sources.map(s => s.link).filter(l => !/news\.google\./.test(l)), ev.article].filter(Boolean);
  let text = "";
  for (const u of urls.slice(0, 2)) { try { text = await articleText(u); } catch {} if (text.length > 300) break; }
  const context = `Event: ${ev.name} (${ev.start || "date unknown"}, ${[ev.venue, ev.city].filter(Boolean).join(", ")})\n` +
    `Headlines:\n${ev.sources.slice(0, 5).map(s => "- " + s.title).join("\n")}\n\nArticle:\n${text || "(none)"}`;
  const { text: out } = await extract([{ role: "system", content: DESCRIBE }, { role: "user", content: context }], ORDERS.describe, key);
  const d = parseJson(out);
  ev.about_th = d.about_th || null;
  ev.highlights_th = Array.isArray(d.highlights_th) ? d.highlights_th.slice(0, 5) : [];
  ev.hours = d.hours || null;
  ev.price_th = (d.price_th || ev.price_th || null)?.slice(0, 60) || null;
  if (d.ticket_url && /^https?:\/\//.test(d.ticket_url) && text.includes(d.ticket_url)) ev.official ??= d.ticket_url;
  ev.described = true;
}

const raw = load(RAW, {});
// Keep raw.json small: processed headlines older than 45 days are never needed again.
const cutoff = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
for (const [id, r] of Object.entries(raw)) if (r.status !== "new" && r.date < cutoff) delete raw[id];
if (!NO_FETCH) console.log(`[fetch] window=${WINDOW}: ${await fetchHeadlines(raw)}`);
save(RAW, raw);
if (FETCH_ONLY) process.exit(0);

// Broken JSON usually comes from one odd headline; retry as two halves so the rest still gets through.
async function extractBatch(items, label, key = null) {
  const user = items.map((r, n) => `${n}. [${r.date}] ${r.title}${r.desc ? ` — ${r.desc}` : ""}`).join("\n");
  const { model, text } = await extract([{ role: "system", content: PROMPT }, { role: "user", content: user }], ORDERS.extract, key);
  let found;
  try { found = parseJson(text).events || []; } catch (e) {
    if (items.length < 4) { for (const r of items) r.status = "failed"; throw e; }
    const half = Math.ceil(items.length / 2);
    console.warn(`[extract] ${label}: bad JSON, retrying as two halves`);
    return (await extractBatch(items.slice(0, half), `${label}a`, key)) + (await extractBatch(items.slice(half), `${label}b`, key));
  }
  const n = merge(events, found, items);
  for (const r of items) r.status = "done";
  console.log(`[extract] ${label}: ${model} → +${n} events`);
  return n;
}

const events = load(EVENTS, []);
// Upcoming events first: headlines that announce something ahead (เตรียมจัด, 開催決定, 即将 …), then newest first.
// Each country gets its own batch budget so China is not starved by Japan/Thailand.
const AHEAD = /เตรียมจัด|จะจัด|เปิดจอง|เปิดขายบัตร|เปิดรับสมัคร|ประกาศจัด|พบกัน|開催決定|開催予定|予定|チケット|先行|エントリー|即将|将于|将举办|开票|报名|预售|upcoming|announce|tickets/i;
const ahead = r => (AHEAD.test(r.title + r.desc) ? 1 : 0);
const pending = Object.values(raw).filter(r => r.status === "new")
  .sort((a, b) => ahead(b) - ahead(a) || b.date.localeCompare(a.date));
// Batches are queued country by country (interleaved), then run in parallel: one worker per Nemotron key.
let added = 0, stop = false;
const jobs = [];
for (const country of TIDY ? [] : Object.keys(COUNTRIES)) {
  const list = pending.filter(r => r.country === country);
  for (let i = 0, b = 0; i < list.length && b < MAX_BATCHES; i += BATCH, b++) jobs.push([b, country, list.slice(i, i + BATCH)]);
}
jobs.sort((x, y) => x[0] - y[0]);
const workerKeys = ORDERS.extract.startsWith("nemotron") && nemotronKeys().length ? nemotronKeys() : [null];
await Promise.all(workerKeys.map(async key => {
  while (jobs.length && !stop) {
    const [b, country, items] = jobs.shift();
    try { added += await extractBatch(items, `${country} batch ${b + 1}`, key); }
    catch (e) {
      if (e instanceof BillingStop) { console.error(e.message); stop = true; break; }
      console.warn(`[extract] ${country} batch failed: ${e.message.slice(0, 200)}`);
    }
    save(RAW, raw);
    save(EVENTS, events);
  }
}));

// China: Bilibili's ticket site (会员购) lists conventions, doujin events and IP exhibitions with exact dates,
// venue and the official poster — structured data, so no AI needed except for the Thai name.
const BILI_TAGS = [[/漫展/, ["anime", "comic"]], [/同人/, ["comic"]], [/演唱会|live/i, ["concert"]], [/音乐节/, ["festival"]],
  [/电竞/, ["esports"]], [/游戏/, ["game"]], [/话剧|音乐剧|舞台/, ["stage"]], [/脱口秀/, ["comedy"]], [/餐厅|咖啡|快闪|谷子/, ["market"]],
  [/展/, ["art"]]];
async function fetchBilibili() {
  const seen = new Map();
  for (let page = 1; page <= 20; page++) {
    let result = [];
    try {
      const url = `https://show.bilibili.com/api/ticket/project/listV2?version=134&page=${page}&pagesize=20&area=-1&filter=&platform=web&p_type=${encodeURIComponent("全部类型")}`;
      result = (await (await fetch(url, { headers: UA })).json()).data?.result || [];
    } catch { break; }
    const before = seen.size;
    for (const x of result) seen.set(x.id, x);
    if (seen.size === before) break; // the feed starts repeating
    await sleep(500);
  }
  let added = 0;
  for (const x of seen.values()) {
    if (!x.start_time || (x.end_time || x.start_time) < today) continue;
    const label = `${x.third_category_name || ""} ${x.project_name}`;
    const f = { name: x.project_name, start: x.start_time.slice(0, 10), end: (x.end_time || x.start_time).slice(0, 10),
      venue: x.venue_name || null, city: x.city || null, country: "CN",
      tags: BILI_TAGS.find(([re]) => re.test(label))?.[1] || ["anime"] };
    const source = { title: x.project_name, link: `https://show.bilibili.com/platform/detail.html?id=${x.id}`,
      source: "bilibili会员购", date: today, image: x.cover ? `https:${x.cover.replace(/^https?:/, "")}` : null };
    const before = events.length;
    merge(events, [{ ...f, i: [0] }], [source]);
    const ev = events.find(e => e.sources.some(s => s.link === source.link));
    if (ev) {
      ev.image ??= source.image;
      ev.official ??= source.link;
      ev.verified = true; // structured listing, no AI guesswork
      if (x.price_low) ev.price_th ??= x.isFree ? "เข้าฟรี" : `เริ่มต้น ¥${(x.price_low / 100).toFixed(0)}`;
    }
    added += events.length - before;
  }
  console.log(`[bilibili] ${seen.size} listings, +${added} new events`);
}
if (!NO_FETCH) await fetchBilibili();

// Thailand: Eventpop's public feed (featured events only — the full search needs a private API; see TODO.md).
const POP_TAGS = { concert: ["concert"], festival: ["festival"], exhibition: ["art"], sport: ["match"], sports: ["match"],
  workshop: ["workshop"], fanmeeting: ["fanmeet"], fan_meeting: ["fanmeet"], conference: ["expo"], seminar: ["expo"], theater: ["stage"] };
async function fetchEventpop() {
  let list = [];
  try { list = (await (await fetch("https://www.eventpop.me/api/v1/events?page=1&per_page=100", { headers: UA })).json()).events || []; }
  catch (e) { console.warn(`[eventpop] ${e.message}`); return; }
  let added = 0;
  for (const x of list) {
    const start = x.start_at?.slice(0, 10), end = (x.end_at || x.start_at)?.slice(0, 10);
    if (!start || end < today || (x.event_venue?.country && x.event_venue.country !== "Thailand")) continue;
    const place = (x.location_name || "").split(",").map(s => s.trim()).filter(Boolean);
    const types = (x.event_types || []).map(t => String(t.name).toLowerCase());
    const f = { name: x.title.trim(), start, end, venue: place[0] || null, city: place.length > 2 ? place[place.length - 2] : null, country: "TH",
      tags: types.flatMap(t => POP_TAGS[t] || []).filter((t, i, a) => a.indexOf(t) === i) };
    if (!f.tags.length) f.tags = ["expo"];
    const source = { title: f.name, link: `https://www.eventpop.me/e/${x.id}`, source: "Eventpop", date: today,
      image: x.posters?.large || x.covers?.cover || null };
    const before = events.length;
    merge(events, [{ ...f, i: [0] }], [source]);
    const ev = events.find(e => e.sources.some(s => s.link === source.link));
    if (ev) { ev.image ??= source.image; ev.official ??= source.link; ev.verified = true; }
    added += events.length - before;
  }
  console.log(`[eventpop] ${list.length} listings, +${added} new events`);
}
if (!NO_FETCH) await fetchEventpop();

// Undated events never show on the calendar. Look the event up by name and let the model read a date only if it is
// written there; drop events that are still undated and whose news is over 60 days old.
const MAX_DATES = Number(arg("max-dates", 30));
const DATE_PROMPT = `From the text, give the event's date(s) ONLY if they are written for this exact event. Never guess.
Today is ${today}. Reply with valid JSON only: {"start":"YYYY-MM-DD or null","end":"YYYY-MM-DD or null","venue":"or null","city":"or null"}`;
async function fillDates() {
  const old = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const undated = events.filter(e => !e.start && !e.dateTried).slice(0, MAX_DATES);
  let found = 0, dropped = 0;
  for (const ev of undated) {
    ev.dateTried = true;
    let text = "";
    try {
      const cc = { TH: "&cc=TH", JP: "&cc=JP" }[ev.country] || "";
      const xml = await (await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(ev.name)}&format=rss${cc}`, { headers: UA })).text();
      text = xml.split("<item>").slice(1, 6).map(i => `- ${tag(i, "title")} — ${tag(i, "description")}`).join("\n");
      const first = ev.sources.map(s => s.link).find(l => !/news\.google\./.test(l));
      if (first) text += `\n\nArticle:\n${(await articleText(first)).slice(0, 1500)}`;
    } catch {}
    try {
      const d = parseJson((await extract([{ role: "system", content: DATE_PROMPT },
        { role: "user", content: `Event: ${ev.name}\n${ev.sources.slice(0, 3).map(s => `- ${s.title}`).join("\n")}\n${text}` }], ORDERS.describe)).text);
      if (/^\d{4}-\d\d-\d\d$/.test(d.start || "")) {
        ev.start = d.start; ev.end = /^\d{4}-\d\d-\d\d$/.test(d.end || "") ? d.end : d.start;
        ev.venue ??= d.venue || null; ev.city ??= d.city || null;
        found++;
      }
    } catch (e) { if (e instanceof BillingStop) break; }
    if (!ev.start && ev.sources.every(s => s.date < old)) { events.splice(events.indexOf(ev), 1); dropped++; }
    await sleep(300);
  }
  if (undated.length) console.log(`[dates] ${undated.length} undated checked: found ${found}, dropped ${dropped} stale`);
}
if (hasKeys()) await fillDates();

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

// Same event under very different names (e.g. "งานหนังสือ 2569" vs "มหกรรมหนังสือระดับชาติ ครั้งที่ 31").
// Only pairs with the same dates (±1 day) and the same venue or city are asked about, and the model must be sure:
// big venues host several different events on the same days.
// Looser name match than similar(): shares at least 40% of character pairs. Only used to pick pairs for the AI to judge.
function similarLoose(a, b) {
  a = norm(a); b = norm(b);
  if (a.length < 4 || b.length < 4) return false;
  const grams = s => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ga = grams(a), gb = grams(b);
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return hit / Math.min(ga.size, gb.size) >= 0.4;
}
const dayGap = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
function dupCandidates() {
  const pairs = [];
  const asked = (a, b) => (a.notDupWith || []).includes(b.id) || (b.notDupWith || []).includes(a.id);
  const dated = events.filter(e => e.start);
  for (let i = 0; i < dated.length; i++) for (let j = i + 1; j < dated.length; j++) {
    const a = dated[i], b = dated[j];
    if (a.country !== b.country || dayGap(a.start, b.start) > 1 || dayGap(a.end || a.start, b.end || b.start) > 1) continue;
    const place = (a.venue && b.venue && similar(a.venue, b.venue)) || (a.city && b.city && norm(a.city) === norm(b.city));
    if (place && !asked(a, b)) pairs.push([a, b]);
  }
  // An undated entry is often a vaguer report of a dated one: pair it with dated events whose name looks alike.
  const looseName = (a, b) => [[a.name, b.name], [a.name_th, b.name_th], [a.name, b.name_th], [a.name_th, b.name]]
    .some(([x, y]) => x && y && similarLoose(x, y));
  for (const u of events.filter(e => !e.start))
    for (const d of dated) if (u.country === d.country && !asked(u, d) && looseName(u, d)) pairs.push([d, u]);
  return pairs;
}
async function aiDedupe() {
  const pairs = dupCandidates();
  let merged = 0;
  const DEDUPE = `For each numbered pair, answer true ONLY if both entries are certainly the SAME event (same edition), just
named differently or in different languages. Different events at the same venue on the same days are false. If unsure, false.
Reply with valid JSON only: {"0":true,"1":false,...}`;
  for (let i = 0; i < pairs.length; i += 15) {
    const chunk = pairs.slice(i, i + 15);
    const desc = e => `${e.name}${e.name_th ? ` / ${e.name_th}` : ""} | ${e.start}–${e.end || e.start} | ${[e.venue, e.city].filter(Boolean).join(", ")} | ${e.tags.join(",")}`;
    try {
      const out = parseJson((await extract([{ role: "system", content: DEDUPE },
        { role: "user", content: chunk.map(([a, b], n) => `${n}. A: ${desc(a)}\n   B: ${desc(b)}`).join("\n") }])).text);
      chunk.forEach(([a, b], n) => {
        if (out[n] === true && events.includes(a) && events.includes(b)) {
          for (const k of ["end", "venue", "city", "name_th", "summary_th", "image", "official", "region"]) a[k] ??= b[k];
          a.tags = [...new Set([...a.tags, ...b.tags])];
          for (const s of b.sources) if (!a.sources.some(x => x.link === s.link)) a.sources.push(s);
          events.splice(events.indexOf(b), 1);
          merged++;
        } else (a.notDupWith ||= []).push(b.id); // don't ask about this pair again
      });
    } catch (e) {
      if (e instanceof BillingStop) { console.error(e.message); break; }
      console.warn(`[dedupe] batch failed: ${e.message.slice(0, 120)}`);
    }
  }
  console.log(`[dedupe] ${pairs.length} candidate pairs, merged ${merged}`);
}
if (hasKeys()) await aiDedupe();

// Thai names for events that came without one (e.g. Bilibili listings).
const noThai = events.filter(e => !e.name_th && (!e.end || e.end >= today));
if (hasKeys()) for (let i = 0; i < noThai.length; i += 30) {
  const chunk = noThai.slice(i, i + 30);
  try {
    const out = parseJson((await extract([{ role: "system", content:
      'Translate each event name into natural Thai (keep brand/IP names in their usual Thai or English form). Reply with valid JSON only: {"0":"...","1":"..."}' },
      { role: "user", content: chunk.map((e, n) => `${n}. ${e.name}`).join("\n") }], ORDERS.describe)).text);
    chunk.forEach((e, n) => { if (typeof out[n] === "string" && out[n].trim()) e.name_th = out[n].trim(); });
  } catch (e) { if (e instanceof BillingStop) break; }
}

// Second opinion: Nemotron does the bulk extraction, Haiku re-checks each new upcoming event against its headlines
// and fixes or drops it. Events that came from structured listings (Bilibili) are already trusted.
const MAX_VERIFY = Number(arg("max-verify", 30));
const VERIFY = `You check events extracted by another model. For each numbered event, compare it with its source headlines.
Today is ${today}. An event must be a real public event with a date (in person, or a scheduled online event like an online
concert or VTuber stream). Reply with valid JSON only, one entry per number:
{"0":{"ok":true},"1":{"ok":true,"fix":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD","tags":["anime"],"online":false,"price_th":"...","name_th":"..."}},
"2":{"ok":false,"reason":"not an event"}}
Only include fields in "fix" that are clearly wrong. Use ok:false only if it is not an event, already ended, or a duplicate entry.
Allowed tags: ${Object.keys(TAGS).join(", ")}.`;
async function verify() {
  const todoVerify = events.filter(e => !e.verified && (!e.end || e.end >= today)).slice(0, MAX_VERIFY);
  let fixed = 0, dropped = 0, checked = 0;
  for (let i = 0; i < todoVerify.length; i += 10) {
    const chunk = todoVerify.slice(i, i + 10);
    const body = chunk.map((e, n) => `${n}. ${e.name} | ${e.start || "?"}–${e.end || "?"} | ${[e.venue, e.city].filter(Boolean).join(", ") || "-"} | tags=${e.tags.join(",")} | online=${!!e.online} | price=${e.price_th || "-"}\n` +
      e.sources.slice(0, 3).map(s => `   - [${s.date}] ${s.title}`).join("\n")).join("\n");
    let out;
    try { out = parseJson((await extract([{ role: "system", content: VERIFY }, { role: "user", content: body }], ORDERS.verify)).text); }
    catch (e) { console.warn(`[verify] stopped: ${e.message.slice(0, 120)}`); break; } // Haiku quota out: try again next run
    chunk.forEach((e, n) => {
      const r = out[n];
      if (!r) return;
      checked++;
      if (r.ok === false) { events.splice(events.indexOf(e), 1); dropped++; return; }
      const f = r.fix || {};
      if (/^\d{4}-\d\d-\d\d$/.test(f.start || "")) e.start = f.start;
      if (/^\d{4}-\d\d-\d\d$/.test(f.end || "")) e.end = f.end;
      if (Array.isArray(f.tags) && f.tags.some(t => TAGS[t])) e.tags = f.tags.filter(t => TAGS[t]);
      if (typeof f.online === "boolean") e.online = f.online;
      if (f.price_th) e.price_th = f.price_th;
      if (f.name_th) e.name_th = f.name_th;
      if (Object.keys(f).length) fixed++;
      e.verified = true;
    });
  }
  if (todoVerify.length) console.log(`[verify] checked ${checked}: fixed ${fixed}, dropped ${dropped}`);
}
if (hasKeys()) await verify();

const todo = events.filter(e => !e.enriched);
for (const ev of todo) await enrich(ev);
console.log(`[enrich] ${todo.length} events: ${todo.filter(e => e.image).length} with poster, ${todo.filter(e => e.official).length} with official link`);
// Same image on several different events = a site logo. Drop it everywhere and search again.
const imageUse = new Map();
for (const e of events) if (e.image) imageUse.set(e.image, (imageUse.get(e.image) || 0) + 1);
for (const [url, n] of imageUse) if (n >= 3) genericImages.add(url);
for (const e of events) {
  const fromLogoSite = LOGO_SITES.test(e.imageFrom || "") || e.sources.some(s => s.image === e.image && LOGO_SITES.test(s.link));
  if (e.image && (!posterOk(e.image) || fromLogoSite)) { e.image = null; e.imageTried = false; e.imageFrom = null; }
  for (const s of e.sources) if (LOGO_SITES.test(s.link)) s.image = null;
}
// News with a picture often comes later: try again every 3 days.
const retryBefore = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
for (const e of events) if (!e.image && e.imageTried && (e.imageTriedAt || "") < retryBefore) e.imageTried = false;
const noImage = events.filter(e => !e.image && !e.imageTried);
for (const ev of noImage) { await searchImage(ev); await sleep(400); }
console.log(`[image search] ${noImage.length} events without poster: found ${noImage.filter(e => e.image).length}`);

// Region for events that have none yet: one cheap call per 40 events (name, venue, city → region code).
const noRegion = events.filter(e => !e.region && !e.regionTried);
if (hasKeys()) for (let i = 0; i < noRegion.length; i += 40) {
  const chunk = noRegion.slice(i, i + 40);
  const prompt = `Give the region code of each event's location. Codes: ${regionCodes()}. Use null if unknown.
Reply with valid JSON only: {"0":"kanto","1":null,...}`;
  const lines = chunk.map((e, n) => `${n}. ${e.country} | ${e.venue || "-"} | ${e.city || "-"} | ${e.name}`).join("\n");
  try {
    const out = parseJson((await extract([{ role: "system", content: prompt }, { role: "user", content: lines }], ORDERS.describe)).text);
    chunk.forEach((e, n) => { e.region = validRegion(e.country, out[n]); e.regionTried = true; });
  } catch (e) {
    if (e instanceof BillingStop) { console.error(e.message); break; }
    console.warn(`[region] batch failed: ${e.message.slice(0, 120)}`);
  }
}
if (noRegion.length) console.log(`[region] ${noRegion.filter(e => e.region).length}/${noRegion.length} events got a region`);

// Upcoming events first; past ones never need details.
const MAX_DESCRIBE = Number(arg("max-describe", 40));
const toDescribe = events.filter(e => !e.described && (!e.end || e.end >= today)).slice(0, MAX_DESCRIBE);
// Same parallel pattern as extraction: one worker per Nemotron key.
let described = 0, describeStop = false;
const describeQueue = [...toDescribe];
if (hasKeys()) await Promise.all((nemotronKeys().length ? nemotronKeys() : [null]).map(async key => {
  while (describeQueue.length && !describeStop) {
    const ev = describeQueue.shift();
    try { await describe(ev, key); described++; } catch (e) {
      if (e instanceof BillingStop) { console.error(e.message); describeStop = true; break; }
      console.warn(`[describe] ${ev.name}: ${e.message.slice(0, 120)}`);
    }
    if (described % 10 === 0) save(EVENTS, events);
  }
}));
console.log(`[describe] ${described}/${toDescribe.length} events got details`);

// Ticket price by web search, the way a person would google it: DuckDuckGo's HTML results (no key needed), then the
// model reads the snippets plus the top pages and returns a price only if it is clearly for this event and edition.
const MAX_PRICE = Number(arg("max-price", 40));
const PRICE_WORD = { TH: "ราคาบัตร", JP: "チケット 料金", CN: "票价" };
const PRICE_PROMPT = `You read web search results about one event. Give its ticket price / entry fee ONLY if a result clearly states it
for this exact event and edition (same year). Never guess. Reply with valid JSON only:
{"price_th":"short Thai, max 40 characters, e.g. เข้าฟรี / เริ่มต้น 200 บาท / 500–2,500 บาท / ¥2,000","source":"URL of the result that states it"}
or {"price_th":null,"source":null}`;
async function webSearch(q) {
  const html = await (await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(15000) })).text();
  return [...html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].slice(0, 8)
    .map(m => ({ url: decodeURIComponent((m[1].match(/uddg=([^&]+)/) || [])[1] || m[1]), title: decode(m[2]), snippet: decode(m[3]) }));
}
async function findPrice(ev, key) {
  ev.priceTriedAt = today;
  const results = await webSearch(`${ev.name} ${(ev.start || "").slice(0, 4)} ${PRICE_WORD[ev.country] || "ticket price"}`);
  if (!results.length) return false;
  let pages = "";
  for (const r of results.filter(r => !/facebook\.com|x\.com|twitter\.com|instagram\.com|tiktok\.com|youtube\.com/.test(r.url)).slice(0, 2)) {
    try { pages += `\n\nPage ${r.url}:\n${(await articleText(r.url)).slice(0, 1200)}`; } catch {}
  }
  const body = `Event: ${ev.name} (${ev.start || "?"}, ${[ev.venue, ev.city].filter(Boolean).join(", ")})\n\nResults:\n` +
    results.map(r => `- ${r.title} | ${r.url}\n  ${r.snippet}`).join("\n") + pages;
  const d = parseJson((await extract([{ role: "system", content: PRICE_PROMPT }, { role: "user", content: body }], ORDERS.describe, key)).text);
  if (!d.price_th) return false;
  ev.price_th = String(d.price_th).slice(0, 60);
  ev.priceSource = /^https?:\/\//.test(d.source || "") ? d.source : null;
  return true;
}
const priceRetry = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const priceQueue = events.filter(e => !e.price_th && e.start && e.end >= today && !e.online && (e.priceTriedAt || "") < priceRetry).slice(0, MAX_PRICE);
let priced = 0;
if (hasKeys() && priceQueue.length) {
  const total = priceQueue.length;
  await Promise.all((nemotronKeys().length ? nemotronKeys() : [null]).map(async (key, n) => {
    await sleep(n * 700); // stagger the searches a little
    while (priceQueue.length) {
      const ev = priceQueue.shift();
      try { if (await findPrice(ev, key)) priced++; } catch (e) { if (e instanceof BillingStop) break; }
      await sleep(1200);
    }
  }));
  console.log(`[price] ${total} events searched: found ${priced}`);
}

events.sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
save(EVENTS, events);
writeCalendars();
console.log(`[done] +${added} new events, ${events.length} total, ${Object.values(raw).filter(r => r.status === "new").length} headlines still pending`);

// Subscribable calendars (webcal): one for everything and one per category group. Phones re-download them on their own,
// so new events appear in the user's calendar app without tapping anything.
function writeCalendars() {
  const dir = path.join(ROOT, "data", "ics");
  fs.mkdirSync(dir, { recursive: true });
  const esc = s => String(s || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const ymd = s => s.replaceAll("-", "");
  const next = s => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const upcoming = events.filter(e => e.start && (e.end || e.start) >= today);
  const write = (file, name, list) => {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventRadar//TH", `X-WR-CALNAME:${name}`, "X-PUBLISHED-TTL:PT6H", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
    for (const e of list) lines.push("BEGIN:VEVENT", `UID:${e.id}@eventradar`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(e.start)}`,
      `DTEND;VALUE=DATE:${ymd(next(e.end || e.start))}`, `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      `SUMMARY:${esc((e.status === "cancelled" ? "[ยกเลิก] " : e.status === "postponed" ? "[เลื่อนวัน] " : "") + (e.name_th || e.name))}`, `LOCATION:${esc([e.venue, e.city].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${esc([e.price_th && "ค่าเข้า: " + e.price_th, e.summary_th, e.official || e.sources[0]?.link].filter(Boolean).join("\n"))}`, "END:VEVENT");
    lines.push("END:VCALENDAR");
    fs.writeFileSync(path.join(dir, file), lines.join("\r\n"));
  };
  write("all.ics", "EventRadar · ทุกงาน", upcoming);
  for (const [g, x] of Object.entries(TAXONOMY))
    write(`${g}.ics`, `EventRadar · ${x.name}`, upcoming.filter(e => e.tags.some(t => x.tags[t])));
}
