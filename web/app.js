// EventRadar: reads data/events.json, filters by country/tag/search, follows events in localStorage.
const COUNTRIES = { TH: "🇹🇭 ไทย", JP: "🇯🇵 ญี่ปุ่น", CN: "🇨🇳 จีน", VN: "🇻🇳 เวียดนาม", KR: "🇰🇷 เกาหลีใต้", ID: "🇮🇩 อินโดนีเซีย" };
// UI icons (Lucide, MIT). Category emoji stay as content decoration; controls use these SVGs.
const ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calplus: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  auto: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// Look & feel, saved per device. Applied to <html> as data-* attributes (also done early in index.html).
const prefs = (() => { try { return JSON.parse(localStorage.getItem("prefs")) || {}; } catch { return {}; } })();
function setPref(k, v) {
  prefs[k] = v;
  store.set("prefs", prefs);
  if (v) document.documentElement.dataset[k] = v; else delete document.documentElement.dataset[k];
}

// Filled from taxonomy.json: groups → tags. TAGS[tag] = { name, group, color, icon }.
let GROUPS = {}, TAGS = {}, REGIONS = {};
const regionName = e => REGIONS[e.country]?.[e.region] || "";
const tagName = t => TAGS[t]?.name || t;
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const TODAY = iso(new Date());
const state = {
  events: [],
  countries: new Set(store.get("countries", Object.keys(COUNTRIES))),
  offTags: new Set(store.get("offTags", [])), // stored as "off" so newly added tags start visible
  offRegions: new Set(store.get("offRegions", [])), // "TH:north" style keys
  format: store.get("format", "all"), // all | offline | online
  quick: store.get("quick", null), // one group picked from the main screen, or null for all
  calView: ["month", "week", "agenda"].includes(store.get("calView")) ? store.get("calView") : "month",
  picker: false,
  pickerYear: new Date().getFullYear(),
  starred: new Set(store.get("starred", [])),
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  day: TODAY,
  view: ["home", "list", "mine", "settings"].includes(store.get("view")) ? store.get("view") : "home",
  q: "",
  near: store.get("near", false), // "ใกล้ฉัน": only events in the user's own region
  follows: store.get("follows", []), // words followed: artist, IP, venue…
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const yr = y => (prefs.era === "ce" ? y : y + 543); // พ.ศ. by default, ค.ศ. from Settings
const fmt = d => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${SHORT[m - 1]} ${yr(y)}`; };
const dateText = e => !e.start ? "ยังไม่ประกาศวัน" : e.end && e.end !== e.start ? `${fmt(e.start)} – ${fmt(e.end)}` : fmt(e.start);
const daysUntil = d => Math.round((new Date(d + "T00:00:00") - new Date(TODAY + "T00:00:00")) / 864e5);
const color = e => TAGS[e.tags[0]]?.color || "#7a5cff";
const emoji = e => TAGS[e.tags[0]]?.icon || "✨";
const badge = t => `<span class="badge" style="--c:${TAGS[t]?.color}">${tagName(t)}</span>`;
const title = e => e.name_th || e.name;
const onDay = (e, day) => e.start && e.start <= day && (e.end || e.start) >= day;
const isNew = e => e.added && daysUntil(e.added) >= -2;

function countdown(e) {
  if (!e.start) return "รอประกาศวัน";
  if (onDay(e, TODAY)) return `<span class="live">กำลังจัดอยู่</span>`;
  const n = daysUntil(e.start);
  return n === 1 ? "พรุ่งนี้!" : `อีก ${n} วัน`;
}

// Region centres (lat, lng) used to turn a GPS position into a region.
const REGION_CENTRES = {
  "TH:bkk": [13.75, 100.5], "TH:central": [14.5, 100.4], "TH:north": [18.8, 99.0], "TH:northeast": [15.5, 103.5],
  "TH:east": [13.0, 101.5], "TH:west": [13.5, 99.3], "TH:south": [8.0, 99.5],
  "JP:hokkaido": [43.1, 141.4], "JP:tohoku": [38.3, 140.9], "JP:kanto": [35.7, 139.7], "JP:chubu": [35.2, 137.0],
  "JP:kansai": [34.7, 135.5], "JP:chugoku": [34.4, 132.5], "JP:shikoku": [33.8, 133.5], "JP:kyushu": [33.0, 130.7],
  "CN:north": [39.9, 116.4], "CN:northeast": [43.8, 125.3], "CN:east": [31.2, 121.5], "CN:south": [23.1, 113.3],
  "CN:central": [30.6, 114.3], "CN:southwest": [30.6, 104.1], "CN:northwest": [34.3, 108.9],
  "VN:north": [21.0, 105.8], "VN:central": [16.05, 108.2], "VN:highlands": [11.94, 108.44], "VN:south": [10.8, 106.7],
  "KR:seoul": [37.57, 126.98], "KR:gangwon": [37.75, 128.9], "KR:chungcheong": [36.35, 127.38], "KR:jeolla": [35.16, 126.85],
  "KR:gyeongsang": [35.18, 129.08], "KR:jeju": [33.5, 126.53],
  "ID:java": [-6.2, 106.8], "ID:bali": [-8.65, 115.2], "ID:sumatra": [3.6, 98.67], "ID:kalimantan": [-1.27, 116.83],
  "ID:sulawesi": [-5.14, 119.42], "ID:east": [-2.5, 140.7],
};
function nearestRegion(lat, lng) {
  let best = null, dist = Infinity;
  for (const [k, [a, b]] of Object.entries(REGION_CENTRES)) { const d = (a - lat) ** 2 + (b - lng) ** 2; if (d < dist) { dist = d; best = k; } }
  return best;
}
const home = () => prefs.home || ""; // "TH:north"
const followMatch = e => state.follows.find(w => [e.name, e.name_th, e.venue, e.city, e.summary_th, e.about_th]
  .some(t => t && t.toLowerCase().includes(w.toLowerCase())));

function visible() {
  const q = state.q.toLowerCase();
  const [hc, hr] = home().split(":");
  // placeSuspect: mentions another country and Haiku has not confirmed where it is yet
  return state.events.filter(e => !e.placeSuspect && state.countries.has(e.country) && !(e.region && state.offRegions.has(`${e.country}:${e.region}`))
    && (state.format === "all" || (state.format === "online") === !!e.online)
    && e.tags.some(t => !state.offTags.has(t) && (!state.quick || TAGS[t]?.group === state.quick))
    && (!state.near || !hc || (e.country === hc && (!hr || e.region === hr)))
    && (!q || [e.name, e.name_th, e.venue, e.city, e.summary_th].some(s => s?.toLowerCase().includes(q))));
}

// News sites often block hotlinked images; load them through a free image proxy that also resizes.
const proxied = (url, w) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&output=webp`;
// No poster: a designed card (category colour, icon, event name) instead of an empty box.
const placeholder = e => `<span class="ph"><i>${emoji(e)}</i><b>${esc(title(e))}</b></span>`;
const img = (e, w = 400) => e.image
  ? `<img src="${esc(proxied(e.image, w))}" data-orig="${esc(e.image)}" data-id="${e.id}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="imgFail(this)">`
  : placeholder(e);
// Proxy failed → try the original URL once → give up and show the placeholder card.
function imgFail(el) {
  if (el.dataset.orig && el.src !== el.dataset.orig) { el.src = el.dataset.orig; el.dataset.orig = ""; return; }
  const e = state.events.find(x => x.id === el.dataset.id);
  el.outerHTML = e ? placeholder(e) : "";
}

// Date changes and cancellations. Followed events are compared with what this phone saw last time.
const statusBadge = e => e.status === "cancelled" ? `<span class="badge cancelled">ยกเลิก</span>`
  : e.status === "postponed" ? `<span class="badge moved">เลื่อนวัน</span>` : "";
const snapshot = e => `${e.start}|${e.end}|${e.status || ""}`;
const seen = store.get("seen", {});
const changedFollowed = () => state.events.filter(e => state.starred.has(e.id) && seen[e.id] && seen[e.id] !== snapshot(e));
function markSeen(list) { for (const e of list) seen[e.id] = snapshot(e); store.set("seen", seen); }

// Main screen: one row — the filter button, then quick single-pick groups. Detailed picks live in the filter sheet.
const filterCount = () => (state.countries.size < Object.keys(COUNTRIES).length ? 1 : 0) + (state.offTags.size ? 1 : 0)
  + (state.offRegions.size ? 1 : 0) + (state.format !== "all" ? 1 : 0);

function chips() {
  const n = filterCount();
  $("#quick").innerHTML = `<button class="chip filter ${n ? "on" : ""}" data-filters>${icon("sliders")} ตัวกรอง${n ? ` <b>${n}</b>` : ""}</button>` +
    (home() ? `<button class="chip ${state.near ? "on" : ""}" data-near>📍 ใกล้ฉัน</button>` : "") +
    `<button class="chip ${!state.quick ? "on" : ""}" data-quick="">ทั้งหมด</button>` +
    Object.entries(GROUPS).map(([g, x]) =>
      `<button class="chip ${state.quick === g ? "on" : ""}" style="--c:${x.color}" data-quick="${g}">${x.icon} ${x.name}</button>`).join("");
}

function filterSheet() {
  const count = visible().length;
  const countries = Object.entries(COUNTRIES).map(([k, v]) =>
    `<button class="chip ${state.countries.has(k) ? "on" : ""}" data-country="${k}">${v}</button>`).join("");
  const groups = Object.entries(GROUPS).map(([g, x]) => {
    const tags = Object.keys(x.tags), on = tags.filter(t => !state.offTags.has(t)).length;
    return `<div class="fgroup" style="--c:${x.color}">
      <label class="fhead"><input type="checkbox" data-group-all="${g}" ${on === tags.length ? "checked" : ""}
        ${on && on < tags.length ? 'data-partial="1"' : ""}> ${x.icon} ${x.name} <small>${on}/${tags.length}</small></label>
      <div class="wrap">${tags.map(t => `<button class="chip ${state.offTags.has(t) ? "" : "on"}" data-tag="${t}">${x.tags[t]}</button>`).join("")}</div>
    </div>`;
  }).join("");
  showSheet(`<div class="sheet-content filters">
    <span class="grab dark"></span>
    <div class="section-head"><h2>ตัวกรอง</h2><button class="link" data-reset>ล้างทั้งหมด</button></div>
    <h5>รูปแบบงาน</h5><div class="seg">${[["all", "ทั้งหมด"], ["offline", "ไปร่วมงาน"], ["online", "ออนไลน์"]].map(([v, l]) =>
      `<button class="${state.format === v ? "on" : ""}" data-format="${v}">${l}</button>`).join("")}</div>
    <h5>ประเทศ</h5><div class="wrap">${countries}</div>
    ${[...state.countries].filter(c => REGIONS[c]).map(c => `<div class="fgroup">
      <div class="fhead">${COUNTRIES[c]} · ภูมิภาค</div>
      <div class="wrap">${Object.entries(REGIONS[c]).map(([r, name]) =>
        `<button class="chip ${state.offRegions.has(`${c}:${r}`) ? "" : "on"}" data-region="${c}:${r}">${name}</button>`).join("")}</div>
    </div>`).join("")}
    <h5>หมวดหมู่</h5>${groups}
    <button class="pill done" data-close>ดูผล ${count} งาน</button>
  </div>`, "filters");
  document.querySelectorAll("[data-partial]").forEach(i => (i.indeterminate = true));
}

function card(e) {
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  return `<div class="card" style="--c:${color(e)}" data-open="${e.id}" role="button" tabindex="0">
    <div class="thumb">${img(e)}</div>
    <div>
      <h4>${esc(title(e))}</h4>
      <p class="meta">📅 ${dateText(e)}${e.price_th ? ` · 🎟️ ${esc(e.price_th)}` : ""}</p>
      <p class="meta">${COUNTRIES[e.country]}${regionName(e) ? ` · ${regionName(e)}` : ""}${place ? ` · ${esc(place)}` : ""}</p>
      <div class="badges">${statusBadge(e)}${e.online ? `<span class="badge online">ออนไลน์</span>` : ""}${isNew(e) ? `<span class="badge new">ใหม่</span>` : ""}${e.tags.map(badge).join("")}</div>
    </div>
    <button class="star ${state.starred.has(e.id) ? "on" : ""}" data-star="${e.id}" aria-label="ติดตาม">${state.starred.has(e.id) ? "★" : "☆"}</button>
  </div>`;
}

// ── Calendar views. Week start and year style come from Settings. ──
const WD = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const weekStart = () => (prefs.weekStart === "mon" ? 1 : 0);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parse = s => new Date(s + "T00:00:00");
const starredOn = (list, day) => list.some(e => state.starred.has(e.id) && onDay(e, day));

function dayCell(list, d, extra = "") {
  const day = iso(d), evs = list.filter(e => onDay(e, day));
  const bars = evs.slice(0, 3).map(e => `<i style="background:${color(e)}"></i>`).join("");
  return `<button class="day ${extra} ${day === TODAY ? "today" : ""} ${day === state.day ? "sel" : ""} ${starredOn(list, day) ? "fav" : ""}" data-day="${day}">
    <b>${d.getDate()}</b><span class="bars">${bars}</span>${evs.length > 1 ? `<em class="n">${evs.length}</em>` : ""}</button>`;
}
const weekdayRow = () => `<div class="grid weekdays">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span>${WD[(i + weekStart()) % 7]}</span>`).join("")}</div>`;

function monthGrid(list) {
  const m = state.month, lead = (m.getDay() - weekStart() + 7) % 7;
  const first = addDays(m, -lead);
  let html = "";
  for (let i = 0; i < 42; i++) { const d = addDays(first, i); html += dayCell(list, d, d.getMonth() !== m.getMonth() ? "out" : ""); }
  return `${weekdayRow()}<div class="grid swipe">${html}</div>`;
}

function weekStrip(list) {
  const sel = parse(state.day), start = addDays(sel, -((sel.getDay() - weekStart() + 7) % 7));
  return `${weekdayRow()}<div class="grid swipe week">${[0, 1, 2, 3, 4, 5, 6].map(i => dayCell(list, addDays(start, i))).join("")}</div>`;
}

// Agenda: the next 45 days from the selected day, one header per day that has events.
function agenda(list) {
  let html = "", shown = 0;
  for (let i = 0; i < 45 && shown < 80; i++) {
    const d = addDays(parse(state.day), i), day = iso(d), evs = list.filter(e => onDay(e, day));
    if (!evs.length) continue;
    shown += evs.length;
    html += `<div class="agenda-day ${day === TODAY ? "is-today" : ""}"><div class="ad-date"><b>${d.getDate()}</b><span>${WD[d.getDay()]} · ${SHORT[d.getMonth()]}</span></div>
      <div class="cards">${evs.map(card).join("")}</div></div>`;
  }
  return html || `<p class="empty">ไม่มีงานใน 45 วันนี้ตามตัวกรองที่เลือก</p>`;
}

// Month/year picker opens inline under the title (never over the content).
function renderPicker() {
  $("#picker").hidden = !state.picker;
  if (!state.picker) return;
  const y = state.pickerYear;
  $("#picker").innerHTML = `<div class="picker-year"><button data-pyear="-1" aria-label="ปีก่อน">‹</button><b>${yr(y)}</b><button data-pyear="1" aria-label="ปีถัดไป">›</button></div>
    <div class="picker-months">${MONTHS.map((n, i) => {
      const count = visible().filter(e => e.start && e.start.slice(0, 7) <= `${y}-${String(i + 1).padStart(2, "0")}` && (e.end || e.start).slice(0, 7) >= `${y}-${String(i + 1).padStart(2, "0")}`).length;
      const cur = y === state.month.getFullYear() && i === state.month.getMonth();
      return `<button class="${cur ? "on" : ""}" data-pmonth="${i}">${SHORT[i]}${count ? `<small>${count}</small>` : ""}</button>`;
    }).join("")}</div>`;
}

function stepCalendar(dir) {
  if (state.calView === "month") return shiftMonth(dir);
  const d = addDays(parse(state.day), dir * (state.calView === "week" ? 7 : 14));
  state.day = iso(d);
  state.month = new Date(d.getFullYear(), d.getMonth(), 1);
}

function renderHome() {
  const list = visible();
  const soon = list.filter(e => e.start && (e.end || e.start) >= TODAY && daysUntil(e.start) <= 30).slice(0, 12);
  $("#soonCount").textContent = soon.length ? `${soon.length} งานใน 30 วัน` : "";
  $("#soon").innerHTML = soon.length ? soon.map(e => `<button class="poster" style="--c:${color(e)}" data-open="${e.id}">
      <div class="img">${img(e)}<span class="count">${countdown(e)}</span></div>
      <div class="txt"><h4>${esc(title(e))}</h4><p>${COUNTRIES[e.country]} · ${e.start ? fmt(e.start) : ""}</p></div>
    </button>`).join("") : `<p class="empty">ยังไม่มีงานใน 30 วันข้างหน้าตามตัวกรองนี้</p>`;

  const m = state.month, view = state.calView;
  $("#monthTitle").innerHTML = `${MONTHS[m.getMonth()]} ${yr(m.getFullYear())} <span class="caret">▾</span>`;
  $("#monthTitle").setAttribute("aria-expanded", state.picker);
  $("#calViews").innerHTML = [["month", "เดือน"], ["week", "สัปดาห์"], ["agenda", "กำหนดการ"]].map(([v, l]) =>
    `<button class="${view === v ? "on" : ""}" data-calview="${v}">${l}</button>`).join("");
  renderPicker();
  $("#dayBlock").hidden = view === "agenda";
  $("#calBody").innerHTML = view === "month" ? monthGrid(list) : view === "week" ? weekStrip(list) : agenda(list);
  if (view === "agenda") return;

  const evs = list.filter(e => onDay(e, state.day));
  $("#dayTitle").textContent = state.day === TODAY ? "วันนี้" : fmt(state.day);
  $("#clash").textContent = evs.length > 1 ? `⚡ ชนกัน ${evs.length} งาน` : "";
  $("#dayEvents").innerHTML = evs.length ? evs.map(card).join("") : `<p class="empty">ไม่มีงานวันนี้ แตะวันอื่นในปฏิทินดูนะ</p>`;
}

function renderList() {
  const list = visible().filter(e => !e.start || (e.end || e.start) >= TODAY);
  const groups = {};
  for (const e of list) (groups[e.start ? (e.start < TODAY ? TODAY : e.start).slice(0, 7) : "nodate"] ||= []).push(e);
  const keys = Object.keys(groups).sort();
  // Events without a date are kept out of the way: a collapsed section at the very end.
  $("#list").innerHTML = keys.length ? keys.map(k => {
    if (k === "nodate") return `<details class="undated"><summary>รอประกาศวัน <small>${groups[k].length} งาน · ยังไม่มีวันที่ในข่าว</small></summary>
      <div class="cards">${groups[k].map(card).join("")}</div></details>`;
    const t = `${MONTHS[Number(k.slice(5)) - 1]} ${yr(Number(k.slice(0, 4)))}`;
    return `<div class="section-head"><h2>${t}</h2><small>${groups[k].length} งาน</small></div><div class="cards">${groups[k].map(card).join("")}</div>`;
  }).join("") : `<p class="empty">ไม่มีงานตามตัวกรองที่เลือก</p>`;
}

function renderMine() {
  const list = state.events.filter(e => state.starred.has(e.id));
  $("#mineHint").textContent = list.length ? "" : "ยังไม่ได้ติดตามงานไหน กด ☆ ที่งานที่สนใจเพื่อเก็บไว้ตรงนี้";
  $("#exportIcs").hidden = !list.some(e => e.start);
  const changed = changedFollowed();
  const matched = state.events.filter(e => !state.starred.has(e.id) && (!e.end || e.end >= TODAY) && followMatch(e));
  const followBox = `<div class="setting follows"><h4>${icon("search")} ติดตามศิลปิน / IP / สถานที่</h4>
      <p>พิมพ์คำที่สนใจ งานที่มีคำนี้ในชื่อ สถานที่ หรือรายละเอียดจะขึ้นตรงนี้เอง และระบบจะช่วยค้นหางานของคำนี้จากเว็บและเพจต่างๆ ให้ด้วย (ส่งแค่คำ ไม่มีข้อมูลส่วนตัว)</p>
      <form class="follow-form" data-follow-form><input name="w" placeholder="เช่น Hololive, Comiket, ศูนย์สิริกิติ์" autocomplete="off"><button class="pill">ติดตาม</button></form>
      <div class="wrap">${state.follows.map(w => `<button class="chip on" data-unfollow="${esc(w)}">${esc(w)} ✕</button>`).join("")}</div></div>`;
  $("#mineFollows").innerHTML = followBox + (matched.length ? `<div class="section-head"><h2>ตรงกับคำที่ติดตาม</h2><small>${matched.length} งาน</small></div>
      <div class="cards">${matched.slice(0, 40).map(card).join("")}</div>` : "");
  $("#mineEvents").innerHTML = (changed.length ? `<div class="notice"><b>มีการเปลี่ยนแปลง ${changed.length} งาน</b>
      <div class="cards">${changed.map(card).join("")}</div><button class="link" data-seen>รับทราบแล้ว</button></div>` : "")
    + list.filter(e => !changed.includes(e)).map(card).join("");
}

// Reports and followed words go to a Google Form straight from the app (no account, nothing personal is sent).
// Each pipeline run reads the answers sheet, checks reports with AI, fixes or removes events, and adds followed words
// to the web-search watch list.
const FORM = "https://docs.google.com/forms/d/e/1FAIpQLScuivlT-u2dc9JFj3F0AhlvhysCwymALxVbbrDYBsOOhPv1Cw";
const FORM_FIELDS = { kind: "entry.1328089119", detail: "entry.691050905", correct: "entry.1963664203", id: "entry.576375444" };
const REPORT_URL = `${FORM}/viewform`; // the plain form, for anything the in-app sheet doesn't cover
function sendForm(values) {
  const body = new URLSearchParams(Object.entries(values).map(([k, v]) => [FORM_FIELDS[k], v]));
  // no-cors: Google Forms accepts the post but the response can't be read — treat a sent request as delivered
  return fetch(`${FORM}/formResponse`, { method: "POST", mode: "no-cors", body }).then(() => true, () => false);
}
const KIND = { wrong: "แจ้งข้อมูลผิด", remove: "ขอให้ลบ", watch: "ให้ระบบค้นหาคำนี้" };
function reportSheet(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  showSheet(`<div class="sheet-content report"><span class="grab dark"></span>
    <h3>แจ้งข้อมูล</h3><p class="orig">${esc(title(e))}</p>
    <form data-report-form="${e.id}">
      <div class="seg"><label><input type="radio" name="kind" value="wrong" checked> ข้อมูลผิด</label>
        <label><input type="radio" name="kind" value="remove"> ขอให้ลบ</label></div>
      <textarea name="detail" required placeholder="อะไรผิด เช่น วันที่จริงคือ 5–6 ธ.ค. / สถานที่ผิด / งานซ้ำกับ… / รูปไม่ใช่ของงานนี้"></textarea>
      <textarea name="correct" placeholder="ข้อมูลที่ถูกต้อง หรือลิงก์อ้างอิง (ถ้ามี)"></textarea>
      <button class="pill done">ส่งให้ระบบตรวจ</button>
      <p class="hint">ระบบจะตรวจกับแหล่งข้อมูลและแก้ไขให้เองในรอบอัปเดตถัดไป ไม่ต้องใส่ข้อมูลส่วนตัว</p>
    </form></div>`, "report");
}

// System status written by each pipeline run (data/status.json).
async function loadStatus() {
  const st = await getJson(`data/status.json?t=${Date.now()}`, null);
  const box = $("#statusBox");
  if (!box) return;
  if (!st) { box.querySelector("p").textContent = "ยังไม่มีข้อมูลสถานะ"; return; }
  const ago = Math.round((Date.now() - new Date(st.finishedAt)) / 60000);
  const when = ago < 60 ? `${ago} นาทีที่แล้ว` : ago < 1440 ? `${Math.round(ago / 60)} ชั่วโมงที่แล้ว` : `${Math.round(ago / 1440)} วันที่แล้ว`;
  box.innerHTML = `<h4>${icon("auto")} สถานะระบบ <span class="dot ${st.problems?.length ? "bad" : "ok"}"></span></h4>
    <p>อัปเดตล่าสุด ${when} (${st.runner === "github" ? "อัตโนมัติบน GitHub" : "เครื่องของผู้ดูแล"})</p>
    <ul class="stat">
      <li><b>${st.total}</b> งานทั้งหมด · <b>${st.upcoming}</b> งานที่กำลังจะมาถึง</li>
      <li>รอบล่าสุดเพิ่ม <b>${st.added}</b> งาน · ข่าวรอคัด <b>${st.pending}</b></li>
      <li>มีวันที่ ${st.withDate}% · มีรูป ${st.withImage}% · มีค่าเข้า ${st.withPrice}%</li>
    </ul>
    ${st.problems?.length ? `<p class="warn">${st.problems.map(esc).join("<br>")}</p>` : "<p>ทุกอย่างทำงานปกติ</p>"}`;
}

// Backup / move to a new phone: followed events and words travel in a link (#import=…), no account needed.
function backupLink() {
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ s: [...state.starred], f: state.follows }))));
  return `${location.origin}${location.pathname}#import=${data}`;
}
function importFromHash() {
  const m = location.hash.match(/^#import=(.+)$/);
  if (!m) return false;
  history.replaceState(null, "", location.pathname);
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    (d.s || []).forEach(id => state.starred.add(id));
    state.follows = [...new Set([...state.follows, ...(d.f || [])])];
    store.set("starred", [...state.starred]); store.set("follows", state.follows);
    markSeen(state.events.filter(e => state.starred.has(e.id)));
    toast(`นำเข้าแล้ว: งานที่ติดตาม ${(d.s || []).length} งาน · คำที่ติดตาม ${(d.f || []).length} คำ`);
  } catch { toast("ลิงก์สำรองไม่ถูกต้อง"); }
  return true;
}

