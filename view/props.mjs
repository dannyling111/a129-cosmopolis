// ============================================================================
// CosmoPolis 渲染层 · view/props.mjs —— 家具零件的「多部件造型」
//
// 这个文件回答一个问题：**怎么让人一眼看出这是三人沙发、那是贵妃榻。**
// 在这之前每件家具都是一个纯色方块，于是 181 件家具长得一模一样。
//
// 三条造型判断（决定了下面所有代码的写法）：
//   ① 认出一件家具靠的是【轮廓剪影】，不是纹理。所以每件东西先把
//      「它有几坨、各坨多大、谁高谁低」摆对：沙发 = 一条矮长横躺的量体
//      + 一片竖起来的靠背 + 两个墩子扶手；贵妃榻 = 同样长，但靠背只有
//      左半边、右半边整个空出来。剪影一分开，颜色再像也不会认错。
//   ② 家具的「身份特征」集中在少数几个小零件上：桌子的四条腿、书架的
//      层板与彩色书脊、柜子的把手、冰箱的门缝、灶台的四个灶眼、电视的
//      黑屏、盆栽的分叉枝叶、吊灯的灯绳。这些小件比大体块贵重得多，
//      所以宁可少几个大面、也要把它们做出来。
//   ③ 尺寸必须【填满】引擎给的 w×d×h 外框。房间是按这个框排的位，
//      造小了会飘、造大了会穿模。所有 builder 的几何都从 kit 的尺寸算，
//      不写死绝对数字（只有把手粗细这类"物理上就那么大"的量才写死）。
//
// 坐标契约（VIEW-CONTRACT.md §坐标与朝向，违反就穿模）：
//   · Group 原点 = 占地矩形中心的【地面】，y=0 就是地板，家具向上长。
//   · +Z 是这件家具的【正面】（沙发坐面朝 +Z、柜门朝 +Z）。旋转由外面处理。
//   · 宽沿 X = kit.w，进深沿 Z = kit.d，高沿 Y = kit.h。
//
// 颜色契约：只用外面传进来的 o.color / o.accent / o.wood / o.metal。
//   本文件不定义配色（那是 palette.mjs 的活），只用 tint() 从这四个色
//   派生明暗档来分出层次（座箱比坐垫深一点，否则一坨颜色看不出结构）。
//   唯一写死的是【物理上就该是那个颜色】的小面：黑屏、玻璃、灯泡暖光、
//   火焰、白瓷/纸张。这些若跟着房间主色走反而会失真。
//
// 性能契约：材质与几何全部缓存复用（一栋楼几千个 mesh，不缓存手机直接卡死）。
// ============================================================================

import * as THREE from '../vendor/three.module.js';

// ---------------------------------------------------------------------------
// 0. 缓存与基础工具
// ---------------------------------------------------------------------------

/** 物理固定色：这些东西不跟房间配色走，跟了反而假 */
const GLASS  = 0xcfe6f2;   // 玻璃（配 transparent）
const SCREEN = 0x14161c;   // 电视/显示器的黑屏
const BULB   = 0xfff2c8;   // 灯泡暖光
const FLAME  = 0xffb43c;   // 烛火
const PAPER  = 0xf6f1e4;   // 纸张/书页/白瓷
const SOIL   = 0x4a3626;   // 盆土
const DARK   = 0x2a2b30;   // 橡胶/密封条/黑铁件

const _mats = new Map();
/**
 * 材质缓存：同色同参数只建一次。
 * @param {number} hex 颜色
 * @param {object} [opts] 额外材质参数（transparent/opacity/emissive/side…）
 */
export function mat(hex, opts) {
  const key = hex + (opts ? '|' + JSON.stringify(opts) : '');
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial(Object.assign({ color: hex }, opts || {}));
    _mats.set(key, m);
  }
  return m;
}

const _geos = new Map();
const q = (v) => Math.round(Math.max(v, 0.004) * 1000) / 1000;   // 量化，提高缓存命中

function gBox(w, h, d) {
  w = q(w); h = q(h); d = q(d);
  const k = 'B' + w + ',' + h + ',' + d;
  let g = _geos.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _geos.set(k, g); }
  return g;
}
function gCyl(rt, rb, h, seg) {
  rt = q(rt); rb = q(rb); h = q(h); seg = seg || 12;
  const k = 'C' + rt + ',' + rb + ',' + h + ',' + seg;
  let g = _geos.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); _geos.set(k, g); }
  return g;
}
function gSph(r, seg) {
  r = q(r); seg = seg || 10;
  const k = 'S' + r + ',' + seg;
  let g = _geos.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)); _geos.set(k, g); }
  return g;
}
function gPlane(w, h) {
  w = q(w); h = q(h);
  const k = 'P' + w + ',' + h;
  let g = _geos.get(k);
  if (!g) { g = new THREE.PlaneGeometry(w, h); _geos.set(k, g); }
  return g;
}

/** 加一个盒子。y 传的是【盒子中心】的高度。rot=[rx,ry,rz] */
function bx(g, w, h, d, c, x, y, z, rot, op) {
  const m = new THREE.Mesh(gBox(w, h, d), mat(c, op));
  m.position.set(x || 0, y || 0, z || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m); return m;
}
/** 加一个圆柱（默认轴沿 Y）。rt=顶半径 rb=底半径 */
function cy(g, rt, rb, h, c, x, y, z, rot, seg, op) {
  const m = new THREE.Mesh(gCyl(rt, rb, h, seg), mat(c, op));
  m.position.set(x || 0, y || 0, z || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m); return m;
}
/** 加一个球。scl=[sx,sy,sz] 用来压扁成叶片/坐垫 */
function sp(g, r, c, x, y, z, scl, op) {
  const m = new THREE.Mesh(gSph(r, 10), mat(c, op));
  m.position.set(x || 0, y || 0, z || 0);
  if (scl) m.scale.set(scl[0], scl[1], scl[2]);
  g.add(m); return m;
}
/** 加一个平面（双面）。默认朝 +Z */
function pl(g, w, h, c, x, y, z, rot, op) {
  const m = new THREE.Mesh(gPlane(w, h), mat(c, Object.assign({ side: THREE.DoubleSide }, op || {})));
  m.position.set(x || 0, y || 0, z || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m); return m;
}

/** 明暗派生：f>0 提亮、f<0 压暗。只从传进来的四个色派生，不引入新色相 */
function tint(hex, f) {
  let r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** 规整入参：调用方可以只传一半，缺的给安全默认，rand 必须可复算 */
function norm(o) {
  o = o || {};
  let s = 1234567;
  const fallback = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return {
    color: (o.color === undefined ? 0xd08a5c : o.color),
    accent: (o.accent === undefined ? 0x4f9bb8 : o.accent),
    wood: (o.wood === undefined ? 0xa9793f : o.wood),
    metal: (o.metal === undefined ? 0x9aa2ad : o.metal),
    rand: (typeof o.rand === 'function' ? o.rand : fallback),
  };
}

// ---------------------------------------------------------------------------
// 1. 共用小零件（这些就是"细节"本身，被到处复用）
// ---------------------------------------------------------------------------

/** 四条腿：桌案/椅子/柜子通用。inset=腿距边缘的内收量，taper=下细上粗 */
function legs4(g, w, d, top, r, c, inset, taper) {
  inset = inset === undefined ? r + 0.03 : inset;
  const x = Math.max(0.02, w / 2 - inset), z = Math.max(0.02, d / 2 - inset);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cy(g, r, taper ? r * 0.62 : r, top, c, sx * x, top / 2, sz * z, null, 8);
  }
}

/** 长条把手：柜门/抽屉/冰箱的身份特征，没有它柜子就是个盒子 */
function handleBar(g, len, c, x, y, z, vertical) {
  const t = 0.022;
  // 把手主体
  bx(g, vertical ? t : len, vertical ? len : t, t, c, x, y, z);
  // 两个支脚（把把手垫离门板，侧面看才有厚度）
  const half = len / 2 - t;
  for (const s of [-1, 1]) {
    if (vertical) bx(g, t, t, 0.03, c, x, y + s * half, z - 0.022);
    else bx(g, t, t, 0.03, c, x + s * half, y, z - 0.022);
  }
}

/** 圆把手/旋钮 */
function knob(g, r, c, x, y, z) {
  cy(g, r, r * 0.8, 0.03, c, x, y, z, [Math.PI / 2, 0, 0], 8);
}

/**
 * 一排彩色书脊。书架的身份特征——没有它，书架就是一堆横板。
 * 用 5 个颜色档（全部从传进来的四色派生），高矮宽窄随机，读起来才像书。
 */
function books(g, x0, x1, yBottom, z, maxH, o, R, thin) {
  const pal = [o.color, o.accent, tint(o.color, 0.32), tint(o.accent, -0.22), tint(o.wood, 0.25)];
  let x = x0;
  let guard = 0;
  while (x < x1 - 0.03 && guard++ < 40) {
    const bw = (thin ? 0.022 : 0.03) + R() * (thin ? 0.02 : 0.035);
    if (x + bw > x1) break;
    const bh = maxH * (0.68 + R() * 0.3);
    const c = pal[Math.floor(R() * pal.length) % pal.length];
    bx(g, bw * 0.88, bh, Math.max(0.05, 0.14), c, x + bw / 2, yBottom + bh / 2, z);
    x += bw;
  }
}

/** 坐垫/靠垫：压扁的球比盒子软，一眼看出是布的不是木的 */
function cushion(g, w, h, d, c, x, y, z, rot) {
  const m = sp(g, 0.5, c, x, y, z, [w, h, d], null);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  return m;
}

/**
 * 分叉的枝叶：一根主干 + n 根斜着长出去的枝 + 枝头压扁的叶球。
 * 这是"盆栽有花盆 + 分叉叶子"里的分叉部分——单一个绿球会像西兰花，
 * 有斜枝才像一棵活的植物。
 */
function foliage(g, opt) {
  const { x = 0, z = 0, base, top, trunkR, trunkC, leafC, leafR, n, R, reach, flowerC } = opt;
  // 主干（上细下粗）
  cy(g, trunkR * 0.66, trunkR, top - base, trunkC, x, (base + top) / 2, z, null, 8);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + R() * 0.6;
    const tilt = 0.5 + R() * 0.55;                 // 枝的外张角
    const len = reach * (0.72 + R() * 0.32);
    const br = new THREE.Group();
    br.position.set(x, top - (i % 3) * (top - base) * 0.2, z);
    br.rotation.y = az; br.rotation.z = tilt;      // 先在 XY 面里斜出去，再绕 Y 转方位
    g.add(br);
    cy(br, trunkR * 0.4, trunkR * 0.6, len, trunkC, 0, len / 2, 0, null, 6);
    // 枝头 1-2 片压扁的叶
    sp(br, leafR, leafC, 0, len, 0, [1, 0.42, 0.85]);
    if (R() > 0.45) sp(br, leafR * 0.7, tint(leafC, 0.18), leafR * 0.5, len * 0.72, 0, [1, 0.42, 0.85]);
    if (flowerC && R() > 0.6) sp(br, leafR * 0.34, flowerC, 0, len + leafR * 0.4, 0);
  }
}

/** 花盆：上宽下窄的锥台 + 盆沿 + 一层土。没有盆的植物会像插在地上 */
function pot(g, rTop, rBot, h, c, x, z, soilC) {
  cy(g, rTop, rBot, h, c, x, h / 2, z, null, 12);
  cy(g, rTop * 1.06, rTop * 1.02, h * 0.13, tint(c, -0.16), x, h * 0.94, z, null, 12);
  cy(g, rTop * 0.9, rTop * 0.9, 0.03, soilC || SOIL, x, h * 0.99, z, null, 10);
}

/**
 * 贴墙的画/镜/牌：四条边框 + 一个面。
 * 全部对称落在 z=0 两侧——这类零件进深只有 0.06m，稍微偏一点就判"不居中"。
 */
function wallPanel(g, w, h, d, frameC, faceC, faceOpts, yc) {
  const t = Math.min(0.05, w * 0.06, h * 0.06);   // 边框宽度
  const fd = Math.min(d * 0.8, 0.05);             // 边框进深
  yc = yc === undefined ? h / 2 : yc;
  bx(g, w, t, fd, frameC, 0, yc + h / 2 - t / 2, 0);          // 上框
  bx(g, w, t, fd, frameC, 0, yc - h / 2 + t / 2, 0);          // 下框
  bx(g, t, h - t * 2, fd, frameC, -w / 2 + t / 2, yc, 0);     // 左框
  bx(g, t, h - t * 2, fd, frameC, w / 2 - t / 2, yc, 0);      // 右框
  bx(g, w - t * 2, h - t * 2, fd * 0.45, faceC, 0, yc, fd * 0.22, null, faceOpts);  // 画面
  return { t, fd, yc };
}

/** 玻璃面（带透明度）的统一入口，免得每处各写各的 */
function glassBox(g, w, h, d, x, y, z) {
  return bx(g, w, h, d, GLASS, x, y, z, null, { transparent: true, opacity: 0.28 });
}

// ---------------------------------------------------------------------------
// 2. 十一大类通用 builder
//    没有专门造型的零件走这里。它们不是"兜底方块"——每个都按该大类的
//    共同剪影搭出 4-10 个部件，并按 kit 的尺寸/tags 自适应（有没有靠背、
//    是柜是箱、是地毯还是窗帘，都由尺寸和标签判出来）。
// ---------------------------------------------------------------------------

/** 座具通用：腿 + 座面 + 坐垫 + 靠背 + 两扶手。高度 ≤0.55 判成凳/长凳（无背） */
function genSeat(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, tags = kit.tags || [];
  const soft = tags.includes('soft') || tags.includes('casual');
  const hasBack = h > 0.55;
  const seatTop = hasBack ? Math.min(0.46, h * 0.56) : h;
  const legR = Math.min(0.035, w * 0.07, d * 0.07);
  const legTop = Math.max(0.12, seatTop - 0.1);
  const woodC = tags.includes('rattan') ? tint(o.wood, 0.2) : o.wood;
  // 四条腿（下细上粗，木家具的腿都是这样）
  legs4(g, w, d, legTop, legR, tags.includes('caster') ? o.metal : woodC, legR + 0.035, true);
  // 座面板（撑满占地，家具的外框就是它）
  bx(g, w, 0.085, d, soft ? tint(o.color, -0.16) : woodC, 0, legTop + 0.0425, 0);
  // 坐垫
  cushion(g, w * 0.94, 0.11, d * 0.9, o.color, 0, seatTop + 0.015, 0);
  if (hasBack) {
    const bt = Math.min(0.1, d * 0.2);
    if (soft) {
      bx(g, w, h - seatTop, bt, tint(o.color, -0.1), 0, (h + seatTop) / 2, -d / 2 + bt / 2);
      cushion(g, w * 0.9, (h - seatTop) * 0.8, 0.14, tint(o.color, 0.12), 0, (h + seatTop) / 2, -d / 2 + bt + 0.05);
    } else {
      // 木椅：两根后腿柱 + 2 根横档，比一整块板更像椅子
      for (const s of [-1, 1]) bx(g, legR * 2, h - legTop, legR * 2, woodC, s * (w / 2 - legR - 0.03), (h + legTop) / 2, -d / 2 + legR + 0.02);
      for (let i = 0; i < 2; i++) bx(g, w - legR * 4 - 0.06, 0.07, 0.03, tint(woodC, 0.1), 0, seatTop + 0.14 + i * (h - seatTop - 0.24), -d / 2 + legR + 0.02);
    }
  }
  // 扶手（宽到一定程度才有，长凳/餐椅没有）
  if (w > 0.62 && hasBack && !tags.includes('bench')) {
    const aw = Math.min(0.15, w * 0.1), aTop = seatTop + (h - seatTop) * 0.52;
    for (const s of [-1, 1]) bx(g, aw, aTop - legTop, d * 0.86, soft ? tint(o.color, -0.05) : woodC, s * (w / 2 - aw / 2), (aTop + legTop) / 2, 0.02);
  }
  return g;
}

/** 桌案通用：桌面 + 四条腿 + 望板（腿间横撑）+ 下层板。四条腿是硬要求 */
function genTable(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, tags = kit.tags || [];
  const topT = Math.min(0.055, h * 0.14);
  const legR = Math.min(0.04, w * 0.05, d * 0.07);
  const legTop = h - topT;
  const woodC = tags.includes('work') ? tint(o.wood, -0.12) : o.wood;
  legs4(g, w, d, legTop, legR, woodC, legR + 0.045, false);
  // 望板：两条长边各一根，桌子有没有"厚度感"全靠它
  const apZ = d / 2 - legR - 0.05;
  for (const s of [-1, 1]) bx(g, w - legR * 4 - 0.1, 0.07, 0.028, tint(woodC, -0.08), 0, legTop - 0.06, s * apZ);
  // 桌面（撑满占地）
  bx(g, w, topT, d, tint(woodC, 0.12), 0, h - topT / 2, 0);
  // 桌面边条（一圈深色收边，远看才有厚度）
  bx(g, w, topT * 0.34, d * 1.002, tint(woodC, -0.18), 0, h - topT + topT * 0.17, 0);
  // 下层板
  if (h > 0.55 && d > 0.33) bx(g, w - legR * 4 - 0.08, 0.028, d - legR * 4 - 0.06, tint(woodC, -0.05), 0, 0.16, 0);
  return g;
}

/** 睡眠通用：床箱 + 床垫 + 被子 + 两个枕头。被子高度受 1.35×h 限制，不许堆山 */
function genBed(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const baseH = h * 0.5, matH = h * 0.42;
  bx(g, w * 0.96, baseH, d * 0.98, o.wood, 0, baseH / 2, 0);                       // 床箱
  for (const sx of [-1, 1]) for (const sz of [-1, 1])                              // 四个床脚
    cy(g, 0.035, 0.03, baseH * 0.35, tint(o.wood, -0.25), sx * (w / 2 - 0.09), baseH * 0.175, sz * (d / 2 - 0.09), null, 6);
  bx(g, w, matH, d, PAPER, 0, baseH + matH / 2, 0);                                // 床垫
  // 被子（盖住脚那半边，露出床垫上半截 = 一眼看出是床不是台）
  bx(g, w * 0.99, 0.06, d * 0.62, o.color, 0, h + 0.03, d * 0.18);
  bx(g, w * 0.99, 0.05, 0.09, tint(o.color, 0.25), 0, h + 0.045, -d * 0.13);       // 被子翻边
  // 枕头（放 -Z 那头 = 床头）
  const pw = Math.min(w * 0.42, 0.52);
  const n = w > 1.2 ? 2 : 1;
  for (let i = 0; i < n; i++) cushion(g, pw, 0.13, d * 0.16, tint(o.accent, 0.3), n === 1 ? 0 : (i - 0.5) * pw * 1.08, h + 0.06, -d / 2 + d * 0.11);
  return g;
}

/** 收纳通用：柜身 + 踢脚 + 顶板 + 两扇门（中缝）+ 把手。把手是柜子的身份特征 */
function genStorage(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, tags = kit.tags || [];
  const open = tags.includes('stack') || tags.includes('slim');
  const plinth = Math.min(0.08, h * 0.09);
  bx(g, w * 0.94, plinth, d * 0.9, tint(o.wood, -0.3), 0, plinth / 2, 0);              // 踢脚
  bx(g, w, h - plinth, d, tint(o.color, -0.1), 0, (h + plinth) / 2, -0.004);           // 柜身
  bx(g, w * 1.01, 0.035, d * 1.03, tint(o.wood, 0.1), 0, h - 0.017, 0);                // 顶板压边
  if (open) {
    // 开放格：层板 + 一排书脊
    const n = Math.max(2, Math.floor((h - plinth) / 0.36));
    for (let i = 1; i <= n; i++) {
      const y = plinth + (h - plinth) * i / (n + 1);
      bx(g, w * 0.94, 0.028, d * 0.9, tint(o.wood, 0.16), 0, y, 0);
      books(g, -w * 0.44, w * 0.44, y + 0.014, d * 0.16, Math.min(0.26, (h - plinth) / (n + 1) * 0.72), o, R);
    }
  } else {
    // 两扇门 + 中缝 + 把手
    const dw = (w - 0.03) / 2, dh = h - plinth - 0.06;
    for (const s of [-1, 1]) {
      bx(g, dw - 0.012, dh, 0.026, o.color, s * (dw / 2 + 0.008), plinth + dh / 2, d / 2 - 0.012);
      bx(g, dw - 0.09, dh - 0.1, 0.012, tint(o.color, 0.14), s * (dw / 2 + 0.008), plinth + dh / 2, d / 2 + 0.003);   // 门芯板
      handleBar(g, Math.min(0.2, dh * 0.4), o.metal, s * 0.028, plinth + dh * 0.52, d / 2 + 0.022, true);
    }
  }
  return g;
}

/** 厨作通用：机身 + 台面 + 门 + 把手 + 控制旋钮 + 踢脚 */
function genCook(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = o.metal, plinth = Math.min(0.07, h * 0.1);
  bx(g, w * 0.92, plinth, d * 0.88, DARK, 0, plinth / 2, 0);                            // 踢脚（凹进去）
  bx(g, w, h - plinth - 0.04, d, tint(steel, 0.06), 0, (h - 0.04 + plinth) / 2, 0);     // 机身
  bx(g, w * 1.01, 0.04, d * 1.02, tint(steel, 0.2), 0, h - 0.02, 0);                    // 不锈钢台面
  // 门（带缝）
  const dh = (h - plinth - 0.04) * 0.72;
  bx(g, w * 0.9, dh, 0.02, tint(steel, -0.05), 0, plinth + dh / 2 + 0.02, d / 2 - 0.006);
  handleBar(g, w * 0.62, tint(steel, 0.3), 0, plinth + dh + 0.055, d / 2 + 0.014, false);
  // 控制旋钮
  for (let i = 0; i < 3; i++) knob(g, 0.026, o.accent, (i - 1) * Math.min(0.14, w * 0.2), h - 0.12, d / 2 + 0.012);
  return g;
}

/** 餐吧通用：吧身 + 出挑台面 + 正面竖木条 + 脚踏杆 + 强调色腰线 */
function genBar(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.96, h - 0.05, d * 0.86, tint(o.color, -0.15), 0, (h - 0.05) / 2, -d * 0.04);   // 吧身
  bx(g, w, 0.055, d, tint(o.wood, 0.15), 0, h - 0.028, 0);                                    // 台面（出挑）
  bx(g, w, 0.02, d * 1.004, tint(o.wood, -0.2), 0, h - 0.056, 0);                             // 台面下沿
  const n = Math.max(3, Math.round(w / 0.24));
  for (let i = 0; i < n; i++)                                                                 // 正面竖木条
    bx(g, w / n * 0.6, h * 0.68, 0.022, o.wood, (i + 0.5 - n / 2) * (w / n), h * 0.42, d * 0.42);
  bx(g, w * 0.98, 0.045, 0.026, o.accent, 0, h * 0.8, d * 0.43);                               // 腰线
  cy(g, 0.02, 0.02, w * 0.9, o.metal, 0, h * 0.16, d * 0.46, [0, 0, Math.PI / 2], 8);          // 脚踏杆
  return g;
}

/** 灯具通用：底座 + 灯杆/灯绳 + 灯罩 + 会发光的灯泡。灯绳是吊灯的身份特征 */
function genLight(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, tags = kit.tags || [];
  const ceiling = tags.includes('ceiling') || tags.includes('overhead');
  const rr = Math.min(w, d) / 2;
  if (ceiling) {
    cy(g, 0.012, 0.012, h * 0.5, DARK, 0, h * 0.75, 0, null, 6);                    // 灯绳
    cy(g, 0.05, 0.05, 0.03, o.metal, 0, h - 0.015, 0, null, 8);                     // 天花底盘
    cy(g, rr * 0.35, rr, h * 0.42, o.color, 0, h * 0.28, 0, null, 14);              // 灯罩（倒锥）
    sp(g, rr * 0.42, BULB, 0, h * 0.11, 0, null, { emissive: BULB, emissiveIntensity: 0.6 });
  } else {
    cy(g, rr * 0.9, rr, 0.035, tint(o.metal, -0.15), 0, 0.018, 0, null, 12);        // 底座
    cy(g, 0.018, 0.022, h * 0.72, o.metal, 0, h * 0.38, 0, null, 8);                // 灯杆
    cy(g, rr * 0.7, rr, h * 0.24, o.color, 0, h - h * 0.14, 0, null, 14);           // 灯罩
    sp(g, rr * 0.4, BULB, 0, h - h * 0.2, 0, null, { emissive: BULB, emissiveIntensity: 0.55 });
  }
  return g;
}

