// ============================================================
// 🧍 figure.mjs —— 人物骨架(会走路、会坐下、【脚真踩在地板上】)
//
// 🔴 这个文件是为了修一个主席一眼看出来的错:上一版的人【浮在空中】。
//    实证:老代码 hip.position.y = 0.86,而腿只有 0.42 长 —— 脚底停在 +0.44m,
//    整个人悬在半空。这不是美术问题,是【几何没对齐】:骨架的原点定在胯,
//    却把胯当成"站立高度"直接抬起来,谁也没算过脚在哪。
//
//    这一版把原点定在【脚底 y=0】,并且坐姿的小腿角度是【解出来的】不是拍脑袋填的:
//    给定坐面高 P,先摆大腿角,再反解小腿角让脚踝正好落到地面 —— 于是无论坐面多高,
//    脚都踩得到地(坐面 ≤ 大腿+小腿+脚高 = 0.90m,我们所有座具都在这个范围内)。
// ============================================================
import * as THREE from '../vendor/three.module.js';

// 人体分段(米)。总高 ≈ 0.06+0.42+0.42+0.52+0.06+0.22 = 1.70
const FOOT_H = 0.06, SHIN = 0.42, THIGH = 0.42;
const HIP_Y = FOOT_H + SHIN + THIGH;      // 站立时胯的高度 = 0.90
const TORSO = 0.52, NECK = 0.06, HEAD = 0.22;
const UPARM = 0.28, FOREARM = 0.26;

/** 坐面高度:按姿态给,坐姿的胯就落在这个高度上 */
export const SEAT_Y = { sit_soft: 0.40, sit_up: 0.45, sit_high: 0.68 };

const MAT = new Map();
const mat = (hex, o = {}) => {
  const k = hex + '|' + JSON.stringify(o);
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial({ color: hex, ...o }));
  return MAT.get(k);
};
const box = (w, h, d, hex, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, o));
const cyl = (r, h, hex, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(hex));
const sph = (r, hex) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(hex));

// 肤色 / 发色 / 上衣 / 裤子 / 鞋 —— 鲜艳一点,一屋子人不重样
export const SKIN  = [0xf6d3b0, 0xecc09a, 0xd9a273, 0xb87a4e, 0x8d5a36, 0xfae0c8];
export const HAIR  = [0x2b2118, 0x4a3524, 0x6b4a2f, 0x1a1a1e, 0x8a5a3a, 0xc9a06a, 0x6e4b8f, 0xc65b4a];
export const SHIRT = [0xff7a59, 0x4fb0c6, 0xf7c948, 0x7bc47f, 0xe86a92, 0x6a7fdb, 0xf49342, 0x59c3b0, 0xb07ce8];
export const PANTS = [0x3d5a80, 0x4a4e69, 0x6b705c, 0x8c5e3c, 0x2f3e56, 0x7a4f6d, 0x35635b];
export const SHOE  = [0x2b2b2f, 0xffffff, 0xc94f4f, 0x3a5a9c, 0x8a6a3a];

/**
 * 造一个人。原点在【脚底】,y=0 就是地板。
 * @param {number} n 种子数(同一个数永远长出同一个人)
 * @param {object} o {scale} scale<1 是小孩
 */
