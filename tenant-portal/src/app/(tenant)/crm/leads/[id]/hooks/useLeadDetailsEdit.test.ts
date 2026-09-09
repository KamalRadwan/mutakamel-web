// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadDetail } from "../../lead-contract";
import { runCrmWrite } from "../../../shared/crm-write";
import { useLeadDetailsEdit } from "./useLeadDetailsEdit";
import { en } from "@/i18n/dictionaries/en";

const ACTOR = "01900100-0000-7000-8000-000000000001";
const OWNER = "01900100-0000-7000-8000-000000000002";
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "01900100-0000-7000-8000-000000000001" } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("../../../shared/crm-write", () => ({ createCrmWriteAttempt: vi.fn(() => ({})), runCrmWrite: vi.fn() }));
const lead = { id: "01900100-0000-7000-8000-000000000003", ownerUserId: OWNER, status: "OPEN", description: "Old note", interestSummary: "Summary", expectedNeed: "Need", acquisitionSourceId: null } as LeadDetail;

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
    expect(runCrmWrite).not.toHaveBeenCalled();
    expect(result.current.form?.ownerUserId).toBe(OWNER);
    expect(result.current.editable).toBe(true);
    expect(runCrmWrite).not.toHaveBeenCalled();
  });
  it("suggests current user for an unassigned edit without writing until save", () => {
    const { result } = setup({ ...lead, ownerUserId: null });
    expect(result.current.form?.ownerUserId).toBe(ACTOR);
    act(() => result.current.cancel());
    expect(runCrmWrite).not.toHaveBeenCalled();
  });
  it("saves a changed textarea without sending contact/company/creator fields", async () => {
    vi.mocked(runCrmWrite).mockResolvedValue({ kind: "success", value: { ...lead, description: "Next" }, replayed: false });
    const { result, onSaved, rerender } = setup();
    act(() => result.current.change("description", "Next"));
    await act(() => result.current.save());
    expect(runCrmWrite).toHaveBeenCalledWith(expect.objectContaining({ method: "patch", path: `/api/tenant/crm/v1/leads/${lead.id}`, body: { description: "Next" } }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ description: "Next" }));
    rerender({ subject: { ...lead, description: "Next" }, editable: true });
    expect(result.current.form?.description).toBe("Next");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.editable).toBe(true);
  });
  it("no-op saves and cancel do not send requests", async () => {
    const { result } = setup();
    await act(() => result.current.save());
    expect(runCrmWrite).not.toHaveBeenCalled();
    expect(result.current.form?.description).toBe("Old note");
    act(() => result.current.change("description", "Unsaved"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.form?.description).toBe("Old note");
    expect(result.current.editable).toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(runCrmWrite).not.toHaveBeenCalled();
  });
  it("retains draft on a definite failure", async () => {
    vi.mocked(runCrmWrite).mockResolvedValue({ kind: "failed", error: { status: 422, message: "Failed" } });
    const { result, onSaved } = setup();
    act(() => result.current.change("expectedNeed", "New need"));
    await act(() => result.current.save());
    expect(result.current.form?.expectedNeed).toBe("New need");
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("blocks replay after an ambiguous write until a fresh lead arrives", async () => {
    vi.mocked(runCrmWrite).mockResolvedValue({ kind: "ambiguous", error: { status: 0, message: "Unknown" } });
    const { result, onSaved, onReconcile, rerender } = setup();
    act(() => result.current.change("description", "New"));
    await act(() => result.current.save());
    expect(result.current.form).toBeNull();
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    act(() => result.current.change("description", "Retry"));
    await act(() => result.current.save());
    expect(runCrmWrite).toHaveBeenCalledOnce();
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
    expect(runCrmWrite).not.toHaveBeenCalled();
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
    vi.mocked(runCrmWrite).mockResolvedValue({ kind: "failed", error: { status: 422 } });
    await act(() => result.current.save());
    expect(runCrmWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { expectedNeed: "New need" } }));
  });

  it("does not suggest an actor outside the allowed owner boundary", () => {
    const { result } = renderHook(() => useLeadDetailsEdit({ ...lead, ownerUserId: null }, true, vi.fn(), vi.fn(), []));
    expect(result.current.form?.ownerUserId).toBe("");
    expect(result.current.isDirty).toBe(false);
  });

  it("requires a post-result refresh if another card refreshes the lead while saving", async () => {
    let release!: () => void;
    vi.mocked(runCrmWrite).mockImplementation(async () => {
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
    expect(runCrmWrite).toHaveBeenCalledOnce();
    rerender({ subject: { ...lead, description: "Verified note" }, editable: true });
    expect(result.current.form?.description).toBe("Verified note");
  });
});
