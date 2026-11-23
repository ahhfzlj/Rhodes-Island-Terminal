import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  computeArknightsGachaStats,
  computeEndfieldGachaStats,
  mergeAkGachaRecords,
  mergeEndfieldGachaRecords,
  parseEndfieldGachaUrl,
} from '../src/utils/analytics.js';
import { generateSklandHeaders } from '../server/hypergryph/signer.js';
import { generateNativeSklandHeaders } from '../src/services/nativeSigner.js';
import {
  normalizeSklandGarrisonResponse,
  normalizeSklandRogueDetail,
} from '../src/utils/parsers.js';
import type { AkGachaRecord, EndfieldGachaRecord } from '../src/types/index.js';

test('generateSklandHeaders computes deterministic HMAC-SHA256 + MD5 signature', () => {
  const apiPath = '/api/v1/game/player/info';
  const query = 'uid=123456789';
  const cred = 'test_cred_abc';
  const signToken = 'test_sign_token_xyz';
  const dId = 'device_001';
  const ts = '1730000000';

  const headers = generateSklandHeaders(apiPath, query, cred, signToken, dId, ts);

  assert.equal(headers.cred, cred);
  assert.equal(headers.platform, '3');
  assert.equal(headers.timestamp, ts);
  assert.equal(headers.dId, dId);
  assert.equal(headers.vName, '1.0.0');

  const expectedHeaderCa = JSON.stringify({
    platform: '3',
    timestamp: ts,
    dId,
    vName: '1.0.0',
  });
  const expectedPayload = apiPath + query + ts + expectedHeaderCa;
  const expectedHmac = crypto
    .createHmac('sha256', signToken)
    .update(expectedPayload)
    .digest('hex');
  const expectedSign = crypto.createHash('md5').update(expectedHmac).digest('hex');

  assert.equal(headers.sign, expectedSign);

  const nativeHeaders = generateNativeSklandHeaders(
    apiPath,
    query,
    cred,
    signToken,
    dId,
    ts
  );
  assert.deepEqual(nativeHeaders, headers);
});

test('computeArknightsGachaStats computes 50-pull soft pity, intervals, and rates accurately', () => {
  const records: AkGachaRecord[] = [];
  const baseTs = 1700000000000;

  // Cycle 1: 20 pulls -> 6★
  for (let i = 0; i < 19; i++) {
    records.push({
      id: `ak_${i}`,
      ts: baseTs + i * 1000,
      poolName: '常规寻访',
      category: 'normal',
      charId: `c_${i}`,
      charName: '桃金娘',
      rarity: 4,
      isNew: false,
      pos: i,
    });
  }
  records.push({
    id: 'ak_19',
    ts: baseTs + 19 * 1000,
    poolName: '常规寻访',
    category: 'normal',
    charId: 'c_6_1',
    charName: '维什戴尔',
    rarity: 6,
    isNew: true,
    pos: 19,
  });

  // Ongoing Cycle 2: 58 pulls without 6★ -> soft pity bonus = (58 - 50) * 2 = 16%, total 18%
  for (let i = 20; i < 78; i++) {
    records.push({
      id: `ak_${i}`,
      ts: baseTs + i * 1000,
      poolName: '常规寻访',
      category: 'normal',
      charId: `c_${i}`,
      charName: i % 10 === 0 ? '德克萨斯' : '芬',
      rarity: i % 10 === 0 ? 5 : 3,
      isNew: false,
      pos: i,
    });
  }

  const stats = computeArknightsGachaStats(records, 'normal');
  assert.equal(stats.totalPulls, 78);
  assert.equal(stats.sixCount, 1);
  assert.equal(stats.currentPity, 58);
  assert.equal(stats.softPityBonus, 16);
  assert.equal(stats.currentSixChance, 18);
  assert.equal(stats.avgPullsPerSix, 20);
  assert.equal(stats.sixStarTimeline.length, 1);
  assert.equal(stats.sixStarTimeline[0].charName, '维什戴尔');
  assert.equal(stats.sixStarTimeline[0].pulls, 20);
});

test('mergeAkGachaRecords deduplicates by id and sorts newest first', () => {
  const a: AkGachaRecord = {
    id: '1',
    ts: 1000,
    poolName: 'A',
    category: 'normal',
    charId: 'c1',
    charName: '芬',
    rarity: 3,
    isNew: false,
    pos: 0,
  };
  const b: AkGachaRecord = {
    id: '2',
    ts: 2000,
    poolName: 'A',
    category: 'normal',
    charId: 'c2',
    charName: '妮芙',
    rarity: 6,
    isNew: true,
    pos: 1,
  };

  const merged = mergeAkGachaRecords([a], [a, b]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, '2');
  assert.equal(merged[1].id, '1');
});

