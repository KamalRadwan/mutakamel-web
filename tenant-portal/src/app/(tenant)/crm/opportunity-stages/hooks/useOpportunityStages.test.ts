// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useOpportunityStages } from "./useOpportunityStages";

const state = vi.hoisted(() => ({ canManage: true, canMutate: true, enabled: vi.fn(), setItems: vi.fn(), reload: vi.fn().mockResolvedValue(true) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: state.canManage ? ["crm.pipelines.manage"] : ["crm.pipelines.read"] } }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: state.canMutate }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../shared/hooks/useOpportunityStageCatalogue", () => ({ useOpportunityStageCatalogue: (enabled: boolean) => { state.enabled(enabled); return { items: [], setItems: state.setItems, hasLoaded: true, isLoading: false, queryError: null, reload: state.reload }; } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); state.canManage = true; state.canMutate = true; });

const input = { nameAr: "مراجعة", nameEn: "Review", flag: "DISCOVERY", category: "IN_PROGRESS", isActive: true } as const;

it("does not read or mutate this catalogue with only pipelines.read", async () => {
  state.canManage = false;
  const post = vi.spyOn(axiosClient, "post");
  const { result } = renderHook(() => useOpportunityStages());
  expect(state.enabled).toHaveBeenLastCalledWith(false);
  await expect(result.current.create(input)).resolves.toMatchObject({ ok: false, error: { status: 403 } });
  expect(post).not.toHaveBeenCalled();
});

it("fences double submission before React renders a pending state", async () => {
  let resolveRequest: (value: Awaited<ReturnType<typeof axiosClient.post>>) => void = () => undefined;
  const post = vi.spyOn(axiosClient, "post").mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
  const remove = vi.spyOn(axiosClient, "delete");
  const { result } = renderHook(() => useOpportunityStages());
  let first: ReturnType<typeof result.current.create>;
  let second: ReturnType<typeof result.current.create>;
  act(() => { first = result.current.create(input); second = result.current.create(input); void result.current.remove("01900300-0000-7000-8000-000000000001"); });
  expect(post).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
  await expect(second!).resolves.toMatchObject({ ok: false, error: null });
  await act(async () => {
    resolveRequest({ status: 201, statusText: "Created", headers: new Headers(), data: { ...input, id: "01900300-0000-7000-8000-000000000001", isSystem: false, createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" } });
    await first!;
  });
  expect(result.current.isSubmitting).toBe(false);
});

it("keeps manage-based reads enabled but refuses every mutation in resolved read-only mode", async () => {
  state.canMutate = false;
  const post = vi.spyOn(axiosClient, "post");
  const patch = vi.spyOn(axiosClient, "patch");
  const remove = vi.spyOn(axiosClient, "delete");
  const { result } = renderHook(() => useOpportunityStages());
  expect(state.enabled).toHaveBeenLastCalledWith(true);
  expect(result.current).toMatchObject({ canRead: true, canManage: false, readOnly: true });
  await expect(result.current.create(input)).resolves.toMatchObject({ error: { status: 403 } });
  await expect(result.current.update({ ...input, id: "01900300-0000-7000-8000-000000000001", isSystem: false, createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" }, input)).resolves.toMatchObject({ error: { status: 403 } });
  await expect(result.current.remove("01900300-0000-7000-8000-000000000001")).resolves.toMatchObject({ error: { status: 403 } });
  expect(post).not.toHaveBeenCalled();
  expect(patch).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it("retains successful reads and fences subsequent writes after a server policy 403", async () => {
  const post = vi.spyOn(axiosClient, "post").mockRejectedValue(new TenantApiClientError("Policy blocked", { status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "CRM_SUBSCRIPTION_READ_ONLY" } }));
  const { result } = renderHook(() => useOpportunityStages());
  await act(async () => { await result.current.create(input); });
  expect(result.current).toMatchObject({ canRead: true, canManage: false, hasLoaded: true, queryError: null, readOnly: true });
  await result.current.create(input);
  expect(post).toHaveBeenCalledOnce();
  expect(state.enabled).toHaveBeenLastCalledWith(true);
});
