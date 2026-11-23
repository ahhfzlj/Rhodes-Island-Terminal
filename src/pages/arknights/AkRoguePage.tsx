import React, { useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Compass,
  Lock,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const AkRoguePage: React.FC = () => {
  const { akRogue, dataMode, syncCurrentGame, syncing } = useApp();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const safeIdx = Math.min(selectedIdx, Math.max(0, akRogue.length - 1));
  const currentTheme = akRogue[safeIdx] || akRogue[0];

  const showRelicRatio = Boolean(
    currentTheme &&
      currentTheme.relicsTotalKnown !== false &&
      currentTheme.relicsTotal >= currentTheme.relicsUnlocked &&
      currentTheme.relicsTotal > 0
  );

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
                  onClick={() => setSelectedIdx(idx)}
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
              {/* Tactical Overview KPI Grid */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
                  <div className="text-[11px] font-mono-tech text-[#7D899B]">
                    MAX DIFFICULTY // 最高难度
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono-tech text-[#FF9A2E] tabular-nums">
                      N{currentTheme.maxDifficulty}
                    </span>
                    <span className="text-xs font-mono-tech text-[#7D899B]">
                      / N{currentTheme.difficultyCap}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#34D399] mt-1 truncate">
                    {currentTheme.bestModeLabel
                      ? `${currentTheme.bestModeLabel} · 探索 ${currentTheme.totalRuns} 次`
                      : currentTheme.totalRuns > 0
                      ? `通关 ${currentTheme.clearedRuns} / ${currentTheme.totalRuns} 次探索`
                      : `已收录近期 ${currentTheme.recentRuns.length} 场战绩`}
                  </div>
                </div>

                <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
                  <div className="text-[11px] font-mono-tech text-[#7D899B]">
                    REWARD LEVEL // 奖励等级
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono-tech text-[#22BBFF] tabular-nums">
                      Lv.{currentTheme.level}
                    </span>
                    <span className="text-xs font-mono-tech text-[#7D899B]">
                      / {currentTheme.maxLevel}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#0A0C0F] mt-2 overflow-hidden">
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

                <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
                  <div className="text-[11px] font-mono-tech text-[#7D899B]">
                    RELICS // 收藏品解锁
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono-tech text-[#ECF0F5] tabular-nums">
                      {currentTheme.relicsUnlocked}
                    </span>
                    {showRelicRatio && (
                      <span className="text-xs font-mono-tech text-[#7D899B]">
                        / {currentTheme.relicsTotal}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#F4C44E] mt-1 font-mono-tech">
                    {showRelicRatio
                      ? `完成率 ${Math.min(
                          100,
                          Math.round(
                            (currentTheme.relicsUnlocked /
                              Math.max(1, currentTheme.relicsTotal)) *
                              100
                          )
                        )}%`
                      : currentTheme.highestScore
                      ? `最高得分 ${currentTheme.highestScore}`
                      : '森空岛已解锁藏品数'}
                  </div>
                </div>

                <div className="bg-[#13171D] border border-[#293240] p-4 ak-chamfer-sm">
                  <div className="text-[11px] font-mono-tech text-[#7D899B]">
                    BANK // 源石锭投资
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Coins className="w-5 h-5 text-[#F4C44E]" />
                    <span className="text-2xl font-black font-mono-tech text-[#F4C44E] tabular-nums">
                      {currentTheme.investedOriginium}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#7D899B] mt-1">坎诺特投资系统存量</div>
                </div>
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
                              <span>×{ending.clearCount}</span>
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

              {/* Recent Runs */}
              {currentTheme.recentRuns.length > 0 && (
                <section className="space-y-2.5">
                  <div className="text-xs font-mono-tech text-[#7D899B]">
                    RECENT EXPEDITIONS // 近期探索实录
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {currentTheme.recentRuns.map((run) => (
                      <div
                        key={run.runId}
                        className="bg-[#13171D] border border-[#293240] p-3.5 space-y-2 ak-chamfer-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono-tech font-bold ${
                              run.cleared
                                ? 'bg-[#34D399]/20 text-[#34D399]'
                                : 'bg-[#F87171]/20 text-[#F87171]'
                            }`}
                          >
                            {run.cleared ? '通关' : '探索中断'}
                          </span>
                          <span className="font-mono-tech text-xs text-[#FF9A2E] font-bold">
                            N{run.difficulty}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-[#ECF0F5]">
                          {run.endingName}
                        </div>
                        <div className="text-xs text-[#7D899B]">{run.squadName}</div>
                        <div className="pt-2 border-t border-[#293240]/70 flex items-center justify-between text-[11px] font-mono-tech text-[#B4C0D0]">
                          <span>藏品 {run.relicsCount}</span>
                          <span>评分 {run.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
