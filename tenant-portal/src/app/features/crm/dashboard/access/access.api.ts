import { addDays } from 'date-fns';
import {
  ApiError,
  FAKE_NOW,
  InfoPage,
  fakeDelay,
  fakeId,
  pageOf,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_ME, fakeLang } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { fieldDetails } from '../shared/api-error-details';
import {
  FAKE_ACTIVE_PEOPLE,
  FAKE_ALL_PEOPLE,
  FAKE_INBOX_REQUESTS,
  FAKE_MINE_REQUESTS,
  FAKE_OWNER_REVIEWS,
  FAKE_RESOURCES,
  type AccessRequestSeed,
  type OwnerReviewSeed,
} from './access.fake';
import type {
  AccessLevel,
  AccessPerson,
  AccessRequest,
  AccessResourceType,
  AccessTabCounts,
  DecideAccessRequestBody,
  ExecuteOwnerTransferBody,
  ExecuteOwnerTransferResult,
  HeldAccessLevel,
  ListAccessRequestsQuery,
  ListOwnerReviewsQuery,
  OwnerReview,
  ProposeOwnerBody,
  RequestableResource,
  SubmitAccessRequestBody,
} from './access.model';

// Contract: crm-app src/crm/dashboards/access (access-requests, owner-reviews). {B} = /api/v1/crm.
// Every list is a cursor page `{ items, pageInfo: { limit, hasMore, nextCursor } }`, default limit 25, max 100.

const DEFAULT_LIMIT = 25;
const PURPOSE_MAX = 250;
const NOTE_MAX = 500;
const REASON_MAX = 500;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toRequest(seed: AccessRequestSeed): AccessRequest {
  return {
    resourceName: null,
    requestedExpiresAt: null,
    decidedByUserId: null,
    decidedAt: null,
    decisionNote: null,
    grantedLevel: null,
    grantedExpiresAt: null,
    shareId: null,
    ...seed,
  };
}

function toReview(seed: OwnerReviewSeed): OwnerReview {
  return { resourceName: null, ...seed };
}

const mineStore: AccessRequest[] = structuredClone(FAKE_MINE_REQUESTS).map(toRequest);
const inboxStore: AccessRequest[] = structuredClone(FAKE_INBOX_REQUESTS).map(toRequest);
const reviewsStore: OwnerReview[] = structuredClone(FAKE_OWNER_REVIEWS).map(toReview);

let requestCounter = 12;

interface IdemRecord<T> {
  fingerprint: string;
  response: T;
}

// crm-app keeps these receipts itself (DB idempotency column / Redis); the gateway only checks the key is a UUIDv7.
const submitIdemCache = new Map<string, IdemRecord<AccessRequest>>();
const transferIdemCache = new Map<string, IdemRecord<ExecuteOwnerTransferResult>>();

const LEVEL_RANK: Record<HeldAccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

function nextRequestNumber(): string {
  const num = requestCounter++;
  return `REQ-${String(num).padStart(4, '0')}`;
}

/**
 * The resource name as the backend joins it (`dashboard.name` / published widget name). The fake keeps a bilingual
 * name per resource and answers in the UI language so the screens read naturally; the field itself is one string.
 */
function nameOf(type: AccessResourceType, id: string): string | null {
  const item = FAKE_RESOURCES.find((entry) => entry.type === type && entry.id === id);
  if (!item) return null;
  return fakeLang() === 'ar' ? item.nameAr : item.nameEn;
}

function viewRequest(row: AccessRequest): AccessRequest {
  return structuredClone({ ...row, resourceName: nameOf(row.resourceType, row.resourceId) });
}

function viewReview(row: OwnerReview): OwnerReview {
  return structuredClone({ ...row, resourceName: nameOf(row.resourceType, row.resourceId) });
}

/** Gateway check on WRITE_SENSITIVE routes: the key must be present and a UUIDv7. */
function gatewayIdempotencyKey(key: string): string {
  const value = key.trim();
  if (!value) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7.test(value)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  return value.toLowerCase();
}