// First visit only: pick interests and (optionally) home region. Anyone with saved settings never sees it.
function maybeOnboard() {
  const used = ["starred", "offTags", "view", "prefs", "follows", "countries"].some(k => { try { return localStorage.getItem(k) !== null; } catch { return true; } });
  if (store.get("onboarded", false) || used) { store.set("onboarded", true); return; }
  const picked = new Set();
  const v = Object.assign(document.createElement("div"), { className: "onboard" });
  const draw = () => {
    v.innerHTML = `<div class="onboard-card"><h2>ยินดีต้อนรับสู่ EventRadar</h2>
      <p>รวมงานอีเวนต์ในไทย ญี่ปุ่น จีน เวียดนาม เกาหลี และอินโดนีเซีย อัปเดตเองวันละ 4 รอบ · กด ☆ เพื่อติดตามงาน · สมัครรับปฏิทินได้ที่หน้าตั้งค่า</p>
      <h5>สนใจหมวดไหน (เลือกได้หลายหมวด)</h5>
      <div class="wrap">${Object.entries(GROUPS).map(([g, x]) => `<button class="chip ${picked.has(g) ? "on" : ""}" style="--c:${x.color}" data-pick="${g}">${x.icon} ${x.name}</button>`).join("")}</div>
      <button class="pill done" data-onboard-done>${picked.size ? `เริ่มเลย (${picked.size} หมวด)` : "ดูทุกหมวด"}</button>
      <button class="link" data-onboard-done>ข้ามไปก่อน</button></div>`;
  };
  v.addEventListener("click", ev => {
    const p = ev.target.closest("[data-pick]");
    if (p) { picked.has(p.dataset.pick) ? picked.delete(p.dataset.pick) : picked.add(p.dataset.pick); draw(); return; }
    if (!ev.target.closest("[data-onboard-done]")) return;
    if (picked.size) {
      for (const [g, x] of Object.entries(GROUPS)) if (!picked.has(g)) Object.keys(x.tags).forEach(t => state.offTags.add(t));
      store.set("offTags", [...state.offTags]);
    }
    store.set("onboarded", true);
    v.remove();
    render();
  });
  draw();
  document.body.append(v);
}

