// ============================================================
// 🎨 textures.mjs —— 用 canvas 现画贴图(地板木纹/瓷砖/地毯/墙纸/书脊)
//
// 为什么用贴图而不是多摆几百个小方块:主席要"细节要多",但手机上几千个 mesh 会卡死。
// 一张 128×128 的 canvas 贴图 = 一个 mesh 就能有木地板的一条条缝、瓷砖的格、地毯的花,
// 这是"细节密度 ÷ 性能开销"最划算的一档。
// 所有贴图都缓存,同参数只画一次。
// ============================================================
import * as THREE from '../vendor/three.module.js';

const CACHE = new Map();
const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

function make(key, w, h, draw, repeat = [1, 1]) {
  const k = key + '|' + repeat.join(',');
  if (CACHE.has(k)) return CACHE.get(k);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  CACHE.set(k, t);
  return t;
}

const jitter = (ctx, w, h, n, alpha) => {           // 撒一层细噪点,免得大色块显得死板
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
};

/** 地板:木纹 / 瓷砖 / 地毯 / 石材 / 草地 / 抛光 */
export function floorTexture(kind, a, b, meters = 4) {
  const rep = Math.max(1, Math.round(meters / 1.2));
  return make(`floor:${kind}:${a}:${b}`, 128, 128, (c, w, h) => {
    c.fillStyle = hex(a); c.fillRect(0, 0, w, h);
    if (kind === 'wood') {
      for (let i = 0; i < 6; i++) {                 // 六条地板,缝里加深色线
        const y = i * (h / 6);
        c.fillStyle = i % 2 ? hex(b) : hex(a);
        c.fillRect(0, y, w, h / 6 - 1);
        c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, y + h / 6 - 1.5, w, 1.5);
        c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 1;   // 木纹
        for (let j = 0; j < 3; j++) {
          c.beginPath(); c.moveTo(0, y + 3 + j * 6); c.bezierCurveTo(w / 3, y + 2 + j * 6, w * .7, y + 7 + j * 6, w, y + 4 + j * 6); c.stroke();
        }
      }
    } else if (kind === 'tile') {
      const n = 4, s = w / n;                        // 瓷砖棋盘 + 砖缝
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 ? hex(b) : hex(a);
        c.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
      }
      c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2;
      for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
    } else if (kind === 'rug') {
      c.fillStyle = hex(b); c.fillRect(0, 0, w, h);  // 地毯:同心方框花纹
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = i % 2 ? hex(a) : 'rgba(255,255,255,.5)';
        c.lineWidth = 5; c.strokeRect(10 + i * 14, 10 + i * 14, w - 20 - i * 28, h - 20 - i * 28);
      }
      jitter(c, w, h, 900, .10);
    } else if (kind === 'grass') {
      c.fillStyle = hex(a); c.fillRect(0, 0, w, h);  // 草地:一撮撮草
      for (let i = 0; i < 700; i++) {
        c.strokeStyle = Math.random() > .5 ? hex(b) : 'rgba(255,255,255,.25)';
        c.lineWidth = 1.2; const x = Math.random() * w, y = Math.random() * h;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - .5) * 3, y - 3 - Math.random() * 3); c.stroke();
      }
    } else if (kind === 'stone') {
      for (let i = 0; i < 26; i++) {                 // 水磨石:大小不一的碎石
        c.fillStyle = i % 3 ? hex(b) : 'rgba(255,255,255,.55)';
        c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 7, 2 + Math.random() * 5, Math.random() * 3, 0, 7); c.fill();
      }
      jitter(c, w, h, 600, .12);
    } else {                                          // polish 抛光:大格 + 高光斜条
      const n = 2, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 ? hex(b) : hex(a); c.fillRect(i * s, j * s, s, s);
      }
      c.globalAlpha = .18; c.fillStyle = '#ffffff';
      for (let i = -2; i < 6; i++) { c.save(); c.translate(i * 34, 0); c.rotate(.5); c.fillRect(0, -40, 9, 220); c.restore(); }
      c.globalAlpha = 1;
    }
    jitter(c, w, h, 260, .06);
  }, [rep, rep]);
}

/** 墙面:细竖条纹 / 小圆点 / 素色,都带一点点噪点,免得像塑料 */
export function wallTexture(base, kind = 'plain', accent = base) {
  return make(`wall:${kind}:${base}:${accent}`, 96, 96, (c, w, h) => {
    c.fillStyle = hex(base); c.fillRect(0, 0, w, h);
    if (kind === 'stripe') {
      c.fillStyle = 'rgba(255,255,255,.30)';
      for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 6, h);
    } else if (kind === 'dot') {
      c.fillStyle = 'rgba(255,255,255,.42)';
      for (let y = 8; y < h; y += 20) for (let x = 8; x < w; x += 20)
        { c.beginPath(); c.arc(x + (y / 20 % 2) * 10, y, 2.6, 0, 7); c.fill(); }
    } else if (kind === 'grid') {
      c.strokeStyle = 'rgba(0,0,0,.10)'; c.lineWidth = 1;
      for (let i = 0; i <= 96; i += 24) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    }
    jitter(c, w, h, 200, .05);
  }, [2, 2]);
}

/** 一面墙上的画/照片墙 —— 画在一张贴图上,一个 mesh 顶十几个小方块 */
export function artTexture(seed = 1, base = 0xfff6ea) {
  return make(`art:${seed}:${base}`, 128, 96, (c, w, h) => {
    c.fillStyle = hex(base); c.fillRect(0, 0, w, h);
    const cols = ['#ff8a5c', '#4fb0c6', '#f7c948', '#7bc47f', '#e86a92', '#6a7fdb', '#b07ce8'];
    let s = seed * 9301 % 233280;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 5; i++) {                    // 五个画框,里面随机一个小图案
      const fw = 18 + rnd() * 26, fh = 16 + rnd() * 24;
      const x = 6 + rnd() * (w - fw - 12), y = 6 + rnd() * (h - fh - 12);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 2, y + 2, fw, fh);
      c.fillStyle = '#fffdf8'; c.fillRect(x, y, fw, fh);
      c.fillStyle = cols[(i + seed) % cols.length];
      c.fillRect(x + 3, y + 3, fw - 6, fh - 6);
      c.fillStyle = 'rgba(255,255,255,.65)';
      if (i % 3 === 0) { c.beginPath(); c.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) / 4, 0, 7); c.fill(); }
      else if (i % 3 === 1) { c.fillRect(x + 5, y + fh * .55, fw - 10, fh * .3); }
      else { c.beginPath(); c.moveTo(x + 4, y + fh - 4); c.lineTo(x + fw / 2, y + 5); c.lineTo(x + fw - 4, y + fh - 4); c.fill(); }
    }
  }, [1, 1]);
}

/** 天空:蓝天 + 白云(参考图里都是大晴天) */
export function skyTexture() {
  return make('sky', 256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#4fa8e8'); g.addColorStop(.55, '#9fd4f5'); g.addColorStop(1, '#e8f6ff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.92)';
    for (let i = 0; i < 9; i++) {                    // 一朵云 = 几个叠起来的圆
      const x = Math.random() * w, y = 20 + Math.random() * h * .5, r = 10 + Math.random() * 16;
      for (let j = 0; j < 5; j++) {
        c.beginPath(); c.arc(x + j * r * .7 - r, y + Math.sin(j) * r * .25, r * (.6 + Math.random() * .5), 0, 7); c.fill();
      }
    }
  }, [1, 1]);
}
