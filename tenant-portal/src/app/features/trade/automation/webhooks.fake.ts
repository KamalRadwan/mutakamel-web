import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import type { Page } from '../shared/trade-foundation.model';
import {
  type ScopeTarget,
  type WriteOptions,
  computeHash,
  fakeIdem,
  getFakeActor,
  requireIdempotencyKey,
  requireIfMatch,
} from './automation-fake-actors';
import { validateAutomationReason } from './automation-reasons.seed';
import type {
  AttemptOutcome,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  DeliveryFilters,
  DeliveryStatus,
  ListDeliveriesQuery,
  ListSubscriptionsQuery,
  RetryDeliveryAccepted,
  RetryDeliveryInput,
  RevealSecretResult,
  SecretOperationAccepted,
  SecretOperationStatus,
  SecretOperationType,
  SecretStatus,
  SubscriptionStatus,
  SubscriptionVersionStatus,
  TestDeliveryAccepted,
  UpdateSubscriptionInput,
  UpdateSubscriptionResult,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryCounts,
  WebhookDeliveryDetail,
  WebhookEndpoint,
  WebhookEventCatalogue,
  WebhookEventDefinition,
  WebhookScopeTarget,
  WebhookSecret,
  WebhookSubscription,
  WebhookSubscriptionDetail,
  WebhookSubscriptionEntity,
  WebhookVersionSummary,
} from './webhooks.model';
import {
  type RetryPolicyCode,
  RETRY_REASON_CODE_PATTERN,
  SUBSCRIPTION_CODE_PATTERN,
  WEBHOOK_EVENTS,
  WEBHOOK_LIMITS,
  type WebhookRetryClass,
} from './webhooks.registry';

// Fake of trade-app extensions-automation webhooks (controller, DTOs, webhook-subscriptions.service.ts,
// webhook-secret-reveal.service.ts) plus the worker results the backend applies in webhook-results.service.ts.

const idem = fakeIdem();

// ---------------------------------------------------------------------------
// Request context (the backend reads it from the scope headers)
// ---------------------------------------------------------------------------

export interface FakeWebhookContext {
  target: ScopeTarget;
  companyId: string | null;
  branchId: string | null;
}

let context: FakeWebhookContext = { target: 'COMPANY', companyId: 'c1', branchId: null };

/** Test hook: the scope the fake backend answers the next requests in. */
export function setFakeWebhookContext(next: FakeWebhookContext): void {
  context = { ...next };
}

/** How long the fake worker takes to apply a secret operation or a delivery attempt. */
let workerDelayMs = 2000;

/** Test hook. */
export function setFakeWebhookWorkerDelay(ms: number): void {
  workerDelayMs = ms;
}

/** Active branches per company (the backend checks the branches table). */
const ACTIVE_BRANCHES: Readonly<Record<string, readonly string[]>> = {
  c1: ['b1', 'b2', 'b3'],
  c2: ['b4', 'b5'],
};

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVEAL_WINDOW_MS = WEBHOOK_LIMITS.revealWindowMinutes * 60_000;
const SYNTHETIC_EVENT = 'trading.webhook.synthetic_test.v1';
const SEEDED_PENDING_DELAY_MS = 8000;
const RETRYABLE_CLASSES: readonly WebhookRetryClass[] = ['TIMEOUT', 'RATE_LIMIT', 'SERVER_ERROR', 'NETWORK_ERROR'];
const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PENDING',
  'RETRY_PENDING',
  'DELIVERED',
  'FAILED',
  'EXHAUSTED',
  'DISABLED',
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type StoredSubscription = WebhookSubscriptionEntity;