function currentHeldLevel(resourceType: AccessResourceType, resourceId: string): HeldAccessLevel {
  const resource = FAKE_RESOURCES.find((item) => item.type === resourceType && item.id === resourceId);
  let level: HeldAccessLevel = resource?.heldLevel ?? 'NONE';
  for (const req of mineStore) {
    if (req.resourceType !== resourceType || req.resourceId !== resourceId || req.status !== 'APPROVED') {
      continue;
    }
    const granted = req.grantedLevel ?? req.requestedLevel;
    if (LEVEL_RANK[granted] > LEVEL_RANK[level]) {
      level = granted;
    }
  }
  return level;
}

/** `@IsDateString({ strict: true })`: an ISO 8601 date or date-time. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value.trim())
    && Number.isFinite(Date.parse(value));
}

function isFuture(value: string): boolean {
  return Date.parse(value) > Date.parse(FAKE_NOW);
}

/** RequirePermissions guard: 403 CRM_PERMISSION_DENIED before the handler runs. */
function requirePermission(key: string): void {
  if (!can(key)) throw new ApiError(403, 'CRM_PERMISSION_DENIED');
}

// POST {B}/dashboards/access-requests (header x-idempotency-key). 201, or 200 + Idempotency-Replayed on a replay.
export async function submitAccessRequest(
  body: SubmitAccessRequestBody,
  key: string,
): Promise<AccessRequest> {
  await fakeDelay();
  const idemKey = gatewayIdempotencyKey(key);

  // DTO (ValidationPipe): 400 CRM_VALIDATION_FAILED, details { field: [reason] }.
  if (body.resourceType !== 'DASHBOARD' && body.resourceType !== 'WIDGET') {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('resourceType', 'is_in'));
  }
  if (!UUID_V7.test(body.resourceId ?? '')) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('resourceId', 'is_uuid'));
  }
  if (!['VIEW', 'EDIT', 'MANAGE'].includes(body.requestedLevel as string)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('requestedLevel', 'is_in'));
  }
  const purpose = (body.purpose ?? '').trim();
  if (purpose.length < 1) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('purpose', 'min_length'));
  }
  if (purpose.length > PURPOSE_MAX) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('purpose', 'max_length'));
  }
  if (body.requestedExpiresAt && !isIsoDate(body.requestedExpiresAt)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('requestedExpiresAt', 'is_date_string'));
  }

  // Service order: MANAGE, idempotency replay, expiry, target, held level.
  if ((body.requestedLevel as string) === 'MANAGE') {
    throw new ApiError(409, 'CRM_SHARE_MANAGE_NOT_ENABLED');
  }
  const fingerprint = JSON.stringify({
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    requestedLevel: body.requestedLevel,
    purpose,
    requestedExpiresAt: body.requestedExpiresAt ? new Date(body.requestedExpiresAt).toISOString() : null,
  });
  const existingIdem = submitIdemCache.get(idemKey);
  if (existingIdem) {
    if (existingIdem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
    }
    return structuredClone(existingIdem.response);
  }

  if (body.requestedExpiresAt && !isFuture(body.requestedExpiresAt)) {
    throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
  }
  const resource = FAKE_RESOURCES.find(
    (item) => item.type === body.resourceType && item.id === body.resourceId,
  );
  // A missing or deleted target answers the request's own 404.
  if (!resource) {
    throw new ApiError(404, 'CRM_ACCESS_REQUEST_NOT_FOUND');
  }

  const held = currentHeldLevel(body.resourceType, body.resourceId);
  if (LEVEL_RANK[held] >= LEVEL_RANK[body.requestedLevel]) {
    throw new ApiError(422, 'CRM_ACCESS_REQUEST_ALREADY_GRANTED');
  }

  // The partial unique index (one PENDING request per requester and target) maps to this 409.
  const pendingExists = mineStore.some(
    (req) =>
      req.resourceType === body.resourceType &&
      req.resourceId === body.resourceId &&
      req.status === 'PENDING',
  );
  if (pendingExists) {
    throw new ApiError(409, 'CRM_ACCESS_REQUEST_PENDING_EXISTS');
  }

  const created: AccessRequest = {
    id: fakeId(),
    requestNumber: nextRequestNumber(),
    requesterUserId: FAKE_ME.id,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    resourceName: null,
    requestedLevel: body.requestedLevel,
    heldLevelAtRequest: held,
    purpose,
    requestedExpiresAt: body.requestedExpiresAt ? new Date(body.requestedExpiresAt).toISOString() : null,
    status: 'PENDING',
    pendingUntil: addDays(new Date(FAKE_NOW), 14).toISOString(),
    decidedByUserId: null,
    decidedAt: null,
    decisionNote: null,
    grantedLevel: null,
    grantedExpiresAt: null,
    shareId: null,
    revision: 1,
    createdAt: FAKE_NOW,
  };
  mineStore.unshift(created);
  const view = viewRequest(created);
  submitIdemCache.set(idemKey, { fingerprint, response: structuredClone(view) });
  return view;
}

