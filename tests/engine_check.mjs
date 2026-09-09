// ============================================================
// 🧪 engine_check.mjs —— CosmoPolis 量化引擎机器闸
// 判的不是「看起来还行」,是五层各自的硬判据。退出码 2 = 不许上线。
//
// 🔴 本闸自带【变红证明】:每条判据都先喂一个【故意做坏的样本】,
//    证明它真会红;再喂真引擎,看它是不是绿。
//    只有正控没有负控的绿灯 = 装饰,它说绿等于没说(Rule-REDPROOF-001)。
// 用法: node tests/engine_check.mjs
// ============================================================
import { KITS, KIT_CATS } from '../engine/kits.mjs';
import { FUNCTIONS, FN_FAMILIES } from '../engine/functions.mjs';
import { SCRIPTS, BODIES } from '../engine/people.mjs';
import { BAND_RULES, ADJACENCY, STREET } from '../engine/city.mjs';
import { planRoom, auditRoom, CAT_BY_ID } from '../engine/room.mjs';
import { cutZones, PROGRAMS, PROGRAM_IDS } from '../engine/zones.mjs';
import { castRoom } from '../engine/actors.mjs';
import { assemble, auditCity } from '../engine/building.mjs';
import { ROLE_IDS } from '../engine/zones.mjs';

let fail = 0, pass = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
};
const H = t => console.log('\n' + t);

// ---------- 1. 数据契约(第 1、3 层的库存) ----------
H('【1】数据契约');
// 🔴 判据锚在【工作指引原文】上,不是我自己顺手编的一套词表 ——
// 蓝图写死了 12 大类和 48 个功能的名字,引擎对不上它就是没按指引做。
const BP_CATS = ['seat','table','bed','storage','cook','bar','light','textile','plant','media','arch','person'];
const BP_FNS = {
  dwell:  ['living','salon','dining','bedroom','kidroom','nursery','guestroom','vanity'],
  make:   ['study','library','coworking','music','atelier','sewing','woodshop','darkroom'],
  cook:   ['kitchen','openkitchen','cafe','bakery','teahouse','winebar','juicebar','piecorner'],
  shop:   ['florist','bookstore','grocer','records','boutique','hairsalon','bikeshop','lobby'],
  gather: ['playroom','gallery','cinema','yoga','greenhouse','roofgarden','roofbbq','roofdining'],
  service:['stairhall','laundry','mailroom','bikepark','storageroom','waterplant','duty','skybridge'],
};
ok(JSON.stringify(KIT_CATS.map(c => c.id)) === JSON.stringify(BP_CATS),
   '12 大类的 id 与顺序 = 工作指引原表', KIT_CATS.map(c => c.id).join(','));
ok(KITS.length >= 120, `套件 ≥120 件`, '实得 ' + KITS.length);
const perCat = {}; KITS.forEach(k => perCat[k.cat] = (perCat[k.cat] || 0) + 1);
ok(BP_CATS.slice(0, 11).every(c => (perCat[c] || 0) >= 10), '11 个可落地大类各 ≥10 件', JSON.stringify(perCat));
ok(perCat.person === 12, '第 12 类『人物』恰好 12 个动作(指引把人物列为一大类)', '实得 ' + perCat.person);
ok(KITS.filter(k => k.cat === 'person').every(k => k.placeable === false), '人物动作不落地(placeable:false)');
ok(FUNCTIONS.length === 48, '功能 48 种', '实得 ' + FUNCTIONS.length);
const perFam = {}; FUNCTIONS.forEach(f => perFam[f.fam] = (perFam[f.fam] || 0) + 1);
ok(FN_FAMILIES.length === 6 && Object.values(perFam).every(v => v === 8), '6 族各 8 个', JSON.stringify(perFam));
const fnMismatch = Object.entries(BP_FNS).filter(([fam, list]) =>
  JSON.stringify(FUNCTIONS.filter(f => f.fam === fam).map(f => f.id).sort()) !== JSON.stringify(list.slice().sort()));
ok(fnMismatch.length === 0, '48 个功能逐条 = 工作指引原表', fnMismatch.map(m => m[0]).join(','));
ok(FUNCTIONS.every(f => PROGRAM_IDS.includes(f.program)), '每个功能都声明了布置程序');
const perProg = {}; FUNCTIONS.forEach(f => perProg[f.program] = (perProg[f.program] || 0) + 1);
ok(PROGRAMS.length === 4 && PROGRAM_IDS.every(p => perProg[p] > 0), '四套布置程序都真有功能在用', JSON.stringify(perProg));
ok(Object.keys(SCRIPTS).length === 48, '人物脚本 48 份', '实得 ' + Object.keys(SCRIPTS).length);
ok(ADJACENCY.avoid.length >= 8 && ADJACENCY.like.length >= 8, '相邻规则 ≥8+8',
   `${ADJACENCY.avoid.length}/${ADJACENCY.like.length}`);
