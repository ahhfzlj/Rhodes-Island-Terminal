import type { EndfieldGachaRecord, EndfieldPoolType } from '../../src/types/index.js';
import { parseImportedEndfieldGachaJson } from '../../src/utils/parsers.js';

export { parseImportedEndfieldGachaJson };

const CHAR_POOL_TYPES: Array<{ apiType: string; localType: EndfieldPoolType }> = [
  { apiType: 'E_CharacterGachaPoolType_Special', localType: 'special' },
  { apiType: 'E_CharacterGachaPoolType_Standard', localType: 'standard' },
  { apiType: 'E_CharacterGachaPoolType_Beginner', localType: 'beginner' },
];

export interface FetchEndfieldParams {
  token: string;
  serverId?: string;
  lang?: string;
  host?: string;
}

export async function fetchEndfieldGachaRecords(
  params: FetchEndfieldParams
): Promise<EndfieldGachaRecord[]> {
  const {
    token,
    serverId = '1',
    lang = 'zh-cn',
    host = 'https://ef-webview.hypergryph.com',
  } = params;

  const allRecords: EndfieldGachaRecord[] = [];
  let anySuccess = false;
  let lastErrorMsg = '';

  // 1. Fetch Character Pools
  for (const pool of CHAR_POOL_TYPES) {
    let seqId = '';
    let pages = 0;

    while (pages < 100) {
      pages += 1;
      const query = new URLSearchParams({
        server_id: serverId,
        pool_type: pool.apiType,
        lang,
        token,
      });
      if (seqId) query.set('seq_id', seqId);

      let res: Response;
      try {
        res = await fetch(`${host}/api/record/char?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        });
      } catch (err) {
        lastErrorMsg = err instanceof Error ? err.message : String(err);
        break;
      }

      const json: any = await res.json().catch(() => null);
      if (!res.ok || !json || (json.code !== 0 && json.status !== 0)) {
        lastErrorMsg = json?.msg || json?.message || `HTTP ${res.status}`;
        break;
      }

      anySuccess = true;
      const list: any[] = json.data?.list || [];
      if (list.length === 0) break;

      for (const item of list) {
        const rawTs = Number(item.gachaTs || item.ts || 0);
        const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
        const seq = String(item.seqId || item.seq_id || '');
        const rarityNum = Number(item.rarity ?? 4);
        const rarity = (
          rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : 4
        ) as EndfieldGachaRecord['rarity'];

        allRecords.push({
          id: `char_${seq || `${tsMs}_${item.charId || item.charName}`}`,
          seqId: seq,
          ts: tsMs,
          poolId: String(item.poolId || pool.apiType),
          poolName: String(item.poolName || '寻访活动'),
          poolType: pool.localType,
          itemId: String(item.charId || item.itemId || ''),
          itemName: String(item.charName || item.itemName || '未知干员'),
          rarity,
          isFeatured: Boolean(item.isFeatured ?? item.isUp ?? false),
          isFree: Boolean(item.isFree ?? false),
        });
      }

      if (json.data?.hasMore === false || list.length < 5) break;
      const nextSeq = String(list[list.length - 1]?.seqId || '');
      if (!nextSeq || nextSeq === seqId) break;
      seqId = nextSeq;
    }
  }

  // 2. Fetch Weapon Pool directly (/api/record/weapon)
  try {
    let seqId = '';
    let pages = 0;
    while (pages < 100) {
      pages += 1;
      const wQuery = new URLSearchParams({
        server_id: serverId,
        lang,
        token,
      });
      if (seqId) wQuery.set('seq_id', seqId);

      const wRes = await fetch(`${host}/api/record/weapon?${wQuery.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const wJson: any = await wRes.json().catch(() => null);
      if (!wRes.ok || !wJson || (wJson.code !== 0 && wJson.status !== 0)) break;

      anySuccess = true;
      const list: any[] = wJson.data?.list || [];
      if (list.length === 0) break;

      for (const item of list) {
        const rawTs = Number(item.gachaTs || item.ts || 0);
        const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
        const seq = String(item.seqId || item.seq_id || '');
        const rarityNum = Number(item.rarity ?? 4);
        const rarity = (
          rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : 4
        ) as EndfieldGachaRecord['rarity'];

        allRecords.push({
          id: `wp_${seq || `${tsMs}_${item.weaponId || item.weaponName}`}`,
          seqId: seq,
          ts: tsMs,
          poolId: String(item.poolId || 'weapon'),
          poolName: String(item.poolName || '武库申领'),
          poolType: 'weapon',
          itemId: String(item.weaponId || item.itemId || ''),
          itemName: String(item.weaponName || item.itemName || '未知武器'),
          rarity,
          isFeatured: Boolean(item.isFeatured ?? item.isUp ?? false),
          isFree: Boolean(item.isFree ?? false),
        });
      }

      if (wJson.data?.hasMore === false || list.length < 5) break;
      const nextSeq = String(list[list.length - 1]?.seqId || '');
      if (!nextSeq || nextSeq === seqId) break;
      seqId = nextSeq;
    }
  } catch {
    // Weapon endpoint is optional
  }

  if (!anySuccess && lastErrorMsg) {
    throw new Error(
      `获取终末地抽卡记录失败 (${lastErrorMsg})，请确认链接或 Token 是否在有效期内`
    );
  }

  return allRecords;
}
