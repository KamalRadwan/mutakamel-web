import { describe, expect, it } from "vitest";
import {
  createInvoiceIntentStore,
  shouldRetainInvoiceIntent,
  stableInvoiceFingerprint,
} from "./invoice-intents";
import { readInvoicePermissions } from "./invoice-permissions";

describe("invoice permission and command policy", () => {
  it("preflights Core's ONE/ALL permission semantics exactly", () => {
    const partial = readInvoicePermissions({
      isSuperAdmin: false,
      permissions: [
        "admin.invoices.read",
        "admin.invoices.create",
        "admin.invoices.update",
        "admin.invoices.void",
      ],
    });
    expect(partial).toMatchObject({
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canIssue: false,
      canVoid: false,
    });

    const critical = readInvoicePermissions({
      isSuperAdmin: false,
      permissions: [
        "admin.invoices.update",
        "admin.invoices.void",
        "admin.invoices.critical",
      ],
    });
    expect(critical.canIssue).toBe(true);
    expect(critical.canVoid).toBe(true);
  });

  it("reuses a key only for the same logical intent", () => {
    const generated = ["key-1", "key-2", "key-3"];
    const store = createInvoiceIntentStore(() => generated.shift() ?? "unexpected");
    const first = stableInvoiceFingerprint({ b: 2, a: 1 });
    const same = stableInvoiceFingerprint({ a: 1, b: 2 });
    const changed = stableInvoiceFingerprint({ a: 1, b: 3 });

    expect(store.get("issue", first)).toBe("key-1");
    expect(store.get("issue", same)).toBe("key-1");
    expect(store.get("issue", changed)).toBe("key-2");
    store.clear("issue");
    expect(store.get("issue", changed)).toBe("key-3");
  });

  it("retains identity only for ambiguous/retryable outcomes", () => {
    expect(shouldRetainInvoiceIntent({ httpStatus: 503, errorCode: "CORE_DOWN" })).toBe(true);
    expect(shouldRetainInvoiceIntent({ httpStatus: 429, errorCode: "RATE_LIMIT" })).toBe(true);
    expect(shouldRetainInvoiceIntent({ httpStatus: 409, errorCode: "GW.IDEM.IN_FLIGHT" })).toBe(true);
    expect(shouldRetainInvoiceIntent({ httpStatus: 409, errorCode: "INVOICE_INVALID_TRANSITION" })).toBe(false);
    expect(shouldRetainInvoiceIntent({ httpStatus: 422, errorCode: "VALIDATION_ERROR" })).toBe(false);
  });
});
