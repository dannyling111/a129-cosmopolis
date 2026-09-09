// ============================================================
// 🎥 render3d.mjs —— 把引擎算出来的数据渲染成一栋【鲜艳、细节密、治愈系】的楼
//
// 渲染层【不做任何决策】:摆哪儿、谁坐哪、哪层放什么,全是 engine/ 算好的。
// v2 大修(主席看图后提的四条):
//   ① 颜色一定要很鲜艳      → 每间房一套糖果色墙面 + 地板贴图(palette.mjs)
//   ② 房子里的细节要加强    → 踢脚线/画墙/吊灯/窗帘/窗台花箱/阳台栏杆/天光
//   ③ 家具细节要加强        → 每件家具是多部件造型,不再是色块(props.mjs)
//   ④ 人物浮在空中          → 骨架原点改到脚底,坐姿小腿角反解落地(figure.mjs)
// ============================================================
import * as THREE from '../vendor/three.module.js';
// 家具造型包是【可插拔】的:没有它也能跑(退回色块),有它就长出多部件家具。
// 这样渲染层不会因为造型包缺一个导出就整页白屏 —— 上一版就是这么白的。
let buildProp = null;
export function setPropBuilder(fn) { buildProp = fn; }
import { ROOM_STYLES, CAT_PALETTE, WOOD, METAL, styleOf, propColors } from './palette.mjs';
import { buildFigure, poseFigure, buildPet, SEAT_Y } from './figure.mjs';
import { floorTexture, wallTexture, artTexture, skyTexture } from './textures.mjs';

export const ZONE_COLOR = { window: 0x6fb7c9, main: 0xff8a5c, aux: 0x9ac96a, walldec: 0xb07ce8, path: 0xd9d2c4 };
/** 12 大类的代表色(界面图例用;三维里用 palette 的每件随机色) */
export const CAT_COLOR = {
  seat: 0xff7a59, table: 0xf0a94b, bed: 0xe86a92, storage: 0xb2865b, cook: 0x9aa6b2,
  bar: 0x7bbf8a, light: 0xf7c948, textile: 0xef7fa8, plant: 0x5fb36a, media: 0x6a7fdb,
  arch: 0x9fb3c8, person: 0x0f7f7c,
};

const MAT = new Map();
const mat = (hex, o = {}) => {
  const k = hex + '|' + JSON.stringify(o);
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial({ color: hex, ...o }));
  return MAT.get(k);
};
const texMat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });
const box = (w, h, d, hex, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, o));
const put = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const rngOf = (n) => { let s = (n * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();

  // 大晴天:天空球 + 远处淡蓝雾(参考图全是明亮户外)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe6f7, 55, 190);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight(0xfff8ec, 0x9fb08a, 1.15));   // 天光偏暖,地面反光偏绿(草地)
  // 房间是封顶的,太阳照不进去 —— 不补一层环境光,屋里就会灰扑扑的,
  // 而参考图里屋里比屋外还亮。这一层专门喂室内。
  scene.add(new THREE.AmbientLight(0xfff4e2, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.95); sun.position.set(16, 26, 18); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.34); fill.position.set(-14, 10, -12); scene.add(fill);

  const world = new THREE.Group(); scene.add(world);
  return { renderer, scene, camera, world, sun };
}

/** 触屏轨道:一指转、两指缩放。界面上不出现任何键鼠话术。 */
export function orbit(canvas, camera, opts = {}) {
  const st = { yaw: opts.yaw ?? -0.42, pitch: opts.pitch ?? 0.30, dist: opts.dist ?? 34, target: opts.target || new THREE.Vector3(0, 5, 0) };
  let ptrs = new Map(), lastPinch = 0;
  const apply = () => {
    const p = Math.max(0.05, Math.min(1.35, st.pitch));
    camera.position.set(
      st.target.x + Math.sin(st.yaw) * Math.cos(p) * st.dist,
      st.target.y + Math.sin(p) * st.dist,
      st.target.z + Math.cos(st.yaw) * Math.cos(p) * st.dist);
    camera.lookAt(st.target);
  };
  const down = e => { canvas.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: 0 }); };
  const move = e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { st.yaw -= dx * 0.0062; st.pitch += dy * 0.0052; apply(); }
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) { st.dist = Math.max(6, Math.min(110, st.dist * (lastPinch / d))); apply(); }
      lastPinch = d;
    }
  };
  const up = e => {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) lastPinch = 0;
    if (p && p.moved < 9 && opts.onTap) opts.onTap({ x: p.x0, y: p.y0 });
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); st.dist = Math.max(6, Math.min(110, st.dist * (1 + Math.sign(e.deltaY) * 0.09))); apply(); }, { passive: false });
  apply();
  return {
    st, apply,
    focus(t, d) { st.target.copy(t); if (d) st.dist = d; apply(); },
    fit(target, spanW, spanH, pad = 1.22) {
      const vfov = camera.fov * Math.PI / 180;
      const dv = (spanH / 2) / Math.tan(vfov / 2);
      const dh = (spanW / 2) / (Math.tan(vfov / 2) * Math.max(0.2, camera.aspect));
      st.target.copy(target); st.dist = Math.max(9, Math.max(dv, dh) * pad); apply();
    },
  };
}