/** 织物通用：按高度分三种形态——贴地地毯 / 竖挂帘幕 / 软垫。全部保证 ≥3 件 */
function genTextile(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  if (h <= 0.1) return rugLike(kit, o, R);
  if (h >= 0.9) return drapeLike(kit, o, R);
  // 软垫堆：2-3 块叠着
  const n = 3;
  for (let i = 0; i < n; i++)
    cushion(g, w * (0.94 - i * 0.1), h / n * 0.9, d * (0.94 - i * 0.08),
      i % 2 ? tint(o.accent, 0.12) : o.color, (R() - 0.5) * w * 0.06, h / n * (i + 0.5), (R() - 0.5) * d * 0.06);
  return g;
}

/** 地毯家族：一块贴地薄板（≤0.03 高）+ 一圈边框 + 面上的图案 */
function rugLike(kit, o, R) {
  const g = new THREE.Group(), { w, d } = kit, T = 0.02;
  bx(g, w, T, d, o.color, 0, T / 2, 0);                                   // 毯身
  bx(g, w * 0.86, 0.004, d * 0.82, tint(o.accent, 0.1), 0, T + 0.002, 0); // 内框
  bx(g, w * 0.72, 0.004, d * 0.66, tint(o.color, 0.28), 0, T + 0.005, 0); // 内芯
  for (let i = 0; i < 3; i++)                                             // 图案条
    bx(g, w * 0.5, 0.004, d * 0.06, o.accent, 0, T + 0.008, (i - 1) * d * 0.18);
  return g;
}

/** 帘幕家族：帘杆 + 两片带褶的帘 + 挂环。褶用几片错开 z 的竖板做出来 */
function drapeLike(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const sheer = (kit.id || '').indexOf('sheer') >= 0;
  const op = sheer ? { transparent: true, opacity: 0.42 } : null;
  cy(g, 0.016, 0.016, w * 0.99, o.metal, 0, h - 0.03, 0, [0, 0, Math.PI / 2], 8);   // 帘杆
  for (const s of [-1, 1]) {
    const pw = w * 0.46;
    for (let i = 0; i < 3; i++)                                                      // 褶
      bx(g, pw / 3 * 0.96, h - 0.08, Math.min(0.03, d * 0.3), i % 2 ? tint(o.color, 0.1) : o.color,
        s * (w * 0.26) + (i - 1) * (pw / 3), (h - 0.08) / 2, (i % 2 ? 1 : -1) * Math.min(0.018, d * 0.18), null, op);
    cy(g, 0.022, 0.022, 0.02, o.metal, s * w * 0.26, h - 0.03, 0, null, 6);          // 挂环
  }
  return g;
}

/** 绿植通用：花盆 + 盆土 + 主干 + 分叉的枝叶 */
function genPlant(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const rr = Math.min(w, d) / 2;
  const potH = Math.min(h * 0.3, rr * 1.5);
  pot(g, rr * 0.82, rr * 0.62, potH, o.wood, 0, 0);
  foliage(g, {
    base: potH * 0.8, top: h * 0.72, trunkR: Math.max(0.015, rr * 0.1),
    trunkC: tint(o.wood, -0.3), leafC: o.color, leafR: rr * 0.42,
    n: 5, reach: rr * 0.85, R, flowerC: o.accent,
  });
  return g;
}

/** 媒介通用：薄的当挂墙画框、厚的当机器（机身 + 面板 + 脚） */
function genMedia(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  if (d <= 0.13) {                                        // 挂墙类
    wallPanel(g, w, h, d, tint(o.wood, -0.1), o.accent);
    bx(g, w * 0.4, h * 0.28, 0.008, tint(o.accent, 0.3), 0, h * 0.58, d * 0.3);   // 画面上的一块浅色
    return g;
  }
  bx(g, w, h * 0.9, d, tint(o.metal, 0.05), 0, h * 0.45 + h * 0.06, 0);           // 机身
  bx(g, w * 0.96, h * 0.06, d * 0.9, DARK, 0, h * 0.03, 0);                        // 底座
  bx(g, w * 0.7, h * 0.3, 0.02, SCREEN, 0, h * 0.62, d / 2 + 0.006);               // 面板
  for (let i = 0; i < 3; i++) knob(g, 0.02, o.accent, (i - 1) * w * 0.16, h * 0.28, d / 2 + 0.012);
  return g;
}

/** 建筑构件通用：外框 + 芯板 + 分格条 */
function genArch(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const t = Math.min(0.08, w * 0.08, h * 0.08);
  bx(g, w, h, d * 0.5, tint(o.wood, -0.05), 0, h / 2, 0);                     // 外框整块
  bx(g, w - t * 2, h - t * 2, d * 0.56, o.color, 0, h / 2, 0.002);            // 芯板
  bx(g, w - t * 2, 0.03, d * 0.6, tint(o.wood, 0.15), 0, h * 0.5, 0.004);     // 中横条
  bx(g, 0.03, h - t * 2, d * 0.6, tint(o.wood, 0.15), 0, h / 2, 0.004);       // 中竖条
  return g;
}

// ---------------------------------------------------------------------------
// 3. 座具专门造型
//    沙发族的剪影 = 一条矮长的座箱 + 一片竖靠背 + 两个墩子扶手 + 独立坐垫，
//    贵妃榻共用同一套零件但【靠背只占左半边】，于是两者再也不会长得一样。
// ---------------------------------------------------------------------------

/** 沙发族（三人/双人/沙发床/坐卧榻共用）：座箱+靠背+两扶手+一排独立坐垫 */
function seatSofa(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const armW = Math.min(0.19, w * 0.12), backD = Math.min(0.18, d * 0.22);
  const seatTop = Math.min(0.42, h * 0.6), footH = 0.07;
  const bodyC = tint(o.color, -0.14), padC = o.color, padC2 = tint(o.color, 0.16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])           // 四个小木脚
    cy(g, 0.032, 0.026, footH, tint(o.wood, -0.2), sx * (w / 2 - 0.1), footH / 2, sz * (d / 2 - 0.1), null, 6);
  bx(g, w, seatTop - footH - 0.06, d, bodyC, 0, (seatTop - 0.06 + footH) / 2, 0);            // 座箱
  bx(g, w, h - seatTop + 0.06, backD, bodyC, 0, (h + seatTop - 0.06) / 2, -d / 2 + backD / 2); // 靠背板
  const armTop = seatTop + (h - seatTop) * 0.55;
  for (const s of [-1, 1]) {                                                                  // 两个扶手墩子
    bx(g, armW, armTop - footH, d * 0.96, tint(o.color, -0.06), s * (w / 2 - armW / 2), (armTop + footH) / 2, 0);
    cushion(g, armW * 0.9, 0.07, d * 0.8, padC2, s * (w / 2 - armW / 2), armTop, 0);          // 扶手上的软包
  }
  const n = (kit.seats && kit.seats.length) ? Math.min(4, kit.seats.length) : Math.max(1, Math.round(w / 0.72));
  const zone = w - armW * 2, cw = zone / n;
  const cz = (d - backD) / 2 - 0.02;
  for (let i = 0; i < n; i++) {
    const cx = -zone / 2 + cw * (i + 0.5);
    cushion(g, cw * 0.94, 0.15, d - backD - 0.06, i % 2 ? padC2 : padC, cx, seatTop + 0.02, cz - (d - backD) / 2 + 0.01);  // 坐垫
    cushion(g, cw * 0.9, (h - seatTop) * 0.86, 0.16, i % 2 ? padC : padC2, cx, (h + seatTop) / 2 + 0.05, -d / 2 + backD + 0.07); // 靠垫
  }
  return g;
}

/** L 型转角沙发：主排 + 一条伸向 +Z 的返回段，两段各有靠背，撑满整个 L 形占地 */
function seatSofaL(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const seatTop = Math.min(0.42, h * 0.6), backD = 0.16, armW = 0.18;
  const bodyC = tint(o.color, -0.14);
  const dMain = d * 0.58, wArm = w * 0.42;
  const zMain = -d / 2 + dMain / 2, xArm = w / 2 - wArm / 2;
  bx(g, w, seatTop - 0.06, dMain, bodyC, 0, (seatTop - 0.06) / 2 + 0.03, zMain);        // 主排座箱
  bx(g, wArm, seatTop - 0.06, d, bodyC, xArm, (seatTop - 0.06) / 2 + 0.03, 0);          // 返回段座箱
  bx(g, w, h - seatTop + 0.06, backD, bodyC, 0, (h + seatTop - 0.06) / 2, -d / 2 + backD / 2);       // 主排靠背
  bx(g, backD, h - seatTop + 0.06, d - backD, bodyC, w / 2 - backD / 2, (h + seatTop - 0.06) / 2, backD / 2); // 返回段靠背
  bx(g, armW, seatTop + (h - seatTop) * 0.5, dMain, tint(o.color, -0.05), -w / 2 + armW / 2, (seatTop + (h - seatTop) * 0.5) / 2, zMain);  // 左扶手
  bx(g, wArm - backD, (h - seatTop) * 0.5 + 0.06, armW, tint(o.color, -0.05), xArm - backD / 2, seatTop + (h - seatTop) * 0.25, d / 2 - armW / 2);   // +Z 端扶手
  for (let i = 0; i < 3; i++) {                                                          // 主排坐垫 + 靠垫
    const cx = -w / 2 + armW + (w - armW - wArm) * (i + 0.5) / 3;
    cushion(g, (w - armW - wArm) / 3 * 0.94, 0.15, dMain - backD - 0.05, i % 2 ? tint(o.color, 0.16) : o.color, cx, seatTop + 0.02, zMain + backD / 2 + 0.02);
    cushion(g, (w - armW - wArm) / 3 * 0.9, (h - seatTop) * 0.85, 0.15, i % 2 ? o.color : tint(o.color, 0.16), cx, (h + seatTop) / 2 + 0.05, -d / 2 + backD + 0.07);
  }
  cushion(g, wArm * 0.8, 0.15, d * 0.6, tint(o.color, 0.16), xArm - 0.03, seatTop + 0.02, -d * 0.05);   // 转角坐垫
  return g;
}

/** 贵妃榻：和沙发一样长，但靠背只占左半边、右半边整个空出来 —— 这就是区分点 */
function seatChaise(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const seatTop = Math.min(0.42, h * 0.55), backD = 0.15, armW = 0.16;
  const bodyC = tint(o.color, -0.14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.03, 0.024, 0.08, tint(o.wood, -0.2), sx * (w / 2 - 0.1), 0.04, sz * (d / 2 - 0.09), null, 6);
  bx(g, w, seatTop - 0.14, d, bodyC, 0, (seatTop - 0.14) / 2 + 0.08, 0);                      // 长座箱
  bx(g, w * 0.5, h - seatTop + 0.06, backD, bodyC, -w * 0.25, (h + seatTop - 0.06) / 2, -d / 2 + backD / 2);   // 半边靠背
  bx(g, armW, h - seatTop * 0.4, d * 0.94, tint(o.color, -0.05), -w / 2 + armW / 2, (h - seatTop * 0.4) / 2 + seatTop * 0.2, 0);  // 左端扶手（高）
  cushion(g, w * 0.96, 0.14, d * 0.92, o.color, 0, seatTop + 0.02, 0.01);                      // 通长坐垫
  cy(g, d * 0.16, d * 0.16, w * 0.22, tint(o.color, 0.2), -w * 0.26, seatTop + 0.16, 0, [0, 0, Math.PI / 2], 10);  // 圆枕
  cushion(g, w * 0.2, 0.16, d * 0.5, tint(o.accent, 0.2), -w * 0.08, seatTop + 0.15, -d * 0.12);
  return g;
}

/** 单人扶手椅 / 高背翼椅：翼椅在靠背两侧多两片"耳朵"，剪影一眼分得开 */
function seatArmchair(kit, o, R, wing) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const seatTop = Math.min(0.42, h * 0.5), armW = Math.min(0.15, w * 0.18), backD = 0.14;
  const bodyC = tint(o.color, -0.13);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.03, 0.024, 0.08, tint(o.wood, -0.2), sx * (w / 2 - 0.08), 0.04, sz * (d / 2 - 0.08), null, 6);
  bx(g, w, seatTop - 0.14, d, bodyC, 0, (seatTop - 0.14) / 2 + 0.08, 0);
  bx(g, w, h - seatTop + 0.06, backD, bodyC, 0, (h + seatTop - 0.06) / 2, -d / 2 + backD / 2);
  const armTop = seatTop + (h - seatTop) * (wing ? 0.32 : 0.45);
  for (const s of [-1, 1]) {
    bx(g, armW, armTop - 0.08, d * 0.94, tint(o.color, -0.04), s * (w / 2 - armW / 2), (armTop + 0.08) / 2, 0);
    if (wing) bx(g, armW * 0.8, (h - armTop) * 0.9, d * 0.5, bodyC, s * (w / 2 - armW / 2), (h + armTop) / 2 - 0.03, -d / 2 + backD + d * 0.2);   // 翼
  }
  cushion(g, w - armW * 2 - 0.03, 0.15, d - backD - 0.05, o.color, 0, seatTop + 0.02, (backD) / 2 + 0.01);
  cushion(g, w - armW * 2 - 0.06, (h - seatTop) * 0.7, 0.15, tint(o.color, 0.18), 0, (h + seatTop) / 2, -d / 2 + backD + 0.07);
  return g;
}

/** 木餐椅 / 咖啡馆藤椅：四条腿 + 座板 + 两根后腿柱 + 横档（藤椅多几根竖条） */
function seatDining(kit, o, R, rattan) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const seatTop = h * 0.5, legR = 0.021, woodC = rattan ? tint(o.wood, 0.22) : o.wood;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, legR, legR * 0.8, seatTop, woodC, sx * (w / 2 - 0.04), seatTop / 2, sz * (d / 2 - 0.04), null, 6);
  bx(g, w * 0.9, 0.03, d * 0.9, tint(woodC, -0.06), 0, seatTop - 0.05, 0);                  // 座框
  for (const s of [-1, 1]) bx(g, w * 0.86, 0.02, 0.022, woodC, 0, seatTop * 0.35, s * (d / 2 - 0.05));  // 横撑
  bx(g, w, 0.045, d, rattan ? tint(o.color, 0.2) : o.color, 0, seatTop + 0.022, 0);          // 座面
  for (const s of [-1, 1]) bx(g, legR * 2.2, h - seatTop, legR * 2.2, woodC, s * (w / 2 - 0.04), (h + seatTop) / 2, -d / 2 + 0.04);  // 后腿柱
  const slats = rattan ? 5 : 2;
  for (let i = 0; i < slats; i++) {
    if (rattan) bx(g, 0.018, h - seatTop - 0.1, 0.02, woodC, (i - (slats - 1) / 2) * (w * 0.72 / slats), (h + seatTop) / 2 + 0.02, -d / 2 + 0.04);
    else bx(g, w * 0.78, 0.07, 0.025, tint(o.color, 0.1), 0, seatTop + 0.14 + i * (h - seatTop - 0.24), -d / 2 + 0.04);
  }
  bx(g, w * 0.84, 0.05, 0.03, tint(woodC, 0.14), 0, h - 0.03, -d / 2 + 0.04);                 // 搭脑（椅背顶横木）
  return g;
}

/** 高吧凳 / 岛台中高凳：圆座 + 四条细腿 + 一圈脚踏杆（脚踏是吧凳的身份特征） */
function seatStool(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const r = Math.min(w, d) / 2, legTop = h - 0.06;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.016, 0.02, legTop, o.metal, sx * (r - 0.05), legTop / 2, sz * (r - 0.05), null, 6);
  const fy = h * 0.28;
  for (const s of [-1, 1]) {                                                     // 脚踏方框（四根）
    bx(g, (r - 0.05) * 2, 0.016, 0.016, o.metal, 0, fy, s * (r - 0.05));
    bx(g, 0.016, 0.016, (r - 0.05) * 2, o.metal, s * (r - 0.05), fy, 0);
  }
  cy(g, r, r * 0.95, 0.05, tint(o.wood, 0.08), 0, legTop + 0.025, 0, null, 14);   // 圆座板
  cushion(g, r * 1.9, 0.06, r * 1.9, o.color, 0, legTop + 0.06, 0);               // 座垫
  return g;
}

/** 圆矮凳：三条腿 + 圆座 + 软垫（三条腿是矮凳最好认的特征） */
function seatStoolLow(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    cy(g, 0.018, 0.024, h - 0.06, o.wood, Math.cos(a) * r * 0.62, (h - 0.06) / 2, Math.sin(a) * r * 0.62, null, 6);
  }
  cy(g, r, r * 0.96, 0.045, tint(o.wood, 0.1), 0, h - 0.038, 0, null, 14);
  cushion(g, r * 1.9, 0.05, r * 1.9, o.color, 0, h - 0.012, 0);
  return g;
}

/** 蒲团坐垫：两层压扁的软包 + 中心扣 + 四角抓褶 */
function seatFloorCushion(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cushion(g, w, h * 0.62, d, o.color, 0, h * 0.32, 0);
  cushion(g, w * 0.82, h * 0.42, d * 0.82, tint(o.color, 0.16), 0, h * 0.72, 0);
  sp(g, w * 0.05, o.accent, 0, h * 0.9, 0, [1, 0.6, 1]);                       // 中心扣
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    sp(g, w * 0.06, tint(o.color, -0.12), sx * w * 0.42, h * 0.3, sz * d * 0.42, [1, 0.5, 1]);
  return g;
}

/** 懒人豆袋：三坨堆叠的压扁球，上小下大，坐进去会塌的那种形状 */
function seatBean(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  sp(g, w / 2, o.color, 0, h * 0.4, 0, [1, h * 0.4 / (w / 2), d / w]);            // 底下那一大坨（球心=半高，正好坐地）
  sp(g, w * 0.3, tint(o.color, 0.12), 0, h * 0.72, -d * 0.06, [1, h * 0.2 / (w * 0.3), 1]);
  sp(g, w * 0.19, tint(o.color, 0.24), 0, h * 0.86, -d * 0.1, [1, 0.6, 1]);
  bx(g, w * 0.5, 0.02, 0.02, o.accent, 0, h * 0.3, d * 0.42);                 // 缝线
  return g;
}

/** 人体工学转椅：五爪底盘 + 滚轮 + 气压柱 + 座 + 网背 + 两扶手 */
function seatOffice(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const r = w / 2, seatY = h * 0.42;
  for (let i = 0; i < 5; i++) {                                               // 五爪 + 五个轮子
    const a = i / 5 * Math.PI * 2, arm = new THREE.Group();
    arm.position.set(0, 0.055, 0); arm.rotation.y = a; g.add(arm);
    bx(arm, 0.05, 0.035, r * 0.86, DARK, 0, 0, r * 0.44);
    cy(arm, 0.028, 0.028, 0.026, DARK, 0, -0.03, r * 0.84, [Math.PI / 2, 0, 0], 8);
  }
  cy(g, 0.032, 0.045, seatY - 0.06, o.metal, 0, (seatY - 0.06) / 2 + 0.06, 0, null, 10);  // 气压柱
  bx(g, w * 0.8, 0.09, d * 0.78, tint(o.color, -0.1), 0, seatY, 0);                        // 座盘
  cushion(g, w * 0.78, 0.07, d * 0.76, o.color, 0, seatY + 0.06, 0);
  bx(g, w * 0.7, h - seatY - 0.16, 0.06, tint(o.accent, -0.05), 0, (h + seatY) / 2 + 0.05, -d / 2 + 0.1, [0.12, 0, 0]);  // 网背
  for (const s of [-1, 1]) bx(g, 0.05, 0.22, d * 0.5, DARK, s * (w / 2 - 0.03), seatY + 0.13, 0.02);   // 扶手
  return g;
}

/** 木摇椅：两根弧形摇板（三段拼出弧）+ 椅身。摇板贴地是它唯一的识别点 */
function seatRocking(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const seatTop = h * 0.42, woodC = o.wood;
  for (const s of [-1, 1]) {
    for (let i = -1; i <= 1; i++)                                            // 三段拼弧
      bx(g, 0.035, 0.05, d * 0.36, tint(woodC, -0.12), s * (w / 2 - 0.05), 0.03 + Math.abs(i) * 0.035, i * d * 0.32, [i * 0.2, 0, 0]);
    cy(g, 0.02, 0.024, seatTop, woodC, s * (w / 2 - 0.05), seatTop / 2 + 0.05, d * 0.22, null, 6);        // 前腿
    cy(g, 0.022, 0.026, h - 0.06, woodC, s * (w / 2 - 0.05), (h - 0.06) / 2 + 0.05, -d * 0.24, null, 6);  // 后腿（直通椅背）
    bx(g, 0.045, 0.04, d * 0.5, woodC, s * (w / 2 - 0.05), seatTop + 0.26, 0, [0.05, 0, 0]);              // 扶手
  }
  bx(g, w * 0.9, 0.045, d * 0.6, tint(woodC, 0.12), 0, seatTop + 0.02, d * 0.02);                          // 座面
  cushion(g, w * 0.84, 0.08, d * 0.5, o.color, 0, seatTop + 0.08, d * 0.02);
  for (let i = 0; i < 3; i++) bx(g, w * 0.78, 0.06, 0.022, tint(woodC, 0.06), 0, seatTop + 0.18 + i * 0.2, -d * 0.24);  // 背板条
  return g;
}

/** 休闲躺椅：座面前倾、靠背后仰、带脚踏段 —— 躺着的姿态是它的识别点 */
function seatLounge(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const woodC = o.wood;
  for (const s of [-1, 1]) {
    bx(g, 0.05, 0.35, d * 0.98, woodC, s * (w / 2 - 0.03), 0.175, 0);                     // 侧板（贯通前后）
    bx(g, 0.045, 0.05, d * 0.3, tint(woodC, -0.15), s * (w / 2 - 0.03), h * 0.55, -d * 0.28, [0.5, 0, 0]);  // 扶手斜段
  }
  bx(g, w * 0.92, 0.09, d * 0.5, tint(o.color, -0.1), 0, 0.4, d * 0.2, [-0.1, 0, 0]);      // 座面（略前倾）
  bx(g, w * 0.92, 0.09, d * 0.45, tint(o.color, -0.1), 0, h * 0.62, -d * 0.26, [0.85, 0, 0]);  // 靠背（后仰）
  cushion(g, w * 0.86, 0.1, d * 0.44, o.color, 0, 0.47, d * 0.2);
  cushion(g, w * 0.82, 0.1, d * 0.4, tint(o.color, 0.15), 0, h * 0.66, -d * 0.29, [0.85, 0, 0]);
  cushion(g, w * 0.5, 0.1, 0.16, tint(o.accent, 0.2), 0, h * 0.9, -d * 0.38);              // 头枕
  return g;
}

// ---------------------------------------------------------------------------
// 4. 桌案专门造型
//    契约硬要求：桌子必须有四条腿，不许是一个实心盒子。所以下面每张桌子
//    都是「桌面 + 腿 + 望板」三件起步，再按用途加抽屉/下层板/桌上小物。
// ---------------------------------------------------------------------------

/** 长餐桌 / 方餐桌 / 折叠桌 / 会议桌：桌面 + 四腿 + 望板 + 桌上小物 */
function tabDining(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const topT = 0.055, legR = opt.slim ? 0.026 : 0.038, legTop = h - topT;
  const woodC = o.wood;
  if (opt.trestle) {                                           // 会议桌：两片梯形支腿 + 一根横梁
    for (const s of [-1, 1]) {
      bx(g, 0.09, legTop, d * 0.72, tint(woodC, -0.1), s * (w * 0.32), legTop / 2, 0);
      bx(g, 0.16, 0.07, d * 0.86, tint(woodC, -0.2), s * (w * 0.32), 0.035, 0);
    }
    bx(g, w * 0.6, 0.08, 0.09, tint(woodC, -0.1), 0, legTop * 0.55, 0);
  } else {
    legs4(g, w, d, legTop, legR, woodC, legR + 0.06, false);
    for (const s of [-1, 1]) bx(g, w - legR * 4 - 0.14, 0.08, 0.03, tint(woodC, -0.1), 0, legTop - 0.07, s * (d / 2 - legR - 0.07));
    bx(g, 0.03, 0.08, d - legR * 4 - 0.14, tint(woodC, -0.1), 0, legTop - 0.07, 0);
  }
  bx(g, w, topT, d, tint(woodC, 0.14), 0, h - topT / 2, 0);                       // 桌面
  bx(g, w, topT * 0.3, d * 1.004, tint(woodC, -0.16), 0, h - topT + 0.008, 0);    // 收边
  if (opt.planks) for (let i = 0; i < 4; i++)                                     // 户外桌：看得见的板缝
    bx(g, w * 0.995, 0.008, 0.012, tint(woodC, -0.3), 0, h + 0.001, (i - 1.5) * d * 0.24);
  // 桌上小物：一只小碗 + 一个瓶（让餐桌不是一块空板）
  cy(g, 0.07, 0.05, 0.05, PAPER, -w * 0.18, h + 0.025, 0, null, 10);
  cy(g, 0.03, 0.045, 0.16, tint(o.accent, 0.1), w * 0.16, h + 0.08, d * 0.06, null, 8);
  return g;
}

