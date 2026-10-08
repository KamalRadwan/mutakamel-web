// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useItemReferenceData } from "./useItemReferenceData";

const { get, scopeHeaders } = vi.hoisted(() => ({
  get: vi.fn(),
  scopeHeaders: { "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001" },
}));

vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  tradeGet: get,
}));
vi.mock("../../useTradeScope", () => ({
  useTradeScopeRequest: (target: string) => ({
    headers: scopeHeaders,
    gap: target === "COMPANY" ? null : "unexpected-target",
  }),
}));

const OWNER_ID = "0192f3a0-0000-7000-8000-000000000002";
const TAX_ID = "0192f3a0-0000-7000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({
    data: {
      owners: [{ id: OWNER_ID, name: "Owner" }],
      taxes: [{
        id: TAX_ID,
        code: "VAT",
        name: "VAT",
        rate: "14",
        isInclusive: false,
        companyId: null,
      }],
      companyCurrencyCode: "EGP",
    },
  });
});

afterEach(cleanup);

describe("useItemReferenceData", () => {
  it("uses company-only scope and the bounded searchable reference route", async () => {
    const { result } = renderHook(() => useItemReferenceData(true));
    await waitFor(() => expect(result.current.owners).toHaveLength(1));

    expect(get).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items/reference-data?search=&limit=50",
      expect.objectContaining({
        headers: { "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001" },
      }),
    );

    act(() => result.current.search("x".repeat(121)));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get.mock.calls[1]?.[0]).toBe(
      `/api/tenant/trade/v1/items/reference-data?search=${"x".repeat(120)}&limit=50`,
    );
  });

  it("does not request reference data while its surface is closed", () => {
    renderHook(() => useItemReferenceData(false));
    expect(get).not.toHaveBeenCalled();
  });
});
