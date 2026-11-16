// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../../../../i18n/dictionaries/en";
const api = vi.hoisted(() => ({ listTiers: vi.fn(), listFeatures: vi.fn(), getApplicationAudit: vi.fn() }));
vi.mock("../api/applications.api", () => ({ applicationsApi: api }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
import { useApplicationCatalogue } from "./useApplicationCatalogue";
const feature = { id: "feature-1", baseIncluded: true, baseGrantRevision: 2 };
beforeEach(() => {
  sessionStorage.clear();
  api.listTiers.mockReset().mockResolvedValue([]);
  api.listFeatures.mockReset().mockResolvedValue([feature]);
  api.getApplicationAudit.mockReset().mockResolvedValue({ items: [] });
});
afterEach(cleanup);
describe("base policy background refresh", () => {
  it("retains the Features subtree and command recovery while authoritative reads are pending", async () => {
    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.features).toEqual([feature]));
    let resolve!: (value: unknown[]) => void;
    api.listFeatures.mockReturnValue(new Promise((done) => { resolve = done; }));
    let pending!: ReturnType<typeof result.current.loadCatalogue>;
    act(() => { pending = result.current.loadCatalogue(true); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.features).toEqual([feature]);
    await act(async () => { resolve([{ ...feature, baseIncluded: false, baseGrantRevision: 3 }]); await pending; });
    expect(result.current.features[0].baseGrantRevision).toBe(3);
  });
  it("keeps last confirmed policy and a persistent error when background read fails", async () => {
    const { result } = renderHook(() => useApplicationCatalogue("application-1"));
    await waitFor(() => expect(result.current.features).toEqual([feature]));
    api.listFeatures.mockRejectedValue(new Error("Read unavailable"));
    await act(async () => { expect(await result.current.loadCatalogue(true)).toBeNull(); });
    expect(result.current.features).toEqual([feature]);
    expect(result.current.loadedApplicationId).toBe("application-1");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.catalogueError).toBeTruthy();
  });
});
