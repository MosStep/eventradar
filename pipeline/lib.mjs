// Pure helpers used by the pipeline (no network, no state) — kept here so tests can import them.
import crypto from "node:crypto";
import { EVENT_WORDS, NOT_EVENT_WORDS, NOT_EVENT_RULES, EVENT_STRONG, PRTIMES_EVENT, JP_DATE, JP_VENUE } from "./sources.mjs";

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
// later), "auth" (the key is rejected or expired: 401, 403 without billing words, or wording about expiry),
// or "other" (bad request, timeout, bad JSON ...). Quota wording wins over a 429 status.
// The HTTP status (the "NNN:" prefix of a response error) decides first: a 429 or 5xx is never billing, whatever its
// body says, so a rate limit that mentions credits or a wallet is not a payment problem.
const AUTH_WORDS = /expired|expir|invalid[ _-]?(api[ _-]?)?key|unauthori[sz]ed|forbidden|not authenticated|no active subscription/i;
export function errorKind(msg) {
  const m = String(msg || "");
  const code = Number(m.match(/^(\d{3}):/)?.[1]) || 0; // 0 = no HTTP status (error inside a stream or a bare body)
  const payment = code === 402 || code === 403;
  const billingWords = payment ? /unpaid|add credits|wallet|credits|overdue|payment required|outstanding/i
    : /unpaid|add credits|overdue|payment required/i;
  if (code !== 429 && code < 500 && billingWords.test(m)) return "billing";
  if (/quota|insufficient|^402/i.test(m)) return "quota";
  if (code === 429 || /AI_PROVIDER_RATE|too many requests|rate.?limit|concurrent_streams/i.test(m)) return "rate";
  if (code === 401 || code === 403 || (code < 500 && AUTH_WORDS.test(m))) return "auth";
  return "other";
}

// Alerts: a problem only counts once it has happened in ALERT_AFTER runs in a row (a single transient one stays in
// status.json, shown in the app). aiProblemKinds() names the AI problems of one run; nextStreaks() keeps the count of
// runs in a row per kind (stored in status.json as "streak"); confirmedKinds() returns the kinds that reached the limit.
export const ALERT_AFTER = 2;
export const AI_KINDS = ["rate", "failed", "billing"];
export function aiProblemKinds(ai) {
  const kinds = [];
  if (ai?.down) kinds.push("rate"); // every provider's breaker tripped: rate limit or quota
  const allQuota = ai?.keys > 0 && (ai.quota?.length || 0) >= ai.keys;
  if (allQuota || (ai?.calls > 5 && ai.failed / ai.calls > 0.5)) kinds.push("failed");
  // Only a Tenixe billing error is an alert; AIUnlimit billing is shown in the status box.
  if (ai?.billing && (Array.isArray(ai.billingBy) ? ai.billingBy.includes("tenixe") : true)) kinds.push("billing");
  return kinds;
}
export function nextStreaks(prev, kinds) {
  const out = {};
  for (const k of AI_KINDS) out[k] = kinds.includes(k) ? (Number(prev?.[k]) || 0) + 1 : 0;
  return out;
}
export const confirmedKinds = streaks => AI_KINDS.filter(k => (streaks?.[k] || 0) >= ALERT_AFTER);

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

// Rule-based triage before any AI call (no network). Returns "" when a headline may be an event, else the rule that
// skipped it. `feed` is the RSS feed name ("PR TIMES") when it differs from the outlet name.
export function prefilterReason(r, feed = r.source) {
  const text = `${r.title} ${r.desc || ""}`;
  if (!EVENT_WORDS.test(text)) return "no_event";
  if (NOT_EVENT_WORDS.test(r.title) && !EVENT_STRONG.test(r.title)) return "noise";
  for (const [name, re] of Object.entries(NOT_EVENT_RULES)) if (re.test(r.title) && !EVENT_STRONG.test(r.title)) return name;
  if (feed === "PR TIMES" && !PRTIMES_EVENT.test(r.title)) return "prtimes_no_event";
  if (feed === "PR TIMES" && !JP_DATE.test(text) && !JP_VENUE.test(text)) return "prtimes_no_date_venue";
  return "";
}

// Extraction priority from tags: TCG first, then anime/game/fan events and concerts/festivals.
const TAG_PRIORITY = { tcg: 3, anime: 2, game: 2, esports: 2, cosplay: 2, comic: 2, figure: 2, vtuber: 2, boardgame: 2,
  fanmeet: 2, idol: 2, concert: 2, festival: 2 };
export const tagPriority = tags => Math.max(0, ...(tags || []).map(t => TAG_PRIORITY[t] || 0));

