import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import type { GameMode } from '../src/types/index.js';
import {
  loadStore,
  resetStore,
  saveStore,
  toAuthStatus,
} from './storage.js';
import {
  createDeviceId,
  grantGameUserCenterTokens,
  grantSklandCred,
  grantU8TokenForUid,
  loginByPassword,
  loginByPhoneCode,
  maskPhone,
  sendPhoneCode,
} from './hypergryph/auth.js';
import {
  fetchArknightsGarrison,
  fetchArknightsPlayerInfo,
  fetchSklandBindings,
  normalizeGarrisonPayload,
} from './hypergryph/skland.js';
import {
  fetchAkGachaRecords,
  parseImportedAkGachaJson,
} from './hypergryph/akGacha.js';
import {
  fetchEndfieldGachaRecords,
  parseImportedEndfieldGachaJson,
} from './hypergryph/endfieldGacha.js';
import {
  mergeAkGachaRecords,
  mergeEndfieldGachaRecords,
  parseEndfieldGachaUrl,
} from '../src/utils/analytics.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

function parseGameParam(raw: unknown): GameMode {
  return raw === 'endfield' ? 'endfield' : 'arknights';
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'arknights-endfield-terminal', ts: Date.now() });
});

// ======================== AUTH ROUTES ========================

app.get('/api/auth/status', (_req, res) => {
  const store = loadStore();
  res.json(toAuthStatus(store));
});

app.post('/api/auth/send-code', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      res.status(400).json({ error: '请输入有效的 11 位中国大陆手机号' });
      return;
    }
    await sendPhoneCode(phone);
    res.json({ ok: true, message: '验证码已发送' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '发送验证码失败';
    res.status(400).json({ error: msg });
  }
});

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

app.post('/api/auth/login-code', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    const game = parseGameParam(req.body?.game);
    if (!phone || !code) {
      res.status(400).json({ error: '请输入手机号与短信验证码' });
      return;
    }
    const { hgToken } = await loginByPhoneCode(phone, code);
    const result = await completeGameLogin(hgToken, phone, game);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '登录失败' });
  }
});

app.post('/api/auth/login-password', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const game = parseGameParam(req.body?.game);
    if (!phone || !password) {
      res.status(400).json({ error: '请输入手机号与密码' });
      return;
    }
    const { hgToken } = await loginByPassword(phone, password);
    const result = await completeGameLogin(hgToken, phone, game);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '登录失败' });
  }
});

app.post('/api/auth/import-cred', async (req, res) => {
  try {
    const { cred, signToken, akU8Token, endfieldInput, dId, game: rawGame } =
      req.body || {};
    const game = parseGameParam(rawGame);
    const store = loadStore();
    const targetAuth = store.auth[game];

    if (cred && signToken) {
      const cleanCred = String(cred).trim();
      const cleanSignToken = String(signToken).trim();
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
      store.auth.arknights.u8Token = String(akU8Token).trim();
    }

    if (endfieldInput) {
      const parsed = parseEndfieldGachaUrl(String(endfieldInput));
      store.auth.endfield.gachaToken = parsed.token;
      store.auth.endfield.serverId = parsed.serverId;
      store.auth.endfield.gachaHost = parsed.host;
    }

    if (!cred && !akU8Token && !endfieldInput) {
      res.status(400).json({ error: '请至少填写一项凭证信息' });
      return;
    }

    saveStore(store);
    res.json({ status: toAuthStatus(store) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '导入凭证失败',
    });
  }
});

app.post('/api/auth/select-uid', async (req, res) => {
  const { game: rawGame, uid } = req.body || {};
  const game = parseGameParam(rawGame);
  const store = loadStore();
  if (uid) {
    const targetAuth = store.auth[game];
    targetAuth.activeUid = String(uid);
    if (targetAuth.oauthToken) {
      try {
        const nextU8 = await grantU8TokenForUid(targetAuth.oauthToken, String(uid));
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
  res.json(toAuthStatus(store));
});

app.post('/api/auth/logout', (req, res) => {
  const game = req.body?.game ? parseGameParam(req.body.game) : undefined;
  const updated = resetStore(game);
  res.json(toAuthStatus(updated));
});

// ======================== ARKNIGHTS ROUTES ========================

app.get('/api/arknights/data', (_req, res) => {
  const store = loadStore();
  res.json({
    profile: store.akProfile,
    gacha: store.akGacha,
    garrison: store.akGarrison,
    rogue: store.akRogue,
    lastSync: store.lastSync,
  });
});

app.post('/api/arknights/sync-profile', async (_req, res) => {
  try {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.sklandCred || !akAuth.sklandSignToken) {
      res.status(400).json({ error: '请先登录明日方舟账号或导入森空岛 Cred' });
      return;
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) {
      res.status(400).json({ error: '当前账号未绑定《明日方舟》角色 UID' });
      return;
    }
    const binding = akAuth.bindings.find((b) => b.uid === uid);
    const { profile, rogue } = await fetchArknightsPlayerInfo(
      akAuth.sklandCred,
      akAuth.sklandSignToken,
      uid,
      akAuth.dId || '',
      binding?.channelName || '官服'
    );
    store.akProfile = profile;
    if (rogue.length > 0) {
      store.akRogue = rogue;
    }
    store.lastSync.akProfile = Date.now();
    saveStore(store);
    res.json({ profile: store.akProfile, rogue: store.akRogue, lastSync: store.lastSync });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '同步博士档案与集成战略数据失败',
    });
  }
});

