// Wire contract for CRM outbound email.
//
// Transcribed from crm-app/src/crm/outbound-emails/outbound-emails.controller.ts,
// dto/outbound-email.dto.ts and outbound-emails.service.ts's listProjection /
// detailProjection. There is no docs/api/*.md semantic page for this family —
// docs/api/README.md#coverage lists outbound email as route-level-only — so
// the controller and the DTOs are the contract.
//
// **Sending is asynchronous.** POST answers 202 Accepted with `status:
// "QUEUED"` and a `Location` header; the actual send is performed by the
// worker pipeline and the row's status is updated afterwards. Nothing in this
// module may describe a 202 as "sent".

export const OUTBOUND_EMAILS_PATH = "/api/tenant/crm/v1/outbound-emails";
export const OUTBOUND_EMAIL_OPTIONS_PATH = `${OUTBOUND_EMAILS_PATH}/options`;
export const OUTBOUND_EMAIL_PREVIEW_PATH = `${OUTBOUND_EMAILS_PATH}/preview`;

/** `RetryCrmOutboundEmailDto`: @IsNotEmpty @MaxLength(500). */
export const RETRY_REASON_MAX_LENGTH = 500;
/** `ListCrmOutboundEmailsQueryDto`: @Min(1) @Max(100), default 25. */
const OUTBOUND_EMAIL_PAGE_SIZE = 25;
/** @MaxLength(512) on the cursor. It is opaque and echoed back verbatim. */
const CURSOR_MAX_LENGTH = 512;

// `CrmOutboundEmailSourceTypeDto` — narrower than the activity source list:
// there is no PARTY here.
export const OUTBOUND_EMAIL_SOURCE_TYPES = [
  "LEAD",
  "CUSTOMER_PROFILE",
  "OPPORTUNITY",
] as const;
export type OutboundEmailSourceType =
  (typeof OUTBOUND_EMAIL_SOURCE_TYPES)[number];

/**
 * `CrmOutboundEmailStatusDto`.
 *
 * QUEUED and DISPATCHING are both "not delivered yet". This enum has no
 * `StatusKind` in the design system's tone map, so these render through
 * `Badge` with a dictionary label rather than `StatusBadge`.
 */
export const OUTBOUND_EMAIL_STATUSES = [
  "QUEUED",
  "DISPATCHING",
  "SENT",
  "FAILED",
] as const;
export type OutboundEmailStatus = (typeof OUTBOUND_EMAIL_STATUSES)[number];

/** Statuses whose next transition still depends on the worker pipeline. */
export function isPendingDelivery(status: OutboundEmailStatus): boolean {
  return status === "QUEUED" || status === "DISPATCHING";
}

export interface OutboundEmailRecipientReference {
  kind: "PARTY_CONTACT" | "SOURCE_PRIMARY_CONTACT";
  partyId?: string;
  contactId?: string;
}

interface OutboundEmailRecipientOption {
  reference: OutboundEmailRecipientReference;
  displayName: string;
  /** Already masked by the server. Never unmask, never reconstruct. */
  maskedAddress: string;
  isPrimary: boolean;
}

interface OutboundEmailTemplateOption {
  templateId: string;
  templateVersionId: string;
  code: string;
  name: string;
  versionNumber: number;
  locale: string;
  direction: "LTR" | "RTL";
  selection: "EFFECTIVE_ASSIGNMENT" | "ELIGIBLE_EXPLICIT";
}

type OutboundEmailAvailability =
  | "NO_APPROVED_RECIPIENT"
  | "NO_COMPATIBLE_TEMPLATE";

export interface OutboundEmailOptions {
  sourceType: OutboundEmailSourceType;
  sourceId: string;
  resolvedLocale: string;
  recipients: OutboundEmailRecipientOption[];
  templates: OutboundEmailTemplateOption[];
  assignedTemplateVersionId: string | null;
  availability: OutboundEmailAvailability[];
}

