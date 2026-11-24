import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  ListFilter,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { apiClient } from '../../services/apiClient.js';
import {
  computeArknightsGachaAnalysis,
  normalizeAkCategoryGroup,
} from '../../utils/analytics.js';
import type {
  AkGachaAchievement,
  AkGachaCategoryGroup,
  AkGachaRecord,
} from '../../types/index.js';

type CategoryFilter = 'all' | AkGachaCategoryGroup;

const CATEGORY_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '全部卡池' },
  { id: 'limited', label: '限定' },
  { id: 'normal', label: '标准' },
  { id: 'classic', label: '中坚' },
];

function formatOrundumCompact(orundum: number): string {
  if (orundum >= 10_000) {
    return `${(orundum / 10_000).toFixed(1)}万`;
  }
  return orundum.toLocaleString('zh-CN');
}

function formatDateDot(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function formatShortDateRange(startTs: number, endTs: number): string {
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };
  const s = fmt(startTs);
  const e = fmt(endTs);
  return s === e ? s : `${s}~${e}`;
}

function getRawCategoryTag(rawCategory: string, group: AkGachaCategoryGroup): string {
  if (rawCategory === 'collab') return '联动';
  if (group === 'limited') return '限定';
  if (group === 'classic') return '中坚';
  return '标准';
}

function getPullBarStyle(pulls: number): {
  barBg: string;
  barText: string;
  tagClass: string;
} {
  if (pulls <= 20) {
    return {
      barBg: 'bg-[#4ADE80]',
      barText: 'text-[#052E16]',
      tagClass: 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40',
    };
  }
  if (pulls <= 35) {
    return {
      barBg: 'bg-[#38BDF8]',
      barText: 'text-[#07131A]',
      tagClass: 'bg-[#22BBFF]/20 text-[#22BBFF] border-[#22BBFF]/40',
    };
  }
  if (pulls <= 59) {
    return {
      barBg: 'bg-[#F4D058]',
      barText: 'text-[#2D1F02]',
      tagClass: 'bg-[#F4C44E]/20 text-[#F4C44E] border-[#F4C44E]/40',
    };
  }
  return {
    barBg: 'bg-[#FB7185]',
    barText: 'text-[#2B060D]',
    tagClass: 'bg-[#F87171]/20 text-[#F87171] border-[#F87171]/40',
  };
}

function getAchievementClass(tone: AkGachaAchievement['tone']): string {
  switch (tone) {
    case 'emerald':
      return 'bg-[#34D399]/15 border-[#34D399]/40 text-[#4ADE80]';
    case 'rose':
      return 'bg-[#F87171]/15 border-[#F87171]/40 text-[#FB7185]';
    case 'amber':
      return 'bg-[#F4C44E]/15 border-[#F4C44E]/40 text-[#F4D058]';
    default:
      return 'bg-[#22BBFF]/15 border-[#22BBFF]/40 text-[#38BDF8]';
  }
}

function getRarityBadgeClass(rarity: AkGachaRecord['rarity']): string {
  if (rarity === 6) return 'text-[#FF6A2B] border-[#FF6A2B]/50 bg-[#FF6A2B]/15';
  if (rarity === 5) return 'text-[#F4C44E] border-[#F4C44E]/50 bg-[#F4C44E]/15';
  if (rarity === 4) return 'text-[#A78BFA] border-[#A78BFA]/40 bg-[#A78BFA]/10';
  return 'text-[#7D899B] border-[#293240] bg-[#1A2029]';
}

