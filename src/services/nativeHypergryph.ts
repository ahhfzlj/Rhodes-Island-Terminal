import { CapacitorHttp } from '@capacitor/core';
import type {
  AkGachaRecord,
  AuthStatus,
  DoctorProfile,
  EndfieldGachaRecord,
  EndfieldPoolType,
  GameAuthState,
  GameBindingItem,
  GameMode,
  GarrisonSeasonData,
  RogueThemeData,
} from '../types/index.js';
import {
  mergeAkGachaRecords,
  mergeEndfieldGachaRecords,
  parseEndfieldGachaUrl,
} from '../utils/analytics.js';
import {
  mapAkCategoryCode,
  normalizeGarrisonPayload,
  normalizeSklandGarrisonResponse,
  normalizeSklandRogueDetail,
  parseImportedAkGachaJson,
  parseImportedEndfieldGachaJson,
  parseSklandRogue,
  sortRogueThemesDesc,
} from '../utils/parsers.js';
import { generateNativeSklandHeaders } from './nativeSigner.js';

const STORAGE_KEY = 'ak_ef_native_store_v1';
const SKLAND_APP_CODE = '4ca99fa6b56cc2ba';
const AK_USER_CENTER_APP_CODE = 'be36d44aa36bfb5b';
const SKLAND_UA =
  'Skland/1.32.1 (com.hypergryph.skland; build:103201004; Android 33; ) Okhttp/4.11.0';
const WEB_UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

interface NativeGameAuth {
  phoneMasked?: string;
  hgToken?: string;
  sklandCred?: string;
  sklandSignToken?: string;
  dId?: string;
  oauthToken?: string;
  u8Token?: string;
  gachaToken?: string;
  serverId?: string;
  gachaHost?: string;
  bindings: GameBindingItem[];
  activeUid?: string;
}

interface NativeStoreData {
  auth: {
    arknights: NativeGameAuth;
    endfield: NativeGameAuth;
  };
  akProfile: DoctorProfile | null;
  akGacha: AkGachaRecord[];
  akGarrison: GarrisonSeasonData | null;
  akRogue: RogueThemeData[];
  endfieldGacha: EndfieldGachaRecord[];
  lastSync: {
    akProfile?: number;
    akGacha?: number;
    akGarrison?: number;
    endfieldGacha?: number;
  };
}

function createEmptyGameAuth(): NativeGameAuth {
  return { bindings: [] };
}

function createEmptyStore(): NativeStoreData {
  return {
    auth: {
      arknights: createEmptyGameAuth(),
      endfield: createEmptyGameAuth(),
    },
    akProfile: null,
    akGacha: [],
    akGarrison: null,
    akRogue: [],
    endfieldGacha: [],
    lastSync: {},
  };
}

function loadStore(): NativeStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as any;
    const empty = createEmptyStore();

    let akAuth = createEmptyGameAuth();
    let efAuth = createEmptyGameAuth();

    if (parsed?.auth?.arknights || parsed?.auth?.endfield) {
      akAuth = {
        ...createEmptyGameAuth(),
        ...(parsed.auth.arknights || {}),
        bindings: parsed.auth.arknights?.bindings || [],
      };
      efAuth = {
        ...createEmptyGameAuth(),
        ...(parsed.auth.endfield || {}),
        bindings: parsed.auth.endfield?.bindings || [],
      };
    } else if (parsed?.auth) {
      const old = parsed.auth;
      akAuth = {
        phoneMasked: old.phoneMasked,
        hgToken: old.hgToken,
        sklandCred: old.sklandCred,
        sklandSignToken: old.sklandSignToken,
        dId: old.dId,
        oauthToken: old.akOAuthToken,
        u8Token: old.akU8Token,
        bindings: old.akBindings || [],
        activeUid: old.activeAkUid,
      };
      efAuth = {
        phoneMasked: old.phoneMasked,
        hgToken: old.hgToken,
        sklandCred: old.sklandCred,
        sklandSignToken: old.sklandSignToken,
        dId: old.dId,
        u8Token: old.endfieldU8Token,
        gachaToken: old.endfieldGachaToken,
        serverId: old.endfieldServerId,
        gachaHost: old.endfieldHost,
        bindings: old.endfieldBindings || [],
        activeUid: old.activeEndfieldUid,
      };
    }

    return {
      ...empty,
      ...parsed,
      auth: {
        arknights: akAuth,
        endfield: efAuth,
      },
      akGacha: parsed.akGacha || [],
      akRogue: parsed.akRogue || [],
      endfieldGacha: parsed.endfieldGacha || [],
      lastSync: parsed.lastSync || {},
    };
  } catch {
    return createEmptyStore();
  }
}

