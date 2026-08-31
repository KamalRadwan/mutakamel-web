import type { CorePath } from "@/lib/api/envelope";
import { coreGet, corePost } from "../core-api";
import {
  TEMPLATE_PAGE_LIMIT,
  parseTemplateCursorPage,
  type TemplateCursorPage,
} from "./templates-contract";
import {
  parseAcceptedPreviewJob,
  parseEmailPreview,
  parseHtmlPreview,
  parsePreviewJob,
  parseRecoverySnapshot,
  parseTemplateVersion,
  parseValidationRun,
  type TemplateEmailPreview,
  type TemplateHtmlPreview,
  type TemplatePreviewJob,
  type TemplateRecoverySnapshot,
  type TemplateValidationRun,
  type TemplateVersion,
} from "./template-lifecycle-contract";

const LIST_LIMIT_BYTES = 900_000;
const PREVIEW_LIMIT_BYTES = 5_000_000;
const ROW_LIMIT_BYTES = 400_000;

function id(value: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(value)) throw new Error("Invalid Core template identifier.");
  return encodeURIComponent(value);
}

function cursorQuery(cursor: string | undefined, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ limit: String(TEMPLATE_PAGE_LIMIT), ...extra });
  // Byte-for-byte: the cursor is HMAC-signed over its own bytes, so any
  // re-encoding invalidates it.
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}

export async function fetchTemplateVersions(
  templateId: string,
  options: { cursor?: string; lifecycleStatus?: string; signal?: AbortSignal },
): Promise<TemplateCursorPage<TemplateVersion>> {
  const extra: Record<string, string> = options.lifecycleStatus
    ? { lifecycleStatus: options.lifecycleStatus }
    : {};
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions?${cursorQuery(options.cursor, extra)}` as CorePath;
  const result = await coreGet(path, {
    signal: options.signal,
    maxResponseBytes: LIST_LIMIT_BYTES,
  });
  return parseTemplateCursorPage(result.data, parseTemplateVersion);
}

export async function fetchTemplateVersion(
  templateId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<TemplateVersion> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions/${id(versionId)}` as CorePath;
  const result = await coreGet(path, { signal, maxResponseBytes: ROW_LIMIT_BYTES });
  return parseTemplateVersion(result.data);
}

/** Replaces the draft from an immutable version and **records an operator reason**. */
export async function restoreTemplateVersion(
  templateId: string,
  versionId: string,
  body: { reason: string; discardCurrentDraft: boolean },
  ifMatch: string,
): Promise<void> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions/${id(versionId)}/restore` as CorePath;
  await corePost(path, body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
}

/** **200**, **no body**, `If-Match` on the **definition** revision. */
export async function retireTemplateVersion(
  templateId: string,
  versionId: string,
  ifMatch: string,
): Promise<void> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions/${id(versionId)}/retire` as CorePath;
  await corePost(path, undefined, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
}

/** **200**, `If-Match` on the **draft** revision. Exactly two renderer targets. */
export async function validateTemplateDraft(
  templateId: string,
  body: { draftRevision: number; rendererTargets: string[] },
  ifMatch: string,
): Promise<TemplateValidationRun> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/validate` as CorePath;
  const result = await corePost(path, body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  return parseValidationRun(result.data);
}

/**
 * **201.** Three preconditions, pinned separately: the definition revision in
 * `If-Match`, the draft revision in the body, and a passed validation run for
 * that exact draft revision.
 */
export async function publishTemplate(
  templateId: string,
  body: {
    definitionRevision: number;
    draftRevision: number;
    validationRunId: string;
    changeNote?: string;
    setAsDefinitionPublished: true;
  },
  ifMatch: string,
): Promise<void> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/publish` as CorePath;
  await corePost(path, body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
}

export async function fetchRecoverySnapshots(
  templateId: string,
  options: { cursor?: string; signal?: AbortSignal },
): Promise<TemplateCursorPage<TemplateRecoverySnapshot>> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/draft/recovery-snapshots?${cursorQuery(options.cursor)}` as CorePath;
  const result = await coreGet(path, {
    signal: options.signal,
    maxResponseBytes: LIST_LIMIT_BYTES,
  });
  return parseTemplateCursorPage(result.data, parseRecoverySnapshot);
}

/** Requires the checksum, an operator **reason** and an explicit discard acknowledgement. */
export async function restoreRecoverySnapshot(
  templateId: string,
  snapshotId: string,
  body: { expectedSnapshotChecksum: string; reason: string; discardCurrentDraft: true },
  ifMatch: string,
): Promise<void> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/draft/recovery-snapshots/${id(snapshotId)}/restore` as CorePath;
  await corePost(path, body, {
    headers: { "If-Match": ifMatch },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
}

export interface PreviewRequest {
  source:
    | { kind: "DRAFT"; draftRevision: number }
    | { kind: "VERSION"; versionId: string };
  fixtureKey: string;
  locale: string;
  timeZone: string;
}

/** Synchronous **200** from a pinned source — never "whatever is current". */
export async function previewTemplateHtml(
  templateId: string,
  body: PreviewRequest,
): Promise<TemplateHtmlPreview> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/preview/html` as CorePath;
  const result = await corePost(path, body, { maxResponseBytes: PREVIEW_LIMIT_BYTES });
  return parseHtmlPreview(result.data);
}

export async function previewTemplateEmail(
  templateId: string,
  body: PreviewRequest,
): Promise<TemplateEmailPreview> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/preview/email` as CorePath;
  const result = await corePost(path, body, { maxResponseBytes: PREVIEW_LIMIT_BYTES });
  return parseEmailPreview(result.data);
}

/** **202.** Returns the job id to poll; the artifact is fetched separately. */
export async function requestPdfPreview(
  templateId: string,
  body: PreviewRequest,
): Promise<string> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/preview/pdf` as CorePath;
  const result = await corePost(path, body, { maxResponseBytes: ROW_LIMIT_BYTES });
  return parseAcceptedPreviewJob(result.data);
}

export async function fetchPreviewJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TemplatePreviewJob> {
  const path = `/api/tenant/core/v1/templates/preview-jobs/${id(jobId)}` as CorePath;
  const result = await coreGet(path, { signal, maxResponseBytes: ROW_LIMIT_BYTES });
  return parsePreviewJob(result.data);
}

/**
 * The artifact is streamed from a same-origin, authorised route. It is opened
 * rather than fetched: the response is `application/pdf` with a
 * `Content-Disposition`, and there is nothing for a JSON validator to check.
 */
export function previewArtifactHref(jobId: string): string {
  return `/api/tenant/core/v1/templates/preview-jobs/${id(jobId)}/artifact`;
}