export function buildFigure(n = 0, o = {}) {
  const pick = (arr, k) => arr[Math.abs((n * 2654435761 + k * 40503) >>> 0) % arr.length];
  const skin = pick(SKIN, 1), hair = pick(HAIR, 2), shirt = pick(SHIRT, 3),
        pants = pick(PANTS, 4), shoe = pick(SHOE, 5);
  const s = o.scale || 1;

  const root = new THREE.Group();
  root.scale.setScalar(s);

  // 胯(整个上半身挂在它下面);站立时它在 0.90
  const hip = new THREE.Group(); hip.position.y = HIP_Y; root.add(hip);

  // 躯干 + 头
  const spine = new THREE.Group(); hip.add(spine);
  const torso = box(0.32, TORSO, 0.19, shirt); torso.position.y = TORSO / 2; spine.add(torso);
  const collar = box(0.33, 0.05, 0.20, pick(SHIRT, 9)); collar.position.y = TORSO - 0.03; spine.add(collar);
  const neck = cyl(0.045, NECK, skin); neck.position.y = TORSO + NECK / 2; spine.add(neck);
  const head = box(0.19, HEAD, 0.185, skin); head.position.y = TORSO + NECK + HEAD / 2; spine.add(head);
  // 头发:后脑一块 + 顶上一块(不同发色就是不同的人)
  const hairTop = box(0.205, 0.075, 0.20, hair); hairTop.position.y = TORSO + NECK + HEAD - 0.02; spine.add(hairTop);
  const hairBack = box(0.20, HEAD * 0.72, 0.06, hair);
  hairBack.position.set(0, TORSO + NECK + HEAD * 0.52, -0.078); spine.add(hairBack);
  if ((n & 3) === 0) {                                  // 四分之一的人扎丸子头
    const bun = sph(0.058, hair); bun.position.set(0, TORSO + NECK + HEAD + 0.04, -0.06); spine.add(bun);
  }
  // 两只眼睛(远看只是两个点,但有没有它,人味差很多)
  [-1, 1].forEach(sx => {
    const eye = box(0.022, 0.03, 0.012, 0x2a2320);
    eye.position.set(sx * 0.045, TORSO + NECK + HEAD * 0.55, 0.094); spine.add(eye);
  });

  // 腿:大腿 → 小腿 → 脚(三段,才能既站直又坐下)
  const legs = [-1, 1].map(sx => {
    const thigh = new THREE.Group(); thigh.position.set(sx * 0.085, 0, 0); hip.add(thigh);
    const tm = box(0.125, THIGH, 0.145, pants); tm.position.y = -THIGH / 2; thigh.add(tm);
    const shin = new THREE.Group(); shin.position.y = -THIGH; thigh.add(shin);
    const sm = box(0.11, SHIN, 0.125, pants); sm.position.y = -SHIN / 2; shin.add(sm);
    const foot = new THREE.Group(); foot.position.y = -SHIN; shin.add(foot);
    const fm = box(0.105, FOOT_H, 0.235, shoe); fm.position.set(0, -FOOT_H / 2, 0.045); foot.add(fm);
    return { thigh, shin, foot };
  });

  // 胳膊:上臂 → 前臂 → 手
  const arms = [-1, 1].map(sx => {
    const up = new THREE.Group(); up.position.set(sx * 0.195, TORSO - 0.06, 0); spine.add(up);
    const um = box(0.085, UPARM, 0.095, shirt); um.position.y = -UPARM / 2; up.add(um);
    const fore = new THREE.Group(); fore.position.y = -UPARM; up.add(fore);
    const fm2 = box(0.075, FOREARM, 0.085, skin); fm2.position.y = -FOREARM / 2; fore.add(fm2);
    const hand = sph(0.048, skin); hand.position.y = -FOREARM - 0.02; fore.add(hand);
    return { up, fore };
  });

  root.userData = { hip, spine, legs, arms, seed: n, scale: s };
  return root;
}

/**
 * 反解小腿角度,让脚踝正好落到地面。
 * 给定胯高 P(=坐面高)和大腿前摆角 tA,求小腿相对大腿的弯曲角 tB,使脚底 y≈0。
 * 从 tA=100° 往下试,取第一个解得出来的 —— 于是任何坐面高度都能把脚放到地上。
 */
function solveSit(P) {
  // 场景图里:大腿 rotation.x = -tA(负角=向前),膝盖 y = P - THIGH·cos(tA)
  //           小腿的总角 = -tA + rS,脚踝 y = 膝盖y - SHIN·cos(tA - rS)
  // 令脚踝 y = FOOT_H 解出 rS = tA - acos(arg)。arg 超出 [-1,1] 说明这个大腿角够不着地,
  // 就把大腿放平一点再试 —— 所以坐面越高,大腿越接近垂直,脚照样踩得到地。
  for (let deg = 100; deg >= 0; deg -= 2) {
    const tA = deg * Math.PI / 180;
    const arg = (P - FOOT_H - THIGH * Math.cos(tA)) / SHIN;
    if (arg >= -1 && arg <= 1) return { tA, rS: tA - Math.acos(arg) };
  }
  return { tA: 0, rS: 0 };
}
const SIT_CACHE = {};
const sitAngles = P => (SIT_CACHE[P] || (SIT_CACHE[P] = solveSit(P)));

/**
 * 摆一个姿势。
 * @param {THREE.Group} g buildFigure 的返回
 * @param {string} body sit_soft|sit_up|sit_high|lie|stand|walk
 * @param {number} phase 走路相位
 * @param {object} o {seatY} 坐面高度(不给就用 SEAT_Y 的默认)
 * @returns {number} 这个姿势下【身体最低点相对 group 原点的 y】—— 摆位时用它对齐地板
 */
