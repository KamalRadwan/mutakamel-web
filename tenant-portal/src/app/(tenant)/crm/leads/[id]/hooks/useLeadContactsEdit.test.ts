// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadDetail } from "../../lead-contract";
import { runCrmWrite } from "../../../shared/crm-write";
import { useLeadContactsEdit } from "./useLeadContactsEdit";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("../../../shared/crm-write", () => ({ runCrmWrite: vi.fn(), createCrmWriteAttempt: () => ({ idempotencyKey: "01900100-0000-7000-8000-000000000001" }) }));

const lead = {
  id: "01900100-0000-7000-8000-000000000001", leadProfileType: "INDIVIDUAL",
  displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: null,
  email: "dina@example.test", primaryMobile: "+20105551234", phones: ["+20105551234"], contacts: [],
} as unknown as LeadDetail;

function setup(canEdit = true) {
  const onSaved = vi.fn();
  const onReconcile = vi.fn();
  const hook = renderHook(() => useLeadContactsEdit(lead, onSaved, onReconcile, canEdit));
  return { ...hook, onSaved, onReconcile };
}

beforeEach(() => vi.clearAllMocks());

describe("useLeadContactsEdit", () => {
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
    expect(runCrmWrite).not.toHaveBeenCalled();
  });

  it("keeps failed edits visible and closes only after a confirmed save", async () => {
    const { result, onSaved } = setup();
    const error = { status: 422, code: "INVALID" };
    vi.mocked(runCrmWrite).mockResolvedValueOnce({ kind: "failed", error }).mockResolvedValueOnce({ kind: "success", value: { ...lead, firstName: "Dena" }, replayed: false });
    act(() => result.current.startEdit());
    act(() => result.current.setField("firstName", "Dena"));
    await act(async () => result.current.save());
    expect(result.current.form?.firstName).toBe("Dena");
    expect(result.current.error).toEqual(error);
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => result.current.save());
    expect(runCrmWrite).toHaveBeenLastCalledWith(expect.objectContaining({ body: { firstName: "Dena" } }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.form).toBeNull();
  });

  it.each(["ambiguous", "applied_unreadable"] as const)("reconciles %s instead of leaving a fresh Save available", async (kind) => {
    const { result, onSaved, onReconcile } = setup();
    vi.mocked(runCrmWrite).mockResolvedValueOnce({ kind, error: { status: 0 } });
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
    expect(runCrmWrite).not.toHaveBeenCalled();
  });
});
