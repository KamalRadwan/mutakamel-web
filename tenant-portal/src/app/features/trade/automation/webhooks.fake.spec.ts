import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError as CoreApiError } from '../../../core/api/api-errors';
import { CoreHttp } from '../../../core/api/core-http';
import { ApiError, TRADE_API_BASE, type TradeContext, newIdempotencyKey } from '../shared/trade-api';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { TradeHttp, bindTradeHttp, bindTradeHttpForTest, tradeQueries } from '../shared/trade-http';
import { ActionKeys } from './automation-shared/action-keys';
import {
  WEBHOOKS_QUERY_KEYS,
  createSubscription,
  getDelivery,
  getDeliveryCounts,
  getSubscription,
  listDeliveries,
  listEvents,
  listSubscriptions,
  retryDelivery,
  revealSecret,
  revokeSecret,
  rotateSecret,
  sendTest,
  updateSubscription,
} from './webhooks.api';
import {
  type CreateSubscriptionResult,
  type DeliveryStatus,
  type RetryDeliveryAccepted,
  type RevealSecretResult,
  type SecretOperationAccepted,
  type TestDeliveryAccepted,
  type UpdateSubscriptionResult,
  type WebhookDelivery,
  type WebhookDeliveryCounts,
  type WebhookDeliveryDetail,
  type WebhookEventCatalogue,
  type WebhookSubscription,
  type WebhookSubscriptionDetail,
  canRetryDelivery,
  endpointText,
} from './webhooks.model';
import { backoffText, endpointProblems } from './webhooks.registry';

const SUB_ID = '019a0000-0000-7000-8000-000000000101';
const SECRET_REF_ID = '019a0000-0000-7000-8000-000000000201';
const DELIVERY_ID = '019a0000-0000-7000-8000-000000000301';
const OP_ID = '019a0000-0000-7000-8000-000000000401';
const COMPANY_ID = '019a0000-0000-7000-8000-00000000c001';
const BRANCH_ID = '019a0000-0000-7000-8000-00000000b001';

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeSubscription(over: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    id: SUB_ID,
    code: 'ERP_SYNC',
    status: 'ACTIVE',
    version: 3,
    scopeTarget: 'COMPANY',
    companyId: COMPANY_ID,
    endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
    activeVersionNumber: 1,
    secret: {
      id: SECRET_REF_ID,
      status: 'ACTIVE',
      providerSecretVersion: '1',
      algorithmCode: 'HMAC_SHA256',
      signatureVersion: 1,
      activeFrom: '2026-11-20T00:00:00.000Z',
      overlapUntil: null,
      revokedAt: null,
    },
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...over,
  };
}

function makeSubscriptionDetail(over: Partial<WebhookSubscriptionDetail> = {}): WebhookSubscriptionDetail {
  return {
    id: SUB_ID,
    code: 'ERP_SYNC',
    status: 'ACTIVE',
    version: 3,
    currentVersion: {
      id: '019a0000-0000-7000-8000-000000000501',
      versionNumber: 1,
      scopeTarget: 'COMPANY',
      companyId: COMPANY_ID,
      endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
      retryPolicyCode: 'EXPONENTIAL_STANDARD',
      maxAttempts: 5,
      status: 'ACTIVE',
      branches: [BRANCH_ID],
      events: [{ eventType: 'trade.order.confirmed', eventVersion: 1, fields: ['id', 'status'] }],
    },
    secret: makeSubscription().secret,
    secretReveal: { available: false, availableUntil: null },
    secretOperation: null,
    ...over,
  };
}