// Country from where the event happens. Only the venue and city count: names and source titles often mention a
// foreign place legitimately (a Thai newspaper about a Japanese festival). Returns {country, sure} when the place
// names point to one country, {country: null, conflict: [...]} when they point to several, or null.
// The city decides when it names a place; the venue is read only when the city names none. Latin words match whole
// words only ("rome" is not "hippodrome"). Hangul place names are transliterations (타이중 is Taichung), so they are
// not evidence by themselves; kana counts as Japanese only with a Japanese place suffix (katakana also spells
// foreign cities, e.g. アーケディア).
const PLACE_WORDS = {
  TH: ["กรุงเทพ", "บางกอก", "bangkok", "thailand", "泰国", "เชียงใหม่", "chiang mai", "ภูเก็ต", "phuket", "พัทยา", "pattaya",
    "หัวหิน", "hua hin", "ขอนแก่น", "khon kaen", "โคราช", "นครราชสีมา", "อุดรธานี", "สงขลา", "หาดใหญ่", "กระบี่", "krabi",
    "สมุย", "samui", "ชลบุรี", "ระยอง", "นครสวรรค์", "nakhon sawan", "ปากน้ำโพ", "อยุธยา", "ayutthaya", "ประเทศไทย",
    "バンコク", "チェンマイ", "プーケット", "パタヤ"],
  JP: ["東京", "大阪", "京都", "名古屋", "横浜", "神戸", "福岡", "札幌", "仙台", "広島", "奈良", "千葉", "埼玉", "神奈川", "県", "豊橋", "船橋", "朝霞", "浜松", "静岡", "新潟", "熊本", "鹿児島", "沖縄", "那覇", "伊豆", "志摩", "岡崎", "豊田", "川崎", "さいたま",
    "日本", "japan", "tokyo", "osaka", "kyoto", "nagoya", "yokohama", "ญี่ปุ่น", "โตเกียว", "โอซาก้า", "เกียวโต", "ฟุกุโอกะ",
    "ซัปโปโร", "โยโกฮามา"],
  CN: ["北京", "上海", "广州", "深圳", "成都", "重庆", "武汉", "南京", "杭州", "西安", "天津", "苏州", "长沙", "郑州", "青岛",
    "厦门", "福州", "济南", "合肥", "昆明", "南宁", "哈尔滨", "沈阳", "大连", "无锡", "宁波", "东莞", "佛山", "珠海", "香港",
    "澳门", "洛阳", "汉中", "四川", "山东", "河南", "湖南", "湖北", "广东", "浙江", "江苏", "福建", "云南", "陕西", "山西",
    "河北", "辽宁", "吉林", "黑龙江", "安徽", "江西", "广西", "海南", "贵州", "甘肃", "青海", "宁夏", "新疆", "西藏", "内蒙古",
    "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "chongqing", "hong kong", "macau", "macao",
    "จีน", "ปักกิ่ง", "เซี่ยงไฮ้", "กวางโจว", "เซินเจิ้น", "ฮ่องกง", "มาเก๊า", "ฉงชิ่ง"],
  TW: ["台北", "臺北", "台中", "臺中", "台南", "臺南", "高雄", "新竹", "嘉義", "花蓮", "基隆", "台東", "臺東", "桃園", "新北",
    "屏東", "宜蘭", "彰化", "雲林", "南投", "苗栗", "澎湖", "金門", "玉里", "淡水", "鹿港", "台湾", "臺灣", "台灣", "đào viên", "taoyuan", "tân bắc", "đạm giang", "taipei", "taichung", "kaohsiung", "taiwan", "tainan", "hsinchu", "hualien",
    "ไต้หวัน", "ไทเป", "เกาสง"],
  KR: ["ソウル", "釜山", "仁川", "大邱", "済州", "韩国", "韓国", "서울", "부산", "인천", "대구", "제주", "대전", "seoul", "busan",
    "incheon", "daegu", "jeju", "korea", "เกาหลี", "โซล", "ปูซาน", "อินชอน", "เชจู"],
  VN: ["hà nội", "hanoi", "hồ chí minh", "ho chi minh", "đà nẵng", "da nang", "huế", "hải phòng", "cần thơ", "vietnam",
    "hội an", "hoi an", "ホイアン", "ฮอยอัน", "ฮานอย", "โฮจิมินห์", "ดานัง", "ดาลัด", "ฮาลอง", "เวียดนาม", "ベトナム", "ハノイ", "ホーチミン", "ダナン", "越南"],
  ID: ["jakarta", "bali", "surabaya", "bandung", "indonesia", "จาการ์ตา", "บาหลี", "อินโดนีเซีย", "インドネシア", "ジャカルタ", ],
  MY: ["kuala lumpur", "malaysia", "penang", "มาเลเซีย", "กัวลาลัมเปอร์", "クアラルンプール", "マレーシア"],
  SG: ["singapore", "สิงคโปร์", "シンガポール"],
  PH: ["manila", "philippines", "cebu", "ฟิลิปปินส์", "มะนิลา", "マニラ", "フィリピン"],
  US: ["new york", "los angeles", "san francisco", "las vegas", "chicago", "united states", "usa", "นิวยอร์ก", "ลอสแอนเจลิส",
    "ลาสเวกัส", "ซานฟรานซิสโก", "ニューヨーク", "ロサンゼルス", "ラスベガス", "サンフランシスコ", "シカゴ", "米国", "美国"],
  GB: ["london", "manchester", "united kingdom", "ลอนดอน", "ロンドン", "英国"],
  FR: ["paris", "フランス", "ฝรั่งเศส", "パリ", "リヨン", "法国", "lyon", "marseille", "ปารีส", "マルセイユ"],
  DE: ["berlin", "munich", "frankfurt", "germany", "cologne", "เบอร์ลิน", "เยอรมนี", "ベルリン", "ドイツ", "ミュンヘン", "เคิล์น"],
  IT: ["milan", "rome", "italy", "มิลาน", "อิตาลี", "ミラノ", "ローマ", "イタリア"],
  ES: ["madrid", "barcelona", "spain", "มาดริด", "บาร์เซโลนา", "สเปน", "マドリード", "バルセロナ", ],
  AU: ["sydney", "melbourne", "australia", "ซิดนีย์", "ออสเตรเลีย", "シドニー", "メルボルン", "オーストラリア"],
  CA: ["toronto", "vancouver", "montreal", "canada", "โตรอนโต", "แคนาดา", "トロント", "バンクーバー", "カナダ"],
};
const BACKSLASH = String.fromCharCode(92), REGEX_SPECIAL = ".*+?^${}()|[]" + BACKSLASH;
const escapeRe = w => w.split("").map(ch => (REGEX_SPECIAL.includes(ch) ? BACKSLASH + ch : ch)).join("");
const WORD_EDGE = BACKSLASH + "b"; // regex word boundary, for Latin words only
const PLACE_RE = Object.fromEntries(Object.entries(PLACE_WORDS).map(([c, words]) => [c, new RegExp(
  words.map(w => (/^[a-z ]+$/.test(w) ? WORD_EDGE + escapeRe(w) + WORD_EDGE : escapeRe(w))).join("|"), "i")]));
