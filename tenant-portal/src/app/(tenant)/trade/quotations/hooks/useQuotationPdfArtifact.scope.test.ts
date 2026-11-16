// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { createHash } from "node:crypto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuotationPdfArtifact, QUOTATION_PDF_MAX_BYTES } from "./useQuotationPdfArtifact";

const transport = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: transport.get } }));
const QUOTE = "01890000-0000-7000-8000-000000000001";
const JOB = "01890000-0000-7000-8000-000000000002";
const scope = { "x-mutakamel-company-id": QUOTE, "x-mutakamel-branch-id": JOB };
const pdf = "%PDF-1.7\nfixture";
const blob = new NodeBlob([pdf], { type: "application/pdf" });
const artifact = { jobId: JOB, checksum: createHash("sha256").update(pdf).digest("hex"), sizeBytes: blob.size };
const assertOwner = () => {};

describe("PDF viewer scope and object URL lifecycle", () => {
  const create = vi.fn(); const revoke = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    create.mockReturnValueOnce("blob:first").mockReturnValue("blob:second");
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
    vi.stubGlobal("crypto", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fetches only the canonical authenticated route and revokes the old artifact when scope changes", async () => {
    transport.get.mockResolvedValue({ data: blob, status: 200 });
    const { result, rerender, unmount } = renderHook(({ id }) => useQuotationPdfArtifact(id, artifact, { ...scope }, assertOwner), { initialProps: { id: QUOTE } });
    act(() => result.current.setOpen(true)); await waitFor(() => expect(result.current.url).toBe("blob:first"));
    expect(transport.get).toHaveBeenCalledWith(`/api/tenant/trade/v1/quotations/${QUOTE}/render-jobs/${JOB}/artifact`, expect.objectContaining({
      headers: scope, responseType: "blob", cache: "no-store", maxBinaryResponseBytes: artifact.sizeBytes,
      redirect: "error", requireExactResponseTarget: true,
    }));
    rerender({ id: QUOTE });
    expect(result.current.url).toBe("blob:first");
    expect(transport.get).toHaveBeenCalledOnce();
    rerender({ id: "01890000-0000-7000-8000-000000000003" });
    expect(result.current.open).toBe(false);
    expect(result.current.url).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:first");
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.url).toBe("blob:second"));
    unmount(); expect(revoke).toHaveBeenCalledWith("blob:second");
  });

  it("does not expose an artifact when its fetch finishes after the job changed", async () => {
    let complete!: (value: { data: NodeBlob; status: number }) => void;
    transport.get.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const { result, rerender } = renderHook(({ available }) => useQuotationPdfArtifact(QUOTE, available ? artifact : null, scope, assertOwner), { initialProps: { available: true } });
    act(() => result.current.setOpen(true)); await waitFor(() => expect(transport.get).toHaveBeenCalledOnce());
    rerender({ available: false });
    await act(async () => { complete({ data: blob, status: 200 }); });
    expect(result.current.url).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts a gateway-bounded PDF above the browser client's configurable limit", async () => {
    const bytes = Buffer.alloc(QUOTATION_PDF_MAX_BYTES);
    bytes.write(pdf);
    const data = new NodeBlob([bytes], { type: "application/pdf" });
    const large = { ...artifact, sizeBytes: data.size, checksum: createHash("sha256").update(bytes).digest("hex") };
    transport.get.mockResolvedValue({ data, status: 200 });
    const { result } = renderHook(() => useQuotationPdfArtifact(QUOTE, large, scope, assertOwner));
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.url).toBe("blob:first"));
    expect(transport.get.mock.lastCall?.[1]).not.toHaveProperty("maxResponseBytes");
  });

  it("retries only the same artifact and rejects bytes from a different size", async () => {
    transport.get.mockResolvedValueOnce({ data: blob.slice(0, blob.size - 1, blob.type), status: 200 })
      .mockResolvedValueOnce({ data: blob, status: 200 });
    const { result } = renderHook(() => useQuotationPdfArtifact(QUOTE, artifact, scope, assertOwner));
    act(() => result.current.setOpen(true));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(create).not.toHaveBeenCalled();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.url).toBe("blob:first"));
    expect(transport.get.mock.calls.map(([path]) => path)).toEqual(Array(2).fill(
      `/api/tenant/trade/v1/quotations/${QUOTE}/render-jobs/${JOB}/artifact`,
    ));
  });
});
