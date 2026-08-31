import { describe, expect, it } from "vitest";
import { parsePublicBranding } from "@/lib/branding/public-branding";
import {
  invoicePath,
  parseBillingSummary,
  parseInvoiceLine,
  parseTenantInvoice,
  parseTenantWallet,
} from "./billing-contract";
import {
  parseActiveIntent,
  parseInvoicePaymentIntent,
  parseInvoicePaymentQuote,
  parsePaymentInputCurrencies,
  parseTenantPayment,
} from "./payment-contract";
import { parseWalletLedgerEntry } from "./wallet-contract";

const UUID = "0199f2b0-1111-7222-8333-444455556666";
const OTHER_UUID = "0199f2b0-2222-7333-8444-555566667777";

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    number: "INV-0001",
    status: "ISSUED",
    purpose: "RENEWAL",
    currencyCode: "USD",
    canonicalUsd: true,
    subtotalUsd: "100.0000",
    taxTotalUsd: "14.0000",
    totalUsd: "114.0000",
    amountPaidUsd: "0.0000",
    outstandingUsd: "114.0000",
    legacyOriginalAmounts: null,
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T00:00:00.000Z",
    issuedAt: "2026-08-01T00:00:00.000Z",
    dueAt: "2026-08-15T00:00:00.000Z",
    paidAt: null,
    ...overrides,
  };
}

describe("invoice parsing", () => {
  it("keeps every money value as the exact string it arrived as", () => {
    const parsed = parseTenantInvoice(
      invoice({ totalUsd: "9007199254740993.1500", outstandingUsd: "0.0001" }),
    );
    // Number() would round this to 9007199254740992; the string must survive.
    expect(parsed.totalUsd).toBe("9007199254740993.1500");
    expect(parsed.outstandingUsd).toBe("0.0001");
  });

  it("carries legacy amounts when the invoice is not canonical USD", () => {
    const parsed = parseTenantInvoice(
      invoice({
        canonicalUsd: false,
        currencyCode: "EGP",
        subtotalUsd: null,
        taxTotalUsd: null,
        totalUsd: null,
        amountPaidUsd: null,
        outstandingUsd: null,
        legacyOriginalAmounts: {
          currencyCode: "EGP",
          subtotal: "5000.0000",
          taxTotal: "700.0000",
          total: "5700.0000",
        },
      }),
    );
    expect(parsed.totalUsd).toBeNull();
    expect(parsed.legacyOriginalAmounts?.total).toBe("5700.0000");
  });

  it("keeps an unrecognised status rather than throwing", () => {
    // A new InvoiceStatusEnum value must not blank the screen a tenant pays on.
    expect(parseTenantInvoice(invoice({ status: "ARCHIVED" })).status).toBe("ARCHIVED");
  });

  it("rejects a malformed decimal and a non-record payload", () => {
    expect(() => parseTenantInvoice(invoice({ totalUsd: "12,00" }))).toThrow();
    expect(() => parseTenantInvoice([])).toThrow();
  });

  it("refuses to build a path from a non-UUIDv7 id", () => {
    expect(() => invoicePath("../admin")).toThrow();
    expect(invoicePath(UUID)).toBe(`/api/tenant/core/v1/billing/invoices/${UUID}`);
  });

  it("reads a line's bilingual description without a language ternary at the call site", () => {
    const line = parseInvoiceLine({
      id: UUID,
      description: "Module: CRM",
      descriptionI18n: { en: "Module: CRM", ar: "الوحدة: CRM" },
      quantity: "1.00",
      unitPrice: "114.0000",
      lineTotal: "114.0000",
    });
    expect(line.descriptionAr).toBe("الوحدة: CRM");
    expect(line.descriptionEn).toBe("Module: CRM");
  });
});

describe("wallet and summary parsing", () => {
  it("reads the one USD wallet", () => {
    const wallet = parseTenantWallet({
      currencyCode: "USD",
      balanceUsd: "250.0000",
      reservedBalanceUsd: "50.0000",
      availableBalanceUsd: "200.0000",
      status: "ACTIVE",
    });
    expect(wallet.currencyCode).toBe("USD");
    expect(wallet.availableBalanceUsd).toBe("200.0000");
  });

  it("keeps an unknown access mode as unresolved rather than guessing FULL", () => {
    const summary = parseBillingSummary({
      subscription: {
        id: UUID,
        status: "PAST_DUE",
        billingCycle: "MONTHLY",
        startedAt: "2026-01-01T00:00:00.000Z",
        trialEndsAt: null,
        currentPeriodStart: "2026-08-01T00:00:00.000Z",
        currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        activationScheduledAt: null,
        totalPriceUsd: "114.0000",
        accessMode: "SOMETHING_NEW",
      },
      wallet: {
        currencyCode: "USD",
        balanceUsd: "0.0000",
        reservedBalanceUsd: "0.0000",
        availableBalanceUsd: "0.0000",
        status: "ACTIVE",
      },
      outstandingInvoice: invoice(),
    });
    expect(summary.subscription.accessMode).toBeNull();
    expect(summary.outstandingInvoice?.number).toBe("INV-0001");
  });
});

