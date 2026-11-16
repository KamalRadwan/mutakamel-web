import { invalidCoreResponse, record, requiredText, requiredTimestamp, requiredUuidV7 } from "../contracts/core-page";

export interface PreviewDraftPin {
  templateId: string;
  draftId: string;
  draftRevision: number;
  templateContentChecksum: string;
}

export interface PreviewVersionPin {
  templateId: string;
  versionId: string;
  versionNumber: number;
  templateContentChecksum: string;
  compiledArtifactChecksum: string;
}

export type PreviewPdfPin = PreviewDraftPin | PreviewVersionPin;

type PreviewJobPin = PreviewPdfPin & {
  compiledArtifactChecksum: string;
  renderJobId: string;
  createdAt: string;
  expiresAt: string;
};

export type AcceptedPdfPreview = PreviewJobPin & { status: "PENDING" };
export type PdfPreviewJob = PreviewJobPin & {
  status: "PENDING" | "RETRYING" | "COMPLETED" | "FAILED";
  lifecycleRevision: number;
  attemptCount: number;
  nextRetryAt: string | null;
  failureCode: string | null;
  failedAt?: string;
  artifact: {
    downloadUrl: string; downloadUrlExpiresAt: string; checksum: string;
    sizeBytes: number; pageCount: number; rendererVersion: string; browserBuildFingerprint: string;
  } | null;
};

function integer(row: Record<string, unknown>, key: string, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalidCoreResponse();
  }
  return value;
}

function checksum(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key, 64);
  if (!/^[a-f0-9]{64}$/u.test(value)) invalidCoreResponse();
  return value;
}

// Core's PDF acceptance and status DTOs serialize these dates with toISOString().
function timestamp(row: Record<string, unknown>, key: string): string {
  const value = requiredTimestamp(row, key);
  if (new Date(value).toISOString() !== value) invalidCoreResponse();
  return value;
}

export function pdfJobPath(jobId: string): `/api/tenant/core/v1/templates/preview-jobs/${string}` {
  requiredUuidV7({ jobId }, "jobId");
  return `/api/tenant/core/v1/templates/preview-jobs/${jobId}`;
}

export function requirePdfPreviewIntent(pin: PreviewPdfPin, requestSource: unknown): void {
  const evidence = { ...pin };
  requiredUuidV7(evidence, "templateId");
  checksum(evidence, "templateContentChecksum");
  const source = record(requestSource);
  if (!source || Object.keys(source).length !== 2) invalidCoreResponse();
  if ("versionId" in pin) {
    checksum(evidence, "compiledArtifactChecksum");
    integer(evidence, "versionNumber");
    if (source.kind !== "VERSION" || requiredUuidV7(source, "versionId") !== requiredUuidV7(evidence, "versionId")) {
      invalidCoreResponse();
    }
  } else if (source.kind !== "DRAFT" || integer(source, "draftRevision") !== pin.draftRevision) {
    invalidCoreResponse();
  } else {
    requiredUuidV7(evidence, "draftId");
  }
}

function parsePin(row: Record<string, unknown>, expected: PreviewPdfPin): PreviewJobPin {
  const source = record(row.source);
  if (!source || row.renderTarget !== "PDF") invalidCoreResponse();
  const pin = {
    templateId: requiredUuidV7(row, "templateId"), templateContentChecksum: checksum(row, "templateContentChecksum"),
    compiledArtifactChecksum: checksum(row, "compiledArtifactChecksum"), renderJobId: requiredUuidV7(row, "renderJobId"),
    createdAt: timestamp(row, "createdAt"), expiresAt: timestamp(row, "expiresAt"),
  };
  if (pin.templateId !== expected.templateId || pin.templateContentChecksum !== expected.templateContentChecksum ||
    Date.parse(pin.expiresAt) <= Date.parse(pin.createdAt)) invalidCoreResponse();
  if ("versionId" in expected) {
    if (source.kind !== "VERSION" || Object.hasOwn(source, "draftId") || Object.hasOwn(source, "draftRevision") ||
      requiredUuidV7(source, "versionId") !== expected.versionId || integer(source, "versionNumber") !== expected.versionNumber ||
      pin.compiledArtifactChecksum !== expected.compiledArtifactChecksum) invalidCoreResponse();
    return { ...pin, versionId: expected.versionId, versionNumber: expected.versionNumber };
  }
  if (source.kind !== "DRAFT" || Object.hasOwn(source, "versionId") || Object.hasOwn(source, "versionNumber") ||
    requiredUuidV7(source, "draftId") !== expected.draftId || integer(source, "draftRevision") !== expected.draftRevision) {
    invalidCoreResponse();
  }
  return { ...pin, draftId: expected.draftId, draftRevision: expected.draftRevision };
}

