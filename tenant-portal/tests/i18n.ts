import { beforeEach } from "vitest";
import { loadLanguageSnapshot } from "@/i18n/dictionary-store";

// Component tests render without the server layout. Supply its already-loaded
// dictionary fixture so existing synchronous assertions do not test downloads.
// Cold loading and failures are covered with isolated modules in i18n tests.
await Promise.all([loadLanguageSnapshot("ar"), loadLanguageSnapshot("en")]);

beforeEach(() => {
  if (typeof document !== "undefined") {
    document.cookie = "tenant_lang=; Path=/; Max-Age=0";
  }
});
