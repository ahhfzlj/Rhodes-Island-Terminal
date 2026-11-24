import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  computeArknightsGachaAnalysis,
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
  parseRogueEndingText,
  parseSklandRogue,
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
            bondInfo: [
              { bondId: 'bond_ult', activate: 1, layer: 4 },
              { bondId: 'bond_abyss', activate: 1, layer: 6 },
              { bondId: 'bond_laterano', activate: 1, layer: 2 },
            ],
            acBossInfo: [],
            chessSquad: [],
          },
          {
            id: 'rec_final_2',
            completeState: 1,
            trophyAfter: 250,
            bandId: 'band_1',
            mode: '终极模拟',
            passRound: 10,
            gameStartTs: 1759900000,
            gameEndTs: 1759901500,
            versionId: 'v3',
            activityId: 'act3autochess',
            bondInfo: [
              { bondId: 'bond_ult', activate: 1, layer: 3 },
              { bondId: 'bond_abyss', activate: 1, layer: 4 },
            ],
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
            bond_ult: { id: 'bond_ult', name: '绝技' },
            bond_abyss: { id: 'bond_abyss', name: '深海' },
            bond_laterano: { id: 'bond_laterano', name: '拉特兰' },
          },
        },
      ],
    }
  );

  assert.equal(season.highestDiffLabel, '终极模拟');
  assert.equal(season.matches[0].modeLabel, '终极模拟');
  assert.deepEqual(season.matches[0].covenants, ['深海 6层', '绝技 4层', '拉特兰 2层']);
  assert.deepEqual(
    season.covenantStats.map((c) => c.name),
    ['深海', '拉特兰']
  );
  assert.equal(season.covenantStats[0].totalMatches, 2);
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
  assert.equal(theme.relicsTotal, 296);
  assert.equal(theme.relicsTotalKnown, true);
  assert.equal(theme.totalRuns, 42);
  assert.deepEqual(
    theme.endings.filter((e) => e.unlocked).map((e) => e.name),
    ['终末新生', '千面一语']
  );
  assert.equal(theme.squads.length, 2);
  assert.equal(theme.squads[0].squadName, '高台分队');
  assert.equal(theme.squads[0].maxDifficulty, 18);
  assert.equal(theme.recentRuns.length, 2);
  assert.equal(theme.recentRuns[0].runId, 'run_1');
  assert.equal(theme.recentRuns[1].relicsCount, 3);
});

test('parseSklandRogue reads rec.rogueId, relicCnt, bank invest, bpLevel, clearTime, and rogueInfoMap without index shift', () => {
  const parsed = parseSklandRogue(
    {
      records: [
        {
          rogueId: 'rogue_5',
          relicCnt: 214,
          bank: { current: 500, record: 999 },
          clearTime: 41,
          bpLevel: 110,
          medal: { total: 12, current: 12 },
        },
        {
          rogueId: 'rogue_6',
          relicCnt: 88,
          bank: { current: 320, record: 640 },
          clearTime: 12,
          bpLevel: 98,
          medal: { total: 10, current: 6 },
        },
      ],
    },
    {
      rogue_5: { id: 'rogue_5', name: '岁的界园志异' },
      rogue_6: { id: 'rogue_6', name: '沉沦者的黑流树海' },
    }
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].themeId, 'rogue_5');
  assert.equal(parsed[0].themeName, '岁的界园志异');
  assert.equal(parsed[0].relicsUnlocked, 214);
  assert.equal(parsed[0].relicsTotal, 294);
  assert.equal(parsed[0].investedOriginium, 500);
  assert.equal(parsed[0].investedRecord, 999);
  assert.equal(parsed[0].clearedRuns, 41);
  assert.equal(parsed[0].level, 110);
  assert.equal(parsed[1].themeId, 'rogue_6');
  assert.equal(parsed[1].themeName, '沉沦者的黑流树海');
  assert.equal(parsed[1].relicsUnlocked, 88);
  assert.equal(parsed[1].investedOriginium, 320);
  assert.equal(parsed[1].investedRecord, 640);
});

