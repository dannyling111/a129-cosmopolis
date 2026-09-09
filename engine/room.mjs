// ============================================================
// 🏠 room.mjs —— 第 3 层:套件(planRoom:功能 → 区域 → 套件)
// 指引原话:「以后生成一间房,必须按这个顺序走,不能从功能直接跳到一张沙发坐标。」
// 所以本文件【只做一件事】:拿功能的区域程序,在各自的区域块里把零件摆下去。
//   · 同类可互换(沙发换贵妃榻,仍是座具,布局语法不变)
//   · 跨类不许乱放(落地灯不进餐桌区,灶不进卧室主区)——靠 KIT_CATS[].zones 与零件级 zones 拦
//   · 通行区永远不落地面家具(人只走这里)
// ============================================================

import { makeRng } from './rng.mjs';
import { cutZones, ROLE_IDS, overlaps, pathIsClear, pullFor, PROGRAM_IDS } from './zones.mjs';
import { KITS, KIT_CATS } from './kits.mjs';
import { FUNCTIONS } from './functions.mjs';

export const FN_BY_ID = Object.fromEntries(FUNCTIONS.map(f => [f.id, f]));
export const CAT_BY_ID = Object.fromEntries(KIT_CATS.map(c => [c.id, c]));
export const KIT_BY_ID = Object.fromEntries(KITS.map(k => [k.id, k]));

const GAP = 0.09;    // 家具之间最小缝(m)
const STEP = 0.10;   // 落位搜索步长(m)

/** 这一大类可不可以落进房间(第 12 类『人物』是动作库,不落地) */
export function isPlaceable(kit) {
  const c = CAT_BY_ID[kit.cat];
  return kit.placeable !== false && !(c && c.placeable === false);
}

/** 这一大类是不是「挂墙的」(不占地) */
export function isWallCat(catId) {
  const c = CAT_BY_ID[catId];
  return !!c && c.floor === false;
}

/** 从库里挑候选零件:大类对、区域允许、功能允许 */
export function candidates(catId, role, fnId) {
  return KITS.filter(k =>
    k.cat === catId && k.placeable !== false &&
    Array.isArray(k.zones) && k.zones.includes(role) &&
    (!k.fn || k.fn.length === 0 || k.fn.includes(fnId))
  );
}

/** 这件零件在这块区域里【转不转得开】—— 不先过这一关,就会抽到一件根本塞不进去的大件,
 *  然后这个区域就白抽了一次(实测:书房主区抽到 3 米长的工作台,结果一把椅子都没坐下人) */
export function fitsZone(kit, zone) {
  const a = kit.w <= zone.w + 1e-6 && kit.d <= zone.d + 1e-6;
  const b = kit.d <= zone.w + 1e-6 && kit.w <= zone.d + 1e-6;
  return a || b;
}

function fits(box, zone) {
  return box.x >= zone.x - 1e-6 && box.z >= zone.z - 1e-6 &&
         box.x + box.w <= zone.x + zone.w + 1e-6 && box.z + box.d <= zone.z + zone.d + 1e-6;
}

/** 在一个区域块里给一件零件找位置;找不到返回 null(找不到就是真放不下,不许硬塞) */
function place(kit, zone, placed, rng, pull = { x: 0, z: 0 }) {
  const opts = [];
  for (const rot of [0, 90]) {
    const w = rot === 0 ? kit.w : kit.d;
    const d = rot === 0 ? kit.d : kit.w;
    if (w > zone.w + 1e-6 || d > zone.d + 1e-6) continue;
    const nx = Math.max(1, Math.floor((zone.w - w) / STEP) + 1);
    const nz = Math.max(1, Math.floor((zone.d - d) / STEP) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const box = { x: +(zone.x + i * STEP).toFixed(3), z: +(zone.z + j * STEP).toFixed(3), w, d };
      if (!fits(box, zone)) continue;
      if (placed.some(p => overlaps(inflate(box, GAP), p.box))) continue;
      const cx = box.x + w / 2, cz = box.z + d / 2;
      const cost = -(pull.x * cx + pull.z * cz) + (rot === 90 ? 0.15 : 0);
      opts.push({ box, rot, cost });
    }
  }
  if (!opts.length) return null;
  opts.sort((a, b) => a.cost - b.cost);
  // 前几名里随机挑一个:同一份文本仍可复算,但不会每间房都摆得一模一样
  const top = opts.slice(0, Math.max(1, Math.min(6, Math.ceil(opts.length * 0.12))));
  return top[Math.floor(rng.f() * top.length)];
}

const inflate = (b, p) => ({ x: b.x - p, z: b.z - p, w: b.w + 2 * p, d: b.d + 2 * p });

