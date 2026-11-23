import type { CoreHttp, CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  TRADE_API_BASE,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
  toTradeError,
  type TradeContext,
} from '../shared/trade-api';
import type { Page } from '../shared/trade-foundation.model';
import { tradeCore, tradeHttp, type TradeCoreTransport } from '../shared/trade-http';
import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  DeliveryFilters,
  ListDeliveriesQuery,
  ListSubscriptionsQuery,
  RetryDeliveryAccepted,
  RetryDeliveryInput,
  RevealSecretResult,
  SecretOperationAccepted,
  TestDeliveryAccepted,
  UpdateSubscriptionInput,
  UpdateSubscriptionResult,
  WebhookDelivery,
  WebhookDeliveryCounts,
  WebhookDeliveryDetail,
  WebhookEventCatalogue,
  WebhookEventSelection,
  WebhookSubscription,
  WebhookSubscriptionDetail,
} from './webhooks.model';

// Routes: trade-app extensions-automation.controller.ts, prefix /api/tenant/trade/v1.

export const WEBHOOKS_QUERY_KEYS = {
  all: ['trade', 'automation', 'webhooks'] as const,
  events: () => ['trade', 'automation', 'webhooks', 'events'] as const,
  subscriptions: (q?: ListSubscriptionsQuery) =>
    ['trade', 'automation', 'webhooks', 'subscriptions', q ?? {}] as const,
  subscription: (id: string) =>
    ['trade', 'automation', 'webhooks', 'subscription', id] as const,
  deliveryCounts: (f?: DeliveryFilters) =>
    ['trade', 'automation', 'webhooks', 'delivery-counts', f ?? {}] as const,
  deliveries: (q?: ListDeliveriesQuery) =>
    ['trade', 'automation', 'webhooks', 'deliveries', q ?? {}] as const,
  delivery: (id: string) => ['trade', 'automation', 'webhooks', 'delivery', id] as const,
};

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: CoreQuery = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

function requireIfMatchHeader(version: number): string {
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
  }
  return ifMatch(version);
}

function deliveryFilterQuery(
  filters: DeliveryFilters,
): Record<string, string | number | boolean | undefined> {
  return {
    status: filters.status?.length ? filters.status.join(',') : undefined,
    subscriptionId: filters.subscriptionId,
    eventType: filters.eventType,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
  };
}

function sanitizeEvents(events: readonly WebhookEventSelection[]): WebhookEventSelection[] {
  return events.map((e) => ({
    eventType: e.eventType,
    eventVersion: e.eventVersion,
    fields: [...e.fields],
  }));
}

