// Checks for the pipeline helpers that have broken before. Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseJson, repairQuotes, similar, similarLoose, near, years, isDate, unwrap, tag, extractText, dateMentions, cleanSplit, eventId, errorKind, prefilterReason, tagPriority } from "../pipeline/lib.mjs";
import { NOT_EVENT_WORDS, PRTIMES_EVENT, EVENT_WORDS } from "../pipeline/sources.mjs";
import { providerOf } from "../pipeline/tenixe.mjs";

test("bare quotes inside AI JSON are repaired", () => {
  const broken = '{"events":[{"name":"お昼寝系"Suupeas"が出演","i":[1]}]}';
  assert.equal(parseJson(broken).events[0].name, 'お昼寝系"Suupeas"が出演');
  assert.equal(JSON.parse(repairQuotes('{"a":"x"y"}')).a, 'x"y');
});

test("AI reply wrapped in prose still parses", () => {
  assert.deepEqual(parseJson('Sure! Here it is:\n{"0":true}\nDone.'), { 0: true });
});

test("same event under different spellings matches; different events do not", () => {
  assert.ok(similar("gamescom asia x Thailand Game Show 2026", "gamescom asia x Thailand Game Show"));
  assert.ok(!similar("Comic Con Thailand", "Thailand Game Show"));
  assert.ok(similarLoose("มหกรรมหนังสือระดับชาติ ครั้งที่ 31", "มหกรรมหนังสือ สมาคมผู้จัดพิมพ์"));
});

test("dates: near, editions and format", () => {
  assert.equal(near(null, null), null); // two undated entries never auto-merge
  assert.ok(near("2026-10-29", "2026-10-30"));
  assert.ok(!near("2026-10-29", "2026-11-15"));
  assert.notEqual(years("Comic Con 2026"), years("Comic Con 2027"));
  assert.ok(isDate("2026-05-30") && !isDate("May 30") && !isDate(null));
});

test("Bing click-tracker links are unwrapped", () => {
  assert.equal(unwrap("http://www.bing.com/news/apiclick.aspx?ref=FexRss&url=https%3a%2f%2fexample.com%2fa&c=1"), "https://example.com/a");
  assert.equal(unwrap("https://example.com/b"), "https://example.com/b");
});

test("RSS tags are read with CDATA and entities", () => {
  assert.equal(tag("<item><title><![CDATA[A &amp; B]]></title></item>", "title"), "A & B");
});

test("article text includes stories written in <div>s (Anime News Network layout)", () => {
  const html = `<html><body><nav>menu</nav><div class="meat">Sozo announced on Thursday that its Anime Festival Asia
    convention will return to Thailand at the Queen Sirikit National Convention Center in Bangkok on May 30 and 31.</div>
    <footer>copyright</footer></body></html>`;
  const text = extractText(html);
  assert.match(text, /May 30 and 31/);
  assert.doesNotMatch(text, /menu|copyright/);
});

test("article text from <p> paragraphs (Sanook layout)", () => {
  const html = `<article><p>วิทยาลัย ANT มหาวิทยาลัยธุรกิจบัณฑิตย์ เปิดรับสมัครทีม RoV ตั้งแต่วันที่ 28 กันยายน ถึงวันที่ 4 ตุลาคม 2569</p></article>`;
  assert.match(extractText(html), /28 กันยายน/);
});

test("word filters: obvious non-events dropped, real events kept", () => {
  assert.ok(NOT_EVENT_WORDS.test("รวมโค้ด Anime Ball Duels: รับฟรี Coins"));
  assert.ok(!NOT_EVENT_WORDS.test("gamescom asia x Thailand Game Show 2026 เปิดขายบัตรแล้ว"));
  assert.ok(EVENT_WORDS.test("Tokyo Game Dungeon 14 開催決定"));
  assert.ok(PRTIMES_EVENT.test("『呪術廻戦』コラボカフェ 開催決定"));
  assert.ok(!PRTIMES_EVENT.test("2026年3月期 決算説明資料"));
});

test("roundup articles: distinct dates are counted in Thai, English and Japanese", () => {
  assert.ok(dateMentions("เปิด 1 ธันวาคม 2569 และงานวันที่ 9-10 มกราคม 2570").size >= 2);
  assert.equal(dateMentions("Opens Dec 1, runs Jan 9 and 10 at centralwOrld").size, 2);
  assert.equal(dateMentions("ฉลองครบรอบ 30 ปี งานเดียววันที่ 26 ตุลาคม").size, 1);
  assert.equal(dateMentions("12月3日と12月10日に開催").size, 2);
});

test("roundup AI answer is cleaned: unnamed items dropped, bad dates and tags removed", () => {
  const out = cleanSplit({ announcement: true, events: [
    { name: "Pokémon Center BANGKOK", start: "2026-12-01", end: "not a date", tags: ["shop", "game", "nope"] },
    { name: " ", start: "2026-12-02" },
    { start: "2027-01-09" },
  ] }, ["game", "shop", "festival"]);
  assert.equal(out.announcement, true);
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].start, "2026-12-01");
  assert.equal(out.events[0].end, null);
  assert.deepEqual(out.events[0].tags, ["shop", "game"]);
  assert.deepEqual(cleanSplit(null, []).events, []);
});

