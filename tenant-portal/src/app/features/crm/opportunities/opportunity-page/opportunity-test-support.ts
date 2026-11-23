import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { ApiError } from '../../../../core/api/api-errors';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../../core/api/core-http';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { CrmModules } from '../../shared/crm-modules/crm-modules';
import { bindCrmHttpForTest, crmQueries, type CrmReadOptions, type CrmWriteOptions } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { PipelineScope } from '../pipeline-scope';
import type { OpportunityCapabilities, OpportunityRow, PipelineView } from '../opportunities.model';

export const companyId = '019f0000-0000-7000-8000-000000000010';
export const branchId = '019f0000-0000-7000-8000-000000000011';
export const opportunityId = '019f0000-0000-7000-8000-000000030008';
export const pipeline = {
  id: 'pipeline', nameEn: 'Sales', nameAr: 'المبيعات', isActive: true, isDefault: true,
  stages: [
    { id: 'new', pipelineId: 'pipeline', rank: 1, nameEn: 'New', nameAr: 'جديدة', flag: 'NEW', category: 'OPEN', isActive: true },
    { id: 'lost', pipelineId: 'pipeline', rank: 2, nameEn: 'Lost', nameAr: 'خاسرة', flag: 'LOST', category: 'CLOSED', isActive: true },
  ],
} as PipelineView;

export function opportunity(): OpportunityRow {
  return {
    id: opportunityId, branchId, customerProfileId: 'customer', customerPartyId: 'party', leadId: null,
    contactPartyId: null, pipelineId: pipeline.id, stageId: 'new', stageFlag: 'NEW', status: 'IN_PROGRESS',
    title: 'Office equipment', importance: 0, cardColor: null, amount: '6200.00000000', currencyCode: 'KWD',
    description: null, expectedCloseDate: null, probabilityPercent: null, ownerUserId: 'owner',
    wonAt: null, lostAt: null, lostReason: null, createdAt: '2026-11-21T12:00:00.000Z', updatedAt: '2026-11-21T12:00:00.000Z',
    customerProfileType: 'CORPORATE', customerDisplayName: 'Acme', customerCompanyName: 'Acme',
    customerPhone: null, customerEmail: null, customerCountry: null, customerCity: null, primaryContact: null,
    leadSourceName: null, leadSourceIconUrl: null, ownerDisplayName: 'A user', ownerAvatarUrl: null,
    openActivityCount: 0, nextOpenActivityAt: null, activityState: 'NO_OPEN', tags: [], winReason: null,
    lostReasonRef: null, stageEnteredAt: '2026-11-21T12:00:00.000Z', customFields: {},
  };
}

const all = { scope: 'all', ownerUserIds: null } as const;
export function capabilities(): OpportunityCapabilities {
  return { create: all, update: all, delete: all, move: all, transfer: all,
    bulk: { assign: all, moveStage: all, createActivity: all, delete: all }, export: false };
}

export class OpportunityTransport extends CrmHttpStub {
  row = opportunity();
  caps = capabilities();
  readErrors = new Map<string, ApiError>();
  writeErrors: ApiError[] = [];
  writeErrorsByPath = new Map<string, ApiError>();
  historyCursorError: ApiError | null = null;
  history = { items: [], nextCursor: null } as { items: unknown[]; nextCursor: string | null };
  private tick = 1;

  constructor() { super({}); }

  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    // Base stub records each call even when it has no fixture.
    await super.read(path, query, options).catch(() => undefined);
    const error = this.readErrors.get(path);
    if (error) throw error;
    if (path.endsWith('/stage-history') && query?.['cursor'] && this.historyCursorError) throw this.historyCursorError;
    const data: Record<string, unknown> = {
      [`/opportunities/${opportunityId}`]: this.row,
      '/opportunities/capabilities': { branchId, opportunities: this.caps },
      '/pipelines': [pipeline], '/pipelines/pipeline': pipeline,
      '/assignable-owners': { items: [{ id: 'owner', displayName: 'A user', avatarUrl: null }], nextCursor: null },
      '/custom-fields': [], '/tags': [], '/customer-profiles': { items: [] },
      '/customer-profiles/customer': { id: 'customer', partyId: 'party', displayName: 'Acme', companyName: 'Acme', status: 'PROSPECT', phones: [], email: null, contacts: [], profileType: 'CORPORATE' },
      [`/opportunities/${opportunityId}/stage-history`]: this.history,
      [`/opportunities/${opportunityId}/tags`]: this.row.tags,
    };
    if (!(path in data)) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
    return structuredClone(data[path]) as T;
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    const recorded = await super.write<T>(method, path, body, options);
    const error = this.writeErrorsByPath.get(path);
    if (error) throw error;
    if (this.writeErrors.length) throw this.writeErrors.shift()!;
    const patch = body as Partial<OpportunityRow> & { expectedUpdatedAt?: string; tagIds?: string[] };
    if (path.endsWith('/tags')) {
      this.row.tags = [...this.row.tags, ...(patch.tagIds ?? []).map((id) => ({ id, name: id, backgroundColor: null, textColor: null }))];
      return { ...recorded, data: structuredClone(this.row.tags) as T };
    }
    if (method === 'DELETE') return recorded;
    if (method !== 'POST' && patch.expectedUpdatedAt !== this.row.updatedAt) throw new ApiError(409, 'CRM.OPPORTUNITY.CONCURRENT_UPDATE');
    this.row = { ...this.row, ...patch, updatedAt: `2026-11-21T12:00:${String(this.tick++).padStart(2, '0')}.000Z` };
    return { ...recorded, data: structuredClone(this.row) as T };
  }
}

export function recordTestProviders(transport: OpportunityTransport) {
  const me = signal({ ...FAKE_TENANT_ME, id: 'opportunity-record-spec', accessibleCompanies: [companyId],
    accessibleBranches: [branchId], accessibleBranchCompanies: [{ branchId, companyId }] });
  return {
    me,
    notify: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
    core: { read: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }), readPage: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, hasNext: false } }) },
    providers: [
      { provide: AuthSession, useValue: { me, status: () => 'signed-in' } },
      { provide: CrmModules, useValue: { ensureLoaded: () => Promise.resolve(), reload: () => Promise.resolve(), loaded: () => true, opportunitiesEnabled: () => true } },
      { provide: PipelineScope, useValue: { current: () => pipeline, pipelines: () => [pipeline], ensureLoaded: () => Promise.resolve() } },
    ],
  };
}

export function bindRecordTest(transport: OpportunityTransport): () => void {
  crmQueries().clear();
  const disposeHttp = bindCrmHttpForTest(transport);
  const disposeRuntime = bindCrmInjectorForTest(() => TestBed.inject(EnvironmentInjector));
  bindAnalyticsPermissions(() => ['crm.opportunities.read.all', 'crm.customer_profiles.read.all']);
  return () => { disposeHttp(); disposeRuntime(); crmQueries().clear(); bindAnalyticsPermissions(() => []); sessionStorage.removeItem('tenant-staff-scope:opportunity-record-spec'); };
}
