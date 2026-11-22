import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { FAKE_ME, setFakeActor } from './automation-fake-actors';
import { ActionKeys } from './automation-shared/action-keys';
import * as api from './webhooks.api';
import {
  getDelivery,
  getDeliveryCounts,
  getSubscription,
  listDeliveries,
  listEvents,
  listSubscriptions,
  revealSecret,
} from './webhooks.api';
import {
  fakeCreateSubscription,
  fakeRevealSecret,
  fakeUpdateSubscription,
  setFakeWebhookContext,
} from './webhooks.fake';
import {
  type CreateSubscriptionInput,
  type RetryDeliveryInput,
  type UpdateSubscriptionInput,
  type WebhookSubscriptionDetail,
  canRetryDelivery,
  endpointText,
} from './webhooks.model';

// Each test call is a new user action, so it gets its own idempotency key.
const createSubscription = (input: CreateSubscriptionInput) => api.createSubscription(input, newIdempotencyKey());
const updateSubscription = (id: string, input: UpdateSubscriptionInput, ifMatch: number) =>
  api.updateSubscription(id, input, ifMatch, newIdempotencyKey());
const rotateSecret = (id: string, hours: number, ifMatch: number) =>
  api.rotateSecret(id, hours, ifMatch, newIdempotencyKey());
const revokeSecret = (id: string, ifMatch: number) => api.revokeSecret(id, ifMatch, newIdempotencyKey());
const sendTest = (id: string) => api.sendTest(id, newIdempotencyKey());
const retryDelivery = (id: string, input: RetryDeliveryInput, ifMatch: number) =>
  api.retryDelivery(id, input, ifMatch, newIdempotencyKey());

/** Runs the fake timers (request delay and fake worker) to completion and returns or rethrows the result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

/** Advances only past the request delay, so the fake worker has not answered yet. */
async function settleRequest<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(400);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const NOW = '2026-11-21T12:00:00.000Z';
const ITEM_EVENT = 'trading.catalog.item_changed.v1';
const ERP = '0193a100-0000-7000-8001-000000000001';
const delivery = (n: number) => `0193a100-0000-7000-8005-${String(n).padStart(12, '0')}`;
let seq = 0;

function input(extra: Partial<CreateSubscriptionInput> = {}): CreateSubscriptionInput {
  seq += 1;
  return {
    code: `SPEC_HOOK_${seq}`,
    scopeTarget: 'COMPANY',
    endpointUri: `https://hooks.example.com/spec/${seq}?tenant=acme`,
    retryPolicyCode: 'EXPONENTIAL_STANDARD',
    maxAttempts: 6,
    events: [{ eventType: ITEM_EVENT, eventVersion: 1, fields: ['status', 'aggregateId'] }],
    ...extra,
  };
}

/** Creates a subscription and lets the fake worker finish the CREATE secret operation. */
async function activeSubscription(extra: Partial<CreateSubscriptionInput> = {}): Promise<WebhookSubscriptionDetail> {
  const created = await settle(createSubscription(input(extra)));
  return settle(getSubscription(created.id));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
  setFakeWebhookContext({ target: 'COMPANY', companyId: 'c1', branchId: null });
});

afterEach(() => {
  setFakeWebhookContext({ target: 'COMPANY', companyId: 'c1', branchId: null });
  vi.useRealTimers();
});

describe('GET /webhooks/events', () => {
  it('answers {items} with the backend event types and fields', async () => {
    const catalogue = await settle(listEvents());

    expect(catalogue.items.map((e) => e.eventType)).toEqual([
      'trading.catalog.item_changed.v1',
      'trading.commercial_account.changed.v1',
      'trading.quotation.sent.v1',
      'trading.quotation.accepted.v1',
      'trading.sales_order.confirmed.v1',
      'trading.purchase_order.confirmed.v1',
      'inventory.receipt.completed.v1',
      'inventory.delivery.completed.v1',
    ]);
    expect(catalogue.items[0]).toEqual({
      eventType: ITEM_EVENT,
      eventVersion: 1,
      fields: ['aggregateId', 'aggregateVersion', 'companyId', 'itemKind', 'canonicalCode', 'status', 'changedFields', 'businessEffectiveAt'],
    });
  });
});

