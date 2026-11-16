// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { can } from "@/lib/auth/permission-scope";
import { useQuotationTemplateLibrary } from "./useQuotationTemplateLibrary";

const authority = { identity: "test-actor-session", isCurrent: () => true };
const api = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn() }));
vi.mock("../quotation-template-library", () => ({ fetchQuotationTemplates: api.list, previewQuotationTemplate: api.preview }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error instanceof Error ? { status: 0 } : error }));

function readProfile(branchId: string) {
  return {
    permissions: ["templates.read"],
    permissionScopes: { "templates.read": { tenantWide: false, companyIds: [], branchIds: [branchId] } },
    accessibleBranchCompanies: [{ companyId: "company", branchId }],
  };
}

describe("template gallery authoritative denial", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("preserves the real policy refusal and blocks retry/search/locale from repeating a forbidden read", async () => {
    const error = { status: 403, code: "ACCESS_POLICY_BLOCKED", correlationId: "support-reference" };
    api.list.mockRejectedValueOnce(error);
    const { result, rerender } = renderHook(({ locale }) => useQuotationTemplateLibrary(authority, "company", "branch", locale, "Africa/Cairo", true), { initialProps: { locale: "ar-EG" } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error).toEqual(error);
    expect(result.current.items).toEqual([]);
    act(() => { result.current.retry(); result.current.more(); result.current.setSearch("Modern"); });
    rerender({ locale: "en-US" });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(result.current.error?.status).toBe(403);
  });

  it("reads again after the same branch read grant is removed and restored", async () => {
    const target = { companyId: "company", branchId: "branch" };
    const granted = readProfile("branch");
    const denied = readProfile("other-branch");
    const choice = { templateId: "template", templateVersionId: "version", canPreview: true };
    api.list.mockRejectedValueOnce({ status: 403, code: "ACCESS_POLICY_BLOCKED" })
      .mockResolvedValueOnce({ items: [choice], nextCursor: null });
    const { result, rerender } = renderHook(({ user }) => useQuotationTemplateLibrary(authority,
      target.companyId, target.branchId, "en-US", "Africa/Cairo", can(user, "templates.read", target),
    ), { initialProps: { user: granted } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error?.status).toBe(403);

    rerender({ user: denied });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current).toMatchObject({ error: null, items: [], cursor: null });
    expect(api.list).toHaveBeenCalledTimes(1);

    rerender({ user: granted });
    expect(result.current.items).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenLastCalledWith("company", "branch", "en-US", "", undefined, expect.any(AbortSignal), expect.any(Function));
    expect(result.current).toMatchObject({ error: null, items: [choice] });
  });

  it("retires the search, page and pending pagination when the quotation revision changes", async () => {
    const oldChoice = { templateId: "old-template", templateVersionId: "old-version", canPreview: true };
    const currentChoice = { templateId: "current-template", templateVersionId: "current-version", canPreview: true };
    const oldPage = Promise.withResolvers<{ items: typeof oldChoice[]; nextCursor: string | null }>();
    api.list.mockResolvedValueOnce({ items: [oldChoice], nextCursor: "old-cursor" })
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce({ items: [currentChoice], nextCursor: null });
    const { result, rerender } = renderHook(({ quotationRevisionKey }) => {
      const context = { ...authority, quotationRevisionKey };
      return useQuotationTemplateLibrary(context, "company", "branch", "en-US", "Africa/Cairo", true);
    }, { initialProps: { quotationRevisionKey: "quotation-a:revision-1" } });

    act(() => { result.current.setSearch("Prior search"); result.current.setOpen(true); });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const retired = result.current;
    expect(retired).toMatchObject({ items: [oldChoice], cursor: "old-cursor", search: "Prior search" });
    act(() => retired.more());
    const oldPageSignal = api.list.mock.calls[1][5] as AbortSignal;

    rerender({ quotationRevisionKey: "quotation-b:revision-1" });
    expect(result.current).toMatchObject({ items: [], cursor: null, search: "" });
    expect(oldPageSignal.aborted).toBe(true);
    await act(async () => {
      retired.more();
      oldPage.resolve({ items: [oldChoice], nextCursor: "retired-cursor" });
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(api.list).toHaveBeenCalledTimes(3);
    expect(api.list).toHaveBeenLastCalledWith("company", "branch", "en-US", "", undefined, expect.any(AbortSignal), expect.any(Function));
    expect(result.current).toMatchObject({ items: [currentChoice], cursor: null, search: "" });
  });

  it("keeps a branch denial authoritative across quotations for the same session", async () => {
    const denial = { status: 403, code: "ACCESS_POLICY_BLOCKED" };
    api.list.mockRejectedValueOnce(denial);
    const { result, rerender } = renderHook(({ quotationRevisionKey }) => {
      const context = { ...authority, quotationRevisionKey };
      return useQuotationTemplateLibrary(context, "company", "branch", "ar-EG", "Africa/Cairo", true);
    }, { initialProps: { quotationRevisionKey: "quotation-a:revision-1" } });

    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error).toEqual(denial);
    rerender({ quotationRevisionKey: "quotation-b:revision-1" });
    act(() => { result.current.retry(); result.current.setSearch("Other template"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error).toEqual(denial);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it("keeps a new server denial authoritative after the same branch grant returns", async () => {
    const target = { companyId: "company", branchId: "branch" };
    const granted = readProfile("branch");
    const denied = readProfile("other-branch");
    const firstDenial = { status: 403, code: "ACCESS_POLICY_BLOCKED", correlationId: "first-refusal" };
    const currentDenial = { ...firstDenial, correlationId: "current-refusal" };
    api.list.mockRejectedValueOnce(firstDenial).mockRejectedValueOnce(currentDenial);
    const { result, rerender } = renderHook(({ user }) => useQuotationTemplateLibrary(authority,
      target.companyId, target.branchId, "en-US", "Africa/Cairo", can(user, "templates.read", target),
    ), { initialProps: { user: granted } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error).toEqual(firstDenial);

    rerender({ user: denied });
    rerender({ user: granted });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current).toMatchObject({ error: currentDenial, items: [], cursor: null });
    act(() => { result.current.retry(); result.current.more(); result.current.setSearch("Another template"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.error).toEqual(currentDenial);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("rejects callbacks from before a same-branch refusal and admits only the newly listed version after regrant", async () => {
    const target = { companyId: "company", branchId: "branch" };
    const granted = readProfile("branch");
    const denied = readProfile("other-branch");
    const oldChoice = { templateId: "template", templateVersionId: "old-version", canPreview: true };
    const newChoice = { ...oldChoice, templateVersionId: "new-version" };
    const nextChoice = { ...oldChoice, templateVersionId: "next-version" };
    const oldSample = Promise.withResolvers<string>();
    const refusal = { status: 403, code: "ACCESS_POLICY_BLOCKED" };
    api.list
      .mockResolvedValueOnce({ items: [oldChoice], nextCursor: "old-next" })
      .mockRejectedValueOnce(refusal)
      .mockResolvedValueOnce({ items: [newChoice], nextCursor: "new-next" })
      .mockResolvedValueOnce({ items: [nextChoice], nextCursor: null });
    api.preview.mockReturnValueOnce(oldSample.promise).mockResolvedValue("<p>New sample</p>");
    const { result, rerender } = renderHook(({ user }) => useQuotationTemplateLibrary(authority,
      target.companyId, target.branchId, "en-US", "Africa/Cairo", can(user, "templates.read", target),
    ), { initialProps: { user: granted } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const retired = result.current;
    const retiredChoice = retired.items[0]!;
    act(() => { void retired.preview(retiredChoice); });
    await act(async () => { retired.more(); });
    expect(result.current).toMatchObject({ error: refusal, items: [], cursor: null });

    rerender({ user: denied });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(api.list).toHaveBeenCalledTimes(2);
    rerender({ user: granted });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current).toMatchObject({ error: null, items: [newChoice], cursor: "new-next" });
    const admitted = result.current;

    await act(async () => {
      retired.retry();
      retired.more();
      await retired.preview(retiredChoice);
      await admitted.preview(retiredChoice);
      oldSample.resolve("<p>Retired sample</p>");
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(api.list.mock.calls.map((call) => call[4])).toEqual([undefined, "old-next", undefined]);
    expect(api.preview.mock.calls.map(([choice]) => choice.templateVersionId)).toEqual(["old-version"]);
    expect(result.current).toMatchObject({ sample: null, sampleLoading: false });

    await act(async () => {
      await admitted.preview(admitted.items[0]!);
      admitted.more();
    });
    expect(api.list.mock.calls.map((call) => call[4])).toEqual([undefined, "old-next", undefined, "new-next"]);
    expect(api.preview.mock.calls.map(([choice]) => choice.templateVersionId)).toEqual(["old-version", "new-version"]);
    expect(result.current).toMatchObject({ items: [newChoice, nextChoice], cursor: null, sample: "<p>New sample</p>" });
  });

  it("keeps a refusal through ineligibility, an unresolved profile, and a denied visit to another branch", async () => {
    const user = readProfile("branch");
    const error = { status: 403, code: "ACCESS_POLICY_BLOCKED" };
    api.list.mockRejectedValueOnce(error);
    const { result, rerender } = renderHook(({ enabled, branchId, profileReady }) => {
      const target = { companyId: "company", branchId };
      return useQuotationTemplateLibrary(authority,
        target.companyId, branchId, "en-US", "Africa/Cairo", profileReady ? can(user, "templates.read", target) : null, enabled,
      );
    }, { initialProps: { enabled: true, branchId: "branch", profileReady: true } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error).toEqual(error);

    rerender({ enabled: false, branchId: "branch", profileReady: true });
    expect(result.current.error).toBeNull();
    rerender({ enabled: true, branchId: "branch", profileReady: true });
    expect(result.current.error).toEqual(error);
    rerender({ enabled: true, branchId: "branch", profileReady: false });
    expect(result.current.error).toBeNull();
    rerender({ enabled: true, branchId: "other-branch", profileReady: true });
    expect(result.current.error).toBeNull();
    rerender({ enabled: true, branchId: "branch", profileReady: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.error).toEqual(error);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it("allows transient service errors to retry, and allows a different branch to make its own authorized read", async () => {
    api.list.mockRejectedValueOnce({ status: 503, code: "SERVICE_UNAVAILABLE" }).mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValueOnce({ items: [], nextCursor: null });
    const { result, rerender } = renderHook(({ branch }) => useQuotationTemplateLibrary(authority, "company", branch, "ar-EG", "Africa/Cairo", true), { initialProps: { branch: "first" } });
    act(() => result.current.setOpen(true)); await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.error?.status).toBe(503);
    act(() => result.current.retry()); await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current).toMatchObject({ items: [], cursor: null, error: null, loading: false });
    expect(api.list).toHaveBeenCalledTimes(2);
    rerender({ branch: "second" }); await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it("hides previously loaded template choices after an authoritative pagination refusal", async () => {
    api.list.mockResolvedValueOnce({ items: [{ templateVersionId: "version", name: "Existing" }], nextCursor: "next" }).mockRejectedValueOnce({ status: 403, code: "FORBIDDEN" });
    const { result } = renderHook(() => useQuotationTemplateLibrary(authority, "company", "branch", "ar-EG", "Africa/Cairo", true));
    act(() => result.current.setOpen(true)); await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current.items).toHaveLength(1);
    await act(async () => { result.current.more(); });
    expect(result.current.error?.status).toBe(403); expect(result.current.items).toEqual([]); expect(result.current.cursor).toBeNull();
  });

  it("drops cached choices and previews when read permission is removed", async () => {
    api.list.mockResolvedValue({
      items: [{ templateId: "template", templateVersionId: "version", canPreview: true }], nextCursor: "next",
    });
    api.preview.mockResolvedValue("<p>Authorized sample</p>");
    const { result, rerender } = renderHook(({ canRead }) => useQuotationTemplateLibrary(authority,
      "company", "branch", "en-US", "Africa/Cairo", canRead,
    ), { initialProps: { canRead: true } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const authorized = result.current;
    const choice = authorized.items[0]!;
    await act(async () => { await authorized.preview(choice); });
    expect(result.current.sample).toBe("<p>Authorized sample</p>");

    rerender({ canRead: false });
    expect(result.current).toMatchObject({ items: [], cursor: null, error: null, sample: null, loading: false, sampleLoading: false });
    await act(async () => {
      result.current.retry();
      result.current.more();
      await result.current.preview(choice);
      authorized.retry();
      authorized.more();
      await authorized.preview(choice);
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenCalledTimes(1);

    rerender({ canRead: true });
    expect(result.current).toMatchObject({ items: [], cursor: null, sample: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual([choice]);
  });

  it("rejects retired callbacks and late responses after returning to the same branch", async () => {
    const oldChoice = { templateId: "old-template", templateVersionId: "old-version", canPreview: true };
    const newChoice = { templateId: "new-template", templateVersionId: "new-version", canPreview: true };
    const pagination = Promise.withResolvers<{ items: typeof oldChoice[]; nextCursor: null }>();
    const sample = Promise.withResolvers<string>();
    api.list.mockResolvedValueOnce({ items: [oldChoice], nextCursor: "old-next" })
      .mockReturnValueOnce(pagination.promise)
      .mockResolvedValueOnce({ items: [newChoice], nextCursor: "new-next" });
    api.preview.mockReturnValueOnce(sample.promise).mockResolvedValueOnce("<p>Current sample</p>");
    const { result, rerender } = renderHook(({ branch }) => useQuotationTemplateLibrary(authority,
      "company", branch, "en-US", "Africa/Cairo", true,
    ), { initialProps: { branch: "first" } });
    act(() => result.current.setOpen(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    const retired = result.current;
    act(() => { retired.more(); void retired.preview(retired.items[0]!); });
    const signal = api.list.mock.lastCall?.[5] as AbortSignal;
    expect(signal.aborted).toBe(false);

    rerender({ branch: "second" });
    expect(signal.aborted).toBe(true);
    rerender({ branch: "first" });
    expect(result.current).toMatchObject({ items: [], cursor: null, sampleLoading: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await act(async () => {
      pagination.resolve({ items: [oldChoice], nextCursor: null });
      sample.resolve("<p>Retired sample</p>");
    });
    expect(result.current).toMatchObject({ items: [newChoice], cursor: "new-next", sample: null, sampleLoading: false });
    await act(async () => {
      retired.retry();
      retired.more();
      await retired.preview(retired.items[0]!);
      await result.current.preview(retired.items[0]!);
      await result.current.preview(result.current.items[0]!);
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(api.list).toHaveBeenCalledTimes(3);
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ items: [newChoice], cursor: "new-next", sample: "<p>Current sample</p>", sampleLoading: false });
  });
});
