import { describe, expect, it, vi } from "vitest";
import { assertPdfJobProgress, parseAcceptedPdfPreview, parsePdfPreviewJob } from "./template-preview-session-contract";
import { createPinnedPdfPreview, readPinnedPdfPreview } from "./template-preview-session-api";

const transport = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../core-api", () => ({ coreGetResponse: transport.get, corePostResponse: transport.post }));
const templateId = "01900100-0000-7000-8000-000000000001";
const draftId = "01900100-0000-7000-8000-000000000002";
const renderJobId = "01900100-0000-7000-8000-000000000003";
const key = renderJobId;
const pin = { templateId, draftId, draftRevision: 3, templateContentChecksum: "a".repeat(64) };
const jobPath = `/api/tenant/core/v1/templates/preview-jobs/${renderJobId}`;
const createPath = `/api/tenant/core/v1/templates/${templateId}/preview/pdf`;
const request = { source: { kind: "DRAFT" as const, draftRevision: 3 }, fixtureKey: "trade.quotation.rich.en-US.v1", locale: "en-US", timeZone: "Africa/Cairo" };
const wire = { templateId, source: { kind: "DRAFT", draftId, draftRevision: 3 }, templateContentChecksum: pin.templateContentChecksum,
  compiledArtifactChecksum: "b".repeat(64), renderJobId, renderTarget: "PDF", status: "PENDING",
  createdAt: "2026-11-10T10:00:00.000Z", expiresAt: "2026-11-10T10:15:00.000Z" };
const acceptedBody = { ...wire, kind: "PDF_ACCEPTED", location: `/api/v1/core/templates/preview-jobs/${renderJobId}` };
const accepted = parseAcceptedPdfPreview(acceptedBody, pin);
const pending = { ...wire, lifecycleRevision: 1, attemptCount: 0, nextRetryAt: null, failure: null, artifact: null };
const artifact = { downloadUrl: `${jobPath}/artifact`,
  downloadUrlExpiresAt: "2026-11-10T11:00:00.000Z", checksum: "c".repeat(64), sizeBytes: 1200, pageCount: 2,
  rendererVersion: "renderer-1", browserBuildFingerprint: "d".repeat(64) };
const completed = { ...pending, status: "COMPLETED", lifecycleRevision: 2, attemptCount: 1, artifact };

function httpResponse(method: "POST" | "GET", status: number, data: unknown, location?: string) {
  const endpoint = method === "POST" ? createPath : jobPath;
  const origin = "http://tenant.example.test:5002";
  return {
    status, data, provenance: "http",
    request: { method, endpoint, origin, finalUrl: `${origin}${endpoint}`, redirected: false },
    headers: new Headers(location === undefined ? undefined : { location }),
  };
}

