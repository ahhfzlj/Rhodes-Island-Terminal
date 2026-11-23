import type {
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