// webcal:// subscribes in Apple Calendar directly; Google Calendar takes the same feed through its "add by URL" link.
function subscribeUrl(group) {
  const feed = new URL(`data/ics/${group}.ics`, location.href).href.replace(/^https?:/, "webcal:");
  return isApple ? feed : `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`;
}

function renderSettings() {
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, label, ic]) =>
    `<button class="${(prefs[k] || "") === v ? "on" : ""}" data-pref="${k}" data-val="${v}">${ic ? icon(ic) : ""}${label}</button>`).join("")}</div>`;
  const accents = [["", "#7a5cff"], ["pink", "#e8457f"], ["blue", "#3d7bf7"], ["green", "#1fa67a"]];
  $("#settings").innerHTML = `<div class="section-head"><h2>ตั้งค่า</h2></div><div class="settings">
    <div class="setting"><h4>${icon("moon")} ธีม</h4>${seg("theme", [["", "ตามเครื่อง", "auto"], ["light", "สว่าง", "sun"], ["dark", "มืด", "moon"]])}</div>
    <div class="setting"><h4>${icon("sparkle")} สีหลัก</h4><div class="swatches">${accents.map(([v, c]) =>
      `<button class="${(prefs.accent || "") === v ? "on" : ""}" style="background:${c}" data-pref="accent" data-val="${v}" aria-label="สี ${c}"></button>`).join("")}</div></div>
    <div class="setting"><h4>${icon("calendar")} ปฏิทิน</h4><p>วันแรกของสัปดาห์</p>${seg("weekStart", [["", "อาทิตย์"], ["mon", "จันทร์"]])}
      <p style="margin-top:12px">รูปแบบปี</p>${seg("era", [["", "พ.ศ."], ["ce", "ค.ศ."]])}</div>
    <div class="setting"><h4>${icon("type")} ขนาดตัวอักษร</h4>${seg("size", [["", "ปกติ"], ["large", "ใหญ่"]])}</div>
    <div class="setting"><h4>${icon("sparkle")} แอนิเมชัน</h4>${seg("motion", [["", "เปิด"], ["off", "ลดการเคลื่อนไหว"]])}</div>
    <div class="setting"><h4>${icon("calplus")} สมัครรับปฏิทิน</h4>
      <p>เพิ่มครั้งเดียว แล้วงานใหม่จะเข้าปฏิทินในมือถือเอง (อัปเดตทุกไม่กี่ชั่วโมง)</p>
      <div class="subs">${[["all", "✨ ทุกงาน"], ...Object.entries(GROUPS).map(([g, x]) => [g, `${x.icon} ${x.name}`])].map(([g, label]) =>
        `<a class="chip" href="${esc(subscribeUrl(g))}" ${isApple ? "" : 'target="_blank" rel="noopener"'}>${label}</a>`).join("")}</div></div>
    <div class="setting"><h4>${icon("pin")} ตำแหน่งของฉัน</h4>
      <p>ใช้กับปุ่ม "📍 ใกล้ฉัน" บนหน้าแรก</p>
      <select class="select" data-home>${["", ...Object.keys(REGION_CENTRES)].map(k =>
        `<option value="${k}" ${home() === k ? "selected" : ""}>${k ? `${COUNTRIES[k.split(":")[0]]} · ${REGIONS[k.split(":")[0]]?.[k.split(":")[1]] || ""}` : "ไม่ระบุ"}</option>`).join("")}</select>
      <button class="pill gps" data-gps>${icon("pin")} ใช้ตำแหน่งปัจจุบัน (GPS)</button></div>
    <div class="setting"><h4>${icon("star")} ข้อมูลของฉัน</h4>
      <p>งานที่ติดตามและการตั้งค่าเก็บไว้ในเครื่องนี้เท่านั้น ไม่ต้องสมัครสมาชิก ถ้าจะย้ายไปเครื่องใหม่ ให้กดสำรองแล้วเปิดลิงก์ในเครื่องใหม่</p>
      <button class="pill" data-backup>สำรอง / ย้ายเครื่อง</button>
      <button class="danger" data-clear-stars style="margin-top:8px">ล้างงานที่ติดตามทั้งหมด</button></div>
    <div class="setting" id="statusBox"><h4>${icon("auto")} สถานะระบบ</h4><p>กำลังโหลด…</p></div>
    <div class="setting about"><h4>${icon("sparkle")} เกี่ยวกับ EventRadar</h4>
      <p>โปรเจกต์ส่วนตัว ไม่แสวงหากำไร รวมงานอีเวนต์จากข่าวและเว็บขายบัตรในไทย ญี่ปุ่น จีน เวียดนาม เกาหลีใต้ และอินโดนีเซีย โดยใช้ AI ช่วยคัดและสรุป
      ข้อมูลอาจคลาดเคลื่อนได้ โปรดตรวจสอบกับผู้จัดงานก่อนเดินทาง</p>
      <p>รูปภาพและข่าวเป็นลิขสิทธิ์ของเว็บต้นทาง ทุกงานมีลิงก์กลับไปยังแหล่งที่มา ถ้าเป็นเจ้าของเนื้อหาและต้องการให้ลบ
      หรือพบข้อมูลผิด แจ้งได้ที่ <a href="${REPORT_URL}" target="_blank" rel="noopener">แจ้งปัญหา / ขอให้ลบ</a></p>
      <p>แหล่งข้อมูล: Bing News, Google News, PR TIMES, Eventpop, bilibili会员购 · รูปผ่าน images.weserv.nl</p></div>
  </div>`;
  loadStatus();
}

function render() {
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== state.view));
  $("#filters").hidden = state.view === "mine" || state.view === "settings";
  // The tab badge shows changes to followed events when there are any, else how many are followed.
  const n = state.events.filter(e => state.starred.has(e.id)).length, c = changedFollowed().length;
  $("#mineBadge").hidden = !n;
  $("#mineBadge").textContent = c ? "!" : n;
  $("#mineBadge").classList.toggle("alert", !!c);
  chips();
  ({ home: renderHome, list: renderList, mine: renderMine, settings: renderSettings })[state.view]();
}

const ymd = s => s.replaceAll("-", "");
const nextDay = s => { const x = new Date(s + "T00:00:00"); x.setDate(x.getDate() + 1); return iso(x); };
const where = e => [e.venue, e.city].filter(Boolean).join(", ");

function googleCal(e) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: title(e), dates: `${ymd(e.start)}/${ymd(nextDay(e.end || e.start))}`,
    location: where(e), details: [e.summary_th, e.official || e.sources[0]?.link].filter(Boolean).join("\n") });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function openSheet(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  // A working direct article first; Google News links only redirect (often to a Yahoo page that is gone), so the
  // article the pipeline found by searching comes before them.
  const news = (e.sources.find(s => !s.dead && !/news\.google\./.test(s.link)) || {}).link || e.article || (e.sources.find(s => !s.dead) || {}).link;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.start?.slice(0, 4) || ""}`)}`;
  const fresh = $("#sheet").hidden || $("#sheetBody").dataset.kind !== "event";
  showSheet(`
    <div class="sheet-hero" style="--c:${color(e)}" ${e.image ? `data-zoom="${e.id}"` : ""}>${img(e, 400)}<span class="grab"></span>
      <span class="when">${countdown(e)}</span>
      <button class="icon-btn share" data-share="${e.id}" aria-label="แชร์ให้เพื่อน">${icon("share")}</button>
      <button class="icon-btn close" data-close aria-label="ปิด">${icon("x")}</button></div>
    <div class="sheet-content">
      <div class="badges">${statusBadge(e)}${e.online ? `<span class="badge online">ออนไลน์</span>` : ""}${isNew(e) ? `<span class="badge new">ใหม่</span>` : ""}${e.tags.map(t => badge(t).replace(">", `>${TAGS[t]?.icon || ""} `)).join("")}</div>
      <h3 style="margin-top:10px">${esc(title(e))}</h3>
      ${e.name_th && e.name_th !== e.name ? `<p class="orig">${esc(e.name)}</p>` : ""}
      <div class="facts">
        <div><span>${icon("calendar")}</span><p>${e.status === "cancelled" ? `<s>${dateText(e)}</s> · <b class="warn">งานนี้ยกเลิกแล้ว</b>` : dateText(e)}${e.history?.length
          ? `<br><small class="was">เดิมกำหนด ${e.history.map(h => h.start ? dateText(h) : "ไม่ระบุ").join(", ")} · เปลี่ยนเมื่อ ${fmt(e.changed)}</small>` : ""}</p></div>
        <div><span>${icon("pin")}</span><p>${esc(where(e) || "ยังไม่ระบุสถานที่")} · ${regionName(e) ? `${regionName(e)}, ` : ""}${COUNTRIES[e.country]}</p></div>
        ${e.hours ? `<div><span>${icon("clock")}</span><p>${esc(e.hours)}</p></div>` : ""}
        ${e.signup_th ? `<div><span>${icon("ticket")}</span><p>เปิดรับสมัคร/ขายบัตร: ${esc(e.signup_th)}</p></div>` : ""}
        ${e.price_th ? `<div><span>${icon("ticket")}</span><p>ค่าเข้า: ${esc(e.price_th)}${e.priceSource ? ` <a class="src-link" href="${esc(e.priceSource)}" target="_blank" rel="noopener">ที่มา</a>` : ""}</p></div>` : ""}
      </div>
      ${e.about_th || e.summary_th ? `<h5>งานนี้คืออะไร</h5><p class="summary">${esc(e.about_th || e.summary_th)}</p>` : ""}
      ${e.highlights_th?.length ? `<h5>ไฮไลต์</h5><ul class="highlights">${e.highlights_th.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      <div class="actions">
        <button class="primary" data-star="${e.id}">${icon("star")} ${state.starred.has(e.id) ? "ติดตามอยู่" : "ติดตามงานนี้"}</button>
        ${e.official ? `<a href="${esc(e.official)}" target="_blank" rel="noopener">${icon("link")} เว็บไซต์งาน</a>` : ""}
        ${news ? `<a href="${esc(news)}" target="_blank" rel="noopener">${icon("news")} อ่านข่าว</a>` : ""}
        <a href="${search}" target="_blank" rel="noopener">${icon("search")} ค้นหางานนี้</a>
        ${where(e) ? `<a href="https://www.google.com/maps/search/${encodeURIComponent(where(e))}" target="_blank" rel="noopener">${icon("map")} แผนที่</a>` : ""}
        ${e.start ? `<button data-addcal="${e.id}">${icon("calplus")} ลงปฏิทิน</button>` : ""}
      </div>
      <div class="sheet-links">
        ${e.venue ? `<button class="chip" data-follow-word="${esc(e.venue)}">${icon("pin")} ติดตามสถานที่นี้</button>` : ""}
        <button class="chip" data-report="${e.id}">แจ้งข้อมูลผิด</button>
      </div>
      <div class="sources">ข่าวที่พูดถึงงานนี้ (${e.sources.filter(s => !s.dead).length})
        ${e.sources.filter(s => !s.dead).map(s => `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)} <small>· ${esc(s.source)}</small></a>`).join("")}
      </div>
    </div>`, "event");
  if (fresh) $("#sheetBody").scrollTop = 0;
  // The 400px poster is already cached from the list, so it shows at once; swap in a sharper one when it arrives.
  const hero = $(".sheet-hero img");
  if (hero && e.image) {
    const hi = new Image();
    hi.onload = () => { if (hero.isConnected) hero.src = hi.src; };
    hi.src = proxied(e.image, 900);
  }
}