interface StoredVersion {
  id: string;
  subscriptionId: string;
  versionNumber: number;
  scopeTarget: WebhookScopeTarget;
  companyId: string | null;
  endpointUri: string;
  retryPolicyCode: RetryPolicyCode;
  maxAttempts: number;
  status: SubscriptionVersionStatus;
  branchIds: string[];
  events: WebhookEventDefinition[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredSecret extends WebhookSecret {
  subscriptionId: string;
  /** The worker's one-time reveal copy (Redis in the backend); never part of any DTO. */
  revealCopy: string | null;
}

interface StoredOperation {
  id: string;
  subscriptionId: string;
  subscriptionVersionId: string;
  type: SecretOperationType;
  status: SecretOperationStatus;
  safeErrorCode: string | null;
  targetSecretId: string;
  priorSecretId: string | null;
  overlapUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredDelivery {
  id: string;
  subscriptionId: string;
  subscriptionVersionId: string;
  status: DeliveryStatus;
  sourceEventType: string;
  sourceEventId: string;
  companyId: string | null;
  branchId: string | null;
  payloadSchemaCode: string;
  payloadHash: string;
  payloadSizeBytes: number;
  payloadPurged: boolean;
  secretReferenceId: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  terminalAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  attempts: WebhookDeliveryAttempt[];
}

const DB = {
  subscriptions: [] as StoredSubscription[],
  versions: [] as StoredVersion[],
  secrets: [] as StoredSecret[],
  operations: [] as StoredOperation[],
  deliveries: [] as StoredDelivery[],
};

function seedId(group: number, n: number): string {
  return `0193a100-0000-7000-8${String(group).padStart(3, '0')}-${String(n).padStart(12, '0')}`;
}

function base64Secret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function seed(): void {
  const erp = seedId(1, 1);
  const bi = seedId(1, 2);
  const old = seedId(1, 3);
  const erpV3 = seedId(2, 3);
  const biV1 = seedId(2, 4);
  const oldV2 = seedId(2, 5);
  const erpSecret = seedId(3, 1);
  const biSecret = seedId(3, 2);
  const oldSecret = seedId(3, 3);
  const activeFrom = new Date(Date.now() - 2 * 60_000).toISOString();
  const actor = getFakeActor();

  const entity = (
    id: string,
    code: string,
    status: SubscriptionStatus,
    activeVersion: string | null,
    secret: string | null,
    version: number,
    createdAt: string,
    updatedAt: string,
  ): StoredSubscription => ({
    id,
    code,
    status,
    currentActiveVersionId: activeVersion,
    currentSecretReferenceId: secret,
    version,
    createdBy: actor,
    updatedBy: actor,
    createdAt,
    updatedAt,
    deletedAt: null,
  });

  DB.subscriptions.push(
    entity(erp, 'ERP_SYNC', 'ACTIVE', erpV3, erpSecret, 5, '2026-10-01T08:00:00.000Z', '2026-11-21T11:02:00.000Z'),
    entity(bi, 'BI_FEED', 'DRAFT', null, null, 1, '2026-11-21T10:55:00.000Z', '2026-11-21T10:55:00.000Z'),
    entity(old, 'OLD_HOOK', 'DISABLED', null, null, 4, '2026-03-01T08:00:00.000Z', '2026-10-15T14:30:00.000Z'),
  );

  DB.versions.push(
    {
      id: erpV3,
      subscriptionId: erp,
      versionNumber: 3,
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      endpointUri: 'https://erp.example.com/hooks/trade',
      retryPolicyCode: 'EXPONENTIAL_STANDARD',
      maxAttempts: 6,
      status: 'ACTIVE',
      branchIds: [],
      events: [
        {
          eventType: 'trading.catalog.item_changed.v1',
          eventVersion: 1,
          fields: ['aggregateId', 'canonicalCode', 'changedFields', 'status'],
        },
        {
          eventType: 'trading.sales_order.confirmed.v1',
          eventVersion: 1,
          fields: ['aggregateId', 'businessEffectiveAt', 'currencyCode', 'grandTotal', 'orderNumber'],
        },
      ],
      version: 1,
      createdAt: '2026-11-21T11:00:00.000Z',
      updatedAt: '2026-11-21T11:02:00.000Z',
    },
    {
      id: biV1,
      subscriptionId: bi,
      versionNumber: 1,
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      endpointUri: 'https://bi.example.net/ingest/events',
      retryPolicyCode: 'EXPONENTIAL_CONSERVATIVE',
      maxAttempts: 4,
      status: 'PENDING_SECRET',
      branchIds: ['b1'],
      events: [
        {
          eventType: 'trading.quotation.accepted.v1',
          eventVersion: 1,
          fields: ['aggregateId', 'quotationNumber'],
        },
        {
          eventType: 'trading.quotation.sent.v1',
          eventVersion: 1,
          fields: ['aggregateId', 'currencyCode', 'grandTotal', 'quotationNumber'],
        },
      ],
      version: 1,
      createdAt: '2026-11-21T10:55:00.000Z',
      updatedAt: '2026-11-21T10:55:00.000Z',
    },
    {
      id: oldV2,
      subscriptionId: old,
      versionNumber: 2,
      scopeTarget: 'COMPANY',
      companyId: 'c1',
      endpointUri: 'https://legacy.example.org/webhooks/v1',
      retryPolicyCode: 'EXPONENTIAL_STANDARD',
      maxAttempts: 6,
      status: 'DISABLED',
      branchIds: [],
      events: [
        {
          eventType: 'trading.purchase_order.confirmed.v1',
          eventVersion: 1,
          fields: ['aggregateId', 'currencyCode', 'grandTotal', 'orderNumber'],
        },
      ],
      version: 1,
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-10-15T14:30:00.000Z',
    },
  );

  const secretRow = (
    id: string,
    subscriptionId: string,
    status: SecretStatus,
    from: string | null,
    revokedAt: string | null,
    revealCopy: string | null,
  ): StoredSecret => ({
    id,
    subscriptionId,
    status,
    providerSecretVersion: status === 'PENDING' ? 'pending' : 'v1',
    algorithmCode: 'HMAC_SHA256',
    signatureVersion: 1,
    activeFrom: from,
    overlapUntil: null,
    revokedAt,
    revealCopy,
  });
  DB.secrets.push(
    secretRow(erpSecret, erp, 'ACTIVE', activeFrom, null, base64Secret()),
    secretRow(biSecret, bi, 'PENDING', null, null, null),
    secretRow(oldSecret, old, 'REVOKED', '2026-03-01T08:00:00.000Z', '2026-10-15T14:30:00.000Z', null),
  );

  const opRow = (
    n: number,
    subscriptionId: string,
    versionId: string,
    type: SecretOperationType,
    status: SecretOperationStatus,
    target: string,
    createdAt: string,
    updatedAt: string,
  ): StoredOperation => ({
    id: seedId(4, n),
    subscriptionId,
    subscriptionVersionId: versionId,
    type,
    status,
    safeErrorCode: null,
    targetSecretId: target,
    priorSecretId: null,
    overlapUntil: null,
    createdAt,
    updatedAt,
  });
  const biCreate = opRow(2, bi, biV1, 'CREATE', 'PENDING', biSecret, '2026-11-21T10:55:00.000Z', '2026-11-21T10:55:00.000Z');
  DB.operations.push(
    opRow(1, erp, erpV3, 'CREATE', 'SUCCEEDED', erpSecret, '2026-11-21T11:00:00.000Z', activeFrom),
    biCreate,
    opRow(3, old, oldV2, 'REVOKE', 'SUCCEEDED', oldSecret, '2026-10-15T14:29:00.000Z', '2026-10-15T14:30:00.000Z'),
  );
  // The seeded pending CREATE completes like any other worker result, a little later.
  setTimeout(() => applySecretSucceeded(biCreate), SEEDED_PENDING_DELAY_MS);

  type Spec = [
    sub: 0 | 2,
    eventType: string,
    status: DeliveryStatus,
    attempts: number,
    lastOutcome: AttemptOutcome | null,
    lastClass: WebhookRetryClass | null,
    lastHttp: number | null,
    size: number,
    offsetMin: number,
  ];
  const specs: Spec[] = [
    [0, 'trading.sales_order.confirmed.v1', 'DELIVERED', 1, 'DELIVERED', null, 200, 1420, 110],
    [0, 'trading.catalog.item_changed.v1', 'DELIVERED', 2, 'DELIVERED', null, 200, 980, 95],
    [0, 'trading.sales_order.confirmed.v1', 'RETRY_PENDING', 2, 'RETRYABLE_FAILURE', 'RATE_LIMIT', 429, 1510, 88],
    [0, 'trading.catalog.item_changed.v1', 'PENDING', 0, null, null, null, 860, 82],
    [0, 'trading.sales_order.confirmed.v1', 'EXHAUSTED', 6, 'RETRYABLE_FAILURE', 'SERVER_ERROR', 502, 1640, 70],
    [0, 'trading.catalog.item_changed.v1', 'EXHAUSTED', 6, 'RETRYABLE_FAILURE', 'TIMEOUT', null, 1120, 60],
    [0, 'trading.sales_order.confirmed.v1', 'FAILED', 1, 'PERMANENT_FAILURE', 'CLIENT_ERROR', 400, 1380, 50],
    [2, 'trading.purchase_order.confirmed.v1', 'EXHAUSTED', 6, 'RETRYABLE_FAILURE', 'SERVER_ERROR', 500, 1790, 40],
    [0, 'trading.sales_order.confirmed.v1', 'DELIVERED', 1, 'DELIVERED', null, 200, 1490, 30],
    [0, 'trading.catalog.item_changed.v1', 'FAILED', 1, 'PERMANENT_FAILURE', 'REDIRECT_FORBIDDEN', 302, 910, 20],
    [2, 'trading.purchase_order.confirmed.v1', 'DISABLED', 0, null, null, null, 1210, 10],
    [0, 'trading.sales_order.confirmed.v1', 'DELIVERED', 1, 'DELIVERED', null, 200, 1445, 5],
  ];
  const tBase = Date.parse('2026-11-21T09:00:00.000Z');
  specs.forEach(([subIdx, eventType, status, count, lastOutcome, lastClass, lastHttp, size, offsetMin], idx) => {
    const sub = DB.subscriptions[subIdx];
    const version = latestVersion(sub.id);
    const startMs = tBase + offsetMin * 60_000;
    const attempts: WebhookDeliveryAttempt[] = [];
    for (let i = 1; i <= count; i += 1) {
      const last = i === count;
      const outcome: AttemptOutcome = last && lastOutcome ? lastOutcome : 'RETRYABLE_FAILURE';
      const retryClass: WebhookRetryClass | null =
        outcome === 'DELIVERED' ? null : last ? lastClass : (lastClass ?? 'TIMEOUT');
      const started = new Date(startMs + (i - 1) * 120_000);
      const durationMs = outcome === 'DELIVERED' ? 142 : retryClass === 'TIMEOUT' ? 10_000 : 318;
      attempts.push({
        attemptNumber: i,
        startedAt: started.toISOString(),
        completedAt: new Date(started.getTime() + durationMs).toISOString(),
        durationMs,
        outcome,
        retryClass,
        httpStatus: outcome === 'DELIVERED' ? 200 : last ? lastHttp : retryClass === 'TIMEOUT' ? null : 503,
        safeErrorCode: retryClass ? `WORKER.WEBHOOK.${retryClass}` : null,
      });
    }
    const lastAt = attempts.at(-1)?.completedAt ?? new Date(startMs).toISOString();
    const terminal = status === 'DELIVERED' || status === 'FAILED' || status === 'EXHAUSTED' || status === 'DISABLED';
    DB.deliveries.push({
      id: seedId(5, idx + 1),
      subscriptionId: sub.id,
      subscriptionVersionId: version.id,
      status,
      sourceEventType: eventType,
      sourceEventId: seedId(6, idx + 1),
      companyId: version.companyId,
      branchId: null,
      payloadSchemaCode: eventType,
      payloadHash: computeHash({ idx, eventType }).padEnd(64, '0'),
      payloadSizeBytes: size,
      payloadPurged: false,
      secretReferenceId: sub.id === erp ? erpSecret : oldSecret,
      attemptCount: count,
      nextAttemptAt: terminal ? null : new Date(startMs + 8 * 60_000).toISOString(),
      terminalAt: terminal ? lastAt : null,
      version: 1,
      createdAt: new Date(startMs).toISOString(),
      updatedAt: lastAt,
      attempts,
    });
  });
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function validationFailed(): never {
  throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
}

function payloadInvalid(): never {
  throw new ApiError(422, 'TRADE.WEBHOOK.PAYLOAD_INVALID');
}

function endpointForbidden(): never {
  throw new ApiError(422, 'TRADE.WEBHOOK.ENDPOINT_FORBIDDEN');
}

function targetDenied(): never {
  throw new ApiError(403, 'TRADE.AUTH.TARGET_DENIED');
}

function stale(): never {
  throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
}

function secretInvalid(reason: string): never {
  throw new ApiError(409, 'TRADE.WEBHOOK.SECRET_VERSION_INVALID', { reason: [reason] });
}

function notRetryable(reason: string): never {
  throw new ApiError(409, 'TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE', { reason: [reason] });
}

// ---------------------------------------------------------------------------
// DTO validation (TradeValidationPipe: whitelist + forbidNonWhitelisted => 400)
// ---------------------------------------------------------------------------

function assertOnlyKeys(body: object, allowed: readonly string[]): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) validationFailed();
  if (Object.keys(body).some((key) => !allowed.includes(key))) validationFailed();
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function checkEventDtos(events: unknown, required: boolean): void {
  if (events === undefined && !required) return;
  if (!Array.isArray(events) || events.length < 1 || events.length > WEBHOOK_LIMITS.maxEventsPerSubscription) {
    validationFailed();
  }
  for (const event of events as unknown[]) {
    assertOnlyKeys(event as object, ['eventType', 'eventVersion', 'fields']);
    const e = event as Record<string, unknown>;
    if (typeof e['eventType'] !== 'string' || e['eventType'].length > 160) validationFailed();
    if (!isInt(e['eventVersion'], 1, 10)) validationFailed();
    const fields = e['fields'];
    if (
      !Array.isArray(fields) ||
      fields.length < 1 ||
      fields.length > WEBHOOK_LIMITS.maxFieldsPerEvent ||
      fields.some((f) => typeof f !== 'string' || f.length > 100)
    ) {
      validationFailed();
    }
  }
}

function checkBranchDtos(branchIds: unknown): void {
  if (branchIds === undefined) return;
  if (!Array.isArray(branchIds) || branchIds.length > WEBHOOK_LIMITS.maxBranches) validationFailed();
  // The backend also requires each id to match UUID v7; the shared scope fake uses short ids (gap).
  if ((branchIds as unknown[]).some((id) => typeof id !== 'string' || !id)) validationFailed();
}

function checkRetryPolicy(value: unknown): void {
  if (value !== 'EXPONENTIAL_STANDARD' && value !== 'EXPONENTIAL_CONSERVATIVE') validationFailed();
}

function checkEndpointDto(value: unknown): void {
  if (typeof value !== 'string' || value.length > WEBHOOK_LIMITS.maxEndpointLength) validationFailed();
}

function checkCreateDto(input: CreateSubscriptionInput): void {
  assertOnlyKeys(input, ['code', 'scopeTarget', 'endpointUri', 'retryPolicyCode', 'maxAttempts', 'branchIds', 'events']);
  if (typeof input.code !== 'string' || !SUBSCRIPTION_CODE_PATTERN.test(input.code)) validationFailed();
  if (input.scopeTarget !== 'TENANT' && input.scopeTarget !== 'COMPANY') validationFailed();
  checkEndpointDto(input.endpointUri);
  checkRetryPolicy(input.retryPolicyCode);
  if (!isInt(input.maxAttempts, WEBHOOK_LIMITS.minAttempts, WEBHOOK_LIMITS.maxAttempts)) validationFailed();
  checkBranchDtos(input.branchIds);
  checkEventDtos(input.events, true);
}

function checkUpdateDto(input: UpdateSubscriptionInput): void {
  assertOnlyKeys(input, ['endpointUri', 'retryPolicyCode', 'maxAttempts', 'status', 'branchIds', 'events']);
  if (input.endpointUri !== undefined) checkEndpointDto(input.endpointUri);
  if (input.retryPolicyCode !== undefined) checkRetryPolicy(input.retryPolicyCode);
  if (
    input.maxAttempts !== undefined &&
    !isInt(input.maxAttempts, WEBHOOK_LIMITS.minAttempts, WEBHOOK_LIMITS.maxAttempts)
  ) {
    validationFailed();
  }
  if (input.status !== undefined && input.status !== 'ACTIVE' && input.status !== 'DISABLED') validationFailed();
  checkBranchDtos(input.branchIds);
  checkEventDtos(input.events, false);
}

// ---------------------------------------------------------------------------
// Domain rules (extensions-registry.ts / webhook-subscriptions.service.ts)
// ---------------------------------------------------------------------------

/** validateWebhookEvents: version 1 only, known event, allowed unique fields, no duplicates; sorted. */
function compileEvents(events: readonly WebhookEventDefinition[]): WebhookEventDefinition[] {
  const identities = events.map((e) => `${e.eventType}:${e.eventVersion}`);
  if (new Set(identities).size !== identities.length) payloadInvalid();
  return events
    .map((event) => {
      if (event.eventVersion !== 1) payloadInvalid();
      const allowed = WEBHOOK_EVENTS.find((spec) => spec.eventType === event.eventType)?.fields;
      if (
        !allowed ||
        new Set(event.fields).size !== event.fields.length ||
        event.fields.some((field) => !allowed.includes(field))
      ) {
        payloadInvalid();
      }
      return { eventType: event.eventType, eventVersion: 1, fields: [...event.fields].sort() };
    })
    .sort((a, b) => a.eventType.localeCompare(b.eventType));
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/** validateWebhookEndpointStatic; the backend also resolves DNS, which the fake cannot do. */
function safeEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    endpointForbidden();
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    (url.port && url.port !== '443' && url.port !== '8443') ||
    [...url.searchParams.keys()].some((key) => /token|secret|key|auth|signature|credential/i.test(key)) ||
    isPrivateIpv4(host) ||
    host.includes(':')
  ) {
    endpointForbidden();
  }
  url.hostname = url.hostname.toLowerCase();
  return url;
}

function webhookCompany(scopeTarget: WebhookScopeTarget): string | null {
  if (scopeTarget === 'COMPANY' && context.target !== 'COMPANY') targetDenied();
  if (scopeTarget === 'TENANT') {
    if (context.target !== 'TENANT') payloadInvalid();
    return null;
  }
  if (!context.companyId) payloadInvalid();
  return context.companyId;
}

function uniqueBranchIds(values: readonly string[]): string[] {
  if (new Set(values).size !== values.length) payloadInvalid();
  return [...values].sort();
}

function validateBranches(companyId: string, ids: readonly string[]): void {
  const active = ACTIVE_BRANCHES[companyId] ?? [];
  if (ids.some((id) => !active.includes(id))) payloadInvalid();
}

// ---------------------------------------------------------------------------
// Lookups and scope
// ---------------------------------------------------------------------------

function latestVersion(subscriptionId: string): StoredVersion {
  const latest = DB.versions
    .filter((v) => v.subscriptionId === subscriptionId)
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  if (!latest) throw new ApiError(404, 'TRADE.WEBHOOK.SUBSCRIPTION_NOT_FOUND');
  return latest;
}

function visibleTo(version: StoredVersion): boolean {
  if (context.target === 'TENANT') return version.scopeTarget === 'TENANT';
  if (version.scopeTarget !== 'COMPANY' || version.companyId !== context.companyId) return false;
  if (context.target === 'BRANCH') {
    return version.branchIds.length === 0 || version.branchIds.includes(context.branchId ?? '');
  }
  return true;
}

function requireRouteId(id: string): void {
  if (!UUID_V7.test(id)) validationFailed();
}

function findSubscription(id: string): StoredSubscription {
  requireRouteId(id);
  const sub = DB.subscriptions.find((s) => s.id === id && !s.deletedAt);
  if (!sub || !visibleTo(latestVersion(sub.id))) {
    throw new ApiError(404, 'TRADE.WEBHOOK.SUBSCRIPTION_NOT_FOUND');
  }
  return sub;
}

function deliveryVisible(d: StoredDelivery): boolean {
  if (context.target === 'TENANT') return d.companyId === null;
  if (d.companyId !== context.companyId) return false;
  return context.target !== 'BRANCH' || d.branchId === null || d.branchId === context.branchId;
}

function findDelivery(id: string): StoredDelivery {
  requireRouteId(id);
  const delivery = DB.deliveries.find((d) => d.id === id);
  if (!delivery || !deliveryVisible(delivery)) {
    throw new ApiError(404, 'TRADE.WEBHOOK.DELIVERY_NOT_FOUND');
  }
  return delivery;
}

function hasPendingOperation(subscriptionId: string): boolean {
  return DB.operations.some((op) => op.subscriptionId === subscriptionId && op.status === 'PENDING');
}

function secretById(id: string | null): StoredSecret | null {
  return id ? (DB.secrets.find((s) => s.id === id) ?? null) : null;
}

/** Any save of the subscription entity bumps its @VersionColumn. */
function touch(sub: StoredSubscription): void {
  sub.version += 1;
  sub.updatedBy = getFakeActor();
  sub.updatedAt = nowIso();
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

function projectEndpoint(uri: string): WebhookEndpoint {
  const url = new URL(uri);
  return { origin: url.origin, pathname: url.pathname };
}

function projectSecret(secret: StoredSecret | null): WebhookSecret | null {
  if (!secret) return null;
  return {
    id: secret.id,
    status: secret.status,
    providerSecretVersion: secret.providerSecretVersion,
    algorithmCode: secret.algorithmCode,
    signatureVersion: secret.signatureVersion,
    activeFrom: secret.activeFrom,
    overlapUntil: secret.overlapUntil,
    revokedAt: secret.revokedAt,
  };
}

function projectVersion(v: StoredVersion): WebhookVersionSummary {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    scopeTarget: v.scopeTarget,
    companyId: v.companyId,
    endpoint: projectEndpoint(v.endpointUri),
    retryPolicyCode: v.retryPolicyCode,
    maxAttempts: v.maxAttempts,
    status: v.status,
    version: v.version,
  };
}

function projectEntity(sub: StoredSubscription): WebhookSubscriptionEntity {
  return { ...sub };
}

function projectSummary(sub: StoredSubscription): WebhookSubscription {
  const version = latestVersion(sub.id);
  return {
    id: sub.id,
    code: sub.code,
    status: sub.status,
    version: sub.version,
    scopeTarget: version.scopeTarget,
    companyId: version.companyId,
    endpoint: projectEndpoint(version.endpointUri),
    activeVersionNumber: sub.currentActiveVersionId === version.id ? version.versionNumber : null,
    secret: projectSecret(secretById(sub.currentSecretReferenceId)),
    updatedAt: sub.updatedAt,
  };
}

/** WebhookSecretRevealService.availability: the reveal copy lives 15 minutes after activation. */
function revealAvailability(secret: StoredSecret | null): { available: boolean; availableUntil: string | null } {
  if (!secret || secret.status !== 'ACTIVE' || !secret.revealCopy || !secret.activeFrom) {
    return { available: false, availableUntil: null };
  }
  const until = Date.parse(secret.activeFrom) + REVEAL_WINDOW_MS;
  return until > Date.now()
    ? { available: true, availableUntil: new Date(until).toISOString() }
    : { available: false, availableUntil: null };
}

function projectDetail(sub: StoredSubscription): WebhookSubscriptionDetail {
  const version = latestVersion(sub.id);
  const secret = secretById(sub.currentSecretReferenceId);
  const operation = DB.operations
    .filter((op) => op.subscriptionId === sub.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    id: sub.id,
    code: sub.code,
    status: sub.status,
    version: sub.version,
    currentVersion: {
      id: version.id,
      versionNumber: version.versionNumber,
      scopeTarget: version.scopeTarget,
      companyId: version.companyId,
      endpoint: projectEndpoint(version.endpointUri),
      retryPolicyCode: version.retryPolicyCode,
      maxAttempts: version.maxAttempts,
      status: version.status,
      branches: [...version.branchIds],
      events: clone(version.events),
    },
    secret: projectSecret(secret),
    secretReveal: revealAvailability(secret),
    secretOperation: operation
      ? {
          id: operation.id,
          type: operation.type,
          status: operation.status,
          safeErrorCode: operation.safeErrorCode,
          createdAt: operation.createdAt,
          updatedAt: operation.updatedAt,
        }
      : null,
  };
}

function projectDelivery(d: StoredDelivery): WebhookDelivery {
  const sub = DB.subscriptions.find((s) => s.id === d.subscriptionId);
  const version = DB.versions.find((v) => v.id === d.subscriptionVersionId);
  if (!sub || !version) throw new Error('Webhook delivery authority is inconsistent.');
  return {
    id: d.id,
    subscriptionId: d.subscriptionId,
    subscriptionCode: sub.code,
    status: d.status,
    sourceEventType: d.sourceEventType,
    sourceEventId: d.sourceEventId,
    companyId: d.companyId,
    branchId: d.branchId,
    payloadSchemaCode: d.payloadSchemaCode,
    payloadHash: d.payloadHash,
    payloadSizeBytes: d.payloadSizeBytes,
    attemptCount: d.attemptCount,
    nextAttemptAt: d.nextAttemptAt,
    terminalAt: d.terminalAt,
    version: d.version,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    endpoint: projectEndpoint(version.endpointUri),
  };
}

// ---------------------------------------------------------------------------
// Fake worker (webhook-results.service.ts)
// ---------------------------------------------------------------------------

function applySecretSucceeded(op: StoredOperation): void {
  if (op.status !== 'PENDING') return;
  const sub = DB.subscriptions.find((s) => s.id === op.subscriptionId);
  const version = DB.versions.find((v) => v.id === op.subscriptionVersionId);
  const target = secretById(op.targetSecretId);
  if (!sub || !version || !target) return;
  const now = nowIso();

  if (op.type === 'REVOKE') {
    target.status = 'REVOKED';
    target.overlapUntil = null;
    target.revokedAt = now;
    target.revealCopy = null;
    for (const overlap of DB.secrets.filter((s) => s.subscriptionId === sub.id && s.status === 'OVERLAP')) {
      overlap.status = 'REVOKED';
      overlap.overlapUntil = null;
      overlap.revokedAt = now;
    }
    if (sub.currentSecretReferenceId === target.id) {
      sub.currentSecretReferenceId = null;
      sub.currentActiveVersionId = null;
      if (sub.status !== 'DISABLED') sub.status = 'DRAFT';
    }
    if (version.status === 'ACTIVE') {
      version.status = sub.status === 'DISABLED' ? 'DISABLED' : 'PENDING_SECRET';
    }
  } else {
    if (op.type === 'ROTATE') {
      for (const older of DB.secrets.filter((s) => s.subscriptionId === sub.id && s.status === 'OVERLAP')) {
        older.status = 'REVOKED';
        older.overlapUntil = null;
        older.revokedAt = now;
      }
      const prior = secretById(op.priorSecretId);
      if (prior) {
        prior.status = 'OVERLAP';
        prior.overlapUntil = op.overlapUntil;
        prior.revealCopy = null;
      }
    }
    target.status = 'ACTIVE';
    target.providerSecretVersion = `v${DB.secrets.filter((s) => s.subscriptionId === sub.id).length}`;
    target.activeFrom = now;
    target.overlapUntil = null;
    target.revokedAt = null;
    target.revealCopy = base64Secret();
    sub.currentSecretReferenceId = target.id;
    if (sub.status !== 'DISABLED') {
      if (sub.currentActiveVersionId && sub.currentActiveVersionId !== version.id) {
        const previous = DB.versions.find((v) => v.id === sub.currentActiveVersionId);
        if (previous?.status === 'ACTIVE') previous.status = 'SUPERSEDED';
      }
      version.status = 'ACTIVE';
      sub.currentActiveVersionId = version.id;
      sub.status = 'ACTIVE';
    } else if (version.status === 'PENDING_SECRET') {
      version.status = 'DISABLED';
    }
  }
  touch(sub);
  op.status = 'SUCCEEDED';
  op.safeErrorCode = null;
  op.updatedAt = now;
}

function scheduleDeliveryAttempt(delivery: StoredDelivery): void {
  setTimeout(() => {
    if (delivery.status !== 'PENDING' && delivery.status !== 'RETRY_PENDING') return;
    const startedAt = nowIso();
    delivery.attemptCount += 1;
    delivery.attempts.push({
      attemptNumber: delivery.attemptCount,
      startedAt,
      completedAt: startedAt,
      durationMs: 118,
      outcome: 'DELIVERED',
      retryClass: null,
      httpStatus: 200,
      safeErrorCode: null,
    });
    delivery.status = 'DELIVERED';
    delivery.nextAttemptAt = null;
    delivery.terminalAt = startedAt;
    delivery.version += 1;
    delivery.updatedAt = startedAt;
  }, workerDelayMs);
}

function createPendingSecretOperation(
  sub: StoredSubscription,
  version: StoredVersion,
  type: 'CREATE' | 'ROTATE',
  priorSecretId: string | null,
  overlapUntil: string | null,
): { secret: StoredSecret; operation: StoredOperation } {
  const now = nowIso();
  const secret: StoredSecret = {
    id: fakeId(),
    subscriptionId: sub.id,
    status: 'PENDING',
    providerSecretVersion: 'pending',
    algorithmCode: 'HMAC_SHA256',
    signatureVersion: 1,
    activeFrom: null,
    overlapUntil,
    revokedAt: null,
    revealCopy: null,
  };
  const operation: StoredOperation = {
    id: fakeId(),
    subscriptionId: sub.id,
    subscriptionVersionId: version.id,
    type,
    status: 'PENDING',
    safeErrorCode: null,
    targetSecretId: secret.id,
    priorSecretId,
    overlapUntil,
    createdAt: now,
    updatedAt: now,
  };
  DB.secrets.push(secret);
  DB.operations.push(operation);
  setTimeout(() => applySecretSucceeded(operation), workerDelayMs);
  return { secret, operation };
}

seed();

// ---------------------------------------------------------------------------
// Public fake API
// ---------------------------------------------------------------------------

function checkPaging(page: number, limit: number): void {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    validationFailed();
  }
}

function checkDeliveryFilters(f: DeliveryFilters): void {
  if (
    f.status !== undefined &&
    (f.status.length < 1 || f.status.length > 6 || f.status.some((s) => !DELIVERY_STATUSES.includes(s)))
  ) {
    validationFailed();
  }
  if (f.subscriptionId !== undefined && !UUID_V7.test(f.subscriptionId)) validationFailed();
  if (f.eventType !== undefined && f.eventType.length > 160) validationFailed();
  for (const iso of [f.createdFrom, f.createdTo]) {
    if (iso !== undefined && Number.isNaN(Date.parse(iso))) validationFailed();
  }
}

function filterDeliveries(f: DeliveryFilters): StoredDelivery[] {
  checkDeliveryFilters(f);
  const from = f.createdFrom ? Date.parse(f.createdFrom) : Number.NEGATIVE_INFINITY;
  const to = f.createdTo ? Date.parse(f.createdTo) : Number.POSITIVE_INFINITY;
  return DB.deliveries.filter((d) => {
    const created = Date.parse(d.createdAt);
    return (
      deliveryVisible(d) &&
      (!f.status || f.status.includes(d.status)) &&
      (!f.subscriptionId || d.subscriptionId === f.subscriptionId) &&
      (!f.eventType || d.sourceEventType === f.eventType) &&
      created >= from &&
      created <= to
    );
  });
}

export async function fakeListWebhookEvents(): Promise<WebhookEventCatalogue> {
  await fakeDelay(80);
  return {
    items: WEBHOOK_EVENTS.map((e) => ({ eventType: e.eventType, eventVersion: 1, fields: [...e.fields] })),
  };
}

export async function fakeListSubscriptions(
  q: ListSubscriptionsQuery = {},
): Promise<Page<WebhookSubscription>> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  checkPaging(page, limit);
  if (q.status !== undefined && !['DRAFT', 'ACTIVE', 'DISABLED'].includes(q.status)) validationFailed();
  const rows = DB.subscriptions
    .filter((s) => !s.deletedAt && visibleTo(latestVersion(s.id)) && (!q.status || s.status === q.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  const items = rows.slice((page - 1) * limit, page * limit).map(projectSummary);
  return clone({ items, page, limit, total: rows.length });
}

export async function fakeGetSubscription(id: string): Promise<WebhookSubscriptionDetail> {
  await fakeDelay();
  return clone(projectDetail(findSubscription(id)));
}

export async function fakeCreateSubscription(
  input: CreateSubscriptionInput,
  idempotencyKey?: string,
): Promise<CreateSubscriptionResult> {
  await fakeDelay();
  checkCreateDto(input);
  const key = requireIdempotencyKey(idempotencyKey);
  const companyId = webhookCompany(input.scopeTarget);
  const endpoint = safeEndpoint(input.endpointUri);
  const events = compileEvents(input.events);
  const branchIds = uniqueBranchIds(input.branchIds ?? []);
  if (input.scopeTarget === 'TENANT' && branchIds.length) payloadInvalid();

  return idem.run('webhooks:create', key, input, () => {
    if (companyId) validateBranches(companyId, branchIds);
    if (DB.subscriptions.some((s) => s.code === input.code && !s.deletedAt)) {
      throw new ApiError(409, 'TRADE.WEBHOOK.SUBSCRIPTION_CODE_CONFLICT');
    }
    const now = nowIso();
    const sub: StoredSubscription = {
      id: fakeId(),
      code: input.code,
      status: 'DRAFT',
      currentActiveVersionId: null,
      currentSecretReferenceId: null,
      version: 1,
      createdBy: getFakeActor(),
      updatedBy: getFakeActor(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const version: StoredVersion = {
      id: fakeId(),
      subscriptionId: sub.id,
      versionNumber: 1,
      scopeTarget: input.scopeTarget,
      companyId,
      endpointUri: endpoint.href,
      retryPolicyCode: input.retryPolicyCode,
      maxAttempts: input.maxAttempts,
      status: 'PENDING_SECRET',
      branchIds,
      events,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    DB.subscriptions.unshift(sub);
    DB.versions.push(version);
    const { secret, operation } = createPendingSecretOperation(sub, version, 'CREATE', null, null);
    return {
      ...projectEntity(sub),
      currentVersion: projectVersion(version),
      secretSetup: {
        status: 'PENDING' as const,
        operationId: operation.id,
        secretReferenceId: secret.id,
        plaintextReturned: false as const,
      },
    };
  });
}

export async function fakeUpdateSubscription(
  id: string,
  input: UpdateSubscriptionInput,
  opts: WriteOptions = {},
): Promise<UpdateSubscriptionResult> {
  await fakeDelay();
  requireRouteId(id);
  checkUpdateDto(input);
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  if (context.target === 'BRANCH') targetDenied();
  if (Object.values(input).every((value) => value === undefined)) payloadInvalid();

  const snapshot = findSubscription(id);
  const current = latestVersion(snapshot.id);
  const endpoint = input.endpointUri ? safeEndpoint(input.endpointUri) : new URL(current.endpointUri);
  const events = compileEvents(input.events ?? current.events);
  const branchIds = uniqueBranchIds(input.branchIds ?? current.branchIds);

  return idem.run(`webhooks:update:${id}`, key, { expected, input }, () => {
    const sub = findSubscription(id);
    if (sub.version !== expected) stale();
    const statusOnly =
      input.status !== undefined &&
      input.endpointUri === undefined &&
      input.retryPolicyCode === undefined &&
      input.maxAttempts === undefined &&
      input.branchIds === undefined &&
      input.events === undefined;
    if (hasPendingOperation(sub.id) && !(statusOnly && input.status === 'DISABLED')) {
      secretInvalid('operation_pending');
    }
    const locked = latestVersion(sub.id);
    if (locked.id !== current.id) stale();
    if (locked.scopeTarget === 'TENANT' && branchIds.length) payloadInvalid();
    if (locked.companyId) validateBranches(locked.companyId, branchIds);
    const activeSecret = DB.secrets.find(
      (s) => s.id === sub.currentSecretReferenceId && s.subscriptionId === sub.id && s.status === 'ACTIVE',
    );

    if (statusOnly) {
      if (input.status === 'ACTIVE' && !activeSecret) secretInvalid('not_active');
      locked.status = input.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED';
      locked.updatedAt = nowIso();
      sub.status = input.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED';
      sub.currentActiveVersionId = input.status === 'ACTIVE' ? locked.id : null;
      touch(sub);
      return { ...projectEntity(sub), currentVersion: projectVersion(locked) };
    }

    const requestedStatus: SubscriptionStatus = input.status ?? sub.status;
    const versionStatus: SubscriptionVersionStatus =
      requestedStatus === 'DISABLED' ? 'DISABLED' : activeSecret ? 'ACTIVE' : 'PENDING_SECRET';
    const now = nowIso();
    const next: StoredVersion = {
      id: fakeId(),
      subscriptionId: sub.id,
      versionNumber: locked.versionNumber + 1,
      scopeTarget: locked.scopeTarget,
      companyId: locked.companyId,
      endpointUri: endpoint.href,
      retryPolicyCode: input.retryPolicyCode ?? locked.retryPolicyCode,
      maxAttempts: input.maxAttempts ?? locked.maxAttempts,
      status: versionStatus,
      branchIds,
      events,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    DB.versions.push(next);
    if (locked.status === 'ACTIVE') locked.status = 'SUPERSEDED';
    sub.currentActiveVersionId = versionStatus === 'ACTIVE' ? next.id : null;
    sub.status = versionStatus === 'ACTIVE' ? 'ACTIVE' : requestedStatus === 'DISABLED' ? 'DISABLED' : 'DRAFT';
    touch(sub);
    return { ...projectEntity(sub), currentVersion: projectVersion(next) };
  });
}

/** No domain idempotency: persisting this response would disclose the secret again. */
export async function fakeRevealSecret(
  id: string,
  body: { secretReferenceId: string },
): Promise<RevealSecretResult> {
  await fakeDelay(150);
  requireRouteId(id);
  assertOnlyKeys(body, ['secretReferenceId']);
  if (typeof body.secretReferenceId !== 'string' || !UUID_V7.test(body.secretReferenceId)) validationFailed();
  const sub = findSubscription(id);
  if (sub.currentSecretReferenceId !== body.secretReferenceId) secretInvalid('not_current_reference');
  if (hasPendingOperation(sub.id)) secretInvalid('operation_pending');
  const secret = DB.secrets.find(
    (s) => s.id === body.secretReferenceId && s.subscriptionId === sub.id && s.status === 'ACTIVE',
  );
  if (!secret) secretInvalid('not_active');
  // GETDEL: the copy is consumed even if the caller never shows it.
  const copy = secret.revealCopy;
  secret.revealCopy = null;
  const expired = !secret.activeFrom || Date.parse(secret.activeFrom) + REVEAL_WINDOW_MS <= Date.now();
  if (!copy || expired) secretInvalid(expired ? 'reveal_expired' : 'already_revealed');
  return {
    secretReferenceId: secret.id,
    secret: copy,
    secretEncoding: 'base64',
    algorithmCode: 'HMAC_SHA256',
  };
}

export async function fakeRotateSecret(
  id: string,
  body: { overlapHours: number },
  opts: WriteOptions = {},
): Promise<SecretOperationAccepted> {
  await fakeDelay();
  requireRouteId(id);
  assertOnlyKeys(body, ['overlapHours']);
  if (!isInt(body.overlapHours, WEBHOOK_LIMITS.minOverlapHours, WEBHOOK_LIMITS.maxOverlapHours)) {
    validationFailed();
  }
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  findSubscription(id);

  return idem.run(`webhooks:rotate:${id}`, key, { expected, body }, () => {
    const sub = findSubscription(id);
    if (sub.version !== expected) stale();
    if (hasPendingOperation(sub.id)) secretInvalid('operation_pending');
    if (sub.status !== 'ACTIVE' || !sub.currentSecretReferenceId) secretInvalid('not_active');
    const overlapUntil = new Date(Date.now() + body.overlapHours * 3_600_000).toISOString();
    const { secret, operation } = createPendingSecretOperation(
      sub,
      latestVersion(sub.id),
      'ROTATE',
      sub.currentSecretReferenceId,
      overlapUntil,
    );
    touch(sub);
    return {
      statusCode: 202 as const,
      subscriptionId: sub.id,
      status: 'PENDING_PROVIDER_RECONCILIATION' as const,
      operationId: operation.id,
      secretReferenceId: secret.id,
      plaintextReturned: false as const,
    };
  });
}

export async function fakeRevokeSecret(
  id: string,
  opts: WriteOptions = {},
): Promise<SecretOperationAccepted> {
  await fakeDelay();
  requireRouteId(id);
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  findSubscription(id);

  return idem.run(`webhooks:revoke:${id}`, key, { expected }, () => {
    const sub = findSubscription(id);
    if (sub.version !== expected) stale();
    if (hasPendingOperation(sub.id)) secretInvalid('operation_pending');
    if (!sub.currentSecretReferenceId) secretInvalid('not_active');
    const reference = DB.secrets.find(
      (s) => s.id === sub.currentSecretReferenceId && s.subscriptionId === sub.id && s.status === 'ACTIVE',
    );
    if (!reference) secretInvalid('not_active');
    const now = nowIso();
    const operation: StoredOperation = {
      id: fakeId(),
      subscriptionId: sub.id,
      subscriptionVersionId: latestVersion(sub.id).id,
      type: 'REVOKE',
      status: 'PENDING',
      safeErrorCode: null,
      targetSecretId: reference.id,
      priorSecretId: null,
      overlapUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    DB.operations.push(operation);
    setTimeout(() => applySecretSucceeded(operation), workerDelayMs);
    return {
      statusCode: 202 as const,
      subscriptionId: sub.id,
      status: 'PENDING_PROVIDER_RECONCILIATION' as const,
      operationId: operation.id,
      secretReferenceId: reference.id,
      plaintextReturned: false as const,
    };
  });
}

export async function fakeSendTestDelivery(
  id: string,
  idempotencyKey?: string,
): Promise<TestDeliveryAccepted> {
  await fakeDelay();
  requireRouteId(id);
  const key = requireIdempotencyKey(idempotencyKey);
  findSubscription(id);

  return idem.run(`webhooks:test:${id}`, key, { synthetic: true }, () => {
    const sub = findSubscription(id);
    if (sub.status !== 'ACTIVE' || !sub.currentActiveVersionId || !sub.currentSecretReferenceId) {
      secretInvalid('not_active');
    }
    const version = DB.versions.find((v) => v.id === sub.currentActiveVersionId && v.status === 'ACTIVE');
    if (!version) secretInvalid('not_active');
    const now = nowIso();
    const delivery: StoredDelivery = {
      id: fakeId(),
      subscriptionId: sub.id,
      subscriptionVersionId: version.id,
      status: 'PENDING',
      sourceEventType: SYNTHETIC_EVENT,
      sourceEventId: key,
      companyId: version.companyId,
      branchId: null,
      payloadSchemaCode: SYNTHETIC_EVENT,
      payloadHash: computeHash({ sub: sub.id, key }).padEnd(64, '0'),
      payloadSizeBytes: 312,
      payloadPurged: false,
      secretReferenceId: sub.currentSecretReferenceId,
      attemptCount: 0,
      nextAttemptAt: now,
      terminalAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      attempts: [],
    };
    DB.deliveries.unshift(delivery);
    scheduleDeliveryAttempt(delivery);
    return { statusCode: 202 as const, deliveryId: delivery.id, status: delivery.status, synthetic: true as const };
  });
}

export async function fakeGetDeliveryCounts(filters: DeliveryFilters = {}): Promise<WebhookDeliveryCounts> {
  await fakeDelay(120);
  const byStatus = Object.fromEntries(DELIVERY_STATUSES.map((s) => [s, 0])) as Record<DeliveryStatus, number>;
  const rows = filterDeliveries(filters);
  for (const d of rows) byStatus[d.status] += 1;
  return { total: rows.length, byStatus };
}

export async function fakeListDeliveries(q: ListDeliveriesQuery = {}): Promise<Page<WebhookDelivery>> {
  await fakeDelay();
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;
  checkPaging(page, limit);
  const rows = filterDeliveries(q).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  const items = rows.slice((page - 1) * limit, page * limit).map(projectDelivery);
  return clone({ items, page, limit, total: rows.length });
}

export async function fakeGetDelivery(id: string): Promise<WebhookDeliveryDetail> {
  await fakeDelay();
  const delivery = findDelivery(id);
  return clone({ ...projectDelivery(delivery), attempts: delivery.attempts });
}

export async function fakeRetryDelivery(
  id: string,
  input: RetryDeliveryInput,
  opts: WriteOptions = {},
): Promise<RetryDeliveryAccepted> {
  await fakeDelay();
  requireRouteId(id);
  assertOnlyKeys(input, ['reasonCode', 'reasonNote']);
  if (typeof input.reasonCode !== 'string' || !RETRY_REASON_CODE_PATTERN.test(input.reasonCode)) validationFailed();
  if (
    input.reasonNote !== undefined &&
    (typeof input.reasonNote !== 'string' || input.reasonNote.length > WEBHOOK_LIMITS.maxReasonNote)
  ) {
    validationFailed();
  }
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);
  findDelivery(id);

  return idem.run(`webhooks:retry:${id}`, key, { expected, input }, () => {
    const delivery = findDelivery(id);
    if (delivery.version !== expected) stale();
    validateAutomationReason('WEBHOOK_DELIVERY_RETRY', input.reasonCode, input.reasonNote);
    const sub = DB.subscriptions.find((s) => s.id === delivery.subscriptionId);
    const version = DB.versions.find((v) => v.id === delivery.subscriptionVersionId);
    if (delivery.status !== 'EXHAUSTED') notRetryable('not_exhausted');
    if (!sub || sub.status !== 'ACTIVE' || !version) notRetryable('subscription_not_active');
    if (delivery.payloadPurged) notRetryable('payload_purged');
    const last = delivery.attempts.at(-1);
    if (!last || last.outcome !== 'RETRYABLE_FAILURE' || !last.retryClass || !RETRYABLE_CLASSES.includes(last.retryClass)) {
      notRetryable('not_retryable_class');
    }
    const secret = secretById(delivery.secretReferenceId);
    if (
      !secret ||
      (secret.status !== 'ACTIVE' && secret.status !== 'OVERLAP') ||
      (secret.status === 'OVERLAP' && (!secret.overlapUntil || Date.parse(secret.overlapUntil) <= Date.now()))
    ) {
      notRetryable('secret_unavailable');
    }
    const now = nowIso();
    delivery.status = 'RETRY_PENDING';
    delivery.nextAttemptAt = now;
    delivery.terminalAt = null;
    delivery.version += 1;
    delivery.updatedAt = now;
    scheduleDeliveryAttempt(delivery);
    return {
      statusCode: 202 as const,
      deliveryId: delivery.id,
      status: 'RETRY_PENDING' as const,
      nextAttemptAt: now,
    };
  });
}