/** 客厅茶几：矮桌面 + 四腿 + 下层板 + 上面摞的两本书 */
function tabCoffee(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const topT = 0.05, legTop = h - topT;
  legs4(g, w, d, legTop, 0.03, o.wood, 0.075, true);
  bx(g, w * 0.82, 0.026, d * 0.78, tint(o.wood, -0.06), 0, h * 0.28, 0);          // 下层板
  bx(g, w, topT, d, tint(o.wood, 0.14), 0, h - topT / 2, 0);
  bx(g, w, 0.016, d * 1.004, tint(o.wood, -0.18), 0, h - topT, 0);
  bx(g, 0.24, 0.035, 0.18, o.accent, -w * 0.2, h + 0.018, 0);                     // 摞着的书
  bx(g, 0.21, 0.03, 0.16, tint(o.color, 0.2), -w * 0.2, h + 0.05, 0.01);
  cy(g, 0.05, 0.06, 0.09, tint(o.color, -0.1), w * 0.22, h + 0.045, 0, null, 10); // 小杯
  return g;
}

/** 圆桌（咖啡圆桌 / 边几）：圆桌面 + 中柱 + 三爪底盘 */
function tabRound(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w, d) / 2;
  for (let i = 0; i < 3; i++) {                                                    // 三爪
    const a = i / 3 * Math.PI * 2, arm = new THREE.Group();
    arm.position.set(0, 0.03, 0); arm.rotation.y = a; g.add(arm);
    bx(arm, 0.05, 0.045, r * 0.85, tint(o.metal, -0.1), 0, 0, r * 0.42);
  }
  cy(g, 0.035, 0.045, h - 0.06, o.metal, 0, (h - 0.06) / 2 + 0.05, 0, null, 10);   // 中柱
  cy(g, r, r * 0.99, 0.045, tint(o.wood, 0.14), 0, h - 0.022, 0, null, 18);        // 圆面
  cy(g, r * 1.005, r * 1.005, 0.014, tint(o.wood, -0.2), 0, h - 0.05, 0, null, 18);
  cy(g, 0.045, 0.035, 0.1, PAPER, 0, h + 0.05, 0, null, 10);                       // 杯子
  return g;
}

/** 书桌 / L 型工位：桌面 + 四腿 + 侧抽屉柜（带把手）+ 挡板 */
function tabDesk(kit, o, R, lshape) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const topT = 0.05, legTop = h - topT, woodC = o.wood;
  if (lshape) {
    const dMain = d * 0.5, wSide = w * 0.42;
    bx(g, w, topT, dMain, tint(woodC, 0.14), 0, h - topT / 2, -d / 2 + dMain / 2);            // 主台面
    bx(g, wSide, topT, d, tint(woodC, 0.14), w / 2 - wSide / 2, h - topT / 2, 0);             // 侧台面
    for (const p of [[-w / 2 + 0.07, -d / 2 + 0.07], [w / 2 - 0.07, -d / 2 + 0.07], [w / 2 - 0.07, d / 2 - 0.07], [w / 2 - wSide + 0.07, d / 2 - 0.07]])
      cy(g, 0.026, 0.026, legTop, o.metal, p[0], legTop / 2, p[1], null, 8);
    bx(g, w * 0.7, 0.3, 0.025, tint(woodC, -0.1), -w * 0.1, h * 0.55, -d / 2 + 0.06);         // 挡板
  } else {
    legs4(g, w, d, legTop, 0.028, o.metal, 0.075, false);
    bx(g, w, topT, d, tint(woodC, 0.14), 0, h - topT / 2, 0);
    bx(g, w * 0.9, 0.3, 0.025, tint(woodC, -0.1), 0, h * 0.55, -d / 2 + 0.06);
  }
  const bw = Math.min(0.38, w * 0.3), bh = legTop * 0.72;
  bx(g, bw, bh, d * 0.8, tint(o.color, -0.05), w / 2 - bw / 2 - 0.05, bh / 2 + 0.05, 0);      // 抽屉柜
  for (let i = 0; i < 3; i++) {
    bx(g, bw - 0.02, bh / 3 - 0.012, 0.02, o.color, w / 2 - bw / 2 - 0.05, 0.05 + bh / 3 * (i + 0.5), d * 0.4 + 0.006);
    handleBar(g, bw * 0.5, o.metal, w / 2 - bw / 2 - 0.05, 0.05 + bh / 3 * (i + 0.5), d * 0.4 + 0.026, false);
  }
  bx(g, 0.3, 0.02, 0.22, PAPER, -w * 0.16, h + 0.012, 0.02);                                   // 桌上摊开的纸
  return g;
}

/** 玄关条案：很浅很长 + 四条细腿 + 下层横板 + 上面一盘钥匙 */
function tabConsole(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  legs4(g, w, d, h - 0.045, 0.022, o.wood, 0.05, true);
  bx(g, w * 0.86, 0.024, d * 0.7, tint(o.wood, -0.05), 0, h * 0.22, 0);
  bx(g, w * 0.9, 0.11, d * 0.8, tint(o.color, -0.05), 0, h - 0.12, 0);                        // 抽屉带
  for (const s of [-1, 1]) handleBar(g, 0.14, o.metal, s * w * 0.22, h - 0.12, d * 0.4 + 0.02, false);
  bx(g, w, 0.045, d, tint(o.wood, 0.14), 0, h - 0.022, 0);
  cy(g, 0.08, 0.075, 0.03, tint(o.accent, 0.1), w * 0.28, h + 0.015, 0, null, 12);            // 托盘
  return g;
}

/** 套叠小几组：大的撑满占地，小的塞在旁边低一截 —— "两张"是它的识别点 */
function tabNesting(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  legs4(g, w, d, h - 0.04, 0.02, o.wood, 0.045, true);
  bx(g, w, 0.04, d, tint(o.wood, 0.14), 0, h - 0.02, 0);
  const w2 = w * 0.62, d2 = d * 0.72, h2 = h * 0.72;
  legs4(g, w2, d2, h2 - 0.035, 0.018, tint(o.color, -0.1), 0.04, true);
  bx(g, w2, 0.035, d2, o.color, 0, h2 - 0.018, 0);
  return g;
}

/** 吧台面（客座侧）：高台面 + 正面木条 + 支撑牛腿 + 脚踏杆 */
function tabBarTop(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, 0.06, d, tint(o.wood, 0.16), 0, h - 0.03, 0);                                     // 台面
  bx(g, w, 0.02, d * 1.004, tint(o.wood, -0.2), 0, h - 0.07, 0);
  bx(g, w * 0.99, h * 0.5, 0.05, tint(o.color, -0.08), 0, h * 0.62, -d / 2 + 0.03);          // 挡板
  const n = Math.max(3, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5 - n / 2) * (w / n);
    bx(g, 0.07, h * 0.9, 0.07, o.metal, x, h * 0.45, -d / 2 + 0.06);                          // 立柱
    bx(g, 0.05, 0.05, d * 0.5, o.metal, x, h - 0.1, -d * 0.1, [0.5, 0, 0]);                   // 牛腿
  }
  cy(g, 0.022, 0.022, w * 0.9, o.metal, 0, h * 0.18, d * 0.2, [0, 0, Math.PI / 2], 8);        // 脚踏杆
  return g;
}

/** 厨房岛台：柜体 + 出挑台面 + 三扇柜门带把手 + 踢脚凹槽 */
function tabIsland(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.93, 0.09, d * 0.88, DARK, 0, 0.045, 0);                                        // 踢脚
  bx(g, w * 0.96, h - 0.15, d * 0.92, tint(o.color, -0.08), 0, (h - 0.15) / 2 + 0.09, 0);    // 柜体
  bx(g, w, 0.06, d, tint(o.metal, 0.25), 0, h - 0.03, 0);                                     // 台面（出挑）
  bx(g, w, 0.018, d * 1.004, tint(o.metal, -0.1), 0, h - 0.068, 0);
  for (let i = 0; i < 3; i++) {                                                               // 三扇门
    const x = (i - 1) * w * 0.31;
    bx(g, w * 0.29, h - 0.24, 0.022, o.color, x, h * 0.52, d * 0.46 + 0.006);
    bx(g, w * 0.22, h - 0.36, 0.01, tint(o.color, 0.14), x, h * 0.52, d * 0.46 + 0.018);
    handleBar(g, 0.16, o.metal, x, h * 0.78, d * 0.46 + 0.036, false);
  }
  cy(g, 0.09, 0.08, 0.05, PAPER, w * 0.3, h + 0.025, 0, null, 12);                            // 台面上的碗
  cy(g, 0.05, 0.05, 0.14, tint(o.accent, 0.1), -w * 0.3, h + 0.07, 0, null, 8);
  return g;
}

/** 梳妆台：桌面 + 细腿 + 两个抽屉 + 一面立起来的椭圆镜 + 几个瓶子 */
function tabVanity(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  legs4(g, w, d, h - 0.045, 0.02, o.wood, 0.05, true);
  bx(g, w * 0.86, 0.14, d * 0.82, tint(o.color, -0.06), 0, h - 0.13, 0);
  for (const s of [-1, 1]) {
    bx(g, w * 0.4, 0.11, 0.02, o.color, s * w * 0.22, h - 0.13, d * 0.41 + 0.006);
    knob(g, 0.022, o.metal, s * w * 0.22, h - 0.13, d * 0.41 + 0.024);
  }
  bx(g, w, 0.045, d, tint(o.wood, 0.14), 0, h - 0.022, 0);
  // 立镜（压扁的圆盘，高度控制在 1.35×h 以内）
  const mr = Math.min(0.13, w * 0.13), my = h + 0.13;
  for (const s of [-1, 1]) cy(g, 0.013, 0.013, 0.14, o.metal, s * mr * 0.7, h + 0.07, -d * 0.2, null, 6);
  cy(g, mr, mr, 0.02, tint(o.wood, -0.05), 0, my, -d * 0.2, [Math.PI / 2, 0, 0], 16);
  cy(g, mr * 0.86, mr * 0.86, 0.024, GLASS, 0, my, -d * 0.2 + 0.004, [Math.PI / 2, 0, 0], 16, { transparent: true, opacity: 0.5 });
  for (let i = 0; i < 3; i++) cy(g, 0.016, 0.02, 0.06 + i * 0.02, tint(o.accent, 0.1 * i), w * 0.24 + i * 0.06, h + 0.04 + i * 0.01, d * 0.1, null, 8);
  return g;
}

/** 户外野餐桌：厚板面（看得见板缝）+ 两组 A 形交叉腿 */
function tabPicnic(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) {                                                     // A 形腿
    bx(g, 0.06, h * 1.02, 0.06, tint(o.wood, -0.15), s * w * 0.34, h * 0.48, -d * 0.3, [-0.28, 0, 0]);
    bx(g, 0.06, h * 1.02, 0.06, tint(o.wood, -0.15), s * w * 0.34, h * 0.48, d * 0.3, [0.28, 0, 0]);
    bx(g, 0.05, 0.05, d * 0.75, tint(o.wood, -0.2), s * w * 0.34, h * 0.3, 0);   // 横撑
  }
  for (let i = 0; i < 4; i++)                                                     // 四条面板
    bx(g, w, 0.05, d * 0.235, tint(o.wood, 0.1 + i * 0.02), 0, h - 0.025, (i - 1.5) * d * 0.25);
  return g;
}

/** 木作工作台：厚台面 + 粗腿 + 下层板 + 台钳（台钳是它区别于餐桌的关键） */
function tabWorkbench(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const topT = 0.09, legTop = h - topT;
  legs4(g, w, d, legTop, 0.05, tint(o.wood, -0.18), 0.09, false);
  bx(g, w * 0.86, 0.035, d * 0.8, tint(o.wood, -0.1), 0, 0.2, 0);                 // 下层板
  for (const s of [-1, 1]) bx(g, w * 0.8, 0.06, 0.04, tint(o.wood, -0.22), 0, legTop - 0.09, s * (d / 2 - 0.09));
  bx(g, w, topT, d, tint(o.wood, 0.08), 0, h - topT / 2, 0);                       // 厚台面
  bx(g, 0.2, 0.14, 0.12, o.metal, -w * 0.36, h - topT - 0.05, d * 0.34);           // 台钳
  cy(g, 0.018, 0.018, 0.2, tint(o.metal, 0.2), -w * 0.36, h - topT - 0.05, d * 0.44, [Math.PI / 2, 0, 0], 6);
  for (let i = 0; i < 3; i++) bx(g, 0.03, 0.03, 0.16, o.accent, w * (0.1 + i * 0.1), h + 0.016, -d * 0.2);  // 台面上的工具
  return g;
}

/** 儿童矮桌：圆角矮台面 + 四条彩色胖腿 */
function tabKid(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const legTop = h - 0.045;
  const cs = [o.color, o.accent, tint(o.color, 0.3), tint(o.accent, 0.3)];
  let i = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.032, 0.038, legTop, cs[i++], sx * (w / 2 - 0.08), legTop / 2, sz * (d / 2 - 0.08), null, 8);
  bx(g, w, 0.045, d, tint(o.wood, 0.2), 0, h - 0.022, 0);
  bx(g, w * 0.94, 0.012, d * 0.9, tint(o.accent, 0.35), 0, h + 0.004, 0);          // 桌面贴片
  for (let k = 0; k < 3; k++) bx(g, 0.05, 0.05, 0.05, cs[k], (k - 1) * 0.14, h + 0.032, d * 0.15);  // 积木
  return g;
}

// ---------------------------------------------------------------------------
// 5. 睡眠专门造型
//    床的识别点不在床本身（都是个方台），在【被子只盖住下半截 + 床头两个枕头】
//    这个组合。婴儿床靠围栏竖条、上下铺靠两层加梯子，各自有各自的剪影。
// ---------------------------------------------------------------------------

/** 床族（双人/大床/单人/儿童床）：床箱 + 床脚 + 床垫 + 被子 + 翻边 + 枕头 */
function bedMain(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const baseH = h * 0.52, matH = h * 0.46;
  bx(g, w * 0.95, baseH, d * 0.97, o.wood, 0, baseH / 2 + 0.03, 0);                        // 床箱
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.035, 0.028, 0.05, tint(o.wood, -0.3), sx * (w / 2 - 0.1), 0.025, sz * (d / 2 - 0.1), null, 6);
  bx(g, w, matH, d, PAPER, 0, baseH + 0.03 + matH / 2, 0);                                  // 床垫
  bx(g, w * 1.002, 0.02, d * 1.002, tint(o.accent, 0.35), 0, baseH + 0.03 + matH * 0.5, 0); // 床垫压线
  bx(g, w, 0.055, d * 0.6, o.color, 0, h + 0.027, d * 0.19);                                // 被子（盖住脚这半边）
  bx(g, w, 0.05, 0.1, tint(o.color, 0.28), 0, h + 0.04, -d * 0.115);                        // 被子翻边
  for (let i = 0; i < (opt.pillows || 2); i++) {
    const n = opt.pillows || 2, pw = Math.min(w / n * 0.86, 0.55);
    cushion(g, pw, 0.12, d * 0.15, tint(o.accent, 0.32), n === 1 ? 0 : (i - (n - 1) / 2) * pw * 1.1, h + 0.055, -d / 2 + d * 0.11);
  }
  if (opt.rail) {                                                                            // 儿童床护栏
    bx(g, w * 0.6, 0.05, 0.04, o.accent, 0, h + 0.16, d / 2 - 0.05);
    for (let i = 0; i < 4; i++) bx(g, 0.03, 0.2, 0.03, o.accent, (i - 1.5) * w * 0.16, h + 0.08, d / 2 - 0.05);
  }
  return g;
}

/** 婴儿床：四根角柱 + 四面竖条围栏 —— 围栏是它区别于小床的唯一标志 */
function bedCrib(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const matY = h * 0.38;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    bx(g, 0.055, h, 0.055, o.wood, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03));         // 四角柱
  for (const sz of [-1, 1]) {                                                                // 长边围栏
    bx(g, w * 0.96, 0.045, 0.035, tint(o.wood, 0.1), 0, h - 0.03, sz * (d / 2 - 0.03));
    for (let i = 0; i < 5; i++) bx(g, 0.024, h - matY - 0.1, 0.024, tint(o.wood, 0.05), (i - 2) * w * 0.19, (h + matY) / 2 - 0.02, sz * (d / 2 - 0.03));
  }
  for (const sx of [-1, 1]) {                                                                // 短边围栏
    bx(g, 0.035, 0.045, d * 0.94, tint(o.wood, 0.1), sx * (w / 2 - 0.03), h - 0.03, 0);
    for (let i = 0; i < 4; i++) bx(g, 0.024, h - matY - 0.1, 0.024, tint(o.wood, 0.05), sx * (w / 2 - 0.03), (h + matY) / 2 - 0.02, (i - 1.5) * d * 0.22);
  }
  bx(g, w * 0.86, 0.1, d * 0.88, PAPER, 0, matY, 0);                                          // 床垫
  bx(g, w * 0.84, 0.04, d * 0.5, o.color, 0, matY + 0.07, d * 0.18);                          // 小被
  cushion(g, w * 0.4, 0.08, d * 0.14, tint(o.accent, 0.3), 0, matY + 0.09, -d * 0.3);         // 枕
  return g;
}

/** 上下铺：两层床板 + 四根通柱 + 上铺护栏 + 一把梯子（梯子是它的识别点） */
function bedBunk(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    bx(g, 0.06, h, 0.06, o.wood, sx * (w / 2 - 0.035), h / 2, sz * (d / 2 - 0.035));           // 四根通柱
  for (const [y, c] of [[h * 0.19, o.color], [h * 0.68, tint(o.accent, 0.1)]]) {
    bx(g, w * 0.94, 0.06, d * 0.94, tint(o.wood, -0.1), 0, y, 0);                              // 床板
    bx(g, w * 0.92, 0.11, d * 0.92, PAPER, 0, y + 0.085, 0);                                   // 床垫
    bx(g, w * 0.92, 0.045, d * 0.55, c, 0, y + 0.16, d * 0.2);                                 // 被
    cushion(g, w * 0.6, 0.1, d * 0.13, tint(o.accent, 0.3), 0, y + 0.18, -d * 0.34);           // 枕
  }
  bx(g, w * 0.94, 0.05, 0.04, o.wood, 0, h * 0.86, d / 2 - 0.035);                             // 上铺护栏
  for (let i = 0; i < 3; i++) bx(g, 0.03, h * 0.16, 0.03, o.wood, (i - 1) * w * 0.3, h * 0.79, d / 2 - 0.035);
  for (let i = 0; i < 4; i++) bx(g, 0.24, 0.035, 0.035, tint(o.wood, 0.12), w / 2 - 0.15, h * 0.26 + i * h * 0.15, d * 0.34);  // 梯子踏板
  return g;
}

/** 榻榻米 / 地铺：直接躺在地上的一片床垫 + 被 + 枕，没有床箱没有腿 */
function bedFloor(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.62, d, PAPER, 0, h * 0.31, 0);
  bx(g, w * 1.002, 0.015, d * 1.002, tint(o.accent, 0.3), 0, h * 0.4, 0);
  bx(g, w * 0.98, h * 0.3, d * 0.58, o.color, 0, h * 0.77, d * 0.2);
  bx(g, w * 0.98, h * 0.22, 0.08, tint(o.color, 0.28), 0, h * 0.73, -d * 0.1);
  cushion(g, w * 0.42, h * 0.34, d * 0.13, tint(o.accent, 0.32), 0, h * 0.79, -d * 0.36);
  return g;
}

/** 坐卧榻：一个矮平台 + 通长坐垫 + 一排靠枕（没有正经靠背 = 白天能当沙发） */
function bedDaybed(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  legs4(g, w, d, h * 0.35, 0.032, tint(o.wood, -0.15), 0.1, true);
  bx(g, w, h * 0.16, d, o.wood, 0, h * 0.43, 0);                                    // 平台
  cushion(g, w * 0.98, h * 0.3, d * 0.96, o.color, 0, h * 0.63, 0);                 // 床垫式坐垫
  for (let i = 0; i < 4; i++)                                                       // 一排靠枕
    cushion(g, w * 0.22, h * 0.42, 0.14, i % 2 ? tint(o.accent, 0.25) : tint(o.color, 0.2), (i - 1.5) * w * 0.24, h * 0.85, -d * 0.38);
  return g;
}

/** 吊床：两根支架 + 中间下垂的网面（五段拼出弧）+ 两端绳 */
function bedHammock(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) {
    bx(g, 0.07, h * 0.9, 0.07, o.wood, 0, h * 0.45, s * (d / 2 - 0.05), [s * 0.12, 0, 0]);   // 斜支柱
    bx(g, w * 0.8, 0.06, 0.3, tint(o.wood, -0.15), 0, 0.03, s * (d / 2 - 0.12));            // 支脚
    cy(g, 0.01, 0.01, 0.3, DARK, 0, h * 0.78, s * (d / 2 - 0.16), [s * 0.6, 0, 0], 5);      // 吊绳
  }
  for (let i = -2; i <= 2; i++) {                                                            // 下垂的网面
    const t = i / 2.5, z = t * d * 0.34;
    bx(g, w * 0.86, 0.05, d * 0.16, o.color, 0, h * 0.42 + t * t * h * 0.28, z, [t * 0.5, 0, 0]);
  }
  cushion(g, w * 0.5, 0.1, d * 0.1, tint(o.accent, 0.3), 0, h * 0.52, -d * 0.26);            // 枕头
  return g;
}

/** 午休舱：一个半包围的壳（后墙+两侧墙+三段弧顶）+ 床垫 + 枕，开口朝 +Z */
function bedPod(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, 0.14, d, tint(o.color, -0.2), 0, 0.07, 0);                                        // 底台
  bx(g, w, h * 0.62, 0.08, tint(o.color, -0.1), 0, h * 0.31 + 0.14, -d / 2 + 0.04);          // 后墙
  for (const s of [-1, 1]) bx(g, 0.07, h * 0.55, d * 0.92, tint(o.color, -0.05), s * (w / 2 - 0.035), h * 0.3 + 0.14, -d * 0.03);  // 两侧墙
  for (let i = 0; i < 3; i++)                                                                 // 三段弧顶
    bx(g, w, 0.07, d * 0.3, o.color, 0, h - 0.05 - i * 0.06, -d * 0.34 + i * d * 0.3, [(i - 1) * 0.32, 0, 0]);
  bx(g, w * 0.9, 0.13, d * 0.9, PAPER, 0, 0.2, 0);                                            // 床垫
  bx(g, w * 0.88, 0.05, d * 0.5, tint(o.accent, 0.15), 0, 0.29, d * 0.2);                     // 薄被
  cushion(g, w * 0.5, 0.1, d * 0.12, tint(o.accent, 0.3), 0, 0.31, -d * 0.34);
  return g;
}

// ---------------------------------------------------------------------------
// 6. 收纳专门造型
//    契约硬要求：柜子要有把手、书架要有层板 + 一排彩色书脊。
//    「有门的柜」和「没门的架」剪影完全不同，所以拆成两条线各写各的。
// ---------------------------------------------------------------------------

