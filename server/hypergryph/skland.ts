import type {
  DoctorProfile,
  GameBindingItem,
  GarrisonSeasonData,
  RogueThemeData,
} from '../../src/types/index.js';
import {
  normalizeGarrisonPayload,
  normalizeSklandGarrisonResponse,
  parseSklandRogue,
} from '../../src/utils/parsers.js';
import { generateSklandHeaders } from './signer.js';

export { normalizeGarrisonPayload };

async function sklandGet<T>(
  apiPath: string,
  query: string,
  cred: string,
  signToken: string,
  dId: string = ''
): Promise<T> {
  const headers = generateSklandHeaders(apiPath, query, cred, signToken, dId);
  const fullUrl = query
    ? `https://zonai.skland.com${apiPath}?${query}`
    : `https://zonai.skland.com${apiPath}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        ...headers,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`森空岛接口连接失败 (${msg})`);
  }

  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json || (typeof json.code === 'number' && json.code !== 0)) {
    const msg = json?.message || json?.msg || `HTTP ${res.status}`;
    if (res.status === 401 || json?.code === 10002) {
      throw new Error(`森空岛凭证已失效或签名错误 (${msg})，请重新登录或导入 Cred`);
    }
    throw new Error(`森空岛请求失败: ${msg}`);
  }

  return json.data as T;
}

export async function fetchSklandBindings(
  cred: string,
  signToken: string,
  dId: string = ''
): Promise<{ akBindings: GameBindingItem[]; endfieldBindings: GameBindingItem[] }> {
  const data = await sklandGet<{ list?: Array<{ appCode?: string; bindingList?: any[] }> }>(
    '/api/v1/game/player/binding',
    '',
    cred,
    signToken,
    dId
  );

  const akBindings: GameBindingItem[] = [];
  const endfieldBindings: GameBindingItem[] = [];

  for (const group of data?.list || []) {
    const target =
      group.appCode === 'endfield'
        ? endfieldBindings
        : group.appCode === 'arknights'
        ? akBindings
        : null;
    if (!target) continue;

    for (const item of group.bindingList || []) {
      const channelMasterId = Number(item.channelMasterId || 1);
      target.push({
        uid: String(item.uid || ''),
        nickName: String(item.nickName || item.uid || '博士'),
        channelName:
          item.channelName || (channelMasterId === 2 ? 'B服' : '官服'),
        channelMasterId,
        isOfficial: channelMasterId === 1,
      });
    }
  }

  return { akBindings, endfieldBindings };
}

export async function fetchArknightsPlayerInfo(
  cred: string,
  signToken: string,
  uid: string,
  dId: string = '',
  channelName: string = '官服'
): Promise<{ profile: DoctorProfile; rogue: RogueThemeData[] }> {
  const data = await sklandGet<any>(
    '/api/v1/game/player/info',
    `uid=${encodeURIComponent(uid)}`,
    cred,
    signToken,
    dId
  );

  const status = data?.status || {};
  const charInfoMap = data?.charInfoMap || {};
  const secretaryCharId = status?.secretary?.charId;
  const secretaryName =
    (secretaryCharId && charInfoMap[secretaryCharId]?.name) ||
    status?.secretary?.name ||
    '阿米娅';

  const profile: DoctorProfile = {
    uid: String(status.uid || uid),
    nickName: String(status.name || status.nickName || `博士#${uid.slice(-4)}`),
    channelName,
    level: Number(status.level || 1),
    apCurrent: Number(status.ap?.current ?? 0),
    apMax: Number(status.ap?.max ?? 135),
    charCount: Array.isArray(data?.chars) ? data.chars.length : 0,
    secretaryName,
    registerTs: Number(status.registerTs || 0) * 1000,
  };

  const rogue: RogueThemeData[] = parseSklandRogue(data?.rogue || data?.rogueInfo);
  return { profile, rogue };
}

export async function fetchArknightsGarrison(
  cred: string,
  signToken: string,
  uid: string,
  dId: string = ''
): Promise<GarrisonSeasonData> {
  const resourceData = await sklandGet<any>(
    '/api/ms/game/arknights/garrison/resource',
    '',
    cred,
    signToken,
    dId
  );

  const activityId = String(
    resourceData?.resources?.[0]?.versionInfo?.activityId || ''
  ).trim();
  if (!activityId) {
    throw new Error('森空岛未返回有效的卫戍协议活动 ID');
  }

  const query = `uid=${encodeURIComponent(uid)}&activityId=${encodeURIComponent(
    activityId
  )}`;
  const infoData = await sklandGet<any>(
    '/api/ms/game/arknights/garrison/info',
    query,
    cred,
    signToken,
    dId
  );

  return normalizeSklandGarrisonResponse(infoData, resourceData);
}
