// ============================================================================
// CosmoPolis 量化积木城市 · 套件库 kits.mjs
// 数据契约唯一权威源 = engine/SCHEMA.md（§0.1 区域角色 / §0.2 十二大类 /
// §0.5 身体姿态 / §1 本文件形状）。12 大类的 id、中文名与顺序照抄工作指引
// 原表，本文件不自造大类，也不改名。
//
// ── 这个库的一条规矩：大类先定、零件后抽、同类可互换、跨类不许乱放 ──
//   1) 大类先定：先在 KIT_CATS 把 12 个大类的“能落在哪些区域角色（zones）、
//      占不占地（floor）”定死。区域程序（functions.mjs）只写“这个区要一件
//      seat”，不写具体是哪把椅子。
//   2) 零件后抽：真正摆哪一件，是排布器从该大类里【随机抽】一件符合当前
//      功能（fn）与区域（zones）的零件。所以零件是可替换的耗材，不是硬编码。
//   3) 同类可互换：同一大类里的任意两件在语义上必须可以互相顶替 —— 抽到
//      餐椅还是咖啡馆藤椅，房间都仍然成立。这是“量化”的前提。
//   4) 跨类不许乱放：靠两层 zones 拦。大类 zones 是天花板（厨作只准 main/aux，
//      永远进不了窗墙）；零件 zones 是更窄的地板（必须是所属大类 zones 的
//      子集）。另有 fn 收窄到具体功能（醒发箱只出现在烘焙工坊）。
//
// ── 第 12 类 person 是故意的 ──
//   工作指引把「人物」列为 12 大类之一 = 那句「人物是套件，不是装饰」的字面
//   落实。它的“零件”是 12 个【动作】，不是家具：不落地、不占位、没有尺寸，
//   用 placeable:false 标记，排房时跳过，由第 5 层人物脚本消费。
//   每个动作用 needs 声明“现场得有什么它才成立”（坐沙发需要 seat，烹需要
//   cook，望窗需要 window，猫 needs:null 哪儿都能趴）。
//
// ── 几条口径说明（不写清楚，下一个人会以为是随手放的）──
//   · 旧版的「墙饰 art + 器械 device + 招牌黑板」按指引并进 media 媒介：
//     指引给 media 的示例本来就横跨「电视/唱机/音箱/投影」与「画/照片墙/钟/
//     镜/灯牌/黑板」，即 media = 一切【承载信息或图像的面与机器】，与是不是
//     通电无关。所以台锯、缝纫机、放大机、街机这类专业机具也归 media。
//   · 旧版「水具」在指引里没有对应大类。洗手台/浴缸/淋浴/马桶全部删除（48 个
//     功能里根本没有卫浴间）；水槽/操作台/洗碗机门按指引归 cook 厨作；洗衣机/
//     烘干机/洗衣池是同一族【带上下水的机具】，也放 cook，但 fn 收窄到
//     laundry / waterplant，绝不会出现在厨房里。
//   · 「床头柜/床屏」指引写在睡眠类的示例里，但契约硬要求「凡 cat 为 bed 的
//     零件 seats 必须非空」——床头柜没有座位口袋，放进 bed 会当场违约。故
//     床头柜归 storage（边柜族）、床屏归 arch（贴墙板件族），bed 只留真正能
//     躺或能坐的家具。这是契约优先于示例清单的取舍，不是漏掉。
//
// 尺寸约定：w=宽(X) d=深(Z) h=高(Y)，单位米，两位小数，全部按真实家具/设备
// 实际尺寸给，不许 1/1/1 占位。座位口袋 seats[] 的 dx/dz 是相对零件中心的米
// 偏移（必须落在占地范围内：|dx|≤w/2、|dz|≤d/2），dir 取 0/90/180/270
// （0 = 面向 +Z），body 取 §0.5 六姿态中的四种可坐/可躺姿态。
// 尺寸下限说明：契约要求每个边长严格 > 0.05m，所以画框厚度、地毯绒厚、灯带
// 截面这类超薄件一律取契约允许的最小值 0.06m —— 这是被下限截断的结果，不是
// 编出来的尺寸；名称里已注明“含挂杆/含垫层/含铝槽”以对得上这个厚度。
// ============================================================================

// ---------------------------------------------------------------------------
// 12 大类：id、中文名与顺序严格照抄 SCHEMA §0.2（工作指引原表）
// ---------------------------------------------------------------------------
// 🔴 2026-09-09 独立验收发现并修:plant 少了 'main'、textile 少了 'path',
//    而 functions.mjs 里有 10 条区域程序正好声明了这两格(花店/温室/屋顶花园的主区绿植、儿童房/游戏室通行的软垫)。
//    后果不是报错,是【静默蒸发】——240 间房被跳过 379 件套件(12.6%),温室主区一棵植物都没有,
//    而当时没有任何判据在看这个数。现在:天花板补上,并且体检里加了一条"声明了天花板不允许的组合=判红"。
export const KIT_CATS = [
  { id:'seat', cn:'座具', desc:'把人接住的零件：沙发/贵妃榻/扶手椅/餐椅/吧凳/长凳/蒲团/摇椅/办公椅，所有“坐”的事件都从它的口袋里长出来',
    zones:['main','aux','window'], floor:true },

  { id:'table', cn:'桌案', desc:'事件发生的水平面：茶几/餐桌/书桌/玄关几/边几/吧台面/岛台/折叠桌/梳妆台/野餐桌，座具围着它成组',
    zones:['main','aux','window'], floor:true },

  { id:'bed', cn:'睡眠', desc:'把人放平的零件：双人床/单人/上下铺/坐卧榻/婴儿床/吊床/床垫，躺与床沿端坐都由它提供口袋',
    zones:['main','aux'], floor:true },

  { id:'storage', cn:'收纳', desc:'把东西藏起来的立面：衣柜/层架/通高书墙/边柜/箱/板条箱/挂杆/鞋架/洞洞板/边橱，通常贴墙沿边站',
    zones:['main','aux','walldec'], floor:true },

  { id:'cook', cn:'厨作', desc:'带上下水与火电的操作带：冰箱/灶/烤箱/水槽/操作台/烟罩/调料架/砧板台/挂锅/洗碗机门，只许进主区与辅区',
    zones:['main','aux'], floor:true },

  { id:'bar', cn:'餐吧', desc:'对外出品的那道台：吧身/咖啡机/点心柜/面包架/黑板/收银/酒龙头/冷柜/菜单牌/蛋糕座',
    zones:['main','aux','window','walldec'], floor:true },

  { id:'light', cn:'灯具', desc:'给房间定气氛的光：吊灯/落地灯/台灯/壁灯/串灯/霓虹/烛簇/天光洗/书桌灯/纸灯',
    zones:['main','aux','window','walldec'], floor:true },

  { id:'textile', cn:'织物', desc:'布与毛的那一层：地毯/帘/靠垫/披毯/床品/帐/桌布/挂旗/垫/纱，负责把硬房间变软',
    zones:['main', 'aux', 'window', 'walldec', 'path'], floor:true },

  { id:'plant', cn:'绿植', desc:'活的那一层：高株/灌木/垂盆/窗箱/花瓶/香草盆/小树/苔墙/多肉盘/花环，靠窗、沿通行边、也可上墙',
    zones:['window', 'path', 'aux', 'walldec', 'main'], floor:true },

  { id:'media', cn:'媒介', desc:'承载信息或图像的面与机器：电视/唱机/音箱/投影/画/照片墙/钟/镜/灯牌/黑板，专业机具（台锯/缝纫机/放大机/街机）同族',
    zones:['main','aux','walldec'], floor:true },

  { id:'arch', cn:'建筑', desc:'房子自己的构件：窗/门/栏杆/柱/拱/百叶/阳台板/天窗/线脚/隔断，可落位但不是家具',
    zones:['window','walldec','path'], floor:true },

  { id:'person', cn:'人物', desc:'12 个动作而不是家具：坐沙发/坐椅/坐凳/走/烹/侍/读/谈/望窗/睡沿/孩玩/猫，不落地不占位，由人物脚本消费',
    zones:[], floor:false, placeable:false }
];

