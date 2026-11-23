import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { auditExportErrorKey, AuditLogApi } from './audit-log.api';
import { setFakeActor } from '../../staff/shared/staff.fake';
import {
  fakeListAuditEvents as listAuditEvents,
  fakeListDeletedRecords as listDeletedRecords,
  fakeListEntityAuditEvents as listEntityAuditEvents,
  fakeListRecordHistory as listRecordHistory,
  fakeListRelatedEntityHistory as listRelatedEntityHistory,
} from './audit-log.fake';
import type { AuditEvent } from './audit-log.model';
import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB } from '../../../crm/customers/customers.fake';
import { fakeAllOpportunityRows } from '../../../crm/opportunities/opportunities.fake';
import { opportunityRef } from '../../../crm/opportunities/opportunities.model';
import { resetAuditFake } from './audit-log.fake';

const UUID_V7 = '019a7c20-0002-7000-8000-000000000002';
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function csrfCookieName(): string {
  return document.location?.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
}

function setCsrfCookie(value = 'csrf-test-token'): void {
  document.cookie = `${csrfCookieName()}=${value}; path=/`;
}

function clearCsrfCookie(): void {
  document.cookie = `${csrfCookieName()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

async function rejectsWith(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ status, code });
}

async function firstLeadEvent(): Promise<AuditEvent> {
  const page = await listAuditEvents({ entityType: 'Lead', limit: 100 });
  const event = page.items.find((item) => item.entityId !== null);
  if (!event) throw new Error('seed has no lead events');
  return event;
}

describe('audit-log fake follows TenantAuditController', () => {
  beforeEach(() => {
    resetAuditFake();
    setFakeActor('owner');
  });

  afterAll(() => setFakeActor('owner'));

  describe('GET tenant/audit deletedOnly and q', () => {
    it('deletedOnly=true returns only DELETE and SOFT_DELETE events', async () => {
      const page = await listAuditEvents({ deletedOnly: true, limit: 100 });
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((item) => item.action === 'DELETE' || item.action === 'SOFT_DELETE')).toBe(true);
      expect(Object.keys(page).sort()).toEqual(['items', 'nextCursor']);
    });

    it('matches GET tenant/audit/deleted', async () => {
      const viaFlag = await listAuditEvents({ deletedOnly: true, limit: 100 });
      const viaRoute = await listDeletedRecords({ limit: 100 });
      expect(viaFlag.items.map((item) => item.id)).toEqual(viaRoute.items.map((item) => item.id));
    });

    it('rejects q, even empty, without deletedOnly (400 AUDIT_QUERY_INVALID)', async () => {
      await rejectsWith(listAuditEvents({ q: 'Nile' }), 400, 'AUDIT_QUERY_INVALID');
      await rejectsWith(listAuditEvents({ q: '' }), 400, 'AUDIT_QUERY_INVALID');
    });

    it('treats q as a literal, case-sensitive label prefix', async () => {
      const upper = await listAuditEvents({ deletedOnly: true, q: 'Nile', limit: 100 });
      expect(upper.items.length).toBeGreaterThan(0);
      expect(upper.items.every((item) => (item.entityLabel ?? '').startsWith('Nile'))).toBe(true);
      const lower = await listAuditEvents({ deletedOnly: true, q: 'nile', limit: 100 });
      expect(lower.items).toEqual([]);
    });
  });

  describe('GET tenant/audit/entities/:entityType/:entityId', () => {
    it('returns the flat event page for one entity', async () => {
      const lead = await firstLeadEvent();
      const page = await listEntityAuditEvents('Lead', lead.entityId as string, { limit: 100 });
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((item) => item.entityId === lead.entityId)).toBe(true);
    });

    it('also matches the LeadEntity spelling', async () => {
      const lead = await firstLeadEvent();
      const a = await listEntityAuditEvents('Lead', lead.entityId as string, { limit: 100 });
      const b = await listEntityAuditEvents('LeadEntity', lead.entityId as string, { limit: 100 });
      expect(b.items.map((item) => item.id)).toEqual(a.items.map((item) => item.id));
    });

    it('returns grouped history with relatedPartyIds', async () => {
      const lead = await firstLeadEvent();
      const page = await listRelatedEntityHistory('Lead', lead.entityId as string, { relatedPartyIds: [UUID_V7] });
      expect(Object.keys(page).sort()).toEqual(['items', 'nextCursor']);
      expect(page.items.length).toBeGreaterThan(0);
      const group = page.items[0];
      expect(Object.keys(group).sort()).toEqual(
        ['action', 'actorLabel', 'actorType', 'createdAt', 'diff', 'id', 'outcome', 'reason', 'referenceLabel', 'subjectId', 'subjectKind'].sort(),
      );
      expect(group.subjectKind).toBe('lead');
    });

    it('filters grouped history by historyCategory', async () => {
      const lead = await firstLeadEvent();
      const page = await listRelatedEntityHistory('Lead', lead.entityId as string, {
        relatedPartyIds: [UUID_V7],
        historyCategory: 'activity',
      });
      expect(page.items.every((item) => item.subjectKind === 'activity')).toBe(true);
    });

    it('rejects bad relatedPartyIds with 400 CORE_VALIDATION_FAILED', async () => {
      const lead = await firstLeadEvent();
      const id = lead.entityId as string;
      const tooMany = Array.from({ length: 22 }, (_, i) => `019a7c20-0002-7000-8000-${String(i).padStart(12, '0')}`);
      await rejectsWith(listRelatedEntityHistory('Lead', id, { relatedPartyIds: [] }), 400, 'CORE_VALIDATION_FAILED');
      await rejectsWith(listRelatedEntityHistory('Lead', id, { relatedPartyIds: tooMany }), 400, 'CORE_VALIDATION_FAILED');
      await rejectsWith(
        listRelatedEntityHistory('Lead', id, { relatedPartyIds: [UUID_V7, UUID_V7] }),
        400,
        'CORE_VALIDATION_FAILED',
      );
      await rejectsWith(
        listRelatedEntityHistory('Lead', id, { relatedPartyIds: ['0192b7ea-7c4f-4a7d-9c9f-51c7f2b3a9e1'] }),
        400,
        'CORE_VALIDATION_FAILED',
      );
    });

    it('accepts exactly 21 related party IDs', async () => {
      const lead = await firstLeadEvent();
      const ids = Array.from({ length: 21 }, (_, i) => `019a7c20-0002-7000-8000-${String(i).padStart(12, '0')}`);
      await expect(listRelatedEntityHistory('Lead', lead.entityId as string, { relatedPartyIds: ids })).resolves.toBeTruthy();
    });
  });

  describe('GET tenant/audit/records/CRM/LEAD/:targetId/history', () => {
    it('returns grouped lead history', async () => {
      const lead = await firstLeadEvent();
      const page = await listRecordHistory(
        { targetApp: 'CRM', targetType: 'LEAD', targetId: lead.entityId as string },
        { historyCategory: 'lead' },
      );
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((item) => item.subjectKind === 'lead')).toBe(true);
    });

    it('pages with an opaque cursor', async () => {
      const lead = await firstLeadEvent();
      const target = { targetApp: 'CRM', targetType: 'LEAD', targetId: lead.entityId as string } as const;
      const all = await listRecordHistory(target, { limit: 100 });
      const first = await listRecordHistory(target, { limit: 1 });
      expect(first.items).toHaveLength(1);
      if (all.items.length > 1) {
        expect(first.nextCursor).not.toBeNull();
        const second = await listRecordHistory(target, { limit: 1, cursor: first.nextCursor as string });
        expect(second.items[0].id).toBe(all.items[1].id);
      }
    });

    it('returns 404 ACTIVITY_NOT_FOUND for an unknown lead', async () => {
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: UUID_V7 }),
        404,
        'ACTIVITY_NOT_FOUND',
      );
    });

    it('returns 400 CORE_VALIDATION_FAILED for a bad id or limit', async () => {
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'not-a-uuid' }),
        400,
        'CORE_VALIDATION_FAILED',
      );
      const lead = await firstLeadEvent();
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: lead.entityId as string }, { limit: 101 }),
        400,
        'CORE_VALIDATION_FAILED',
      );
    });

    it('returns 403 MISSING_REQUIRED_PERMISSIONS without a CRM lead read permission', async () => {
      const lead = await firstLeadEvent();
      setFakeActor('tenantAdmin');
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: lead.entityId as string }),
        403,
        'MISSING_REQUIRED_PERMISSIONS',
      );
    });
  });

  describe('CRM fake records (fake id patterns and seeded history)', () => {
    const seededLeadId = () => CUSTOMERS_FAKE_DB.find((customer) => customer.sourceLeadId)?.sourceLeadId as string;

    it("returns a non-empty grouped history for a CRM fake lead (lead-001 style id)", async () => {
      const leadId = seededLeadId();
      expect(leadId).toMatch(/^lead-/);
      const page = await listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: leadId }, { limit: 100 });
      expect(page.items.length).toBeGreaterThan(0);
      const actions = page.items.map((item) => item.action);
      expect(actions).toEqual(expect.arrayContaining(['LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_STAGE_CHANGED', 'ACTIVITY_CREATED']));
      const updated = page.items.find((item) => item.action === 'LEAD_UPDATED');
      expect(updated?.diff.length).toBeGreaterThan(0);
      const kinds = new Set(page.items.map((item) => item.subjectKind));
      expect(kinds.has('lead')).toBe(true);
      expect(kinds.has('activity')).toBe(true);
      expect(kinds.has('contact')).toBe(true);
    });

    it('pages a CRM fake lead history with the cursor', async () => {
      const target = { targetApp: 'CRM', targetType: 'LEAD', targetId: seededLeadId() } as const;
      const all = await listRecordHistory(target, { limit: 100 });
      const first = await listRecordHistory(target, { limit: 2 });
      expect(first.nextCursor).not.toBeNull();
      const second = await listRecordHistory(target, { limit: 2, cursor: first.nextCursor as string });
      expect([...first.items, ...second.items].map((item) => item.id)).toEqual(all.items.slice(0, 4).map((item) => item.id));
    });

    it('still rejects ids that are neither UUIDs nor CRM fake ids', async () => {
      await rejectsWith(listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'customer 1' }), 400, 'CORE_VALIDATION_FAILED');
      await rejectsWith(
        listRelatedEntityHistory('CustomerProfile', ACME_CUSTOMER_ID, { relatedPartyIds: ['not-a-party'] }),
        400,
        'CORE_VALIDATION_FAILED',
      );
    });

    it('accepts CRM fake party ids (party-c-1-2) as relatedPartyIds', async () => {
      await expect(
        listRelatedEntityHistory('Lead', seededLeadId(), { relatedPartyIds: ['party-c-1-2', 'party-1'] }),
      ).resolves.toBeTruthy();
    });

    it("returns a customer's related history with its party ids, root events as kind lead", async () => {
      const customer = CUSTOMERS_FAKE_DB.find((item) => item.id === ACME_CUSTOMER_ID)!;
      const relatedPartyIds = [customer.partyId, ...customer.contacts.map((contact) => contact.partyId)];
      const page = await listRelatedEntityHistory('CustomerProfile', customer.id, { relatedPartyIds, limit: 100 });
      expect(page.items.length).toBeGreaterThan(0);
      const created = page.items.find((item) => item.action === 'CUSTOMER_PROFILE_CREATED');
      expect(created?.subjectKind).toBe('lead');
      const kinds = new Set(page.items.map((item) => item.subjectKind));
      for (const kind of ['lead', 'contact', 'activity', 'salesOrder', 'invoice']) {
        expect(kinds.has(kind as never)).toBe(true);
      }
      const contacts = await listRelatedEntityHistory('CustomerProfile', customer.id, {
        relatedPartyIds,
        historyCategory: 'contact',
      });
      expect(contacts.items.length).toBeGreaterThan(0);
      expect(contacts.items.every((item) => item.subjectKind === 'contact')).toBe(true);

      const first = await listRelatedEntityHistory('CustomerProfile', customer.id, { relatedPartyIds, limit: 3 });
      const second = await listRelatedEntityHistory('CustomerProfile', customer.id, {
        relatedPartyIds,
        limit: 3,
        cursor: first.nextCursor as string,
      });
      expect([...first.items, ...second.items].map((item) => item.id)).toEqual(page.items.slice(0, 6).map((item) => item.id));
    });

    it("returns a customer's flat events without party ids", async () => {
      const page = await listEntityAuditEvents('CustomerProfile', ACME_CUSTOMER_ID, { limit: 100 });
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((item) => item.entityId === ACME_CUSTOMER_ID)).toBe(true);
    });

    it('seeds OP-30008 history (Opportunity and OpportunityEntity spellings)', async () => {
      const row = fakeAllOpportunityRows().find((item) => opportunityRef(item.id) === 'OP-30008')!;
      const relatedPartyIds = [row.customerPartyId, row.contactPartyId].filter((id): id is string => Boolean(id));
      const page = await listRelatedEntityHistory('OpportunityEntity', row.id, { relatedPartyIds, limit: 100 });
      const actions = page.items.map((item) => item.action);
      expect(actions).toEqual(
        expect.arrayContaining(['OPPORTUNITY_CREATED', 'OPPORTUNITY_UPDATED', 'OPPORTUNITY_STAGE_CHANGED', 'QUOTATION_CREATED']),
      );
      expect(page.items.find((item) => item.action === 'OPPORTUNITY_STAGE_CHANGED')?.subjectKind).toBe('lead');
      const quotations = await listRelatedEntityHistory('Opportunity', row.id, { relatedPartyIds, historyCategory: 'quotation' });
      expect(quotations.items.map((item) => item.action)).toEqual(['QUOTATION_CREATED']);
    });
  });
});

describe('AuditLogApi', () => {
  let api: AuditLogApi;
  let http: HttpTestingController;
  const scope = { me: signal({ id: 'actor', permissions: ['audit.read'], permissionScopes: {}, isTenantOwner: true }), selection: signal(null) };

  beforeEach(() => {
    setCsrfCookie();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: TenantScopeState, useValue: scope }] });
    api = TestBed.inject(AuditLogApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clearCsrfCookie();
    http.verify();
  });

  it('list unwraps the cursor page', async () => {
    const pending = api.listAuditEvents({ action: 'UPDATE', cursor: 'cursor-1' });
    const request = http.expectOne((r) => r.url === '/api/tenant/core/v1/audit');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.get('action')).toBe('UPDATE');
    expect(request.request.params.get('cursor')).toBe('cursor-1');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    expect(request.request.headers.has('If-Match')).toBe(false);
    request.flush({ success: true, data: { items: [], nextCursor: 'next' } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: 'next' });
  });

  it('list asks for 25 rows', async () => {
    const pending = api.listAuditEvents();
    const request = http.expectOne((r) => r.url === '/api/tenant/core/v1/audit');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ success: true, data: { items: [], nextCursor: null } });
    await pending;
  });

  it('links every remaining route and serializes related parties as CSV', async () => {
    const cases = [
      { run: () => api.listDeletedRecords({ q: 'Nile' }), path: '/deleted', data: { items: [], nextCursor: null } },
      { run: () => api.getAuditEvent(UUID_V7), path: `/events/${UUID_V7}`, data: { id: UUID_V7 } },
      { run: () => api.listEntityAuditEvents('Party/Entity', 'entity with space'), path: '/entities/Party%2FEntity/entity%20with%20space', data: { items: [], nextCursor: null } },
      { run: () => api.listRelatedEntityHistory('Party', UUID_V7, { relatedPartyIds: [UUID_V7, '019a7c20-0002-7000-8000-000000000003'], historyCategory: 'contact' }), path: `/entities/Party/${UUID_V7}`, data: { items: [], nextCursor: null } },
      { run: () => api.listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: UUID_V7 }, { historyCategory: 'lead' }), path: `/records/CRM/LEAD/${UUID_V7}/history`, data: { items: [], nextCursor: null } },
    ];
    for (const test of cases) {
      const pending = test.run();
      const request = http.expectOne((r) => r.url === `/api/tenant/core/v1/audit${test.path}`);
      if (test.path === '/deleted') expect(request.request.params.get('q')).toBe('Nile');
      if (request.request.params.has('relatedPartyIds')) expect(request.request.params.getAll('relatedPartyIds')).toEqual([`${UUID_V7},019a7c20-0002-7000-8000-000000000003`]);
      request.flush({ success: true, data: test.data });
      await pending;
    }
  });

  it('rejects malformed success envelopes', async () => {
    const pending = expect(api.listAuditEvents()).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne((r) => r.url.endsWith('/audit')).flush({ items: [], nextCursor: null });
    await pending;
  });

  it('rechecks scope and refetches instead of retaining audit data', async () => {
    for (const id of ['actor', 'other']) {
      scope.me.update((me) => ({ ...me, id }));
      const pending = api.listAuditEvents();
      http.expectOne((r) => r.url.endsWith('/audit')).flush({ success: true, data: { items: [], nextCursor: null } });
      await pending;
    }
  });

  it('preserves gateway errors, correlation and Retry-After', async () => {
    const pending = expect(api.listAuditEvents()).rejects.toMatchObject({ status: 429, code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'support', details: { retryAfterSeconds: ['9'] } });
    http.expectOne((r) => r.url.endsWith('/audit')).flush({ code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'support' }, { status: 429, statusText: 'Rate limited', headers: { 'Retry-After': '9' } });
    await pending;
  });

  it('export sends the filters with a key and no cursor', async () => {
    const key = '019a7c20-0003-7000-8000-000000000003';
    const pending = api.startAuditExport(
      {
        cursor: 'ignored-cursor',
        limit: 25,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-10T23:59:59.000Z',
        sourceApp: 'CRM',
        includeRequests: true,
        deletedOnly: true,
        q: 'Nile',
      },
      key,
    );
    const request = http.expectOne((r) => r.method === 'POST' && r.url === '/api/tenant/core/v1/audit/exports');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7_REGEX);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-test-token');
    expect(request.request.body).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-10T23:59:59.000Z',
      sourceApp: 'CRM',
      includeRequests: true,
      deletedOnly: true,
      q: 'Nile',
    });
    expect(request.request.body).not.toHaveProperty('cursor');
    expect(request.request.body).not.toHaveProperty('limit');
    request.flush({ success: true, data: { exportId: UUID_V7, status: 'QUEUED' } }, { status: 202, statusText: 'Accepted' });
    await expect(pending).resolves.toEqual({ exportId: UUID_V7, status: 'QUEUED' });
  });

  it('export rejects without a CSRF cookie without sending a request', async () => {
    clearCsrfCookie();
    await expect(
      api.startAuditExport({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-05T00:00:00.000Z' }, UUID_V7),
    ).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone((r) => r.url.includes('/exports'));
  });

  it('export rejects malformed success envelopes', async () => {
    const startPending = expect(
      api.startAuditExport({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-05T00:00:00.000Z' }, UUID_V7),
    ).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne('/api/tenant/core/v1/audit/exports').flush({ exportId: UUID_V7, status: 'QUEUED' });
    await startPending;

    const statusPending = expect(api.getAuditExport(UUID_V7)).rejects.toMatchObject({
      status: 502,
      code: 'COMMON.GENERIC.INTERNAL_ERROR',
    });
    http.expectOne(`/api/tenant/core/v1/audit/exports/${UUID_V7}`).flush({ status: 'READY' });
    await statusPending;
  });

  it('getAuditExport unwraps status and preserves envelope correlationId', async () => {
    const pending = api.getAuditExport(UUID_V7);
    const request = http.expectOne(`/api/tenant/core/v1/audit/exports/${UUID_V7}`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      success: true,
      correlationId: 'corr-export-1',
      data: {
        status: 'FAILED',
        rowsWritten: 500000,
        fileName: `audit-${UUID_V7}.csv`,
        sizeBytes: 0,
        expiresAt: null,
        errorCode: 'AUDIT_EXPORT_STALLED',
      },
    });
    await expect(pending).resolves.toEqual({
      status: 'FAILED',
      rowsWritten: 500000,
      fileName: `audit-${UUID_V7}.csv`,
      sizeBytes: 0,
      expiresAt: null,
      errorCode: 'AUDIT_EXPORT_STALLED',
      correlationId: 'corr-export-1',
    });
  });

  it('downloadAuditExport reads a CSV blob and parses JSON error blobs', async () => {
    const csvBlob = new Blob(['\uFEFFid,action\n'], { type: 'text/csv; charset=utf-8' });
    const pending = api.downloadAuditExport(UUID_V7);
    const okReq = http.expectOne(`/api/tenant/core/v1/audit/exports/${UUID_V7}/download`);
    expect(okReq.request.responseType).toBe('blob');
    okReq.flush(csvBlob);
    await expect(pending).resolves.toBe(csvBlob);

    const expiredPending = expect(api.downloadAuditExport(UUID_V7)).rejects.toMatchObject({
      status: 410,
      code: 'AUDIT_EXPORT_EXPIRED',
    });
    const errReq = http.expectOne(`/api/tenant/core/v1/audit/exports/${UUID_V7}/download`);
    errReq.flush(
      new Blob([JSON.stringify({ code: 'AUDIT_EXPORT_EXPIRED' })], { type: 'application/json' }),
      { status: 410, statusText: 'Gone' },
    );
    await expiredPending;
  });

  it('auditExportErrorKey maps known export codes including AUDIT_EXPORT_STALLED', () => {
    expect(auditExportErrorKey('AUDIT_EXPORT_LIMIT_EXCEEDED')).toBe('wsAudit.errors.AUDIT_EXPORT_LIMIT_EXCEEDED');
    expect(auditExportErrorKey('AUDIT_EXPORT_STALLED')).toBe('wsAudit.errors.AUDIT_EXPORT_STALLED');
    expect(auditExportErrorKey('SOMETHING_ELSE')).toBe('wsAudit.errors.exportFailed');
    expect(auditExportErrorKey(undefined)).toBe('wsAudit.errors.exportFailed');
  });
});

describe('audit-log', () => {
  let api: AuditLogApi;
  let http: HttpTestingController;
  const scope = { me: signal({ id: 'actor', permissions: ['audit.read'], permissionScopes: {}, isTenantOwner: true }), selection: signal(null) };

  beforeEach(() => {
    setCsrfCookie();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: TenantScopeState, useValue: scope }] });
    api = TestBed.inject(AuditLogApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clearCsrfCookie();
    http.verify();
  });

  it('export does not use bulk jobs', async () => {
    const pending = api.startAuditExport({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-05T00:00:00.000Z' }, UUID_V7);
    http.expectNone((r) => r.url.includes('bulk-jobs') || r.url.includes('bulkJobs'));
    const req = http.expectOne('/api/tenant/core/v1/audit/exports');
    req.flush({ success: true, data: { exportId: UUID_V7, status: 'QUEUED' } }, { status: 202, statusText: 'Accepted' });
    await pending;
  });
});

describe('audit-log fake', () => {
  beforeEach(() => { resetAuditFake(); setFakeActor('owner'); });
  it('DTO faults return CORE_VALIDATION_FAILED', async () => {
    for (const query of [{ limit: 101 }, { limit: 0 }, { action: 'x'.repeat(65) }, { from: 'bad' }, { sourceApp: 'bad' }]) {
      await expect(listAuditEvents(query as import('./audit-log.model').AuditQuery)).rejects.toMatchObject({ status: 400, code: 'CORE_VALIDATION_FAILED' });
    }
    await expect(listAuditEvents({ cursor: 'broken' })).rejects.toMatchObject({ code: 'AUDIT_QUERY_INVALID' });
  });
  it('includeRequests includes requests and events while sourceKind still filters exactly', async () => {
    const both = await listAuditEvents({ includeRequests: true, limit: 100 });
    expect(both.items.some((row) => row.sourceKind === 'HTTP_COMMAND')).toBe(true);
    expect(both.items.some((row) => row.sourceKind !== 'HTTP_COMMAND')).toBe(true);
    const requests = await listAuditEvents({ includeRequests: true, sourceKind: 'HTTP_COMMAND' });
    expect(requests.items.every((row) => row.sourceKind === 'HTTP_COMMAND')).toBe(true);
  });
});
