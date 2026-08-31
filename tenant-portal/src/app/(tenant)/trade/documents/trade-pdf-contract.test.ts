import { describe, expect, it } from "vitest";
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
