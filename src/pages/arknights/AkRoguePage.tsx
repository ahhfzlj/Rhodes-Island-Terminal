import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Compass,
  Lock,
  RefreshCw,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import type { RogueRecentRun, RogueRunOperator } from '../../types/index.js';

function formatRunDateTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatRunDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}时${String(m).padStart(2, '0')}分`;
  return `${m}分${String(s).padStart(2, '0')}秒`;
}

function getRarityColor(rarity: number): string {
  if (rarity >= 6) return 'text-[#FF9A2E] border-[#FF9A2E]/40 bg-[#FF9A2B]/15';
  if (rarity === 5) return 'text-[#F4C44E] border-[#F4C44E]/40 bg-[#F4C44E]/10';
  if (rarity === 4) return 'text-[#C084FC] border-[#C084FC]/40 bg-[#C084FC]/10';
  return 'text-[#22BBFF] border-[#22BBFF]/40 bg-[#22BBFF]/10';
}

const RunOperatorChip: React.FC<{ op: RogueRunOperator }> = ({ op }) => (
  <div className="bg-[#0A0C0F] border border-[#293240] px-2.5 py-2 flex flex-col justify-between gap-1">
    <div className="flex items-center justify-between gap-1">
      <span
        className={`px-1 py-0.5 text-[10px] font-mono-tech font-bold border leading-none ${getRarityColor(
          op.rarity
        )}`}
      >
        {op.rarity}★
      </span>
      <span className="text-[10px] font-mono-tech text-[#7D899B]">
        {op.profession || '干员'}
      </span>
    </div>
    <div className="text-xs font-bold text-[#ECF0F5] truncate" title={op.name}>
      {op.name}
    </div>
    <div className="flex items-center justify-between text-[10px] font-mono-tech text-[#B4C0D0]">
      <span>{op.evolvePhase > 0 ? `精${op.evolvePhase}` : '未精英'}</span>
      <span className="text-[#22BBFF]">Lv.{op.level}</span>
    </div>
  </div>
);

export const AkRoguePage: React.FC = () => {
  const { akRogue, dataMode, syncCurrentGame, syncing } = useApp();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [runTab, setRunTab] = useState<'recent' | 'favorite'>('recent');
  const [selectedRun, setSelectedRun] = useState<RogueRecentRun | null>(null);
  const [showAllRelics, setShowAllRelics] = useState(false);

  const safeIdx = Math.min(selectedIdx, Math.max(0, akRogue.length - 1));
  const currentTheme = akRogue[safeIdx] || akRogue[0];

  const showRelicRatio = Boolean(
    currentTheme &&
      currentTheme.relicsTotalKnown !== false &&
      currentTheme.relicsTotal >= currentTheme.relicsUnlocked &&
      currentTheme.relicsTotal > 0
  );

  const favRuns = currentTheme
    ? currentTheme.recentRuns.filter((r) => r.isFavorite)
    : [];
  const displayedRuns = currentTheme
    ? runTab === 'favorite'
      ? favRuns
      : currentTheme.recentRuns
    : [];

  const handleThemeSelect = (idx: number) => {
    setSelectedIdx(idx);
    setRunTab('recent');
    setSelectedRun(null);
    setShowAllRelics(false);
  };

  const totemCountSum = selectedRun?.totems
    ? selectedRun.totems.reduce((acc, item) => acc + (item.count ?? 1), 0)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[11px] tracking-widest text-[#FF9A2E]">
            INTEGRATED STRATEGIES // 集成战略战绩
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5">集成战略（肉鸽）档案</h1>
        </div>
        <button
          type="button"
          onClick={() => void syncCurrentGame()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#22BBFF] text-[#07131A] cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {dataMode === 'demo' ? '演示数据' : '同步肉鸽记录'}
        </button>
      </div>

      {akRogue.length === 0 ? (
        <div className="bg-[#13171D] border border-[#293240] p-8 text-center space-y-3 ak-chamfer">
          <Compass className="w-8 h-8 text-[#FF9A2E] mx-auto opacity-80" />
          <div className="text-sm font-bold">暂无集成战略同步数据</div>
          <p className="text-xs text-[#7D899B] max-w-md mx-auto">
            请绑定森空岛 Cred 后点击「同步肉鸽记录」，或切换至演示模式预览全部主题战绩。
          </p>
        </div>
      ) : (
        <>
          {/* Horizontal Scrollable Theme Selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {akRogue.map((theme, idx) => {
              const active = idx === safeIdx;
              return (
                <button
                  key={theme.themeId}
                  type="button"
                  onClick={() => handleThemeSelect(idx)}
                  className={`px-3.5 py-2 text-left shrink-0 transition-all cursor-pointer border ${
                    active
                      ? 'bg-[#22BBFF]/15 border-[#22BBFF] text-[#ECF0F5] ak-chamfer-sm'
                      : 'bg-[#13171D] border-[#293240] text-[#7D899B] hover:text-[#ECF0F5]'
                  }`}
                >
                  <div className="font-mono-tech text-[10px] text-[#22BBFF]">
                    {theme.codeName}
                  </div>
                  <div className="text-xs sm:text-sm font-bold mt-0.5">
                    {theme.themeName}
                  </div>
                </button>
              );
            })}
          </div>

          {currentTheme && (
            <>
              {/* Skland-Style Primary Overview Card */}
              <section className="bg-[#13171D] border border-[#293240] p-4 space-y-4 ak-chamfer">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Highest Achieved Difficulty */}
                  <div className="bg-[#0A0C0F] border border-[#293240] p-3.5 flex flex-col justify-between">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      MAX ACHIEVED // 最高达成
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-lg sm:text-xl font-black text-[#22BBFF]">
                        {currentTheme.bestModeLabel || '最高难度'}
                      </span>
                      <span className="text-xs text-[#7D899B]">♦</span>
                      <span className="text-xl sm:text-2xl font-black font-mono-tech text-[#FF9A2E] tabular-nums">
                        {currentTheme.maxDifficulty}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#7D899B] mt-1 font-mono-tech">
                      难度上限 N{currentTheme.difficultyCap}
                    </div>
                  </div>

                  {/* Highest Score */}
                  <div className="bg-[#0A0C0F] border border-[#293240] p-3.5 flex flex-col justify-between">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      RECORD // 最高得分
                    </div>
                    <div className="text-2xl font-black font-mono-tech text-[#ECF0F5] mt-1.5 tabular-nums">
                      {currentTheme.highestScore ?? '--'}
                    </div>
                    <div className="text-[11px] text-[#34D399] mt-1 font-mono-tech">
                      单局最高结算分
                    </div>
                  </div>

                  {/* Reward Level */}
                  <div className="bg-[#0A0C0F] border border-[#293240] p-3.5 flex flex-col justify-between">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      LV. // 奖励等级
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-2xl font-black font-mono-tech text-[#22BBFF] tabular-nums">
                        Lv.{currentTheme.level}
                      </span>
                      <span className="text-xs font-mono-tech text-[#7D899B]">
                        / {currentTheme.maxLevel}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#13171D] mt-2 overflow-hidden">
                      <div
                        className="h-full bg-[#22BBFF]"
                        style={{
                          width: `${Math.min(
                            100,
                            (currentTheme.level / Math.max(1, currentTheme.maxLevel)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary Career KPIs: Relics, Bank, Medals/Runs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-[#0A0C0F]/80 border border-[#293240] p-3">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      RELICS // 收藏品解锁
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
                        {currentTheme.relicsUnlocked}
                      </span>
                      {showRelicRatio && (
                        <span className="text-xs font-mono-tech text-[#7D899B]">
                          / {currentTheme.relicsTotal}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#F4C44E] mt-0.5 font-mono-tech">
                      {showRelicRatio
                        ? `完成率 ${Math.min(
                            100,
                            Math.round(
                              (currentTheme.relicsUnlocked /
                                Math.max(1, currentTheme.relicsTotal)) *
                                100
                            )
                          )}%`
                        : '森空岛已解锁藏品数'}
                    </div>
                  </div>

                  <div className="bg-[#0A0C0F]/80 border border-[#293240] p-3">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      BANK // 源石锭投资
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Coins className="w-4 h-4 text-[#F4C44E]" />
                      <span className="text-xl font-black font-mono-tech text-[#F4C44E] tabular-nums">
                        {currentTheme.investedOriginium}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#7D899B] mt-0.5">
                      {currentTheme.investedRecord &&
                      currentTheme.investedRecord > currentTheme.investedOriginium
                        ? `历史最高 ${currentTheme.investedRecord}`
                        : '坎诺特投资系统存量'}
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-[#0A0C0F]/80 border border-[#293240] p-3">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      MEDAL & RUNS // 蚀刻与通关
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Award className="w-4 h-4 text-[#22BBFF]" />
                      <span className="text-xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
                        {currentTheme.medalCurrent !== undefined &&
                        currentTheme.medalTotal !== undefined
                          ? `${currentTheme.medalCurrent} / ${currentTheme.medalTotal}`
                          : `${currentTheme.clearedRuns} 胜`}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#34D399] mt-0.5 font-mono-tech">
                      通关 {currentTheme.clearedRuns} 次 · 探索 {currentTheme.totalRuns} 次
                    </div>
                  </div>
                </div>

                {/* Recent Favorite Operators (最近常用干员) */}
                {currentTheme.favoriteChars && currentTheme.favoriteChars.length > 0 && (
                  <div className="pt-2 border-t border-[#293240]/70 space-y-2">
                    <div className="text-[11px] font-mono-tech text-[#7D899B]">
                      FREQUENT OPERATORS // 最近常用干员
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {currentTheme.favoriteChars.map((op, i) => (
                        <RunOperatorChip key={`${op.id}_${i}`} op={op} />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Endings Matrix */}
              <section className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono-tech text-[#7D899B]">
                    ENDING MATRIX // 结局达成矩阵
                  </span>
                  <span className="text-xs font-mono-tech text-[#22BBFF]">
                    {currentTheme.endings.filter((e) => e.unlocked).length} /{' '}
                    {currentTheme.endings.length} UNLOCKED
                  </span>
                </div>
                {currentTheme.endings.length === 0 ? (
                  <div className="py-4 text-xs text-[#7D899B]">
                    当前主题暂未同步到结局达成数据，请点击右上角「同步肉鸽记录」刷新。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {currentTheme.endings.map((ending) => (
                      <div
                        key={ending.id}
                        className={`p-3 border flex items-center justify-between gap-2 ${
                          ending.unlocked
                            ? 'bg-[#1A2029] border-[#22BBFF]/40'
                            : 'bg-[#0A0C0F] border-[#293240] opacity-65'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-mono-tech text-[10px] text-[#22BBFF]">
                            {ending.code}
                          </div>
                          <div className="text-sm font-bold text-[#ECF0F5] truncate">
                            {ending.name}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {ending.unlocked ? (
                            <div className="flex items-center gap-1 text-xs font-mono-tech text-[#34D399]">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {ending.maxGrade !== undefined
                                  ? `最高 N${ending.maxGrade}`
                                  : `×${ending.clearCount}`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs font-mono-tech text-[#7D899B]">
                              <Lock className="w-3.5 h-3.5" />
                              <span>未达成</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Squad Progress Grid */}
              {currentTheme.squads.length > 0 && (
                <section className="bg-[#13171D] border border-[#293240] p-4">
                  <div className="text-xs font-mono-tech text-[#7D899B] mb-3">
                    SQUAD PROGRESS // 分队通关记录
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {currentTheme.squads.map((sq) => (
                      <div
                        key={sq.squadName}
                        className="p-3 bg-[#0A0C0F] border border-[#293240] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#ECF0F5]">
                            {sq.squadName}
                          </div>
                          <div className="text-[11px] font-mono-tech text-[#7D899B] mt-0.5">
                            最高 N{sq.maxDifficulty}
                          </div>
                        </div>
                        <Trophy
                          className={`w-4 h-4 ${
                            sq.maxDifficulty >= currentTheme.difficultyCap
                              ? 'text-[#F4C44E]'
                              : 'text-[#22BBFF]'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Combat Logs with 最近 / 收藏 Tabs + Clickable Run Detail Modal */}
              {currentTheme.recentRuns.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-tech text-[#7D899B]">
                      COMBAT LOGS // 作战记录
                    </span>
                    <div className="flex items-center gap-1 bg-[#13171D] border border-[#293240] p-0.5">
                      <button
                        type="button"
                        onClick={() => setRunTab('recent')}
                        className={`px-2.5 py-1 text-xs font-mono-tech cursor-pointer transition-colors ${
                          runTab === 'recent'
                            ? 'bg-[#22BBFF] text-[#07131A] font-bold'
                            : 'text-[#7D899B] hover:text-[#ECF0F5]'
                        }`}
                      >
                        最近 ({currentTheme.recentRuns.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRunTab('favorite')}
                        className={`px-2.5 py-1 text-xs font-mono-tech cursor-pointer transition-colors inline-flex items-center gap-1 ${
                          runTab === 'favorite'
                            ? 'bg-[#FF9A2E] text-[#07131A] font-bold'
                            : 'text-[#7D899B] hover:text-[#ECF0F5]'
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        收藏 ({favRuns.length})
                      </button>
                    </div>
                  </div>

                  {displayedRuns.length === 0 ? (
                    <div className="bg-[#13171D] border border-[#293240] p-6 text-center text-xs text-[#7D899B]">
                      暂无收藏的集成战略战绩。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {displayedRuns.map((run) => (
                        <button
                          key={run.runId}
                          type="button"
                          onClick={() => {
                            setShowAllRelics(false);
                            setSelectedRun(run);
                          }}
                          className={`text-left bg-[#13171D] hover:bg-[#171D26] border p-3.5 space-y-2.5 transition-all cursor-pointer ak-chamfer-sm ${
                            run.cleared
                              ? 'border-[#34D399]/35 hover:border-[#34D399]/70'
                              : 'border-[#293240] hover:border-[#22BBFF]/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#ECF0F5] truncate">
                                {run.modeLabel || '集成战略'}
                                {run.difficulty > 0 ? ` · ${run.difficulty}` : ''}
                              </div>
                              <div className="text-xs font-mono-tech text-[#22BBFF] mt-0.5 tabular-nums">
                                得分 {run.score}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block px-2 py-0.5 text-[10px] font-mono-tech font-bold ${
                                  run.cleared
                                    ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40'
                                    : 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                                }`}
                              >
                                {run.cleared ? '胜利' : '失败'}
                              </span>
                              <div className="text-[11px] font-bold text-[#FF9A2E] mt-0.5 truncate max-w-[140px]">
                                「{run.lastStage || run.endingName}」
                              </div>
                            </div>
                          </div>

                          {run.lastChars && run.lastChars.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {run.lastChars.slice(0, 6).map((ch, idx) => (
                                <span
                                  key={`${ch.id}_${idx}`}
                                  className="px-1.5 py-0.5 text-[10px] bg-[#0A0C0F] border border-[#293240] text-[#B4C0D0]"
                                >
                                  {ch.name}
                                </span>
                              ))}
                              {run.lastChars.length > 6 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#0A0C0F] border border-[#293240] text-[#7D899B]">
                                  +{run.lastChars.length - 6}
                                </span>
                              )}
                            </div>
                          )}

                          {run.tags && run.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {run.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.name}
                                  className="px-1.5 py-0.5 text-[10px] bg-[#725CAD]/25 border border-[#725CAD]/50 text-[#D8B4FE]"
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="pt-2 border-t border-[#293240]/70 flex items-center justify-between text-[11px] text-[#7D899B]">
                            <span className="truncate">{run.squadName}</span>
                            <span className="flex items-center gap-1 font-mono-tech shrink-0 text-[#22BBFF]">
                              <span>{formatRunDateTime(run.ts)}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* Skland-Style Run Detail Modal */}
      {selectedRun && currentTheme && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#13171D] border border-[#22BBFF]/60 p-4 sm:p-5 space-y-5 ak-chamfer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#293240]">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-xs font-mono-tech font-bold ${
                      selectedRun.cleared
                        ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40'
                        : 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                    }`}
                  >
                    {selectedRun.cleared ? '胜利' : '失败'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#ECF0F5]">
                    「{selectedRun.lastStage || selectedRun.endingName}」
                  </span>
                  <span className="text-sm font-mono-tech font-bold text-[#22BBFF] tabular-nums">
                    得分 {selectedRun.score}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-[#7D899B] font-mono-tech">
                  <span>{formatRunDateTime(selectedRun.ts)}</span>
                  {selectedRun.durationSec !== undefined && selectedRun.durationSec > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRunDuration(selectedRun.durationSec)}
                    </span>
                  )}
                  <span className="text-[#FF9A2E]">
                    {selectedRun.modeLabel || currentTheme.bestModeLabel || '集成战略'}
                    {selectedRun.difficulty > 0 ? ` · ${selectedRun.difficulty}` : ''}
                  </span>
                  <span className="text-[#ECF0F5]">{selectedRun.squadName}</span>
                </div>
                {selectedRun.tags && selectedRun.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedRun.tags.map((tag) => (
                      <span
                        key={tag.name}
                        title={tag.description}
                        className="px-2 py-0.5 text-[11px] bg-[#725CAD]/25 border border-[#725CAD]/50 text-[#D8B4FE]"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="text-[#7D899B] hover:text-[#ECF0F5] cursor-pointer shrink-0 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Journey Review (历程回顾) */}
            <div className="space-y-2">
              <div className="text-xs font-mono-tech text-[#7D899B]">
                JOURNEY REVIEW // 历程回顾
              </div>
              <div className="bg-[#0A0C0F] border border-[#293240] p-3.5 text-sm leading-relaxed">
                {selectedRun.journeySegments && selectedRun.journeySegments.length > 0 ? (
                  selectedRun.journeySegments.map((seg, i) => {
                    const useAccent = seg.highlight;
                    const safeColor = useAccent
                      ? seg.color || '#80E3EE'
                      : '#B4C0D0';
                    return (
                      <span
                        key={`${i}_${seg.text}`}
                        style={{ color: safeColor }}
                        className={useAccent ? 'font-bold' : ''}
                      >
                        {seg.text}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[#B4C0D0]">{selectedRun.endingName}</span>
                )}
              </div>
            </div>

            {/* Initial Operators (初始干员) */}
            {selectedRun.initChars && selectedRun.initChars.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono-tech text-[#7D899B]">
                  INITIAL OPERATORS // 初始干员 ({selectedRun.initChars.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedRun.initChars.map((op, i) => (
                    <RunOperatorChip key={`${op.id}_init_${i}`} op={op} />
                  ))}
                </div>
              </div>
            )}

            {/* Recruited Operators (招募干员) */}
            {selectedRun.troopChars && selectedRun.troopChars.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono-tech text-[#7D899B]">
                  RECRUITED OPERATORS // 招募干员 ({selectedRun.troopChars.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedRun.troopChars.map((op, i) => (
                    <RunOperatorChip key={`${op.id}_troop_${i}`} op={op} />
                  ))}
                </div>
              </div>
            )}

            {/* Run Statistics (数据统计) */}
            {selectedRun.stats && (
              <div className="space-y-2">
                <div className="text-xs font-mono-tech text-[#7D899B]">
                  STATISTICS // 数据统计
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    { label: '得分', value: selectedRun.score, accent: 'text-[#22BBFF]' },
                    { label: '通过层数', value: selectedRun.stats.crossedZone },
                    { label: '获得物品数', value: selectedRun.stats.gainRelicItem },
                    { label: '通过步数', value: selectedRun.stats.arrivedNode },
                    { label: '领袖战斗次数', value: selectedRun.stats.battleBoss },
                    { label: '普通战斗次数', value: selectedRun.stats.battleNormal },
                    { label: '精英战斗次数', value: selectedRun.stats.battleElite },
                    { label: '招募干员次数', value: selectedRun.stats.recruitUpgrade },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-[#0A0C0F] border border-[#293240] p-2.5"
                    >
                      <div className="text-[10px] text-[#7D899B]">{item.label}</div>
                      <div
                        className={`text-base font-black font-mono-tech mt-0.5 tabular-nums ${
                          item.accent || 'text-[#ECF0F5]'
                        }`}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Theme Totems / Copper / Parts (主题专属物品) */}
            {selectedRun.totems && selectedRun.totems.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono-tech text-[#7D899B]">
                  {currentTheme.totemLabel || '专属物品'} ({totemCountSum})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedRun.totems.map((totem, i) => (
                    <div
                      key={`${totem.id}_${i}`}
                      className="bg-[#0A0C0F] border border-[#293240] p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#ECF0F5]">
                          {totem.name}
                        </span>
                        {totem.count !== undefined && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#FF9A2E]/15 border border-[#FF9A2E]/40 text-[#FF9A2E]">
                            ×{totem.count}
                          </span>
                        )}
                      </div>
                      {(totem.usage || totem.description) && (
                        <div className="text-[11px] text-[#7D899B] leading-snug">
                          {totem.usage || totem.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collected Relics (获得收藏品) */}
            {selectedRun.relics && selectedRun.relics.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono-tech text-[#7D899B]">
                  RELICS // 收藏品 ({selectedRun.relics.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllRelics
                    ? selectedRun.relics
                    : selectedRun.relics.slice(0, 16)
                  ).map((relic, i) => (
                    <span
                      key={`${relic.id}_${i}`}
                      title={relic.usage || relic.description}
                      className="px-2 py-1 text-[11px] bg-[#0A0C0F] border border-[#293240] text-[#B4C0D0]"
                    >
                      {relic.name}
                    </span>
                  ))}
                </div>
                {selectedRun.relics.length > 16 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRelics((prev) => !prev)}
                    className="text-xs font-mono-tech text-[#22BBFF] hover:underline cursor-pointer"
                  >
                    {showAllRelics
                      ? '收起部分收藏品'
                      : `展开全部 ${selectedRun.relics.length} 件收藏品`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
