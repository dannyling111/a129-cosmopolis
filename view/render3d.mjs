// ============================================================
// 🎥 render3d.mjs —— 把引擎算出来的数据渲染成一栋楼(three.js)
// 渲染层【不做任何决策】:摆哪儿、谁坐哪、哪层放什么,全是 engine/ 算好的。
// 这一层只负责把数字变成能看的东西 —— 换渲染器不该改引擎,反过来也一样。
// ============================================================
import * as THREE from '../vendor/three.module.js';

// 12 大类各一个颜色:一眼看出「这是座具还是灯」
export const CAT_COLOR = {
  seat: 0xc9714f, table: 0xc0954f, bed: 0xb0687f, storage: 0x8a7a63,
  cook: 0x8d8f97, bar: 0x7f9b7a, light: 0xe8c86a, textile: 0xd08c96,
  plant: 0x5f9161, media: 0x5c6b8a, arch: 0x9aa2ad, person: 0x0f7f7c,
};
export const ZONE_COLOR = { window: 0x6fb7c9, main: 0xd98b5f, aux: 0x9aa86a, walldec: 0xa585c4, path: 0xb9b2a4 };

const MAT = new Map();
const mat = (hex, o = {}) => {
  const k = hex + '|' + JSON.stringify(o);
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial({ color: hex, ...o }));
  return MAT.get(k);
};
const box = (w, h, d, hex, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, o));

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e0d2);
  scene.fog = new THREE.Fog(0xe7e0d2, 46, 130);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xfff6e2, 0x6b6355, 1.05));
  const sun = new THREE.DirectionalLight(0xffeccc, 0.85);
  sun.position.set(14, 22, 16); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd3ff, 0.3);
  fill.position.set(-12, 8, -10); scene.add(fill);

  const world = new THREE.Group(); scene.add(world);
  return { renderer, scene, camera, world, sun };
}

/** 触屏轨道:一指转、两指缩放、双击回全景。禁止出现「鼠标/右键」话术。 */
export function orbit(canvas, camera, opts = {}) {
  const st = { yaw: opts.yaw ?? -0.55, pitch: opts.pitch ?? 0.42, dist: opts.dist ?? 34,
               target: opts.target || new THREE.Vector3(0, 5, 0), auto: false };
  let ptrs = new Map(), lastPinch = 0;
  const apply = () => {
    const p = Math.max(0.06, Math.min(1.35, st.pitch));
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
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) { st.dist = Math.max(7, Math.min(96, st.dist * (lastPinch / dist))); apply(); }
      lastPinch = dist;
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
  canvas.addEventListener('wheel', e => { e.preventDefault(); st.dist = Math.max(7, Math.min(96, st.dist * (1 + Math.sign(e.deltaY) * 0.09))); apply(); }, { passive: false });
  apply();
  return {
    st, apply,
    focus(t, dist) { st.target.copy(t); if (dist) st.dist = dist; apply(); },
    /** 按当前画面比例把 (宽 × 高) 整个装进画面 —— 手机是竖屏,横向视角很窄,
     *  拍脑袋写死一个距离必然在手机上把楼裁掉半截 */
    fit(target, spanW, spanH, pad = 1.22) {
      const vfov = camera.fov * Math.PI / 180;
      const dv = (spanH / 2) / Math.tan(vfov / 2);
      const dh = (spanW / 2) / (Math.tan(vfov / 2) * Math.max(0.2, camera.aspect));
      st.target.copy(target); st.dist = Math.max(9, Math.max(dv, dh) * pad); apply();
    },
  };
}

// ---------- 人 ----------
const SKIN = [0xe8bd97, 0xd7a273, 0xb98155, 0x8d5f3d, 0xf2d3b3];
const CLOTH = [0x5b6d8c, 0x8c5b5b, 0x5b8c6d, 0xa8853f, 0x6a5b8c, 0x40505c];

function figure(seedN) {
  const g = new THREE.Group();
  const skin = SKIN[seedN % SKIN.length], cloth = CLOTH[(seedN * 7 + 3) % CLOTH.length];
  const hip = new THREE.Group(); g.add(hip);
  const torso = box(0.34, 0.52, 0.20, cloth); torso.position.y = 0.26; hip.add(torso);
  const head = box(0.20, 0.21, 0.19, skin); head.position.y = 0.63; hip.add(head);
  const hair = box(0.215, 0.07, 0.20, 0x3a2b22); hair.position.y = 0.735; hip.add(hair);
  const mkLeg = s => { const l = box(0.12, 0.42, 0.14, 0x3f4652); l.position.set(s * 0.09, -0.21, 0); const p = new THREE.Group(); p.position.y = 0; p.add(l); hip.add(p); return p; };
  const mkArm = s => { const a = box(0.09, 0.40, 0.10, cloth); a.position.set(s * 0.215, 0.31, 0); hip.add(a); return a; };
  const legs = [mkLeg(-1), mkLeg(1)], arms = [mkArm(-1), mkArm(1)];
  g.userData = { hip, torso, head, legs, arms };
  return g;
}

