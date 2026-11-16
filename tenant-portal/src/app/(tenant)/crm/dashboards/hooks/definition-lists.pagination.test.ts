// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantApiClientError } from '@/lib/api/axiosClient';
import { useDashboards } from './useDashboards';
import { useWidgets } from '../../widgets/hooks/useWidgets';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useTenantAuth: () => ({ user: { id: "01900300-0000-7000-8000-000000000001", permissions: ["crm.widgets.read"] }, realtimeAuthGeneration: 1 }) }));
vi.mock('@/design-system', () => ({ hasPermission: (_grants: string[], key: string) => key === "crm.widgets.read" }));
vi.mock('@/lib/api/axiosClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/axiosClient')>()), axiosClient: { get },
}));

const firstId = '01900300-0000-7000-8000-000000000002';
const secondId = '01900300-0000-7000-8000-000000000001';
const definition = {
  id: firstId, ownerUserId: firstId, name: 'First', revision: 1,
  createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z', accessLevel: 'OWNER',
  visualizationType: 'METRIC_CARD', querySpec: { series: [{ metricKey: 'crm.leads.created.count' }] },
  displaySpec: {}, schemaVersion: 1,
};
const catalog = { grid: {}, visualizations: [], metrics: [], dimensions: [], templates: [] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe.each([
  { resource: 'dashboards', useList: () => useDashboards(true) },
  { resource: 'widgets', useList: useWidgets },
])('$resource cursor list', ({ resource, useList }) => {
  it('loads on demand, retains a failed page for retry, and resets after reload', async () => {
    const path = `/api/tenant/crm/v1/${resource}`;
    const item = resource === 'widgets' ? {
      ...definition, ownerName: null, isShared: false, governanceRevision: 1,
      status: 'PUBLISHED', versionNumber: 1, hasDraft: false, draftRevision: null,
    } : definition;
    let failPage = true;
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/catalog')) return { status: 200, data: catalog };
      if (url === path) return { status: 200, data: { items: [item], nextCursor: firstId } };
      if (failPage) throw new TenantApiClientError('Failed', {
        status: 500, statusText: 'Internal Server Error', headers: new Headers(), data: {},
      });
      return { status: 200, data: { items: [{ ...item, id: secondId, name: 'Second' }], nextCursor: null } };
    });
    const { result } = renderHook(() => useList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual([firstId]);
    expect(result.current.hasMore).toBe(true);
    expect(get.mock.calls.some(([url]) => String(url).includes('?cursor='))).toBe(false);

    await act(async () => { await result.current.loadMore(); });
    expect(result.current.queryError?.status).toBe(500);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
    failPage = false;
    await act(async () => { await result.current.loadMore(); });
    expect(get).toHaveBeenCalledWith(`${path}?cursor=${firstId}`, expect.any(Object));
    expect(result.current.items.map((item) => item.id)).toEqual([firstId, secondId]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.queryError).toBeNull();

    await act(async () => { await result.current.reload(); });
    expect(result.current.items.map((item) => item.id)).toEqual([firstId]);
    expect(result.current.hasMore).toBe(true);
  });
});


