// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { InquiryReviewAction } from "./InquiryReviewAction";
import { inquiryPath, parseInquiryContext, type InquiryCommand, type InquirySelection } from "./contract";
import { useInquiryReview } from "./useInquiryReview";

const view = vi.hoisted(() => ({ user: null as TenantUserProfile | null, lang: "en" as "en" | "ar" }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: view.user, realtimeAuthGeneration: "review-session" }) }));
vi.mock("@/hooks/useTenantBranchLabels", () => ({
  useTenantBranchLabels: () => new Map([[source.branchId, "Cairo"]]),
  useTenantCompanyLabels: () => new Map(),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => view.lang === "ar" ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" },
  useLanguage: () => view.lang,
}));
vi.mock("@/i18n/useLanguage", () => ({
  useLanguage: () => view.lang, useDictionary: () => view.lang === "ar" ? ar : en,
  useDirection: () => view.lang === "ar" ? "rtl" : "ltr",
}));
vi.mock("@/lib/api/axiosClient", async actual => ({
  ...await actual<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn(), post: vi.fn() },
}));

const uuid = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const actorId = uuid(1);
const source: InquirySelection = { id: uuid(2), branchId: uuid(3), name: "Amina Hassan" };
const reference: InquirySelection = { id: uuid(4), branchId: uuid(5), name: "Amina Hassan" };
const establishedIdentity = uuid(6);
const now = "2026-11-12T09:40:00.000Z";
const ok = (data: unknown) => ({ status: 200, statusText: "OK", headers: new Headers(), data });
const get = vi.mocked(axiosClient.get);
const post = vi.mocked(axiosClient.post);
const decision = (selection: InquirySelection, options: Partial<{
  id: string; reason: string; identityId: string; requestedIdentityId: string | null; previousIdentityId: string | null;
  revision: number; sourceRevision: number;
}> = {}) => ({
  id: uuid(7), leadId: selection.id, actorUserId: actorId, identityId: establishedIdentity, requestedIdentityId: null,
  previousIdentityId: null, reason: "VERIFIED_DISTINCT", revision: 1, sourceRevision: 1, decidedAt: now, ...options,
});
const context = (selection: InquirySelection, current: ReturnType<typeof decision> | null = null) => ({
  leadId: selection.id, branchId: selection.branchId, leadName: selection.name, profileType: "INDIVIDUAL",
  state: current ? "REVIEWED" : "UNREVIEWED", coverageStartedAt: now, sourceRevision: 1, current,
  history: current ? [current] : [], hasMore: false, nextBeforeRevision: null,
});
const receipt = (command: InquiryCommand, replayed = false) => ({
  decision: decision(source, { id: command.requestId, reason: command.reason,
    identityId: command.targetIdentityId ?? establishedIdentity, requestedIdentityId: command.targetIdentityId ?? null }),
  replayed, requiresContextReload: true,
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok(context(source)));
  post.mockReset();
  view.lang = "en";
  view.user = { id: actorId, isTenantOwner: true, accessibleBranches: [source.branchId],
    permissions: ["crm.inquiry_identities.manage"] } as unknown as TenantUserProfile;
});
afterEach(cleanup);

async function sourceReview() {
  const hook = renderHook(() => useInquiryReview(actorId, true));
  act(() => hook.result.current.chooseSource(source));
  await waitFor(() => expect(hook.result.current.sourceRead.context?.state).toBe("UNREVIEWED"));
  return hook;
}

