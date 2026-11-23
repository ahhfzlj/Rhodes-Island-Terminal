import { Capacitor } from '@capacitor/core';
import type {
  AkGachaRecord,
  AuthStatus,
  DoctorProfile,
  EndfieldGachaRecord,
  GameMode,
  GarrisonSeasonData,
  RogueThemeData,
} from '../types/index.js';
import { nativeHypergryph } from './nativeHypergryph.js';

async function webRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `请求失败 (HTTP ${res.status})`);
  }
  return json as T;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export const apiClient = {
  isNativePlatform: isNative,

  getAuthStatus(): Promise<AuthStatus> {
    if (isNative()) return nativeHypergryph.getAuthStatus();
    return webRequest<AuthStatus>('/api/auth/status');
  },

  sendPhoneCode(phone: string): Promise<{ ok: boolean; message: string }> {
    if (isNative()) return nativeHypergryph.sendPhoneCode(phone);
    return webRequest('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
  },

  loginByCode(
    phone: string,
    code: string,
    game: GameMode = 'arknights'
  ): Promise<{ status: AuthStatus; warnings: string[] }> {
    if (isNative()) return nativeHypergryph.loginByCode(phone, code, game);
    return webRequest('/api/auth/login-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, game }),
    });
  },

  loginByPassword(
    phone: string,
    password: string,
    game: GameMode = 'arknights'
  ): Promise<{ status: AuthStatus; warnings: string[] }> {
    if (isNative()) return nativeHypergryph.loginByPassword(phone, password, game);
    return webRequest('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, game }),
    });
  },

  importCred(payload: {
    game?: GameMode;
    cred?: string;
    signToken?: string;
    akU8Token?: string;
    endfieldInput?: string;
    dId?: string;
  }): Promise<{ status: AuthStatus }> {
    if (isNative()) return nativeHypergryph.importCred(payload);
    return webRequest('/api/auth/import-cred', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  selectUid(game: GameMode, uid: string): Promise<AuthStatus> {
    if (isNative()) return nativeHypergryph.selectUid(game, uid);
    return webRequest('/api/auth/select-uid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, uid }),
    });
  },

  logout(game?: GameMode): Promise<AuthStatus> {
    if (isNative()) return nativeHypergryph.logout(game);
    return webRequest('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game ? { game } : {}),
    });
  },

  getArknightsData(): Promise<{
    profile: DoctorProfile | null;
    gacha: AkGachaRecord[];
    garrison: GarrisonSeasonData | null;
    rogue: RogueThemeData[];
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.getArknightsData();
    return webRequest('/api/arknights/data');
  },

  syncArknightsProfile() {
    if (isNative()) return nativeHypergryph.syncArknightsProfile();
    return webRequest('/api/arknights/sync-profile', { method: 'POST' });
  },

  syncArknightsGacha() {
    if (isNative()) return nativeHypergryph.syncArknightsGacha();
    return webRequest('/api/arknights/sync-gacha', { method: 'POST' });
  },

  importArknightsGacha(data: unknown): Promise<{
    importedCount: number;
    gacha: AkGachaRecord[];
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.importArknightsGacha(data);
    return webRequest('/api/arknights/import-gacha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
  },

  syncArknightsGarrison() {
    if (isNative()) return nativeHypergryph.syncArknightsGarrison();
    return webRequest('/api/arknights/sync-garrison', { method: 'POST' });
  },

  importArknightsGarrison(data: unknown): Promise<{
    garrison: GarrisonSeasonData;
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.importArknightsGarrison(data);
    return webRequest('/api/arknights/import-garrison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
  },

  getEndfieldData(): Promise<{
    gacha: EndfieldGachaRecord[];
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.getEndfieldData();
    return webRequest('/api/endfield/data');
  },

  syncEndfieldGacha(urlOrToken?: string): Promise<{
    fetchedCount: number;
    gacha: EndfieldGachaRecord[];
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.syncEndfieldGacha(urlOrToken);
    return webRequest('/api/endfield/sync-gacha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(urlOrToken ? { urlOrToken } : {}),
    });
  },

  importEndfieldGacha(data: unknown): Promise<{
    importedCount: number;
    gacha: EndfieldGachaRecord[];
    lastSync: AuthStatus['lastSync'];
  }> {
    if (isNative()) return nativeHypergryph.importEndfieldGacha(data);
    return webRequest('/api/endfield/import-gacha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
  },
};