// ---------------------------------------------------------------------------
// 零件库：前 11 类是可落地零件，第 12 类 person 是动作（形状不同）
// ---------------------------------------------------------------------------
// 🔴 2026-09-09:下面若干零件的 zones 里带着「后补的区域」——
//    原因是功能的区域程序声明了某个(大类×区域),而库里一件能进那个区域的零件都没有,
//    于是那一格【静默蒸发】(花店/温室的主区一棵植物都没有)。体检里现在有一条硬判据:
//    功能声明的每个(大类×区域)在库里必须至少有 3 件零件能进,否则判红。
export const KITS = [

  // ==== 1. seat 座具（18 件）：全部带座位口袋，人从这里长出来 ==============
  { id:'sofa_3', cn:'三人布艺沙发', cat:'seat', w:2.10, d:0.90, h:0.75,
    zones:['main'], fn:[],
    seats:[ {dx:-0.70, dz:0.06, dir:0, body:'sit_soft'},
            {dx: 0.00, dz:0.06, dir:0, body:'sit_soft'},
            {dx: 0.70, dz:0.06, dir:0, body:'sit_soft'} ],
    tags:['soft','anchor'] },

  { id:'sofa_2', cn:'双人沙发', cat:'seat', w:1.60, d:0.88, h:0.75,
    zones:['main','aux'], fn:[],
    seats:[ {dx:-0.38, dz:0.06, dir:0, body:'sit_soft'},
            {dx: 0.38, dz:0.06, dir:0, body:'sit_soft'} ],
    tags:['soft'] },

  { id:'sofa_l', cn:'L 型转角沙发', cat:'seat', w:2.40, d:1.60, h:0.72,
    zones:['main'], fn:['living','salon','playroom','cinema','lobby'],
    seats:[ {dx:-0.85, dz:-0.40, dir:0,   body:'sit_soft'},
            {dx:-0.28, dz:-0.40, dir:0,   body:'sit_soft'},
            {dx: 0.30, dz:-0.40, dir:0,   body:'sit_soft'},
            {dx: 0.88, dz: 0.25, dir:270, body:'sit_soft'} ],
    tags:['soft','anchor'] },

  { id:'chaise', cn:'贵妃榻', cat:'seat', w:1.60, d:0.75, h:0.80,
    zones:['main','aux','window'], fn:['living','salon','bedroom','guestroom','hairsalon','lobby','gallery'],
    seats:[ {dx:-0.35, dz:0.00, dir:0, body:'sit_soft'} ],
    tags:['soft'] },

  { id:'armchair', cn:'单人扶手椅', cat:'seat', w:0.80, d:0.82, h:0.78,
    zones:['main','aux','window'], fn:[],
    seats:[ {dx:0.00, dz:0.05, dir:0, body:'sit_soft'} ],
    tags:['soft'] },

  { id:'wing_chair', cn:'高背翼椅', cat:'seat', w:0.85, d:0.88, h:1.10,
    zones:['aux','window','main'], fn:['living','salon','study','library','bookstore','teahouse','lobby','guestroom'],
    seats:[ {dx:0.00, dz:0.05, dir:0, body:'sit_soft'} ],
    tags:['soft','tall'] },

  { id:'lounge_chair', cn:'休闲躺椅', cat:'seat', w:0.72, d:1.40, h:0.92,
    zones:['aux','window'], fn:['living','salon','roofgarden','roofdining','library','gallery','greenhouse'],
    seats:[ {dx:0.00, dz:-0.15, dir:0, body:'sit_soft'} ],
    tags:['soft','recline'] },

  { id:'dining_chair', cn:'木餐椅', cat:'seat', w:0.46, d:0.50, h:0.90,
    zones:['main','aux'], fn:[],
    seats:[ {dx:0.00, dz:0.02, dir:0, body:'sit_up'} ],
    tags:['hard','stack'] },

  { id:'cafe_chair', cn:'咖啡馆藤编椅', cat:'seat', w:0.48, d:0.52, h:0.82,
    zones:['main','aux','window'], fn:['cafe','bakery','teahouse','winebar','juicebar','piecorner','dining','roofdining','bookstore'],
    seats:[ {dx:0.00, dz:0.03, dir:0, body:'sit_up'} ],
    tags:['hard','rattan'] },

  { id:'bench_dining', cn:'长条餐凳', cat:'seat', w:1.40, d:0.35, h:0.45,
    zones:['main'], fn:['dining','openkitchen','kitchen','cafe','bakery','teahouse','piecorner','roofdining','roofbbq'],
    seats:[ {dx:-0.35, dz:0.00, dir:0, body:'sit_up'},
            {dx: 0.35, dz:0.00, dir:0, body:'sit_up'} ],
    tags:['hard','bench'] },

  { id:'bench_hall', cn:'门厅长椅', cat:'seat', w:1.80, d:0.45, h:0.85,
    zones:['aux','main','window'], fn:['lobby','stairhall','mailroom','laundry','hairsalon','bikeshop','gallery','skybridge','duty'],
    seats:[ {dx:-0.60, dz:0.00, dir:0, body:'sit_up'},
            {dx: 0.00, dz:0.00, dir:0, body:'sit_up'},
            {dx: 0.60, dz:0.00, dir:0, body:'sit_up'} ],
    tags:['hard','public'] },

  { id:'bar_stool', cn:'高吧凳', cat:'seat', w:0.38, d:0.38, h:0.75,
    zones:['main','aux'], fn:['winebar','cafe','juicebar','openkitchen','kitchen','bakery','teahouse','piecorner','roofdining'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_high'} ],
    tags:['hard','high'] },

  { id:'counter_stool', cn:'岛台中高凳', cat:'seat', w:0.36, d:0.36, h:0.65,
    zones:['main','aux'], fn:['openkitchen','kitchen','cafe','bakery','atelier','woodshop','sewing','bikeshop','juicebar'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_high'} ],
    tags:['hard','high'] },

  { id:'office_chair', cn:'人体工学转椅', cat:'seat', w:0.62, d:0.62, h:1.10,
    zones:['main','aux'], fn:['study','coworking','atelier','sewing','darkroom','woodshop','music','duty','mailroom'],
    seats:[ {dx:0.00, dz:0.02, dir:0, body:'sit_up'} ],
    tags:['caster','task'] },

  { id:'stool_low', cn:'圆矮凳', cat:'seat', w:0.34, d:0.34, h:0.45,
    zones:['aux','main'], fn:[],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_up'} ],
    tags:['hard','light'] },

  { id:'floor_cushion', cn:'蒲团坐垫', cat:'seat', w:0.60, d:0.60, h:0.15,
    zones:['main','aux','window'], fn:['teahouse','playroom','kidroom','library','music','yoga','cinema','nursery','salon'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_soft'} ],
    tags:['soft','floor'] },

  { id:'beanbag', cn:'懒人豆袋沙发', cat:'seat', w:0.90, d:0.90, h:0.70,
    zones:['main','aux','window'], fn:['playroom','kidroom','cinema','library','bookstore','records','yoga','atelier'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_soft'} ],
    tags:['soft','casual'] },

  { id:'rocking_chair', cn:'木摇椅', cat:'seat', w:0.70, d:0.95, h:1.05,
    zones:['window','aux'], fn:['living','bedroom','guestroom','nursery','roofgarden','teahouse','library','greenhouse'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'sit_soft'} ],
    tags:['wood','rock'] },

  // ==== 2. table 桌案（17 件） ============================================
  { id:'coffee_table', cn:'客厅茶几', cat:'table', w:1.10, d:0.60, h:0.42,
    zones:['main'], fn:['living','salon','guestroom','cinema','lobby','hairsalon','gallery','playroom'], seats:[], tags:['low'] },

  { id:'dining_table_6', cn:'六人长餐桌', cat:'table', w:1.80, d:0.90, h:0.75,
    zones:['main'], fn:['dining','openkitchen','kitchen','roofdining','coworking','cafe'], seats:[], tags:['anchor','wood'] },

  { id:'dining_table_4', cn:'四人方餐桌', cat:'table', w:1.20, d:0.80, h:0.75,
    zones:['main','aux'], fn:['dining','kitchen','openkitchen','cafe','bakery','teahouse','piecorner','roofdining'], seats:[], tags:['wood'] },

  { id:'cafe_table_2', cn:'双人咖啡圆桌', cat:'table', w:0.70, d:0.70, h:0.74,
    zones:['main','aux','window'], fn:['cafe', 'bakery', 'teahouse', 'winebar', 'juicebar', 'piecorner', 'bookstore', 'roofdining', 'roofgarden', 'florist', 'grocer'], seats:[], tags:['round'] },

  { id:'desk_work', cn:'书桌', cat:'table', w:1.40, d:0.70, h:0.75,
    zones:['main','aux','window'], fn:['study','coworking','bedroom','guestroom','kidroom','atelier','darkroom','mailroom','duty'], seats:[], tags:['work'] },

  { id:'desk_l', cn:'L 型工位', cat:'table', w:1.60, d:1.40, h:0.75,
    zones:['main'], fn:['coworking','study','atelier','music','darkroom'], seats:[], tags:['work','anchor'] },

  { id:'meeting_table', cn:'长会议桌', cat:'table', w:2.80, d:1.20, h:0.75,
    zones:['main'], fn:['coworking','library','gallery','atelier'], seats:[], tags:['anchor'] },

  { id:'console_table', cn:'玄关条案', cat:'table', w:1.20, d:0.35, h:0.80,
    zones:['aux','window'], fn:[], seats:[], tags:['narrow'] },

  { id:'side_table', cn:'沙发边几', cat:'table', w:0.45, d:0.45, h:0.55,
    zones:['aux','main','window'], fn:[], seats:[], tags:['low','small'] },

  { id:'nesting_tables', cn:'套叠小几组', cat:'table', w:0.55, d:0.40, h:0.50,
    zones:['aux','window'], fn:['living','salon','teahouse','guestroom','bookstore','hairsalon','lobby'], seats:[], tags:['low','small'] },

  { id:'bar_top', cn:'吧台面（客座侧）', cat:'table', w:2.40, d:0.45, h:1.05,
    zones:['main','window'], fn:['winebar','cafe','juicebar','teahouse','openkitchen','piecorner','roofdining'], seats:[], tags:['high','anchor'] },

  { id:'island_counter', cn:'厨房岛台', cat:'table', w:1.80, d:0.90, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','bakery','cafe','piecorner','juicebar'], seats:[], tags:['high','anchor'] },

  { id:'folding_table', cn:'折叠长桌', cat:'table', w:1.20, d:0.60, h:0.74,
    zones:['main','aux'], fn:['laundry','storageroom','mailroom','playroom','greenhouse','roofbbq','duty','bikepark','stairhall'], seats:[], tags:['fold'] },

  { id:'vanity_table', cn:'梳妆台', cat:'table', w:1.10, d:0.45, h:0.78,
    zones:['main','aux','window'], fn:['vanity','bedroom','guestroom','hairsalon'], seats:[], tags:['narrow'] },

  { id:'picnic_table', cn:'户外野餐桌', cat:'table', w:1.60, d:0.75, h:0.74,
    zones:['main','aux'], fn:['roofgarden','roofbbq','roofdining','greenhouse','skybridge'], seats:[], tags:['outdoor','anchor'] },

  { id:'workbench', cn:'木作工作台', cat:'table', w:1.60, d:0.75, h:0.90,
    zones:['main','aux'], fn:['woodshop','atelier','sewing','bikeshop','greenhouse','darkroom','waterplant'], seats:[], tags:['high','work'] },

  { id:'kid_table', cn:'儿童矮桌', cat:'table', w:0.90, d:0.60, h:0.52,
    zones:['main','aux'], fn:['kidroom','playroom','nursery','bookstore','library'], seats:[], tags:['kid','low'] },

  // ==== 3. bed 睡眠（12 件）：躺口袋 + 床沿端坐口袋 ========================
  { id:'bed_double', cn:'双人床 1.5m', cat:'bed', w:1.50, d:2.00, h:0.50,
    zones:['main'], fn:['bedroom','guestroom'],
    seats:[ {dx:-0.35, dz:0.05, dir:0, body:'lie'},
            {dx: 0.35, dz:0.05, dir:0, body:'lie'},
            {dx: 0.00, dz:-0.90, dir:180, body:'sit_up'} ],
    tags:['anchor'] },

  { id:'bed_queen', cn:'大床 1.8m', cat:'bed', w:1.80, d:2.00, h:0.55,
    zones:['main'], fn:['bedroom','guestroom'],
    seats:[ {dx:-0.42, dz:0.05, dir:0, body:'lie'},
            {dx: 0.42, dz:0.05, dir:0, body:'lie'},
            {dx: 0.00, dz:-0.88, dir:180, body:'sit_up'} ],
    tags:['anchor'] },

  { id:'bed_single', cn:'单人床 0.9m', cat:'bed', w:0.90, d:2.00, h:0.45,
    zones:['main','aux'], fn:['bedroom','guestroom','kidroom','nursery','duty'],
    seats:[ {dx:0.00, dz:0.05, dir:0, body:'lie'},
            {dx:0.00, dz:-0.88, dir:180, body:'sit_up'} ],
    tags:[] },

  { id:'bed_bunk', cn:'上下铺', cat:'bed', w:0.95, d:2.00, h:1.70,
    zones:['main','aux'], fn:['kidroom','guestroom','playroom'],
    seats:[ {dx:0.00, dz:0.05, dir:0, body:'lie'},
            {dx:0.00, dz:-0.85, dir:180, body:'sit_up'} ],
    tags:['kid','tall'] },

  { id:'bed_kid', cn:'儿童床 1.7m', cat:'bed', w:0.90, d:1.70, h:0.45,
    zones:['main'], fn:['kidroom','nursery'],
    seats:[ {dx:0.00, dz:0.05, dir:0, body:'lie'},
            {dx:0.00, dz:-0.72, dir:180, body:'sit_up'} ],
    tags:['kid'] },

  { id:'crib', cn:'婴儿床', cat:'bed', w:0.70, d:1.30, h:0.95,
    zones:['main','aux'], fn:['nursery','bedroom','kidroom'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'lie'} ],
    tags:['kid'] },

  { id:'sofa_bed', cn:'可展开沙发床', cat:'bed', w:1.90, d:0.95, h:0.70,
    zones:['main','aux'], fn:['guestroom','living','salon','study','atelier','duty'],
    seats:[ {dx:-0.45, dz:0.06, dir:0, body:'sit_soft'},
            {dx: 0.45, dz:0.06, dir:0, body:'sit_soft'},
            {dx: 0.00, dz:0.00, dir:90, body:'lie'} ],
    tags:['soft','convert'] },

  { id:'daybed', cn:'坐卧榻', cat:'bed', w:1.90, d:0.80, h:0.60,
    zones:['aux','main'], fn:['living','salon','bedroom','guestroom','library','hairsalon','roofgarden','greenhouse'],
    seats:[ {dx:-0.20, dz:0.00, dir:90, body:'lie'},
            {dx: 0.65, dz:0.00, dir:0,  body:'sit_soft'} ],
    tags:['soft'] },

  { id:'futon', cn:'榻榻米床垫', cat:'bed', w:1.40, d:2.00, h:0.20,
    zones:['main'], fn:['bedroom','guestroom','teahouse','yoga'],
    seats:[ {dx:-0.32, dz:0.00, dir:0, body:'lie'},
            {dx: 0.32, dz:0.00, dir:0, body:'lie'} ],
    tags:['floor','soft'] },

  { id:'floor_mattress', cn:'地铺床垫', cat:'bed', w:1.00, d:1.90, h:0.16,
    zones:['main','aux'], fn:['kidroom','playroom','guestroom','yoga','nursery'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'lie'} ],
    tags:['floor'] },

  { id:'hammock', cn:'吊床', cat:'bed', w:0.90, d:2.20, h:1.05,
    zones:['main','aux'], fn:['roofgarden','greenhouse','playroom','skybridge','kidroom'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'lie'} ],
    tags:['hang'] },

  { id:'nap_pod', cn:'午休舱', cat:'bed', w:0.95, d:2.05, h:1.15,
    zones:['aux'], fn:['coworking','duty','yoga','library','stairhall'],
    seats:[ {dx:0.00, dz:0.00, dir:0, body:'lie'} ],
    tags:['pod'] },

  // ==== 4. storage 收纳（18 件） ==========================================
  { id:'wardrobe', cn:'对开门衣柜', cat:'storage', w:1.60, d:0.60, h:2.20,
    zones:['main','aux'], fn:['bedroom','guestroom','vanity','kidroom','boutique','hairsalon','laundry'], seats:[], tags:['tall','anchor'] },

  { id:'shelf_unit', cn:'开放层架', cat:'storage', w:0.90, d:0.35, h:1.75,
    zones:['aux','main'], fn:[], seats:[], tags:['tall'] },

  { id:'book_wall', cn:'通高书墙', cat:'storage', w:2.40, d:0.35, h:2.60,
    zones:['main','aux'], fn:['library','study','bookstore','records','living','salon','coworking','gallery'], seats:[], tags:['tall','anchor'] },

  { id:'bookshelf', cn:'单柱书架', cat:'storage', w:0.80, d:0.30, h:1.90,
    zones:['aux','main'], fn:[], seats:[], tags:['tall'] },

  { id:'sideboard', cn:'餐边柜', cat:'storage', w:1.40, d:0.45, h:0.85,
    zones:['aux','main'], fn:['dining','kitchen','openkitchen','living','salon','teahouse','cafe','storageroom'], seats:[], tags:['low'] },

  { id:'cabinet_low', cn:'矮边橱', cat:'storage', w:1.00, d:0.42, h:0.80,
    zones:['aux','main'], fn:[], seats:[], tags:['low'] },

  { id:'trunk_box', cn:'收纳箱', cat:'storage', w:0.70, d:0.45, h:0.45,
    zones:['aux','main'], fn:[], seats:[], tags:['low','small'] },

  { id:'crate_stack', cn:'板条箱堆', cat:'storage', w:0.50, d:0.35, h:0.90,
    zones:['aux', 'main', 'walldec'], fn:['grocer','florist','bakery','storageroom','bikepark','woodshop','records','greenhouse','waterplant','piecorner'], seats:[], tags:[] },

  { id:'clothes_rail', cn:'落地挂杆', cat:'storage', w:1.20, d:0.55, h:1.60,
    zones:['main','aux'], fn:['boutique','vanity','bedroom','laundry','hairsalon','storageroom'], seats:[], tags:['tall'] },

  { id:'shoe_rack', cn:'鞋架', cat:'storage', w:0.80, d:0.32, h:0.85,
    zones:['aux'], fn:['bedroom','vanity','lobby','stairhall','laundry','yoga','boutique','guestroom'], seats:[], tags:['narrow'] },

  { id:'pegboard', cn:'洞洞板工具墙', cat:'storage', w:1.20, d:0.06, h:0.90,
    zones:['walldec'], fn:['woodshop', 'atelier', 'sewing', 'bikeshop', 'kitchen', 'greenhouse', 'laundry', 'storageroom', 'waterplant', 'darkroom', 'salon', 'vanity', 'library', 'openkitchen', 'mailroom'], seats:[], tags:['wall'], wall:true },

  { id:'wall_shelf', cn:'挂墙搁板', cat:'storage', w:1.20, d:0.24, h:0.06,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'nightstand', cn:'床头柜', cat:'storage', w:0.45, d:0.40, h:0.55,
    zones:['main','aux'], fn:['bedroom','guestroom','kidroom','nursery','duty'], seats:[], tags:['small'] },

  { id:'locker', cn:'更衣柜组', cat:'storage', w:0.90, d:0.50, h:1.80,
    zones:['aux'], fn:['yoga','laundry','woodshop','bikepark','storageroom','mailroom','duty','coworking'], seats:[], tags:['tall'] },

  { id:'filing_cabinet', cn:'文件柜', cat:'storage', w:0.90, d:0.45, h:1.35,
    zones:['aux'], fn:['coworking','study','mailroom','darkroom','duty','atelier'], seats:[], tags:[] },

  { id:'toy_chest', cn:'玩具收纳箱', cat:'storage', w:0.90, d:0.45, h:0.55,
    zones:['aux','main'], fn:['kidroom','playroom','nursery'], seats:[], tags:['kid','low'] },

  { id:'bike_rack', cn:'自行车停放架', cat:'storage', w:1.80, d:0.50, h:1.10,
    zones:['main','aux'], fn:['bikepark','bikeshop','stairhall','lobby'], seats:[], tags:['anchor'] },

  { id:'coat_rack', cn:'落地衣帽架', cat:'storage', w:0.45, d:0.45, h:1.75,
    zones:['aux'], fn:['lobby','stairhall','living','coworking','hairsalon','boutique','mailroom','laundry','duty','skybridge'], seats:[], tags:['tall','slim'] },

  // ==== 5. cook 厨作（20 件）：只准 main/aux，绝不进窗墙 ===================
  { id:'fridge_tall', cn:'双门冰箱', cat:'cook', w:0.90, d:0.70, h:1.85,
    zones:['main','aux'], fn:['kitchen','openkitchen','cafe','bakery','grocer','piecorner','juicebar','winebar','storageroom'], seats:[], tags:['tall','anchor'] },

  { id:'fridge_under', cn:'台下冷藏柜', cat:'cook', w:0.60, d:0.60, h:0.85,
    zones:['aux','main'], fn:['cafe','bakery','teahouse','juicebar','winebar','openkitchen','piecorner','duty'], seats:[], tags:['low'] },

  { id:'range_gas', cn:'四眼燃气灶台', cat:'cook', w:0.60, d:0.60, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','piecorner','bakery','roofbbq'], seats:[], tags:['heat'] },

  { id:'induction_hob', cn:'嵌入式电磁灶', cat:'cook', w:0.75, d:0.52, h:0.10,
    zones:['main','aux'], fn:['kitchen','openkitchen','teahouse','juicebar','piecorner'], seats:[], tags:['heat','flush'] },

  { id:'oven_stack', cn:'家用烤箱柜', cat:'cook', w:0.60, d:0.60, h:0.88,
    zones:['main','aux'], fn:['kitchen','openkitchen','bakery','piecorner'], seats:[], tags:['heat'] },

  { id:'deck_oven', cn:'三层商用烤炉', cat:'cook', w:1.35, d:0.90, h:1.60,
    zones:['main'], fn:['bakery','piecorner'], seats:[], tags:['heat','anchor'] },

  { id:'proofing_cabinet', cn:'面团醒发箱', cat:'cook', w:0.80, d:0.80, h:1.90,
    zones:['aux','main'], fn:['bakery','piecorner'], seats:[], tags:['tall'] },

  { id:'dough_mixer', cn:'落地和面机', cat:'cook', w:0.60, d:0.75, h:1.20,
    zones:['aux','main'], fn:['bakery','piecorner','kitchen'], seats:[], tags:['machine'] },

  { id:'range_hood', cn:'抽油烟罩', cat:'cook', w:0.90, d:0.50, h:0.65,
    zones:['main','aux'], fn:['kitchen','openkitchen','bakery','piecorner','roofbbq'], seats:[], tags:['overhead'] },

  { id:'grill_station', cn:'户外烧烤炉', cat:'cook', w:1.20, d:0.65, h:1.10,
    zones:['main'], fn:['roofbbq','roofdining','roofgarden'], seats:[], tags:['heat','outdoor','anchor'] },

  { id:'sink_kitchen', cn:'厨房单槽柜', cat:'cook', w:0.80, d:0.60, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','cafe','bakery','teahouse','juicebar','florist','greenhouse','waterplant','piecorner'], seats:[], tags:['plumb'] },

  { id:'sink_double', cn:'双槽洗涤台', cat:'cook', w:1.20, d:0.65, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','bakery','florist','woodshop','darkroom','waterplant'], seats:[], tags:['plumb','anchor'] },

  { id:'prep_counter', cn:'不锈钢操作台', cat:'cook', w:1.50, d:0.70, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','bakery','cafe','piecorner','grocer','juicebar','roofbbq'], seats:[], tags:['counter','anchor'] },

  { id:'cutting_station', cn:'砧板操作台', cat:'cook', w:0.90, d:0.60, h:0.90,
    zones:['main','aux'], fn:['kitchen','openkitchen','piecorner','bakery','juicebar','grocer','roofbbq'], seats:[], tags:['counter'] },

  { id:'spice_rack', cn:'调料架', cat:'cook', w:0.60, d:0.14, h:0.55,
    zones:['aux','main'], fn:['kitchen', 'openkitchen', 'bakery', 'cafe', 'piecorner', 'teahouse', 'atelier', 'hairsalon', 'darkroom'], seats:[], tags:['small'] },

  { id:'pot_hanger', cn:'挂锅杆', cat:'cook', w:1.10, d:0.30, h:0.45,
    zones:['main','aux'], fn:['kitchen', 'openkitchen', 'bakery', 'piecorner', 'atelier', 'hairsalon'], seats:[], tags:['overhead'] },

  { id:'dishwasher_door', cn:'洗碗机门', cat:'cook', w:0.60, d:0.60, h:0.82,
    zones:['aux','main'], fn:['kitchen','openkitchen','cafe','bakery','piecorner','teahouse'], seats:[], tags:['machine'] },

  { id:'washer', cn:'滚筒洗衣机', cat:'cook', w:0.60, d:0.60, h:0.85,
    zones:['main','aux'], fn:['laundry'], seats:[], tags:['plumb','machine'] },

  { id:'dryer', cn:'热泵烘干机', cat:'cook', w:0.60, d:0.60, h:0.85,
    zones:['main','aux'], fn:['laundry'], seats:[], tags:['machine'] },

  { id:'utility_tub', cn:'洗衣池 / 水房池', cat:'cook', w:0.60, d:0.55, h:0.85,
    zones:['aux','main'], fn:['laundry','waterplant','storageroom','greenhouse','woodshop'], seats:[], tags:['plumb'] },

  // ==== 6. bar 餐吧（16 件）：对外出品的那道台 =============================
  { id:'bar_body', cn:'服务吧身', cat:'bar', w:2.20, d:0.65, h:1.05,
    zones:['main'], fn:['cafe','winebar','juicebar','teahouse','bakery','piecorner','openkitchen','roofdining','lobby'], seats:[], tags:['anchor','high'] },

  { id:'bar_body_small', cn:'小吧身', cat:'bar', w:1.40, d:0.55, h:1.05,
    zones:['main','aux'], fn:['cafe','juicebar','teahouse','bookstore','records','gallery','lobby','duty','roofgarden'], seats:[], tags:['high'] },

  { id:'espresso_machine', cn:'双头商用咖啡机', cat:'bar', w:0.75, d:0.55, h:0.50,
    zones:['main','aux'], fn:['cafe','bakery','teahouse','bookstore','records','piecorner','lobby','coworking'], seats:[], tags:['counter'] },

  { id:'grinder', cn:'磨豆机', cat:'bar', w:0.25, d:0.35, h:0.55,
    zones:['main','aux'], fn:['cafe', 'bakery', 'teahouse', 'piecorner', 'juicebar', 'salon', 'dining', 'roofbbq', 'coworking', 'openkitchen', 'bikeshop', 'gallery', 'roofdining', 'duty'], seats:[], tags:['counter','small'] },

  { id:'pastry_case', cn:'点心展示柜', cat:'bar', w:1.20, d:0.70, h:1.10,
    zones:['main','window'], fn:['cafe','bakery','piecorner','teahouse','grocer'], seats:[], tags:['cold','anchor'] },

  { id:'bread_rack', cn:'面包货架', cat:'bar', w:1.00, d:0.45, h:1.75,
    zones:['main','aux','window'], fn:['bakery', 'piecorner', 'grocer', 'cafe', 'florist', 'bookstore', 'records', 'boutique', 'juicebar'], seats:[], tags:['tall'] },

  { id:'cold_case', cn:'立式冷柜', cat:'bar', w:0.90, d:0.75, h:1.95,
    zones:['main','aux'], fn:['grocer','winebar','juicebar','cafe','bakery','piecorner'], seats:[], tags:['tall','cold'] },

  { id:'register', cn:'收银机台', cat:'bar', w:0.70, d:0.55, h:1.05,
    zones:['main','aux'], fn:['cafe','bakery','grocer','florist','bookstore','records','boutique','hairsalon','bikeshop','piecorner','juicebar','winebar'], seats:[], tags:['high','public'] },

  { id:'tap_tower', cn:'酒龙头塔', cat:'bar', w:0.35, d:0.30, h:0.65,
    zones:['main'], fn:['winebar','juicebar','roofdining','roofbbq'], seats:[], tags:['counter'] },

  { id:'juice_press', cn:'榨汁机组', cat:'bar', w:0.45, d:0.40, h:0.60,
    zones:['main','aux'], fn:['juicebar','cafe','grocer','piecorner'], seats:[], tags:['counter'] },

  { id:'pie_warmer', cn:'馅饼保温柜', cat:'bar', w:0.80, d:0.60, h:0.75,
    zones:['main','window'], fn:['piecorner','bakery','cafe','grocer'], seats:[], tags:['heat'] },

  { id:'cake_stand', cn:'蛋糕玻璃罩座', cat:'bar', w:0.32, d:0.32, h:0.35,
    zones:['main','aux'], fn:['bakery','cafe','piecorner','teahouse','grocer'], seats:[], tags:['small'] },

  { id:'chalk_menu', cn:'手写黑板菜单', cat:'bar', w:0.80, d:0.06, h:1.10,
    zones:['walldec'], fn:['cafe','bakery','winebar','juicebar','teahouse','piecorner','grocer','roofdining'], seats:[], tags:['wall','sign'], wall:true },

  { id:'menu_sign', cn:'立式菜单牌', cat:'bar', w:0.50, d:0.40, h:1.40,
    zones:['window','aux'], fn:['cafe', 'bakery', 'winebar', 'juicebar', 'piecorner', 'grocer', 'roofdining', 'teahouse', 'florist', 'bookstore', 'records', 'boutique'], seats:[], tags:['slim','sign'] },

  { id:'cup_shelf', cn:'杯具挂架', cat:'bar', w:0.90, d:0.25, h:1.20,
    zones:['aux','walldec'], fn:['cafe','teahouse','winebar','juicebar','bakery','piecorner','openkitchen'], seats:[], tags:['tall'] },

  { id:'syrup_rail', cn:'糖浆瓶导轨', cat:'bar', w:0.60, d:0.16, h:0.45,
    zones:['aux','main'], fn:['cafe', 'juicebar', 'teahouse', 'bakery', 'winebar', 'salon', 'dining', 'roofbbq'], seats:[], tags:['small'] },

  // ==== 7. light 灯具（15 件）：壁挂件用零件级 wall:true 标 =================
  { id:'pendant_single', cn:'单头吊灯', cat:'light', w:0.30, d:0.30, h:0.45,
    zones:['main','aux'], fn:[], seats:[], tags:['ceiling'] },

  { id:'pendant_cluster', cn:'三头吊灯组', cat:'light', w:1.10, d:0.25, h:0.60,
    zones:['main'], fn:['dining','openkitchen','kitchen','cafe','winebar','bakery','teahouse','roofdining','coworking','salon'], seats:[], tags:['ceiling'] },

  { id:'shop_pendant', cn:'工业搪瓷吊灯', cat:'light', w:0.40, d:0.40, h:0.55,
    zones:['main','aux'], fn:['woodshop','bikeshop','grocer','records','bakery','storageroom','laundry','piecorner','atelier'], seats:[], tags:['ceiling'] },

  { id:'floor_lamp', cn:'落地灯', cat:'light', w:0.40, d:0.40, h:1.65,
    zones:['aux','window','main'], fn:[], seats:[], tags:['tall'] },

  { id:'arc_lamp', cn:'钓鱼式弧形落地灯', cat:'light', w:1.20, d:0.40, h:2.05,
    zones:['main','aux'], fn:['living','salon','atelier','gallery','cinema','lobby','coworking','music'], seats:[], tags:['tall'] },

  { id:'table_lamp', cn:'台灯', cat:'light', w:0.28, d:0.28, h:0.52,
    zones:['aux','main','window'], fn:[], seats:[], tags:['small'] },

  { id:'desk_lamp', cn:'夹持式书桌灯', cat:'light', w:0.45, d:0.20, h:0.55,
    zones:['main','aux'], fn:['study','coworking','atelier','sewing','woodshop','darkroom','bedroom','kidroom','mailroom','duty'], seats:[], tags:['small','task'] },

  { id:'wall_sconce', cn:'壁灯', cat:'light', w:0.18, d:0.14, h:0.32,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'string_lights', cn:'串灯', cat:'light', w:3.00, d:0.06, h:0.12,
    zones:['window','walldec'], fn:['roofgarden','roofbbq','roofdining','greenhouse','playroom','kidroom','cafe','winebar','skybridge','salon'], seats:[], tags:['wall'], wall:true },

  { id:'neon_sign', cn:'霓虹灯牌', cat:'light', w:0.90, d:0.06, h:0.35,
    zones:['walldec','window'], fn:['winebar','cafe','records','boutique','bikeshop','juicebar','bookstore','hairsalon','piecorner','playroom'], seats:[], tags:['wall','sign'], wall:true },

  { id:'candle_cluster', cn:'烛簇', cat:'light', w:0.35, d:0.35, h:0.28,
    zones:['main','aux','window'], fn:['dining','salon','teahouse','winebar','roofdining','bedroom','guestroom','library'], seats:[], tags:['small'] },

  { id:'skylight_wash', cn:'天光洗墙灯', cat:'light', w:1.50, d:0.10, h:0.12,
    zones:['walldec','main'], fn:['gallery','boutique','bookstore','records','florist','atelier','lobby','greenhouse','skybridge'], seats:[], tags:['ceiling'] },

  { id:'paper_lantern', cn:'纸灯', cat:'light', w:0.45, d:0.45, h:0.55,
    zones:['main','aux','window'], fn:['teahouse','bedroom','salon','guestroom','roofgarden','nursery','library','roofdining'], seats:[], tags:['ceiling','soft'] },

  { id:'track_light', cn:'轨道射灯', cat:'light', w:1.50, d:0.08, h:0.12,
    zones:['main','aux','walldec'], fn:['gallery','boutique','bookstore','records','florist','atelier','grocer','hairsalon','bikeshop','lobby'], seats:[], tags:['ceiling'] },

  { id:'safelight', cn:'暗房红色安全灯', cat:'light', w:0.20, d:0.12, h:0.25,
    zones:['walldec'], fn:['darkroom', 'living', 'dining', 'nursery', 'coworking', 'music', 'cinema', 'yoga', 'waterplant', 'duty'], seats:[], tags:['wall'], wall:true },

  // ==== 8. textile 织物（16 件） ==========================================
  { id:'rug_large', cn:'大块羊毛地毯（含垫层）', cat:'textile', w:2.40, d:1.70, h:0.06,
    zones:['main'], fn:[], seats:[], tags:['floor'] },

  { id:'rug_round', cn:'圆形长绒地毯', cat:'textile', w:1.60, d:1.60, h:0.06,
    zones:['main','aux'], fn:[], seats:[], tags:['floor'] },

  { id:'rug_runner', cn:'走道长条地毯', cat:'textile', w:0.80, d:2.40, h:0.06,
    zones:['aux','main'], fn:['stairhall','lobby','library','bookstore','skybridge','hairsalon','boutique','gallery'], seats:[], tags:['floor'] },

  { id:'floor_mat', cn:'门口刮泥地垫', cat:'textile', w:0.80, d:0.50, h:0.06,
    zones:['aux'], fn:[], seats:[], tags:['floor','small'] },

  { id:'yoga_mat', cn:'加厚瑜伽垫', cat:'textile', w:0.61, d:1.73, h:0.06,
    zones:['main','aux'], fn:['yoga','playroom','kidroom','roofgarden','nursery'], seats:[], tags:['floor'] },

  { id:'curtain_sheer', cn:'纱帘', cat:'textile', w:1.80, d:0.10, h:2.40,
    zones:['window'], fn:[], seats:[], tags:['window'] },

  { id:'curtain_black', cn:'遮光窗帘', cat:'textile', w:2.20, d:0.14, h:2.50,
    zones:['window'], fn:['bedroom','guestroom','cinema','darkroom','kidroom','music','nursery','atelier'], seats:[], tags:['window'] },

  { id:'roman_blind', cn:'罗马帘', cat:'textile', w:1.20, d:0.10, h:1.60,
    zones:['window'], fn:[], seats:[], tags:['window'] },

  { id:'sheer_panel', cn:'落地纱屏', cat:'textile', w:1.20, d:0.08, h:2.30,
    zones:['window', 'main', 'path'], fn:['salon','teahouse','hairsalon','gallery','bedroom','yoga','boutique','lobby'], seats:[], tags:['window'] },

  { id:'cushion_set', cn:'靠垫组', cat:'textile', w:0.50, d:0.18, h:0.50,
    zones:['main', 'aux', 'window', 'path'], fn:[], seats:[], tags:['small'] },

  { id:'throw_blanket', cn:'披毯', cat:'textile', w:0.60, d:0.30, h:0.12,
    zones:['main','aux'], fn:[], seats:[], tags:['small'] },

  { id:'bed_linen', cn:'床品套件', cat:'textile', w:1.50, d:2.00, h:0.08,
    zones:['main'], fn:['bedroom','guestroom','kidroom','nursery','duty'], seats:[], tags:['soft'] },

  { id:'canopy', cn:'床帐', cat:'textile', w:1.60, d:2.10, h:2.20,
    zones:['main'], fn:['bedroom','guestroom','kidroom','nursery','salon'], seats:[], tags:['tall','soft'] },

  { id:'tablecloth', cn:'桌布', cat:'textile', w:1.90, d:1.00, h:0.08,
    zones:['main'], fn:['dining','roofdining','teahouse','cafe','bakery','salon','piecorner','greenhouse'], seats:[], tags:['soft'] },

  { id:'banner', cn:'挂旗', cat:'textile', w:0.60, d:0.06, h:1.40,
    zones:['walldec', 'path'], fn:['playroom','kidroom','gallery','records','bookstore','roofbbq','lobby','stairhall','boutique','bikeshop'], seats:[], tags:['wall'], wall:true },

  { id:'acoustic_panel', cn:'吸音软包', cat:'textile', w:0.60, d:0.06, h:1.20,
    zones:['walldec', 'path'], fn:['music','cinema','darkroom','coworking','atelier','records','yoga'], seats:[], tags:['wall'], wall:true },

  // ==== 9. plant 绿植（13 件） ============================================
  { id:'tall_ficus', cn:'高株琴叶榕', cat:'plant', w:0.60, d:0.60, h:1.75,
    zones:['window','path','aux'], fn:[], seats:[], tags:['tall'] },

  { id:'potted_palm', cn:'高株散尾葵', cat:'plant', w:0.80, d:0.80, h:1.90,
    zones:['window','path','aux'], fn:[], seats:[], tags:['tall'] },

  { id:'small_tree', cn:'室内小树', cat:'plant', w:0.70, d:0.70, h:2.20,
    zones:['window','path'], fn:['lobby','greenhouse','roofgarden','gallery','stairhall','skybridge','florist','bookstore'], seats:[], tags:['tall'] },

  { id:'shrub_box', cn:'灌木球盆', cat:'plant', w:0.55, d:0.55, h:0.85,
    zones:['window','path','aux'], fn:[], seats:[], tags:[] },

  { id:'hanging_pothos', cn:'垂盆绿萝', cat:'plant', w:0.40, d:0.40, h:0.85,
    zones:['window','aux'], fn:[], seats:[], tags:['hang'] },

  { id:'window_box', cn:'窗箱', cat:'plant', w:0.90, d:0.22, h:0.35,
    zones:['window'], fn:[], seats:[], tags:['small'] },

  { id:'flower_vase', cn:'插花花瓶', cat:'plant', w:0.25, d:0.25, h:0.45,
    zones:['window', 'aux', 'main'], fn:[], seats:[], tags:['small'] },

  { id:'herb_pot', cn:'香草盆', cat:'plant', w:0.20, d:0.20, h:0.28,
    zones:['window', 'aux', 'main'], fn:['kitchen','openkitchen','cafe','bakery','greenhouse','teahouse','roofgarden','piecorner','juicebar','waterplant'], seats:[], tags:['small'] },

  { id:'succulent_tray', cn:'多肉盘', cat:'plant', w:0.40, d:0.28, h:0.16,
    zones:['window', 'aux', 'main'], fn:[], seats:[], tags:['small'] },

  { id:'moss_wall', cn:'苔墙', cat:'plant', w:1.20, d:0.10, h:0.90,
    zones:['walldec'], fn:['greenhouse','florist','gallery','lobby','cafe','coworking','yoga','waterplant','bookstore','skybridge'], seats:[], tags:['wall'], wall:true },

  { id:'wreath', cn:'门口花环', cat:'plant', w:0.45, d:0.10, h:0.45,
    zones:['walldec', 'main'], fn:['florist','lobby','stairhall','grocer','bakery','boutique','greenhouse','roofgarden'], seats:[], tags:['wall'], wall:true },

  { id:'street_planter', cn:'街边花箱', cat:'plant', w:0.90, d:0.40, h:0.60,
    zones:['path','window'], fn:['florist','grocer','bakery','cafe','bookstore','boutique','bikeshop','roofgarden','lobby','skybridge'], seats:[], tags:['low','outdoor'] },

  { id:'seed_rack', cn:'育苗架', cat:'plant', w:0.90, d:0.45, h:1.60,
    zones:['aux','window'], fn:['greenhouse','florist','waterplant','roofgarden'], seats:[], tags:['tall'] },

  // ==== 10. media 媒介（21 件）：承载信息或图像的面与机器 ==================
  { id:'tv_wall', cn:'壁挂电视', cat:'media', w:1.25, d:0.08, h:0.72,
    zones:['walldec'], fn:['living','salon','guestroom','bedroom','cinema','playroom','lobby','yoga','duty','coworking'], seats:[], tags:['wall'], wall:true },

  { id:'projector_screen', cn:'投影幕布', cat:'media', w:2.20, d:0.10, h:1.40,
    zones:['walldec'], fn:['cinema','coworking','gallery','music','playroom','library','atelier','yoga'], seats:[], tags:['wall'], wall:true },

  { id:'turntable', cn:'黑胶唱机', cat:'media', w:0.45, d:0.38, h:0.15,
    zones:['main','aux'], fn:['records','living','salon','music','winebar','cafe','bookstore','teahouse','hairsalon'], seats:[], tags:['small'] },

  { id:'speaker_floor', cn:'落地音箱', cat:'media', w:0.25, d:0.32, h:1.05,
    zones:['main','aux'], fn:['records', 'music', 'living', 'salon', 'cinema', 'winebar', 'yoga', 'playroom', 'boutique', 'hairsalon', 'gallery'], seats:[], tags:['slim'] },

  { id:'record_bin', cn:'唱片翻箱', cat:'media', w:1.00, d:0.60, h:0.95,
    zones:['main','aux'], fn:['records','bookstore','grocer'], seats:[], tags:['low'] },

  { id:'piano_upright', cn:'立式钢琴', cat:'media', w:1.50, d:0.62, h:1.25,
    zones:['main','aux'], fn:['music','salon','living','winebar','lobby','gallery'], seats:[], tags:['anchor'] },

  { id:'framed_print', cn:'装裱版画', cat:'media', w:0.70, d:0.06, h:0.50,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'large_canvas', cn:'大幅布面油画', cat:'media', w:1.60, d:0.06, h:1.10,
    zones:['walldec'], fn:['living','salon','gallery','lobby','coworking','boutique','atelier','library'], seats:[], tags:['wall'], wall:true },

  { id:'photo_grid', cn:'照片墙九宫格', cat:'media', w:1.20, d:0.06, h:0.90,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'poster_set', cn:'海报组（含裱板）', cat:'media', w:0.90, d:0.06, h:1.20,
    zones:['walldec'], fn:['kidroom','playroom','cinema','music','records','atelier','bookstore','yoga','bikeshop','darkroom'], seats:[], tags:['wall'], wall:true },

  { id:'wall_clock', cn:'挂钟', cat:'media', w:0.32, d:0.06, h:0.32,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'mirror_round', cn:'圆形装饰镜', cat:'media', w:0.70, d:0.06, h:0.70,
    zones:['walldec'], fn:[], seats:[], tags:['wall'], wall:true },

  { id:'mirror_full', cn:'全身穿衣镜', cat:'media', w:0.60, d:0.06, h:1.70,
    zones:['walldec'], fn:['vanity','bedroom','boutique','hairsalon','yoga','guestroom','laundry'], seats:[], tags:['wall'], wall:true },

  { id:'sign_board', cn:'店招灯牌', cat:'media', w:1.40, d:0.08, h:0.45,
    zones:['walldec'], fn:['florist','bookstore','grocer','records','boutique','hairsalon','bikeshop','cafe','bakery','piecorner','winebar','juicebar'], seats:[], tags:['wall','sign'], wall:true },

  { id:'blackboard', cn:'教学黑板', cat:'media', w:1.20, d:0.06, h:0.90,
    zones:['walldec'], fn:['playroom','kidroom','coworking','woodshop','atelier','library','nursery','greenhouse','duty','mailroom'], seats:[], tags:['wall'], wall:true },

  { id:'desktop_pc', cn:'台式机主机', cat:'media', w:0.22, d:0.45, h:0.45,
    zones:['aux','main'], fn:['coworking', 'study', 'atelier', 'darkroom', 'music', 'mailroom', 'duty', 'records', 'cinema'], seats:[], tags:['small'] },

  { id:'monitor_dual', cn:'双屏显示器', cat:'media', w:1.20, d:0.25, h:0.55,
    zones:['main','aux'], fn:['coworking','study','atelier','music','darkroom','duty'], seats:[], tags:['desk'] },

  { id:'printer_mfp', cn:'复合打印机', cat:'media', w:0.50, d:0.45, h:0.55,
    zones:['aux'], fn:['coworking','study','mailroom','atelier','darkroom','duty','library'], seats:[], tags:[] },

  { id:'sewing_machine', cn:'工业缝纫机', cat:'media', w:0.50, d:0.30, h:0.35,
    zones:['main','aux'], fn:['sewing','atelier','boutique','woodshop'], seats:[], tags:['desk','small'] },

  { id:'bench_saw', cn:'木工台锯', cat:'media', w:1.10, d:0.75, h:0.95,
    zones:['main'], fn:['woodshop','atelier'], seats:[], tags:['machine','anchor'] },

  { id:'enlarger', cn:'暗房放大机', cat:'media', w:0.50, d:0.55, h:1.20,
    zones:['main','aux'], fn:['darkroom','atelier'], seats:[], tags:['machine'] },

  // ==== 11. arch 建筑（14 件）：房子自己的构件 =============================
  { id:'window_casement', cn:'双开外窗', cat:'arch', w:1.40, d:0.14, h:1.60,
    zones:['window'], fn:[], seats:[], tags:['opening'] },

  { id:'window_bay', cn:'飘窗龛', cat:'arch', w:2.00, d:0.55, h:1.80,
    zones:['window'], fn:['living','salon','bedroom','study','library','bookstore','cafe','teahouse','guestroom','kidroom'], seats:[], tags:['opening','anchor'] },

  { id:'shopfront_glass', cn:'落地玻璃店面', cat:'arch', w:2.60, d:0.16, h:2.80,
    zones:['window'], fn:['florist','bookstore','grocer','records','boutique','hairsalon','bikeshop','cafe','bakery','piecorner','winebar','juicebar'], seats:[], tags:['opening','public'] },

  { id:'door_panel', cn:'木门扇', cat:'arch', w:0.90, d:0.10, h:2.10,
    zones:['walldec','path'], fn:[], seats:[], tags:['opening'] },

  { id:'railing', cn:'金属栏杆', cat:'arch', w:1.80, d:0.10, h:1.05,
    zones:['window','path'], fn:['roofgarden','roofbbq','roofdining','stairhall','skybridge','greenhouse','lobby','bikepark'], seats:[], tags:['guard'] },

  { id:'column', cn:'结构圆柱', cat:'arch', w:0.40, d:0.40, h:3.00,
    zones:['path'], fn:[], seats:[], tags:['structure'] },

  { id:'arch_opening', cn:'拱形门洞', cat:'arch', w:1.40, d:0.30, h:2.40,
    zones:['walldec','path'], fn:['salon','lobby','gallery','teahouse','bakery','stairhall','library','winebar'], seats:[], tags:['opening'] },

  { id:'louver', cn:'百叶格栅', cat:'arch', w:1.20, d:0.10, h:1.80,
    zones:['window','walldec'], fn:[], seats:[], tags:['screen'] },

  { id:'balcony_slab', cn:'阳台挑板', cat:'arch', w:2.20, d:1.00, h:0.18,
    zones:['window'], fn:['living','bedroom','roofgarden','roofdining','greenhouse','salon','guestroom','skybridge'], seats:[], tags:['structure'] },

  { id:'skylight', cn:'天窗', cat:'arch', w:1.20, d:1.20, h:0.16,
    zones:['window','walldec'], fn:['greenhouse','atelier','gallery','roofgarden','stairhall','darkroom','yoga','skybridge','library','woodshop'], seats:[], tags:['opening'] },

  { id:'cornice', cn:'顶部线脚', cat:'arch', w:2.00, d:0.12, h:0.18,
    zones:['walldec'], fn:[], seats:[], tags:['trim'] },

  { id:'partition_screen', cn:'木格隔断', cat:'arch', w:1.60, d:0.12, h:2.10,
    zones:['path','walldec'], fn:['teahouse','salon','coworking','hairsalon','library','lobby','yoga','gallery','boutique','openkitchen'], seats:[], tags:['screen'] },

  { id:'step_stoop', cn:'入口台阶', cat:'arch', w:1.40, d:0.60, h:0.36,
    zones:['path'], fn:['lobby','stairhall','florist','grocer','bookstore','bakery','cafe','bikeshop','boutique','piecorner'], seats:[], tags:['structure'] },

  { id:'handrail_wall', cn:'靠墙扶手', cat:'arch', w:1.60, d:0.08, h:0.10,
    zones:['walldec','path'], fn:['stairhall','skybridge','lobby','bikepark','duty','laundry','mailroom','storageroom'], seats:[], tags:['guard'], wall:true },

  { id:'headboard', cn:'床屏', cat:'arch', w:1.60, d:0.10, h:1.05,
    zones:['walldec'], fn:['bedroom','guestroom','kidroom','nursery'], seats:[], tags:['trim'], wall:true },

  // ==== 12. person 人物（恰好 12 个动作）：不落地、不占位、没有尺寸 ========
  //   needs = 这个动作要现场有什么才成立；null = 哪儿都能发生
  { id:'sit_sofa',  cn:'坐沙发', cat:'person', placeable:false, body:'sit_soft', needs:'seat',
    note:'陷进软座，主区会客事件的主角' },
  { id:'sit_chair', cn:'坐椅',   cat:'person', placeable:false, body:'sit_up',   needs:'seat',
    note:'端坐，腿成 L，餐桌与书桌前的标准姿态' },
  { id:'sit_stool', cn:'坐凳',   cat:'person', placeable:false, body:'sit_high', needs:'seat',
    note:'高凳垂腿，吧台与岛台前的姿态' },
  { id:'walk',      cn:'走',     cat:'person', placeable:false, body:'walk',     needs:'path',
    note:'只在通行区来回，绝不穿越主区家具' },
  { id:'cook',      cn:'烹',     cat:'person', placeable:false, body:'stand',    needs:'cook',
    note:'站在操作带前两三点来回：灶—水槽—台面' },
  { id:'serve',     cn:'侍',     cat:'person', placeable:false, body:'stand',    needs:'bar',
    note:'站在吧身内侧出品与收银，面朝客席' },
  { id:'read',      cn:'读',     cat:'person', placeable:false, body:'sit_up',   needs:'seat',
    note:'低头静止久坐，配阅读角的灯与椅' },
  { id:'talk',      cn:'谈',     cat:'person', placeable:false, body:'stand',    needs:null,
    note:'两人站着交谈，成对出现、彼此转向' },
  { id:'gaze',      cn:'望窗',   cat:'person', placeable:false, body:'stand',    needs:'window',
    note:'站在窗墙前朝外看，给外立面制造表情' },
  { id:'bedside',   cn:'睡沿',   cat:'person', placeable:false, body:'sit_up',   needs:'bed',
    note:'坐在床沿，用的是卧具的第三个口袋而不是躺口袋' },
  { id:'kidplay',   cn:'孩玩',   cat:'person', placeable:false, body:'sit_soft', needs:null,
    note:'席地而坐玩耍，个头矮、动作碎' },
  { id:'cat',       cn:'猫',     cat:'person', placeable:false, body:'lie',      needs:null,
    note:'趴在任意柔软或高处的面上，不需要任何套件支撑' }
];
