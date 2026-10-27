// Weekly LINE digest: broadcasts "this week's events" as a card carousel to everyone who added the LINE OA.
// Needs repo secret LINE_CHANNEL_TOKEN (Messaging API channel access token). Without it the script just says so.
// Usage: node scripts/line-digest.mjs [--dry]   (--dry prints the message instead of sending)
import fs from "node:fs";

const SITE = process.env.SITE_URL || "https://mosstep.github.io/eventradar/";
const token = process.env.LINE_CHANNEL_TOKEN;
const dry = process.argv.includes("--dry");
const events = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

const iso = d => d.toISOString().slice(0, 10);
const today = iso(new Date()), weekEnd = iso(new Date(Date.now() + 7 * 864e5));
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const d = s => { const [y, m, dd] = s.split("-").map(Number); return `${dd} ${TH_MONTH[m - 1]}`; };
const FLAG = { TH: "🇹🇭", JP: "🇯🇵", CN: "🇨🇳" };

// Events happening in the next 7 days; Thai ones first (most readers can go), then by start date, with posters first.
const week = events.filter(e => e.start && e.start <= weekEnd && (e.end || e.start) >= today && e.status !== "cancelled")
  .sort((a, b) => (a.country === "TH" ? 0 : 1) - (b.country === "TH" ? 0 : 1) || (b.image ? 1 : 0) - (a.image ? 1 : 0) || a.start.localeCompare(b.start))
  .slice(0, 10);
if (!week.length) { console.log("no events this week — nothing sent"); process.exit(0); }

const bubble = e => ({
  type: "bubble", size: "kilo",
  ...(e.image ? { hero: { type: "image", url: `https://images.weserv.nl/?url=${encodeURIComponent(e.image)}&w=600&h=400&fit=cover&output=jpg`,
    size: "full", aspectRatio: "3:2", aspectMode: "cover" } } : {}),
  body: { type: "box", layout: "vertical", spacing: "sm", contents: [
    { type: "text", text: (e.name_th || e.name).slice(0, 80), weight: "bold", size: "md", wrap: true, maxLines: 2 },
    { type: "text", text: `${FLAG[e.country] || ""} ${e.end && e.end !== e.start ? `${d(e.start)} – ${d(e.end)}` : d(e.start)}`, size: "sm", color: "#7a5cff" },
    ...(e.venue ? [{ type: "text", text: e.venue.slice(0, 60), size: "xs", color: "#888888", wrap: true, maxLines: 2 }] : []),
    ...(e.price_th ? [{ type: "text", text: `🎟️ ${e.price_th}`, size: "xs", color: "#888888" }] : []),
  ] },
  footer: { type: "box", layout: "vertical", contents: [
    { type: "button", style: "primary", color: "#7a5cff", height: "sm", action: { type: "uri", label: "ดูรายละเอียด", uri: `${SITE}data/e/${e.id}.html` } },
  ] },
});

const messages = [
  { type: "text", text: `📅 สัปดาห์นี้มีอะไรบ้าง (${d(today)} – ${d(weekEnd)})\nคัดมา ${week.length} งาน · ดูทั้งหมด ${SITE}` },
  { type: "flex", altText: `งานสัปดาห์นี้ ${week.length} งาน`, contents: { type: "carousel", contents: week.map(bubble) } },
];

if (dry || !token) {
  console.log(token ? "dry run:" : "LINE_CHANNEL_TOKEN not set — showing the message instead of sending:");
  console.log(JSON.stringify(messages, null, 1).slice(0, 3000));
  process.exit(0);
}
const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages }),
});
console.log(res.ok ? `sent ${week.length} events` : `LINE error ${res.status}: ${await res.text()}`);
if (!res.ok) process.exit(1);