test('computeEndfieldGachaStats handles 80-pull inherited small pity and 120-pull per-banner non-inherited guarantee', () => {
  const baseTs = 1750000000000;
  const records: EndfieldGachaRecord[] = [];
  let seq = 1;

  // Banner 1 ('pool_a'): 30 pulls -> wins featured 6★
  for (let i = 0; i < 29; i++) {
    records.push({
      id: `ef_${seq}`,
      seqId: String(seq++),
      ts: baseTs + seq * 1000,
      poolId: 'pool_a',
      poolName: '特许 · 苍穹回响',
      poolType: 'special',
      itemId: 'i4',
      itemName: '安塔尔',
      rarity: 4,
      isFeatured: false,
      isFree: false,
    });
  }
  records.push({
    id: `ef_${seq}`,
    seqId: String(seq++),
    ts: baseTs + seq * 1000,
    poolId: 'pool_a',
    poolName: '特许 · 苍穹回响',
    poolType: 'special',
    itemId: 'i6a',
    itemName: '洁尔佩塔',
    rarity: 6,
    isFeatured: true,
    isFree: false,
  });

  // Banner 2 ('pool_b'): 40 pulls -> loses 50/50 (non-featured 6★), then 25 more pulls
  // Expected:
  // - smallPity80.current = 25 (inherited counter resets on ANY 6★ in special pool)
  // - pool_b 120 bigPity: pullsInBanner = 65, hasWonFeatured = false, remaining = 55!
  // - pool_a 120 bigPity: pullsInBanner = 30, hasWonFeatured = true, remaining = 0!
  for (let i = 0; i < 39; i++) {
    records.push({
      id: `ef_${seq}`,
      seqId: String(seq++),
      ts: baseTs + seq * 1000,
      poolId: 'pool_b',
      poolName: '特许 · 炽焰余烬',
      poolType: 'special',
      itemId: 'i4',
      itemName: '卡契尔',
      rarity: 4,
      isFeatured: false,
      isFree: false,
    });
  }
  records.push({
    id: `ef_${seq}`,
    seqId: String(seq++),
    ts: baseTs + seq * 1000,
    poolId: 'pool_b',
    poolName: '特许 · 炽焰余烬',
    poolType: 'special',
    itemId: 'i6off',
    itemName: '艾尔黛拉',
    rarity: 6,
    isFeatured: false,
    isFree: false,
  });
  for (let i = 0; i < 25; i++) {
    records.push({
      id: `ef_${seq}`,
      seqId: String(seq++),
      ts: baseTs + seq * 1000,
      poolId: 'pool_b',
      poolName: '特许 · 炽焰余烬',
      poolType: 'special',
      itemId: 'i5',
      itemName: '佩丽卡',
      rarity: 5,
      isFeatured: false,
      isFree: false,
    });
  }

  // Merge check
  const merged = mergeEndfieldGachaRecords(records.slice(0, 10), records);
  assert.equal(merged.length, records.length);

  const statsB = computeEndfieldGachaStats(merged, 'special', 'pool_b');
  assert.equal(statsB.smallPity80.current, 25);
  assert.equal(statsB.smallPity80.max, 80);
  assert.equal(statsB.smallPity80.inherited, true);
  assert.equal(statsB.featuredWinRate, 50);
  assert.equal(statsB.bigPity120?.poolId, 'pool_b');
  assert.equal(statsB.bigPity120?.pullsInBanner, 65);
  assert.equal(statsB.bigPity120?.hasWonFeatured, false);
  assert.equal(statsB.bigPity120?.remaining, 55);
  assert.equal(statsB.bigPity120?.nonInherited, true);

  const statsA = computeEndfieldGachaStats(merged, 'special', 'pool_a');
  assert.equal(statsA.bigPity120?.hasWonFeatured, true);
  assert.equal(statsA.bigPity120?.pullsInBanner, 30);
  assert.equal(statsA.bigPity120?.remaining, 0);
});

