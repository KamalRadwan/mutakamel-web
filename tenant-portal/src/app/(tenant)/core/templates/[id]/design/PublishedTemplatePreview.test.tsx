// @vitest-environment jsdom

import { createHash } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import { canonicalJson } from "@mutakamel/template-schema/browser-safe";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/uuid";
import { STARTER_CATALOGUE_DATA } from "../../starter-catalogue.data";
import type { TemplateDetail } from "../../templates-contract";
import { PublishedTemplatePreview } from "./PublishedTemplatePreview";

const io = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), version: vi.fn(), schema: vi.fn(), html: vi.fn(), authEvents: vi.fn(),
  jobId: "01900100-0000-7000-8000-000000000004",
  language: "en" as "ar" | "en",
  canPreview: true,
}));
vi.mock("../../../core-api", () => ({ coreGetResponse: io.get, corePostResponse: io.post }));
vi.mock("../../template-design-api", () => ({ fetchTemplateDataSchema: io.schema }));
vi.mock("../../template-lifecycle-api", () => ({ fetchTemplateVersion: io.version, previewTemplateHtml: io.html }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: io.language, dir: { ar: "rtl", en: "ltr" }[io.language], t: { ar, en }[io.language] }),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  authState: "AUTHENTICATED", realtimeAuthGeneration: "tenant:session:actor",
  user: { id: "actor", permissions: io.canPreview ? ["templates.read", "templates.preview"] : ["templates.read"], permissionScopes: {
    "templates.read": { tenantWide: true, companyIds: [], branchIds: [] },
    "templates.preview": { tenantWide: true, companyIds: [], branchIds: [] },
  } },
}) }));
vi.mock("@/lib/api/axiosClient", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  getStoredTenantSessionMeta: () => ({ sessionId: "session" }),
}));
vi.mock("@/lib/auth/sessionCoordinator", () => ({
  subscribeToTenantAuthEvents: (listener: unknown) => { io.authEvents(listener); return () => undefined; },
}));
vi.mock("@/lib/uuid", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/uuid")>(), generateUUIDv7: vi.fn(() => io.jobId),
}));

const templateId = "01900100-0000-7000-8000-000000000001";
const draftId = "01900100-0000-7000-8000-000000000002";
const versionId = "01900100-0000-7000-8000-000000000003";
const otherVersion = "01900100-0000-7000-8000-000000000005";
const fixture = { fixtureKey: "trade.quotation.rich.en-US.v1", locale: "en-US", fixtureChecksum: "a".repeat(64) };
const arabicFixture = { fixtureKey: "trade.quotation.rich.ar-EG.v1", locale: "ar-EG", fixtureChecksum: "7".repeat(64) };
type PublishedSource = Pick<TemplateDetail, "code" | "name" | "documentType" | "dataSourceKey"> & {
  syntheticFixtures: (typeof fixture)[];
};

const salesSource: PublishedSource = {
  code: "QUOTE", name: "Sales quotation", documentType: "QUOTATION", dataSourceKey: "TRADE_QUOTATION_PRINT_V1",
  syntheticFixtures: [arabicFixture, fixture],
};
const schemaChecksum = "b".repeat(64);
const compiledChecksum = "c".repeat(64);
const createdAt = "2026-11-10T10:00:00.000Z";
const versionPath = `/api/tenant/core/v1/templates/${templateId}/versions/${versionId}`;
const createPath = `/api/tenant/core/v1/templates/${templateId}/preview/pdf`;
const jobPath = `/api/tenant/core/v1/templates/preview-jobs/${io.jobId}`;
const pdfBytes = "%PDF-1.4\n% Published preview fixture\n%%EOF\n";
const artifact = {
  downloadUrl: `${jobPath}/artifact`, downloadUrlExpiresAt: "2026-11-10T11:00:00.000Z",
  checksum: createHash("sha256").update(pdfBytes).digest("hex"),
  sizeBytes: Buffer.byteLength(pdfBytes), pageCount: 1, rendererVersion: "renderer-1", browserBuildFingerprint: "e".repeat(64),
};
const copy = templatePreviewMessages.en;

