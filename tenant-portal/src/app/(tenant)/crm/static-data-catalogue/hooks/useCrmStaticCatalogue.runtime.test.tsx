// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const { api, auth } = vi.hoisted(() => ({
  api: { get: vi.fn() }, auth: { user: { id: "actor-1", permissions: ["crm.settings.read"] } },
}));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: api, TenantApiClientError: class extends Error {
  constructor(message: string, public response: { status: number; data: Record<string, unknown> }) { super(message); }
} }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));

import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useCrmStaticCatalogue } from "./useCrmStaticCatalogue";
import { catalogueFixture } from "./static-catalogue.test-fixture";

beforeEach(() => {
  vi.clearAllMocks(); auth.user = { id: "actor-1", permissions: ["crm.settings.read"] };
  api.get.mockResolvedValue({ data: catalogueFixture });
});
afterEach(cleanup);

describe("static catalogue reads", () => {
  it("retains last confirmed data on refresh failure and clears degradation after recovery", async () => {
    const { result } = renderHook(useCrmStaticCatalogue);
    await waitFor(() => expect(result.current.allGroups).toHaveLength(18));
    api.get.mockRejectedValueOnce(new Error("offline"));
    await act(() => result.current.reload());
    expect(result.current.groups).toHaveLength(18);
    expect(result.current.isStale).toBe(true);
    expect(result.current.loadError).toBeNull();
    await act(() => result.current.reload());
    expect(result.current.isStale).toBe(false);
  });

  it("clears retained rows and open details on an authoritative refresh 403", async () => {
    const { result } = renderHook(useCrmStaticCatalogue);
    await waitFor(() => expect(result.current.allGroups).toHaveLength(18));
    act(() => result.current.openDetails("profileTypes"));
    expect(result.current.selectedGroup).not.toBeNull();
    api.get.mockRejectedValueOnce(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    await act(() => result.current.reload());
    expect(result.current.denied).toBe(true);
    expect(result.current.catalogue).toBeNull();
    expect(result.current.selectedGroup).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it("ignores a late older response even when transport ignores cancellation", async () => {
    let resolveFirst!: (value: { data: unknown }) => void;
    api.get.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const { result } = renderHook(useCrmStaticCatalogue);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const firstSignal = api.get.mock.calls[0][1].signal as AbortSignal;
    await act(() => result.current.reload());
    expect(firstSignal.aborted).toBe(true);
    await act(async () => resolveFirst({ data: { ...catalogueFixture, enumOptions: {} } }));
    expect(result.current.allGroups).toHaveLength(18);
    expect(result.current.isLoading).toBe(false);
  });

  it("does not read without the route grant, and removes old actor data before a new read", async () => {
    const view = renderHook(useCrmStaticCatalogue);
    await waitFor(() => expect(view.result.current.allGroups).toHaveLength(18));
    auth.user = { id: "actor-2", permissions: [] };
    view.rerender();
    expect(view.result.current.catalogue).toBeNull();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("aborts an outstanding read on unmount", async () => {
    api.get.mockImplementationOnce(() => new Promise(() => undefined));
    const view = renderHook(useCrmStaticCatalogue);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const signal = api.get.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