test("AI errors: provider rate limits are told apart from quota and billing", () => {
  assert.equal(errorKind('429: {"message":"The model provider is receiving too many requests right now","type":"api_error","code":"AI_PROVIDER_RATE_LIMITED"}'), "rate");
  assert.equal(errorKind('429: {"error":"daily quota exceeded for this key"}'), "quota");
  assert.equal(errorKind('402: {"error":"insufficient balance"}'), "quota");
  assert.equal(errorKind('{"message":"account unpaid, add credits"}'), "billing");
  assert.equal(errorKind("500: upstream_timeout"), "other");
});

test("event ids are stable for the same country, name and start", () => {
  assert.equal(eventId("TH", "Pokemon RUN 30", "2027-01-09"), eventId("TH", "pokemon run 30", "2027-01-09"));
  assert.notEqual(eventId("TH", "Pokemon RUN 30", "2027-01-09"), eventId("JP", "Pokemon RUN 30", "2027-01-09"));
});

test("models with a node prefix (rb/, cb/, mr/) route to AIUnlimit, the rest to Tenixe", () => {
  assert.equal(providerOf("rb/deepseek-v4.1-flash"), "aiu");
  assert.equal(providerOf("cb/deepseek-v4.1-flash"), "aiu");
  assert.equal(providerOf("mr/gemini-3.5-flash-lite"), "aiu");
  assert.equal(providerOf("nemotron-3-ultra"), "tenixe");
  assert.equal(providerOf("claude-haiku-5-5"), "tenixe");
  assert.equal(providerOf("deepseek-v4-flash"), "tenixe");
});

test("sliding rate limit: at most N starts per window", async () => {
  const { rateWaitMs, slidingLimiter } = await import("../pipeline/lib.mjs");
  // Starts at 0, 10, 20 with limit 3 and window 60s: the next start waits until the first one leaves the window.
  assert.equal(rateWaitMs([0, 10, 20], 20, 3, 60000), 60000 - 20);
  assert.equal(rateWaitMs([0, 10], 20, 3, 60000), 0);
  assert.equal(rateWaitMs([0, 10, 20], 60000, 3, 60000), 0); // the start at 0 has left the window
  // Fake clock: sleeping advances time instead of waiting.
  let t = 0;
  const starts = [];
  const acquire = slidingLimiter(2, 1000, { now: () => t, sleep: async ms => { t += ms; } });
  for (let i = 0; i < 5; i++) { await acquire(); starts.push(t); }
  assert.deepEqual(starts, [0, 0, 1000, 1000, 2000]);
});

test("prefilter keeps events in every language and drops press-release noise", () => {
  const keep = [
    { title: "Anime Expo 2026 lineup announced", country: "US" },
    { title: "Thailand Game Show 2026 เปิดตัวเกมใหม่", country: "TH" },
    { title: "Concert tickets on sale", country: "KR" },
    { title: "Acme appoints new CEO at Festival Expo", country: "US" }, // strong event noun overrides personnel
    { title: "ポケモンカード 世界大会 開催決定 12月5日 東京", country: "JP" },
    { title: "Ticket sales for Gamescom Asia", country: "CN", desc: "" },
    { title: "Eason演唱会 实名抽签购票攻略", country: "CN" }, // concert beats the guide word
  ];
  for (const r of keep) assert.equal(prefilterReason(r), "", r.title);
  const drop = [
    ["Sony announces Q2 earnings results", "US", "no_event"],
    ["Acme appoints new CEO after launch", "US", "personnel"],
    ["Phone X spec sheet revealed, launch next month", "US", "product"],
    ["ガチャ 攻略 開催", "JP", "noise"],
    ["Pokémon Card Game launch review", "US", "noise"],
    ["Survey results: 60% of users like the new launch", "US", "survey"],
  ];
  for (const [title, country, rule] of drop) assert.equal(prefilterReason({ title, country }), rule, title);
  assert.equal(prefilterReason({ title: "新商品 発表会 開催 12月5日", country: "JP" }, "PR TIMES"), "", "dated PR TIMES event");
  assert.equal(prefilterReason({ title: "新商品 発表会 開催", country: "JP" }, "PR TIMES"), "prtimes_no_date_venue", "undated PR TIMES event");
  assert.equal(prefilterReason({ title: "新商品 発表会 開催", country: "JP" }), "", "JP news without date keeps going");
  assert.equal(prefilterReason({ title: "社長就任のお知らせ", country: "JP" }, "PR TIMES"), "no_event");
});

test("TCG first, then anime/game/fan and concerts, other tags last", () => {
  assert.equal(tagPriority(["tcg", "anime"]), 3);
  assert.equal(tagPriority(["anime"]), 2);
  assert.equal(tagPriority(["concert"]), 2);
  assert.equal(tagPriority(["food"]), 0);
  assert.equal(tagPriority(undefined), 0);
});
