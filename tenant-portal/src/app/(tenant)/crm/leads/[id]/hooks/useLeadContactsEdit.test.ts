// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadDetail } from "../../lead-contract";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { useLeadContactsEdit } from "./useLeadContactsEdit";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({ warning }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/idempotent-write", () => ({ runIdempotentWrite: vi.fn(), createWriteAttempt: () => ({ idempotencyKey: "01900100-0000-7000-8000-000000000001" }) }));

const lead = {
  id: "01900100-0000-7000-8000-000000000001", leadProfileType: "INDIVIDUAL",
  updatedAt: "2026-10-26T10:00:00.123Z",
  displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: null,
  email: "dina@example.test", primaryMobile: "+20105551234", phones: ["+20105551234"], contacts: [],
} as unknown as LeadDetail;

function setup(canEdit = true) {
  const onSaved = vi.fn();
  const onReconcile = vi.fn();
  const hook = renderHook(({ subject }) => useLeadContactsEdit(subject, onSaved, onReconcile, canEdit), { initialProps: { subject: lead } });
  return { ...hook, onSaved, onReconcile };
}

beforeEach(() => vi.clearAllMocks());

describe("useLeadContactsEdit", () => {
  it.each([{ status: 409, code: "CRM.LEAD.CONCURRENT_UPDATE" }, { status: 409 }, { status: 422, code: "CRM.LEAD.CONCURRENT_UPDATE" }])("refetches a conflict and saves reapplied edits with the fresh timestamp: %j", async (conflict) => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error: conflict });
    const { result, rerender, onReconcile, onSaved } = setup();
    act(() => result.current.startEdit());
    act(() => result.current.setField("firstName", "Dena"));
    await act(() => result.current.save());
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(result.current.error).toEqual(conflict);
    expect(warning).toHaveBeenCalledExactlyOnceWith(en.crmShared.refusals["CRM.LEAD.CONCURRENT_UPDATE"], undefined, 0, { label: en.crmLeadDetail.reloadLead, onClick: onReconcile });
    expect(warning.mock.invocationCallOrder[0]).toBeLessThan(onReconcile.mock.invocationCallOrder[0]);
    expect(result.current.form).toBeNull();
    act(() => result.current.startEdit());
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    const refreshed = { ...lead, firstName: "Dina fresh", updatedAt: "2026-10-26T10:01:00.123Z" };
    rerender({ subject: refreshed });
    act(() => result.current.startEdit());
    expect(result.current.form?.firstName).toBe("Dina fresh");
    act(() => result.current.setField("firstName", "Dena"));
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "success", value: { ...refreshed, firstName: "Dena" }, replayed: false });
    await act(() => result.current.save());
    expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({ body: { firstName: "Dena", expectedUpdatedAt: refreshed.updatedAt } }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("cancels and closes a no-op without sending a request", async () => {
    const { result } = setup();
    act(() => result.current.startEdit());
    act(() => result.current.setField("firstName", "Dena"));
    act(() => result.current.cancel());
    expect(result.current.form).toBeNull();
    act(() => result.current.startEdit());
    expect(result.current.form?.firstName).toBe("Dina");
    await act(async () => result.current.save());
    expect(result.current.form).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });

  it("keeps failed edits visible and closes only after a confirmed save", async () => {
    const { result, onSaved } = setup();
    const error = { status: 422, code: "INVALID" };
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "failed", error }).mockResolvedValueOnce({ kind: "success", value: { ...lead, firstName: "Dena" }, replayed: false });
    act(() => result.current.startEdit());
    act(() => result.current.setField("firstName", "Dena"));
    await act(async () => result.current.save());
    expect(result.current.form?.firstName).toBe("Dena");
    expect(result.current.error).toEqual(error);
    expect(warning).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => result.current.save());
    expect(runIdempotentWrite).toHaveBeenLastCalledWith(expect.objectContaining({ body: { firstName: "Dena", expectedUpdatedAt: lead.updatedAt } }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.form).toBeNull();
  });

  it.each(["ambiguous", "applied_unreadable"] as const)("reconciles %s instead of leaving a fresh Save available", async (kind) => {
    const { result, onSaved, onReconcile } = setup();
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind, error: { status: 0 } });
    act(() => result.current.startEdit());
    act(() => result.current.setField("firstName", "Dena"));
    await act(async () => result.current.save());
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.form).toBeNull();
  });

  it("blocks invalid values and denied editing before transport", async () => {
    const denied = setup(false);
    act(() => denied.result.current.startEdit());
    expect(denied.result.current.form).toBeNull();
    const { result } = setup();
    act(() => result.current.startEdit());
    act(() => result.current.setField("email", "invalid"));
    await act(async () => result.current.save());
    expect(result.current.errors.email).toBe(en.crmLeads.create.errors.email);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
});
