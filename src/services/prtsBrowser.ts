import { Capacitor, registerPlugin } from '@capacitor/core';
import type { GameMode } from '../types/index.js';

interface PrtsBrowserPlugin {
  open(options: { url: string; title?: string }): Promise<void>;
  setSystemChrome(options: { backgroundColor: string; lightIcons: boolean }): Promise<void>;
}

const PrtsBrowser = registerPlugin<PrtsBrowserPlugin>('PrtsBrowser');

export async function openPrtsNative(url: string, title?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await PrtsBrowser.open({ url, title: title || 'PRTS.WIKI' });
  return true;
}

export function syncNativeSystemChrome(gameMode: GameMode): void {
  if (!Capacitor.isNativePlatform()) return;
  const isAk = gameMode === 'arknights';
  PrtsBrowser.setSystemChrome({
    backgroundColor: isAk ? '#0A0C0F' : '#F7F8FA',
    lightIcons: isAk,
  }).catch(() => {});
}
