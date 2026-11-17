// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./I18nContext";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Admin language preferences", () => {
  it("defaults to English/LTR without persisting an explicit choice", () => {
    const { result } = renderHook(useI18n, { wrapper: I18nProvider });

    expect(result.current.lang).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("app_lang")).toBeNull();
  });

  it("preserves saved Arabic and follows explicit switches", () => {
    localStorage.setItem("app_lang", "ar");
    const { result } = renderHook(useI18n, { wrapper: I18nProvider });

    expect(result.current.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    act(() => result.current.setLang("en"));
    expect(result.current.lang).toBe("en");
    expect(localStorage.getItem("app_lang")).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