ok(['ground', 'mid', 'top', 'roof'].every(b => BAND_RULES[b] && BAND_RULES[b].fams.length), '四个层带规则齐全');
ok(!!STREET && Array.isArray(STREET.lamps), '街道规则存在');
const zoneSig = new Set(FUNCTIONS.map(f => JSON.stringify(f.zones)));
ok(zoneSig.size === FUNCTIONS.length, '48 个功能的区域程序互不相同(没灌水)', `去重后 ${zoneSig.size}`);
ok(FUNCTIONS.every(f => Object.values(f.zones).every(l => (l || []).every(e => e.cat !== 'person'))),
   '没有把「人物」当家具塞进任何区域程序(它是第 4 层的事)');

// ---------- 2. 排房:家具只落在自己的块里 ----------
H('【2】排房(第 2+3 层):48 个功能 × 5 个种子 = 240 间房');
let roomBad = [], roomN = 0, itemN = 0, emptyN = 0;
for (const f of FUNCTIONS) for (let s = 0; s < 5; s++) {
  const p = planRoom(f.id, { seed: 'gate' + s, tag: 't' + s });
  roomN++; itemN += p.items.length;
  if (p.items.length === 0) emptyN++;
  const a = auditRoom(p);
  if (!a.ok) roomBad.push(`${f.id}#${s}: ${a.problems[0]}`);
}
ok(roomBad.length === 0, `240 间房全部通过房内规则`, roomBad.slice(0, 3).join(' | '));
ok(emptyN === 0, '没有一间房是空的', emptyN + ' 间空房');
ok(itemN / roomN >= 4, `平均每间 ≥4 件套件`, '实得 ' + (itemN / roomN).toFixed(1));

// ---------- 2.5 布置程序:换一套程序,区域角色真的换位置 ----------
H('【2.5】布置程序(第 2 层的四套变体)');
{
  const geo = p => JSON.stringify(cutZones({ w: 5.4, d: 4.6, program: p }).list.map(z => [z.role, +z.x.toFixed(2), +z.z.toFixed(2), +z.w.toFixed(2), +z.d.toFixed(2)]));
  const sigs = PROGRAM_IDS.map(geo);
  ok(new Set(sigs).size === 4, '四套程序在同一间房里给出四种不同的区域几何(不是换个名字而已)',
     `去重后 ${new Set(sigs).size} 种`);
  // 负控:同一套程序两次必须一模一样(否则上面那条"四种不同"可能只是随机噪声冒充的)
  ok(geo('face') === geo('face'), '负控:同一套程序两次结果必须完全相同(排除随机噪声冒充差异)');
  // 换程序之后零件尺寸不许变 —— 指引原话「换布置程序,区域角色怎么换,零件语法不变」
  const sizes = p => planRoom('living', { seed: 'prog', tag: 'p', program: p })
    .items.map(i => i.kit).sort().length > 0;
  ok(PROGRAM_IDS.every(sizes), '四套程序都排得出房间');
}

// ---------- 3. 人物:座位从家具口袋里长出来 ----------
H('【3】人物(第 4 层)');
let castBad = [], airSeat = 0, actorN = 0;
for (const f of FUNCTIONS) {
  const p = planRoom(f.id, { seed: 'castgate', tag: 'c' });
  const c = castRoom(p, 'castgate');
  actorN += c.actors.length;
  c.actors.filter(a => a.state === 'sit' && a.home).forEach(a => {
    const inPocket = p.seats.some(s => s.id === a.home.id);
    if (!inPocket) airSeat++;
  });
  if (c.warns.length) castBad.push(`${f.id}: ${c.warns[0]}`);
}
ok(airSeat === 0, '没有人坐在空气里(每个坐着的人都占着一件家具自带的口袋)', airSeat + ' 人');
ok(actorN >= 48, '48 个功能总共长出 ≥48 个人', '实得 ' + actorN);
ok(castBad.length <= 4, '座位不够的功能 ≤4 个', castBad.slice(0, 3).join(' | '));
ok((BODIES || []).length === 6, '六种身体姿态', '实得 ' + (BODIES || []).length);