test('parseEndfieldGachaUrl parses full ef-webview URL and raw token', () => {
  const parsedUrl = parseEndfieldGachaUrl(
    'https://ef-webview.hypergryph.com/api/record/char?server_id=1&pool_type=E_CharacterGachaPoolType_Special&lang=zh-cn&token=abc123token'
  );
  assert.equal(parsedUrl.token, 'abc123token');
  assert.equal(parsedUrl.serverId, '1');
  assert.equal(parsedUrl.lang, 'zh-cn');
  assert.equal(parsedUrl.host, 'https://ef-webview.hypergryph.com');

  const parsedRaw = parseEndfieldGachaUrl('raw_token_xyz');
  assert.equal(parsedRaw.token, 'raw_token_xyz');
  assert.equal(parsedRaw.host, 'https://ef-webview.hypergryph.com');
});

test('normalizeSklandGarrisonResponse parses official Skland garrison info and resource payloads', () => {
  const resourceData = {
    resources: [
      {
        versionInfo: {
          versionId: 'v2',
          activityId: 'act2autochess',
          seasonName: '卫戍协议：盟约',
        },
        bandInfo: {
          band_1: { id: 'band_1', name: '高台狙术协同' },
        },
        bondInfo: {
          bond_laterano: { id: 'bond_laterano', name: '拉特兰' },
          bond_precise: { id: 'bond_precise', name: '精准' },
        },
        equipInfo: {
          eq_1: { id: 'eq_1', name: '重型攻城弹匣' },
        },
        chessInfo: {
          chess_wis: {
            id: 'chess_wis',
            charId: 'char_1035_wisdel',
            charName: '维什戴尔',
            charProfession: 'SNIPER',
            chessLevel: 4,
            evolvePhase: 2,
          },
        },
        bossInfo: {
          boss_1: { id: 'boss_1', enemyId: 'enemy_9013_acstmk', handbookEnemyId: 'enemy_9013_acstmk' },
          boss_h: { id: 'boss_h', enemyId: 'enemy_1559_vtlionk', handbookEnemyId: 'enemy_1559_vtlionk' },
        },
      },
    ],
  };

  const infoData = {
    career: {
      mode: '绝境模拟',
      totalSingleBattleCnt: 10,
      totalSingleBattleWinCnt: 7,
      totalMultiBattleCnt: 2,
      totalMultiBattleWinCnt: 2,
      totalTrophyCnt: 64,
      top1BandUseId: 'band_1',
    },
    history: {
      records: [
        {
          id: 'match_01',
          completeState: 1,
          trophyAfter: 120,
          bandId: 'band_1',
          mode: '绝境模拟',
          passRound: 10,
          gameStartTs: 1760000000,
          gameEndTs: 1760001000,
          versionId: 'v2',
          activityId: 'act2autochess',
          bondInfo: [
            { bondId: 'bond_laterano', activate: 1, layer: 4 },
            { bondId: 'bond_precise', activate: 1, layer: 2 },
          ],
          acBossInfo: [
            { bossId: 'boss_1', isHidden: false, isKilled: true },
            { bossId: 'boss_h', isHidden: true, isKilled: true },
          ],
          chessSquad: [
            {
              chessId: 'chess_wis',
              charId: 'char_1035_wisdel',
              equips: [{ equipId: 'eq_1' }],
            },
          ],
        },
      ],
    },
  };

  const season = normalizeSklandGarrisonResponse(infoData, resourceData);
  assert.equal(season.seasonId, 'act2autochess');
  assert.equal(season.seasonName, '卫戍协议：盟约');
  assert.equal(season.totalMatches, 12);
  assert.equal(season.clearCount, 9);
  assert.equal(season.winRate, 75);
  assert.equal(season.trophies, 64);
  assert.equal(season.favoriteStrategy, '高台狙术协同');
  assert.equal(season.normalBossKills, 1);
  assert.equal(season.hiddenBossKills, 1);
  assert.equal(season.matches.length, 1);
  assert.equal(season.matches[0].modeLabel, '绝境模拟');
  assert.equal(season.matches[0].durationSec, 1000);
  assert.deepEqual(season.matches[0].covenants, ['拉特兰 4层', '精准 2层']);
  assert.deepEqual(season.matches[0].covenantDetails, [
    { name: '拉特兰', layer: 4, activated: true },
    { name: '精准', layer: 2, activated: true },
  ]);
  assert.deepEqual(season.matches[0].normalBossKills, ['假想敌：胄']);
  assert.deepEqual(season.matches[0].hiddenBossKills, ['阿利斯泰尔，帝国余晖']);
  assert.equal(season.matches[0].squad[0].name, '维什戴尔');
  assert.deepEqual(season.matches[0].squad[0].equipments, ['重型攻城弹匣']);
  assert.equal(season.covenantStats.length, 2);
});

