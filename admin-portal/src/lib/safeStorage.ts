import { logger } from './logger';

/**
 * A safe wrapper around browser localStorage to prevent crashes in strict privacy modes
 * (e.g., Safari Private Browsing) or environments where window is undefined.
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      logger.warn(`Failed to read ${key} from localStorage`, { error: e });
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      logger.warn(`Failed to set ${key} in localStorage`, { error: e });
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      logger.warn(`Failed to remove ${key} from localStorage`, { error: e });
    }
  }
};
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      logger.warn(`Failed to read ${key} from sessionStorage`, { error: e });
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, value);
      }
    } catch (e) {
      logger.warn(`Failed to set ${key} in sessionStorage`, { error: e });
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
      }
    } catch (e) {
      logger.warn(`Failed to remove ${key} from sessionStorage`, { error: e });
    }
  }
};
