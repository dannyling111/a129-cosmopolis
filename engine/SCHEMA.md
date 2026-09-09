# CosmoPolis 量化引擎 · 数据契约 v1（唯一权威源，改这里才准改数据）

引擎五层（不许跳级）：**社区 → 功能 → 区域 → 套件 → 人物**。
本文件锁死每层的数据形状；`engine/*.mjs` 只准按此形状写，`tests/engine_check.mjs` 按此形状机器判。

---

## 0. 固定词表（不许自造，两份数据必须用同一套 id）

### 0.1 区域角色 ZONE_ROLES（恰好 5 个）
| id | 中文 | 干什么 |
|---|---|---|
| `window` | 窗墙 | 贴外窗那一条，采光与对外表情 |
| `main`   | 主区 | 这间房的主事件（围坐/睡/进食/主操作） |
| `aux`    | 辅区 | 次要事件（阅读角/操作带/收纳带） |
| `walldec`| 墙装 | 内墙那一面，只挂不占地 |
| `path`   | 通行 | 必须留空，人只走这里 |

### 0.2 套件大类 KIT_CATS（恰好 12 个，**照抄工作指引的原名，不许自造**）
| id | 中文 | 指引里的零件示例 | 可落地 |
|---|---|---|---|
| `seat` | 座具 | 三人沙发/双人/贵妃榻/扶手椅/翼椅/餐椅/吧凳/长凳/蒲团/摇椅/办公椅/地垫坐 | ✅ |
| `table` | 桌案 | 茶几/餐桌/书桌/玄关几/边几/吧台面/岛台/折叠桌/梳妆台/野餐桌 | ✅ |
| `bed` | 睡眠 | 双人床/单人/上下铺/坐卧榻/婴儿床/床头柜/床屏/吊床 | ✅ |
| `storage` | 收纳 | 衣柜/层架/通高书墙/边柜/箱/板条箱/挂杆/鞋架/洞洞板/边橱 | ✅ |
| `cook` | 厨作 | 冰箱/灶/烤箱/水槽/操作台/烟罩/调料架/砧板台/挂锅/洗碗机门 | ✅ |
| `bar` | 餐吧 | 吧身/咖啡机/点心柜/面包架/黑板/收银/酒龙头/冷柜/菜单牌/蛋糕座 | ✅ |
| `light` | 灯具 | 吊灯/落地灯/台灯/壁灯/串灯/霓虹/烛簇/天光洗/书桌灯/纸灯 | ✅ |
| `textile` | 织物 | 地毯/帘/靠垫/披毯/床品/帐/桌布/挂旗/垫/纱 | ✅ |
| `plant` | 绿植 | 高株/灌木/垂盆/窗箱/花瓶/香草盆/小树/苔墙/多肉盘/花环 | ✅ |
| `media` | 媒介 | 电视/唱机/音箱/投影/画/照片墙/钟/镜/灯牌/黑板 | ✅ |
| `arch` | 建筑 | 窗/门/栏杆/柱/拱/百叶/阳台板/天窗/线脚/隔断 | ✅ |
| `person` | 人物 | 坐沙发/坐椅/坐凳/走/烹/侍/读/谈/望窗/睡沿/孩玩/猫 | ❌ 动作库 |

🔴 **第 12 类 `person` 是故意的**：工作指引把「人物」列为 12 大类之一，正是那句
「人物是套件，不是装饰」的字面落实 —— 它的「零件」是 12 个**动作**，由第 4 层消费，
不落地、不占位。它在 `KITS` 里用 `placeable:false` 标记，排房时跳过。

### 0.3 功能族 FN_FAMILIES（恰好 6 个，**照抄工作指引**）
`dwell` 住 / `make` 作 / `cook` 食 / `shop` 市 / `gather` 聚 / `service` 服
（`cook` 既是族 id 也是套件大类 id，两个命名空间不冲突；照指引原样保留，不改名。）

### 0.4 层带 BANDS（恰好 4 个）
`ground` 地面 / `mid` 中层 / `top` 顶层 / `roof` 屋顶

### 0.5 身体姿态 BODIES（恰好 6 个）
`sit_soft` 沉进沙发 / `sit_up` 端坐（餐椅/书桌椅，腿成 L）/ `sit_high` 高凳垂腿 /
`lie` 躺 / `stand` 站 / `walk` 走