describe('subscription list and detail', () => {
  it('lists summaries with the endpoint as origin and path only', async () => {
    const page = await settle(listSubscriptions());
    const erp = page.items.find((s) => s.id === ERP)!;

    expect(page.limit).toBe(50);
    expect(Object.keys(erp).sort()).toEqual(
      ['activeVersionNumber', 'code', 'companyId', 'endpoint', 'id', 'scopeTarget', 'secret', 'status', 'updatedAt', 'version'].sort(),
    );
    expect(erp.endpoint).toEqual({ origin: 'https://erp.example.com', pathname: '/hooks/trade' });
    expect(erp.activeVersionNumber).toBe(3);
  });

  it('never returns the query string of the stored endpoint', async () => {
    const detail = await activeSubscription();

    expect(endpointText(detail.currentVersion.endpoint)).toBe(`https://hooks.example.com/spec/${seq}`);
    expect(JSON.stringify(detail)).not.toContain('tenant=acme');
  });

  it('rejects a non-UUIDv7 id with 400 and an unknown one with SUBSCRIPTION_NOT_FOUND', async () => {
    expect((await rejection(getSubscription('whsub-erp-sync'))).code).toBe('TRADE.VALIDATION_FAILED');
    const missing = await rejection(getSubscription('0193a100-0000-7000-8001-999999999999'));
    expect(missing.status).toBe(404);
    expect(missing.code).toBe('TRADE.WEBHOOK.SUBSCRIPTION_NOT_FOUND');
  });

  it('hides company subscriptions from the tenant context', async () => {
    setFakeWebhookContext({ target: 'TENANT', companyId: null, branchId: null });

    const page = await settle(listSubscriptions());

    expect(page.items.some((s) => s.id === ERP)).toBe(false);
  });
});

describe('POST /webhooks/subscriptions', () => {
  it('answers the entity, a version summary and a pending secret setup without any secret', async () => {
    const created = await settleRequest(createSubscription(input()));

    expect(created.status).toBe('DRAFT');
    expect(created.currentSecretReferenceId).toBeNull();
    expect(created.currentVersion).toMatchObject({ versionNumber: 1, status: 'PENDING_SECRET', scopeTarget: 'COMPANY' });
    expect(created.secretSetup).toMatchObject({ status: 'PENDING', plaintextReturned: false });

    const detail = await settleRequest(getSubscription(created.id));
    expect(detail.secret).toBeNull();
    expect(detail.secretOperation).toMatchObject({ type: 'CREATE', status: 'PENDING' });
    expect(detail.currentVersion.events[0].fields).toEqual(['aggregateId', 'status']);
  });

  it('activates the subscription once the worker applies the secret', async () => {
    const detail = await activeSubscription();

    expect(detail.status).toBe('ACTIVE');
    expect(detail.currentVersion.status).toBe('ACTIVE');
    expect(detail.secret?.status).toBe('ACTIVE');
    expect(detail.secretReveal.available).toBe(true);
  });

  it('rejects unknown body fields (whitelist) and a missing idempotency key with 400', async () => {
    const legacy = { ...input(), endpointUrl: 'https://x.example.com' } as CreateSubscriptionInput;
    expect((await rejection(createSubscription(legacy))).code).toBe('TRADE.VALIDATION_FAILED');
    expect((await rejection(fakeCreateSubscription(input()))).code).toBe('TRADE.IDEMPOTENCY.KEY_MISSING');
  });

  it('rejects the old retry policy codes with 400', async () => {
    const error = await rejection(
      createSubscription({ ...input(), retryPolicyCode: 'STANDARD' as unknown as CreateSubscriptionInput['retryPolicyCode'] }),
    );
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects a duplicate code with 409 SUBSCRIPTION_CODE_CONFLICT', async () => {
    const error = await rejection(createSubscription(input({ code: 'ERP_SYNC' })));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.WEBHOOK.SUBSCRIPTION_CODE_CONFLICT');
  });

  it.each([
    'http://hooks.example.com/x',
    'https://localhost/x',
    'https://10.1.2.3/x',
    'https://hooks.example.com:8080/x',
    'https://hooks.example.com/x?token=abc',
  ])('rejects the endpoint %s with 422 ENDPOINT_FORBIDDEN and no details', async (endpointUri) => {
    const error = await rejection(createSubscription(input({ endpointUri })));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.WEBHOOK.ENDPOINT_FORBIDDEN');
    expect(error.details).toBeUndefined();
  });

  it('rejects a field outside the event projection with 422 PAYLOAD_INVALID', async () => {
    const error = await rejection(
      createSubscription(input({ events: [{ eventType: ITEM_EVENT, eventVersion: 1, fields: ['itemId'] }] })),
    );
    expect(error.code).toBe('TRADE.WEBHOOK.PAYLOAD_INVALID');
  });

  it('applies the scope rules: TENANT from a company 422, COMPANY from the tenant 403', async () => {
    expect((await rejection(createSubscription(input({ scopeTarget: 'TENANT' })))).code).toBe(
      'TRADE.WEBHOOK.PAYLOAD_INVALID',
    );
    setFakeWebhookContext({ target: 'TENANT', companyId: null, branchId: null });
    const denied = await rejection(createSubscription(input()));
    expect(denied.status).toBe(403);
    expect(denied.code).toBe('TRADE.AUTH.TARGET_DENIED');
  });

  it('rejects branches on a tenant subscription and unknown branches with 422', async () => {
    setFakeWebhookContext({ target: 'TENANT', companyId: null, branchId: null });
    expect((await rejection(createSubscription(input({ scopeTarget: 'TENANT', branchIds: ['b1'] })))).code).toBe(
      'TRADE.WEBHOOK.PAYLOAD_INVALID',
    );
    setFakeWebhookContext({ target: 'COMPANY', companyId: 'c1', branchId: null });
    expect((await rejection(createSubscription(input({ branchIds: ['b4'] })))).code).toBe(
      'TRADE.WEBHOOK.PAYLOAD_INVALID',
    );
  });
});

