// ═══════════════════════════════════════════════════════════════════════════
// CosmoPolis · view/palette.mjs —— 鲜艳配色与房间风格（纯数据层，不 import 任何东西）
//
// 主席的判据（原话）：「颜色一定要很鲜艳……欢快鲜艳、风格各异的、这种治愈系的」。
// 参考图里每间房一个鲜艳主色，一眼扫过去像糖果盒，绝不是一片米灰。
//
// 「鲜艳但不刺眼」的配方 = 浅而艳（马卡龙 / 糖果色）：
//   · 主墙 wall   —— 饱和度 ≥0.35、明度 0.70~0.90。艳在饱和度上，不艳在浓度上，
//                    所以整面墙铺开来是甜的而不是吵的。
//   · 强调 accent —— 饱和度 ≥0.45、明度 0.35~0.75。只占一面墙 / 一圈点缀，
//                    浓度全给它，负责把「这间房是什么房」一眼说清。
//   · 描边 trim   —— 同色相的极浅色（明度 0.95），踢脚线 / 窗框用，
//                    比纯白多一点色相，房间才有整体感。
//
// 48 间房按【族】分色相带，带内再错开色相 + 明度 + 饱和度三个维度，
// 所以主卧 / 客房 / 儿童房绝不会都是粉的：
//   住 dwell   → 暖橙粉  318°~42°   （粉 / 玫瑰 / 珊瑚 / 蜜桃 / 杏）
//   作 make    → 蓝青    176°~250°  （青绿 / 天蓝 / 靛 / 蓝紫）
//   食 cook    → 黄橙红  12°~66°    （酒红 / 焦糖 / 蜜橙 / 麦金 / 柠黄）
//   市 shop    → 品红紫  266°~316°  （紫罗兰 / 薰衣草 / 电紫 / 葡萄 / 洋红）
//   聚 gather  → 绿松    128°~176°  （嫩绿 / 草地 / 翠 / 薄荷 / 松石）
//   服 service → 灰蓝低彩 168°~268° （饱和刻意压到全楼最低 0.36~0.48，
//                                     服务空间不该跟客厅抢眼，但仍不许发灰）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 48 个功能各自的房间风格。id 与 engine/functions.mjs 的 48 个 id 一一对应。
 * 字段：wall 主墙 / accent 强调墙·点缀 / trim 踢脚线·窗框 /
 *       floor 地面材质 / floorA·floorB 地面两色（条纹或棋盘，必有可见差别） /
 *       mood 灯光冷暖档（渲染层据此调环境光）
 */
