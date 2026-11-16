// @vitest-environment jsdom

import { createHash } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { TemplatePdfPreviewBridge } from "./[id]/components/TemplatePdfPreviewBridge";
import { useTemplatePdfSession, type TemplatePdfSessionInput } from "./[id]/hooks/useTemplatePdfSession";
import { STARTER_CATALOGUE_DATA } from "./starter-catalogue.data";
import { fetchPinnedPdfArtifact, readPinnedPdfPreview } from "./template-preview-session-api";
import { parseAcceptedPdfPreview, parsePdfPreviewJob } from "./template-preview-session-contract";

const actorId = "01900100-0000-7000-8000-000000000001";
const templateId = "01900100-0000-7000-8000-000000000002";
const draftId = "01900100-0000-7000-8000-000000000003";
const ids = vi.hoisted(() => ({ job: "01900100-0000-7000-8000-000000000004" }));
const ui = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const jobId = ids.job;
const otherJobId = "01900100-0000-7000-8000-000000000005";
const sessionId = "preview-integration-session";
const createdAt = "2026-11-10T10:00:00.000Z";
const expiresAt = "2026-11-10T10:15:00.000Z";
const createPath = `/api/tenant/core/v1/templates/${templateId}/preview/pdf`;
const jobPath = `/api/tenant/core/v1/templates/preview-jobs/${jobId}`;
const artifactPath = `${jobPath}/artifact`;
const fileName = `template-preview-${jobId}.pdf`;
const disposition = `attachment; filename="${fileName}"`;
const artifactExpiresAt = "2026-11-10T11:00:00.000Z";
const artifactExpired = "CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED";

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    authState: "AUTHENTICATED", realtimeAuthGeneration: `tenant:${sessionId}:${actorId}`,
    user: { id: actorId, permissions: ["templates.preview"],
      permissionScopes: { "templates.preview": { tenantWide: true, companyIds: [], branchIds: [] } } },
  }),
}));
vi.mock("@/lib/uuid", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/uuid")>(),
  generateUUIDv7: () => ids.job,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: ui.lang, dir: { ar: "rtl", en: "ltr" }[ui.lang], t: { ar, en }[ui.lang] }),
}));

const layouts = [
  ["FLOW_DOCUMENT", "trade.quotation.editorial-flow.en-US.v1"],
  ["FIXED_CANVAS", "trade.quotation.color-fixed.en-US.v1"],
  ["FLOW_DOCUMENT", "trade.quotation.editorial-flow.ar-EG.v1"],
  ["FIXED_CANVAS", "trade.quotation.color-fixed.ar-EG.v1"],
] as const;

function sessionInput(layoutMode: string, starterKey: string): TemplatePdfSessionInput {
  const starter = STARTER_CATALOGUE_DATA.find(entry => entry.descriptor.starterKey === starterKey);
  if (!starter || starter.descriptor.layoutMode !== layoutMode) throw new Error(`Missing ${starterKey}`);
  const { documentType, outputChannel, dataSourceKey, locale, resolvedDirection, templateContentChecksum } = starter.descriptor;
  return {
    template: {
      id: templateId, code: "QUOTE", name: starter.descriptor.displayName, documentType, outputChannel, layoutMode,
      dataSourceKey, locale, direction: resolvedDirection, lifecycleStatus: "ACTIVE", description: null, systemProtected: false,
      scope: { type: "TENANT" }, previewPdf: { state: "ENABLED", reason: null }, createdAt, updatedAt: createdAt,
      currentPublishedVersion: null, definitionRevision: 1, definitionEtag: '"1"', etag: '"1"',
      draft: { draftId, revision: 1, validationState: "PASSED" },
      currentDraft: { draftId, revision: 1, contentChecksum: templateContentChecksum, validationState: "PASSED", etag: '"1"' },
    },
    draft: { templateId, draftId, revision: 1 },
    schema: { syntheticFixtures: [{ fixtureKey: starter.metadata.thumbnailSource.fixtureKey, locale }] },
    canPreview: true, blocked: false, current: () => true, reload: vi.fn(),
  };
}

function reply(path: string, body: BodyInit, init: ResponseInit): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: `${window.location.origin}${path}`, configurable: true });
  return response;
}

