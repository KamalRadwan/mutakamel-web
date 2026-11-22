import { setFakeActor } from '../../staff/shared/staff.fake';
import {
  AuditEvent,
  listAuditEvents,
  listDeletedRecords,
  listEntityAuditEvents,
  listRecordHistory,
  listRelatedEntityHistory,
} from './audit-log.api';
import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB } from '../../../crm/customers/customers.fake';
import { fakeAllOpportunityRows } from '../../../crm/opportunities/opportunities.fake';
import { opportunityRef } from '../../../crm/opportunities/opportunities.model';
import { resetAuditFake } from './audit-log.fake';

const UUID_V7 = '019a7c20-0002-7000-8000-000000000002';

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

    it('rejects bad relatedPartyIds with 400 AUDIT_QUERY_INVALID', async () => {
      const lead = await firstLeadEvent();
      const id = lead.entityId as string;
      const tooMany = Array.from({ length: 22 }, (_, i) => `019a7c20-0002-7000-8000-${String(i).padStart(12, '0')}`);
      await rejectsWith(listRelatedEntityHistory('Lead', id, { relatedPartyIds: [] }), 400, 'AUDIT_QUERY_INVALID');
      await rejectsWith(listRelatedEntityHistory('Lead', id, { relatedPartyIds: tooMany }), 400, 'AUDIT_QUERY_INVALID');
      await rejectsWith(
        listRelatedEntityHistory('Lead', id, { relatedPartyIds: [UUID_V7, UUID_V7] }),
        400,
        'AUDIT_QUERY_INVALID',
      );
      await rejectsWith(
        listRelatedEntityHistory('Lead', id, { relatedPartyIds: ['0192b7ea-7c4f-4a7d-9c9f-51c7f2b3a9e1'] }),
        400,
        'AUDIT_QUERY_INVALID',
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

    it('returns 400 AUDIT_QUERY_INVALID for a bad id or limit', async () => {
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'not-a-uuid' }),
        400,
        'AUDIT_QUERY_INVALID',
      );
      const lead = await firstLeadEvent();
      await rejectsWith(
        listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: lead.entityId as string }, { limit: 101 }),
        400,
        'AUDIT_QUERY_INVALID',
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
      await rejectsWith(listRecordHistory({ targetApp: 'CRM', targetType: 'LEAD', targetId: 'customer 1' }), 400, 'AUDIT_QUERY_INVALID');
      await rejectsWith(
        listRelatedEntityHistory('CustomerProfile', ACME_CUSTOMER_ID, { relatedPartyIds: ['not-a-party'] }),
        400,
        'AUDIT_QUERY_INVALID',
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
