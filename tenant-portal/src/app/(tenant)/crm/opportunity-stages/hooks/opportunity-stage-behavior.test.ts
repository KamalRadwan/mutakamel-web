// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityStageDefinition } from "../../pipelines/pipeline-contract";
import { useOpportunityStageForm } from "./useOpportunityStageForm";
import { isUncertainStageWrite, useOpportunityStageFeedback } from "./useOpportunityStageFeedback";

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), outcomeFromApi: vi.fn() }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const stage: OpportunityStageDefinition = { id: "01900300-0000-7000-8000-000000000001", nameAr: "مراجعة", nameEn: "Review", flag: "DISCOVERY", category: "IN_PROGRESS", isActive: true, isSystem: false, createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" };

describe("opportunity-stage forms", () => {
  it("retains a rejected draft and blocks empty and overlength names", () => {
    const submit = vi.fn();
    const { result } = renderHook(() => useOpportunityStageForm(null, submit));
    expect(result.current.nameArError).toBeUndefined();
    act(() => result.current.submit());
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.nameArError).toBe(en.crmOpportunityStages.nameRequired);
    act(() => { result.current.changeNameAr("مراجعة"); result.current.changeNameEn("A".repeat(81)); });
    act(() => result.current.submit());
    expect(result.current.form.nameEn).toHaveLength(81);
    expect(result.current.nameEnError).toBe(en.crmOpportunityStages.nameTooLong);
    act(() => result.current.changeNameEn("A".repeat(80)));
    act(() => result.current.submit());
    expect(submit).toHaveBeenCalledOnce();
  });

  it("keeps system semantics protected while allowing names and valid category changes", () => {
    const submit = vi.fn();
    const { result } = renderHook(() => useOpportunityStageForm({ ...stage, isSystem: true }, submit));
    act(() => { result.current.changeFlag("WON"); result.current.changeActive(false); result.current.changeNameEn("Exploration"); result.current.changeCategory("POSITIVE"); });
    expect(result.current.form).toMatchObject({ flag: "DISCOVERY", isActive: true, nameEn: "Exploration", category: "POSITIVE" });
    act(() => result.current.submit());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ nameEn: "Exploration" }));
  });

  it("moves a custom terminal meaning to its required category", () => {
    const { result } = renderHook(() => useOpportunityStageForm(stage, vi.fn()));
    act(() => result.current.changeFlag("NEW"));
    expect(result.current.categories).toEqual(["OPEN"]);
    act(() => result.current.changeFlag("WON"));
    expect(result.current.form.category).toBe("POSITIVE");
    act(() => result.current.changeFlag("LOST"));
    expect(result.current.form.category).toBe("NEGATIVE");
  });

  it("keeps edited names after an in-use refusal and restores the protected values", () => {
    const { result, rerender } = renderHook(({ assigned }) => useOpportunityStageForm(stage, vi.fn(), assigned), { initialProps: { assigned: false } });
    act(() => { result.current.changeNameEn("Commercial review"); result.current.changeFlag("PROPOSAL"); result.current.changeActive(false); });
    rerender({ assigned: true });
    expect(result.current.form).toMatchObject({ nameEn: "Commercial review", flag: "DISCOVERY", isActive: true });
    expect(result.current.semanticsLocked).toBe(true);
    act(() => result.current.changeCategory("POSITIVE"));
    expect(result.current.form.category).toBe("POSITIVE");
  });
});

describe("nonreplayable write recovery", () => {
  it("distinguishes a dependency refusal from an uncertain write", () => {
    expect(isUncertainStageWrite({ status: 409, code: "OPPORTUNITY_STAGE_IN_USE" })).toBe(false);
    expect(isUncertainStageWrite({ status: 429 })).toBe(false);
    expect(isUncertainStageWrite({ status: 0, code: "OPPORTUNITY_STAGE_NAME_INVALID" })).toBe(false);
    expect(isUncertainStageWrite({ status: 0 })).toBe(true);
    expect(isUncertainStageWrite({ status: 503 })).toBe(true);
  });

  it("blocks another write until explicit catalogue reconciliation succeeds", async () => {
    const reload = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useOpportunityStageFeedback(reload));
    act(() => { result.current.report({ ok: false, replayed: false, error: { status: 0 } }, "Saved"); });
    expect(result.current.blocked).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    act(() => result.current.clear());
    expect(result.current.message).toBe(en.crmOpportunityStages.uncertain);
    await act(async () => result.current.reconcile());
    expect(result.current.blocked).toBe(true);
    expect(result.current.message).toBe(en.crmOpportunityStages.reconcileFailed);
    await act(async () => result.current.reconcile());
    expect(result.current.blocked).toBe(false);
    expect(result.current.message).toBe(en.crmOpportunityStages.reconciled);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
