import { NO_ERRORS_SCHEMA, type Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import type { CoreQuery } from '../../../../../core/api/core-http';
import type { CrmReadOptions } from '../../../shared/crm-http';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { DashboardFilters } from '../dashboard-filters/dashboard-filters';
import { EditBar } from '../edit-bar/edit-bar';
import { LayoutEditor } from '../layout-editor';
import { LayoutSaveSession, saveLayoutResolving } from '../layout-save';
import { DashboardPage } from './dashboard-page';
import {
  DashboardHttpStub,
  dashboardDetail,
  dashboardId,
  dashboardRun,
  setupDashboardTest,
} from './dashboard-test-support';

interface EditingPage {
  editor: LayoutEditor;
  pageStatus: Signal<string>;
  editing: Signal<boolean>;
  editSizeError: Signal<string | null>;
  onEnterEditMode(): void;
  onSaveLayout(): Promise<boolean>;
}
class LayoutStub extends DashboardHttpStub {
  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    if (path.endsWith('/version-policy'))
      return {
        dashboardRevision: 9,
        widgetRevision: 3,
        governanceRevision: 2,
      } as T;
    return super.read(path, query, options);
  }
}
for (const language of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark']) {
    describe(`LayoutEditor ${language} ${theme}`, () => {
      let fixture: ComponentFixture<DashboardPage> | undefined;
      let setup: ReturnType<typeof setupDashboardTest>;
      let stub: LayoutStub;
      let page: EditingPage;
      beforeEach(() => {
        stub = new LayoutStub();
        setup = setupDashboardTest(language, theme, stub);
        setup.permissions.push('crm.dashboards.update');
      });
      afterEach(() => {
        fixture?.destroy();
        fixture = undefined;
        setup.restore();
      });
      async function create() {
        TestBed.overrideComponent(DashboardPage, {
          set: {
            imports: [TranslocoPipe, FullState, DashboardFilters, EditBar, ConflictDialog],
            schemas: [NO_ERRORS_SCHEMA],
          },
        });
        fixture = setup.create(DashboardPage);
        page = fixture.componentInstance as unknown as EditingPage;
        fixture.detectChanges();
        await vi.waitFor(() => {
          fixture!.detectChanges();
          expect(page.pageStatus()).toBe('ready');
        });
        page.onEnterEditMode();
        page.editor.apply(
          page.editor.items().map((item, index) => (index === 0 ? { ...item, y: 15 } : item)),
        );
        fixture.detectChanges();
      }
      it('stale layout', async () => {
        stub.respond = async (path) => {
          if (path.endsWith('/layout')) throw new ApiError(409, 'CRM_DASHBOARD_LAYOUT_STALE');
          return dashboardRun();
        };
        await create();
        const moved = page.editor.payload();
        const save = page.onSaveLayout();
        await vi.waitFor(() => {
          fixture!.detectChanges();
          expect(
            fixture!.debugElement.query(By.directive(ConflictDialog)).componentInstance.open(),
          ).toBe(true);
        });
        const dialog = fixture!.debugElement.query(By.directive(ConflictDialog));
        (dialog.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();
        expect(await save).toBe(false);
        expect(page.editing()).toBe(true);
        expect(page.editor.payload()).toEqual(moved);
        expect(page.editor.dirty()).toBe(true);
        expect(
          stub.recordedWrites().filter((write) => write.path.endsWith('/layout')),
        ).toHaveLength(1);
      });
      it('layout codes', async () => {
        await create();
        const moved = page.editor.payload();
        for (const code of [
          'CRM_DASHBOARD_LAYOUT_OVERLAP',
          'CRM_DASHBOARD_LAYOUT_LOCKED',
          'CRM_DASHBOARD_PLACEMENT_LAYOUT_LIMIT',
          'CRM_DASHBOARD_LAYOUT_POSITION_INVALID',
          'CRM_DASHBOARD_LAYOUT_SIZE_INVALID',
          'CRM_DASHBOARD_BREAKPOINT_UNKNOWN',
          'CRM_DASHBOARD_WIDGET_LIMIT',
          'CRM_DASHBOARD_PLACEMENT_LIMIT',
        ]) {
          stub.respond = async () => {
            throw new ApiError(422, code);
          };
          expect(await page.onSaveLayout()).toBe(false);
          fixture!.detectChanges();
          expect(page.editSizeError()).toBe(setup.transloco.translate(`dashEdit.errors.${code}`));
          expect(fixture!.nativeElement.textContent).toContain(page.editSizeError());
          expect(page.editor.payload()).toEqual(moved);
          expect(page.editing()).toBe(true);
        }
      });
      it('retries a failed PUT with the same key and body; changed boxes get a new key', async () => {
        const session = new LayoutSaveSession();
        const items = dashboardDetail().layouts['desktop'].items;
        stub.respond = async () => {
          throw new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE');
        };
        const confirm = { open: vi.fn(async () => true) };
        await expect(
          saveLayoutResolving(dashboardId, 7, items, confirm, undefined, session),
        ).rejects.toMatchObject({ status: 503 });
        await expect(
          saveLayoutResolving(dashboardId, 7, items, confirm, undefined, session),
        ).rejects.toMatchObject({ status: 503 });
        let writes = stub.recordedWrites();
        expect(writes[1].options.key).toBe(writes[0].options.key);
        expect(writes[1].body).toEqual(writes[0].body);
        await expect(
          saveLayoutResolving(
            dashboardId,
            7,
            items.map((item) => ({ ...item, y: 20 })),
            confirm,
            undefined,
            session,
          ),
        ).rejects.toMatchObject({ status: 503 });
        writes = stub.recordedWrites();
        expect(writes[2].options.key).not.toBe(writes[1].options.key);
      });
      it('keeps a successful placement after a later save failure', async () => {
        const session = new LayoutSaveSession();
        const tempId = 'local-1';
        const placement = dashboardDetail().placements[0];
        stub.respond = async (path) =>
          path.endsWith('/placements')
            ? { ...placement, dashboardRevision: 8 }
            : Promise.reject(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
        const items = [
          { placementId: tempId, x: 0, y: 0, w: 16, h: 12, zIndex: 0, isHidden: false },
        ];
        const plan = {
          removedPlacementIds: [],
          adds: [{ tempId, widgetId: placement.widgetId, pinnedVersionNumber: null }],
        };
        for (let i = 0; i < 2; i++)
          await expect(
            saveLayoutResolving(dashboardId, 7, items, { open: async () => false }, plan, session),
          ).rejects.toMatchObject({ status: 503 });
        expect(
          stub.recordedWrites().filter((write) => write.path.endsWith('/placements')),
        ).toHaveLength(1);
        expect((stub.recordedWrites().at(-1)!.body as { revision: number }).revision).toBe(8);
      });
      it('places validation feedback on the layout while preserving boxes', async () => {
        await create();
        const moved = page.editor.payload();
        stub.respond = async () => {
          throw new ApiError(400, 'CRM_VALIDATION_FAILED', { 'items.0.w': ['out_of_range'] });
        };
        expect(await page.onSaveLayout()).toBe(false);
        fixture!.detectChanges();
        expect(page.editSizeError()).toBe(setup.transloco.translate('dashEdit.layoutValidation'));
        expect(page.editor.payload()).toEqual(moved);
      });
      it('preserves the chosen pinned version after a failed layout and placement-id reconciliation', async () => {
        const session = new LayoutSaveSession();
        const placement = dashboardDetail().placements[0];
        const box = {
          placementId: 'local-pinned',
          x: 0,
          y: 0,
          w: 16,
          h: 12,
          zIndex: 0,
          isHidden: false,
        };
        stub.respond = async (path) =>
          path.endsWith('/placements')
            ? { ...placement, dashboardRevision: 8 }
            : Promise.reject(new ApiError(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID'));
        await expect(
          saveLayoutResolving(
            dashboardId,
            7,
            [box],
            { open: async () => false },
            {
              removedPlacementIds: [],
              adds: [
                { tempId: box.placementId, widgetId: placement.widgetId, pinnedVersionNumber: 1 },
              ],
            },
            session,
          ),
        ).rejects.toMatchObject({ code: 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID' });
        stub.respond = async (path) =>
          path.endsWith('/layout')
            ? { ...dashboardDetail(), revision: 9, adjusted: false }
            : path.endsWith('/impact')
              ? { proposed: { selectedVersionNumber: 1, placement: { x: 0, y: 0, w: 16, h: 12 } } }
              : { changed: true, dashboardRevision: 10 };
        await saveLayoutResolving(
          dashboardId,
          8,
          [{ ...box, placementId: placement.id }],
          { open: async () => false },
          { removedPlacementIds: [], adds: [] },
          session,
        );
        const policy = stub
          .recordedWrites()
          .find((write) => write.path.endsWith('/version-policy') && write.method === 'PATCH');
        expect(policy?.body).toHaveProperty('pinnedVersionNumber', 1);
        expect(
          stub.recordedWrites().filter((write) => write.path.endsWith('/placements')),
        ).toHaveLength(1);
      });
    });
  }
