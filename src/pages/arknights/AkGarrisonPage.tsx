import React, { useState } from 'react';
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
  Award,
  Clock,
  RefreshCw,
  Shield,
  Skull,
  Swords,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { apiClient } from '../../services/apiClient.js';
import type { GarrisonMatch } from '../../types/index.js';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export const AkGarrisonPage: React.FC = () => {
  const { akGarrison, dataMode, setDataMode, syncCurrentGame, syncing, refreshAll, showToast } =
    useApp();
  const [selectedMatch, setSelectedMatch] = useState<GarrisonMatch | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importText);
      await apiClient.importArknightsGarrison(parsed);
      await refreshAll();
      setDataMode('live');
      setImportOpen(false);
      setImportText('');
      showToast('已导入卫戍协议战绩 JSON 并切换至实时库', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'JSON 解析失败', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[11px] tracking-widest text-[#22BBFF]">
            GARRISON PROTOCOL // 卫戍协议战绩档案
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5">
            {akGarrison?.seasonName || '卫戍协议战绩'}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncCurrentGame()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {dataMode === 'demo' ? '演示赛季' : '同步战绩'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#13171D] hover:bg-[#1A2029] border border-[#293240] text-[#ECF0F5] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            导入战绩 JSON
          </button>
        </div>
      </div>

      {!akGarrison ? (
        <div className="bg-[#13171D] border border-[#293240] p-8 text-center space-y-3 ak-chamfer">
          <Shield className="w-8 h-8 text-[#22BBFF] mx-auto opacity-75" />
          <div className="text-sm font-bold">暂无卫戍协议战绩数据</div>
          <p className="text-xs text-[#7D899B] max-w-md mx-auto">
            请绑定森空岛 Cred 后点击同步，或导入卫戍协议战绩 JSON / 切换回演示模式查看完整战绩面板。
          </p>
        </div>
      ) : (
        <>
          {/* Career KPI Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-[#13171D] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="text-[11px] font-mono-tech text-[#7D899B]">MATCHES // 总局数</div>
              <div className="text-2xl font-black font-mono-tech mt-1 tabular-nums">
                {akGarrison.totalMatches}
              </div>
              <div className="text-[11px] text-[#34D399] mt-0.5">
                通关 {akGarrison.clearCount} 局
              </div>
            </div>

            <div className="bg-[#13171D] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="text-[11px] font-mono-tech text-[#7D899B]">WIN RATE // 通关率</div>
              <div className="text-2xl font-black font-mono-tech text-[#22BBFF] mt-1 tabular-nums">
                {akGarrison.winRate}%
              </div>
              <div className="text-[11px] text-[#7D899B] mt-0.5 truncate">
                常用：{akGarrison.favoriteStrategy}
              </div>
            </div>

            <div className="bg-[#13171D] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="text-[11px] font-mono-tech text-[#7D899B]">MAX DIFF // 最高协议</div>
              <div className="text-2xl font-black font-mono-tech text-[#FF9A2E] mt-1 tabular-nums">
                N{akGarrison.highestDiff}
              </div>
              <div className="text-[11px] text-[#7D899B] mt-0.5 truncate">
                {akGarrison.highestDiffLabel}
              </div>
            </div>

            <div className="bg-[#13171D] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="text-[11px] font-mono-tech text-[#7D899B]">TROPHIES // 奖杯数</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Award className="w-5 h-5 text-[#F4C44E]" />
                <span className="text-2xl font-black font-mono-tech text-[#F4C44E] tabular-nums">
                  {akGarrison.trophies}
                </span>
              </div>
              <div className="text-[11px] text-[#7D899B] mt-0.5">赛季累计荣誉</div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#13171D] border border-[#293240] p-3.5 ak-chamfer-sm">
              <div className="text-[11px] font-mono-tech text-[#7D899B]">BOSS KILLS // 首领击杀</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Skull className="w-5 h-5 text-[#FF6A2B]" />
                <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
                  {akGarrison.normalBossKills + akGarrison.hiddenBossKills}
                </span>
              </div>
              <div className="text-[11px] text-[#FF6A2B] mt-0.5">
                隐秘首领 ×{akGarrison.hiddenBossKills}
              </div>
            </div>
          </section>

          {/* Covenant Win-Rate Horizontal Chart */}
          {akGarrison.covenantStats.length > 0 && (
            <section className="bg-[#13171D] border border-[#293240] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono-tech text-[#7D899B]">
                  COVENANT WIN RATE // 盟约通关率统计 (%)
                </span>
                <span className="text-[11px] font-mono-tech text-[#22BBFF]">
                  点击下方战绩可展开阵容详情
                </span>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={akGarrison.covenantStats}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke="#7D899B"
                      tick={{ fill: '#7D899B', fontSize: 11 }}
                      axisLine={{ stroke: '#293240' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={64}
                      stroke="#7D899B"
                      tick={{ fill: '#ECF0F5', fontSize: 12 }}
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
                      formatter={(val: number) => [`${val}%`, '通关率']}
                    />
                    <Bar dataKey="winRate" radius={[0, 3, 3, 0]}>
                      {akGarrison.covenantStats.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={idx === 0 ? '#FF9A2E' : idx < 3 ? '#22BBFF' : '#5EEAD4'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Match History Cards */}
          <section className="space-y-3">
            <div className="text-xs font-mono-tech text-[#7D899B]">
              COMBAT LOGS // 近期对局记录 ({akGarrison.matches.length})
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {akGarrison.matches.map((match) => (
                <button
                  key={match.matchId}
                  type="button"
                  onClick={() => setSelectedMatch(match)}
                  className="text-left bg-[#13171D] hover:bg-[#171D26] border border-[#293240] hover:border-[#22BBFF]/60 p-4 transition-all cursor-pointer ak-chamfer-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono-tech font-bold ${
                          match.cleared
                            ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40'
                            : 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                        }`}
                      >
                        {match.cleared ? 'CLEAR // 通关' : `W${match.finalWave}/${match.maxWave} 撤离`}
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-mono-tech bg-[#1A2029] border border-[#394659] text-[#FF9A2E]">
                        {match.difficultyLabel}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tech text-[#7D899B] tabular-nums">
                      {new Date(match.ts).toLocaleDateString('zh-CN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#ECF0F5]">{match.strategyName}</h3>
                    <span className="font-mono-tech text-xs font-bold text-[#22BBFF] tabular-nums">
                      SCORE {match.score}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {match.covenants.map((cov) => (
                      <span
                        key={cov}
                        className="px-1.5 py-0.5 text-[10px] bg-[#0A0C0F] border border-[#293240] text-[#B4C0D0]"
                      >
                        {cov}
                      </span>
                    ))}
                    {match.hiddenBossKills.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-[#FF6A2B]/15 border border-[#FF6A2B]/40 text-[#FF6A2B]">
                        隐秘BOSS击破
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#293240]/70 flex items-center justify-between text-[11px] text-[#7D899B]">
                    <span className="truncate max-w-[70%]">
                      阵容：{match.squad.map((op) => op.name).join(' · ') || '未记录'}
                    </span>
                    <span className="flex items-center gap-1 font-mono-tech shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDuration(match.durationSec)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-[#13171D] border border-[#22BBFF]/60 p-5 space-y-4 ak-chamfer">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono-tech text-[10px] text-[#22BBFF]">
                  MATCH DETAIL // {selectedMatch.matchId}
                </div>
                <h3 className="text-lg font-bold text-[#ECF0F5] mt-0.5">
                  {selectedMatch.strategyName} · {selectedMatch.difficultyLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="text-[#7D899B] hover:text-[#ECF0F5] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center bg-[#0A0C0F] border border-[#293240] p-3">
              <div>
                <div className="text-[10px] font-mono-tech text-[#7D899B]">RESULT</div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    selectedMatch.cleared ? 'text-[#34D399]' : 'text-[#F87171]'
                  }`}
                >
                  {selectedMatch.cleared ? '行动成功' : '行动中止'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tech text-[#7D899B]">SCORE</div>
                <div className="text-sm font-bold font-mono-tech text-[#22BBFF] mt-0.5 tabular-nums">
                  {selectedMatch.score}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tech text-[#7D899B]">DURATION</div>
                <div className="text-sm font-bold font-mono-tech text-[#ECF0F5] mt-0.5 tabular-nums">
                  {formatDuration(selectedMatch.durationSec)}
                </div>
              </div>
            </div>

            {/* Boss Kills */}
            <div className="space-y-1.5">
              <div className="text-xs font-mono-tech text-[#7D899B] flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-[#FF6A2B]" />
                首领击杀明细
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedMatch.normalBossKills.map((b) => (
                  <span
                    key={b}
                    className="px-2 py-1 text-xs bg-[#1A2029] border border-[#293240] text-[#ECF0F5]"
                  >
                    普通首领：{b}
                  </span>
                ))}
                {selectedMatch.hiddenBossKills.map((b) => (
                  <span
                    key={b}
                    className="px-2 py-1 text-xs bg-[#FF6A2B]/20 border border-[#FF6A2B]/50 text-[#FF6A2B] font-semibold"
                  >
                    隐秘首领：{b}
                  </span>
                ))}
                {selectedMatch.normalBossKills.length === 0 &&
                  selectedMatch.hiddenBossKills.length === 0 && (
                    <span className="text-xs text-[#7D899B]">暂无首领击破记录</span>
                  )}
              </div>
            </div>

            {/* Squad & Equipments */}
            <div className="space-y-2">
              <div className="text-xs font-mono-tech text-[#7D899B]">
                出战干员及装配组件 ({selectedMatch.squad.length})
              </div>
              <div className="space-y-2">
                {selectedMatch.squad.map((op) => (
                  <div
                    key={op.charId + op.name}
                    className="bg-[#0A0C0F] border border-[#293240] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#FF6A2B]/20 text-[#FF6A2B] border border-[#FF6A2B]/40">
                        {op.rarity}★
                      </span>
                      <span className="text-sm font-bold text-[#ECF0F5]">{op.name}</span>
                      <span className="text-xs text-[#7D899B]">{op.profession}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(op.equipments || []).map((eq) => (
                        <span
                          key={eq}
                          className="px-2 py-0.5 text-[11px] bg-[#1A2029] border border-[#394659] text-[#22BBFF]"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Garrison JSON Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg bg-[#13171D] border border-[#394659] p-5 space-y-4 ak-chamfer">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#ECF0F5]">导入卫戍协议战绩 JSON</h3>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="text-[#7D899B] hover:text-[#ECF0F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#7D899B]">
              若森空岛接口返回空或需恢复历史战绩，可粘贴抓包/第三方导出的卫戍协议 JSON 数据。
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder='粘贴卫戍协议战绩 JSON...'
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
