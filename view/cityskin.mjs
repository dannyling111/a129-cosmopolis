// ═══════════════════════════════════════════════════════════════════════════
// CosmoPolis · view/cityskin.mjs —— 【画风融合层】
//
// 主席原话:「其实画风我更倾向于这个项目的画风,所以你看你的这个项目跟这个项目
//            有没有进一步再融合的可能性」——指 dannyling111.github.io/a129-cosmopolis
//            首页那个【剖楼玩偶屋】(另一个窗口做的 React 版)。
//
// 我把那一版的产物真读了一遍(assets/index-BLth0fHk.js),它好看在哪、我差在哪,
// 逐条对出来的结论(不是感觉,是从它的代码里抄下来的参数):
//
//   ① 它整栋楼是【一栋被切开的楼】:楼板 slab + 竖向柱 pier + 外侧檐 + 顶檐,
//      把并排的房间绑成一栋建筑。我原来是 15 个独立盒子并排 —— 像货架不像楼。
//   ② 它【一栋楼只有一种城市风格】(paris / nyc / med / tropical),
//      每间房的墙色都落在同一族里,只让【强调色】各不相同。
//      我原来 48 间房各自一个糖果色 —— 单看每间都甜,一整栋看过去是彩虹,不是家。
//      ✅ 融合做法:大面积的【墙】把整个 360° 色环【压进城市色相的 ±36° 窄带】(强度 0.80),
//                  小面积的【强调】几乎不动(强度 0.15) ——
//                  这样既统一又不丢主席上一轮要的「风格各异」。
//   ③ 它有【白天 / 黄昏 / 夜晚】三态,夜里屋内点暖灯。治愈感有一大半来自这个。
//   ④ 它有【远景塔楼 + 云 + 日月 + 雾同色于天空】,所以有纵深,不是悬空的模型。
//   ⑤ 它相机 fov 34(长焦压缩透视 = 更像插画)、ACESFilmic 色调映射、曝光 1.08。
//      我原来 fov 45 + 无色调映射 —— 同样的颜色,出来就是"三维软件截图"味。
//
// 本文件只出【数据与配方】,不 import three、不碰 DOM(和 palette.mjs 同一层)。
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 城市皮肤:一栋楼选一个,决定外壳颜色、天空、地面、远景剪影,以及房间配色往哪族收。
 * hue/sat/light 是【墙色收敛目标】(HSL,hue 单位度)。
 */
