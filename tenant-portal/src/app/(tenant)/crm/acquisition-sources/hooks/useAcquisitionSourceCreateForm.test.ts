// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useAcquisitionSourceCreateForm } from "./useAcquisitionSourceCreateForm";

const language = vi.hoisted(() => ({ value: "en" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { en, ar }[language.value] }) }));
afterEach(() => { cleanup(); language.value = "en"; });

describe("source create form", () => {
  it.each(["ar", "en"] as const)("validates each required field in %s without sending invalid input", async (lang) => {
    language.value = lang;
    const send = vi.fn();
    const { result } = renderHook(() => useAcquisitionSourceCreateForm(send, vi.fn()));
    await act(async () => { await result.current.submit(); });
    expect(result.current.errors.nameAr).toBe({ ar, en }[lang].crmAcquisitionSources.arabicRequired);
    expect(result.current.errors.nameEn).toBe({ ar, en }[lang].crmAcquisitionSources.englishRequired);
    expect(send).not.toHaveBeenCalled();
  });

  it("retains the draft after a rejected save and clears it only after confirmed success", async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useAcquisitionSourceCreateForm(send, vi.fn()));
    const draft = { nameAr: "إحالة", nameEn: "Referral" };
    act(() => result.current.setDraft(draft));
    await act(async () => { await result.current.submit(); });
    expect(result.current.draft).toEqual(draft);
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(result.current.draft).toEqual({ nameAr: "", nameEn: "" });
  });
});
