// EventRadar: reads data/events.json, filters by country/tag/search, follows events in localStorage.
const COUNTRIES = { TH: "🇹🇭 ไทย", JP: "🇯🇵 ญี่ปุ่น", CN: "🇨🇳 จีน" };
// Filled from taxonomy.json: groups → tags. TAGS[tag] = { name, group, color, icon }.
let GROUPS = {}, TAGS = {};
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
  openGroup: null,
  starred: new Set(store.get("starred", [])),
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  day: TODAY,
  view: ["home", "list", "mine"].includes(store.get("view")) ? store.get("view") : "home",
  q: "",
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = d => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${SHORT[m - 1]} ${y + 543}`; };
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

function visible() {
  const q = state.q.toLowerCase();
  return state.events.filter(e => state.countries.has(e.country) && e.tags.some(t => !state.offTags.has(t))
    && (!q || [e.name, e.name_th, e.venue, e.city].some(s => s?.toLowerCase().includes(q))));
}

// News sites often block hotlinked images; load them through a free image proxy that also resizes.
const proxied = (url, w) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&output=webp`;
const img = (e, w = 400) => e.image
  ? `<img src="${esc(proxied(e.image, w))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${emoji(e)}'))">`
  : emoji(e);

function chips() {
  $("#countryChips").innerHTML = Object.entries(COUNTRIES).map(([k, v]) =>
    `<button class="chip ${state.countries.has(k) ? "on" : ""}" data-country="${k}">${v}</button>`).join("");
  // Row 1: groups (tap to open its sub-tags). Row 2: the open group's sub-tags.
  const allOn = !state.offTags.size;
  $("#groupChips").innerHTML = `<button class="chip ${allOn ? "on" : ""}" data-all>✨ ทุกหมวด</button>` +
    Object.entries(GROUPS).map(([g, x]) => {
      const tags = Object.keys(x.tags), on = tags.filter(t => !state.offTags.has(t)).length;
      return `<button class="chip group ${on ? "on" : ""} ${state.openGroup === g ? "open" : ""}" style="--c:${x.color}" data-group="${g}">
        ${x.icon} ${x.name}${on && on < tags.length ? ` <small>${on}/${tags.length}</small>` : ""} <span class="caret">▾</span></button>`;
    }).join("");
  const g = GROUPS[state.openGroup];
  $("#tagChips").hidden = !g;
  if (!g) return;
  const tags = Object.keys(g.tags), groupOn = tags.every(t => !state.offTags.has(t));
  $("#tagChips").innerHTML = `<button class="chip ${groupOn ? "on" : ""}" style="--c:${g.color}" data-group-all="${state.openGroup}">ทั้งหมวด</button>` +
    tags.map(t => `<button class="chip ${state.offTags.has(t) ? "" : "on"}" style="--c:${g.color}" data-tag="${t}">${g.tags[t]}</button>`).join("");
}

function card(e) {
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  return `<div class="card" style="--c:${color(e)}" data-open="${e.id}" role="button" tabindex="0">
    <div class="thumb">${img(e)}</div>
    <div>
      <h4>${esc(title(e))}</h4>
      <p class="meta">📅 ${dateText(e)}</p>
      <p class="meta">${COUNTRIES[e.country]}${place ? ` · ${esc(place)}` : ""}</p>
      <div class="badges">${isNew(e) ? `<span class="badge new">ใหม่</span>` : ""}${e.tags.map(badge).join("")}</div>
    </div>
    <button class="star ${state.starred.has(e.id) ? "on" : ""}" data-star="${e.id}" aria-label="ติดตาม">${state.starred.has(e.id) ? "★" : "☆"}</button>
  </div>`;
}