/** 有门/有抽屉的柜（衣柜/边柜/床头柜/更衣柜/文件柜共用） */
function stoCabinet(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const plinth = Math.min(0.09, h * 0.08), bodyH = h - plinth - (opt.cornice ? 0.05 : 0);
  bx(g, w * 0.92, plinth, d * 0.88, tint(o.wood, -0.35), 0, plinth / 2, 0);                   // 踢脚
  bx(g, w, bodyH, d, tint(o.color, -0.12), 0, plinth + bodyH / 2, 0);                          // 柜身
  if (opt.cornice) bx(g, w * 1.02, 0.05, d * 1.04, tint(o.wood, 0.12), 0, h - 0.025, 0);       // 顶线脚
  const nD = opt.doors || 0, nDr = opt.drawers || 0;
  const drawZone = nDr ? bodyH * (nD ? 0.42 : 1) : 0;
  for (let i = 0; i < nDr; i++) {                                                              // 抽屉（带缝 + 把手）
    const dh = drawZone / nDr, y = plinth + bodyH - drawZone + dh * (i + 0.5);
    bx(g, w * 0.96, dh - 0.014, 0.022, o.color, 0, y, d / 2 - 0.008);
    bx(g, w * 0.88, dh - 0.06, 0.01, tint(o.color, 0.12), 0, y, d / 2 + 0.006);
    handleBar(g, Math.min(0.24, w * 0.34), o.metal, 0, y, d / 2 + 0.026, false);
    if (opt.label) bx(g, 0.1, 0.045, 0.008, PAPER, -w * 0.3, y, d / 2 + 0.008);                // 文件柜标签
  }
  if (nD) {                                                                                     // 门（中缝 + 竖把手）
    const dh = bodyH - drawZone - 0.03, dw = (w - 0.02 * (nD + 1)) / nD;
    for (let i = 0; i < nD; i++) {
      const x = -w / 2 + 0.02 + dw * (i + 0.5) + 0.02 * i;
      bx(g, dw, dh, 0.024, o.color, x, plinth + dh / 2 + 0.015, d / 2 - 0.008);
      bx(g, dw - 0.09, dh - 0.11, 0.012, tint(o.color, 0.15), x, plinth + dh / 2 + 0.015, d / 2 + 0.008);
      handleBar(g, Math.min(0.2, dh * 0.32), o.metal, x + (nD > 1 && i === 0 ? dw * 0.36 : -dw * 0.36), plinth + dh * 0.55, d / 2 + 0.026, true);
      if (opt.vents) for (let v = 0; v < 3; v++) bx(g, dw * 0.5, 0.012, 0.01, DARK, x, plinth + dh * 0.9 - v * 0.035, d / 2 + 0.012);  // 更衣柜百叶
    }
  }
  if (opt.top) {                                                                                // 柜面上的小摆件
    cy(g, Math.min(0.06, w * 0.1), Math.min(0.05, w * 0.09), 0.13, tint(o.accent, 0.1), -w * 0.28, h + 0.065, 0, null, 8);
    bx(g, Math.min(0.18, w * 0.2), 0.03, 0.13, tint(o.color, 0.25), w * 0.25, h + 0.015, 0);
  }
  return g;
}

/** 开放架 / 书架 / 通高书墙：两片立板 + 多层层板 + 每层一排彩色书脊 */
function stoShelf(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const side = 0.035;
  for (const s of [-1, 1]) bx(g, side, h, d, tint(o.wood, -0.08), s * (w / 2 - side / 2), h / 2, 0);   // 两片立板
  bx(g, w, 0.03, d * 0.98, tint(o.wood, -0.2), 0, 0.015, 0);                                            // 底板
  bx(g, w, 0.035, d, tint(o.wood, 0.12), 0, h - 0.018, 0);                                              // 顶板
  bx(g, w - side * 2, h - 0.06, 0.014, tint(o.color, -0.05), 0, h / 2, -d / 2 + 0.01);                  // 背板
  const n = Math.max(2, Math.round((h - 0.1) / (opt.pitch || 0.38)));
  for (let i = 1; i < n; i++) {
    const y = 0.03 + (h - 0.09) * i / n;
    bx(g, w - side * 2, 0.028, d * 0.94, tint(o.wood, 0.06), 0, y, 0);                                  // 层板
    const cell = (h - 0.09) / n - 0.05;
    if (i % 3 === 2 && !opt.allBooks) {                                                                  // 偶尔放几个盒子/摆件换换口味
      bx(g, w * 0.3, cell * 0.7, d * 0.6, tint(o.accent, 0.1), -w * 0.25, y + 0.014 + cell * 0.35, 0);
      cy(g, d * 0.2, d * 0.16, cell * 0.6, tint(o.color, 0.2), w * 0.2, y + 0.014 + cell * 0.3, 0, null, 10);
    } else {
      books(g, -w / 2 + side + 0.02, w / 2 - side - 0.02, y + 0.014, 0, cell, o, R, w < 0.9);            // 一排彩色书脊
    }
  }
  return g;
}

/** 挂墙搁板：一块板 + 两个三角托架（整件只有 6cm 高，放不下任何摆件） */
function stoWallShelf(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.55, d, tint(o.wood, 0.1), 0, h - h * 0.275, 0);                     // 板
  bx(g, w, h * 0.16, d * 1.004, tint(o.wood, -0.2), 0, h - h * 0.55, 0);             // 板下沿
  for (const s of [-1, 1]) bx(g, 0.035, h * 0.45, d * 0.7, o.metal, s * (w / 2 - 0.1), h * 0.22, -d * 0.1);  // 托架
  return g;
}

/** 鞋架：两片侧框 + 三层斜置层板 + 两双鞋（鞋是它区别于书架的关键） */
function stoShoeRack(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) bx(g, 0.03, h, d * 0.95, o.wood, s * (w / 2 - 0.015), h / 2, 0);
  for (let i = 0; i < 3; i++) {
    const y = 0.1 + i * (h - 0.16) / 3;
    bx(g, w - 0.06, 0.025, d * 0.9, tint(o.wood, 0.1), 0, y, 0, [-0.28, 0, 0]);       // 斜层板
    for (const s of [-1, 1]) {                                                        // 鞋
      bx(g, w * 0.28, 0.07, d * 0.55, s > 0 ? o.color : tint(o.accent, 0.05), s * w * 0.2, y + 0.07, 0.02);
      bx(g, w * 0.24, 0.05, d * 0.2, tint(s > 0 ? o.color : o.accent, 0.25), s * w * 0.2, y + 0.11, -d * 0.14);
    }
  }
  return g;
}

/** 洞洞板工具墙：底板 + 一排孔位横条 + 三个挂钩 + 挂着的工具（全部对称落在 z=0） */
function stoPegboard(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit;
  bx(g, w, h, 0.028, o.color, 0, h / 2, -0.014);                                        // 底板
  for (let i = 0; i < 4; i++) bx(g, w * 0.94, 0.008, 0.006, tint(o.color, -0.2), 0, h * (0.2 + i * 0.2), 0.002);  // 孔位线
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.28;
    cy(g, 0.008, 0.008, 0.05, o.metal, x, h * 0.72, 0.02, [Math.PI / 2, 0, 0], 5);      // 挂钩
    bx(g, 0.035, 0.22, 0.03, [o.metal, o.accent, tint(o.wood, 0.1)][i], x, h * 0.58, 0.022);   // 工具
    bx(g, 0.09, 0.05, 0.03, tint(o.metal, -0.2), x, h * 0.46, 0.022);
  }
  return g;
}

/** 板条箱堆：三个箱子叠着，每个箱正面有横板条和一条标签 */
function stoCrates(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const ch = h / 3;
  for (let i = 0; i < 3; i++) {
    const y = ch * i, c = i % 2 ? tint(o.wood, 0.12) : o.wood, off = (R() - 0.5) * w * 0.12;
    bx(g, w * 0.96, ch * 0.9, d * 0.96, c, off, y + ch * 0.45, 0);                       // 箱体
    for (let k = 0; k < 2; k++) bx(g, w * 0.98, ch * 0.22, 0.012, tint(c, 0.2), off, y + ch * (0.28 + k * 0.35), d / 2 + 0.004);  // 板条
    bx(g, w * 0.34, ch * 0.24, 0.008, PAPER, off, y + ch * 0.45, d / 2 + 0.01);          // 标签
  }
  return g;
}

/** 落地挂杆：两组 A 形支架 + 顶横杆 + 四件挂着的衣服 + 衣架 */
function stoRail(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) {
    bx(g, 0.04, h, 0.04, o.metal, s * (w / 2 - 0.03), h / 2, -d / 2 + 0.11, [-0.06, 0, 0]);
    bx(g, 0.04, h, 0.04, o.metal, s * (w / 2 - 0.03), h / 2, d / 2 - 0.11, [0.06, 0, 0]);
    bx(g, 0.05, 0.04, d * 0.72, tint(o.metal, -0.2), s * (w / 2 - 0.03), 0.02, 0);
  }
  cy(g, 0.018, 0.018, w * 0.95, tint(o.metal, 0.2), 0, h - 0.06, 0, [0, 0, Math.PI / 2], 8);   // 横杆
  const cs = [o.color, o.accent, tint(o.color, 0.25), tint(o.accent, -0.15)];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * w * 0.22;
    cy(g, 0.01, 0.01, 0.08, o.metal, x, h - 0.1, 0, null, 5);                                   // 衣架钩
    bx(g, w * 0.16, 0.02, d * 0.3, o.metal, x, h - 0.14, 0);
    bx(g, w * 0.15, h * 0.42, d * 0.26, cs[i], x, h * 0.66, 0);                                  // 衣服
  }
  return g;
}

/** 落地衣帽架：圆底盘 + 三脚 + 立杆 + 四个挂钩 + 一顶帽子 */
function stoCoatRack(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  cy(g, r * 0.55, r * 0.75, 0.035, tint(o.wood, -0.2), 0, 0.018, 0, null, 12);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2, arm = new THREE.Group();
    arm.position.set(0, 0.03, 0); arm.rotation.y = a; g.add(arm);
    bx(arm, 0.05, 0.035, r * 0.94, tint(o.wood, -0.1), 0, 0, r * 0.47);
  }
  cy(g, 0.026, 0.034, h - 0.1, o.wood, 0, (h - 0.1) / 2 + 0.05, 0, null, 10);                    // 立杆
  for (let i = 0; i < 4; i++) {                                                                   // 挂钩
    const a = i / 4 * Math.PI * 2, hk = new THREE.Group();
    hk.position.set(0, h - 0.14 - (i % 2) * 0.12, 0); hk.rotation.y = a; g.add(hk);
    cy(hk, 0.014, 0.014, 0.11, o.metal, 0, 0, 0.055, [Math.PI / 2.4, 0, 0], 6);
    sp(hk, 0.022, o.accent, 0, 0.03, 0.1);
  }
  cy(g, r * 0.5, r * 0.5, 0.06, o.color, 0.02, h - 0.02, 0, null, 12);                            // 帽子
  cy(g, r * 0.78, r * 0.78, 0.014, o.color, 0.02, h - 0.05, 0, null, 12);
  return g;
}

/** 自行车停放架：两个地面卡箍 + 一辆立着的自行车（两个轮子就是识别点） */
function stoBikeRack(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) {                                                                       // 卡箍
    bx(g, 0.05, 0.3, 0.05, o.metal, s * w * 0.22, 0.15, -d * 0.2);
    bx(g, w * 0.44 + 0.05, 0.05, 0.05, o.metal, 0, 0.3, -d * 0.2);
  }
  const wr = h * 0.3;                                                                              // 车轮（轴沿 Z，立在 XY 面里）
  for (const s of [-1, 1]) {
    cy(g, wr, wr, 0.035, DARK, s * (w / 2 - wr - 0.03), wr + 0.02, d * 0.1, [Math.PI / 2, 0, 0], 16);
    cy(g, wr * 0.28, wr * 0.28, 0.05, tint(o.metal, 0.2), s * (w / 2 - wr - 0.03), wr + 0.02, d * 0.1, [Math.PI / 2, 0, 0], 8);
  }
  const x0 = -(w / 2 - wr - 0.03), x1 = (w / 2 - wr - 0.03);
  bx(g, (x1 - x0) * 0.62, 0.04, 0.04, o.color, (x0 + x1) / 2, h * 0.62, d * 0.1, [0, 0, 0.18]);    // 上管
  bx(g, (x1 - x0) * 0.66, 0.04, 0.04, o.color, (x0 + x1) / 2, h * 0.4, d * 0.1, [0, 0, -0.1]);     // 下管
  bx(g, 0.04, h * 0.42, 0.04, o.color, x1 - 0.06, h * 0.5, d * 0.1, [0, 0, 0.22]);                 // 前叉
  bx(g, 0.16, 0.06, 0.05, tint(o.color, -0.2), x0 + 0.1, h * 0.78, d * 0.1);                       // 座
  cy(g, 0.016, 0.016, 0.3, DARK, x1 - 0.1, h * 0.86, d * 0.1, [Math.PI / 2, 0, 0], 6);             // 车把
  return g;
}

/** 玩具收纳箱 / 收纳箱：箱体 + 掀盖 + 两侧提手 + （玩具箱）露出来的玩具 */
function stoChest(kit, o, R, toys) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.82, d, o.color, 0, h * 0.41, 0);                                                   // 箱体
  bx(g, w * 1.02, h * 0.14, d * 1.02, tint(o.color, -0.18), 0, h * 0.89, 0);                        // 盖子
  bx(g, w * 0.96, h * 0.05, d * 0.98, tint(o.wood, 0.1), 0, h * 0.8, 0);                            // 盖沿
  for (const s of [-1, 1]) handleBar(g, Math.min(0.16, h * 0.3), o.metal, s * (w / 2 + 0.005), h * 0.42, 0, true);
  bx(g, w * 0.7, 0.03, d * 0.8, tint(o.accent, 0.1), 0, h * 0.97, 0);                               // 盖面装饰条
  if (toys) {                                                                                        // 露出来的玩具
    sp(g, 0.07, o.accent, -w * 0.22, h * 1.0, 0);
    bx(g, 0.09, 0.09, 0.09, tint(o.color, 0.3), w * 0.2, h * 1.0, d * 0.1, null);
    cy(g, 0.05, 0.05, 0.1, tint(o.accent, 0.25), w * 0.02, h * 1.0, -d * 0.15, null, 8);
  } else {
    for (let i = 0; i < 2; i++) bx(g, w * 1.005, 0.03, d * 0.06, o.metal, 0, h * (0.3 + i * 0.3), 0);  // 铁皮箍
  }
  return g;
}

// ---------------------------------------------------------------------------
// 7. 厨作专门造型
//    契约硬要求：冰箱要有门缝线和把手、灶台要有 4 个灶眼。这两件是整套
//    厨房里最容易被做成"一个白盒子"的东西，所以专门写死。
// ---------------------------------------------------------------------------

/** 双门冰箱：门缝把上下分成冷冻/冷藏两段 + 两根竖长把手 + 门封条 + 底脚 */
function cookFridge(kit, o, R, single) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.12);
  bx(g, w, h - 0.05, d, tint(steel, -0.12), 0, (h - 0.05) / 2 + 0.05, 0);                     // 箱体
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.022, 0.022, 0.05, DARK, sx * (w / 2 - 0.06), 0.025, sz * (d / 2 - 0.06), null, 6);
  const split = single ? 1 : 0.34;                                                             // 冷冻段占比
  const parts = single ? [[0.05, h - 0.05]] : [[h * (1 - split) + 0.03, h - 0.08], [0.06, h * (1 - split) - 0.02]];
  parts.forEach((p, i) => {
    const dh = p[1] - p[0], cyy = p[0] + dh / 2;
    bx(g, w * 0.98, dh, 0.035, steel, 0, cyy, d / 2 - 0.012);                                  // 门板
    bx(g, w * 0.9, dh - 0.05, 0.012, tint(steel, 0.1), 0, cyy, d / 2 + 0.008);                 // 门封条内框
    handleBar(g, Math.min(dh * 0.6, 0.6), tint(o.metal, 0.3), w * 0.34, cyy, d / 2 + 0.03, true);   // 竖长把手
  });
  if (!single) bx(g, w * 0.99, 0.014, 0.04, DARK, 0, h * (1 - split), d / 2 - 0.005);          // 门缝线
  bx(g, w * 0.3, 0.1, 0.02, SCREEN, -w * 0.24, h - 0.2, d / 2 + 0.014);                        // 门上小面板
  return g;
}

/** 四眼燃气灶台：灶面 + 4 个灶眼（火盖 + 井字架）+ 烤箱门带玻璃窗 + 4 个旋钮 */
function cookRange(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.1);
  bx(g, w, h - 0.1, d, steel, 0, (h - 0.1) / 2 + 0.06, 0);                                     // 机身
  bx(g, w * 0.94, 0.06, d * 0.9, DARK, 0, 0.03, 0);                                            // 踢脚
  bx(g, w, 0.05, d, tint(steel, -0.15), 0, h - 0.025, 0);                                      // 灶面板
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                        // 四个灶眼
    const x = sx * w * 0.24, z = sz * d * 0.22;
    cy(g, w * 0.115, w * 0.13, 0.02, DARK, x, h + 0.005, z, null, 14);                          // 火盖底盘
    cy(g, w * 0.06, w * 0.07, 0.026, tint(o.metal, -0.3), x, h + 0.022, z, null, 10);           // 火盖
    bx(g, w * 0.3, 0.012, 0.016, DARK, x, h + 0.03, z);                                         // 井字架
    bx(g, 0.016, 0.012, d * 0.3, DARK, x, h + 0.03, z);
  }
  const dh = (h - 0.16) * 0.72;
  bx(g, w * 0.94, dh, 0.026, tint(steel, 0.08), 0, dh / 2 + 0.08, d / 2 - 0.01);                // 烤箱门
  bx(g, w * 0.72, dh * 0.5, 0.012, SCREEN, 0, dh / 2 + 0.08, d / 2 + 0.008, null, { transparent: true, opacity: 0.75 });  // 观察窗
  handleBar(g, w * 0.8, tint(o.metal, 0.3), 0, dh + 0.11, d / 2 + 0.026, false);
  for (let i = 0; i < 4; i++) knob(g, 0.026, o.accent, (i - 1.5) * w * 0.2, h - 0.11, d / 2 + 0.014);   // 四个旋钮
  return g;
}

/** 嵌入式电磁灶：一整块黑玻璃面 + 4 个印在上面的加热圈 + 触摸条（只有 10cm 高） */
function cookHob(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.98, h * 0.5, d * 0.98, tint(o.metal, -0.2), 0, h * 0.25, 0);                      // 沉在台面里的机身
  bx(g, w, h * 0.35, d, SCREEN, 0, h * 0.68, 0);                                                // 黑玻璃面
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, w * 0.11, w * 0.11, 0.008, tint(o.accent, -0.1), sx * w * 0.24, h * 0.86, sz * d * 0.22, null, 16);  // 加热圈
  bx(g, w * 0.4, 0.006, d * 0.1, tint(o.accent, 0.3), 0, h * 0.86, -d * 0.4);                   // 触摸条
  return g;
}

/** 烤箱柜 / 商用烤炉：叠起来的炉膛 + 每层玻璃门 + 横把手 + 控制面板 */
function cookOven(kit, o, R, decks) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.1);
  bx(g, w, h * 0.94, d, steel, 0, h * 0.47 + h * 0.06, 0);                                      // 机身
  bx(g, w * 0.94, h * 0.06, d * 0.9, DARK, 0, h * 0.03, 0);
  const n = decks || 2, zone = h * 0.82;
  for (let i = 0; i < n; i++) {
    const dh = zone / n - 0.04, cyy = h * 0.08 + zone * (i + 0.5) / n;
    bx(g, w * 0.94, dh, 0.03, tint(steel, -0.08), 0, cyy, d / 2 - 0.012);                       // 炉门
    bx(g, w * 0.78, dh * 0.55, 0.014, SCREEN, 0, cyy, d / 2 + 0.006, null, { transparent: true, opacity: 0.72 });
    handleBar(g, w * 0.8, tint(o.metal, 0.32), 0, cyy + dh * 0.42, d / 2 + 0.026, false);
    if (decks) bx(g, w * 0.2, 0.05, 0.014, o.accent, w * 0.34, cyy - dh * 0.32, d / 2 + 0.01);  // 每层指示灯
  }
  bx(g, w * 0.94, h * 0.08, 0.03, tint(steel, 0.2), 0, h * 0.95, d / 2 - 0.012);                // 顶部控制面板
  for (let i = 0; i < 3; i++) knob(g, 0.024, o.accent, (i - 1) * w * 0.18, h * 0.95, d / 2 + 0.012);
  if (decks) cy(g, 0.06, 0.06, h * 0.12, tint(o.metal, -0.2), w * 0.36, h * 1.02, -d * 0.3, null, 8);   // 排烟管
  return g;
}

/** 面团醒发箱 / 立式冷柜：玻璃门 + 里面看得见的层架和东西 */
function cookGlassCab(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.08);
  bx(g, w, 0.1, d, DARK, 0, 0.05, 0);                                                            // 底座
  bx(g, w, h - 0.1, 0.06, steel, 0, (h + 0.1) / 2, -d / 2 + 0.03);                                // 背板
  for (const s of [-1, 1]) bx(g, 0.05, h - 0.1, d, steel, s * (w / 2 - 0.025), (h + 0.1) / 2, 0);  // 两侧立柱
  bx(g, w, 0.1, d, steel, 0, h - 0.05, 0);                                                        // 顶罩
  glassBox(g, w * 0.92, h - 0.26, 0.04, 0, (h + 0.1) / 2, d / 2 - 0.03);                          // 玻璃门
  handleBar(g, (h - 0.3) * 0.4, tint(o.metal, 0.3), w * 0.34, h * 0.55, d / 2 + 0.01, true);
  const n = opt.racks || 4;
  for (let i = 0; i < n; i++) {
    const y = 0.16 + (h - 0.34) * i / n;
    bx(g, w * 0.88, 0.02, d * 0.82, tint(steel, 0.15), 0, y, -0.01);                              // 层架
    for (let k = 0; k < 3; k++) {                                                                  // 架上的东西
      const c = [o.color, o.accent, tint(o.color, 0.25)][k];
      if (opt.bottles) cy(g, 0.032, 0.036, 0.2, c, (k - 1) * w * 0.24, y + 0.11, -0.01, null, 8);
      else bx(g, w * 0.22, 0.09, d * 0.4, c, (k - 1) * w * 0.24, y + 0.055, -0.01);
    }
  }
  bx(g, w * 0.8, 0.03, 0.05, BULB, 0, h - 0.12, d * 0.2, null, { emissive: BULB, emissiveIntensity: 0.5 });  // 柜内灯
  return g;
}

/** 落地和面机：底座 + 立柱 + 悬臂机头 + 一个大搅拌缸 + 搅拌钩 */
function cookMixer(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.1);
  bx(g, w * 0.9, 0.12, d * 0.8, DARK, 0, 0.06, 0);                                                // 底座
  bx(g, w * 0.5, h * 0.62, d * 0.4, steel, 0, h * 0.31 + 0.12, -d * 0.24);                        // 立柱
  bx(g, w * 0.8, h * 0.18, d * 0.55, steel, 0, h * 0.86, -d * 0.02);                              // 机头
  cy(g, w * 0.4, w * 0.34, h * 0.4, tint(o.metal, 0.25), 0, h * 0.36, d * 0.14, null, 16);         // 搅拌缸
  cy(g, w * 0.42, w * 0.42, 0.03, tint(o.metal, 0.35), 0, h * 0.56, d * 0.14, null, 16);           // 缸口
  cy(g, 0.03, 0.05, h * 0.24, tint(o.metal, -0.1), 0, h * 0.63, d * 0.14, null, 8);                // 搅拌钩
  knob(g, 0.03, o.accent, w * 0.28, h * 0.86, d * 0.26);
  return g;
}

/** 抽油烟罩：斜面罩体（三段）+ 上方排烟管 + 底面滤网条 + 两盏灯 */
function cookHood(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.18);
  bx(g, w, h * 0.28, d, steel, 0, h * 0.14, 0);                                                    // 罩体下沿
  for (let i = 0; i < 3; i++) bx(g, w, h * 0.14, d * (0.86 - i * 0.22), steel, 0, h * (0.34 + i * 0.13), -d * i * 0.09, [-0.22, 0, 0]);  // 斜面
  bx(g, w * 0.34, h * 0.3, d * 0.3, tint(steel, -0.1), 0, h * 0.85, -d * 0.2);                     // 排烟管
  for (let i = 0; i < 3; i++) bx(g, w * 0.28, 0.012, d * 0.7, DARK, (i - 1) * w * 0.3, 0.006, 0);  // 滤网条
  for (const s of [-1, 1]) cy(g, 0.035, 0.035, 0.02, BULB, s * w * 0.3, 0.008, d * 0.28, null, 10, { emissive: BULB, emissiveIntensity: 0.6 });
  return g;
}

/** 户外烧烤炉：炉身 + 半球形炉盖 + 铁篦子 + 侧板 + 轮子 */
function cookGrill(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.66, h * 0.42, d * 0.9, tint(o.metal, -0.1), 0, h * 0.28, 0);                          // 炉身
  for (const s of [-1, 1]) cy(g, h * 0.07, h * 0.07, 0.05, DARK, s * w * 0.26, h * 0.07, d * 0.3, [Math.PI / 2, 0, 0], 10);  // 轮子
  for (let i = 0; i < 5; i++) bx(g, w * 0.6, 0.012, 0.016, DARK, 0, h * 0.5, (i - 2) * d * 0.16);   // 铁篦子
  sp(g, w * 0.33, o.color, 0, h * 0.52, 0, [1, 0.95, d * 0.9 / (w * 0.66)]);                        // 半球炉盖
  cy(g, 0.03, 0.03, 0.12, DARK, 0, h * 0.86, d * 0.16, [0.4, 0, 0], 6);                             // 盖把手
  bx(g, w * 0.24, 0.03, d * 0.6, tint(o.wood, 0.1), w * 0.42, h * 0.5, 0);                          // 侧操作板
  return g;
}