// ---------------- 一间房 ----------------
const T = 0.10;          // 墙厚
const SILL = 0.85;       // 窗台高
const HEADER = 2.35;     // 窗顶高

export function buildRoom(room, floor, xOff, showZones) {
  const g = new THREE.Group();
  const p = room.plan, h = p.h;
  const S = styleOf(room.fn);
  const rand = rngOf(floor.level * 977 + room.bay * 131 + room.fn.length);
  g.position.set(xOff, floor.y, 0);
  g.userData.room = room;
  const roofTop = floor.band === 'roof';

  // ── 地面:按功能选材质(住宅木地板/厨卫瓷砖/店铺抛光/屋顶草地/工坊石材)
  const fl = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.14, p.d),
    [0, 1, 2, 3, 4, 5].map(i => i === 2
      ? texMat(floorTexture(S.floor, S.floorA, S.floorB, Math.max(p.w, p.d)))
      : mat(S.floorB)));
  g.add(put(fl, p.w / 2, -0.07, p.d / 2));

  const wallH = roofTop ? 1.05 : h;
  // ── 里墙(背景墙):用强调色 + 一张"画墙"贴图,一个 mesh 换来五个画框
  const backTex = texMat(artTexture(Math.floor(rand() * 999), S.accent));
  const back = new THREE.Mesh(new THREE.BoxGeometry(p.w, wallH, T),
    [mat(S.accent), mat(S.accent), mat(S.accent), mat(S.accent), roofTop ? mat(S.accent) : backTex, mat(S.accent)]);
  g.add(put(back, p.w / 2, wallH / 2, -T / 2));
  // ── 侧隔墙(比里墙厚一号,让每间房看得出边界)
  const sideMat = texMat(wallTexture(S.wall, ['plain', 'stripe', 'dot', 'grid'][Math.floor(rand() * 4)], S.accent));
  const wl = new THREE.Mesh(new THREE.BoxGeometry(T * 1.5, wallH, p.d), sideMat);
  g.add(put(wl, -T * 0.75, wallH / 2, p.d / 2));
  if (room.bay === floor.rooms.length - 1) {
    const wr = new THREE.Mesh(new THREE.BoxGeometry(T * 1.5, wallH, p.d), sideMat);
    g.add(put(wr, p.w + T * 0.75, wallH / 2, p.d / 2));
  }
  // ── 踢脚线(细节里最便宜也最像样的一条)
  g.add(put(box(p.w, 0.10, 0.03, S.trim), p.w / 2, 0.05, 0.015));
  g.add(put(box(0.03, 0.10, p.d, S.trim), 0.015, 0.05, p.d / 2));

  if (!roofTop) {
    // ── 天花板 + 吊灯(带灯绳和暖光)
    g.add(put(box(p.w, 0.08, p.d, 0xfffaf0), p.w / 2, h + 0.04, p.d / 2));
    const lx = p.w * (0.35 + rand() * 0.3), lz = p.d * 0.45;
    g.add(put(box(0.025, 0.42, 0.025, 0x6b5f52), lx, h - 0.21, lz));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 12), mat(S.accent));
    shade.rotation.x = Math.PI; g.add(put(shade, lx, h - 0.50, lz));
    g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xfff3c4)), lx, h - 0.60, lz));
    const lamp = new THREE.PointLight(S.mood === 'neon' ? 0xff7ae0 : 0xffe4b8, S.mood === 'neon' ? 0.85 : 0.70, 8.5);
    g.add(put(lamp, lx, h - 0.7, lz));

    // ── 外墙:窗下墙 + 窗上梁 + 窗框竖挺 + 窗台 + 帘子 + 窗外花箱
    g.add(put(box(p.w, SILL, T, S.wall), p.w / 2, SILL / 2, p.d + T / 2));
    g.add(put(box(p.w, Math.max(0.1, h - HEADER), T, S.wall), p.w / 2, h - (h - HEADER) / 2, p.d + T / 2));
    g.add(put(box(p.w, 0.06, 0.20, S.trim), p.w / 2, SILL + 0.03, p.d + 0.02));            // 窗台板
    const bays = Math.max(2, Math.round(p.w / 1.6));
    for (let i = 0; i <= bays; i++)
      g.add(put(box(0.07, HEADER - SILL, 0.07, S.trim), (i / bays) * p.w, (SILL + HEADER) / 2, p.d + T / 2));
    // 玻璃(淡蓝半透,远看有反光感)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(p.w, HEADER - SILL), new THREE.MeshLambertMaterial({ color: 0xbfe4f5, transparent: true, opacity: 0.28 }));
    g.add(put(glass, p.w / 2, (SILL + HEADER) / 2, p.d + T * 0.55));
    // 两侧窗帘
    [0.14, p.w - 0.14].forEach(x => g.add(put(box(0.26, HEADER - SILL + 0.14, 0.06, S.accent), x, (SILL + HEADER) / 2 + 0.05, p.d - 0.06)));
    // 窗外花箱 + 花(参考图里几乎每扇窗下都有)
    const bw = Math.min(p.w * 0.6, 1.6);
    g.add(put(box(bw, 0.22, 0.26, 0xb5794a), p.w / 2, SILL + 0.11, p.d + 0.22));
    for (let i = 0; i < 5; i++) {
      const c = [0xff5d7a, 0xffd34e, 0xff8a3d, 0xe86af0, 0xfff1f0][i % 5];
      g.add(put(box(0.10, 0.10, 0.10, c), p.w / 2 - bw / 2 + 0.16 + i * (bw - 0.32) / 4, SILL + 0.28, p.d + 0.22));
    }
    g.add(put(box(bw - 0.08, 0.10, 0.20, 0x4f9a52), p.w / 2, SILL + 0.24, p.d + 0.22));

    // ── 住人的层给个小阳台(参考图里阳台是"有人住"的最强信号)
    if (floor.band !== 'ground' && rand() > 0.35) {
      const by = 0;
      g.add(put(box(p.w * 0.62, 0.10, 0.85, S.trim), p.w / 2, by + 0.05, p.d + 0.60));
      for (let i = 0; i <= 6; i++)
        g.add(put(box(0.035, 0.52, 0.035, 0x8d8272), p.w / 2 - p.w * 0.31 + i * (p.w * 0.62) / 6, by + 0.36, p.d + 1.00));
      g.add(put(box(p.w * 0.62, 0.05, 0.05, 0x8d8272), p.w / 2, by + 0.62, p.d + 1.00));
      g.add(put(box(0.34, 0.30, 0.30, 0xc98a5c), p.w / 2 - p.w * 0.24, by + 0.20, p.d + 0.75));
      g.add(put(box(0.30, 0.34, 0.26, 0x5fae5a), p.w / 2 - p.w * 0.24, by + 0.50, p.d + 0.75));
    }
  } else {
    // 屋顶层:女儿墙 + 花池
    g.add(put(box(p.w, 1.05, T, S.trim), p.w / 2, 0.52, p.d + T / 2));
    g.add(put(box(p.w, 1.05, T, S.trim), p.w / 2, 0.52, -T / 2));
    for (let i = 0; i < 3; i++) {
      const x = p.w * (0.2 + i * 0.3);
      g.add(put(box(0.8, 0.32, 0.5, 0xb5794a), x, 0.16, p.d * 0.25));
      g.add(put(box(0.72, 0.30, 0.44, 0x4f9a52), x, 0.44, p.d * 0.25));
    }
  }

  if (showZones) {
    p.zones.list.forEach(z => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d),
        new THREE.MeshBasicMaterial({ color: ZONE_COLOR[z.role], transparent: true, opacity: 0.34, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(z.x + z.w / 2, 0.03, z.z + z.d / 2);
      g.add(m);
    });
  }

  // ── 家具:每件都是多部件造型,原点在占地中心的地面,+Z 是正面
  p.items.forEach((it, idx) => {
    const kit = KIT_LOOKUP[it.kit];
    if (!kit) return;
    const cols = propColors(kit, rngOf(idx * 7919 + floor.level * 31 + room.bay));
    let obj = null;
    if (buildProp) { try { obj = buildProp(kit, { ...cols, rand: rngOf(idx * 104729 + room.bay) }); } catch (e) { obj = null; } }
    if (!obj) { obj = box(Math.max(0.06, it.box.w - 0.04), Math.max(0.05, it.h || 0.6), Math.max(0.06, it.box.d - 0.04), cols.color); obj.position.y = (it.h || 0.6) / 2; const w = new THREE.Group(); w.add(obj); obj = w; }
    obj.rotation.y = -(it.rot || 0) * Math.PI / 180;
    obj.position.set(it.box.x + it.box.w / 2, it.lift || 0, it.box.z + it.box.d / 2);
    obj.userData.item = it;
    g.add(obj);
  });

  // ── 人:脚踩在地板上(y=0 就是这一层的地面)
  const people = new THREE.Group(); g.add(people);
  room.cast.actors.forEach((a, i) => {
    const seed = i * 37 + room.bay * 7 + floor.level * 101;
    const f = a.kind === 'person' ? buildFigure(seed, { scale: room.fn === 'kidroom' || room.fn === 'nursery' || room.fn === 'playroom' ? 0.72 : 1 }) : buildPet(seed);
    f.userData.actor = a;
    people.add(f);
  });
  g.userData.people = people;
  g.userData.style = S;
  return g;
}

