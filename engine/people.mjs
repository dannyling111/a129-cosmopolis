// ============================================================
// CosmoPolis 量化积木城市 · 第五层【人物】
// 依据:engine/SCHEMA.md v1 §0.1 / §0.5 / §3
// 一个功能一份脚本,key 与 functions.mjs 的 FUNCTIONS[].id 一一对应(恰好 48 份)。
// 铁律:seats[].zone 必须是该功能【确实摆了 seat 座具或 bed 睡眠】的那个区域,
//       否则人会坐在空气里。没有座具的功能(家庭厨房/瑜伽/楼梯厅/车棚…)一律 seats: []。
// 服 service 族多数是"没人久留"的空间,脚本以 walk/busy 为主,不硬塞座位。
// 无任何 import,纯数据。
// ============================================================

// ── 身体姿态(恰好 6 个,id 照 SCHEMA §0.5)──────────────────
export const BODIES = [
  { id:'sit_soft', cn:'沉进沙发',
    how:'骨盆后倾陷进坐垫,大腿几乎与地面平行,背靠住,双臂搭扶手,小腿前伸。' },
  { id:'sit_up',   cn:'端坐',
    how:'臀坐前三分之一,大腿与小腿约成 90 度的 L 形,脊背立直,双脚平踩地面。' },
  { id:'sit_high', cn:'高凳垂腿',
    how:'坐面高于膝,双腿自然垂下或一只脚勾住横档,躯干略前倾靠向台面。' },
  { id:'lie',      cn:'躺',
    how:'整个身体水平铺在床面,头落枕上,双臂放身侧或搭腹前,朝向沿床的长轴。' },
  { id:'stand',    cn:'站',
    how:'双脚与肩同宽,重心略偏一侧,面朝当前正在操作的那件家具。' },
  { id:'walk',     cn:'走',
    how:'沿 path 区的中线迈步,两臂小幅摆动,视线朝着下一个落脚点。' }
];