/** 水槽柜（单槽/双槽）：柜体 + 台面 + 下沉的槽 + 弯脖水龙头 + 柜门 */
function cookSink(kit, o, R, twin) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.2);
  bx(g, w * 0.94, 0.07, d * 0.88, DARK, 0, 0.035, 0);
  bx(g, w, h - 0.11, d, tint(o.color, -0.08), 0, (h - 0.11) / 2 + 0.07, 0);                          // 柜体
  bx(g, w, 0.04, d, steel, 0, h - 0.02, 0);                                                          // 台面
  const bs = twin ? [-1, 1] : [0];
  for (const s of bs) {                                                                              // 水槽（下沉的盆）
    const bw = twin ? w * 0.38 : w * 0.6;
    bx(g, bw, 0.1, d * 0.62, tint(steel, -0.2), s * w * 0.22, h - 0.09, 0.02);
    bx(g, bw * 0.9, 0.02, d * 0.56, tint(steel, -0.35), s * w * 0.22, h - 0.13, 0.02);                // 槽底
    cy(g, 0.022, 0.022, 0.02, DARK, s * w * 0.22, h - 0.12, 0.02, null, 8);                           // 下水口
  }
  cy(g, 0.018, 0.02, 0.26, steel, 0, h + 0.13, -d * 0.3, null, 8);                                    // 龙头立管
  cy(g, 0.016, 0.016, 0.16, steel, 0, h + 0.25, -d * 0.22, [Math.PI / 2.2, 0, 0], 8);                 // 弯脖
  knob(g, 0.02, o.accent, 0.07, h + 0.06, -d * 0.34);
  for (const s of [-1, 1]) {                                                                          // 柜门
    bx(g, w * 0.46, h * 0.6, 0.022, o.color, s * w * 0.24, h * 0.42, d / 2 - 0.008);
    handleBar(g, 0.16, o.metal, s * w * 0.06, h * 0.6, d / 2 + 0.022, true);
  }
  return g;
}

/** 不锈钢操作台 / 砧板台：钢台面 + 四条钢腿 + 下层板 + 挡水板（+ 砧板与刀） */
function cookPrep(kit, o, R, board) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.2);
  legs4(g, w, d, h - 0.05, 0.024, tint(steel, -0.15), 0.07, false);
  bx(g, w * 0.92, 0.028, d * 0.86, tint(steel, -0.1), 0, 0.22, 0);                                    // 下层板
  bx(g, w * 0.9, 0.024, d * 0.84, tint(steel, -0.05), 0, 0.5, 0);                                     // 中层板
  bx(g, w, 0.05, d, steel, 0, h - 0.025, 0);                                                          // 台面
  bx(g, w, 0.12, 0.03, tint(steel, -0.08), 0, h + 0.06, -d / 2 + 0.015);                              // 挡水板
  if (board) {
    bx(g, w * 0.5, 0.035, d * 0.5, tint(o.wood, 0.15), 0, h + 0.018, d * 0.06);                       // 砧板
    bx(g, 0.02, 0.012, 0.22, tint(o.metal, 0.35), w * 0.06, h + 0.042, d * 0.06);                     // 刀身
    bx(g, 0.024, 0.02, 0.1, DARK, w * 0.06, h + 0.045, d * 0.06 - 0.16);                              // 刀柄
  } else {
    for (let i = 0; i < 3; i++) cy(g, 0.05, 0.055, 0.1, tint(steel, 0.1), (i - 1) * w * 0.2, h + 0.05, 0, null, 10);  // 几个盆
  }
  return g;
}

/** 调料架 / 糖浆导轨：一块背板 + 层板 + 一排瓶子（瓶子是它的识别点） */
function cookRack(kit, o, R, pump) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, 0.022, tint(o.wood, -0.05), 0, h / 2, -0.011);                                          // 背板
  const rows = h > 0.5 ? 2 : 1;
  for (let r0 = 0; r0 < rows; r0++) {
    const y = h * (rows === 1 ? 0.18 : 0.14 + r0 * 0.46);
    bx(g, w * 0.96, 0.02, d * 0.7, tint(o.wood, 0.12), 0, y, d * 0.16);                               // 层板
    for (let i = 0; i < 4; i++) {
      const c = [o.color, o.accent, tint(o.color, 0.28), tint(o.accent, -0.15)][i];
      cy(g, w * 0.05, w * 0.055, h * (rows === 1 ? 0.5 : 0.24), c, (i - 1.5) * w * 0.22, y + h * (rows === 1 ? 0.26 : 0.13), d * 0.16, null, 8);
      if (pump) cy(g, 0.008, 0.008, 0.05, o.metal, (i - 1.5) * w * 0.22, y + h * 0.28, d * 0.16, null, 5);
    }
  }
  return g;
}

/** 挂锅杆：一根横杆 + 挂钩 + 三口挂着的锅（锅柄朝外） */
function cookPotHanger(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, 0.016, 0.016, w * 0.96, o.metal, 0, h - 0.04, 0, [0, 0, Math.PI / 2], 8);                     // 横杆
  for (const s of [-1, 1]) bx(g, 0.04, h * 0.34, 0.04, tint(o.metal, -0.2), s * (w / 2 - 0.02), h - 0.17, 0);  // 端头吊臂
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.28, c = [tint(o.metal, 0.15), o.color, tint(o.metal, -0.1)][i];
    cy(g, 0.007, 0.007, 0.07, o.metal, x, h - 0.08, 0, null, 5);                                       // 挂钩
    cy(g, h * 0.2, h * 0.17, h * 0.3, c, x, h * 0.6, 0, null, 12);                                     // 锅身
    cy(g, 0.012, 0.012, h * 0.32, DARK, x + h * 0.24, h * 0.62, 0, [0, 0, Math.PI / 2.4], 6);          // 锅柄
  }
  return g;
}

/** 洗衣机 / 烘干机 / 洗碗机门：机身 + 圆形舱门 + 控制面板 + 旋钮 + 底脚 */
function cookMachine(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.14);
  bx(g, w, h - 0.05, d, steel, 0, (h - 0.05) / 2 + 0.05, 0);                                            // 机身
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.02, 0.02, 0.05, DARK, sx * (w / 2 - 0.06), 0.025, sz * (d / 2 - 0.06), null, 6);
  bx(g, w * 0.96, h * 0.16, 0.03, tint(steel, 0.2), 0, h - 0.1, d / 2 - 0.012);                         // 控制面板
  for (let i = 0; i < 3; i++) knob(g, 0.022, o.accent, (i - 1) * w * 0.2, h - 0.1, d / 2 + 0.01);
  if (opt.flat) {                                                                                        // 洗碗机：一整块平门 + 横把手
    bx(g, w * 0.96, h * 0.66, 0.028, tint(o.color, -0.05), 0, h * 0.38, d / 2 - 0.008);
    handleBar(g, w * 0.8, tint(o.metal, 0.3), 0, h * 0.68, d / 2 + 0.024, false);
  } else {                                                                                               // 滚筒：圆舱门
    const r = Math.min(w, h) * 0.3;
    cy(g, r, r, 0.05, tint(steel, -0.1), 0, h * 0.45, d / 2 - 0.005, [Math.PI / 2, 0, 0], 16);
    cy(g, r * 0.72, r * 0.72, 0.055, SCREEN, 0, h * 0.45, d / 2 + 0.004, [Math.PI / 2, 0, 0], 16, { transparent: true, opacity: 0.62 });
    cy(g, 0.022, 0.022, 0.05, tint(o.metal, 0.3), -r * 0.95, h * 0.45, d / 2 + 0.01, [Math.PI / 2, 0, 0], 8);
  }
  return g;
}

/** 洗衣池 / 水房池：深盆 + 四条支腿 + 高身水龙头 + 下水管 */
function cookTub(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const basinY = h * 0.66;
  legs4(g, w, d, basinY, 0.022, o.metal, 0.06, false);
  bx(g, w, h - basinY, d, tint(o.color, 0.2), 0, (h + basinY) / 2, 0);                                    // 盆体
  bx(g, w * 0.86, (h - basinY) * 0.7, d * 0.82, tint(o.color, -0.1), 0, (h + basinY) / 2 + 0.03, 0);      // 盆内凹
  cy(g, 0.02, 0.02, 0.24, o.metal, 0, h + 0.1, -d * 0.32, null, 8);                                        // 龙头
  cy(g, 0.016, 0.016, 0.14, o.metal, 0, h + 0.21, -d * 0.24, [Math.PI / 2.2, 0, 0], 8);
  cy(g, 0.03, 0.03, basinY * 0.8, tint(o.metal, -0.2), 0, basinY * 0.4, 0, null, 8);                       // 下水管
  return g;
}

// ---------------------------------------------------------------------------
// 8. 餐吧专门造型
// ---------------------------------------------------------------------------

/** 服务吧身：吧身 + 出挑台面 + 正面竖木条 + 强调腰线 + 脚踏杆 + 台上小物 */
function barBody(kit, o, R) {
  const g = genBar(kit, o, R), { w, h, d } = kit;
  cy(g, 0.05, 0.045, 0.12, PAPER, -w * 0.3, h + 0.06, -d * 0.05, null, 10);            // 台上的杯子
  cy(g, 0.05, 0.045, 0.12, PAPER, -w * 0.3 + 0.12, h + 0.06, -d * 0.05, null, 10);
  bx(g, w * 0.16, 0.06, d * 0.4, tint(o.wood, -0.1), w * 0.3, h + 0.03, 0);            // 托盘
  return g;
}

/** 双头商用咖啡机：机身 + 两个冲煮头 + 两个手柄 + 蒸汽棒 + 滴水盘 + 顶上倒扣的杯子 */
function barEspresso(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const steel = tint(o.metal, 0.25);
  bx(g, w, h * 0.62, d * 0.9, steel, 0, h * 0.31 + h * 0.14, -d * 0.02);                 // 机身
  bx(g, w * 0.96, h * 0.14, d * 0.94, DARK, 0, h * 0.07, 0);                             // 滴水盘座
  for (let i = 0; i < 5; i++) bx(g, w * 0.14, 0.012, d * 0.5, tint(steel, -0.3), (i - 2) * w * 0.17, h * 0.145, d * 0.08);  // 滴水格栅
  for (const s of [-1, 1]) {                                                              // 两个冲煮头 + 手柄
    cy(g, 0.045, 0.05, h * 0.14, tint(steel, -0.15), s * w * 0.24, h * 0.24, d * 0.28, null, 10);
    cy(g, 0.03, 0.03, 0.12, DARK, s * w * 0.24, h * 0.19, d * 0.42, [Math.PI / 2, 0, 0], 8);
  }
  cy(g, 0.012, 0.012, h * 0.34, tint(steel, 0.1), w * 0.44, h * 0.3, d * 0.2, [0.35, 0, 0], 6);   // 蒸汽棒
  bx(g, w * 0.9, 0.03, d * 0.7, tint(steel, -0.05), 0, h * 0.78, -d * 0.02);                       // 顶部置杯板
  for (let i = 0; i < 4; i++) cy(g, 0.035, 0.03, 0.07, PAPER, (i - 1.5) * w * 0.2, h * 0.83, -d * 0.02, null, 8);
  bx(g, w * 0.3, 0.06, 0.02, o.accent, 0, h * 0.55, d * 0.42);                                     // 面板灯条
  return g;
}

/** 磨豆机：底座 + 机身 + 透明豆仓（上大下小的锥）+ 出粉口 */
function barGrinder(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.12, d, DARK, 0, h * 0.06, 0);                                          // 底座
  bx(g, w * 0.86, h * 0.42, d * 0.8, tint(o.metal, 0.2), 0, h * 0.33, 0);                // 机身
  cy(g, w * 0.44, w * 0.2, h * 0.4, GLASS, 0, h * 0.74, 0, null, 12, { transparent: true, opacity: 0.4 });  // 豆仓
  cy(g, w * 0.2, w * 0.2, 0.03, tint(o.wood, -0.2), 0, h * 0.55, 0, null, 12);            // 仓底豆
  bx(g, w * 0.3, h * 0.1, d * 0.2, tint(o.metal, -0.15), 0, h * 0.18, d * 0.4);           // 出粉口
  knob(g, 0.018, o.accent, w * 0.3, h * 0.36, d * 0.4);
  return g;
}

/** 点心展示柜 / 馅饼保温柜：底柜 + 玻璃罩 + 层板 + 一排看得见的点心 */
function barCase(kit, o, R, warm) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const baseH = h * 0.34;
  bx(g, w, baseH, d, tint(o.color, -0.12), 0, baseH / 2, 0);                              // 底柜
  bx(g, w * 1.01, 0.04, d * 1.02, tint(o.wood, 0.12), 0, baseH + 0.02, 0);
  for (const s of [-1, 1]) bx(g, 0.035, h - baseH - 0.04, d, tint(o.metal, 0.1), s * (w / 2 - 0.018), (h + baseH) / 2, 0);   // 罩子立柱
  glassBox(g, w * 0.94, h - baseH - 0.08, d * 0.96, 0, (h + baseH) / 2, 0);                // 玻璃罩
  bx(g, w, 0.05, d, tint(o.metal, 0.15), 0, h - 0.025, 0);                                 // 顶板
  for (let i = 0; i < 2; i++) {
    const y = baseH + 0.08 + i * (h - baseH - 0.2) * 0.55;
    bx(g, w * 0.9, 0.02, d * 0.8, tint(o.metal, 0.25), 0, y, 0);                            // 层板
    for (let k = 0; k < 4; k++) {                                                            // 点心
      const c = [o.color, o.accent, tint(o.color, 0.3), tint(o.accent, 0.25)][k];
      cy(g, w * 0.075, w * 0.08, 0.07, c, (k - 1.5) * w * 0.2, y + 0.045, 0, null, 10);
      sp(g, w * 0.03, tint(c, 0.4), (k - 1.5) * w * 0.2, y + 0.09, 0);
    }
  }
  if (warm) bx(g, w * 0.8, 0.025, 0.05, FLAME, 0, h - 0.08, 0, null, { emissive: FLAME, emissiveIntensity: 0.55 });  // 保温灯
  return g;
}

/** 面包货架：立框 + 五层斜置层板 + 一堆面包（斜板 + 面包 = 它的识别点） */
function barBreadRack(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    bx(g, 0.04, h, 0.04, o.wood, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02));
  bx(g, w, 0.05, d * 0.3, tint(o.wood, 0.1), 0, h - 0.025, -d * 0.35);                        // 顶板
  for (let i = 0; i < 5; i++) {
    const y = 0.16 + i * (h - 0.28) / 5;
    bx(g, w * 0.94, 0.025, d * 0.9, tint(o.wood, 0.08), 0, y, 0, [-0.3, 0, 0]);                // 斜层板
    for (let k = 0; k < 3; k++)                                                                // 面包
      sp(g, w * 0.11, tint(o.wood, 0.3 - k * 0.06), (k - 1) * w * 0.28, y + 0.1 + k * 0.004, -d * 0.04, [1, 0.62, 0.7]);
  }
  return g;
}

/** 收银机台：台身 + 台面 + 一台带斜屏的收银机 + 钱箱缝 */
function barRegister(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const topY = h * 0.68;
  bx(g, w, topY, d, tint(o.color, -0.1), 0, topY / 2, 0);                                       // 台身
  bx(g, w * 1.02, 0.045, d * 1.03, tint(o.wood, 0.14), 0, topY + 0.022, 0);                     // 台面
  bx(g, w * 0.9, 0.05, 0.02, DARK, 0, topY * 0.6, d / 2 - 0.006);                               // 钱箱缝
  handleBar(g, w * 0.4, o.metal, 0, topY * 0.6, d / 2 + 0.016, false);
  bx(g, w * 0.7, h * 0.14, d * 0.6, tint(o.metal, 0.1), 0, topY + 0.1, -d * 0.05);              // 机身
  bx(g, w * 0.62, h * 0.2, 0.03, SCREEN, 0, topY + 0.24, -d * 0.16, [-0.35, 0, 0]);             // 斜屏
  for (let i = 0; i < 3; i++) bx(g, w * 0.16, 0.02, d * 0.1, tint(o.accent, 0.2), (i - 1) * w * 0.2, topY + 0.17, d * 0.12);  // 按键
  return g;
}

/** 酒龙头塔：底盘 + 圆柱塔身 + 三个朝 +Z 的龙头 + 接酒格栅 */
function barTap(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, w * 0.3, w * 0.42, 0.05, tint(o.metal, -0.1), 0, 0.025, 0, null, 12);
  cy(g, w * 0.22, w * 0.26, h * 0.8, tint(o.metal, 0.28), 0, h * 0.4 + 0.05, 0, null, 12);       // 塔身
  cy(g, w * 0.28, w * 0.28, 0.04, tint(o.metal, 0.35), 0, h - 0.02, 0, null, 12);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.24;
    cy(g, 0.014, 0.014, 0.1, tint(o.metal, 0.3), x, h * 0.6, d * 0.16, [Math.PI / 2, 0, 0], 6);  // 龙头管
    cy(g, 0.012, 0.012, 0.07, o.color, x, h * 0.66, d * 0.22, [0.3, 0, 0], 6);                   // 拉柄
    sp(g, 0.02, o.accent, x, h * 0.72, d * 0.24);
  }
  for (let i = 0; i < 3; i++) bx(g, w * 0.7, 0.01, 0.02, DARK, 0, 0.055, d * (0.1 + i * 0.1));    // 格栅
  return g;
}

/** 榨汁机组：底座 + 机身 + 长压杆 + 出汁口 + 一杯果汁 */
function barJuicer(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, w * 0.42, w * 0.5, h * 0.12, tint(o.metal, -0.05), 0, h * 0.06, 0, null, 12);
  cy(g, w * 0.24, w * 0.3, h * 0.5, tint(o.metal, 0.25), 0, h * 0.37, -d * 0.05, null, 12);       // 立柱
  cy(g, w * 0.34, w * 0.34, h * 0.16, o.color, 0, h * 0.66, -d * 0.05, null, 12);                 // 机头
  bx(g, w * 0.7, 0.035, 0.035, tint(o.metal, 0.2), w * 0.18, h * 0.82, -d * 0.05, [0, 0, -0.3]);  // 压杆
  sp(g, 0.03, o.accent, w * 0.5, h * 0.9, -d * 0.05);                                             // 压杆头
  cy(g, 0.035, 0.03, h * 0.3, tint(o.accent, 0.25), 0, h * 0.27, d * 0.2, null, 10);              // 果汁杯
  return g;
}

/** 蛋糕玻璃罩座：底盘 + 短柱 + 托盘 + 一块蛋糕 + 半球玻璃罩 */
function barCakeStand(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  cy(g, r * 0.4, r * 0.55, h * 0.1, tint(o.wood, -0.1), 0, h * 0.05, 0, null, 12);
  cy(g, r * 0.16, r * 0.16, h * 0.2, tint(o.wood, 0.05), 0, h * 0.2, 0, null, 8);
  cy(g, r, r * 0.98, h * 0.06, tint(o.wood, 0.18), 0, h * 0.33, 0, null, 16);                     // 托盘
  cy(g, r * 0.62, r * 0.66, h * 0.28, o.color, 0, h * 0.5, 0, null, 14);                          // 蛋糕
  cy(g, r * 0.62, r * 0.62, 0.02, tint(o.accent, 0.3), 0, h * 0.65, 0, null, 14);                 // 糖霜
  sp(g, r * 0.92, GLASS, 0, h * 0.42, 0, [1, 0.72, 1], { transparent: true, opacity: 0.24 });     // 玻璃罩
  return g;
}

/** 杯具挂架：立框 + 三层板 + 一排杯子（口朝下） */
function barCupShelf(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) bx(g, 0.035, h, d * 0.9, o.wood, s * (w / 2 - 0.018), h / 2, 0);
  bx(g, w, 0.04, d * 0.9, tint(o.wood, 0.12), 0, h - 0.02, 0);
  for (let i = 0; i < 3; i++) {
    const y = h * (0.22 + i * 0.26);
    bx(g, w * 0.94, 0.024, d * 0.86, tint(o.wood, 0.06), 0, y, 0);
    for (let k = 0; k < 4; k++) cy(g, w * 0.055, w * 0.045, h * 0.09, k % 2 ? PAPER : tint(o.color, 0.3), (k - 1.5) * w * 0.22, y + h * 0.055, 0, null, 10);
  }
  return g;
}

/** 手写黑板菜单 / 教学黑板：木框 + 黑板面 + 几行"粉笔字" + 粉笔槽 */
function barChalk(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const f = wallPanel(g, w, h, d, o.wood, 0x24312c);                                              // 框 + 板面
  for (let i = 0; i < 4; i++) bx(g, w * (0.62 - (i % 2) * 0.2), 0.018, 0.006, PAPER, -w * 0.06, h * (0.72 - i * 0.16), f.fd * 0.28 + 0.004);  // 粉笔字行
  bx(g, w * 0.9, 0.03, Math.min(0.05, d * 0.8), tint(o.wood, -0.15), 0, h * 0.06, f.fd * 0.35);   // 粉笔槽
  bx(g, 0.05, 0.016, 0.016, PAPER, -w * 0.3, h * 0.09, f.fd * 0.35);                              // 一根粉笔
  return g;
}

/** 立式菜单牌：底盘 + 立杆 + 带框的牌面 + 几行字 */
function barMenuSign(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, w * 0.36, w * 0.46, 0.045, tint(o.metal, -0.15), 0, 0.022, 0, null, 12);                  // 底盘
  cy(g, 0.022, 0.026, h * 0.55, o.metal, 0, h * 0.28, 0, null, 8);                                // 立杆
  const bh = h * 0.42, byc = h - bh / 2 - 0.03;
  bx(g, w * 0.94, bh, Math.min(0.05, d * 0.4), o.wood, 0, byc, 0);                                 // 牌框
  bx(g, w * 0.82, bh * 0.86, Math.min(0.03, d * 0.3), tint(o.color, 0.25), 0, byc, 0.012);         // 牌面
  for (let i = 0; i < 3; i++) bx(g, w * (0.6 - i * 0.12), 0.02, 0.008, tint(o.accent, -0.1), 0, byc + bh * (0.28 - i * 0.2), 0.026);
  return g;
}

// ---------------------------------------------------------------------------
// 9. 灯具专门造型
//    契约硬要求：吊灯要有灯绳。吊灯没有那根绳就成了浮在空中的碗。
// ---------------------------------------------------------------------------

/** 吊灯（单头/工业搪瓷）：天花底盘 + 灯绳 + 灯罩 + 会亮的灯泡 */
function litPendant(kit, o, R, wide) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w, d) / 2;
  cy(g, 0.05, 0.05, 0.03, tint(o.metal, -0.1), 0, h - 0.015, 0, null, 10);                       // 天花底盘
  cy(g, 0.008, 0.008, h * 0.42, DARK, 0, h * 0.78, 0, null, 5);                                   // 灯绳
  const shadeH = wide ? h * 0.32 : h * 0.44, shadeY = h * 0.55 - shadeH / 2;
  cy(g, wide ? r * 0.3 : r * 0.4, r, shadeH, o.color, 0, shadeY, 0, null, 16);                     // 灯罩
  cy(g, r * 0.99, r * 0.99, 0.015, tint(o.color, 0.35), 0, shadeY - shadeH / 2 + 0.008, 0, null, 16);  // 罩口反光圈
  sp(g, r * 0.36, BULB, 0, shadeY - shadeH * 0.45, 0, null, { emissive: BULB, emissiveIntensity: 0.7 });
  return g;
}

/** 三头吊灯组：一根顶杆 + 三根不等长的灯绳 + 三个灯罩（错落是它的识别点） */
function litCluster(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w / 3, d) * 0.42;
  bx(g, w * 0.9, 0.035, 0.05, tint(o.metal, -0.1), 0, h - 0.02, 0);                                // 顶杆
  const drop = [0.34, 0.55, 0.42];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.33, y = h - h * drop[i];
    cy(g, 0.007, 0.007, h * drop[i] - r * 0.5, DARK, x, (h + y + r * 0.5) / 2 - 0.01, 0, null, 5);  // 灯绳
    cy(g, r * 0.4, r, r * 1.1, i === 1 ? o.accent : o.color, x, y, 0, null, 14);                    // 灯罩
    sp(g, r * 0.34, BULB, x, y - r * 0.5, 0, null, { emissive: BULB, emissiveIntensity: 0.7 });
  }
  return g;
}

