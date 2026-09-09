// ============================================================
// 🎲 rng.mjs —— 稳定随机(整座城的唯一随机源)
// 规矩:一切随机由 (seed, 用途字符串) 决定 —— 同一个种子永远长出同一座城,
// 换种子才是另一座城。绝不用 Math.random(),否则每次刷新都变、没法复算也没法验收。
//
// 🔴 撞衫说明(为什么不 import 仓库里现成的那份):
//   A129 里已经有一份 PRNG 真源 —— storyforge/src/story-engine.js 的 makeRng/hashSeed,
//   talkforge/src/core/rng.js 就是薄壳包着它。理想情况我该直接 import 它。
//   不这么做的唯一原因是【交付形态】:CosmoPolis 同时活在两个仓库里 ——
//   A129 的 web/terminal/cosmopolis/,以及独立仓库 dannyling111/a129-cosmopolis(GitHub Pages 直接发根目录)。
//   独立仓库里没有 storyforge,跨仓库 import 会让线上页面当场白屏。
//   所以这里保留一份 40 行的本地实现,并反过来把整台引擎封装成 capsule(engine/index.mjs),
//   让【别人 import cosmopolis】,而不是 cosmopolis 去 import 别人 —— 复用方向反过来走。
//   代价是这一份 mulberry32 与 storyforge 那份是两条独立的数列,两边的种子不可互换。
// ============================================================

/** 把任意字符串折成一个 32 位整数(同样的字符串永远同样的数) */
export function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 造一个随机器:同 seed + 同 salt = 同一串数 */
export function makeRng(seed, salt = '') {
  let a = (strHash(String(seed) + '|' + salt) + 0x9e3779b9) >>> 0;
  const next = () => {                       // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    f: next,                                                   // [0,1)
    range: (lo, hi) => lo + next() * (hi - lo),                 // 浮点区间
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),   // 整数闭区间
    /** n 可以写整数,也可以写 [min,max] —— 契约里的件数就是这么写的 */
    count: (n) => (Array.isArray(n) ? r.int(n[0], n[1]) : n | 0),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
      return a2;
    },
    /** 不重复地抽 k 个;不够就有多少给多少(不复读同一件) */
    sample: (arr, k) => r.shuffle(arr).slice(0, Math.max(0, Math.min(k, arr.length))),
  };
  return r;
}