export const ROOM_STYLES = {

  // ══ 住 dwell · 暖橙粉带 —— 粉 / 玫瑰 / 珊瑚 / 蜜桃 / 杏 ══
  living: { // 起居客厅 —— 亮珊瑚，全家最跳的一间
    wall: 0xf4bca4, accent: 0xea4a3e, trim: 0xf7f1ee,
    floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'warm',
  },
  salon: { // 会客沙龙 —— 柔玫瑰，待客的体面色
    wall: 0xefbdce, accent: 0xd9454f, trim: 0xf7eef1,
    floor: 'wood', floorA: 0xc59a63, floorB: 0xa97542, mood: 'warm',
  },
  dining: { // 家庭餐厅 —— 番茄红，最开胃
    wall: 0xf49d90, accent: 0xe48525, trim: 0xf7efee,
    floor: 'wood', floorA: 0xc5a163, floorB: 0xa97c42, mood: 'warm',
  },
  bedroom: { // 主卧 —— 淡蜜桃，主卧要最不刺眼
    wall: 0xefdac8, accent: 0xd25441, trim: 0xf7f2ee,
    floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'soft',
  },
  kidroom: { // 儿童房 —— 糖果粉，全楼最甜
    wall: 0xf797c7, accent: 0xee4f4f, trim: 0xf7eef2,
    floor: 'rug', floorA: 0xdd88b3, floorB: 0xc95468, mood: 'soft',
  },
  nursery: { // 婴儿房 —— 奶油杏，明度最高
    wall: 0xf6e9cb, accent: 0xdb8d76, trim: 0xf7f4ee,
    floor: 'rug', floorA: 0xddc388, floorB: 0xc5c954, mood: 'soft',
  },
  guestroom: { // 客房 —— 藕粉，刻意低彩留白
    wall: 0xeac8cc, accent: 0xd18a61, trim: 0xf7eeef,
    floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'soft',
  },
  vanity: { // 梳妆更衣 —— 丁香粉，镜前要亮
    wall: 0xedb6dc, accent: 0xcd3cdd, trim: 0xf7eef4,
    floor: 'tile', floorA: 0xf0eaee, floorB: 0xdbb8d0, mood: 'soft',
  },

  // ══ 作 make · 蓝青带 —— 青绿 / 天蓝 / 靛 / 蓝紫 ══
  study: { // 书房 —— 天蓝，久坐不烦
    wall: 0xb5d6ee, accent: 0x2740ce, trim: 0xeef3f7,
    floor: 'wood', floorA: 0xc5a163, floorB: 0xa97c42, mood: 'cool',
  },
  library: { // 墙到墙书库 —— 浅青，书脊才是主角
    wall: 0xc4e8ee, accent: 0x2d5eb4, trim: 0xeef5f7,
    floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'cool',
  },
  coworking: { // 共工位 —— 亮蓝，提神
    wall: 0xa8bef0, accent: 0x2ca8dd, trim: 0xeef1f7,
    floor: 'polish', floorA: 0xd9dce2, floorB: 0xb1bacd, mood: 'cool',
  },
  music: { // 音乐室 —— 蓝紫，吸音板的底色
    wall: 0xc6bfee, accent: 0x9b43d6, trim: 0xefeef7,
    floor: 'wood', floorA: 0xc5a163, floorB: 0xa97c42, mood: 'soft',
  },
  atelier: { // 画室 —— 青绿，北窗冷光的搭档
    wall: 0xb6ede9, accent: 0x2b6fd4, trim: 0xeef7f6,
    floor: 'stone', floorA: 0xb9c6c5, floorB: 0x94adab, mood: 'cool',
  },
  sewing: { // 缝纫间 —— 淡靛，布料再花也压得住
    wall: 0xcdcfef, accent: 0x9454d4, trim: 0xeeeef7,
    floor: 'wood', floorA: 0xc59a63, floorB: 0xa97542, mood: 'cool',
  },
  woodshop: { // 木作间 —— 湖蓝，衬木头的黄
    wall: 0x9ddbf1, accent: 0x1ecca4, trim: 0xeef4f7,
    floor: 'stone', floorA: 0xb9c2c6, floorB: 0x94a6ad, mood: 'cool',
  },
  darkroom: { // 暗房 —— 暗房最深的一间，强调色是红安全灯
    wall: 0x9cbade, accent: 0xe61957, trim: 0xeef2f7,
    floor: 'tile', floorA: 0xeaedf0, floorB: 0xb8c8db, mood: 'cool',
  },

  // ══ 食 cook · 黄橙红带 —— 酒红 / 焦糖 / 蜜橙 / 麦金 / 柠黄 ══
  kitchen: { // 家庭厨房 —— 亮黄，站着做饭要亮
    wall: 0xf8e8b5, accent: 0xe45225, trim: 0xf7f5ee,
    floor: 'tile', floorA: 0xf0efea, floorB: 0xdbd3b8, mood: 'warm',
  },
  openkitchen: { // 开放餐厨 —— 南瓜橙，岛台的主色
    wall: 0xf8cca0, accent: 0xe6d819, trim: 0xf7f2ee,
    floor: 'tile', floorA: 0xf0edea, floorB: 0xdbc9b8, mood: 'warm',
  },
  cafe: { // 咖啡吧 —— 焦糖，咖啡的颜色
    wall: 0xedbaa1, accent: 0xba8e26, trim: 0xf7f1ee,
    floor: 'polish', floorA: 0xe2dcd9, floorB: 0xcdbbb1, mood: 'warm',
  },
  bakery: { // 烘焙工坊 —— 奶油麦金，衬面包
    wall: 0xf8e7c9, accent: 0xde6e35, trim: 0xf7f3ee,
    floor: 'tile', floorA: 0xf0eeea, floorB: 0xdbceb8, mood: 'warm',
  },
  teahouse: { // 茶室 —— 茶黄绿，最静的一间
    wall: 0xeaeec9, accent: 0x3abf36, trim: 0xf6f7ee,
    floor: 'wood', floorA: 0xc5a163, floorB: 0xa97c42, mood: 'fresh',
  },
  winebar: { // 酒铺吧 —— 陈酒玫瑰红，灯压得很暗
    wall: 0xe8ab9c, accent: 0xca2170, trim: 0xf7f0ee,
    floor: 'polish', floorA: 0xe2dbd9, floorB: 0xcdb7b1, mood: 'neon',
  },
  juicebar: { // 果汁吧 —— 柠檬黄，最鲜的一间
    wall: 0xf9f1a9, accent: 0x25e4ab, trim: 0xf7f6ee,
    floor: 'tile', floorA: 0xf0efea, floorB: 0xdbd7b8, mood: 'fresh',
  },
  piecorner: { // 街角馅饼 —— 蜜橙，对街窗口要显眼
    wall: 0xf5d5bc, accent: 0xdbdb24, trim: 0xf7f2ee,
    floor: 'tile', floorA: 0xf0edea, floorB: 0xdbc7b8, mood: 'warm',
  },

  // ══ 市 shop · 品红紫带 —— 紫罗兰 / 薰衣草 / 电紫 / 葡萄 / 洋红 ══
  florist: { // 花店 —— 洋红，花桶的底色
    wall: 0xf4bde6, accent: 0xdc4838, trim: 0xf7eef4,
    floor: 'polish', floorA: 0xe2d9e0, floorB: 0xcdb1c6, mood: 'fresh',
  },
  bookstore: { // 书店 —— 薰衣草，书店要沉一点
    wall: 0xd7bceb, accent: 0xc62f94, trim: 0xf3eef7,
    floor: 'wood', floorA: 0xc59a63, floorB: 0xa97542, mood: 'warm',
  },
  grocer: { // 杂货 —— 淡紫红，货架很花所以墙要浅
    wall: 0xf3c8f3, accent: 0xd8313c, trim: 0xf7eef7,
    floor: 'polish', floorA: 0xe2d9e2, floorB: 0xcdb1cd, mood: 'fresh',
  },
  records: { // 唱片行 —— 电紫，霓虹的家
    wall: 0xdf9af4, accent: 0xeb3376, trim: 0xf5eef7,
    floor: 'polish', floorA: 0xe0d9e2, floorB: 0xc7b1cd, mood: 'neon',
  },
  boutique: { // 服装橱窗 —— 灰紫粉，大片留白
    wall: 0xefd2eb, accent: 0xa15ed4, trim: 0xf7eef5,
    floor: 'polish', floorA: 0xe2d9e1, floorB: 0xcdb1ca, mood: 'soft',
  },
  hairsalon: { // 理发 —— 紫罗兰，镜墙成排
    wall: 0xd6c1f0, accent: 0xd42b85, trim: 0xf2eef7,
    floor: 'tile', floorA: 0xedeaf0, floorB: 0xc7b8db, mood: 'cool',
  },
  bikeshop: { // 自行车铺 —— 葡萄紫，衬金属车架
    wall: 0xe9a8f0, accent: 0xca2137, trim: 0xf6eef7,
    floor: 'stone', floorA: 0xc4b9c6, floorB: 0xaa94ad, mood: 'cool',
  },
  lobby: { // 门厅接待 —— 浅紫，整栋楼的第一张脸
    wall: 0xe6d1f0, accent: 0xd0395c, trim: 0xf4eef7,
    floor: 'polish', floorA: 0xdfd9e2, floorB: 0xc4b1cd, mood: 'warm',
  },

  // ══ 聚 gather · 绿松带 —— 嫩绿 / 草地 / 翠 / 薄荷 / 松石 ══
  playroom: { // 儿童游戏 —— 薄荷草绿，地上全是软垫
    wall: 0xbaf3cd, accent: 0xe44eb2, trim: 0xeef7f1,
    floor: 'rug', floorA: 0x88dda4, floorB: 0x54c9a2, mood: 'soft',
  },
  gallery: { // 小展厅 —— 浅松绿，墙面要让给画
    wall: 0xd1f0ea, accent: 0xcc336b, trim: 0xeef7f5,
    floor: 'polish', floorA: 0xd9e2e1, floorB: 0xb1cdc8, mood: 'cool',
  },
  cinema: { // 放映角 —— 深松石，全场最暗
    wall: 0x9ce8e3, accent: 0xe42591, trim: 0xeef7f6,
    floor: 'rug', floorA: 0x88ddd7, floorB: 0x54aac9, mood: 'neon',
  },
  yoga: { // 瑜伽垫间 —— 薄荷，没有一把椅子
    wall: 0xc7f0dd, accent: 0xd04377, trim: 0xeef7f3,
    floor: 'wood', floorA: 0xc5a163, floorB: 0xa97c42, mood: 'fresh',
  },
  greenhouse: { // 温室 —— 嫩绿，玻璃房里再绿一层
    wall: 0xaff4b8, accent: 0xd02580, trim: 0xeef7ef,
    floor: 'grass', floorA: 0x6cc25b, floorB: 0x3fa242, mood: 'fresh',
  },
  roofgarden: { // 屋顶花园 —— 草地绿，傍晚点灯串
    wall: 0xccf5d5, accent: 0xd94562, trim: 0xeef7f0,
    floor: 'grass', floorA: 0x62c25b, floorB: 0x3fa249, mood: 'fresh',
  },
  roofbbq: { // 屋顶烧烤 —— 松石，火光是暖的对比
    wall: 0xb0e8d5, accent: 0xca212c, trim: 0xeef7f4,
    floor: 'stone', floorA: 0xb9c6c1, floorB: 0x94ada5, mood: 'warm',
  },
  roofdining: { // 屋顶餐廊 —— 翠绿，布篷下的长桌
    wall: 0xb1f6cf, accent: 0xe13373, trim: 0xeef7f2,
    floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'warm',
  },

  // ══ 服 service · 灰蓝低彩带 —— 灰青 / 灰蓝 / 灰紫（全楼最低彩，靠明度取胜） ══
  stairhall: { // 楼梯厅 —— 灰青，穿过去不停留
    wall: 0xcde1ea, accent: 0xcc3e5a, trim: 0xeef4f7,
    floor: 'stone', floorA: 0xb9c2c6, floorB: 0x94a6ad, mood: 'cool',
  },
  laundry: { // 洗衣 —— 灰薄荷，最干净的一间
    wall: 0xd2edee, accent: 0xd24b66, trim: 0xeef6f7,
    floor: 'tile', floorA: 0xeaf0f0, floorB: 0xb8d8db, mood: 'fresh',
  },
  mailroom: { // 信箱间 —— 灰蓝，一整面格口柜
    wall: 0xc6cde7, accent: 0xc7385e, trim: 0xeef0f7,
    floor: 'polish', floorA: 0xd9dbe2, floorB: 0xb1b8cd, mood: 'cool',
  },
  bikepark: { // 车棚 —— 灰靛，通道要显得宽
    wall: 0xcecee8, accent: 0xc1334b, trim: 0xeeeef7,
    floor: 'stone', floorA: 0xb9b9c6, floorB: 0x9494ad, mood: 'cool',
  },
  storageroom: { // 储藏 —— 灰钢蓝，四面全是架子
    wall: 0xbed0e4, accent: 0xb73445, trim: 0xeef2f7,
    floor: 'stone', floorA: 0xb9bfc6, floorB: 0x94a0ad, mood: 'cool',
  },
  waterplant: { // 水房花槽 —— 灰青绿，槽边种香草
    wall: 0xceeee7, accent: 0xcf3050, trim: 0xeef7f5,
    floor: 'tile', floorA: 0xeaf0ef, floorB: 0xb8dbd4, mood: 'fresh',
  },
  duty: { // 值班小间 —— 灰紫蓝，整晚一盏屏光
    wall: 0xc0b6e2, accent: 0xd0435b, trim: 0xf0eef7,
    floor: 'polish', floorA: 0xdbd9e2, floorB: 0xb8b1cd, mood: 'cool',
  },
  skybridge: { // 连廊 —— 灰蓝紫，两侧全是玻璃
    wall: 0xe0d5ec, accent: 0xd05858, trim: 0xf2eef7,
    floor: 'polish', floorA: 0xded9e2, floorB: 0xbeb1cd, mood: 'cool',
  },

};

