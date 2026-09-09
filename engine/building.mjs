// ============================================================
// 🏙️ building.mjs —— 第 0 层:社区(assemble:整栋不是叠盒子)
// 指引原话:「有趣来自邻里关系:底商、楼上住户、屋顶的人互相看得见。
//            量化引擎在抽房间时就要用社区规则,而不是抽完再装饰。」
// 所以层带/相邻/街道这三条规则是【抽房间时】就生效的约束,不是事后贴的皮。
// ============================================================

import { makeRng } from './rng.mjs';
import { FUNCTIONS } from './functions.mjs';
import { BAND_RULES, ADJACENCY, STREET, FLOOR_MIX } from './city.mjs';
import { planRoom } from './room.mjs';
import { castRoom } from './actors.mjs';

const BY_ID = Object.fromEntries(FUNCTIONS.map(f => [f.id, f]));
const pairKey = (a, b) => [a, b].sort().join('|');
const AVOID = new Set((ADJACENCY.avoid || []).map(p => pairKey(p[0], p[1])));
const LIKE = new Set((ADJACENCY.like || []).map(p => pairKey(p[0], p[1])));

/** 这一层是什么层带 */
export function bandOf(level, levels) {
  if (level === levels) return 'roof';           // 顶上那一层是露台层
  if (level === 0) return 'ground';
  if (level === levels - 1) return 'top';
  return 'mid';
}

/** 该层带允许哪些功能(层带 fams + 功能自己的 bands + 明令禁止,三重过滤) */
export function poolFor(band) {
  const rule = BAND_RULES[band] || { fams: [] };
  const banned = new Set((ADJACENCY.banned && ADJACENCY.banned[band]) || []);
  return FUNCTIONS.filter(f =>
    rule.fams.includes(f.fam) &&
    (f.bands || []).includes(band) &&
    !banned.has(f.id)
  );
}

/**
 * 抽一整栋楼。
 * @param {{seed?:any, levels?:number, bays?:number, depth?:number, floorH?:number}} o
 *        levels = 有几个居住层(不含屋顶层);屋顶层自动加一层
 */
export function assemble(o = {}) {
  const seed = o.seed ?? 'cosmopolis';
  const levels = Math.max(2, Math.min(6, o.levels ?? 4));
  const bays = Math.max(2, Math.min(5, o.bays ?? 3));
  const depth = o.depth ?? 6.2;
  const floorH = o.floorH ?? 3.05;
  const rng = makeRng(seed, 'assemble');

  // 结构柱网:各开间宽度一次定死,所有层共用(楼不是每层各画各的)
  const bayW = Array.from({ length: bays }, () => +rng.range(4.6, 6.8).toFixed(2));
  const width = +bayW.reduce((a, b) => a + b, 0).toFixed(2);

  const floors = [];
  for (let lv = 0; lv <= levels; lv++) {
    const band = bandOf(lv, levels);
    const rule = BAND_RULES[band] || {};
    const pool = poolFor(band);
    const mix = (FLOOR_MIX && FLOOR_MIX[band]) || null;
    const rooms = [];
    let x = 0;
    for (let b = 0; b < bays; b++) {
      const w = bayW[b];
      const prev = rooms.length ? rooms[rooms.length - 1].fn : null;
      let cands = pool.filter(f => !prev || !AVOID.has(pairKey(prev, f.id)));
      if (!cands.length) cands = pool.slice();
      // 层带的对外比例:地面层至少三分之二临街对外
      const needPublic = (rule.publicMin || 0) > 0 &&
        (rooms.filter(r => BY_ID[r.fn].public).length) < Math.ceil(bays * (rule.publicMin || 0));
      if (needPublic) { const pub = cands.filter(f => f.public); if (pub.length) cands = pub; }
      // 族配比建议(FLOOR_MIX):优先抽还没抽够的族
      if (mix && mix.fams) {
        const short = Object.entries(mix.fams).filter(([fam, share]) =>
          rooms.filter(r => BY_ID[r.fn].fam === fam).length < Math.round(share * bays));
        if (short.length) {
          const want = new Set(short.map(s => s[0]));
          const nar = cands.filter(f => want.has(f.fam));
          if (nar.length) cands = nar;
        }
      }
      // 邻里加成:跟左邻是「愿意挨着」的一对,权重翻倍
      const weighted = [];
      cands.forEach(f => { weighted.push(f); if (prev && LIKE.has(pairKey(prev, f.id))) weighted.push(f, f); });
      const fn = rng.pick(weighted);
      const plan = planRoom(fn.id, { w, d: depth, h: floorH - 0.25, seed, tag: `L${lv}B${b}` });
      const cast = castRoom(plan, `${seed}|L${lv}B${b}`);
      rooms.push({ fn: fn.id, cn: fn.cn, fam: fn.fam, public: !!fn.public, bay: b, x, w, plan, cast });
      x += w;
    }
    floors.push({ level: lv, band, y: lv * floorH, rooms, note: rule.note || '' });
  }

  // 街道:楼前是社区的一层(晚上路灯亮,窗里才显得有人)
  const st = STREET || {};
  const street = {
    lamps: rng.count(st.lamps || [6, 10]),
    trees: rng.count(st.trees || [4, 8]),
    pedestrians: rng.count(st.pedestrians || [8, 18]),
    planters: rng.count(st.planters || [2, 6]),
    width,
  };

  return { seed, levels, bays, width, depth, floorH, bayW, floors, street,
           stats: statsOf(floors) };
}

export function statsOf(floors) {
  let rooms = 0, items = 0, actors = 0, seats = 0, bad = 0;
  const fam = {}, fns = new Set();
  floors.forEach(f => f.rooms.forEach(r => {
    rooms++; fns.add(r.fn);
    items += r.plan.items.length; seats += r.plan.seats.length;
    actors += r.cast.actors.length;
    if (!r.plan.path.clear) bad++;
    fam[r.fam] = (fam[r.fam] || 0) + 1;
  }));
  return { rooms, items, actors, seats, blockedPaths: bad, distinctFn: fns.size, fam };
}

/** 社区规则体检:层带、相邻、对外比例有没有被违反 */
export function auditCity(b) {
  const bad = [];
  b.floors.forEach(f => {
    const rule = BAND_RULES[f.band] || {};
    const banned = new Set((ADJACENCY.banned && ADJACENCY.banned[f.band]) || []);
    f.rooms.forEach((r, i) => {
      if (banned.has(r.fn)) bad.push(`L${f.level}(${f.band}) 出现了明令禁止的 ${r.cn}`);
      if (!(BY_ID[r.fn].bands || []).includes(f.band)) bad.push(`L${f.level} 的 ${r.cn} 不该出现在 ${f.band} 层带`);
      if (!(rule.fams || []).includes(r.fam)) bad.push(`L${f.level} 的 ${r.cn} 属 ${r.fam} 族,不在该层带允许的族里`);
      if (i > 0) {
        const k = pairKey(f.rooms[i - 1].fn, r.fn);
        if (AVOID.has(k)) bad.push(`L${f.level}: ${f.rooms[i - 1].cn} 不该紧挨 ${r.cn}`);
      }
    });
    if (rule.publicMin > 0) {
      const share = f.rooms.filter(r => r.public).length / f.rooms.length;
      if (share + 1e-9 < rule.publicMin) bad.push(`L${f.level}(${f.band}) 对外比例 ${(share * 100) | 0}% < 要求的 ${(rule.publicMin * 100) | 0}%`);
    }
  });
  return { ok: bad.length === 0, problems: bad };
}
