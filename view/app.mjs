// ============================================================
// 🕹️ app.mjs —— 沙盘的操作层(把引擎接到手指上)
// 手机竖屏触控优先:一指转、两指缩放、点房选房、点区看区。界面上不出现任何键鼠话术。
// ============================================================
import * as THREE from '../vendor/three.module.js';
import { assemble, auditCity } from '../engine/building.mjs';
import { COSMOPOLIS_VERSION } from '../engine/index.mjs';
import { auditRoom, CAT_BY_ID, FN_BY_ID, candidates } from '../engine/room.mjs';
import { KIT_CATS, KITS } from '../engine/kits.mjs';
import { KIT_BY_ID } from '../engine/room.mjs';
import { FUNCTIONS, FN_FAMILIES } from '../engine/functions.mjs';
import { SCRIPTS } from '../engine/people.mjs';
import { BAND_RULES, ADJACENCY } from '../engine/city.mjs';
import { ROLE_CN, ROLE_IDS, PROGRAM_CN, PROGRAMS } from '../engine/zones.mjs';
import { stepActors } from '../engine/actors.mjs';
import { createStage, orbit, buildRoom, buildStreet, buildBillboard, syncPeople, syncStreet,
         setKitLookup, setPropBuilder, CAT_COLOR, ZONE_COLOR } from './render3d.mjs';
import { drawPlan, hitZone } from './plan2d.mjs';

const $ = s => document.querySelector(s);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const BAND_CN = { ground: '地面 · 开店', mid: '中层 · 住人', top: '顶层 · 安静', roof: '屋顶 · 社交' };
const FAM_CN = Object.fromEntries(FN_FAMILIES.map(f => [f.id, f.cn]));

setKitLookup(KIT_BY_ID);          // 渲染层要知道每件家具多高(人坐多高由家具决定)
// 家具造型包:装上就长出多部件家具,装不上就退回色块 —— 不许因为它整页白屏
try {
  const P = await import('./props.mjs');
  if (typeof P.buildProp === 'function') setPropBuilder(P.buildProp);
} catch (e) { console.warn('造型包没装上,退回色块显示:', e.message); }
const stage = createStage($('#view'));
let B = null, roomGroups = [], street = null, sel = null, selZone = 'main', playing = true, showZones = false;

const cam = orbit($('#view'), stage.camera, { onTap: pickRoom, pitch: 0.22, yaw: -0.36 });

function resize() {
  const c = $('#view'), r = c.parentElement.getBoundingClientRect();
  stage.renderer.setSize(r.width, r.height, false);
  stage.camera.aspect = r.width / Math.max(1, r.height);
  stage.camera.updateProjectionMatrix();
}
addEventListener('resize', () => { resize(); fitAll(); });

function build() {
  const seed = $('#seed').value.trim() || 'cosmopolis';
  const levels = +(localStorage.getItem('cp.levels') || 4);
  const bays = +(localStorage.getItem('cp.bays') || 3);
  B = assemble({ seed, levels, bays });

  stage.world.clear(); roomGroups = [];
  B.floors.forEach(f => f.rooms.forEach(r => {
    const g = buildRoom(r, f, r.x, showZones);
    stage.world.add(g); roomGroups.push(g);
  }));
  street = buildStreet(B); stage.world.add(street);
  stage.world.add(buildBillboard(B));      // 侧墙大广告牌(参考图里那块)
  stage.world.position.x = -B.width / 2;

  fitAll();
  sel = null; selZone = 'main';
  $('#hudTitle').textContent = `${B.floors.length} 层 · ${B.bays} 开间 · ${B.stats.rooms} 间房`;
  // 「本栋」两个字不能省:这里是这一栋楼抽到的功能种数(常见 14 上下),
  // 而 14 恰好是指引里"升级前只有 14 种"那个数字,不加限定词一眼看去像在自打脸
  $('#hudStat').textContent = `本栋 ${B.stats.distinctFn} 种功能 · ${B.stats.items} 件套件 · ${B.stats.actors} 个人 ｜ 库里 ${FUNCTIONS.length} 种`;
  $('#hudPick').textContent = '点一间房看它的五块区域';
  renderAll();
}

function pickRoom(pt) {
  const r = $('#view').getBoundingClientRect();
  const nd = new THREE.Vector2(((pt.x - r.left) / r.width) * 2 - 1, -((pt.y - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(nd, stage.camera);
  const hits = ray.intersectObjects(roomGroups, true);
  if (!hits.length) return;
  let o = hits[0].object;
  while (o && !o.userData.room) o = o.parent;
  if (!o) return;
  selectRoom(o.userData.room);
}

function selectRoom(room) {
  sel = room;
  const has = ROLE_IDS.filter(r => (FN_BY_ID[room.fn].zones[r] || []).length);
  selZone = has.includes('main') ? 'main' : (has[0] || 'main');
  $('#hudPick').textContent = `${room.cn} · ${room.plan.area} ㎡ · ${room.plan.items.length} 件`;
  showTab('room');
  renderAll();
}

// ---------------- 面板 ----------------
function showTab(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === id)));
  document.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + id; });
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { showTab(b.dataset.tab); renderAll(); }));