describe('POST /webhooks/subscriptions/:id/reveal-secret', () => {
  it('returns the plaintext once, only in the reveal answer', async () => {
    const detail = await activeSubscription();
    const secretId = detail.secret!.id;

    const revealed = await settle(revealSecret(detail.id, secretId));

    expect(Object.keys(revealed).sort()).toEqual(['algorithmCode', 'secret', 'secretEncoding', 'secretReferenceId']);
    expect(revealed).toMatchObject({ secretReferenceId: secretId, secretEncoding: 'base64', algorithmCode: 'HMAC_SHA256' });
    expect(revealed.secret).toMatch(/^[A-Za-z0-9+/]{43}=$/);

    const after = await settle(getSubscription(detail.id));
    expect(JSON.stringify(after)).not.toContain(revealed.secret);
    expect(after.secretReveal).toEqual({ available: false, availableUntil: null });

    const again = await rejection(revealSecret(detail.id, secretId));
    expect(again.status).toBe(409);
    expect(again.details).toEqual({ reason: ['already_revealed'] });
  });

  it('answers reveal_expired after the 15-minute window', async () => {
    const detail = await activeSubscription();
    vi.setSystemTime(new Date(Date.now() + 16 * 60_000));

    const error = await rejection(revealSecret(detail.id, detail.secret!.id));

    expect(error.details).toEqual({ reason: ['reveal_expired'] });
  });

  it('answers not_current_reference for another secret id and 400 for a bad body', async () => {
    const detail = await activeSubscription();
    const error = await rejection(revealSecret(detail.id, '0193a100-0000-7000-8003-999999999999'));
    expect(error.details).toEqual({ reason: ['not_current_reference'] });

    const bad = await rejection(fakeRevealSecret(detail.id, { secretReferenceId: 'nope' }));
    expect(bad.code).toBe('TRADE.VALIDATION_FAILED');
  });
});

describe('rotate-secret and revoke-secret', () => {
  it('accepts a rotation (202), blocks writes while pending, then keeps the prior secret in overlap', async () => {
    const detail = await activeSubscription();
    const prior = detail.secret!.id;

    const accepted = await settleRequest(rotateSecret(detail.id, 48, detail.version));
    expect(accepted).toMatchObject({
      statusCode: 202,
      subscriptionId: detail.id,
      status: 'PENDING_PROVIDER_RECONCILIATION',
      plaintextReturned: false,
    });

    const pending = await settleRequest(getSubscription(detail.id));
    expect(pending.secretOperation).toMatchObject({ type: 'ROTATE', status: 'PENDING' });
    const blocked = await rejection(updateSubscription(detail.id, { maxAttempts: 3 }, pending.version));
    expect(blocked.details).toEqual({ reason: ['operation_pending'] });

    const done = await settle(getSubscription(detail.id));
    expect(done.secret?.id).toBe(accepted.secretReferenceId);
    expect(done.secret?.id).not.toBe(prior);
    expect(done.secret?.status).toBe('ACTIVE');
  });

  it('rejects an overlap outside 30..168 hours with 400 and a pending create with operation_pending', async () => {
    const detail = await activeSubscription();
    expect((await rejection(rotateSecret(detail.id, 20, detail.version))).code).toBe('TRADE.VALIDATION_FAILED');

    const draft = await settleRequest(createSubscription(input()));
    const error = await rejection(rotateSecret(draft.id, 30, draft.version));
    expect(error.details).toEqual({ reason: ['operation_pending'] });
  });

  it('revokes the current secret: the subscription returns to DRAFT and tests are refused', async () => {
    const detail = await activeSubscription();

    const accepted = await settle(revokeSecret(detail.id, detail.version));
    expect(accepted.secretReferenceId).toBe(detail.secret!.id);

    const after = await settle(getSubscription(detail.id));
    expect(after.status).toBe('DRAFT');
    expect(after.secret).toBeNull();
    expect(after.currentVersion.status).toBe('PENDING_SECRET');

    const test = await rejection(sendTest(detail.id));
    expect(test.details).toEqual({ reason: ['not_active'] });
  });
});

