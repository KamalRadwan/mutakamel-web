import {
  invalidCoreResponse,
  isMember,
  nullableText,
  record,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";

// Versions, validation runs, publish preconditions, recovery snapshots and the
// three preview shapes.
//
// Source: core-app/src/tenant/template-platform/template-platform.service.ts
// (`versionReadListDto`, `validationRunDto`, `previewJobDto`, `recoveryShape`)
// and template-recovery.service.ts.

const TEMPLATE_VALIDATION_RUN_STATUSES = ["PASSED", "FAILED"] as const;
const TEMPLATE_PREVIEW_JOB_STATUSES = [
  "PENDING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
] as const;
const TEMPLATE_SNAPSHOT_INTEGRITY = ["AVAILABLE", "QUARANTINED"] as const;

type TemplateValidationRunStatus = (typeof TEMPLATE_VALIDATION_RUN_STATUSES)[number];
type TemplatePreviewJobStatus = (typeof TEMPLATE_PREVIEW_JOB_STATUSES)[number];

/**
 * The rejections this surface branches on. Everything else falls through to
 * `t.coreOperations.errors`, which carries the full code table.
 */
export const STALE_REVISION_CODE = "CORE.TEMPLATE.CONCURRENCY.STALE_REVISION";
export const CURSOR_INVALID_CODE = "CORE.TEMPLATE.CURSOR.INVALID";
export const ARTIFACT_EXPIRED_CODE = "CORE.TEMPLATE.PREVIEW.ARTIFACT_EXPIRED";
export const SNAPSHOT_EXPIRED_CODE = "CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_EXPIRED";
export const SNAPSHOT_STALE_CODE = "CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_STALE";
export const SNAPSHOT_ALREADY_RESTORED_CODE =
  "CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_ALREADY_RESTORED";
export const SNAPSHOT_INTEGRITY_CODE = "CORE.TEMPLATE.DRAFT.RECOVERY_SNAPSHOT_INTEGRITY_FAILED";

export const TEMPLATE_CHANGE_NOTE_MAX = 500;

export interface TemplateVersion {
  id: string;
  versionNumber: number;
  lifecycleStatus: string;
  publishedAt: string;
  retiredAt: string | null;
  changeNote: string | null;
  templateContentChecksum: string;
  dataSourceKey: string;
  /** Detail-only fields — the list projection does not carry them. */
  compilerVersion: string | null;
  validationRunId: string | null;
  rendererTargets: string[];
}

interface TemplateValidationIssue {
  severity: string;
  code: string;
  message: string;
  nodeId: string | null;
}

export interface TemplateValidationRun {
  id: string;
  draftId: string;
  /** The run only applies to **this exact** draft revision. */
  draftRevision: number;
  status: TemplateValidationRunStatus;
  rendererTargets: string[];
  issues: TemplateValidationIssue[];
  completedAt: string;
}

export interface TemplateRecoverySnapshot {
  id: string;
  sourceDraftRevision: number;
  /** Checksum-pinned: the restore body must repeat it exactly. */
  snapshotChecksum: string;
  captureReason: string;
  createdAt: string;
  expiresAt: string;
  integrityStatus: string;
  restoredAt: string | null;
  objectDeletedAt: string | null;
}

interface TemplatePreviewPin {
  templateId: string;
  sourceKind: "DRAFT" | "VERSION";
  draftRevision: number | null;
  versionId: string | null;
  templateContentChecksum: string;
}

export interface TemplateHtmlPreview extends TemplatePreviewPin {
  kind: "HTML";
  html: string;
}

export interface TemplateEmailPreview extends TemplatePreviewPin {
  kind: "EMAIL";
  subject: string;
  preheader: string | null;
  html: string;
  text: string;
}

export interface TemplatePreviewJob {
  renderJobId: string;
  status: TemplatePreviewJobStatus;
  attemptCount: number;
  createdAt: string;
  nextRetryAt: string | null;
  failureCode: string | null;
  /** Present only while the artifact is unexpired; it is a fifth, real state. */
  artifact: { downloadUrlExpiresAt: string; sizeBytes: number; pageCount: number } | null;
}

function positiveInteger(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidCoreResponse();
  return value as number;
}

function nullableTimestamp(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  return requiredTimestamp(source, key);
}

export function parseTemplateVersion(payload: unknown): TemplateVersion {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "templateVersionId"),
    versionNumber: positiveInteger(row, "versionNumber"),
    lifecycleStatus: requiredText(row, "lifecycleStatus", 16),
    publishedAt: requiredTimestamp(row, "publishedAt"),
    retiredAt: nullableTimestamp(row, "retiredAt"),
    changeNote: nullableText(row, "changeNote", TEMPLATE_CHANGE_NOTE_MAX),
    templateContentChecksum: requiredText(row, "templateContentChecksum", 128),
    dataSourceKey: requiredText(row, "dataSourceKey", 64),
    compilerVersion: nullableText(row, "compilerVersion", 64),
    validationRunId: typeof row.validationRunId === "string" ? row.validationRunId : null,
    rendererTargets: Array.isArray(row.rendererTargets) ? row.rendererTargets.map(String) : [],
  };
}