/** 家具查表(由 app 注入,避免 render 层去 import 引擎数据) */
export let KIT_LOOKUP = {};
export function setKitLookup(map) { KIT_LOOKUP = map; }

/** 每帧把人放到引擎算出的位置上(渲染不决定人在哪,只是照着摆) */
/** 从"人占着的那件家具"倒推坐面高度 —— 人坐多高不是我拍的,是那件家具的高度决定的 */
function seatInfo(a) {
  if (a._si) return a._si;
  const kit = a.home && KIT_LOOKUP[a.home.kit];
  const kh = kit ? kit.h : 0.8;
  let seatY = 0.45, lift = 0;
  if (a.body === 'sit_soft') seatY = Math.min(0.46, Math.max(0.24, kh * 0.55));
  else if (a.body === 'sit_up') seatY = Math.min(0.52, Math.max(0.30, kh * 0.52));
  else if (a.body === 'sit_high') seatY = Math.min(0.80, Math.max(0.50, kh * 0.90));
  else if (a.body === 'lie') { lift = Math.min(0.75, Math.max(0.25, kh)); seatY = 0; }
  return (a._si = { seatY, lift });
}

export function syncPeople(g, t) {
  const people = g.userData.people; if (!people) return;
  people.children.forEach(f => {
    const a = f.userData.actor;
    const si = a.kind === 'person' ? seatInfo(a) : { seatY: 0, lift: 0 };
    f.position.set(a.x, a.state === 'sit' ? si.lift : 0, a.z);
    f.rotation.y = (a.dir || 0) * Math.PI / 180;
    if (a.kind === 'person') poseFigure(f, a.body, t * 5.2 + a.x * 2, { seatY: si.seatY });
  });
}

