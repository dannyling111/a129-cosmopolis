// ============================================================
// 🗺️ plan2d.mjs —— 平面图:点一块区域,看这一块允许什么、人在里面干什么
// 指引原话:「点平面上的区域,看这一块允许什么、人物在里面干什么。」
// 它和三维是【同一份数据的两个投影】,不是另画一张图。
// ============================================================
import { ZONE_COLOR } from './render3d.mjs';
import { ROLE_CN } from '../engine/zones.mjs';

const hex = n => '#' + n.toString(16).padStart(6, '0');

export function drawPlan(canvas, plan, sel = null) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 320, cssH = canvas.clientHeight || 240;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = 14;
  const s = Math.min((cssW - pad * 2) / plan.w, (cssH - pad * 2) / plan.d);
  const ox = (cssW - plan.w * s) / 2, oy = (cssH - plan.d * s) / 2;
  // 屏幕 y 反过来:z 越大(越靠窗)画得越靠上
  const X = x => ox + x * s, Y = z => oy + (plan.d - z) * s;

  ctx.fillStyle = '#f6f1e6'; ctx.fillRect(X(0), Y(plan.d), plan.w * s, plan.d * s);

  plan.zones.list.forEach(z => {
    const on = sel === z.role;
    ctx.fillStyle = hex(ZONE_COLOR[z.role]);
    ctx.globalAlpha = on ? 0.55 : 0.24;
    ctx.fillRect(X(z.x), Y(z.z + z.d), z.w * s, z.d * s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = on ? '#16130f' : 'rgba(22,19,15,.30)';
    ctx.lineWidth = on ? 2.2 : 1;
    ctx.strokeRect(X(z.x), Y(z.z + z.d), z.w * s, z.d * s);
    if (z.w * s > 46 && z.d * s > 22) {
      ctx.fillStyle = '#2a241d'; ctx.font = `600 ${Math.min(13, s * 0.42)}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ROLE_CN[z.role], X(z.x + z.w / 2), Y(z.z + z.d / 2));
    }
  });

  plan.items.forEach(it => {
    if (it.mount === 'wall') return;
    ctx.fillStyle = 'rgba(30,26,20,.62)';
    ctx.fillRect(X(it.box.x), Y(it.box.z + it.box.d), it.box.w * s, it.box.d * s);
  });
  plan.seats.forEach(p => {
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.z), Math.max(2.5, s * 0.10), 0, 7);
    ctx.fillStyle = '#0f7f7c'; ctx.fill();
  });

  // 门口
  ctx.fillStyle = '#16130f';
  ctx.fillRect(X(plan.doorX - 0.5), Y(0) - 3, 1.0 * s, 5);

  canvas.__hit = { X, Y, s, ox, oy, plan };
  return { X, Y, s };
}

/** 屏幕坐标 → 命中哪个区域(手指点的是它自己,不是隔壁) */
export function hitZone(canvas, clientX, clientY) {
  const h = canvas.__hit; if (!h) return null;
  const r = canvas.getBoundingClientRect();
  const px = clientX - r.left, py = clientY - r.top;
  const x = (px - h.ox) / h.s;
  const z = h.plan.d - (py - h.oy) / h.s;
  // 通行区最后判:它和主辅区不重叠,但让实心块优先命中更符合手指直觉
  const order = ['window', 'main', 'aux', 'path', 'walldec'];
  for (const role of order) {
    const zn = h.plan.zones.roles[role];
    if (x >= zn.x && x <= zn.x + zn.w && z >= zn.z && z <= zn.z + zn.d) return role;
  }
  return null;
}
