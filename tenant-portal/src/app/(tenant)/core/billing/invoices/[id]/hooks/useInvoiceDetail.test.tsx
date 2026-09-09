// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { createInvoiceReadFixture } from "../../../invoice-read.fixture";
import { parseInvoiceRead, type InvoiceRead } from "../../../invoice-read";
const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: true }, isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const reads = vi.hoisted(() => ({ invoice: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("../../../billing-contract", () => ({ fetchInvoice: reads.invoice }));
const { useInvoiceDetail } = await import("./useInvoiceDetail");
const fixture = createInvoiceReadFixture();
const view = parseInvoiceRead(fixture, { invoiceId: fixture.data.invoice.id });
const invoiceId = view.invoice.id;
const failure = (status: number) => new TenantApiClientError("rejected", { status, statusText: "Rejected", headers: new Headers(), data: {} });
function deferred() {
  let resolve!: (value: InvoiceRead) => void;
  const promise = new Promise<InvoiceRead>((accept) => { resolve = accept; });
  return { promise, resolve };
}
beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: true }; auth.isAuthenticated = true; auth.realtimeAuthGeneration = "session-1";
  reads.invoice.mockReset().mockResolvedValue(view);
});
afterEach(cleanup);

describe("exact invoice owner/session lifecycle", () => {
  it("loads the complete retained view for the exact owner and target", async () => {
    const { result } = renderHook(() => useInvoiceDetail(invoiceId));
    expect(result.current.view).toBeNull(); expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.view).toBe(view));
    expect(reads.invoice.mock.calls[0][0]).toBe(invoiceId);
  });
  it.each(["non-owner", "unauthenticated", "no-actor"])("makes no financial request when %s", (kind) => {
    if (kind === "non-owner") auth.user.isTenantOwner = false;
    if (kind === "unauthenticated") auth.isAuthenticated = false;
    if (kind === "no-actor") auth.user.id = "";
    const { result } = renderHook(() => useInvoiceDetail(invoiceId));
    expect(result.current.denied).toBe(true); expect(reads.invoice).not.toHaveBeenCalled();
  });
  it("resolves malformed links as not-found without a request", () => {
    const { result } = renderHook(() => useInvoiceDetail("invalid"));
    expect(result.current.isNotFound).toBe(true); expect(result.current.isLoading).toBe(false);
    expect(reads.invoice).not.toHaveBeenCalled();
  });
  it.each([403, 404, 409, 503])("clears financial facts on server%s", async (status) => {
    const { result } = renderHook(() => useInvoiceDetail(invoiceId));
    await waitFor(() => expect(result.current.view).toBe(view));
    reads.invoice.mockRejectedValueOnce(failure(status)); act(() => result.current.reload());
    expect(result.current.view).toBeNull();
    await waitFor(() => expect(result.current.error?.status).toBe(status));
    expect(result.current.view).toBeNull(); expect(result.current.denied).toBe(status === 403);
    expect(result.current.isNotFound).toBe(status === 404);
  });
  it.each(["actor", "session", "owner", "authentication"])("hides old evidence immediately on %s change", async (kind) => {
    const { result, rerender } = renderHook(() => useInvoiceDetail(invoiceId));
    await waitFor(() => expect(result.current.view).toBe(view));
    reads.invoice.mockImplementation(() => new Promise(() => undefined));
    if (kind === "actor") auth.user.id = "new-actor";
    if (kind === "session") auth.realtimeAuthGeneration = "session-2";
    if (kind === "owner") auth.user.isTenantOwner = false;
    if (kind === "authentication") auth.isAuthenticated = false;
    rerender(); expect(result.current.view).toBeNull();
    expect((reads.invoice.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  });
  it("does not resurrect an earlier invoice snapshot when the target changes A→B→A", async () => {
    const { result, rerender } = renderHook(({ id }) => useInvoiceDetail(id), { initialProps: { id: invoiceId } });
    await waitFor(() => expect(result.current.view).toBe(view));
    reads.invoice.mockImplementation(() => new Promise(() => undefined));
    rerender({ id: view.invoice.subscriptionId }); expect(result.current.view).toBeNull();
    rerender({ id: invoiceId }); expect(result.current.view).toBeNull(); expect(result.current.isLoading).toBe(true);
  });
  it("ignores late results from the old target and aborts on unmount", async () => {
    const old = deferred(), next = deferred(); reads.invoice.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { result, rerender, unmount } = renderHook(({ id }) => useInvoiceDetail(id), { initialProps: { id: invoiceId } });
    rerender({ id: view.invoice.subscriptionId });
    await act(async () => old.resolve(view)); expect(result.current.view).toBeNull();
    const signal = reads.invoice.mock.calls[1][1] as AbortSignal; unmount(); expect(signal.aborted).toBe(true);
    await act(async () => next.resolve(view));
  });
  it("keeps reload stable and invalidates facts before refetch", async () => {
    const { result } = renderHook(() => useInvoiceDetail(invoiceId));
    await waitFor(() => expect(result.current.view).toBe(view)); const reload = result.current.reload;
    reads.invoice.mockReturnValueOnce(new Promise(() => undefined)); act(() => result.current.reload());
    expect(result.current.reload).toBe(reload); expect(result.current.view).toBeNull();
  });
});
