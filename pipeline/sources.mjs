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
      tcg: ["การแข่งขันการ์ดเกม", "Pokemon TCG ทัวร์นาเมนต์ ไทย", "Yu-Gi-Oh แข่ง ประเทศไทย", "One Piece Card Game แข่ง", "Digimon Card Game Thailand",
        "งานการ์ดเกม ตลาดการ์ด", "Weiss Schwarz Thailand", "Union Arena Thailand", "Magic the Gathering Thailand", "Card Fight Vanguard Thailand"],
      boardgame: ["งานบอร์ดเกม"], stage: ["ละครเวที มิวสิคัล เปิดจองบัตร"], comedy: ["เดี่ยวไมโครโฟน สแตนด์อัพคอมเมดี้"],
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
      tcg: ["カードゲーム 大会 開催", "ポケモンカード 大会", "遊戯王 大会 開催", "ワンピースカードゲーム 大会", "デュエル・マスターズ 大会",
        "ヴァイスシュヴァルツ 大会", "ユニオンアリーナ 大会", "TCG イベント 開催決定", "カードショップ 大会"],
      boardgame: ["ゲームマーケット ボードゲーム"], stage: ["舞台 ミュージカル 上演決定"], comedy: ["お笑いライブ 開催"],
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
      tcg: ["卡牌 比赛", "宝可梦卡牌 比赛", "游戏王 比赛", "集换式卡牌 展会", "航海王卡牌 比赛"],
      boardgame: ["桌游展"], stage: ["音乐剧 演出 开票"], comedy: ["脱口秀 演出"],
      museum: ["博物馆 特展 开幕"], design: ["设计周 举办"], photo: ["摄影展 开幕"], workshop: ["手作 市集 工作坊"],
      cafe: ["咖啡节 举办"], drink: ["啤酒节 举办"], nightmarket: ["夜市 开市"],
      flea: ["创意市集 举办"], sale: ["购物节 活动"], fashion: ["时装周 举办"],
      national: ["灯会 春节 活动"], lights: ["灯光秀 烟花 举办"], nature: ["赏花节 开幕"],
      run: ["马拉松 报名"], match: ["比赛 门票 开售"], wellness: ["瑜伽 节"], outdoor: ["露营节 户外"],
      kids: ["亲子 活动 举办"], themepark: ["主题乐园 活动"],
      home: ["家博会 举办"], wedding: ["婚博会 举办"],
    },
  },
  VN: {
    name: "เวียดนาม",
    rss: "hl=vi&gl=VN&ceid=VN:vi",
    queries: {
      anime: ["lễ hội anime", "sự kiện anime cosplay"], game: ["sự kiện game", "Vietnam Game Show"], esports: ["giải đấu esports chung kết"],
      cosplay: ["sự kiện cosplay"], comic: ["hội chợ truyện tranh", "Comic Con Việt Nam"], figure: ["triển lãm mô hình figure"], vtuber: ["VTuber Việt Nam sự kiện"],
      tcg: ["giải đấu thẻ bài Pokemon", "giải đấu Yu-Gi-Oh", "One Piece Card Game Việt Nam"], boardgame: ["sự kiện boardgame"],
      concert: ["concert Hà Nội", "concert TP.HCM"], festival: ["lễ hội âm nhạc"], fanmeet: ["fan meeting Việt Nam"], idol: ["idol K-pop concert Việt Nam"],
      stage: ["nhạc kịch biểu diễn"], comedy: ["hài độc thoại stand-up"], movie: ["ra mắt phim họp báo"],
      art: ["triển lãm nghệ thuật"], museum: ["bảo tàng triển lãm đặc biệt"], design: ["tuần lễ thiết kế"], photo: ["triển lãm ảnh"], workshop: ["workshop sự kiện cuối tuần"],
      food: ["lễ hội ẩm thực"], cafe: ["lễ hội cà phê"], drink: ["lễ hội bia"], nightmarket: ["chợ đêm khai trương"],
      market: ["pop-up store khai trương"], flea: ["hội chợ handmade"], sale: ["hội chợ khuyến mãi"], fashion: ["tuần lễ thời trang"],
      local: ["lễ hội truyền thống"], national: ["lễ hội Tết sự kiện"], lights: ["lễ hội ánh sáng pháo hoa"], nature: ["lễ hội hoa tam giác mạch", "lễ hội hoa"],
      run: ["giải chạy marathon đăng ký"], match: ["trận đấu vé bán"], wellness: ["lễ hội yoga"], outdoor: ["lễ hội cắm trại"],
      kids: ["sự kiện thiếu nhi gia đình"], pet: ["sự kiện thú cưng"], themepark: ["công viên giải trí sự kiện"],
      ai: ["hội thảo AI trí tuệ nhân tạo"], gadget: ["ra mắt điện thoại sự kiện"], startup: ["sự kiện khởi nghiệp"], devconf: ["hội nghị lập trình viên"],
      carlaunch: ["ra mắt xe mới"], motorshow: ["Vietnam Motor Show triển lãm ô tô"], ev: ["triển lãm xe điện"], bike: ["triển lãm xe máy"],
      expo: ["hội chợ triển lãm SECC", "triển lãm quốc tế Hà Nội"], home: ["triển lãm nội thất"], travel: ["hội chợ du lịch"], book: ["hội sách"], edu: ["triển lãm giáo dục du học"], wedding: ["triển lãm cưới"],
    },
  },
  KR: {
    name: "เกาหลีใต้",
    rss: "hl=ko&gl=KR&ceid=KR:ko",
    queries: {
      anime: ["애니메이션 페스티벌 개최", "애니 이벤트 개최"], game: ["게임쇼 개최", "지스타"], esports: ["e스포츠 결승 개최"],
      cosplay: ["코스프레 행사"], comic: ["코믹월드", "서울코믹월드"], figure: ["피규어 전시 개최"], vtuber: ["버튜버 오프라인 이벤트"],
      tcg: ["포켓몬 카드 대회", "유희왕 대회", "원피스 카드게임 대회", "TCG 대회 개최"], boardgame: ["보드게임 페스타"],
      concert: ["콘서트 개최 티켓 오픈"], festival: ["음악 페스티벌 개최"], fanmeet: ["팬미팅 개최"], idol: ["아이돌 콘서트 개최"],
      stage: ["뮤지컬 개막"], comedy: ["코미디 공연"], movie: ["영화 시사회 개최"],
      art: ["전시회 개막"], museum: ["박물관 특별전"], design: ["디자인위크 개최"], photo: ["사진전 개막"], workshop: ["원데이 클래스 행사"],
      food: ["음식 축제 개최"], cafe: ["카페쇼 개최"], drink: ["맥주 축제 개최"], nightmarket: ["야시장 개장"],
      market: ["팝업스토어 오픈"], flea: ["플리마켓 개최"], sale: ["코리아세일페스타"], fashion: ["서울패션위크"],
      local: ["지역 축제 개최"], national: ["전통 축제 개최"], lights: ["불꽃축제", "빛 축제 개최"], nature: ["꽃 축제 개최", "단풍 축제"],
      run: ["마라톤 대회 참가 신청"], match: ["경기 티켓 예매"], wellness: ["요가 페스티벌"], outdoor: ["캠핑 페스티벌"],
      kids: ["어린이 체험 행사"], pet: ["펫쇼 개최", "반려동물 박람회"], themepark: ["테마파크 축제"],
      ai: ["AI 박람회 개최", "인공지능 컨퍼런스"], gadget: ["신제품 체험 행사"], startup: ["스타트업 행사 개최"], devconf: ["개발자 컨퍼런스 개최"],
      carlaunch: ["신차 출시 행사"], motorshow: ["모빌리티쇼 개최"], ev: ["전기차 박람회"], bike: ["모터사이클 쇼"],
      expo: ["코엑스 박람회 개최", "킨텍스 박람회 개최"], home: ["리빙 박람회 개최"], travel: ["여행 박람회 개최"], book: ["도서전 개최"], edu: ["유학 박람회"], wedding: ["웨딩 박람회"],
    },
  },
  ID: {
    name: "อินโดนีเซีย",
    rss: "hl=id&gl=ID&ceid=ID:id",
    queries: {
      anime: ["festival anime Jakarta", "event jejepangan"], game: ["pameran game Indonesia", "Indonesia Game Show"], esports: ["final turnamen esports"],
      cosplay: ["event cosplay"], comic: ["Indonesia Comic Con", "pameran komik"], figure: ["pameran action figure"], vtuber: ["VTuber Indonesia offline event"],
      tcg: ["turnamen Pokemon TCG Indonesia", "turnamen Yu-Gi-Oh Indonesia", "One Piece Card Game Indonesia turnamen"], boardgame: ["festival board game"],
      concert: ["konser Jakarta tiket", "konser digelar"], festival: ["festival musik digelar"], fanmeet: ["fan meeting Jakarta"], idol: ["konser idol Jakarta"],
      stage: ["pertunjukan musikal"], comedy: ["stand up comedy pertunjukan"], movie: ["gala premiere film"],
      art: ["pameran seni dibuka"], museum: ["museum pameran khusus"], design: ["pekan desain"], photo: ["pameran foto"], workshop: ["workshop akhir pekan event"],
      food: ["festival kuliner digelar"], cafe: ["festival kopi"], drink: ["festival minuman"], nightmarket: ["pasar malam dibuka"],
      market: ["pop up store dibuka"], flea: ["bazar UMKM digelar"], sale: ["pesta diskon"], fashion: ["Jakarta Fashion Week"],
      local: ["festival budaya daerah"], national: ["perayaan festival tradisional"], lights: ["festival lampion kembang api"], nature: ["festival bunga"],
      run: ["lomba lari marathon pendaftaran"], match: ["pertandingan tiket dijual"], wellness: ["festival yoga"], outdoor: ["festival camping"],
      kids: ["acara keluarga anak"], pet: ["pameran hewan peliharaan"], themepark: ["taman hiburan acara"],
      ai: ["konferensi AI kecerdasan buatan"], gadget: ["peluncuran smartphone acara"], startup: ["acara startup digelar"], devconf: ["konferensi developer"],
      carlaunch: ["peluncuran mobil baru"], motorshow: ["GIIAS pameran otomotif", "IIMS pameran"], ev: ["pameran kendaraan listrik"], bike: ["pameran motor"],
      expo: ["pameran JIExpo", "pameran ICE BSD"], home: ["pameran rumah interior"], travel: ["pameran pariwisata"], book: ["pameran buku"], edu: ["pameran pendidikan"], wedding: ["pameran pernikahan"],
    },
  },
  US: {
    name: "สหรัฐอเมริกา",
    rss: "hl=en-US&gl=US&ceid=US:en",
    queries: {
      anime: ["Anime Expo tickets announced"], game: ["video game expo opens"], tcg: ["Pokemon TCG regional tournament"], concert: ["concert tickets announced"], festival: ["music festival lineup announced"],
      fanmeet: ["K-pop fan meeting tickets"], art: ["art exhibition opens"], food: ["food festival this weekend"], local: ["cultural festival announced"], motorshow: ["auto show opens"],
      ai: ["AI conference announced"], expo: ["Javits Center expo"], run: ["marathon registration opens"], kids: ["family festival kids event"], market: ["pop-up market opens"],
    },
  },
  CA: {
    name: "แคนาดา",
    rss: "hl=en-CA&gl=CA&ceid=CA:en",
    queries: {
      anime: ["Fan Expo Canada tickets"], game: ["jeux vidéo expo Toronto"], tcg: ["tournoi Pokemon TCG régional"], concert: ["billets concert annoncés"], festival: ["festival de musique annoncé"],
      fanmeet: ["K-pop fan meeting Toronto"], art: ["exposition d'art ouvre"], food: ["festival gastronomique Montréal"], local: ["festival culturel annoncé"], motorshow: ["salon de l'auto Montréal"],
      ai: ["conférence IA Toronto"], expo: ["Metro Toronto Convention Centre expo"], run: ["marathon inscriptions ouvertes"], kids: ["festival familial enfants"], market: ["marché pop-up ouvre"],
    },
  },
  GB: {
    name: "สหราชอาณาจักร",
    rss: "hl=en-GB&gl=GB&ceid=GB:en",
    queries: {
      anime: ["MCM Comic Con London tickets"], game: ["games expo UK announced"], tcg: ["Pokemon TCG regional championship UK"], concert: ["concert tickets announced UK"], festival: ["festival lineup announced"],
      fanmeet: ["K-pop fan meeting London"], art: ["exhibition opens London"], food: ["food festival London weekend"], local: ["traditional festival announced"], motorshow: ["motor show London"],
      ai: ["AI conference London"], expo: ["ExCeL London expo"], run: ["marathon registration opens"], kids: ["family festival kids event"], market: ["pop-up market opens"],
    },
  },
  FR: {
    name: "ฝรั่งเศส",
    rss: "hl=fr&gl=FR&ceid=FR:fr",
    queries: {
      anime: ["Japan Expo billets annoncés"], game: ["salon jeux vidéo ouvre"], tcg: ["tournoi Pokémon TCG régional"], concert: ["billets concert annoncés"], festival: ["festival de musique programmation annoncée"],
      fanmeet: ["fan meeting K-pop Paris"], art: ["exposition d'art ouvre"], food: ["festival gastronomique annoncé"], local: ["fête traditionnelle annoncée"], motorshow: ["salon de l'auto Paris"],
      ai: ["conférence intelligence artificielle"], expo: ["Paris Expo Porte de Versailles salon"], run: ["marathon inscriptions ouvertes"], kids: ["festival enfants famille"], market: ["marché pop-up ouvre"],
    },
  },
  DE: {
    name: "เยอรมนี",
    rss: "hl=de&gl=DE&ceid=DE:de",
    queries: {
      anime: ["Anime Messe Tickets angekündigt"], game: ["Gamescom Messe eröffnet"], tcg: ["Pokémon TCG Turnier Regional"], concert: ["Konzertkarten angekündigt"], festival: ["Musikfestival Programm angekündigt"],
      fanmeet: ["K-Pop Fan-Meeting Tickets"], art: ["Kunstausstellung eröffnet"], food: ["Food-Festival Wochenende"], local: ["traditionelles Volksfest angekündigt"], motorshow: ["Automesse eröffnet"],
      ai: ["KI-Konferenz angekündigt"], expo: ["Messe München Ausstellung"], run: ["Marathon Anmeldung startet"], kids: ["Familienfest Kinderfest"], market: ["Pop-up Markt eröffnet"],
    },
  },
  IT: {
    name: "อิตาลี",
    rss: "hl=it&gl=IT&ceid=IT:it",
    queries: {
      anime: ["Lucca Comics & Games biglietti"], game: ["fiera videogiochi annunciata"], tcg: ["torneo Pokémon TCG regionale"], concert: ["concerto biglietti annunciati"], festival: ["festival musicale annunciato"],
      fanmeet: ["fan meeting K-pop biglietti"], art: ["mostra d'arte inaugura"], food: ["festival del cibo sagra"], local: ["festa tradizionale annunciata"], motorshow: ["Salone dell'auto apre"],
      ai: ["conferenza intelligenza artificiale"], expo: ["Fiera Milano expo"], run: ["maratona iscrizioni aperte"], kids: ["festival per bambini famiglia"], market: ["mercatino pop-up apre"],
    },
  },
  ES: {
    name: "สเปน",
    rss: "hl=es&gl=ES&ceid=ES:es",
    queries: {
      anime: ["Expomanga entradas anunciadas"], game: ["feria de videojuegos anuncia"], tcg: ["torneo Pokémon TCG regional"], concert: ["entradas concierto anunciadas"], festival: ["festival de música cartel anunciado"],
      fanmeet: ["fan meeting K-pop entradas"], art: ["exposición de arte inaugura"], food: ["festival gastronómico fin de semana"], local: ["fiesta tradicional anunciada"], motorshow: ["salón del automóvil Madrid"],
      ai: ["congreso inteligencia artificial"], expo: ["Ifema Madrid feria"], run: ["maratón inscripciones abiertas"], kids: ["festival familiar para niños"], market: ["mercadillo pop-up abre"],
    },
  },
  AU: {
    name: "ออสเตรเลีย",
    rss: "hl=en-AU&gl=AU&ceid=AU:en",
    queries: {
      anime: ["Supanova tickets announced"], game: ["games expo Australia announced"], tcg: ["Pokemon TCG regional championship Australia"], concert: ["concert tickets announced Sydney"], festival: ["music festival lineup announced"],
      fanmeet: ["K-pop fan meeting Sydney"], art: ["art exhibition opens Melbourne"], food: ["food festival this weekend"], local: ["cultural festival announced"], motorshow: ["motor show Sydney"],
      ai: ["AI conference Sydney"], expo: ["ICC Sydney expo"], run: ["marathon registration opens"], kids: ["family festival kids event"], market: ["pop-up market opens"],
    },
  },
  SG: {
    name: "สิงคโปร์",
    rss: "hl=en-SG&gl=SG&ceid=SG:en",
    queries: {
      anime: ["anime convention Singapore tickets"], game: ["gaming expo Singapore announced"], tcg: ["Pokemon TCG tournament Singapore"], concert: ["concert tickets announced Singapore"], festival: ["music festival Singapore lineup"],
      fanmeet: ["K-pop fan meeting Singapore"], art: ["art exhibition opens Singapore"], food: ["food festival Singapore"], local: ["cultural festival Singapore announced"], motorshow: ["motor show Singapore"],
      ai: ["tech conference Singapore announced"], expo: ["Marina Bay Sands expo"], run: ["marathon registration Singapore"], kids: ["family festival Singapore kids"], market: ["pop-up market Singapore opens"],
    },
  },
  TW: {
    name: "ไต้หวัน",
    rss: "hl=zh-TW&gl=TW&ceid=TW:zh-Hant",
    queries: {
      anime: ["動漫祭 門票 開賣"], game: ["台北遊戲展 開展"], tcg: ["寶可夢 卡牌 錦標賽 區域賽"], concert: ["演唱會 門票 開賣"], festival: ["音樂節 陣容 公布"],
      fanmeet: ["韓團 粉絲見面會 售票"], art: ["藝術展 開幕"], food: ["美食節 登場"], local: ["傳統 文化祭 活動 公布"], motorshow: ["車展 開幕"],
      ai: ["AI 科技論壇 大會 宣布"], expo: ["台北世貿 展覽 博覽會"], run: ["馬拉松 報名 開跑"], kids: ["親子 節 活動 開跑"], market: ["快閃市集 開幕"],
    },
  },
  MY: {
    name: "มาเลเซีย",
    rss: "hl=en-MY&gl=MY&ceid=MY:en",
    queries: {
      anime: ["Pesta Anime tiket dilancarkan"], game: ["pameran permainan video dilancarkan"], tcg: ["kejohanan Pokemon TCG"], concert: ["konsert tiket dilancarkan"], festival: ["festival muzik lineup diumumkan"],
      fanmeet: ["fan meeting K-pop tiket"], art: ["pameran seni dibuka"], food: ["festival makanan minggu ini"], local: ["festival budaya diumumkan"], motorshow: ["pameran kereta Kuala Lumpur"],
      ai: ["persidangan AI diumumkan"], expo: ["MITEC Kuala Lumpur expo"], run: ["marathon pendaftaran dibuka"], kids: ["festival keluarga kanak-kanak"], market: ["pasar pop-up dibuka"],
    },
  },
  PH: {
    name: "ฟิลิปปินส์",
    rss: "hl=en-PH&gl=PH&ceid=PH:en",
    queries: {
      anime: ["anime convention Manila tickets"], game: ["gaming expo Manila announced"], tcg: ["Pokemon TCG tournament Manila"], concert: ["concert tickets announced Manila"], festival: ["music festival lineup Manila"],
      fanmeet: ["K-pop fan meeting Manila"], art: ["art exhibit opens Manila"], food: ["food festival Manila"], local: ["cultural festival Philippines announced"], motorshow: ["auto show Manila"],
      ai: ["tech conference Manila"], expo: ["SMX Convention Center Manila expo"], run: ["marathon registration Manila"], kids: ["family festival kids Manila"], market: ["pop-up market Manila opens"],
    },
  },
};

