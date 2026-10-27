// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadDetail } from "../../lead-contract";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { useLeadDetailsEdit } from "./useLeadDetailsEdit";
import { en } from "@/i18n/dictionaries/en";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({ warning }),
}));
const ACTOR = "01900100-0000-7000-8000-000000000001";
const OWNER = "01900100-0000-7000-8000-000000000002";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "01900100-0000-7000-8000-000000000001" } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/idempotent-write", () => ({ createWriteAttempt: vi.fn(() => ({})), runIdempotentWrite: vi.fn() }));
const lead = { id: "01900100-0000-7000-8000-000000000003", updatedAt: "2026-10-26T10:00:00.123Z", ownerUserId: OWNER, status: "OPEN", description: "Old note", interestSummary: "Summary", expectedNeed: "Need", acquisitionSourceId: null } as LeadDetail;

function setup(subject = lead, editable = true) {
  const onSaved = vi.fn();
  const onReconcile = vi.fn();
  const hook = renderHook(({ subject, editable }) => useLeadDetailsEdit(subject, editable, onSaved, onReconcile, null), { initialProps: { subject, editable } });
  return { ...hook, onSaved, onReconcile };
}

describe("useLeadDetailsEdit", () => {
  beforeEach(() => vi.clearAllMocks());
  it("never assigns on mount and preserves an existing owner", () => {
    const { result } = setup();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    expect(result.current.form?.ownerUserId).toBe(OWNER);
    expect(result.current.editable).toBe(true);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("suggests current user for an unassigned edit without writing until save", () => {
    const { result } = setup({ ...lead, ownerUserId: null });
    expect(result.current.form?.ownerUserId).toBe(ACTOR);
    act(() => result.current.cancel());
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("saves a changed textarea without sending contact/company/creator fields", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", value: { ...lead, description: "Next" }, replayed: false });
    const { result, onSaved, rerender } = setup();
    act(() => result.current.change("description", "Next"));
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ method: "patch", path: `/api/tenant/crm/v1/leads/${lead.id}`, body: { description: "Next", expectedUpdatedAt: lead.updatedAt } }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ description: "Next" }));
    rerender({ subject: { ...lead, description: "Next" }, editable: true });
    expect(result.current.form?.description).toBe("Next");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.editable).toBe(true);
  });
  it("no-op saves and cancel do not send requests", async () => {
    const { result } = setup();
    await act(() => result.current.save());
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    expect(result.current.form?.description).toBe("Old note");
    act(() => result.current.change("description", "Unsaved"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.form?.description).toBe("Old note");
    expect(result.current.editable).toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("retains draft on a definite failure", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "failed", error: { status: 422, message: "Failed" } });
    const { result, onSaved } = setup();
    act(() => result.current.change("expectedNeed", "New need"));
    await act(() => result.current.save());
    expect(result.current.form?.expectedNeed).toBe("New need");
    expect(warning).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("blocks replay after an ambiguous write until a fresh lead arrives", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "ambiguous", error: { status: 0, message: "Unknown" } });
    const { result, onSaved, onReconcile, rerender } = setup();
    act(() => result.current.change("description", "New"));
    await act(() => result.current.save());
    expect(result.current.form).toBeNull();
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    act(() => result.current.change("description", "Retry"));
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    rerender({ subject: { ...lead, description: "Verified" }, editable: true });
    expect(result.current.form?.description).toBe("Verified");
    expect(result.current.editable).toBe(true);
  });
  it("does not allow edits without capability or after conversion", async () => {
    const denied = setup(lead, false);
    act(() => denied.result.current.change("description", "Denied"));
    await act(() => denied.result.current.save());
    expect(denied.result.current.form).toBeNull();
    const converted = setup({ ...lead, status: "CONVERTED" });
    act(() => converted.result.current.change("description", "Denied"));
    await act(() => converted.result.current.save());
    expect(converted.result.current.form).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it("merges batched changes without losing another field", () => {
    const { result } = setup();
    act(() => {
      result.current.change("description", "New note");
      result.current.change("expectedNeed", "New need");
    });
    expect(result.current.form).toMatchObject({ description: "New note", expectedNeed: "New need" });
  });

  it("tracks fresh server values when clean but preserves an unsaved draft", () => {
    const { result, rerender } = setup();
    const refreshed = { ...lead, description: "Server note" };
    rerender({ subject: refreshed, editable: true });
    expect(result.current.form?.description).toBe("Server note");
    act(() => result.current.change("description", "My draft"));
    rerender({ subject: { ...refreshed, description: "Another update" }, editable: true });
    expect(result.current.form?.description).toBe("My draft");
    act(() => result.current.cancel());
    expect(result.current.form?.description).toBe("Another update");
  });

  it("uses the latest clean baseline after a reverted edit and a refresh", async () => {
    const { result, rerender } = setup();
    act(() => result.current.change("description", "Draft"));
    act(() => result.current.change("description", "Old note"));
    rerender({ subject: { ...lead, description: "Fresh note" }, editable: true });
    act(() => result.current.change("expectedNeed", "New need"));
    expect(result.current.form).toMatchObject({ description: "Fresh note", expectedNeed: "New need" });
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "failed", error: { status: 422 } });
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { expectedNeed: "New need", expectedUpdatedAt: lead.updatedAt } }));
  });

  it("does not suggest an actor outside the allowed owner boundary", () => {
    const { result } = renderHook(() => useLeadDetailsEdit({ ...lead, ownerUserId: null }, true, vi.fn(), vi.fn(), []));
    expect(result.current.form?.ownerUserId).toBe("");
    expect(result.current.isDirty).toBe(false);
  });

  it.each([{ status: 409 }, { status: 422, code: "CRM.LEAD.CONCURRENT_UPDATE" }])("discards a stale draft and reconciles before reapplying: %j", async (conflict) => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error: conflict });
    const { result, rerender, onSaved, onReconcile } = setup();
    act(() => result.current.change("description", "My draft"));
    rerender({ subject: { ...lead, updatedAt: "2026-10-26T10:01:00.123Z", description: "Someone else's edit" }, editable: true });
    act(() => result.current.change("expectedNeed", "My need"));
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledWith(expect.objectContaining({
      body: { description: "My draft", expectedNeed: "My need", expectedUpdatedAt: lead.updatedAt },
    }));
    expect(result.current.error).toEqual(conflict);
    expect(warning).toHaveBeenCalledExactlyOnceWith(en.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: en.crmLeadDetail.reloadLead, onClick: onReconcile });
    expect(warning.mock.invocationCallOrder[0]).toBeLessThan(onReconcile.mock.invocationCallOrder[0]);
    expect(result.current.form).toBeNull();
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    const refreshed = { ...lead, updatedAt: "2026-10-26T10:02:00.123Z", description: "Fresh server note" };
    rerender({ subject: refreshed, editable: true });
    expect(result.current.form?.description).toBe("Fresh server note");
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.change("description", "Reapplied note"));
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "success", value: { ...refreshed, description: "Reapplied note" }, replayed: false });
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({ body: { description: "Reapplied note", expectedUpdatedAt: refreshed.updatedAt } }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("requires a post-result refresh if another card refreshes the lead while saving", async () => {
    let release!: () => void;
    vi.mocked(runIdempotentWrite).mockImplementation(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { kind: "ambiguous", error: { status: 0 } };
    });
    const { result, rerender } = setup();
    act(() => result.current.change("description", "Pending note"));
    act(() => { void result.current.save(); });
    expect(result.current.saving).toBe(true);
    rerender({ subject: { ...lead, companyName: "Updated company" }, editable: true });
    await act(async () => { release(); });
    expect(result.current.form).toBeNull();
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    rerender({ subject: { ...lead, description: "Verified note" }, editable: true });
    expect(result.current.form?.description).toBe("Verified note");
  });
});