### 0.6 布置程序 PROGRAMS（恰好 4 个，**照抄工作指引**）
| id | 名称 | 指引原话 |
|---|---|---|
| `face` | 会客朝向 | 沙发对切开面，茶几在前，阅读椅在侧 |
| `wall` | 靠墙沙发 | 沙发贴窗墙，围坐退到房间深处 |
| `side` | 侧向围坐 | 沙发沿侧墙，媒介墙正对切开面 |
| `nook` | 阅读角落 | 主区缩小，阅读椅和灯变成主角 |

布置程序**只改区域角色的几何**（哪块当主区、多大、往哪面墙推），
**绝不改零件尺寸**——这是「换布置程序，区域角色换了，零件语法不变」的机器含义。

---

## 1. `kits.mjs` —— 套件库（12 大类 × 零件）

```js
export const KIT_CATS = [
  { id:'seat', cn:'座具', desc:'一句话：这类零件是干什么的',
    zones:['main','aux'],          // 这一大类允许落在哪些区域角色（子集，来自 0.1）
    floor:true }                   // true=占地；false=挂墙（挂墙类只准进 walldec/window）
];

export const KITS = [
  { id:'sofa_l', cn:'L 型沙发', cat:'seat',
    w:2.40, d:1.60, h:0.75,        // 米。真实家具尺寸，不许写 1/1/1 占位
    zones:['main'],                // 更窄的限制（必须是所属大类 zones 的子集）
    fn:['living','lounge'],        // 只在这些功能里出现；写 [] = 该大类允许的功能都可以
    seats:[ {dx:-0.55, dz:0.30, dir:180, body:'sit_soft'} ],  // 座位口袋：相对零件中心的米偏移 + 朝向角度 + 姿态
    tags:['soft'] }                // 自由标签，可空
];
```

硬要求（机器检查）：
- `KIT_CATS.length === 12` 且 id 与 0.2 完全一致（顺序也照它）。
- `KITS.length >= 120`；11 个可落地大类每类 **≥ 10** 件；`person` 恰好 12 个动作。
- `person` 大类的条目形状不同：`{ id, cn, cat:'person', body, needs }`，
  `needs` ∈ `seat|bed|bar|cook|path|window|null`（这个动作需要现场有什么才成立）。
- 每件 `w/d/h` 都在 (0.05, 6.0] 米之间，且是**可信真实尺寸**（沙发别写 0.3m 宽）。
- `cat` 必须在 0.2 里；`zones` 必须是该 cat 的 `zones` 子集且非空。
- 凡 `cat` 属于 `seat`/`bed` 的零件，`seats` 必须非空（人要从家具口袋里长出来）。
- `seats[].body` 必须在 0.5 里；`dir` 取 0/90/180/270 之一。
- `floor:false` 的大类（`art` 必然是，`light` 里的壁灯用零件级 `wall:true` 标）其零件不参与占地。

---

## 2. `functions.mjs` —— 48 功能（6 族 × 8）

```js
export const FUNCTIONS = [
  { id:'living', cn:'客厅', fam:'live',
    bands:['mid','top'],            // 允许出现在哪些层带（0.4 子集）
    area:[16, 34],                  // 合理面积区间 ㎡
    zones:{                         // 区域程序：每个区域角色要什么大类、要几件
      window : [ {cat:'plant', n:[0,2]}, {cat:'soft', n:1} ],
      main   : [ {cat:'seat', n:[2,3]}, {cat:'table', n:1} ],
      aux    : [ {cat:'seat', n:1}, {cat:'light', n:1} ],
      walldec: [ {cat:'device', n:[0,1]}, {cat:'art', n:1} ],
      path   : [ {cat:'plant', n:[0,1]} ]
    },
    people:'living',                // 指向 people.mjs 的脚本 id
    public:false,                   // 是否对外（临街店面类为 true）
    desc:'一句话：这一格干什么' }
];
```

硬要求：
- `FUNCTIONS.length === 48`，每族恰好 **8** 个。
- **48 个功能名必须逐字照抄工作指引**（下表 `cn` 列），id 用对应英文小写：