export function poseFigure(g, body, phase = 0, o = {}) {
  const { hip, spine, legs, arms } = g.userData;
  hip.rotation.set(0, 0, 0); spine.rotation.set(0, 0, 0);
  legs.forEach(l => { l.thigh.rotation.set(0, 0, 0); l.shin.rotation.set(0, 0, 0); l.foot.rotation.set(0, 0, 0); });
  arms.forEach(a => { a.up.rotation.set(0, 0, 0); a.fore.rotation.set(0, 0, 0); });

  switch (body) {
    case 'sit_soft': case 'sit_up': case 'sit_high': {
      const P = o.seatY || SEAT_Y[body] || 0.45;
      const { tA, rS } = sitAngles(+P.toFixed(2));
      hip.position.y = P;
      legs.forEach((l, i) => {
        l.thigh.rotation.x = -tA + (i ? 0.04 : -0.04);   // 两条腿略微错开,不像木偶
        l.shin.rotation.x = rS;
        l.foot.rotation.x = -(l.thigh.rotation.x + l.shin.rotation.x);   // 脚掌永远放平贴地
      });
      spine.rotation.x = body === 'sit_soft' ? -0.16 : -0.03;   // 沙发上身子往后靠
      arms.forEach((a, i) => { a.up.rotation.x = body === 'sit_soft' ? -0.28 : -0.62; a.fore.rotation.x = -0.55 + i * 0.06; });
      break;
    }
    case 'lie':
      hip.position.y = 0.20;
      hip.rotation.x = -Math.PI / 2 + 0.05;              // 整个人躺平(原点=床垫面)
      legs.forEach(l => { l.thigh.rotation.x = 0.06; l.shin.rotation.x = 0.04; });
      arms.forEach(a => { a.up.rotation.x = 0.35; a.fore.rotation.x = -0.2; });
      break;
    case 'walk': {
      hip.position.y = HIP_Y - 0.015 + Math.sin(phase * 2) * 0.012;   // 走路时上下起伏
      const sw = Math.sin(phase) * 0.52;
      legs[0].thigh.rotation.x = sw;  legs[0].shin.rotation.x = Math.max(0, -sw) * 0.75;
      legs[1].thigh.rotation.x = -sw; legs[1].shin.rotation.x = Math.max(0, sw) * 0.75;
      legs.forEach((l, i) => { l.foot.rotation.x = -l.thigh.rotation.x - l.shin.rotation.x; });
      arms[0].up.rotation.x = -sw * 0.8; arms[1].up.rotation.x = sw * 0.8;
      arms.forEach(a => a.fore.rotation.x = -0.22);
      break;
    }
    default:                                             // stand
      hip.position.y = HIP_Y;
      arms.forEach((a, i) => { a.up.rotation.x = 0.04; a.up.rotation.z = (i ? -1 : 1) * 0.06; a.fore.rotation.x = -0.12; });
  }
  return body === 'lie' ? 0 : 0;                         // 原点就是脚底,不用再补偿
}

/** 猫(治愈系必备) */
export function buildPet(n = 0) {
  const c = [0xd9a15b, 0x8a7a6a, 0x3a3a3f, 0xe6e0d6, 0xc4744a][Math.abs(n) % 5];
  const g = new THREE.Group();
  const body = box(0.19, 0.16, 0.36, c); body.position.y = 0.16; g.add(body);
  const head = box(0.155, 0.14, 0.14, c); head.position.set(0, 0.26, 0.20); g.add(head);
  [-1, 1].forEach(sx => { const ear = box(0.05, 0.06, 0.02, c); ear.position.set(sx * 0.045, 0.35, 0.20); g.add(ear); });
  [-1, 1].forEach(sx => { const eye = box(0.022, 0.02, 0.01, 0x2a2320); eye.position.set(sx * 0.038, 0.28, 0.272); g.add(eye); });
  const tail = box(0.045, 0.045, 0.24, c); tail.position.set(0, 0.24, -0.20); tail.rotation.x = 0.55; g.add(tail);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const leg = box(0.055, 0.09, 0.055, c); leg.position.set(sx * 0.062, 0.045, sz * 0.12); g.add(leg);
  });
  return g;
}