// Tap the poster to see it full screen; tap again (or Esc) to close.
function zoomPoster(id) {
  const e = state.events.find(x => x.id === id);
  if (!e?.image) return;
  const v = Object.assign(document.createElement("div"), { className: "viewer" });
  v.innerHTML = `<img src="${esc(proxied(e.image, 400))}" alt=""><button class="icon-btn close" aria-label="ปิด">${icon("x")}</button>`;
  const full = new Image();
  full.onload = () => { const i = v.querySelector("img"); if (i) i.src = full.src; };
  full.src = proxied(e.image, 1600);
  v.addEventListener("click", () => v.remove());
  document.body.append(v);
}

function showSheet(html, kind) {
  const keepScroll = $("#sheetBody").scrollTop;
  $("#sheetBody").innerHTML = html;
  $("#sheetBody").dataset.kind = kind;
  if ($("#sheet").hidden) {
    history.pushState({ sheet: kind }, ""); // phone back button closes the sheet
    $("#sheet").hidden = false;
    document.body.classList.add("lock");
    $("#sheetBody").scrollTop = 0;
  } else $("#sheetBody").scrollTop = keepScroll;
}

// Share link opens the app straight on this event: …/eventradar/#e=<id>
async function share(id) {
  const e = state.events.find(x => x.id === id);
  // The share page carries the poster/name preview for LINE and Facebook, then opens the app on this event.
  const url = `${location.origin}${location.pathname}data/e/${id}.html`;
  const text = `${title(e)} · ${dateText(e)}${where(e) ? ` · ${where(e)}` : ""}`;
  try {
    if (navigator.share) return await navigator.share({ title: title(e), text, url });
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย");
  } catch {}
}

