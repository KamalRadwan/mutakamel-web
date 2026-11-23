import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCrmHttpForTest, crmQueries } from '../../../features/crm/shared/crm-http';
import { CrmHttpStub } from '../../../features/crm/shared/testing/crm-http-testing';
import { WorkspaceLookups } from '../workspace-lookups/workspace-lookups.api';
import { bindAnalyticsPermissions } from './analytics-permissions';
import { listOwnerOptions, listPipelineOptions, listShareTargets, listTransferTargets, OrgApi } from './org.api';

const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;

describe.each(VIEWS)('OrgApi (%s / %s)', (language, theme) => {
  const lookups = { allBranches: vi.fn(), users: vi.fn(), user: vi.fn() };
  let org: OrgApi;
  let dispose: () => void;

  beforeEach(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    TestBed.configureTestingModule({ providers: [{ provide: WorkspaceLookups, useValue: lookups }] });
    org = TestBed.inject(OrgApi);
    bindAnalyticsPermissions(() => []);
    crmQueries().clear();
    dispose = bindCrmHttpForTest(new CrmHttpStub());
  });

  afterEach(() => { dispose(); bindAnalyticsPermissions(() => []); vi.resetAllMocks(); });

  it('branches need org.branch.read', async () => {
    expect(await org.listBranches()).toEqual([]);
    expect(lookups.allBranches).not.toHaveBeenCalled();
    bindAnalyticsPermissions(() => ['org.branch.read', 'crm.dashboards.read.own']);
    lookups.allBranches.mockResolvedValue([
      { id: 'branch-1', companyId: 'company-1', name: 'Branch one', status: 'ACTIVE' },
      { id: 'branch-2', companyId: 'company-2', name: 'Branch two', status: 'ACTIVE' },
      { id: 'inactive', companyId: 'company-1', name: 'Old branch', status: 'INACTIVE' },
    ]);
    expect((await org.listGrantedBranches()).map((branch) => branch.id)).toEqual(['branch-1', 'branch-2']);
    expect(lookups.allBranches).toHaveBeenCalledExactlyOnceWith({ status: 'ACTIVE' });
    expect(org.branches[0].name).toEqual({ en: 'Branch one', ar: 'Branch one' });
    bindAnalyticsPermissions(() => []);
    expect(org.branches).toEqual([]);
  });

  it('targets', async () => {
    const stub = new CrmHttpStub({
      '/dashboards/share-targets': { items: [{ id: 'team-1', type: 'TEAM' }], nextOffset: 50 },
      '/widgets/share-targets': { items: [{ id: 'user-1', type: 'USER' }] },
      '/widgets/owner-options': { items: [{ id: 'owner-1', name: null }], nextCursor: 'owner-cursor' },
      '/widgets/widget-1/ownership-transfer/targets': { items: [{ id: 'target-1', name: 'Target' }], nextCursor: null },
      '/pipelines': [{ id: 'pipeline-1', code: 'CUSTOM', nameEn: 'Custom', nameAr: 'مخصص' }],
    });
    const restore = bindCrmHttpForTest(stub);
    const read = vi.spyOn(stub, 'read');
    try {
      expect((await listShareTargets('dashboards', 'Team', 50, 10)).nextOffset).toBe(50);
      expect((await org.listShareTargets('widgets')).items[0].id).toBe('user-1');
      expect((await listOwnerOptions('Owner', 'cursor', 10, 'SHARED')).nextCursor).toBe('owner-cursor');
      expect((await listTransferTargets('widget-1', 'Target', 'next', 7)).items[0].id).toBe('target-1');
      expect((await listPipelineOptions())[0].code).toBe('CUSTOM');
      expect(read.mock.calls).toEqual([
        ['/dashboards/share-targets', { search: 'Team', offset: 50, limit: 10 }],
        ['/widgets/share-targets', { search: '', offset: 0, limit: 50 }],
        ['/widgets/owner-options', { search: 'Owner', cursor: 'cursor', limit: 10, access: 'SHARED' }],
        ['/widgets/widget-1/ownership-transfer/targets', { search: 'Target', cursor: 'next', limit: 7 }],
        ['/pipelines'],
      ]);
      expect(crmQueries().getQueryCache().getAll().every((query) => query.queryKey[0] === 'crm-analytics')).toBe(true);
      expect(stub.recordedWrites()).toEqual([]);
    } finally { restore(); }
  });

  it('uses the real clock on every call', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      expect(org.now()).toBe('2030-01-01T00:00:00.000Z');
      vi.advanceTimersByTime(1000);
      expect(org.now()).toBe('2030-01-01T00:00:01.000Z');
    } finally { vi.useRealTimers(); }
  });

  it('loads users from the real directory with pagination', async () => {
    lookups.users.mockResolvedValueOnce({
      data: [{ id: 'user-1', firstName: 'First', lastName: 'User', email: 'first@example.com', teamId: null, branchId: 'branch-1' }],
      meta: { hasNext: true },
    }).mockResolvedValueOnce({ data: [], meta: { hasNext: false } });
    expect((await org.listUsers('branch-1'))[0].name).toBe('First User');
    expect(lookups.users.mock.calls).toEqual([1, 2].map((page) => [{ branchId: 'branch-1', status: 'ACTIVE', page, limit: 100 }]));
  });
});
