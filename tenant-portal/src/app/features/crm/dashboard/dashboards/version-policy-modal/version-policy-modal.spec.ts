import { type Signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import type { CoreQuery } from '../../../../../core/api/core-http';
import type { CrmReadOptions } from '../../../shared/crm-http';
import type { VersionBinding } from '../dashboards.model';
import {
  DashboardHttpStub,
  dashboardDetail,
  dashboardId,
  setupDashboardTest,
  widgetId,
} from '../dashboard-page/dashboard-test-support';
import { VersionPolicyModal } from './version-policy-modal';

const placementId = dashboardDetail().placements[0].id;
interface PolicyState {
  loading: Signal<boolean>;
  preview: Signal<unknown>;
  binding: Signal<VersionBinding | null>;
  policy: Signal<string>;
  versionError: Signal<string | null>;
  onPolicyChange(policy: string): void;
  save(): Promise<void>;
}
class PolicyStub extends DashboardHttpStub {
  bindingReads = 0;
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    if (!path.endsWith('/version-policy')) return super.read(path, query, options);
    this.bindingReads++;
    return {
      dashboardId,
      placementId,
      widgetId,
      dashboardRevision: 6 + this.bindingReads,
      widgetRevision: 3,
      governanceRevision: 2,
      versionPolicy: 'FOLLOW_ACTIVE',
      pinnedVersionNumber: null,
      activeVersionNumber: 2,
      selectedVersionNumber: 2,
      placement: { x: 0, y: 0, w: 16, h: 12 },
    } as T;
  }
}
for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`VersionPolicyModal ${language} ${theme}`, () => {
      let setup: ReturnType<typeof setupDashboardTest>;
      let stub: PolicyStub;
      let fixture: ComponentFixture<VersionPolicyModal> | undefined;
      let policy: PolicyState;
      beforeEach(() => {
        stub = new PolicyStub();
        setup = setupDashboardTest(language, theme, stub);
      });
      afterEach(() => {
        fixture?.destroy();
        fixture = undefined;
        setup.restore();
      });
      async function create() {
        fixture = setup.create(VersionPolicyModal);
        fixture.detectChanges();
        policy = fixture.componentInstance as unknown as PolicyState;
        void fixture.componentInstance.open(dashboardId, placementId);
        await vi.waitFor(() => {
          fixture!.detectChanges();
          expect(policy.loading()).toBe(false);
        });
        stub.respond = async (path) => {
          if (path.endsWith('/impact'))
            return {
              current: policy.binding(),
              proposed: {
                versionPolicy: 'PINNED',
                pinnedVersionNumber: 2,
                selectedVersionNumber: 2,
                placement: { x: 0, y: 0, w: 16, h: 12 },
                visualizationType: 'METRIC_CARD',
                changed: true,
                layoutChanged: false,
              },
            };
          throw new ApiError(409, 'CRM_DASHBOARD_PLACEMENT_VERSION_STALE');
        };
      }
      it('stale', async () => {
        await create();
        vi.useFakeTimers();
        policy.onPolicyChange('PINNED');
        await vi.advanceTimersByTimeAsync(599);
        expect(stub.recordedWrites()).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);
        fixture!.detectChanges();
        expect(policy.preview()).not.toBeNull();
        const save = policy.save();
        await vi.advanceTimersByTimeAsync(0);
        fixture!.detectChanges();
        const conflict = fixture!.debugElement.query(By.directive(ConflictDialog));
        expect(conflict.componentInstance.open()).toBe(true);
        (conflict.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();
        await save;
        await vi.advanceTimersByTimeAsync(600);
        fixture!.detectChanges();
        expect(stub.bindingReads).toBe(2);
        expect(policy.binding()?.dashboardRevision).toBe(8);
        expect(policy.policy()).toBe('PINNED');
        const impacts = stub.recordedWrites().filter((write) => write.path.endsWith('/impact'));
        expect(impacts).toHaveLength(2);
        expect(impacts[1].body).toHaveProperty('expectedDashboardRevision', 8);
        for (const field of fixture!.debugElement.queryAll(By.directive(Field)))
          expect(field.componentInstance.hint()).toBeTruthy();
      });
      it('debounces preview and never polls it', async () => {
        await create();
        vi.useFakeTimers();
        policy.onPolicyChange('PINNED');
        policy.onPolicyChange('FOLLOW_ACTIVE');
        policy.onPolicyChange('PINNED');
        await vi.advanceTimersByTimeAsync(600);
        expect(stub.recordedWrites()).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(stub.recordedWrites()).toHaveLength(1);
      });
      it('maps the pinned version validation path to its field', async () => {
        await create();
        vi.useFakeTimers();
        policy.onPolicyChange('PINNED');
        await vi.advanceTimersByTimeAsync(600);
        fixture!.detectChanges();
        stub.respond = async () => {
          throw new ApiError(400, 'CRM_VALIDATION_FAILED', {
            pinnedVersionNumber: ['invalid_value'],
          });
        };
        await policy.save();
        fixture!.detectChanges();
        expect(policy.versionError()).toBe(setup.transloco.translate('dashEdit.invalidVersion'));
        expect(fixture!.nativeElement.textContent).toContain(policy.versionError());
      });
    });
  }
