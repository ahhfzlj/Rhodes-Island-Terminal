export type GameMode = 'arknights' | 'endfield';
export type DataMode = 'demo' | 'live';

export interface AkGachaRecord {
  id: string;
  ts: number; // Unix timestamp in milliseconds
  poolName: string;
  category: 'normal' | 'limited' | 'classic' | 'collab' | string;
  charId: string;
  charName: string;
  rarity: 3 | 4 | 5 | 6;
  isNew: boolean;
  pos: number;
}

export interface AkSixStarTimelineItem {
  id: string;
  ts: number;
  poolName: string;
  category: string;
  charName: string;
  pulls: number;
  isNew: boolean;
}

export interface AkGachaStats {
  totalPulls: number;
  sixCount: number;
  fiveCount: number;
  fourCount: number;
  threeCount: number;
  sixRate: number;
  fiveRate: number;
  fourRate: number;
  threeRate: number;
  avgPullsPerSix: number;
  currentPity: number;
  softPityBonus: number;
  currentSixChance: number;
  luckRating: 'EX' | 'S' | 'A' | 'B' | 'C';
  sixStarTimeline: AkSixStarTimelineItem[];
}

export interface GarrisonOperator {
  charId: string;
  name: string;
  profession: string;
  rarity: number;
  elite: number;
  equipments?: string[];
}

export interface GarrisonMatch {
  matchId: string;
  ts: number;
  difficulty: number;
  difficultyLabel: string;
  cleared: boolean;
  strategyName: string;
  covenants: string[];
  durationSec: number;
  score: number;
  normalBossKills: string[];
  hiddenBossKills: string[];
  squad: GarrisonOperator[];
  finalWave: number;
  maxWave: number;
}

export interface GarrisonCovenantStat {
  name: string;
  totalMatches: number;
  clearCount: number;
  winRate: number;
}

export interface GarrisonSeasonData {
  seasonId: string;
  seasonName: string;
  totalMatches: number;
  clearCount: number;
  winRate: number;
  highestDiff: number;
  highestDiffLabel: string;
  trophies: number;
  normalBossKills: number;
  hiddenBossKills: number;
  favoriteStrategy: string;
  covenantStats: GarrisonCovenantStat[];
  matches: GarrisonMatch[];
}

export interface RogueEnding {
  id: string;
  name: string;
  code: string;
  unlocked: boolean;
  clearCount: number;
}

export interface RogueSquadProgress {
  squadName: string;
  maxDifficulty: number;
  cleared: boolean;
}

export interface RogueRecentRun {
  runId: string;
  ts: number;
  difficulty: number;
  squadName: string;
  endingName: string;
  cleared: boolean;
  score: number;
  relicsCount: number;
}

export interface RogueThemeData {
  themeId: string;
  themeName: string;
  codeName: string;
  maxDifficulty: number;
  difficultyCap: number;
  totalRuns: number;
  clearedRuns: number;
  endings: RogueEnding[];
  relicsUnlocked: number;
  relicsTotal: number;
  level: number;
  maxLevel: number;
  investedOriginium: number;
  squads: RogueSquadProgress[];
  recentRuns: RogueRecentRun[];
}

export interface DoctorProfile {
  uid: string;
  nickName: string;
  channelName: string; // '官服' | 'B服'
  level: number;
  apCurrent: number;
  apMax: number;
  charCount: number;
  secretaryName: string;
  registerTs: number;
}

export type EndfieldPoolType = 'special' | 'standard' | 'beginner' | 'weapon';

export interface EndfieldGachaRecord {
  id: string;
  seqId: string;
  ts: number; // Unix timestamp in milliseconds
  poolId: string;
  poolName: string;
  poolType: EndfieldPoolType;
  itemId: string;
  itemName: string;
  rarity: 4 | 5 | 6;
  isFeatured: boolean;
  isFree: boolean;
}

export interface EndfieldSmallPityInfo {
  current: number;
  max: number;
  softPityStart: number;
  inSoftPity: boolean;
  inherited: boolean;
}

export interface EndfieldBigPityInfo {
  poolId: string;
  poolName: string;
  pullsInBanner: number;
  guaranteedAt: number; // 120 for special char banner, 80 for weapon
  hasWonFeatured: boolean;
  remaining: number;
  nonInherited: true;
}

export interface EndfieldSixStarTimelineItem {
  id: string;
  ts: number;
  poolId: string;
  poolName: string;
  poolType: EndfieldPoolType;
  itemName: string;
  pulls: number;
  isFeatured: boolean;
  isFree: boolean;
}

export interface EndfieldGachaStats {
  totalPulls: number;
  sixCount: number;
  fiveCount: number;
  fourCount: number;
  sixRate: number;
  fiveRate: number;
  fourRate: number;
  avgPullsPerSix: number;
  smallPity80: EndfieldSmallPityInfo;
  bigPity120: EndfieldBigPityInfo | null;
  bannerBigPities: EndfieldBigPityInfo[];
  featuredWinRate: number | null;
  sixStarTimeline: EndfieldSixStarTimelineItem[];
}

export interface GameBindingItem {
  uid: string;
  nickName: string;
  channelName: string;
  channelMasterId: number;
  isOfficial: boolean;
}

export interface GameAuthState {
  authenticated: boolean;
  phoneMasked?: string;
  hasSklandCred: boolean;
  hasU8Token: boolean;
  bindings: GameBindingItem[];
  activeUid?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  arknights: GameAuthState;
  endfield: GameAuthState;
  lastSync?: {
    akProfile?: number;
    akGacha?: number;
    akGarrison?: number;
    endfieldGacha?: number;
  };
}
