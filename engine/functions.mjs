// ============================================================
// CosmoPolis 量化积木城市 · 第二层【功能】
// 依据:engine/SCHEMA.md v1 §0.2 / §0.3 / §0.4 / §0.6 / §2
// 6 族 × 8 = 恰好 48 个功能,族名与功能中文名【逐字照抄工作指引】。
// 每个功能自带:一套【布置程序 program】+ 一份【五区程序 zones】。
// 无任何 import,纯数据。
// ============================================================

// ── 功能族(恰好 6 个,id 照 SCHEMA §0.3)────────────────────
// 注:族 id `cook`(食)与套件大类 id `cook`(厨作)同名,是指引原样,两个命名空间不冲突。
export const FN_FAMILIES = [
  { id:'dwell',   cn:'住', desc:'一家人起居、睡觉、待客、更衣的那些格子' },
  { id:'make',    cn:'作', desc:'读写、创作、动手、跑机器的生产性格子' },
  { id:'cook',    cn:'食', desc:'做、卖、喝、吃,从自家灶台到街角窗口' },
  { id:'shop',    cn:'市', desc:'临街对外做买卖与迎客,橱窗是它的表情' },
  { id:'gather',  cn:'聚', desc:'一群人聚在一起玩、看、动、种,含全部屋顶格子' },
  { id:'service', cn:'服', desc:'撑起整栋楼运转的服务格子,多数没人久留' }
];

// ── 布置程序(恰好 4 个,id 照 SCHEMA §0.6)───────────────────
// 它只改区域角色的几何(哪块当主区、多大、往哪面墙推),不改零件尺寸。
export const PROGRAMS = [
  { id:'face', cn:'会客朝向', how:'主座具对着切开面,桌案在前,辅座在侧——为"面对面说话"排的。' },
  { id:'wall', cn:'靠墙沙发', how:'主家具贴窗墙一线排开,围坐退到房间深处——为"贴窗采光"排的。' },
  { id:'side', cn:'侧向围坐', how:'主家具沿一侧长墙,媒介墙正对切开面——为"一起看同一个方向"排的。' },
  { id:'nook', cn:'阅读角落', how:'主区刻意缩小,辅区的操作带或阅读椅升为主角——为"一个人干一件事"排的。' }
];