function openFromHash() {
  const id = location.hash.match(/^#e=(\w+)/)?.[1];
  if (!id) return;
  history.replaceState(null, "", location.pathname);
  openSheet(id);
}

function toast(msg) {
  const t = Object.assign(document.createElement("div"), { className: "toast", textContent: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

function closeSheet() {
  if ($("#sheet").hidden) return;
  $("#sheet").hidden = true;
  document.body.classList.remove("lock");
  $("#sheetBody").style.transform = "";
  if (history.state?.sheet) { skipPop = true; history.back(); }
}
// Our own history.back() fires popstate later; skip it so it can't close a sheet opened in the meantime.
let skipPop = false;
addEventListener("popstate", () => {
  if (skipPop) { skipPop = false; return; }
  if (!$("#sheet").hidden) { history.replaceState(null, ""); closeSheet(); }
});

// Drag the sheet down (from its top, when not scrolled) to close it.
let dragY = null;
$("#sheetBody").addEventListener("touchstart", e => { dragY = $("#sheetBody").scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
$("#sheetBody").addEventListener("touchmove", e => {
  if (dragY === null) return;
  const dy = e.touches[0].clientY - dragY;
  if (dy > 0) { e.preventDefault(); $("#sheetBody").style.transform = `translate(-50%, ${dy}px)`; }
}, { passive: false });
$("#sheetBody").addEventListener("touchend", e => {
  if (dragY === null) return;
  const dy = e.changedTouches[0].clientY - dragY;
  dragY = null;
  $("#sheetBody").style.transition = "transform .2s";
  if (dy > 90) closeSheet(); else $("#sheetBody").style.transform = "";
  setTimeout(() => ($("#sheetBody").style.transition = ""), 220);
});

function ics(list) {
  const txt = s => String(s || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventRadar//TH"];
  for (const e of list.filter(e => e.start)) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@eventradar`, `DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.end || e.start))}`,
      `SUMMARY:${txt(title(e))}`, `LOCATION:${txt(where(e))}`, `DESCRIPTION:${txt([e.summary_th, e.official || e.sources[0]?.link].filter(Boolean).join("\n"))}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// iPhone/iPad/Mac: opening an .ics shows Apple Calendar's "Add" card. Everything else: Google Calendar's prefilled event.
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
function addToCalendar(e) {
  if (!isApple) return window.open(googleCal(e), "_blank", "noopener");
  location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics([e]))}`;
}

function exportIcs() {
  const list = state.events.filter(e => state.starred.has(e.id));
  if (isApple) { location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics(list))}`; return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics(list)], { type: "text/calendar" }));
  a.download = "eventradar.ics";
  a.click();
}

