import { describe, expect, it } from "vitest";
import { readInvoicePage, readInvoiceSnapshot } from "./invoice-readers";

const INVOICE_ID = "019f0000-0000-7000-8000-000000000001";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function row(detail = false): Record<string, unknown> {
  return {
    id: INVOICE_ID,
    subscriptionId: "019f0000-0000-7000-8000-000000000002",
    tenantId: "019f0000-0000-7000-8000-000000000003",
    number: "INV-2026-0001",
    status: "DRAFT",
    purpose: "MANUAL",
    currencyCode: "USD",
    subtotal: "12345678901234.0000",
    taxTotal: "0.0000",
    total: "12345678901234.0000",
    settlementCurrencyCode: "USD",
    settlementSubtotalUsd: null,
    settlementTaxTotalUsd: null,
    settlementTotalUsd: null,
    amountPaidUsd: "0.0000",
    fxUnitsPerUsd: null,
    fxRateRevisionId: null,
    fxObservedAt: null,
    settlementLockedAt: null,
    periodStart: null,
    periodEnd: null,
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    providerSecret: "must-not-project",
    ...(detail
      ? {
          lines: [
            {
              id: "019f0000-0000-7000-8000-000000000004",
              invoiceId: INVOICE_ID,
              description: "Consulting",
              descriptionI18n: { en: "Consulting", ar: "استشارات" },
              quantity: "0.01",
              unitPrice: "0",
              lineTotal: "0",
              internalCost: "999.0000",
            },
          ],
        }
      : {}),
  };
}

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    correlationId: "corr-invoice",
    timestamp: TIMESTAMP,
  };
}

describe("invoice wire readers", () => {
  it("reads canonical pagination without coercing decimal strings", () => {
    const result = readInvoicePage(
      envelope([row()], {
        page: 2,
        limit: 20,
        total: 21,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      }),
    );

    expect(result.data).toMatchObject({ page: 2, total: 21, hasPrev: true });
    expect(result.data.items[0].total).toBe("12345678901234.0000");
    expect(result.data.items[0]).not.toHaveProperty("providerSecret");
    expect(result.correlationId).toBe("corr-invoice");
  });

  it("reads detail lines through a safe localized allowlist", () => {
    const result = readInvoiceSnapshot(envelope(row(true)));

    expect(result.data.lines).toEqual([
      {
        id: "019f0000-0000-7000-8000-000000000004",
        invoiceId: INVOICE_ID,
        description: "Consulting",
        descriptionI18n: { en: "Consulting", ar: "استشارات" },
        quantity: "0.01",
        unitPrice: "0",
        lineTotal: "0",
      },
    ]);
    expect(result.data.lines?.[0]).not.toHaveProperty("internalCost");
  });

  it("projects the tenant identity a list row renders and nulls it when absent", () => {
    const named = {
      ...row(),
      tenant: {
        id: "019f0000-0000-7000-8000-000000000003",
        name: "acme-retail",
        companyName: "Acme Retail LLC",
        status: "ACTIVE",
        ownerEmail: "must-not-project@example.com",
      },
    };
    const result = readInvoicePage(
      envelope([named, row()], {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
    );

    expect(result.data.items[0].tenant).toEqual({
      id: "019f0000-0000-7000-8000-000000000003",
      name: "acme-retail",
      companyName: "Acme Retail LLC",
      status: "ACTIVE",
    });
    expect(result.data.items[0].tenant).not.toHaveProperty("ownerEmail");
    expect(result.data.items[1].tenant).toBeNull();
  });

  it("supports Core's direct pre-interceptor pagination shape", () => {
    const result = readInvoicePage(
      envelope({
        items: [],
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }),
    );
    expect(result.data.items).toEqual([]);
  });

  it.each([
    ["numeric money", { ...row(true), total: 10 }],
    ["unknown status", { ...row(true), status: "CANCELLED" }],
    ["missing detail lines", row(false)],
    ["non-v7 identifier", { ...row(true), tenantId: "tenant-1" }],
    [
      "a tenant summary billing another tenant",
      {
        ...row(true),
        tenant: {
          id: "019f0000-0000-7000-8000-0000000000ff",
          name: "other",
          companyName: "Other LLC",
          status: "ACTIVE",
        },
      },
    ],
    [
      "an unknown tenant status",
      {
        ...row(true),
        tenant: {
          id: "019f0000-0000-7000-8000-000000000003",
          name: "acme-retail",
          companyName: "Acme Retail LLC",
          status: "ARCHIVED",
        },
      },
    ],
  ])("fails closed for %s", (_label, malformed) => {
    expect(() => readInvoiceSnapshot(envelope(malformed))).toThrow(
      "INVALID_ADMIN_INVOICE_RESPONSE",
    );
  });
});