// ── 48 个功能 ──────────────────────────────────────────────
// zones 里每条 {cat, n}:cat 取 SCHEMA §0.2 的 11 个可落地大类,n 是整数或 [min,max]。
// 🔴 第 12 类 `person` 是动作库,绝不许出现在任何 zones 程序里。
// 各大类的落位天花板(写之前先问"这一格是干什么的"):
//   seat 座具[main,aux] ｜ table 桌案[main,aux,window] ｜ bed 睡眠[main]
//   storage 收纳[aux,walldec,main] ｜ cook 厨作[main,aux] ｜ bar 餐吧[main,aux,window]
//   light 灯具[window,main,aux,walldec] ｜ textile 织物[window,main,path,aux]
//   plant 绿植[window,path,aux,main] ｜ media 媒介[walldec,main,aux] ｜ arch 建筑[window,walldec,path]
// 单间总件数(按 max 累加)一律 ≤ 18。
export const FUNCTIONS = [

  // ══════════ dwell 住 (8) ══════════

  { id:'living', cn:'起居客厅', fam:'dwell', program:'face',
    bands:['mid','top'], area:[16,34],
    zones:{
      // 主事件=围坐说话:沙发对着切开面,茶几在前;电视只挂墙不占地
      window : [ {cat:'textile', n:1}, {cat:'plant', n:[1,2]} ],
      main   : [ {cat:'seat', n:[2,3]}, {cat:'table', n:1}, {cat:'light', n:1} ],
      aux    : [ {cat:'seat', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'living', public:false,
    desc:'一家人下班后瘫着说话看电视的地方,主区一定要围得起来。' },

  { id:'salon', cn:'会客沙龙', fam:'dwell', program:'face',
    bands:['ground','mid'], area:[18,38],
    zones:{
      // 与客厅的差别:椅子多而不成套,辅区多一段饮品吧台,给"来了又走"的客人用
      window : [ {cat:'textile', n:[1,2]}, {cat:'plant', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'seat', n:[3,5]}, {cat:'table', n:[1,2]} ],
      aux    : [ {cat:'seat', n:1}, {cat:'bar', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'storage', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'salon', public:true,
    desc:'单椅散着摆的对外客厅,谁都能坐下聊十分钟,角落有一段小吧台。' },

  { id:'dining', cn:'家庭餐厅', fam:'dwell', program:'face',
    bands:['ground','mid'], area:[12,26],
    zones:{
      // 一张大桌钉死主区、椅子围一圈,是全楼"椅子朝内"密度最高的自用格
      window : [ {cat:'textile', n:1}, {cat:'plant', n:[1,2]} ],
      main   : [ {cat:'table', n:[1,2]}, {cat:'seat', n:[4,6]} ],
      aux    : [ {cat:'storage', n:1}, {cat:'bar', n:1} ],
      walldec: [ {cat:'light', n:1}, {cat:'media', n:1} ],
      path   : []
    },
    people:'dining', public:false,
    desc:'一桌人吃饭,桌子摆正、椅子围满,谁也不许中途穿过桌子。' },

  { id:'bedroom', cn:'主卧', fam:'dwell', program:'wall',
    bands:['mid','top'], area:[12,22],
    zones:{
      // 主区只归床,床贴窗墙一线;卧室不许有灶、不许有柜台陈列
      window : [ {cat:'textile', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'bed', n:1}, {cat:'table', n:[1,2]} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'textile', n:1} ],
      walldec: [ {cat:'media', n:1} ],
      path   : []
    },
    people:'bedroom', public:false,
    desc:'一张床占住主区,其余全是收纳与遮光,东西越少睡得越好。' },

  { id:'kidroom', cn:'儿童房', fam:'dwell', program:'nook',
    bands:['mid'], area:[10,18],
    zones:{
      // 床只占半边,辅区升为主角:整条"书桌+玩具柜"操作带,地上还留软垫
      window : [ {cat:'plant', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'bed', n:1}, {cat:'textile', n:[1,2]} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'table', n:1}, {cat:'seat', n:1} ],
      walldec: [ {cat:'media', n:[2,3]} ],
      path   : [ {cat:'textile', n:[0,1]} ]
    },
    people:'kidroom', public:false,
    desc:'半边睡觉半边写作业,地上必须留一块能坐下来玩的软垫。' },

  { id:'nursery', cn:'婴儿房', fam:'dwell', program:'wall',
    bands:['mid','top'], area:[8,14],
    zones:{
      // 与主卧的差别:床边配一把哺乳摇椅(主区同时有 bed 与 seat),灯要柔、件数极少
      window : [ {cat:'textile', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'bed', n:1}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'table', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'light', n:1} ],
      path   : []
    },
    people:'nursery', public:false,
    desc:'婴儿床贴着窗墙,旁边一把摇椅,尿布台在辅区,夜里只有一盏小灯。' },

  { id:'guestroom', cn:'客房', fam:'dwell', program:'wall',
    bands:['mid','top'], area:[9,16],
    zones:{
      // 全楼最空的居住格:刻意留白让行李箱摊得开,没有梳妆也没有软装堆
      window : [ {cat:'textile', n:1}, {cat:'plant', n:1} ],
      main   : [ {cat:'bed', n:1}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]} ],
      path   : []
    },
    people:'guestroom', public:false,
    desc:'平时空着、来人才用的小房间,刻意留白,行李箱要摊得开。' },

  { id:'vanity', cn:'梳妆更衣', fam:'dwell', program:'nook',
    bands:['mid','top'], area:[5,10],
    zones:{
      // 主区缩到只剩镜台加一把凳,辅区的密集抽屉才是主角;照明给三处
      window : [ {cat:'light', n:1}, {cat:'textile', n:1} ],
      main   : [ {cat:'table', n:1}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'light', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'storage', n:1} ],
      path   : []
    },
    people:'vanity', public:false,
    desc:'一台镜子一把凳子外加满墙抽屉,坐下就不再起来的小格子。' },

  // ══════════ make 作 (8) ══════════

  { id:'study', cn:'书房', fam:'make', program:'nook',
    bands:['mid','top'], area:[8,18],
    zones:{
      // 主区一桌一椅,辅区那把阅读椅加落地灯升为主角(nook 的典型)
      window : [ {cat:'light', n:1}, {cat:'plant', n:1} ],
      main   : [ {cat:'table', n:1}, {cat:'seat', n:[1,2]}, {cat:'storage', n:[1,2]} ],
      aux    : [ {cat:'seat', n:1}, {cat:'storage', n:[1,2]}, {cat:'light', n:1} ],
      walldec: [ {cat:'media', n:1} ],
      path   : []
    },
    people:'study', public:false,
    desc:'一张书桌加一个只属于自己的阅读角,窗光落在桌左手边。' },

  { id:'library', cn:'墙到墙书库', fam:'make', program:'side',
    bands:['mid','top'], area:[18,40],
    zones:{
      // 通高书墙沿一侧长墙拉满,长桌与它平行;全楼件数顶格的一格
      window : [ {cat:'light', n:[1,2]}, {cat:'textile', n:1}, {cat:'plant', n:1} ],
      main   : [ {cat:'storage', n:[3,5]}, {cat:'table', n:[1,2]}, {cat:'seat', n:[2,3]} ],
      aux    : [ {cat:'seat', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]} ],
      path   : []
    },
    people:'library', public:false,
    desc:'书墙从这头顶到那头,长桌与它平行,坐下的人一小时不出声。' },

  { id:'coworking', cn:'共工位', fam:'make', program:'side',
    bands:['mid','top'], area:[20,45],
    zones:{
      // 与书库的差别:桌椅成对拼岛(不是长桌),辅区有咖啡角与柜,墙上挂屏
      window : [ {cat:'plant', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'table', n:[2,3]}, {cat:'seat', n:[3,5]} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'bar', n:1}, {cat:'seat', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'coworking', public:true,
    desc:'桌椅成对拼成工位岛,角落一台咖啡机,人坐得久但会去续杯。' },

  { id:'music', cn:'音乐室', fam:'make', program:'side',
    bands:['mid','top'], area:[12,26],
    zones:{
      // 一台大乐器(归 media 声音设备)沿侧墙吃掉主区,墙上挂吸音板与谱,窗必须厚帘
      window : [ {cat:'textile', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'media', n:[1,2]}, {cat:'seat', n:[1,3]}, {cat:'table', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'music', public:false,
    desc:'琴沿着侧墙斜放,谱架与琴凳围着它,墙上挂着吸音板与音箱。' },

  { id:'atelier', cn:'画室', fam:'make', program:'side',
    bands:['mid','top'], area:[14,30],
    zones:{
      // 画架与大桌沿侧墙一线,正对的整面墙是作品墙(media 给到 4)
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'table', n:[1,2]}, {cat:'seat', n:[1,2]}, {cat:'storage', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'cook', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'media', n:[2,4]} ],
      path   : []
    },
    people:'atelier', public:false,
    desc:'画架正对北窗,洗笔池在辅区,对面整堵墙全是自己的画。' },

  { id:'sewing', cn:'缝纫间', fam:'make', program:'nook',
    bands:['mid','top'], area:[8,18],
    zones:{
      // 主区只有一台机一把椅,辅区的裁剪台与布料架才是主角;墙上挂杆挂满
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'table', n:[1,2]}, {cat:'seat', n:1}, {cat:'storage', n:1} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'table', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'sewing', public:false,
    desc:'缝纫机前一把椅子坐死,身后是裁剪台和一整墙布料与挂杆。' },

  { id:'woodshop', cn:'木作间', fam:'make', program:'side',
    bands:['mid','top'], area:[18,40],
    zones:{
      // 工作台沿侧墙,四面可绕;工具全挂墙,只放一把高凳,人以站为主
      window : [ {cat:'light', n:[1,2]}, {cat:'arch', n:1} ],
      main   : [ {cat:'table', n:[1,2]}, {cat:'storage', n:1}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'cook', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'woodshop', public:false,
    desc:'工作台居中四面可绕,工具全挂墙,人围着台子转不坐下。' },

  { id:'darkroom', cn:'暗房', fam:'make', program:'nook',
    bands:['mid','top'], area:[5,12],
    zones:{
      // 窗只剩一片遮光百叶,主区缩到"水槽+操作台+一把高凳"三件
      window : [ {cat:'arch', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'table', n:[1,2]}, {cat:'cook', n:[1,2]}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'light', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'storage', n:1} ],
      path   : []
    },
    people:'darkroom', public:false,
    desc:'窗封成一片百叶只留红灯,水槽和操作台连成一条,人半小时不挪窝。' },

  // ══════════ cook 食 (8) ══════════

  { id:'kitchen', cn:'家庭厨房', fam:'cook', program:'wall',
    bands:['ground','mid'], area:[8,18],
    zones:{
      // 灶与操作台贴窗墙一线,水槽在辅区,连成洗→切→炒三角;没有座位,人一直站着
      window : [ {cat:'light', n:1}, {cat:'plant', n:1} ],
      main   : [ {cat:'cook', n:[2,3]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:[2,3]}, {cat:'light', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'kitchen', public:false,
    desc:'洗切炒三点连成一个三角,人一直站在灶前,绝不许摆沙发。' },

  { id:'openkitchen', cn:'开放餐厨', fam:'cook', program:'face',
    bands:['ground','mid'], area:[20,45],
    zones:{
      // 与家庭厨房的差别:岛台把灶与餐座连成一体,做饭的人面朝吃饭的人
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'cook', n:[1,2]}, {cat:'bar', n:1}, {cat:'seat', n:[2,4]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:[1,2]} ],
      walldec: [ {cat:'storage', n:1}, {cat:'media', n:1} ],
      path   : []
    },
    people:'openkitchen', public:false,
    desc:'岛台一边是灶一边是高凳,做饭的人抬头就能跟坐着的人说话。' },

  { id:'cafe', cn:'咖啡吧', fam:'cook', program:'wall',
    bands:['ground'], area:[20,45],
    zones:{
      // 窗边一排小方桌是临街表情,吧台退到辅区;客人坐得久、店员一直在走
      window : [ {cat:'table', n:[1,2]}, {cat:'plant', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'seat', n:[4,5]}, {cat:'table', n:[2,3]} ],
      aux    : [ {cat:'bar', n:[1,2]}, {cat:'seat', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'light', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'cafe', public:true,
    desc:'一半人坐窗边发呆一半人排队,吧台在辅区,咖啡机声就是背景音。' },

  { id:'bakery', cn:'烘焙工坊', fam:'cook', program:'side',
    bands:['ground'], area:[16,34],
    zones:{
      // 陈列柜沿侧墙一线拉开、窗里再摆一排,后场烤炉在辅区;全店没有一把客人的椅子
      window : [ {cat:'bar', n:[2,3]}, {cat:'light', n:1} ],
      main   : [ {cat:'bar', n:[2,3]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:[1,2]}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'storage', n:1} ],
      path   : []
    },
    people:'bakery', public:true,
    desc:'面包摆得比人多,客人拿夹子沿柜台走一圈就结账,不设堂食座位。' },

  { id:'teahouse', cn:'茶室', fam:'cook', program:'face',
    bands:['ground','mid'], area:[10,22],
    zones:{
      // 全族件数最少的一格:一桌数座对坐,绿植与织物压住气氛,不要陈列柜
      window : [ {cat:'plant', n:[1,2]}, {cat:'textile', n:1} ],
      main   : [ {cat:'seat', n:[3,4]}, {cat:'table', n:[1,2]} ],
      aux    : [ {cat:'storage', n:1}, {cat:'bar', n:1} ],
      walldec: [ {cat:'media', n:[1,2]} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'teahouse', public:true,
    desc:'东西越少越对,一桌四座、一窗绿意,人坐下来能待一个钟头。' },

  { id:'winebar', cn:'酒铺吧', fam:'cook', program:'side',
    bands:['ground','mid'], area:[16,36],
    zones:{
      // 吧身沿侧墙拉一条长线,高凳贴着它;场中另有低桌卡座,酒柜是背景墙
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'seat', n:[3,5]}, {cat:'table', n:[1,2]}, {cat:'bar', n:1} ],
      aux    : [ {cat:'seat', n:[1,2]}, {cat:'bar', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'light', n:1} ],
      path   : []
    },
    people:'winebar', public:true,
    desc:'吧台沿侧墙一线排开,高凳与卡座各占一半,灯压得很暗。' },

  { id:'juicebar', cn:'果汁吧', fam:'cook', program:'wall',
    bands:['ground'], area:[8,18],
    zones:{
      // 小格子:操作台贴窗墙,水果就是橱窗;只有两三个高凳,人喝完就走
      window : [ {cat:'bar', n:[1,2]}, {cat:'plant', n:[1,2]} ],
      main   : [ {cat:'bar', n:1}, {cat:'seat', n:[1,2]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'juicebar', public:true,
    desc:'水果堆在窗台就是招牌,两三个高凳而已,人站着喝完就走。' },

  { id:'piecorner', cn:'街角馅饼', fam:'cook', program:'nook',
    bands:['ground'], area:[6,14],
    zones:{
      // 全楼最小的商业格:主区缩成一个对街窗口柜台,后面就是炉子,零座位
      window : [ {cat:'bar', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'bar', n:[1,2]}, {cat:'cook', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:[1,2]} ],
      walldec: [ {cat:'media', n:1}, {cat:'storage', n:1} ],
      path   : []
    },
    people:'piecorner', public:true,
    desc:'一个对街的小窗口,后面就是炉子,买了拿着走,没有任何座位。' },

  // ══════════ shop 市 (8) ══════════

  { id:'florist', cn:'花店', fam:'shop', program:'wall',
    bands:['ground'], area:[10,24],
    zones:{
      // 全楼唯一以 plant 为主角的商业格:窗、主区、辅区、通行四处都是花
      window : [ {cat:'plant', n:[3,4]}, {cat:'bar', n:1} ],
      main   : [ {cat:'plant', n:[2,3]}, {cat:'table', n:1}, {cat:'bar', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:1}, {cat:'plant', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'light', n:1} ],
      path   : [ {cat:'plant', n:[0,2]} ]
    },
    people:'florist', public:true,
    desc:'花桶从橱窗一直摆到门口,一张扎花台居中,老板始终站着。' },

  { id:'bookstore', cn:'书店', fam:'shop', program:'nook',
    bands:['ground','mid'], area:[18,40],
    zones:{
      // 与书库的差别:书架围成迷宫、主区被拆小,拐角塞进可坐的阅读角才是卖点
      window : [ {cat:'bar', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'storage', n:[3,4]}, {cat:'seat', n:[1,2]}, {cat:'table', n:1} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'seat', n:1} ],
      walldec: [ {cat:'light', n:1}, {cat:'media', n:1} ],
      path   : []
    },
    people:'bookstore', public:true,
    desc:'书架围成迷宫,拐角塞一把椅子,客人站着翻累了才坐下。' },

  { id:'grocer', cn:'杂货', fam:'shop', program:'side',
    bands:['ground'], area:[18,40],
    zones:{
      // 货架沿侧墙成排、中间一条主通道;辅区有冲洗池与理货台,零座位
      window : [ {cat:'bar', n:[2,3]}, {cat:'plant', n:1} ],
      main   : [ {cat:'storage', n:[3,4]}, {cat:'bar', n:1}, {cat:'table', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'cook', n:1} ],
      walldec: [ {cat:'storage', n:1}, {cat:'media', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'grocer', public:true,
    desc:'菜筐堆到齐腰、货架排成两条巷子,人挑挑拣拣一直在走。' },

  { id:'records', cn:'唱片行', fam:'shop', program:'side',
    bands:['ground','mid'], area:[12,28],
    zones:{
      // 翻箱沿侧墙一线,正对的墙是唱片封面墙;店里必有一台真在放的唱机
      window : [ {cat:'bar', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'storage', n:[2,4]}, {cat:'media', n:[1,2]}, {cat:'seat', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      walldec: [ {cat:'media', n:[2,3]} ],
      path   : []
    },
    people:'records', public:true,
    desc:'翻箱一排排,墙上贴满封面,角落那台唱机一直在放。' },

  { id:'boutique', cn:'服装橱窗', fam:'shop', program:'wall',
    bands:['ground'], area:[16,34],
    zones:{
      // 橱窗是主角(bar 陈列贴窗墙),场中大片留白,只给陪同的人一把椅子
      window : [ {cat:'bar', n:[2,3]}, {cat:'light', n:[1,2]}, {cat:'textile', n:1} ],
      main   : [ {cat:'bar', n:[2,3]}, {cat:'seat', n:1}, {cat:'storage', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      walldec: [ {cat:'media', n:1}, {cat:'light', n:1} ],
      path   : []
    },
    people:'boutique', public:true,
    desc:'橱窗只挂三件、场中大片留白,陪同的人坐在那把椅子上等。' },

  { id:'hairsalon', cn:'理发', fam:'shop', program:'side',
    bands:['ground'], area:[14,30],
    zones:{
      // 座具与镜面一一配对沿侧墙排开,洗头池在辅区;客人坐死、师傅一直绕着走
      window : [ {cat:'plant', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'seat', n:[2,4]}, {cat:'media', n:[2,4]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:[1,2]}, {cat:'seat', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]} ],
      path   : []
    },
    people:'hairsalon', public:true,
    desc:'一把椅子配一面镜子沿墙排开,洗头池在后墙,师傅绕着客人转。' },

  { id:'bikeshop', cn:'自行车铺', fam:'shop', program:'nook',
    bands:['ground'], area:[12,28],
    zones:{
      // 主区是挂车的架子,真正的主角是辅区那条修车工作台(nook)
      window : [ {cat:'arch', n:1}, {cat:'light', n:1} ],
      main   : [ {cat:'storage', n:[2,3]}, {cat:'table', n:[1,2]}, {cat:'bar', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'table', n:1}, {cat:'seat', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'bikeshop', public:true,
    desc:'整车挂满墙架,角落一条修车台才是店的心脏,老板多半在那儿。' },

  { id:'lobby', cn:'门厅接待', fam:'shop', program:'face',
    bands:['ground'], area:[14,32],
    zones:{
      // 接待台面朝门,等候椅对着切开面;整栋楼的第一印象,绿植与灯要足
      window : [ {cat:'plant', n:[1,2]}, {cat:'light', n:1}, {cat:'arch', n:1} ],
      main   : [ {cat:'seat', n:[2,3]}, {cat:'table', n:[1,2]}, {cat:'bar', n:1} ],
      aux    : [ {cat:'seat', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'lobby', public:true,
    desc:'接待台正对大门,几组等候椅围着茶几,是整栋楼的第一张脸。' },

  // ══════════ gather 聚 (8) ══════════

  { id:'playroom', cn:'儿童游戏', fam:'gather', program:'nook',
    bands:['ground','mid'], area:[14,30],
    zones:{
      // 主区被地垫吃掉、家具全部矮化退到边上,大人只在角落有一把软座
      window : [ {cat:'plant', n:1}, {cat:'textile', n:1} ],
      main   : [ {cat:'textile', n:[2,3]}, {cat:'storage', n:[1,2]}, {cat:'seat', n:[1,2]} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'table', n:1} ],
      walldec: [ {cat:'media', n:[2,3]} ],
      path   : [ {cat:'textile', n:[0,1]} ]
    },
    people:'playroom', public:true,
    desc:'地上整片软垫,矮柜围一圈,大人坐边上、小孩满地爬。' },

  { id:'gallery', cn:'小展厅', fam:'gather', program:'side',
    bands:['ground','mid'], area:[20,45],
    zones:{
      // 全楼墙面挂载量最大的一格:展墙沿侧面拉满、地面刻意空,只留一条长凳
      window : [ {cat:'light', n:[1,2]}, {cat:'arch', n:1} ],
      main   : [ {cat:'media', n:[3,5]}, {cat:'seat', n:[1,2]} ],
      aux    : [ {cat:'bar', n:1}, {cat:'plant', n:1} ],
      walldec: [ {cat:'media', n:[3,5]} ],
      path   : []
    },
    people:'gallery', public:true,
    desc:'墙面挂满、地面空着,中间一条长凳,人走三步停五秒。' },

  { id:'cinema', cn:'放映角', fam:'gather', program:'side',
    bands:['mid','top'], area:[20,45],
    zones:{
      // 全楼最"静止"的格子:座位沿侧墙一排全部朝同一端,窗必须能全遮
      window : [ {cat:'textile', n:[1,2]} ],
      main   : [ {cat:'seat', n:[5,8]}, {cat:'table', n:1} ],
      aux    : [ {cat:'media', n:1}, {cat:'storage', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:[1,2]} ],
      path   : []
    },
    people:'cinema', public:false,
    desc:'一排座位齐刷刷朝着幕布,灯全灭,两小时里几乎没人动。' },

  { id:'yoga', cn:'瑜伽垫间', fam:'gather', program:'wall',
    bands:['mid','top'], area:[16,34],
    zones:{
      // 全楼唯一"一把椅子都没有"的聚会格:垫子铺满主区,镜面上墙,人只在垫上
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1}, {cat:'textile', n:1} ],
      main   : [ {cat:'textile', n:[3,5]}, {cat:'plant', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'textile', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'yoga', public:true,
    desc:'垫子沿窗墙铺满一地,镜子挂在对面,场里没有一把椅子。' },

  { id:'greenhouse', cn:'温室', fam:'gather', program:'wall',
    bands:['top','roof'], area:[16,40],
    zones:{
      // 育苗床贴着玻璃墙成排,人在其间弯腰忙;没有座位,通行道也种着东西
      window : [ {cat:'plant', n:[3,4]}, {cat:'light', n:1} ],
      main   : [ {cat:'plant', n:[3,4]}, {cat:'table', n:[1,2]} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:1}, {cat:'plant', n:[1,2]} ],
      walldec: [ {cat:'arch', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'greenhouse', public:true,
    desc:'育苗床贴着玻璃一排排,水管拖在地上,人弯着腰来回,不会坐下。' },

  { id:'roofgarden', cn:'屋顶花园', fam:'gather', program:'wall',
    bands:['roof'], area:[24,60],
    zones:{
      // 花池沿女儿墙一圈,座位散在花与花之间;通行道本身也是花径
      window : [ {cat:'plant', n:[2,3]}, {cat:'light', n:[1,2]}, {cat:'arch', n:1} ],
      main   : [ {cat:'seat', n:[2,3]}, {cat:'plant', n:[1,2]} ],
      aux    : [ {cat:'plant', n:[1,2]}, {cat:'storage', n:1} ],
      walldec: [ {cat:'light', n:1}, {cat:'arch', n:1} ],
      path   : [ {cat:'plant', n:[1,2]} ]
    },
    people:'roofgarden', public:true,
    desc:'花池沿着女儿墙围一圈,座位藏在花中间,傍晚灯串亮起来。' },

  { id:'roofbbq', cn:'屋顶烧烤', fam:'gather', program:'face',
    bands:['roof'], area:[18,45],
    zones:{
      // 烤台正对围坐的人(face),备餐台与冷柜在辅区;是屋顶唯一允许有明火的格
      window : [ {cat:'light', n:[1,2]}, {cat:'plant', n:1} ],
      main   : [ {cat:'cook', n:[1,2]}, {cat:'table', n:[1,2]}, {cat:'seat', n:[3,4]} ],
      aux    : [ {cat:'bar', n:1}, {cat:'storage', n:1}, {cat:'cook', n:1} ],
      walldec: [ {cat:'light', n:1}, {cat:'arch', n:1} ],
      path   : []
    },
    people:'roofbbq', public:true,
    desc:'烤台正对着一圈人,烟往上走,备餐台和冷柜退到栏杆边。' },

  { id:'roofdining', cn:'屋顶餐廊', fam:'gather', program:'face',
    bands:['roof'], area:[20,50],
    zones:{
      // 与屋顶烧烤的差别:没有明火,长桌成排、椅子围满,顶上是布篷与灯串
      window : [ {cat:'plant', n:[1,2]}, {cat:'light', n:[1,2]}, {cat:'textile', n:1} ],
      main   : [ {cat:'table', n:[2,3]}, {cat:'seat', n:[4,6]} ],
      aux    : [ {cat:'bar', n:1}, {cat:'plant', n:1} ],
      walldec: [ {cat:'light', n:1}, {cat:'arch', n:1} ],
      path   : []
    },
    people:'roofdining', public:true,
    desc:'长桌摆在布篷下,椅子围满,一抬头是灯串和天,吃到很晚。' },

  // ══════════ service 服 (8) ══════════

  { id:'stairhall', cn:'楼梯厅', fam:'service', program:'nook',
    bands:['ground','mid','top'], area:[8,18],
    zones:{
      // 主区必须让给梯段本身,只放一株高绿与一盏灯;栏杆(arch)沿通行道走
      window : [ {cat:'arch', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'plant', n:[1,2]}, {cat:'light', n:1} ],
      aux    : [ {cat:'storage', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'arch', n:[1,2]}, {cat:'media', n:1} ],
      path   : [ {cat:'arch', n:[1,2]} ]
    },
    people:'stairhall', public:true,
    desc:'梯段占住中间,只在转角放一株高绿,人穿过去从不停留。' },

  { id:'laundry', cn:'洗衣', fam:'service', program:'nook',
    bands:['ground','mid'], area:[4,10],
    zones:{
      // 洗烘设备与操作台同属带水带电的一类,贴墙排开;主区窄、辅区才是作业带
      window : [ {cat:'light', n:1}, {cat:'plant', n:1} ],
      main   : [ {cat:'cook', n:[1,2]}, {cat:'table', n:1} ],
      aux    : [ {cat:'cook', n:1}, {cat:'storage', n:[1,2]} ],
      walldec: [ {cat:'storage', n:1}, {cat:'media', n:1} ],
      path   : []
    },
    people:'laundry', public:false,
    desc:'洗烘设备贴墙排开,人站着装卸再到台面上折叠,没有一把椅子。' },

  { id:'mailroom', cn:'信箱间', fam:'service', program:'nook',
    bands:['ground'], area:[5,12],
    zones:{
      // 整面格口柜是主角,分拣台只是一条窄边;没有座位,住户探个头就走
      window : [ {cat:'light', n:1}, {cat:'arch', n:1} ],
      main   : [ {cat:'storage', n:[3,4]}, {cat:'table', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'light', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'mailroom', public:true,
    desc:'一整面格口柜加一条分拣台,住户开箱取件,前后不到半分钟。' },

  { id:'bikepark', cn:'车棚', fam:'service', program:'wall',
    bands:['ground'], area:[10,26],
    zones:{
      // 车架贴墙成排,通行道留出推车的宽度;栏杆与雨棚(arch)是它的全部建筑感
      window : [ {cat:'arch', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'storage', n:[3,5]}, {cat:'plant', n:1} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'light', n:1} ],
      walldec: [ {cat:'arch', n:1}, {cat:'media', n:1} ],
      path   : [ {cat:'arch', n:[0,1]} ]
    },
    people:'bikepark', public:true,
    desc:'车架贴墙成排,人推着车进来锁上就走,通道要留得下车把。' },

  { id:'storageroom', cn:'储藏', fam:'service', program:'nook',
    bands:['ground','mid','top'], area:[3,9],
    zones:{
      // 全楼最纯粹的一格:主区只有货架一件大类,人进去转个身就出来
      window : [ {cat:'light', n:1} ],
      main   : [ {cat:'storage', n:[3,4]} ],
      aux    : [ {cat:'storage', n:[2,3]}, {cat:'table', n:1} ],
      walldec: [ {cat:'storage', n:[1,2]}, {cat:'media', n:1} ],
      path   : []
    },
    people:'storageroom', public:false,
    desc:'四面全是架子,中间只够一个人转身,取完东西马上出去。' },

  { id:'waterplant', cn:'水房花槽', fam:'service', program:'wall',
    bands:['ground','mid'], area:[4,12],
    zones:{
      // 水管与水槽贴墙一线,槽边就势种上香草;是全楼最湿的一格,人只来放水
      window : [ {cat:'plant', n:[2,3]}, {cat:'arch', n:1} ],
      main   : [ {cat:'cook', n:[1,2]}, {cat:'plant', n:[1,2]} ],
      aux    : [ {cat:'storage', n:1}, {cat:'cook', n:1}, {cat:'plant', n:1} ],
      walldec: [ {cat:'arch', n:1}, {cat:'light', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'waterplant', public:false,
    desc:'水槽与管道贴墙一线,槽边顺手种了香草,人来接盆水就走。' },

  { id:'duty', cn:'值班小间', fam:'service', program:'nook',
    bands:['ground','mid'], area:[4,10],
    zones:{
      // 服族里唯一有人久坐的格:一桌一椅一屏,主区小到刚好装下这个人
      window : [ {cat:'light', n:1}, {cat:'arch', n:1} ],
      main   : [ {cat:'table', n:1}, {cat:'seat', n:1}, {cat:'media', n:[1,2]} ],
      aux    : [ {cat:'storage', n:[1,2]}, {cat:'bar', n:1} ],
      walldec: [ {cat:'media', n:[1,2]}, {cat:'light', n:1} ],
      path   : []
    },
    people:'duty', public:true,
    desc:'一桌一椅一块屏,值班的人整晚坐在这儿,门外有人才抬头。' },

  { id:'skybridge', cn:'连廊', fam:'service', program:'wall',
    bands:['mid','top'], area:[10,26],
    zones:{
      // 两侧是玻璃与栏杆,中间必须让出通行;只在一端放一条能看风景的长凳
      window : [ {cat:'arch', n:[2,3]}, {cat:'plant', n:[1,2]}, {cat:'light', n:1} ],
      main   : [ {cat:'seat', n:[1,2]}, {cat:'plant', n:1} ],
      aux    : [ {cat:'plant', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'arch', n:1}, {cat:'media', n:1} ],
      path   : [ {cat:'arch', n:[1,2]}, {cat:'plant', n:[0,1]} ]
    },
    people:'skybridge', public:true,
    desc:'两侧全是玻璃,中间让出通道,尽头一条长凳专门用来看外面。' }

];
