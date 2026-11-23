import fs from 'node:fs';
import path from 'node:path';
import type {
  AkGachaRecord,
  AuthStatus,
  DoctorProfile,
  EndfieldGachaRecord,
  GameAuthState,
  GameBindingItem,
  GameMode,
  GarrisonSeasonData,
  RogueThemeData,
} from '../src/types/index.js';

export interface StoredGameAuth {
  phoneMasked?: string;
  hgToken?: string;
  sklandCred?: string;
  sklandSignToken?: string;
  dId?: string;
  oauthToken?: string;
  u8Token?: string;
  gachaToken?: string;
  serverId?: string;
  gachaHost?: string;
  bindings: GameBindingItem[];
  activeUid?: string;
}

export interface StoreData {
  auth: {
    arknights: StoredGameAuth;
    endfield: StoredGameAuth;
  };
  akProfile: DoctorProfile | null;
  akGacha: AkGachaRecord[];
  akGarrison: GarrisonSeasonData | null;
  akRogue: RogueThemeData[];
  endfieldGacha: EndfieldGachaRecord[];
  lastSync: {
    akProfile?: number;
    akGacha?: number;
    akGarrison?: number;
    endfieldGacha?: number;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export function createEmptyGameAuth(): StoredGameAuth {
  return {
    bindings: [],
  };
}

function createEmptyStore(): StoreData {
  return {
    auth: {
      arknights: createEmptyGameAuth(),
      endfield: createEmptyGameAuth(),
    },
    akProfile: null,
    akGacha: [],
    akGarrison: null,
    akRogue: [],
    endfieldGacha: [],
    lastSync: {},
  };
}

export function loadStore(): StoreData {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return createEmptyStore();
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as any;
    const empty = createEmptyStore();

    let akAuth = createEmptyGameAuth();
    let efAuth = createEmptyGameAuth();

    if (parsed?.auth?.arknights || parsed?.auth?.endfield) {
      akAuth = {
        ...createEmptyGameAuth(),
        ...(parsed.auth.arknights || {}),
        bindings: parsed.auth.arknights?.bindings || [],
      };
      efAuth = {
        ...createEmptyGameAuth(),
        ...(parsed.auth.endfield || {}),
        bindings: parsed.auth.endfield?.bindings || [],
      };
    } else if (parsed?.auth) {
      // Migrate legacy shared auth format into independent slots
      const old = parsed.auth;
      akAuth = {
        phoneMasked: old.phoneMasked,
        hgToken: old.hgToken,
        sklandCred: old.sklandCred,
        sklandSignToken: old.sklandSignToken,
        dId: old.dId,
        oauthToken: old.akOAuthToken,
        u8Token: old.akU8Token,
        bindings: old.akBindings || [],
        activeUid: old.activeAkUid,
      };
      efAuth = {
        phoneMasked: old.phoneMasked,
        hgToken: old.hgToken,
        sklandCred: old.sklandCred,
        sklandSignToken: old.sklandSignToken,
        dId: old.dId,
        u8Token: old.endfieldU8Token,
        gachaToken: old.endfieldGachaToken,
        serverId: old.endfieldServerId,
        gachaHost: old.endfieldHost,
        bindings: old.endfieldBindings || [],
        activeUid: old.activeEndfieldUid,
      };
    }

    return {
      ...empty,
      ...parsed,
      auth: {
        arknights: akAuth,
        endfield: efAuth,
      },
      akGacha: parsed.akGacha || [],
      akRogue: parsed.akRogue || [],
      endfieldGacha: parsed.endfieldGacha || [],
      lastSync: parsed.lastSync || {},
    };
  } catch {
    return createEmptyStore();
  }
}

export function saveStore(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function resetStore(game?: GameMode): StoreData {
  if (!game) {
    const empty = createEmptyStore();
    saveStore(empty);
    return empty;
  }
  const store = loadStore();
  if (game === 'arknights') {
    store.auth.arknights = createEmptyGameAuth();
    store.akProfile = null;
    store.akGacha = [];
    store.akGarrison = null;
    store.akRogue = [];
    delete store.lastSync.akProfile;
    delete store.lastSync.akGacha;
    delete store.lastSync.akGarrison;
  } else {
    store.auth.endfield = createEmptyGameAuth();
    store.endfieldGacha = [];
    delete store.lastSync.endfieldGacha;
  }
  saveStore(store);
  return store;
}

function toGameAuthState(auth: StoredGameAuth): GameAuthState {
  const hasSklandCred = Boolean(auth.sklandCred && auth.sklandSignToken);
  const hasU8Token = Boolean(auth.u8Token || auth.gachaToken);
  return {
    authenticated: hasSklandCred || hasU8Token || Boolean(auth.hgToken),
    phoneMasked: auth.phoneMasked,
    hasSklandCred,
    hasU8Token,
    bindings: auth.bindings,
    activeUid: auth.activeUid || auth.bindings[0]?.uid,
  };
}

export function toAuthStatus(store: StoreData): AuthStatus {
  const arknights = toGameAuthState(store.auth.arknights);
  const endfield = toGameAuthState(store.auth.endfield);
  return {
    authenticated: arknights.authenticated || endfield.authenticated,
    arknights,
    endfield,
    lastSync: store.lastSync,
  };
}
