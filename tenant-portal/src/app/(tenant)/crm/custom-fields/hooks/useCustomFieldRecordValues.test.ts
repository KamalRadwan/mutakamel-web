// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CustomFieldItem } from "../custom-field-contract";
import type { CustomFieldValue } from "../custom-field-values-contract";
import type { ValueWriteResult } from "./useCustomFieldValues";
import { useCustomFieldRecordValues } from "./useCustomFieldRecordValues";

const { fixture, load, save, reset, selectBranch, success, retry, router } = vi.hoisted(() => ({
  fixture: { branchId: "0192f3a0-0000-7000-8000-000000000001" as string | null,
    allowed: true, hasLoaded: true, isLoading: false, isSaving: false, values: [] as CustomFieldValue[] },
  load: vi.fn(), save: vi.fn(), reset: vi.fn(), selectBranch: vi.fn(), success: vi.fn(), retry: vi.fn(),
  router: { push: vi.fn() },
}));
const BRANCH = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH_B = "0192f3a0-0000-7000-8000-000000000002";
const OWNER = "0192f3a0-0000-7000-8000-0000000000aa";
const OWNER_B = "0192f3a0-0000-7000-8000-0000000000bb";
const FIELD = "0192f3a0-0000-7000-8000-0000000000f1";

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {} }) }));
vi.mock("@/i18n/I18nContext", async () => {
  const { en: dictionary } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", t: dictionary }) };
});
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({ branchIds: [BRANCH, BRANCH_B], branchId: fixture.branchId, selectBranch }),
}));
vi.mock("@/hooks/useTenantBranchLabels", () => ({
  useTenantBranchLabels: () => new Map([[BRANCH, "Cairo"], [BRANCH_B, "Alexandria"]]),
}));
vi.mock("@/hooks/useCrmRecordOptions", () => ({
  useCrmRecordOptions: () => ({ options: [{ value: OWNER, label: "Orbit" }, { value: OWNER_B, label: "Delta" }],
    search: vi.fn(), error: null, isLoading: false }),
}));
vi.mock("./useCustomFieldOwnerAccess", () => ({
  useCustomFieldOwnerAccess: ({ enabled, ownerId }: { enabled: boolean; ownerId?: string }) => ({
    canEdit: enabled && !!ownerId && fixture.allowed, converted: false, isLoading: false, error: null, retry,
  }),
}));
vi.mock("./useCustomFieldValues", () => ({
  useCustomFieldValues: () => ({ values: fixture.values, hasLoaded: fixture.hasLoaded,
    isLoading: fixture.isLoading, isSaving: fixture.isSaving, savingFieldId: null, loadError: null, load, save, reset }),
}));