// Bing gives direct article links, a short description and a thumbnail; it has no results for mainland China,
// so CN uses Google News only. Google rate-limits bursts, so keep its query count low.
const BING = { TH: "cc=TH&setlang=th", JP: "cc=JP&setlang=ja", VN: "cc=VN&setlang=vi", KR: "cc=KR&setlang=ko", ID: "cc=ID&setlang=id", US: "cc=US&setlang=en", CA: "cc=CA&setlang=en", GB: "cc=GB&setlang=en", FR: "cc=FR&setlang=fr", DE: "cc=DE&setlang=de", IT: "cc=IT&setlang=it", ES: "cc=ES&setlang=es", AU: "cc=AU&setlang=en", SG: "cc=SG&setlang=en", TW: "cc=TW&setlang=zh-hant", MY: "cc=MY&setlang=en", PH: "cc=PH&setlang=en" };

export function feeds(country, query, window = "7d") {
  const list = [`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&${COUNTRIES[country].rss}`];
  if (BING[country]) list.unshift(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&${BING[country]}`);
  return list;
}

// Headlines without any of these words are rarely events; skipping them saves AI credits.
export const EVENT_WORDS = /lễ hội|sự kiện|triển lãm|hội chợ|giải đấu|ra mắt|concert|축제|개최|행사|박람회|콘서트|전시|팬미팅|대회|팝업|festival|pameran|konser|digelar|acara|turnamen|peluncuran|bazar|งาน|จัด|เทศกาล|แฟนมีต|คอนเสิร์ต|โชว์|มหกรรม|นิทรรศการ|เปิดตัว|สัมมนา|แข่งขัน|fest|expo|show|con\b|conference|convention|summit|live|launch|開催|イベント|フェス|展|ライブ|即売会|ファンミ|発表会|大会|举办|举行|漫展|节|见面会|演唱会|开幕|启幕|发布会|大会|博览会/i;

// Headlines with these are almost never public events even when an event word appears (checked before the AI).
// Kept narrow on purpose: a missed event costs more than a few wasted tokens.
export const NOT_EVENT_WORDS = /รีวิว|รวมโค้ด|โค้ดฟรี|แจกโค้ด|ผลการแข่งขัน|ผลบอล|ราคาทอง|หุ้น|ดูดวง|ทำนาย|รับสมัครงาน|攻略|ガチャ|ギフトコード|決算|株価|人事|求人|おみくじ|股价|财报|招聘|攻略|兑换码|review|walkthrough|stock price|earnings|patch notes/i;
// PR TIMES carries every kind of press release; keep only ones that read like an event.
export const PRTIMES_EVENT = /開催|イベント|フェス|展示会|展覧会|ライブ|ポップアップ|コラボカフェ|体験会|上映会|即売会|ファンミ|マルシェ|祭/;

// Words searched across the whole web every run (not only news): card games first. Users' followed words are added
// to data/watch.json (see TODO.md) and searched the same way. Facebook pages of shops and organisers are included.
export const WATCH_DEFAULT = [
  { q: "Pokemon TCG", country: "TH" }, { q: "โปเกมอนการ์ด แข่ง", country: "TH" }, { q: "Yu-Gi-Oh tournament Thailand", country: "TH" },
  { q: "One Piece Card Game Thailand", country: "TH" }, { q: "Digimon Card Game Thailand", country: "TH" },
  { q: "Duel Masters Thailand", country: "TH" }, { q: "Weiss Schwarz Thailand", country: "TH" }, { q: "Union Arena Thailand", country: "TH" },
  { q: "Magic: The Gathering Bangkok", country: "TH" }, { q: "Battle Spirits Saga Thailand", country: "TH" }, { q: "Vanguard Thailand", country: "TH" },
  { q: "Lorcana Thailand", country: "TH" }, { q: "Gundam Card Game Thailand", country: "TH" }, { q: "งานตลาดการ์ด", country: "TH" },
  { q: "ポケモンカード 大会 申込", country: "JP" }, { q: "遊戯王 大会 開催", country: "JP" }, { q: "ワンピースカード 大会", country: "JP" },
  { q: "宝可梦卡牌 比赛", country: "CN" },
];

// Organisers' own event/news pages, read every fetching run. Add a page here to follow a game or organiser directly.
// follow: links on the page to open as well (newest first, only ones not read before).
export const OFFICIAL_PAGES = [
  { url: "https://asia.pokemon-card.com/th/", name: "Pokémon TCG Thailand", country: "TH", tags: ["tcg"],
    follow: /https:\/\/asia\.pokemon-card\.com\/th\/archives\/\d+\//g },
  { url: "https://asia.pokemon-card.com/th/event/", name: "Pokémon TCG Thailand events", country: "TH", tags: ["tcg"] },
  { url: "https://asia-en.onepiece-cardgame.com/events/", name: "ONE PIECE Card Game Asia", country: "TH", tags: ["tcg", "anime"] },
  { url: "https://world.digimoncard.com/event/", name: "Digimon Card Game", country: "TH", tags: ["tcg", "anime"] },
];
