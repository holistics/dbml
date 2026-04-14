import {
  ref, watch,
} from 'vue';
import {
  defineStore,
} from 'pinia';
import logger from '../utils/logger';

export interface UserPreferences {
  isVim: boolean;
}

const STORAGE_KEY = 'USER_DATA';

const defaults: UserPreferences = {
  isVim: false,
};

function load (): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return {
      ...defaults,
      ...JSON.parse(raw),
    };
  } catch (err) {
    logger.warn('Failed to load user preferences:', err);
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
    } catch (err) {
      logger.warn('Failed to save user preferences:', err);
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