/** 落地灯 / 台灯：底盘 + 灯杆 + 梯形灯罩 + 灯泡 */
function litLamp(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w, d) / 2;
  cy(g, r * 0.9, r, 0.04, tint(o.metal, -0.15), 0, 0.02, 0, null, 14);                              // 底盘
  cy(g, 0.014, 0.02, h * 0.78, o.metal, 0, h * 0.4, 0, null, 8);                                     // 灯杆
  const sh = h * 0.22;
  cy(g, r * 0.68, r, sh, o.color, 0, h - sh * 0.6, 0, null, 16);                                     // 灯罩
  cy(g, r * 0.98, r * 0.98, 0.012, tint(o.color, 0.4), 0, h - sh * 1.08, 0, null, 16);
  sp(g, r * 0.3, BULB, 0, h - sh * 0.9, 0, null, { emissive: BULB, emissiveIntensity: 0.65 });
  return g;
}

/** 钓鱼式弧形落地灯：一头是重底盘、一头是伸出去的罩，中间用五段拼出弧 */
function litArc(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit;
  const x0 = -w * 0.35, x1 = w * 0.36;
  cy(g, w * 0.13, w * 0.15, 0.06, tint(o.metal, -0.2), x0, 0.03, 0, null, 14);                       // 重底盘
  cy(g, 0.018, 0.024, h * 0.68, o.metal, x0, h * 0.34, 0, null, 8);                                  // 立杆
  for (let i = 0; i < 5; i++) {                                                                       // 五段弧
    const t = i / 5, t2 = (i + 1) / 5;
    const ax = x0 + (x1 - x0) * (t * t * 0.5 + t * 0.5), ay = h * 0.68 + (h * 0.92 - h * 0.68) * Math.sin(t * 1.5);
    const bxp = x0 + (x1 - x0) * (t2 * t2 * 0.5 + t2 * 0.5), byp = h * 0.68 + (h * 0.92 - h * 0.68) * Math.sin(t2 * 1.5);
    const len = Math.hypot(bxp - ax, byp - ay);
    cy(g, 0.016, 0.016, len * 1.15, o.metal, (ax + bxp) / 2, (ay + byp) / 2, 0, [0, 0, -Math.atan2(bxp - ax, byp - ay)], 6);
  }
  const r = w * 0.12;
  cy(g, r * 0.5, r, r * 1.2, o.color, x1, h * 0.84, 0, null, 14);                                     // 灯罩
  sp(g, r * 0.4, BULB, x1, h * 0.78, 0, null, { emissive: BULB, emissiveIntensity: 0.7 });
  return g;
}

/** 夹持式书桌灯：夹钳 + 两节连杆 + 灯头（关节结构是它的识别点） */
function litDesk(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const x0 = -w * 0.4;
  bx(g, w * 0.16, h * 0.16, d * 0.6, tint(o.metal, -0.1), x0, h * 0.08, 0);                            // 夹钳
  bx(g, w * 0.1, 0.03, d * 0.5, tint(o.metal, -0.25), x0, h * 0.02, 0);
  cy(g, 0.014, 0.016, h * 0.45, o.metal, x0, h * 0.38, 0, null, 6);                                    // 下臂
  cy(g, 0.013, 0.013, w * 0.5, o.metal, x0 + w * 0.24, h * 0.72, 0, [0, 0, Math.PI / 2.6], 6);          // 上臂
  sp(g, 0.026, tint(o.metal, -0.2), x0, h * 0.6, 0);                                                   // 关节
  cy(g, w * 0.16, w * 0.1, h * 0.2, o.color, w * 0.3, h * 0.75, 0, [0.6, 0, 0], 12);                    // 灯头
  sp(g, 0.03, BULB, w * 0.29, h * 0.68, 0.02, null, { emissive: BULB, emissiveIntensity: 0.7 });
  return g;
}

/** 壁灯：贴墙背板 + 短臂 + 朝上的小罩 + 灯泡（整件只有 18cm 宽） */
function litSconce(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.7, h * 0.6, 0.022, tint(o.metal, -0.1), 0, h * 0.42, -d * 0.32);                          // 背板
  cy(g, 0.012, 0.012, d * 0.5, o.metal, 0, h * 0.5, -d * 0.1, [Math.PI / 2, 0, 0], 6);                  // 臂
  cy(g, w * 0.42, w * 0.24, h * 0.32, o.color, 0, h * 0.78, d * 0.08, null, 12);                        // 罩
  sp(g, w * 0.2, BULB, 0, h * 0.68, d * 0.08, null, { emissive: BULB, emissiveIntensity: 0.7 });
  return g;
}

/** 串灯：一根下垂的线 + 一串小灯泡（线的弧度就是它的识别点） */
function litString(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit;
  const n = Math.max(5, Math.round(w / 0.32));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, tx = (t - 0.5) * w;
    const sag = h * 0.86 - Math.sin(t * Math.PI) * h * 0.2;
    cy(g, 0.005, 0.005, w / n * 1.1, DARK, tx, sag, 0, [0, 0, Math.PI / 2 + (t - 0.5) * 0.5], 4);       // 线段
    sp(g, h * 0.2, BULB, tx, sag - h * 0.28, 0, null, { emissive: BULB, emissiveIntensity: 0.8 });      // 灯泡
  }
  return g;
}

/** 霓虹灯牌：底板 + 弯折的发光管（三段）+ 一个圆点 */
function litNeon(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, 0.022, DARK, 0, h / 2, -0.012);                                                            // 底板
  const em = { emissive: o.accent, emissiveIntensity: 0.9 };
  cy(g, 0.012, 0.012, w * 0.7, o.accent, -w * 0.08, h * 0.68, 0.006, [0, 0, Math.PI / 2], 6, em);
  cy(g, 0.012, 0.012, w * 0.45, o.accent, -w * 0.2, h * 0.36, 0.006, [0, 0, Math.PI / 2], 6, em);
  cy(g, 0.012, 0.012, h * 0.4, o.accent, w * 0.26, h * 0.48, 0.006, null, 6, em);
  sp(g, 0.03, tint(o.accent, 0.4), w * 0.36, h * 0.7, 0.006, null, em);
  return g;
}

/** 烛簇：托盘 + 三支不等高的蜡烛 + 三点火苗 */
function litCandles(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  cy(g, r, r * 0.9, h * 0.1, tint(o.metal, 0.1), 0, h * 0.05, 0, null, 14);                              // 托盘
  const hs = [0.62, 0.86, 0.5];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2, x = Math.cos(a) * r * 0.45, z = Math.sin(a) * r * 0.45;
    cy(g, r * 0.16, r * 0.17, h * hs[i], PAPER, x, h * 0.1 + h * hs[i] / 2, z, null, 10);                 // 蜡烛
    sp(g, r * 0.09, FLAME, x, h * (0.13 + hs[i]), z, [1, 1.7, 1], { emissive: FLAME, emissiveIntensity: 0.9 });  // 火苗
  }
  return g;
}

/** 天光洗墙灯 / 轨道射灯：一根铝槽 + 灯珠/射灯头 */
function litRail(kit, o, R, spots) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.42, d * 0.7, tint(o.metal, -0.05), 0, h * 0.79, 0);                                      // 铝槽
  for (const s of [-1, 1]) bx(g, 0.03, h * 0.5, d * 0.72, tint(o.metal, -0.2), s * (w / 2 - 0.015), h * 0.75, 0);  // 端盖
  if (spots) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * w * 0.3;
      cy(g, h * 0.22, h * 0.26, h * 0.5, o.color, x, h * 0.3, 0, null, 10);                                // 射灯头
      cy(g, h * 0.18, h * 0.18, 0.012, BULB, x, h * 0.06, 0, null, 10, { emissive: BULB, emissiveIntensity: 0.85 });
    }
  } else {
    bx(g, w * 0.94, h * 0.2, d * 0.5, BULB, 0, h * 0.46, 0, null, { emissive: BULB, emissiveIntensity: 0.8 });   // 灯带
  }
  return g;
}

/** 纸灯：灯绳 + 上下纸盖 + 中间的球（球形是它的识别点）+ 底穗 */
function litLantern(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  cy(g, 0.007, 0.007, h * 0.22, DARK, 0, h * 0.89, 0, null, 5);                                            // 灯绳
  cy(g, r * 0.3, r * 0.3, 0.02, tint(o.wood, -0.1), 0, h * 0.78, 0, null, 10);                             // 上盖
  sp(g, r, o.color, 0, h * 0.42, 0, [1, 0.78, 1], { emissive: tint(o.color, 0.4), emissiveIntensity: 0.35 });  // 纸球
  for (let i = 0; i < 3; i++) cy(g, r * 1.002, r * 1.002, 0.008, tint(o.color, -0.15), 0, h * (0.3 + i * 0.12), 0, null, 14);  // 竹骨横线
  cy(g, r * 0.26, r * 0.26, 0.02, tint(o.wood, -0.1), 0, h * 0.06, 0, null, 10);                            // 下盖
  return g;
}

/** 暗房红色安全灯：挂臂 + 灯壳 + 红色滤片 */
function litSafe(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.5, h * 0.2, d * 0.3, tint(o.metal, -0.2), 0, h * 0.9, -d * 0.28);                             // 挂臂
  bx(g, w, h * 0.6, d * 0.7, DARK, 0, h * 0.48, 0);                                                          // 灯壳
  bx(g, w * 0.8, h * 0.4, 0.02, 0xd2402e, 0, h * 0.46, d * 0.36, null, { emissive: 0xd2402e, emissiveIntensity: 0.8 });  // 红滤片
  bx(g, w * 0.9, 0.02, d * 0.6, tint(o.metal, -0.1), 0, h * 0.78, 0);
  return g;
}

// ---------------------------------------------------------------------------
// 10. 织物专门造型
//     契约硬要求：地毯必须是贴地薄板（≤0.03 高）。所以地毯家族全部压在
//     0.03 以内，靠"边框 + 内芯 + 图案条"三层色块拉开层次，而不是靠厚度。
// ---------------------------------------------------------------------------

/** 圆形长绒地毯：三层同心圆盘（≤0.03 厚） */
function texRugRound(kit, o, R) {
  const g = new THREE.Group(), r = Math.min(kit.w, kit.d) / 2;
  cy(g, r, r, 0.02, o.color, 0, 0.01, 0, null, 24);
  cy(g, r * 0.8, r * 0.8, 0.004, tint(o.accent, 0.1), 0, 0.022, 0, null, 24);
  cy(g, r * 0.52, r * 0.52, 0.004, tint(o.color, 0.3), 0, 0.025, 0, null, 24);
  cy(g, r * 0.24, r * 0.24, 0.004, o.accent, 0, 0.028, 0, null, 20);
  return g;
}

/** 门口刮泥垫：薄垫 + 一圈框 + 刮泥凸条（凸条是它区别于地毯的地方） */
function texFloorMat(kit, o, R) {
  const g = new THREE.Group(), { w, d } = kit;
  bx(g, w, 0.018, d, tint(o.color, -0.2), 0, 0.009, 0);
  bx(g, w * 0.88, 0.004, d * 0.82, tint(o.color, 0.15), 0, 0.02, 0);
  for (let i = 0; i < 6; i++) bx(g, w * 0.8, 0.008, d * 0.045, DARK, 0, 0.026, (i - 2.5) * d * 0.13);
  return g;
}

/** 加厚瑜伽垫：垫身 + 中线 + 两端卷边 */
function texYogaMat(kit, o, R) {
  const g = new THREE.Group(), { w, d } = kit;
  bx(g, w, 0.024, d, o.color, 0, 0.012, 0);
  bx(g, w * 0.06, 0.005, d * 0.9, tint(o.accent, 0.2), 0, 0.026, 0);
  for (const s of [-1, 1]) cy(g, 0.014, 0.014, w * 0.99, tint(o.color, -0.15), 0, 0.016, s * (d / 2 - 0.012), [0, 0, Math.PI / 2], 8);
  return g;
}

/** 靠垫组：三块叠在一起、大小不一的软垫 */
function texCushionSet(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cushion(g, w * 0.96, h * 0.92, d * 0.44, o.color, 0, h * 0.48, -d * 0.16, [0.08, 0, 0]);
  cushion(g, w * 0.8, h * 0.78, d * 0.4, tint(o.accent, 0.15), w * 0.06, h * 0.42, d * 0.02, [0.11, 0, 0]);
  cushion(g, w * 0.6, h * 0.56, d * 0.34, tint(o.color, 0.3), -w * 0.1, h * 0.3, d * 0.2, [0.14, 0, 0]);
  sp(g, w * 0.05, o.accent, w * 0.06, h * 0.8, d * 0.14);                                                    // 一颗扣子
  return g;
}

/** 披毯：三层随手叠起来的布（错开的层是它"软"的来源） */
function texThrow(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (let i = 0; i < 3; i++)
    bx(g, w * (0.98 - i * 0.08), h / 3 * 0.9, d * (0.96 - i * 0.1), i % 2 ? tint(o.color, 0.18) : o.color,
      (R() - 0.5) * w * 0.08, h / 3 * (i + 0.5), (R() - 0.5) * d * 0.1, [0, (R() - 0.5) * 0.2, 0]);
  bx(g, w * 0.4, 0.012, d * 0.3, tint(o.accent, 0.2), 0, h * 0.99, 0);                                        // 露出来的一角
  return g;
}

/** 床品套件：铺开的被面 + 翻边 + 两个枕头（整套只有 8cm 厚） */
function texLinen(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.5, d, o.color, 0, h * 0.25, 0);                                                              // 被面
  bx(g, w, h * 0.5, d * 0.14, tint(o.color, 0.3), 0, h * 0.62, -d * 0.34);                                    // 翻边
  for (const s of [-1, 1]) cushion(g, w * 0.42, h * 0.55, d * 0.11, tint(o.accent, 0.32), s * w * 0.24, h * 0.72, -d * 0.42);
  bx(g, w * 0.9, 0.006, d * 0.02, tint(o.accent, 0.1), 0, h * 0.51, d * 0.1);                                 // 缝线
  return g;
}

/** 床帐：四根立柱 + 顶部框 + 四片垂帘 */
function texCanopy(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    bx(g, 0.05, h, 0.05, o.wood, sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));                           // 四柱
  for (const sz of [-1, 1]) bx(g, w, 0.05, 0.05, tint(o.wood, 0.1), 0, h - 0.025, sz * (d / 2 - 0.025));       // 顶框
  for (const sx of [-1, 1]) bx(g, 0.05, 0.05, d, tint(o.wood, 0.1), sx * (w / 2 - 0.025), h - 0.025, 0);
  const op = { transparent: true, opacity: 0.42 };
  for (const sx of [-1, 1]) bx(g, 0.06, h * 0.86, d * 0.9, o.color, sx * (w / 2 - 0.05), h * 0.52, 0, null, op);   // 侧帘
  bx(g, w * 0.9, h * 0.86, 0.06, o.color, 0, h * 0.52, -d / 2 + 0.05, null, op);                                   // 后帘
  bx(g, w * 0.9, h * 0.1, d * 0.9, tint(o.color, 0.2), 0, h - 0.08, 0, null, op);                                  // 顶纱
  return g;
}

/** 桌布：铺开的台面布 + 四边下垂的裙边（整件只有 8cm 高） */
function texTablecloth(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.4, d, o.color, 0, h * 0.8, 0);                                                                // 台面部分
  for (const sz of [-1, 1]) bx(g, w, h * 0.6, 0.03, tint(o.color, -0.08), 0, h * 0.3, sz * (d / 2 - 0.015));    // 前后裙边
  for (const sx of [-1, 1]) bx(g, 0.03, h * 0.6, d, tint(o.color, -0.08), sx * (w / 2 - 0.015), h * 0.3, 0);    // 左右裙边
  bx(g, w * 0.7, 0.008, d * 0.6, tint(o.accent, 0.2), 0, h * 1.0, 0);                                          // 桌旗
  return g;
}

/** 挂旗：横杆 + 布面 + 底部两条穗子 */
function texBanner(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, 0.014, 0.014, w * 1.05, o.wood, 0, h - 0.02, 0, [0, 0, Math.PI / 2], 8);                                // 横杆
  bx(g, w * 0.92, h * 0.88, 0.02, o.color, 0, h * 0.5, 0);                                                       // 布面
  bx(g, w * 0.6, h * 0.3, 0.008, tint(o.accent, 0.2), 0, h * 0.62, 0.014);                                       // 图案
  for (const s of [-1, 1]) cy(g, 0.012, 0.012, h * 0.1, tint(o.accent, -0.1), s * w * 0.3, h * 0.04, 0, null, 6); // 穗子
  return g;
}

/** 吸音软包：软包面板 + 三条压缝（压缝让它一眼是"软"的不是木板） */
function texAcoustic(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, 0.022, tint(o.color, -0.12), 0, h / 2, -0.011);
  for (let i = 0; i < 3; i++) cushion(g, w * 0.92, h * 0.28, 0.03, o.color, 0, h * (0.18 + i * 0.32), 0.008);
  return g;
}

// ---------------------------------------------------------------------------
// 11. 绿植专门造型
//     契约硬要求：盆栽要有花盆 + 分叉的叶子。所以每株都是 pot() + foliage()，
//     枝的长度按 w/2 反推，保证叶子不会伸出占地框。
// ---------------------------------------------------------------------------

/** 盆栽通式：花盆 + 主干 + 分叉枝叶。leafR/reach 由占地半径反推，绝不越框 */
function plantPotted(kit, o, R, opt) {
  opt = opt || {};
  const g = new THREE.Group(), { w, d, h } = kit;
  const rr = Math.min(w, d) / 2;
  const potH = Math.min(h * (opt.potRatio || 0.28), rr * 1.6);
  pot(g, rr * 0.8, rr * 0.58, potH, opt.potC || o.wood, 0, 0);
  const leafR = rr * 0.4, reach = (rr * 0.98 - leafR) / 0.9;
  foliage(g, {
    base: potH * 0.7, top: h - leafR * 1.15, trunkR: Math.max(0.014, rr * 0.11),
    trunkC: tint(o.wood, -0.3), leafC: o.color, leafR, n: opt.n || 6, reach, R,
    flowerC: opt.flower ? o.accent : null,
  });
  return g;
}

/** 高株散尾葵：没有粗主干，一丛细杆各自顶一片长叶（棕榈的剪影） */
function plantPalm(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const rr = Math.min(w, d) / 2, potH = h * 0.22;
  pot(g, rr * 0.78, rr * 0.56, potH, o.wood, 0, 0);
  for (let i = 0; i < 7; i++) {
    const az = i / 7 * Math.PI * 2 + R() * 0.4, tilt = 0.04 + R() * 0.16;
    const len = (h - potH) * (0.5 + R() * 0.28);
    const st = new THREE.Group();
    st.position.set(0, potH * 0.9, 0); st.rotation.y = az; st.rotation.z = tilt; g.add(st);
    cy(st, 0.008, 0.014, len, tint(o.color, -0.28), 0, len / 2, 0, null, 5);                      // 细杆
    sp(st, rr * 0.3, o.color, 0, len, 0, [1.1, 0.18, 0.45]);                                       // 长叶
    sp(st, rr * 0.22, tint(o.color, 0.16), 0, len * 0.82, 0, [1, 0.16, 0.4]);
  }
  return g;
}

/** 室内小树：粗树干 + 三坨球形树冠（树冠成团 = 树，不是草） */
function plantTree(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const rr = Math.min(w, d) / 2, potH = h * 0.16;
  pot(g, rr * 0.82, rr * 0.6, potH, o.wood, 0, 0);
  cy(g, rr * 0.11, rr * 0.2, h * 0.56, tint(o.wood, -0.35), 0, potH + h * 0.28, 0, null, 8);       // 树干
  for (let i = 0; i < 3; i++) {                                                                     // 三根分叉（只有两根，看过去还是一根杆）
    const br = new THREE.Group(); br.position.set(0, potH + h * (0.42 + i * 0.06), 0);
    br.rotation.y = i * 2.1; br.rotation.z = (i === 1 ? 0.55 : -0.5) + i * 0.06; g.add(br);
    cy(br, rr * 0.06, rr * 0.1, h * 0.18, tint(o.wood, -0.35), 0, h * 0.09, 0, null, 6);
  }
  sp(g, rr * 0.72, o.color, 0, h * 0.8, 0, [1, 0.86, 1]);                                           // 主树冠
  sp(g, rr * 0.5, tint(o.color, 0.14), -rr * 0.42, h * 0.66, rr * 0.1, [1, 0.86, 1]);
  sp(g, rr * 0.44, tint(o.color, -0.1), rr * 0.44, h * 0.7, -rr * 0.12, [1, 0.86, 1]);
  return g;
}

/** 灌木球盆：方盆 + 一颗修剪成球的灌木 + 几片叶 */
function plantShrub(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const potH = h * 0.42;
  bx(g, w * 0.9, potH, d * 0.9, o.wood, 0, potH / 2, 0);                                             // 方盆
  bx(g, w * 0.96, potH * 0.14, d * 0.96, tint(o.wood, -0.2), 0, potH * 0.93, 0);                     // 盆沿
  bx(g, w * 0.8, 0.03, d * 0.8, SOIL, 0, potH, 0);
  sp(g, Math.min(w, d) * 0.44, o.color, 0, h * 0.68, 0, [1, 0.92, 1]);                               // 球
  for (let i = 0; i < 4; i++) sp(g, w * 0.1, tint(o.color, 0.2), Math.cos(i * 1.6) * w * 0.3, h * (0.62 + (i % 2) * 0.14), Math.sin(i * 1.6) * d * 0.3, [1, 0.5, 1]);
  return g;
}

/** 垂盆绿萝：吊绳 + 悬空的盆 + 往下垂的藤（往下垂是它的识别点） */
function plantPothos(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const rr = Math.min(w, d) / 2, potY = h * 0.62;
  for (let i = 0; i < 3; i++) {                                                                       // 三根吊绳
    const a = i / 3 * Math.PI * 2;
    cy(g, 0.005, 0.005, h * 0.34, DARK, Math.cos(a) * rr * 0.5, potY + h * 0.19, Math.sin(a) * rr * 0.5, [0, 0, 0], 4);
  }
  cy(g, rr * 0.8, rr * 0.6, h * 0.26, o.wood, 0, potY, 0, null, 12);                                  // 盆
  cy(g, rr * 0.78, rr * 0.78, 0.02, SOIL, 0, potY + h * 0.12, 0, null, 10);
  for (let i = 0; i < 5; i++) {                                                                        // 垂下来的藤
    const a = i / 5 * Math.PI * 2, x = Math.cos(a) * rr * 0.62, z = Math.sin(a) * rr * 0.62;
    const len = h * (0.28 + R() * 0.26);
    cy(g, 0.006, 0.006, len, tint(o.color, -0.2), x, potY - h * 0.12 - len / 2, z, null, 4);
    for (let k = 0; k < 3; k++) sp(g, rr * 0.2, tint(o.color, k * 0.1), x, potY - h * 0.12 - len * (k + 0.5) / 3, z, [1, 0.35, 0.8]);
  }
  return g;
}

/** 窗箱 / 街边花箱：长条箱 + 土 + 一排花（花球是它的识别点） */
function plantBox(kit, o, R, tall) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const boxH = tall ? h * 0.62 : h * 0.5;
  bx(g, w, boxH, d, o.wood, 0, boxH / 2, 0);
  bx(g, w * 1.02, boxH * 0.12, d * 1.03, tint(o.wood, -0.22), 0, boxH * 0.94, 0);                      // 箱沿
  for (let i = 0; i < 3; i++) bx(g, w * 0.98, boxH * 0.1, 0.012, tint(o.wood, 0.14), 0, boxH * (0.2 + i * 0.26), d / 2 + 0.004);  // 板缝
  bx(g, w * 0.9, 0.03, d * 0.8, SOIL, 0, boxH, 0);
  const n = Math.max(3, Math.round(w / 0.24));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5 - n / 2) * (w / n), hh = (h - boxH) * (0.6 + R() * 0.4);
    cy(g, 0.008, 0.01, hh, tint(o.color, -0.25), x, boxH + hh / 2, (R() - 0.5) * d * 0.3, null, 5);    // 茎
    sp(g, Math.min(w / n, d) * 0.32, i % 2 ? o.color : o.accent, x, boxH + hh, (R() - 0.5) * d * 0.3, [1, 0.8, 1]);  // 花球
  }
  return g;
}