function admission(input: TemplatePdfSessionInput) {
  return {
    templateId, source: { kind: "DRAFT", draftId, draftRevision: 1 }, renderJobId: jobId, renderTarget: "PDF",
    templateContentChecksum: input.template.currentDraft.contentChecksum, compiledArtifactChecksum: "b".repeat(64),
    kind: "PDF_ACCEPTED", status: "PENDING", location: `/api/v1/core/templates/preview-jobs/${jobId}`, createdAt, expiresAt,
  };
}

function statusReply(body: unknown): Response {
  return reply(jobPath, JSON.stringify({ success: true, data: body }), { status: 200 });
}

function expiredReply(path: string): Response {
  return reply(path, JSON.stringify({ success: false, statusCode: 410, errorCode: artifactExpired,
    message: "The preview artifact has expired." }), { status: 410, headers: { "Content-Type": "application/json" } });
}

function completedFixture(input: TemplatePdfSessionInput) {
  const { kind: _kind, location: _location, ...statusPin } = admission(input);
  const bytes = Buffer.from(`%PDF-1.4\n% ${input.template.layoutMode} transport fixture\n%%EOF\n`);
  const artifact = {
    downloadUrl: artifactPath, downloadUrlExpiresAt: artifactExpiresAt,
    checksum: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.byteLength,
    pageCount: 1, rendererVersion: "renderer-1", browserBuildFingerprint: "d".repeat(64),
  };
  const pending = { ...statusPin, lifecycleRevision: 1, attemptCount: 0, nextRetryAt: null, failure: null, artifact: null };
  const completed = { ...pending, status: "COMPLETED", lifecycleRevision: 2, attemptCount: 1, artifact };
  return { bytes, artifact, pending, completed };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Blob", NodeBlob);
  ui.lang = "en";
  vi.setSystemTime(new Date("2026-11-10T10:01:00.000Z"));
  sessionStorage.setItem("tenant_session_meta", JSON.stringify({ sessionId, savedAt: Date.now(),
    expiresIn: 900, sessionExpiresIn: 1_800, tokenType: "Bearer", remember: false,
    authorizationVersion: 1, profileVersion: 1, authEventId: "preview-integration-auth" }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
});

it.each(layouts)("downloads %s from %s using the localized preview action", async (layoutMode, starterKey) => {
  const input = sessionInput(layoutMode, starterKey);
  const receipt = admission(input);
  const { bytes, artifact, pending, completed } = completedFixture(input);
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockImplementationOnce(async () => reply(createPath, JSON.stringify({ success: true, data: receipt }), { status: 202, headers: { Location: jobPath } }))
    .mockImplementationOnce(async () => statusReply(pending))
    .mockImplementationOnce(async () => statusReply(completed))
    .mockImplementationOnce(async () => reply(artifactPath, new Uint8Array(bytes), { status: 200, headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "Content-Disposition": disposition,
    } }));
  vi.stubGlobal("fetch", fetch);
  const navigate = vi.fn<(path: string) => void>();
  const close = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({ opener: window, location: { replace: navigate }, close } as unknown as Window);
  const save = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe(fileName);
    expect(this.href).toBe("blob:verified");
  });
  const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:verified");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });

  ui.lang = input.template.locale === "ar-EG" ? "ar" : "en";
  const copy = templatePreviewMessages[ui.lang];
  const dir = input.template.direction === "RTL" ? "rtl" : "ltr";
  render(createElement("div", { dir }, createElement(TemplatePdfPreviewBridge, input)));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.draftFeedback.pending);
  const [path, create] = fetch.mock.calls[0];
  expect(path).toBe(createPath);
  expect(create).toMatchObject({ method: "POST", cache: "no-store", redirect: "error", credentials: "include" });
  expect(new Headers(create?.headers).get("x-idempotency-key")).toBe(jobId);
  expect(JSON.parse(String(create?.body))).toEqual({ source: { kind: "DRAFT", draftRevision: 1 },
    fixtureKey: input.schema!.syntheticFixtures[0].fixtureKey, locale: input.template.locale, timeZone: "Africa/Cairo" });

  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  // The render input deadline has passed, but the completed artifact is still valid.
  vi.setSystemTime(new Date(expiresAt));
  const download = screen.getByRole("button", { name: copy.download });
  expect(download.closest("[dir]")).toHaveAttribute("dir", dir);
  expect(screen.getByText(fileName)).toHaveAttribute("dir", "ltr");
  download.focus();
  await act(async () => { fireEvent.click(download); });
  expect(download).toHaveFocus();
  expect(navigate).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledOnce();
  const statusRequests = fetch.mock.calls.slice(1, -1);
  expect(statusRequests.map(([target]) => target)).toEqual([jobPath, jobPath]);
  for (const [, options] of statusRequests) {
    expect(options).toMatchObject({ method: "GET", cache: "no-store", redirect: "error", credentials: "include" });
  }

  expect(fetch).toHaveBeenLastCalledWith(artifactPath, expect.objectContaining({
    method: "GET", redirect: "error", credentials: "include", cache: "no-store",
  }));
  const [verifiedBlob] = createObjectURL.mock.calls[0];
  expect(verifiedBlob.type).toBe("application/pdf");
  const delivered = Buffer.from(await verifiedBlob.arrayBuffer());
  expect(delivered.byteLength).toBe(artifact.sizeBytes);
  expect(createHash("sha256").update(delivered).digest("hex")).toBe(artifact.checksum);
  await vi.advanceTimersByTimeAsync(1);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:verified");
});

