// ============================================================
// 🌐 live_check.mjs —— 线上到底是不是【我们这一份】,不看状态码
//
// 🔴 这个文件是为了修我自己制造的一次假绿(2026-09-09 实测):
//    我用「HTTP 200 就算上线了」当判据等了两轮,结果
//    https://dannyling111.github.io/a129-cosmopolis/studio.html 确实回 200 ——
//    但内容是【另一个叫 NEXORA 的项目的 SPA 兜底页】。
//    原因:用户级 Pages 站点(dannyling111.github.io)会对任何未命中的路径回一个 200 的兜底页,
//    所以在这个域名下,【状态码根本不是"上线了"的证据】。
//
//    判据必须改成【逐字节和本地那一份比对】:一致才算上线。
//
// 用法: node tests/live_check.mjs <线上根URL> <本地目录> [文件1 文件2 ...]
//   例: node tests/live_check.mjs https://dannyling111.github.io/A129/cosmopolis /path/to/cosmopolis
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [base, dir, ...only] = process.argv.slice(2);
if (!base || !dir) { console.log('用法: node tests/live_check.mjs <线上根URL> <本地目录> [文件...]'); process.exit(1); }

const FILES = only.length ? only : [
  'index.html', 'studio.html', 'style.css',
  'engine/index.mjs', 'engine/kits.mjs', 'engine/functions.mjs', 'engine/people.mjs',
  'engine/city.mjs', 'engine/zones.mjs', 'engine/room.mjs', 'engine/building.mjs',
  'engine/actors.mjs', 'engine/rng.mjs',
  'view/app.mjs', 'view/render3d.mjs', 'view/plan2d.mjs',
];

let same = 0, diff = 0, missing = 0;
for (const f of FILES) {
  const lp = join(dir, f);
  if (!existsSync(lp)) { console.log(`  ⚪ ${f} 本地没有,跳过`); continue; }
  const local = readFileSync(lp);
  let body;
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/${f}?cb=${Math.random()}`, { headers: { 'Cache-Control': 'no-cache' } });
    body = Buffer.from(await r.arrayBuffer());
    if (!r.ok) { console.log(`  ❌ ${f} HTTP ${r.status}`); diff++; continue; }
  } catch (e) { console.log(`  ❌ ${f} 取不到:${e.message}`); missing++; continue; }
  if (body.equals(local)) { same++; console.log(`  ✅ ${f}`); }
  else {
    diff++;
    const head = body.toString('utf8', 0, 200).replace(/\s+/g, ' ');
    const looksLikeFallback = /<title>(?!.*CosmoPolis)/i.test(head) || body.length < local.length * 0.3;
    console.log(`  ❌ ${f} 内容对不上(线上 ${body.length}B / 本地 ${local.length}B)` +
                (looksLikeFallback ? ' ← 像是站点兜底页,不是我们的文件' : ''));
  }
}
console.log(`\n━━━ 逐字节:一致 ${same} / 不一致 ${diff} / 取不到 ${missing} ━━━`);
if (diff || missing) { console.log('🔴 线上不是这一份,别说已上线'); process.exit(2); }
console.log('🟢 线上就是本地这一份');
