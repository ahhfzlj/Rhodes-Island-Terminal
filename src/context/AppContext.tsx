import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import type {
  AkGachaRecord,
  AuthStatus,
  DataMode,
  DoctorProfile,
  EndfieldGachaRecord,
  GameAuthState,
  GameMode,
  GarrisonSeasonData,
  RogueThemeData,
} from '../types/index.js';
import {
  DEMO_AK_GACHA,
  DEMO_DOCTOR,
  DEMO_ENDFIELD_GACHA,
  DEMO_GARRISON,
  DEMO_ROGUE,
} from '../data/demoData.js';
import { apiClient } from '../services/apiClient.js';
import { openPrtsNative, syncNativeSystemChrome } from '../services/prtsBrowser.js';

export type AkTab = 'overview' | 'gacha' | 'garrison' | 'rogue' | 'prts' | 'account';
export type EfTab = 'gacha' | 'account';

interface ToastMessage {
  id: number;
  type: 'info' | 'success' | 'error';
  text: string;
}

interface PrtsModalState {
  url: string;
  title: string;
}

interface AppContextValue {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  akTab: AkTab;
  setAkTab: (tab: AkTab) => void;
  efTab: EfTab;
  setEfTab: (tab: EfTab) => void;
  openAccountPage: () => void;
  authStatus: AuthStatus;
  refreshAll: () => Promise<void>;
  syncing: boolean;
  syncCurrentGame: () => Promise<void>;
  doctorProfile: DoctorProfile | null;
  akGacha: AkGachaRecord[];
  akGarrison: GarrisonSeasonData | null;
  akRogue: RogueThemeData[];
  endfieldGacha: EndfieldGachaRecord[];
  toast: ToastMessage | null;
  showToast: (text: string, type?: ToastMessage['type']) => void;
  clearToast: () => void;
  prtsModal: PrtsModalState | null;
  openPrts: (url?: string, title?: string) => void;
  closePrts: () => void;
}

const DEFAULT_GAME_AUTH: GameAuthState = {
  authenticated: false,
  hasSklandCred: false,
  hasU8Token: false,
  bindings: [],
};