// ---------------- 街道:楼前是社区的一层 ----------------
function lowFigure(n) {                                   // 街上的行人离得远,用简化版(6 个部件),不然手机吃不消
  const g = new THREE.Group();
  const sh = [0xff7a59, 0x4fb0c6, 0xf7c948, 0x7bc47f, 0xe86a92, 0x6a7fdb][n % 6];
  const pa = [0x3d5a80, 0x4a4e69, 0x8c5e3c][n % 3];
  const sk = [0xf6d3b0, 0xd9a273, 0xb87a4e, 0x8d5a36][n % 4];
  const legs = [-1, 1].map(sx => { const l = box(0.11, 0.86, 0.13, pa); l.position.set(sx * 0.085, 0.43, 0); g.add(l); return l; });
  g.add(put(box(0.32, 0.52, 0.19, sh), 0, 1.16, 0));
  g.add(put(box(0.19, 0.22, 0.185, sk), 0, 1.53, 0));
  g.add(put(box(0.205, 0.08, 0.20, [0x2b2118, 0x6b4a2f, 0x1a1a1e][n % 3]), 0, 1.63, 0));
  g.userData.legs = legs;
  return g;
}

export function buildStreet(b) {
  const g = new THREE.Group();
  const W = b.width, D = b.depth;
  const rnd = rngOf(9173);
  // 大地:草地贴图(参考图里楼就长在公园边上)
  // 大地铺得足够远,靠雾把边缘化进天空 —— 不然会看到一条生硬的"地平线切口"
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W + 420, 0.06, 420), texMat(floorTexture('grass', 0x8cc06a, 0x6ea854, 160)));
  g.add(put(ground, W / 2, -0.24, D + 6));
  g.add(put(box(W + 34, 0.16, 9.5, 0x9c968a), W / 2, -0.08, D + 7.2));                     // 路面
  g.add(put(box(W + 34, 0.30, 3.4, 0xe4dcc9), W / 2, -0.02, D + 1.7));                    // 人行道
  // 斑马线
  for (let i = 0; i < 8; i++) g.add(put(box(0.5, 0.02, 2.4, 0xfffdf6), W * 0.5 - 2 + i * 0.62, 0.02, D + 7.2));

  for (let i = 0; i < b.street.lamps; i++) {
    const x = (i + 0.5) / b.street.lamps * (W + 18) - 9;
    g.add(put(box(0.13, 4.2, 0.13, 0x4e5a58), x, 2.1, D + 3.0));
    g.add(put(box(0.5, 0.16, 0.3, 0xffe9a8), x, 4.25, D + 3.0));
    const glow = new THREE.PointLight(0xffd98a, 0.22, 8); g.add(put(glow, x, 3.9, D + 3.0));
  }
  for (let i = 0; i < b.street.trees; i++) {
    const x = (i + 0.5) / b.street.trees * (W + 16) - 8 + rnd() * 1.2;
    g.add(put(box(0.24, 2.1, 0.24, 0x6b5340), x, 1.05, D + 5.4));
    const c1 = [0x5d8a56, 0x6fa35f, 0x4f7d4a][i % 3];
    g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.95 + rnd() * 0.3, 8, 6), mat(c1)), x, 2.6, D + 5.4));
    g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.7 + rnd() * 0.25, 8, 6), mat(c1)), x + 0.5, 3.15, D + 5.1));
    g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.6 + rnd() * 0.2, 8, 6), mat(c1)), x - 0.45, 3.05, D + 5.7));
  }
  for (let i = 0; i < b.street.planters; i++) {
    const x = (i + 0.5) / b.street.planters * W;
    g.add(put(box(1.4, 0.40, 0.55, 0xb5794a), x, 0.20, D + 1.6));
    g.add(put(box(1.2, 0.30, 0.42, 0x62935b), x, 0.52, D + 1.6));
    [0xff5d7a, 0xffd34e, 0xe86af0].forEach((c, j) => g.add(put(box(0.13, 0.13, 0.13, c), x - 0.4 + j * 0.4, 0.70, D + 1.6)));
  }
  // 一楼店面的遮阳篷(参考图里底商都有)
  for (let i = 0; i < b.bays; i++) {
    const x = b.bayW.slice(0, i).reduce((a, c) => a + c, 0) + b.bayW[i] / 2;
    const aw = new THREE.Mesh(new THREE.BoxGeometry(b.bayW[i] * 0.8, 0.10, 1.1), mat([0xff8a5c, 0x4fb0c6, 0xf7c948, 0x7bc47f, 0xe86a92][i % 5]));
    aw.rotation.x = -0.28; g.add(put(aw, x, 2.55, D + 0.65));
  }
  const peds = new THREE.Group();
  for (let i = 0; i < b.street.pedestrians; i++) {
    const f = lowFigure(i);
    f.userData.ped = { x: rnd() * (W + 16) - 8, z: D + 3.4 + rnd() * 2.6, v: (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.8), ph: rnd() * 6 };
    peds.add(f);
  }
  g.add(peds); g.userData.peds = peds; g.userData.W = W;
  return g;
}