const row = (color, t, v) => `<div class="row"><i class="k" style="background:${color}"></i><span class="t">${t}</span><span class="v">${v || ''}</span></div>`;

function renderCity() {
  const a = auditCity(B);
  const perBand = B.floors.map(f =>
    `<div class="row"><i class="k" style="background:${f.band === 'ground' ? '#c9714f' : f.band === 'roof' ? '#5f9161' : f.band === 'top' ? '#5c6b8a' : '#c0954f'}"></i>
     <span class="t">L${f.level} ${BAND_CN[f.band]}</span><span class="v">${f.rooms.map(r => r.cn).join(' · ')}</span></div>`).join('');
  $('#pane-city').innerHTML = `
    <h3>整栋是社区,不是叠盒子</h3>
    <p>层带决定这一层能出现哪些族,相邻规则决定谁不能挨着谁 —— 这两条在<b>抽房间的时候</b>就生效,不是抽完再装饰。</p>
    <div class="field"><label>层数</label><input id="fLv" type="range" min="2" max="6" value="${B.levels}"><output>${B.levels}</output></div>
    <div class="field"><label>开间</label><input id="fBay" type="range" min="2" max="5" value="${B.bays}"><output>${B.bays}</output></div>
    <div class="rows">${perBand}</div>
    <p class="note" style="margin-top:10px">街道:路灯 ${B.street.lamps} · 树 ${B.street.trees} · 行人 ${B.street.pedestrians} · 花箱 ${B.street.planters}</p>
    <p class="${a.ok ? 'ok' : 'bad'}" style="margin-top:6px">${a.ok ? '✅ 社区规则全部满足' : '⚠️ ' + a.problems.length + ' 条社区规则被违反(见「体检」)'}</p>`;
  const bind = (id, key) => $(id)?.addEventListener('change', e => { localStorage.setItem(key, e.target.value); build(); });
  bind('#fLv', 'cp.levels'); bind('#fBay', 'cp.bays');
  $('#fLv')?.addEventListener('input', e => e.target.nextElementSibling.value = e.target.value);
  $('#fBay')?.addEventListener('input', e => e.target.nextElementSibling.value = e.target.value);
}

function renderRoom() {
  if (!sel) { $('#pane-room').innerHTML = `<h3>点一间房</h3><p>在上面的楼里点任意一间房,这里会列出它的五块区域各放了什么。</p>`; return; }
  const p = sel.plan, fn = FN_BY_ID[sel.fn];
  const byZone = ROLE_IDS.map(r => {
    const its = p.items.filter(i => i.zone === r);
    if (!its.length) return `<div class="row"><i class="k" style="background:${hex(ZONE_COLOR[r])}"></i><span class="t">${ROLE_CN[r]}</span><span class="v">留空</span></div>`;
    return `<div class="row"><i class="k" style="background:${hex(ZONE_COLOR[r])}"></i><span class="t">${ROLE_CN[r]}:${its.map(i => i.cn).join('、')}</span><span class="v">${its.length}</span></div>`;
  }).join('');
  $('#pane-room').innerHTML = `
    <h3>${sel.cn} <span class="pill">${FAM_CN[sel.fam]}族</span><span class="pill">布置程序 · ${PROGRAM_CN[p.program] || p.program}</span>${sel.public ? '<span class="pill">临街对外</span>' : ''}</h3>
    <p>${fn.desc || ''}</p>
    <p class="note">${p.w}×${p.d} m · ${p.area} ㎡ · ${p.items.length} 件套件 · ${p.seats.length} 个座位口袋 · ${sel.cast.actors.length} 个人</p>
    <div class="rows">${byZone}</div>
    ${p.skipped.length ? `<p class="note" style="margin-top:8px">放不下而跳过 ${p.skipped.length} 件(区域装不下就不硬塞)。</p>` : ''}`;
}

