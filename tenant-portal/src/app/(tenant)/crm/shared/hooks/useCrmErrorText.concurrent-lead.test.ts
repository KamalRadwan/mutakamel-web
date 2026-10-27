// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { useCrmErrorText } from "./useCrmErrorText";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { en, ar }[locale.lang] }) }));

describe("concurrent lead edit feedback", () => {
  it.each(["en", "ar"] as const)("shows the reload instruction in %s for a stale save", (language) => {
    locale.lang = language;
    const { result } = renderHook(() => useCrmErrorText());
    const text = result.current({ status: 409, code: "CRM.LEAD.CONCURRENT_UPDATE" });
    expect(text).toBe({ en, ar }[language].crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"]);
    expect(text).not.toBe({ en, ar }[language].crmShared.errorConflict);
  });
});