function reply(method: "GET" | "POST", endpoint: string, data: unknown, status: number, location?: string) {
  const origin = "http://tenant.example.test:5002";
  return { provenance: "http", status, data: { success: true, data },
    headers: new Headers(location ? { Location: location } : undefined),
    request: { method, endpoint, origin, finalUrl: `${origin}${endpoint}`, redirected: false },
  };
}

function pdfReply(path: string) {
  return {
    ...reply("GET", path, null, 200),
    data: new Blob([pdfBytes], { type: "application/pdf" }),
    headers: new Headers({
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="template-preview-${path.split("/").at(-2)}.pdf"`,
    }),
  };
}

function browserDownload() {
  const replace = vi.fn();
  const close = vi.fn();
  const save = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  vi.spyOn(window, "open").mockReturnValue({ opener: null, location: { replace }, close } as unknown as Window);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:verified");
    static revokeObjectURL = vi.fn();
  });
  return { replace, close, save };
}

function setUp(layoutMode: TemplateDetail["layoutMode"], explicitCanvas = false, selectedVersionId = versionId,
  renderJobId = io.jobId, selectedFixture = fixture, { syntheticFixtures, ...source }: PublishedSource = salesSource) {
  const template: TemplateDetail = {
    ...source, id: templateId, description: null, lifecycleStatus: "ACTIVE",
    direction: selectedFixture.locale === "ar-EG" ? "RTL" : "LTR",
    outputChannel: "PRINT", layoutMode, locale: selectedFixture.locale,
    systemProtected: false, scope: { type: "TENANT" }, previewPdf: { state: "HIDDEN", reason: null }, currentPublishedVersion: null,
    definitionRevision: 2, definitionEtag: '"2"', etag: '"2"', createdAt, updatedAt: createdAt,
    draft: { draftId, revision: 19, validationState: "FAILED" },
    currentDraft: { draftId, revision: 19, contentChecksum: "f".repeat(64), validationState: "FAILED", etag: '"19"' },
  };
  const { documentType, outputChannel, dataSourceKey, locale } = template;
  const document = { schemaVersion: 1, documentType, outputChannel, dataSourceKey, layoutMode, locale,
    page: { preset: "A4", orientation: "PORTRAIT", marginMm: { top: 10, right: 10, bottom: 10, left: 10 } },
    ...(explicitCanvas ? { canvasPages: [] } : {}),
  };
  const templateContentChecksum = createHash("sha256").update(canonicalJson(document)).digest("hex");
  const version = { id: selectedVersionId, versionNumber: selectedVersionId === versionId ? 2 : 3, lifecycleStatus: "PUBLISHED", dataSourceKey, locale,
    templateContentChecksum, publishedAt: createdAt, retiredAt: null, changeNote: null, compilerVersion: "1", rendererTargets: ["HTML", "PDF"],
  };
  const versionDetail = { ...version, templateVersionId: selectedVersionId, templateDefinitionId: templateId,
    documentType, outputChannel, layoutMode, compiledChecksum, editorSchemaVersion: 1, editorDocument: document,
    dataSourceSchemaVersion: 1, dataSourceSchemaChecksum: schemaChecksum,
  };
  const html = "<!doctype html><title>" + template.name + "</title>";
  io.version.mockResolvedValue(version);
  io.schema.mockResolvedValue({ documentType, schemaChecksum, allowedOutputChannels: ["PRINT"], allowedLayoutModes: [layoutMode],
    syntheticFixtures });
  io.html.mockResolvedValue({ kind: "HTML", sourceKind: "VERSION", templateId, versionId: selectedVersionId, templateContentChecksum, html, versionEvidence: {
    versionNumber: version.versionNumber, compiledArtifactChecksum: compiledChecksum,
    outputChecksum: createHash("sha256").update(html).digest("hex"),
    publishedPreviewFixture: { fixtureKey: selectedFixture.fixtureKey, fixturePayloadChecksum: selectedFixture.fixtureChecksum },
  } });
  io.get.mockResolvedValueOnce(reply("GET", `/api/tenant/core/v1/templates/${templateId}/versions/${selectedVersionId}`, versionDetail, 200));

  const selectedJobPath = `/api/tenant/core/v1/templates/preview-jobs/${renderJobId}`;
  const pin = { templateId, source: { kind: "VERSION", versionId: selectedVersionId, versionNumber: version.versionNumber }, templateContentChecksum,
    compiledArtifactChecksum: compiledChecksum, renderJobId, renderTarget: "PDF", createdAt, expiresAt: "2026-11-10T10:15:00.000Z" };
  const accepted = { ...pin, status: "PENDING", kind: "PDF_ACCEPTED", location: `/api/v1/core/templates/preview-jobs/${renderJobId}` };
  const pending = { ...pin, status: "PENDING", lifecycleRevision: 1, attemptCount: 0, artifact: null, nextRetryAt: null, failure: null };
  const completed = { ...pending, status: "COMPLETED", lifecycleRevision: 2, attemptCount: 1, artifact: { ...artifact, downloadUrl: `${selectedJobPath}/artifact` } };
  vi.mocked(generateUUIDv7).mockReturnValue(renderJobId);
  io.post.mockResolvedValue(reply("POST", createPath, accepted, 202, selectedJobPath));
  return { template, versionDetail, accepted, pending, completed, selectedJobPath };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("Blob", NodeBlob);
  io.language = "en";
  io.canPreview = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:01:00.000Z"));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function showPreview(template: TemplateDetail) {
  const preview = (id: string, definition = template) => <PublishedTemplatePreview key={id} template={definition} versionId={id}
    backHref="/core/templates" backToDesign={false} />;
  const view = render(preview(versionId));
  await act(async () => { await vi.dynamicImportSettled(); });
  return { ...view, preview };
}

it.each([
  ["HYBRID_DOCUMENT", "en", fixture],
  ["FLOW_DOCUMENT", "en", fixture], ["FLOW_DOCUMENT", "ar", arabicFixture],
  ["FIXED_CANVAS", "en", fixture], ["FIXED_CANVAS", "ar", arabicFixture],
] as const)("downloads the exact published %s in %s despite a hidden draft capability", async (layoutMode, language, selectedFixture) => {
  io.language = language;
  const copy = templatePreviewMessages[language];
  const { template, pending, completed } = setUp(layoutMode, false, versionId, io.jobId, selectedFixture);
  io.get.mockResolvedValueOnce(reply("GET", jobPath, pending, 200)).mockResolvedValueOnce(reply("GET", jobPath, completed, 200))
    .mockResolvedValueOnce(pdfReply(artifact.downloadUrl));
  const { replace, close, save } = browserDownload();
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(io.post).toHaveBeenCalledExactlyOnceWith(createPath, {
    source: { kind: "VERSION", versionId }, fixtureKey: selectedFixture.fixtureKey, locale: selectedFixture.locale, timeZone: "Africa/Cairo",
  }, expect.objectContaining({ headers: { "x-idempotency-key": io.jobId } }));
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  const download = screen.getByRole("button", { name: copy.download });
  download.focus();
  await act(async () => { fireEvent.click(download); });
  expect(download).toHaveFocus();
  expect(replace).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledOnce();
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([versionPath, jobPath, jobPath, artifact.downloadUrl]);
});

it.each([
  ["en", "trade.purchase-quotation.classic-hybrid.en-US.v1", "Published version preview"],
  ["ar", "trade.purchase-quotation.editorial-flow.ar-EG.v1", "معاينة الإصدار المنشور"],
] as const)("previews and downloads a published Purchase Quotation in %s", async (language, starterKey, previewTitle) => {
  const starter = STARTER_CATALOGUE_DATA.find(({ descriptor }) => descriptor.starterKey === starterKey);
  if (!starter) throw new Error("Missing Purchase Quotation starter " + starterKey);
  const { documentType, dataSourceKey, layoutMode, locale } = starter.descriptor;
  expect(documentType).toBe("PURCHASE_QUOTATION");
  expect(dataSourceKey).toBe("TRADE_PURCHASE_QUOTATION_PRINT_V1");
  const selectedFixture = {
    fixtureKey: starter.metadata.thumbnailSource.fixtureKey, locale, fixtureChecksum: "9".repeat(64),
  };
  const source = { code: "PQUOTE", name: "Purchase quotation", documentType, dataSourceKey, syntheticFixtures: [selectedFixture] };
  const { template, pending, completed } = setUp(layoutMode, false, versionId, io.jobId, selectedFixture, source);
  io.language = language;
  const copy = templatePreviewMessages[language];
  io.get.mockResolvedValueOnce(reply("GET", jobPath, pending, 200))
    .mockResolvedValueOnce(reply("GET", jobPath, completed, 200))
    .mockResolvedValueOnce(pdfReply(artifact.downloadUrl));
  const { close, replace, save } = browserDownload();

  await showPreview(template);
  expect(screen.getByTitle(previewTitle)).toHaveAttribute("srcdoc", "<!doctype html><title>Purchase quotation</title>");
  expect(io.schema).toHaveBeenCalledExactlyOnceWith("TRADE_PURCHASE_QUOTATION_PRINT_V1", { type: "TENANT" }, expect.any(AbortSignal));

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
  expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.download })); });

  expect(io.post).toHaveBeenCalledExactlyOnceWith(createPath, {
    source: { kind: "VERSION", versionId }, fixtureKey: selectedFixture.fixtureKey, locale, timeZone: "Africa/Cairo",
  }, expect.objectContaining({ headers: { "x-idempotency-key": io.jobId } }));
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([versionPath, jobPath, jobPath, artifact.downloadUrl]);
  expect(io.get).toHaveBeenLastCalledWith(artifact.downloadUrl, expect.objectContaining({
    headers: { Accept: "application/pdf" }, responseType: "blob", requireExactResponseTarget: true,
  }));
  expect(replace).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.contexts[0]).toMatchObject({ download: "template-preview-" + io.jobId + ".pdf", href: "blob:verified" });
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob.type).toBe("application/pdf");
  expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from(pdfBytes));
});

it("withholds published Purchase PDF creation without template preview permission", async () => {
  const purchaseFixture = { ...fixture, fixtureKey: "trade.purchase-quotation.standard.en-US.v1" };
  const { template } = setUp("HYBRID_DOCUMENT", false, versionId, io.jobId, purchaseFixture, {
    code: "PQUOTE", name: "Purchase quotation", documentType: "PURCHASE_QUOTATION",
    dataSourceKey: "TRADE_PURCHASE_QUOTATION_PRINT_V1", syntheticFixtures: [purchaseFixture],
  });
  io.canPreview = false;

  await showPreview(template);

  expect(screen.getByText(en.permissionGate.title)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: copy.create })).toBeNull();
  expect(io.post).not.toHaveBeenCalled();
});

it("keeps the verified HTML available when the published Fixed version uses explicit canvas pages", async () => {
  const { template } = setUp("FIXED_CANVAS", true);
  await showPreview(template);
  expect(screen.getByTitle("Quotation preview")).toHaveAttribute("data-preview-version-id", versionId);
  expect(screen.queryByRole("button", { name: copy.create })).toBeNull();
  expect(io.post).not.toHaveBeenCalled();
});

it.each(["version ID", "version number", "content checksum", "compiled checksum", "draft source"] as const)("withholds an artifact when status changes the accepted %s", async mismatch => {
  const { template, completed } = setUp("FLOW_DOCUMENT");
  const mismatches = {
    "version ID": { source: { ...completed.source, versionId: otherVersion } },
    "version number": { source: { ...completed.source, versionNumber: 3 } },
    "content checksum": { templateContentChecksum: "f".repeat(64) },
    "compiled checksum": { compiledArtifactChecksum: "f".repeat(64) },
    "draft source": { source: { kind: "DRAFT", draftId, draftRevision: 19 } },
  };
  io.get.mockResolvedValueOnce(reply("GET", jobPath, { ...completed, ...mismatches[mismatch] }, 200));
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(screen.getByRole("alert")).toHaveTextContent(copy.states.invalid);
  expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
});

it("retains the same command when the first acceptance fails to match the verified version", async () => {
  const { template, accepted, pending } = setUp("FLOW_DOCUMENT");
  io.post.mockResolvedValueOnce(reply("POST", createPath, { ...accepted, compiledArtifactChecksum: "f".repeat(64) }, 202, jobPath));
  io.get.mockResolvedValueOnce(reply("GET", jobPath, pending, 200));
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(screen.getByRole("alert")).toHaveTextContent(copy.states.unknown);
  expect(io.get).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.recover })); });
  expect(io.post.mock.calls[1].slice(0, 2)).toEqual(io.post.mock.calls[0].slice(0, 2));
  expect(io.post.mock.calls[1][2].headers).toEqual(io.post.mock.calls[0][2].headers);
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
});

it("stops and resumes the same published job while showing the server retry state", async () => {
  const { template, pending } = setUp("FLOW_DOCUMENT");
  const retrying = { ...pending, status: "RETRYING", lifecycleRevision: 2, nextRetryAt: "2026-11-10T10:05:00.000Z" };
  io.get.mockResolvedValueOnce(reply("GET", jobPath, pending, 200)).mockResolvedValueOnce(reply("GET", jobPath, retrying, 200));
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  fireEvent.click(screen.getByRole("button", { name: copy.stop }));
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.stopped);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.resume })); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.retrying);
  expect(io.post).toHaveBeenCalledTimes(1);
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([versionPath, jobPath, jobPath]);
});

it("keeps the focused Resume button and the same published job when switching to Arabic", async () => {
  const { template, pending, completed } = setUp("FLOW_DOCUMENT");
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  io.get.mockResolvedValueOnce(reply("GET", jobPath, pending, 200))
    .mockImplementationOnce(() => new Promise(() => undefined))
    .mockResolvedValueOnce(reply("GET", jobPath, completed, 200));
  const { rerender, preview } = await showPreview(template);
  const frame = screen.getByTitle("Quotation preview");
  expect(frame).toHaveAttribute("data-preview-fixture-key", fixture.fixtureKey);
  expect(frame).toHaveAttribute("data-preview-fixture-payload-checksum", fixture.fixtureChecksum);
  expect(screen.queryByRole("combobox")).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(io.html.mock.calls[0][1]).toEqual(io.post.mock.calls[0][1]);

  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.paused);
  expect(io.get.mock.calls[2][1].signal.aborted).toBe(true);

  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  const resume = screen.getByRole("button", { name: copy.resume });
  resume.focus();
  io.language = "ar";
  await act(async () => { rerender(preview(versionId)); });
  const arabic = templatePreviewMessages.ar;
  expect(screen.getByRole("button", { name: arabic.resume })).toBe(resume);
  expect(resume).toHaveFocus();
  expect(screen.getByTitle("معاينة عرض السعر")).toBe(frame);
  expect(frame).toHaveAttribute("data-preview-version-id", versionId);
  expect(frame).toHaveAttribute("data-preview-fixture-key", fixture.fixtureKey);
  expect(frame).toHaveAttribute("data-preview-fixture-payload-checksum", fixture.fixtureChecksum);
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([versionPath, jobPath, jobPath]);
  expect(io.post).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(resume); });

  expect(screen.getByRole("status")).toHaveTextContent(arabic.states.completed);
  expect(screen.getByRole("button", { name: arabic.download })).toBeEnabled();
  expect(io.post).toHaveBeenCalledTimes(1);
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([versionPath, jobPath, jobPath, jobPath]);
  expect(screen.getByRole("region", { name: arabic.title })).toHaveFocus();
});

it("starts a new job for the same published version after a terminal render failure", async () => {
  const { template, pending, accepted } = setUp("FLOW_DOCUMENT");
  const nextJobId = "01900100-0000-7000-8000-000000000006";
  const nextJobPath = `/api/tenant/core/v1/templates/preview-jobs/${nextJobId}`;
  vi.mocked(generateUUIDv7).mockReturnValueOnce(io.jobId).mockReturnValueOnce(nextJobId);
  io.post.mockResolvedValueOnce(reply("POST", createPath, accepted, 202, jobPath)).mockResolvedValueOnce(reply("POST", createPath, {
    ...accepted, renderJobId: nextJobId, location: `/api/v1/core/templates/preview-jobs/${nextJobId}`,
  }, 202, nextJobPath));
  io.get.mockResolvedValueOnce(reply("GET", jobPath, {
    ...pending, status: "FAILED", lifecycleRevision: 2, attemptCount: 1,
    failure: { code: "RENDER_FAILED", failedAt: "2026-11-10T10:01:00.000Z", retryable: false },
  }, 200)).mockResolvedValueOnce(reply("GET", nextJobPath, { ...pending, renderJobId: nextJobId }, 200));
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(screen.getByRole("alert")).toHaveTextContent(copy.states.failed);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.retry })); });
  expect(io.post.mock.calls[1][1]).toEqual(io.post.mock.calls[0][1]);
  expect(io.post.mock.calls[1][2].headers).toEqual({ "x-idempotency-key": nextJobId });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
});

it.each([
  { focusDuringReload: "heading", staleResponse: "job status" },
  { focusDuringReload: "back link", staleResponse: "create" },
])("keeps Reload focused through a language change and preserves focus on the $focusDuringReload during reload",
async ({ focusDuringReload, staleResponse }) => {
  const { template, versionDetail } = setUp("FLOW_DOCUMENT");
  const stale = new TenantApiClientError("Stale version", {
    status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: "CORE.TEMPLATE.PREVIEW.SOURCE_STALE" },
  });
  if (staleResponse === "job status") io.get.mockRejectedValueOnce(stale);
  else io.post.mockRejectedValueOnce(stale);
  io.get.mockResolvedValueOnce(reply("GET", versionPath, versionDetail, 200));
  io.language = "ar";
  const { rerender, preview } = await showPreview(template);
  const arabic = templatePreviewMessages.ar;
  const frame = screen.getByTitle("معاينة عرض السعر");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: arabic.create })); });
  const reload = screen.getByRole("button", { name: "إعادة تحميل الإصدار المنشور" });
  reload.focus();
  io.language = "en";
  await act(async () => { rerender(preview(versionId)); });
  expect(screen.queryByRole("button", { name: copy.retry })).toBeNull();
  expect(screen.getByRole("button", { name: "Reload published version" })).toBe(reload);
  expect(reload).toHaveFocus();
  expect(screen.getByTitle("Quotation preview")).toBe(frame);
  expect(frame).toHaveAttribute("data-preview-version-id", versionId);
  expect(frame).toHaveAttribute("data-preview-fixture-key", fixture.fixtureKey);
  expect(frame).toHaveAttribute("data-preview-fixture-payload-checksum", fixture.fixtureChecksum);
  const readsBeforeReload = staleResponse === "job status" ? [versionPath, jobPath] : [versionPath];
  expect(io.get.mock.calls.map(([path]) => path)).toEqual(readsBeforeReload);
  expect(io.post).toHaveBeenCalledTimes(1);

  const heading = screen.getByRole("heading", { name: "Quotation preview" });
  const back = screen.getByRole("link", { name: "Back to template details" });
  fireEvent.click(reload);
  expect(heading).toHaveFocus();
  if (focusDuringReload === "back link") back.focus();
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(screen.getByRole("button", { name: copy.create })).toBeEnabled();
  expect(focusDuringReload === "heading" ? heading : back).toHaveFocus();
  expect(io.get.mock.calls.map(([path]) => path)).toEqual([...readsBeforeReload, versionPath]);
  expect(io.post).toHaveBeenCalledTimes(1);
});

it("aborts the old poll and uses only the replacement version's Arabic fixture", async () => {
  const { template, completed } = setUp("FLOW_DOCUMENT");
  const oldCompletion = reply("GET", jobPath, completed, 200);
  let deliverOldCompletion!: (value: typeof oldCompletion) => void;
  const oldRead = new Promise<typeof oldCompletion>(resolve => { deliverOldCompletion = resolve; });
  io.get.mockReturnValueOnce(oldRead);
  const { rerender, preview } = await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  const firstStatusSignal = io.get.mock.calls[1][1].signal as AbortSignal;
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
  screen.getByRole("button", { name: copy.stop }).focus();

  const replacement = setUp("FLOW_DOCUMENT", false, otherVersion, "01900100-0000-7000-8000-000000000006", arabicFixture);
  io.get.mockResolvedValueOnce(reply("GET", replacement.selectedJobPath, replacement.pending, 200))
    .mockResolvedValueOnce(reply("GET", replacement.selectedJobPath, replacement.completed, 200))
    .mockResolvedValueOnce(pdfReply(replacement.completed.artifact.downloadUrl));
  rerender(preview(otherVersion, replacement.template));
  expect(firstStatusSignal.aborted).toBe(true);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByRole("heading", { name: "Quotation preview" })).toHaveFocus();
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(screen.getByTitle("Quotation preview")).toHaveAttribute("data-preview-version-id", otherVersion);
  expect(screen.getByTitle("Quotation preview")).toHaveAttribute("data-preview-fixture-key", arabicFixture.fixtureKey);
  expect(screen.getByTitle("Quotation preview")).toHaveAttribute("data-preview-fixture-payload-checksum", arabicFixture.fixtureChecksum);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  expect(io.post.mock.calls[1][1]).toEqual({
    source: { kind: "VERSION", versionId: otherVersion }, fixtureKey: arabicFixture.fixtureKey,
    locale: arabicFixture.locale, timeZone: "Africa/Cairo",
  });
  await act(async () => { deliverOldCompletion(oldCompletion); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.pending);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: copy.download })).toBeNull();

  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(screen.getByRole("status")).toHaveTextContent(copy.states.completed);
  const { replace, save } = browserDownload();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.download })); });
  expect(replace).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledOnce();
  expect(io.get.mock.lastCall?.[0]).toBe(replacement.completed.artifact.downloadUrl);
  expect(io.get.mock.calls.filter(([path]) => path === jobPath)).toHaveLength(1);
});

it.each([
  ["en", "version change"], ["ar", "version change"],
  ["en", "artifact expiry"], ["ar", "artifact expiry"],
] as const)("withholds the %s download on %s during verification", async (language, event) => {
  io.language = language;
  const copy = templatePreviewMessages[language];
  const selectedFixture = { en: fixture, ar: arabicFixture }[language];
  const { template, completed } = setUp("FLOW_DOCUMENT", false, versionId, io.jobId, selectedFixture);
  const oldCompletion = reply("GET", jobPath, completed, 200);
  let deliverDownloadCheck!: (value: ReturnType<typeof pdfReply>) => void;
  const downloadCheck = new Promise<ReturnType<typeof pdfReply>>(resolve => { deliverDownloadCheck = resolve; });
  io.get.mockResolvedValueOnce(oldCompletion).mockReturnValueOnce(downloadCheck);
  const { close, replace, save } = browserDownload();

  const { rerender, preview } = await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  const downloadButton = screen.getByRole("button", { name: copy.download });
  downloadButton.focus();
  await act(async () => { fireEvent.click(downloadButton); });
  expect(downloadButton).toHaveFocus();
  expect(downloadButton).toHaveAttribute("aria-disabled", "true");
  const downloadSignal = io.get.mock.calls[2][1].signal as AbortSignal;
  expect(downloadSignal.aborted).toBe(false);

  if (event === "version change") {
    setUp("FLOW_DOCUMENT", false, otherVersion, io.jobId, selectedFixture);
    rerender(preview(otherVersion));
    expect(downloadSignal.aborted).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  } else {
    vi.setSystemTime(new Date(artifact.downloadUrlExpiresAt));
  }
  await act(async () => { deliverDownloadCheck(pdfReply(artifact.downloadUrl)); });

  expect(document.querySelector("iframe")).toHaveAttribute("data-preview-version-id", event === "version change" ? otherVersion : versionId);
  if (event === "artifact expiry") expect(screen.getByRole("alert")).toHaveTextContent(copy.states.expired);
  expect(screen.getByRole("button", { name: event === "artifact expiry" ? copy.retry : copy.create })).toBeEnabled();
  expect(close).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it("retires a published job on the authenticated session end", async () => {
  const { template } = setUp("FLOW_DOCUMENT");
  io.get.mockImplementationOnce(() => new Promise(() => undefined));
  await showPreview(template);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.create })); });
  const signal = io.get.mock.calls[1][1].signal as AbortSignal;
  act(() => { for (const [listener] of io.authEvents.mock.calls) listener({ kind: "session-ended", sessionId: "session" }); });
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
});