describe("current Core PDF projection boundary", () => {
  it("retains exact source and output pins and the owner's canonical download URL", () => {
    expect(parsePdfPreviewJob(completed, accepted).artifact).toEqual(artifact);
  });
  it.each([
    { templateId: key }, { source: { kind: "VERSION", versionId: key } },
    { source: { kind: "DRAFT", draftId, draftRevision: 4 } },
    { source: { ...wire.source, versionId: key, versionNumber: 1 } },
    { templateContentChecksum: "d".repeat(64) }, { compiledArtifactChecksum: "d".repeat(64) },
    { renderJobId: templateId }, { renderTarget: "HTML" }, { lifecycleRevision: 0 }, { attemptCount: -1 },
    { attemptCount: 0 }, { attemptCount: 4 },
    { expiresAt: "2026-11-10T10:16:00.000Z" }, { artifact: { ...artifact, downloadUrl: "https://example.com/file.pdf" } },
    { artifact: { ...artifact, downloadUrl: `${artifact.downloadUrl}?token=secret` } },
    { artifact: { ...artifact, checksum: "not-a-checksum" } }, { artifact: { ...artifact, pageCount: 0 } },
    { artifact: { ...artifact, sizeBytes: 0 } }, { artifact: { ...artifact, sizeBytes: 25 * 1024 * 1024 + 1 } },
    { artifact: { ...artifact, pageCount: 201 } }, { artifact: { ...artifact, rendererVersion: "a".repeat(101) } },
    { artifact: { ...artifact, browserBuildFingerprint: "chromium-pinned" } },
    { artifact: { ...artifact, downloadUrlExpiresAt: "2026-11-11" } },
    { artifact: null }, { failure: { code: "mixed" } },
  ])("withholds a mismatched or malformed response %j", mutation => {
    expect(() => parsePdfPreviewJob({ ...completed, ...mutation }, accepted)).toThrow();
  });
  it("rejects a coerced status or a pending job with retry evidence", () => {
    expect(() => parsePdfPreviewJob({ ...pending, status: ["PENDING"] }, accepted)).toThrow();
    expect(() => parsePdfPreviewJob({ ...pending, nextRetryAt: "2026-11-10T10:01:00.000Z" }, accepted)).toThrow();
  });
  it("rejects lifecycle rollback and a mutated completed output", () => {
    const done = parsePdfPreviewJob(completed, accepted);
    expect(() => assertPdfJobProgress(done, parsePdfPreviewJob(pending, accepted))).toThrow();
    expect(() => assertPdfJobProgress(done, { ...done, artifact: { ...done.artifact!, checksum: "d".repeat(64) } })).toThrow();
    expect(() => assertPdfJobProgress(done, done)).not.toThrow();
  });
  it("preserves the timestamp of an immutable terminal failure", () => {
    const failure = { code: "CORE.TEMPLATE.PREVIEW.EXPIRED", failedAt: "2026-11-10T10:16:00.000Z", retryable: false };
    const row = { ...pending, status: "FAILED", lifecycleRevision: 2, failure };
    const failed = parsePdfPreviewJob(row, accepted);
    expect(failed.failedAt).toBe(failure.failedAt);
    const changed = parsePdfPreviewJob({ ...row, failure: { ...failure, failedAt: "2026-11-10T10:17:00.000Z" } }, accepted);
    expect(() => assertPdfJobProgress(failed, changed)).toThrow();
  });
  it("rejects mismatched draft intent before sending a command", async () => {
    transport.post.mockClear();
    const signal = new AbortController().signal;
    await expect(createPinnedPdfPreview(pin, { ...request, source: { kind: "DRAFT", draftRevision: 4 } }, key, signal)).rejects.toThrow();
    await expect(createPinnedPdfPreview(pin, { ...request, source: { kind: "VERSION", versionId: draftId } }, key, signal)).rejects.toThrow();
    await expect(createPinnedPdfPreview({ ...pin, templateContentChecksum: "invalid" }, request, key, signal)).rejects.toThrow();
    expect(transport.post).not.toHaveBeenCalled();
  });
  it("checks actual HTTP status/envelope before source admission", async () => {
    transport.post.mockResolvedValue(httpResponse("POST", 200, { success: true, data: acceptedBody }, jobPath));
    await expect(createPinnedPdfPreview(pin, request, key, new AbortController().signal)).rejects.toThrow();
    transport.post.mockResolvedValue(httpResponse("POST", 202, { success: false, data: acceptedBody }, jobPath));
    await expect(createPinnedPdfPreview(pin, request, key, new AbortController().signal)).rejects.toThrow();
    transport.post.mockResolvedValue(httpResponse("POST", 202, { success: true, data: acceptedBody }, jobPath));
    await expect(createPinnedPdfPreview(pin, request, "01900100-0000-7000-8000-000000000004", new AbortController().signal)).rejects.toThrow();
    await expect(createPinnedPdfPreview(pin, request, key, new AbortController().signal)).resolves.toEqual(accepted);
    expect(transport.post.mock.lastCall?.[2]).toMatchObject({ headers: { "x-idempotency-key": key }, requireExactResponseTarget: true, cache: "no-store", redirect: "error" });
    transport.get.mockResolvedValue(httpResponse("GET", 200, { success: true, data: completed }));
    await expect(readPinnedPdfPreview(accepted, new AbortController().signal)).resolves.toMatchObject({ artifact });
  });
  it.each([undefined, `/api/tenant/core/v1/templates/preview-jobs/${templateId}`, acceptedBody.location, `${jobPath}?extra=1`, `${jobPath}, ${jobPath}`])(
    "rejects a missing or inconsistent public Location %s", async location => {
      transport.post.mockResolvedValue(httpResponse("POST", 202, acceptedBody, location));
      await expect(createPinnedPdfPreview(pin, request, key, new AbortController().signal)).rejects.toThrow();
    },
  );
  it("accepts exact replay and rejects missing or redirected response targets", async () => {
    const signal = new AbortController().signal;
    const replay = httpResponse("POST", 202, acceptedBody, jobPath);
    replay.headers.set("idempotency-replayed", "true");
    transport.post.mockResolvedValue(replay);
    await expect(createPinnedPdfPreview(pin, request, key, signal)).resolves.toEqual(accepted);
    transport.post.mockResolvedValue({ ...replay, request: { ...replay.request, finalUrl: "" } });
    await expect(createPinnedPdfPreview(pin, request, key, signal)).rejects.toThrow();
    const reply = httpResponse("GET", 200, completed);
    transport.get.mockResolvedValue({ ...reply, request: { ...reply.request, redirected: true } });
    await expect(readPinnedPdfPreview(accepted, signal)).rejects.toThrow();
    transport.get.mockResolvedValue({ ...reply, request: { ...reply.request, finalUrl: `${reply.request.finalUrl}?extra=1` } });
    await expect(readPinnedPdfPreview(accepted, signal)).rejects.toThrow();
  });
});