export const CITY_SKINS = {
  paris: {
    id: 'paris', name: '巴黎', sub: '奥斯曼米石 · 锌灰屋顶',
    facade: 0xe8dcc8, facadeTrim: 0xd5c09a, roof: 0x6b7380, base: 0xcbb9a0,
    ground: 0xbfae95, sidewalk: 0xd8cbb4, water: null,
    skyDay: 0xbfd9ee, skyDusk: 0xf0b898, skyNight: 0x1b2440,
    fogDay: 0xd7e6f2, fogDusk: 0xe8b898, fogNight: 0x1b2440,
    towerColors: [0xe8dcc8, 0xddd2bc, 0xcbbba0, 0xd6c8ae], towerH: [4, 11],
    hue: 34, sat: 0.34, light: 0.82,        // 米石暖白(黄橙)
  },
  nyc: {
    id: 'nyc', name: '纽约', sub: '红砖 · 钢窗 · 消防梯',
    facade: 0xb8674c, facadeTrim: 0x8a5340, roof: 0x4e5359, base: 0x8f6b58,
    ground: 0x8f9298, sidewalk: 0xb9bcc0, water: null,
    skyDay: 0xa8c6e2, skyDusk: 0xe89a72, skyNight: 0x141a2c,
    fogDay: 0xcfdfee, fogDusk: 0xe0a480, fogNight: 0x141a2c,
    towerColors: [0xc4c8ce, 0x9aa3ae, 0xd8d2c8, 0x8a9098], towerH: [6, 22],
    hue: 8,  sat: 0.44, light: 0.74,        // 砖红(偏红,和巴黎的黄橙差 26°)
  },
  med: {
    id: 'med', name: '地中海', sub: '灰泥白墙 · 陶瓦',
    facade: 0xf6f3ec, facadeTrim: 0xe4dbc9, roof: 0xc45c4a, base: 0xe8e0d0,
    ground: 0xd8c9a8, sidewalk: 0xefe8d8, water: 0x3fa8c4,
    skyDay: 0x8fd0ee, skyDusk: 0xf7c08a, skyNight: 0x16264a,
    fogDay: 0xcfeaf6, fogDusk: 0xf2bb8e, fogNight: 0x16264a,
    towerColors: [0xf6f3ec, 0xefe8dc, 0xf4efe6, 0xeadfc9], towerH: [3, 8],
    hue: 190, sat: 0.26, light: 0.89,       // 爱琴海白蓝(地中海本来就是白墙配蓝,不是米黄)
  },
  tropic: {
    id: 'tropic', name: '热带', sub: '薄荷绿 · 芒果黄 · 海风',
    facade: 0xf2e7c8, facadeTrim: 0x5fbfa8, roof: 0x2a9d8f, base: 0xe4d6ae,
    ground: 0x86b86a, sidewalk: 0xe4dcc0, water: 0x38b6c8,
    skyDay: 0x7fd4ee, skyDusk: 0xffb27a, skyNight: 0x0e2a3c,
    fogDay: 0xc4ecf6, fogDusk: 0xffc194, fogNight: 0x0e2a3c,
    towerColors: [0xd8e2ea, 0xc5d4e0, 0xeef2f5, 0xb7c6d4], towerH: [4, 14],
    hue: 158, sat: 0.40, light: 0.83,       // 薄荷
  },
  tokyo: {
    id: 'tokyo', name: '东京', sub: '素水泥 · 招牌霓虹',
    facade: 0xdfe0dc, facadeTrim: 0xb0b4b0, roof: 0x59606a, base: 0xc9cbc6,
    ground: 0x9a9d9c, sidewalk: 0xc8cac6, water: null,
    skyDay: 0xc4d6e4, skyDusk: 0xe6a0b4, skyNight: 0x111528,
    fogDay: 0xdae7f0, fogDusk: 0xe4a8ba, fogNight: 0x111528,
    towerColors: [0xd2d6da, 0xb4bac0, 0xe2e4e4, 0x9aa0a6], towerH: [6, 24],
    hue: 224, sat: 0.22, light: 0.85,       // 冷素灰蓝紫
  },
  nordic: {
    id: 'nordic', name: '北欧', sub: '木饰面 · 亚麻 · 长日照',
    facade: 0xefe4d2, facadeTrim: 0xc79a6a, roof: 0x8a6a4c, base: 0xdccdb6,
    ground: 0xa8bb92, sidewalk: 0xe6ddca, water: 0x6aa8c4,
    skyDay: 0xd2e6f2, skyDusk: 0xf4c2a0, skyNight: 0x1a2436,
    fogDay: 0xe2eef6, fogDusk: 0xf2c6a6, fogNight: 0x1a2436,
    towerColors: [0xefe4d2, 0xe2d4be, 0xf4ece0, 0xd6c4a8], towerH: [3, 9],
    hue: 96, sat: 0.22, light: 0.87,        // 浅木配鼠尾草绿(北欧的 greige,不是巴黎的米石)
  },
};
export const SKIN_IDS = Object.keys(CITY_SKINS);

/**
 * 三个时段的光照配方。数值口径抄自那一版(暖主光 + 冷补光 + 强半球光),
 * 我按自己场景更大(整栋 + 街道 + 远景)略微上调了强度。
 */
export const TIMES = {
  day:   { id: 'day',   name: '白天', sky: 'skyDay',   fog: 'fogDay',
           hemiSky: 0xe8f4ff, hemi: 1.05, amb: 0.55,
           keyPos: [16, 26, 14], key: 0xfff3dc, keyI: 1.20,
           fillPos: [-14, 8, -10], fill: 0xb8d4ea, fillI: 0.28,
           lamps: 0, fogNear: 46, fogFar: 168, exposure: 1.08 },
  dusk:  { id: 'dusk',  name: '黄昏', sky: 'skyDusk',  fog: 'fogDusk',
           hemiSky: 0xf0c8a0, hemi: 0.78, amb: 0.46,
           keyPos: [22, 12, 8], key: 0xf4c48a, keyI: 0.80,
           fillPos: [-14, 8, -10], fill: 0x9ab4d8, fillI: 0.26,
           lamps: 0.85, fogNear: 40, fogFar: 150, exposure: 1.10 },
  night: { id: 'night', name: '夜晚', sky: 'skyNight', fog: 'fogNight',
           hemiSky: 0x7a8cb0, hemi: 0.26, amb: 0.16,
           keyPos: [-10, 20, 6], key: 0xb8c8ee, keyI: 0.24,
           fillPos: [-14, 8, -10], fill: 0x6a88c8, fillI: 0.08,
           lamps: 1.0, fogNear: 30, fogFar: 96, exposure: 1.12 },
};
export const TIME_IDS = Object.keys(TIMES);