function renderHome() {
  const list = visible();
  const soon = list.filter(e => e.start && (e.end || e.start) >= TODAY && daysUntil(e.start) <= 30).slice(0, 12);
  $("#soonCount").textContent = soon.length ? `${soon.length} งานใน 30 วัน` : "";
  $("#soon").innerHTML = soon.length ? soon.map(e => `<button class="poster" style="--c:${color(e)}" data-open="${e.id}">
      <div class="img">${img(e)}<span class="count">${countdown(e)}</span></div>
      <div class="txt"><h4>${esc(title(e))}</h4><p>${COUNTRIES[e.country]} · ${e.start ? fmt(e.start) : ""}</p></div>
    </button>`).join("") : `<p class="empty">ยังไม่มีงานใน 30 วันข้างหน้าตามตัวกรองนี้</p>`;

  const m = state.month;
  $("#monthTitle").textContent = `${MONTHS[m.getMonth()]} ${m.getFullYear() + 543}`;
  const first = new Date(m.getFullYear(), m.getMonth(), 1 - m.getDay());
  let html = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i), day = iso(d);
    const evs = list.filter(e => onDay(e, day));
    const bars = evs.slice(0, 3).map(e => `<i style="background:${color(e)}"></i>`).join("");
    html += `<button class="day ${d.getMonth() !== m.getMonth() ? "out" : ""} ${day === TODAY ? "today" : ""} ${day === state.day ? "sel" : ""}" data-day="${day}">
      <b>${d.getDate()}</b><span class="bars">${bars}</span>${evs.length > 1 ? `<em class="n">${evs.length}</em>` : ""}</button>`;
  }
  $("#days").innerHTML = html;

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
  $("#list").innerHTML = keys.length ? keys.map(k => {
    const t = k === "nodate" ? "ยังไม่ประกาศวัน" : `${MONTHS[Number(k.slice(5)) - 1]} ${Number(k.slice(0, 4)) + 543}`;
    return `<div class="section-head"><h2>${t}</h2><small>${groups[k].length} งาน</small></div><div class="cards">${groups[k].map(card).join("")}</div>`;
  }).join("") : `<p class="empty">ไม่มีงานตามตัวกรองที่เลือก</p>`;
}

function renderMine() {
  const list = state.events.filter(e => state.starred.has(e.id));
  $("#mineHint").textContent = list.length ? "" : "ยังไม่ได้ติดตามงานไหน กด ☆ ที่งานที่สนใจเพื่อเก็บไว้ตรงนี้";
  $("#exportIcs").hidden = !list.some(e => e.start);
  $("#mineEvents").innerHTML = list.map(card).join("");
}

function render() {
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== state.view));
  $("#filters").hidden = state.view === "mine";
  const n = state.events.filter(e => state.starred.has(e.id)).length;
  $("#mineBadge").hidden = !n;
  $("#mineBadge").textContent = n;
  chips();
  ({ home: renderHome, list: renderList, mine: renderMine })[state.view]();
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
  const news = e.sources[0]?.link;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.start?.slice(0, 4) || ""}`)}`;
  $("#sheetBody").innerHTML = `
    <div class="sheet-hero" style="--c:${color(e)}">${img(e, 800)}<span class="grab"></span>
      <button class="close" data-close aria-label="ปิด">✕</button></div>
    <div class="sheet-content">
      <div class="badges">${isNew(e) ? `<span class="badge new">ใหม่</span>` : ""}${e.tags.map(t => badge(t).replace(">", `>${TAGS[t]?.icon || ""} `)).join("")}</div>
      <h3 style="margin-top:10px">${esc(title(e))}</h3>
      ${e.name_th && e.name_th !== e.name ? `<p class="orig">${esc(e.name)}</p>` : ""}
      <div class="facts">
        <div><span>📅</span><p>${dateText(e)} · <b>${countdown(e)}</b></p></div>
        <div><span>📍</span><p>${esc(where(e) || "ยังไม่ระบุสถานที่")} · ${COUNTRIES[e.country]}</p></div>
      </div>
      ${e.hours || e.price_th ? `<div class="facts">
        ${e.hours ? `<div><span>🕒</span><p>${esc(e.hours)}</p></div>` : ""}
        ${e.price_th ? `<div><span>🎟️</span><p>${esc(e.price_th)}</p></div>` : ""}</div>` : ""}
      ${e.about_th || e.summary_th ? `<h5>งานนี้คืออะไร</h5><p class="summary">${esc(e.about_th || e.summary_th)}</p>` : ""}
      ${e.highlights_th?.length ? `<h5>ไฮไลต์</h5><ul class="highlights">${e.highlights_th.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      <div class="actions">
        <button class="primary" data-star="${e.id}">${state.starred.has(e.id) ? "★ ติดตามอยู่" : "☆ ติดตามงานนี้"}</button>
        <button data-share="${e.id}">📤 แชร์ให้เพื่อน</button>
        ${e.official ? `<a href="${esc(e.official)}" target="_blank" rel="noopener">🔗 เว็บไซต์งาน</a>` : ""}
        ${news ? `<a href="${esc(news)}" target="_blank" rel="noopener">📰 อ่านข่าว</a>` : ""}
        <a href="${search}" target="_blank" rel="noopener">🔍 ค้นหางานนี้</a>
        ${where(e) ? `<a href="https://www.google.com/maps/search/${encodeURIComponent(where(e))}" target="_blank" rel="noopener">🗺️ แผนที่</a>` : ""}
        ${e.start ? `<a href="${googleCal(e)}" target="_blank" rel="noopener">📆 ลง Google Calendar</a>` : ""}
      </div>
      <div class="sources">ข่าวที่พูดถึงงานนี้ (${e.sources.length})
        ${e.sources.map(s => `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)} <small>· ${esc(s.source)}</small></a>`).join("")}
      </div>
    </div>`;
  if ($("#sheet").hidden) history.pushState({ sheet: id }, ""); // phone back button closes the sheet
  $("#sheet").hidden = false;
  document.body.classList.add("lock");
  $("#sheetBody").scrollTop = 0;
}

// Share link opens the app straight on this event: …/eventradar/#e=<id>
async function share(id) {
  const e = state.events.find(x => x.id === id);
  const url = `${location.origin}${location.pathname}#e=${id}`;
  const text = `${title(e)} · ${dateText(e)}${where(e) ? ` · ${where(e)}` : ""}`;
  try {
    if (navigator.share) return await navigator.share({ title: title(e), text, url });
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย");
  } catch {}
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
  if (history.state?.sheet) history.back();
}
addEventListener("popstate", () => { if (!$("#sheet").hidden) { history.replaceState(null, ""); closeSheet(); } });

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

