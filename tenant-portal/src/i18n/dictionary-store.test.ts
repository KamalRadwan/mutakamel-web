// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.cookie = "tenant_lang=; Path=/; Max-Age=0";
});
afterEach(() => {
  vi.doUnmock("./dictionaries/ar");
  vi.doUnmock("./dictionaries/en");
  vi.restoreAllMocks();
});

function delayEnglish() {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  const load = vi.fn(async () => { await ready; return { en }; });
  vi.doMock("./dictionaries/en", load);
  return { resolve, load };
}

describe("dictionary loading", () => {
  it("uses the server copy without importing either dictionary", async () => {
    const loadAr = vi.fn(() => ({ ar }));
    const loadEn = vi.fn(() => ({ en }));
    vi.doMock("./dictionaries/ar", loadAr);
    vi.doMock("./dictionaries/en", loadEn);
    const store = await import("./dictionary-store");
    document.cookie = "tenant_lang=en; Path=/";
    store.seedLanguageSnapshot({ lang: "en", dictionary: en });
    expect(await store.getActiveDictionary()).toBe(en);
    expect(store.getLanguageSnapshot()?.lang).toBe("en");
    expect(loadAr).not.toHaveBeenCalled();
    expect(loadEn).not.toHaveBeenCalled();
  });

  it("keeps language, copy and persistence unchanged until the new chunk loads", async () => {
    const delayed = delayEnglish();
    const store = await import("./dictionary-store");
    store.seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    const switching = store.setLanguage("en");
    expect(store.getLanguageSnapshot()).toEqual({ lang: "ar", dictionary: ar });
    expect(await store.getActiveDictionary()).toBe(ar);
    expect(localStorage.getItem("tenant_lang")).toBeNull();
    delayed.resolve();
    await switching;
    expect(await store.getActiveDictionary()).toBe(en);
    expect(store.getLanguageSnapshot()?.lang).toBe("en");
    expect(localStorage.getItem("tenant_lang")).toBe("en");
    expect(document.cookie).toContain("tenant_lang=en");
    expect(delayed.load).toHaveBeenCalledOnce();
  });

  it("does not let a late download override a newer selection", async () => {
    const delayed = delayEnglish();
    const store = await import("./dictionary-store");
    store.seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    const first = store.setLanguage("en");
    await store.setLanguage("ar");
    delayed.resolve();
    await first;
    expect(await store.getActiveDictionary()).toBe(ar);
    expect(localStorage.getItem("tenant_lang")).toBe("ar");
  });

  it("keeps the working language on failure and allows a later retry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.doMock("./dictionaries/en", () => { throw new Error("offline"); });
    const store = await import("./dictionary-store");
    store.seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    await store.setLanguage("en");
    expect(await store.getActiveDictionary()).toBe(ar);
    expect(localStorage.getItem("tenant_lang")).toBeNull();
    vi.doMock("./dictionaries/en", () => ({ en }));
    await store.setLanguage("en");
    expect(await store.getActiveDictionary()).toBe(en);
  });

  it("loads only the selected fallback for non-React callers", async () => {
    const loadAr = vi.fn(() => ({ ar }));
    const loadEn = vi.fn(() => ({ en }));
    vi.doMock("./dictionaries/ar", loadAr);
    vi.doMock("./dictionaries/en", loadEn);
    localStorage.setItem("tenant_lang", "en");
    const store = await import("./dictionary-store");
    const [first, second] = await Promise.all([store.getActiveDictionary(), store.getActiveDictionary()]);
    expect(first).toBe(en);
    expect(second).toBe(en);
    expect(loadEn).toHaveBeenCalledOnce();
    expect(loadAr).not.toHaveBeenCalled();
  });

  it("migrates a stored preference and follows cross-tab changes after loading", async () => {
    const delayed = delayEnglish();
    const store = await import("./dictionary-store");
    store.seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    localStorage.setItem("tenant_lang", "ar");
    const listener = vi.fn();
    const unsubscribe = store.subscribeLanguage(listener);
    expect(document.cookie).toContain("tenant_lang=ar");
    listener.mockClear();
    localStorage.setItem("tenant_lang", "en");
    window.dispatchEvent(new StorageEvent("storage", { key: "tenant_lang", newValue: "en" }));
    expect(store.getLanguageSnapshot()?.lang).toBe("ar");
    expect(listener).not.toHaveBeenCalled();
    delayed.resolve();
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(store.getLanguageSnapshot()?.lang).toBe("en");
    unsubscribe();
  });

  it("does not persist a default that would block account preference hydration", async () => {
    const store = await import("./dictionary-store");
    store.seedLanguageSnapshot({ lang: "ar", dictionary: ar });
    const unsubscribe = store.subscribeLanguage(() => {});
    expect(localStorage.getItem("tenant_lang")).toBeNull();
    store.hydrateAccountLanguage("en");
    await vi.waitFor(() => expect(store.getLanguageSnapshot()?.lang).toBe("en"));
    store.hydrateAccountLanguage("ar");
    expect(store.getLanguageSnapshot()?.lang).toBe("en");
    unsubscribe();
  });
});
