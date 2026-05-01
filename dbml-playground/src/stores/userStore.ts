import {
  ref, watch,
} from 'vue';
import {
  defineStore,
} from 'pinia';
import logger from '../utils/logger';

export enum OutputTabId {
  Tokens = 'tokens',
  Nodes = 'nodes',
  Symbols = 'symbols',
  Database = 'database',
  Diagnostics = 'diagnostics',
}

export interface UserPreferences {
  isVim: boolean;
  activeOutputTab: OutputTabId;
  panelSizes: number[];
}

const STORAGE_KEY = 'USER_DATA';

const defaults: UserPreferences = {
  isVim: false,
  activeOutputTab: OutputTabId.Nodes,
  panelSizes: [15, 42, 43],
};

function load (): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return {
      ...defaults,
      ...JSON.parse(raw),
    };
  } catch (_err) {
    logger.warn('Failed to load user preferences');
  }
  return {
    ...defaults,
  };
}

export const useUser = defineStore('user', () => {
  const prefs = ref<UserPreferences>(load());

  watch(prefs, (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_err) {
      logger.warn('Failed to save user preferences');
    }
  }, {
    deep: true,
  });

  function set<K extends keyof UserPreferences> (key: K, value: UserPreferences[K]) {
    prefs.value[key] = value;
  }

  return {
    prefs,
    set,
  };
});