function exportIcs() {
  const txt = s => String(s || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventRadar//TH"];
  for (const e of state.events.filter(e => state.starred.has(e.id) && e.start)) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@eventradar`, `DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.end || e.start))}`,
      `SUMMARY:${txt(title(e))}`, `LOCATION:${txt(where(e))}`, `DESCRIPTION:${txt([e.summary_th, e.official || e.sources[0]?.link].filter(Boolean).join("\n"))}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = "eventradar.ics";
  a.click();
}

function toggle(set, key, value) { set.has(value) ? set.delete(value) : set.add(value); store.set(key, [...set]); }

document.addEventListener("click", ev => {
  if (ev.target.closest("a")) return;
  if (ev.target.closest("[data-close]")) return closeSheet();
  const sh = ev.target.closest("[data-share]");
  if (sh) return share(sh.dataset.share);
  const star = ev.target.closest("[data-star]");
  if (star) {
    toggle(state.starred, "starred", star.dataset.star);
    render();
    if (!$("#sheet").hidden) openSheet(star.dataset.star);
    return;
  }
  const open = ev.target.closest("[data-open]");
  if (open) return openSheet(open.dataset.open);
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.view) { state.view = b.dataset.view; store.set("view", state.view); scrollTo(0, 0); }
  else if (b.dataset.country) toggle(state.countries, "countries", b.dataset.country);
  else if (b.dataset.tag) toggle(state.offTags, "offTags", b.dataset.tag);
  else if (b.dataset.group) state.openGroup = state.openGroup === b.dataset.group ? null : b.dataset.group;
  else if (b.dataset.groupAll) {
    const tags = Object.keys(GROUPS[b.dataset.groupAll].tags), allOn = tags.every(t => !state.offTags.has(t));
    tags.forEach(t => (allOn ? state.offTags.add(t) : state.offTags.delete(t)));
    store.set("offTags", [...state.offTags]);
  } else if (b.dataset.all !== undefined) { state.offTags.clear(); store.set("offTags", []); }
  else if (b.dataset.day) state.day = b.dataset.day;
  else if (b.id === "prev" || b.id === "next") shiftMonth(b.id === "next" ? 1 : -1);
  else if (b.id === "exportIcs") return exportIcs();
  else return;
  render();
});

function shiftMonth(n) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1); }

// Swipe the month grid left/right to change month.
let touchX = null;
$("#days").addEventListener("touchstart", e => (touchX = e.touches[0].clientX), { passive: true });
$("#days").addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) { shiftMonth(dx < 0 ? 1 : -1); render(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
$("#search").addEventListener("input", e => { state.q = e.target.value.trim(); render(); });

const getJson = (url, def) => fetch(url).then(r => (r.ok ? r.json() : def)).catch(() => def);
Promise.all([getJson("taxonomy.json", {}), getJson("data/events.json", [])]).then(([taxonomy, events]) => {
  GROUPS = taxonomy;
  for (const [g, x] of Object.entries(GROUPS))
    for (const [t, name] of Object.entries(x.tags)) TAGS[t] = { name, group: g, color: x.color, icon: x.icon };
  state.events = events;
  const updated = events.reduce((m, e) => (e.updated > m ? e.updated : m), "");
  $("#status").textContent = events.length ? `${events.length} งาน · อัปเดตล่าสุด ${fmt(updated)}` : "ยังไม่มีข้อมูล";
  render();
  const shared = location.hash.match(/^#e=(\w+)/)?.[1];
  if (shared) { history.replaceState(null, "", location.pathname); openSheet(shared); }
});