function makeDelivery(over: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id: DELIVERY_ID,
    subscriptionId: SUB_ID,
    subscriptionCode: 'ERP_SYNC',
    status: 'EXHAUSTED',
    sourceEventType: 'trade.order.confirmed',
    sourceEventId: '019a0000-0000-7000-8000-000000000601',
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    payloadSchemaCode: 'trade.order.confirmed.v1',
    payloadHash: 'sha256:abc123',
    payloadSizeBytes: 512,
    attemptCount: 5,
    nextAttemptAt: null,
    terminalAt: '2026-11-23T01:00:00.000Z',
    version: 7,
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T01:00:00.000Z',
    endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
    ...over,
  };
}

function makeDeliveryDetail(over: Partial<WebhookDeliveryDetail> = {}): WebhookDeliveryDetail {
  return {
    ...makeDelivery(),
    attempts: [
      {
        attemptNumber: 1,
        startedAt: '2026-11-23T00:59:00.000Z',
        completedAt: '2026-11-23T00:59:05.000Z',
        durationMs: 5000,
        outcome: 'RETRYABLE_FAILURE',
        retryClass: 'TIMEOUT',
        httpStatus: 504,
        safeErrorCode: 'UPSTREAM_TIMEOUT',
      },
    ],
    ...over,
  };
}

function emptyCounts(): WebhookDeliveryCounts {
  return {
    total: 4,
    byStatus: {
      PENDING: 1,
      RETRY_PENDING: 1,
      DELIVERED: 1,
      FAILED: 0,
      EXHAUSTED: 1,
      DISABLED: 0,
    },
  };
}