const ACCESS_REQUEST_STATUS_FILTERS: readonly string[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ALL'];

// GET {B}/dashboards/access-requests?box=mine|inbox&status=&cursor=&limit=
// `crm.dashboards.read` only: an inbox with nothing to decide is an empty page, never a 403.
export async function listAccessRequests(
  box: 'mine' | 'inbox',
  q: ListAccessRequestsQuery = {},
): Promise<InfoPage<AccessRequest>> {
  await fakeDelay();
  // `status` is one stored status or `ALL`, uppercase only (`all` is 400 like any unknown value).
  if (q.status != null && !ACCESS_REQUEST_STATUS_FILTERS.includes(q.status)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('status', 'is_in'));
  }
  const source = box === 'mine' ? mineStore : can('crm.dashboards.share') ? inboxStore : [];
  // `status=ALL` (lead decision 2026-11-22) returns every status in both boxes; no status keeps the inbox on PENDING.
  const status = q.status === 'ALL' ? null : (q.status ?? (box === 'inbox' ? 'PENDING' : null));
  const filtered = status ? source.filter((item) => item.status === status) : source;
  const page = pageOf(filtered, q.cursor ?? null, q.limit ?? DEFAULT_LIMIT);
  return { items: page.items.map(viewRequest), pageInfo: page.pageInfo };
}

// GET {B}/dashboards/access-requests/:id: the requester's own request or one the caller may decide; else 404.
export async function getAccessRequest(id: string): Promise<AccessRequest> {
  await fakeDelay();
  const found =
    mineStore.find((item) => item.id === id) ??
    (can('crm.dashboards.share') ? inboxStore.find((item) => item.id === id) : undefined);
  if (!found) {
    throw new ApiError(404, 'CRM_ACCESS_REQUEST_NOT_FOUND');
  }
  return viewRequest(found);
}

// POST {B}/dashboards/access-requests/:id/cancel  body { revision } (or If-Match). 200.
export async function cancelAccessRequest(id: string, revision: number): Promise<AccessRequest> {
  await fakeDelay();
  const req = mineStore.find((item) => item.id === id);
  if (!req) {
    throw new ApiError(404, 'CRM_ACCESS_REQUEST_NOT_FOUND');
  }
  if (req.revision !== revision || req.status !== 'PENDING') {
    throw new ApiError(409, req.status === 'EXPIRED' ? 'CRM_ACCESS_REQUEST_EXPIRED' : 'CRM_ACCESS_REQUEST_REVISION_STALE');
  }
  req.status = 'CANCELLED';
  req.decidedAt = FAKE_NOW;
  req.revision += 1;
  return viewRequest(req);
}