export interface OutboundEmailPreview {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  bodyText: string;
  direction: "LTR" | "RTL";
  resolvedLocale: string;
  templateVersionNumber: number;
}

export interface OutboundEmailListItem {
  outboundEmailId: string;
  sourceType: OutboundEmailSourceType;
  sourceId: string;
  subjectPreview: string | null;
  status: OutboundEmailStatus;
  recipient: { displayName: string; maskedAddress: string };
  requestedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  requestedBy: { id: string; displayName: string };
  retryOfId: string | null;
}

export interface OutboundEmailListPage {
  items: OutboundEmailListItem[];
  /** Opaque and filter-bound. Sent back exactly as received, never parsed. */
  nextCursor: string | null;
  hasNext: boolean;
}

interface OutboundEmailTimelineEntry {
  state: string;
  occurredAt: string;
}

interface OutboundEmailFeedbackEntry {
  type: "BOUNCE" | "COMPLAINT";
  occurredAt: string;
  reasonCode: string;
}

export interface OutboundEmailDetail {
  outboundEmailId: string;
  activityId: string;
  sourceType: OutboundEmailSourceType;
  sourceId: string;
  status: OutboundEmailStatus;
  recipient: { displayName: string; maskedAddress: string };
  sender: { displayName: string; maskedAddress: string };
  /** `REDACTED_BY_RETENTION` once the retention job has run — not an error. */
  content:
    | { state: "AVAILABLE"; subject: string; preheader: string | null; text: string }
    | { state: "REDACTED_BY_RETENTION"; redactedAt: string };
  failure: { code: string; failedAt: string } | null;
  feedback: OutboundEmailFeedbackEntry[];
  timeline: OutboundEmailTimelineEntry[];
  requestedAt: string;
  sentAt: string | null;
  failedAt: string | null;
  retryOfId: string | null;
  retriedById: string | null;
}

export interface OutboundEmailAccepted {
  outboundEmailId: string;
  status: "QUEUED";
  requestedAt: string;
  recipient: { displayName: string; maskedAddress: string };
}

export function outboundEmailPath(id: string): string {
  if (!isUuid(id)) invalidResponse();
  return `${OUTBOUND_EMAILS_PATH}/${encodeURIComponent(id)}`;
}

export function outboundEmailRetryPath(id: string): string {
  return `${outboundEmailPath(id)}/retry`;
}

/**
 * `GET /outbound-emails` query.
 *
 * There is **no `branchId`** on `ListCrmOutboundEmailsQueryDto` — this is the
 * one CRM list in this task that is not branch-scoped, verified field by field
 * against the DTO. Paging is by opaque cursor, not by page number.
 */
export function buildOutboundEmailListQuery(
  filters: { status?: OutboundEmailStatus | ""; sourceType?: OutboundEmailSourceType | ""; sourceId?: string },
  cursor: string | null,
): string {
  const params = new URLSearchParams({
    limit: String(OUTBOUND_EMAIL_PAGE_SIZE),
  });
  if (filters.status) params.set("status", filters.status);
  // sourceType and sourceId are independently optional on this DTO, unlike the
  // activities list — but a source filter without its id narrows nothing, so
  // both are sent together or neither.
  if (filters.sourceType && filters.sourceId) {
    params.set("sourceType", filters.sourceType);
    params.set("sourceId", filters.sourceId);
  }
  if (cursor) {
    if (cursor.length > CURSOR_MAX_LENGTH) invalidResponse();
    // Verbatim. The cursor encodes `requestedAt` and an id and must never be
    // decoded, trimmed or re-encoded here.
    params.set("cursor", cursor);
  }
  return params.toString();
}

/** The body shared by options, preview and send. */
export function buildOptionsRequest(
  sourceType: OutboundEmailSourceType,
  sourceId: string,
): Record<string, unknown> {
  if (!isAnyUuid(sourceId)) throw new Error("CRM_EMAIL_SOURCE_INVALID");
  // `locale` is optional and the server falls back to the tenant's configured
  // default. Nothing here guesses one.
  return { sourceType, sourceId };
}