export function parseValidationRun(payload: unknown): TemplateValidationRun {
  const row = record(payload);
  if (!row || !isMember(TEMPLATE_VALIDATION_RUN_STATUSES, row.status)) invalidCoreResponse();
  const issues = Array.isArray(row.issues) ? row.issues : [];
  const targets = Array.isArray(row.rendererTargets) ? row.rendererTargets : [];
  return {
    id: requiredUuidV7(row, "validationRunId"),
    draftId: requiredUuidV7(row, "draftId"),
    draftRevision: positiveInteger(row, "draftRevision"),
    status: row.status,
    rendererTargets: targets.map(String),
    issues: issues.map((entry) => {
      const issue = record(entry);
      if (!issue) invalidCoreResponse();
      return {
        severity: requiredText(issue, "severity", 16),
        code: requiredText(issue, "code", 120),
        message: requiredText(issue, "message", 2000),
        nodeId: nullableText(issue, "nodeId", 120),
      };
    }),
    completedAt: requiredTimestamp(row, "completedAt"),
  };
}

export function parseRecoverySnapshot(payload: unknown): TemplateRecoverySnapshot {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    id: requiredUuidV7(row, "snapshotId"),
    sourceDraftRevision: positiveInteger(row, "sourceDraftRevision"),
    snapshotChecksum: requiredText(row, "snapshotChecksum", 64),
    captureReason: requiredText(row, "captureReason", 64),
    createdAt: requiredTimestamp(row, "createdAt"),
    expiresAt: requiredTimestamp(row, "expiresAt"),
    integrityStatus: isMember(TEMPLATE_SNAPSHOT_INTEGRITY, row.integrityStatus)
      ? row.integrityStatus
      : "QUARANTINED",
    restoredAt: nullableTimestamp(row, "restoredAt"),
    objectDeletedAt: nullableTimestamp(row, "objectDeletedAt"),
  };
}

function parsePin(row: Record<string, unknown>): TemplatePreviewPin {
  const source = record(row.source);
  if (!source) invalidCoreResponse();
  const kind = source.kind === "VERSION" ? "VERSION" : "DRAFT";
  return {
    templateId: requiredUuidV7(row, "templateId"),
    sourceKind: kind,
    draftRevision: kind === "DRAFT" ? positiveInteger(source, "draftRevision") : null,
    versionId: kind === "VERSION" ? requiredUuidV7(source, "versionId") : null,
    templateContentChecksum: requiredText(row, "templateContentChecksum", 128),
  };
}

export function parseHtmlPreview(payload: unknown): TemplateHtmlPreview {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return { ...parsePin(row), kind: "HTML", html: requiredText(row, "html", 4_000_000) };
}

export function parseEmailPreview(payload: unknown): TemplateEmailPreview {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    ...parsePin(row),
    kind: "EMAIL",
    subject: requiredText(row, "subject", 2000),
    preheader: nullableText(row, "preheader", 2000),
    html: requiredText(row, "html", 4_000_000),
    text: requiredText(row, "text", 4_000_000),
  };
}

export function parsePreviewJob(payload: unknown): TemplatePreviewJob {
  const row = record(payload);
  if (!row || !isMember(TEMPLATE_PREVIEW_JOB_STATUSES, row.status)) invalidCoreResponse();
  const artifact = record(row.artifact);
  const failure = record(row.failure);
  const attempts = row.attemptCount;
  return {
    renderJobId: requiredUuidV7(row, "renderJobId"),
    status: row.status,
    attemptCount: Number.isSafeInteger(attempts) ? (attempts as number) : 0,
    createdAt: requiredTimestamp(row, "createdAt"),
    nextRetryAt: nullableTimestamp(row, "nextRetryAt"),
    failureCode: failure ? requiredText(failure, "code", 120) : null,
    artifact: artifact
      ? {
          downloadUrlExpiresAt: requiredTimestamp(artifact, "downloadUrlExpiresAt"),
          sizeBytes: Number.isSafeInteger(artifact.sizeBytes) ? (artifact.sizeBytes as number) : 0,
          pageCount: Number.isSafeInteger(artifact.pageCount) ? (artifact.pageCount as number) : 0,
        }
      : null,
  };
}

/** The 202 body: a job id and nothing renderable yet. */
export function parseAcceptedPreviewJob(payload: unknown): string {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return requiredUuidV7(row, "renderJobId");
}