// POST {B}/dashboards/access-requests/:id/decision  body { revision, decision, grantedLevel?, grantedExpiresAt?, note? }. 200.
export async function decideAccessRequest(
  id: string,
  body: DecideAccessRequestBody,
): Promise<AccessRequest> {
  await fakeDelay();
  requirePermission('crm.dashboards.share');

  const rawNote = body.note ?? '';
  if (rawNote.trim().length > NOTE_MAX) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('note', 'max_length'));
  }
  if (body.grantedExpiresAt && !isIsoDate(body.grantedExpiresAt)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('grantedExpiresAt', 'is_date_string'));
  }

  // Not found and "may not decide" answer the same 404 (no oracle).
  const req = inboxStore.find((item) => item.id === id);
  if (!req) {
    throw new ApiError(404, 'CRM_ACCESS_REQUEST_NOT_FOUND');
  }
  const pastDeadline = new Date(req.pendingUntil).getTime() <= new Date(FAKE_NOW).getTime();
  if (req.status !== 'PENDING') {
    throw new ApiError(409, req.status === 'EXPIRED' ? 'CRM_ACCESS_REQUEST_EXPIRED' : 'CRM_ACCESS_REQUEST_REVISION_STALE');
  }
  if (pastDeadline) {
    throw new ApiError(409, 'CRM_ACCESS_REQUEST_EXPIRED');
  }
  if (req.revision !== body.revision) {
    throw new ApiError(409, 'CRM_ACCESS_REQUEST_REVISION_STALE');
  }

  const note = rawNote.trim();
  if (body.decision === 'REJECTED') {
    if (!note) {
      throw new ApiError(422, 'CRM_ACCESS_REQUEST_NOTE_REQUIRED');
    }
    req.status = 'REJECTED';
    req.decidedByUserId = FAKE_ME.id;
    req.decidedAt = FAKE_NOW;
    req.decisionNote = note;
    req.grantedLevel = null;
    req.grantedExpiresAt = null;
    req.shareId = null;
    req.revision += 1;
    return viewRequest(req);
  }

  const grantedLevel: AccessLevel = body.grantedLevel ?? req.requestedLevel;
  if (LEVEL_RANK[grantedLevel] > LEVEL_RANK[req.requestedLevel]) {
    throw new ApiError(422, 'CRM_ACCESS_REQUEST_GRANT_EXCEEDS_REQUEST');
  }
  // Defaults to the requested expiry; must be in the future.
  const grantedExpiresAt = body.grantedExpiresAt
    ? new Date(body.grantedExpiresAt).toISOString()
    : req.requestedExpiresAt;
  if (grantedExpiresAt && !isFuture(grantedExpiresAt)) {
    throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
  }

  req.status = 'APPROVED';
  req.decidedByUserId = FAKE_ME.id;
  req.decidedAt = FAKE_NOW;
  req.decisionNote = note || null;
  req.grantedLevel = grantedLevel;
  req.grantedExpiresAt = grantedExpiresAt ?? null;
  req.shareId = fakeId();
  req.revision += 1;
  return viewRequest(req);
}

// GET {B}/dashboards/owner-reviews?status=&cursor=&limit=  (`crm.widgets.transfer_ownership`).
// The backend has no `ALL` here: the UI's 'ALL' choice is sent as no status.
export async function listOwnerReviews(q: ListOwnerReviewsQuery = {}): Promise<InfoPage<OwnerReview>> {
  await fakeDelay();
  requirePermission('crm.widgets.transfer_ownership');
  const status = q.status && q.status !== 'ALL' ? q.status : null;
  const filtered = status ? reviewsStore.filter((item) => item.status === status) : reviewsStore;
  const page = pageOf(filtered, q.cursor ?? null, q.limit ?? DEFAULT_LIMIT);
  return { items: page.items.map(viewReview), pageInfo: page.pageInfo };
}

// GET {B}/dashboards/owner-reviews/:id  (`crm.widgets.transfer_ownership`). One list item; 403 without the
// permission (checked before the lookup), 404 CRM_OWNER_REVIEW_NOT_FOUND for an unknown id.
export async function getOwnerReview(id: string): Promise<OwnerReview> {
  await fakeDelay();
  requirePermission('crm.widgets.transfer_ownership');
  const review = reviewsStore.find((item) => item.id === id);
  if (!review) {
    throw new ApiError(404, 'CRM_OWNER_REVIEW_NOT_FOUND');
  }
  return viewReview(review);
}

function openReview(id: string, revision: number): OwnerReview {
  const review = reviewsStore.find((item) => item.id === id);
  if (!review) {
    throw new ApiError(404, 'CRM_OWNER_REVIEW_NOT_FOUND');
  }
  if (review.status !== 'OPEN') {
    throw new ApiError(409, 'CRM_OWNER_REVIEW_NOT_OPEN');
  }
  if (review.revision !== revision) {
    throw new ApiError(409, 'CRM_OWNER_REVIEW_REVISION_STALE');
  }
  return review;
}