describe("inquiry identity review", () => {
  it("admits unobserved creation with a source change but refuses a mismatched branch or journal page", () => {
    expect(parseInquiryContext({ ...context(source), state: "HISTORY_UNAVAILABLE" }, source).state).toBe("HISTORY_UNAVAILABLE");
    expect(() => parseInquiryContext(context(reference), { ...reference, branchId: source.branchId })).toThrow();
    expect(() => parseInquiryContext({ ...context(source, decision(source)), history: [] }, source)).toThrow();
    expect(() => parseInquiryContext(context(source, decision(source)), source, 1)).toThrow();
  });

  it("sends one distinct-identity command and displays current context only after a fresh GET", async () => {
    const { result } = await sourceReview();
    act(() => result.current.chooseMode("NEW"));
    post.mockImplementationOnce(async (_url, input) => {
      const response = receipt(input as InquiryCommand);
      get.mockResolvedValue(ok(context(source, response.decision)));
      return ok(response);
    });
    await act(async () => { await Promise.all([result.current.save(), result.current.save()]); });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(inquiryPath(source.id), {
      requestId: expect.any(String), mode: "NEW", expectedRevision: 0, expectedSourceRevision: 1, reason: "VERIFIED_DISTINCT",
    }, expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    await waitFor(() => expect(result.current.sourceRead.context?.state).toBe("REVIEWED"));
    expect(result.current.saved).toBe(true);
    expect(result.current.canSave).toBe(false);
  });

  it("reconciles a lost response with the original command and never treats a historical receipt as current", async () => {
    const { result } = await sourceReview();
    act(() => result.current.chooseMode("NEW"));
    post.mockRejectedValueOnce(new Error("response lost"));
    await act(async () => { await result.current.save(); });
    expect(result.current.pending).toBe(true);
    expect(result.current.canSave).toBe(false);
    post.mockImplementationOnce(async (_url, input) => {
      const replay = receipt(input as InquiryCommand, true);
      const later = decision(source, { id: uuid(8), identityId: uuid(9), revision: 2, previousIdentityId: establishedIdentity, reason: "CORRECTION" });
      get.mockResolvedValue(ok({ ...context(source, later), history: [later, replay.decision] }));
      return ok(replay);
    });
    await act(async () => { await result.current.reconcile(); });
    expect(post.mock.calls[0]?.[1]).toEqual(post.mock.calls[1]?.[1]);
    await waitFor(() => expect(result.current.sourceRead.context?.current?.revision).toBe(2));
    expect(result.current.pending).toBe(false);
  });

  it("rejects a reference that changed identity before linking across branches", async () => {
    const { result } = await sourceReview();
    get.mockImplementation(async path => ok(path === inquiryPath(reference.id)
      ? context(reference, decision(reference)) : context(source)));
    act(() => result.current.chooseMode("LINK"));
    act(() => result.current.chooseReference(reference));
    await waitFor(() => expect(result.current.canSave).toBe(true));
    get.mockImplementation(async path => ok(path === inquiryPath(reference.id)
      ? context(reference, decision(reference, { identityId: uuid(9) })) : context(source)));
    await act(async () => { await result.current.save(); });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.error?.code).toBe("REFERENCE_CHANGED");
  });

  it("reloads an authoritative conflict and keeps unknown history unreviewable", async () => {
    const { result } = await sourceReview();
    act(() => result.current.chooseMode("NEW"));
    post.mockImplementationOnce(async () => {
      get.mockResolvedValue(ok({ ...context(source), state: "HISTORY_UNAVAILABLE" }));
      throw new TenantApiClientError("conflict", {
        status: 409, statusText: "Conflict", headers: new Headers(), data: { code: "CRM_INQUIRY_DECISION_CONFLICT" },
      });
    });
    await act(async () => { await result.current.save(); });
    await waitFor(() => expect(result.current.sourceRead.context?.state).toBe("HISTORY_UNAVAILABLE"));
    expect(result.current.pending).toBe(false);
    expect(result.current.canSave).toBe(false);
  });

  it("offers the Arabic dialog to owners and removes it when management permission is unavailable", async () => {
    view.lang = "ar";
    const mounted = render(<InquiryReviewAction />);
    fireEvent.click(screen.getByRole("button", { name: ar.crmDashboardReports.inquiryReview.action }));
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("rtl");
    expect(get).not.toHaveBeenCalled();
    view.user = { ...view.user!, isTenantOwner: false, permissions: ["crm.inquiry_identities.manage"],
      permissionScopes: { "crm.inquiry_identities.manage": { tenantWide: false, branchIds: [source.branchId], companyIds: [] } } };
    mounted.rerender(<InquiryReviewAction />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: ar.crmDashboardReports.inquiryReview.action })).toBeNull();
  });

  it("waits for the management permission to be provisioned before offering the action to a tenant owner", () => {
    view.user = { ...view.user!, permissions: [] };
    render(<InquiryReviewAction />);
    expect(screen.queryByRole("button", { name: en.crmDashboardReports.inquiryReview.action })).toBeNull();
  });

  it("selects a named inquiry from the current branch and reaches the command from Reports Explorer's action", async () => {
    get.mockImplementation(async path => String(path).includes("/leads?")
      ? ok({ items: [{ id: source.id, partyId: uuid(10), branchId: source.branchId, stageId: uuid(11),
        displayName: source.name, leadProfileType: "INDIVIDUAL", createdAt: now }],
        total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false })
      : ok(context(source)));
    post.mockImplementation(async (_path, input) => {
      const response = receipt(input as InquiryCommand);
      get.mockResolvedValue(ok(context(source, response.decision)));
      return ok(response);
    });
    const copy = en.crmDashboardReports.inquiryReview;
    render(<InquiryReviewAction />);
    fireEvent.click(screen.getByRole("button", { name: copy.action }));
    fireEvent.click(screen.getByRole("button", { name: copy.source }));
    fireEvent.click(await screen.findByRole("option", { name: /Amina Hassan/u }));
    expect(await screen.findByText(copy.states.UNREVIEWED)).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringContaining(`branchId=${source.branchId}`), expect.any(Object));
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(copy.distinct, "u") }));
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    expect(await screen.findByText(copy.states.REVIEWED)).toBeTruthy();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