describe('trade automation webhooks api (AU-WH)', () => {
  let stub: TradeHttpStub;
  let restoreHttp: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub({
      'GET /webhooks/events': {
        items: [{ eventType: 'trade.order.confirmed', eventVersion: 1, fields: ['id', 'status'] }],
      } satisfies WebhookEventCatalogue,
      'GET /webhooks/subscriptions': {
        items: [makeSubscription()],
        total: 1,
        page: 1,
        limit: 20,
      },
      'GET /webhooks/subscriptions/:id': makeSubscriptionDetail(),
      'POST /webhooks/subscriptions': {
        id: SUB_ID,
        code: 'ERP_SYNC',
        status: 'DRAFT',
        currentActiveVersionId: null,
        currentSecretReferenceId: SECRET_REF_ID,
        version: 1,
        createdBy: 'u1',
        updatedBy: 'u1',
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
        deletedAt: null,
        currentVersion: {
          id: 'v1',
          versionNumber: 1,
          scopeTarget: 'COMPANY',
          companyId: COMPANY_ID,
          endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
          retryPolicyCode: 'EXPONENTIAL_STANDARD',
          maxAttempts: 5,
          status: 'PENDING_SECRET',
          version: 1,
        },
        secretSetup: {
          status: 'PENDING',
          operationId: OP_ID,
          secretReferenceId: SECRET_REF_ID,
          plaintextReturned: false,
        },
      } satisfies CreateSubscriptionResult,
      'PATCH /webhooks/subscriptions/:id': {
        id: SUB_ID,
        code: 'ERP_SYNC',
        status: 'ACTIVE',
        currentActiveVersionId: 'v1',
        currentSecretReferenceId: SECRET_REF_ID,
        version: 4,
        createdBy: 'u1',
        updatedBy: 'u1',
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:05:00.000Z',
        deletedAt: null,
        currentVersion: {
          id: 'v1',
          versionNumber: 1,
          scopeTarget: 'COMPANY',
          companyId: COMPANY_ID,
          endpoint: { origin: 'https://erp.example.com', pathname: '/hooks/trade' },
          retryPolicyCode: 'EXPONENTIAL_STANDARD',
          maxAttempts: 6,
          status: 'ACTIVE',
          version: 2,
        },
      } satisfies UpdateSubscriptionResult,
      'POST /webhooks/subscriptions/:id/rotate-secret': {
        statusCode: 202,
        subscriptionId: SUB_ID,
        status: 'PENDING_PROVIDER_RECONCILIATION',
        operationId: OP_ID,
        secretReferenceId: '019a0000-0000-7000-8000-000000000202',
        plaintextReturned: false,
      } satisfies SecretOperationAccepted,
      'POST /webhooks/subscriptions/:id/revoke-secret': {
        statusCode: 202,
        subscriptionId: SUB_ID,
        status: 'PENDING_PROVIDER_RECONCILIATION',
        operationId: OP_ID,
        secretReferenceId: SECRET_REF_ID,
        plaintextReturned: false,
      } satisfies SecretOperationAccepted,
      'POST /webhooks/subscriptions/:id/test': {
        statusCode: 202,
        deliveryId: DELIVERY_ID,
        status: 'PENDING',
        synthetic: true,
      } satisfies TestDeliveryAccepted,
      'GET /webhooks/deliveries/counts': emptyCounts(),
      'GET /webhooks/deliveries': {
        items: [makeDelivery()],
        total: 1,
        page: 1,
        limit: 20,
      },
      'GET /webhooks/deliveries/:id': makeDeliveryDetail(),
      'POST /webhooks/deliveries/:id/retry': {
        statusCode: 202,
        deliveryId: DELIVERY_ID,
        status: 'RETRY_PENDING',
        nextAttemptAt: '2026-11-23T02:00:00.000Z',
      } satisfies RetryDeliveryAccepted,
    });
    restoreHttp = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    restoreHttp();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('calls read endpoints with exact paths, compacted query params, and OPTIONAL scope', async () => {
    const events = await listEvents({ companyId: COMPANY_ID });
    expect(events.items).toHaveLength(1);

    await listSubscriptions({ page: 2, limit: 24, status: 'ACTIVE' }, { companyId: COMPANY_ID, branchId: BRANCH_ID });
    await getSubscription(SUB_ID);
    const counts = await getDeliveryCounts(
      {
        status: ['FAILED', 'EXHAUSTED'],
        subscriptionId: SUB_ID,
        eventType: 'trade.order.confirmed',
        createdFrom: '2026-11-01T00:00:00.000Z',
        createdTo: '2026-11-23T23:59:59.999Z',
      },
      { companyId: COMPANY_ID },
    );
    expect(counts.total).toBe(4);

    const deliveries = await listDeliveries({
      page: 1,
      limit: 24,
      status: ['EXHAUSTED'],
      subscriptionId: SUB_ID,
    });
    expect(deliveries.items).toHaveLength(1);

    const detail = await getDelivery(DELIVERY_ID, { companyId: COMPANY_ID, branchId: BRANCH_ID });
    expect(detail.attempts).toHaveLength(1);

    const reads = stub.recordedReads();
    expect(reads[0]).toEqual({ path: '/webhooks/events', query: undefined, scope: { companyId: COMPANY_ID } });
    expect(reads[1]).toEqual({
      path: '/webhooks/subscriptions',
      query: { page: 2, limit: 24, status: 'ACTIVE' },
      scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
    });
    expect(reads[2]).toEqual({ path: `/webhooks/subscriptions/${SUB_ID}`, query: undefined, scope: {} });
    expect(reads[3]).toEqual({
      path: '/webhooks/deliveries/counts',
      query: {
        status: 'FAILED,EXHAUSTED',
        subscriptionId: SUB_ID,
        eventType: 'trade.order.confirmed',
        createdFrom: '2026-11-01T00:00:00.000Z',
        createdTo: '2026-11-23T23:59:59.999Z',
      },
      scope: { companyId: COMPANY_ID },
    });
    expect(reads[4]).toEqual({
      path: '/webhooks/deliveries',
      query: { page: 1, limit: 24, status: 'EXHAUSTED', subscriptionId: SUB_ID },
      scope: {},
    });
    expect(reads[5]).toEqual({
      path: `/webhooks/deliveries/${DELIVERY_ID}`,
      query: undefined,
      scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
    });
  });

  it('subscriptions CRUD: createSubscription whitelists DTO body and attaches UUIDv7 idempotency key', async () => {
    const dirtyInput = {
      code: 'ERP_SYNC',
      scopeTarget: 'COMPANY' as const,
      endpointUri: 'https://erp.example.com/hooks/trade',
      retryPolicyCode: 'EXPONENTIAL_STANDARD' as const,
      maxAttempts: 5,
      branchIds: [BRANCH_ID],
      events: [{ eventType: 'trade.order.confirmed', eventVersion: 1, fields: ['id'], extraEventProp: 'drop' }],
      unexpectedField: 'must-be-stripped',
    };

    const created = await createSubscription(dirtyInput as never, undefined, { companyId: COMPANY_ID });
    expect(created.id).toBe(SUB_ID);

    const write = stub.recordedWrites()[0];
    expect(write.method).toBe('POST');
    expect(write.path).toBe('/webhooks/subscriptions');
    expect(write.key).toMatch(UUID_V7_RE);
    expect(write.ifMatch).toBeUndefined();
    expect(write.scope).toEqual({ companyId: COMPANY_ID });
    expect(write.body).toEqual({
      code: 'ERP_SYNC',
      scopeTarget: 'COMPANY',
      endpointUri: 'https://erp.example.com/hooks/trade',
      retryPolicyCode: 'EXPONENTIAL_STANDARD',
      maxAttempts: 5,
      branchIds: [BRANCH_ID],
      events: [{ eventType: 'trade.order.confirmed', eventVersion: 1, fields: ['id'] }],
    });
  });

  it('subscriptions CRUD: updateSubscription sends If-Match, UUIDv7 key, and whitelisted patch fields', async () => {
    const key = newIdempotencyKey();
    const updated = await updateSubscription(
      SUB_ID,
      {
        endpointUri: 'https://erp.example.com/hooks/v2',
        maxAttempts: 6,
        status: 'ACTIVE',
        unexpectedExtra: 123,
      } as never,
      3,
      key,
      { companyId: COMPANY_ID },
    );
    expect(updated.version).toBe(4);

    const write = stub.recordedWrites()[0];
    expect(write.method).toBe('PATCH');
    expect(write.path).toBe(`/webhooks/subscriptions/${SUB_ID}`);
    expect(write.key).toBe(key);
    expect(write.ifMatch).toBe('"3"');
    expect(write.body).toEqual({
      endpointUri: 'https://erp.example.com/hooks/v2',
      maxAttempts: 6,
      status: 'ACTIVE',
    });
  });

  it('rotate / revoke / test / retry send required headers and expected 202 payloads', async () => {
    const rotateKey = newIdempotencyKey();
    const rotated = await rotateSecret(SUB_ID, 30, 3, rotateKey, { companyId: COMPANY_ID });
    expect(rotated.statusCode).toBe(202);
    expect(rotated.plaintextReturned).toBe(false);

    const revokeKey = newIdempotencyKey();
    const revoked = await revokeSecret(SUB_ID, 4, revokeKey);
    expect(revoked.statusCode).toBe(202);

    const testKey = newIdempotencyKey();
    const tested = await sendTest(SUB_ID, testKey, { companyId: COMPANY_ID });
    expect(tested.statusCode).toBe(202);
    expect(tested.synthetic).toBe(true);

    const retryKey = newIdempotencyKey();
    const retried = await retryDelivery(
      DELIVERY_ID,
      { reasonCode: 'UPSTREAM_RECOVERED', reasonNote: 'ERP back online', ignored: true } as never,
      7,
      retryKey,
      { companyId: COMPANY_ID, branchId: BRANCH_ID },
    );
    expect(retried.statusCode).toBe(202);
    expect(retried.status).toBe('RETRY_PENDING');

    const writes = stub.recordedWrites();
    expect(writes[0]).toMatchObject({
      method: 'POST',
      path: `/webhooks/subscriptions/${SUB_ID}/rotate-secret`,
      body: { overlapHours: 30 },
      key: rotateKey,
      ifMatch: '"3"',
      scope: { companyId: COMPANY_ID },
    });
    expect(writes[1]).toMatchObject({
      method: 'POST',
      path: `/webhooks/subscriptions/${SUB_ID}/revoke-secret`,
      body: undefined,
      key: revokeKey,
      ifMatch: '"4"',
      scope: {},
    });
    expect(writes[2]).toMatchObject({
      method: 'POST',
      path: `/webhooks/subscriptions/${SUB_ID}/test`,
      body: undefined,
      key: testKey,
      ifMatch: undefined,
      scope: { companyId: COMPANY_ID },
    });
    expect(writes[3]).toMatchObject({
      method: 'POST',
      path: `/webhooks/deliveries/${DELIVERY_ID}/retry`,
      body: { reasonCode: 'UPSTREAM_RECOVERED', reasonNote: 'ERP back online' },
      key: retryKey,
      ifMatch: '"7"',
      scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
    });
  });

  it('rejects missing/bad idempotency keys and missing/invalid If-Match before sending HTTP requests', async () => {
    await expect(
      createSubscription(
        {
          code: 'ERP_SYNC',
          scopeTarget: 'TENANT',
          endpointUri: 'https://erp.example.com/hooks',
          retryPolicyCode: 'EXPONENTIAL_STANDARD',
          maxAttempts: 5,
          events: [{ eventType: 'trade.order.confirmed', eventVersion: 1, fields: ['id'] }],
        },
        '',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

    await expect(
      sendTest(SUB_ID, 'not-a-uuid-v7'),
    ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

    await expect(
      updateSubscription(SUB_ID, { maxAttempts: 4 }, 0, newIdempotencyKey()),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

    await expect(
      rotateSecret(SUB_ID, 30, 1.5, newIdempotencyKey()),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

    expect(stub.recordedWrites()).toHaveLength(0);
  });

  describe('real TradeHttp / CoreHttp transport + reveal-secret wire contract', () => {
    let httpMock: HttpTestingController;
    let unbindReal: () => void;

    const context: TradeContext = { companyId: COMPANY_ID, branchId: BRANCH_ID };
    const input = {
      code: 'ERP_SYNC',
      scopeTarget: 'COMPANY' as const,
      endpointUri: 'https://erp.example.com/hooks/trade',
      retryPolicyCode: 'EXPONENTIAL_STANDARD' as const,
      maxAttempts: 5,
      events: [{ eventType: 'trading.sales_order.confirmed.v1', eventVersion: 1, fields: ['id'] }],
    };
    const filter = { status: ['EXHAUSTED' as const], subscriptionId: SUB_ID };
    const cases = [
      { name: 'getDeliveryCounts', method: 'GET', path: '/webhooks/deliveries/counts',
        query: { status: 'EXHAUSTED', subscriptionId: SUB_ID },
        invoke: () => getDeliveryCounts(filter, context) },
      { name: 'listEvents', method: 'GET', path: '/webhooks/events',
        invoke: () => listEvents(context) },
      { name: 'listSubscriptions', method: 'GET', path: '/webhooks/subscriptions',
        query: { page: '2', limit: '24', status: 'ACTIVE' },
        invoke: () => listSubscriptions({ page: 2, limit: 24, status: 'ACTIVE' }, context) },
      { name: 'getSubscription', method: 'GET', path: `/webhooks/subscriptions/${SUB_ID}`,
        invoke: () => getSubscription(SUB_ID, context) },
      { name: 'createSubscription', method: 'POST', path: '/webhooks/subscriptions',
        body: input, status: 201,
        invoke: () => createSubscription(input, undefined, context) },
      { name: 'updateSubscription', method: 'PATCH', path: `/webhooks/subscriptions/${SUB_ID}`,
        body: { status: 'DISABLED' }, version: 3,
        invoke: () => updateSubscription(SUB_ID, { status: 'DISABLED' }, 3, undefined, context) },
      { name: 'revealSecret', method: 'POST', path: `/webhooks/subscriptions/${SUB_ID}/reveal-secret`,
        body: { secretReferenceId: SECRET_REF_ID }, noKey: true,
        invoke: () => revealSecret(SUB_ID, SECRET_REF_ID, context) },
      { name: 'rotateSecret', method: 'POST', path: `/webhooks/subscriptions/${SUB_ID}/rotate-secret`,
        body: { overlapHours: 30 }, version: 3, status: 202,
        invoke: () => rotateSecret(SUB_ID, 30, 3, undefined, context) },
      { name: 'revokeSecret', method: 'POST', path: `/webhooks/subscriptions/${SUB_ID}/revoke-secret`,
        version: 3, status: 202,
        invoke: () => revokeSecret(SUB_ID, 3, undefined, context) },
      { name: 'sendTest', method: 'POST', path: `/webhooks/subscriptions/${SUB_ID}/test`, status: 202,
        invoke: () => sendTest(SUB_ID, undefined, context) },
      { name: 'listDeliveries', method: 'GET', path: '/webhooks/deliveries',
        query: { page: '2', limit: '24', status: 'EXHAUSTED', subscriptionId: SUB_ID },
        invoke: () => listDeliveries({ ...filter, page: 2, limit: 24 }, context) },
      { name: 'getDelivery', method: 'GET', path: `/webhooks/deliveries/${DELIVERY_ID}`,
        invoke: () => getDelivery(DELIVERY_ID, context) },
      { name: 'retryDelivery', method: 'POST', path: `/webhooks/deliveries/${DELIVERY_ID}/retry`,
        body: { reasonCode: 'UPSTREAM_RECOVERED', reasonNote: 'ERP back online' }, version: 7, status: 202,
        invoke: () => retryDelivery(DELIVERY_ID,
          { reasonCode: 'UPSTREAM_RECOVERED', reasonNote: 'ERP back online' }, 7, undefined, context) },
    ];

    beforeEach(() => {
      tradeQueries().getQueryCache().clear();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), TradeHttp],
      });
      const doc = TestBed.inject(DOCUMENT);
      vi.spyOn(doc, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof');

      httpMock = TestBed.inject(HttpTestingController);
      const realTradeHttp = TestBed.inject(TradeHttp);
      const realCoreHttp = TestBed.inject(CoreHttp);
      bindTradeHttp(realTradeHttp, tradeQueries(), realCoreHttp);
      unbindReal = () => restoreHttp();
    });

    afterEach(() => {
      httpMock.verify();
      unbindReal();
    });

    it.each(cases)('$name: exact wire request, envelope unwrap, and field error mapping', async (testCase) => {
      // Reveal has no key; the current shared stub, like TradeHttp.write, requires one.
      if (!testCase.noKey) {
        const restoreStub = bindTradeHttpForTest(stub);
        try {
          const payload = { id: 'stub-response' };
          stub.register(testCase.method as Parameters<TradeHttpStub['register']>[0], testCase.path, payload);
          expect(await testCase.invoke()).toEqual(payload);
          const recorded = testCase.method === 'GET' ? stub.recordedReads().at(-1) : stub.recordedWrites().at(-1);
          expect(recorded).toMatchObject({ path: testCase.path, scope: context });
        } finally {
          restoreStub();
        }
      }
      const promise = testCase.invoke();
      const request = httpMock.expectOne((req) => req.url === `${TRADE_API_BASE}${testCase.path}`);
      expect(request.request.method).toBe(testCase.method);
      expect(Object.fromEntries(request.request.params.keys().map((key) =>
        [key, request.request.params.get(key)]))).toEqual(testCase.query ?? {});
      expect(request.request.body ?? undefined).toEqual(testCase.body);
      expect(request.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
      expect(request.request.headers.get('x-mutakamel-branch-id')).toBe(BRANCH_ID);
      const key = request.request.headers.get('x-idempotency-key');
      if (testCase.method === 'GET' || testCase.noKey) expect(key).toBeNull();
      else expect(key).toMatch(UUID_V7_RE);
      expect(request.request.headers.get('If-Match')).toBe(
        testCase.version === undefined ? null : `"${testCase.version}"`,
      );
      const payload = { id: 'unwrapped-response' };
      request.flush({ success: true, data: payload, correlationId: 'corr-ok', timestamp: '2026-11-23T00:00:00Z' },
        { status: testCase.status ?? 200, statusText: 'OK' });
      expect(await promise).toEqual(payload);

      const rejected = testCase.invoke();
      const assertion = expect(rejected).rejects.toMatchObject({
        status: 400, code: 'TRADE.VALIDATION_FAILED',
        details: { endpointUri: ['INVALID_URL'] }, correlationId: 'corr-fields',
      });
      const invalidRequest = httpMock.expectOne((req) => req.url === `${TRADE_API_BASE}${testCase.path}`);
      invalidRequest.flush({ errorCode: 'TRADE.VALIDATION_FAILED',
        details: { endpointUri: ['INVALID_URL'] }, correlationId: 'corr-fields' },
        { status: 400, statusText: 'Bad Request' });
      await assertion;
    });

    it('reveal-secret posts via CoreHttp with NO x-idempotency-key, never caches, and never logs the secret', async () => {
      const secretText = 'whsec_test_plaintext_secret_do_not_log';
      const consoleSpies = [
        vi.spyOn(console, 'log').mockImplementation(() => {}),
        vi.spyOn(console, 'info').mockImplementation(() => {}),
        vi.spyOn(console, 'warn').mockImplementation(() => {}),
        vi.spyOn(console, 'error').mockImplementation(() => {}),
        vi.spyOn(console, 'debug').mockImplementation(() => {}),
      ];

      const promise = revealSecret(SUB_ID, SECRET_REF_ID, { companyId: COMPANY_ID });
      const req = httpMock.expectOne(`${TRADE_API_BASE}/webhooks/subscriptions/${SUB_ID}/reveal-secret`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ secretReferenceId: SECRET_REF_ID });
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
      expect(req.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
      expect(req.request.headers.has('x-mutakamel-branch-id')).toBe(false);

      req.flush({
        success: true,
        data: {
          secretReferenceId: SECRET_REF_ID,
          secret: secretText,
          secretEncoding: 'base64',
          algorithmCode: 'HMAC_SHA256',
        } satisfies RevealSecretResult,
      });

      const revealed = await promise;
      expect(revealed.secret).toBe(secretText);
      expect(tradeQueries().getQueryCache().getAll()).toHaveLength(0);
      for (const spy of consoleSpies) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(secretText);
      }
    });

    it('reveal-secret maps 409 already_revealed / CoreApiError to Trade ApiError cleanly', async () => {
      const promise = revealSecret(SUB_ID, SECRET_REF_ID);
      const req = httpMock.expectOne(`${TRADE_API_BASE}/webhooks/subscriptions/${SUB_ID}/reveal-secret`);
      expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      expect(req.request.headers.has('x-mutakamel-company-id')).toBe(false);

      req.flush(
        {
          success: false,
          errorCode: 'TRADE.WEBHOOK.SECRET_VERSION_INVALID',
          details: { reason: ['already_revealed'] },
          correlationId: 'corr-secret-409',
        },
        { status: 409, statusText: 'Conflict' },
      );

      let caught: unknown;
      try {
        await promise;
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect(caught).toMatchObject({
        status: 409,
        code: 'TRADE.WEBHOOK.SECRET_VERSION_INVALID',
        correlationId: 'corr-secret-409',
        details: { reason: ['already_revealed'] },
      });
    });

    it('unwraps Trade envelope, sends OPTIONAL scope headers, and fails with 502 on bare non-envelope responses', async () => {
      const countsPromise = getDeliveryCounts({}, { companyId: COMPANY_ID, branchId: BRANCH_ID });
      const countsReq = httpMock.expectOne(`${TRADE_API_BASE}/webhooks/deliveries/counts`);
      expect(countsReq.request.headers.get('x-mutakamel-company-id')).toBe(COMPANY_ID);
      expect(countsReq.request.headers.get('x-mutakamel-branch-id')).toBe(BRANCH_ID);
      countsReq.flush({ success: true, data: emptyCounts() });
      expect((await countsPromise).total).toBe(4);

      const badPromise = listEvents();
      const badReq = httpMock.expectOne(`${TRADE_API_BASE}/webhooks/events`);
      expect(badReq.request.headers.has('x-mutakamel-company-id')).toBe(false);
      badReq.flush({ items: [] });

      let caught: unknown;
      try {
        await badPromise;
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(502);
      expect(CoreApiError).toBeDefined();
    });
  });

  it('ActionKeys reuses key for identical body/If-Match and regenerates on change or done()', () => {
    const keys = new ActionKeys();
    const k1 = keys.for('toggle', { id: SUB_ID, status: 'DISABLED', version: 3 });
    const k2 = keys.for('toggle', { version: 3, status: 'DISABLED', id: SUB_ID });
    expect(k2).toBe(k1);

    const k3 = keys.for('toggle', { id: SUB_ID, status: 'DISABLED', version: 4 });
    expect(k3).not.toBe(k1);

    keys.done('toggle');
    const k4 = keys.for('toggle', { id: SUB_ID, status: 'DISABLED', version: 4 });
    expect(k4).not.toBe(k3);
  });

  it('pure webhook helpers validate endpoint URLs, retry eligibility, and localized backoff labels', () => {
    expect(endpointText({ origin: 'https://erp.example.com', pathname: '/' })).toBe('https://erp.example.com');
    expect(endpointText({ origin: 'https://erp.example.com', pathname: '/hooks' })).toBe(
      'https://erp.example.com/hooks',
    );

    expect(endpointProblems('https://erp.example.com/hooks?token=secret')).toContain('SECRET_QUERY_FORBIDDEN');
    expect(endpointProblems('http://localhost:8080/hook#frag')).toEqual(
      expect.arrayContaining(['HTTPS_REQUIRED', 'FRAGMENT_FORBIDDEN', 'LOCALHOST_FORBIDDEN', 'PORT_FORBIDDEN']),
    );
    expect(endpointProblems('https://erp.example.com:8443/hooks')).toEqual([]);

    const exhaustedRetryable = makeDeliveryDetail();
    expect(canRetryDelivery(exhaustedRetryable, 'ACTIVE')).toBe(true);
    expect(canRetryDelivery(exhaustedRetryable, 'DISABLED')).toBe(false);
    expect(
      canRetryDelivery(
        makeDeliveryDetail({
          attempts: [
            {
              attemptNumber: 1,
              startedAt: '2026-11-23T00:00:00.000Z',
              completedAt: '2026-11-23T00:00:01.000Z',
              durationMs: 1000,
              outcome: 'PERMANENT_FAILURE',
              retryClass: 'CLIENT_ERROR',
              httpStatus: 400,
              safeErrorCode: 'BAD_REQUEST',
            },
          ],
        }),
        'ACTIVE',
      ),
    ).toBe(false);

    expect(backoffText('EXPONENTIAL_STANDARD', 1, 'en')).toBe('30s');
    expect(backoffText('EXPONENTIAL_STANDARD', 1, 'ar')).toBe('30 ثانية');
    expect(WEBHOOKS_QUERY_KEYS.subscription(SUB_ID)).toEqual(['trade', 'automation', 'webhooks', 'subscription', SUB_ID]);
  });
});
