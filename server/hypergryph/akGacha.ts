import type { AkGachaRecord } from '../../src/types/index.js';
import {
  mapAkCategoryCode,
  parseImportedAkGachaJson,
} from '../../src/utils/parsers.js';

export { parseImportedAkGachaJson };

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function loginAkRoleCookie(u8Token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch('https://ak.hypergryph.com/user/api/role/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        token: u8Token,
        source_from: '',
        share_type: '',
        share_by: '',
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`连接明日方舟寻访中心失败 (${msg})`);
  }

  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json || (json.code !== 0 && json.status !== 0)) {
    throw new Error(
      `明日方舟角色鉴权失败: ${json?.msg || json?.message || `HTTP ${res.status}`}`
    );
  }

  const cookiesList: string[] =
    typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : [res.headers.get('set-cookie') || ''];
  const joined = cookiesList.join('; ');
  const cookieMatch = joined.match(/ak-user-center=([^;]+)/);
  if (!cookieMatch) {
    throw new Error('角色登录成功但未下发 ak-user-center cookie，请重新登录后重试');
  }
  return `ak-user-center=${cookieMatch[1]}`;
}

function handleAkGachaJsonError(json: any, httpStatus: number, context: string): void {
  if (!json) {
    throw new Error(`${context}失败：接口返回非 JSON 数据 (HTTP ${httpStatus})`);
  }
  if (json.reason === 'UN_LOGIN') {
    throw new Error('寻访访问凭据已过期（UN_LOGIN），请重新登录明日方舟账号');
  }
  if (json.reason === 'MissingCookie') {
    throw new Error('缺少 ak-user-center cookie（MissingCookie），请重新登录');
  }
  if (json.reason) {
    throw new Error(`${context}鉴权失败 (${json.reason}: ${json.msg || json.message || ''})`);
  }
  if (typeof json.code === 'number' && json.code !== 0) {
    throw new Error(`${context}失败: ${json.msg || json.message || `错误码 ${json.code}`}`);
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    throw new Error(`${context}失败 (HTTP ${httpStatus})`);
  }
}

export async function fetchAkGachaRecords(
  u8Token: string,
  uid: string,
  accountToken?: string
): Promise<AkGachaRecord[]> {
  const cookie = await loginAkRoleCookie(u8Token);
  const authHeaders: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Referer: 'https://ak.hypergryph.com/',
    'X-Role-Token': u8Token,
    Cookie: cookie,
  };
  if (accountToken) {
    authHeaders['X-Account-Token'] = accountToken;
  }

  const cateRes = await fetch(
    `https://ak.hypergryph.com/user/api/inquiry/gacha/cate?uid=${encodeURIComponent(uid)}`,
    { headers: authHeaders, signal: AbortSignal.timeout(12000) }
  );
  const cateJson: any = await cateRes.json().catch(() => null);
  handleAkGachaJsonError(cateJson, cateRes.status, '获取卡池分类');

  const rawCateList: any[] = Array.isArray(cateJson.data)
    ? cateJson.data
    : Array.isArray(cateJson.data?.list)
    ? cateJson.data.list
    : [];

  const categories: Array<{ id: string; name: string }> =
    rawCateList.length > 0
      ? rawCateList.map((c: any) => ({
          id: String(c.id || c.cate || c.category || 'normal'),
          name: String(c.name || c.title || c.id || '标准寻访'),
        }))
      : [{ id: 'normal', name: '常规寻访' }];

  const allRecords: AkGachaRecord[] = [];
  let firstError: Error | null = null;

  for (const cate of categories) {
    let gachaTs = '';
    let pos = '';
    let pages = 0;

    while (pages < 50) {
      pages += 1;
      const params = new URLSearchParams({
        uid,
        category: cate.id,
        size: '100',
      });
      if (gachaTs && pos !== '') {
        params.set('gachaTs', gachaTs);
        params.set('pos', pos);
      }

      const histRes = await fetch(
        `https://ak.hypergryph.com/user/api/inquiry/gacha/history?${params.toString()}`,
        { headers: authHeaders, signal: AbortSignal.timeout(12000) }
      );
      const histJson: any = await histRes.json().catch(() => null);
      try {
        handleAkGachaJsonError(histJson, histRes.status, `拉取「${cate.name}」`);
      } catch (err) {
        if (!firstError) {
          firstError = err instanceof Error ? err : new Error(String(err));
        }
        break;
      }

      const list: any[] = histJson.data?.list || [];
      if (list.length === 0) break;

      for (const item of list) {
        const rawTs = Number(item.gachaTs || item.ts || 0);
        const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
        const itemPos = Number(item.pos ?? 0);
        const charId = String(item.charId || item.id || '');
        const charName = String(item.charName || item.name || '未知干员');
        const rawRarity = Number(item.rarity ?? 2);
        // Official ak.hypergryph.com API uses 0-based rarity (5=6★, 4=5★, 3=4★, 2=3★)
        const starNum = rawRarity >= 0 && rawRarity <= 5 ? rawRarity + 1 : rawRarity;
        const rarity = (
          starNum >= 6 ? 6 : starNum === 5 ? 5 : starNum === 4 ? 4 : 3
        ) as AkGachaRecord['rarity'];

        allRecords.push({
          id: `${tsMs}_${itemPos}_${charId || charName}`,
          ts: tsMs,
          poolName: String(item.poolName || cate.name),
          category: mapAkCategoryCode(cate.id, item.poolName || cate.name),
          charId,
          charName,
          rarity,
          isNew: Boolean(item.isNew),
          pos: itemPos,
        });
      }

      if (!histJson.data?.hasMore) break;
      const last = list[list.length - 1];
      const nextTs = String(last.gachaTs || last.ts || '');
      const nextPos = String(last.pos ?? '');
      if (!nextTs || (nextTs === gachaTs && nextPos === pos)) break;
      gachaTs = nextTs;
      pos = nextPos;
    }
  }

  if (allRecords.length === 0 && firstError) {
    throw firstError;
  }

  return allRecords;
}
