// ============================================================
// 🦶 ground_check.mjs —— 人到底有没有踩在地板上
//
// 🔴 主席一眼看出来的:「你现在的人物都是浮在空中的,并没有走在地板上」。
//    他是对的,而且能算出准确数字:老骨架把胯放在 0.86,腿只有 0.42 长 → 脚底停在 +0.44m。
//    整套引擎判据(240 间房逐间体检)全绿,因为它们判的是【家具落位】,
//    没有一条在看【人的脚在哪】—— 判据没覆盖到的地方,绿灯不代表对。
//
// 用法: node tests/ground_check.mjs      退出码 2 = 有人在飘
// ============================================================
import * as THREE from '../vendor/three.module.js';
import { buildFigure, poseFigure, SEAT_Y } from '../view/figure.mjs';

let fail = 0, pass = 0;
const ok = (c, n, e = '') => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (e ? ' — ' + e : '')); } };
const footY = (g) => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).min.y; };

console.log('【1】六种姿态,脚底必须贴地(容差 6cm)');
const BODIES = ['stand', 'walk', 'sit_soft', 'sit_up', 'sit_high', 'lie'];
BODIES.forEach(b => {
  let worst = 0;
  for (let i = 0; i < 24; i++) {                       // 24 个不同的人 × 走路相位
    const g = buildFigure(i * 7 + 1);
    poseFigure(g, b, i * 0.37);
    worst = Math.max(worst, Math.abs(footY(g)));
  }
  ok(worst <= 0.06, `${b}:24 个人最差脚底偏移 ${worst.toFixed(3)}m`, worst.toFixed(3));
});

console.log('\n【2】任意坐面高度都要坐得下(座具从矮蒲团到高吧凳)');
{
  let worst = 0, bad = [];
  for (let P = 0.30; P <= 0.88; P += 0.02) {
    ['sit_soft', 'sit_up', 'sit_high'].forEach(b => {
      const g = buildFigure(5); poseFigure(g, b, 0, { seatY: +P.toFixed(2) });
      const d = Math.abs(footY(g));
      if (d > 0.06) bad.push(`${b}@${P.toFixed(2)}=${d.toFixed(2)}`);
      worst = Math.max(worst, d);
    });
  }
  ok(bad.length === 0, `坐面 0.30–0.88m 全程脚踩地(最差 ${worst.toFixed(3)}m)`, bad.slice(0, 4).join(' '));
}

console.log('\n【3】身高与比例合理(不是压扁的方块人)');
{
  const g = buildFigure(2); poseFigure(g, 'stand', 0); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  const h = bb.max.y - bb.min.y;
  ok(h > 1.55 && h < 1.85, `站立身高 ${h.toFixed(2)}m 在 1.55–1.85 之间`);
  let n = 0; g.traverse(o => { if (o.isMesh) n++; });
  ok(n >= 18, `一个人由 ${n} 个部件组成(头/发/眼/躯干/两条三段腿/两条三段臂)`, String(n));
}

console.log('\n【4】🔴 变红证明:把老的坏骨架喂进来,判据必须判红');
{
  // 老骨架的形状:胯放 0.86,腿只有 0.42 —— 用一个等价的假人复现它
  const fake = new THREE.Group();
  const hip = new THREE.Group(); hip.position.y = 0.86; fake.add(hip);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.2), new THREE.MeshBasicMaterial());
  torso.position.y = 0.26; hip.add(torso);
  [-1, 1].forEach(sx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.14), new THREE.MeshBasicMaterial());
    leg.position.set(sx * 0.09, -0.21, 0); hip.add(leg);
  });
  const y = footY(fake);
  ok(Math.abs(y) > 0.06, `负控:老骨架(胯0.86/腿0.42)脚底 ${y.toFixed(3)}m → 必须判红`, y.toFixed(3));

  // 正控:新骨架同样量法必须判绿
  const good = buildFigure(11); poseFigure(good, 'stand', 0);
  const y2 = footY(good);
  ok(Math.abs(y2) <= 0.06, `正控:新骨架脚底 ${y2.toFixed(3)}m → 必须判绿`, y2.toFixed(3));

  // 负控2:把坐姿的坐面高度硬设成一个骨架够不着的数(1.4m),判据必须判红
  const g3 = buildFigure(3); poseFigure(g3, 'sit_up', 0, { seatY: 1.4 });
  ok(Math.abs(footY(g3)) > 0.06, `负控:坐面 1.4m(腿根本够不着)→ 必须判红`, footY(g3).toFixed(3));
}

console.log(`\n━━━ 结果:${pass} 条通过 / ${fail} 条失败 ━━━`);
if (fail) { console.log('🔴 有人在飘,禁止上线'); process.exit(2); }
console.log('🟢 人都站在地板上');