function renderZone() {
  const host = $('#pane-zone');
  if (!sel) { host.innerHTML = `<h3>先点一间房</h3><p>客厅是母模板:五块区域说完一间客厅,其它房间只换套件族,语法不变。</p>`; return; }
  const fn = FN_BY_ID[sel.fn], p = sel.plan;
  const btns = ROLE_IDS.map(r => `<button data-z="${r}" aria-pressed="${r === selZone}">${ROLE_CN[r]}</button>`).join('');
  const prog = (fn.zones[selZone] || []);
  const allow = prog.map(e => {
    const c = CAT_BY_ID[e.cat], pool = candidates(e.cat, selZone, sel.fn);
    return row(hex(CAT_COLOR[e.cat] || 0x999999), `${c ? c.cn : e.cat}`, `要 ${Array.isArray(e.n) ? e.n.join('–') : e.n} 件 · 库里 ${pool.length} 件可换`);
  }).join('') || `<div class="row"><span class="t">这一块按程序留空</span></div>`;
  const got = p.items.filter(i => i.zone === selZone);
  host.innerHTML = `
    <h3>${sel.cn} · ${ROLE_CN[selZone]}</h3>
    <p class="note">布置程序「${PROGRAM_CN[p.program]}」:${(PROGRAMS.find(x => x.id === p.program) || {}).hint || ''}换一套程序,区域角色的位置和大小就换,零件语法不变。</p>
    <canvas id="plan"></canvas>
    <div class="zonebtns">${btns}</div>
    <p class="note">这一块<b>允许</b>什么(区域程序 → 同类可互换、跨类不许进):</p>
    <div class="rows">${allow}</div>
    <p class="note" style="margin-top:8px">这一间<b>实际</b>抽到了:${got.length ? got.map(i => i.cn).join('、') : '（留空）'}</p>
    <div class="legend">${ROLE_IDS.map(r => `<span><i style="background:${hex(ZONE_COLOR[r])}"></i>${ROLE_CN[r]}</span>`).join('')}</div>`;
  const cv = $('#plan');
  drawPlan(cv, p, selZone);
  cv.addEventListener('pointerdown', e => { const z = hitZone(cv, e.clientX, e.clientY); if (z) { selZone = z; renderAll(); } });
  host.querySelectorAll('.zonebtns button').forEach(b => b.addEventListener('click', () => { selZone = b.dataset.z; renderAll(); }));
}

function renderPeople() {
  if (!sel) { $('#pane-people').innerHTML = `<h3>先点一间房</h3><p>人物是套件,不是装饰:座位从家具口袋里长出来,走路只走通行区。</p>`; return; }
  const sc = SCRIPTS[sel.fn] || {};
  const acts = sel.cast.actors;
  const list = acts.map(a => row(a.kind === 'person' ? '#0f7f7c' : '#8a6a4a',
    `${a.actCn || (a.kind === 'person' ? '人' : '猫')}`,
    `${a.state === 'sit' ? '坐' : a.state === 'walk' ? '走' : '忙'}${a.home ? ' @' + ROLE_CN[a.home.zone] : ''}`)).join('');
  $('#pane-people').innerHTML = `
    <h3>${sel.cn} · 人物脚本</h3>
    <p>${sc.note || ''}</p>
    <div class="rows">${(sc.seats || []).map(s => row('#0f7f7c', `坐 ${ROLE_CN[s.zone]}`, `${Array.isArray(s.n) ? s.n.join('–') : s.n} 人 · ${s.body} · 坐 ${(s.hold || []).join('–')} 秒`)).join('')}
      ${row('#b9b2a4', '在通行区走动', (sc.walkers || [0, 0]).join('–') + ' 人')}
      ${row('#c0954f', '在辅区来回忙', (sc.busy || [0, 0]).join('–') + ' 人')}</div>
    <p class="note" style="margin-top:10px">这一间实际长出来的人(${acts.length}):</p>
    <div class="rows">${list || '<div class="row"><span class="t">这间没有人</span></div>'}</div>
    ${sel.cast.warns.length ? `<p class="bad note" style="margin-top:8px">${sel.cast.warns.join('；')}</p>` : ''}`;
}

function renderAudit() {
  const city = auditCity(B);
  let bad = [], rooms = 0;
  B.floors.forEach(f => f.rooms.forEach(r => { rooms++; const a = auditRoom(r.plan); if (!a.ok) bad.push(`L${f.level} ${r.cn}:${a.problems[0]}`); }));
  $('#pane-audit').innerHTML = `
    <h3>量化体检</h3>
    <p>不是「看起来还行」,是逐条判:家具有没有越出自己的区域、有没有压住通行、有没有跨类乱放、层带与相邻规则有没有被违反。</p>
    <div class="rows">
      ${row(bad.length ? '#a83232' : '#0f7f4a', `房间内部规则 ${rooms - bad.length}/${rooms} 通过`, bad.length ? bad.length + ' 间有问题' : '全绿')}
      ${row(city.ok ? '#0f7f4a' : '#a83232', `社区规则`, city.ok ? '全绿' : city.problems.length + ' 条违反')}
      ${row('#5c6b8a', '套件库', `${KIT_CATS.length} 大类 · ${KITS.length} 件`)}
      ${row('#9aa2ad', '布置程序', `${PROGRAMS.length} 套 · ${PROGRAMS.map(x => x.cn).join('/')}`)}
      ${row('#c0954f', '功能库', `${FUNCTIONS.length} 种 · ${FN_FAMILIES.length} 族`)}
      ${row('#0f7f7c', '人物脚本', `${Object.keys(SCRIPTS).length} 份`)}
      ${row('#8a7a63', '相邻规则', `不许挨 ${ADJACENCY.avoid.length} 对 · 愿意挨 ${ADJACENCY.like.length} 对`)}
      ${row('#6f675c', '引擎版本', 'v' + COSMOPOLIS_VERSION)}
    </div>
    <p class="note" style="margin-top:10px">这一页的每个数字都是<b>现算</b>的,不是写死在页面里的。命令行同一套判据:<code>node tests/engine_check.mjs</code>(退出码 2 = 不许上线)。</p>
    ${(bad.length || !city.ok) ? `<p class="note bad" style="margin-top:8px">${[...bad, ...city.problems].slice(0, 8).join('<br>')}</p>` : ''}`;
}