export const AkGachaPage: React.FC = () => {
  const {
    akGacha,
    doctorProfile,
    dataMode,
    setDataMode,
    syncCurrentGame,
    syncing,
    refreshAll,
    showToast,
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFiveStars, setShowFiveStars] = useState(false);
  const [expandedBanners, setExpandedBanners] = useState<Record<string, boolean>>({});

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number>(0);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const analysis = useMemo(
    () => computeArknightsGachaAnalysis(akGacha),
    [akGacha]
  );

  const visibleBanners = useMemo(() => {
    if (categoryFilter === 'all') return analysis.banners;
    return analysis.banners.filter((b) => b.categoryGroup === categoryFilter);
  }, [analysis.banners, categoryFilter]);

  const filteredModalRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return akGacha.filter((r) => {
      if (
        categoryFilter !== 'all' &&
        normalizeAkCategoryGroup(r.category) !== categoryFilter
      ) {
        return false;
      }
      if (rarityFilter > 0 && r.rarity !== rarityFilter) return false;
      if (q) {
        const hit =
          r.charName.toLowerCase().includes(q) ||
          r.poolName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [akGacha, categoryFilter, rarityFilter, searchText]);

  const toggleBannerExpand = (bannerKey: string) => {
    setExpandedBanners((prev) => ({
      ...prev,
      [bannerKey]: !prev[bannerKey],
    }));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(akGacha, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arknights-gacha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出明日方舟寻访记录 JSON', 'success');
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importText);
      const json = await apiClient.importArknightsGacha(parsed);
      await refreshAll();
      setDataMode('live');
      setImportOpen(false);
      setImportText('');
      showToast(`成功导入 ${json.importedCount} 条寻访记录并切换至实时库`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'JSON 解析或导入失败', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const summaryCols = [
    analysis.categories.limited,
    analysis.categories.normal,
    analysis.categories.classic,
  ];

  const pityTracks = [
    {
      label: '限定已垫',
      dotColor: 'bg-[#FF9A2E]',
      barColor: 'bg-[#FF9A2E]',
      data: analysis.categories.limited,
    },
    {
      label: '常驻已垫',
      dotColor: 'bg-[#34D399]',
      barColor: 'bg-[#34D399]',
      data: analysis.categories.normal,
    },
    {
      label: '中坚已垫',
      dotColor: 'bg-[#22BBFF]',
      barColor: 'bg-[#22BBFF]',
      data: analysis.categories.classic,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Compact Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="font-mono-tech text-[11px] tracking-widest text-[#22BBFF]">
            HEADHUNTING // 干员寻访档案
          </div>
          <h1 className="text-lg sm:text-2xl font-bold mt-0.5">明日方舟抽卡分析</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void syncCurrentGame()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {dataMode === 'demo' ? '演示数据' : '更新数据'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-[#13171D] hover:bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            导入
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-[#13171D] hover:bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>
        </div>
      </div>

      {/* Doctor & Resource Consumption Card */}
      <section className="bg-[#13171D] border border-[#293240] p-3.5 sm:p-4 space-y-3 ak-chamfer-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-[#0A0C0F] border border-[#22BBFF]/50 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#22BBFF]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#ECF0F5] truncate">
                {doctorProfile?.nickName || '罗德岛干员寻访库'}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono-tech text-[#7D899B]">
                <span>{doctorProfile?.channelName || (dataMode === 'demo' ? '演示档案' : '实时同步')}</span>
                {doctorProfile?.uid && <span>UID:{doctorProfile.uid}</span>}
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[11px] font-mono-tech font-bold border border-[#394659] bg-[#0A0C0F] text-[#22BBFF] shrink-0">
            综合 {analysis.luckRating}
          </span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#293240] bg-[#0A0C0F] border border-[#293240] py-2.5 px-2">
          <div className="px-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#7D899B]">总消耗</span>
            <div className="text-right font-mono-tech tabular-nums">
              <span className="text-sm font-black text-[#ECF0F5]">
                {formatOrundumCompact(analysis.totalOrundum)}
              </span>
              <span className="text-[11px] text-[#7D899B] ml-1">
                ({analysis.totalPulls}抽)
              </span>
            </div>
          </div>
          <div className="px-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#7D899B]">生涯评分</span>
            <span className="text-sm font-bold text-[#34D399] truncate">
              {analysis.title}
            </span>
          </div>
        </div>
      </section>

      {/* Heybox-Style Overview Card (Title Banner + 3 Category Columns + Achievements) */}
      <section className="bg-[#13171D] border border-[#293240] p-3.5 sm:p-4 space-y-3 ak-chamfer">
        {/* Title Ribbon & Start Date */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#34D399] to-[#22BBFF] text-[#06141A] px-3 py-1 font-black text-sm sm:text-base shadow-sm">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>《{analysis.title}》</span>
          </div>
          {analysis.dateRange && (
            <span className="text-[11px] font-mono-tech text-[#7D899B]">
              统计自 {formatDateDot(analysis.dateRange.startTs)}
            </span>
          )}
        </div>

        {/* 3 Interactive Category Columns: 限定 | 标准 | 中坚 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {summaryCols.map((col) => {
            const active = categoryFilter === col.group;
            return (
              <button
                key={col.group}
                type="button"
                onClick={() =>
                  setCategoryFilter((prev) =>
                    prev === col.group ? 'all' : col.group
                  )
                }
                className={`text-left bg-[#0A0C0F] border p-2.5 sm:p-3 transition-all cursor-pointer ${
                  active
                    ? 'border-[#22BBFF] bg-[#1A2029]'
                    : 'border-[#293240] hover:border-[#394659]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[#B4C0D0]">{col.label}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22BBFF]" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono-tech tabular-nums">
                  <span className="text-xl sm:text-2xl font-black text-[#ECF0F5]">
                    {col.totalPulls}
                  </span>
                  <span className="text-[11px] text-[#7D899B]">抽</span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#293240]/70 grid grid-cols-2 gap-1 text-[10px] font-mono-tech tabular-nums">
                  <div>
                    <div className="text-[#FF6A2B] font-bold text-xs">
                      {col.sixCount}
                    </div>
                    <div className="text-[#7D899B]">出卡数</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#ECF0F5] font-bold text-xs">
                      {col.avgPullsPerSix || '--'}
                    </div>
                    <div className="text-[#7D899B]">六星平均</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Achievements Pills */}
        {analysis.achievements.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {analysis.achievements.map((ach) => (
              <span
                key={ach.label}
                className={`px-2 py-0.5 text-[11px] font-bold border ${getAchievementClass(
                  ach.tone
                )}`}
              >
                {ach.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Pull History Header + Controls */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#ECF0F5]">抽卡历史</h2>
            <span className="text-xs font-mono-tech text-[#7D899B]">
              ({visibleBanners.length} 个卡池)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowFiveStars((prev) => !prev)}
              className={`px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                showFiveStars
                  ? 'bg-[#F4C44E]/20 border-[#F4C44E] text-[#F4C44E]'
                  : 'bg-[#13171D] border-[#293240] text-[#B4C0D0] hover:text-[#ECF0F5]'
              }`}
            >
              {showFiveStars ? '已展示五星' : '展示五星'}
            </button>
            <button
              type="button"
              onClick={() => setLogModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-[#13171D] border border-[#293240] text-[#B4C0D0] hover:text-[#ECF0F5] cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#22BBFF]" />
              全库明细
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {CATEGORY_TABS.map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#22BBFF] text-[#07131A]'
                    : 'bg-[#13171D] text-[#7D899B] border border-[#293240] hover:text-[#ECF0F5]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 3-Track Pity Strip (限定已垫 | 常驻已垫 | 中坚已垫) */}
        <div className="grid grid-cols-3 gap-2 bg-[#13171D] border border-[#293240] p-2.5 sm:p-3">
          {pityTracks.map((track) => {
            const { currentPity, softPityBonus, currentSixChance } = track.data;
            const pct = Math.min(100, (currentPity / 99) * 100);
            return (
              <div key={track.label} className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#B4C0D0]">
                  <span className={`w-1.5 h-1.5 rounded-full ${track.dotColor}`} />
                  <span className="truncate">{track.label}</span>
                </div>
                <div className="relative h-4 bg-[#0A0C0F] border border-[#293240] overflow-hidden flex items-center justify-center">
                  <div
                    className={`absolute left-0 top-0 bottom-0 ${track.barColor} opacity-35 transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-[10px] font-mono-tech font-bold text-[#ECF0F5] tabular-nums">
                    {currentPity}/99
                  </span>
                </div>
                <div
                  className={`text-center text-[10px] font-mono-tech tabular-nums ${
                    softPityBonus > 0 ? 'text-[#FF9A2E] font-bold' : 'text-[#7D899B]'
                  }`}
                >
                  当前概率{currentSixChance}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-Banner Cards List */}
        {visibleBanners.length === 0 ? (
          <div className="bg-[#13171D] border border-[#293240] p-8 text-center text-xs text-[#7D899B] ak-chamfer-sm">
            当前分类下暂无寻访卡池记录，可点击上方「更新数据」或「导入」获取记录。
          </div>
        ) : (
          <div className="space-y-3">
            {visibleBanners.map((banner) => {
              const expanded = Boolean(expandedBanners[banner.bannerKey]);
              const catTag = getRawCategoryTag(
                banner.rawCategory,
                banner.categoryGroup
              );

              return (
                <article
                  key={banner.bannerKey}
                  className="bg-[#13171D] border border-[#293240] overflow-hidden ak-chamfer-sm"
                >
                  {/* Banner Header */}
                  <div className="px-3.5 py-3 bg-[#171D26] border-b border-[#293240]/80 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-[#ECF0F5] truncate">
                          {banner.poolName}
                        </h3>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#0A0C0F] border border-[#394659] text-[#B4C0D0] shrink-0">
                          {catTag}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tech text-[#7D899B] mt-0.5 tabular-nums">
                        {formatShortDateRange(banner.startTs, banner.endTs)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1 bg-[#22BBFF]/15 border border-[#22BBFF]/50 text-[#22BBFF] font-mono-tech text-xs font-black shrink-0 tabular-nums">
                      {banner.totalPulls} 抽
                    </div>
                  </div>

                  {/* Body: 5★ Optional Strip + 6★ Bars or Empty Message */}
                  <div className="p-3.5 space-y-3">
                    {showFiveStars && (
                      <div className="bg-[#0A0C0F] border border-[#293240]/80 p-2.5 space-y-1.5">
                        <div className="text-[10px] font-mono-tech text-[#F4C44E]">
                          5★ 出货 ({banner.fiveStars.length})
                        </div>
                        {banner.fiveStars.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {banner.fiveStars.map((op) => (
                              <span
                                key={op.id}
                                className="px-2 py-0.5 text-[11px] bg-[#1A2029] border border-[#F4C44E]/40 text-[#ECF0F5] inline-flex items-center gap-1"
                              >
                                <span>{op.charName}</span>
                                {op.isNew && (
                                  <span className="text-[9px] font-mono-tech font-bold text-[#FF9A2E]">
                                    NEW
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#7D899B]">本池未出五星干员</div>
                        )}
                      </div>
                    )}

                    {banner.sixStars.length === 0 ? (
                      <div className="py-3 text-center text-xs text-[#7D899B] bg-[#0A0C0F]/60 border border-[#293240]/60">
                        该卡池暂无六星
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {banner.sixStars.map((six) => {
                          const style = getPullBarStyle(six.pulls);
                          const widthPct = Math.max(
                            18,
                            Math.min(100, (six.pulls / 75) * 100)
                          );
                          return (
                            <div key={six.id} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-bold text-[#ECF0F5] truncate">
                                    {six.charName}
                                  </span>
                                  {six.isNew && (
                                    <span className="px-1 py-0.2 bg-[#FF6A2B]/20 text-[#FF6A2B] border border-[#FF6A2B]/40 text-[9px] font-mono-tech font-bold shrink-0">
                                      NEW
                                    </span>
                                  )}
                                </div>
                                {six.luckTag && (
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-bold border shrink-0 leading-none ${style.tagClass}`}
                                  >
                                    {six.luckTag}
                                  </span>
                                )}
                              </div>

                              <div className="h-6 bg-[#0A0C0F] border border-[#293240]/90 overflow-hidden flex items-center">
                                <div
                                  className={`h-full ${style.barBg} flex items-center px-2 min-w-[54px] transition-all duration-300`}
                                  style={{ width: `${widthPct}%` }}
                                >
                                  <span
                                    className={`text-xs font-mono-tech font-black tabular-nums whitespace-nowrap ${style.barText}`}
                                  >
                                    {six.pulls} 抽
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer Summary + Expandable Banner Log */}
                  <div className="px-3.5 py-2 bg-[#0A0C0F]/70 border-t border-[#293240]/70 flex items-center justify-between gap-2 text-[11px]">
                    <div className="font-mono-tech text-[#7D899B] truncate tabular-nums">
                      5★×{banner.fiveCount} · 4★×{banner.fourCount} · 3★×
                      {banner.threeCount}
                      {banner.trailingPity > 0 && (
                        <span className="text-[#B4C0D0] ml-2">
                          · 余垫 {banner.trailingPity} 抽
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBannerExpand(banner.bannerKey)}
                      className="inline-flex items-center gap-1 text-[#22BBFF] hover:text-[#ECF0F5] font-mono-tech font-bold shrink-0 cursor-pointer"
                    >
                      <span>{expanded ? '收起明细' : '展开明细'}</span>
                      {expanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-[#293240] bg-[#0A0C0F] max-h-64 overflow-y-auto divide-y divide-[#293240]/50">
                      {banner.records.map((r) => (
                        <div
                          key={r.id}
                          className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-mono-tech border shrink-0 ${getRarityBadgeClass(
                                r.rarity
                              )}`}
                            >
                              {r.rarity}★
                            </span>
                            <span className="font-medium text-[#ECF0F5] truncate">
                              {r.charName}
                            </span>
                            {r.isNew && (
                              <span className="text-[10px] text-[#FF6A2B] font-mono-tech shrink-0">
                                NEW
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono-tech text-[#7D899B] shrink-0 tabular-nums">
                            {new Date(r.ts).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Searchable Full Log Modal */}
      {logModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setLogModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-[#13171D] border border-[#22BBFF]/60 p-4 sm:p-5 space-y-3 ak-chamfer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-[#ECF0F5]">
                全库寻访明细 ({filteredModalRecords.length})
              </div>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="text-[#7D899B] hover:text-[#ECF0F5] cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-[#7D899B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜索干员或卡池..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0A0C0F] border border-[#293240] focus:border-[#22BBFF] outline-none text-[#ECF0F5]"
                />
              </div>
              <div className="flex gap-1">
                {[0, 6, 5, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRarityFilter(r)}
                    className={`px-2 py-1 text-[11px] font-mono-tech border cursor-pointer ${
                      rarityFilter === r
                        ? 'bg-[#22BBFF] text-[#07131A] border-[#22BBFF] font-bold'
                        : 'bg-[#0A0C0F] text-[#7D899B] border-[#293240]'
                    }`}
                  >
                    {r === 0 ? '全部' : `${r}★`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-[#293240] bg-[#0A0C0F]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#1A2029] text-[#7D899B] font-mono-tech">
                  <tr>
                    <th className="py-2 px-2.5">干员</th>
                    <th className="py-2 px-2.5">星级</th>
                    <th className="py-2 px-2.5">寻访卡池</th>
                    <th className="py-2 px-2.5 text-right">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#293240]/60">
                  {filteredModalRecords.slice(0, 200).map((r) => (
                    <tr key={r.id} className="hover:bg-[#1A2029]/60">
                      <td className="py-2 px-2.5 font-medium text-[#ECF0F5]">
                        {r.charName}
                        {r.isNew && (
                          <span className="ml-1.5 text-[10px] text-[#FF6A2B] font-mono-tech">
                            NEW
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-mono-tech border ${getRarityBadgeClass(
                            r.rarity
                          )}`}
                        >
                          {r.rarity}★
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-[#B4C0D0]">{r.poolName}</td>
                      <td className="py-2 px-2.5 text-right font-mono-tech text-[#7D899B] tabular-nums">
                        {new Date(r.ts).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                  {filteredModalRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#7D899B]">
                        无匹配寻访记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg bg-[#13171D] border border-[#394659] p-5 space-y-4 ak-chamfer">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#ECF0F5]">导入明日方舟抽卡 JSON</h3>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-[#7D899B] hover:text-[#ECF0F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#7D899B]">
              支持本终端导出的 JSON 文件，或社区通用的明日方舟寻访记录 JSON 格式。
            </p>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-[#B4C0D0] file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-[#1A2029] file:text-[#22BBFF] file:font-bold cursor-pointer"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder='粘贴 JSON 数组或 {"list": [...]}...'
              className="w-full p-2.5 text-xs font-mono-tech bg-[#0A0C0F] border border-[#293240] focus:border-[#22BBFF] outline-none text-[#ECF0F5]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="px-3.5 py-2 text-xs bg-[#1A2029] border border-[#293240] text-[#B4C0D0] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleImportSubmit()}
                disabled={importing || !importText.trim()}
                className="px-4 py-2 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer disabled:opacity-50"
              >
                {importing ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