/**
 * 取不到风格时的安全默认（永不返回 undefined）。
 * 用一间中性的暖白房：饱和度仍守 ≥0.35 的底线，不许退回米灰。
 */
const DEFAULT_STYLE = {
  wall: 0xf5d9bd, accent: 0xe07a3c, trim: 0xfaf1e8,
  floor: 'wood', floorA: 0xc59463, floorB: 0xa96e42, mood: 'warm',
};

/**
 * 12 大类零件配色。每类 ≥5 色（这里给到 8 色），同类零件按种子从里面取，
 * 于是一屋子椅子不会全同色 —— 这是主席说的「风格各异」在零件级的落点。
 * 零件色比墙色浓（明度中段），因为它们是【摆在浅墙前面的东西】，
 * 太浅就会糊进墙里看不见形状。
 */
export const CAT_PALETTE = {
  // 座具：沙发 / 单椅 / 高凳的布面色 —— 珊瑚、芥黄、薄荷、天蓝、薰衣草、砖红、松石、玫瑰
  seat:    [0xef6f5a, 0xe8b53c, 0x6fc99a, 0x5aa9e6, 0x9b8bd6, 0xc75f43, 0x3fb0a8, 0xe98aa6],
  // 桌案：木本色为主，掺两只彩色桌面（餐桌 / 儿童桌）
  table:   [0xc08a4e, 0x9c6b3a, 0xd8a86a, 0x7a5335, 0xe07a4f, 0x4fa3c7, 0xb8894f, 0x8fae5c],
  // 睡眠：床架与被面 —— 奶油、藕粉、雾蓝、薄荷、杏、丁香、麦、灰绿
  bed:     [0xf0dcc0, 0xe8a9b8, 0x8fb8dd, 0x86ccb0, 0xefb989, 0xc0a8de, 0xdcc48e, 0x9dbfa4],
  // 收纳：柜体漆色 —— 参考图里的柜子是彩色的，不是原木一片
  storage: [0x5f9ed4, 0xe0864a, 0x62b98a, 0xd05f6e, 0xb08ad6, 0xe3bb45, 0x4aa9a2, 0xc9744f],
  // 厨作：设备与台面 —— 奶油白、薄荷绿冰箱、番茄红、钢蓝、麦黄、青瓷、砖橙、灰绿
  cook:    [0xefe4cf, 0x74c7a4, 0xdc5744, 0x6f9ec2, 0xe0bb63, 0x86c6c0, 0xd47a44, 0x9fb391],
  // 餐吧：吧台 / 咖啡机 / 陈列柜 —— 铜、酒红、深青、焦糖、奶油、橄榄、洋红、木
  bar:     [0xc9873f, 0xa8443f, 0x37837f, 0xd28b4c, 0xecd9b8, 0x8b9c4e, 0xc45a86, 0x9a6a3e],
  // 灯具：灯罩色（会被点亮，所以偏亮偏暖）—— 奶黄、橘、乳白、薄荷、粉、天蓝、金、紫
  light:   [0xf6d98a, 0xf0a05c, 0xf7efdd, 0x9fdcc2, 0xf2a8bd, 0x8fc6ef, 0xe3b845, 0xb9a2e0],
  // 织物：地毯 / 窗帘 / 抱枕 —— 全场最鲜艳的一类，参考图里地毯就是房间的第二主色
  textile: [0xe8574f, 0xf0a93c, 0x4fbf94, 0x4f97dd, 0xa878da, 0xea7fa8, 0x2fa9a4, 0xd8c24a],
  // 绿植：叶色深浅八档（同一屋里的植物必须深浅不一才像真的）
  plant:   [0x4f9e4a, 0x6bbd5a, 0x3d7f45, 0x86c96f, 0x2f6b3c, 0x9ed17e, 0x57a67d, 0x7fb04a],
  // 媒介：电视 / 唱机 / 画框 / 招牌 —— 深色机身 + 彩色画面，衬浅墙最出形
  media:   [0x3a3f47, 0x8a5a3c, 0x2f4a63, 0xd4564f, 0x4a7a5c, 0xc79a3f, 0x5c4a72, 0x6f767d],
  // 建筑：窗框 / 门 / 栏杆 / 柱 —— 白框 + 彩色门（参考图里门都是有颜色的）
  arch:    [0xf4efe6, 0x5f96c4, 0xd9764c, 0x74ab84, 0xc8546a, 0xe0bd68, 0x8a7fbb, 0xb08b62],
  // 人物：衣服色 —— 必须最跳，人是画面里最该被一眼找到的东西
  person:  [0xe8503f, 0x2f7fc4, 0xf2b32e, 0x3fa86c, 0xd44f8e, 0x7a4fc4, 0xe07a2f, 0x2fa8a0],
};

