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
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { apiClient } from '../../services/apiClient.js';
import { computeArknightsGachaStats } from '../../utils/analytics.js';
import type { AkGachaRecord } from '../../types/index.js';

const CATEGORY_TABS = [
  { id: 'all', label: '全部卡池' },
  { id: 'normal', label: '常规寻访' },
  { id: 'limited', label: '限定 / 庆典' },
  { id: 'classic', label: '中坚寻访' },
];

export const AkGachaPage: React.FC = () => {
  const { akGacha, dataMode, setDataMode, syncCurrentGame, syncing, refreshAll, showToast } =
    useApp();
  const [category, setCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number>(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const stats = useMemo(
    () => computeArknightsGachaStats(akGacha, category),
    [akGacha, category]
  );

  const chartData = useMemo(
    () => [
      { name: '6★', count: stats.sixCount, rate: stats.sixRate, color: '#FF6A2B' },
      { name: '5★', count: stats.fiveCount, rate: stats.fiveRate, color: '#F4C44E' },
      { name: '4★', count: stats.fourCount, rate: stats.fourRate, color: '#A78BFA' },
      { name: '3★', count: stats.threeCount, rate: stats.threeRate, color: '#7D899B' },
    ],
    [stats]
  );

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return akGacha.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (rarityFilter > 0 && r.rarity !== rarityFilter) return false;
      if (q) {
        const hit =
          r.charName.toLowerCase().includes(q) ||
          r.poolName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [akGacha, category, rarityFilter, searchText]);

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

  const pityBarColor =
    stats.currentPity > 50
      ? 'from-[#FF9A2E] to-[#FF6A2B]'
      : 'from-[#22BBFF] to-[#5EEAD4]';

  const getPullBarColor = (pulls: number) => {
    if (pulls <= 25) return 'bg-[#34D399]';
    if (pulls <= 50) return 'bg-[#22BBFF]';
    if (pulls <= 65) return 'bg-[#F4C44E]';
    return 'bg-[#FF6A2B]';
  };

  const getRarityBadge = (rarity: AkGachaRecord['rarity']) => {
    if (rarity === 6) return 'text-[#FF6A2B] border-[#FF6A2B]/50 bg-[#FF6A2B]/15';
    if (rarity === 5) return 'text-[#F4C44E] border-[#F4C44E]/50 bg-[#F4C44E]/15';
    if (rarity === 4) return 'text-[#A78BFA] border-[#A78BFA]/40 bg-[#A78BFA]/10';
    return 'text-[#7D899B] border-[#293240] bg-[#1A2029]';
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[11px] tracking-widest text-[#22BBFF]">
            HEADHUNTING // 干员寻访分析
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5">明日方舟抽卡统计</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncCurrentGame()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {dataMode === 'demo' ? '演示数据' : '同步寻访'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#13171D] hover:bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            导入 JSON
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#13171D] hover:bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
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

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
          <div className="text-xs text-[#7D899B] font-mono-tech">TOTAL PULLS // 总寻访</div>
          <div className="text-2xl font-black font-mono-tech mt-1 tabular-nums">
            {stats.totalPulls}
          </div>
          <div className="text-[11px] text-[#7D899B] mt-1 tabular-nums">
            折合合成玉 {(stats.totalPulls * 600).toLocaleString()}
          </div>
        </div>

        <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
          <div className="text-xs text-[#7D899B] font-mono-tech">6★ OPERATORS // 六星出货</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono-tech text-[#FF6A2B] tabular-nums">
              {stats.sixCount}
            </span>
            <span className="text-xs font-mono-tech text-[#B4C0D0]">
              ({stats.sixRate}%)
            </span>
          </div>
          <div className="text-[11px] text-[#7D899B] mt-1">5★ 共 {stats.fiveCount} 名</div>
        </div>

        <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
          <div className="text-xs text-[#7D899B] font-mono-tech">AVG PITY // 平均六星</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
              {stats.avgPullsPerSix || '--'}
            </span>
            <span className="text-xs text-[#7D899B]">抽</span>
          </div>
          <div className="text-[11px] text-[#7D899B] mt-1">理论期望 ≈ 34.5 抽</div>
        </div>

        <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-[#7D899B] font-mono-tech">EVALUATION // 评级</div>
            <div className="text-xs text-[#B4C0D0] mt-2">
              {stats.luckRating === 'EX' || stats.luckRating === 'S'
                ? '欧气显著高于期望'
                : stats.luckRating === 'A'
                ? '状态稳定良好'
                : '符合常规浮动'}
            </div>
          </div>
          <span
            className={`px-3 py-1.5 text-xl font-black font-mono-tech border ${
              stats.luckRating === 'EX' || stats.luckRating === 'S'
                ? 'bg-[#FF6A2B]/20 text-[#FF6A2B] border-[#FF6A2B]'
                : stats.luckRating === 'A'
                ? 'bg-[#22BBFF]/20 text-[#22BBFF] border-[#22BBFF]'
                : 'bg-[#1A2029] text-[#B4C0D0] border-[#394659]'
            }`}
          >
            {stats.luckRating}
          </span>
        </div>
      </section>

      {/* 50-Pull Soft Pity Progress Bar */}
      <section className="bg-[#13171D] border border-[#293240] p-4 sm:p-5 ak-chamfer">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#22BBFF]" />
            <h2 className="text-sm font-bold">当前 6★ 保底水位（50 抽后每抽 +2%）</h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-tech tabular-nums">
            <span className="text-[#B4C0D0]">
              当前概率 <strong className="text-[#FF6A2B]">{stats.currentSixChance}%</strong>
            </span>
            {stats.softPityBonus > 0 && (
              <span className="px-2 py-0.5 bg-[#FF6A2B]/20 text-[#FF6A2B] border border-[#FF6A2B]/50">
                软保底加成 +{stats.softPityBonus}%
              </span>
            )}
          </div>
        </div>

        <div className="relative h-4 bg-[#0A0C0F] border border-[#293240] overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${pityBarColor} transition-all duration-500`}
            style={{ width: `${Math.min(100, stats.currentPity)}%` }}
          />
          {/* 50-pull soft pity threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#FF9A2E]"
            style={{ left: '50%' }}
            title="50抽软保底线"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono-tech text-[#7D899B] mt-2 tabular-nums">
          <span>已累计垫抽：{stats.currentPity} / 99</span>
          <span className="text-[#FF9A2E]">50 抽起触发概率提升</span>
          <span>距极限保底：{Math.max(0, 99 - stats.currentPity)} 抽</span>
        </div>
      </section>

      {/* Distribution Chart + 6-Star Timeline */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Star Distribution Chart */}
        <div className="lg:col-span-5 bg-[#13171D] border border-[#293240] p-4">
          <div className="text-xs font-mono-tech text-[#7D899B] mb-3">
            RARITY DISTRIBUTION // 星级分布
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  stroke="#7D899B"
                  tick={{ fill: '#B4C0D0', fontSize: 12 }}
                  axisLine={{ stroke: '#293240' }}
                />
                <YAxis
                  stroke="#7D899B"
                  tick={{ fill: '#7D899B', fontSize: 11 }}
                  axisLine={{ stroke: '#293240' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(34, 187, 255, 0.08)' }}
                  contentStyle={{
                    backgroundColor: '#0A0C0F',
                    borderColor: '#293240',
                    color: '#ECF0F5',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-[#293240] text-center">
            {chartData.map((item) => (
              <div key={item.name}>
                <div className="text-xs font-bold" style={{ color: item.color }}>
                  {item.name}
                </div>
                <div className="text-xs font-mono-tech tabular-nums text-[#ECF0F5]">
                  {item.count}
                </div>
                <div className="text-[10px] font-mono-tech text-[#7D899B]">{item.rate}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* 6-Star Timeline */}
        <div className="lg:col-span-7 bg-[#13171D] border border-[#293240] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono-tech text-[#7D899B]">
              6★ TIMELINE // 六星出货抽数横条
            </span>
            <span className="text-[11px] font-mono-tech text-[#22BBFF]">
              共 {stats.sixStarTimeline.length} 次出货
            </span>
          </div>

          {stats.sixStarTimeline.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#7D899B]">
              当前筛选范围内暂无 6★ 干员出货记录
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {stats.sixStarTimeline.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-[#ECF0F5] truncate">
                        {item.charName}
                      </span>
                      {item.isNew && (
                        <span className="px-1.5 py-0.2 bg-[#FF6A2B]/20 text-[#FF6A2B] border border-[#FF6A2B]/40 text-[10px] font-mono-tech">
                          NEW
                        </span>
                      )}
                      <span className="text-[11px] text-[#7D899B] truncate hidden sm:inline">
                        {item.poolName}
                      </span>
                    </div>
                    <span className="font-mono-tech font-bold tabular-nums text-[#ECF0F5] shrink-0">
                      {item.pulls} 抽
                    </span>
                  </div>
                  <div className="h-2 bg-[#0A0C0F] border border-[#293240]/80 overflow-hidden">
                    <div
                      className={`h-full ${getPullBarColor(item.pulls)}`}
                      style={{ width: `${Math.min(100, (item.pulls / 80) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Searchable Pull History Table */}
      <section className="bg-[#13171D] border border-[#293240] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-xs font-mono-tech text-[#7D899B]">
            PULL LOG // 寻访明细 ({filteredRecords.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7D899B] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索干员或卡池..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#0A0C0F] border border-[#293240] focus:border-[#22BBFF] outline-none text-[#ECF0F5] w-44 sm:w-52"
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
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
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
              {filteredRecords.slice(0, 100).map((r) => (
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
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-mono-tech border ${getRarityBadge(
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
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#7D899B]">
                    无匹配寻访记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