it.each(layouts)("withholds the %s download when the artifact GET returns Core's expiry error", async (layoutMode, starterKey) => {
  const input = sessionInput(layoutMode, starterKey);
  const { completed } = completedFixture(input);
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(reply(createPath, JSON.stringify(admission(input)), { status: 202, headers: { Location: jobPath } }))
    .mockResolvedValueOnce(statusReply(completed))
    .mockResolvedValueOnce(expiredReply(artifactPath));
  vi.stubGlobal("fetch", fetch);
  const navigate = vi.fn();
  const close = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({ opener: null, location: { replace: navigate }, close } as unknown as Window);

  const { result } = renderHook(() => useTemplatePdfSession(input));
  await act(async () => { await result.current.start(); });
  expect(result.current.status).toBe("completed");
  await act(async () => { await result.current.download(); });
  expect(result.current.status).toBe("expired");
  expect(result.current.job).toBeNull();
  expect(close).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  expect(fetch.mock.calls.map(([target]) => target)).toEqual([createPath, jobPath, artifactPath]);
});

it.each([
  "another origin", "another job path", "redirected response", "wrong MIME", "wrong filename", "short body", "checksum mismatch", "oversize stream",
] as const)("never navigates or saves after a %s", async failure => {
  const input = sessionInput(...layouts[0]);
  const { bytes, completed } = completedFixture(input);
  const cancel = vi.fn();
  const responseBytes = failure === "short body" ? bytes.subarray(1)
    : failure === "checksum mismatch" ? Buffer.alloc(bytes.length) : bytes;
  const body = failure === "oversize stream"
    ? new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new Uint8Array(bytes.length + 1)); }, cancel })
    : new Uint8Array(responseBytes);
  const response = reply(artifactPath, body, { status: 200, headers: {
    "Content-Type": failure === "wrong MIME" ? "application/pdf, text/html" : "application/pdf",
    "Content-Disposition": failure === "wrong filename" ? 'attachment; filename="another.pdf"' : disposition,
  } });
  if (failure === "another origin") Object.defineProperty(response, "url", { value: `https://other.example.test${artifactPath}` });
  if (failure === "another job path") {
    Object.defineProperty(response, "url", { value: `${window.location.origin}${artifactPath.replace(jobId, otherJobId)}` });
  }
  if (failure === "redirected response") Object.defineProperty(response, "redirected", { value: true });
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(reply(createPath, JSON.stringify(admission(input)), { status: 202, headers: { Location: jobPath } }))
    .mockResolvedValueOnce(statusReply(completed))
    .mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetch);
  const navigate = vi.fn();
  const save = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const close = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({ opener: null, location: { replace: navigate }, close } as unknown as Window);

  const { result } = renderHook(() => useTemplatePdfSession(input));
  await act(async () => { await result.current.start(); });
  expect(result.current.status).toBe("completed");
  await act(async () => { await result.current.download(); });
  expect(navigate).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(fetch.mock.calls.map(([target]) => target)).toEqual([createPath, jobPath, artifactPath]);
  if (failure === "oversize stream") expect(cancel).toHaveBeenCalledOnce();
});