/** 木色档（浅橡 → 胡桃 → 深栗），桌腿 / 床架 / 层板用 */
export const WOOD = [0xd9a86e, 0xc08a4e, 0xa06f3c, 0x7f5530, 0x5f3f24];

/** 金属档（哑白 → 铝 → 铁灰 → 黄铜 → 铜），把手 / 支架 / 管件用 */
export const METAL = [0xdfe3e6, 0xb6bcc2, 0x8d949b, 0x5f666d, 0xc9a24a, 0xb07a45];

/**
 * 取某功能的房间风格；未知 id 一律给安全默认，绝不返回 undefined。
 * @param {string} fnId engine/functions.mjs 里的功能 id
 */
export function styleOf(fnId) {
  return ROOM_STYLES[fnId] || DEFAULT_STYLE;
}

// ── 以下是 propColors 的内部工具（不导出） ──────────────────────────────

/** 取 0xRRGGBB 的色相（0~360）。用来判断两色够不够拉得开。 */
function hueOf(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = ((b - r) / d + 2);
  else h = ((r - g) / d + 4);
  return h * 60;
}

/** 两个色相的圆环距离（0~180）。≥60 才算「对比够」。 */
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 把字符串揉成一个稳定小整数：让【不同 id 的零件】天然错开取色，不全靠随机。 */
function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 点缀色备选池：跨色相的浓色，用来给主色配一个拉得开的伴色 */
const ACCENT_POOL = [
  0xe8503f, 0xf0a93c, 0xe3d24a, 0x5fb84f, 0x2fa8a0,
  0x3f8fd4, 0x7a5fc4, 0xd44f8e, 0xef7a3c, 0x38857a,
];

