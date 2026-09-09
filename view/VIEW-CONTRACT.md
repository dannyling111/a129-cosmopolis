# CosmoPolis 渲染层 · 视觉大修 v2 数据契约

主席给的三张参考图的共同点（这就是要还原的东西）：
1. **每间房一个鲜艳的主色**（粉/黄/薄荷绿/天蓝/珊瑚红/紫），一眼扫过去像糖果盒，不是一片米灰
2. **细节密集**：墙上有画、有钟、有镜子；柜上有书有罐有花瓶；地上有地毯；窗上有帘有花箱
3. **家具是有形状的东西**，不是色块 —— 沙发有靠背有扶手有坐垫，床有床头有被子有枕头
4. **人真站在地板上**，有头发、有衣服、手脚分明，在做具体的事
5. **治愈系**：暖光、绿植多、圆角、饱和但不刺眼

渲染层【不做任何决策】：摆哪儿、谁坐哪、哪层放什么，全是 `engine/` 算好的。
本层只把数字变成好看的东西。**引擎数据一个字节都不许改。**

---

## 坐标与朝向（所有零件通用，违反就会穿模/浮空）

- 一件家具的 `THREE.Group` 原点 = **占地矩形中心的【地面】**，即 `y = 0` 就是地板。
- 家具向上长：所有子网格的 y 都 > 0，最高点 ≈ `kit.h`。
- **`+Z` 是这件家具的正面**（沙发的坐面朝 +Z，柜子的门朝 +Z）。旋转由外面处理，builder 不管。
- 宽度沿 `X`（= `kit.w`），进深沿 `Z`（= `kit.d`），高度沿 `Y`（= `kit.h`）。
- 尺寸必须【填满】给定的 w/d/h，不许比它小一大截（房间是按这个尺寸排的位）。

---

## 1. `view/props.mjs` —— 家具零件的多部件造型

```js
import * as THREE from '../vendor/three.module.js';

/**
 * @param {object} kit  {id, cn, cat, w, d, h, tags}
 * @param {object} o    {color, accent, wood, metal, rand}  // rand() 是可复算随机,必须只用它
 * @returns {THREE.Group}  原点在占地中心的地面,+Z 是正面
 */
export function buildProp(kit, o) { ... }
```

要求：
- **12 大类每类至少一个专门 builder**：`seat 座具 / table 桌案 / bed 睡眠 / storage 收纳 /
  cook 厨作 / bar 餐吧 / light 灯具 / textile 织物 / plant 绿植 / media 媒介 / arch 建筑`
  （第 12 类 `person` 不落地，不用管）
- **另外给 ≥25 个具体 id 单独做造型**（沙发/床/餐桌/书架/冰箱/灶台/咖啡机/电视/吊灯/地毯/大盆栽/窗/门…），
  其余同类零件走该大类的通用 builder。
- 每件至少 **3 个部件**（沙发 = 座箱 + 靠背 + 两个扶手 + 2-3 个坐垫 = 6+）。
- **必须有的小细节**（这是主席说的"细节"）：桌案要有四条腿（不是一个实心盒）、
  书架要有层板 + 一排彩色书脊、柜子要有把手、冰箱要有门缝线和把手、
  灶台要有 4 个灶眼、电视要有黑屏面 + 底座、盆栽要有花盆 + 分叉的叶子、
  地毯是一块贴地的薄板（高度 ≤0.03）、吊灯要有灯绳。
- 颜色用传进来的 `o.color`（主色）/`o.accent`（点缀）/`o.wood`/`o.metal`，
  **不要在文件里写死一堆颜色常量**——配色由 palette.mjs 决定，你只负责造型。
  唯一例外：黑屏、玻璃、金属这类物理上就该是那个颜色的小面可以写死。
- 只用 `THREE.BoxGeometry` / `CylinderGeometry` / `SphereGeometry` / `PlaneGeometry`，
  材质统一 `MeshLambertMaterial`（可加 `transparent` 做玻璃）。
- **材质必须缓存复用**（同色同参数只建一次），否则一栋楼几千个 mesh 会卡死手机。
  文件里自带一个 `mat(hex, opts)` 缓存函数。
- 导出一个 `PROP_BUILDERS` 对象（`{ [catOrKitId]: fn }`）方便别处查有没有专门造型。

---

## 2. `view/palette.mjs` —— 鲜艳配色与房间风格

```js
/** 48 个功能各自的房间风格。id 必须与 engine/functions.mjs 的 48 个 id 一一对应 */
export const ROOM_STYLES = {
  living: {
    wall:   0xffd9c0,   // 主墙色（鲜艳but不刺眼）
    accent: 0xff8a5c,   // 一面强调墙 / 点缀
    floor:  'wood',     // 'wood' | 'tile' | 'rug' | 'stone' | 'grass' | 'polish'
    floorA: 0xd9a066, floorB: 0xc98f52,   // 地板两色（做条纹/棋盘）
    trim:   0xfff6ea,   // 踢脚线/窗框
    mood:   'warm',     // 'warm' | 'cool' | 'fresh' | 'neon' | 'soft'
  },
  ...48 条
};

/** 12 大类各一组鲜艳配色,每组 ≥5 色,同类零件从里面按种子取,于是同类之间也不重样 */
export const CAT_PALETTE = { seat: [0x0,0x0], table:[], bed:[], storage:[], cook:[], bar:[], light:[], textile:[], plant:[], media:[], arch:[], person:[] };

export const WOOD = [];   // 木色档（3-5 档）
export const METAL = [];  // 金属档
export function styleOf(fnId){}       // 取不到时给一个安全默认,不许 undefined
export function propColors(kit, rand){}  // → {color, accent, wood, metal}
```

要求：
- **48 条风格必须互相不同**，同族之间也要能一眼分开（主卧 vs 客房 vs 儿童房）。
- 颜色要【鲜艳】：主墙色饱和度别低到发灰；参考图里粉、薄荷、鹅黄、天蓝、珊瑚是主力。
- 但要【治愈】不刺眼：墙色偏浅（明度高），强调色才浓。
- 地面材质按功能选：住宅木地板、厨卫瓷砖、店铺抛光、屋顶花园草地、工坊水泥。
- 全中文注释，ES module，**不许 import 任何东西**（palette 是纯数据）。

---

## 3. 谁负责什么（别越界）

| 文件 | 归谁 | 管什么 |
|---|---|---|
| `view/props.mjs` | 架构师 A | 家具造型（多部件几何） |
| `view/palette.mjs` | 架构师 B | 鲜艳配色 + 48 房间风格 |
| `view/render3d.mjs` | 数字分身 | 人物骨架/站地面、房间壳体、墙面地面、环境、集成 |
| `engine/**` | 谁都别动 | 引擎数据这一轮一个字节不改 |
