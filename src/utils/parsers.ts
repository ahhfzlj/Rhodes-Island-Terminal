import type {
  AkGachaRecord,
  EndfieldGachaRecord,
  EndfieldPoolType,
  GarrisonCovenantStat,
  GarrisonMatch,
  GarrisonSeasonData,
  RogueThemeData,
} from '../types/index.js';

export function mapAkCategoryCode(
  cateId: string,
  cateName: string
): AkGachaRecord['category'] {
  const combined = `${cateId} ${cateName}`.toLowerCase();
  if (combined.includes('classic') || combined.includes('中坚')) return 'classic';
  if (
    combined.includes('limited') ||
    combined.includes('限定') ||
    combined.includes('庆典') ||
    combined.includes('fes')
  ) {
    return 'limited';
  }
  if (
    combined.includes('linkage') ||
    combined.includes('collab') ||
    combined.includes('联动')
  ) {
    return 'collab';
  }
  return 'normal';
}

export function parseImportedAkGachaJson(raw: unknown): AkGachaRecord[] {
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as any;
    if (Array.isArray(obj.list)) list = obj.list;
    else if (Array.isArray(obj.data?.list)) list = obj.data.list;
    else if (Array.isArray(obj.records)) list = obj.records;
  }

  if (list.length === 0) {
    throw new Error('JSON 中未识别到有效的明日方舟抽卡记录数组');
  }

  const normalized: AkGachaRecord[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (Array.isArray(item.chars)) {
      const rawTs = Number(item.ts || 0);
      const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
      item.chars.forEach((c: any, idx: number) => {
        const rarityVal = Number(c.rarity ?? 2);
        const rarity = (
          rarityVal <= 5 && item.pool !== undefined && rarityVal >= 2 && !item.rarity
            ? rarityVal + 1
            : rarityVal
        ) as AkGachaRecord['rarity'];
        const clamped = (
          rarity >= 6 ? 6 : rarity === 5 ? 5 : rarity === 4 ? 4 : 3
        ) as AkGachaRecord['rarity'];
        normalized.push({
          id: `${tsMs}_${idx}_${c.name || i}`,
          ts: tsMs,
          poolName: String(item.pool || item.poolName || '标准寻访'),
          category: mapAkCategoryCode('', String(item.pool || item.poolName || '')),
          charId: String(c.charId || ''),
          charName: String(c.name || '未知干员'),
          rarity: clamped,
          isNew: Boolean(c.isNew),
          pos: idx,
        });
      });
      continue;
    }

    const rawTs = Number(item.ts || item.gachaTs || Date.now());
    const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    const rarityNum = Number(item.rarity ?? 3);
    const rarity = (
      rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : rarityNum === 4 ? 4 : 3
    ) as AkGachaRecord['rarity'];
    const pos = Number(item.pos ?? i);
    const charName = String(item.charName || item.name || '未知干员');
    const charId = String(item.charId || '');

    normalized.push({
      id: String(item.id || `${tsMs}_${pos}_${charId || charName}`),
      ts: tsMs,
      poolName: String(item.poolName || item.pool || '常规寻访'),
      category: item.category
        ? String(item.category)
        : mapAkCategoryCode('', String(item.poolName || item.pool || '')),
      charId,
      charName,
      rarity,
      isNew: Boolean(item.isNew),
      pos,
    });
  }

  return normalized;
}

function normalizeEndfieldPoolType(rawType: string): EndfieldPoolType {
  const low = rawType.toLowerCase();
  if (low.includes('special') || low === 'special') return 'special';
  if (low.includes('beginner') || low === 'beginner') return 'beginner';
  if (low.includes('weapon') || low === 'weapon') return 'weapon';
  return 'standard';
}