/**
 * 给一个零件配一套颜色。
 * 取色规则 =【id 哈希】+【rand() 抖动】：
 *   哈希保证同一大类里不同 id 的零件天然分开（一屋子椅子不会全同色），
 *   rand() 保证同一个 id 在不同房间里也能换个颜色（可复算，不用 Math.random）。
 * accent 从备选池里挑第一个与主色【色相差 ≥60°】的，保证点缀真的看得出来。
 * @param {object} kit  {id, cn, cat, w, d, h, tags}
 * @param {function} rand 可复算随机源（0~1）
 * @returns {{color:number, accent:number, wood:number, metal:number}}
 */
export function propColors(kit, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const cat = (kit && kit.cat) || 'seat';
  const list = CAT_PALETTE[cat] || CAT_PALETTE.seat;

  // 主色：id 哈希打底 + 随机抖动，两者相加再取模
  const jitter = Math.floor(r() * list.length);
  const color = list[(hashId((kit && kit.id) || cat) + jitter) % list.length];

  // 点缀色：从备选池里找第一个跟主色拉得开的（色相差 ≥60°）
  const ch = hueOf(color);
  const start = Math.floor(r() * ACCENT_POOL.length);
  let accent = ACCENT_POOL[(start + 3) % ACCENT_POOL.length];
  for (let i = 0; i < ACCENT_POOL.length; i++) {
    const cand = ACCENT_POOL[(start + i) % ACCENT_POOL.length];
    if (hueGap(ch, hueOf(cand)) >= 60) { accent = cand; break; }
  }

  return {
    color,
    accent,
    wood:  WOOD[(hashId((kit && kit.id) || cat) + Math.floor(r() * WOOD.length)) % WOOD.length],
    metal: METAL[Math.floor(r() * METAL.length) % METAL.length],
  };
}
