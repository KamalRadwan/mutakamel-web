import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record, timestamp } from "../../dashboard-parse";

const STATES = ["HISTORY_UNAVAILABLE", "UNREVIEWED", "REVIEWED", "SOURCE_CHANGED"] as const;
const REASONS = ["VERIFIED_DISTINCT", "VERIFIED_SAME", "CORRECTION"] as const;
const PROFILES = ["INDIVIDUAL", "CORPORATE"] as const;
const MAX_REVISION = 2_147_483_647;
const HISTORY_LIMIT = 25;

export type ReviewMode = "NEW" | "LINK";
export interface InquirySelection {
  id: string;
  branchId: string;
  name: string;
  createdAt?: string;
}

const fail = () => invalidResponse("inquiry review");
const member = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some(item => item === value);
const revision = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_REVISION;
const nullableId = (value: unknown): value is string | null => value === null || isUUIDv7(value);

function parseDecision(value: unknown, leadId: string) {
  const row = record(value);
  if (!row || row.leadId !== leadId || !isUUIDv7(row.id) || !isUUIDv7(row.actorUserId)
    || !isUUIDv7(row.identityId) || !nullableId(row.requestedIdentityId) || !nullableId(row.previousIdentityId)
    || !revision(row.revision) || !revision(row.sourceRevision) || !member(REASONS, row.reason)
    || !timestamp(row.decidedAt)) return fail();
  const expectedReason = row.revision > 1 ? "CORRECTION" : row.requestedIdentityId ? "VERIFIED_SAME" : "VERIFIED_DISTINCT";
  if (row.reason !== expectedReason || (row.revision === 1) !== (row.previousIdentityId === null)
    || (row.requestedIdentityId !== null && row.requestedIdentityId !== row.identityId)) return fail();
  return { id: row.id, actorUserId: row.actorUserId, identityId: row.identityId, requestedIdentityId: row.requestedIdentityId,
    previousIdentityId: row.previousIdentityId, revision: row.revision, sourceRevision: row.sourceRevision, reason: row.reason, decidedAt: row.decidedAt };
}

export function parseInquiryContext(value: unknown, selection: InquirySelection, beforeRevision?: number) {
  const row = record(value);
  if (!row || row.leadId !== selection.id || row.branchId !== selection.branchId || !member(PROFILES, row.profileType)
    || !member(STATES, row.state) || !timestamp(row.coverageStartedAt)
    || (row.leadName !== null && typeof row.leadName !== "string")
    || (row.sourceRevision !== null && !revision(row.sourceRevision))
    || !boundedArray(row.history, HISTORY_LIMIT) || typeof row.hasMore !== "boolean") return fail();
  const current = row.current === null ? null : parseDecision(row.current, selection.id);
  const history = row.history.map(item => parseDecision(item, selection.id));
  const { state, sourceRevision, nextBeforeRevision } = row;
  if (state !== "HISTORY_UNAVAILABLE" && sourceRevision === null) return fail();
  if ((state === "REVIEWED" || state === "SOURCE_CHANGED") !== Boolean(current)) return fail();
  if (current && (sourceRevision === null || current.sourceRevision > sourceRevision
    || (state === "REVIEWED") !== (current.sourceRevision === sourceRevision))) return fail();

  const firstRevision = Math.min(current?.revision ?? 0, (beforeRevision ?? MAX_REVISION + 1) - 1);
  const hasMore = firstRevision > HISTORY_LIMIT;
  if (history.length !== Math.min(firstRevision, HISTORY_LIMIT) || row.hasMore !== hasMore
    || nextBeforeRevision !== (hasMore ? firstRevision - HISTORY_LIMIT + 1 : null)) return fail();
  for (const [index, decision] of history.entries()) {
    if (decision.revision !== firstRevision - index || decision.sourceRevision > (current?.sourceRevision ?? 0)
      || (index === 0 && decision.revision === current?.revision && decision.id !== current.id)) return fail();
  }
  return { name: row.leadName?.trim() || selection.name, profileType: row.profileType, state,
    coverageStartedAt: row.coverageStartedAt, sourceRevision, current, history,
    nextBeforeRevision: typeof nextBeforeRevision === "number" ? nextBeforeRevision : null };
}

export type InquiryContext = ReturnType<typeof parseInquiryContext>;

export function canReview(context: InquiryContext | undefined) {
  return Boolean(context && context.state !== "HISTORY_UNAVAILABLE" && (context.current?.revision ?? 0) < MAX_REVISION);
}

export function referenceIdentity(source: InquiryContext | undefined, reference: InquiryContext | undefined) {
  return source && reference?.state === "REVIEWED" && reference.profileType === source.profileType
    ? reference.current?.identityId : undefined;
}

export function buildInquiryCommand(context: InquiryContext, mode: ReviewMode, targetIdentityId?: string) {
  if (!canReview(context) || context.sourceRevision === null || (mode === "LINK" && !targetIdentityId)) return fail();
  return {
    requestId: generateUUIDv7(), mode,
    ...(mode === "LINK" ? { targetIdentityId } : {}),
    expectedRevision: context.current?.revision ?? 0,
    expectedSourceRevision: context.sourceRevision,
    reason: context.current ? "CORRECTION" : mode === "NEW" ? "VERIFIED_DISTINCT" : "VERIFIED_SAME",
  };
}

export type InquiryCommand = ReturnType<typeof buildInquiryCommand>;

export function validateInquiryReceipt(value: unknown, leadId: string, actorId: string, command: InquiryCommand, previousIdentityId: string | null) {
  const row = record(value);
  if (!row || row.requiresContextReload !== true || typeof row.replayed !== "boolean") return fail();
  const decision = parseDecision(row.decision, leadId);
  if (decision.id !== command.requestId || decision.actorUserId !== actorId
    || decision.revision !== command.expectedRevision + 1 || decision.sourceRevision !== command.expectedSourceRevision
    || decision.reason !== command.reason || decision.previousIdentityId !== previousIdentityId
    || decision.requestedIdentityId !== (command.targetIdentityId ?? null)) return fail();
}

export function inquiryPath(leadId: string, beforeRevision?: number) {
  const path = `/api/tenant/crm/v1/dashboards/inquiry-identities/${leadId}`;
  return beforeRevision ? `${path}?beforeRevision=${beforeRevision}` : path;
}
