import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { coreGetResponse, corePostResponse } from "../core-api";
import { readTemplateResponse, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "./template-wire";
import { invalidCoreResponse, record, requiredUuidV7 } from "../contracts/core-page";
import type { PreviewRequest } from "./template-lifecycle-api";
import { parseTemplateVersion, type TemplateVersion } from "./template-lifecycle-contract";
import {
  parseAcceptedPdfPreview, parsePdfPreviewJob, pdfJobPath, requirePdfPreviewIntent,
  type AcceptedPdfPreview, type PdfPreviewJob, type PreviewPdfPin, type PreviewVersionPin,
} from "./template-preview-session-contract";
import type { TemplateDetail } from "./templates-contract";

function assertPreviewResponseTarget(
  response: Awaited<ReturnType<typeof coreGetResponse>>,
  path: string,
  method: "POST" | "GET",
) {
  const target = response.request;
  if (response.provenance !== "http" || !target?.origin || target.method !== method ||
    target.endpoint !== path || target.redirected !== false || target.finalUrl !== `${target.origin}${path}`) {
    invalidCoreResponse();
  }
}

function readPreviewResponse(
  response: Awaited<ReturnType<typeof coreGetResponse>>,
  path: string,
  method: "POST" | "GET",
  status: 202 | 200,
) {
  assertPreviewResponseTarget(response, path, method);
  return readTemplateResponse(response, [status]);
}

export async function createPinnedPdfPreview(pin: PreviewPdfPin, request: PreviewRequest, key: string, signal: AbortSignal) {
  requirePdfPreviewIntent(pin, request?.source);
  requiredUuidV7({ key }, "key");
  const path = `/api/tenant/core/v1/templates/${pin.templateId}/preview/pdf` as const;
  const response = await corePostResponse(path, request, {
    signal, headers: { "x-idempotency-key": key }, cache: "no-store", redirect: "error",
    maxResponseBytes: 400_000, requireExactResponseTarget: true,
  });
  const accepted = parseAcceptedPdfPreview(readPreviewResponse(response, path, "POST", 202), pin);
  // Current Core uses the command identity as the render job identity, including exact replays.
  if (accepted.renderJobId !== key || response.headers.get("location") !== pdfJobPath(key)) invalidCoreResponse();
  return accepted;
}

export async function readPinnedPdfPreview(accepted: AcceptedPdfPreview, signal: AbortSignal) {
  const path = pdfJobPath(accepted.renderJobId);
  const response = await coreGetResponse(path, {
    signal, cache: "no-store", redirect: "error", maxResponseBytes: 400_000, requireExactResponseTarget: true,
  });
  return parsePdfPreviewJob(readPreviewResponse(response, path, "GET", 200), accepted);
}

export async function fetchPinnedPdfArtifact(job: PdfPreviewJob, signal: AbortSignal, assertCurrent: () => void) {
  const { artifact } = job;
  const path = `${pdfJobPath(job.renderJobId)}/artifact` as const;
  if (job.status !== "COMPLETED" || artifact?.downloadUrl !== path) invalidCoreResponse();
  const response = await coreGetResponse(path, {
    signal, assertCurrent, cache: "no-store", redirect: "error", requireExactResponseTarget: true,
    headers: { Accept: "application/pdf" }, responseType: "blob", nonReplayable: true,
    maxBinaryResponseBytes: artifact.sizeBytes, maxResponseBytes: 400_000,
  });
  assertPreviewResponseTarget(response, path, "GET");
  const { data, headers, status } = response;
  if (status !== 200 || headers.get("content-type")?.trim().toLowerCase() !== "application/pdf" ||
      headers.get("content-disposition") !== `attachment; filename="template-preview-${job.renderJobId}.pdf"` ||
      !(data instanceof Blob) || data.size !== artifact.sizeBytes) invalidCoreResponse();
  const bytes = new Uint8Array(await data.arrayBuffer());
  signal.throwIfAborted();
  assertCurrent();
  if (bytesToHex(sha256(bytes)) !== artifact.checksum) invalidCoreResponse();
  return data;
}

export async function confirmPublishedPdfVersion(
  definition: Pick<TemplateDetail, "id" | "documentType" | "outputChannel" | "layoutMode" | "locale" | "dataSourceKey">,
  selected: TemplateVersion,
  schemaChecksum: string,
  compiledArtifactChecksum: string,
  signal: AbortSignal,
): Promise<PreviewVersionPin | null> {
  const templateId = requiredUuidV7(definition, "id");
  const versionId = requiredUuidV7({ id: selected.id }, "id");
  const path = `/api/tenant/core/v1/templates/${templateId}/versions/${versionId}` as const;
  const response = await coreGetResponse(path, {
    signal, cache: "no-store", redirect: "error", maxResponseBytes: TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES,
    requireExactResponseTarget: true,
  });
  const row = record(readPreviewResponse(response, path, "GET", 200));
  if (!row) invalidCoreResponse();
  const version = parseTemplateVersion(row);
  if (row.templateDefinitionId !== templateId || version.id !== versionId || version.lifecycleStatus !== "PUBLISHED" ||
    version.versionNumber !== selected.versionNumber || version.dataSourceKey !== definition.dataSourceKey ||
    version.locale !== definition.locale || version.templateContentChecksum !== selected.templateContentChecksum ||
    row.compiledChecksum !== compiledArtifactChecksum || row.documentType !== definition.documentType ||
    row.outputChannel !== definition.outputChannel || row.layoutMode !== definition.layoutMode) invalidCoreResponse();

  const document = record(row.editorDocument);
  if (!document || row.editorSchemaVersion !== 1 || document.schemaVersion !== row.editorSchemaVersion ||
    document.documentType !== definition.documentType || document.outputChannel !== definition.outputChannel ||
    document.layoutMode !== definition.layoutMode || document.locale !== definition.locale ||
    document.dataSourceKey !== definition.dataSourceKey || row.dataSourceSchemaVersion !== 1 ||
    row.dataSourceSchemaChecksum !== schemaChecksum || !version.rendererTargets.includes("PDF")) return null;
  const { canonicalJson } = await import("@mutakamel/template-schema/browser-safe");
  const checksum = bytesToHex(sha256(new TextEncoder().encode(canonicalJson(document))));
  if (checksum !== version.templateContentChecksum) invalidCoreResponse();
  // Core checks the version's document for these PDF constraints, independently of the draft.
  if (!record(document.page) || (definition.layoutMode === "FIXED_CANVAS" && Object.hasOwn(document, "canvasPages"))) return null;
  return { templateId, versionId, versionNumber: version.versionNumber, templateContentChecksum: checksum, compiledArtifactChecksum };
}
