// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../../../../i18n/dictionaries/en";
import { isUUIDv7 } from "@/lib/utils/uuid";
import type { FeatureView } from "../types";
const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../api/applications.api", () => ({ applicationsApi: { updateCoreBaseFeaturePolicy: update } }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
import { useTemplateDesignerBasePolicy } from "./useTemplateDesignerBasePolicy";
const applicationId = "01a0edef-f984-72d6-a207-97ccc6131756";
const feature: FeatureView = {
  id: "01a0edef-fd8f-70bf-892d-7e53517c0ae2", moduleId: applicationId, key: "core.template_designer",
  baseIncluded: false, baseGrantRevision: 1, name: "Template Designer", rank: 1, isActive: true,
  description: null, createdAt: "", updatedAt: "", deletedAt: null,
};
const receipt = { id: feature.id, moduleId: applicationId, key: feature.key, baseIncluded: true, baseGrantRevision: 2 };
const failure = (httpStatus: number, errorCode: string) => ({ isNormalized: true, httpStatus, errorCode, message: "server", correlationId: "safe-correlation" });
beforeEach(() => { update.mockReset().mockResolvedValue(receipt); });
afterEach(cleanup);
function setup(initial = feature, allowed = true) {
  const onRefresh = vi.fn().mockResolvedValue({ features: [initial] });
  const hook = renderHook(({ row, canMutate }) => useTemplateDesignerBasePolicy({ applicationId, feature: row, canMutate, onRefresh }),
    { initialProps: { row: initial, canMutate: allowed } });
  return { ...hook, onRefresh };
}