// POST {B}/dashboards/owner-reviews/:id/proposal  body { revision, proposedOwnerUserId?, reason? }. 200.
export async function proposeOwner(id: string, body: ProposeOwnerBody): Promise<OwnerReview> {
  await fakeDelay();
  requirePermission('crm.widgets.transfer_ownership');

  const proposedOwnerId = typeof body.proposedOwnerUserId === 'string' ? body.proposedOwnerUserId.trim() : '';
  if (proposedOwnerId && !UUID_V7.test(proposedOwnerId)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('proposedOwnerUserId', 'is_uuid'));
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > REASON_MAX) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('reason', 'max_length'));
  }
  // A proposal needs a reason (checked before the review is read).
  if (proposedOwnerId && !reason) {
    throw new ApiError(422, 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID');
  }

  const review = openReview(id, body.revision);
  if (proposedOwnerId) {
    const person = FAKE_ALL_PEOPLE.find((item) => item.id === proposedOwnerId);
    if (!person || !person.active || proposedOwnerId === review.ownerUserId) {
      throw new ApiError(422, 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID');
    }
  }

  // No owner: the proposal is withdrawn (all four columns NULL).
  review.proposedOwnerUserId = proposedOwnerId || null;
  review.proposalReason = proposedOwnerId ? reason : null;
  review.proposedByUserId = proposedOwnerId ? FAKE_ME.id : null;
  review.proposedAt = proposedOwnerId ? FAKE_NOW : null;
  review.revision += 1;
  return viewReview(review);
}

// POST {B}/dashboards/owner-reviews/:id/cancel  body { revision }. 200.
export async function cancelOwnerReview(id: string, revision: number): Promise<OwnerReview> {
  await fakeDelay();
  requirePermission('crm.widgets.transfer_ownership');
  const review = openReview(id, revision);
  review.status = 'CANCELLED';
  review.resolvedAt = FAKE_NOW;
  review.resolvedByUserId = FAKE_ME.id;
  review.revision += 1;
  return viewReview(review);
}

/**
 * The fake resource heads the owner reviews point at (dashboards: `revision`; widgets: `revision` and
 * `governanceRevision`). Seeded per id so a transfer returns the real next revision, never a constant.
 */
const resourceHeads = new Map<string, { revision: number; governanceRevision: number }>();

function resourceHead(resourceId: string): { revision: number; governanceRevision: number } {
  let head = resourceHeads.get(resourceId);
  if (!head) {
    const seed = parseInt(resourceId.slice(-3), 16) || 1;
    head = { revision: 3 + (seed % 7), governanceRevision: 1 + (seed % 3) };
    resourceHeads.set(resourceId, head);
  }
  return head;
}

function bumpResourceHead(
  resourceId: string,
  type: OwnerReview['resourceType'],
): { revision: number; governanceRevision: number } {
  const head = resourceHead(resourceId);
  head.revision += 1;
  if (type === 'WIDGET') head.governanceRevision += 1;
  return { ...head };
}

// POST {B}/dashboards/owner-reviews/:id/transfer  body { revision, reason } (header x-idempotency-key). 200.
export async function executeOwnerTransfer(
  id: string,
  body: ExecuteOwnerTransferBody,
  key: string,
): Promise<ExecuteOwnerTransferResult> {
  await fakeDelay();
  requirePermission('crm.widgets.transfer_ownership');
  const idemKey = gatewayIdempotencyKey(key);

  const reason = (body.reason ?? '').trim();
  if (!reason) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('reason', 'matches'));
  }
  if (reason.length > REASON_MAX) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', fieldDetails('reason', 'max_length'));
  }

  const fingerprint = JSON.stringify({ id, revision: body.revision, reason });
  const existingIdem = transferIdemCache.get(idemKey);
  if (existingIdem) {
    if (existingIdem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'CRM_IDEMPOTENCY_KEY_REUSED');
    }
    return structuredClone(existingIdem.response);
  }

  const review = reviewsStore.find((item) => item.id === id);
  if (!review) {
    throw new ApiError(404, 'CRM_OWNER_REVIEW_NOT_FOUND');
  }
  if (review.status !== 'OPEN') {
    throw new ApiError(409, 'CRM_OWNER_REVIEW_NOT_OPEN');
  }
  if (review.revision !== body.revision) {
    throw new ApiError(409, 'CRM_OWNER_REVIEW_REVISION_STALE');
  }
  if (!review.proposedOwnerUserId) {
    throw new ApiError(422, 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID');
  }
  const proposedPerson = FAKE_ALL_PEOPLE.find((item) => item.id === review.proposedOwnerUserId);
  if (!proposedPerson || !proposedPerson.active) {
    throw new ApiError(
      422,
      review.resourceType === 'WIDGET' ? 'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE' : 'CRM_OWNERSHIP_TARGET_INACTIVE',
    );
  }

  const previousOwnerUserId = review.ownerUserId;
  const next = bumpResourceHead(review.resourceId, review.resourceType);
  review.status = 'TRANSFERRED';
  review.resolvedAt = FAKE_NOW;
  review.resolvedByUserId = FAKE_ME.id;
  review.revision += 1;

  const view = viewReview(review);
  const response: ExecuteOwnerTransferResult = {
    review: view,
    transfer: {
      resourceType: review.resourceType,
      id: review.resourceId,
      name: view.resourceName,
      ownerUserId: review.proposedOwnerUserId,
      previousOwnerUserId,
      // The resource head after the change: a dashboard bumps `revision`; a widget bumps `revision` and
      // `governance_revision` (dashboard-ownership-transfer.service.ts).
      revision: next.revision,
      ...(review.resourceType === 'WIDGET' ? { governanceRevision: next.governanceRevision } : {}),
      revokedShareCount: 0,
      retainedShareCount: 0,
      ownerReviewId: review.id,
    },
  };
  transferIdemCache.set(idemKey, { fingerprint, response: structuredClone(response) });
  return response;
}