test('normalizeSklandGarrisonResponse preserves official 终极模拟 mode label', () => {
  const season = normalizeSklandGarrisonResponse(
    {
      career: {
        totalSingleBattleCnt: 5,
        totalSingleBattleWinCnt: 4,
        totalMultiBattleCnt: 0,
        totalMultiBattleWinCnt: 0,
        totalTrophyCnt: 300,
        mode: '终极模拟',
      },
      history: {
        records: [
          {
            id: 'rec_final_1',
            completeState: 1,
            trophyAfter: 300,
            bandId: 'band_1',
            mode: '终极模拟',
            passRound: 12,
            gameStartTs: 1760000000,
            gameEndTs: 1760001800,
            versionId: 'v3',
            activityId: 'act3autochess',
            bondInfo: [{ bondId: 'bond_abyss', activate: 1, layer: 6 }],
            acBossInfo: [],
            chessSquad: [],
          },
        ],
      },
    },
    {
      resources: [
        {
          versionInfo: {
            versionId: 'v3',
            activityId: 'act3autochess',
            seasonName: '卫戍协议：终极',
          },
          bondInfo: {
            bond_abyss: { id: 'bond_abyss', name: '深海' },
          },
        },
      ],
    }
  );

  assert.equal(season.highestDiffLabel, '终极模拟');
  assert.equal(season.matches[0].modeLabel, '终极模拟');
  assert.deepEqual(season.matches[0].covenants, ['深海 6层']);
});

test('normalizeSklandRogueDetail parses real theme name, N18 difficulty, bpLevel, bank invest, endings, squads, and recentRuns', () => {
  const theme = normalizeSklandRogueDetail('rogue_4', {
    history: {
      bpLevel: 145,
      mode: '思维之裂 N18',
      modeGrade: 18,
      score: 2560,
      medal: { current: 8, count: 10 },
      records: [
        {
          id: 'run_1',
          startTs: 1760000000,
          endTs: 1760002000,
          modeGrade: 18,
          success: 1,
          score: 2560,
          cntGainRelicItem: 42,
          band: { name: '高台分队' },
          endingText: '终末新生',
        },
        {
          id: 'run_2',
          startTs: 1759990000,
          endTs: 1759991200,
          modeGrade: 15,
          success: 0,
          score: 1480,
          gainRelicList: ['r1', 'r2', 'r3'],
          band: { name: '点刺成面分队' },
          lastStage: '第五层险境',
        },
      ],
      favourRecords: [
        {
          id: 'run_1',
          startTs: 1760000000,
          endTs: 1760002000,
          modeGrade: 18,
          success: 1,
          score: 2560,
          cntGainRelicItem: 42,
          band: { name: '高台分队' },
          endingText: '终末新生',
        },
      ],
    },
    career: {
      game: 42,
      invest: 999,
      relic: 214,
      clearInfo: {
        difficulty: '灵魂熔炉 N18',
        endings: ['终末新生', '千面一语'],
      },
    },
  });

  assert.equal(theme.themeName, '萨卡兹的无终奇语');
  assert.equal(theme.maxDifficulty, 18);
  assert.equal(theme.difficultyCap, 18);
  assert.equal(theme.bestModeLabel, '灵魂熔炉 N18');
  assert.equal(theme.highestScore, 2560);
  assert.equal(theme.medalCurrent, 8);
  assert.equal(theme.medalTotal, 10);
  assert.equal(theme.level, 145);
  assert.equal(theme.investedOriginium, 999);
  assert.equal(theme.relicsUnlocked, 214);
  assert.equal(theme.relicsTotalKnown, false);
  assert.equal(theme.totalRuns, 42);
  assert.deepEqual(
    theme.endings.map((e) => e.name),
    ['终末新生', '千面一语']
  );
  assert.equal(theme.squads.length, 2);
  assert.equal(theme.squads[0].squadName, '高台分队');
  assert.equal(theme.squads[0].maxDifficulty, 18);
  assert.equal(theme.recentRuns.length, 2);
  assert.equal(theme.recentRuns[0].runId, 'run_1');
  assert.equal(theme.recentRuns[1].relicsCount, 3);
});
