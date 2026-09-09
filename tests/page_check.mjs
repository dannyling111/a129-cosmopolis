// ============================================================
// 📱 page_check.mjs —— 真浏览器 + 真手机尺寸 + 真触摸的验收
// 判据不是「按钮存在」,是【手指按在按钮中心,命中的是不是它自己】(Rule-MOBILE-001)。
// 用法: node tests/page_check.mjs [URL]
// ============================================================
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
// playwright 装在全局(/opt/node22/lib/node_modules),仓库里没有 node_modules,所以按绝对路径取
const { chromium } = require_(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');

const URL = process.argv[2] || 'http://127.0.0.1:8099/cosmopolis/studio.html';
const DEVICES = [
  { name: 'iPhone 12 · 390×844', w: 390, h: 844 },
  { name: '小屏安卓 · 360×740', w: 360, h: 740 },
];
let fail = 0, pass = 0;
const ok = (c, n, e = '') => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (e ? ' — ' + e : '')); } };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

for (const dev of DEVICES) {
  console.log('\n━━━ ' + dev.name + ' ━━━');
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);

  // 🔴 诚实边界:本容器的出网被代理挡着,谷歌字体一定连不上(ERR_CONNECTION_RESET)。
  // 这是【环境限制】不是页面缺陷 —— 所以把它单独列出来放行,而不是悄悄把判据放宽。
  // 字体连不上时页面回退到系统字体,功能一个不少;真机上有网则正常加载。
  const fontErr = errs.filter(e => /fonts\.(googleapis|gstatic)\.com|ERR_CONNECTION_RESET/.test(e));
  const realErr = errs.filter(e => !fontErr.includes(e));
  if (fontErr.length) console.log(`  🟦 已放行 ${fontErr.length} 条外网字体加载失败(容器无外网,真机不受影响)`);
  ok(realErr.length === 0, '零控制台报错(字体外链除外)', realErr.slice(0, 2).join(' | '));

  const st = await page.evaluate(() => {
    const B = window.__COSMO__ && window.__COSMO__.building;
    return B ? { rooms: B.stats.rooms, items: B.stats.items, actors: B.stats.actors, fns: B.stats.distinctFn,
                 blocked: B.stats.blockedPaths, city: window.__COSMO__.auditCity(B).ok } : null;
  });
  ok(!!st, '引擎在页面里真跑起来了(window.__COSMO__.building 有数据)');
  if (st) {
    ok(st.rooms >= 6, `抽出了 ${st.rooms} 间房`);
    ok(st.items >= 30, `摆了 ${st.items} 件套件`);
    ok(st.actors >= 5, `长出了 ${st.actors} 个人`);
    ok(st.blocked === 0, '没有一间房的通行区被堵住');
    ok(st.city === true, '社区规则在页面里也是全绿');
  }

  // 画面不是黑的 / 不是白的
  const buf = await page.screenshot();
  const png = buf.length;
  ok(png > 25000, '画面有内容(截图 ' + (png / 1024 | 0) + ' KB,黑屏白屏会小得多)');

  // 触摸目标:每个按钮 ≥44px 且【中心点命中它自己】
  const btns = await page.$$('button');
  let small = [], stolen = [];
  for (const b of btns) {
    const box = await b.boundingBox(); if (!box) continue;
    if (box.width < 44 || box.height < 44) small.push(await b.evaluate(e => e.id || e.textContent.trim().slice(0, 6)) + ` ${box.width | 0}×${box.height | 0}`);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.closest('button') ? (el.closest('button').id || el.closest('button').textContent.trim().slice(0, 6)) : 'NOT_A_BUTTON:' + el.tagName) : 'NOTHING';
    }, [cx, cy]);
    const self = await b.evaluate(e => e.id || e.textContent.trim().slice(0, 6));
    if (hit !== self) stolen.push(`${self} 被 ${hit} 挡住`);
  }
  ok(small.length === 0, `${btns.length} 个按钮全部 ≥44px`, small.join('、'));
  ok(stolen.length === 0, '每个按钮按下去命中的是它自己(没被别的东西盖住)', stolen.join('、'));

  // 按下态的按钮不许「浅底浅字」——按下去字就没了等于按钮消失
  const invisible = await page.evaluate(() => {
    const lum = c => { const m = c.match(/\d+/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    return [...document.querySelectorAll('button')].filter(b => {
      const s = getComputedStyle(b);
      return Math.abs(lum(s.color) - lum(s.backgroundColor)) < 60;
    }).map(b => (b.id || b.textContent.trim().slice(0, 4)));
  });
  ok(invisible.length === 0, '每个按钮的字都看得见(前景背景对比够)', invisible.join('、'));

  // 无横向溢出
  const of = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(of <= 1, '没有横向溢出', of + 'px');

  // 界面上不许出现键鼠话术
  const bad = await page.evaluate(() => {
    const t = document.body.innerText;
    return ['鼠标', '右键', '单击左键', 'WASD', '按 J', '键盘', '滚轮'].filter(w => t.includes(w));
  });
  ok(bad.length === 0, '界面上没有键鼠话术', bad.join('、'));

  // 真触摸:点一间房 → 面板必须换成那间房的内容
  const before = await page.evaluate(() => document.querySelector('#hudPick').textContent);
  // 点【舞台正中】,不是拍脑袋的一个 y 坐标 —— 换个取景楼就挪位置了,写死坐标的测试会假绿
  const sb = await (await page.$('.stage')).boundingBox();
  await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height * 0.55);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => document.querySelector('#hudPick').textContent);
  ok(before !== after, '手指点一间房 → 真的选中了(HUD 变了)', `${before} → ${after}`);

  // 真触摸:切到「区域」页签,平面图必须画出来
  const tabZone = await page.$('button[data-tab="zone"]');
  const tb = await tabZone.boundingBox();
  await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.waitForTimeout(500);
  const planOK = await page.evaluate(() => {
    const c = document.querySelector('#plan');
    if (!c) return false;
    const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0; for (let i = 0; i < g.length; i += 4 * 97) if (g[i + 3] > 10) ink++;
    return ink > 50;
  });
  ok(planOK, '「区域」页里平面图真的画出来了(不是空 canvas)');

  await ctx.close();
}
await browser.close();
console.log(`\n━━━ 结果:${pass} 条通过 / ${fail} 条失败 ━━━`);
if (fail) { console.log('🔴 手机上用不了,禁止上线'); process.exit(2); }
console.log('🟢 手机上可用');
