import { type Signal, type WritableSignal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Notify } from '../../../../../core/notify/notify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import type { CoreQuery } from '../../../../../core/api/core-http';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import type {
  ShareListItem,
  ShareTarget,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import type { CrmReadOptions } from '../../../shared/crm-http';
import {
  addDashboardShare,
  listDashboardShares,
  previewDashboardShare,
  revokeDashboardShare,
  updateDashboardShare,
} from '../../dashboards/dashboards.api';
import {
  DashboardHttpStub,
  dashboardId,
  setupDashboardTest,
  widgetId,
} from '../../dashboards/dashboard-page/dashboard-test-support';
import { ShareModal, type ShareApi } from './share-modal';

const shareId = '019a9d10-0000-7000-8000-000000000071';
interface ShareState {
  loadingShares: Signal<boolean>;
  shares: Signal<ShareListItem[]>;
  reasonError: Signal<string | null>;
  accessError: Signal<string | null>;
  readOnly: Signal<boolean>;
  selectedTarget: WritableSignal<ShareTarget | null>;
  shareDrafts: Signal<Record<string, string>>;
  chooseTarget(target: ShareTarget): void;
  addShare(): Promise<void>;
  updateAccess(item: ShareListItem, next: 'VIEW' | 'EDIT'): Promise<void>;
  revokeShare(item: ShareListItem): Promise<void>;
  confirmRevoke(): Promise<void>;
}
class ShareStub extends DashboardHttpStub {
  row: ShareListItem & { revision: number } = {
    id: shareId,
    subjectType: 'USER',
    subjectId: widgetId,
    accessLevel: 'VIEW',
    effectiveAccessLevel: 'VIEW',
    revision: 3,
    sharedByUserId: widgetId,
    expiresAt: null,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
    subjectName: 'Sales user',
    subjectEmail: 'sales@example.test',
    context: 'Branch',
    effectiveAccessSource: 'Direct grant',
  };
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    if (path.endsWith('/shares')) return structuredClone([this.row]) as T;
    if (path.endsWith('/shares/preview')) return {} as T;
    return super.read(path, query, options);
  }
}
for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`ShareModal ${language} ${theme}`, () => {
      let setup: ReturnType<typeof setupDashboardTest>;
      let stub: ShareStub;
      let fixture: ComponentFixture<ShareModal> | undefined;
      let modal: ShareState;
      const target = {
        type: 'USER' as const,
        id: widgetId,
        name: 'Sales user',
        branchId: dashboardId,
      };
      beforeEach(() => {
        stub = new ShareStub();
        setup = setupDashboardTest(language, theme, stub);
      });
      afterEach(() => {
        fixture?.destroy();
        fixture = undefined;
        setup.restore();
      });
      async function create() {
        fixture = setup.create(ShareModal);
        fixture.detectChanges();
        modal = fixture.componentInstance as unknown as ShareState;
        const api: ShareApi = {
          list: () => listDashboardShares(dashboardId),
          add: (body, key) => addDashboardShare(dashboardId, body, key),
          update: (id, body) => updateDashboardShare(dashboardId, id, body),
          revoke: (id, reason) => revokeDashboardShare(dashboardId, id, reason),
          targets: async () => [target],
          preview: (type, id) => previewDashboardShare(dashboardId, type, id),
        };
        fixture.componentInstance.open(api, 'Sales', false);
        await vi.waitFor(() => {
          fixture!.detectChanges();
          expect(modal.loadingShares()).toBe(false);
        });
      }
      it('share rules', async () => {
        await create();
        stub.respond = async () => {
          stub.row = {
            ...stub.row,
            revision: 4,
            accessLevel: 'EDIT',
            effectiveAccessLevel: 'EDIT',
          };
          return stub.row;
        };
        await modal.updateAccess(modal.shares()[0], 'EDIT');
        expect(stub.recordedWrites()[0].options.ifMatch).toBe(`"dashboard-share:${shareId}:3"`);
        await modal.revokeShare(modal.shares()[0]);
        fixture!.detectChanges();
        stub.respond = async () => {
          throw new ApiError(422, 'CRM_SHARE_REVOKE_REASON_REQUIRED');
        };
        await modal.confirmRevoke();
        fixture!.detectChanges();
        expect(modal.reasonError()).toBe(setup.transloco.translate('share.reasonRequired'));
        expect(stub.recordedWrites()[1].options).toMatchObject({
          ifMatch: `"dashboard-share:${shareId}:4"`,
          query: { reason: 'OWNER_REVOKED' },
        });
        const reason = fixture!.debugElement
          .queryAll(By.directive(Field))
          .find((field) => field.componentInstance.for() === 'share-revoke-reason');
        expect(reason?.componentInstance.hint()).toBe(
          setup.transloco.translate('share.revokeReasonHint'),
        );
        expect(
          fixture!.nativeElement
            .querySelector('#share-revoke-reason button')
            ?.getAttribute('aria-describedby'),
        ).toContain('share-revoke-reason-hint');
      });
      it('retains a failed grant and its idempotency key', async () => {
        await create();
        modal.selectedTarget.set(target);
        stub.respond = async () => {
          throw new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE');
        };
        await modal.addShare();
        expect(modal.selectedTarget()?.id).toBe(widgetId);
        await modal.addShare();
        const writes = stub.recordedWrites();
        expect(writes).toHaveLength(2);
        expect(writes[1].options.key).toBe(writes[0].options.key);
        expect(writes[1].body).toEqual(writes[0].body);
      });
      it('keeps the access draft while reloading a stale share', async () => {
        await create();
        stub.respond = async () => {
          throw new ApiError(409, 'CRM_SHARE_REVISION_STALE');
        };
        const update = modal.updateAccess(modal.shares()[0], 'EDIT');
        await vi.waitFor(() => {
          fixture!.detectChanges();
          expect(
            fixture!.debugElement.query(By.directive(ConflictDialog)).componentInstance.open(),
          ).toBe(true);
        });
        stub.row.revision = 8;
        (
          fixture!.debugElement
            .query(By.directive(ConflictDialog))
            .nativeElement.querySelectorAll('button')[1] as HTMLButtonElement
        ).click();
        await update;
        fixture!.detectChanges();
        expect(modal.shareDrafts()[shareId]).toBe('EDIT');
        stub.respond = async () => ({ ...stub.row, revision: 9, accessLevel: 'EDIT' });
        await modal.updateAccess(modal.shares()[0], 'EDIT');
        expect(stub.recordedWrites().at(-1)?.options.ifMatch).toBe(
          `"dashboard-share:${shareId}:8"`,
        );
      });
      it('never resends an idempotency mismatch', async () => {
        await create();
        modal.selectedTarget.set(target);
        stub.respond = async () => {
          throw new ApiError(409, 'GW.IDEM.MISMATCH');
        };
        await modal.addShare();
        await modal.addShare();
        expect(stub.recordedWrites()).toHaveLength(1);
      });
      it('maps validation paths to their fields', async () => {
        await create();
        modal.selectedTarget.set(target);
        stub.respond = async () => {
          throw new ApiError(400, 'CRM_VALIDATION_FAILED', { accessLevel: ['invalid_value'] });
        };
        await modal.addShare();
        fixture!.detectChanges();
        expect(modal.accessError()).toBe(setup.transloco.translate('share.invalidAccess'));
        expect(fixture!.nativeElement.querySelector('#share-access-error')?.textContent).toContain(
          modal.accessError(),
        );
      });
      it('keeps the form and key on 401 and blocks writes when the module is disabled', async () => {
        await create();
        modal.selectedTarget.set(target);
        stub.respond = async () => {
          throw new ApiError(401, 'GW.AUTH.UNAUTHORIZED');
        };
        await modal.addShare();
        await modal.addShare();
        expect(stub.recordedWrites()[1].options.key).toBe(stub.recordedWrites()[0].options.key);
        expect(TestBed.inject(Notify).error).toHaveBeenLastCalledWith(
          setup.transloco.translate('share.errors.notSaved'),
        );
        stub.respond = async () => {
          throw new ApiError(403, 'CRM_MODULE_DISABLED');
        };
        await modal.addShare();
        fixture!.detectChanges();
        expect(modal.readOnly()).toBe(true);
        await modal.addShare();
        expect(stub.recordedWrites()).toHaveLength(3);
        expect(TestBed.inject(Notify).error).toHaveBeenLastCalledWith(
          setup.transloco.translate('share.errors.moduleDisabled'),
        );
      });
      it('shows the provisioning state with its permission-gated readiness action', async () => {
        vi.spyOn(stub, 'read').mockRejectedValue(
          new ApiError(503, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE'),
        );
        await create();
        const state = fixture!.debugElement.query(By.directive(FullState))
          .componentInstance as FullState;
        expect(state.kind()).toBe('provisioning');
        expect(state.actionLabel()).toBe(setup.transloco.translate('share.openReadiness'));
        state.action.emit();
        expect(setup.navigate).toHaveBeenCalledWith(['/crm/settings/data-readiness']);
      });
    });
  }
