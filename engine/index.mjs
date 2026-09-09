// ============================================================
// 📦 CosmoPolis 量化引擎 · 唯一入口
// 别的项目要用这台引擎,只 import 这一个文件就够了:
//   import { assemble, planRoom, castRoom, auditRoom, auditCity } from '<路径>/engine/index.mjs';
// 引擎【零依赖】(node 里直接能跑),渲染是另一层(view/),换渲染器不用动引擎。
// 五层:社区 assemble → 功能 FUNCTIONS → 区域 cutZones → 套件 planRoom → 人物 castRoom
// ============================================================

export const COSMOPOLIS_VERSION = '1.0.0';

export { makeRng, strHash } from './rng.mjs';
export { cutZones, pullFor, pathIsClear, overlaps, inside,
         ZONE_ROLES, ROLE_IDS, ROLE_CN, PROGRAMS, PROGRAM_IDS, PROGRAM_CN } from './zones.mjs';
export { KITS, KIT_CATS } from './kits.mjs';
export { FUNCTIONS, FN_FAMILIES } from './functions.mjs';
export { SCRIPTS, BODIES } from './people.mjs';
export { BAND_RULES, ADJACENCY, STREET, FLOOR_MIX } from './city.mjs';
export { planRoom, auditRoom, candidates, fitsZone, isPlaceable, isWallCat,
         FN_BY_ID, CAT_BY_ID, KIT_BY_ID } from './room.mjs';
export { castRoom, stepActors, ACTS, ACT_BY_ID } from './actors.mjs';
export { assemble, auditCity, bandOf, poolFor, statsOf } from './building.mjs';

/** 一行拿到「这台引擎现在有多大」——给页面打版本印/给体检报数用 */
export async function capabilities() {
  const [{ KITS, KIT_CATS }, { FUNCTIONS, FN_FAMILIES }, { SCRIPTS }, { PROGRAMS, ZONE_ROLES }] =
    await Promise.all([import('./kits.mjs'), import('./functions.mjs'), import('./people.mjs'), import('./zones.mjs')]);
  return {
    version: COSMOPOLIS_VERSION,
    functions: FUNCTIONS.length, families: FN_FAMILIES.length,
    kitCats: KIT_CATS.length, kits: KITS.length,
    zoneRoles: ZONE_ROLES.length, programs: PROGRAMS.length,
    scripts: Object.keys(SCRIPTS).length,
  };
}
