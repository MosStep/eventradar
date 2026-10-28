// Checks for the pipeline helpers that have broken before. Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseJson, repairQuotes, similar, similarLoose, near, years, isDate, unwrap, tag, extractText, dateMentions, cleanSplit, eventId } from "../pipeline/lib.mjs";
import { NOT_EVENT_WORDS, PRTIMES_EVENT, EVENT_WORDS } from "../pipeline/sources.mjs";

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

test("event ids are stable for the same country, name and start", () => {
  assert.equal(eventId("TH", "Pokemon RUN 30", "2027-01-09"), eventId("TH", "pokemon run 30", "2027-01-09"));
  assert.notEqual(eventId("TH", "Pokemon RUN 30", "2027-01-09"), eventId("JP", "Pokemon RUN 30", "2027-01-09"));
});
