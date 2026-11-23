import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Compass,
  Database,
  ExternalLink,
  RefreshCw,
  RotateCw,
  Shield,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp, type AkTab, type EfTab } from '../context/AppContext.js';

interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  code: string;
  icon: React.FC<{ className?: string }>;
}

const AK_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '罗德岛总览', shortLabel: '总览', code: 'PRTS-01', icon: Activity },
  { id: 'gacha', label: '寻访分析', shortLabel: '抽卡', code: 'HEAD-02', icon: Sparkles },
  { id: 'garrison', label: '卫戍协议', shortLabel: '卫戍', code: 'GARR-03', icon: Shield },
  { id: 'rogue', label: '集成战略', shortLabel: '肉鸽', code: 'IS-04', icon: Compass },
  { id: 'prts', label: 'PRTS 入口', shortLabel: 'PRTS', code: 'WIKI-05', icon: BookOpen },
];

const EF_NAV_ITEMS: NavItem[] = [
  { id: 'gacha', label: '寻访工业分析', shortLabel: '寻访分析', code: 'EF-GACHA', icon: BarChart3 },
  { id: 'account', label: '账号与数据终端', shortLabel: '账号设置', code: 'EF-AUTH', icon: UserCheck },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
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
    syncing,
    syncCurrentGame,
    toast,
    clearToast,
    prtsModal,
    closePrts,
  } = useApp();

  const [iframeKey, setIframeKey] = useState(0);

  const isAk = gameMode === 'arknights';
  const navItems = isAk ? AK_NAV_ITEMS : EF_NAV_ITEMS;
  const activeNavId = isAk ? akTab : efTab;
  const currentGameAuth = isAk ? authStatus.arknights : authStatus.endfield;

  const handleNavSelect = (id: string) => {
    if (isAk) setAkTab(id as AkTab);
    else setEfTab(id as EfTab);
  };

  return (
    <div
      data-theme={gameMode}
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isAk ? 'ak-grid-bg text-[#ECF0F5]' : 'ef-dot-grid text-[#14161A]'
      }`}
    >
      {/* Top Tactical / Industrial Bar */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          isAk
            ? 'bg-[#0A0C0F]/92 border-[#293240]'
            : 'bg-[#F7F8FA]/95 border-[#14161A]'
        }`}
      >
        {!isAk && <div className="h-1 w-full ef-stripe" />}

        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-12 sm:h-14 flex items-center justify-between gap-2">
          {/* Brand + Game Mode Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={`hidden sm:flex items-center gap-2 pr-3 border-r ${
                isAk ? 'border-[#293240]' : 'border-[#C5CCD4]'
              }`}
            >
              <span
                className={`w-2 h-2 ${
                  isAk ? 'bg-[#22BBFF] shadow-[0_0_8px_#22BBFF]' : 'bg-[#FF5200]'
                }`}
              />
              <span className="font-mono-tech text-xs font-bold tracking-widest uppercase">
                {isAk ? 'PRTS // TERMINAL' : 'ENDFIELD // IND'}
              </span>
            </div>

            {/* Game Toggle Pill */}
            <div
              className={`inline-flex p-0.5 ${
                isAk
                  ? 'bg-[#13171D] border border-[#293240] ak-chamfer-sm'
                  : 'bg-[#E2E6EB] border border-[#14161A]'
              }`}
            >
              <button
                type="button"
                onClick={() => setGameMode('arknights')}
                className={`px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isAk
                    ? 'bg-[#22BBFF] text-[#07131A] shadow-sm'
                    : 'text-[#4A525E] hover:text-[#14161A]'
                }`}
              >
                明日方舟
              </button>
              <button
                type="button"
                onClick={() => setGameMode('endfield')}
                className={`px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  !isAk
                    ? 'bg-[#FFE600] text-[#14161A] border border-[#14161A]'
                    : 'text-[#7D899B] hover:text-[#ECF0F5]'
                }`}
              >
                终末地
              </button>
            </div>
          </div>

          {/* Right Controls: Data Mode Pill + Sync + Account */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Data Mode Switch */}
            <button
              type="button"
              onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
              title="切换演示数据 / 真实鹰角账号数据"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono-tech font-semibold cursor-pointer transition-colors ${
                isAk
                  ? dataMode === 'demo'
                    ? 'bg-[#FF9A2E]/15 text-[#FF9A2E] border border-[#FF9A2E]/50'
                    : 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/50'
                  : dataMode === 'demo'
                  ? 'bg-[#14161A] text-[#FFE600] border border-[#14161A]'
                  : 'bg-[#0E9F6E] text-white border border-[#14161A]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{dataMode === 'demo' ? '演示模式' : '实时账号'}</span>
            </button>

            {/* Sync Button */}
            <button
              type="button"
              onClick={() => void syncCurrentGame()}
              disabled={syncing}
              title="同步当前游戏数据"
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
                isAk
                  ? 'bg-[#1A2029] hover:bg-[#232B37] text-[#ECF0F5] border border-[#293240]'
                  : 'bg-white hover:bg-[#FFE600] text-[#14161A] border border-[#14161A]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? '同步中' : '同步'}</span>
            </button>

            {/* Quick Account Button */}
            <button
              type="button"
              onClick={openAccountPage}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                activeNavId === 'account'
                  ? isAk
                    ? 'bg-[#22BBFF] text-[#07131A]'
                    : 'bg-[#FFE600] text-[#14161A] border border-[#14161A]'
                  : isAk
                  ? 'bg-[#13171D] hover:bg-[#1A2029] text-[#B4C0D0] border border-[#293240]'
                  : 'bg-[#14161A] hover:bg-[#2A2E35] text-white border border-[#14161A]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {currentGameAuth.authenticated ? '已绑定' : '账号'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Desktop Left Rail + Centered Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Navigation Rail */}
        <aside
          className={`hidden md:flex flex-col w-60 shrink-0 border-r p-4 gap-2 ${
            isAk
              ? 'bg-[#0D1015]/85 border-[#293240]'
              : 'bg-[#F7F8FA]/90 border-[#14161A]'
          }`}
        >
          <div className="mb-2 px-2">
            <div
              className={`text-[10px] font-mono-tech uppercase tracking-widest ${
                isAk ? 'text-[#22BBFF]' : 'text-[#5C6573]'
              }`}
            >
              {isAk ? 'RHODES ISLAND // NAV' : 'TALOS-II // SECTOR'}
            </div>
            <div className="text-sm font-bold mt-0.5">
              {isAk ? '明日方舟战略模块' : '终末地工业系统'}
            </div>
          </div>

          <nav className="flex flex-col gap-1.5 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNavId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavSelect(item.id)}
                  className={`flex items-center justify-between px-3 py-2.5 text-left transition-all cursor-pointer ${
                    isAk
                      ? active
                        ? 'bg-[#22BBFF]/15 text-[#22BBFF] border-l-2 border-[#22BBFF] ak-chamfer-sm'
                        : 'text-[#B4C0D0] hover:bg-[#1A2029] hover:text-[#ECF0F5]'
                      : active
                      ? 'bg-[#FFE600] text-[#14161A] border border-[#14161A] font-bold shadow-[2px_2px_0_#14161A]'
                      : 'text-[#2F3640] hover:bg-[#E2E6EB] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  <span className="text-[10px] font-mono-tech opacity-65">{item.code}</span>
                </button>
              );
            })}

            {isAk && (
              <button
                type="button"
                onClick={() => setAkTab('account')}
                className={`mt-2 flex items-center justify-between px-3 py-2.5 text-left transition-all cursor-pointer ${
                  akTab === 'account'
                    ? 'bg-[#FF9A2E]/15 text-[#FF9A2E] border-l-2 border-[#FF9A2E] ak-chamfer-sm'
                    : 'text-[#7D899B] hover:bg-[#1A2029] hover:text-[#ECF0F5]'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>鹰角账号 & 导入</span>
                </span>
                <span className="text-[10px] font-mono-tech opacity-65">AUTH</span>
              </button>
            )}
          </nav>

          {/* Status Footer Card in Sidebar */}
          <div
            className={`p-3 text-xs ${
              isAk
                ? 'bg-[#13171D] border border-[#293240] text-[#7D899B] ak-chamfer-sm'
                : 'bg-[#14161A] text-[#E9ECEF]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono-tech text-[10px] uppercase">
                {isAk ? 'LINK STATUS' : 'SYS // TELEMETRY'}
              </span>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono-tech font-bold ${
                  dataMode === 'demo'
                    ? isAk
                      ? 'bg-[#FF9A2E]/20 text-[#FF9A2E]'
                      : 'bg-[#FFE600] text-[#14161A]'
                    : 'bg-[#34D399]/20 text-[#34D399]'
                }`}
              >
                {dataMode === 'demo' ? 'DEMO' : 'LIVE'}
              </span>
            </div>
            <p className="leading-relaxed opacity-85">
              {currentGameAuth.authenticated
                ? `已接入${isAk ? '明日方舟' : '终末地'}账号 ${
                    currentGameAuth.phoneMasked || 'Cred'
                  }。`
                : `尚未绑定${isAk ? '明日方舟' : '终末地'}账号，可随时点击「账号」独立登录。`}
            </p>
          </div>
        </aside>

        {/* Scrollable Content Area */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 pt-4 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t pb-safe backdrop-blur-md ${
          isAk
            ? 'bg-[#0A0C0F]/95 border-[#293240]'
            : 'bg-[#F7F8FA]/95 border-[#14161A]'
        }`}
      >
        <div
          className={`grid ${
            isAk ? 'grid-cols-5' : 'grid-cols-2'
          } max-w-lg mx-auto`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNavId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavSelect(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  isAk
                    ? active
                      ? 'text-[#22BBFF]'
                      : 'text-[#7D899B]'
                    : active
                    ? 'bg-[#FFE600] text-[#14161A] font-bold'
                    : 'text-[#4A525E]'
                }`}
              >
                {active && isAk && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-[#22BBFF]" />
                )}
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Web In-App PRTS Modal Viewer */}
      {prtsModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0C0F]">
          <div className="h-12 px-3 border-b border-[#293240] bg-[#0A0C0F] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 bg-[#22BBFF] shrink-0" />
              <span className="text-sm font-bold text-[#ECF0F5] truncate">
                {prtsModal.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                title="刷新页面"
                className="p-1.5 bg-[#13171D] border border-[#293240] text-[#22BBFF] cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={prtsModal.url}
                target="_blank"
                rel="noopener noreferrer"
                title="若站点拦截内嵌可新标签页打开"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#13171D] border border-[#293240] text-[#B4C0D0]"
              >
                <span>外部打开</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={closePrts}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-[#FF6A2B]/20 border border-[#FF6A2B]/50 text-[#FF6A2B] cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>关闭</span>
              </button>
            </div>
          </div>
          <iframe
            key={iframeKey}
            src={prtsModal.url}
            title={prtsModal.title}
            className="flex-1 w-full border-0 bg-white"
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50">
          <div
            className={`flex items-start justify-between gap-3 px-4 py-3 text-sm shadow-xl border ${
              isAk
                ? toast.type === 'error'
                  ? 'bg-[#1F1215] border-[#F87171] text-[#FEE2E2]'
                  : toast.type === 'success'
                  ? 'bg-[#0E1E1A] border-[#34D399] text-[#D1FAE5]'
                  : 'bg-[#13171D] border-[#22BBFF] text-[#ECF0F5]'
                : toast.type === 'error'
                ? 'bg-[#14161A] border-[#FF5200] text-white'
                : 'bg-[#14161A] border-[#FFE600] text-[#FFE600]'
            }`}
          >
            <span className="leading-snug">{toast.text}</span>
            <button
              type="button"
              onClick={clearToast}
              className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