const DEFAULT_AUTH: AuthStatus = {
  authenticated: false,
  arknights: DEFAULT_GAME_AUTH,
  endfield: DEFAULT_GAME_AUTH,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameMode, setGameModeState] = useState<GameMode>(() => {
    const saved = localStorage.getItem('ak_ef_game_mode');
    return saved === 'endfield' ? 'endfield' : 'arknights';
  });

  const [dataMode, setDataModeState] = useState<DataMode>(() => {
    const saved = localStorage.getItem('ak_ef_data_mode');
    return saved === 'live' ? 'live' : 'demo';
  });

  const [akTab, setAkTab] = useState<AkTab>('overview');
  const [efTab, setEfTab] = useState<EfTab>('gacha');
  const [authStatus, setAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH);
  const [liveDoctor, setLiveDoctor] = useState<DoctorProfile | null>(null);
  const [liveAkGacha, setLiveAkGacha] = useState<AkGachaRecord[]>([]);
  const [liveGarrison, setLiveGarrison] = useState<GarrisonSeasonData | null>(null);
  const [liveRogue, setLiveRogue] = useState<RogueThemeData[]>([]);
  const [liveEndfieldGacha, setLiveEndfieldGacha] = useState<EndfieldGachaRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [prtsModal, setPrtsModal] = useState<PrtsModalState | null>(null);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setGameMode = useCallback((mode: GameMode) => {
    setGameModeState(mode);
    localStorage.setItem('ak_ef_game_mode', mode);
  }, []);

  const setDataMode = useCallback((mode: DataMode) => {
    setDataModeState(mode);
    localStorage.setItem('ak_ef_data_mode', mode);
  }, []);

  const openAccountPage = useCallback(() => {
    if (gameMode === 'arknights') setAkTab('account');
    else setEfTab('account');
  }, [gameMode]);

  const openPrts = useCallback(
    (url: string = 'https://prts.wiki', title: string = 'PRTS.WIKI') => {
      if (Capacitor.isNativePlatform()) {
        openPrtsNative(url, title).catch(() => {
          setPrtsModal({ url, title });
        });
        return;
      }
      setPrtsModal({ url, title });
    },
    []
  );

  const closePrts = useCallback(() => setPrtsModal(null), []);

  // Update browser theme-color, document title & Android system bar chrome on game switch
  useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', gameMode === 'arknights' ? '#0A0C0F' : '#E9ECEF');
    }
    document.title =
      gameMode === 'arknights'
        ? '罗德岛终端 // 明日方舟'
        : '罗德岛终端 // 终末地';

    if (Capacitor.isNativePlatform()) {
      syncNativeSystemChrome(gameMode);
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({
        color: gameMode === 'arknights' ? '#0A0C0F' : '#F7F8FA',
      }).catch(() => {});
      StatusBar.setStyle({
        style: gameMode === 'arknights' ? Style.Dark : Style.Light,
      }).catch(() => {});
    }
  }, [gameMode]);

  // Android hardware back button handling
  const navStateRef = useRef({ gameMode, akTab, efTab, prtsModal });
  navStateRef.current = { gameMode, akTab, efTab, prtsModal };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener('backButton', () => {
      const state = navStateRef.current;
      if (state.prtsModal) {
        setPrtsModal(null);
      } else if (state.gameMode === 'arknights' && state.akTab !== 'overview') {
        setAkTab('overview');
      } else if (state.gameMode === 'endfield' && state.efTab !== 'gacha') {
        setEfTab('gacha');
      } else {
        void CapApp.exitApp();
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [authJson, akJson, efJson] = await Promise.all([
        apiClient.getAuthStatus(),
        apiClient.getArknightsData(),
        apiClient.getEndfieldData(),
      ]);
      setAuthStatus(authJson);
      setLiveDoctor(akJson.profile || null);
      setLiveAkGacha(akJson.gacha || []);
      setLiveGarrison(akJson.garrison || null);
      setLiveRogue(akJson.rogue || []);
      setLiveEndfieldGacha(efJson.gacha || []);
    } catch {
      // Backend might not be reachable in offline static preview
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const syncCurrentGame = useCallback(async () => {
    if (dataMode === 'demo') {
      showToast('当前为演示模式，点击右上角可随时切换或绑定真实鹰角账号', 'info');
      return;
    }

    const currentAuth =
      gameMode === 'arknights' ? authStatus.arknights : authStatus.endfield;

    if (!currentAuth.authenticated) {
      showToast(
        `尚未绑定${gameMode === 'arknights' ? '明日方舟' : '终末地'}账号凭证，正在前往账号页`,
        'error'
      );
      openAccountPage();
      return;
    }

    setSyncing(true);
    try {
      if (gameMode === 'arknights') {
        const errors: string[] = [];
        if (currentAuth.hasSklandCred) {
          try {
            await apiClient.syncArknightsProfile();
          } catch (err) {
            errors.push(err instanceof Error ? err.message : '档案同步失败');
          }
          try {
            await apiClient.syncArknightsGarrison();
          } catch (err) {
            errors.push(err instanceof Error ? err.message : '卫戍同步失败');
          }
        }
        if (currentAuth.hasU8Token) {
          try {
            await apiClient.syncArknightsGacha();
          } catch (err) {
            errors.push(err instanceof Error ? err.message : '抽卡同步失败');
          }
        }
        await refreshAll();
        if (errors.length > 0) {
          showToast(`部分同步完成（${errors[0]}）`, 'info');
        } else {
          showToast('明日方舟数据同步完成', 'success');
        }
      } else {
        const json = await apiClient.syncEndfieldGacha();
        await refreshAll();
        showToast(`终末地寻访同步完成（获取 ${json.fetchedCount ?? 0} 条）`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '同步失败', 'error');
    } finally {
      setSyncing(false);
    }
  }, [authStatus, dataMode, gameMode, openAccountPage, refreshAll, showToast]);

  const doctorProfile = dataMode === 'demo' ? DEMO_DOCTOR : liveDoctor;
  const akGacha = dataMode === 'demo' ? DEMO_AK_GACHA : liveAkGacha;
  const akGarrison = dataMode === 'demo' ? DEMO_GARRISON : liveGarrison;
  const akRogue = dataMode === 'demo' ? DEMO_ROGUE : liveRogue;
  const endfieldGacha = dataMode === 'demo' ? DEMO_ENDFIELD_GACHA : liveEndfieldGacha;

  return (
    <AppContext.Provider
      value={{
        gameMode,
        setGameMode,
        dataMode,
        setDataMode,
        akTab,
        setAkTab,
        efTab,
        setEfTab,
        openAccountPage,
        authStatus,
        refreshAll,
        syncing,
        syncCurrentGame,
        doctorProfile,
        akGacha,
        akGarrison,
        akRogue,
        endfieldGacha,
        toast,
        showToast,
        clearToast,
        prtsModal,
        openPrts,
        closePrts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