/** 把零件自带的「座位口袋」换算成房间坐标 —— 人是从家具里长出来的,不是后贴的 */
function pocketsOf(kit, box, rot) {
  const cx = box.x + box.w / 2, cz = box.z + box.d / 2;
  return (kit.seats || []).map((s, i) => {
    const dx = rot === 0 ? s.dx : -s.dz;
    const dz = rot === 0 ? s.dz : s.dx;
    return { id: `${kit.id}#${i}`, kit: kit.id, x: +(cx + dx).toFixed(3), z: +(cz + dz).toFixed(3),
             dir: (s.dir + rot) % 360, body: s.body };
  });
}

/**
 * 排一间房。
 * @param {string} fnId 功能 id
 * @param {{w?:number,d?:number,h?:number,seed?:any,doorX?:number,tag?:string}} o
 */
export function planRoom(fnId, o = {}) {
  const fn = FN_BY_ID[fnId];
  if (!fn) throw new Error('未知功能: ' + fnId);
  const seed = o.seed ?? 1;
  const rng = makeRng(seed, 'room|' + fnId + '|' + (o.tag || ''));

  // 面积没给就按功能的合理区间抽一个,再折成接近黄金比的长宽
  let w = o.w, d = o.d;
  if (!w || !d) {
    const a = rng.range(fn.area[0], fn.area[1]);
    const ratio = rng.range(1.05, 1.55);
    w = Math.round(Math.sqrt(a * ratio) * 10) / 10;
    d = Math.round((a / w) * 10) / 10;
  }
  // 进深下限 2.4m:窗墙带 + 通行带 + 一件家具的进深,物理上就要这么多。
  // 比这更浅的房间不是「小」,是【放不下自己的程序】—— 宁可把它拉长也不许长出一间空房。
  const MIN_D = 2.4, MIN_W = 2.2;
  if (d < MIN_D) { const a = w * d; d = MIN_D; w = Math.max(MIN_W, Math.round((a / d) * 10) / 10); }
  if (w < MIN_W) { w = MIN_W; }
  const h = o.h || 2.9;
  const program = o.program || (PROGRAM_IDS.includes(fn.program) ? fn.program : 'face');
  const z = cutZones({ w, d, doorX: o.doorX, id: fnId, program });

  // 通行区永远留空(人只走这里)。功能程序里写在 path 的零件 = 指引说的「留空 + 角植」,
  // 它落在【紧贴通行区的那个角落】,属于 path 程序但不占走道 —— 两件事必须分开,
  // 否则「角植」和「挡道」在数据上长得一模一样,判据就永远抓不住后者。
  const cornerZone = (() => {
    const p = z.roles.path, m = z.roles.main, a = z.roles.aux;
    const host = m.area >= a.area ? m : a;
    const side = host.x < p.x ? 'left' : 'right';
    const cw = Math.min(0.95, host.w), cd = Math.min(0.95, host.d);
    return { role: 'path', mount: 'floor',
             x: side === 'left' ? host.x + host.w - cw : host.x,
             z: host.z, w: cw, d: cd, area: +(cw * cd).toFixed(2) };
  })();

  const items = [], seats = [], skipped = [];
  for (const role of ROLE_IDS) {
    const zone = role === 'path' ? cornerZone : z.roles[role];
    const program = fn.zones[role] || [];
    const placedHere = [];
    // 先摆大件:大的先占位,小的才有地方见缝插针
    const wants = [];
    for (const entry of program) {
      const n = rng.count(entry.n);
      for (let i = 0; i < n; i++) wants.push(entry.cat);
    }
    const chosen = [];
    for (const cat of wants) {
      const all = candidates(cat, role, fnId);
      const pool = all.filter(k => isWallCat(k.cat) || role === 'walldec' || fitsZone(k, zone));
      if (!pool.length) { skipped.push({ role, cat, why: all.length ? '这块区域装不下该大类的任何零件' : '库里没有该大类可进此区域的零件' }); continue; }
      // 同一间房尽量不重复同一件(除了椅子这种本来就成组的)
      const fresh = pool.filter(k => !chosen.some(c => c.id === k.id));
      chosen.push(rng.pick(fresh.length ? fresh : pool));
    }
    // 🔴 座具/卧具【先摆】,再按大小摆其余。
    // 为什么不是「大件优先」:大衣柜先占满 1.4×0.8 的辅区之后,那把椅子就永远进不来,
    // 于是人物脚本说的「有人坐在辅区」在物理上不可能发生 —— 而「人在哪儿」正是这台引擎的输出。
    // 柜子放不下只是少一件收纳(会记进 skipped),椅子放不下是整条人物脚本作废,两者不对等。
    const seatFirst = k => (k.cat === 'seat' || k.cat === 'bed') ? 0 : 1;
    chosen.sort((a, b) => seatFirst(a) - seatFirst(b) || (b.w * b.d) - (a.w * a.d));

    for (const kit of chosen) {
      if (isWallCat(kit.cat) || role === 'walldec') {
        // 挂墙:不占地,沿墙面均匀铺开,高度按零件自己的 h 当离地高度
        const n = placedHere.filter(p => p.mount === 'wall').length;
        const span = zone.w / 1 || 1;
        const px = zone.x + ((n + 0.5) / Math.max(1, program.reduce((s, e) => s + (Array.isArray(e.n) ? e.n[1] : e.n), 0))) * span;
        const it = { kit: kit.id, cn: kit.cn, cat: kit.cat, zone: role, mount: 'wall', rot: 0,
                     box: { x: Math.min(Math.max(px - kit.w / 2, zone.x), zone.x + zone.w - kit.w), z: zone.z, w: kit.w, d: Math.min(kit.d, zone.d) },
                     lift: role === 'walldec' ? 1.45 : 0, h: kit.h };
        items.push(it); placedHere.push(it);
        continue;
      }
      // 碰撞要拿【全部地面家具】比,不能只比同一个区域的 ——
      // 角植所在的角落是从主区/辅区身上切出来的,只比同区域就必然和主区的椅子叠在一起
      const spot = place(kit, zone, role === 'path' ? items.filter(i => i.mount === 'floor') : placedHere, rng, pullFor(role, z));
      if (!spot) { skipped.push({ role, cat: kit.cat, kit: kit.id, why: '这块区域放不下了' }); continue; }
      const it = { kit: kit.id, cn: kit.cn, cat: kit.cat, zone: role, mount: 'floor',
                   rot: spot.rot, box: spot.box, lift: 0, h: kit.h };
      items.push(it); placedHere.push(it);
      pocketsOf(kit, spot.box, spot.rot).forEach(p => seats.push({ ...p, zone: role }));
    }
  }

  // 兜底:某个区域的程序明明要了座具/卧具,却一个座位口袋都没长出来(大件全没塞进去)
  // → 补一件【最小的、放得下的】,否则人物脚本会让人坐在空气里。
  for (const role of ROLE_IDS) {
    if (role === 'path' || role === 'walldec') continue;
    const prog = fn.zones[role] || [];
    const wantsSeat = prog.some(e => e.cat === 'seat' || e.cat === 'bed');
    if (!wantsSeat) continue;
    if (seats.some(s => s.zone === role)) continue;
    const zone = z.roles[role];
    const pool = ['seat', 'bed']
      .filter(c => prog.some(e => e.cat === c))
      .flatMap(c => candidates(c, role, fnId))
      .filter(k => fitsZone(k, zone) && (k.seats || []).length)
      .sort((a, b) => (a.w * a.d) - (b.w * b.d));
    for (const kit of pool) {
      const spot = place(kit, zone, items.filter(i => i.zone === role), rng, pullFor(role, z));
      if (!spot) continue;
      const it = { kit: kit.id, cn: kit.cn, cat: kit.cat, zone: role, mount: 'floor',
                   rot: spot.rot, box: spot.box, lift: 0, h: kit.h, rescued: true };
      items.push(it);
      pocketsOf(kit, spot.box, spot.rot).forEach(p => seats.push({ ...p, zone: role }));
      break;
    }
  }

  const clear = pathIsClear(z, items);
  return {
    fn: fnId, cn: fn.cn, fam: fn.fam, w, d, h, seed, program,
    area: +(w * d).toFixed(2),
    zones: z, items, seats, skipped,
    path: { ...z.roles.path, clear: clear.ok, why: clear.why },
    doorX: z.meta.doorX,
  };
}