describe('PATCH /webhooks/subscriptions/:id', () => {
  it('disables with a status-only body and answers the entity and the version summary', async () => {
    const detail = await activeSubscription();

    const result = await settle(updateSubscription(detail.id, { status: 'DISABLED' }, detail.version));

    expect(result.status).toBe('DISABLED');
    expect(result.currentActiveVersionId).toBeNull();
    expect(result.currentVersion).toMatchObject({ versionNumber: 1, status: 'DISABLED' });
  });

  it('creates a new version for a configuration change and supersedes the active one', async () => {
    const detail = await activeSubscription();

    const result = await settle(
      updateSubscription(detail.id, { retryPolicyCode: 'EXPONENTIAL_CONSERVATIVE' }, detail.version),
    );

    expect(result.currentVersion).toMatchObject({
      versionNumber: 2,
      status: 'ACTIVE',
      retryPolicyCode: 'EXPONENTIAL_CONSERVATIVE',
    });
    expect(result.status).toBe('ACTIVE');
  });

  it('answers 422 for an empty body, 409 for a stale version, 400 without If-Match, 403 at branch level', async () => {
    const detail = await activeSubscription();
    expect((await rejection(updateSubscription(detail.id, {}, detail.version))).code).toBe(
      'TRADE.WEBHOOK.PAYLOAD_INVALID',
    );
    expect((await rejection(updateSubscription(detail.id, { maxAttempts: 2 }, detail.version + 7))).code).toBe(
      'TRADE.CONCURRENCY.STALE_VERSION',
    );
    expect(
      (await rejection(fakeUpdateSubscription(detail.id, { maxAttempts: 2 }, { idempotencyKey: 'k' }))).code,
    ).toBe('TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
    setFakeWebhookContext({ target: 'BRANCH', companyId: 'c1', branchId: 'b1' });
    expect((await rejection(updateSubscription(detail.id, { maxAttempts: 2 }, detail.version))).status).toBe(403);
  });

  it('refuses to enable a subscription without an active secret', async () => {
    const detail = await activeSubscription();
    await settle(revokeSecret(detail.id, detail.version));
    const revoked = await settle(getSubscription(detail.id));

    const error = await rejection(updateSubscription(detail.id, { status: 'ACTIVE' }, revoked.version));

    expect(error.code).toBe('TRADE.WEBHOOK.SECRET_VERSION_INVALID');
    expect(error.details).toEqual({ reason: ['not_active'] });
  });
});

describe('POST /webhooks/subscriptions/:id/test', () => {
  it('queues a synthetic delivery (202) that the worker delivers', async () => {
    const detail = await activeSubscription();

    const accepted = await settleRequest(sendTest(detail.id));
    expect(accepted).toMatchObject({ statusCode: 202, status: 'PENDING', synthetic: true });

    await vi.runAllTimersAsync(); // let the fake worker attempt the delivery
    const delivered = await settle(getDelivery(accepted.deliveryId));
    expect(delivered.sourceEventType).toBe('trading.webhook.synthetic_test.v1');
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.attempts).toHaveLength(1);
    expect(delivered.attempts[0]).toMatchObject({ attemptNumber: 1, outcome: 'DELIVERED', httpStatus: 200 });
  });
});