export function buildSendRequest(
  sourceType: OutboundEmailSourceType,
  sourceId: string,
  recipient: OutboundEmailRecipientReference,
  templateVersionId: string | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...buildOptionsRequest(sourceType, sourceId),
    recipient: buildRecipientReference(recipient),
  };
  if (templateVersionId) {
    if (!isAnyUuid(templateVersionId)) throw new Error("CRM_EMAIL_TEMPLATE_INVALID");
    body.templateVersionId = templateVersionId;
  }
  return body;
}

export function buildRetryRequest(reason: string): Record<string, unknown> {
  const trimmed = reason.trim();
  if (trimmed.length === 0 || trimmed.length > RETRY_REASON_MAX_LENGTH) {
    throw new Error("CRM_EMAIL_RETRY_REASON_INVALID");
  }
  return { reason: trimmed };
}

/**
 * `CrmRecipientReferenceDto` is a discriminated union: `partyId` and
 * `contactId` are validated only when `kind` is `PARTY_CONTACT`, and sending
 * them for a `SOURCE_PRIMARY_CONTACT` would be an unknown-key rejection under
 * `forbidNonWhitelisted`.
 */
function buildRecipientReference(
  reference: OutboundEmailRecipientReference,
): Record<string, unknown> {
  if (reference.kind === "SOURCE_PRIMARY_CONTACT") {
    return { kind: "SOURCE_PRIMARY_CONTACT" };
  }
  if (!isAnyUuid(reference.partyId) || !isAnyUuid(reference.contactId)) {
    throw new Error("CRM_EMAIL_RECIPIENT_INVALID");
  }
  return {
    kind: "PARTY_CONTACT",
    partyId: reference.partyId,
    contactId: reference.contactId,
  };
}

export function parseOptionsResponse(payload: unknown): OutboundEmailOptions {
  const source = requireRecord(payload);
  if (
    !isMember(OUTBOUND_EMAIL_SOURCE_TYPES, source.sourceType) ||
    typeof source.sourceId !== "string" ||
    typeof source.resolvedLocale !== "string" ||
    !Array.isArray(source.recipients) ||
    !Array.isArray(source.templates) ||
    !Array.isArray(source.availability)
  ) {
    invalidResponse();
  }
  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    resolvedLocale: source.resolvedLocale,
    recipients: source.recipients.map(parseRecipientOption),
    templates: source.templates.map(parseTemplateOption),
    assignedTemplateVersionId:
      typeof source.assignedTemplateVersionId === "string"
        ? source.assignedTemplateVersionId
        : null,
    availability: source.availability.filter(
      (entry): entry is OutboundEmailAvailability =>
        entry === "NO_APPROVED_RECIPIENT" || entry === "NO_COMPATIBLE_TEMPLATE",
    ),
  };
}

export function parsePreviewResponse(payload: unknown): OutboundEmailPreview {
  const source = requireRecord(payload);
  if (
    typeof source.subject !== "string" ||
    typeof source.bodyHtml !== "string" ||
    typeof source.bodyText !== "string" ||
    (source.direction !== "LTR" && source.direction !== "RTL") ||
    typeof source.resolvedLocale !== "string"
  ) {
    invalidResponse();
  }
  return {
    subject: source.subject,
    preheader: typeof source.preheader === "string" ? source.preheader : null,
    bodyHtml: source.bodyHtml,
    bodyText: source.bodyText,
    direction: source.direction,
    resolvedLocale: source.resolvedLocale,
    templateVersionNumber: Number(source.templateVersionNumber ?? 0),
  };
}

export function parseAcceptedResponse(payload: unknown): OutboundEmailAccepted {
  const source = requireRecord(payload);
  if (
    typeof source.outboundEmailId !== "string" ||
    source.status !== "QUEUED" ||
    !isTimestamp(source.requestedAt)
  ) {
    invalidResponse();
  }
  return {
    outboundEmailId: source.outboundEmailId,
    status: "QUEUED",
    requestedAt: source.requestedAt as string,
    recipient: parseParty(source.recipient),
  };
}