export function syncStreet(g, t) {
  const peds = g.userData.peds; if (!peds) return;
  peds.children.forEach(f => {
    const p = f.userData.ped;
    p.x += p.v * 0.016;
    if (p.x > g.userData.W + 9) p.x = -9; if (p.x < -9) p.x = g.userData.W + 9;
    f.position.set(p.x, 0, p.z);
    f.rotation.y = p.v > 0 ? Math.PI / 2 : -Math.PI / 2;
    const sw = Math.sin(t * 5 + p.ph) * 0.32;
    f.userData.legs[0].rotation.x = sw; f.userData.legs[1].rotation.x = -sw;
  });
}

/** 侧墙上的大广告牌(参考图里那块 "CosmoPolis · the future you can see") */
export function buildBillboard(b) {
  const g = new THREE.Group();
  const H = (b.levels + 1) * b.floorH;
  const bw = Math.min(4.6, b.depth * 0.8), bh = Math.min(H * 0.52, 7.5);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 420;
  const c = cv.getContext('2d');
  const grd = c.createLinearGradient(0, 0, 0, 420);
  grd.addColorStop(0, '#1b2a6b'); grd.addColorStop(0.62, '#3b4fd8'); grd.addColorStop(1, '#ff6b9d');
  c.fillStyle = grd; c.fillRect(0, 0, 256, 420);
  c.strokeStyle = 'rgba(120,240,255,.55)'; c.lineWidth = 3;
  for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(40 + i * 34, 300 + (i % 3) * 30, 26 + i * 4, 0, 7); c.stroke(); }
  c.fillStyle = '#ffffff'; c.font = 'bold 40px system-ui, sans-serif'; c.textAlign = 'center';
  c.fillText('CosmoPolis', 128, 78);
  c.font = '600 20px system-ui, sans-serif'; c.fillStyle = '#cfe8ff';
  c.fillText('量化积木城市', 128, 112);
  c.font = 'italic 600 26px system-ui, sans-serif'; c.fillStyle = '#fff3b0';
  c.fillText('the future', 128, 372); c.fillText('you can see', 128, 402);
  const tex = new THREE.CanvasTexture(cv);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, bh, bw), [mat(0x2a2f3a), mat(0x2a2f3a), mat(0x2a2f3a), mat(0x2a2f3a), texMat(tex), mat(0x2a2f3a)]);
  g.add(put(panel, b.width + 0.34, bh / 2 + H * 0.28, b.depth * 0.45));
  for (const dy of [-bh * 0.35, bh * 0.35])
    g.add(put(box(0.5, 0.09, 0.09, 0x5a5f6a), b.width + 0.12, bh / 2 + H * 0.28 + dy, b.depth * 0.45));
  return g;
}
