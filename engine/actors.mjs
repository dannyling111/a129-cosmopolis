// ============================================================
// 🧍 actors.mjs —— 第 4 层:人物(人是引擎的输出,不是后贴的小人)
// 指引原话:「座位从家具口袋里长出来;走路只走通行区;
//            会客可以坐一会儿再起来走;吃饭的人坐死在餐椅上。」
// 所以:座位不是随便找个坐标,而是【第 3 层摆下的那件家具自带的口袋】;
//       走路的点不是随便撒的,而是【第 2 层切出来的通行区】里的种子路径。
// ============================================================

import { makeRng } from './rng.mjs';
import { SCRIPTS, BODIES } from './people.mjs';
import { KITS } from './kits.mjs';

/** 第 12 大类『人物』= 12 个动作。工作指引把人物列进套件大类,不是随口一说 ——
 *  人在房间里干什么,和沙发是哪一件一样,是从库里【抽】出来的,不是渲染时随便摆的。 */
export const ACTS = KITS.filter(k => k.cat === 'person');
export const ACT_BY_ID = Object.fromEntries(ACTS.map(a => [a.id, a]));

/** 给一个人挑动作:先按身体姿态过滤,再看现场有没有它需要的东西(needs) */
function pickAct(body, have, rng) {
  const fit = ACTS.filter(a => a.body === body && (a.needs === null || a.needs === undefined || have.has(a.needs)));
  const any = fit.length ? fit : ACTS.filter(a => a.body === body);
  return any.length ? rng.pick(any) : null;
}

/** 这间房现场有什么(决定哪些动作成立) */
function haveOf(plan) {
  const h = new Set();
  plan.items.forEach(i => h.add(i.cat));
  if (plan.zones.roles.path.area > 0) h.add('path');
  if (plan.zones.roles.window.area > 0) h.add('window');
  return h;
}

export const BODY_CN = Object.fromEntries((BODIES || []).map(b => [b.id, b.cn]));

/** 通行区里的种子路径:从门口一路到窗前,中间打几个点 */
function pathRoute(plan, rng) {
  const p = plan.zones.roles.path;
  const cx = p.x + p.w / 2;
  const n = 3 + (rng.f() > 0.5 ? 1 : 0);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x: +(cx + rng.range(-p.w * 0.28, p.w * 0.28)).toFixed(2),
               z: +(p.z + 0.25 + t * (p.d - 0.5)).toFixed(2) });
  }
  return pts;
}

/** 忙的人:在辅区(或主区操作带)前面两三点来回,不穿越客座 */
function busyRoute(plan, rng) {
  const a = plan.zones.roles.aux, m = plan.zones.roles.main;
  const z = a.area >= 1.2 ? a : m;
  const n = 2 + (rng.f() > 0.4 ? 1 : 0);
  return Array.from({ length: n }, (_, i) => ({
    x: +(z.x + (0.25 + 0.5 * (i / Math.max(1, n - 1))) * z.w).toFixed(2),
    z: +(z.z + z.d * (0.15 + 0.25 * rng.f())).toFixed(2),
  }));
}

/**
 * 按功能的人物脚本，把人放进一间已经排好的房。
 * @param {object} plan planRoom 的返回
 * @returns {{actors:Array, script:object, warns:Array}}
 */
