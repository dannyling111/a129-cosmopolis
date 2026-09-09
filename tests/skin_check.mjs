// ════════════════════════════════════════════════════════════════════════════
// 🎨 skin_check.mjs —— 画风融合层的判据(Rule-REDPROOF-001:每条先证明它【会红】)
//
// 为什么要单独一道闸:融合层做的是【颜色关系】,而颜色关系正是"看着还行"最容易蒙混的地方。
// 引擎闸判布局、落地闸判人站没站稳、页面闸判手指点不点得中 —— 没有一条在看
// 【这一整栋楼的颜色到底统不统一、还分不分得出房间】。这道闸补上那只眼睛。
//
// 每条判据都配一个【故意做坏的样本】,坏样本必须让它变红;
// 只会判绿的判据是装饰,它说绿等于没说。
//
// 用法: node tests/skin_check.mjs
// ════════════════════════════════════════════════════════════════════════════
import { CITY_SKINS, SKIN_IDS, TIMES, TIME_IDS, harmonize, hexToHsl, tint, skylineTowers } from '../view/cityskin.mjs';
import { ROOM_STYLES } from '../view/palette.mjs';

let pass = 0, fail = 0;
const ok = (c, n, e = '') => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (e ? ' — ' + e : '')); } };
const FNS = Object.keys(ROOM_STYLES);
const dev = (h, c) => Math.abs(((h - c + 540) % 360) - 180);          // 到色环中心的最短距离
const span = arr => {                                                 // 一组色相铺开的宽度
  const s = [...arr].sort((a, b) => a - b);
  let gap = 360 - (s[s.length - 1] - s[0]);
  for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
  return 360 - gap;
};

console.log('\n━━━ A. 整栋统一:墙色必须落进城市色相的窄带 ━━━');
const COHESION_MAX = 45;      // 配色学的"同类色"宽度上限;再宽人眼就读成两栋楼
for (const id of SKIN_IDS) {
  const c = CITY_SKINS[id].hue;
  const d = FNS.map(f => dev(hexToHsl(harmonize(ROOM_STYLES[f], id).wall).h, c));
  ok(Math.max(...d) <= COHESION_MAX, `${id}:48 间房墙色最大偏离 ${Math.max(...d).toFixed(1)}° ≤ ${COHESION_MAX}°`);
}
{ // 🔴 负控:不收敛(等价 WALL_PULL=0)必须判红 —— 这正是融合前的状态
  const c = CITY_SKINS.paris.hue;
  const d = FNS.map(f => dev(hexToHsl(tint(ROOM_STYLES[f].wall, CITY_SKINS.paris, 0)).h, c));
  ok(Math.max(...d) > COHESION_MAX, `负控:不收敛(融合前)最大偏离 ${Math.max(...d).toFixed(1)}° → 必须判红`);
}

console.log('\n━━━ B. 房间还分得出来:强调色不许被一起拉平 ━━━');
const DISTINCT_MIN = 120;     // 48 间房的强调色至少要铺开这么宽,否则"风格各异"就没了
for (const id of SKIN_IDS) {
  const s = span(FNS.map(f => hexToHsl(harmonize(ROOM_STYLES[f], id).accent).h));
  ok(s >= DISTINCT_MIN, `${id}:强调色铺开 ${s.toFixed(0)}° ≥ ${DISTINCT_MIN}°`);
}
{ // 🔴 负控:把强调色也拉到 0.92,必须判红(统一过头 = 一栋楼一个色,没性格)
  const s = span(FNS.map(f => hexToHsl(tint(ROOM_STYLES[f].accent, CITY_SKINS.paris, 0.92)).h));
  ok(s < DISTINCT_MIN, `负控:强调色也拉到 0.92 → 只剩 ${s.toFixed(0)}° → 必须判红`);
}