function saveStore(data: NativeStoreData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function toGameAuthState(auth: NativeGameAuth): GameAuthState {
  const hasSklandCred = Boolean(auth.sklandCred && auth.sklandSignToken);
  const hasU8Token = Boolean(auth.u8Token || auth.gachaToken);
  return {
    authenticated: hasSklandCred || hasU8Token || Boolean(auth.hgToken),
    phoneMasked: auth.phoneMasked,
    hasSklandCred,
    hasU8Token,
    bindings: auth.bindings,
    activeUid: auth.activeUid || auth.bindings[0]?.uid,
  };
}

function toAuthStatus(store: NativeStoreData): AuthStatus {
  const arknights = toGameAuthState(store.auth.arknights);
  const endfield = toGameAuthState(store.auth.endfield);
  return {
    authenticated: arknights.authenticated || endfield.authenticated,
    arknights,
    endfield,
    lastSync: store.lastSync,
  };
}

function createDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function maskPhone(phone: string): string {
  const clean = phone.trim();
  if (clean.length < 7) return clean;
  return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
}

function parseJsonBody(raw: unknown): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

async function nativePostJson<T>(
  url: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): Promise<{ json: T; headers: Record<string, string>; status: number }> {
  const res = await CapacitorHttp.request({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'User-Agent': SKLAND_UA,
      ...extraHeaders,
    },
    data: body,
    connectTimeout: 12000,
    readTimeout: 12000,
  });

  const json = parseJsonBody(res.data);
  if (!json) {
    throw new Error(`鹰角接口返回非 JSON 响应 (HTTP ${res.status})`);
  }

  const code = json?.status ?? json?.code;
  if (res.status < 200 || res.status >= 300 || (typeof code === 'number' && code !== 0)) {
    const serverMsg = json?.msg || json?.message || `HTTP ${res.status}`;
    if (
      String(serverMsg).includes('人机') ||
      String(serverMsg).includes('验证') ||
      code === 10001
    ) {
      throw new Error(
        `触发鹰角安全人机验证 (${serverMsg})，请改用「Cred / Token 手动导入」`
      );
    }
    throw new Error(`鹰角接口验证失败: ${serverMsg}`);
  }

  return { json: json as T, headers: res.headers || {}, status: res.status };
}

async function nativeGetJson<T>(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ json: T; status: number }> {
  const res = await CapacitorHttp.request({
    url,
    method: 'GET',
    headers: {
      'User-Agent': SKLAND_UA,
      Accept: 'application/json',
      ...extraHeaders,
    },
    connectTimeout: 12000,
    readTimeout: 12000,
  });

  const json = parseJsonBody(res.data);
  return { json: json as T, status: res.status };
}

async function sklandGet<T>(
  apiPath: string,
  query: string,
  cred: string,
  signToken: string,
  dId: string = ''
): Promise<T> {
  const headers = generateNativeSklandHeaders(apiPath, query, cred, signToken, dId);
  const fullUrl = query
    ? `https://zonai.skland.com${apiPath}?${query}`
    : `https://zonai.skland.com${apiPath}`;

  const res = await CapacitorHttp.request({
    url: fullUrl,
    method: 'GET',
    headers: {
      ...headers,
      Accept: 'application/json',
    },
    connectTimeout: 12000,
    readTimeout: 12000,
  });

  const json = parseJsonBody(res.data);
  if (
    res.status < 200 ||
    res.status >= 300 ||
    !json ||
    (typeof json.code === 'number' && json.code !== 0)
  ) {
    const msg = json?.message || json?.msg || `HTTP ${res.status}`;
    if (res.status === 401 || json?.code === 10002) {
      throw new Error(`森空岛凭证已失效或签名错误 (${msg})，请重新登录或导入 Cred`);
    }
    throw new Error(`森空岛请求失败: ${msg}`);
  }

  return json.data as T;
}