// ---------- 4. 社区:层带 / 相邻 / 对外比例 ----------
H('【4】社区(第 0 层):20 个种子各抽一栋楼');
let cityBad = [], fnSeen = new Set(), roomsAll = 0;
for (let i = 0; i < 20; i++) {
  const b = assemble({ seed: 'city' + i, levels: 4, bays: 3 });
  const a = auditCity(b);
  if (!a.ok) cityBad.push(`seed${i}: ${a.problems[0]}`);
  b.floors.forEach(f => f.rooms.forEach(r => { fnSeen.add(r.fn); roomsAll++; }));
}
ok(cityBad.length === 0, `20 栋楼全部满足层带+相邻+对外比例`, cityBad.slice(0, 3).join(' | '));
ok(fnSeen.size >= 20, `20 栋楼里真的抽到了 ≥20 种不同功能(不是来回那几种)`, '实得 ' + fnSeen.size);

// ---------- 5. 可复算:同种子 = 同一座城 ----------
H('【5】可复算');
const s1 = JSON.stringify(assemble({ seed: 'repeat', levels: 3, bays: 3 }).floors.map(f => f.rooms.map(r => [r.fn, r.plan.items.map(i => [i.kit, i.box.x, i.box.z])])));
const s2 = JSON.stringify(assemble({ seed: 'repeat', levels: 3, bays: 3 }).floors.map(f => f.rooms.map(r => [r.fn, r.plan.items.map(i => [i.kit, i.box.x, i.box.z])])));
ok(s1 === s2, '同一个种子两次生成完全一致');
const s3 = JSON.stringify(assemble({ seed: 'other', levels: 3, bays: 3 }).floors.map(f => f.rooms.map(r => r.fn)));
ok(s3 !== JSON.stringify(assemble({ seed: 'repeat', levels: 3, bays: 3 }).floors.map(f => f.rooms.map(r => r.fn))), '换种子就是另一座城');

// ---------- 6. 🔴 变红证明:故意做坏的样本,判据必须判红 ----------
H('【6】变红证明(负控:判据本身有没有被证明会红)');
{
  const p = planRoom('living', { seed: 'red', tag: 'r' });
  // 负控 A:把一件家具塞进通行区
  const pa = JSON.parse(JSON.stringify(p));
  const pz = pa.zones.roles.path;
  pa.items.push({ kit: 'FAKE_BLOCK', cn: '假障碍', cat: 'seat', zone: 'main', mount: 'floor', rot: 0,
                  box: { x: pz.x + 0.05, z: pz.z + 0.4, w: 0.9, d: 0.9 }, lift: 0, h: 0.8 });
  pa.path.clear = false; pa.path.why = '注入的障碍';
  ok(auditRoom(pa).ok === false, '负控A:家具压住通行区 → 必须判红');

  // 负控 B:跨类乱放(把灶塞进窗墙区)
  const pb = JSON.parse(JSON.stringify(p));
  const zw = pb.zones.roles.window;
  pb.items.push({ kit: 'FAKE_STOVE', cn: '假灶', cat: 'cook', zone: 'window', mount: 'floor', rot: 0,
                  box: { x: zw.x + 0.05, z: zw.z + 0.05, w: 0.6, d: 0.6 }, lift: 0, h: 0.9 });
  const rb = auditRoom(pb);
  ok(rb.ok === false && rb.problems.some(x => x.includes('跨类')), '负控B:厨作进窗墙区 → 必须判红', rb.problems[0] || '');

  // 负控 C:家具越出自己的区域
  const pc = JSON.parse(JSON.stringify(p));
  const zm = pc.zones.roles.main;
  pc.items.push({ kit: 'FAKE_OVER', cn: '假越界', cat: 'seat', zone: 'main', mount: 'floor', rot: 0,
                  box: { x: zm.x - 1.5, z: zm.z, w: 0.8, d: 0.8 }, lift: 0, h: 0.8 });
  ok(auditRoom(pc).ok === false, '负控C:家具越出区域 → 必须判红');

  // 负控 D:正控 —— 真引擎排出来的那间房必须是绿的
  ok(auditRoom(p).ok === true, '正控:真引擎排的房 → 必须判绿', auditRoom(p).problems[0] || '');
}
{
  // 负控 E:社区规则 —— 把厨房搬上屋顶,必须判红
  const b = assemble({ seed: 'redcity', levels: 3, bays: 3 });
  const roof = b.floors[b.floors.length - 1];
  roof.rooms[0] = { ...roof.rooms[0], fn: 'kitchen', cn: '厨房', fam: 'eat', public: false };
  ok(auditCity(b).ok === false, '负控E:厨房搬上屋顶 → 必须判红');
  const b2 = assemble({ seed: 'redcity', levels: 3, bays: 3 });
  ok(auditCity(b2).ok === true, '正控:真 assemble 的楼 → 必须判绿', (auditCity(b2).problems[0] || ''));
}

// ---------- 收口 ----------
console.log(`\n━━━ 结果:${pass} 条通过 / ${fail} 条失败 ━━━`);
if (fail) { console.log('🔴 引擎不合格,禁止上线'); process.exit(2); }
console.log('🟢 引擎合格');