test('normalizeSklandRogueDetail handles rogue_5 ending IDs, JSON journey endingText, zero-career fallback, and full run details', () => {
  const parsedText = parseRogueEndingText(
    JSON.stringify([
      { type: 'text', content: '您', color: '#FFFFFF73' },
      { type: 'text', content: ' Dr.ahhfzxc ', color: '#80E3EE', fontSize: 500 },
      { type: 'text', content: '驻足在', color: '#FFFFFF73' },
      { type: 'text', content: ' 血色空脉 ', color: '#80E3EE', fontSize: 500 },
      { type: 'text', content: '光芒之下。', color: '#FFFFFF73' },
    ])
  );
  assert.equal(parsedText.extractedEndingName, '血色空脉');
  assert.equal(parsedText.segments.length, 5);

  const stubs = parseSklandRogue({
    records: [
      {
        rogueId: 'rogue_5',
        relicCnt: 214,
        bank: { current: 999, record: 999 },
        clearTime: 35,
        bpLevel: 110,
        medal: { total: 12, current: 12 },
      },
    ],
  });

  const theme = normalizeSklandRogueDetail(
    'rogue_5',
    {
      topics: [{ id: 'rogue_5', name: '岁的界园志异', isSelected: true }],
      itemInfo: {
        rogue_5_copper_R_13_a: {
          name: '火照吉通宝',
          description: '通宝描述',
          usage: '全队攻击力+15%',
        },
        rogue_5_relic_explore_2: {
          name: '古旧罗盘',
          description: '罗盘描述',
          usage: '初始希望+2',
        },
      },
      history: {
        bpLevel: 110,
        mode: '请君入园',
        modeGrade: 15,
        score: 2512,
        medal: { current: 12, count: 12 },
        chars: [
          {
            id: 'char_4195_radian',
            name: '电弧',
            rarity: 5,
            profession: 'SUPPORT',
            evolvePhase: 2,
            level: 80,
          },
        ],
        records: [
          {
            id: 'r_win',
            startTs: '1762945337',
            endTs: '1762947137',
            mode: '请君入园',
            modeGrade: 15,
            success: 1,
            score: 2317,
            lastStage: '末狩',
            band: { id: 'rogue_5_band_23', name: '岁影回音分队' },
            cntCrossedZone: 7,
            cntArrivedNode: 90,
            cntBattleNormal: 22,
            cntBattleElite: 2,
            cntBattleBoss: 3,
            cntGainRelicItem: 73,
            cntRecruitUpgrade: 45,
            initChars: [
              {
                id: 'char_1043_leizi2',
                name: '司霆惊蛰',
                rarity: 5,
                profession: 'WARRIOR',
                evolvePhase: 2,
                level: 90,
              },
            ],
            troopChars: [
              {
                id: 'char_1043_leizi2',
                name: '司霆惊蛰',
                rarity: 5,
                profession: 'WARRIOR',
                evolvePhase: 2,
                level: 90,
              },
              {
                id: 'char_4163_rosesa',
                name: '瑰盐',
                rarity: 4,
                profession: 'MEDIC',
                evolvePhase: 2,
                level: 80,
              },
            ],
            lastChars: [
              {
                id: 'char_1043_leizi2',
                name: '司霆惊蛰',
                rarity: 5,
                profession: 'WARRIOR',
                evolvePhase: 2,
                level: 90,
              },
            ],
            gainRelicList: ['rogue_5_relic_explore_2'],
            totemList: [{ id: 'rogue_5_copper_R_13_a', count: 2 }],
            tagList: [{ name: '收藏大师', description: '获得收藏品>=60' }],
            endingText: JSON.stringify([
              { type: 'text', content: '您 Dr.这位同学 使用 岁影回音分队 见证了', color: '#FFFFFF73' },
              { type: 'text', content: ' 无中生有 ', color: '#BCF4CA', fontSize: 500 },
              { type: 'text', content: '落墨成卷。', color: '#FFFFFF73' },
            ]),
          },
          {
            id: 'r_fail',
            startTs: '1762900000',
            endTs: '1762900143',
            mode: '保密等级',
            modeGrade: 0,
            success: 0,
            score: 108,
            band: { id: 'band_1', name: '堡垒战术分队' },
            endingText: parsedText.segments.map((s) => ({
              type: 'text',
              content: s.text,
              color: s.color || '#FFFFFF73',
              fontSize: s.highlight ? 500 : undefined,
            })),
          },
        ],
        favourRecords: [
          {
            id: 'r_win',
            startTs: '1762945337',
            endTs: '1762947137',
            mode: '请君入园',
            modeGrade: 15,
            success: 1,
            score: 2317,
            band: { id: 'rogue_5_band_23', name: '岁影回音分队' },
            endingText: '无中生有',
          },
        ],
      },
      career: {
        game: 0,
        invest: 0,
        relic: 0,
        clearInfo: {
          difficulty: '请君入园',
          grade: 15,
          endings: ['ro5_ending_1', 'ro5_ending_2', 'ro5_ending_3', 'ro5_ending_4'],
          endingGrade: {
            ro5_ending_1: 15,
            ro5_ending_2: 15,
            ro5_ending_3: 15,
            ro5_ending_4: 15,
          },
        },
      },
    },
    stubs[0]
  );

  // Career relic=0 & invest=0 fall back accurately to player/info stub values
  assert.equal(theme.relicsUnlocked, 214);
  assert.equal(theme.relicsTotal, 294);
  assert.equal(theme.relicsTotalKnown, true);
  assert.equal(theme.investedOriginium, 999);
  assert.equal(theme.investedRecord, 999);
  assert.equal(theme.totemLabel, '通宝');
  assert.equal(theme.favoriteChars?.[0].name, '电弧');
  assert.equal(theme.favoriteChars?.[0].rarity, 6);
  assert.equal(theme.favoriteChars?.[0].profession, '辅助');

  // Ending IDs translated to official Chinese names + 5th ending locked
  assert.deepEqual(
    theme.endings.map((e) => [e.name, e.unlocked, e.maxGrade]),
    [
      ['依律镇抚', true, 15],
      ['长卷留痕', true, 15],
      ['黑白入玄', true, 15],
      ['无中生有', true, 15],
      ['落子无悔', false, undefined],
    ]
  );

  // Run details verified (no raw JSON in endingName!)
  const winRun = theme.recentRuns.find((r) => r.runId === 'r_win')!;
  const failRun = theme.recentRuns.find((r) => r.runId === 'r_fail')!;
  assert.equal(winRun.endingName, '无中生有');
  assert.equal(winRun.lastStage, '末狩');
  assert.equal(winRun.isFavorite, true);
  assert.equal(winRun.durationSec, 1800);
  assert.equal(winRun.initChars?.[0].rarity, 6);
  assert.equal(winRun.initChars?.[0].profession, '近卫');
  assert.equal(winRun.troopChars?.[1].rarity, 5);
  assert.equal(winRun.troopChars?.[1].profession, '医疗');
  assert.equal(winRun.stats?.crossedZone, 7);
  assert.equal(winRun.stats?.battleBoss, 3);
  assert.equal(winRun.relics?.[0].name, '古旧罗盘');
  assert.equal(winRun.totems?.[0].name, '火照吉通宝');
  assert.equal(winRun.totems?.[0].count, 2);
  assert.equal(winRun.tags?.[0].name, '收藏大师');

  assert.equal(failRun.endingName, '血色空脉');
  assert.equal(failRun.endingName.includes('[{"type"'), false);
  assert.equal(failRun.isFavorite, false);
});

