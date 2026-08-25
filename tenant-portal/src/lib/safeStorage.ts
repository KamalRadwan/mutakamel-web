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
      console.warn(`Failed to read ${key} from localStorage`, e);
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`Failed to set ${key} in localStorage`, e);
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`Failed to remove ${key} from localStorage`, e);
    }
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined") {
        return window.sessionStorage.getItem(key);
      }
    } catch (error) {
      console.warn(`Failed to read ${key} from sessionStorage`, error);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn(`Failed to set ${key} in sessionStorage`, error);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to remove ${key} from sessionStorage`, error);
    }
  },
};
