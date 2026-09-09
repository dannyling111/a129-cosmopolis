// ============================================================
// 🧩 zones.mjs —— 第 2 层:区域(把一间房切成 4–6 块)
// 指引原话:「一间房切成 4–6 块:窗墙、主区、辅区、墙装、通行。家具只落在自己的块里。」
// 这一层【只管切】,不管放什么 —— 放什么是第 3 层(套件)的事。
// 坐标系:房间左前角为原点,x 向右 [0,w],z 向里 [0,d];z=d 是外墙(窗),z=0 是内墙(门在这边)。
// ============================================================

export const ZONE_ROLES = [
  { id: 'window',  cn: '窗墙', note: '贴外窗那一条:采光、花箱、帘子,对外的表情' },
  { id: 'main',    cn: '主区', note: '这间房的主事件:围坐 / 睡 / 进食 / 主操作' },
  { id: 'aux',     cn: '辅区', note: '次要事件:阅读角 / 操作带 / 收纳带' },
  { id: 'walldec', cn: '墙装', note: '内墙那一面,只挂不占地' },
  { id: 'path',    cn: '通行', note: '必须留空,人只走这里' },
];
export const ROLE_IDS = ZONE_ROLES.map(z => z.id);
export const ROLE_CN = Object.fromEntries(ZONE_ROLES.map(z => [z.id, z.cn]));

/** 四套布置程序(照抄工作指引)。它们【只改区域角色的几何】——哪块当主区、多大、往哪面墙推;
 *  绝不改零件尺寸。这就是「换布置程序,区域角色换了,零件语法不变」这句话的机器含义。 */
export const PROGRAMS = [
  { id: 'face', cn: '会客朝向', hint: '沙发对切开面,茶几在前,阅读椅在侧。' },
  { id: 'wall', cn: '靠墙沙发', hint: '沙发贴窗墙,围坐退到房间深处。' },
  { id: 'side', cn: '侧向围坐', hint: '沙发沿侧墙,媒介墙正对切开面。' },
  { id: 'nook', cn: '阅读角落', hint: '主区缩小,阅读椅和灯变成主角。' },
];
export const PROGRAM_IDS = PROGRAMS.map(p => p.id);
export const PROGRAM_CN = Object.fromEntries(PROGRAMS.map(p => [p.id, p.cn]));

const WIN_BAND_MAX = 0.95;   // 窗墙进深上限(m):够放花箱和一把窗前椅
const WALL_BAND = 0.16;      // 墙装带厚(m):只挂东西,不占地
const PATH_W = 1.15;         // 通行净宽(m):一个人走 + 一个人侧身让,低于这个数就是过不去

/** 窗墙带按房间进深收缩:一间 2.4m 深的小屋不能被 0.95m 的窗带吃掉四成,
 *  否则剩下的主辅区连一把椅子都塞不进(实测:衣帽间/暗房就是这么变成空房的) */
const winBandFor = d => Math.min(WIN_BAND_MAX, Math.max(0.45, d * 0.22));

const area = r => Math.max(0, r.w) * Math.max(0, r.d);

/**
 * 把一间房切成五块。
 * @param {{w:number,d:number,doorX?:number,seed?:any}} room 房间净尺寸(米)
 * @returns {{roles:Object, list:Array, meta:Object}} roles[角色]=矩形;list 是有序数组
 */
