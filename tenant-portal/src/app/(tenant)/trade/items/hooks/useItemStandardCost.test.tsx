// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { useItemStandardCost } from "./useItemStandardCost";

const { auth, get, patch, scope, toast, write } = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  scope: {
    headers: { "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001" },
    gap: null,
  },
  toast: { success: vi.fn() },
  write: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: auth }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => toast,
}));
vi.mock("../../useTradeScope", () => ({
  useTradeScopeRequest: () => scope,
}));
vi.mock("../../useTradeWrite", () => ({ useTradeWrite: () => write }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  tradeGet: get,
  tradePatch: patch,
  tradeIfMatch: (version: number) => `\"${version}\"`,
}));

const ITEM_ID = "0192f3a0-0000-7000-8000-000000000003";
const COMPANY_PROFILE_ID = "0192f3a0-0000-7000-8000-000000000004";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({
    user: {
      isTenantOwner: false,
      permissions: ["trade.pricing.view_cost"],
    },
  });
  get.mockResolvedValue({
    data: {
      itemId: ITEM_ID,
      companyProfileId: COMPANY_PROFILE_ID,
      standardCost: "12.50",
      currencyCode: "EGP",
      version: 2,
    },
  });
});

afterEach(cleanup);

describe("useItemStandardCost", () => {
  it("loads cost only through the protected company-scoped endpoint", async () => {
    const { result } = renderHook(() => useItemStandardCost(ITEM_ID, true));

    await waitFor(() => expect(result.current.cost?.standardCost).toBe("12.50"));
    expect(get).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/items/${ITEM_ID}/standard-cost`,
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001" },
      }),
    );
  });

  it("hides the section after a server-side 403 without exposing an error body", async () => {
    get.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      data: { code: "TRADE.AUTH.TARGET_DENIED" },
    }));

    const { result } = renderHook(() => useItemStandardCost(ITEM_ID, true));
    await waitFor(() => expect(result.current.canView).toBe(false));
    expect(result.current.cost).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not call the cost endpoint without view permission", async () => {
    auth.mockReturnValue({ user: { isTenantOwner: false, permissions: [] } });
    const { result } = renderHook(() => useItemStandardCost(ITEM_ID, true));

    expect(result.current.canView).toBe(false);
    await Promise.resolve();
    expect(get).not.toHaveBeenCalled();
  });

  it("saves with a UUIDv7 idempotency key that works without randomUUID", async () => {
    auth.mockReturnValue({
      user: {
        isTenantOwner: false,
        permissions: ["trade.pricing.view_cost", "trade.pricing.manage"],
      },
    });
    patch.mockResolvedValue({ data: {} });
    write.mockImplementation(async (operation: () => Promise<unknown>) => {
      await operation();
      return { ok: true, replayed: false };
    });
    const { result } = renderHook(() => useItemStandardCost(ITEM_ID, true));
    await waitFor(() => expect(result.current.cost?.standardCost).toBe("12.50"));

    let saved = false;
    await act(async () => {
      saved = await result.current.save("13.25");
    });

    expect(saved).toBe(true);
    const options = patch.mock.calls[0]?.[2] as {
      headers?: Record<string, string>;
    } | undefined;
    expect(isUUIDv7(options?.headers?.["x-idempotency-key"] ?? "")).toBe(true);
  });
});