/** Current Core `createPdfPreview` / `previewJobDto`; no receipt or snapshot fields are invented. */
export function parseAcceptedPdfPreview(payload: unknown, expected: PreviewPdfPin): AcceptedPdfPreview {
  const row = record(payload);
  if (!row || row.kind !== "PDF_ACCEPTED" || row.status !== "PENDING") invalidCoreResponse();
  const pin = parsePin(row, expected);
  if (row.location !== `/api/v1/core/templates/preview-jobs/${pin.renderJobId}`) invalidCoreResponse();
  return { ...pin, status: "PENDING" };
}

export function parsePdfPreviewJob(payload: unknown, accepted: AcceptedPdfPreview): PdfPreviewJob {
  const row = record(payload);
  const status = row?.status;
  if (!row || (status !== "PENDING" && status !== "RETRYING" && status !== "COMPLETED" && status !== "FAILED")) {
    invalidCoreResponse();
  }
  const pin = parsePin(row, accepted);
  if (pin.renderJobId !== accepted.renderJobId || pin.compiledArtifactChecksum !== accepted.compiledArtifactChecksum ||
    pin.createdAt !== accepted.createdAt || pin.expiresAt !== accepted.expiresAt) invalidCoreResponse();
  const base = { ...pin, lifecycleRevision: integer(row, "lifecycleRevision"), attemptCount: integer(row, "attemptCount", 0, 3) };
  if (status === "COMPLETED") {
    const artifact = record(row.artifact);
    const downloadUrl = `${pdfJobPath(pin.renderJobId)}/artifact`;
    if (!artifact || row.failure !== null || row.nextRetryAt !== null || base.attemptCount === 0 ||
      artifact.downloadUrl !== downloadUrl) invalidCoreResponse();
    const expiry = timestamp(artifact, "downloadUrlExpiresAt");
    if (Date.parse(expiry) <= Date.parse(pin.createdAt)) invalidCoreResponse();
    // Core projects the Worker v1 result, bounded by pdf-contracts.ts and TemplatePreviewJobEntity.
    return { ...base, status: "COMPLETED", nextRetryAt: null, failureCode: null, artifact: {
      downloadUrl, downloadUrlExpiresAt: expiry, checksum: checksum(artifact, "checksum"),
      sizeBytes: integer(artifact, "sizeBytes", 1, 25 * 1024 * 1024), pageCount: integer(artifact, "pageCount", 1, 200),
      rendererVersion: requiredText(artifact, "rendererVersion", 100),
      browserBuildFingerprint: checksum(artifact, "browserBuildFingerprint"),
    } };
  }
  if (row.artifact !== null) invalidCoreResponse();
  if (status === "FAILED") {
    const failure = record(row.failure);
    if (!failure || failure.retryable !== false || row.nextRetryAt !== null) invalidCoreResponse();
    return { ...base, status: "FAILED", nextRetryAt: null, artifact: null,
      failureCode: requiredText(failure, "code", 120), failedAt: timestamp(failure, "failedAt") };
  }
  if (row.failure !== null || (status === "PENDING" && (base.attemptCount !== 0 || row.nextRetryAt !== null))) {
    invalidCoreResponse();
  }
  return { ...base, status, artifact: null, failureCode: null,
    nextRetryAt: row.nextRetryAt === null ? null : timestamp(row, "nextRetryAt") };
}

/** A mutable/lower lifecycle response must never replace an already observed immutable output. */
export function assertPdfJobProgress(previous: PdfPreviewJob | null, next: PdfPreviewJob): void {
  if (!previous) return;
  if (next.lifecycleRevision < previous.lifecycleRevision || next.attemptCount < previous.attemptCount ||
    (previous.status === "COMPLETED" && JSON.stringify(next) !== JSON.stringify(previous)) ||
    (previous.status === "FAILED" && JSON.stringify(next) !== JSON.stringify(previous)) ||
    (next.lifecycleRevision === previous.lifecycleRevision && JSON.stringify(next) !== JSON.stringify(previous))) invalidCoreResponse();
}
