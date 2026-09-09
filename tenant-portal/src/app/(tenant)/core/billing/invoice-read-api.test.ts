import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { fetchInvoice } from "./billing-contract";
import { createInvoiceReadFixture, createManualInvoiceReadFixture } from "./invoice-read.fixture";
const headers = new Headers();
const invoiceId = createInvoiceReadFixture().data.invoice.id;
afterEach(() => vi.restoreAllMocks());

describe("enabled existing Tenant invoice detail fetch", () => {
  it("uses only the canonical cookie route, exact selector and4MiB limit", async () => {
    const fixture = createInvoiceReadFixture();
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: fixture, headers, status: 200, statusText: "OK" });
    const signal = new AbortController().signal;
    await expect(fetchInvoice(invoiceId, signal)).resolves.toEqual(fixture.data);
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/billing/invoices/${invoiceId}`, {
      signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
    });
  });
  it("reads a manual invoice without retrying or inferring selected identities", async () => {
    const fixture = createManualInvoiceReadFixture();
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: fixture, headers, status: 200, statusText: "OK" });
    await expect(fetchInvoice(invoiceId)).resolves.toEqual(fixture.data);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each(["version", "invoice", "shape", "tenant-uuid"])("rejects mismatched %s without fallback", async (kind) => {
    const fixture = createInvoiceReadFixture();
    if (kind === "version") Object.assign(fixture.data, { contractVersion: 2 });
    if (kind === "invoice") fixture.data.invoice.id = fixture.data.invoice.tenantId;
    if (kind === "shape") Object.assign(fixture.data, { extra: true });
    if (kind === "tenant-uuid") fixture.data.invoice.tenantId = "not-a-tenant";
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: fixture,
      headers, status: 200, statusText: "OK" });
    await expect(fetchInvoice(invoiceId)).rejects.toThrow("could not be verified");
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("does not send malformed invoice paths", async () => {
    const spy = vi.spyOn(axiosClient, "get");
    await expect(fetchInvoice("../invoice")).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