export function parseListResponse(payload: unknown): OutboundEmailListPage {
  const source = requireRecord(payload);
  if (!Array.isArray(source.items) || typeof source.hasNext !== "boolean") {
    invalidResponse();
  }
  const nextCursor = source.nextCursor;
  if (
    nextCursor !== null &&
    nextCursor !== undefined &&
    (typeof nextCursor !== "string" || nextCursor.length > CURSOR_MAX_LENGTH)
  ) {
    invalidResponse();
  }
  return {
    items: source.items.map(parseListItem),
    nextCursor: (nextCursor as string | null | undefined) ?? null,
    hasNext: source.hasNext,
  };
}

export function parseDetailResponse(payload: unknown): OutboundEmailDetail {
  const source = requireRecord(payload);
  if (
    typeof source.outboundEmailId !== "string" ||
    typeof source.activityId !== "string" ||
    !isMember(OUTBOUND_EMAIL_SOURCE_TYPES, source.sourceType) ||
    typeof source.sourceId !== "string" ||
    !isMember(OUTBOUND_EMAIL_STATUSES, source.status) ||
    !isTimestamp(source.requestedAt) ||
    !Array.isArray(source.timeline) ||
    !Array.isArray(source.feedback)
  ) {
    invalidResponse();
  }
  return {
    outboundEmailId: source.outboundEmailId,
    activityId: source.activityId,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    status: source.status,
    recipient: parseParty(source.recipient),
    sender: parseParty(source.sender),
    content: parseContent(source.content),
    failure: parseFailure(source.failure),
    feedback: source.feedback.map(parseFeedback),
    timeline: source.timeline.map(parseTimelineEntry),
    requestedAt: source.requestedAt as string,
    sentAt: isTimestamp(source.sentAt) ? (source.sentAt as string) : null,
    failedAt: isTimestamp(source.failedAt) ? (source.failedAt as string) : null,
    retryOfId: typeof source.retryOfId === "string" ? source.retryOfId : null,
    retriedById:
      typeof source.retriedById === "string" ? source.retriedById : null,
  };
}

function parseListItem(payload: unknown): OutboundEmailListItem {
  const source = requireRecord(payload);
  if (
    typeof source.outboundEmailId !== "string" ||
    !isMember(OUTBOUND_EMAIL_SOURCE_TYPES, source.sourceType) ||
    typeof source.sourceId !== "string" ||
    !isMember(OUTBOUND_EMAIL_STATUSES, source.status) ||
    !isTimestamp(source.requestedAt)
  ) {
    invalidResponse();
  }
  const requestedBy = requireRecord(source.requestedBy);
  return {
    outboundEmailId: source.outboundEmailId,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    subjectPreview:
      typeof source.subjectPreview === "string" ? source.subjectPreview : null,
    status: source.status,
    recipient: parseParty(source.recipient),
    requestedAt: source.requestedAt as string,
    sentAt: isTimestamp(source.sentAt) ? (source.sentAt as string) : null,
    failedAt: isTimestamp(source.failedAt) ? (source.failedAt as string) : null,
    requestedBy: {
      id: String(requestedBy.id ?? ""),
      displayName: String(requestedBy.displayName ?? ""),
    },
    retryOfId: typeof source.retryOfId === "string" ? source.retryOfId : null,
  };
}

function parseRecipientOption(payload: unknown): OutboundEmailRecipientOption {
  const source = requireRecord(payload);
  const reference = requireRecord(source.reference);
  if (
    (reference.kind !== "PARTY_CONTACT" &&
      reference.kind !== "SOURCE_PRIMARY_CONTACT") ||
    typeof source.displayName !== "string" ||
    typeof source.maskedAddress !== "string" ||
    typeof source.isPrimary !== "boolean"
  ) {
    invalidResponse();
  }
  return {
    reference: {
      kind: reference.kind,
      partyId:
        typeof reference.partyId === "string" ? reference.partyId : undefined,
      contactId:
        typeof reference.contactId === "string" ? reference.contactId : undefined,
    },
    displayName: source.displayName,
    maskedAddress: source.maskedAddress,
    isPrimary: source.isPrimary,
  };
}