describe("Template Designer base policy intent", () => {
  it("captures the displayed revision and changes policy separately from commercial metadata", async () => {
    const { result, onRefresh } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    expect(result.current.intent?.policy.baseGrantRevision).toBe(1);
    await act(() => result.current.submit());
    expect(update).toHaveBeenCalledWith(feature.id, { basePolicy: { expectedBaseGrantRevision: 1, included: true } }, expect.any(String));
    expect(isUUIDv7(update.mock.calls[0][2])).toBe(true);
    expect(result.current.status).toBe(en.applications.baseFeaturePolicy.saved);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it.each([
    { row: feature, allowed: false },
    { row: { ...feature, baseGrantRevision: undefined }, allowed: true },
    { row: { ...feature, moduleId: "01a0ffff-f984-72d6-a207-97ccc6131756" }, allowed: true },
    { row: { ...feature, key: "crm.leads" }, allowed: true },
  ])("does not open or submit without valid policy identity and permission", async ({ row, allowed }) => {
    const { result } = setup(row, allowed);
    await act(async () => {});
    act(() => result.current.requestChange());
    await act(() => result.current.submit());
    expect(result.current.isOpen).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rechecks permission after confirmation opens", async () => {
    const { result, rerender } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    rerender({ row: feature, canMutate: false });
    await act(() => result.current.submit());
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a confirmation whose visible policy changed before submission", async () => {
    const { result, rerender } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    rerender({ row: { ...feature, baseIncluded: true, baseGrantRevision: 2 }, canMutate: true });
    await act(() => result.current.submit());
    expect(update).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe(en.applications.baseFeaturePolicy.stale);
    expect(result.current.needsRefresh).toBe(true);
  });

  it.each([[409, "CORE_BASE_FEATURE_REVISION_STALE", "stale"], [403, "FORBIDDEN", "forbidden"], [409, "CORE_BASE_FEATURE_NOT_ELIGIBLE", "notEligible"]] as const)(
    "keeps %s/%s actionable in the open confirmation and requires refresh", async (status, code, message) => {
      update.mockRejectedValue(failure(status, code));
      const { result, onRefresh } = setup();
      await act(async () => {});
      act(() => result.current.requestChange());
      await act(() => result.current.submit());
      expect(result.current.isOpen).toBe(true);
      expect(result.current.errorMessage).toBe(en.applications.baseFeaturePolicy[message]);
      expect(result.current.failure?.correlationId).toBe("safe-correlation");
      expect(result.current.needsRefresh).toBe(true);
      await act(() => result.current.submit());
      expect(update).toHaveBeenCalledOnce();
      expect(onRefresh).toHaveBeenCalledOnce();
    },
  );

  it("preserves the exact UUIDv7 key and body after an ambiguous outcome and same-revision refresh", async () => {
    update.mockRejectedValueOnce(failure(503, "UNKNOWN_ERROR")).mockResolvedValueOnce(receipt);
    const { result } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    await act(() => result.current.submit());
    await act(() => result.current.refresh());
    expect(result.current.intent).not.toBeNull();
    await act(() => result.current.submit());
    expect(update.mock.calls[1]).toEqual(update.mock.calls[0]);
  });

  it("discards a canceled draft but retains the exact command after an ambiguous submission", async () => {
    update.mockRejectedValueOnce(failure(503, "UNKNOWN_ERROR")).mockResolvedValueOnce(receipt);
    const { result } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    const canceledKey = result.current.intent?.key;
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.intent).toBeNull();
    expect(update).not.toHaveBeenCalled();

    act(() => result.current.requestChange());
    const submittedKey = result.current.intent?.key;
    expect(submittedKey).not.toBe(canceledKey);
    await act(() => result.current.submit());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.intent?.key).toBe(submittedKey);
    expect(result.current.errorMessage).toBe(en.applications.baseFeaturePolicy.unknown);

    act(() => result.current.requestChange());
    await act(() => result.current.submit());
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]).toEqual(update.mock.calls[0]);
  });

  it("does not duplicate a rapid submission", async () => {
    let resolve!: (value: unknown) => void;
    update.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    let pending!: Promise<void>;
    act(() => { pending = result.current.submit(); void result.current.submit(); });
    expect(update).toHaveBeenCalledOnce();
    await act(async () => { resolve(receipt); await pending; });
  });

  it("keeps a new context's pending submission locked when the old context's refresh completes", async () => {
    const applicationB = "01a0ffff-f984-72d6-a207-97ccc6131756";
    const featureB = { ...feature, id: "01a0ffff-fd8f-70bf-892d-7e53517c0ae2", moduleId: applicationB };
    const receiptB = { ...receipt, id: featureB.id, moduleId: applicationB };
    let resolveOldRefresh!: (snapshot: { features: FeatureView[] }) => void;
    let resolveNewWrite!: (value: typeof receiptB) => void;
    const refreshA = vi.fn().mockReturnValue(new Promise((resolve) => { resolveOldRefresh = resolve; }));
    const refreshB = vi.fn().mockResolvedValue({ features: [{ ...featureB, ...receiptB }] });
    update.mockResolvedValueOnce(receipt).mockReturnValueOnce(new Promise((resolve) => { resolveNewWrite = resolve; }));
    const { result, rerender } = renderHook(({ application, row, refresh }) => useTemplateDesignerBasePolicy({
      applicationId: application, feature: row, canMutate: true, onRefresh: refresh,
    }), { initialProps: { application: applicationId, row: feature, refresh: refreshA } });
    await act(async () => {});
    act(() => result.current.requestChange());
    let submissionA!: Promise<void>;
    act(() => { submissionA = result.current.submit(); });
    await waitFor(() => expect(refreshA).toHaveBeenCalledOnce());

    rerender({ application: applicationB, row: featureB, refresh: refreshB });
    await act(async () => {});
    act(() => result.current.requestChange());
    let submissionB!: Promise<void>;
    act(() => { submissionB = result.current.submit(); });
    expect(result.current.isSubmitting).toBe(true);
    expect(update).toHaveBeenCalledTimes(2);

    await act(async () => { resolveOldRefresh({ features: [{ ...feature, ...receipt }] }); await submissionA; });
    expect(result.current.isSubmitting).toBe(true);
    await act(() => result.current.submit());
    expect(update).toHaveBeenCalledTimes(2);

    await act(async () => { resolveNewWrite(receiptB); await submissionB; });
    expect(result.current.isSubmitting).toBe(false);
    expect(refreshB).toHaveBeenCalledOnce();
  });

  it("does not accept a valid-looking receipt from another application", async () => {
    update.mockResolvedValue({ ...receipt, moduleId: "01a0ffff-f984-72d6-a207-97ccc6131756" });
    const { result } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    await act(() => result.current.submit());
    expect(result.current.status).not.toBe(en.applications.baseFeaturePolicy.saved);
    expect(result.current.errorMessage).toBe(en.applications.baseFeaturePolicy.unknown);
  });

  it("resolves an old ambiguous intent only after newer authoritative evidence", async () => {
    update.mockRejectedValue(failure(409, "GW.IDEM.IN_FLIGHT"));
    const { result, onRefresh } = setup();
    await act(async () => {});
    act(() => result.current.requestChange());
    await act(() => result.current.submit());
    onRefresh.mockResolvedValue({ features: [{ ...feature, baseIncluded: true, baseGrantRevision: 2 }] });
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.intent).toBeNull());
    expect(result.current.status).toBe(en.applications.baseFeaturePolicy.refreshed);
  });
});
