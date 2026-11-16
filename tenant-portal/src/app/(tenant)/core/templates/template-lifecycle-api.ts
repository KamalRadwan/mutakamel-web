import type { CorePath } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { coreGet, coreGetResponse, corePost, corePostResponse } from "../core-api";
import { invalidCoreResponse, record } from "../contracts/core-page";
import { InvalidRecoveryRestoreReply, InvalidVersionRestoreReply, readTemplateResponse } from "./template-wire";
import { parseTemplateDraftDocument } from "./template-design-api";
import { parseTemplateSourceTuple } from "./template-source-metadata";
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

export interface TemplateVersionReadScope {
  headers: Record<string, string>;
  locale: string;
}

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
  options: { cursor?: string; lifecycleStatus?: string; signal?: AbortSignal; scope?: TemplateVersionReadScope },
): Promise<TemplateCursorPage<TemplateVersion>> {
  const extra: Record<string, string> = options.lifecycleStatus
    ? { lifecycleStatus: options.lifecycleStatus }
    : {};
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions?${cursorQuery(options.cursor, extra)}` as CorePath;
  const config = {
    signal: options.signal,
    maxResponseBytes: LIST_LIMIT_BYTES,
  };
  const { scope } = options;
  if (!scope) return parseTemplateCursorPage((await coreGet(path, config)).data, parseTemplateVersion);
  const result = await coreGetResponse(path, { ...config, headers: scope.headers, requireExactResponseTarget: true });
  const envelope = record(result.data);
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data")) invalidCoreResponse();
  return parseTemplateCursorPage(readTemplateResponse(result, [200]), value => {
    const version = parseTemplateVersion(value);
    if (record(value)?.templateDefinitionId !== templateId || version.locale !== scope.locale ||
      !["PUBLISHED", "RETIRED"].includes(version.lifecycleStatus)) invalidCoreResponse();
    return version;
  });
}

export async function fetchTemplateVersion(
  templateId: string,
  versionId: string,
  signal?: AbortSignal,
  verification?: { selected: TemplateVersion; scope: TemplateVersionReadScope; assertCurrent?: () => void },
): Promise<TemplateVersion> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions/${id(versionId)}` as CorePath;
  const config = { signal, maxResponseBytes: ROW_LIMIT_BYTES };
  if (!verification) return parseTemplateVersion((await coreGet(path, config)).data);

  const { selected, scope, assertCurrent } = verification;
  const result = await coreGetResponse(path, { ...config, headers: scope.headers, requireExactResponseTarget: true,
    ...(assertCurrent ? { assertCurrent } : {}) });
  const envelope = record(result.data);
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data")) invalidCoreResponse();
  const payload = record(readTemplateResponse(result, [200]));
  const version = parseTemplateVersion(payload);
  const document = record(payload?.editorDocument);
  if (payload?.templateDefinitionId !== templateId || version.id !== versionId || version.id !== selected.id ||
    version.versionNumber !== selected.versionNumber || version.lifecycleStatus !== selected.lifecycleStatus ||
    !["PUBLISHED", "RETIRED"].includes(version.lifecycleStatus) ||
    version.publishedAt !== selected.publishedAt || version.retiredAt !== selected.retiredAt ||
    version.dataSourceKey !== selected.dataSourceKey || selected.locale !== scope.locale || version.locale !== scope.locale ||
    (version.publisherActorId && selected.publisherActorId && version.publisherActorId !== selected.publisherActorId) ||
    (version.publisherName && selected.publisherName && version.publisherName !== selected.publisherName) ||
    version.templateContentChecksum !== selected.templateContentChecksum ||
    !/^[a-f0-9]{64}$/u.test(version.templateContentChecksum) || !document ||
    typeof payload.editorSchemaVersion !== "number" || !Number.isSafeInteger(payload.editorSchemaVersion) ||
    payload.editorSchemaVersion < 1 || document.schemaVersion !== payload.editorSchemaVersion ||
    document.dataSourceKey !== version.dataSourceKey || document.locale !== version.locale) invalidCoreResponse();
  if (await canonicalDocumentChecksum(document) !== version.templateContentChecksum) invalidCoreResponse();
  return version;
}

async function canonicalDocumentChecksum(document: unknown): Promise<string> {
  const [{ canonicalJson }, { sha256 }] = await Promise.all([
    import("@mutakamel/template-schema/browser-safe"),
    import("@noble/hashes/sha2.js"),
  ]);
  return Array.from(sha256(new TextEncoder().encode(canonicalJson(document))),
    byte => byte.toString(16).padStart(2, "0")).join("");
}

interface DraftRestoreExpectation {
  draftId: string;
  revision: number;
  etag: string;
  assertCurrent(): void;
}

function restoreReplyCorrelation(response: Awaited<ReturnType<typeof corePostResponse>>): string | undefined {
  const envelope = record(response.data);
  return response.headers.get("x-correlation-id") ??
    (typeof envelope?.correlationId === "string" ? envelope.correlationId : undefined);
}