it("verifies the full 25 MiB artifact limit across multiple stream chunks", async () => {
  const input = sessionInput(...layouts[1]);
  const { completed, artifact } = completedFixture(input);
  const accepted = parseAcceptedPdfPreview(admission(input), {
    templateId, draftId, draftRevision: 1, templateContentChecksum: input.template.currentDraft.contentChecksum,
  });
  const chunk = new Uint8Array(1024 * 1024);
  chunk.set(new TextEncoder().encode("%PDF-1.4"));
  const hash = createHash("sha256");
  let count = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
      if (++count === 25) controller.close();
    },
  });
  for (let part = 0; part < 25; part++) hash.update(chunk);
  const job = parsePdfPreviewJob({
    ...completed, artifact: { ...artifact, sizeBytes: 25 * chunk.length, checksum: hash.digest("hex") },
  }, accepted);
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
    reply(artifactPath, stream, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": disposition } }),
  );
  vi.stubGlobal("fetch", fetch);

  await expect(fetchPinnedPdfArtifact(job, new AbortController().signal, () => undefined))
    .resolves.toMatchObject({ size: 25 * chunk.length, type: "application/pdf" });
  expect(fetch).toHaveBeenCalledOnce();
});

it.each(layouts)("rejects a %s status body served from another job URL", async (layoutMode, starterKey) => {
  const input = sessionInput(layoutMode, starterKey);
  const accepted = parseAcceptedPdfPreview(admission(input), {
    templateId, draftId, draftRevision: 1, templateContentChecksum: input.template.currentDraft.contentChecksum,
  });
  const { completed } = completedFixture(input);
  const otherJobPath = jobPath.replace(jobId, otherJobId);
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
    reply(otherJobPath, JSON.stringify({ success: true, data: completed }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);

  await expect(readPinnedPdfPreview(accepted, new AbortController().signal)).rejects.toMatchObject({
    response: { status: 409, data: { errorCode: "RESPONSE_TARGET_UNCONFIRMED" } },
  });
  expect(fetch.mock.calls.map(([target]) => target)).toEqual([jobPath]);
});

it.each(["Gateway Location", "Core body location"] as const)("halts a preview when the %s identifies another job", async mismatch => {
  const input = sessionInput(...layouts[0]);
  const receipt = admission(input);
  const location = mismatch === "Gateway Location" ? jobPath.replace(jobId, otherJobId) : jobPath;
  const body = mismatch === "Core body location" ? { ...receipt, location: receipt.location.replace(jobId, otherJobId) } : receipt;
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(reply(createPath, JSON.stringify(body), {
    status: 202, headers: { Location: location },
  })).mockResolvedValueOnce(reply(createPath, JSON.stringify(receipt), {
    status: 202, headers: { Location: jobPath, "Idempotency-Replayed": "true" },
  }));
  const { kind: _kind, location: _location, ...statusPin } = receipt;
  fetch.mockResolvedValueOnce(reply(jobPath, JSON.stringify({ ...statusPin,
    lifecycleRevision: 1, attemptCount: 0, nextRetryAt: null, failure: null, artifact: null,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const open = vi.spyOn(window, "open");

  const { result } = renderHook(() => useTemplatePdfSession(input));
  await act(async () => { await result.current.start(); });
  expect(result.current.status).toBe("unknown");
  expect(result.current.job).toBeNull();
  await act(async () => { await result.current.download(); });
  expect(open).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);

  await act(async () => { await result.current.recover(); });
  expect(result.current.status).toBe("pending");
  const [first, replay, poll] = fetch.mock.calls;
  expect(replay[0]).toBe(first[0]);
  expect(replay[1]?.body).toBe(first[1]?.body);
  expect(new Headers(replay[1]?.headers).get("x-idempotency-key")).toBe(jobId);
  expect(poll[0]).toBe(jobPath);
});