function toggle(set, key, value) { set.has(value) ? set.delete(value) : set.add(value); store.set(key, [...set]); }

document.addEventListener("click", ev => {
  if (ev.target.closest("a")) return;
  if (ev.target.closest("[data-close]")) return closeSheet();
  const sh = ev.target.closest("[data-share]");
  if (sh) return share(sh.dataset.share);
  const zoom = ev.target.closest("[data-zoom]");
  if (zoom && !ev.target.closest("button")) return zoomPoster(zoom.dataset.zoom);
  const cal = ev.target.closest("[data-addcal]");
  if (cal) return addToCalendar(state.events.find(e => e.id === cal.dataset.addcal));
  const star = ev.target.closest("[data-star]");
  if (star) {
    toggle(state.starred, "starred", star.dataset.star);
    markSeen(state.events.filter(e => e.id === star.dataset.star));
    render();
    if (!$("#sheet").hidden) openSheet(star.dataset.star);
    return;
  }
  const open = ev.target.closest("[data-open]");
  if (open) return openSheet(open.dataset.open);
  const b = ev.target.closest("button, [data-group-all]");
  if (!b) return;
  const inFilters = $("#sheetBody").dataset.kind === "filters" && !$("#sheet").hidden;
  if (b.dataset.filters !== undefined) return filterSheet();
  if (b.dataset.near !== undefined) { state.near = !state.near; store.set("near", state.near); return render(); }
  if (b.dataset.unfollow) { state.follows = state.follows.filter(w => w !== b.dataset.unfollow); store.set("follows", state.follows); return render(); }
  if (b.dataset.report) return reportSheet(b.dataset.report);
  if (b.dataset.followWord) {
    if (!state.follows.includes(b.dataset.followWord)) {
      state.follows.push(b.dataset.followWord); store.set("follows", state.follows);
      sendForm({ kind: KIND.watch, detail: b.dataset.followWord });
    }
    toast(`ติดตาม "${b.dataset.followWord}" แล้ว · ดูได้ที่แท็บของฉัน`); return;
  }
  if (b.dataset.gps !== undefined) {
    if (!navigator.geolocation) return toast("เครื่องนี้ใช้ GPS ไม่ได้");
    navigator.geolocation.getCurrentPosition(p => {
      const k = nearestRegion(p.coords.latitude, p.coords.longitude);
      setPref("home", k); state.near = true; store.set("near", true);
      toast(`ตั้งตำแหน่งเป็น ${REGIONS[k.split(":")[0]]?.[k.split(":")[1]] || k}`); render();
    }, () => toast("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง"), { timeout: 10000 });
    return;
  }
  if (b.dataset.backup !== undefined) {
    const url = backupLink();
    if (navigator.share) navigator.share({ title: "สำรองรายการติดตาม EventRadar", url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast("คัดลอกลิงก์สำรองแล้ว เปิดลิงก์นี้ในเครื่องใหม่"));
    return;
  }
  if (b.dataset.seen !== undefined) { markSeen(changedFollowed()); return render(); }
  if (b.dataset.pref) { setPref(b.dataset.pref, b.dataset.val); return render(); }
  if (b.dataset.clearStars !== undefined) {
    if (confirm("ล้างงานที่ติดตามทั้งหมด?")) { state.starred.clear(); store.set("starred", []); render(); }
    return;
  }
  if (b.dataset.view) { state.view = b.dataset.view; store.set("view", state.view); scrollTo(0, 0); }
  else if (b.dataset.quick !== undefined) { state.quick = b.dataset.quick || null; store.set("quick", state.quick); }
  else if (b.dataset.country) toggle(state.countries, "countries", b.dataset.country);
  else if (b.dataset.tag) toggle(state.offTags, "offTags", b.dataset.tag);
  else if (b.dataset.region) toggle(state.offRegions, "offRegions", b.dataset.region);
  else if (b.dataset.format) { state.format = b.dataset.format; store.set("format", state.format); }
  else if (b.dataset.groupAll) {
    const tags = Object.keys(GROUPS[b.dataset.groupAll].tags), allOn = tags.every(t => !state.offTags.has(t));
    tags.forEach(t => (allOn ? state.offTags.add(t) : state.offTags.delete(t)));
    store.set("offTags", [...state.offTags]);
  } else if (b.dataset.reset !== undefined) {
    state.offTags.clear(); state.offRegions.clear(); state.countries = new Set(Object.keys(COUNTRIES)); state.quick = null; state.format = "all";
    store.set("offTags", []); store.set("offRegions", []); store.set("format", "all"); store.set("countries", [...state.countries]); store.set("quick", null);
  }
  else if (b.dataset.day) {
    state.day = b.dataset.day;
    const d = parse(state.day);
    if (state.calView === "month" && d.getMonth() !== state.month.getMonth()) state.month = new Date(d.getFullYear(), d.getMonth(), 1);
  }
  else if (b.dataset.calview) { state.calView = b.dataset.calview; state.picker = false; store.set("calView", state.calView); }
  else if (b.id === "monthTitle") { state.picker = !state.picker; state.pickerYear = state.month.getFullYear(); }
  else if (b.dataset.pyear) state.pickerYear += Number(b.dataset.pyear);
  else if (b.dataset.pmonth) {
    state.month = new Date(state.pickerYear, Number(b.dataset.pmonth), 1);
    state.day = iso(state.month); state.picker = false;
  }
  else if (b.id === "today") { state.day = TODAY; state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); state.picker = false; }
  else if (b.id === "prev" || b.id === "next") stepCalendar(b.id === "next" ? 1 : -1);
  else if (b.id === "exportIcs") return exportIcs();
  else return;
  render();
  if (inFilters) filterSheet();
});

