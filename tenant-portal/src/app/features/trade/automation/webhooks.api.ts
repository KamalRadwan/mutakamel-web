import type { Page } from '../shared/trade-foundation.model';
import {
  fakeCreateSubscription,
  fakeGetDelivery,
  fakeGetDeliveryCounts,
  fakeGetSubscription,
  fakeListDeliveries,
  fakeListSubscriptions,
  fakeListWebhookEvents,
  fakeRetryDelivery,
  fakeRevealSecret,
  fakeRevokeSecret,
  fakeRotateSecret,
  fakeSendTestDelivery,
  fakeUpdateSubscription,
} from './webhooks.fake';
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

// GET /webhooks/deliveries/counts?status&subscriptionId&eventType&createdFrom&createdTo
export function getDeliveryCounts(filters: DeliveryFilters = {}): Promise<WebhookDeliveryCounts> {
  return fakeGetDeliveryCounts(filters);
}

// GET /webhooks/events
export function listEvents(): Promise<WebhookEventCatalogue> {
  return fakeListWebhookEvents();
}

// GET /webhooks/subscriptions?page&limit&status
export function listSubscriptions(
  q: ListSubscriptionsQuery = {},
): Promise<Page<WebhookSubscription>> {
  return fakeListSubscriptions(q);
}

// GET /webhooks/subscriptions/:id
export function getSubscription(id: string): Promise<WebhookSubscriptionDetail> {
  return fakeGetSubscription(id);
}

// POST /webhooks/subscriptions (X-Idempotency-Key) -> 201
export function createSubscription(
  input: CreateSubscriptionInput,
  idempotencyKey: string,
): Promise<CreateSubscriptionResult> {
  return fakeCreateSubscription(input, idempotencyKey);
}

// PATCH /webhooks/subscriptions/:id (X-Idempotency-Key, If-Match) -> 200
export function updateSubscription(
  id: string,
  input: UpdateSubscriptionInput,
  ifMatch: number,
  idempotencyKey: string,
): Promise<UpdateSubscriptionResult> {
  return fakeUpdateSubscription(id, input, { ifMatch, idempotencyKey });
}

// POST /webhooks/subscriptions/:id/reveal-secret body {secretReferenceId} -> 200 (no idempotency key)
export function revealSecret(id: string, secretReferenceId: string): Promise<RevealSecretResult> {
  return fakeRevealSecret(id, { secretReferenceId });
}

// POST /webhooks/subscriptions/:id/rotate-secret body {overlapHours} (X-Idempotency-Key, If-Match) -> 202
export function rotateSecret(
  id: string,
  overlapHours: number,
  ifMatch: number,
  idempotencyKey: string,
): Promise<SecretOperationAccepted> {
  return fakeRotateSecret(id, { overlapHours }, { ifMatch, idempotencyKey });
}

// POST /webhooks/subscriptions/:id/revoke-secret (X-Idempotency-Key, If-Match) -> 202
export function revokeSecret(
  id: string,
  ifMatch: number,
  idempotencyKey: string,
): Promise<SecretOperationAccepted> {
  return fakeRevokeSecret(id, { ifMatch, idempotencyKey });
}

// POST /webhooks/subscriptions/:id/test (X-Idempotency-Key) -> 202
export function sendTest(
  id: string,
  idempotencyKey: string,
): Promise<TestDeliveryAccepted> {
  return fakeSendTestDelivery(id, idempotencyKey);
}

// GET /webhooks/deliveries?page&limit&status&subscriptionId&eventType&createdFrom&createdTo
export function listDeliveries(
  q: ListDeliveriesQuery = {},
): Promise<Page<WebhookDelivery>> {
  return fakeListDeliveries(q);
}

// GET /webhooks/deliveries/:id
export function getDelivery(id: string): Promise<WebhookDeliveryDetail> {
  return fakeGetDelivery(id);
}

// POST /webhooks/deliveries/:id/retry body {reasonCode, reasonNote?} (X-Idempotency-Key, If-Match) -> 202
export function retryDelivery(
  id: string,
  input: RetryDeliveryInput,
  ifMatch: number,
  idempotencyKey: string,
): Promise<RetryDeliveryAccepted> {
  return fakeRetryDelivery(id, input, { ifMatch, idempotencyKey });
}
