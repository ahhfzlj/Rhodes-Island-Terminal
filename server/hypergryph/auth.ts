import crypto from 'node:crypto';
import type { GameBindingItem, GameMode } from '../../src/types/index.js';

const SKLAND_APP_CODE = '4ca99fa6b56cc2ba';
const AK_USER_CENTER_APP_CODE = 'be36d44aa36bfb5b';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'User-Agent':
    'Skland/1.32.1 (com.hypergryph.skland; build:103201004; Android 33; ) Okhttp/4.11.0',
};

export function createDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function maskPhone(phone: string): string {
  const clean = phone.trim();
  if (clean.length < 7) return clean;
  return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`无法连接鹰角网络服务器 (${msg})，请检查本地网络或代理设置`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`鹰角接口返回非 JSON 响应 (HTTP ${res.status})`);
  }

  const status = json?.status ?? json?.code;
  if (!res.ok || (typeof status === 'number' && status !== 0)) {
    const serverMsg = json?.msg || json?.message || `HTTP ${res.status}`;
    if (
      String(serverMsg).includes('人机') ||
      String(serverMsg).includes('验证') ||
      status === 10001
    ) {
      throw new Error(
        `触发鹰角安全人机验证 (${serverMsg})，请改用「Cred / Token 手动导入」`
      );
    }
    throw new Error(`鹰角通行证验证失败: ${serverMsg}`);
  }

  return json as T;
}

async function getJson<T>(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`网络请求失败 (${msg})`);
  }

  const json: any = await res.json().catch(() => null);
  const status = json?.status ?? json?.code;
  if (!res.ok || !json || (typeof status === 'number' && status !== 0)) {
    throw new Error(json?.msg || json?.message || `请求失败 (HTTP ${res.status})`);
  }
  return json as T;
}

export async function sendPhoneCode(phone: string): Promise<void> {
  await postJson('https://as.hypergryph.com/general/v1/send_phone_code', {
    phone: phone.trim(),
    type: 2,
  });
}

export async function loginByPhoneCode(
  phone: string,
  code: string
): Promise<{ hgToken: string }> {
  const res = await postJson<{ data?: { token?: string } }>(
    'https://as.hypergryph.com/user/auth/v2/token_by_phone_code',
    {
      phone: phone.trim(),
      code: code.trim(),
    }
  );
  const hgToken = res.data?.token;
  if (!hgToken) {
    throw new Error('登录成功但未返回通行证 Token');
  }
  return { hgToken };
}

export async function loginByPassword(
  phone: string,
  password: string
): Promise<{ hgToken: string }> {
  const res = await postJson<{ data?: { token?: string } }>(
    'https://as.hypergryph.com/user/auth/v1/token_by_phone_password',
    {
      phone: phone.trim(),
      password,
    }
  );
  const hgToken = res.data?.token;
  if (!hgToken) {
    throw new Error('登录成功但未返回通行证 Token');
  }
  return { hgToken };
}

export async function grantSklandCred(
  hgToken: string,
  dId: string
): Promise<{ cred: string; signToken: string }> {
  const grantRes = await postJson<{ data?: { code?: string } }>(
    'https://as.hypergryph.com/user/oauth2/v2/grant',
    {
      token: hgToken,
      appCode: SKLAND_APP_CODE,
      type: 0,
    }
  );
  const code = grantRes.data?.code;
  if (!code) {
    throw new Error('森空岛 OAuth2 授权失败，未获得 code');
  }

  const credRes = await postJson<{
    data?: { cred?: string; token?: string };
  }>(
    'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code',
    { kind: 1, code },
    {
      dId,
      platform: '3',
      vName: '1.0.0',
    }
  );

  const cred = credRes.data?.cred;
  const signToken = credRes.data?.token;
  if (!cred || !signToken) {
    throw new Error('生成森空岛 Cred 凭证失败');
  }
  return { cred, signToken };
}

export async function grantU8TokenForUid(
  oauthToken: string,
  uid: string
): Promise<string | undefined> {
  const u8Res = await postJson<{ data?: { token?: string } }>(
    'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid',
    {
      token: oauthToken,
      uid,
    }
  );
  return u8Res.data?.token;
}

export async function grantGameUserCenterTokens(
  hgToken: string,
  game: GameMode
): Promise<{
  oauthToken?: string;
  u8Token?: string;
  bindings: GameBindingItem[];
}> {
  const grantRes = await postJson<{ data?: { token?: string } }>(
    'https://as.hypergryph.com/user/oauth2/v2/grant',
    {
      token: hgToken,
      appCode: AK_USER_CENTER_APP_CODE,
      type: 1,
    }
  );
  const oauthToken = grantRes.data?.token;
  if (!oauthToken) {
    return { bindings: [] };
  }

  const appCode = game === 'arknights' ? 'arknights' : 'endfield';
  const url = `https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list?token=${encodeURIComponent(
    oauthToken
  )}&appCode=${appCode}`;

  const listRes = await getJson<{
    data?: { list?: Array<{ appCode?: string; bindingList?: any[] }> };
  }>(url);

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