function shiftMonth(n) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1); }

// Swipe the month grid left/right to change month.
// Only a quick, clearly sideways swipe on the grid changes month/week. Scrolling the page up or down (even at a slant)
// must never move the calendar, so the gesture has to be mostly horizontal and short.
let touch = null;
$("#calBody").addEventListener("touchstart", e => {
  touch = e.target.closest(".swipe") ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
}, { passive: true });
$("#calBody").addEventListener("touchend", e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y, ms = Date.now() - touch.t;
  touch = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2.5 * Math.abs(dy) && ms < 500) { stepCalendar(dx < 0 ? 1 : -1); render(); }
});
document.addEventListener("submit", async ev => {
  if (ev.target.matches("[data-report-form]")) {
    ev.preventDefault();
    const f = ev.target, id = f.dataset.reportForm;
    f.querySelector("button").disabled = true;
    const ok = await sendForm({ kind: KIND[f.kind.value], detail: f.detail.value.trim(), correct: f.correct.value.trim(), id });
    closeSheet();
    toast(ok ? "ส่งแล้ว ขอบคุณ! ระบบจะตรวจและแก้ไขในรอบอัปเดตถัดไป" : "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    return;
  }
  if (!ev.target.matches("[data-follow-form]")) return;
  ev.preventDefault();
  const w = ev.target.w.value.trim();
  if (w && !state.follows.includes(w)) {
    state.follows.push(w); store.set("follows", state.follows);
    sendForm({ kind: KIND.watch, detail: w }); // the word also joins the system's web-search list
  }
  render();
});
document.addEventListener("change", ev => {
  if (!ev.target.matches("[data-home]")) return;
  setPref("home", ev.target.value);
  if (!ev.target.value) { state.near = false; store.set("near", false); }
  render();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const v = $(".viewer");
  v ? v.remove() : closeSheet();
});
$("#search").addEventListener("input", e => { state.q = e.target.value.trim(); render(); });

document.querySelectorAll("[data-icon]").forEach(b => b.insertAdjacentHTML("afterbegin", icon(b.dataset.icon)));

const getJson = (url, def) => fetch(url).then(r => (r.ok ? r.json() : def)).catch(() => def);
Promise.all([getJson("taxonomy.json", {}), getJson(`data/events.json?t=${Date.now()}`, []), getJson("regions.json", {})]).then(([taxonomy, events, regions]) => {
  GROUPS = taxonomy;
  REGIONS = regions;
  if (state.quick && !GROUPS[state.quick]) state.quick = null; // group ids changed since it was saved
  for (const [g, x] of Object.entries(GROUPS))
    for (const [t, name] of Object.entries(x.tags)) TAGS[t] = { name, group: g, color: x.color, icon: x.icon };
  state.events = events;
  const updated = events.reduce((m, e) => (e.updated > m ? e.updated : m), "");
  $("#status").textContent = events.length ? `${events.length} งาน · อัปเดตล่าสุด ${fmt(updated)}` : "ยังไม่มีข้อมูล";
  // Followed events first seen on this phone become the baseline; later changes are reported once.
  markSeen(state.events.filter(e => state.starred.has(e.id) && !seen[e.id]));
  render();
  const c = changedFollowed().length;
  if (c) toast(`งานที่คุณติดตามมีการเปลี่ยนแปลง ${c} งาน — ดูที่แท็บ "ของฉัน"`);
  if (!importFromHash()) openFromHash();
  addEventListener("hashchange", () => importFromHash() || openFromHash());
  maybeOnboard();
});
