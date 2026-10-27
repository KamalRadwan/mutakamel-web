// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { resolveTradeScope, type TradeScopeTarget } from "../../trade-scope";
import { useUomDetail } from "./useUomDetail";
import { useUoms } from "./useUoms";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  toast: { success: vi.fn() },
  write: vi.fn(),
  context: { companyId: null, branchId: null, channelId: null },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: ar, lang: "ar" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
  tradeGet: mocks.get, tradePost: vi.fn(), tradePatch: vi.fn(), tradeIfMatch: vi.fn(),
}));
vi.mock("../../useTradeWrite", () => ({ useTradeWrite: () => mocks.write }));
vi.mock("../../useTradeScope", async () => {
  const { useMemo } = await import("react");
  return {
    useTradeScopeRequest: (target: TradeScopeTarget) => useMemo(() => {
      const resolution = resolveTradeScope(target, mocks.context);
      return resolution.ok
        ? { headers: resolution.headers, gap: null }
        : { headers: {}, gap: resolution.gap };
    }, [target]),
  };
});

const row = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057", code: "PCS", displayName: "Piece",
  localizedNames: { en: "Piece" }, status: "ACTIVE", version: 1,
  updatedAt: "2026-10-17T09:00:00.000Z",
};

beforeEach(() => mocks.get.mockReset());
afterEach(cleanup);

describe("UoM master reads without organization selectors", () => {
  it("loads the master list before a company or branch exists", async () => {
    mocks.get.mockResolvedValue({ data: { items: [row], total: 1, page: 1, limit: 50 } });
    const { result } = renderHook(() => useUoms());
    await waitFor(() => expect(result.current.items).toEqual([row]));
    expect(mocks.get).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/uoms?page=1&limit=50", expect.objectContaining({ headers: {} }),
    );
    expect(result.current.queryError).toBeNull();
    expect(result.current.operatingScopeGap).toBe("company-required");
    await result.current.loadOperating();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("loads master detail without company or branch headers", async () => {
    mocks.get.mockResolvedValue({ data: row });
    const { result } = renderHook(() => useUomDetail(row.id));
    await waitFor(() => expect(result.current.uom).toEqual(row));
    expect(mocks.get).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/uoms/${row.id}`, expect.objectContaining({ headers: {} }),
    );
    expect(result.current.error).toBeNull();
  });
});
