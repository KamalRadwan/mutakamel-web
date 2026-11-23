import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { crmQueries } from '../../../shared/crm-http';
import { addWidgetShare, applyLifecycle, cloneWidget, compareVersions, lifecycleImpact, listTransferTargets,
  listVersions, listWidgetShares, previewWidgetShare, restoreVersionToDraft, revokeWidgetShare,
  transferImpact, transferWidget, updateWidgetShare } from '../widgets.api';
import { compareFixture, lifecycleFixture, setupGovernanceTest, shareId, targetId, transferFixture,
  widgetId, widgetPath } from './governance-test-support';

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`WidgetsApi ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupGovernanceTest>;
    beforeEach(() => { setup = setupGovernanceTest(language, theme); });
    afterEach(() => setup.restore());

    it('clone', async () => {
      const key = newIdempotencyKey();
      const clone = await cloneWidget(widgetId, 'Copy', key);
      expect(clone.widgetId).toBe(widgetId);
      expect(setup.stub.recordedWrites().at(-1)).toEqual({ method: 'POST', path: `${widgetPath}/clone`,
        body: { name: 'Copy' }, options: { key } });
      await cloneWidget(widgetId, null, newIdempotencyKey());
      expect(setup.stub.recordedWrites().at(-1)?.body).toEqual({});
    });

    it('links versions and all impact requests without organization headers or polling', async () => {
      await listVersions(widgetId, 3);
      expect(setup.stub.recordedReads().at(-1)).toMatchObject({ path: `${widgetPath}/versions`, query: { beforeVersion: 3 }, scope: undefined });
      await compareVersions(widgetId, 1, 2);
      await lifecycleImpact(widgetId, { action: 'ARCHIVE', expectedWidgetRevision: 7, expectedGovernanceRevision: 3 });
      await transferImpact(widgetId, { targetUserId: targetId, expectedWidgetRevision: 7, expectedGovernanceRevision: 3 });
      expect(setup.stub.recordedWrites().map((w) => w.path)).toEqual([
        `${widgetPath}/versions/compare`, `${widgetPath}/lifecycle-impact`, `${widgetPath}/ownership-transfer/impact`,
      ]);
      expect(setup.stub.recordedWrites()[0].body).toEqual({ leftVersionNumber: 1, rightVersionNumber: 2 });
      for (const request of setup.stub.recordedWrites()) {
        expect(request.options.key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
        expect(request.options.scope).toBeUndefined();
      }
      await crmQueries().invalidateQueries({ queryKey: ['crm-analytics'] });
      expect(setup.stub.recordedWrites()).toHaveLength(3);
      await listTransferTargets(widgetId, ' Recipient ');
      expect(setup.stub.recordedReads().at(-1)).toMatchObject({ path: `${widgetPath}/ownership-transfer/targets`,
        query: { search: 'Recipient', limit: 50 }, scope: undefined });
    });

    it('sends loaded tokens on restores and transfers and cancels/invalidate analytics reads', async () => {
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      const compare = compareFixture();
      const restore = { leftVersionNumber: 1, rightVersionNumber: 2, sourceVersionNumber: 1,
        expectedWidgetRevision: compare.widgetRevision, expectedGovernanceRevision: compare.governanceRevision,
        impactId: compare.proof!.impactId, acknowledged: true as const };
      await restoreVersionToDraft(widgetId, restore);
      const lifecycle = lifecycleFixture();
      await applyLifecycle(widgetId, { action: 'ARCHIVE', impactId: lifecycle.impactId,
        expectedWidgetRevision: lifecycle.widgetRevision, expectedGovernanceRevision: lifecycle.governanceRevision, reason: 'Retired' });
      const transfer = transferFixture();
      await transferWidget(widgetId, { targetUserId: targetId, impactId: transfer.impactId,
        expectedWidgetRevision: transfer.widget.widgetRevision, expectedGovernanceRevision: transfer.widget.governanceRevision,
        reason: 'New owner', acknowledged: true });
      expect(setup.stub.recordedWrites()[0].body).toEqual(restore);
      expect(setup.stub.recordedWrites().at(-1)).toMatchObject({ method: 'PATCH', path: `${widgetPath}/ownership-transfer`,
        body: { expectedWidgetRevision: 7, expectedGovernanceRevision: 3, acknowledged: true } });
      for (const request of setup.stub.recordedWrites()) {
        expect(request.options.key).toBeTruthy();
        expect(request.options.scope).toBeUndefined();
      }
      expect(cancel).toHaveBeenCalledTimes(3);
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics', 'widgets'] });
      expect(invalidate).toHaveBeenCalledTimes(3);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
    });

    it('shares use the loaded share ETag and required revoke reason', async () => {
      await listWidgetShares(widgetId);
      await updateWidgetShare(widgetId, shareId, { accessLevel: 'EDIT' });
      expect(setup.stub.recordedWrites().at(-1)?.options.ifMatch).toBe(`"widget-share:${shareId}:4"`);
      await revokeWidgetShare(widgetId, shareId, 'OWNER_REVOKED');
      expect(setup.stub.recordedWrites().at(-1)).toMatchObject({ method: 'DELETE', path: `${widgetPath}/shares/${shareId}`,
        body: undefined, options: { ifMatch: `"widget-share:${shareId}:5"`, query: { reason: 'OWNER_REVOKED' } } });
      const key = newIdempotencyKey();
      await addWidgetShare(widgetId, { subjectType: 'USER', subjectId: targetId, accessLevel: 'VIEW' }, key);
      expect(setup.stub.recordedWrites().at(-1)?.options.key).toBe(key);
      await previewWidgetShare(widgetId, 'USER', targetId);
      expect(setup.stub.recordedReads().at(-1)).toMatchObject({ path: `${widgetPath}/shares/preview`,
        query: { subjectType: 'USER', subjectId: targetId }, scope: undefined });
      for (const request of setup.stub.recordedWrites()) {
        expect(request.options.key).toBeTruthy();
        expect(request.options.scope).toBeUndefined();
      }
    });

    it.each([0, 401, 503, 409])('retains a lifecycle action key only for an uncertain result (%i)', async (status) => {
      const body = { action: 'ARCHIVE' as const, expectedWidgetRevision: 7, expectedGovernanceRevision: 3,
        impactId: lifecycleFixture().impactId, reason: 'Retired' };
      const normal = setup.stub.respond;
      setup.stub.respond = () => { throw new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK_ERROR'); };
      await expect(applyLifecycle(widgetId, body)).rejects.toBeInstanceOf(ApiError);
      setup.stub.respond = normal;
      await applyLifecycle(widgetId, body);
      expect(setup.stub.recordedWrites().at(-1)?.options.key).toBe(setup.stub.recordedWrites().at(-2)?.options.key);
      setup.stub.respond = () => { throw new ApiError(422, 'GW.IDEM.MISMATCH'); };
      await expect(applyLifecycle(widgetId, body)).rejects.toBeInstanceOf(ApiError);
      const mismatchKey = setup.stub.recordedWrites().at(-1)?.options.key;
      setup.stub.respond = normal;
      await applyLifecycle(widgetId, { ...body, impactId: '019a9d10-0000-7000-8000-000000000095' });
      expect(setup.stub.recordedWrites().at(-1)?.options.key).not.toBe(mismatchKey);
    });
  });
}