/** 三种身体:坐(三档)/走/站/躺 —— 姿势由 body 决定,不是随便摆 */
export function poseFigure(g, body, phase = 0) {
  const { hip, legs, arms, torso } = g.userData;
  hip.rotation.set(0, 0, 0); legs.forEach(p => p.rotation.set(0, 0, 0)); torso.rotation.x = 0;
  switch (body) {
    case 'sit_soft':                       // 沉进沙发:坐得低、身子后仰、腿往前伸
      hip.position.y = 0.34; torso.rotation.x = -0.20;
      legs.forEach(p => { p.rotation.x = -1.25; p.children[0].position.y = -0.21; });
      arms.forEach((a, i) => a.rotation.x = -0.35 + i * 0.05); break;
    case 'sit_up':                         // 餐椅/书桌椅:腿成 L,背直
      hip.position.y = 0.46; legs.forEach(p => p.rotation.x = -1.55);
      arms.forEach(a => a.rotation.x = -0.55); break;
    case 'sit_high':                       // 高凳:垂腿
      hip.position.y = 0.76; legs.forEach(p => p.rotation.x = -0.12);
      arms.forEach(a => a.rotation.x = -0.30); break;
    case 'lie':
      hip.position.y = 0.28; hip.rotation.x = -Math.PI / 2 + 0.06;
      legs.forEach(p => p.rotation.x = 0.05); break;
    case 'walk':
      hip.position.y = 0.86;
      legs[0].rotation.x = Math.sin(phase) * 0.55; legs[1].rotation.x = -Math.sin(phase) * 0.55;
      arms[0].rotation.x = -Math.sin(phase) * 0.45; arms[1].rotation.x = Math.sin(phase) * 0.45; break;
    default:                               // stand
      hip.position.y = 0.86; arms.forEach(a => a.rotation.x = 0.02);
  }
}

function petMesh() {
  const g = new THREE.Group();
  const b = box(0.34, 0.16, 0.17, 0x6b5a4a); b.position.y = 0.11; g.add(b);
  const h = box(0.15, 0.14, 0.14, 0x6b5a4a); h.position.set(0.2, 0.2, 0); g.add(h);
  const t = box(0.22, 0.05, 0.05, 0x6b5a4a); t.position.set(-0.25, 0.18, 0); t.rotation.z = 0.5; g.add(t);
  return g;
}

// ---------- 一间房 ----------
const T = 0.11;   // 墙厚(渲染用)

export function buildRoom(room, floor, xOff, showZones) {
  const g = new THREE.Group();
  const p = room.plan, h = p.h;
  g.position.set(xOff, floor.y, 0);
  g.userData.room = room;

  const roof = floor.band === 'roof';
  g.add(place(box(p.w, 0.14, p.d, 0xd9cfbc), p.w / 2, -0.07, p.d / 2));              // 楼板
  const wallH = roof ? 1.05 : h;                                                     // 屋顶层只砌女儿墙,不封顶
  g.add(place(box(p.w, wallH, T, roof ? 0xd6cbb4 : 0xefe7d6), p.w / 2, wallH / 2, -T / 2));   // 里墙(z=0)
  g.add(place(box(T * 1.4, wallH, p.d, 0xcfc4ad), -T * 0.7, wallH / 2, p.d / 2));    // 左隔墙(比里墙深一号,让每间房看得出边界)
  if (room.bay === (floor.rooms.length - 1))
    g.add(place(box(T * 1.4, wallH, p.d, 0xcfc4ad), p.w + T * 0.7, wallH / 2, p.d / 2));      // 最右一间补上外侧山墙
  // 外墙:只留窗下墙 + 窗上梁,中间掏空 —— 于是从街上真能看进屋里
  if (roof) {
    g.add(place(box(p.w, 1.05, T, 0xd6cbb4), p.w / 2, 0.52, p.d + T / 2));           // 屋顶层:一圈女儿墙
  } else {
    g.add(place(box(p.w, 0.85, T, 0xdcd1bb), p.w / 2, 0.42, p.d + T / 2));
    g.add(place(box(p.w, Math.max(0.1, h - 2.35), T, 0xdcd1bb), p.w / 2, h - (h - 2.35) / 2, p.d + T / 2));
    g.add(place(box(0.14, 1.5, 0.06, 0x8d8272), 0.35, 1.6, p.d + T / 2));            // 窗框竖挺
    g.add(place(box(0.14, 1.5, 0.06, 0x8d8272), p.w - 0.35, 1.6, p.d + T / 2));
  }

  if (showZones) {
    p.zones.list.forEach(z => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d),
        new THREE.MeshBasicMaterial({ color: ZONE_COLOR[z.role], transparent: true, opacity: 0.30, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(z.x + z.w / 2, 0.025, z.z + z.d / 2);
      g.add(m);
    });
  }

  p.items.forEach(it => {
    const w = it.rot === 0 ? it.box.w : it.box.w, d = it.box.d;   // box 已经是旋转后的占地
    const hh = Math.max(0.05, it.h || 0.6);
    const m = box(Math.max(0.06, w - 0.04), hh, Math.max(0.06, d - 0.04), CAT_COLOR[it.cat] || 0x999999);
    m.position.set(it.box.x + it.box.w / 2, (it.lift || 0) + hh / 2, it.box.z + it.box.d / 2);
    m.userData.item = it;
    g.add(m);
  });

  const people = new THREE.Group(); g.add(people);
  room.cast.actors.forEach((a, i) => {
    const f = a.kind === 'person' ? figure(i + room.bay * 7 + floor.level * 13) : petMesh();
    f.userData.actor = a; people.add(f);
  });
  g.userData.people = people;
  return g;
}

