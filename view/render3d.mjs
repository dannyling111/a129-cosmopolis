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
import { floorTexture, wallTexture, artTexture } from './textures.mjs';
import { CITY_SKINS, TIMES, harmonize, skylineTowers } from './cityskin.mjs';

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
const mixHex = (a, b, k) => {
  const ch = (v, sh) => (v >> sh) & 255;
  return [16, 8, 0].reduce((acc, sh) => (acc << 8) | Math.round(ch(a, sh) * (1 - k) + ch(b, sh) * k), 0);
};
const rngOf = (n) => { let s = (n * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  // 🎨 融合点①:色调映射 + 曝光。同样的颜色,过不过这一步,出来是"插画"还是"三维软件截图"。
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  // 🎨 融合点②:开阴影。参考图里每件家具都有一小片柔影把它按在地板上,
  //             没有影子的东西看着就是"浮"的 —— 和主席上一轮说的人物浮空是同一种病。
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // 🎨 融合点③:天空用纯色 + 同色雾(不再用天空球贴图)——
  //             这样黄昏/夜晚只要换一个颜色,整张图的气氛就跟着换。
  scene.background = new THREE.Color(0xbfd9ee);
  scene.fog = new THREE.Fog(0xd7e6f2, 46, 168);

  // 🎨 融合点④:fov 34 的长焦。透视被压平,竖线接近平行,才有剖面插画的味道;
  //             45 度广角会把楼"撑开",怎么调色都像游戏截图。
  const camera = new THREE.PerspectiveCamera(34, 1, 0.3, 900);

  const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x9fb08a, 1.05); scene.add(hemi);
  const amb  = new THREE.AmbientLight(0xfff4e2, 0.55); scene.add(amb);
  const sun  = new THREE.DirectionalLight(0xfff3dc, 1.20); sun.position.set(16, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xb8d4ea, 0.28); fill.position.set(-14, 8, -10); scene.add(fill);

  const world = new THREE.Group(); scene.add(world);
  const stage = { renderer, scene, camera, world, sun, fill, hemi, amb, skin: 'paris', time: 'day' };
  applySkin(stage, 'paris', 'day');
  return stage;
}

/**
 * 换城市皮肤 / 换时段。只改灯光、天空、雾和屋内灯的亮度 —— 一个几何体都不重建。
 * 引擎数据完全不参与,所以随便切,布局不会变。
 */