// ── HSL 互转(只在本文件用,不外泄) ────────────────────────────────
export function hexToHsl(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l };
}
export function hslToHex({ h, s, l }) {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return t.map(v => Math.round((v + m) * 255)).reduce((a, v) => (a << 8) | v, 0);
}
/** 沿色环最短路插值(不这么做,从 350° 到 10° 会绕一整圈变成灰) */
function mixHue(a, b, k) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * k;
}
/** 把一个颜色往城市色族拉 k 成(k=0 原样,k=1 完全变成城市色) */
export function tint(hex, skin, k, { keepSat = 0.5 } = {}) {
  if (k <= 0) return hex;
  const c = hexToHsl(hex);
  return hslToHex({
    h: mixHue(c.h, skin.hue, k),
    s: c.s * (1 - k * keepSat) + skin.sat * (k * keepSat),
    l: c.l * (1 - k) + skin.light * k,
  });
}

/** 墙拉得狠、强调几乎不动 —— 融合的核心一行。
 * 0.80 不是拍的:它等价于把 360° 色环压成 ±36° 的【同类色带】(360×0.20÷2),
 * 而 ±30~40° 正是配色学里同类色/邻近色的宽度 —— 再宽就散,再窄就一片死板。 */
export const WALL_PULL = 0.80;
export const ACCENT_PULL = 0.15;
export const TRIM_PULL = 0.86;
export const FLOOR_DARKER = 0.14;  // 地板至少比墙暗这么多(亮度,0-1)
export const FLOOR_PULL = 0.20;   // 🔴 地面只轻拉:第一版拉 0.45,整栋变成一片奶油色,
                                  //    墙和地分不开(实测截图上像"融化了")。地板是全屋唯一的深色面,
                                  //    它必须留住自己的木/砖本色,房间才有上浅下深的重量。

/**
 * 把一间房的风格按城市皮肤重新调和。
 * 输入 = palette.mjs 的 ROOM_STYLES 条目;输出 = 同结构,颜色已收敛。
 * 引擎完全不知道这一层存在 —— 换皮肤不动任何布局数据。
 */
export function harmonize(style, skinId) {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const wall = tint(style.wall, skin, WALL_PULL);
  const Lw = hexToHsl(wall).l;
  // 🔴 地板【一定】比墙暗一档,不许靠"原始配色刚好够暗"碰运气。
  //    实测:不压这一手时有 15~26/48 间房的墙地亮度差 <0.08,人眼读成一片糊
  //    (skin_check D 条当场判红)。房间的重量感全靠"上浅下深"这一档。
  const sink = hex => {
    const c = hexToHsl(tint(hex, skin, FLOOR_PULL));
    return hslToHex({ ...c, l: Math.max(0.18, Math.min(c.l, Lw - FLOOR_DARKER)) });
  };
  return {
    ...style,
    wall,
    accent: tint(style.accent, skin, ACCENT_PULL, { keepSat: 0.15 }),
    trim:   tint(style.trim,   skin, TRIM_PULL),
    floorA: sink(style.floorA),
    floorB: sink(style.floorB),
    skin,
  };
}

/**
 * 远景塔楼剪影(22 座)。同一个 landmark 每次结果一样 —— 换种子不该让远景乱跳。
 * 这套"确定性伪随机 + 按皮肤给高度带"的做法,是从那一版抄来的,我按自己场景放大了范围。
 */
export function skylineTowers(skinId) {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const r = i => { const t = Math.sin(i * 127.1) * 43758.5453; return t - Math.floor(t); };
  const [h0, h1] = skin.towerH, out = [];
  for (let i = 0; i < 22; i++) {
    out.push({
      x: -78 + r(i + 1) * 156,
      z: -54 - r(i + 3) * 46,
      h: h0 + r(i + 7) * (h1 - h0),
      w: 3.4 + r(i + 9) * 5.6,
      d: 3.4 + r(i + 11) * 5.0,
      c: skin.towerColors[i % skin.towerColors.length],
    });
  }
  return out;
}