// GET /webhooks/deliveries/counts?status&subscriptionId&eventType&createdFrom&createdTo (OPTIONAL scope)
export function getDeliveryCounts(
  filters: DeliveryFilters = {},
  ctx: TradeContext = {},
): Promise<WebhookDeliveryCounts> {
  return tradeHttp().read<WebhookDeliveryCounts>(
    '/webhooks/deliveries/counts',
    compactQuery(deliveryFilterQuery(filters)),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /webhooks/events (OPTIONAL scope)
export function listEvents(ctx: TradeContext = {}): Promise<WebhookEventCatalogue> {
  return tradeHttp().read<WebhookEventCatalogue>('/webhooks/events', undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /webhooks/subscriptions?page&limit&status (OPTIONAL scope)
export function listSubscriptions(
  q: ListSubscriptionsQuery = {},
  ctx: TradeContext = {},
): Promise<Page<WebhookSubscription>> {
  return tradeHttp().read<Page<WebhookSubscription>>(
    '/webhooks/subscriptions',
    compactQuery({
      page: q.page,
      limit: q.limit,
      status: q.status,
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /webhooks/subscriptions/:id (OPTIONAL scope)
export function getSubscription(
  id: string,
  ctx: TradeContext = {},
): Promise<WebhookSubscriptionDetail> {
  return tradeHttp().read<WebhookSubscriptionDetail>(
    `/webhooks/subscriptions/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// POST /webhooks/subscriptions (X-Idempotency-Key, OPTIONAL scope) -> 201
export async function createSubscription(
  input: CreateSubscriptionInput,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<CreateSubscriptionResult> {
  const body: CreateSubscriptionInput = {
    code: input.code,
    scopeTarget: input.scopeTarget,
    endpointUri: input.endpointUri,
    retryPolicyCode: input.retryPolicyCode,
    maxAttempts: input.maxAttempts,
    ...(input.branchIds !== undefined ? { branchIds: [...input.branchIds] } : {}),
    events: sanitizeEvents(input.events),
  };
  const { data } = await tradeHttp().write<CreateSubscriptionResult>(
    'POST',
    '/webhooks/subscriptions',
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// PATCH /webhooks/subscriptions/:id (X-Idempotency-Key, If-Match, OPTIONAL scope) -> 200
export async function updateSubscription(
  id: string,
  input: UpdateSubscriptionInput,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<UpdateSubscriptionResult> {
  const body: UpdateSubscriptionInput = {
    ...(input.endpointUri !== undefined ? { endpointUri: input.endpointUri } : {}),
    ...(input.retryPolicyCode !== undefined ? { retryPolicyCode: input.retryPolicyCode } : {}),
    ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.branchIds !== undefined ? { branchIds: [...input.branchIds] } : {}),
    ...(input.events !== undefined ? { events: sanitizeEvents(input.events) } : {}),
  };
  const { data } = await tradeHttp().write<UpdateSubscriptionResult>(
    'PATCH',
    `/webhooks/subscriptions/${encodeSeg(id)}`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /webhooks/subscriptions/:id/reveal-secret body {secretReferenceId} -> 200 (no idempotency key, never cached/logged)
export async function revealSecret(
  id: string,
  secretReferenceId: string,
  ctx: TradeContext = {},
): Promise<RevealSecretResult> {
  const scope = scopeFor(ctx, 'OPTIONAL');
  const path = `${TRADE_API_BASE}/webhooks/subscriptions/${encodeSeg(id)}/reveal-secret`;
  const core = tradeCore() as TradeCoreTransport & { write?: CoreHttp['write'] };
  if (typeof core.write !== 'function') {
    throw new ApiError(500, 'TRADE.TRANSPORT.UNSUPPORTED');
  }
  try {
    const { data } = await core.write<RevealSecretResult>(
      'POST',
      path,
      { secretReferenceId },
      { scope },
    );
    return data;
  } catch (error) {
    throw toTradeError(error);
  }
}

// POST /webhooks/subscriptions/:id/rotate-secret body {overlapHours} (X-Idempotency-Key, If-Match, OPTIONAL scope) -> 202
export async function rotateSecret(
  id: string,
  overlapHours: number,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<SecretOperationAccepted> {
  const { data } = await tradeHttp().write<SecretOperationAccepted>(
    'POST',
    `/webhooks/subscriptions/${encodeSeg(id)}/rotate-secret`,
    { overlapHours },
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /webhooks/subscriptions/:id/revoke-secret (X-Idempotency-Key, If-Match, OPTIONAL scope) -> 202
export async function revokeSecret(
  id: string,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<SecretOperationAccepted> {
  const { data } = await tradeHttp().write<SecretOperationAccepted>(
    'POST',
    `/webhooks/subscriptions/${encodeSeg(id)}/revoke-secret`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// POST /webhooks/subscriptions/:id/test (X-Idempotency-Key, OPTIONAL scope) -> 202
export async function sendTest(
  id: string,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<TestDeliveryAccepted> {
  const { data } = await tradeHttp().write<TestDeliveryAccepted>(
    'POST',
    `/webhooks/subscriptions/${encodeSeg(id)}/test`,
    undefined,
    {
      key: assertIdempotencyKey(idempotencyKey),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}

// GET /webhooks/deliveries?page&limit&status&subscriptionId&eventType&createdFrom&createdTo (OPTIONAL scope)
export function listDeliveries(
  q: ListDeliveriesQuery = {},
  ctx: TradeContext = {},
): Promise<Page<WebhookDelivery>> {
  return tradeHttp().read<Page<WebhookDelivery>>(
    '/webhooks/deliveries',
    compactQuery({
      page: q.page,
      limit: q.limit,
      ...deliveryFilterQuery(q),
    }),
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// GET /webhooks/deliveries/:id (OPTIONAL scope)
export function getDelivery(
  id: string,
  ctx: TradeContext = {},
): Promise<WebhookDeliveryDetail> {
  return tradeHttp().read<WebhookDeliveryDetail>(
    `/webhooks/deliveries/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
}

// POST /webhooks/deliveries/:id/retry body {reasonCode, reasonNote?} (X-Idempotency-Key, If-Match, OPTIONAL scope) -> 202
export async function retryDelivery(
  id: string,
  input: RetryDeliveryInput,
  expectedVersion: number,
  idempotencyKey: string = newIdempotencyKey(),
  ctx: TradeContext = {},
): Promise<RetryDeliveryAccepted> {
  const body: RetryDeliveryInput = {
    reasonCode: input.reasonCode,
    ...(input.reasonNote !== undefined ? { reasonNote: input.reasonNote } : {}),
  };
  const { data } = await tradeHttp().write<RetryDeliveryAccepted>(
    'POST',
    `/webhooks/deliveries/${encodeSeg(id)}/retry`,
    body,
    {
      key: assertIdempotencyKey(idempotencyKey),
      ifMatch: requireIfMatchHeader(expectedVersion),
      scope: scopeFor(ctx, 'OPTIONAL'),
    },
  );
  return data;
}
