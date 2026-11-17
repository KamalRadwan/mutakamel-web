import { safeStorage } from "@/lib/safeStorage";
import type { Dictionary } from "./dictionaries/ar";

export type Language = "ar" | "en";
export interface LanguageSnapshot {
  lang: Language;
  dictionary: Dictionary;
}

export const LANGUAGE_KEY = "tenant_lang";
const LOCAL_CHANGE_EVENT = "tenant-lang-change";
const snapshots: Partial<Record<Language, LanguageSnapshot>> = {};
const pending: Partial<Record<Language, Promise<LanguageSnapshot>>> = {};
let active: LanguageSnapshot | null = null;
let selection = 0;

export function languageOrDefault(value: string | null | undefined): Language {
  if (value === "ar") return "ar";
  return "en";
}

export function readLanguage(): Language {
  const stored = safeStorage.getItem(LANGUAGE_KEY);
  if (stored !== null) return languageOrDefault(stored);
  if (typeof document !== "undefined") {
    try {
      const cookie = document.cookie.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${LANGUAGE_KEY}=`));
      return languageOrDefault(cookie?.split("=")[1]);
    } catch {
      // Restricted browser contexts may deny cookies as well as storage.
      return "en";
    }
  }
  return "en";
}

// Each literal import is a separate async entry. Never import either value
// statically: the provider already receives the initial dictionary via RSC.
const loaders = {
  ar: () => import("./dictionaries/ar").then((module) => module.ar),
  en: () => import("./dictionaries/en").then((module) => module.en),
};

export function loadLanguageSnapshot(lang: Language): Promise<LanguageSnapshot> {
  const cached = snapshots[lang];
  if (cached) return pending[lang] ??= Promise.resolve(cached);
  return pending[lang] ??= loaders[lang]().then((dictionary) => {
    const snapshot = snapshots[lang] ?? { lang, dictionary };
    snapshots[lang] = snapshot;
    return snapshot;
  }).catch((error: unknown) => {
    // A failed chunk request must be retryable on the next selection.
    delete pending[lang];
    throw error;
  });
}

/** The already-loaded copy, if any — lets a render avoid suspending. */
export function peekLanguageSnapshot(lang: Language): LanguageSnapshot | null {
  return snapshots[lang] ?? null;
}

export function seedLanguageSnapshot(snapshot: LanguageSnapshot): void {
  // SSR state belongs to the request's context, never to this browser store.
  if (typeof window === "undefined") return;
  snapshots[snapshot.lang] ??= snapshot;
  active ??= snapshots[snapshot.lang] ?? null;
}

export function getLanguageSnapshot(): LanguageSnapshot | null {
  if (typeof window === "undefined") return null;
  return snapshots[readLanguage()] ?? active;
}

/** Non-React callers share the provider's loaded copy, or load on demand. */
export async function getActiveDictionary(): Promise<Dictionary> {
  return (getLanguageSnapshot() ?? await loadLanguageSnapshot(readLanguage())).dictionary;
}

function notify(): void {
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

export async function setLanguage(lang: Language): Promise<void> {
  const request = ++selection;
  try {
    // Cached switches stay synchronous; cold switches keep the current copy
    // and direction until the entire target dictionary has arrived.
    const next = snapshots[lang] ?? await loadLanguageSnapshot(lang);
    if (request !== selection || typeof window === "undefined") return;
    active = next;
    safeStorage.setItem(LANGUAGE_KEY, lang);
    try {
      document.cookie = `${LANGUAGE_KEY}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // Persistence is best effort, just like safeStorage; still notify React.
    }
    notify();
  } catch (error) {
    // Keep the working language on a chunk/network failure, including callers
    // such as account preference hydration that intentionally do not await us.
    console.warn("Unable to load tenant language", error);
  }
}

export function hydrateAccountLanguage(value: string | null): void {
  if (safeStorage.getItem(LANGUAGE_KEY) !== null) return;
  if (value === "ar" || value === "en") void setLanguage(value);
}

function syncStoredLanguage(): void {
  const lang = readLanguage();
  if (safeStorage.getItem(LANGUAGE_KEY) !== null) {
    void setLanguage(lang);
  } else if (!getLanguageSnapshot()) {
    void loadLanguageSnapshot(lang).then(() => notify()).catch((error: unknown) => {
      console.warn("Unable to load tenant language", error);
    });
  }
}

const listeners = new Set<() => void>();
function onStorage(event: StorageEvent): void {
  if (event.key === LANGUAGE_KEY || event.key === null) syncStoredLanguage();
}
function onChange(): void {
  for (const listener of listeners) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
    syncStoredLanguage();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
    }
  };
}
