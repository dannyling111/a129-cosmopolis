// ============================================================
// CosmoPolis 量化积木城市 · 第一层【社区】
// 依据:engine/SCHEMA.md v1 §0.3 / §0.4 / §4
// 管的是"整栋楼怎么排":哪一层带允许哪些族、谁不许挨着谁、
// 街面长什么样、每层大概放几间。assemble() 只读这里,不自己拍脑袋。
// 族 id 用蓝图原名:dwell 住 / make 作 / cook 食 / shop 市 / gather 聚 / service 服。
// 无任何 import,纯数据。
// ============================================================

// ── 层带规则(4 个层带,照 SCHEMA §0.4,fams 一律非空)────────
export const BAND_RULES = {
  ground: { fams:['shop','cook','service'],                 publicMin:0.66,
            note:'临街面是社区的脸:市与食占主体,再夹几间对社区开放的服务格(门厅/信箱/车棚);私密居住不许落在街面。' },
  mid   : { fams:['dwell','gather','make','cook','service'], publicMin:0.10,
            note:'楼的肚子:住与聚为主,夹几间作与家常的食;每层必须留得下楼梯厅与洗衣这类服务格,允许极少数对外(会客沙龙/儿童游戏)。' },
  top   : { fams:['dwell','make','gather','service'],        publicMin:0.00,
            note:'安静层:睡觉与创作为主,商业彻底退出;需要卸货、明火或重噪声的一律不上来。' },
  roof  : { fams:['gather'],                                 publicMin:0.50,
            note:'屋顶只归"聚"这一族:花园/烧烤/餐廊/温室四件,全部对外共享;明火厨房、暗房、木作、私密居住一律不许上屋顶。' }
};

// ── 相邻规则 ────────────────────────────────────────────────
// avoid = 不许相邻(assemble 排格时硬拒);like = 优先相邻(加权)。
// 🔴 noSameNeighbor:同一个功能不许紧挨自己。
//    指引开篇批评的就是「同一功能的房间看起来像复制粘贴」,但第一版没有任何机制拦它。
//    assemble() 抽房间时过滤,auditCity() 判红,两边用同一个开关。
export const ADJACENCY = {
  noSameNeighbor: true,
  // 同一层里同一个功能最多出现一次。noSameNeighbor 只拦"紧挨着",
  // 但一层三间里第 1 间和第 3 间都是信箱间,看上去照样是复制粘贴 —— 主席给的参考图里
  // 一层从来不会出现两间一样的房。
  noRepeatOnFloor: true,
  avoid: [
    // 🔴 指引原话「两间厨房不要并排」——第一版整套规则里一条含 kitchen 的自对都没有,
    //    独立验收实测 9000 对相邻里犯了 18 次,而体检每一栋都判绿。这三对是补上的。
    ['kitchen', 'kitchen'],        // 两间家庭厨房并排 = 指引明令禁止
    ['openkitchen', 'openkitchen'],// 开放餐厨同理
    ['kitchen', 'openkitchen'],    // 两种厨房并排也算并排

    ['kitchen','bedroom'],       // 油烟与睡眠正面冲突,墙再厚也挡不住味
    ['woodshop','nursery'],      // 电锯与婴儿作息不可能共存,这是最硬的一对
    ['woodshop','darkroom'],     // 木屑一旦飘进显影盘,整批片子作废
    ['cinema','music'],          // 两个都要发声的房间挨着,互相串音谁也用不成
    ['winebar','nursery'],       // 深夜酒吧的人声与婴儿房的作息完全对不上
    ['grocer','bedroom'],        // 卸货声与生鲜气味不该出现在卧室隔壁
    ['stairhall','darkroom'],    // 楼梯厅人来人往,一开门暗房就漏光
    ['hairsalon','bakery'],      // 染发的气味绝不许串进食品柜台
    ['yoga','woodshop'],         // 一边要静到听见呼吸,一边要开电锯
    ['laundry','records'],       // 洗衣房的湿气会让唱片和封套发霉
    ['bikepark','gallery'],      // 车棚带进来的泥水与展墙不能挨着
    ['storageroom','lobby']      // 门厅是整栋楼的脸,不许紧挨杂物间
  ],
  like  : [
    ['kitchen','dining'],        // 端菜距离越短越好,这是全楼最硬的一对
    ['openkitchen','dining'],    // 开放餐厨与餐厅本就是一件事的两半
    ['cafe','bakery'],           // 面包与咖啡共用客流,挨着能互相带客
    ['bedroom','vanity'],        // 起床转身就上妆,两格连成一条动线
    ['bedroom','nursery'],       // 夜里听得见才敢睡,婴儿房必须贴着主卧
    ['study','library'],         // 写与查是同一件事,书墙就该在书桌隔壁
    ['living','salon'],          // 自家起居与对外会客共享同一套待客动线
    ['playroom','kidroom'],      // 玩与睡挨着,孩子自己就能来回
    ['florist','greenhouse'],    // 花店的货直接从温室端过来
    ['roofgarden','roofdining'], // 花园是餐廊的景,餐廊是花园的用途
    ['roofbbq','roofdining'],    // 烤好直接端上长桌,中间不该隔别的东西
    ['lobby','mailroom'],        // 进门顺手取件,是门厅的标准配套
    ['stairhall','skybridge'],   // 垂直交通与水平交通必须接在一起
    ['bikeshop','bikepark'],     // 修车与停车同一批人同一批车
    ['atelier','gallery'],       // 画完直接挂到隔壁展墙上
    ['records','bookstore']      // 翻唱片与翻书是同一类客人同一种逛法
  ],
  // 某层带上明确禁止出现的功能。多数条目其实已被 fams 挡在门外,
  // 这里再写一遍是双保险:蓝图往后加功能时,fams 可能放宽,这张黑名单不会。
  banned: {
    // 屋顶:明火/遮光/重噪声/私密,一件都不许上来
    roof  : ['kitchen','openkitchen','darkroom','woodshop','sewing','laundry','storageroom','waterplant','bedroom','nursery','guestroom','vanity','cinema'],
    // 街面:私密居住与纯堆放不许占用临街面
    ground: ['bedroom','guestroom','nursery','vanity','kidroom','storageroom','waterplant','cinema'],
    // 中层:暗房要的是彻底遮光与安静,不该夹在人来人往的住户层(darkroom 的 bands 含 mid,这条是真拦,拦完它只能落顶层)
    mid   : ['darkroom'],
    // 顶层:要卸货、要明火、要推车的不该爬到最高层
    top   : ['grocer','piecorner','laundry','bikepark']
  }
};

