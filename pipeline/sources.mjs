// What to search each day: news queries per country × tag. Tags and groups live in web/taxonomy.json.
// Add a topic: add the tag to taxonomy.json, then a query for it in each country below.
import fs from "node:fs";
import path from "node:path";

export const TAXONOMY = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "web", "taxonomy.json"), "utf8"));
export const TAGS = Object.fromEntries(Object.values(TAXONOMY).flatMap(g => Object.entries(g.tags)));

export const COUNTRIES = {
  TH: {
    name: "ไทย",
    rss: "hl=th&gl=TH&ceid=TH:th",
    queries: {
      anime: ["งานอนิเมะ", "anime festival bangkok"], game: ["งานเกม อีเวนต์", "Thailand Game Show"], esports: ["การแข่งขันอีสปอร์ต รอบชิงชนะเลิศ"],
      cosplay: ["งานคอสเพลย์"], comic: ["Comic Con Thailand", "งานการ์ตูน จัดงาน"], figure: ["งานฟิกเกอร์", "art toy งาน"],
      vtuber: ["VTuber งาน กรุงเทพ"],
      fanmeet: ["แฟนมีต", "fan meeting bangkok"], idol: ["คอนเสิร์ต ไอดอล ญี่ปุ่น กรุงเทพ"], concert: ["คอนเสิร์ต กรุงเทพ ประกาศ"],
      festival: ["มิวสิกเฟสติวัล"], movie: ["รอบปฐมทัศน์ ภาพยนตร์ กาล่า"],
      ai: ["งานสัมมนา AI", "AI conference bangkok"], gadget: ["งานเปิดตัว สมาร์ทโฟน", "Thailand Mobile Expo"], startup: ["งานสตาร์ทอัพ"],
      devconf: ["งานสัมมนา นักพัฒนา developer conference bangkok"],
      carlaunch: ["งานเปิดตัวรถยนต์ใหม่"], motorshow: ["Motor Show มอเตอร์โชว์", "Motor Expo"], ev: ["งาน EV รถยนต์ไฟฟ้า"], bike: ["งานมอเตอร์ไซค์ บิ๊กไบค์"],
      food: ["เทศกาลอาหาร"], art: ["นิทรรศการศิลปะ กรุงเทพ"], market: ["งานป๊อปอัพ ตลาดนัด จัดงาน"], travel: ["งานไทยเที่ยวไทย"], pet: ["งานสัตว์เลี้ยง Pet Expo"],
      expo: ["อิมแพ็ค เมืองทองธานี งาน", "ไบเทค บางนา งาน", "ศูนย์ประชุมแห่งชาติสิริกิติ์ งาน"], edu: ["งานแนะแนวการศึกษา"], book: ["งานมหกรรมหนังสือ"],
    },
  },
  JP: {
    name: "ญี่ปุ่น",
    rss: "hl=ja&gl=JP&ceid=JP:ja",
    queries: {
      anime: ["アニメ イベント 開催決定", "AnimeJapan"], game: ["ゲーム イベント 開催", "東京ゲームショウ"], esports: ["eスポーツ 大会 決勝 会場"],
      cosplay: ["コスプレイベント 開催"], comic: ["同人誌即売会", "コミックマーケット"], figure: ["フィギュア イベント 開催", "ワンダーフェスティバル"],
      vtuber: ["VTuber リアルイベント 開催"],
      fanmeet: ["ファンミーティング 開催決定"], idol: ["アイドル ライブ 開催決定"], concert: ["ライブ 公演 開催決定 アリーナ"],
      festival: ["音楽フェス 開催"], movie: ["映画 舞台挨拶 プレミア"],
      ai: ["AI EXPO", "生成AI イベント 開催"], gadget: ["ガジェット 展示会"], startup: ["スタートアップ イベント 開催"], devconf: ["開発者 カンファレンス 開催"],
      carlaunch: ["新型車 発表会"], motorshow: ["ジャパンモビリティショー", "オートサロン"], ev: ["EV 展示会"], bike: ["モーターサイクルショー"],
      food: ["グルメフェス 開催"], art: ["展覧会 開催 美術館"], market: ["ポップアップストア 開催"], travel: ["ツーリズムEXPO"], pet: ["ペット 博 開催"],
      expo: ["幕張メッセ イベント", "東京ビッグサイト イベント"], edu: ["進学 フェア"], book: ["ブックフェア 開催"],
    },
  },
  CN: {
    name: "จีน",
    rss: "hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    queries: {
      anime: ["动漫展 举办", "漫展 时间"], game: ["游戏展 举办", "ChinaJoy"], esports: ["电竞 总决赛 举办"],
      cosplay: ["cosplay 漫展"], comic: ["同人展", "CP 同人展"], figure: ["手办展"], vtuber: ["虚拟主播 线下活动"],
      fanmeet: ["粉丝见面会"], idol: ["偶像 演唱会"], concert: ["演唱会 开票"], festival: ["音乐节 举办"], movie: ["电影 首映礼"],
      ai: ["人工智能大会 举办"], gadget: ["新品发布会 手机"], startup: ["创业大赛 活动"], devconf: ["开发者大会"],
      carlaunch: ["新车 上市发布会"], motorshow: ["车展 举办"], ev: ["新能源汽车 展会"], bike: ["摩托车展"],
      food: ["美食节 举办"], art: ["艺术展 开幕"], market: ["市集 活动 举办"], travel: ["旅游博览会"], pet: ["宠物展"],
      expo: ["Bilibili World", "国家会展中心 展会"], edu: ["教育展"], book: ["书展 举办"],
    },
  },
};

// Bing gives direct article links, a short description and a thumbnail; it has no results for mainland China,
// so CN uses Google News only. Google rate-limits bursts, so keep its query count low.
const BING = { TH: "cc=TH&setlang=th", JP: "cc=JP&setlang=ja" };

export function feeds(country, query, window = "7d") {
  const list = [`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&${COUNTRIES[country].rss}`];
  if (BING[country]) list.unshift(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&${BING[country]}`);
  return list;
}

// Headlines without any of these words are rarely events; skipping them saves AI credits.
export const EVENT_WORDS = /งาน|จัด|เทศกาล|แฟนมีต|คอนเสิร์ต|โชว์|มหกรรม|นิทรรศการ|เปิดตัว|สัมมนา|แข่งขัน|fest|expo|show|con\b|conference|convention|summit|live|launch|開催|イベント|フェス|展|ライブ|即売会|ファンミ|発表会|大会|举办|举行|漫展|节|见面会|演唱会|开幕|启幕|发布会|大会|博览会/i;
