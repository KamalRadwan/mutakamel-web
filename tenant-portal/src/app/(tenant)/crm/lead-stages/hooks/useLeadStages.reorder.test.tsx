// @vitest-environment jsdom

/**
 * The reorder write, covered here rather than through the screen.
 *
 * A drag cannot be driven in jsdom — every box `@hello-pangea/dnd` measures is
 * 0×0 (see `design-system/views/board/virtual-dnd.probe.test.tsx`) — and the
 * handle is now the only way to start one. So the drop's *outcome* is exercised
 * where it is decided: `handleReorder` is exactly what `DataTable` calls with
 * the order a drop produced.
 */

import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: { permissions: ["crm.lead_stages.read", "crm.lead_stages.manage"], isTenantOwner: false },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  TenantApiClientError: class TenantApiClientError extends Error {},
  unwrapCoreData: (payload: unknown) => payload,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));

import { I18nProvider } from "@/i18n/I18nContext";
import { useLeadStages } from "./useLeadStages";

const ENTRY = {
  id: "01900100-0000-7000-8000-000000000001",
  nameAr: "جديد",
  nameEn: "New",
  flag: "NEW",
  category: "IN_PROGRESS",
  sortOrder: 1,
  isDefault: true,
  isActive: true,
};
const CONTACTED = {
  ...ENTRY,
  id: "01900100-0000-7000-8000-000000000002",
  nameAr: "تم التواصل",
  nameEn: "Contacted",
  flag: "CONTACTED",
  sortOrder: 2,
  isDefault: false,
};
const QUALIFIED = {
  ...CONTACTED,
  id: "01900100-0000-7000-8000-000000000003",
  nameAr: "مؤهَّل",
  nameEn: "Qualified",
  flag: "QUALIFIED",
  sortOrder: 3,
};
const CATALOGUE = [ENTRY, CONTACTED, QUALIFIED];
const REORDER_PATH = "/api/tenant/crm/v1/lead-stages/reorder";
const DROPPED_ORDER = [ENTRY.id, QUALIFIED.id, CONTACTED.id];

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

async function loadedCatalogue() {
  const view = renderHook(() => useLeadStages(), { wrapper });
  await waitFor(() => expect(view.result.current.items).toHaveLength(3));
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.setItem("tenant_lang", "en");
  api.get.mockResolvedValue({ data: CATALOGUE });
});

afterEach(cleanup);

describe("useLeadStages — the reorder write", () => {
  it("sends the WHOLE order, and takes the response as the new list", async () => {
    api.patch.mockResolvedValue({
      data: [ENTRY, { ...QUALIFIED, sortOrder: 2 }, { ...CONTACTED, sortOrder: 3 }],
    });
    const { result } = await loadedCatalogue();

    await act(() => result.current.handleReorder(DROPPED_ORDER));

    expect(api.patch).toHaveBeenCalledWith(
      REORDER_PATH,
      { orderedIds: DROPPED_ORDER },
      // Auto-idempotency stays on: the Gateway declares this route idempotent
      // and it answers IDEM_MISSING without the key.
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.current.items.map(({ nameEn }) => nameEn)).toEqual([
      "New",
      "Qualified",
      "Contacted",
    ]);
    expect(result.current.items.map(({ sortOrder }) => sortOrder)).toEqual([1, 2, 3]);
  });

  it("rolls the order back and says why when the write fails", async () => {
    api.patch.mockRejectedValue(new Error("Stage order rejected."));
    const { result } = await loadedCatalogue();

    await act(() => result.current.handleReorder(DROPPED_ORDER));

    expect(result.current.items.map(({ nameEn }) => nameEn)).toEqual([
      "New",
      "Contacted",
      "Qualified",
    ]);
    expect(result.current.error).toBe("Stage order rejected.");
  });

  // Both refusals `assertExactOrder` answers 422 for. Neither costs a round
  // trip, and neither leaves the table showing an order that was never written.
  it("refuses an order that displaces the entry stage, or that drops a stage", async () => {
    const { result } = await loadedCatalogue();

    await act(() => result.current.handleReorder([CONTACTED.id, ENTRY.id, QUALIFIED.id]));
    expect(api.patch).not.toHaveBeenCalled();

    await act(() => result.current.handleReorder([ENTRY.id, CONTACTED.id]));
    expect(api.patch).not.toHaveBeenCalled();
    expect(result.current.error).toContain("entry stage stays first");
    expect(result.current.items.map(({ nameEn }) => nameEn)).toEqual([
      "New",
      "Contacted",
      "Qualified",
    ]);
  });
});