describe("payment flow parsing", () => {
  it("reads a quote's frozen figures and its expiry", () => {
    const quote = parseInvoicePaymentQuote({
      quoteId: UUID,
      invoiceId: OTHER_UUID,
      invoiceOutstandingUsd: "114.0000",
      walletAppliedUsd: "14.0000",
      gatewayAmountUsd: "100.0000",
      providerAmount: "4850.0000",
      providerCurrencyCode: "EGP",
      currencyUnitsPerUsd: "48.5000",
      rateRevisionId: null,
      rateObservedAt: "2026-08-31T09:00:00.000Z",
      expiresAt: "2026-08-31T09:10:00.000Z",
    });
    expect(quote.providerAmount).toBe("4850.0000");
    expect(quote.expiresAt).toBe("2026-08-31T09:10:00.000Z");
  });

  it("accepts only an https checkout URL", () => {
    const base = {
      paymentId: UUID,
      status: "PENDING",
      requiresExternalPayment: true,
      expiresAt: null,
      invoiceStatus: "ISSUED",
      subscriptionStatus: "ACTIVE",
    };
    expect(parseInvoicePaymentIntent({ ...base, checkoutUrl: null }).checkoutUrl).toBeNull();
    expect(
      parseInvoicePaymentIntent({ ...base, checkoutUrl: "https://pay.example/x" }).checkoutUrl,
    ).toBe("https://pay.example/x");
    expect(() =>
      parseInvoicePaymentIntent({ ...base, checkoutUrl: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("treats a null active intent as no hold, not as a failure", () => {
    expect(parseActiveIntent(null)).toBeNull();
    const active = parseActiveIntent({
      paymentId: UUID,
      status: "REQUIRES_REVIEW",
      checkoutUrl: null,
      requiresExternalPayment: true,
      expiresAt: null,
      recoveryAction: "RECONCILIATION_REQUIRED",
    });
    expect(active?.recoveryAction).toBe("RECONCILIATION_REQUIRED");
  });

  it("reads a payment status projection without coercing any amount", () => {
    const payment = parseTenantPayment({
      paymentId: UUID,
      purpose: "WALLET_TOP_UP",
      provider: "PAYMOB",
      status: "SUCCEEDED",
      invoiceId: null,
      invoiceStatus: null,
      subscriptionStatus: null,
      providerAmount: "4850.0000",
      providerCurrencyCode: "EGP",
      settlementAmountUsd: "100.0000",
      walletAppliedUsd: "0.0000",
      totalAppliedUsd: "100.0000",
      createdAt: "2026-08-31T09:00:00.000Z",
      updatedAt: "2026-08-31T09:05:00.000Z",
    });
    expect(payment.invoiceId).toBeNull();
    expect(payment.totalAppliedUsd).toBe("100.0000");
  });

  it("reads a ledger entry's FX evidence, keeping USD as the only balance", () => {
    const entry = parseWalletLedgerEntry({
      id: UUID,
      walletId: OTHER_UUID,
      direction: "CREDIT",
      amountUsd: "100.0000",
      sourceAmount: "4850.0000",
      sourceCurrencyCode: "EGP",
      currencyUnitsPerUsd: "48.5000",
      rateRevisionId: null,
      rateObservedAt: null,
      balanceAfterUsd: "350.0000",
      reason: "TOP_UP",
      actor: { type: "TENANT", id: null },
      referenceType: null,
      referenceId: null,
      note: null,
      createdAt: "2026-08-31T09:05:00.000Z",
    });
    expect(entry.balanceAfterUsd).toBe("350.0000");
    expect(entry.sourceCurrencyCode).toBe("EGP");
  });

  it("reads the collection currencies with USD marked as the wallet currency", () => {
    const view = parsePaymentInputCurrencies({
      walletCurrencyCode: "USD",
      items: [
        { currencyCode: "USD", isBaseCurrency: true },
        { currencyCode: "EGP", isBaseCurrency: false },
      ],
      total: 2,
    });
    expect(view.walletCurrencyCode).toBe("USD");
    expect(view.items.map((item) => item.currencyCode)).toEqual(["USD", "EGP"]);
  });
});

describe("public branding parsing", () => {
  it("reads exactly the fields PublicBrandingView carries", () => {
    const branding = parsePublicBranding({
      appName: "Acme",
      tabTitle: "Acme Portal",
      primaryColor: "#2563eb",
      secondaryColor: null,
      fontFamily: null,
      loginHtml: "<p>Welcome</p>",
      logoUrl: "/api/tenant/core/v1/branding/public/logo",
      iconUrl: null,
    });
    expect(branding.logoUrl).toBe("/api/tenant/core/v1/branding/public/logo");
    expect(branding.iconUrl).toBeNull();
    expect(branding.loginHtml).toBe("<p>Welcome</p>");
  });

  it("refuses an asset path that is not the exact route Core emits", () => {
    expect(() =>
      parsePublicBranding({
        appName: null,
        tabTitle: null,
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        loginHtml: null,
        logoUrl: "https://evil.example/logo.png",
        iconUrl: null,
      }),
    ).toThrow();
  });
});