const KANA = /[\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff]/; // Japanese only (・ is shared with Chinese)
const JP_SUFFIX = /市|区|町|村|郡|県|府|都|道/;
const VN_LETTERS = /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđơưăĐƠƯĂ]/;
export function countryEvidence(e) {
  const city = String(e.city || "").trim(), venue = String(e.venue || "").trim();
  // The city decides when it names a place; the venue is read only when the city is empty. Venues often carry foreign
  // names (ニューヨークランプミュージアム is in Izu, Japan).
  const placeText = city || venue;
  const found = new Set();
  for (const [c, re] of Object.entries(PLACE_RE)) if (placeText && re.test(placeText)) found.add(c);
  if (found.size > 1) return { country: null, conflict: [...found] };
  if (found.size === 1) return { country: [...found][0], sure: true };
  // Vietnamese letters: names written in Vietnamese, also used for French venues (Điện Élysée), so not sure.
  if (VN_LETTERS.test(placeText)) return { country: "VN", sure: false };
  // Kana with a Japanese administrative suffix (katakana also spells foreign venues, e.g. オルセー美術館).
  const both = `${city} ${venue}`;
  if (KANA.test(`${e.name || ""} ${both}`) && JP_SUFFIX.test(both)) return { country: "JP", sure: true };
  return null;
}

// What to do with an event whose country may be wrong: keep it; move it when the place names are sure; otherwise hide
// it (placeSuspect) until a person checks, and hide it too when the place names conflict without the event's country.
export function placeVerdict(e) {
  const ev = countryEvidence(e);
  if (!ev) return { action: "keep" };
  if (ev.country === null) return ev.conflict.includes(e.country) ? { action: "keep" } : { action: "suspect" };
  if (ev.country === e.country) return { action: "keep" };
  return ev.sure ? { action: "move", country: ev.country } : { action: "suspect" };
}