export function parseImportedEndfieldGachaJson(raw: unknown): EndfieldGachaRecord[] {
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as any;
    if (Array.isArray(obj.list)) list = obj.list;
    else if (Array.isArray(obj.data?.list)) list = obj.data.list;
    else if (Array.isArray(obj.records)) list = obj.records;
  }

  if (list.length === 0) {
    throw new Error('JSON 中未识别到有效的终末地寻访记录数组');
  }

  return list.map((item, idx): EndfieldGachaRecord => {
    const rawTs = Number(item.ts || item.gachaTs || Date.now());
    const tsMs = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    const rarityNum = Number(item.rarity ?? 4);
    const rarity = (
      rarityNum >= 6 ? 6 : rarityNum === 5 ? 5 : 4
    ) as EndfieldGachaRecord['rarity'];
    const seqId = String(item.seqId || item.seq_id || idx);
    const poolType = normalizeEndfieldPoolType(
      String(item.poolType || item.pool_type || 'special')
    );
    const itemName = String(
      item.itemName || item.charName || item.weaponName || '未知目标'
    );

    return {
      id: String(item.id || `${poolType}_${seqId}_${tsMs}`),
      seqId,
      ts: tsMs,
      poolId: String(item.poolId || poolType),
      poolName: String(item.poolName || '终末地寻访'),
      poolType,
      itemId: String(item.itemId || item.charId || item.weaponId || ''),
      itemName,
      rarity,
      isFeatured: Boolean(item.isFeatured ?? item.isUp ?? false),
      isFree: Boolean(item.isFree ?? false),
    };
  });
}

export function normalizeGarrisonPayload(raw: any): GarrisonSeasonData {
  const data = raw?.data ?? raw;
  if (data && typeof data.seasonName === 'string' && Array.isArray(data.matches)) {
    return data as GarrisonSeasonData;
  }

  const stat = data?.stat || data?.summary || {};
  const list = Array.isArray(data?.records)
    ? data.records
    : Array.isArray(data?.history)
    ? data.history
    : Array.isArray(data?.matches)
    ? data.matches
    : [];

  const matches: GarrisonMatch[] = list.map((m: any, idx: number) => ({
    matchId: String(m.matchId || m.id || `garrison_${idx}`),
    ts:
      Number(m.ts || m.createTime || Date.now() / 1000) *
      (Number(m.ts || 0) < 1e12 ? 1000 : 1),
    difficulty: Number(m.difficulty ?? m.level ?? 1),
    difficultyLabel: String(m.difficultyLabel || `难度 ${m.difficulty ?? m.level ?? 1}`),
    cleared: Boolean(m.cleared ?? m.isWin ?? m.win),
    strategyName: String(m.strategyName || m.strategy?.name || '常规策略'),
    covenants: Array.isArray(m.covenants)
      ? m.covenants.map((c: any) => (typeof c === 'string' ? c : c.name || ''))
      : [],
    durationSec: Number(m.durationSec || m.duration || 0),
    score: Number(m.score || 0),
    normalBossKills: Array.isArray(m.normalBossKills) ? m.normalBossKills : [],
    hiddenBossKills: Array.isArray(m.hiddenBossKills) ? m.hiddenBossKills : [],
    squad: Array.isArray(m.squad)
      ? m.squad.map((op: any) => ({
          charId: String(op.charId || ''),
          name: String(op.name || '干员'),
          profession: String(op.profession || ''),
          rarity: Number(op.rarity || 6),
          elite: Number(op.elite || 2),
          equipments: Array.isArray(op.equipments) ? op.equipments : [],
        }))
      : [],
    finalWave: Number(m.finalWave || 0),
    maxWave: Number(m.maxWave || 10),
  }));

  const totalMatches = Number(stat.totalMatches ?? stat.total ?? matches.length);
  const clearCount = Number(
    stat.clearCount ?? stat.winCount ?? matches.filter((m) => m.cleared).length
  );

  return {
    seasonId: String(data?.seasonId || 'season_current'),
    seasonName: String(data?.seasonName || '卫戍协议 // 当前赛季'),
    totalMatches,
    clearCount,
    winRate:
      totalMatches > 0 ? Number(((clearCount / totalMatches) * 100).toFixed(1)) : 0,
    highestDiff: Number(stat.highestDiff ?? 0),
    highestDiffLabel: String(stat.highestDiffLabel || `难度 ${stat.highestDiff ?? 0}`),
    trophies: Number(stat.trophies ?? stat.trophyCount ?? 0),
    normalBossKills: Number(stat.normalBossKills ?? 0),
    hiddenBossKills: Number(stat.hiddenBossKills ?? 0),
    favoriteStrategy: String(stat.favoriteStrategy || '均衡防御策略'),
    covenantStats: Array.isArray(data?.covenantStats) ? data.covenantStats : [],
    matches,
  };
}