function readRestoredDraftReceipt(response: Awaited<ReturnType<typeof corePostResponse>>,
  templateId: string, expected: DraftRestoreExpectation) {
  const envelope = record(response.data);
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data")) invalidCoreResponse();
  const payload = record(readTemplateResponse(response, [200]));
  const wireDraft = record(payload?.draft);
  if (!payload || !wireDraft) invalidCoreResponse();
  const draft = parseTemplateDraftDocument(wireDraft);
  const revision = expected.revision + 1;
  const etag = `"${revision}"`;
  if (draft.templateId !== templateId || draft.draftId !== expected.draftId ||
      draft.revision !== revision || draft.etag !== etag ||
      response.headers.get("etag") !== etag) invalidCoreResponse();
  return { payload, wireDraft, revision };
}

/** Restores an immutable version and reports whether Core replayed the receipt. */
export async function restoreTemplateVersion(
  templateId: string,
  versionId: string,
  body: { reason: string; discardCurrentDraft: boolean },
  expected: DraftRestoreExpectation,
): Promise<boolean> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/versions/${id(versionId)}/restore` as CorePath;
  const response = await corePostResponse(path, body, {
    headers: { "If-Match": expected.etag },
    assertCurrent: expected.assertCurrent,
    requireExactResponseTarget: true,
    redirect: "error",
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  try {
    const { payload, wireDraft } = readRestoredDraftReceipt(response, templateId, expected);
    const validation = record(wireDraft.validation);
    if (wireDraft.restoreSourceVersionId !== versionId ||
        validation?.state !== "STALE" || validation.lastValidationRunId !== null ||
        validation.validatedDraftRevision !== null ||
        (payload.migrationRecovery !== null && !record(payload.migrationRecovery))) invalidCoreResponse();
    if (wireDraft.contentChecksum !== await canonicalDocumentChecksum(wireDraft.editorDocument)) invalidCoreResponse();
  } catch {
    throw new InvalidVersionRestoreReply(restoreReplyCorrelation(response));
  }
  expected.assertCurrent();
  return isIdempotentReplay(response.headers);
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
 * the body, the draft revision in both `If-Match` and the body, and a passed
 * validation run for that exact draft revision.
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
  verification?: {
    scope: TemplateVersionReadScope;
    dataSourceKey: string;
    currentVersionId: string | null;
    assertCurrent: () => void;
  },
): Promise<void> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/publish` as CorePath;
  if (!verification) {
    await corePost(path, body, {
      headers: { "If-Match": ifMatch },
      maxResponseBytes: ROW_LIMIT_BYTES,
    });
    return;
  }

  const response = await corePostResponse(path, body, {
    headers: { ...verification.scope.headers, "If-Match": ifMatch },
    requireExactResponseTarget: true,
    redirect: "error",
    assertCurrent: verification.assertCurrent,
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  verification.assertCurrent();
  const receipt = record(readTemplateResponse(response, [201]));
  const definitionRevision = body.definitionRevision + 1;
  const definitionEtag = `"${definitionRevision}"`;
  const responseEtag = response.headers.get("etag");
  if (!receipt || receipt.definitionRevision !== definitionRevision || receipt.definitionEtag !== definitionEtag ||
    (responseEtag !== null && responseEtag !== definitionEtag) ||
    receipt.consumedDraftRevision !== body.draftRevision || receipt.draftEtag !== `"${body.draftRevision + 1}"`) {
    invalidCoreResponse();
  }
  const wire = record(receipt.version);
  if (!wire || parseTemplateSourceTuple(wire).outputChannel !== "PRINT") invalidCoreResponse();
  const version = parseTemplateVersion(wire);
  if (wire?.templateDefinitionId !== templateId ||
    response.headers.get("location") !== `/api/tenant/core/v1/templates/${id(templateId)}/versions/${version.id}` ||
    version.id === verification.currentVersionId ||
    version.lifecycleStatus !== "PUBLISHED" || version.validationRunId !== body.validationRunId ||
    version.dataSourceKey !== verification.dataSourceKey || version.locale !== verification.scope.locale) {
    invalidCoreResponse();
  }
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
  expected: DraftRestoreExpectation,
): Promise<void> {
  const path =
    `/api/tenant/core/v1/templates/${id(templateId)}/draft/recovery-snapshots/${id(snapshotId)}/restore` as CorePath;
  const response = await corePostResponse(path, body, {
    headers: { "If-Match": expected.etag },
    assertCurrent: expected.assertCurrent,
    requireExactResponseTarget: true,
    redirect: "error",
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  try {
    const { payload, revision } = readRestoredDraftReceipt(response, templateId, expected);
    const recoveredFrom = record(payload.recoveredFrom);
    const snapshot = parseRecoverySnapshot(recoveredFrom);
    if (snapshot.id !== snapshotId || snapshot.snapshotChecksum !== body.expectedSnapshotChecksum ||
        snapshot.integrityStatus !== "AVAILABLE" || !snapshot.restoredAt ||
        recoveredFrom?.restoredToDraftRevision !== revision || payload.migrationRecovery !== null ||
        (payload.replacedDraftRecovery !== null && !record(payload.replacedDraftRecovery))) invalidCoreResponse();
  } catch {
    throw new InvalidRecoveryRestoreReply(restoreReplyCorrelation(response));
  }
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
  signal?: AbortSignal,
): Promise<TemplateHtmlPreview> {
  const path = `/api/tenant/core/v1/templates/${id(templateId)}/preview/html` as CorePath;
  const result = await corePost(path, body, { signal, maxResponseBytes: PREVIEW_LIMIT_BYTES });
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
