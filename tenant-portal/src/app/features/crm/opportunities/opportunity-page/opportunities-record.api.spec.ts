import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import {
  attachOpportunityTags, canManagePipelines, canManageTags, countOpportunitiesByParty, createOpportunity, deleteOpportunity, detachOpportunityTag,
  getOpportunity, getOpportunityCapabilities, listLinkedQuotations, listOpportunityTags, listStageHistory,
  moveOpportunityStage, patchOpportunity, transferOpportunityPipeline, listPipelines, getPipeline,
  listOpportunityCustomFields, getOpportunityCustomValues, searchCustomerOptions, getCustomerOption,
  listCustomerContacts, listOwners,
} from '../opportunities.api';
import { bindRecordTest, branchId, companyId, opportunityId, OpportunityTransport, recordTestProviders } from './opportunity-test-support';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (language, theme) => {
  describe('OpportunitiesApi', () => {
    let transport: OpportunityTransport;
    let dispose: () => void;
    let environment: ReturnType<typeof recordTestProviders>;
    beforeEach(() => {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      transport = new OpportunityTransport();
      environment = recordTestProviders(transport);
      TestBed.configureTestingModule({ providers: [...environment.providers, { provide: CoreHttp, useValue: environment.core }] });
      dispose = bindRecordTest(transport);
    });
    afterEach(() => dispose());

    it('capabilities sends both scope headers', async () => {
      expect(await getOpportunityCapabilities(branchId)).toEqual(transport.caps);
      expect(transport.recordedReads()).toEqual([{ path: '/opportunities/capabilities', query: { branchId }, scope: { companyId, branchId } }]);
    });

    it('makes no capability request for company-only or ambiguous scope', async () => {
      environment.me.update((me) => ({ ...me, accessibleBranches: [], accessibleBranchCompanies: [] }));
      await expect(getOpportunityCapabilities(branchId)).rejects.toMatchObject({ status: 403 });
      environment.me.update((me) => ({ ...me, accessibleBranches: [branchId], accessibleBranchCompanies: [{ branchId, companyId }, { branchId, companyId: '019f0000-0000-7000-8000-000000000099' }] }));
      expect(TestBed.inject(TenantScopeState).branchCompanies().has(branchId)).toBe(false);
      await expect(getOpportunityCapabilities(branchId)).rejects.toMatchObject({ status: 403 });
      expect(transport.recordedReads()).toEqual([]);
    });

    it('create key reuse', async () => {
      const body = { branchId, customerProfileId: 'customer', pipelineId: 'pipeline', stageId: 'new', title: 'Deal', amount: '12.12500000', currencyCode: 'KWD' };
      const key = newIdempotencyKey();
      transport.writeErrors.push(new ApiError(503, 'SERVER_ERROR'));
      await expect(createOpportunity(body, key)).rejects.toMatchObject({ status: 503 });
      await createOpportunity(body, key);
      const writes = transport.recordedWrites();
      expect(writes.map((write) => write.options.key)).toEqual([key, key]);
      expect(writes[0].body).toEqual(writes[1].body);
      expect(writes[1].body).not.toHaveProperty('tagIds');
      expect(writes[1].body).toMatchObject({ amount: '12.12500000' });
    });

    it('uses keyed header-free record writes and always retains the loaded token', async () => {
      const token = transport.row.updatedAt;
      await patchOpportunity(opportunityId, { expectedUpdatedAt: token, title: 'Changed' });
      await moveOpportunityStage(opportunityId, { expectedUpdatedAt: transport.row.updatedAt, stageId: 'lost', lostReason: 'Price' });
      await transferOpportunityPipeline(opportunityId, { expectedUpdatedAt: transport.row.updatedAt, pipelineId: 'next' }, newIdempotencyKey());
      await attachOpportunityTags(opportunityId, ['tag']);
      await detachOpportunityTag(opportunityId, 'tag');
      await deleteOpportunity(opportunityId, 'Duplicate');
      const writes = transport.recordedWrites();
      for (const write of writes) {
        expect(write.options.key).toMatch(/^[\da-f-]{14}7[\da-f-]{21}$/i);
        expect(write.options.scope).toBeUndefined();
      }
      expect(writes[0].body).toEqual({ expectedUpdatedAt: token, title: 'Changed' });
      expect(writes[1].body).toHaveProperty('expectedUpdatedAt');
      expect(writes[2].body).toHaveProperty('expectedUpdatedAt');
    });

    it('reuses generated keys only for unchanged uncertain writes', async () => {
      const body = { expectedUpdatedAt: transport.row.updatedAt, title: 'Changed' };
      transport.writeErrors.push(new ApiError(0, 'NETWORK_ERROR'));
      await expect(patchOpportunity(opportunityId, body)).rejects.toMatchObject({ status: 0 });
      await patchOpportunity(opportunityId, body);
      const writes = transport.recordedWrites();
      expect(writes[0].options.key).toBe(writes[1].options.key);
      await patchOpportunity(opportunityId, { expectedUpdatedAt: transport.row.updatedAt, title: 'Another' });
      expect(transport.recordedWrites()[2].options.key).not.toBe(writes[1].options.key);
    });

    it('record reads stay header-free and preserve history cursors', async () => {
      await getOpportunity(opportunityId);
      await listOpportunityTags(opportunityId);
      await listStageHistory(opportunityId, 'cursor');
      for (const read of transport.recordedReads()) expect(read.scope).toBeUndefined();
      expect(transport.recordedReads().at(-1)?.query).toEqual({ limit: 100, cursor: 'cursor' });
    });

    it('catalogues and customer lookups stay header-free while owners use the session scope', async () => {
      await listPipelines(); await getPipeline('pipeline'); await listOpportunityCustomFields();
      await getOpportunityCustomValues(branchId, opportunityId);
      await searchCustomerOptions(branchId, 'Acme'); await getCustomerOption('customer');
      await listCustomerContacts('customer');
      expect(transport.recordedReads().every((read) => read.scope === undefined)).toBe(true);
      await listOwners(branchId);
      expect(transport.recordedReads().at(-1)).toMatchObject({ path: '/assignable-owners', scope: { branchId, companyId } });
    });

    it('never resends an idempotency mismatch', async () => {
      const body = { branchId, customerProfileId: 'customer', pipelineId: 'pipeline', stageId: 'new', title: 'Deal' };
      transport.writeErrors.push(new ApiError(422, 'GW.IDEM.MISMATCH'));
      await expect(createOpportunity(body, newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      await expect(createOpportunity({ ...body, title: 'Changed' }, newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(transport.recordedWrites()).toHaveLength(1);
    });

    it('links Trade quotations with crmOpportunityId and no scope headers', async () => {
      await listLinkedQuotations(opportunityId, 2, 20);
      expect(environment.core.read).toHaveBeenCalledWith('/api/tenant/trade/v1/quotations', { crmOpportunityId: opportunityId, page: 2, limit: 20 }, { bare: true });
    });

    it('uses static permissions for management links', () => {
      bindAnalyticsPermissions(() => ['crm.tags.manage']);
      expect(canManageTags()).toBe(true);
      expect(canManagePipelines()).toBe(false);
    });

    it('counts parties with a keyed body and no scope headers', async () => {
      await countOpportunitiesByParty(branchId, ['party']);
      expect(transport.recordedWrites()[0]).toMatchObject({ method: 'POST', path: '/opportunities/counts-by-party', body: { branchId, partyIds: ['party'] } });
      expect(transport.recordedWrites()[0].options.scope).toBeUndefined();
      expect(transport.recordedWrites()[0].options.key).toBeTruthy();
    });
  });
});