app.post('/api/arknights/sync-gacha', async (_req, res) => {
  try {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.u8Token) {
      res.status(400).json({
        error: '缺少明日方舟寻访 U8 Token，请先登录明日方舟账号或导入 U8 Token',
      });
      return;
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) {
      res.status(400).json({ error: '未找到绑定的《明日方舟》角色 UID' });
      return;
    }
    const incoming = await fetchAkGachaRecords(akAuth.u8Token, uid, akAuth.hgToken);
    store.akGacha = mergeAkGachaRecords(store.akGacha, incoming);
    store.lastSync.akGacha = Date.now();
    saveStore(store);
    res.json({
      addedCount: incoming.length,
      gacha: store.akGacha,
      lastSync: store.lastSync,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '同步明日方舟抽卡记录失败',
    });
  }
});

app.post('/api/arknights/import-gacha', (req, res) => {
  try {
    const parsed = parseImportedAkGachaJson(req.body?.data ?? req.body);
    const store = loadStore();
    store.akGacha = mergeAkGachaRecords(store.akGacha, parsed);
    store.lastSync.akGacha = Date.now();
    saveStore(store);
    res.json({
      importedCount: parsed.length,
      gacha: store.akGacha,
      lastSync: store.lastSync,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '导入明日方舟抽卡 JSON 失败',
    });
  }
});

app.post('/api/arknights/sync-garrison', async (_req, res) => {
  try {
    const store = loadStore();
    const akAuth = store.auth.arknights;
    if (!akAuth.sklandCred || !akAuth.sklandSignToken) {
      res.status(400).json({ error: '请先登录明日方舟账号或导入森空岛 Cred' });
      return;
    }
    const uid = akAuth.activeUid || akAuth.bindings[0]?.uid;
    if (!uid) {
      res.status(400).json({ error: '未找到绑定的《明日方舟》角色 UID' });
      return;
    }
    const garrison = await fetchArknightsGarrison(
      akAuth.sklandCred,
      akAuth.sklandSignToken,
      uid,
      akAuth.dId || ''
    );
    store.akGarrison = garrison;
    store.lastSync.akGarrison = Date.now();
    saveStore(store);
    res.json({ garrison: store.akGarrison, lastSync: store.lastSync });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '同步卫戍协议战绩失败',
    });
  }
});

app.post('/api/arknights/import-garrison', (req, res) => {
  try {
    const normalized = normalizeGarrisonPayload(req.body?.data ?? req.body);
    const store = loadStore();
    store.akGarrison = normalized;
    store.lastSync.akGarrison = Date.now();
    saveStore(store);
    res.json({ garrison: store.akGarrison, lastSync: store.lastSync });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '导入卫戍协议战绩 JSON 失败',
    });
  }
});

// ======================== ENDFIELD ROUTES ========================

app.get('/api/endfield/data', (_req, res) => {
  const store = loadStore();
  res.json({
    gacha: store.endfieldGacha,
    lastSync: store.lastSync,
  });
});

app.post('/api/endfield/sync-gacha', async (req, res) => {
  try {
    const store = loadStore();
    const efAuth = store.auth.endfield;
    let token = efAuth.gachaToken || efAuth.u8Token || '';
    let serverId = efAuth.serverId || '1';
    let host = efAuth.gachaHost || 'https://ef-webview.hypergryph.com';

    if (req.body?.urlOrToken) {
      const parsed = parseEndfieldGachaUrl(String(req.body.urlOrToken));
      token = parsed.token;
      serverId = parsed.serverId;
      host = parsed.host;
      efAuth.gachaToken = token;
      efAuth.serverId = serverId;
      efAuth.gachaHost = host;
    }

    if (!token) {
      res.status(400).json({
        error: '缺少终末地寻访 Token，请登录终末地账号或粘贴 ef-webview 抽卡链接',
      });
      return;
    }

    const incoming = await fetchEndfieldGachaRecords({ token, serverId, host });
    store.endfieldGacha = mergeEndfieldGachaRecords(store.endfieldGacha, incoming);
    store.lastSync.endfieldGacha = Date.now();
    saveStore(store);
    res.json({
      fetchedCount: incoming.length,
      gacha: store.endfieldGacha,
      lastSync: store.lastSync,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '同步终末地抽卡记录失败',
    });
  }
});

app.post('/api/endfield/import-gacha', (req, res) => {
  try {
    const parsed = parseImportedEndfieldGachaJson(req.body?.data ?? req.body);
    const store = loadStore();
    store.endfieldGacha = mergeEndfieldGachaRecords(store.endfieldGacha, parsed);
    store.lastSync.endfieldGacha = Date.now();
    saveStore(store);
    res.json({
      importedCount: parsed.length,
      gacha: store.endfieldGacha,
      lastSync: store.lastSync,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : '导入终末地寻访 JSON 失败',
    });
  }
});

// ======================== STATIC FRONTEND (PROD) ========================
const DIST_DIR = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || (fs.existsSync(DIST_DIR) ? 3000 : 3001));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PRTS // ENDFIELD] API server listening on http://127.0.0.1:${PORT}`);
});