console.log('\n━━━ C. 六座城真的不一样(不是换个名字) ━━━');
const SKIN_GAP_MIN = 18;
let worst = { g: 999, a: '', b: '' };
for (let i = 0; i < SKIN_IDS.length; i++) for (let j = i + 1; j < SKIN_IDS.length; j++) {
  const g = dev(CITY_SKINS[SKIN_IDS[i]].hue, CITY_SKINS[SKIN_IDS[j]].hue);
  if (g < worst.g) worst = { g, a: SKIN_IDS[i], b: SKIN_IDS[j] };
}
ok(worst.g >= SKIN_GAP_MIN, `最接近的两座城 ${worst.a}/${worst.b} 相差 ${worst.g.toFixed(1)}° ≥ ${SKIN_GAP_MIN}°`);
ok(dev(CITY_SKINS.paris.hue, CITY_SKINS.paris.hue) < SKIN_GAP_MIN, '负控:同一座城跟自己比 0° → 必须判红(证明这条尺子真在量差异)');

console.log('\n━━━ D. 地面必须留住自己的深色(墙地分不开 = 一片糊) ━━━');
const LIGHT_GAP = 0.08;
for (const id of SKIN_IDS) {
  const bad = FNS.filter(f => {
    const h = harmonize(ROOM_STYLES[f], id);
    return (hexToHsl(h.wall).l - hexToHsl(h.floorA).l) < LIGHT_GAP;
  });
  ok(bad.length <= FNS.length * 0.10, `${id}:墙比地板亮 ≥${LIGHT_GAP} 的房间 ${FNS.length - bad.length}/${FNS.length}`, bad.slice(0, 3).join(','));
}
{ // 🔴 负控:地板也拉满(FLOOR_PULL=1),必须判红 —— 第一版 0.45 就已经开始糊了
  const bad = FNS.filter(f => {
    const w = tint(ROOM_STYLES[f].wall, CITY_SKINS.paris, 0.80);
    const fl = tint(ROOM_STYLES[f].floorA, CITY_SKINS.paris, 1);
    return (hexToHsl(w).l - hexToHsl(fl).l) < LIGHT_GAP;
  });
  ok(bad.length > FNS.length * 0.10, `负控:地板拉满 → ${bad.length}/${FNS.length} 间墙地分不开 → 必须判红`);
}

console.log('\n━━━ E. 皮肤与时段的数据完整(缺字段 = 换到那一档就崩) ━━━');
const NEED = ['facade', 'facadeTrim', 'roof', 'base', 'ground', 'sidewalk',
  'skyDay', 'skyDusk', 'skyNight', 'fogDay', 'fogDusk', 'fogNight', 'towerColors', 'towerH', 'hue', 'sat', 'light'];
for (const id of SKIN_IDS) {
  const miss = NEED.filter(k => CITY_SKINS[id][k] === undefined);
  ok(!miss.length, `${id}:${NEED.length} 个字段齐`, miss.join(','));
}
const TNEED = ['sky', 'fog', 'hemiSky', 'hemi', 'amb', 'keyPos', 'key', 'keyI', 'fillPos', 'fill', 'fillI', 'lamps', 'fogNear', 'fogFar', 'exposure'];
for (const id of TIME_IDS) {
  const miss = TNEED.filter(k => TIMES[id][k] === undefined);
  ok(!miss.length, `时段 ${id}:${TNEED.length} 个字段齐`, miss.join(','));
  ok(CITY_SKINS.paris[TIMES[id].sky] !== undefined, `时段 ${id} 指的天空字段在皮肤里真存在`);
}
ok(TIMES.day.lamps === 0 && TIMES.night.lamps > TIMES.dusk.lamps && TIMES.dusk.lamps > 0,
  '屋内灯:白天灭 < 黄昏 < 夜晚(不是三档都一样)');

console.log('\n━━━ F. 远景可复算(换种子不该让天际线乱跳) ━━━');
const t1 = skylineTowers('nyc'), t2 = skylineTowers('nyc');
ok(JSON.stringify(t1) === JSON.stringify(t2), '同一座城两次调用结果一致');
ok(t1.length === 22, `22 座塔楼(实得 ${t1.length})`);
ok(JSON.stringify(skylineTowers('med')) !== JSON.stringify(t1), '负控:换一座城必须换一套天际线');

console.log(`\n━━━ 结果:${pass} 条通过 / ${fail} 条失败 ━━━`);
console.log(fail ? '🔴 画风融合层不合格' : '🟢 画风融合层合格');
process.exit(fail ? 2 : 0);