/** 插花花瓶：细颈瓶 + 三支花茎 + 花头 */
function plantVase(kit, o, R) {
  const g = new THREE.Group(), { w, h } = kit, r = w / 2;
  cy(g, r * 0.5, r * 0.85, h * 0.4, GLASS, 0, h * 0.2, 0, null, 14, { transparent: true, opacity: 0.45 });   // 瓶身
  cy(g, r * 0.42, r * 0.42, h * 0.16, GLASS, 0, h * 0.48, 0, null, 12, { transparent: true, opacity: 0.45 }); // 瓶颈
  cy(g, r * 0.44, r * 0.44, h * 0.2, tint(o.color, -0.2), 0, h * 0.14, 0, null, 12);                          // 瓶中的水/茎
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1, x = Math.cos(a) * r * 0.5, z = Math.sin(a) * r * 0.5;
    cy(g, 0.005, 0.006, h * 0.5, tint(o.color, -0.3), x * 0.5, h * 0.62, z * 0.5, [z * 0.6, 0, -x * 0.6], 4);
    sp(g, r * 0.36, i % 2 ? o.accent : tint(o.accent, 0.28), x, h * 0.88, z, [1, 0.85, 1]);
  }
  return g;
}

/** 香草盆 / 多肉盘：小盆 + 几丛紧凑的叶（矮胖是它区别于大盆栽的地方） */
function plantSmall(kit, o, R, tray) {
  const g = new THREE.Group(), { w, d, h } = kit;
  if (tray) {
    bx(g, w, h * 0.44, d, o.wood, 0, h * 0.22, 0);                                                    // 长盘
    bx(g, w * 0.9, 0.02, d * 0.86, SOIL, 0, h * 0.44, 0);
    for (let i = 0; i < 3; i++) {                                                                      // 三颗多肉
      const x = (i - 1) * w * 0.28;
      sp(g, Math.min(w / 3, d) * 0.3, i % 2 ? o.color : tint(o.color, 0.2), x, h * 0.6, 0, [1, 0.7, 1]);
      for (let k = 0; k < 4; k++) sp(g, Math.min(w / 3, d) * 0.16, tint(o.color, 0.28), x + Math.cos(k * 1.6) * w * 0.08, h * 0.56, Math.sin(k * 1.6) * d * 0.16, [1, 0.45, 1]);
    }
  } else {
    const r = w / 2, potH = h * 0.46;
    pot(g, r * 0.9, r * 0.68, potH, o.wood, 0, 0);
    for (let i = 0; i < 5; i++) {                                                                       // 一丛香草
      const a = i / 5 * Math.PI * 2;
      cy(g, 0.004, 0.005, h * 0.3, tint(o.color, -0.25), Math.cos(a) * r * 0.3, potH + h * 0.15, Math.sin(a) * r * 0.3, [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], 4);
      sp(g, r * 0.34, tint(o.color, i * 0.05), Math.cos(a) * r * 0.5, potH + h * 0.32, Math.sin(a) * r * 0.5, [1, 0.6, 1]);
    }
  }
  return g;
}

/** 苔墙：底板 + 一整面高低起伏的苔藓块（起伏是它区别于一块绿板的地方） */
function plantMossWall(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, 0.04, tint(o.wood, -0.3), 0, h / 2, -0.03);                                               // 底板
  const cols = Math.max(4, Math.round(w / 0.26)), rows = Math.max(3, Math.round(h / 0.26));
  for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) {
    const c = [o.color, tint(o.color, 0.2), tint(o.color, -0.15), o.accent][(i + k) % 4];
    sp(g, Math.min(w / cols, h / rows) * 0.62, c, (i + 0.5 - cols / 2) * (w / cols), (k + 0.5) * (h / rows), 0.012 + R() * 0.012, [1, 1, 0.3]);
  }
  return g;
}

/** 门口花环：一圈叶球拼成的环 + 一个蝴蝶结（环形是它唯一的识别点） */
function plantWreath(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const r = Math.min(w, h) * 0.4, yc = h / 2;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    sp(g, r * 0.3, i % 3 ? o.color : tint(o.color, 0.22), Math.cos(a) * r, yc + Math.sin(a) * r, (i % 2 ? 1 : -1) * 0.012, [1, 1, 0.42]);
  }
  for (const s of [-1, 1]) sp(g, r * 0.24, o.accent, s * r * 0.28, yc - r * 0.92, 0.012, [1, 0.7, 0.4]);   // 蝴蝶结
  sp(g, r * 0.12, tint(o.accent, -0.15), 0, yc - r * 0.9, 0.016);
  return g;
}

/** 育苗架：金属立框 + 三层托盘 + 一排小苗 */
function plantSeedRack(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    cy(g, 0.018, 0.018, h, o.metal, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), null, 6);
  for (let i = 0; i < 3; i++) {
    const y = 0.18 + i * (h - 0.24) / 3;
    bx(g, w * 0.96, 0.02, d * 0.9, tint(o.metal, 0.1), 0, y, 0);                                          // 托盘底
    bx(g, w * 0.9, 0.06, d * 0.84, tint(o.wood, -0.15), 0, y + 0.04, 0);                                  // 育苗盘
    bx(g, w * 0.86, 0.02, d * 0.8, SOIL, 0, y + 0.075, 0);
    for (let k = 0; k < 5; k++) {                                                                          // 小苗
      const x = (k - 2) * w * 0.17;
      cy(g, 0.004, 0.005, 0.06, tint(o.color, -0.2), x, y + 0.11, 0, null, 4);
      sp(g, 0.028, o.color, x, y + 0.15, 0, [1.4, 0.4, 1]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 12. 媒介专门造型
//     契约硬要求：电视要有黑屏面 + 底座。挂墙类零件进深只有 6-8cm，
//     所有部件必须对称落在 z=0 两侧，否则会被判"不居中"。
// ---------------------------------------------------------------------------

/** 壁挂电视：窄边框 + 一整块黑屏 + 背后的挂架底座 + 一颗待机灯 */
function medTV(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, d * 0.55, DARK, 0, h / 2, -d * 0.06);                                                  // 机身边框
  bx(g, w * 0.955, h * 0.92, d * 0.25, SCREEN, 0, h / 2, d * 0.3);                                    // 黑屏
  bx(g, w * 0.9, h * 0.86, d * 0.1, tint(o.accent, -0.35), 0, h / 2, d * 0.36, null, { transparent: true, opacity: 0.35 });  // 屏面反光
  bx(g, w * 0.24, h * 0.3, d * 0.4, tint(o.metal, -0.2), 0, h * 0.5, -d * 0.42);                       // 挂架底座
  bx(g, 0.04, 0.012, 0.012, o.accent, w * 0.4, h * 0.06, d * 0.36, null, { emissive: o.accent, emissiveIntensity: 0.7 });  // 待机灯
  return g;
}

/** 投影幕布：顶部卷筒 + 白幕面 + 底部压杆 + 两个吊码 */
function medScreen(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, d * 0.35, d * 0.35, w * 0.99, tint(o.metal, -0.1), 0, h - d * 0.35, 0, [0, 0, Math.PI / 2], 12);  // 卷筒
  bx(g, w * 0.94, h * 0.82, d * 0.16, PAPER, 0, h * 0.44, 0);                                              // 幕面
  bx(g, w * 0.94, h * 0.03, d * 0.3, DARK, 0, h * 0.04, 0);                                                // 底压杆
  for (const s of [-1, 1]) bx(g, 0.05, d * 0.5, d * 0.5, tint(o.metal, -0.25), s * w * 0.44, h - d * 0.2, 0);  // 吊码
  return g;
}

/** 黑胶唱机：底座 + 转盘 + 唱片 + 唱臂 + 配重（唱臂是它的识别点） */
function medTurntable(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.42, d, tint(o.wood, -0.05), 0, h * 0.21, 0);                                              // 木底座
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, 0.015, 0.015, 0.02, DARK, sx * (w / 2 - 0.04), 0.01, sz * (d / 2 - 0.04), null, 6);
  const r = Math.min(w, d) * 0.34;
  cy(g, r, r, h * 0.14, tint(o.metal, 0.2), -w * 0.1, h * 0.49, 0, null, 20);                              // 转盘
  cy(g, r * 0.95, r * 0.95, 0.006, SCREEN, -w * 0.1, h * 0.57, 0, null, 20);                                // 唱片
  cy(g, r * 0.3, r * 0.3, 0.008, o.accent, -w * 0.1, h * 0.58, 0, null, 12);                                // 唱片标签
  bx(g, w * 0.42, 0.012, 0.012, tint(o.metal, 0.3), w * 0.1, h * 0.62, -d * 0.06, [0, -0.5, 0]);            // 唱臂
  sp(g, 0.022, DARK, w * 0.3, h * 0.62, -d * 0.22);                                                          // 配重
  knob(g, 0.018, o.accent, w * 0.34, h * 0.24, d / 2 + 0.008);
  return g;
}

/** 落地音箱：木箱 + 大低音单元 + 中音 + 高音 + 脚钉（三个圆单元 = 音箱） */
function medSpeaker(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h - 0.05, d, tint(o.wood, -0.15), 0, (h - 0.05) / 2 + 0.05, 0);                                   // 箱体
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, 0.012, 0.012, 0.05, tint(o.metal, -0.2), sx * (w / 2 - 0.035), 0.025, sz * (d / 2 - 0.035), null, 6);
  const zf = d / 2 - 0.005;
  cy(g, w * 0.36, w * 0.36, 0.03, DARK, 0, h * 0.28, zf, [Math.PI / 2, 0, 0], 14);                            // 低音
  cy(g, w * 0.2, w * 0.2, 0.03, tint(o.metal, -0.1), 0, h * 0.28, zf + 0.006, [Math.PI / 2, 0, 0], 12);
  cy(g, w * 0.24, w * 0.24, 0.03, DARK, 0, h * 0.58, zf, [Math.PI / 2, 0, 0], 12);                            // 中音
  cy(g, w * 0.12, w * 0.12, 0.03, tint(o.metal, 0.15), 0, h * 0.78, zf, [Math.PI / 2, 0, 0], 10);             // 高音
  bx(g, w * 0.6, 0.012, 0.012, o.accent, 0, h * 0.92, zf);                                                     // 铭牌
  return g;
}

/** 唱片翻箱：斜口木箱 + 四条腿 + 中间隔板 + 一排立着的唱片（翻箱的识别点） */
function medRecordBin(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const bodyY = h * 0.36;
  legs4(g, w, d, bodyY, 0.03, tint(o.wood, -0.2), 0.08, true);
  bx(g, w, h - bodyY, d, o.wood, 0, (h + bodyY) / 2, 0);                                                       // 箱体
  bx(g, w * 0.92, (h - bodyY) * 0.8, d * 0.88, tint(o.wood, -0.3), 0, (h + bodyY) / 2 + 0.05, 0);              // 箱内凹
  for (let i = 0; i < 3; i++) bx(g, 0.02, (h - bodyY) * 0.7, d * 0.86, tint(o.wood, 0.15), (i - 1) * w * 0.3, (h + bodyY) / 2 + 0.04, 0);  // 隔板
  const cs = [o.color, o.accent, tint(o.color, 0.3), tint(o.accent, -0.2), tint(o.wood, 0.3)];
  for (let i = 0; i < 10; i++)                                                                                  // 立着的唱片
    bx(g, 0.022, (h - bodyY) * 0.62, d * 0.8, cs[i % 5], -w * 0.42 + i * w * 0.085, (h + bodyY) / 2 + 0.06, 0, [0, 0, 0.06]);
  return g;
}

/** 立式钢琴：琴身 + 键盘台 + 一排白键 + 黑键 + 谱架 + 两个踏板 */
function medPiano(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.86, d * 0.62, tint(o.wood, -0.15), 0, h * 0.43 + h * 0.1, -d * 0.16);                          // 琴身
  bx(g, w * 1.01, h * 0.06, d * 0.68, tint(o.wood, 0.05), 0, h - h * 0.03, -d * 0.14);                          // 顶盖
  bx(g, w * 0.96, h * 0.07, d * 0.45, tint(o.wood, -0.05), 0, h * 0.52, d * 0.2);                                // 键盘台
  bx(g, w * 0.88, h * 0.025, d * 0.3, PAPER, 0, h * 0.57, d * 0.24);                                             // 白键
  for (let i = 0; i < 11; i++) {                                                                                  // 黑键
    if (i % 7 === 2 || i % 7 === 6) continue;
    bx(g, w * 0.026, h * 0.02, d * 0.18, SCREEN, (i - 5) * w * 0.078, h * 0.585, d * 0.19);
  }
  bx(g, w * 0.8, h * 0.22, 0.025, tint(o.wood, 0.12), 0, h * 0.72, d * 0.1, [0.22, 0, 0]);                        // 谱架
  bx(g, w * 0.5, h * 0.16, 0.012, PAPER, 0, h * 0.76, d * 0.12, [0.22, 0, 0]);                                    // 谱子
  for (const s of [-1, 1]) bx(g, 0.1, h * 0.44, d * 0.5, tint(o.wood, -0.25), s * (w / 2 - 0.06), h * 0.22, -d * 0.1);   // 两侧腿
  for (const s of [-1, 1]) bx(g, 0.04, 0.05, 0.1, tint(o.metal, 0.25), s * 0.07, 0.07, d * 0.14, [0.3, 0, 0]);    // 踏板
  return g;
}

/** 挂墙的画 / 海报 / 照片墙：框 + 画面 + 画面上的构图块（分格数由类型决定） */
function medArt(kit, o, R, grid) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const f = wallPanel(g, w, h, d, tint(o.wood, -0.05), tint(o.color, 0.28));
  const zf = f.fd * 0.28 + 0.005;
  if (grid) {                                                                                                      // 九宫格照片墙
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++)
      bx(g, w * 0.26, h * 0.26, 0.008, [o.color, o.accent, tint(o.color, 0.35), tint(o.accent, 0.3)][(i + k) % 4],
        (i - 1) * w * 0.3, h * 0.5 + (k - 1) * h * 0.3, zf);
  } else {                                                                                                          // 一幅画：几块色面拼出构图
    bx(g, w * 0.6, h * 0.34, 0.008, o.accent, -w * 0.1, h * 0.62, zf);
    bx(g, w * 0.4, h * 0.26, 0.008, o.color, w * 0.16, h * 0.36, zf);
    cy(g, Math.min(w, h) * 0.12, Math.min(w, h) * 0.12, 0.008, tint(o.accent, 0.35), -w * 0.22, h * 0.34, zf, [Math.PI / 2, 0, 0], 14);
  }
  return g;
}

/** 挂钟：外圈 + 表盘 + 时针分针 + 中心轴 + 四个刻度（指针是它的识别点） */
function medClock(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w, h) / 2;
  cy(g, r, r, d * 0.6, tint(o.wood, -0.05), 0, h / 2, 0, [Math.PI / 2, 0, 0], 20);                                  // 外圈
  cy(g, r * 0.86, r * 0.86, d * 0.7, PAPER, 0, h / 2, d * 0.06, [Math.PI / 2, 0, 0], 20);                           // 表盘
  for (let i = 0; i < 4; i++) {                                                                                      // 四个刻度
    const a = i / 4 * Math.PI * 2;
    bx(g, 0.018, 0.05, 0.006, DARK, Math.sin(a) * r * 0.72, h / 2 + Math.cos(a) * r * 0.72, d * 0.2, [0, 0, a]);
  }
  bx(g, 0.016, r * 0.9, 0.006, DARK, 0, h / 2 + r * 0.2, d * 0.24, [0, 0, -0.5]);                                    // 分针
  bx(g, 0.018, r * 0.6, 0.006, o.accent, 0, h / 2 + r * 0.12, d * 0.26, [0, 0, 1.9]);                                // 时针
  sp(g, 0.022, o.accent, 0, h / 2, d * 0.28);                                                                        // 中心轴
  return g;
}

/** 镜子（圆镜 / 穿衣镜）：框 + 反光玻璃 + 一道高光（高光让它一眼是镜不是画） */
function medMirror(kit, o, R, round) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const gl = { transparent: true, opacity: 0.5 };
  if (round) {
    const r = Math.min(w, h) / 2;
    cy(g, r, r, d * 0.6, tint(o.metal, 0.1), 0, h / 2, 0, [Math.PI / 2, 0, 0], 22);
    cy(g, r * 0.88, r * 0.88, d * 0.7, GLASS, 0, h / 2, d * 0.08, [Math.PI / 2, 0, 0], 22, gl);
    bx(g, r * 0.34, r * 1.1, 0.006, tint(GLASS, 0.4), -r * 0.28, h / 2, d * 0.2, [0, 0, 0.5], gl);                   // 高光
  } else {
    wallPanel(g, w, h, d, tint(o.wood, -0.05), GLASS, gl);
    bx(g, w * 0.3, h * 0.9, 0.006, tint(GLASS, 0.4), -w * 0.16, h * 0.5, d * 0.2, [0, 0, 0.14], gl);
    for (const s of [-1, 1]) bx(g, w * 0.3, 0.03, d * 0.5, tint(o.wood, -0.2), s * w * 0.2, 0.015, 0);               // 落地支脚
  }
  return g;
}

/** 店招灯牌：灯箱体 + 亮面 + 三块"字" + 挂臂 */
function medSign(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h, d * 0.5, tint(o.metal, -0.2), 0, h / 2, -d * 0.1);                                                      // 灯箱
  bx(g, w * 0.94, h * 0.82, d * 0.3, tint(o.color, 0.35), 0, h / 2, d * 0.18, null, { emissive: tint(o.color, 0.3), emissiveIntensity: 0.5 });  // 亮面
  for (let i = 0; i < 3; i++) bx(g, w * 0.16, h * 0.4, 0.012, o.accent, (i - 1) * w * 0.22, h * 0.5, d * 0.3);         // 字块
  bx(g, w * 0.2, 0.04, d * 0.6, tint(o.metal, -0.3), 0, h + 0.02, -d * 0.1);                                          // 挂臂
  return g;
}

/** 台式机主机：机箱 + 前面板 + 散热格栅 + 电源灯 + 底脚 */
function medPC(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h - 0.02, d, tint(o.metal, -0.05), 0, (h - 0.02) / 2 + 0.02, 0);
  bx(g, w * 0.9, h * 0.9, 0.02, DARK, 0, h * 0.5, d / 2 - 0.005);                                                     // 前面板
  for (let i = 0; i < 5; i++) bx(g, w * 0.6, 0.012, 0.01, tint(o.metal, -0.35), 0, h * (0.2 + i * 0.12), d / 2 + 0.006);  // 格栅
  cy(g, 0.012, 0.012, 0.01, o.accent, 0, h * 0.86, d / 2 + 0.008, [Math.PI / 2, 0, 0], 8, { emissive: o.accent, emissiveIntensity: 0.8 });
  for (const sz of [-1, 1]) bx(g, w * 0.9, 0.02, 0.04, DARK, 0, 0.01, sz * (d / 2 - 0.04));
  return g;
}

/** 双屏显示器：两块黑屏 + 中间立柱 + 底盘（两块并排就是它的识别点） */
function medMonitors(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.3, 0.025, d * 0.8, tint(o.metal, -0.1), 0, 0.012, 0);                                                    // 底盘
  cy(g, 0.022, 0.03, h * 0.38, tint(o.metal, 0.05), 0, h * 0.19, 0, null, 8);                                          // 立柱
  bx(g, w * 0.5, 0.03, 0.03, tint(o.metal, 0.05), 0, h * 0.62, 0);                                                     // 横臂
  for (const s of [-1, 1]) {
    bx(g, w * 0.46, h * 0.56, 0.03, tint(o.metal, -0.15), s * w * 0.25, h * 0.66, -d * 0.1, [0, -s * 0.22, 0]);         // 背壳
    bx(g, w * 0.43, h * 0.5, 0.016, SCREEN, s * w * 0.25, h * 0.66, -d * 0.1 + 0.02, [0, -s * 0.22, 0]);                // 黑屏
    bx(g, w * 0.36, h * 0.36, 0.008, tint(o.accent, -0.3), s * w * 0.25, h * 0.7, -d * 0.1 + 0.03, [0, -s * 0.22, 0], { transparent: true, opacity: 0.4 });
  }
  return g;
}

/** 复合打印机：机身 + 掀盖 + 出纸槽 + 进纸盘 + 控制面板 */
function medPrinter(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.66, d, tint(o.metal, 0.08), 0, h * 0.33, 0);                                                          // 机身
  bx(g, w * 0.98, h * 0.1, d * 0.96, tint(o.metal, -0.05), 0, h * 0.71, 0);                                            // 扫描盖
  bx(g, w * 0.9, h * 0.06, d * 0.8, DARK, 0, h * 0.79, -d * 0.05, [-0.12, 0, 0]);                                      // 掀开一角
  bx(g, w * 0.8, h * 0.06, d * 0.5, PAPER, 0, h * 0.44, d * 0.34, [-0.16, 0, 0]);                                      // 出纸
  bx(g, w * 0.86, h * 0.14, d * 0.3, tint(o.color, -0.05), 0, h * 0.12, d * 0.42);                                     // 进纸盘
  bx(g, w * 0.34, h * 0.08, 0.02, SCREEN, -w * 0.24, h * 0.66, d / 2 - 0.004);                                          // 面板
  for (let i = 0; i < 3; i++) knob(g, 0.014, o.accent, w * (0.12 + i * 0.12), h * 0.66, d / 2 + 0.006);
  return g;
}

/** 工业缝纫机：机台 + 立柱 + 悬臂 + 机头 + 针杆 + 手轮（悬臂是它的识别点） */
function medSewing(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.3, d, tint(o.metal, -0.05), 0, h * 0.15, 0);                                                          // 机台
  bx(g, w * 0.24, h * 0.62, d * 0.7, o.color, w * 0.35, h * 0.55, 0);                                                  // 立柱
  bx(g, w * 0.7, h * 0.22, d * 0.5, o.color, -w * 0.02, h * 0.8, 0);                                                   // 悬臂
  bx(g, w * 0.16, h * 0.3, d * 0.5, tint(o.color, -0.1), -w * 0.36, h * 0.62, 0);                                      // 机头
  cy(g, 0.008, 0.008, h * 0.2, tint(o.metal, 0.3), -w * 0.36, h * 0.4, 0, null, 5);                                    // 针杆
  cy(g, h * 0.16, h * 0.16, 0.03, tint(o.metal, 0.15), w * 0.46, h * 0.78, 0, [0, 0, Math.PI / 2], 14);                 // 手轮
  bx(g, w * 0.4, 0.012, d * 0.3, PAPER, -w * 0.2, h * 0.31, d * 0.1);                                                  // 布料
  return g;
}

/** 木工台锯：台面 + 锯片（露出来的圆盘）+ 导轨挡板 + 四条腿 + 电机箱 */
function medSaw(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const topY = h * 0.72;
  legs4(g, w, d, topY, 0.028, tint(o.metal, -0.2), 0.08, false);
  bx(g, w * 0.9, 0.2, d * 0.7, tint(o.metal, -0.05), 0, topY * 0.42, 0);                                               // 电机箱
  bx(g, w, 0.05, d, tint(o.metal, 0.22), 0, topY, 0);                                                                  // 台面
  cy(g, h * 0.14, h * 0.14, 0.012, tint(o.metal, 0.35), 0, topY + h * 0.07, 0, [0, 0, Math.PI / 2], 18);                // 锯片
  bx(g, w * 0.96, 0.06, 0.05, o.accent, 0, topY + 0.05, -d * 0.3);                                                     // 导轨挡板
  bx(g, 0.06, 0.06, d * 0.9, o.accent, w * 0.3, topY + 0.05, 0);                                                       // 纵向靠山
  knob(g, 0.03, o.color, -w * 0.4, topY * 0.5, d / 2 + 0.01);                                                          // 升降手轮
  return g;
}

/** 暗房放大机：底板 + 立柱 + 机头 + 镜头 + 调焦旋钮 */
function medEnlarger(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.05, d, tint(o.wood, 0.05), 0, h * 0.025, 0);                                                           // 底板
  bx(g, w * 0.16, h * 0.92, d * 0.14, tint(o.metal, -0.05), 0, h * 0.5, -d * 0.36);                                     // 立柱
  bx(g, w * 0.6, h * 0.18, d * 0.5, o.color, 0, h * 0.78, -d * 0.05);                                                   // 机头
  cy(g, w * 0.2, w * 0.24, h * 0.1, tint(o.metal, 0.1), 0, h * 0.63, -d * 0.05, null, 12);                              // 灯箱
  cy(g, w * 0.1, w * 0.1, h * 0.08, DARK, 0, h * 0.55, -d * 0.05, null, 12);                                            // 镜头
  knob(g, 0.03, o.accent, w * 0.16, h * 0.72, -d * 0.28);                                                               // 调焦钮
  bx(g, w * 0.5, 0.012, d * 0.4, PAPER, 0, h * 0.06, d * 0.1);                                                          // 相纸
  return g;
}

// ---------------------------------------------------------------------------
// 13. 建筑构件专门造型
//     这些是房间的壳件：窗要有窗框和玻璃、门要有门芯板和门把、栏杆要有栏条。
// ---------------------------------------------------------------------------

