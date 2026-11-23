import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Link2,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { apiClient } from '../../services/apiClient.js';
import { computeEndfieldGachaStats } from '../../utils/analytics.js';
import type { EndfieldPoolType } from '../../types/index.js';

const POOL_TABS: Array<{ id: 'special' | 'standard' | 'beginner' | 'weapon' | 'all'; label: string; code: string }> = [
  { id: 'special', label: '特许寻访 (限定UP)', code: 'SP-01' },
  { id: 'standard', label: '基础寻访 (常驻)', code: 'STD-02' },
  { id: 'beginner', label: '启程寻访 (新手)', code: 'BEG-03' },
  { id: 'weapon', label: '武库申领 (武器)', code: 'WPN-04' },
  { id: 'all', label: '全池总览', code: 'ALL' },
];

const POOL_TYPE_LABELS: Record<EndfieldPoolType, string> = {
  special: '特许',
  standard: '基础',
  beginner: '启程',
  weapon: '武库',
};

export const EfGachaPage: React.FC = () => {
  const {
    endfieldGacha,
    dataMode,
    setDataMode,
    syncCurrentGame,
    syncing,
    refreshAll,
    showToast,
  } = useApp();

  const [poolType, setPoolType] = useState<'special' | 'standard' | 'beginner' | 'weapon' | 'all'>('special');
  const [selectedBannerId, setSelectedBannerId] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number>(0);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const stats = useMemo(
    () => computeEndfieldGachaStats(endfieldGacha, poolType, selectedBannerId || undefined),
    [endfieldGacha, poolType, selectedBannerId]
  );

  const chartData = useMemo(
    () => [
      { name: '6★', count: stats.sixCount, rate: stats.sixRate, color: '#FF5200' },
      { name: '5★', count: stats.fiveCount, rate: stats.fiveRate, color: '#EAB308' },
      { name: '4★', count: stats.fourCount, rate: stats.fourRate, color: '#4A525E' },
    ],
    [stats]
  );

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return endfieldGacha.filter((r) => {
      if (poolType !== 'all' && r.poolType !== poolType) return false;
      if (rarityFilter > 0 && r.rarity !== rarityFilter) return false;
      if (q) {
        const hit =
          r.itemName.toLowerCase().includes(q) ||
          r.poolName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [endfieldGacha, poolType, rarityFilter, searchText]);

  const handleFetchByUrl = async () => {
    if (!urlInput.trim()) return;
    setFetchingUrl(true);
    try {
      const json = await apiClient.syncEndfieldGacha(urlInput.trim());
      await refreshAll();
      setDataMode('live');
      setLinkModalOpen(false);
      setUrlInput('');
      showToast(`已成功抓取 ${json.fetchedCount ?? 0} 条终末地寻访记录`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '链接抓取失败', 'error');
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleImportJson = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importText);
      const json = await apiClient.importEndfieldGacha(parsed);
      await refreshAll();
      setDataMode('live');
      setImportOpen(false);
      setImportText('');
      showToast(`成功导入 ${json.importedCount} 条终末地记录`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'JSON 解析或导入失败', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(endfieldGacha, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endfield-gacha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出终末地寻访记录 JSON', 'success');
  };

  const smallPct = Math.min(
    100,
    Math.round((stats.smallPity80.current / Math.max(1, stats.smallPity80.max)) * 100)
  );
  const softMarkerPct = Math.round(
    (stats.smallPity80.softPityStart / Math.max(1, stats.smallPity80.max)) * 100
  );

  const bigPity = stats.bigPity120;
  const bigPct = bigPity
    ? Math.min(100, Math.round((bigPity.pullsInBanner / bigPity.guaranteedAt) * 100))
    : 0;

  return (
    <div className="space-y-5">
      {/* Industrial Spec Banner Header */}
      <section className="bg-[#14161A] text-[#F7F8FA] p-4 sm:p-5 border border-[#14161A] ef-chamfer">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono-tech font-bold bg-[#FFE600] text-[#14161A]">
                TALOS-II // EF-HEADHUNTING
              </span>
              <span className="text-[11px] font-mono-tech text-[#9CA3AF]">
                {dataMode === 'demo' ? 'MODE: SIMULATION' : 'MODE: LIVE TELEMETRY'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1.5">
              终末地 · 寻访工业数据分析终端
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              支持特许 80 抽小保底（可继承）与 120 抽当期 UP 大保底（不跨池继承）双轨监控。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLinkModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black bg-[#FFE600] hover:bg-[#FFF04D] text-[#14161A] cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              粘贴抽卡链接抓取
            </button>
            <button
              type="button"
              onClick={() => void syncCurrentGame()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#262A32] hover:bg-[#323742] text-white border border-[#3E4552] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {dataMode === 'demo' ? '演示库' : '账号同步'}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#262A32] hover:bg-[#323742] text-white border border-[#3E4552] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              导入
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#262A32] hover:bg-[#323742] text-white border border-[#3E4552] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出
            </button>
          </div>
        </div>
      </section>

      {/* Pool Selector Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {POOL_TABS.map((tab) => {
          const active = poolType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPoolType(tab.id)}
              className={`px-3.5 py-2 text-xs whitespace-nowrap transition-all cursor-pointer border flex items-center gap-2 ${
                active
                  ? 'bg-[#FFE600] text-[#14161A] border-[#14161A] font-black shadow-[2px_2px_0_#14161A]'
                  : 'bg-[#F7F8FA] text-[#4A525E] border-[#C5CCD4] hover:border-[#14161A] hover:text-[#14161A] font-medium'
              }`}
            >
              <span className="font-mono-tech text-[10px] opacity-70">{tab.code}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dual Pity Gauge Panel (80 Small + 120 Non-Inherited Big) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 01 // 80-Pull Small Pity */}
        <div className="ef-frame p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[10px] font-bold text-[#5C6573]">
                GAUGE 01 // {poolType === 'weapon' ? '40-PULL WEAPON PITY' : '80-PULL 6★ PITY'}
              </div>
              <h2 className="text-base font-black text-[#14161A] mt-0.5">
                {poolType === 'weapon' ? '40 抽武器 6★ 保底水位' : '80 抽 6★ 小保底水位'}
              </h2>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono-tech font-bold ${
                stats.smallPity80.inherited
                  ? 'bg-[#14161A] text-[#FFE600]'
                  : 'bg-[#E2E6EB] text-[#4A525E]'
              }`}
            >
              {stats.smallPity80.inherited ? '可跨池继承 // INHERITED' : '独立计数'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono-tech text-[#14161A] tabular-nums">
                {stats.smallPity80.current}
              </span>
              <span className="text-sm font-mono-tech text-[#5C6573]">
                / {stats.smallPity80.max}
              </span>
            </div>
            <span
              className={`text-xs font-bold ${
                stats.smallPity80.inSoftPity ? 'text-[#FF5200]' : 'text-[#4A525E]'
              }`}
            >
              {stats.smallPity80.inSoftPity
                ? '已进入概率递增区间！'
                : `距必出 6★ 还差 ${Math.max(
                    0,
                    stats.smallPity80.max - stats.smallPity80.current
                  )} 抽`}
            </span>
          </div>

          <div className="relative h-4 bg-[#DCE1E7] border border-[#14161A] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                stats.smallPity80.inSoftPity ? 'bg-[#FF5200]' : 'bg-[#14161A]'
              }`}
              style={{ width: `${smallPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#FFE600]"
              style={{ left: `${softMarkerPct}%` }}
              title="软保底起始线"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-tech text-[#5C6573]">
            <span>BASE 0</span>
            <span>SOFT PITY: {stats.smallPity80.softPityStart}+</span>
            <span>HARD: {stats.smallPity80.max}</span>
          </div>
        </div>

        {/* 02 // 120-Pull Big Pity (Non-Inherited) */}
        <div className="ef-frame p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[10px] font-bold text-[#FF5200]">
                GAUGE 02 // 120-PULL FEATURED GUARANTEE
              </div>
              <h2 className="text-base font-black text-[#14161A] mt-0.5">
                120 抽当期 UP 角色大保底
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-tech font-bold bg-[#FF5200] text-white">
              <AlertTriangle className="w-3 h-3" />
              不跨池继承 // NON-INHERITED
            </span>
          </div>

          {bigPity ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {stats.bannerBigPities.length > 1 ? (
                  <select
                    value={bigPity.poolId}
                    onChange={(e) => setSelectedBannerId(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold bg-white border border-[#14161A] text-[#14161A] outline-none"
                  >
                    {stats.bannerBigPities.map((b) => (
                      <option key={b.poolId} value={b.poolId}>
                        {b.poolName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-[#14161A]">
                    {bigPity.poolName}
                  </span>
                )}

                {bigPity.hasWonFeatured ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E9F6E]">
                    <CheckCircle2 className="w-4 h-4" />
                    本池已获得当期 UP（第 {bigPity.pullsInBanner} 抽达成）
                  </span>
                ) : (
                  <span className="text-xs font-bold text-[#FF5200] tabular-nums">
                    还差 {bigPity.remaining} 抽必得当期 UP
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono-tech text-[#14161A] tabular-nums">
                  {bigPity.pullsInBanner}
                </span>
                <span className="text-sm font-mono-tech text-[#5C6573]">
                  / {bigPity.guaranteedAt}
                </span>
              </div>

              <div className="relative h-4 bg-[#DCE1E7] border border-[#14161A] overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    bigPity.hasWonFeatured ? 'bg-[#0E9F6E]' : 'bg-[#FFE600]'
                  }`}
                  style={{ width: `${bigPct}%` }}
                />
              </div>

              <div className="text-[11px] text-[#5C6573]">
                注：每期特许寻访的 120 抽大保底独立计算，卡池结束即重置，请合理规划嵌晶玉投入。
              </div>
            </>
          ) : (
            <div className="py-6 text-xs text-[#5C6573]">
              {poolType === 'special' || poolType === 'all'
                ? '暂无特许寻访记录，导入或同步后可追踪 120 抽当期 UP 大保底进度。'
                : '当前选择的卡池类型不适用 120 抽特许 UP 大保底（切换至「特许寻访」查看）。'}
            </div>
          )}
        </div>
      </section>

      {/* Industrial KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="ef-frame p-4">
          <div className="font-mono-tech text-[10px] text-[#5C6573]">EF-01 // TOTAL PULLS</div>
          <div className="text-2xl font-black font-mono-tech text-[#14161A] mt-1 tabular-nums">
            {stats.totalPulls}
          </div>
          <div className="text-[11px] text-[#5C6573] mt-1 tabular-nums">
            约合嵌晶玉 {(stats.totalPulls * 500).toLocaleString()}
          </div>
        </div>

        <div className="ef-frame p-4">
          <div className="font-mono-tech text-[10px] text-[#5C6573]">EF-02 // 6★ YIELD</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono-tech text-[#FF5200] tabular-nums">
              {stats.sixCount}
            </span>
            <span className="text-xs font-mono-tech text-[#4A525E]">({stats.sixRate}%)</span>
          </div>
          <div className="text-[11px] text-[#5C6573] mt-1">5★ 共 {stats.fiveCount} 次</div>
        </div>

        <div className="ef-frame p-4">
          <div className="font-mono-tech text-[10px] text-[#5C6573]">EF-03 // MEAN INTERVAL</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black font-mono-tech text-[#14161A] tabular-nums">
              {stats.avgPullsPerSix || '--'}
            </span>
            <span className="text-xs text-[#5C6573]">抽 / 6★</span>
          </div>
          <div className="text-[11px] text-[#5C6573] mt-1">已统计完整周期均值</div>
        </div>

        <div className="ef-frame p-4 bg-[#14161A] text-[#F7F8FA]">
          <div className="font-mono-tech text-[10px] text-[#FFE600]">EF-04 // UP WIN RATE</div>
          <div className="text-2xl font-black font-mono-tech text-[#FFE600] mt-1 tabular-nums">
            {stats.featuredWinRate !== null ? `${stats.featuredWinRate}%` : '--'}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-1">特许寻访 6★ 不歪率</div>
        </div>
      </section>

      {/* Distribution Chart + 6★ Industrial Gantt Bars */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 ef-frame p-4">
          <div className="font-mono-tech text-[11px] font-bold text-[#5C6573] mb-3">
            DIST-MATRIX // 稀有度分布统计
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  stroke="#5C6573"
                  tick={{ fill: '#14161A', fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: '#14161A' }}
                />
                <YAxis
                  stroke="#5C6573"
                  tick={{ fill: '#5C6573', fontSize: 11 }}
                  axisLine={{ stroke: '#C5CCD4' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 230, 0, 0.2)' }}
                  contentStyle={{
                    backgroundColor: '#14161A',
                    borderColor: '#FFE600',
                    color: '#F7F8FA',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count">
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#C5CCD4] text-center">
            {chartData.map((item) => (
              <div key={item.name}>
                <div className="text-xs font-black" style={{ color: item.color }}>
                  {item.name}
                </div>
                <div className="text-xs font-mono-tech font-bold text-[#14161A]">
                  {item.count}
                </div>
                <div className="text-[10px] font-mono-tech text-[#5C6573]">{item.rate}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* 6★ Gantt Timeline */}
        <div className="lg:col-span-7 ef-frame p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono-tech text-[11px] font-bold text-[#5C6573]">
              GANTT-6★ // 高星出货工业甘特条
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono-tech font-bold bg-[#14161A] text-[#FFE600]">
              {stats.sixStarTimeline.length} RECORDS
            </span>
          </div>

          {stats.sixStarTimeline.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5C6573]">
              当前筛选卡池暂无 6★ 出货记录
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {stats.sixStarTimeline.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-[#14161A] truncate">
                        {item.itemName}
                      </span>
                      {item.poolType === 'special' && (
                        <span
                          className={`px-1.5 py-0.2 text-[10px] font-mono-tech font-bold ${
                            item.isFeatured
                              ? 'bg-[#FFE600] text-[#14161A] border border-[#14161A]'
                              : 'bg-[#FF5200]/15 text-[#FF5200] border border-[#FF5200]'
                          }`}
                        >
                          {item.isFeatured ? 'UP限定' : '常驻/歪'}
                        </span>
                      )}
                      <span className="text-[11px] text-[#5C6573] truncate hidden sm:inline">
                        {item.poolName}
                      </span>
                    </div>
                    <span className="font-mono-tech font-black tabular-nums text-[#14161A] shrink-0">
                      {item.pulls} 抽
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#DCE1E7] border border-[#14161A] overflow-hidden">
                    <div
                      className={`h-full ${
                        item.pulls <= 30
                          ? 'bg-[#0E9F6E]'
                          : item.pulls <= 64
                          ? 'bg-[#14161A]'
                          : 'bg-[#FF5200]'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (item.pulls / (item.poolType === 'weapon' ? 40 : 80)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Searchable Log Table */}
      <section className="ef-frame p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="font-mono-tech text-[11px] font-bold text-[#5C6573]">
            LOG-ARCHIVE // 寻访流水明细 ({filteredRecords.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5C6573] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="检索干员、武器或卡池..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#14161A] outline-none text-[#14161A] w-44 sm:w-52"
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
                      ? 'bg-[#14161A] text-[#FFE600] border-[#14161A] font-bold'
                      : 'bg-white text-[#4A525E] border-[#C5CCD4]'
                  }`}
                >
                  {r === 0 ? '全部' : `${r}★`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[#C5CCD4]">
          <table className="w-full text-left text-xs border-collapse bg-white">
            <thead className="sticky top-0 bg-[#14161A] text-[#FFE600] font-mono-tech">
              <tr>
                <th className="py-2 px-2.5">获取目标</th>
                <th className="py-2 px-2.5">星级</th>
                <th className="py-2 px-2.5">类型</th>
                <th className="py-2 px-2.5">卡池</th>
                <th className="py-2 px-2.5 text-right">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EB]">
              {filteredRecords.slice(0, 100).map((r) => (
                <tr key={r.id} className="hover:bg-[#FFFDE6]">
                  <td className="py-2 px-2.5 font-bold text-[#14161A]">
                    {r.itemName}
                    {r.isFeatured && r.rarity === 6 && (
                      <span className="ml-1.5 px-1 py-0.2 bg-[#FFE600] text-[#14161A] border border-[#14161A] text-[10px] font-mono-tech">
                        UP
                      </span>
                    )}
                    {r.isFree && (
                      <span className="ml-1.5 text-[10px] text-[#0E9F6E] font-mono-tech">
                        FREE
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-mono-tech font-bold ${
                        r.rarity === 6
                          ? 'bg-[#FF5200] text-white'
                          : r.rarity === 5
                          ? 'bg-[#FFE600] text-[#14161A]'
                          : 'bg-[#E9ECEF] text-[#4A525E]'
                      }`}
                    >
                      {r.rarity}★
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-[#5C6573] font-mono-tech">
                    {POOL_TYPE_LABELS[r.poolType]}
                  </td>
                  <td className="py-2 px-2.5 text-[#2F3640]">{r.poolName}</td>
                  <td className="py-2 px-2.5 text-right font-mono-tech text-[#5C6573] tabular-nums">
                    {new Date(r.ts).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#5C6573]">
                    无匹配终末地寻访记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Paste ef-webview URL Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-[#F7F8FA] border-2 border-[#14161A] p-5 space-y-4 ef-chamfer">
            <div className="flex items-center justify-between border-b border-[#C5CCD4] pb-2">
              <div>
                <div className="font-mono-tech text-[10px] text-[#FF5200] font-bold">
                  ENDFIELD // WEBVIEW LINK EXTRACTOR
                </div>
                <h3 className="text-base font-black text-[#14161A]">
                  粘贴终末地抽卡记录链接抓取
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="text-[#5C6573] hover:text-[#14161A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#14161A] text-[#E9ECEF] p-3 text-xs space-y-1.5 leading-relaxed">
              <div className="font-bold text-[#FFE600]">获取链接指引（国服）：</div>
              <p>1. 打开《明日方舟：终末地》游戏内的「寻访记录」页面；</p>
              <p>
                2. 从本地日志（如 <code className="text-[#FFE600]">HGWebview.log</code>）或抓包中复制完整{' '}
                <code className="text-[#FFE600]">https://ef-webview.hypergryph.com/...</code> 链接或{' '}
                <code className="text-[#FFE600]">token</code>；
              </p>
              <p>3. 粘贴至下方即可自动分页拉取角色与武器全池记录。</p>
            </div>

            <textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              rows={4}
              placeholder="https://ef-webview.hypergryph.com/api/record/char?server_id=1&token=..."
              className="w-full p-2.5 text-xs font-mono-tech bg-white border border-[#14161A] outline-none text-[#14161A]"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-white border border-[#14161A] text-[#14161A] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleFetchByUrl()}
                disabled={fetchingUrl || !urlInput.trim()}
                className="px-4 py-2 text-xs font-black bg-[#FFE600] border border-[#14161A] text-[#14161A] cursor-pointer disabled:opacity-50"
              >
                {fetchingUrl ? '抓取中...' : '开始抓取并分析'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-[#F7F8FA] border-2 border-[#14161A] p-5 space-y-4 ef-chamfer">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#14161A]">导入终末地寻访 JSON</h3>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-[#5C6573] hover:text-[#14161A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder='粘贴 JSON 数组或 {"list": [...]}...'
              className="w-full p-2.5 text-xs font-mono-tech bg-white border border-[#14161A] outline-none text-[#14161A]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="px-3.5 py-2 text-xs font-bold bg-white border border-[#14161A] text-[#14161A] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleImportJson()}
                disabled={importing || !importText.trim()}
                className="px-4 py-2 text-xs font-black bg-[#FFE600] border border-[#14161A] text-[#14161A] cursor-pointer disabled:opacity-50"
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