const GARRISON_DIFF_MAP: Record<string, { num: number; label: string }> = {
  ABYSS: { num: 15, label: '险境 / 深渊' },
  HARD: { num: 12, label: '困难协议' },
  NORMAL: { num: 8, label: '标准协议' },
  FAST: { num: 6, label: '极速模式' },
  FUNNY: { num: 4, label: '趣味模式' },
  TRAINING: { num: 1, label: '演习训练' },
};

const GARRISON_BOSS_NAMES: Record<string, string> = {
  enemy_1521_dslily: '盐风主教昆图斯',
  enemy_1559_vtlionk: '阿利斯泰尔，帝国余晖',
  enemy_2054_smdeer: '「萨米的意志」',
  enemy_2124_dyjsfg: '矩兽',
  enemy_9013_acstmk: '假想敌：胄',
  enemy_9013_acstmk_2: '假想敌：胄',
  enemy_9017_achunt: '假想敌：铳',
  enemy_9017_achunt_2: '假想敌：铳',
  enemy_9021_acduml: '假想敌：管',
  enemy_9021_acduml_2: '假想敌：管',
  enemy_9029_acfnc: '假想敌：械',
  enemy_9035_acspider: '假想敌：茧',
  enemy_9037_aceel: '假想敌：鳍',
};

function mapDifficultyInfo(modeDifficulty?: string, mode?: string): { num: number; label: string } {
  const key = String(modeDifficulty || mode || 'NORMAL').toUpperCase();
  if (GARRISON_DIFF_MAP[key]) return GARRISON_DIFF_MAP[key];
  const digits = key.match(/\d+/);
  if (digits) {
    const n = Number(digits[0]);
    return { num: n, label: `协议 N${n}` };
  }
  return { num: 8, label: key || '标准协议' };
}