function parseTemplateOption(payload: unknown): OutboundEmailTemplateOption {
  const source = requireRecord(payload);
  if (
    typeof source.templateId !== "string" ||
    typeof source.templateVersionId !== "string" ||
    typeof source.code !== "string" ||
    typeof source.name !== "string" ||
    typeof source.locale !== "string" ||
    (source.direction !== "LTR" && source.direction !== "RTL") ||
    (source.selection !== "EFFECTIVE_ASSIGNMENT" &&
      source.selection !== "ELIGIBLE_EXPLICIT")
  ) {
    invalidResponse();
  }
  return {
    templateId: source.templateId,
    templateVersionId: source.templateVersionId,
    code: source.code,
    name: source.name,
    versionNumber: Number(source.versionNumber ?? 0),
    locale: source.locale,
    direction: source.direction,
    selection: source.selection,
  };
}

function parseContent(payload: unknown): OutboundEmailDetail["content"] {
  const source = requireRecord(payload);
  if (source.state === "REDACTED_BY_RETENTION") {
    return {
      state: "REDACTED_BY_RETENTION",
      redactedAt: isTimestamp(source.redactedAt)
        ? (source.redactedAt as string)
        : "",
    };
  }
  if (source.state !== "AVAILABLE") invalidResponse();
  return {
    state: "AVAILABLE",
    subject: typeof source.subject === "string" ? source.subject : "",
    preheader: typeof source.preheader === "string" ? source.preheader : null,
    // Only the TEXT body is carried into the UI. The stored `html` is server
    // content that would have to be sanitised before it could be rendered, and
    // the text alternative is already an exact record of what was sent.
    text: typeof source.text === "string" ? source.text : "",
  };
}

function parseFailure(payload: unknown): OutboundEmailDetail["failure"] {
  if (payload === null || payload === undefined) return null;
  const source = requireRecord(payload);
  return {
    code: typeof source.code === "string" ? source.code : "",
    failedAt: isTimestamp(source.failedAt) ? (source.failedAt as string) : "",
  };
}

function parseFeedback(payload: unknown): OutboundEmailFeedbackEntry {
  const source = requireRecord(payload);
  if (source.type !== "BOUNCE" && source.type !== "COMPLAINT") {
    invalidResponse();
  }
  return {
    type: source.type,
    occurredAt: isTimestamp(source.occurredAt)
      ? (source.occurredAt as string)
      : "",
    reasonCode:
      typeof source.reasonCode === "string" ? source.reasonCode : "UNSPECIFIED",
  };
}

function parseTimelineEntry(payload: unknown): OutboundEmailTimelineEntry {
  const source = requireRecord(payload);
  if (typeof source.state !== "string" || !isTimestamp(source.occurredAt)) {
    invalidResponse();
  }
  return { state: source.state, occurredAt: source.occurredAt as string };
}

function parseParty(payload: unknown): {
  displayName: string;
  maskedAddress: string;
} {
  const source = requireRecord(payload);
  return {
    displayName:
      typeof source.displayName === "string" ? source.displayName : "",
    maskedAddress:
      typeof source.maskedAddress === "string" ? source.maskedAddress : "",
  };
}

// Outbound-email ids are `@IsUUID()` with no version — unlike the rest of CRM,
// which pins v7 — so a v4 id is legitimate here.
const ANY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

function isAnyUuid(value: unknown): boolean {
  return typeof value === "string" && ANY_UUID_PATTERN.test(value);
}

function isTimestamp(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidResponse();
  }
  return value as Record<string, unknown>;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM outbound-email response.");
}