| 族 | 8 个功能（cn ← 指引原文） |
|---|---|
| `dwell` 住 | 起居客厅 `living` · 会客沙龙 `salon` · 家庭餐厅 `dining` · 主卧 `bedroom` · 儿童房 `kidroom` · 婴儿房 `nursery` · 客房 `guestroom` · 梳妆更衣 `vanity` |
| `make` 作 | 书房 `study` · 墙到墙书库 `library` · 共工位 `coworking` · 音乐室 `music` · 画室 `atelier` · 缝纫间 `sewing` · 木作间 `woodshop` · 暗房 `darkroom` |
| `cook` 食 | 家庭厨房 `kitchen` · 开放餐厨 `openkitchen` · 咖啡吧 `cafe` · 烘焙工坊 `bakery` · 茶室 `teahouse` · 酒铺吧 `winebar` · 果汁吧 `juicebar` · 街角馅饼 `piecorner` |
| `shop` 市 | 花店 `florist` · 书店 `bookstore` · 杂货 `grocer` · 唱片行 `records` · 服装橱窗 `boutique` · 理发 `hairsalon` · 自行车铺 `bikeshop` · 门厅接待 `lobby` |
| `gather` 聚 | 儿童游戏 `playroom` · 小展厅 `gallery` · 放映角 `cinema` · 瑜伽垫间 `yoga` · 温室 `greenhouse` · 屋顶花园 `roofgarden` · 屋顶烧烤 `roofbbq` · 屋顶餐廊 `roofdining` |
| `service` 服 | 楼梯厅 `stairhall` · 洗衣 `laundry` · 信箱间 `mailroom` · 车棚 `bikepark` · 储藏 `storageroom` · 水房花槽 `waterplant` · 值班小间 `duty` · 连廊 `skybridge` |

- 每个功能再加一个 `program` 字段：`face|wall|side|nook` 之一（这一格默认用哪套布置程序）。
- 每个功能 `zones` 必须**五个角色齐全**（`path` 可以是 `[]`，其余至少 1 条）。
- `{cat, n}` 里 `n` 是整数或 `[min,max]`；单间总件数（取 max）不得超过 **18**。
- 每条 `{cat}` 必须是 0.2 里的 id，且该 cat 的 `zones` 必须包含它被放的那个角色（跨类不许乱放：灶不进卧室主区、落地灯不进餐桌区，靠这条拦）。
- `area` 区间合理（卧室别写 [4,6]）。

---

## 3. `people.mjs` —— 人物脚本（每个功能一份，可继承族默认）

```js
export const SCRIPTS = {
  living: {
    seats  : [ {zone:'main', n:[1,2], body:'sit_soft', hold:[8,20]},   // 坐哪个区、几个人、什么姿态、坐多少秒
               {zone:'aux',  n:[0,1], body:'sit_up',   hold:[20,60]} ],
    walkers: [0,1],            // 在 path 区来回走的人数区间
    busy   : [0,0],            // 在 aux 区两三点来回忙的人数区间
    pets   : [ {kind:'cat', zone:'main'} ],   // 可空数组
    forbid : ['cross_table'],  // 禁止穿越的语义（自由词，引擎用来加禁行盒）
    note   : '一句话：这个功能里人在干嘛'
  }
};
```

硬要求：
- `Object.keys(SCRIPTS).length === 48`，key 与 `FUNCTIONS[].id` 一一对应（不多不少）。
- 每份脚本 `seats[].zone` 必须是 0.1 的 id，且该功能在那个区域**确实有座具或卧具**（否则人会坐在空气里）。
- `body` 必须在 0.5 里；`hold` 是 [min,max] 秒。
- 至少 30 份脚本 `pets`/`busy`/`walkers` 有差异——48 份不许长得一样。

---

## 4. `city.mjs` —— 社区规则（整栋 assemble 用）

```js
export const BAND_RULES = {
  ground: { fams:['shop','eat','civic'], publicMin:0.66, note:'临街至少三分之二对外' },
  mid   : { fams:['live','play'],        publicMin:0,    note:'住与起居' },
  top   : { fams:['live','work'],        publicMin:0,    note:'安静' },
  roof  : { fams:['play','eat','civic'], publicMin:0.5,  note:'露台/烧烤/花园；厨房不许上屋顶' }
};

export const ADJACENCY = {
  avoid : [ ['kitchen','kitchen'], ['guestroom','kidroom'] ],   // 不许相邻
  like  : [ ['cafe','bakery'], ['living','library'] ],          // 优先相邻
  banned: { roof:['kitchen'] }                                  // 某层带禁止出现的功能
};

export const STREET = {
  lamps:[6,10], trees:[4,8], pedestrians:[8,18], planters:[2,6],
  note:'楼前是社区的一层'
};
```

硬要求：`avoid` ≥ 6 对、`like` ≥ 6 对，所涉 id 必须都在 FUNCTIONS 里；每个 band 的 `fams` 非空。

---

## 5. 通用禁令
- 不许写占位符（`TODO` / `xxx` / `待定` / 尺寸 1/1/1）。
- 不许灌水凑数：48 个功能必须**互相不同**（zones 程序不许两个功能一模一样）。
- 全部中文注释，文件是 ES module，`export const`，无外部依赖，不许 import 任何东西。
