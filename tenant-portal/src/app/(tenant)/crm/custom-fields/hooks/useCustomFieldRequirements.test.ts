// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseCrmCustomField } from "../custom-field-contract";
import { useCustomFieldRequirements } from "./useCustomFieldRequirements";

const { post, success } = vi.hoisted(() => ({ post: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post } }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
const field = parseCrmCustomField({
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "channel",
  nameAr: "القناة", nameEn: "Channel", type: "TEXT", options: [], isActive: true, isSearchable: false, sortOrder: 1,
});
const response = (operation: string) => ({ data: { id: "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  fieldDefinitionId: field.id, operation, isRequired: true, entityScope: null } });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("custom-field requirement writes", () => {
  it("stops sequential writes and reconciliation when the workspace unmounts during a write", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    post.mockReturnValue(new Promise<ReturnType<typeof response>>((resolve) => { finish = resolve; }));
    const reload = vi.fn().mockResolvedValue([field]);
    const { result, unmount } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select(field));
    act(() => { result.current.change("CREATE", true); result.current.change("UPDATE", true); });
    let saving!: Promise<void>;
    act(() => { saving = result.current.save(); });
    expect(post).toHaveBeenCalledOnce();
    unmount();
    await act(async () => { finish(response("CREATE")); await saving; });
    expect(post).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("suppresses a stale success toast when the workspace unmounts during reconciliation", async () => {
    let finish!: (value: typeof field[]) => void;
    const reload = vi.fn(() => new Promise<typeof field[]>((resolve) => { finish = resolve; }));
    post.mockResolvedValue(response("CREATE"));
    const { result, unmount } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select(field));
    act(() => result.current.change("CREATE", true));
    let saving!: Promise<void>;
    await act(async () => { saving = result.current.save(); });
    expect(reload).toHaveBeenCalledOnce();
    unmount();
    await act(async () => { finish([field]); await saving; });
    expect(success).not.toHaveBeenCalled();
  });

  it("does not reconcile a rejected in-flight write after unmount", async () => {
    let fail!: (error: Error) => void;
    post.mockReturnValue(new Promise<never>((_resolve, reject) => { fail = reject; }));
    const reload = vi.fn();
    const { result, unmount } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select(field));
    act(() => result.current.change("CREATE", true));
    let saving!: Promise<void>;
    act(() => { saving = result.current.save(); });
    unmount();
    await act(async () => { fail(new Error("Transport failed")); await saving; });
    expect(reload).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("keeps earlier successful rules and reconciles a later failure instead of claiming rollback", async () => {
    const current = { ...field, requirements: [{ operation: "CREATE" as const, entityScope: null, isRequired: true }] };
    const reload = vi.fn().mockResolvedValue([current]);
    post.mockResolvedValueOnce(response("CREATE")).mockRejectedValueOnce(new TenantApiClientError("Rejected", {
      status: 422, statusText: "Unprocessable", headers: new Headers(), data: { code: "CUSTOM_FIELD_LIMIT_EXCEEDED" },
    }));
    const { result } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select(field));
    act(() => { result.current.change("CREATE", true); result.current.change("UPDATE", true); });
    await act(async () => result.current.save());
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.map((call) => call[1].operation)).toEqual(["CREATE", "UPDATE"]);
    expect(result.current.flags).toEqual({ CREATE: true, UPDATE: false, CONVERT: false });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.error).toBe(en.crmCustomFields.requirementsPartial);
    expect(success).not.toHaveBeenCalled();
  });

  it("does not submit inactive rules or Opportunity conversion rules", async () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select({ ...field, isActive: false }));
    act(() => result.current.change("CREATE", true));
    await act(async () => result.current.save());
    expect(post).not.toHaveBeenCalled();
    act(() => result.current.select({ ...field, ownerType: "OPPORTUNITY" }));
    act(() => result.current.change("CONVERT", true));
    await act(async () => result.current.save());
    expect(result.current.flags.CONVERT).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("requires a successful reload before resubmitting an uncertain or stale result", async () => {
    post.mockResolvedValue(response("CREATE"));
    const reload = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useCustomFieldRequirements(true, reload));
    act(() => result.current.select(field));
    act(() => result.current.change("CREATE", true));
    await act(async () => result.current.save());
    expect(result.current.needsReload).toBe(true);
    await act(async () => result.current.save());
    expect(post).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
  });

  it("rejects a response for another field instead of showing a saved toast", async () => {
    post.mockResolvedValue({ data: { ...response("CREATE").data, fieldDefinitionId: "other" } });
    const { result } = renderHook(() => useCustomFieldRequirements(true, vi.fn().mockResolvedValue([field])));
    act(() => result.current.select(field));
    act(() => result.current.change("CREATE", true));
    await act(async () => result.current.save());
    expect(result.current.field).not.toBeNull();
    expect(result.current.error).toBe(en.crmCustomFields.requirementsPartial);
    expect(success).not.toHaveBeenCalled();
  });
});