/** 一间房的量化体检(机器闸直接用这个) */
export function auditRoom(plan) {
  const bad = [];
  const zs = plan.zones.roles;
  plan.items.forEach(it => {
    const zone = zs[it.zone];
    if (it.mount === 'floor' && it.zone !== 'path') {
      if (!(it.box.x >= zone.x - 0.02 && it.box.z >= zone.z - 0.02 &&
            it.box.x + it.box.w <= zone.x + zone.w + 0.02 &&
            it.box.z + it.box.d <= zone.z + zone.d + 0.02)) bad.push(`${it.kit} 越出了 ${it.zone} 区`);
      if (overlaps(it.box, zs.path, 0.005)) bad.push(`${it.kit} 压住了通行区`);
      if (it.zone === 'path') {
        const p = zs.path;
        const near = Math.min(Math.abs(it.box.x + it.box.w - p.x), Math.abs(p.x + p.w - it.box.x));
        if (near > 0.40) bad.push(`${it.kit} 挂在 path 程序名下,却离通行区 ${near.toFixed(2)}m,不是角植`);
      }
    }
    const cat = CAT_BY_ID[it.cat];
    if (cat && !cat.zones.includes(it.zone)) bad.push(`${it.kit}(${it.cat})跨类乱放进了 ${it.zone}`);
  });
  for (let i = 0; i < plan.items.length; i++) for (let j = i + 1; j < plan.items.length; j++) {
    const a = plan.items[i], b = plan.items[j];
    if (a.mount === 'floor' && b.mount === 'floor' && overlaps(a.box, b.box, 0.01)) bad.push(`${a.kit} 与 ${b.kit} 叠在一起`);
  }
  if (!plan.path.clear) bad.push('通行区不通:' + plan.path.why);
  return { ok: bad.length === 0, problems: bad };
}
