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
      local: ["งานวัด งานประจำปี", "งานประจำปี จังหวัด"], food: ["เทศกาลอาหาร"], art: ["นิทรรศการศิลปะ กรุงเทพ"], market: ["งานป๊อปอัพ ตลาดนัด จัดงาน"], travel: ["งานไทยเที่ยวไทย"], pet: ["งานสัตว์เลี้ยง Pet Expo"],
      expo: ["อิมแพ็ค เมืองทองธานี งาน", "ไบเทค บางนา งาน", "ศูนย์ประชุมแห่งชาติสิริกิติ์ งาน"], edu: ["งานแนะแนวการศึกษา", "Job Fair มหกรรมหางาน"], book: ["งานมหกรรมหนังสือ"],
      boardgame: ["งานบอร์ดเกม การ์ดเกม แข่งขัน"], stage: ["ละครเวที มิวสิคัล เปิดจองบัตร"], comedy: ["เดี่ยวไมโครโฟน สแตนด์อัพคอมเมดี้"],
      museum: ["พิพิธภัณฑ์ นิทรรศการพิเศษ"], design: ["Bangkok Design Week"], photo: ["นิทรรศการภาพถ่าย"], workshop: ["เวิร์กช็อป งานคราฟต์ จัดกิจกรรม"],
      cafe: ["เทศกาลกาแฟ Coffee Fest"], drink: ["เทศกาลคราฟต์เบียร์ ไวน์"], nightmarket: ["ตลาดกลางคืน เปิดใหม่ สตรีทฟู้ด"],
      flea: ["ตลาดนัดแฮนด์เมด อาร์ตมาร์เก็ต"], sale: ["มหกรรมลดราคา เซลล์"], fashion: ["แฟชั่นวีค บิวตี้ เอ็กซ์โป"],
      national: ["เทศกาลลอยกระทง สงกรานต์ จัดงาน"], lights: ["งานแสดงไฟ เทศกาลไฟ พลุ"], nature: ["เทศกาลดอกไม้ บานสะพรั่ง"],
      run: ["งานวิ่ง มาราธอน เปิดรับสมัคร"], match: ["การแข่งขัน ฟุตบอล ชิงแชมป์ สนาม"], wellness: ["โยคะ เวลเนส เฟสติวัล"], outdoor: ["งานแคมป์ปิ้ง เอาต์ดอร์"],
      kids: ["งานวันเด็ก กิจกรรมครอบครัว"], themepark: ["สวนสนุก สวนสัตว์ กิจกรรมพิเศษ"],
      home: ["งานบ้านและสวน บ้านแฟร์"], wedding: ["งานแต่งงาน Wedding Fair"],
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
      local: ["祭り 開催 地域"], food: ["グルメフェス 開催"], art: ["展覧会 開催 美術館"], market: ["ポップアップストア 開催"], travel: ["ツーリズムEXPO"], pet: ["ペット 博 開催"],
      expo: ["幕張メッセ イベント", "東京ビッグサイト イベント"], edu: ["進学 フェア"], book: ["ブックフェア 開催"],
      boardgame: ["ゲームマーケット ボードゲーム", "TCG 大会 開催"], stage: ["舞台 ミュージカル 上演決定"], comedy: ["お笑いライブ 開催"],
      museum: ["博物館 特別展 開催"], design: ["デザインウィーク 開催"], photo: ["写真展 開催"], workshop: ["ワークショップ 体験 イベント 開催"],
      cafe: ["コラボカフェ 開催", "スイーツフェス 開催"], drink: ["ビアフェス 日本酒 イベント 開催"], nightmarket: ["屋台 ナイトマーケット 開催"],
      flea: ["フリーマーケット ハンドメイド イベント"], sale: ["セール 大バーゲン 開催"], fashion: ["ファッションウィーク コスメ イベント"],
      national: ["花火大会 開催決定"], lights: ["イルミネーション 点灯 開催"], nature: ["紅葉 ライトアップ 開催", "桜まつり 開催"],
      run: ["マラソン 大会 エントリー"], match: ["試合 開催 スタジアム"], wellness: ["ヨガ フェス 開催"], outdoor: ["アウトドア フェス キャンプ"],
      kids: ["親子 イベント 開催"], themepark: ["遊園地 動物園 イベント 開催"],
      home: ["住宅展示 フェア"], wedding: ["ブライダルフェア"],
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
      local: ["庙会 举办"], food: ["美食节 举办"], art: ["艺术展 开幕"], market: ["市集 活动 举办"], travel: ["旅游博览会"], pet: ["宠物展"],
      expo: ["Bilibili World", "国家会展中心 展会"], edu: ["教育展", "招聘会 举办"], book: ["书展 举办"],
      boardgame: ["桌游展", "卡牌 比赛"], stage: ["音乐剧 演出 开票"], comedy: ["脱口秀 演出"],
      museum: ["博物馆 特展 开幕"], design: ["设计周 举办"], photo: ["摄影展 开幕"], workshop: ["手作 市集 工作坊"],
      cafe: ["咖啡节 举办"], drink: ["啤酒节 举办"], nightmarket: ["夜市 开市"],
      flea: ["创意市集 举办"], sale: ["购物节 活动"], fashion: ["时装周 举办"],
      national: ["灯会 春节 活动"], lights: ["灯光秀 烟花 举办"], nature: ["赏花节 开幕"],
      run: ["马拉松 报名"], match: ["比赛 门票 开售"], wellness: ["瑜伽 节"], outdoor: ["露营节 户外"],
      kids: ["亲子 活动 举办"], themepark: ["主题乐园 活动"],
      home: ["家博会 举办"], wedding: ["婚博会 举办"],
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
