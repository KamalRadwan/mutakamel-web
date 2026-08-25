import { describe, expect, it } from "vitest";
import {
  buildGenerateInvoiceDto,
  buildIssueInvoiceDto,
  buildUpdateInvoiceDto,
  localDateTimeToDate,
  validateCriticalInvoiceDraft,
  validateGenerateInvoice,
  validateInvoiceEdit,
  validateInvoiceFilters,
} from "./invoice-validation";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";

describe("invoice input validation", () => {
  it("validates list filters at Core's bounds", () => {
    expect(
      validateInvoiceFilters({
        search: "x".repeat(201),
        tenantId: "v4-is-not-supported",
        status: "",
        sortBy: "createdAt",
        sortDir: "DESC",
        limit: "30",
      }),
    ).toEqual({
      search: "SEARCH_TOO_LONG",
      tenantId: "INVALID_UUID_V7",
      limit: "INVALID_LIMIT",
    });
  });

  it("requires a valid increasing generation period and emits only Core fields", () => {
    const invalid = {
      tenantId: TENANT_ID,
      periodStart: "2026-08-02T12:00",
      periodEnd: "2026-08-02T11:59",
      purpose: "MANUAL" as const,
    };
    expect(validateGenerateInvoice(invalid)).toEqual({
      periodRange: "INVALID_PERIOD_RANGE",
    });

    const valid = { ...invalid, periodEnd: "2026-08-03T11:59" };
    expect(buildGenerateInvoiceDto(valid)).toEqual({
      tenantId: TENANT_ID,
      periodStart: localDateTimeToDate(valid.periodStart)?.toISOString(),
      periodEnd: localDateTimeToDate(valid.periodEnd)?.toISOString(),
      currencyCode: "USD",
      purpose: "MANUAL",
    });
  });

  it.each([
    ["0", "0", "INVALID_QUANTITY", undefined],
    ["0.00", "0", "INVALID_QUANTITY", undefined],
    ["0.01", "0", undefined, undefined],
    ["9999999999.99", "99999999999999.9999", undefined, undefined],
    ["10000000000", "100000000000000", "INVALID_QUANTITY", "INVALID_UNIT_PRICE"],
    ["1.001", "1.00000", "INVALID_QUANTITY", "INVALID_UNIT_PRICE"],
  ])(
    "enforces exact quantity and unit-price decimals (%s / %s)",
    (quantity, unitPrice, quantityError, unitPriceError) => {
      const errors = validateInvoiceEdit({
        lines: [
          { clientId: "line-1", description: "Service", quantity, unitPrice },
        ],
        dueAt: "",
      });
      expect(errors["lines.0.quantity"]).toBe(quantityError);
      expect(errors["lines.0.unitPrice"]).toBe(unitPriceError);
    },
  );

  it("does not pretend an existing due date can be cleared", () => {
    expect(
      validateInvoiceEdit(
        {
          lines: [
            {
              clientId: "line-1",
              description: "Service",
              quantity: "1.00",
              unitPrice: "10.0000",
            },
          ],
          dueAt: "",
        },
        true,
      ),
    ).toEqual({ dueAt: "DUE_DATE_CANNOT_CLEAR" });
  });

  it("trims manual lines and never adds operator-only fields to Core DTOs", () => {
    expect(
      buildUpdateInvoiceDto({
        lines: [
          {
            clientId: "browser-only",
            description: "  Service  ",
            quantity: "1.00",
            unitPrice: "10.0000",
          },
        ],
        dueAt: "",
      }),
    ).toEqual({
      lines: [
        { description: "Service", quantity: "1.00", unitPrice: "10.0000" },
      ],
    });

    const critical = {
      dueAt: "2026-08-01T12:00",
      reason: "Reviewed tenant and amount",
      confirmed: true,
    };
    expect(validateCriticalInvoiceDraft(critical, true)).toEqual({});
    expect(buildIssueInvoiceDto(critical)).toEqual({
      dueAt: localDateTimeToDate(critical.dueAt)?.toISOString(),
    });
  });

  it("requires a bounded local reason and explicit confirmation for critical commands", () => {
    expect(
      validateCriticalInvoiceDraft(
        { dueAt: "", reason: " ", confirmed: false },
        false,
      ),
    ).toEqual({
      reason: "REASON_REQUIRED",
      confirmed: "CONFIRMATION_REQUIRED",
    });
    expect(
      validateCriticalInvoiceDraft(
        { dueAt: "", reason: "x".repeat(501), confirmed: true },
        false,
      ),
    ).toEqual({ reason: "REASON_TOO_LONG" });
  });
});