export function normalizeSklandGarrisonResponse(
  infoData: any,
  resourceData?: any
): GarrisonSeasonData {
  const resourcesList: any[] = Array.isArray(resourceData?.resources)
    ? resourceData.resources
    : [];
  const currentRes = resourcesList[0] || {};
  const findRes = (versionId?: string, activityId?: string) => {
    if (!versionId && !activityId) return currentRes;
    return (
      resourcesList.find(
        (r) =>
          (!versionId || r?.versionInfo?.versionId === versionId) &&
          (!activityId || r?.versionInfo?.activityId === activityId)
      ) || currentRes
    );
  };

  const career = infoData?.career || {};
  const rawRecords: any[] = [
    ...(Array.isArray(infoData?.history?.records) ? infoData.history.records : []),
    ...(Array.isArray(infoData?.history?.favourRecords)
      ? infoData.history.favourRecords
      : []),
  ];

  // Deduplicate by match id
  const dedupMap = new Map<string, any>();
  for (const r of rawRecords) {
    const id = String(r?.id || '');
    if (id && !dedupMap.has(id)) dedupMap.set(id, r);
  }
  const uniqueRecords = Array.from(dedupMap.values());

  let totalNormalBossKills = 0;
  let totalHiddenBossKills = 0;
  let highestDiff = mapDifficultyInfo(career.modeDifficulty, career.mode);

  const covenantCounter = new Map<string, { total: number; cleared: number }>();

  const matches: GarrisonMatch[] = uniqueRecords.map((rec: any, idx: number) => {
    const res = findRes(rec.versionId, rec.activityId);
    const diff = mapDifficultyInfo(rec.modeDifficulty, rec.mode);
    if (diff.num > highestDiff.num) highestDiff = diff;

    const cleared = Number(rec.completeState) === 1;
    const bandName =
      res?.bandInfo?.[rec.bandId]?.name ||
      currentRes?.bandInfo?.[rec.bandId]?.name ||
      rec.bandId ||
      '常规策略';

    const covenants: string[] = [];
    for (const b of Array.isArray(rec.bondInfo) ? rec.bondInfo : []) {
      const active = Number(b.activate ?? b.layer ?? 0);
      if (active <= 0 && (rec.bondInfo?.length || 0) > 4) continue;
      const bondName =
        res?.bondInfo?.[b.bondId]?.name ||
        currentRes?.bondInfo?.[b.bondId]?.name ||
        b.bondId;
      if (bondName && !covenants.includes(bondName)) {
        covenants.push(bondName);
        const cur = covenantCounter.get(bondName) || { total: 0, cleared: 0 };
        cur.total += 1;
        if (cleared) cur.cleared += 1;
        covenantCounter.set(bondName, cur);
      }
    }

    const normalBossKills: string[] = [];
    const hiddenBossKills: string[] = [];
    for (const boss of Array.isArray(rec.acBossInfo) ? rec.acBossInfo : []) {
      if (!boss?.isKilled) continue;
      const bossMeta =
        res?.bossInfo?.[boss.bossId] || currentRes?.bossInfo?.[boss.bossId];
      const enemyId = String(
        bossMeta?.handbookEnemyId || bossMeta?.enemyId || boss.bossId || ''
      );
      const bossName = GARRISON_BOSS_NAMES[enemyId] || enemyId || '区域首领';
      if (boss.isHidden) {
        hiddenBossKills.push(bossName);
        totalHiddenBossKills += 1;
      } else {
        normalBossKills.push(bossName);
        totalNormalBossKills += 1;
      }
    }

    const squad = (Array.isArray(rec.chessSquad) ? rec.chessSquad : []).map((ch: any) => {
      const chessMeta =
        ch.chessInfo ||
        res?.chessInfo?.[ch.chessId] ||
        currentRes?.chessInfo?.[ch.chessId] ||
        {};
      const equipments = (Array.isArray(ch.equips) ? ch.equips : []).map((eq: any) => {
        const eqId = String(eq.equipId || eq.id || '');
        return (
          res?.equipInfo?.[eqId]?.name ||
          currentRes?.equipInfo?.[eqId]?.name ||
          eqId
        );
      });
      return {
        charId: String(ch.charId || chessMeta.charId || ''),
        name: String(chessMeta.charName || ch.charId || ch.chessId || '干员'),
        profession: String(chessMeta.charProfession || ''),
        rarity: Number(chessMeta.chessLevel ? Math.min(6, chessMeta.chessLevel + 2) : 6),
        elite: Number(chessMeta.evolvePhase ?? 2),
        equipments: equipments.filter(Boolean),
      };
    });

    const rawEnd = Number(rec.gameEndTs || rec.gameStartTs || 0);
    const tsMs = rawEnd > 0 ? (rawEnd < 1e12 ? rawEnd * 1000 : rawEnd) : Date.now();
    const durationSec =
      rec.gameEndTs && rec.gameStartTs
        ? Math.max(0, Number(rec.gameEndTs) - Number(rec.gameStartTs))
        : 0;

    return {
      matchId: String(rec.id || `garrison_${idx}`),
      ts: tsMs,
      difficulty: diff.num,
      difficultyLabel: diff.label,
      cleared,
      strategyName: String(bandName),
      covenants,
      durationSec,
      score: Number(rec.trophyAfter ?? rec.killCnt ?? 0),
      normalBossKills,
      hiddenBossKills,
      squad,
      finalWave: Number(rec.passRound ?? 0),
      maxWave: Math.max(10, Number(rec.passRound ?? 10)),
    };
  });

  matches.sort((a, b) => b.ts - a.ts);

  const singleCnt = Number(career.totalSingleBattleCnt ?? 0);
  const multiCnt = Number(career.totalMultiBattleCnt ?? 0);
  const singleWin = Number(career.totalSingleBattleWinCnt ?? 0);
  const multiWin = Number(career.totalMultiBattleWinCnt ?? 0);

  const totalMatches = singleCnt + multiCnt > 0 ? singleCnt + multiCnt : matches.length;
  const clearCount =
    singleWin + multiWin > 0 || singleCnt + multiCnt > 0
      ? singleWin + multiWin
      : matches.filter((m) => m.cleared).length;

  const favoriteStrategy =
    currentRes?.bandInfo?.[career.top1BandUseId]?.name ||
    career.top1BandUseId ||
    matches[0]?.strategyName ||
    '均衡防御策略';

  const covenantStats: GarrisonCovenantStat[] = Array.from(covenantCounter.entries())
    .map(([name, val]) => ({
      name,
      totalMatches: val.total,
      clearCount: val.cleared,
      winRate: val.total > 0 ? Number(((val.cleared / val.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalMatches - a.totalMatches)
    .slice(0, 8);

  const ver = currentRes?.versionInfo || {};
  return {
    seasonId: String(ver.activityId || ver.versionId || 'garrison_current'),
    seasonName: String(ver.seasonName || '卫戍协议 // 当前赛季'),
    totalMatches,
    clearCount,
    winRate:
      totalMatches > 0 ? Number(((clearCount / totalMatches) * 100).toFixed(1)) : 0,
    highestDiff: highestDiff.num,
    highestDiffLabel: highestDiff.label,
    trophies: Number(career.totalTrophyCnt ?? 0),
    normalBossKills: totalNormalBossKills,
    hiddenBossKills: totalHiddenBossKills,
    favoriteStrategy: String(favoriteStrategy),
    covenantStats,
    matches,
  };
}

export function parseSklandRogue(rogueRaw: any): RogueThemeData[] {
  if (!rogueRaw) return [];
  let records: any[] = [];
  if (Array.isArray(rogueRaw.records)) {
    records = rogueRaw.records;
  } else if (rogueRaw.themes && typeof rogueRaw.themes === 'object') {
    records = Object.entries(rogueRaw.themes).map(([id, val]: [string, any]) => ({
      topicId: id,
      ...(val || {}),
    }));
  }

  const rogueInfoMap = rogueRaw.rogueInfoMap || {};
  const globalBank = rogueRaw.bank || {};

  return records.map((rec: any, idx: number): RogueThemeData => {
    const topicId = String(rec.topicId || rec.theme || rec.id || `rogue_${idx}`);
    const meta = rogueInfoMap[topicId] || {};
    const bank = rec.bank || globalBank || {};
    const medal = rec.medal || {};
    const endingsRaw = Array.isArray(rec.endings) ? rec.endings : [];

    return {
      themeId: topicId,
      themeName: meta.name || rec.name || `集成战略 #${idx + 1}`,
      codeName: meta.codeName || topicId.toUpperCase(),
      maxDifficulty: Number(rec.maxDifficulty ?? rec.clearDifficulty ?? rec.maxLevel ?? 0),
      difficultyCap: Number(meta.maxDifficulty ?? 15),
      totalRuns: Number(rec.totalRuns ?? rec.count ?? 0),
      clearedRuns: Number(rec.clearedRuns ?? rec.clearCount ?? 0),
      endings: endingsRaw.map((e: any, eIdx: number) => ({
        id: String(e.id || `end_${eIdx}`),
        name: String(e.name || `结局 ${eIdx + 1}`),
        code: String(e.code || `END-${eIdx + 1}`),
        unlocked: Boolean(e.unlocked ?? Number(e.clearCount || 0) > 0),
        clearCount: Number(e.clearCount || 0),
      })),
      relicsUnlocked: Number(rec.relics?.current ?? rec.relicCount ?? rec.relicCnt ?? 0),
      relicsTotal: Number(rec.relics?.total ?? meta.relicTotal ?? 200),
      level: Number(rec.level ?? rec.buffLevel ?? medal.level ?? 0),
      maxLevel: Number(rec.maxLevel ?? meta.maxLevel ?? 100),
      investedOriginium: Number(bank.record ?? bank.current ?? bank.invest ?? 0),
      squads: Array.isArray(rec.squads)
        ? rec.squads.map((s: any) => ({
            squadName: String(s.name || s.squadName || '未知分队'),
            maxDifficulty: Number(s.maxDifficulty || 0),
            cleared: Boolean(s.cleared),
          }))
        : [],
      recentRuns: [],
    };
  });
}
