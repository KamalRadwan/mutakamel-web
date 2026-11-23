import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreHttp } from '../../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { CrmHttp, bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import {
  addDashboardShare,
  addPlacement,
  deleteDashboard,
  duplicateDashboard,
  getScopeInspector,
  getVersionBinding,
  listAddableWidgets,
  listDashboardShares,
  patchDashboard,
  previewDashboardShare,
  previewVersionPolicy,
  removePlacement,
  revokeDashboardShare,
  saveLayout,
  setVersionPolicy,
  transferDashboardOwnership,
  updateDashboardShare,
} from '../dashboards.api';
import { dashboardDetail, dashboardId, widgetId } from './dashboard-test-support';

const base = '/api/tenant/crm/v1';
const shareId = '019a9d10-0000-7000-8000-000000000070';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for (const language of ['en', 'ar'])
  for (const theme of ['light', 'dark']) {
    describe(`DashboardsApi ${language} ${theme}`, () => {
      let http: HttpTestingController;
      let dispose: () => void;
      beforeEach(() => {
        TestBed.configureTestingModule({
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            CoreHttp,
            CrmHttp,
            {
              provide: DOCUMENT,
              useValue: {
                cookie: '__Host-mutakamel-tenant-csrf=edit-csrf',
                location: { protocol: 'https:' },
              },
            },
          ],
        });
        http = TestBed.inject(HttpTestingController);
        crmQueries().clear();
        dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
      });
      afterEach(() => {
        http.verify();
        crmQueries().clear();
        dispose();
        TestBed.resetTestingModule();
      });
      async function request(path: string, method: string): Promise<TestRequest> {
        let found: TestRequest | undefined;
        await vi.waitFor(() => {
          found = http.expectOne((req) => req.url === `${base}${path}` && req.method === method);
        });
        const req = found!.request;
        expect(req.headers.get('x-mutakamel-company-id')).toBeNull();
        expect(req.headers.get('x-mutakamel-branch-id')).toBeNull();
        if (method !== 'GET') {
          expect(req.headers.get('x-idempotency-key')).toMatch(uuidV7);
          expect(req.headers.get('x-csrf-token')).toBe('edit-csrf');
        }
        return found!;
      }
      it('layout save', async () => {
        const detail = dashboardDetail();
        const body = {
          revision: detail.revision,
          breakpointKey: 'desktop' as const,
          items: detail.layouts['desktop'].items,
        };
        const key = newIdempotencyKey();
        const result = saveLayout(dashboardId, body, key);
        const req = await request(`/dashboards/${dashboardId}/layout`, 'PUT');
        expect(req.request.body).toEqual(body);
        expect(req.request.headers.get('x-idempotency-key')).toBe(key);
        expect(req.request.headers.get('If-Match')).toBe(`"dashboard:${dashboardId}:7"`);
        req.flush({ ...detail, revision: 8, adjusted: false });
        expect((await result).revision).toBe(8);
        http.expectNone((req) => req.method === 'PUT');
      });
      it('duplicate', async () => {
        const key = newIdempotencyKey();
        const result = duplicateDashboard(dashboardId, null, key);
        const req = await request(`/dashboards/${dashboardId}/duplicate`, 'POST');
        expect(req.request.body).toEqual({});
        expect(req.request.headers.get('x-idempotency-key')).toBe(key);
        req.flush({ ...dashboardDetail(), duplication: { warnings: [] } });
        expect((await result).duplication.warnings).toEqual([]);
      });
      it('patch revision', async () => {
        const body = {
          revision: 7,
          name: 'Sales updated',
          layoutCollisionMode: 'BLOCK' as const,
          isLayoutLocked: true,
        };
        const result = patchDashboard(dashboardId, body);
        const req = await request(`/dashboards/${dashboardId}`, 'PATCH');
        expect(req.request.headers.get('If-Match')).toBe(`"dashboard:${dashboardId}:7"`);
        expect(req.request.body).toEqual(body);
        const rejected = expect(result).rejects.toMatchObject({
          status: 409,
          code: 'CRM_DASHBOARD_REVISION_CONFLICT',
        });
        req.flush(
          { errorCode: 'CRM_DASHBOARD_REVISION_CONFLICT' },
          { status: 409, statusText: 'Conflict' },
        );
        await rejected;
      });
      it('shares use the loaded share ETag, including revoke reason', async () => {
        const share = {
          id: shareId,
          subjectType: 'USER',
          subjectId: widgetId,
          accessLevel: 'VIEW',
          revision: 3,
        };
        const list = listDashboardShares(dashboardId);
        (await request(`/dashboards/${dashboardId}/shares`, 'GET')).flush([share]);
        await list;
        const update = updateDashboardShare(dashboardId, shareId, { accessLevel: 'EDIT' });
        const patch = await request(`/dashboards/${dashboardId}/shares/${shareId}`, 'PATCH');
        expect(patch.request.headers.get('If-Match')).toBe(`"dashboard-share:${shareId}:3"`);
        patch.flush(
          { ...share, accessLevel: 'EDIT', revision: 4 },
          { headers: { ETag: `"dashboard-share:${shareId}:4"` } },
        );
        await update;
        const revoke = revokeDashboardShare(dashboardId, shareId, 'OWNER_REVOKED');
        const deletion = await request(`/dashboards/${dashboardId}/shares/${shareId}`, 'DELETE');
        expect(deletion.request.headers.get('If-Match')).toBe(`"dashboard-share:${shareId}:4"`);
        expect(deletion.request.params.get('reason')).toBe('OWNER_REVOKED');
        deletion.flush(null);
        await revoke;
      });
      it('links placements, version policy, inspector, grant preview and ownership without organization headers', async () => {
        const detail = dashboardDetail();
        const placement = detail.placements[0];
        const root = `/dashboards/${dashboardId}`;
        const add = addPlacement(dashboardId, { widgetId, w: 16, h: 12 }, newIdempotencyKey());
        (await request(`${root}/placements`, 'POST')).flush({
          ...placement,
          x: 0,
          y: 0,
          w: 16,
          h: 12,
          dashboardRevision: 8,
        });
        await add;
        const remove = removePlacement(dashboardId, placement.id);
        (await request(`${root}/placements/${placement.id}`, 'DELETE')).flush({
          dashboardRevision: 9,
        });
        await remove;
        const binding = getVersionBinding(dashboardId, placement.id);
        (await request(`${root}/placements/${placement.id}/version-policy`, 'GET')).flush({
          dashboardRevision: 9,
        });
        await binding;
        const policy = {
          versionPolicy: 'PINNED' as const,
          pinnedVersionNumber: 1,
          expectedDashboardRevision: 9,
          expectedWidgetRevision: 3,
          expectedGovernanceRevision: 2,
        };
        const impact = previewVersionPolicy(dashboardId, placement.id, policy);
        (await request(`${root}/placements/${placement.id}/version-policy/impact`, 'POST')).flush({
          current: {},
          proposed: {},
        });
        await impact;
        const savePolicy = setVersionPolicy(dashboardId, placement.id, {
          ...policy,
          expectedSelectedVersionNumber: 1,
          expectedPlacement: { x: 0, y: 0, w: 16, h: 12 },
        });
        (await request(`${root}/placements/${placement.id}/version-policy`, 'PATCH')).flush({
          changed: true,
        });
        await savePolicy;
        const inspector = getScopeInspector(dashboardId);
        (await request(`${root}/scope-inspector`, 'GET')).flush({ effectiveLevel: 'EDIT' });
        await inspector;
        const preview = previewDashboardShare(dashboardId, 'USER', widgetId);
        const previewReq = await request(`${root}/shares/preview`, 'GET');
        expect(previewReq.request.params.get('subjectId')).toBe(widgetId);
        previewReq.flush({});
        await preview;
        const grant = addDashboardShare(
          dashboardId,
          { subjectType: 'USER', subjectId: widgetId, accessLevel: 'VIEW' },
          newIdempotencyKey(),
        );
        (await request(`${root}/shares`, 'POST')).flush({ id: shareId, revision: 1 });
        await grant;
        const transfer = transferDashboardOwnership(
          dashboardId,
          { revision: 9, toOwnerUserId: widgetId, reason: 'Owner changed' },
          newIdempotencyKey(),
        );
        const transferReq = await request(`${root}/ownership-transfer`, 'POST');
        expect(transferReq.request.headers.get('If-Match')).toBe(`"dashboard:${dashboardId}:9"`);
        transferReq.flush({ ownerUserId: widgetId });
        await transfer;
        const deletion = deleteDashboard(dashboardId);
        (await request(root, 'DELETE')).flush(null);
        await deletion;
      });
      it('loads only published addable widgets and keeps cursor paging', async () => {
        const result = listAddableWidgets({ search: 'Sales', cursor: 'next' });
        const req = await request('/widgets', 'GET');
        expect(req.request.params.get('status')).toBe('PUBLISHED');
        expect(req.request.params.get('cursor')).toBe('next');
        const widget = dashboardDetail().widgets[0];
        req.flush({ items: [{ ...widget, accessLevel: 'VIEW' }], nextCursor: 'after' });
        expect(await result).toMatchObject({
          items: [{ id: widgetId, accessLevel: 'VIEW' }],
          nextCursor: 'after',
        });
      });
      it.each([0, 401, 503])(
        'retains the implicit key on recoverable status %s',
        async (status) => {
          const body = { revision: 7, name: 'Retry patch' };
          const first = patchDashboard(dashboardId, body);
          const req = await request(`/dashboards/${dashboardId}`, 'PATCH');
          const key = req.request.headers.get('x-idempotency-key');
          const failure = expect(first).rejects.toMatchObject({ status });
          if (status === 0) req.error(new ProgressEvent('offline'));
          else req.flush({ errorCode: 'TEST_FAILURE' }, { status, statusText: 'Failure' });
          await failure;
          const retry = patchDashboard(dashboardId, body);
          const retryReq = await request(`/dashboards/${dashboardId}`, 'PATCH');
          expect(retryReq.request.headers.get('x-idempotency-key')).toBe(key);
          retryReq.flush(dashboardDetail());
          await retry;
        },
      );
    });
  }