export function castRoom(plan, seed = plan.seed) {
  const sc = SCRIPTS[plan.fn];
  const rng = makeRng(seed, 'cast|' + plan.fn);
  const warns = [];
  if (!sc) return { actors: [], script: null, warns: ['该功能没有人物脚本'] };

  const used = new Set();
  const have = haveOf(plan);
  const actors = [];
  let n = 0;
  const tag = a => { const act = pickAct(a.body, have, rng); if (act) { a.act = act.id; a.actCn = act.cn; } return a; };

  for (const want of (sc.seats || [])) {
    // 想坐几个人,得先看这个区域【真长出了几个座位口袋】——
    // 脚本写「坐 4 个」而房间只摆得下 3 把椅子时,正确动作是坐 3 个,不是让第 4 个人悬空。
    const avail = plan.seats.filter(s => s.zone === want.zone).length;
    if (avail === 0) { warns.push(`${plan.fn}:${want.zone} 区一个座位口袋都没有(脚本想让人坐在这)`); continue; }
    const k = Math.min(rng.count(want.n), avail);
    for (let i = 0; i < k; i++) {
      // 只认这个区域里、这件家具自己长出来的口袋
      let pool = plan.seats.filter(s => s.zone === want.zone && !used.has(s.id) && s.body === want.body);
      if (!pool.length) pool = plan.seats.filter(s => s.zone === want.zone && !used.has(s.id));
      if (!pool.length) break;   // 口袋被别的脚本条目占完了,坐到几个算几个(这不是错)
      const pocket = rng.pick(pool);
      used.add(pocket.id);
      actors.push(tag({
        id: 'a' + (n++), kind: 'person', state: 'sit',
        body: want.body, home: pocket,
        x: pocket.x, z: pocket.z, dir: pocket.dir,
        hold: want.hold || [10, 30], t: rng.range(0, (want.hold || [10, 30])[1]),
        roam: (rng.count(sc.walkers || [0, 0]) > 0) && want.body !== 'lie',
        route: null, leg: 0,
      }));
    }
  }

  const walkers = rng.count(sc.walkers || [0, 0]);
  for (let i = 0; i < walkers; i++) {
    const route = pathRoute(plan, rng);
    actors.push(tag({ id: 'a' + (n++), kind: 'person', state: 'walk', body: 'walk',
                  route, leg: rng.int(0, route.length - 1), x: route[0].x, z: route[0].z, dir: 0,
                  home: null, hold: [0, 0], t: 0, roam: true }));
  }

  const busy = rng.count(sc.busy || [0, 0]);
  for (let i = 0; i < busy; i++) {
    const route = busyRoute(plan, rng);
    actors.push(tag({ id: 'a' + (n++), kind: 'person', state: 'busy', body: 'stand',
                  route, leg: 0, x: route[0].x, z: route[0].z, dir: 180,
                  home: null, hold: [2, 5], t: rng.range(0, 4), roam: false }));
  }

  for (const pet of (sc.pets || [])) {
    const z = plan.zones.roles[pet.zone] || plan.zones.roles.main;
    actors.push({ id: 'p' + (n++), kind: pet.kind || 'cat', state: 'sit', body: 'lie',
                  x: +(z.x + z.w * (0.3 + 0.4 * rng.f())).toFixed(2),
                  z: +(z.z + z.d * (0.3 + 0.4 * rng.f())).toFixed(2),
                  dir: rng.pick([0, 90, 180, 270]), home: null, hold: [20, 60], t: 0, roam: false, route: null, leg: 0,
                  act: 'cat', actCn: '猫' });
  }

  return { actors, script: sc, warns };
}

const SPEED = 0.85;   // m/s,室内散步速度

/** 推进一帧。人只在通行区/自己的路线上走,坐着的人到点才起身。 */
export function stepActors(cast, plan, dt, seed = plan.seed) {
  const rng = makeRng(seed, 'step');
  for (const a of cast.actors) {
    a.t += dt;
    if (a.state === 'sit') {
      const [lo, hi] = a.hold;
      if (a.roam && a.t > lo + (hi - lo) * 0.5) {          // 坐够了就起来走一圈
        a.state = 'walk'; a.body = 'walk'; a.t = 0;
        a.route = pathRoute(plan, rng); a.leg = 0;
      } else { a.x = a.home ? a.home.x : a.x; a.z = a.home ? a.home.z : a.z; }
      continue;
    }
    const route = a.route || [];
    if (!route.length) continue;
    const tgt = route[a.leg % route.length];
    const dx = tgt.x - a.x, dz = tgt.z - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) {
      a.leg++;
      if (a.state === 'walk' && a.home && a.leg >= route.length) {   // 走完一圈回自己的座位
        a.state = 'sit'; a.body = a.home.body; a.t = 0; a.x = a.home.x; a.z = a.home.z; a.dir = a.home.dir;
      }
      continue;
    }
    const v = (a.state === 'busy' ? SPEED * 0.55 : SPEED) * dt;
    a.x += (dx / dist) * v; a.z += (dz / dist) * v;
    a.dir = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
  }
  return cast;
}