export function cutZones({ w, d, doorX = null, id = 'room', program = 'face' }) {
  const prog = PROGRAM_IDS.includes(program) ? program : 'face';
  const WIN_BAND = winBandFor(d);

  // 房间够宽才让通行走中间(两侧各成一块);太窄就把通行贴到一侧墙,
  // 好让剩下的那块是一整片 —— 否则一间 2.6m 宽的房会被中间的走道切成两条谁也放不下东西的窄缝。
  // 「靠墙沙发」和「侧向围坐」这两套程序【本来就要求走道贴边】,所以直接强制贴边。
  const twoSided = w >= PATH_W + 2 * 1.30 && (prog === 'face' || prog === 'nook');
  const defX = twoSided ? w * 0.5 : PATH_W / 2 + 0.08;
  const dx = Math.min(Math.max(doorX == null ? defX : doorX, PATH_W / 2 + 0.06), w - PATH_W / 2 - 0.06);

  const innerZ0 = WALL_BAND;
  const innerZ1 = Math.max(innerZ0 + 0.4, d - WIN_BAND);
  const innerD = innerZ1 - innerZ0;

  const window_ = { role: 'window',  x: 0, z: d - WIN_BAND, w, d: WIN_BAND, mount: 'floor' };
  const walldec = { role: 'walldec', x: 0, z: 0,            w, d: WALL_BAND, mount: 'wall' };
  const path    = { role: 'path',    x: dx - PATH_W / 2, z: innerZ0, w: PATH_W, d: innerD, mount: 'none' };

  const left  = { x: 0,               z: innerZ0, w: Math.max(0, path.x),              d: innerD };
  const right = { x: path.x + PATH_W, z: innerZ0, w: Math.max(0, w - path.x - PATH_W), d: innerD };
  const big   = area(left) >= area(right) ? left : right;
  const small = big === left ? right : left;
  const flankable = area(small) >= 3.2 && small.w >= 1.1;

  let main, aux, split;
  const stack = (host, mainShare, mainAtWindow = true) => {
    const cut = host.d * mainShare;
    const front = { x: host.x, z: host.z + host.d - cut, w: host.w, d: cut };          // 靠窗那一段
    const back  = { x: host.x, z: host.z,                w: host.w, d: host.d - cut }; // 靠里那一段
    return mainAtWindow ? [front, back] : [back, front];
  };

  if (prog === 'wall') {
    // 靠墙沙发:主家具贴窗墙,围坐退到房间深处 → 主区是靠窗那一条,辅区在它身后
    const [m, a] = stack(big, 0.52, true);
    main = { role: 'main', ...m, mount: 'floor' };
    aux  = { role: 'aux',  ...a, mount: 'floor' };
    split = 'wall';
  } else if (prog === 'side') {
    // 侧向围坐:主家具沿侧墙铺开(占满进深),媒介墙正对切开面;辅区是贴着走道的那一条
    const farSide = big.x < path.x;                     // 主区在走道的哪一侧
    const mw = Math.max(0.9, big.w * 0.62);
    const mx = farSide ? big.x : big.x + big.w - mw;     // 主区推到离走道最远的那面墙
    main = { role: 'main', x: mx, z: big.z, w: mw, d: big.d, mount: 'floor' };
    aux  = { role: 'aux',  x: farSide ? big.x + mw : big.x, z: big.z, w: big.w - mw, d: big.d, mount: 'floor' };
    split = 'side';
  } else if (prog === 'nook' && flankable) {
    // 阅读角落:主区缩小 —— 两侧成块时,小的那块当主区,大的那块留给阅读辅区
    main = { role: 'main', ...small, mount: 'floor' };
    aux  = { role: 'aux',  ...big,   mount: 'floor' };
    split = 'nook-flank';
  } else if (prog === 'nook') {
    const [m, a] = stack(big, 0.42, false);             // 主区退到里侧且只占四成
    main = { role: 'main', ...m, mount: 'floor' };
    aux  = { role: 'aux',  ...a, mount: 'floor' };
    split = 'nook-stack';
  } else if (flankable) {
    // 会客朝向:通行居中,主辅分列两侧
    main = { role: 'main', ...big,   mount: 'floor' };
    aux  = { role: 'aux',  ...small, mount: 'floor' };
    split = 'flank';
  } else {
    const [m, a] = stack(big, 0.60, true);
    main = { role: 'main', ...m, mount: 'floor' };
    aux  = { role: 'aux',  ...a, mount: 'floor' };
    split = 'stack';
  }

  const roles = { window: window_, main, aux, walldec, path };
  ROLE_IDS.forEach(r => { roles[r].id = id + ':' + r; roles[r].area = +area(roles[r]).toFixed(2); });
  return {
    roles,
    list: ROLE_IDS.map(r => roles[r]),
    meta: { w, d, doorX: dx, program: prog, split, pathW: PATH_W, winBand: WIN_BAND, wallBand: WALL_BAND },
  };
}

/** 家具往哪面墙推 —— 布置程序换了,推的方向也跟着换(这是「区域角色换了」的一部分) */
export function pullFor(role, z) {
  const prog = z.meta.program;
  if (role === 'window') return { x: 0, z: 1 };
  if (role === 'walldec') return { x: 0, z: -1 };
  if (role === 'path') return { x: 0, z: 0 };
  const m = z.roles.main, p = z.roles.path;
  if (role === 'main') {
    if (prog === 'wall') return { x: 0, z: 1.6 };                     // 死贴窗墙
    if (prog === 'side') return { x: m.x < p.x ? -1.4 : 1.4, z: 0.2 };// 死贴侧墙
    if (prog === 'nook') return { x: 0, z: -0.8 };                    // 退到里侧
    return { x: 0, z: 1 };
  }
  if (prog === 'wall') return { x: 0, z: -1 };
  if (prog === 'side') return { x: 0, z: 0.6 };
  if (prog === 'nook') return { x: 0, z: 1.2 };                       // 阅读角贴窗,光才够
  return { x: 0, z: -1 };
}

/** 通行区是不是真的从门通到窗(人走得过去) —— 机器闸用这条判「留空」有没有失守 */
export function pathIsClear(z, items = []) {
  const p = z.roles.path;
  if (p.w < 1.0 - 1e-6) return { ok: false, why: `通行净宽 ${p.w.toFixed(2)}m < 1.00m` };
  if (p.d < z.meta.d - z.meta.winBand - z.meta.wallBand - 1e-6) return { ok: false, why: '通行没有从门连到窗墙' };
  // 5mm 容差:落位坐标做过三位小数取整,区域边界又是浮点数,
  // 不留这点容差会把「正好贴着走道边线」误判成「压住走道」(实测 3e-16 的误差就够翻车)
  const hit = items.filter(it => overlaps(it.box, p, 0.005));
  if (hit.length) return { ok: false, why: `${hit.length} 件家具压住了通行区: ${hit.slice(0, 3).map(h => h.kit).join('、')}` };
  return { ok: true, why: '门到窗通畅' };
}

export function overlaps(a, b, pad = 0) {
  return a.x < b.x + b.w - pad && a.x + a.w > b.x + pad && a.z < b.z + b.d - pad && a.z + a.d > b.z + pad;
}
export function inside(a, b, tol = 0.02) {
  return a.x >= b.x - tol && a.z >= b.z - tol && a.x + a.w <= b.x + b.w + tol && a.z + a.d <= b.z + b.d + tol;
}