test('computeArknightsGachaAnalysis tracks 3-track independent pity, zero-6★ banners, limited isolation, and achievements', () => {
  const baseTs = 1760000000000;
  const day = 86_400_000;
  const records: AkGachaRecord[] = [];
  let idx = 0;

  const pushPull = (
    poolName: string,
    category: AkGachaRecord['category'],
    rarity: AkGachaRecord['rarity'],
    ts: number,
    pos: number,
    charName = '测试干员',
    isNew = false
  ) => {
    records.push({
      id: `g_${idx++}`,
      ts,
      poolName,
      category,
      charId: `c_${idx}`,
      charName,
      rarity,
      isNew,
      pos,
    });
  };

  // 1) Limited Banner 1 (zero 6★, 11 pulls -> must NOT carry into Limited Banner 2)
  for (let i = 0; i < 11; i++) {
    pushPull('海渊巡游', 'limited', i === 0 ? 5 : 4, baseTs + i * 1000, i, '五星干员');
  }

  // 2) Normal Banner A (zero 6★, 15 pulls -> MUST carry into Normal Banner B)
  for (let i = 0; i < 15; i++) {
    pushPull('标准寻访A', 'normal', 4, baseTs + 2 * day + i * 1000, i);
  }

  // 3) Normal Banner B: 9 non-6★ + 10th pull is 6★ => cumulative normal pity = 15 + 10 = 25!
  // Plus 4 trailing pulls => categories.normal.currentPity = 4
  for (let i = 0; i < 9; i++) {
    pushPull('标准寻访B', 'normal', 4, baseTs + 4 * day + i * 1000, i);
  }
  pushPull('标准寻访B', 'normal', 6, baseTs + 4 * day + 9 * 1000, 9, '妮芙', true);
  for (let i = 0; i < 4; i++) {
    pushPull('标准寻访B', 'normal', 3, baseTs + 4 * day + (10 + i) * 1000, 10 + i);
  }

  // 4) Classic Banner: 3 pulls, 2nd pull 6★ => pulls === 2, classic trailing pity === 1
  pushPull('中坚寻访 · 银心', 'classic', 4, baseTs + 6 * day, 0);
  pushPull('中坚寻访 · 银心', 'classic', 6, baseTs + 6 * day + 1000, 1, '银灰', false);
  pushPull('中坚寻访 · 银心', 'classic', 5, baseTs + 6 * day + 2000, 2, '德克萨斯');

  // 5) Limited Banner 2:
  // Batch 1 (pos 0..9 sharing batchTs1): pos 0 is 6★ (pulls === 1 -> 一发入魂!), pos 5 is 6★ (pulls === 5 -> same ts => 十连两金!)
  // Batch 2 (5 trailing pulls -> categories.limited.currentPity === 5)
  const batchTs1 = baseTs + 8 * day;
  pushPull('将雪投火', 'limited', 6, batchTs1, 0, '将进酒干员A', true);
  for (let p = 1; p < 5; p++) {
    pushPull('将雪投火', 'limited', 4, batchTs1, p);
  }
  pushPull('将雪投火', 'limited', 6, batchTs1, 5, '将进酒干员B', true);
  for (let p = 6; p < 10; p++) {
    pushPull('将雪投火', 'limited', 3, batchTs1, p);
  }
  const batchTs2 = baseTs + 8 * day + 60_000;
  for (let p = 0; p < 5; p++) {
    pushPull('将雪投火', 'limited', 4, batchTs2, p);
  }

  const analysis = computeArknightsGachaAnalysis(records);

  // Category totals & independent 3-track currentPity
  assert.equal(analysis.categories.normal.totalPulls, 29);
  assert.equal(analysis.categories.normal.sixCount, 1);
  assert.equal(analysis.categories.normal.currentPity, 4);

  assert.equal(analysis.categories.classic.totalPulls, 3);
  assert.equal(analysis.categories.classic.sixCount, 1);
  assert.equal(analysis.categories.classic.currentPity, 1);

  assert.equal(analysis.categories.limited.totalPulls, 26);
  assert.equal(analysis.categories.limited.sixCount, 2);
  assert.equal(analysis.categories.limited.currentPity, 9);

  // Every banner appears in newest-first order, including zero-6★ banners
  assert.equal(analysis.banners.length, 5);
  assert.deepEqual(
    analysis.banners.map((b) => b.poolName),
    ['将雪投火', '中坚寻访 · 银心', '标准寻访B', '标准寻访A', '海渊巡游']
  );

  const limitedBanner2 = analysis.banners[0];
  const classicBanner = analysis.banners[1];
  const normalBannerB = analysis.banners[2];
  const normalBannerA = analysis.banners[3];
  const limitedBanner1 = analysis.banners[4];

  assert.equal(limitedBanner1.totalPulls, 11);
  assert.equal(limitedBanner1.sixStars.length, 0);
  assert.equal(limitedBanner1.fiveCount, 1);

  assert.equal(normalBannerA.totalPulls, 15);
  assert.equal(normalBannerA.sixStars.length, 0);

  // Standard pity carried across Standard A (15) + Standard B (10) = 25
  assert.equal(normalBannerB.sixStars[0].pulls, 25);
  assert.equal(classicBanner.sixStars[0].pulls, 2);

  // Limited isolation: Limited Banner 2 starts fresh at pull 1 (NOT 11 + 1)
  assert.equal(limitedBanner2.sixStars[0].pulls, 1);
  assert.equal(limitedBanner2.sixStars[1].pulls, 5);
  assert.equal(limitedBanner2.trailingPity, 9);

  // Achievements detected cleanly
  const achLabels = analysis.achievements.map((a) => a.label);
  assert.ok(achLabels.some((l) => l.includes('十连两金')));
  assert.ok(achLabels.some((l) => l.includes('一发入魂')));
});
