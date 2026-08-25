import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock, patch: patchMock },
}));

import { invoicesApi, serializeInvoiceQuery } from "./invoices-api";

const INVOICE_ID = "019f0000-0000-7000-8000-000000000001";
const TENANT_ID = "019f0000-0000-7000-8000-000000000002";
const IDEMPOTENCY_KEY = "019f0000-0000-7000-8000-000000000003";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    data: {
      success: true,
      data,
      ...(meta ? { meta } : {}),
      correlationId: "corr-invoice",
      timestamp: TIMESTAMP,
    },
  };
}

function invoice() {
  return {
    id: INVOICE_ID,
    subscriptionId: "019f0000-0000-7000-8000-000000000004",
    tenantId: TENANT_ID,
    number: "INV-2026-0001",
    status: "DRAFT",
    purpose: "MANUAL",
    currencyCode: "USD",
    subtotal: "20.0000",
    taxTotal: "0.0000",
    total: "20.0000",
    settlementCurrencyCode: "USD",
    settlementSubtotalUsd: "20.0000",
    settlementTaxTotalUsd: "0.0000",
    settlementTotalUsd: "20.0000",
    amountPaidUsd: "0.0000",
    fxUnitsPerUsd: "1.000000000000",
    fxRateRevisionId: null,
    fxObservedAt: TIMESTAMP,
    settlementLockedAt: TIMESTAMP,
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.000Z",
    issuedAt: null,
    dueAt: "2026-09-10T00:00:00.000Z",
    paidAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lines: [
      {
        id: "019f0000-0000-7000-8000-000000000005",
        invoiceId: INVOICE_ID,
        description: "Platform subscription",
        quantity: "1.00",
        unitPrice: "20.0000",
        lineTotal: "20.0000",
      },
    ],
  };
}

describe("invoicesApi", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  it("serializes only explicitly supplied list values", () => {
    expect(
      serializeInvoiceQuery({
        page: 2,
        limit: 25,
        search: "INV-2026",
        sortBy: "createdAt",
        sortDir: "DESC",
      }),
    ).toBe("?page=2&limit=25&search=INV-2026&sortBy=createdAt&sortDir=DESC");
  });

  it("calls both exact read routes with no-store and strict projections", async () => {
    const signal = new AbortController().signal;
    getMock
      .mockResolvedValueOnce(
        envelope([], {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }),
      )
      .mockResolvedValueOnce(envelope(invoice()));

    await invoicesApi.list(
      { page: 1, limit: 20, sortBy: "createdAt", sortDir: "DESC" },
      signal,
    );
    const detail = await invoicesApi.get(INVOICE_ID, signal);

    expect(getMock.mock.calls).toEqual([
      [
        "/api/admin/core/v1/invoices?page=1&limit=20&sortBy=createdAt&sortDir=DESC",
        { cache: "no-store", signal },
      ],
      [`/api/admin/core/v1/invoices/${INVOICE_ID}`, { cache: "no-store", signal }],
    ]);
    expect(detail.data.id).toBe(INVOICE_ID);
  });

  it("calls all four exact command routes with the caller-owned UUIDv7 header", async () => {
    postMock.mockResolvedValue(envelope(invoice()));
    patchMock.mockResolvedValue(envelope(invoice()));
    const generateDto = {
      tenantId: TENANT_ID,
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.000Z",
      currencyCode: "USD",
      purpose: "MANUAL" as const,
    };
    const updateDto = {
      lines: [
        {
          description: "Platform subscription",
          quantity: "1.00",
          unitPrice: "20.0000",
        },
      ],
      dueAt: "2026-09-10T00:00:00.000Z",
    };
    const issueDto = { dueAt: "2026-09-10T00:00:00.000Z" };
    const config = { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } };

    await invoicesApi.generate(generateDto, IDEMPOTENCY_KEY);
    await invoicesApi.update(INVOICE_ID, updateDto, IDEMPOTENCY_KEY);
    await invoicesApi.issue(INVOICE_ID, issueDto, IDEMPOTENCY_KEY);
    await invoicesApi.void(INVOICE_ID, IDEMPOTENCY_KEY);

    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/invoices/${INVOICE_ID}`,
      updateDto,
      config,
    );
    expect(postMock.mock.calls).toEqual([
      ["/api/admin/core/v1/invoices/generate", generateDto, config],
      [`/api/admin/core/v1/invoices/${INVOICE_ID}/issue`, issueDto, config],
      [`/api/admin/core/v1/invoices/${INVOICE_ID}/void`, undefined, config],
    ]);
  });

  it("fails before transport for non-v7 resource or command identifiers", async () => {
    await expect(invoicesApi.get("not-an-id")).rejects.toThrow(
      "INVALID_ADMIN_INVOICE_ID",
    );
    await expect(
      invoicesApi.void(INVOICE_ID, "not-a-command-id"),
    ).rejects.toThrow("INVALID_ADMIN_INVOICE_IDEMPOTENCY_KEY");
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });
});
