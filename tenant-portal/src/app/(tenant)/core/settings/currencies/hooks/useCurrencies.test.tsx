// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CURRENCY_PAGE_SIZE, currenciesListPath, currencyPath, type Currency } from "../currency-contract";
import { useCurrencies } from "./useCurrencies";

const { coreGet, coreDelete, toast } = vi.hoisted(() => ({
  coreGet: vi.fn(),
  coreDelete: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(),
  },
}));

vi.mock("@/design-system", () => ({ useCan: () => true, useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../../core-api", () => ({
  coreGet,
  coreDelete,
  corePatch: vi.fn(),
  corePost: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const currencies: Currency[] = Array.from({ length: 41 }, (_, index) => ({
  id: `01902001-3000-7000-8000-${String(index + 1).padStart(12, "0")}`,
  code: "EUR",
  name: `Currency ${index + 1}`,
  symbol: null,
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
}));

describe("useCurrencies pagination recovery", () => {
  it.each([
    { before: 21, after: 20 },
    { before: 41, after: 40 },
    { before: 21, after: 0 },
  ])("reloads the last valid filtered page when total falls from $before to $after", async ({ before, after }) => {
    let total = before;
    coreGet.mockImplementation(async (path: string) => {
      const query = new URL(path, "https://portal.example").searchParams;
      const page = Number(query.get("page"));
      const start = (page - 1) * CURRENCY_PAGE_SIZE;
      return {
        data: { items: currencies.slice(start, Math.min(start + CURRENCY_PAGE_SIZE, total)), total, page, limit: CURRENCY_PAGE_SIZE },
      };
    });
    coreDelete.mockImplementation(async () => { total = after; });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    act(() => {
      result.current.setStatusFilter("ACTIVE");
      result.current.setSearch("Currency");
      result.current.setSort({ id: "name", direction: "desc" });
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    const originalPage = Math.ceil(before / CURRENCY_PAGE_SIZE);
    act(() => result.current.setPage(originalPage));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });
    const target = result.current.items[0]!;
    act(() => result.current.openDeactivate(target));
    await act(async () => { await result.current.deactivate(); });

    const lastPage = Math.max(1, Math.ceil(after / CURRENCY_PAGE_SIZE));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.pageInfo).toEqual({ page: lastPage, limit: CURRENCY_PAGE_SIZE, total: after });
      expect(result.current.items).toHaveLength(Math.min(after, CURRENCY_PAGE_SIZE));
    });
    expect(coreDelete).toHaveBeenCalledWith(currencyPath(target.id), { maxResponseBytes: 10_000 });
    expect(coreGet).toHaveBeenLastCalledWith(
      currenciesListPath(lastPage, "ACTIVE", "Currency", "name", "DESC"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.statusFilter).toBe("ACTIVE");
    expect(result.current.search).toBe("Currency");
    expect(result.current.sort).toEqual({ id: "name", direction: "desc" });
    expect(result.current.queryError).toBeNull();
  });
});