/** Display name of a row's resource: the DTO `resourceName`, else the id. */
export function resourceLabel(row: { resourceName: string | null; resourceId: string }): string {
  return row.resourceName?.trim() || row.resourceId;
}

export function personName(userId: string | null | undefined, lang: 'ar' | 'en'): string {
  if (!userId) return '—';
  const person = FAKE_ALL_PEOPLE.find((item) => item.id === userId);
  if (!person) return userId;
  return lang === 'ar' ? person.nameAr : person.name;
}

export function isPersonInactive(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const person = FAKE_ALL_PEOPLE.find((item) => item.id === userId);
  return Boolean(person && !person.active);
}

// TODO(Phase 5): no backend lookup lists "resources I may request"; the picker needs one (fake-only helper).
export async function listRequestableResources(
  type: AccessResourceType,
): Promise<RequestableResource[]> {
  await fakeDelay(100);
  const items = FAKE_RESOURCES.filter((item) => {
    if (item.type !== type) return false;
    const held = currentHeldLevel(item.type, item.id);
    return held === 'NONE' || held === 'VIEW';
  })
    .map((item) => ({
      ...item,
      heldLevel: currentHeldLevel(item.type, item.id),
    }))
    .sort((a, b) => LEVEL_RANK[a.heldLevel] - LEVEL_RANK[b.heldLevel]);
  return structuredClone(items);
}

// TODO(Phase 5): eligible owners come from an ownership-transfer targets lookup (fake-only helper).
export async function listActiveOwners(): Promise<AccessPerson[]> {
  await fakeDelay(100);
  return structuredClone(FAKE_ACTIVE_PEOPLE);
}

/**
 * Tab badge counts. Fake-only: there is no real endpoint for it yet.
 */
// TODO(Phase 5): no real endpoint yet
export async function getAccessTabCounts(): Promise<AccessTabCounts> {
  await fakeDelay(60);
  return {
    mine: mineStore.length,
    inbox: can('crm.dashboards.share')
      ? inboxStore.filter((item) => item.status === 'PENDING').length
      : 0,
    reviews: can('crm.widgets.transfer_ownership')
      ? reviewsStore.filter((item) => item.status === 'OPEN').length
      : 0,
  };
}