function place(m, x, y, z) { m.position.set(x, y, z); return m; }

/** 每帧把人放到引擎算出的位置上(渲染不决定人在哪,只是照着摆) */
export function syncPeople(g, t) {
  const people = g.userData.people; if (!people) return;
  people.children.forEach(f => {
    const a = f.userData.actor;
    f.position.set(a.x, 0, a.z);
    f.rotation.y = (a.dir || 0) * Math.PI / 180;
    if (a.kind === 'person') poseFigure(f, a.body, t * 6 + a.x);
  });
}

// ---------- 街道:楼前是社区的一层 ----------
export function buildStreet(b) {
  const g = new THREE.Group();
  const W = b.width, D = b.depth;
  g.add(place(box(W + 120, 0.06, 120, 0xdad3c4), W / 2, -0.22, D + 5));    // 大地(楼不许悬浮;铺得够大,画面里不该出现地面的边)
  g.add(place(box(W + 26, 0.16, 9.5, 0x9a958a), W / 2, -0.08, D + 6.8));    // 路面
  g.add(place(box(W + 26, 0.30, 3.2, 0xc8bfae), W / 2, -0.02, D + 1.4));    // 人行道
  const r = (n, i) => ((Math.sin(n * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < b.street.lamps; i++) {
    const x = (i + 0.5) / b.street.lamps * (W + 16) - 8;
    g.add(place(box(0.13, 4.2, 0.13, 0x59605e), x, 2.1, D + 2.9));
    const head = box(0.5, 0.16, 0.3, 0xffe9a8); head.position.set(x, 4.25, D + 2.9); g.add(head);
    const glow = new THREE.PointLight(0xffd98a, 0.30, 9); glow.position.set(x, 4.0, D + 2.9); g.add(glow);
  }
  for (let i = 0; i < b.street.trees; i++) {
    const x = (i + 0.5) / b.street.trees * (W + 14) - 7 + r(i, 3) * 1.2;
    g.add(place(box(0.22, 1.9, 0.22, 0x6b5340), x, 0.95, D + 5.2));
    const c = box(1.3 + r(i, 5) * 0.5, 1.3, 1.3, 0x5d8a56); c.position.set(x, 2.3 + r(i, 7) * 0.3, D + 5.2); g.add(c);
  }
  for (let i = 0; i < b.street.planters; i++) {
    const x = (i + 0.5) / b.street.planters * W;
    g.add(place(box(1.4, 0.40, 0.55, 0xb08a63), x, 0.20, D + 1.5));
    g.add(place(box(1.2, 0.32, 0.42, 0x628f5b), x, 0.52, D + 1.5));
  }
  const peds = new THREE.Group();
  for (let i = 0; i < b.street.pedestrians; i++) {
    const f = figure(i * 3 + 1);
    f.userData.ped = { x: r(i, 11) * (W + 14) - 7, z: D + 3.6 + r(i, 13) * 2.4,
                       v: (r(i, 17) > 0.5 ? 1 : -1) * (0.5 + r(i, 19) * 0.7) };
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
    if (p.x > g.userData.W + 8) p.x = -8; if (p.x < -8) p.x = g.userData.W + 8;
    f.position.set(p.x, 0, p.z);
    f.rotation.y = p.v > 0 ? Math.PI / 2 : -Math.PI / 2;
    poseFigure(f, 'walk', t * 6 + p.x);
  });
}