// ── 街面(楼前的一层)──────────────────────────────────────
export const STREET = {
  lamps      : [6,10],   // 路灯,沿街等距
  trees      : [4,8],    // 行道树,种在灯与灯之间
  pedestrians: [8,18],   // 走动的路人
  planters   : [2,6],    // 花池/地栽,压住店门两侧
  benches    : [2,5],    // 长椅,面朝街不面朝墙
  bikes      : [3,9],    // 停靠的自行车,贴着花池排
  awnings    : [2,5],    // 店面雨棚,只出现在 public:true 的临街格前
  note       : '楼前这条街是社区的第一层:先有灯与树定出节奏,再让人流沿着店门走。'
};

// ── 每层带的配比建议(给 assemble 分格用)────────────────────
// rooms = 这一层带大约切几间;mix = 各族占比(总和 ≈ 1,键必须是 6 个族 id);
// publicHint = 期望对外格子的比例(与 BAND_RULES.publicMin 呼应,前者是目标后者是底线)。
export const FLOOR_MIX = {
  ground: {
    rooms:[4,7],
    mix:{ shop:0.45, cook:0.35, service:0.20, dwell:0, make:0, gather:0 },
    publicHint:0.80,
    note:'街面以市为骨、食为肉,再插一两间对社区开放的服务格(门厅/信箱间/车棚)。' },
  mid: {
    rooms:[5,8],
    mix:{ dwell:0.42, gather:0.18, make:0.18, cook:0.12, service:0.10, shop:0 },
    publicHint:0.15,
    note:'住宅主层:每层一套完整住区(主卧+起居+餐厅+厨房),再补一两间作与聚,末尾必留楼梯厅。' },
  top: {
    rooms:[4,7],
    mix:{ dwell:0.40, make:0.35, gather:0.15, service:0.10, cook:0, shop:0 },
    publicHint:0.00,
    note:'安静层:主卧、书房、书库与画室成组,不放任何对外格子,只留楼梯厅与储藏。' },
  roof: {
    rooms:[2,4],
    mix:{ gather:1.00, dwell:0, make:0, cook:0, shop:0, service:0 },
    publicHint:0.75,
    note:'屋顶只切两到四大格:花园压住主景,配餐廊或烧烤,温室占一角,其余留大片空地。' }
};
