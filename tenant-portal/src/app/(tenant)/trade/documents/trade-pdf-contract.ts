import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  isBoundedString,
  isTradeTimestamp,
  record,
  tradeInvalidResponse,
} from "./trade-document-contract";

// The six `render-pdf` families share one job shape. `RenderQuotationPdfDto`
// takes `revisionId` and the single purpose `CUSTOMER_QUOTATION`;
// `RenderTradeBusinessPdfDto` takes `sourceVersion` and one of five purposes
// that must match its own route's family. Both are 202.

// The job status is `PENDING` · `RETRYING` · `COMPLETED` · `FAILED`, and the
// five business-document purposes are `SUPPLIER_QUOTATION`, `SALES_ORDER`,
// `PURCHASE_ORDER`, `INVOICE` and `CONTRACT` — `@IsIn`, never inferred from the
// route. Both sets are labelled in trade-document-status.ts and passed as
// literals at the four call sites, so neither needs a type of its own here.

interface TradeRenderArtifact {
  checksum: string;
  sizeBytes: number;
  pageCount: number;
  completedAt: string;
  downloadUrl: string;
  downloadExpiresAt: string;
}

export interface TradeRenderJob {
  renderJobId: string;
  status: string;
  attemptCount: number;
  quotationId?: string;
  quotationRevisionId?: string;
  templateDefinitionId?: string;
  templateVersionId?: string;
  /**
   * Present when the worker reported a failure.
   *
   * **This lives inside a 200 body, never in an HTTP status.**
   * `quotation-pdf-results.service.ts` and
   * `business-document-pdf-results.service.ts` contain no `new …Exception` at
   * all: `PDF_INPUT_EXPIRED` and `PDF_RENDER_FAILED` are written through
   * `safePdfFailureCode`, and `PDF_RESULT_CONFLICT` onto the inbox row. A poll
   * loop that only inspects the response status spins forever on a dead job.
   */
  failure: { code: string; terminal: boolean } | null;
  /**
   * The canonical poll path, built by the service itself.
   *
   * Poll requests are rebuilt from validated resource IDs, so a response can
   * never redirect a read to an unrelated document or origin.
   */
  statusUrl: string;
  artifact: TradeRenderArtifact | null;
}

export const TRADE_PDF_RESPONSE_BYTES = 50_000;

/** Repeated polls of a job that may take tens of seconds to render. */
export const TRADE_PDF_POLL_INTERVAL_MS = 2_000;
export const TRADE_PDF_POLL_LIMIT = 60;

export function parseTradeRenderJob(payload: unknown): TradeRenderJob {
  const job = record(payload);
  if (
    !job ||
    !isUUIDv7(job.renderJobId) ||
    !["PENDING", "RETRYING", "COMPLETED", "FAILED"].includes(String(job.status)) ||
    typeof job.status !== "string" ||
    typeof job.attemptCount !== "number" || !Number.isSafeInteger(job.attemptCount) || job.attemptCount < 0 ||
    !isBoundedString(job.statusUrl, 300) ||
    !job.statusUrl.startsWith("/api/tenant/trade/v1/")
  ) {
    tradeInvalidResponse();
  }
  return {
    renderJobId: job.renderJobId,
    status: job.status,
    attemptCount: job.attemptCount,
    failure: parseFailure(job.failure),
    statusUrl: job.statusUrl,
    artifact: parseArtifact(job.artifact),
    ...optionalJobIds(job),
  };
}

function optionalJobIds(job: Record<string, unknown>): Pick<TradeRenderJob, "quotationId" | "quotationRevisionId" | "templateDefinitionId" | "templateVersionId"> {
  const ids: Pick<TradeRenderJob, "quotationId" | "quotationRevisionId" | "templateDefinitionId" | "templateVersionId"> = {};
  for (const key of ["quotationId", "quotationRevisionId", "templateDefinitionId", "templateVersionId"] as const) {
    if (job[key] === undefined) continue;
    if (!isUUIDv7(job[key])) tradeInvalidResponse();
    ids[key] = job[key];
  }
  return ids;
}

/** Branch-authorized binary endpoint; no caller-controlled storage URL. */
export function quotationRenderArtifactPath(quotationId: string, jobId: string): TradePath {
  if (!isUUIDv7(quotationId) || !isUUIDv7(jobId)) tradeInvalidResponse();
  return `/api/tenant/trade/v1/quotations/${quotationId}/render-jobs/${jobId}/artifact`;
}

/**
 * The poll path, rebuilt from ids rather than trusted from the body.
 *
 * `statusUrl` is validated above and is what the service emits, but a path is
 * the one thing a screen must never take on faith from a response — so the
 * shape is re-checked against the family this screen actually belongs to.
 */
export function tradeRenderJobPath(base: string, documentId: string, jobId: string): TradePath {
  if (!isUUIDv7(documentId) || !isUUIDv7(jobId)) tradeInvalidResponse();
  return `${base}/${documentId}/render-jobs/${jobId}` as TradePath;
}

export function tradeRenderPdfPath(base: string, documentId: string): TradePath {
  if (!isUUIDv7(documentId)) tradeInvalidResponse();
  return `${base}/${documentId}/render-pdf` as TradePath;
}

function parseFailure(value: unknown): TradeRenderJob["failure"] {
  const failure = record(value);
  if (!failure) return null;
  if (!isBoundedString(failure.code, 120) || typeof failure.terminal !== "boolean") {
    tradeInvalidResponse();
  }
  return { code: failure.code, terminal: failure.terminal };
}

function parseArtifact(value: unknown): TradeRenderArtifact | null {
  const artifact = record(value);
  if (!artifact) return null;
  if (
    !isBoundedString(artifact.checksum, 200) ||
    typeof artifact.sizeBytes !== "number" || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 1 ||
    typeof artifact.pageCount !== "number" || !Number.isSafeInteger(artifact.pageCount) || artifact.pageCount < 1 ||
    !isTradeTimestamp(artifact.completedAt) ||
    !isBoundedString(artifact.downloadUrl, 4_000) ||
    !isTradeTimestamp(artifact.downloadExpiresAt)
  ) {
    tradeInvalidResponse();
  }
  let downloadUrl: URL;
  try {
    downloadUrl = new URL(artifact.downloadUrl);
  } catch {
    tradeInvalidResponse();
  }
  if (
    downloadUrl.protocol !== "https:" &&
    !(downloadUrl.protocol === "http:" && typeof window !== "undefined" && window.location.protocol === "http:")
  ) {
    tradeInvalidResponse();
  }
  return {
    checksum: artifact.checksum,
    sizeBytes: artifact.sizeBytes,
    pageCount: artifact.pageCount,
    completedAt: artifact.completedAt,
    downloadUrl: artifact.downloadUrl,
    downloadExpiresAt: artifact.downloadExpiresAt,
  };
}
