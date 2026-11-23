import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupWidgetTest, widgetCatalog } from '../builder-test-support';
import { StepCompare } from './step-compare';
import type { GovernedTargetOption } from '../../widgets.model';
import { ApiError } from '../../../../../../core/api/api-errors';

class CompareHarness extends StepCompare {
  get teamsForTest() { return this.teamOptions(); }
  get targetsForTest() { return this.governedTargets(); }
  get loadingForTest() { return this.targetsLoading(); }
  get addAllowed() { return this.canAddDataset(); }
  add() { this.addDataset(); }
}

describe('live builder comparisons', () => {
  let env: ReturnType<typeof setupWidgetTest>;
  const branch = '019a9d10-0000-7000-8000-000000000101';
  beforeEach(() => {
    env = setupWidgetTest(); env.initialize();
    const catalog = structuredClone(widgetCatalog);
    for (const metric of catalog.metrics) {
      metric.comparisonTypes = ['NONE', 'GOVERNED_TARGET', 'DATASETS'];
      metric.datasetComparison = { bases: ['TEAM'] };
    }
    vi.spyOn(env.state, 'catalog').mockReturnValue(catalog);
    env.state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }], comparison: { type: 'GOVERNED_TARGET' } });
  });
  afterEach(() => env.restore());
  const flush = async () => { TestBed.tick(); await Promise.resolve(); await Promise.resolve(); };

  it('waits for a selected branch then passes it to the target endpoint', async () => {
    const read = vi.spyOn(env.stub, 'read').mockResolvedValue({ items: [], hasNext: false });
    TestBed.runInInjectionContext(() => new CompareHarness());
    await flush(); expect(read).not.toHaveBeenCalled();
    env.state.patchQuery({ filters: { branchId: branch } });
    await flush();
    expect(read).toHaveBeenCalledWith('/targets', expect.objectContaining({ metricKey: 'crm.leads.count', periodGrain: 'MONTH', branchId: branch }));
  });

  it('ignores a late result from the previous branch and clears rows while loading', async () => {
    let resolveOld: (page: { items: unknown[]; hasNext: boolean }) => void = () => {};
    const old = new Promise<{ items: unknown[]; hasNext: boolean }>((resolve) => { resolveOld = resolve; });
    const row: GovernedTargetOption = { id: 'target', branchId: branch, subjectType: 'BRANCH', subjectId: branch,
      subjectName: 'Branch', currencyCode: 'EGP', periodGrain: 'MONTH', periodStart: '2026-11-01', unit: 'MONEY', targetValue: '10.00' };
    vi.spyOn(env.stub, 'read').mockReturnValueOnce(old).mockResolvedValueOnce({ items: [], hasNext: false });
    env.state.patchQuery({ filters: { branchId: branch } });
    const compare = TestBed.runInInjectionContext(() => new CompareHarness());
    await flush(); expect(compare.loadingForTest).toBe(true);
    env.state.patchQuery({ filters: { branchId: 'other-branch' } });
    await flush(); resolveOld({ items: [{ ...row, metricKey: 'crm.leads.count', approvalState: 'APPROVED' }], hasNext: false }); await flush();
    expect(compare.targetsForTest).toEqual([]);
    expect(compare.loadingForTest).toBe(false);
  });

  it('uses the saved target branch when a widget has no branch filter', async () => {
    const read = vi.spyOn(env.stub, 'read').mockResolvedValue({ items: [], hasNext: false });
    env.state.patchQuery({ comparison: { type: 'GOVERNED_TARGET', governedTarget: {
      branchId: branch, subjectType: 'BRANCH', subjectId: branch, currencyCode: 'EGP', periodGrain: 'MONTH',
    } } });
    TestBed.runInInjectionContext(() => new CompareHarness());
    await flush();
    expect(read).toHaveBeenCalledWith('/targets', expect.objectContaining({ branchId: branch }));
  });

  it('uses the existing error translation and leaves no substitute targets', async () => {
    vi.spyOn(env.stub, 'read').mockRejectedValue(new ApiError(503, 'CRM_TARGET_SOURCE_NOT_READY'));
    env.state.patchQuery({ filters: { branchId: branch } });
    const compare = TestBed.runInInjectionContext(() => new CompareHarness());
    await flush();
    await vi.waitFor(() => expect(compare.loadingForTest).toBe(false));
    expect(compare.targetsForTest).toEqual([]);
    expect(env.notify.error).toHaveBeenCalledTimes(1);
  });

  it('uses live team names and safely handles an empty directory', () => {
    env.state.patchQuery({ comparison: { type: 'DATASETS', basis: 'TEAM', datasets: [] } });
    const compare = TestBed.runInInjectionContext(() => new CompareHarness());
    expect(compare.teamsForTest).toEqual([]);
    expect(compare.addAllowed).toBe(false);
    compare.add();
    env.state.teams.set([{ id: 'team', branchId: branch, name: { en: 'Sales', ar: 'المبيعات' } }]);
    expect(compare.teamsForTest).toEqual([{ value: 'team', label: 'Sales' }]);
  });
});