describe('deliveries', () => {
  it('lists the backend projection and filters by a status list', async () => {
    const page = await settle(listDeliveries({ status: ['EXHAUSTED', 'DISABLED'] }));

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((d) => d.status === 'EXHAUSTED' || d.status === 'DISABLED')).toBe(true);
    expect(Object.keys(page.items[0]).sort()).toEqual(
      [
        'attemptCount', 'branchId', 'companyId', 'createdAt', 'endpoint', 'id', 'nextAttemptAt', 'payloadHash',
        'payloadSchemaCode', 'payloadSizeBytes', 'sourceEventId', 'sourceEventType', 'status', 'subscriptionCode',
        'subscriptionId', 'terminalAt', 'updatedAt', 'version',
      ].sort(),
    );
  });

  it('filters by created range and rejects an unknown status with 400', async () => {
    const page = await settle(
      listDeliveries({ createdFrom: '2026-11-21T10:00:00.000Z', createdTo: '2026-11-21T10:35:00.000Z' }),
    );
    expect(page.items.every((d) => d.createdAt >= '2026-11-21T10:00:00.000Z' && d.createdAt <= '2026-11-21T10:35:00.000Z')).toBe(true);

    const error = await rejection(listDeliveries({ status: ['GAVE_UP' as never] }));
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('counts {total, byStatus} with all six statuses', async () => {
    const counts = await settle(getDeliveryCounts());

    expect(Object.keys(counts.byStatus).sort()).toEqual(
      ['DELIVERED', 'DISABLED', 'EXHAUSTED', 'FAILED', 'PENDING', 'RETRY_PENDING'],
    );
    expect(Object.values(counts.byStatus).reduce((a, b) => a + b, 0)).toBe(counts.total);
  });

  it('answers DELIVERY_NOT_FOUND for an unknown delivery', async () => {
    const error = await rejection(getDelivery('0193a100-0000-7000-8005-999999999999'));
    expect(error.code).toBe('TRADE.WEBHOOK.DELIVERY_NOT_FOUND');
  });
});

describe('POST /webhooks/deliveries/:id/retry', () => {
  it('validates the reason code shape (400) and the reason catalogue (422)', async () => {
    const target = await settle(getDelivery(delivery(7)));
    expect((await rejection(retryDelivery(target.id, { reasonCode: '' }, target.version))).code).toBe(
      'TRADE.VALIDATION_FAILED',
    );
    expect((await rejection(retryDelivery(target.id, { reasonCode: 'NOT_A_REASON' }, target.version))).code).toBe(
      'TRADE.REASON.NOT_FOUND',
    );
    expect(
      (await rejection(retryDelivery(target.id, { reasonCode: 'OPERATOR_RETRY', reasonNote: 'x'.repeat(501) }, target.version)))
        .code,
    ).toBe('TRADE.VALIDATION_FAILED');
  });

  it.each([
    [7, 'not_exhausted'],
    [8, 'subscription_not_active'],
  ])('refuses delivery %i with reason %s', async (n, reason) => {
    const target = await settle(getDelivery(delivery(n)));

    const error = await rejection(retryDelivery(target.id, { reasonCode: 'OPERATOR_RETRY' }, target.version));

    expect(error.code).toBe('TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE');
    expect(error.details).toEqual({ reason: [reason] });
  });

  it('accepts an exhausted, retryable delivery (202) and the worker delivers it', async () => {
    const target = await settle(getDelivery(delivery(6)));
    expect(canRetryDelivery(target, 'ACTIVE')).toBe(true);

    const accepted = await settleRequest(
      retryDelivery(target.id, { reasonCode: 'OPERATOR_RETRY', reasonNote: 'endpoint is back' }, target.version),
    );
    expect(accepted).toMatchObject({ statusCode: 202, deliveryId: target.id, status: 'RETRY_PENDING' });

    await vi.runAllTimersAsync(); // let the fake worker attempt the delivery
    const after = await settle(getDelivery(target.id));
    expect(after.status).toBe('DELIVERED');
    expect(after.attempts.at(-1)?.outcome).toBe('DELIVERED');
  });

  it('derives canRetry client-side: never for a permanent failure', async () => {
    const failed = await settle(getDelivery(delivery(7)));
    expect(canRetryDelivery(failed, 'ACTIVE')).toBe(false);
  });
});

describe('ActionKeys', () => {
  it('reuses one key while the same action is retried and issues a new one after success or a changed request', () => {
    const keys = new ActionKeys();
    const first = keys.for('create', { code: 'A' });
    expect(keys.for('create', { code: 'A' })).toBe(first);
    expect(keys.for('create', { code: 'B' })).not.toBe(first);
    const second = keys.for('create', { code: 'B' });
    keys.done('create');
    expect(keys.for('create', { code: 'B' })).not.toBe(second);
  });
});