function field(change: Partial<CustomFieldItem> = {}): CustomFieldItem {
  return { id: FIELD, fieldKey: "notes", nameAr: "ملاحظات", nameEn: "Notes", ownerType: "LEAD",
    type: "TEXT", options: [], optionsCount: 0, isSearchable: false, isActive: true, sortOrder: 1,
    requirements: [], ...change };
}
function stored(fieldId: string, value: unknown): CustomFieldValue {
  return { fieldDefinitionId: fieldId, ownerType: "LEAD", ownerId: OWNER, value };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function selected(definitions = [field()], canManage = true) {
  const hook = renderHook(() => useCustomFieldRecordValues(definitions, canManage));
  act(() => hook.result.current.selectOwner(OWNER));
  return hook;
}
type State = ReturnType<typeof useCustomFieldRecordValues>;
function transition(state: State, kind: string) {
  if (kind === "record") state.selectOwner(OWNER_B);
  else if (kind === "branch") state.changeBranch(BRANCH_B);
  else state.selectType("OPPORTUNITY");
}

beforeEach(() => {
  fixture.branchId = BRANCH; fixture.allowed = true; fixture.hasLoaded = true;
  fixture.isLoading = false; fixture.isSaving = false; fixture.values = [stored(FIELD, "Saved")];
  load.mockResolvedValue(true); save.mockResolvedValue({ ok: true, error: null });
  selectBranch.mockImplementation((next: string) => { fixture.branchId = next; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("custom-field record value drafts", () => {
  it.each(["record", "branch", "type"])("waits for discard before a dirty %s transition", (kind) => {
    const { result } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    act(() => transition(result.current, kind));
    expect(result.current.guard.isDiscardOpen).toBe(true);
    expect(result.current.ownerId).toBe(OWNER);
    expect(result.current.ownerType).toBe("LEAD");
    expect(result.current.branchId).toBe(BRANCH);
    expect(load).toHaveBeenCalledTimes(1);
    expect(selectBranch).not.toHaveBeenCalled();
    act(() => result.current.guard.confirmDiscard());
    expect(result.current.isDirty).toBe(false);
    if (kind === "record") {
      expect(result.current.ownerId).toBe(OWNER_B);
      expect(load).toHaveBeenLastCalledWith("LEAD", OWNER_B);
    } else {
      expect(result.current.ownerId).toBeUndefined();
      expect(reset).toHaveBeenCalledOnce();
      if (kind === "branch") expect(selectBranch).toHaveBeenCalledWith(BRANCH_B);
      else expect(result.current.ownerType).toBe("OPPORTUNITY");
    }
  });

  it.each(["record", "branch", "type"])("keeps the selection and draft when cancelling a %s transition", (kind) => {
    const { result } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    act(() => transition(result.current, kind));
    act(() => result.current.guard.cancelDiscard());
    expect(result.current.guard.isDiscardOpen).toBe(false);
    expect(result.current.ownerId).toBe(OWNER);
    expect(result.current.valueFor(FIELD)).toBe("Draft");
    expect(result.current.isDirty).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("removes the draft when a field is reverted to its saved value", () => {
    const { result } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.change(FIELD, "Saved"));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasDraft(FIELD)).toBe(false);
    act(() => result.current.selectOwner(OWNER_B));
    expect(result.current.guard.isDiscardOpen).toBe(false);
    expect(load).toHaveBeenLastCalledWith("LEAD", OWNER_B);
  });

  it.each([false, true])("does not mutate when record update permission is unavailable (generic manage %s)", async (canManage) => {
    fixture.allowed = false;
    const { result } = selected(undefined, canManage);
    expect(result.current.canEdit).toBe(false);
    act(() => result.current.change(FIELD, "Forbidden"));
    await act(async () => { await result.current.save(field()); });
    expect(result.current.isDirty).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("blocks a previously drafted write if capability is revoked", async () => {
    const { result, rerender } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    fixture.allowed = false; rerender();
    await act(async () => { await result.current.save(field()); });
    expect(result.current.valueFor(FIELD)).toBe("Draft");
    expect(result.current.canEdit).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it.each([["BOOLEAN", false], ["NUMBER", 0]] as const)("saves %s %s as a real value, not a clear", async (type, value) => {
    fixture.values = [];
    const definition = field({ type });
    const { result } = selected([definition]);
    act(() => result.current.change(FIELD, value));
    expect(result.current.canSave(definition)).toBe(true);
    expect(result.current.canClear(definition)).toBe(true);
    await act(async () => { await result.current.save(definition); });
    expect(save).toHaveBeenCalledWith(definition, "LEAD", OWNER, value);
    expect(result.current.isDirty).toBe(false);
  });

  it("prevents clearing and saving a blank UPDATE-required value", async () => {
    const definition = field({ requirements: [{ operation: "UPDATE", entityScope: null, isRequired: true }] });
    const { result } = selected([definition]);
    expect(result.current.isRequired(definition)).toBe(true);
    expect(result.current.canClear(definition)).toBe(false);
    act(() => result.current.change(FIELD, null));
    expect(result.current.canSave(definition)).toBe(false);
    expect(result.current.errorFor(definition)).toBe(en.crmCustomFields.valueValidation.required);
    await act(async () => { await result.current.save(definition); });
    expect(save).not.toHaveBeenCalled();
  });

  it("honours matching scoped requirements while ignoring requirements for another owner", () => {
    const definition = field({ requirements: [{ operation: "UPDATE", entityScope: "CUSTOMER_PROFILE", isRequired: true }] });
    const { result } = selected([definition]);
    expect(result.current.isRequired(definition)).toBe(false);
    expect(result.current.canClear(definition)).toBe(true);
  });

  it("removes only the confirmed field draft and preserves other unsaved fields", async () => {
    const other = field({ id: "other-field", fieldKey: "other" });
    const { result } = selected([field(), other]);
    act(() => { result.current.change(FIELD, "First draft"); result.current.change(other.id, "Other draft"); });
    await act(async () => { await result.current.save(field()); });
    expect(result.current.hasDraft(FIELD)).toBe(false);
    expect(result.current.hasDraft(other.id)).toBe(true);
    expect(result.current.valueFor(other.id)).toBe("Other draft");
    expect(result.current.isDirty).toBe(true);
    expect(success).toHaveBeenCalledWith(en.crmCustomFields.valueSaved);
  });

  it.each([
    [{ ok: false, error: null, uncertain: true, refreshFailed: false }, "valueUncertain", false],
    [{ ok: false, error: null, uncertain: true, refreshFailed: true }, "valueUncertainStale", true],
    [{ ok: false, error: null, confirmed: true, refreshFailed: true }, "valueConfirmedReloadFailed", true],
  ] as const)("keeps uncertain outcomes truthful: %j", async (outcome, messageKey, retainsDraft) => {
    save.mockResolvedValue(outcome);
    const { result } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    await act(async () => { await result.current.save(field()); });
    expect(result.current.notice).toBe(en.crmCustomFields[messageKey]);
    expect(result.current.hasDraft(FIELD)).toBe(retainsDraft);
    expect(success).not.toHaveBeenCalled();
  });

  it("does not edit or save before selecting a record", async () => {
    const { result } = renderHook(() => useCustomFieldRecordValues([field()], true));
    expect(result.current.ownerId).toBeUndefined();
    expect(result.current.canEdit).toBe(false);
    act(() => result.current.change(FIELD, "No record"));
    await act(async () => { await result.current.save(field()); });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.isDirty).toBe(false);
  });

  it("cannot write an old owner's draft after the external branch scope changes", async () => {
    const { result, rerender } = selected();
    act(() => result.current.change(FIELD, "Old branch draft"));
    fixture.branchId = BRANCH_B; rerender();
    expect(result.current.ownerId).toBeUndefined();
    expect(result.current.ownerLabel).toBeUndefined();
    expect(result.current.canEdit).toBe(false);
    await act(async () => { await result.current.save(field()); });
    expect(save).not.toHaveBeenCalled();
  });

  it("blocks transitions during a pending save", () => {
    const { result, rerender } = selected();
    fixture.isSaving = true; rerender();
    act(() => { result.current.selectOwner(OWNER_B); result.current.changeBranch(BRANCH_B); result.current.selectType("OPPORTUNITY"); });
    expect(result.current.guard.isDiscardOpen).toBe(false);
    expect(result.current.ownerId).toBe(OWNER);
    expect(selectBranch).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("refreshes owner access after an authoritative write denial", async () => {
    save.mockResolvedValue({ ok: false, error: { status: 403, code: "CRM_SCOPED_PERMISSION_DENIED" } } satisfies ValueWriteResult);
    const { result } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    await act(async () => { await result.current.save(field()); });
    expect(retry).toHaveBeenCalledOnce();
    expect(result.current.hasDraft(FIELD)).toBe(true);
    expect(result.current.errorFor(field())).toBe(en.crmCustomFields.valueErrors.CRM_SCOPED_PERMISSION_DENIED);
  });

  it("does not announce a deferred save after the workspace unmounts", async () => {
    const pending = deferred<ValueWriteResult>();
    save.mockReturnValue(pending.promise);
    const { result, unmount } = selected();
    act(() => result.current.change(FIELD, "Draft"));
    let saving: Promise<void> | undefined;
    act(() => { saving = result.current.save(field()); });
    expect(save).toHaveBeenCalledOnce();
    unmount();
    await act(async () => { pending.resolve({ ok: true, error: null }); await saving; });
    expect(success).not.toHaveBeenCalled();
  });

  it.each([
    { ok: true, error: null },
    { ok: false, error: null, uncertain: true, refreshFailed: true },
  ] satisfies ValueWriteResult[])("ignores a late write outcome after an external branch change: %j", async (outcome) => {
    const pending = deferred<ValueWriteResult>();
    save.mockReturnValue(pending.promise);
    const { result, rerender } = selected();
    act(() => result.current.change(FIELD, "Old branch draft"));
    let saving: Promise<void> | undefined;
    act(() => { saving = result.current.save(field()); });
    fixture.branchId = BRANCH_B; rerender();
    expect(result.current.ownerId).toBeUndefined();
    await act(async () => { pending.resolve(outcome); await saving; });
    expect(result.current.notice).toBeNull();
    expect(success).not.toHaveBeenCalled();
    expect(result.current.hasDraft(FIELD)).toBe(true);
  });

  it("reloads definitions and values only after confirming dirty draft discard", () => {
    const reloadDefinitions = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useCustomFieldRecordValues([field()], true, reloadDefinitions));
    act(() => result.current.selectOwner(OWNER));
    act(() => result.current.change(FIELD, "Draft"));
    act(() => result.current.reload());
    expect(result.current.guard.isDiscardOpen).toBe(true);
    expect(reloadDefinitions).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    act(() => result.current.guard.cancelDiscard());
    expect(result.current.valueFor(FIELD)).toBe("Draft");
    expect(reloadDefinitions).not.toHaveBeenCalled();
    act(() => result.current.reload());
    act(() => result.current.guard.confirmDiscard());
    expect(result.current.isDirty).toBe(false);
    expect(reloadDefinitions).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("LEAD", OWNER);
    expect(retry).toHaveBeenCalledOnce();
  });
});