// ── 48 份人物脚本 ──────────────────────────────────────────
export const SCRIPTS = {

  // ══════════ dwell 住 ══════════

  living: {
    seats  : [ {zone:'main', n:[1,3], body:'sit_soft', hold:[20,90]},
               {zone:'aux',  n:[0,1], body:'sit_up',   hold:[15,45]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [ {kind:'cat', zone:'main'} ],
    forbid : ['cross_table'],
    note   : '一家人瘫在沙发上说话看电视,偶尔有人起来去倒杯水。' },

  salon: {
    seats  : [ {zone:'main', n:[2,4], body:'sit_soft', hold:[120,600]},
               {zone:'aux',  n:[0,1], body:'sit_up',   hold:[60,300]} ],
    walkers: [1,2], busy:[0,1],
    pets   : [],
    forbid : ['cross_table'],
    note   : '客人坐一会儿聊两句就换人,单椅之间总有人在起身让座。' },

  dining: {
    seats  : [ {zone:'main', n:[3,6], body:'sit_up', hold:[300,900]} ],
    walkers: [0,0], busy:[0,0],
    pets   : [ {kind:'dog', zone:'path'} ],
    forbid : ['cross_table'],
    note   : '一桌人坐死在餐椅上吃饭,全程没有人穿过桌子。' },

  bedroom: {
    seats  : [ {zone:'main', n:[1,2], body:'lie', hold:[60,180]} ],
    walkers: [0,0], busy:[0,0],
    pets   : [ {kind:'cat', zone:'main'} ],
    forbid : ['cross_bed'],
    note   : '夜里躺着不动,整格几乎没有走动,只有猫在床脚挪位置。' },

  kidroom: {
    seats  : [ {zone:'main', n:[0,1], body:'lie',    hold:[20,60]},
               {zone:'aux',  n:[0,1], body:'sit_up', hold:[20,60]} ],
    walkers: [1,2], busy:[0,1],
    pets   : [ {kind:'dog', zone:'main'} ],
    forbid : ['cross_bed'],
    note   : '一个在书桌前写作业,另一个在地垫上翻滚,狗跟着跑。' },

  nursery: {
    seats  : [ {zone:'main', n:[0,1], body:'lie',    hold:[120,600]},
               {zone:'main', n:[0,1], body:'sit_up', hold:[60,300]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [],
    forbid : ['cross_bed','loud'],
    note   : '婴儿躺着,大人坐在摇椅上轻轻晃,除此之外没人进来。' },

  guestroom: {
    seats  : [ {zone:'main', n:[0,1], body:'lie',    hold:[40,120]},
               {zone:'main', n:[0,1], body:'sit_up', hold:[10,30]} ],
    walkers: [0,1], busy:[0,0],
    pets   : [],
    forbid : ['cross_bed'],
    note   : '客人多半在整理行李,坐床沿上待一会儿再躺下。' },

  vanity: {
    seats  : [ {zone:'main', n:1, body:'sit_up', hold:[60,240]} ],
    walkers: [0,0], busy:[0,1],
    pets   : [],
    forbid : ['cross_mirror'],
    note   : '坐在镜前一动不动地上妆,身后偶尔有人来抽屉里取东西。' },

  // ══════════ make 作 ══════════

  study: {
    seats  : [ {zone:'main', n:1,     body:'sit_up',   hold:[900,3600]},
               {zone:'aux',  n:[0,1], body:'sit_soft', hold:[600,2400]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [ {kind:'cat', zone:'aux'} ],
    forbid : ['cross_desk'],
    note   : '一个人在书桌前坐很久,想不动了就挪到角落那把阅读椅上。' },

  library: {
    seats  : [ {zone:'main', n:[2,3], body:'sit_up',   hold:[900,3600]},
               {zone:'aux',  n:[0,1], body:'sit_soft', hold:[600,1800]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [],
    forbid : ['cross_table','loud'],
    note   : '长桌上一排人埋头不动,只有找书的偶尔沿书墙挪几步。' },

  coworking: {
    seats  : [ {zone:'main', n:[3,5], body:'sit_up', hold:[600,2400]},
               {zone:'aux',  n:[0,1], body:'sit_high', hold:[60,240]} ],
    walkers: [1,2], busy:[1,2],
    pets   : [],
    forbid : ['cross_desk'],
    note   : '工位上的人长时间伏案,总有一两个在咖啡角站着聊天。' },

  music: {
    seats  : [ {zone:'main', n:[1,2], body:'sit_up', hold:[600,2400]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [],
    forbid : ['cross_piano'],
    note   : '弹的人端坐琴凳一动不动,听的人站在琴身旁边。' },

  atelier: {
    seats  : [ {zone:'main', n:[0,1], body:'sit_up', hold:[120,600]} ],
    walkers: [1,2], busy:[1,1],
    pets   : [ {kind:'cat', zone:'window'} ],
    forbid : ['cross_easel'],
    note   : '画两笔就退后两步看,站着的时间比坐着多得多。' },

  sewing: {
    seats  : [ {zone:'main', n:1, body:'sit_up', hold:[600,2400]} ],
    walkers: [0,1], busy:[1,1],
    pets   : [],
    forbid : ['cross_table'],
    note   : '一个人钉在缝纫机前踩踏板,起身只为去裁剪台量一段布。' },

  woodshop: {
    seats  : [ {zone:'main', n:[0,1], body:'sit_high', hold:[30,120]} ],
    walkers: [1,2], busy:[1,2],
    pets   : [],
    forbid : ['enter_machine_zone'],
    note   : '人围着工作台转圈,只有打磨细活时才靠上那把高凳。' },

  darkroom: {
    seats  : [ {zone:'main', n:1, body:'sit_high', hold:[300,1200]} ],
    walkers: [0,0], busy:[1,1],
    pets   : [],
    forbid : ['open_door'],
    note   : '一个人坐在水槽前盯着显影盘,几乎整场不挪窝。' },

  // ══════════ cook 食 ══════════

  kitchen: {
    seats  : [],
    walkers: [0,1], busy:[1,1],
    pets   : [],
    forbid : ['cross_cook_triangle'],
    note   : '一个人钉在灶前颠锅,另一个进来取个东西就走,没人坐下。' },

  openkitchen: {
    seats  : [ {zone:'main', n:[2,4], body:'sit_high', hold:[300,1200]} ],
    walkers: [0,1], busy:[1,2],
    pets   : [ {kind:'dog', zone:'path'} ],
    forbid : ['enter_cook_side'],
    note   : '岛台一侧有人做饭一直站着,另一侧几个人坐高凳看着他说话。' },

  cafe: {
    seats  : [ {zone:'main', n:[2,5], body:'sit_up',   hold:[240,900]},
               {zone:'aux',  n:[0,1], body:'sit_high', hold:[120,400]} ],
    walkers: [1,3], busy:[1,2],
    pets   : [ {kind:'dog', zone:'window'} ],
    forbid : ['cross_bar'],
    note   : '客人坐着看窗外,店员在吧台与桌子之间不停来回。' },

  bakery: {
    seats  : [],
    walkers: [2,4], busy:[1,2],
    pets   : [],
    forbid : ['enter_backline'],
    note   : '客人端着托盘沿柜台走一圈,店员在后场烤箱前忙,全店无座。' },

  teahouse: {
    seats  : [ {zone:'main', n:[2,4], body:'sit_up', hold:[600,1800]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [ {kind:'cat', zone:'window'} ],
    forbid : ['cross_table'],
    note   : '几个人围着矮桌慢慢喝茶,一坐就是半小时不换姿势。' },

  winebar: {
    seats  : [ {zone:'aux',  n:[1,2], body:'sit_high', hold:[180,600]},
               {zone:'main', n:[2,4], body:'sit_soft', hold:[300,1200]} ],
    walkers: [1,3], busy:[1,1],
    pets   : [],
    forbid : ['cross_bar'],
    note   : '吧台一排高凳垂着腿,卡座里的人陷进沙发,酒保绕着吧台转。' },

  juicebar: {
    seats  : [ {zone:'main', n:[1,2], body:'sit_high', hold:[60,240]} ],
    walkers: [1,3], busy:[1,1],
    pets   : [],
    forbid : ['enter_counter'],
    note   : '大多数人站着喝完就走,只有一两个坐上高凳待几分钟。' },

  piecorner: {
    seats  : [],
    walkers: [2,5], busy:[1,1],
    pets   : [],
    forbid : ['enter_counter'],
    note   : '窗口前排着几个人,买了拿着就走,店里只有一个师傅在烤。' },

  // ══════════ shop 市 ══════════

  florist: {
    seats  : [],
    walkers: [1,2], busy:[1,1],
    pets   : [ {kind:'cat', zone:'window'} ],
    forbid : ['cross_bucket'],
    note   : '老板站在扎花台前包花,客人绕着一地花桶转圈。' },

  bookstore: {
    seats  : [ {zone:'main', n:[1,2], body:'sit_up',   hold:[300,1200]},
               {zone:'aux',  n:[0,1], body:'sit_soft', hold:[400,1500]} ],
    walkers: [1,3], busy:[0,1],
    pets   : [ {kind:'cat', zone:'aux'} ],
    forbid : ['block_aisle'],
    note   : '大部分人站在书架前翻,少数几个占住拐角的椅子一直不走。' },

  grocer: {
    seats  : [],
    walkers: [3,6], busy:[1,2],
    pets   : [],
    forbid : ['block_aisle'],
    note   : '所有人都在走,挑挑拣拣掂来掂去,没有一个坐下的。' },

  records: {
    seats  : [ {zone:'main', n:[0,1], body:'sit_up', hold:[120,600]} ],
    walkers: [2,4], busy:[0,1],
    pets   : [],
    forbid : ['block_aisle'],
    note   : '人俯身在翻箱上一张张翻,偶尔有人坐下试听一整面。' },

  boutique: {
    seats  : [ {zone:'main', n:[0,1], body:'sit_soft', hold:[180,600]} ],
    walkers: [1,3], busy:[1,1],
    pets   : [],
    forbid : ['enter_fitting'],
    note   : '试衣的人一直在走,陪同的人坐在那把椅子上等着。' },

  hairsalon: {
    seats  : [ {zone:'main', n:[2,4], body:'sit_up', hold:[900,2700]},
               {zone:'aux',  n:[0,1], body:'lie',    hold:[300,600]} ],
    walkers: [1,2], busy:[1,2],
    pets   : [],
    forbid : ['cross_chair'],
    note   : '客人被围裙固定在椅子上不能动,师傅一直绕着他们走。' },

  bikeshop: {
    seats  : [ {zone:'aux', n:[0,1], body:'sit_high', hold:[120,600]} ],
    walkers: [1,3], busy:[1,2],
    pets   : [],
    forbid : ['enter_workbench'],
    note   : '客人在车架间挑车,老板多半弓在修车台前,偶尔坐上那把高凳。' },

  lobby: {
    seats  : [ {zone:'main', n:[1,3], body:'sit_soft', hold:[120,600]},
               {zone:'aux',  n:[0,1], body:'sit_up',   hold:[300,1800]} ],
    walkers: [2,5], busy:[1,1],
    pets   : [],
    forbid : ['enter_counter'],
    note   : '人不停穿过门厅,只有等人的坐在沙发上,接待员守着台子。' },

  // ══════════ gather 聚 ══════════

  playroom: {
    seats  : [ {zone:'main', n:[1,2], body:'sit_soft', hold:[300,1200]} ],
    walkers: [1,3], busy:[0,1],
    pets   : [ {kind:'dog', zone:'main'} ],
    forbid : ['cross_mat'],
    note   : '大人坐在边上的软座里看着,小孩在地垫上到处跑。' },

  gallery: {
    seats  : [ {zone:'main', n:[0,2], body:'sit_up', hold:[60,300]} ],
    walkers: [2,5], busy:[0,1],
    pets   : [],
    forbid : ['touch_wall','cross_plinth'],
    note   : '大多数人贴着墙慢慢走,累了才在中间那条长凳上坐一会儿。' },

  cinema: {
    seats  : [ {zone:'main', n:[5,8], body:'sit_soft', hold:[1800,5400]} ],
    walkers: [0,0], busy:[0,0],
    pets   : [],
    forbid : ['block_screen','cross_row'],
    note   : '一排人坐死不动地看片,全程没有任何人起身。' },

  yoga: {
    seats  : [],
    walkers: [1,3], busy:[2,4],
    pets   : [],
    forbid : ['cross_mat'],
    note   : '所有人各占一块垫子站着或伸展,老师在垫与垫之间来回走。' },

  greenhouse: {
    seats  : [],
    walkers: [1,2], busy:[1,2],
    pets   : [ {kind:'cat', zone:'path'} ],
    forbid : ['cross_bed_row'],
    note   : '人在苗床之间弯腰浇水,一直在挪位置,从不坐下。' },

  roofgarden: {
    seats  : [ {zone:'main', n:[1,3], body:'sit_up', hold:[300,1800]} ],
    walkers: [2,4], busy:[0,1],
    pets   : [ {kind:'dog', zone:'path'} ],
    forbid : ['climb_parapet'],
    note   : '有人坐在花丛里的椅子上发呆,更多人端着杯子沿花径绕圈。' },

  roofbbq: {
    seats  : [ {zone:'main', n:[2,4], body:'sit_up', hold:[300,1200]} ],
    walkers: [1,3], busy:[1,2],
    pets   : [],
    forbid : ['touch_grill','climb_parapet'],
    note   : '烤的人一直站在台前翻动,围坐的人时不时起来夹一块。' },

  roofdining: {
    seats  : [ {zone:'main', n:[4,6], body:'sit_up', hold:[600,2400]} ],
    walkers: [0,2], busy:[0,1],
    pets   : [],
    forbid : ['cross_table','climb_parapet'],
    note   : '长桌坐满,吃到很晚也没人挪窝,只有上菜的人在两侧走。' },

  // ══════════ service 服 ══════════

  stairhall: {
    seats  : [],
    walkers: [1,4], busy:[0,0],
    pets   : [],
    forbid : ['block_stair','loiter'],
    note   : '人只是穿过去,上下楼各走一侧,没有任何人停下来。' },

  laundry: {
    seats  : [],
    walkers: [0,1], busy:[1,1],
    pets   : [],
    forbid : ['block_machine'],
    note   : '一个人站在机器前装卸衣物,转身到台面上折叠,全程不坐。' },

  mailroom: {
    seats  : [],
    walkers: [1,2], busy:[0,1],
    pets   : [],
    forbid : ['block_boxes'],
    note   : '住户进来开箱取件就走,前后不到半分钟,常常空无一人。' },

  bikepark: {
    seats  : [],
    walkers: [1,3], busy:[0,1],
    pets   : [],
    forbid : ['block_rack','ride_inside'],
    note   : '人推着车进来上锁再走出去,谁也不会在这儿待着。' },

  storageroom: {
    seats  : [],
    walkers: [0,1], busy:[0,1],
    pets   : [],
    forbid : ['block_shelf'],
    note   : '一个人进来取货放货,转个身就出去,大多数时候是空的。' },

  waterplant: {
    seats  : [],
    walkers: [0,1], busy:[1,1],
    pets   : [ {kind:'cat', zone:'path'} ],
    forbid : ['cross_wet'],
    note   : '偶尔有人来接一盆水或掐一把香草,弯腰几秒就走。' },

  duty: {
    seats  : [ {zone:'main', n:1, body:'sit_up', hold:[1200,3600]} ],
    walkers: [0,1], busy:[0,1],
    pets   : [],
    forbid : ['enter_counter'],
    note   : '值班的人整晚坐在桌后盯着屏,门外有人经过才抬一下头。' },

  skybridge: {
    seats  : [ {zone:'main', n:[0,2], body:'sit_up', hold:[120,600]} ],
    walkers: [2,5], busy:[0,0],
    pets   : [],
    forbid : ['block_bridge','climb_rail'],
    note   : '大部分人只是穿过,少数几个坐在尽头那条长凳上看外面。' }

};
