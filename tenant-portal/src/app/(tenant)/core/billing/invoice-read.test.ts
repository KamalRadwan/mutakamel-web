import { describe, expect, it } from "vitest";
import { createInvoiceReadFixture, createManualInvoiceReadFixture } from "./invoice-read.fixture";
import { parseInvoiceRead } from "./invoice-read";

const target = { invoiceId: createInvoiceReadFixture().data.invoice.id, tenantId: createInvoiceReadFixture().data.invoice.tenantId };
const parse = (value: unknown) => parseInvoiceRead(value, target);
function change(value: unknown, path: string, replacement: unknown) {
  const keys = path.split(".");
  let row = value as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) row = row[key] as Record<string, unknown>;
  row[keys[keys.length - 1]] = replacement;
}

describe("Tenant retained invoice boundary (not a live request)", () => {
  it("keeps exact App/Addon amounts, selected identities and accepted users distinct from quantity", () => {
    const source = createInvoiceReadFixture();
    const result = parse(source);
    expect(result).toEqual(source.data);
    expect(result.lines[1]).toMatchObject({ quantity: "1.00", acceptedSeats: 10, lineTotal: "21.2340", sourceKind: "ADDON" });
  });
  it("accepts historical null identities and exact half-up rounding without fabricating USD settlement", () => {
    const source = createManualInvoiceReadFixture();
    expect(parse(source)).toEqual(source.data);
  });
  it("refuses missing nested price evidence even with complete App/Addon identity", () => {
    const source = createInvoiceReadFixture();
    for (const line of source.data.lines) change(line, "acceptedPricingSnapshot", { ...line.acceptedPricingSnapshot,
      evidenceStatus: "LEGACY_UNAVAILABLE", priceRevision: null, breakdown: null });
    expect(() => parse(source)).toThrow();
  });
  it("accepts dynamic graduated brackets and original sub-cent prices", () => {
    const source = createInvoiceReadFixture();
    source.data.lines[1].acceptedPricingSnapshot.breakdown = [
      { minUsers: 1, maxUsers: 3, chargedUsers: 3, unitPriceUsd: "7.0780", amountUsd: "21.2340" },
      { minUsers: 4, maxUsers: null, chargedUsers: 7, unitPriceUsd: "0.0000", amountUsd: "0.0000" },
    ];
    expect(parse(source)).toEqual(source.data);
  });
  it.each([
    ["extra", true], ["success", false], ["data.extra", true], ["data.contractVersion", 1], ["data.invoice.extra", true],
    ["data.invoice.id", target.tenantId], ["data.invoice.tenantId", target.invoiceId], ["data.invoice.status", "NEW"],
    ["data.invoice.purpose", "UNKNOWN"], ["data.invoice.number", " "], ["data.invoice.createdAt", "yesterday"],
    ["data.invoice.currencyCode", "EGP"], ["data.invoice.subtotal", "95.555"], ["data.invoice.taxTotal", "-1.0000"],
    ["data.invoice.total", "96.5549"], ["data.invoice.amountPaidUsd", "100000000000000.0000"],
    ["data.invoice.settlementCurrencyCode", "EGP"], ["data.invoice.settlementTaxTotalUsd", null],
    ["data.invoice.settlementTotalUsd", "96.5551"], ["data.invoice.periodStart", null],
    ["data.invoice.periodEnd", "2026-09-01T00:00:00.000Z"], ["data.lines", []],
    ["data.lines.0.id", createInvoiceReadFixture().data.lines[1].id], ["data.lines.0.invoiceId", target.tenantId],
    ["data.lines.0.quantity", "10.00"], ["data.lines.0.description", ""], ["data.lines.0.acceptedSeats", 100001],
    ["data.lines.0.addonSelectionId", target.invoiceId], ["data.lines.1.baseItemId", target.invoiceId],
    ["data.lines.1.addonSelectionId", createInvoiceReadFixture().data.lines[0].baseItemId],
    ["data.lines.1.addonDefinitionVersionId", null], ["data.lines.1.acceptedSeats", 11],
    ["data.lines.1.commercialEvidenceStatus", "LEGACY_UNAVAILABLE"], ["data.lines.1.lineTotal", "21.2339"],
    ["data.lines.1.acceptedPricingSnapshot.extra", true], ["data.lines.1.acceptedPricingSnapshot.billingCycle", "ANNUAL"],
    ["data.lines.1.acceptedPricingSnapshot.recurringAmountUsd", "21.2339"], ["data.lines.1.acceptedPricingSnapshot.priceRevision", "a".repeat(64)],
    ["data.lines.0.acceptedPricingSnapshot.priceRevision", target.invoiceId], ["data.lines.0.acceptedPricingSnapshot.breakdown", []],
    ["data.lines.1.acceptedPricingSnapshot.breakdown.0.minUsers", 2], ["data.lines.1.acceptedPricingSnapshot.breakdown.0.chargedUsers", 9],
    ["data.lines.1.acceptedPricingSnapshot.breakdown.0.amountUsd", "21.2341"], ["data.lines.1.acceptedPricingSnapshot.breakdown.0.unitPriceUsd", "2.1235"],
    ["data.lines.1.acceptedPricingSnapshot.breakdown.0.extra", true], ["data.lines.1.acceptedPricingSnapshot.evidenceStatus", "LEGACY_UNAVAILABLE"],
  ])("rejects inconsistent or open data at %s", (path, value) => {
    const source = createInvoiceReadFixture(); change(source, String(path), value);
    expect(() => parse(source)).toThrow("could not be verified");
  });
  it.each(["sourceKind", "baseItemId", "addonSelectionId", "addonDefinitionVersionId", "acceptedSeats", "acceptedPricingSnapshot"])("requires legacy %s to remain explicitly null", (key) => {
    const source = createManualInvoiceReadFixture(); change(source, `data.lines.0.${key}`, "invented");
    expect(() => parse(source)).toThrow();
  });
  it.each(["0.00", "0.5", "10000000000.00"])("rejects noncanonical or out-of-range legacy quantity %s", (quantity) => {
    const source = createManualInvoiceReadFixture(); source.data.lines[0].quantity = quantity;
    expect(() => parse(source)).toThrow();
  });
  it("rejects removed discriminators, null, cycles, huge input and invalid target", () => {
    const source = createInvoiceReadFixture();
    expect(() => parseInvoiceRead({ ...source, data: { ...source.data, contractVersion: 2 } }, target)).toThrow();
    expect(() => parseInvoiceRead({ ...source, data: { ...source.data, commercialEvidenceStatus: "COMPLETE" } }, target)).toThrow();
    expect(() => parseInvoiceRead(source, { ...target, tenantId: "unknown" })).toThrow();
    expect(() => parse({ success: true, data: { ...source.data.invoice, lines: source.data.lines } })).toThrow();
    expect(() => parse(null)).toThrow();
    expect(() => parse({ huge: "x".repeat(4 * 1024 * 1024) })).toThrow();
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    expect(() => parse(cyclic)).toThrow();
  });
  it("refuses duplicate parent items and repeated Addon selections", () => {
    const source = createInvoiceReadFixture();
    source.data.lines.push({ ...source.data.lines[0], id: target.tenantId });
    Object.assign(source.data.invoice, { subtotal: "169.8760", total: "170.8760" });
    expect(() => parse(source)).toThrow();
    source.data.lines.pop(); source.data.lines.push({ ...source.data.lines[1], id: target.tenantId });
    Object.assign(source.data.invoice, { subtotal: "116.7890", total: "117.7890" });
    expect(() => parse(source)).toThrow();
  });
  it("accepts the full bounded historical line set and refuses its 201st row", () => {
    const source = createManualInvoiceReadFixture();
    source.data.lines = Array.from({ length: 200 }, (_, index) => ({ ...source.data.lines[0],
      id: `01a0793f-1c93-7ae2-ae43-${index.toString(16).padStart(12, "0")}`, unitPrice: "0.0000", lineTotal: "0.0000" }));
    Object.assign(source.data.invoice, { subtotal: "0.0000", total: "0.0000" });
    expect(parse(source).lines).toHaveLength(200);
    source.data.lines.push({ ...source.data.lines[0], id: "01a0793f-1c93-7ae2-ae43-ffffffffffff" });
    expect(() => parse(source)).toThrow();
  });
  it("accepts maximum storage-scale money without converting decimal strings to numbers", () => {
    const source = createManualInvoiceReadFixture();
    const maximum = "99999999999999.9999";
    Object.assign(source.data.lines[0], { quantity: "1.00", unitPrice: maximum, lineTotal: maximum });
    Object.assign(source.data.invoice, { subtotal: maximum, total: maximum });
    expect(parse(source).invoice.total).toBe(maximum);
  });
});