async function fetchSklandBindings(cred: string, signToken: string, dId: string = '') {
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
        channelName: item.channelName || (channelMasterId === 2 ? 'B服' : '官服'),
        channelMasterId,
        isOfficial: channelMasterId === 1,
      });
    }
  }

  return { akBindings, endfieldBindings };
}

async function grantSklandCred(hgToken: string, dId: string) {
  const grantRes = await nativePostJson<{ data?: { code?: string } }>(
    'https://as.hypergryph.com/user/oauth2/v2/grant',
    {
      token: hgToken,
      appCode: SKLAND_APP_CODE,
      type: 0,
    }
  );
  const code = grantRes.json.data?.code;
  if (!code) throw new Error('森空岛 OAuth2 授权失败，未获得 code');

  const credRes = await nativePostJson<{ data?: { cred?: string; token?: string } }>(
    'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code',
    { kind: 1, code },
    { dId, platform: '3', vName: '1.0.0' }
  );
  const cred = credRes.json.data?.cred;
  const signToken = credRes.json.data?.token;
  if (!cred || !signToken) throw new Error('生成森空岛 Cred 凭证失败');
  return { cred, signToken };
}

async function grantU8TokenForUid(oauthToken: string, uid: string) {
  const u8Res = await nativePostJson<{ data?: { token?: string } }>(
    'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid',
    { token: oauthToken, uid }
  );
  return u8Res.json.data?.token;
}

async function grantGameUserCenterTokens(hgToken: string, game: GameMode) {
  const grantRes = await nativePostJson<{ data?: { token?: string } }>(
    'https://as.hypergryph.com/user/oauth2/v2/grant',
    {
      token: hgToken,
      appCode: AK_USER_CENTER_APP_CODE,
      type: 1,
    }
  );
  const oauthToken = grantRes.json.data?.token;
  if (!oauthToken) {
    return { bindings: [] as GameBindingItem[] };
  }

  const appCode = game === 'arknights' ? 'arknights' : 'endfield';
  const url = `https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list?token=${encodeURIComponent(
    oauthToken
  )}&appCode=${appCode}`;

  const { json: listRes, status } = await nativeGetJson<{
    code?: number;
    status?: number;
    msg?: string;
    message?: string;
    data?: { list?: Array<{ appCode?: string; bindingList?: any[] }> };
  }>(url);

  const errCode = listRes?.status ?? listRes?.code;
  if (status < 200 || status >= 300 || !listRes || (typeof errCode === 'number' && errCode !== 0)) {
    throw new Error(listRes?.msg || listRes?.message || `获取绑定角色失败 (HTTP ${status})`);
  }

  const groups = listRes.data?.list || [];
  const matchedGroups = groups.filter((g) =>
    String(g.appCode || '').toLowerCase().includes(appCode)
  );
  const rawList = (matchedGroups.length > 0 ? matchedGroups : groups).flatMap(
    (g) => g.bindingList || []
  );

  const bindings: GameBindingItem[] = rawList
    .filter((b) => String(b?.uid || '').trim() !== '')
    .map((b) => {
      const channelMasterId = Number(b.channelMasterId ?? (b.isOfficial === false ? 2 : 1));
      return {
        uid: String(b.uid),
        nickName: String(b.nickName || b.nickname || b.uid || '未知角色'),
        channelName: b.channelName || (channelMasterId === 2 ? 'B服' : '官服'),
        channelMasterId,
        isOfficial: typeof b.isOfficial === 'boolean' ? b.isOfficial : channelMasterId === 1,
      };
    });

  let u8Token: string | undefined;
  if (bindings[0]?.uid) {
    u8Token = await grantU8TokenForUid(oauthToken, bindings[0].uid);
  }

  return {
    oauthToken,
    u8Token,
    bindings,
  };
}