function renderAll() { renderCity(); renderRoom(); renderZone(); renderPeople(); renderAudit(); }

// ---------------- 工具按钮 ----------------
$('#build').addEventListener('click', build);
$('#seed').addEventListener('change', build);
$('#tZone').addEventListener('click', () => {
  showZones = !showZones; $('#tZone').setAttribute('aria-pressed', String(showZones)); build();
});
$('#tPlay').addEventListener('click', () => {
  playing = !playing; $('#tPlay').setAttribute('aria-pressed', String(playing));
  $('#tPlay').textContent = playing ? '暂停' : '继续';
});
$('#tFit').addEventListener('click', fitAll);

function fitAll() {
  if (!B) return;
  const hTot = (B.levels + 1) * B.floorH;
  // 贴近一点:主席要看清房间里的细节,楼太小等于白做
  cam.fit(new THREE.Vector3(0, hTot * 0.52, B.depth * 0.28), B.width + 1.0, hTot + 1.0, 1.02);
}

// ---------------- 主循环 ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && B) {
    B.floors.forEach(f => f.rooms.forEach(r => stepActors(r.cast, r.plan, dt, `${B.seed}|L${f.level}B${r.bay}`)));
    roomGroups.forEach(g => syncPeople(g, now / 1000));
    syncStreet(street, now / 1000);
  }
  stage.renderer.render(stage.scene, stage.camera);
  requestAnimationFrame(loop);
}

// 版本印:线上是哪一版,打开控制台或看体检页就知道,不靠猜(Rule-ONESITE-001)
console.log('COSMOPOLIS v' + COSMOPOLIS_VERSION);
resize(); build(); requestAnimationFrame(loop);
// ── 运行时探针:给机器闸用,不是给界面用 ──────────────────────────
// 🔴 主席一眼看出「人物浮在空中」,而当时所有引擎判据都是绿的 ——
//    因为它们判的是家具落位,没有一条在看【人的脚在哪】。这个探针就是补上那只眼睛:
//    它在【真页面、真渲染完之后】量每个人的世界坐标最低点,和他所在那层楼板对比。
const KITS_BY_ID = KIT_BY_ID;
function groundReport() {
  const out = { total: 0, floating: 0, sunken: 0, worst: 0, worstWho: '', meshes: 0, colors: new Set() };
  stage.world.traverse(o => { if (o.isMesh) { out.meshes++; if (o.material && o.material.color) out.colors.add(o.material.color.getHex()); } });
  roomGroups.forEach(g => {
    const floorY = g.position.y;
    const people = g.userData.people; if (!people) return;
    people.children.forEach(f => {
      const a = f.userData.actor;
      if (a.kind !== 'person') return;
      f.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(f);
      // 🔴 判据要认"他站/坐在什么上面",不能一律拿楼板量:
      //    躺在床上的人本来就该高出楼板一个床垫的高度,拿楼板量他会被误判成"浮空"。
      //    所以躺姿的参照面是那件床的高度,其余姿态(站/走/坐)的参照面才是楼板 ——
      //    坐姿也是楼板,因为脚必须踩到地(坐面高只抬胯,不抬人)。
      const kit = a.home && KITS_BY_ID[a.home.kit];
      const expect = a.body === 'lie' ? Math.min(0.75, Math.max(0.25, kit ? kit.h : 0.5)) : 0;
      const d = bb.min.y - floorY - expect;
      out.total++;
      if (d > 0.12) out.floating++;
      if (d < -0.12) out.sunken++;
      if (Math.abs(d) > Math.abs(out.worst)) { out.worst = d; out.worstWho = `${g.userData.room.cn}/${a.body}`; }
    });
  });
  return { ...out, colors: out.colors.size };
}

window.__COSMO__ = { get building() { return B; }, assemble, auditCity, auditRoom, groundReport };
window.__CLIPPROBE__ = groundReport;   // 全仓穿模闸的通用契约名
