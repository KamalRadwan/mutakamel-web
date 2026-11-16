import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseTradeRenderJob,
  tradeRenderJobPath,
  tradeRenderPdfPath,
} from "./trade-pdf-contract";

const UUID = "01890000-0000-7000-8000-000000000001";
const JOB = "01890000-0000-7000-8000-000000000009";

const job = {
  renderJobId: JOB,
  status: "PENDING",
  attemptCount: 0,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  statusUrl: `/api/tenant/trade/v1/quotations/${UUID}/render-jobs/${JOB}`,
};

describe("the render job", () => {
  it("reads a failure that arrived inside a 200 body", () => {
    // `PDF_INPUT_EXPIRED`, `PDF_RENDER_FAILED` and `PDF_RESULT_CONFLICT` are
    // never HTTP statuses — both results services contain no exception at all.
    // A poll loop that only inspects the response status spins forever.
    const parsed = parseTradeRenderJob({
      ...job,
      status: "FAILED",
      failure: { code: "TRADE.QUOTE.PDF_RENDER_FAILED", terminal: true },
    });
    expect(parsed.failure).toEqual({ code: "TRADE.QUOTE.PDF_RENDER_FAILED", terminal: true });
  });

  it("has no failure on a healthy job", () => {
    expect(parseTradeRenderJob(job).failure).toBeNull();
  });

  it("refuses a statusUrl that is not a canonical Gateway path", () => {
    // The 202's `Location` header carries a path with no Gateway mapping, so
    // the body's `statusUrl` is the only address worth trusting — and only when
    // it is the canonical form.
    expect(() => parseTradeRenderJob({ ...job, statusUrl: "/trade/quotations/x" })).toThrow();
  });

  it("returns no artifact until the job completes with one", () => {
    expect(parseTradeRenderJob(job).artifact).toBeNull();
    const done = parseTradeRenderJob({
      ...job,
      status: "COMPLETED",
      artifact: {
        checksum: "abc",
        sizeBytes: 10,
        pageCount: 1,
        completedAt: "2026-08-31T00:00:00.000Z",
        downloadUrl: "https://storage.example/x",
        downloadExpiresAt: "2026-08-31T00:05:00.000Z",
      },
    });
    expect(done.artifact?.pageCount).toBe(1);
  });
});

describe("PDF artifact download URLs", () => {
  afterEach(() => vi.unstubAllGlobals());

  function completedJob(downloadUrl: string) {
    return {
      ...job,
      status: "COMPLETED",
      artifact: {
        checksum: "abc",
        sizeBytes: 10,
        pageCount: 1,
        completedAt: "2026-08-31T00:00:00.000Z",
        downloadUrl,
        downloadExpiresAt: "2026-08-31T00:05:00.000Z",
      },
    };
  }

  describe.each(["http:", "https:"])("on a %s portal", (protocol) => {
    it("preserves an HTTPS presigned URL exactly", () => {
      vi.stubGlobal("window", { location: { protocol } });
      const url = "https://storage.example/file.pdf?signature=a%2Fb%2Bc&expires=123";
      expect(parseTradeRenderJob(completedJob(url)).artifact?.downloadUrl).toBe(url);
    });

    it("allows HTTP downloads only on the HTTP portal", () => {
      vi.stubGlobal("window", { location: { protocol } });
      const url = "http://storage.example/file.pdf?signature=a%2Fb";
      if (protocol === "http:") {
        expect(parseTradeRenderJob(completedJob(url)).artifact?.downloadUrl).toBe(url);
      } else {
        expect(() => parseTradeRenderJob(completedJob(url))).toThrow("Invalid Trade document response.");
      }
    });

    it.each([
      "javascript:alert(1)",
      "data:application/pdf;base64,JVBERi0=",
      "blob:https://storage.example/file",
      "ftp://storage.example/file.pdf",
      "/file.pdf",
      "file.pdf",
      "//storage.example/file.pdf",
      "https://",
    ])("rejects an unsafe or invalid URL: %s", (url) => {
      vi.stubGlobal("window", { location: { protocol } });
      expect(() => parseTradeRenderJob(completedJob(url))).toThrow("Invalid Trade document response.");
    });
  });

  it("requires HTTPS when no browser location is available", () => {
    vi.stubGlobal("window", undefined);
    const url = "https://storage.example/file.pdf";
    expect(parseTradeRenderJob(completedJob(url)).artifact?.downloadUrl).toBe(url);
    expect(() => parseTradeRenderJob(completedJob("http://storage.example/file.pdf"))).toThrow(
      "Invalid Trade document response.",
    );
  });
});

describe("render paths", () => {
  it("builds the poll path from ids rather than from the Location header", () => {
    expect(tradeRenderJobPath("/api/tenant/trade/v1/quotations", UUID, JOB)).toBe(
      `/api/tenant/trade/v1/quotations/${UUID}/render-jobs/${JOB}`,
    );
  });

  it("refuses an id that is not a UUID v7", () => {
    expect(() => tradeRenderPdfPath("/api/tenant/trade/v1/invoices", "nope")).toThrow();
  });
});