/** 双开外窗：外框 + 中竖梃 + 两扇窗 + 玻璃 + 窗台板 */
function archWindow(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const fd = Math.min(d * 0.55, 0.1), t = 0.07, trim = tint(o.wood, 0.18);
  bx(g, w, t, fd, trim, 0, h - t / 2, 0);                                                                                // 上框
  bx(g, w, t, fd, trim, 0, t / 2, 0);                                                                                     // 下框
  for (const s of [-1, 1]) bx(g, t, h - t * 2, fd, trim, s * (w / 2 - t / 2), h / 2, 0);                                   // 边框
  bx(g, 0.05, h - t * 2, fd, trim, 0, h / 2, 0);                                                                           // 中竖梃
  for (const s of [-1, 1]) {
    glassBox(g, (w - t * 2 - 0.05) / 2 - 0.02, h - t * 2 - 0.04, fd * 0.5, s * (w * 0.25 - 0.005), h / 2, 0);              // 玻璃
    bx(g, (w - t * 2 - 0.05) / 2 - 0.02, 0.03, fd * 0.6, trim, s * (w * 0.25 - 0.005), h * 0.58, 0.004);                   // 窗格横条
  }
  bx(g, w * 1.04, 0.04, Math.min(d * 0.9, 0.16), tint(o.wood, 0.05), 0, 0.02, d * 0.1);                                    // 窗台板
  return g;
}

/** 飘窗龛：三面窗（正面 + 两侧斜面）+ 窗台坐板 + 一个靠垫 */
function archBay(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const trim = tint(o.wood, 0.18), sillY = h * 0.28;
  bx(g, w, sillY, d, tint(o.color, -0.05), 0, sillY / 2, 0);                                                               // 窗下墙
  bx(g, w * 1.02, 0.05, d * 1.02, tint(o.wood, 0.1), 0, sillY + 0.025, 0);                                                 // 坐板
  bx(g, w * 0.6, 0.09, d * 0.55, trim, 0, h - 0.045, d * 0.2);                                                              // 正面上框
  glassBox(g, w * 0.56, h - sillY - 0.13, d * 0.16, 0, (h + sillY) / 2 - 0.02, d * 0.28);                                    // 正面玻璃
  for (const s of [-1, 1]) {
    bx(g, 0.07, h - sillY - 0.05, d * 0.6, trim, s * (w / 2 - 0.04), (h + sillY) / 2, 0, [0, -s * 0.5, 0]);                  // 斜边框
    glassBox(g, w * 0.24, h - sillY - 0.13, d * 0.14, s * w * 0.36, (h + sillY) / 2 - 0.02, d * 0.02);                       // 侧玻璃
  }
  cushion(g, w * 0.4, 0.12, d * 0.5, o.color, -w * 0.22, sillY + 0.11, d * 0.02);                                            // 坐垫
  return g;
}

/** 落地玻璃店面：大玻璃 + 门扇 + 上亮子 + 底部踢脚 + 分格竖挺 */
function archShopfront(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const fd = Math.min(d * 0.5, 0.09), frame = tint(o.metal, -0.05);
  bx(g, w, 0.1, fd, frame, 0, h - 0.05, 0);                                                                                  // 顶梁
  bx(g, w, 0.12, d * 0.9, tint(o.wood, -0.1), 0, 0.06, 0);                                                                   // 踢脚
  for (const s of [-1, 1]) bx(g, 0.09, h, fd, frame, s * (w / 2 - 0.045), h / 2, 0);                                          // 两边竖挺
  bx(g, 0.07, h - 0.2, fd, frame, -w * 0.16, (h - 0.2) / 2 + 0.12, 0);                                                        // 中竖挺
  bx(g, w, 0.07, fd, frame, 0, h * 0.82, 0);                                                                                  // 亮子横挺
  glassBox(g, w * 0.5, h * 0.66, fd * 0.4, w * 0.22, h * 0.47, 0);                                                            // 大玻璃
  glassBox(g, w * 0.94, h * 0.13, fd * 0.4, 0, h * 0.9, 0);                                                                   // 上亮子
  bx(g, w * 0.28, h * 0.68, fd * 0.7, frame, -w * 0.31, h * 0.46, 0);                                                          // 门扇框
  glassBox(g, w * 0.22, h * 0.56, fd * 0.35, -w * 0.31, h * 0.48, 0);
  cy(g, 0.018, 0.018, h * 0.2, tint(o.metal, 0.3), -w * 0.2, h * 0.45, fd * 0.5, null, 8);                                     // 门把
  return g;
}

/** 木门扇：门板 + 两块凹进去的门芯 + 两侧都有的门把 + 两个合页 */
function archDoor(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const leafD = Math.min(d * 0.55, 0.055);
  bx(g, w, h, leafD, o.wood, 0, h / 2, 0);                                                                                     // 门板
  for (let i = 0; i < 2; i++) {                                                                                                 // 门芯板
    const yc = i ? h * 0.68 : h * 0.28, hh = i ? h * 0.42 : h * 0.36;
    bx(g, w * 0.7, hh, leafD * 1.1, tint(o.wood, -0.14), 0, yc, 0);
    bx(g, w * 0.6, hh * 0.86, leafD * 1.2, tint(o.wood, 0.08), 0, yc, 0);
  }
  for (const s of [-1, 1]) {                                                                                                    // 门把（两面都有）
    sp(g, 0.032, o.metal, w * 0.34, h * 0.46, s * (leafD / 2 + 0.014), [1, 1, 0.7]);
    bx(g, 0.05, 0.1, 0.012, tint(o.metal, -0.1), w * 0.34, h * 0.46, s * (leafD / 2 + 0.006));
  }
  for (let i = 0; i < 2; i++) bx(g, 0.03, 0.12, leafD * 1.3, tint(o.metal, -0.15), -w / 2 + 0.015, h * (0.2 + i * 0.6), 0);      // 合页
  return g;
}

/** 金属栏杆：两根立柱 + 上下横杆 + 一排栏条（栏条是它的识别点） */
function archRailing(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (const s of [-1, 1]) bx(g, 0.05, h, Math.min(d * 0.5, 0.05), o.metal, s * (w / 2 - 0.025), h / 2, 0);
  cy(g, 0.024, 0.024, w * 0.99, tint(o.metal, 0.15), 0, h - 0.03, 0, [0, 0, Math.PI / 2], 10);                                   // 扶手
  bx(g, w * 0.98, 0.03, Math.min(d * 0.4, 0.04), o.metal, 0, h * 0.12, 0);                                                       // 下横杆
  const n = Math.max(5, Math.round(w / 0.16));
  for (let i = 0; i < n; i++) bx(g, 0.018, h * 0.84, 0.018, tint(o.metal, 0.05), (i + 0.5 - n / 2) * (w / n), h * 0.5, 0);        // 栏条
  return g;
}

/** 结构圆柱：柱础 + 柱身 + 柱头 + 竖向凹槽 */
function archColumn(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit, r = Math.min(w, d) / 2;
  cy(g, r * 0.9, r, h * 0.05, tint(o.color, -0.2), 0, h * 0.025, 0, null, 16);                                                    // 柱础
  cy(g, r * 0.78, r * 0.86, h * 0.88, o.color, 0, h * 0.5, 0, null, 16);                                                          // 柱身
  for (let i = 0; i < 6; i++) {                                                                                                    // 凹槽
    const a = i / 6 * Math.PI * 2;
    bx(g, 0.03, h * 0.84, 0.03, tint(o.color, -0.12), Math.cos(a) * r * 0.8, h * 0.5, Math.sin(a) * r * 0.8);
  }
  cy(g, r, r * 0.82, h * 0.06, tint(o.color, 0.15), 0, h * 0.95, 0, null, 16);                                                     // 柱头
  bx(g, r * 2, h * 0.03, r * 2, tint(o.color, 0.22), 0, h - h * 0.015, 0);                                                         // 顶板
  return g;
}

/** 拱形门洞：两侧门垛 + 半圆拱（六段拼）+ 拱心石 */
function archArch(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const jw = w * 0.15, r = w / 2 - jw * 0.62, yb = h - r - 0.06;
  for (const s of [-1, 1]) bx(g, jw, yb, d * 0.6, o.color, s * (w / 2 - jw / 2), yb / 2, 0);                                        // 门垛
  for (let i = 0; i < 6; i++) {                                                                                                     // 拱券
    const a = Math.PI * (i + 0.5) / 6;
    bx(g, jw, r * 0.5, d * 0.6, i % 2 ? tint(o.color, 0.1) : o.color, -Math.cos(a) * r, yb + Math.sin(a) * r, 0, [0, 0, -Math.PI / 2 + a]);
  }
  bx(g, jw * 0.9, r * 0.4, d * 0.66, tint(o.color, 0.24), 0, yb + r, 0);                                                            // 拱心石
  for (const s of [-1, 1]) bx(g, jw * 1.2, 0.06, d * 0.68, tint(o.color, -0.12), s * (w / 2 - jw / 2), yb, 0);                       // 起拱线
  return g;
}

/** 百叶格栅：外框 + 一排斜置的百叶片 */
function archLouver(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const fd = Math.min(d * 0.5, 0.05);
  for (const s of [-1, 1]) bx(g, 0.05, h, fd, o.wood, s * (w / 2 - 0.025), h / 2, 0);
  bx(g, w, 0.05, fd, o.wood, 0, h - 0.025, 0);
  bx(g, w, 0.05, fd, o.wood, 0, 0.025, 0);
  const n = Math.max(6, Math.round(h / 0.14));
  for (let i = 0; i < n; i++) bx(g, w * 0.92, 0.035, Math.min(d * 0.6, 0.06), tint(o.wood, 0.12 - (i % 2) * 0.08), 0, 0.07 + (h - 0.14) * i / n, 0, [-0.45, 0, 0]);
  return g;
}

/** 阳台挑板：板体 + 上表面 + 一圈边梁 + 底面加劲肋 */
function archSlab(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.55, d, tint(o.color, -0.1), 0, h * 0.275, 0);                                                                     // 板体
  bx(g, w * 0.98, h * 0.2, d * 0.98, tint(o.color, 0.16), 0, h * 0.65, 0);                                                          // 面层
  for (const sz of [-1, 1]) bx(g, w, h * 0.28, 0.06, tint(o.color, 0.05), 0, h * 0.86, sz * (d / 2 - 0.03));                         // 边梁
  for (const sx of [-1, 1]) bx(g, 0.06, h * 0.28, d, tint(o.color, 0.05), sx * (w / 2 - 0.03), h * 0.86, 0);
  for (let i = 0; i < 3; i++) bx(g, w * 0.06, h * 0.5, d * 0.9, tint(o.color, -0.24), (i - 1) * w * 0.3, h * 0.25, 0);               // 加劲肋
  return g;
}

/** 天窗：井框 + 玻璃 + 十字压条（贴在顶上的一个亮口） */
function archSkylight(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const t = 0.08;
  for (const sx of [-1, 1]) bx(g, t, h * 0.9, d, tint(o.metal, 0.05), sx * (w / 2 - t / 2), h * 0.45, 0);
  for (const sz of [-1, 1]) bx(g, w - t * 2, h * 0.9, t, tint(o.metal, 0.05), 0, h * 0.45, sz * (d / 2 - t / 2));
  glassBox(g, w - t * 2, h * 0.3, d - t * 2, 0, h * 0.72, 0);                                                                        // 玻璃
  bx(g, w - t * 2, h * 0.18, 0.04, tint(o.metal, -0.1), 0, h * 0.8, 0);                                                              // 压条
  bx(g, 0.04, h * 0.18, d - t * 2, tint(o.metal, -0.1), 0, h * 0.8, 0);
  return g;
}

/** 顶部线脚：三层逐级出挑的横带（阶梯剖面就是线脚） */
function archCornice(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w, h * 0.34, d * 0.5, tint(o.color, -0.06), 0, h * 0.17, 0);
  bx(g, w, h * 0.3, d * 0.78, o.color, 0, h * 0.49, 0);
  bx(g, w, h * 0.34, d, tint(o.color, 0.16), 0, h * 0.83, 0);
  bx(g, w * 0.999, 0.012, d * 1.002, tint(o.color, -0.2), 0, h * 0.64, 0);
  return g;
}

/** 木格隔断：外框 + 井字格栅（格子是它的识别点） */
function archPartition(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const fd = Math.min(d * 0.55, 0.06), t = 0.06;
  for (const sx of [-1, 1]) bx(g, t, h, fd, o.wood, sx * (w / 2 - t / 2), h / 2, 0);
  for (const sy of [0, 1]) bx(g, w, t, fd, o.wood, 0, sy ? h - t / 2 : t / 2, 0);
  const nc = Math.max(3, Math.round(w / 0.42)), nr = Math.max(4, Math.round(h / 0.42));
  for (let i = 1; i < nc; i++) bx(g, 0.03, h - t * 2, fd * 0.7, tint(o.wood, 0.12), -w / 2 + w * i / nc, h / 2, 0);
  for (let k = 1; k < nr; k++) bx(g, w - t * 2, 0.03, fd * 0.7, tint(o.wood, 0.12), 0, h * k / nr, 0);
  return g;
}

/** 入口台阶：三级踏步 + 两侧侧墙（一级比一级窄 = 台阶剖面） */
function archStoop(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  for (let i = 0; i < 3; i++) {
    const dd = d * (1 - i / 3), zc = d / 2 - dd / 2;
    bx(g, w, h / 3, dd, tint(o.color, -0.05 + i * 0.08), 0, h / 3 * (i + 0.5), zc);                                                   // 踏步
    bx(g, w * 1.002, 0.015, dd * 1.002, tint(o.color, 0.2), 0, h / 3 * (i + 1) - 0.008, zc);                                          // 防滑条
  }
  for (const s of [-1, 1]) bx(g, 0.06, h * 0.4, d * 0.3, tint(o.color, -0.18), s * (w / 2 - 0.03), h * 0.2, -d * 0.34);                // 侧墙
  return g;
}

/** 靠墙扶手：一根圆管 + 两个墙上托座（整件只有 10cm 高） */
function archHandrail(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  cy(g, h * 0.28, h * 0.28, w * 0.98, tint(o.wood, 0.12), 0, h * 0.62, d * 0.1, [0, 0, Math.PI / 2], 12);                              // 扶手管
  for (const s of [-1, 1]) {
    bx(g, 0.04, h * 0.5, d * 0.5, o.metal, s * w * 0.36, h * 0.3, -d * 0.15);                                                          // 托座
    bx(g, 0.06, h * 0.2, d * 0.24, tint(o.metal, -0.15), s * w * 0.36, h * 0.12, -d * 0.32);                                           // 墙板
  }
  return g;
}

/** 床屏：软包板 + 一圈木框 + 一排菱形扣（扣子是软包床屏的识别点）+ 两条支腿 */
function archHeadboard(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  const pd = Math.min(d * 0.55, 0.055);
  bx(g, w, h * 0.88, pd, tint(o.wood, -0.1), 0, h * 0.56, -0.005);                                                                      // 背板
  bx(g, w * 0.94, h * 0.8, pd * 0.9, o.color, 0, h * 0.56, 0.012);                                                                      // 软包面
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++)
    sp(g, 0.024, tint(o.color, -0.22), (i - 1.5) * w * 0.22, h * (0.4 + k * 0.32), 0.028, [1, 1, 0.4]);                                  // 菱形扣
  bx(g, w * 1.005, h * 0.06, pd * 1.1, tint(o.wood, 0.12), 0, h - h * 0.03, -0.005);                                                     // 顶收边
  for (const s of [-1, 1]) bx(g, 0.06, h * 0.16, pd, tint(o.wood, -0.2), s * (w / 2 - 0.05), h * 0.08, -0.005);                          // 支腿
  return g;
}

// ---------------------------------------------------------------------------
// 14. 分派表 —— 每个零件 id 指到它的专门造型；查不到才落回大类通用 builder。
//     别处可以 `PROP_BUILDERS[id]` 判断某个零件有没有专门造型。
// ---------------------------------------------------------------------------

const W = (fn, ...extra) => (kit, o, R) => fn(kit, o, R, ...extra);   // 给同一个 builder 传不同开关

export const PROP_BUILDERS = {
  // —— 11 个可落地大类的通用 builder（没有专门造型的零件走这里）——
  seat: genSeat, table: genTable, bed: genBed, storage: genStorage, cook: genCook,
  bar: genBar, light: genLight, textile: genTextile, plant: genPlant, media: genMedia, arch: genArch,

  // —— 座具 18 ——
  sofa_3: seatSofa, sofa_2: seatSofa, sofa_l: seatSofaL, chaise: seatChaise,
  armchair: seatArmchair, wing_chair: W(seatArmchair, true), lounge_chair: seatLounge,
  dining_chair: seatDining, cafe_chair: W(seatDining, true),
  bench_dining: genSeat, bench_hall: genSeat,
  bar_stool: seatStool, counter_stool: seatStool, office_chair: seatOffice,
  stool_low: seatStoolLow, floor_cushion: seatFloorCushion, beanbag: seatBean, rocking_chair: seatRocking,

  // —— 桌案 17 ——
  coffee_table: tabCoffee, dining_table_6: tabDining, dining_table_4: tabDining,
  cafe_table_2: tabRound, side_table: tabRound,
  desk_work: tabDesk, desk_l: W(tabDesk, true), meeting_table: W(tabDining, { trestle: true }),
  console_table: tabConsole, nesting_tables: tabNesting, bar_top: tabBarTop,
  island_counter: tabIsland, folding_table: W(tabDining, { slim: true }), vanity_table: tabVanity,
  picnic_table: tabPicnic, workbench: tabWorkbench, kid_table: tabKid,

  // —— 睡眠 12 ——
  bed_double: bedMain, bed_queen: bedMain, bed_single: W(bedMain, { pillows: 1 }),
  bed_kid: W(bedMain, { pillows: 1, rail: true }), bed_bunk: bedBunk, crib: bedCrib,
  sofa_bed: seatSofa, daybed: bedDaybed, futon: bedFloor, floor_mattress: bedFloor,
  hammock: bedHammock, nap_pod: bedPod,

  // —— 收纳 18 ——
  wardrobe: W(stoCabinet, { doors: 2, cornice: true }),
  sideboard: W(stoCabinet, { doors: 2, drawers: 2, top: true }),
  cabinet_low: W(stoCabinet, { doors: 2, top: true }),
  nightstand: W(stoCabinet, { drawers: 2, top: true }),
  locker: W(stoCabinet, { doors: 3, vents: true }),
  filing_cabinet: W(stoCabinet, { drawers: 3, label: true }),
  shelf_unit: stoShelf, bookshelf: stoShelf, book_wall: W(stoShelf, { allBooks: true, pitch: 0.42 }),
  wall_shelf: stoWallShelf, shoe_rack: stoShoeRack, pegboard: stoPegboard,
  crate_stack: stoCrates, clothes_rail: stoRail, coat_rack: stoCoatRack, bike_rack: stoBikeRack,
  toy_chest: W(stoChest, true), trunk_box: stoChest,

  // —— 厨作 20 ——
  fridge_tall: cookFridge, fridge_under: W(cookFridge, true),
  range_gas: cookRange, induction_hob: cookHob,
  oven_stack: cookOven, deck_oven: W(cookOven, 3),
  proofing_cabinet: W(cookGlassCab, { racks: 5 }), dough_mixer: cookMixer,
  range_hood: cookHood, grill_station: cookGrill,
  sink_kitchen: cookSink, sink_double: W(cookSink, true),
  prep_counter: cookPrep, cutting_station: W(cookPrep, true),
  spice_rack: cookRack, pot_hanger: cookPotHanger,
  dishwasher_door: W(cookMachine, { flat: true }), washer: cookMachine, dryer: cookMachine,
  utility_tub: cookTub,

  // —— 餐吧 16 ——
  bar_body: barBody, bar_body_small: barBody, espresso_machine: barEspresso, grinder: barGrinder,
  pastry_case: barCase, pie_warmer: W(barCase, true), bread_rack: barBreadRack,
  cold_case: W(cookGlassCab, { racks: 4, bottles: true }), register: barRegister,
  tap_tower: barTap, juice_press: barJuicer, cake_stand: barCakeStand,
  chalk_menu: barChalk, menu_sign: barMenuSign, cup_shelf: barCupShelf, syrup_rail: W(cookRack, true),

  // —— 灯具 15 ——
  pendant_single: litPendant, shop_pendant: W(litPendant, true), pendant_cluster: litCluster,
  floor_lamp: litLamp, table_lamp: litLamp, arc_lamp: litArc, desk_lamp: litDesk,
  wall_sconce: litSconce, string_lights: litString, neon_sign: litNeon,
  candle_cluster: litCandles, skylight_wash: litRail, track_light: W(litRail, true),
  paper_lantern: litLantern, safelight: litSafe,

  // —— 织物 16 ——
  rug_large: rugLike, rug_runner: rugLike, rug_round: texRugRound,
  floor_mat: texFloorMat, yoga_mat: texYogaMat,
  curtain_sheer: drapeLike, curtain_black: drapeLike, roman_blind: drapeLike, sheer_panel: drapeLike,
  cushion_set: texCushionSet, throw_blanket: texThrow, bed_linen: texLinen,
  canopy: texCanopy, tablecloth: texTablecloth, banner: texBanner, acoustic_panel: texAcoustic,

  // —— 绿植 13 ——
  tall_ficus: plantPotted, potted_palm: plantPalm, small_tree: plantTree, shrub_box: plantShrub,
  hanging_pothos: plantPothos, window_box: plantBox, street_planter: W(plantBox, true),
  flower_vase: plantVase, herb_pot: plantSmall, succulent_tray: W(plantSmall, true),
  moss_wall: plantMossWall, wreath: plantWreath, seed_rack: plantSeedRack,

  // —— 媒介 21 ——
  tv_wall: medTV, projector_screen: medScreen, turntable: medTurntable, speaker_floor: medSpeaker,
  record_bin: medRecordBin, piano_upright: medPiano,
  framed_print: medArt, large_canvas: medArt, photo_grid: W(medArt, true), poster_set: W(medArt, true),
  wall_clock: medClock, mirror_round: W(medMirror, true), mirror_full: medMirror,
  sign_board: medSign, blackboard: barChalk, desktop_pc: medPC, monitor_dual: medMonitors,
  printer_mfp: medPrinter, sewing_machine: medSewing, bench_saw: medSaw, enlarger: medEnlarger,

  // —— 建筑构件 15 ——
  window_casement: archWindow, window_bay: archBay, shopfront_glass: archShopfront,
  door_panel: archDoor, railing: archRailing, column: archColumn, arch_opening: archArch,
  louver: archLouver, balcony_slab: archSlab, skylight: archSkylight, cornice: archCornice,
  partition_screen: archPartition, step_stoop: archStoop, handrail_wall: archHandrail,
  headboard: archHeadboard,
};

/** 兜底：万一将来引擎加了新大类，也别让它变成一个纯色方块 */
function genericFallback(kit, o, R) {
  const g = new THREE.Group(), { w, d, h } = kit;
  bx(g, w * 0.92, h * 0.86, d * 0.92, o.color, 0, h * 0.43 + h * 0.07, 0);
  bx(g, w, h * 0.1, d, tint(o.wood, 0.1), 0, h * 0.05, 0);
  bx(g, w * 0.98, h * 0.06, d * 0.98, tint(o.accent, 0.1), 0, h * 0.97, 0);
  bx(g, w * 0.5, h * 0.3, 0.02, tint(o.color, 0.25), 0, h * 0.55, d / 2 + 0.006);
  return g;
}

/**
 * 造一件家具。
 * @param {object} kit {id, cn, cat, w, d, h, tags} —— 引擎给的零件定义，只读
 * @param {object} o   {color, accent, wood, metal, rand} —— 配色与可复算随机
 * @returns {THREE.Group|null} 原点在占地中心的地面、+Z 是正面；person 这类
 *          不落地的零件返回 null（它们由人物脚本消费，不是家具）
 */
export function buildProp(kit, o) {
  if (!kit || !isFinite(kit.w) || !isFinite(kit.d) || !isFinite(kit.h)) return null;
  const oo = norm(o);
  const fn = PROP_BUILDERS[kit.id] || PROP_BUILDERS[kit.cat] || genericFallback;
  const g = fn(kit, oo, oo.rand) || new THREE.Group();
  g.name = kit.id || 'prop';
  return g;
}

/** 某个零件有没有专门造型（给调试面板/体检脚本用） */
export function hasSpecialBuilder(kitId) {
  return Object.prototype.hasOwnProperty.call(PROP_BUILDERS, kitId);
}

export default buildProp;
