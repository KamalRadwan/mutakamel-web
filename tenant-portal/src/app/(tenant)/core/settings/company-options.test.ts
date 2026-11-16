import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  TENANT_WIDE_COMPANY,
  companyLabel,
  loadCompanyOptions,
  parseCompanyOption,
  parseCompanyOptionsPage,
} from "./company-options";

function wireCompany(index: number) {
  return {
    id: `01902001-3000-7000-8000-${String(index).padStart(12, "0")}`,
    code: `C${index}`,
    name: `Company ${index}`,
    legalName: null,
    taxNumber: null,
    currencyCode: "SAR",
    status: "ACTIVE",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function expectedCompany(index: number) {
  return {
    id: `01902001-3000-7000-8000-${String(index).padStart(12, "0")}`,
    code: `C${index}`,
    name: `Company ${index}`,
  };
}

function httpEnvelopeResponse(total: number, pageNumber: number, dataOverride?: unknown) {
  const limit = 100;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (pageNumber - 1) * limit;
  const count = Math.max(0, Math.min(limit, total - start));
  const data =
    dataOverride ??
    Array.from({ length: count }, (_, offset) => wireCompany(start + offset + 1));

  return {
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      code: "ORG_COMPANIES_LISTED",
      message: "Companies retrieved.",
      data,
      meta: {
        page: pageNumber,
        limit,
        total,
        totalPages,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1 && totalPages > 0,
      },
      correlationId: "01902001-3000-7000-8000-000000009999",
      timestamp: "2026-11-01T10:00:00.000Z",
    },
    status: 200,
    statusText: "OK",
    headers: new Headers(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("company-options contract", () => {
  it("projects validated company options from the canonical Core page envelope", () => {
    expect(parseCompanyOption(wireCompany(1))).toEqual(expectedCompany(1));
    expect(TENANT_WIDE_COMPANY).toBe("__tenant_wide__");

    const parsed = parseCompanyOptionsPage(
      {
        data: [wireCompany(1), wireCompany(2)],
        meta: {
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
      1,
    );
    expect(parsed.items).toEqual([expectedCompany(1), expectedCompany(2)]);
    expect(parsed.total).toBe(2);
  });

  it("accepts an empty first page with canonical zero-total metadata", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(httpEnvelopeResponse(0, 1));
    const result = await loadCompanyOptions(new AbortController().signal);

    expect(result).toEqual({ companies: [], isTruncated: false });
    expect(getSpy).toHaveBeenCalledTimes(1);
    const [requestUrl, requestConfig] = getSpy.mock.calls[0];
    const parsedUrl = new URL(requestUrl, "https://tenant.test");
    expect(parsedUrl.pathname).toBe("/api/tenant/core/v1/organization/companies");
    expect(Object.fromEntries(parsedUrl.searchParams.entries())).toEqual({
      page: "1",
      limit: "100",
      sortBy: "name",
      sortDir: "ASC",
      status: "ACTIVE",
    });
    expect(requestConfig).toMatchObject({
      cache: "no-store",
      suppressForbiddenToast: true,
      maxResponseBytes: 400_000,
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects legacy { items, total } shapes, missing meta, and malformed fields", async () => {
    expect(() =>
      parseCompanyOptionsPage({
        data: { items: [wireCompany(1)], total: 1 },
        meta: undefined,
      }),
    ).toThrow("Invalid Core identity response.");

    expect(() =>
      parseCompanyOptionsPage(
        {
          data: [wireCompany(1)],
          meta: { page: 2, limit: 100, total: 150, totalPages: 2, hasNext: false, hasPrev: true },
        },
        1,
      ),
    ).toThrow("Invalid Core identity response.");

    expect(() =>
      parseCompanyOptionsPage({
        data: [wireCompany(1)],
        meta: { page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ).toThrow("Invalid Core identity response.");

    expect(() =>
      parseCompanyOption({
        ...wireCompany(1),
        id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toThrow("Invalid Core identity response.");

    expect(() => parseCompanyOption({ ...wireCompany(1), code: "" })).toThrow(
      "Invalid Core identity response.",
    );
    expect(() => parseCompanyOption({ ...wireCompany(1), name: "x".repeat(121) })).toThrow(
      "Invalid Core identity response.",
    );

    vi.spyOn(axiosClient, "get").mockResolvedValueOnce({
      data: { success: true, data: { items: [wireCompany(1)], total: 1 } },
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    });
    await expect(loadCompanyOptions(new AbortController().signal)).rejects.toThrow(
      "Invalid Core identity response.",
    );
  });

  it("rejects duplicate company ids across sequential pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => wireCompany(i + 1));
    vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(httpEnvelopeResponse(101, 1, firstPage))
      .mockResolvedValueOnce(httpEnvelopeResponse(101, 2, [wireCompany(1)]));

    await expect(loadCompanyOptions(new AbortController().signal)).rejects.toThrow(
      "Invalid Core identity response.",
    );
  });

  it("fences pre-aborted signals before issuing a network call", async () => {
    const getSpy = vi.spyOn(axiosClient, "get");
    const controller = new AbortController();
    controller.abort();

    await expect(loadCompanyOptions(controller.signal)).rejects.toThrow();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("aborts mid-pagination with an ordinary AbortError without requesting the next page", async () => {
    const controller = new AbortController();
    const abortError = Object.assign(new Error("Request aborted"), { name: "AbortError" });
    expect(abortError).not.toBeInstanceOf(DOMException);

    const getSpy = vi.spyOn(axiosClient, "get").mockImplementationOnce(async () => {
      controller.abort(abortError);
      return httpEnvelopeResponse(250, 1);
    });

    await expect(loadCompanyOptions(controller.signal)).rejects.toBe(abortError);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it.each([en, ar])("resolves company names and falls back to localized unknownCompany", (t) => {
    const loaded = [expectedCompany(1)];
    expect(
      companyLabel(loaded, expectedCompany(1).id, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany),
    ).toBe("Company 1");
    expect(
      companyLabel(loaded, expectedCompany(2).id, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany),
    ).toBe(t.coreSettings.unknownCompany);
    expect(
      companyLabel(loaded, expectedCompany(2).id, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany),
    ).not.toContain(expectedCompany(2).id);
    expect(
      companyLabel(loaded, null, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany),
    ).toBe(t.coreSettings.taxTenantWide);
  });
});
