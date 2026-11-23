import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Database,
  ExternalLink,
  RefreshCw,
  Shield,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { computeArknightsGachaStats } from '../../utils/analytics.js';

export const AkOverviewPage: React.FC = () => {
  const {
    dataMode,
    setDataMode,
    setAkTab,
    doctorProfile,
    akGacha,
    akGarrison,
    akRogue,
    syncCurrentGame,
    syncing,
    authStatus,
    openPrts,
  } = useApp();

  const akAuth = authStatus.arknights;

  const gachaStats = useMemo(() => computeArknightsGachaStats(akGacha, 'all'), [akGacha]);
  const latestRogue = akRogue[0];

  const sanityPct = doctorProfile
    ? Math.min(100, Math.round((doctorProfile.apCurrent / Math.max(1, doctorProfile.apMax)) * 100))
    : 0;

  return (
    <div className="space-y-5">
      {/* Page Header Tag */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono-tech text-[11px] tracking-widest text-[#22BBFF] uppercase">
            PRTS // RHODES ISLAND TACTICAL TERMINAL
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
            罗德岛战略总览
          </h1>
        </div>
        <span className="font-mono-tech text-xs px-2.5 py-1 bg-[#13171D] border border-[#293240] text-[#7D899B]">
          {dataMode === 'demo' ? 'SIMULATION // 演示档案' : 'LIVE // 实时链路'}
        </span>
      </div>

      {/* Doctor Tactical Dossier Card */}
      <section className="bg-[#13171D] border border-[#293240] p-4 sm:p-5 ak-chamfer ak-reticle">
        {doctorProfile ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-mono-tech font-bold bg-[#22BBFF] text-[#07131A]">
                  LV.{doctorProfile.level}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-mono-tech bg-[#1A2029] border border-[#394659] text-[#FF9A2E]">
                  {doctorProfile.channelName}
                </span>
                <span className="font-mono-tech text-xs text-[#7D899B] tabular-nums">
                  UID {doctorProfile.uid}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#ECF0F5]">
                {doctorProfile.nickName}
              </h2>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#B4C0D0]">
                <span>
                  助理干员：
                  <strong className="text-[#22BBFF] font-semibold">
                    {doctorProfile.secretaryName}
                  </strong>
                </span>
                <span>
                  已招募干员：
                  <strong className="text-[#ECF0F5] font-mono-tech tabular-nums">
                    {doctorProfile.charCount}
                  </strong>
                </span>
              </div>
            </div>

            {/* Sanity Gauge */}
            <div className="w-full md:w-72 bg-[#0A0C0F] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-[#B4C0D0] font-medium">
                  <Zap className="w-3.5 h-3.5 text-[#22BBFF]" />
                  当前理智 // SANITY
                </span>
                <span className="font-mono-tech font-bold text-[#ECF0F5] tabular-nums">
                  {doctorProfile.apCurrent} / {doctorProfile.apMax}
                </span>
              </div>
              <div className="h-2.5 bg-[#1A2029] overflow-hidden border border-[#293240]">
                <div
                  className="h-full bg-gradient-to-r from-[#22BBFF] to-[#5EEAD4] transition-all duration-500"
                  style={{ width: `${sanityPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-[#7D899B] font-mono-tech">
                <span>STATUS: {sanityPct >= 95 ? '理智接近上限' : '恢复中'}</span>
                <span>{sanityPct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm font-bold text-[#ECF0F5]">尚未同步博士档案</div>
              <p className="text-xs text-[#7D899B] mt-1">
                当前为实时账号模式，请先在「鹰角账号」绑定森空岛 Cred 或点击同步拉取档案。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAkTab('account')}
                className="px-3.5 py-2 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer"
              >
                去绑定账号
              </button>
              <button
                type="button"
                onClick={() => setDataMode('demo')}
                className="px-3.5 py-2 text-xs font-bold bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
              >
                切换演示数据
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3-Column Summary Telemetry Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Gacha Telemetry */}
        <button
          type="button"
          onClick={() => setAkTab('gacha')}
          className="text-left bg-[#13171D] hover:bg-[#171D26] border border-[#293240] hover:border-[#22BBFF]/60 p-4 transition-all cursor-pointer group ak-chamfer-sm"
        >
          <div className="flex items-center justify-between text-xs text-[#7D899B] mb-2">
            <span className="flex items-center gap-1.5 font-mono-tech">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6A2B]" />
              寻访统计
            </span>
            <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#22BBFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
              {gachaStats.currentPity}
            </span>
            <span className="text-xs text-[#7D899B]">抽未出 6★</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#293240]/70 flex items-center justify-between text-xs text-[#B4C0D0]">
            <span>累计 {gachaStats.totalPulls} 抽</span>
            <span className="text-[#FF6A2B] font-mono-tech">
              6★ 均值 {gachaStats.avgPullsPerSix || '-'}
            </span>
          </div>
        </button>

        {/* Garrison Telemetry */}
        <button
          type="button"
          onClick={() => setAkTab('garrison')}
          className="text-left bg-[#13171D] hover:bg-[#171D26] border border-[#293240] hover:border-[#22BBFF]/60 p-4 transition-all cursor-pointer group ak-chamfer-sm"
        >
          <div className="flex items-center justify-between text-xs text-[#7D899B] mb-2">
            <span className="flex items-center gap-1.5 font-mono-tech">
              <Shield className="w-3.5 h-3.5 text-[#22BBFF]" />
              卫戍协议
            </span>
            <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#22BBFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
              {akGarrison ? `${akGarrison.winRate}%` : '--'}
            </span>
            <span className="text-xs text-[#7D899B]">
              {akGarrison ? `${akGarrison.clearCount}/${akGarrison.totalMatches} 通关` : '暂无战绩'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#293240]/70 flex items-center justify-between text-xs text-[#B4C0D0]">
            <span>{akGarrison?.highestDiffLabel || '等待同步'}</span>
            <span className="text-[#F4C44E] font-mono-tech">
              奖杯 {akGarrison?.trophies ?? 0}
            </span>
          </div>
        </button>

        {/* Rogue Telemetry */}
        <button
          type="button"
          onClick={() => setAkTab('rogue')}
          className="text-left bg-[#13171D] hover:bg-[#171D26] border border-[#293240] hover:border-[#22BBFF]/60 p-4 transition-all cursor-pointer group ak-chamfer-sm"
        >
          <div className="flex items-center justify-between text-xs text-[#7D899B] mb-2">
            <span className="flex items-center gap-1.5 font-mono-tech">
              <Compass className="w-3.5 h-3.5 text-[#FF9A2E]" />
              集成战略
            </span>
            <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#22BBFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
              {latestRogue ? `N${latestRogue.maxDifficulty}` : '--'}
            </span>
            <span className="text-xs text-[#7D899B] truncate">
              {latestRogue ? latestRogue.themeName : '暂无记录'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#293240]/70 flex items-center justify-between text-xs text-[#B4C0D0]">
            <span>
              结局 {latestRogue ? latestRogue.endings.filter((e) => e.unlocked).length : 0}/
              {latestRogue?.endings.length ?? 0}
            </span>
            <span className="text-[#22BBFF] font-mono-tech">
              藏品 {latestRogue ? `${latestRogue.relicsUnlocked}/${latestRogue.relicsTotal}` : '-'}
            </span>
          </div>
        </button>
      </section>

      {/* Quick Launch PRTS Banner */}
      <section className="bg-[#13171D] border border-[#293240] overflow-hidden ak-chamfer">
        <div className="h-1.5 w-full ak-hazard border-b border-[#293240]" />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-[#22BBFF]/15 border border-[#22BBFF]/50 text-[#22BBFF]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono-tech text-[10px] tracking-widest text-[#22BBFF]">
                PRTS.WIKI // KNOWLEDGE DATABASE
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#ECF0F5] mt-0.5">
                PRTS Wiki 战略资料库直达入口
              </h3>
              <p className="text-xs text-[#7D899B] mt-1">
                快速检索干员档案、模组数据、公开招募计算器、集成战略节点与卫戍协议专题。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAkTab('prts')}
              className="px-3.5 py-2 text-xs font-bold bg-[#1A2029] hover:bg-[#232B37] border border-[#394659] text-[#ECF0F5] cursor-pointer"
            >
              站内分类入口
            </button>
            <button
              type="button"
              onClick={() => openPrts('https://prts.wiki', 'PRTS.WIKI')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#22BBFF] hover:bg-[#49C7FF] text-[#07131A] cursor-pointer"
            >
              <span>应用内打开 prts.wiki</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Account Sync / Mode Switch Card */}
      <section className="bg-[#13171D] border border-[#293240] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center bg-[#1A2029] border border-[#293240] text-[#FF9A2E]">
            {dataMode === 'demo' ? (
              <Database className="w-4 h-4" />
            ) : (
              <UserCheck className="w-4 h-4 text-[#34D399]" />
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-[#ECF0F5]">
              {dataMode === 'demo'
                ? '当前处于演示数据模式'
                : akAuth.authenticated
                ? `已接入明日方舟账号 (${akAuth.phoneMasked || 'Cred 已导入'})`
                : '实时模式：待绑定明日方舟账号'}
            </div>
            <div className="text-xs text-[#7D899B]">
              支持官服 / B服短信登录、森空岛 Cred 导入及本地 JSON 离线备份恢复。
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {dataMode === 'live' && akAuth.authenticated && (
            <button
              type="button"
              onClick={() => void syncCurrentGame()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1A2029] hover:bg-[#232B37] border border-[#394659] text-[#ECF0F5] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              立即同步
            </button>
          )}
          <button
            type="button"
            onClick={() => setAkTab('account')}
            className="px-3.5 py-1.5 text-xs font-bold bg-[#FF9A2E] hover:bg-[#FFA94D] text-[#1A0F03] cursor-pointer"
          >
            管理账号与数据
          </button>
        </div>
      </section>
    </div>
  );
};
