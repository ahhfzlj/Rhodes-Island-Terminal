import type {
  AkBannerFiveStar,
  AkBannerGroup,
  AkBannerSixStar,
  AkCategorySummary,
  AkGachaAchievement,
  AkGachaAnalysis,
  AkGachaCategoryGroup,
  AkGachaRecord,
  AkGachaStats,
  AkSixStarTimelineItem,
  EndfieldBigPityInfo,
  EndfieldGachaRecord,
  EndfieldGachaStats,
  EndfieldPoolType,
  EndfieldSixStarTimelineItem,
} from '../types/index.js';

/**
 * Sort Arknights records chronologically (oldest first) for accurate pity counting.
 * On identical timestamps, lower `pos` means earlier or vice versa:
 * Hypergryph `pos` within a 10-pull/batch starts at 0..N; sorting by ts asc, then pos asc gives chronological order.
 */
function sortAkChronological(records: AkGachaRecord[]): AkGachaRecord[] {
  return [...records].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.pos - b.pos;
  });
}

/**
 * Sort Endfield records chronologically (oldest first) using ts and numeric seqId fallback.
 */
function sortEndfieldChronological(records: EndfieldGachaRecord[]): EndfieldGachaRecord[] {
  return [...records].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    const seqA = Number(a.seqId);
    const seqB = Number(b.seqId);
    if (!Number.isNaN(seqA) && !Number.isNaN(seqB) && seqA !== seqB) {
      return seqA - seqB;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Compute Arknights gacha statistics including 50-pull soft pity (+2%/pull after 50),
 * 6-star intervals, star distribution, and luck grade.
 */
export function computeArknightsGachaStats(
  records: AkGachaRecord[],
  categoryFilter: string = 'all'
): AkGachaStats {
  const filtered =
    categoryFilter === 'all'
      ? records
      : records.filter((r) => r.category === categoryFilter);

  const totalPulls = filtered.length;
  if (totalPulls === 0) {
    return {
      totalPulls: 0,
      sixCount: 0,
      fiveCount: 0,
      fourCount: 0,
      threeCount: 0,
      sixRate: 0,
      fiveRate: 0,
      fourRate: 0,
      threeRate: 0,
      avgPullsPerSix: 0,
      currentPity: 0,
      softPityBonus: 0,
      currentSixChance: 2,
      luckRating: 'B',
      sixStarTimeline: [],
    };
  }

  let sixCount = 0;
  let fiveCount = 0;
  let fourCount = 0;
  let threeCount = 0;

  // Note: In Arknights, normal/limited/classic categories actually have independent pity,
  // except standard & event pools share normal pity. Here we compute pity sequentially on the filtered set
  // (or on normal+limited when viewing 'all' for general telemetry).
  const chronological = sortAkChronological(filtered);
  let pityCounter = 0;
  const timelineAsc: AkSixStarTimelineItem[] = [];

  for (const r of chronological) {
    pityCounter += 1;
    if (r.rarity === 6) {
      sixCount += 1;
      timelineAsc.push({
        id: r.id,
        ts: r.ts,
        poolName: r.poolName,
        category: r.category,
        charName: r.charName,
        pulls: pityCounter,
        isNew: r.isNew,
      });
      pityCounter = 0;
    } else if (r.rarity === 5) {
      fiveCount += 1;
    } else if (r.rarity === 4) {
      fourCount += 1;
    } else {
      threeCount += 1;
    }
  }

  const currentPity = pityCounter;
  const softPityBonus = currentPity > 50 ? Math.min(98, (currentPity - 50) * 2) : 0;
  const currentSixChance = Math.min(100, 2 + softPityBonus);

  const avgPullsPerSix =
    sixCount > 0 ? Number(((totalPulls - currentPity) / sixCount).toFixed(1)) : 0;

  let luckRating: AkGachaStats['luckRating'] = 'B';
  if (sixCount === 0) {
    luckRating = currentPity > 60 ? 'C' : 'B';
  } else if (avgPullsPerSix <= 24) {
    luckRating = 'EX';
  } else if (avgPullsPerSix <= 32) {
    luckRating = 'S';
  } else if (avgPullsPerSix <= 40) {
    luckRating = 'A';
  } else if (avgPullsPerSix <= 50) {
    luckRating = 'B';
  } else {
    luckRating = 'C';
  }

  return {
    totalPulls,
    sixCount,
    fiveCount,
    fourCount,
    threeCount,
    sixRate: Number(((sixCount / totalPulls) * 100).toFixed(2)),
    fiveRate: Number(((fiveCount / totalPulls) * 100).toFixed(2)),
    fourRate: Number(((fourCount / totalPulls) * 100).toFixed(2)),
    threeRate: Number(((threeCount / totalPulls) * 100).toFixed(2)),
    avgPullsPerSix,
    currentPity,
    softPityBonus,
    currentSixChance,
    luckRating,
    sixStarTimeline: timelineAsc.reverse(),
  };
}

export function normalizeAkCategoryGroup(category: string): AkGachaCategoryGroup {
  const low = String(category || '').toLowerCase();
  if (
    low === 'limited' ||
    low === 'collab' ||
    low.includes('限定') ||
    low.includes('庆典') ||
    low.includes('联动')
  ) {
    return 'limited';
  }
  if (low === 'classic' || low.includes('中坚')) {
    return 'classic';
  }
  return 'normal';
}

function calcAkSoftPity(currentPity: number): {
  currentPity: number;
  softPityBonus: number;
  currentSixChance: number;
} {
  const softPityBonus = currentPity > 50 ? Math.min(98, (currentPity - 50) * 2) : 0;
  const currentSixChance = Math.min(100, 2 + softPityBonus);
  return { currentPity, softPityBonus, currentSixChance };
}

interface BannerSessionBuilder {
  bannerKey: string;
  poolName: string;
  categoryGroup: AkGachaCategoryGroup;
  rawCategory: string;
  startTs: number;
  endTs: number;
  totalPulls: number;
  sixStars: AkBannerSixStar[];
  fiveStars: AkBannerFiveStar[];
  fiveCount: number;
  fourCount: number;
  threeCount: number;
  limitedPity: number;
  trailingPity: number;
  records: AkGachaRecord[];
}

export function computeArknightsGachaAnalysis(records: AkGachaRecord[]): AkGachaAnalysis {
  const makeEmptyCategory = (
    group: AkGachaCategoryGroup,
    label: string
  ): AkCategorySummary => ({
    group,
    label,
    totalPulls: 0,
    sixCount: 0,
    fiveCount: 0,
    avgPullsPerSix: 0,
    ...calcAkSoftPity(0),
  });

  if (records.length === 0) {
    return {
      totalPulls: 0,
      totalOrundum: 0,
      sixCount: 0,
      fiveCount: 0,
      fourCount: 0,
      threeCount: 0,
      sixRate: 0,
      avgPullsPerSix: 0,
      luckRating: 'B',
      title: '蓄势待发',
      dateRange: null,
      categories: {
        limited: makeEmptyCategory('limited', '限定'),
        normal: makeEmptyCategory('normal', '标准'),
        classic: makeEmptyCategory('classic', '中坚'),
      },
      achievements: [],
      banners: [],
    };
  }

  const chronological = sortAkChronological(records);
  const SESSION_GAP_MS = 30 * 86_400_000;

  let normalPity = 0;
  let classicPity = 0;

  const groupCounters: Record<
    AkGachaCategoryGroup,
    { totalPulls: number; sixCount: number; fiveCount: number; sixPitySum: number }
  > = {
    limited: { totalPulls: 0, sixCount: 0, fiveCount: 0, sixPitySum: 0 },
    normal: { totalPulls: 0, sixCount: 0, fiveCount: 0, sixPitySum: 0 },
    classic: { totalPulls: 0, sixCount: 0, fiveCount: 0, sixPitySum: 0 },
  };

  let fourCount = 0;
  let threeCount = 0;

  const latestSessionByPool = new Map<string, BannerSessionBuilder>();
  const allSessions: BannerSessionBuilder[] = [];
  let sessionSeq = 1;

  for (const r of chronological) {
    const group = normalizeAkCategoryGroup(r.category);
    const poolName = String(r.poolName || '标准寻访').trim() || '标准寻访';
    const baseKey = `${group}::${poolName}`;

    let session = latestSessionByPool.get(baseKey);
    if (!session || r.ts - session.endTs > SESSION_GAP_MS) {
      session = {
        bannerKey: `${baseKey}#${sessionSeq++}`,
        poolName,
        categoryGroup: group,
        rawCategory: r.category,
        startTs: r.ts,
        endTs: r.ts,
        totalPulls: 0,
        sixStars: [],
        fiveStars: [],
        fiveCount: 0,
        fourCount: 0,
        threeCount: 0,
        limitedPity: 0,
        trailingPity: 0,
        records: [],
      };
      latestSessionByPool.set(baseKey, session);
      allSessions.push(session);
    }

    session.startTs = Math.min(session.startTs, r.ts);
    session.endTs = Math.max(session.endTs, r.ts);
    session.totalPulls += 1;
    session.records.push(r);

    groupCounters[group].totalPulls += 1;

    let pityForPull: number;
    if (group === 'normal') {
      normalPity += 1;
      pityForPull = normalPity;
    } else if (group === 'classic') {
      classicPity += 1;
      pityForPull = classicPity;
    } else {
      session.limitedPity += 1;
      pityForPull = session.limitedPity;
    }
    session.trailingPity += 1;

    if (r.rarity === 6) {
      const luckTag: AkBannerSixStar['luckTag'] =
        pityForPull <= 20
          ? '超欧'
          : pityForPull <= 35
          ? '欧'
          : pityForPull >= 60
          ? '非'
          : undefined;

      session.sixStars.push({
        id: r.id,
        ts: r.ts,
        charName: r.charName,
        charId: r.charId,
        pulls: pityForPull,
        isNew: r.isNew,
        ...(luckTag ? { luckTag } : {}),
      });

      groupCounters[group].sixCount += 1;
      groupCounters[group].sixPitySum += pityForPull;

      if (group === 'normal') {
        normalPity = 0;
      } else if (group === 'classic') {
        classicPity = 0;
      } else {
        session.limitedPity = 0;
      }
      session.trailingPity = 0;
    } else if (r.rarity === 5) {
      session.fiveStars.push({
        id: r.id,
        ts: r.ts,
        charName: r.charName,
        charId: r.charId,
        isNew: r.isNew,
      });
      session.fiveCount += 1;
      groupCounters[group].fiveCount += 1;
    } else if (r.rarity === 4) {
      session.fourCount += 1;
      fourCount += 1;
    } else {
      session.threeCount += 1;
      threeCount += 1;
    }
  }

  const banners: AkBannerGroup[] = allSessions
    .map((s) => ({
      bannerKey: s.bannerKey,
      poolName: s.poolName,
      categoryGroup: s.categoryGroup,
      rawCategory: s.rawCategory,
      startTs: s.startTs,
      endTs: s.endTs,
      totalPulls: s.totalPulls,
      sixStars: s.sixStars,
      fiveStars: s.fiveStars,
      fiveCount: s.fiveCount,
      fourCount: s.fourCount,
      threeCount: s.threeCount,
      trailingPity: s.trailingPity,
      records: [...s.records].sort((a, b) =>
        b.ts !== a.ts ? b.ts - a.ts : b.pos - a.pos
      ),
    }))
    .sort((a, b) =>
      b.endTs !== a.endTs ? b.endTs - a.endTs : b.startTs - a.startTs
    );

  const latestLimited = banners.find((b) => b.categoryGroup === 'limited');
  const buildCategorySummary = (
    group: AkGachaCategoryGroup,
    label: string,
    currentPity: number
  ): AkCategorySummary => {
    const gc = groupCounters[group];
    const avg = gc.sixCount > 0 ? Number((gc.sixPitySum / gc.sixCount).toFixed(1)) : 0;
    return {
      group,
      label,
      totalPulls: gc.totalPulls,
      sixCount: gc.sixCount,
      fiveCount: gc.fiveCount,
      avgPullsPerSix: avg,
      ...calcAkSoftPity(currentPity),
    };
  };

  const categories = {
    limited: buildCategorySummary(
      'limited',
      '限定',
      latestLimited ? latestLimited.trailingPity : 0
    ),
    normal: buildCategorySummary('normal', '标准', normalPity),
    classic: buildCategorySummary('classic', '中坚', classicPity),
  };

  const totalPulls = records.length;
  const totalOrundum = totalPulls * 600;
  const sixCount =
    groupCounters.limited.sixCount +
    groupCounters.normal.sixCount +
    groupCounters.classic.sixCount;
  const fiveCount =
    groupCounters.limited.fiveCount +
    groupCounters.normal.fiveCount +
    groupCounters.classic.fiveCount;
  const totalSixPitySum =
    groupCounters.limited.sixPitySum +
    groupCounters.normal.sixPitySum +
    groupCounters.classic.sixPitySum;

  const avgPullsPerSix =
    sixCount > 0 ? Number((totalSixPitySum / sixCount).toFixed(1)) : 0;
  const sixRate = Number(((sixCount / totalPulls) * 100).toFixed(2));

  let luckRating: AkGachaAnalysis['luckRating'] = 'B';
  let title = '蓄势待发';
  if (sixCount > 0) {
    if (avgPullsPerSix <= 22) {
      luckRating = 'EX';
      title = '双层至尊欧皇';
    } else if (avgPullsPerSix <= 30) {
      luckRating = 'S';
      title = '天选欧皇';
    } else if (avgPullsPerSix <= 36) {
      luckRating = 'A';
      title = '欧气盈门';
    } else if (avgPullsPerSix <= 45) {
      luckRating = 'B';
      title = '稳扎稳打';
    } else {
      luckRating = 'C';
      title = '非酋护体';
    }
  }

  // Dynamic achievements
  const achievements: AkGachaAchievement[] = [];
  const allSixStars = banners.flatMap((b) => b.sixStars);

  const sixBatchCountByTs = new Map<number, number>();
  for (const s of allSixStars) {
    sixBatchCountByTs.set(s.ts, (sixBatchCountByTs.get(s.ts) || 0) + 1);
  }
  let multiBatchCount = 0;
  let maxInBatch = 0;
  for (const cnt of sixBatchCountByTs.values()) {
    if (cnt >= 2) {
      multiBatchCount += 1;
      maxInBatch = Math.max(maxInBatch, cnt);
    }
  }
  if (multiBatchCount > 0) {
    if (maxInBatch >= 3) {
      achievements.push({
        label: multiBatchCount > 1 ? `十连多金 ×${multiBatchCount}` : '十连多金',
        tone: 'emerald',
      });
    } else {
      achievements.push({
        label: multiBatchCount > 1 ? `十连两金 ×${multiBatchCount}` : '十连两金',
        tone: 'emerald',
      });
    }
  }

  const onePullCount = allSixStars.filter((s) => s.pulls === 1).length;
  if (onePullCount > 0) {
    achievements.push({
      label: onePullCount > 1 ? `一发入魂 ×${onePullCount}` : '一发入魂',
      tone: 'cyan',
    });
  }

  const ultraLuckyCount = allSixStars.filter((s) => s.pulls <= 15).length;
  if (ultraLuckyCount > 0) {
    achievements.push({
      label: `超欧时刻 ×${ultraLuckyCount}`,
      tone: 'emerald',
    });
  }

  const wellsCount = banners
    .filter((b) => b.categoryGroup === 'limited' && b.totalPulls >= 300)
    .reduce((sum, b) => sum + Math.floor(b.totalPulls / 300), 0);
  if (wellsCount > 0) {
    achievements.push({
      label: `抽满${wellsCount}井`,
      tone: 'rose',
    });
  }

  const hardPityCount = allSixStars.filter((s) => s.pulls >= 65).length;
  if (hardPityCount > 0) {
    achievements.push({
      label: `极限保底 ×${hardPityCount}`,
      tone: 'amber',
    });
  }

  if (achievements.length === 0) {
    achievements.push({
      label: `六星综合出率 ${sixRate}%`,
      tone: 'cyan',
    });
  }

  return {
    totalPulls,
    totalOrundum,
    sixCount,
    fiveCount,
    fourCount,
    threeCount,
    sixRate,
    avgPullsPerSix,
    luckRating,
    title,
    dateRange: {
      startTs: chronological[0].ts,
      endTs: chronological[chronological.length - 1].ts,
    },
    categories,
    achievements,
    banners,
  };
}

/**
 * Compute Endfield gacha statistics:
 * - 80-pull inherited small pity across the same poolType (or 40-pull 6★ pity / 80-pull UP guarantee for weapon pool)
 * - 120-pull NON-INHERITED featured UP guarantee tracked per individual `special` banner `poolId`
 */
export function computeEndfieldGachaStats(
  records: EndfieldGachaRecord[],
  poolType: 'all' | EndfieldPoolType = 'special',
  selectedBannerId?: string
): EndfieldGachaStats {
  const filtered =
    poolType === 'all'
      ? records
      : records.filter((r) => r.poolType === poolType);

  const isWeapon = poolType === 'weapon';
  const smallMax = isWeapon ? 40 : 80;
  const softStart = isWeapon ? 30 : 65;

  const totalPulls = filtered.length;
  if (totalPulls === 0) {
    return {
      totalPulls: 0,
      sixCount: 0,
      fiveCount: 0,
      fourCount: 0,
      sixRate: 0,
      fiveRate: 0,
      fourRate: 0,
      avgPullsPerSix: 0,
      smallPity80: {
        current: 0,
        max: smallMax,
        softPityStart: softStart,
        inSoftPity: false,
        inherited: poolType !== 'beginner',
      },
      bigPity120: null,
      bannerBigPities: [],
      featuredWinRate: null,
      sixStarTimeline: [],
    };
  }

  // Group by poolType if viewing 'all' to avoid mixing pity counters across incompatible pool types
  const smallTargetRecords =
    poolType === 'all'
      ? sortEndfieldChronological(records.filter((r) => r.poolType === 'special'))
      : sortEndfieldChronological(filtered);

  let smallCounter = 0;
  for (const r of smallTargetRecords) {
    smallCounter += 1;
    if (r.rarity === 6) {
      smallCounter = 0;
    }
  }

  // Timeline and star counts over the filtered scope
  const chronological = sortEndfieldChronological(filtered);
  let sixCount = 0;
  let fiveCount = 0;
  let fourCount = 0;
  let specialSixTotal = 0;
  let specialSixFeatured = 0;

  // Per-poolType small pity counter for accurate timeline intervals when viewing 'all'
  const poolTypeCounter: Record<string, number> = {};
  const timelineAsc: EndfieldSixStarTimelineItem[] = [];

  for (const r of chronological) {
    poolTypeCounter[r.poolType] = (poolTypeCounter[r.poolType] || 0) + 1;
    if (r.rarity === 6) {
      sixCount += 1;
      if (r.poolType === 'special') {
        specialSixTotal += 1;
        if (r.isFeatured) specialSixFeatured += 1;
      }
      timelineAsc.push({
        id: r.id,
        ts: r.ts,
        poolId: r.poolId,
        poolName: r.poolName,
        poolType: r.poolType,
        itemName: r.itemName,
        pulls: poolTypeCounter[r.poolType],
        isFeatured: r.isFeatured,
        isFree: r.isFree,
      });
      poolTypeCounter[r.poolType] = 0;
    } else if (r.rarity === 5) {
      fiveCount += 1;
    } else {
      fourCount += 1;
    }
  }

  // Compute independent non-inherited 120-pull guarantee per 'special' banner (and 80 for weapon banners if applicable)
  const specialRecords = sortEndfieldChronological(
    records.filter((r) => r.poolType === 'special')
  );
  const bannerMap = new Map<
    string,
    {
      poolId: string;
      poolName: string;
      pullsSinceStart: number;
      hasWonFeatured: boolean;
      lastTs: number;
    }
  >();

  for (const r of specialRecords) {
    let state = bannerMap.get(r.poolId);
    if (!state) {
      state = {
        poolId: r.poolId,
        poolName: r.poolName,
        pullsSinceStart: 0,
        hasWonFeatured: false,
        lastTs: r.ts,
      };
      bannerMap.set(r.poolId, state);
    }
    state.lastTs = Math.max(state.lastTs, r.ts);
    if (!state.hasWonFeatured) {
      state.pullsSinceStart += 1;
      if (r.rarity === 6 && r.isFeatured) {
        state.hasWonFeatured = true;
      }
    }
  }

  const bannerBigPities: EndfieldBigPityInfo[] = Array.from(bannerMap.values())
    .sort((a, b) => b.lastTs - a.lastTs)
    .map((b) => ({
      poolId: b.poolId,
      poolName: b.poolName,
      pullsInBanner: b.pullsSinceStart,
      guaranteedAt: 120,
      hasWonFeatured: b.hasWonFeatured,
      remaining: b.hasWonFeatured ? 0 : Math.max(0, 120 - b.pullsSinceStart),
      nonInherited: true,
    }));

  const bigPity120 =
    selectedBannerId
      ? bannerBigPities.find((b) => b.poolId === selectedBannerId) ||
        bannerBigPities[0] ||
        null
      : bannerBigPities[0] || null;

  const completedSixPulls = timelineAsc.reduce((acc, item) => acc + item.pulls, 0);
  const avgPullsPerSix =
    sixCount > 0 ? Number((completedSixPulls / sixCount).toFixed(1)) : 0;

  return {
    totalPulls,
    sixCount,
    fiveCount,
    fourCount,
    sixRate: Number(((sixCount / totalPulls) * 100).toFixed(2)),
    fiveRate: Number(((fiveCount / totalPulls) * 100).toFixed(2)),
    fourRate: Number(((fourCount / totalPulls) * 100).toFixed(2)),
    avgPullsPerSix,
    smallPity80: {
      current: smallCounter,
      max: smallMax,
      softPityStart: softStart,
      inSoftPity: smallCounter >= softStart,
      inherited: poolType !== 'beginner',
    },
    bigPity120:
      poolType === 'standard' || poolType === 'beginner' || poolType === 'weapon'
        ? null
        : bigPity120,
    bannerBigPities,
    featuredWinRate:
      specialSixTotal > 0
        ? Number(((specialSixFeatured / specialSixTotal) * 100).toFixed(1))
        : null,
    sixStarTimeline: timelineAsc.reverse(),
  };
}

/**
 * Deduplicate and merge Arknights gacha records (newest first).
 */
export function mergeAkGachaRecords(
  existing: AkGachaRecord[],
  incoming: AkGachaRecord[]
): AkGachaRecord[] {
  const map = new Map<string, AkGachaRecord>();
  for (const rec of existing) {
    map.set(rec.id, rec);
  }
  for (const rec of incoming) {
    map.set(rec.id, rec);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    return b.pos - a.pos;
  });
}

/**
 * Deduplicate and merge Endfield gacha records (newest first).
 */
export function mergeEndfieldGachaRecords(
  existing: EndfieldGachaRecord[],
  incoming: EndfieldGachaRecord[]
): EndfieldGachaRecord[] {
  const map = new Map<string, EndfieldGachaRecord>();
  for (const rec of existing) {
    map.set(rec.id, rec);
  }
  for (const rec of incoming) {
    map.set(rec.id, rec);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    const seqA = Number(a.seqId);
    const seqB = Number(b.seqId);
    if (!Number.isNaN(seqA) && !Number.isNaN(seqB) && seqB !== seqA) {
      return seqB - seqA;
    }
    return b.id.localeCompare(a.id);
  });
}

/**
 * Parse an Endfield webview gacha URL (e.g., https://ef-webview.hypergryph.com/...)
 * or a raw token string into structured parameters.
 */
export function parseEndfieldGachaUrl(input: string): {
  token: string;
  serverId: string;
  lang: string;
  host: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('请输入终末地抽卡记录链接或 Token');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('链接格式无效，请检查是否完整复制');
    }
    const token =
      parsed.searchParams.get('token') ||
      parsed.searchParams.get('u8_token') ||
      '';
    if (!token) {
      throw new Error('链接中未找到 token 参数');
    }
    const serverId = parsed.searchParams.get('server_id') || '1';
    const lang = parsed.searchParams.get('lang') || 'zh-cn';
    const host = parsed.host.includes('gryphline')
      ? 'https://ef-webview.gryphline.com'
      : 'https://ef-webview.hypergryph.com';
    return { token, serverId, lang, host };
  }

  // Treat raw text as token
  return {
    token: trimmed,
    serverId: '1',
    lang: 'zh-cn',
    host: 'https://ef-webview.hypergryph.com',
  };
}
