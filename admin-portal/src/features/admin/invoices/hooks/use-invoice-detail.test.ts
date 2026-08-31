// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreSnapshot, Invoice } from "../types/invoices";

const { authMock, getMock, updateMock, issueMock, voidMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: [
        "admin.invoices.read",
        "admin.invoices.update",
        "admin.invoices.critical",
        "admin.invoices.void",
      ],
    } as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  getMock: vi.fn(),
  updateMock: vi.fn(),
  issueMock: vi.fn(),
  voidMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/invoices-api", () => ({
  invoicesApi: {
    get: getMock,
    update: updateMock,
    issue: issueMock,
    void: voidMock,
  },
}));

import { useInvoiceDetail } from "./use-invoice-detail";

const INVOICE_ID = "019f0000-0000-7000-8000-000000000001";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function invoice(status: Invoice["status"] = "DRAFT"): Invoice {
  return {
    id: INVOICE_ID,
    subscriptionId: "019f0000-0000-7000-8000-000000000002",
    tenantId: "019f0000-0000-7000-8000-000000000003",
    tenant: null,
    number: "INV-2026-0001",
    status,
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
    issuedAt: status === "DRAFT" ? null : TIMESTAMP,
    dueAt: "2026-09-10T00:00:00.000Z",
    paidAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lines: [
      {
        id: "019f0000-0000-7000-8000-000000000004",
        invoiceId: INVOICE_ID,
        description: "Platform subscription",
        descriptionI18n: {
          en: "Platform subscription",
          ar: "اشتراك المنصة",
        },
        quantity: "1.00",
        unitPrice: "20.0000",
        lineTotal: "20.0000",
      },
    ],
  };
}

function snapshot(status: Invoice["status"] = "DRAFT"): CoreSnapshot<Invoice> {
  return {
    data: invoice(status),
    correlationId: `corr-${status.toLowerCase()}`,
    responseTimestamp: TIMESTAMP,
  };
}

describe("useInvoiceDetail", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.invoices.read",
        "admin.invoices.update",
        "admin.invoices.critical",
        "admin.invoices.void",
      ],
    };
    authMock.isLoading = false;
    getMock.mockReset().mockResolvedValue(snapshot());
    updateMock.mockReset();
    issueMock.mockReset();
    voidMock.mockReset();
  });

  it("fails closed before transport without invoice read permission", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useInvoiceDetail(INVOICE_ID));

    await waitFor(() => expect(result.current.state).toBe("FORBIDDEN"));
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.snapshot).toBeNull();
  });

  it("requires both critical permissions before exposing issue and void", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.invoices.read", "admin.invoices.update", "admin.invoices.void"],
    };
    const { result } = renderHook(() => useInvoiceDetail(INVOICE_ID));

    await waitFor(() => expect(result.current.state).toBe("READY"));
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canIssue).toBe(false);
    expect(result.current.canVoid).toBe(false);
  });

  it("reuses an unchanged issue identity after an ambiguous failure and never transmits the local reason", async () => {
    issueMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_UPSTREAM_UNAVAILABLE",
        message: "Outcome is unknown",
        correlationId: "corr-unavailable",
      })
      .mockResolvedValueOnce(snapshot("ISSUED"));
    const { result } = renderHook(() => useInvoiceDetail(INVOICE_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));

    act(() => result.current.openIssue());
    act(() => {
      result.current.updateIssueDraft("reason", "Reviewed tenant and total");
      result.current.updateIssueDraft("confirmed", true);
    });
    await act(async () => {
      await result.current.issueInvoice();
    });
    await waitFor(() => expect(result.current.mutation.phase).toBe("UNAVAILABLE"));
    await waitFor(() => expect(getMock.mock.calls.length).toBeGreaterThan(1));

    await act(async () => {
      await result.current.issueInvoice();
    });
    await waitFor(() => expect(result.current.snapshot?.data.status).toBe("ISSUED"));

    expect(issueMock).toHaveBeenCalledTimes(2);
    expect(issueMock.mock.calls[0][0]).toBe(INVOICE_ID);
    expect(issueMock.mock.calls[0][1]).toEqual({
      dueAt: "2026-09-10T00:00:00.000Z",
    });
    expect(issueMock.mock.calls[0][1]).not.toHaveProperty("reason");
    expect(issueMock.mock.calls[0][2]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(issueMock.mock.calls[1][2]).toBe(issueMock.mock.calls[0][2]);
  });

  it("does not let a stale read overwrite a newer command response", async () => {
    let resolveStale: ((value: CoreSnapshot<Invoice>) => void) | undefined;
    getMock
      .mockResolvedValueOnce(snapshot())
      .mockReturnValueOnce(
        new Promise<CoreSnapshot<Invoice>>((resolve) => {
          resolveStale = resolve;
        }),
      );
    issueMock.mockResolvedValue(snapshot("ISSUED"));
    const { result } = renderHook(() => useInvoiceDetail(INVOICE_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));

    act(() => result.current.refresh());
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    act(() => result.current.openIssue());
    act(() => {
      result.current.updateIssueDraft("reason", "Reviewed tenant and total");
      result.current.updateIssueDraft("confirmed", true);
    });
    await act(async () => {
      await result.current.issueInvoice();
    });
    expect(result.current.snapshot?.data.status).toBe("ISSUED");

    await act(async () => resolveStale?.(snapshot("DRAFT")));
    expect(result.current.snapshot?.data.status).toBe("ISSUED");
  });
});