export function applySkin(stage, skinId, timeId) {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const T = TIMES[timeId] || TIMES.day;
  stage.skin = skin.id; stage.time = T.id;
  stage.scene.background.setHex(skin[T.sky]);
  stage.scene.fog.color.setHex(skin[T.fog]);
  stage.scene.fog.near = T.fogNear; stage.scene.fog.far = T.fogFar;
  stage.hemi.color.setHex(T.hemiSky); stage.hemi.groundColor.setHex(skin.ground); stage.hemi.intensity = T.hemi;
  stage.amb.intensity = T.amb;
  stage.sun.color.setHex(T.key); stage.sun.intensity = T.keyI; stage.sun.position.set(...T.keyPos);
  stage.fill.color.setHex(T.fill); stage.fill.intensity = T.fillI; stage.fill.position.set(...T.fillPos);
  stage.renderer.toneMappingExposure = T.exposure;
  // 屋内吊灯:白天全灭,黄昏半亮,夜里全开(治愈感的一大半在这里)
  stage.world.traverse(o => {
    if (o.isLight && o.userData.lampBase !== undefined) o.intensity = o.userData.lampBase * T.lamps;
    if (o.userData.bulb) o.material = o.userData.bulbMats[T.lamps > 0.3 ? 1 : 0];
    if (o.userData.streetLamp) o.intensity = o.userData.lampBase * (T.lamps > 0 ? 1 : 0.12);
    if (o.userData.windowGlass) { o.material.color.setHex(T.lamps > 0.3 ? 0xffe2a8 : 0xbfe4f5); o.material.opacity = T.lamps > 0.3 ? 0.62 : 0.28; }
  });
  return stage;
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

export function buildRoom(room, floor, xOff, showZones, skinId = 'paris') {
  const g = new THREE.Group();
  const p = room.plan, h = p.h;
  // 🎨 融合点⑤:房间自己的配色先算出来,再【整栋按同一个城市皮肤收敛】。
  //    墙压进城市色相的 ±36° 窄带 → 一整栋看过去是一栋楼;
  //    强调色几乎不动 → 每间房还是各有各的性格(主席上一轮要的"风格各异"没丢)。
  const S = harmonize(styleOf(room.fn), skinId);
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
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0x8f8a78));
    bulb.userData.bulb = true;
    bulb.userData.bulbMats = [mat(0x8f8a78), new THREE.MeshBasicMaterial({ color: 0xfff3c4 })];
    g.add(put(bulb, lx, h - 0.60, lz));
    const lamp = new THREE.PointLight(S.mood === 'neon' ? 0xff7ae0 : 0xffd9a0, 0, 11);
    // 0.8 那一版夜里屋里只是"没那么黑",不是"亮着灯";参考图里夜晚每间房是暖橙色的发光盒子。
    lamp.userData.lampBase = S.mood === 'neon' ? 1.9 : 1.7;     // 由 applySkin 按时段点亮
    g.add(put(lamp, lx, h - 0.7, lz));

    // ── 🎨 融合点⑥【剖面开口】:面向观众的这一面【整面拆掉】,不留墙、不留玻璃。
    //    这是和另一个项目、也和参考插画差得最远的一处 —— 我原来在这一面装了整幅玻璃幕墙,
    //    于是所有房间都是"隔着一层毛玻璃看进去"的:夜里灯一亮,玻璃反而更挡人。
    //    参考图和那一版的做法是【把这一面直接切掉】(剖楼玩偶屋的"剖"就在这儿),
    //    看进去是通透的,家具和人是直接露出来的。开口边上只留三样东西提示"这里原本是外墙":
    //      · 楼板挑檐(把切口封个边,不然像被撕开的纸)
    //      · 及腰栏杆(住人的层才有 —— 底商是敞开的店面,不该有栏杆)
    //      · 花箱(参考图里几乎每个开口边都有,是"有人住"最便宜的信号)
    const edgeZ = p.d + 0.06;
    g.add(put(box(p.w, 0.12, 0.34, S.trim), p.w / 2, 0.06, edgeZ + 0.10));          // 切口封边
    const bw = Math.min(p.w * 0.52, 1.5);
    if (floor.band !== 'ground') {
      // 及腰栏杆(玻璃栏板 + 扶手 + 立柱):挡不住视线,但一眼就知道这是几层楼上
      const rail = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.62, 0.05),
        new THREE.MeshLambertMaterial({ color: 0xdff0f6, transparent: true, opacity: 0.30 }));
      g.add(put(rail, p.w / 2, 0.34, edgeZ + 0.16));
      g.add(put(box(p.w, 0.06, 0.11, S.trim), p.w / 2, 0.68, edgeZ + 0.16));         // 扶手
      const posts = Math.max(3, Math.round(p.w / 1.5));
      for (let i = 0; i <= posts; i++)
        g.add(put(box(0.05, 0.66, 0.05, S.trim), (i / posts) * p.w, 0.35, edgeZ + 0.16));
      // 花箱挂在栏杆外侧
      g.add(put(box(bw, 0.20, 0.22, 0xb5794a), p.w * 0.5, 0.30, edgeZ + 0.30));
      g.add(put(box(bw - 0.06, 0.10, 0.17, 0x4f9a52), p.w * 0.5, 0.44, edgeZ + 0.30));
      for (let i = 0; i < 5; i++)
        g.add(put(box(0.09, 0.09, 0.09, [0xff5d7a, 0xffd34e, 0xff8a3d, 0xe86af0, 0xfff1f0][i % 5]),
          p.w * 0.5 - bw / 2 + 0.15 + i * (bw - 0.30) / 4, 0.52, edgeZ + 0.30));
    }
    // ── 背景墙上开真窗洞:光从楼背面透进来,屋里才有"里外"关系,不是个封死的盒子
    const winW = Math.min(p.w * 0.42, 1.7), winH = HEADER - SILL - 0.25;
    const wx = p.w * (0.24 + rand() * 0.5);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH),
      new THREE.MeshBasicMaterial({ color: 0xbfe4f5 }));
    sky.userData.windowGlass = true;
    g.add(put(sky, wx, SILL + winH / 2 + 0.1, 0.012));   // 贴在背景墙【室内那一面】上,不能塞进墙体里(会被墙面挡住)
    g.add(put(box(winW + 0.14, 0.07, 0.07, S.trim), wx, SILL + 0.06, 0.035));         // 窗台
    g.add(put(box(winW + 0.14, 0.07, 0.07, S.trim), wx, SILL + winH + 0.16, 0.035));
    [-1, 1].forEach(sx => g.add(put(box(0.06, winH + 0.22, 0.07, S.trim), wx + sx * (winW / 2 + 0.05), SILL + winH / 2 + 0.1, 0.035)));
    // 窗帘(背景墙上的,不挡剖面)
    [-1, 1].forEach(sx => g.add(put(box(0.20, winH + 0.20, 0.06, S.accent), wx + sx * (winW / 2 + 0.16), SILL + winH / 2 + 0.12, 0.06)));
  } else {
    // 屋顶层:女儿墙 + 花池
    g.add(put(box(p.w, 0.42, T, S.trim), p.w / 2, 0.21, p.d + T / 2));   // 朝观众这面压低到 0.42m,否则整个露台被挡住
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
  // 阴影:家具投影、墙地受影。没有这一步,家具再精细也是"贴"在地上的。
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

export function buildStreet(b, skinId = 'paris') {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const g = new THREE.Group();
  const W = b.width, D = b.depth;
  const rnd = rngOf(9173);
  // 大地:草地贴图(参考图里楼就长在公园边上)
  // 大地铺得足够远,靠雾把边缘化进天空 —— 不然会看到一条生硬的"地平线切口"
  const gA = skin.ground, gB = mixHex(skin.ground, 0x000000, 0.14);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W + 420, 0.06, 420), texMat(floorTexture('grass', gA, gB, 160)));
  g.add(put(ground, W / 2, -0.24, D + 6));
  g.add(put(box(W + 34, 0.16, 9.5, 0x9c968a), W / 2, -0.08, D + 7.2));                     // 路面
  g.add(put(box(W + 34, 0.30, 3.4, skin.sidewalk), W / 2, -0.02, D + 1.7));               // 人行道
  // 斑马线
  for (let i = 0; i < 8; i++) g.add(put(box(0.5, 0.02, 2.4, 0xfffdf6), W * 0.5 - 2 + i * 0.62, 0.02, D + 7.2));

  for (let i = 0; i < b.street.lamps; i++) {
    const x = (i + 0.5) / b.street.lamps * (W + 18) - 9;
    g.add(put(box(0.13, 4.2, 0.13, 0x4e5a58), x, 2.1, D + 3.0));
    g.add(put(box(0.5, 0.16, 0.3, 0xffe9a8), x, 4.25, D + 3.0));
    const glow = new THREE.PointLight(0xffd98a, 0.22, 11);
    glow.userData.streetLamp = true; glow.userData.lampBase = 1.5;
    g.add(put(glow, x, 3.9, D + 3.0));
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
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  ground.castShadow = false;                       // 大地只接影,不投影(不然自遮挡出条纹)
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

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ buildShell —— 【剖楼外壳】:把并排的房间绑成"一栋被切开的楼"
//
// 这是画风融合里改动最大、也最值的一块。原来 15 间房是 15 个独立盒子并排 ——
// 看着像货架。参考图和另一个项目里,楼之所以是"楼",靠的是三样【房间之外】的东西:
//   · 楼板 slab   —— 每层之间一道水平厚板,把这一层的房间在视觉上串成一条
//   · 竖柱 pier   —— 开间之间一根通高的柱子,把楼板在竖向上钉住
//   · 外檐/基座/顶檐 —— 让这栋楼有"上下两头",不是一截被切断的管子
// 少了它们,再精细的室内也拼不成一栋建筑。
// ═══════════════════════════════════════════════════════════════════════════
export function buildShell(b, skinId = 'paris') {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const g = new THREE.Group();
  const W = b.width, D = b.depth, H = (b.levels + 1) * b.floorH;

  // 基座:楼比地面高出一截,才有"落在地上"的分量
  g.add(put(box(W + 1.1, 0.55, D + 1.3, skin.base), W / 2, -0.28, D / 2 - 0.1));
  g.add(put(box(W + 1.35, 0.18, D + 1.5, skin.facadeTrim), W / 2, -0.60, D / 2 - 0.1));

  // 每层楼板(挑出室内 0.22m,形成一道阴影线 —— 剖面插画全靠这道线分层)
  for (let lv = 0; lv <= b.levels; lv++) {
    const y = lv * b.floorH;
    g.add(put(box(W + 0.5, 0.16, D + 0.44, skin.facade), W / 2, y - 0.16, D / 2 + 0.10));
    g.add(put(box(W + 0.62, 0.07, D + 0.56, skin.facadeTrim), W / 2, y - 0.26, D / 2 + 0.14));
  }

  // 开间之间的竖柱(含最左最右两根边柱)
  let x = 0;
  for (let i = 0; i <= b.bays; i++) {
    g.add(put(box(0.30, H + 0.30, 0.30, skin.facadeTrim), x, H / 2 - 0.15, D + 0.16));
    if (i < b.bays) x += b.bayW[i];
  }

  // 两侧山墙(整栋只有面向相机的一面是敞开的 —— 这就是"剖")
  g.add(put(box(0.26, H, D + 0.3, skin.facade), -0.13, H / 2, D / 2));
  g.add(put(box(0.26, H, D + 0.3, skin.facade), W + 0.13, H / 2, D / 2));
  // 背立面
  g.add(put(box(W + 0.26, H, 0.22, skin.facade), W / 2, H / 2, -0.24));

  // 顶檐 + 屋脊
  g.add(put(box(W + 1.0, 0.22, D + 1.1, skin.facadeTrim), W / 2, H + 0.11, D / 2 + 0.05));
  g.add(put(box(W + 0.7, 0.30, D + 0.8, skin.roof), W / 2, H + 0.37, D / 2 + 0.05));

  // 接触阴影:楼底下一片径向渐隐的软影。太阳阴影管硬的,这片管"贴地"的那种沉。
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c2 = cv.getContext('2d');
  const gr = c2.createRadialGradient(128, 128, 10, 128, 128, 126);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c2.fillStyle = gr; c2.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W + 14, D + 16),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  g.add(put(shadow, W / 2, -0.66, D / 2 + 1.2));
  g.traverse(o => { if (o.isMesh && o !== shadow) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌆 buildSkyline —— 远景城市剪影 + 云 + 日月
// 没有远景时,这栋楼是"悬在空盒子里的模型";有了远景 + 同色雾,它才在一座城里。
// ═══════════════════════════════════════════════════════════════════════════
export function buildSkyline(b, skinId = 'paris') {
  const skin = CITY_SKINS[skinId] || CITY_SKINS.paris;
  const g = new THREE.Group();
  const cx = b.width / 2;
  skylineTowers(skinId).forEach((t, i) => {
    const m = box(t.w, t.h, t.d, t.c);
    g.add(put(m, cx + t.x, t.h / 2, t.z));
    // 夜里亮起来的窗带(只给最近的 12 座,远的看不出来还费性能)
    if (i < 12) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(t.w * 0.62, t.h * 0.42),
        new THREE.MeshBasicMaterial({ color: 0xf0d9a0, transparent: true, opacity: 0 }));
      win.userData.windowGlass = false;
      win.userData.towerWin = true;
      g.add(put(win, cx + t.x, t.h * 0.58, t.z + t.d / 2 + 0.06));
    }
  });
  // 云(白天才有)
  const clouds = new THREE.Group(); clouds.userData.clouds = true;
  [[-42, 34, -60], [26, 30, -66], [58, 32, -48], [-14, 38, -72], [8, 28, -40]].forEach(pz => {
    const c = new THREE.Group();
    [[0, 0, 0, 3.4], [3.1, 0.4, 0.5, 2.6], [-2.7, 0.2, 0.4, 2.2]].forEach(([dx, dy, dz, r]) =>
      c.add(put(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(0xfffdf8)), dx, dy, dz)));
    clouds.add(put(c, cx + pz[0], pz[1], pz[2]));
  });
  g.add(clouds);
  // 日/月:同一个球换颜色换位置,由 applySkin 之外的 setSkyBody 管
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 14), new THREE.MeshBasicMaterial({ color: 0xfff4c8 }));
  body.userData.skyBody = true;
  g.add(put(body, cx + 42, 40, -74));
  g.userData.skyline = true;
  return g;
}

/** 远景随时段变:夜里点亮塔楼窗、收起云、把太阳换成月亮 */
export function setSkylineTime(g, timeId) {
  const night = timeId === 'night', dusk = timeId === 'dusk';
  g.traverse(o => {
    if (o.userData.towerWin) o.material.opacity = night ? 0.55 : dusk ? 0.22 : 0;
    if (o.userData.clouds) o.visible = !night;
    if (o.userData.skyBody) {
      o.material.color.setHex(night ? 0xf4f0e0 : dusk ? 0xf0b27a : 0xfff4c8);
      o.position.set(o.position.x, night ? 46 : dusk ? 22 : 40, o.position.z);
      o.scale.setScalar(night ? 1.35 : 1);
    }
  });
}