async function completeGameLogin(hgToken: string, phone: string, game: GameMode) {
  const store = loadStore();
  const targetAuth = store.auth[game];
  const dId = targetAuth.dId || createDeviceId();

  targetAuth.hgToken = hgToken;
  targetAuth.dId = dId;
  targetAuth.phoneMasked = maskPhone(phone);

  const warnings: string[] = [];

  try {
    const skland = await grantSklandCred(hgToken, dId);
    targetAuth.sklandCred = skland.cred;
    targetAuth.sklandSignToken = skland.signToken;

    const bindings = await fetchSklandBindings(skland.cred, skland.signToken, dId);
    const list = game === 'arknights' ? bindings.akBindings : bindings.endfieldBindings;
    if (list.length > 0) {
      targetAuth.bindings = list;
      targetAuth.activeUid = targetAuth.activeUid || list[0].uid;
    }
  } catch (err) {
    warnings.push(
      `森空岛自动授权未完成: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const u8 = await grantGameUserCenterTokens(hgToken, game);
    if (u8.oauthToken) targetAuth.oauthToken = u8.oauthToken;
    if (u8.u8Token) {
      targetAuth.u8Token = u8.u8Token;
      if (game === 'endfield') {
        targetAuth.gachaToken = targetAuth.gachaToken || u8.u8Token;
      }
    }
    if (u8.bindings.length > 0 && targetAuth.bindings.length === 0) {
      targetAuth.bindings = u8.bindings;
      targetAuth.activeUid = targetAuth.activeUid || u8.bindings[0].uid;
    }
  } catch (err) {
    warnings.push(
      `寻访记录 U8 授权未完成: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  saveStore(store);
  return { status: toAuthStatus(store), warnings };
}

function extractSetCookie(headers: Record<string, string>): string {
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === 'set-cookie') {
      const joined = Array.isArray(v) ? v.join('; ') : String(v);
      const match = joined.match(/ak-user-center=([^;]+)/);
      if (match) return `ak-user-center=${match[1]}`;
    }
  }
  return '';
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

export const nativeHypergryph = {
  async getAuthStatus(): Promise<AuthStatus> {
    return toAuthStatus(loadStore());
  },

  async sendPhoneCode(phone: string) {
    const clean = phone.trim();
    if (!/^1\d{10}$/.test(clean)) {
      throw new Error('请输入有效的 11 位中国大陆手机号');
    }
    await nativePostJson('https://as.hypergryph.com/general/v1/send_phone_code', {
      phone: clean,
      type: 2,
    });
    return { ok: true, message: '验证码已发送' };
  },

  async loginByCode(phone: string, code: string, game: GameMode = 'arknights') {
    const res = await nativePostJson<{ data?: { token?: string } }>(
      'https://as.hypergryph.com/user/auth/v2/token_by_phone_code',
      { phone: phone.trim(), code: code.trim() }
    );
    const hgToken = res.json.data?.token;
    if (!hgToken) throw new Error('登录成功但未返回通行证 Token');
    return completeGameLogin(hgToken, phone, game);
  },

  async loginByPassword(phone: string, password: string, game: GameMode = 'arknights') {
    const res = await nativePostJson<{ data?: { token?: string } }>(
      'https://as.hypergryph.com/user/auth/v1/token_by_phone_password',
      { phone: phone.trim(), password }
    );
    const hgToken = res.json.data?.token;
    if (!hgToken) throw new Error('登录成功但未返回通行证 Token');
    return completeGameLogin(hgToken, phone, game);
  },

  async importCred(payload: {
    game?: GameMode;
    cred?: string;
    signToken?: string;
    akU8Token?: string;
    endfieldInput?: string;
    dId?: string;
  }) {
    const game: GameMode = payload.game === 'endfield' ? 'endfield' : 'arknights';
    const store = loadStore();
    const targetAuth = store.auth[game];
    const { cred, signToken, akU8Token, endfieldInput, dId } = payload;

    if (cred && signToken) {
      const cleanCred = cred.trim();
      const cleanSignToken = signToken.trim();
      const deviceId = String(dId || targetAuth.dId || '').trim();
      const bindings = await fetchSklandBindings(cleanCred, cleanSignToken, deviceId);
      const list = game === 'arknights' ? bindings.akBindings : bindings.endfieldBindings;
      targetAuth.sklandCred = cleanCred;
      targetAuth.sklandSignToken = cleanSignToken;
      if (deviceId) targetAuth.dId = deviceId;
      if (list.length > 0) {
        targetAuth.bindings = list;
        targetAuth.activeUid = list[0].uid;
      }
    }

    if (akU8Token) {
      store.auth.arknights.u8Token = akU8Token.trim();
    }

    if (endfieldInput) {
      const parsed = parseEndfieldGachaUrl(endfieldInput);
      store.auth.endfield.gachaToken = parsed.token;
      store.auth.endfield.serverId = parsed.serverId;
      store.auth.endfield.gachaHost = parsed.host;
    }

    if (!cred && !akU8Token && !endfieldInput) {
      throw new Error('请至少填写一项凭证信息');
    }

    saveStore(store);
    return { status: toAuthStatus(store) };
  },

  async selectUid(game: GameMode, uid: string): Promise<AuthStatus> {
    const store = loadStore();
    if (uid) {
      const targetAuth = store.auth[game];
      targetAuth.activeUid = uid;
      if (targetAuth.oauthToken) {
        try {
          const nextU8 = await grantU8TokenForUid(targetAuth.oauthToken, uid);
          if (nextU8) {
            targetAuth.u8Token = nextU8;
            if (game === 'endfield') targetAuth.gachaToken = nextU8;
          }
        } catch {
          // Ignore if OAuth token expired
        }
      }
      saveStore(store);
    }
    return toAuthStatus(store);
  },

  async logout(game?: GameMode): Promise<AuthStatus> {
    if (!game) {
      const empty = createEmptyStore();
      saveStore(empty);
      return toAuthStatus(empty);
    }
    const store = loadStore();
    if (game === 'arknights') {
      store.auth.arknights = createEmptyGameAuth();
      store.akProfile = null;
      store.akGacha = [];
      store.akGarrison = null;
      store.akRogue = [];
      delete store.lastSync.akProfile;
      delete store.lastSync.akGacha;
      delete store.lastSync.akGarrison;
    } else {
      store.auth.endfield = createEmptyGameAuth();
      store.endfieldGacha = [];
      delete store.lastSync.endfieldGacha;
    }
    saveStore(store);
    return toAuthStatus(store);
  },

  async getArknightsData() {
    const store = loadStore();
    return {
      profile: store.akProfile,
      gacha: store.akGacha,
      garrison: store.akGarrison,
      rogue: store.akRogue,
      lastSync: store.lastSync,
    };
  },

  async syncArknightsProfile() {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.sklandCred || !akAuth.sklandSignToken) {
      throw new Error('请先登录明日方舟账号或导入森空岛 Cred');
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) throw new Error('当前账号未绑定《明日方舟》角色 UID');
    const binding = akAuth.bindings.find((b) => b.uid === uid);

    const data = await sklandGet<any>(
      '/api/v1/game/player/info',
      `uid=${encodeURIComponent(uid)}`,
      akAuth.sklandCred,
      akAuth.sklandSignToken,
      akAuth.dId || ''
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
      channelName: binding?.channelName || '官服',
      level: Number(status.level || 1),
      apCurrent: Number(status.ap?.current ?? 0),
      apMax: Number(status.ap?.max ?? 135),
      charCount: Array.isArray(data?.chars) ? data.chars.length : 0,
      secretaryName,
      registerTs: Number(status.registerTs || 0) * 1000,
    };

    const stubRogue = parseSklandRogue(data?.rogue || data?.rogueInfo);
    let rogue = stubRogue;

    try {
      let userId = '';
      try {
        const teen = await sklandGet<any>(
          '/api/v1/user/teenager',
          '',
          akAuth.sklandCred,
          akAuth.sklandSignToken,
          akAuth.dId || ''
        );
        if (teen?.teenager?.userId) userId = String(teen.teenager.userId);
      } catch {
        const userRes = await sklandGet<any>(
          '/api/v1/user',
          '',
          akAuth.sklandCred,
          akAuth.sklandSignToken,
          akAuth.dId || ''
        );
        userId = String(userRes?.user?.id || userRes?.id || '');
      }

      if (userId) {
        const baseDetail = await sklandGet<any>(
          '/api/v1/game/arknights/rogue',
          `uid=${encodeURIComponent(uid)}&targetUserId=${encodeURIComponent(userId)}&topicId=`,
          akAuth.sklandCred,
          akAuth.sklandSignToken,
          akAuth.dId || ''
        );

        const topics: Array<{ id: string; isSelected?: boolean; name?: string }> =
          Array.isArray(baseDetail?.topics) ? baseDetail.topics : [];

        if (topics.length > 0) {
          const selectedTopicId =
            topics.find((t) => t.isSelected)?.id || topics[0]?.id || '';
          const stubMap = new Map(stubRogue.map((s) => [s.themeId, s]));

          const detailed = await Promise.all(
            topics.map(async (topic) => {
              const stub = stubMap.get(topic.id);
              if (topic.id === selectedTopicId) {
                return normalizeSklandRogueDetail(topic.id, baseDetail, stub);
              }
              try {
                const detail = await sklandGet<any>(
                  '/api/v1/game/arknights/rogue',
                  `uid=${encodeURIComponent(uid)}&targetUserId=${encodeURIComponent(
                    userId
                  )}&topicId=${encodeURIComponent(topic.id)}`,
                  akAuth.sklandCred!,
                  akAuth.sklandSignToken!,
                  akAuth.dId || ''
                );
                return normalizeSklandRogueDetail(topic.id, detail, stub);
              } catch {
                return stub || normalizeSklandRogueDetail(topic.id, { topics }, undefined);
              }
            })
          );
          if (detailed.length > 0) rogue = detailed;
        }
      }
    } catch {
      // Keep fallback stubRogue
    }

    const sortedRogue = sortRogueThemesDesc(rogue);
    store.akProfile = profile;
    if (sortedRogue.length > 0) store.akRogue = sortedRogue;
    store.lastSync.akProfile = Date.now();
    saveStore(store);
    return { profile: store.akProfile, rogue: store.akRogue, lastSync: store.lastSync };
  },

  async syncArknightsGarrison() {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.sklandCred || !akAuth.sklandSignToken) {
      throw new Error('请先登录明日方舟账号或导入森空岛 Cred');
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) throw new Error('未找到绑定的《明日方舟》角色 UID');

    const resourceData = await sklandGet<any>(
      '/api/ms/game/arknights/garrison/resource',
      '',
      akAuth.sklandCred,
      akAuth.sklandSignToken,
      akAuth.dId || ''
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
      akAuth.sklandCred,
      akAuth.sklandSignToken,
      akAuth.dId || ''
    );

    store.akGarrison = normalizeSklandGarrisonResponse(infoData, resourceData);
    store.lastSync.akGarrison = Date.now();
    saveStore(store);
    return { garrison: store.akGarrison, lastSync: store.lastSync };
  },

  async importArknightsGarrison(data: unknown) {
    const store = loadStore();
    store.akGarrison = normalizeGarrisonPayload(data);
    store.lastSync.akGarrison = Date.now();
    saveStore(store);
    return { garrison: store.akGarrison, lastSync: store.lastSync };
  },

  async syncArknightsGacha() {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.u8Token) {
      throw new Error('缺少明日方舟寻访 U8 Token，请先登录明日方舟账号或导入 U8 Token');
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) throw new Error('未找到绑定的《明日方舟》角色 UID');

    const loginRes = await nativePostJson<any>(
      'https://ak.hypergryph.com/user/api/role/login',
      {
        token: akAuth.u8Token,
        source_from: '',
        share_type: '',
        share_by: '',
      },
      { 'User-Agent': WEB_UA }
    );

    const cookie = extractSetCookie(loginRes.headers);
    const authHeaders: Record<string, string> = {
      'User-Agent': WEB_UA,
      Accept: 'application/json',
      Referer: 'https://ak.hypergryph.com/',
      'X-Role-Token': akAuth.u8Token,
    };
    if (akAuth.hgToken) {
      authHeaders['X-Account-Token'] = akAuth.hgToken;
    }
    if (cookie) {
      authHeaders.Cookie = cookie;
    }

    const { json: cateJson, status: cateStatus } = await nativeGetJson<any>(
      `https://ak.hypergryph.com/user/api/inquiry/gacha/cate?uid=${encodeURIComponent(uid)}`,
      authHeaders
    );
    handleAkGachaJsonError(cateJson, cateStatus, '获取卡池分类');

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

    const incoming: AkGachaRecord[] = [];
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

        const { json: histJson, status: histStatus } = await nativeGetJson<any>(
          `https://ak.hypergryph.com/user/api/inquiry/gacha/history?${params.toString()}`,
          authHeaders
        );
        try {
          handleAkGachaJsonError(histJson, histStatus, `拉取「${cate.name}」`);
        } catch (err) {
          if (!firstError) {
            firstError = err instanceof Error ? err : new Error(String(err));
          }
          break;
        }

        const list: any[] = histJson?.data?.list || [];
        if (list.length === 0) break;

        for (const item of list) {
          const rawTs = Number(item.gachaTs || item.ts || 0);
          const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
          const itemPos = Number(item.pos ?? 0);
          const charId = String(item.charId || item.id || '');
          const charName = String(item.charName || item.name || '未知干员');
          const rawRarity = Number(item.rarity ?? 2);
          const starNum = rawRarity >= 0 && rawRarity <= 5 ? rawRarity + 1 : rawRarity;
          const rarity = (
            starNum >= 6 ? 6 : starNum === 5 ? 5 : starNum === 4 ? 4 : 3
          ) as AkGachaRecord['rarity'];

          incoming.push({
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

        if (!histJson?.data?.hasMore) break;
        const last = list[list.length - 1];
        const nextTs = String(last.gachaTs || last.ts || '');
        const nextPos = String(last.pos ?? '');
        if (!nextTs || (nextTs === gachaTs && nextPos === pos)) break;
        gachaTs = nextTs;
        pos = nextPos;
      }
    }

    if (incoming.length === 0 && firstError) {
      throw firstError;
    }

    store.akGacha = mergeAkGachaRecords(store.akGacha, incoming);
    store.lastSync.akGacha = Date.now();
    saveStore(store);
    return { addedCount: incoming.length, gacha: store.akGacha, lastSync: store.lastSync };
  },

  async importArknightsGacha(data: unknown) {
    const parsed = parseImportedAkGachaJson(data);
    const store = loadStore();
    store.akGacha = mergeAkGachaRecords(store.akGacha, parsed);
    store.lastSync.akGacha = Date.now();
    saveStore(store);
    return {
      importedCount: parsed.length,
      gacha: store.akGacha,
      lastSync: store.lastSync,
    };
  },

  async getEndfieldData() {
    const store = loadStore();
    return { gacha: store.endfieldGacha, lastSync: store.lastSync };
  },

  async syncEndfieldGacha(urlOrToken?: string) {
    const store = loadStore();
    const efAuth = store.auth.endfield;
    let token = efAuth.gachaToken || efAuth.u8Token || '';
    let serverId = efAuth.serverId || '1';
    let host = efAuth.gachaHost || 'https://ef-webview.hypergryph.com';

    if (urlOrToken) {
      const parsed = parseEndfieldGachaUrl(urlOrToken);
      token = parsed.token;
      serverId = parsed.serverId;
      host = parsed.host;
      efAuth.gachaToken = token;
      efAuth.serverId = serverId;
      efAuth.gachaHost = host;
    }

    if (!token) {
      throw new Error('缺少终末地寻访 Token，请登录终末地账号或粘贴 ef-webview 抽卡链接');
    }

    const CHAR_POOL_TYPES: Array<{ apiType: string; localType: EndfieldPoolType }> = [
      { apiType: 'E_CharacterGachaPoolType_Special', localType: 'special' },
      { apiType: 'E_CharacterGachaPoolType_Standard', localType: 'standard' },
      { apiType: 'E_CharacterGachaPoolType_Beginner', localType: 'beginner' },
    ];

    const incoming: EndfieldGachaRecord[] = [];
    let anySuccess = false;
    let lastErrorMsg = '';

    for (const pool of CHAR_POOL_TYPES) {
      let seqId = '';
      let pages = 0;

      while (pages < 100) {
        pages += 1;
        const query = new URLSearchParams({
          server_id: serverId,
          pool_type: pool.apiType,
          lang: 'zh-cn',
          token,
        });
        if (seqId) query.set('seq_id', seqId);

        const { json, status } = await nativeGetJson<any>(
          `${host}/api/record/char?${query.toString()}`
        );
        const code = json?.status ?? json?.code;
        if (status < 200 || status >= 300 || !json || (typeof code === 'number' && code !== 0)) {
          lastErrorMsg = json?.msg || json?.message || `HTTP ${status}`;
          break;
        }

        anySuccess = true;
        const list: any[] = json?.data?.list || [];
        if (list.length === 0) break;

        for (const item of list) {
          const rawTs = Number(item.gachaTs || item.ts || 0);
          const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
          const seq = String(item.seqId || item.seq_id || '');
          const rarityNum = Number(item.rarity ?? 4);
          const rarity = (
            rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : 4
          ) as EndfieldGachaRecord['rarity'];

          incoming.push({
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

        if (json?.data?.hasMore === false || list.length < 5) break;
        const nextSeq = String(list[list.length - 1]?.seqId || '');
        if (!nextSeq || nextSeq === seqId) break;
        seqId = nextSeq;
      }
    }

    // Fetch weapon pool directly (/api/record/weapon)
    try {
      let seqId = '';
      let pages = 0;
      while (pages < 100) {
        pages += 1;
        const wQuery = new URLSearchParams({
          server_id: serverId,
          lang: 'zh-cn',
          token,
        });
        if (seqId) wQuery.set('seq_id', seqId);

        const { json: wJson, status: wStatus } = await nativeGetJson<any>(
          `${host}/api/record/weapon?${wQuery.toString()}`
        );
        const wCode = wJson?.status ?? wJson?.code;
        if (
          wStatus < 200 ||
          wStatus >= 300 ||
          !wJson ||
          (typeof wCode === 'number' && wCode !== 0)
        ) {
          break;
        }

        anySuccess = true;
        const list: any[] = wJson?.data?.list || [];
        if (list.length === 0) break;

        for (const item of list) {
          const rawTs = Number(item.gachaTs || item.ts || 0);
          const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
          const seq = String(item.seqId || item.seq_id || '');
          const rarityNum = Number(item.rarity ?? 4);
          const rarity = (
            rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : 4
          ) as EndfieldGachaRecord['rarity'];

          incoming.push({
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

        if (wJson?.data?.hasMore === false || list.length < 5) break;
        const nextSeq = String(list[list.length - 1]?.seqId || '');
        if (!nextSeq || nextSeq === seqId) break;
        seqId = nextSeq;
      }
    } catch {
      // Weapon records are optional
    }

    if (!anySuccess && lastErrorMsg) {
      throw new Error(
        `获取终末地抽卡记录失败 (${lastErrorMsg})，请确认链接或 Token 是否在有效期内`
      );
    }

    store.endfieldGacha = mergeEndfieldGachaRecords(store.endfieldGacha, incoming);
    store.lastSync.endfieldGacha = Date.now();
    saveStore(store);
    return {
      fetchedCount: incoming.length,
      gacha: store.endfieldGacha,
      lastSync: store.lastSync,
    };
  },

  async importEndfieldGacha(data: unknown) {
    const parsed = parseImportedEndfieldGachaJson(data);
    const store = loadStore();
    store.endfieldGacha = mergeEndfieldGachaRecords(store.endfieldGacha, parsed);
    store.lastSync.endfieldGacha = Date.now();
    saveStore(store);
    return {
      importedCount: parsed.length,
      gacha: store.endfieldGacha,
      lastSync: store.lastSync,
    };
  },
};
