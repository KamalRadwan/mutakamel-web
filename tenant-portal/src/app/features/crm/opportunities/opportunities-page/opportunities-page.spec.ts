import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { branchId, companyId, opportunity } from '../opportunity-page/opportunity-test-support';
import { OpportunityTable } from '../opportunity-table/opportunity-table';
import { OpportunityModal } from '../opportunity-modal/opportunity-modal';
import { OpportunitiesPage } from './opportunities-page';
import { configureListTest, settleList } from './opportunities-list-test-support';

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
])('%s / %s', (lang, theme) => {
  describe('OpportunitiesPage', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => {
      context = configureListTest(lang, theme);
    });
    afterEach(async () => {
      await context.dispose();
    });
    it('no session branch', async () => {
      sessionStorage.setItem(
        'tenant-staff-scope:opportunity-record-spec',
        JSON.stringify({ companyId, branchId: null }),
      );
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'table');
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.textContent).toContain(
        TestBed.inject(TranslocoService).translate('opportunities.page.chooseBranch'),
      );
      expect(context.transport.recordedReads()).toEqual([]);
      expect(context.transport.recordedWrites()).toEqual([]);
      expect(context.environment.core.read).not.toHaveBeenCalled();
    });
    it('links board and cards without the Wave A holding state', async () => {
      const fixture = TestBed.createComponent(OpportunitiesPage);
      for (const view of ['board', 'cards']) {
        fixture.componentRef.setInput('view', view);
        await settleList(() => fixture.detectChanges());
        expect(fixture.nativeElement.textContent).not.toContain(
          TestBed.inject(TranslocoService).translate('opportunities.page.viewUnavailable'),
        );
        expect(fixture.nativeElement.querySelector(view === 'board' ? 'app-opportunity-board' : 'app-opportunity-cards')).not.toBeNull();
        expect(fixture.debugElement.query(By.directive(OpportunityTable))).toBeNull();
        expect(fixture.nativeElement.querySelector('[aria-controls="opportunities-advanced-search"]').disabled).toBe(false);
      }
      const writes = context.transport.recordedWrites();
      expect(writes.some((call) => call.path.endsWith('/board'))).toBe(true);
      expect(writes.some((call) => call.path.endsWith('/cards'))).toBe(true);
      expect(writes.some((call) => call.path === '/opportunities/search')).toBe(false);
    });
    it('shows no pipeline for restricted users and sends no board or card request', async () => {
      vi.spyOn(context.transport, 'read').mockImplementation(async (path, query, options) => {
        if (path === '/pipelines') return [] as never;
        return Object.getPrototypeOf(context.transport).read.call(context.transport, path, query, options);
      });
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'board');
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.textContent).toContain(TestBed.inject(TranslocoService).translate('opportunities.page.noPipeline.title'));
      expect(context.transport.recordedWrites()).toEqual([]);
    });
    it('shows summary read failure with correlation and Retry', async () => {
      context.transport.writeErrorsByPath.set('/pipelines/pipeline/board', new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'summary-503' }));
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'cards');
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.textContent).toContain('summary-503');
      context.transport.writeErrorsByPath.clear();
      (fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement).click();
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('app-opportunity-cards')).not.toBeNull();
    });
    it('retains read-only mode when switching views', async () => {
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'table');
      await settleList(() => fixture.detectChanges());
      const page = fixture.componentInstance as unknown as { writeDenied: { set(value: boolean): void; (): boolean } };
      page.writeDenied.set(true);
      for (const view of ['board', 'cards', 'table']) {
        fixture.componentRef.setInput('view', view);
        await settleList(() => fixture.detectChanges());
        expect(page.writeDenied()).toBe(true);
      }
    });
    it('loads a pipeline-free table and uses scoped capability GET headers', async () => {
      context.transport.readErrors.set(
        '/pipelines',
        new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'),
      );
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'table');
      await settleList(() => fixture.detectChanges());
      const table = fixture.debugElement.query(By.directive(OpportunityTable))
        .componentInstance as OpportunityTable;
      expect(table.items().map((row) => row.id)).toEqual([opportunity().id]);
      const search = context.transport
        .recordedWrites()
        .filter((write) => write.path === '/opportunities/search');
      expect(search.length).toBeGreaterThan(0);
      expect(JSON.stringify(search[0].body)).not.toContain('pipelineId');
      expect((search[0].body as { branchId: string }).branchId).toBe(branchId);
      const reads = context.transport.recordedReads();
      expect(reads.find((read) => read.path === '/opportunities/capabilities')?.scope).toEqual({
        companyId,
        branchId,
      });
      for (const read of reads.filter(
        (read) => !['/opportunities/capabilities', '/assignable-owners'].includes(read.path),
      ))
        expect(read.scope).toBeUndefined();
    });
    it('disables forbidden catalogues with their access hint', async () => {
      context.transport.readErrors.set('/tags', new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'table');
      await settleList(() => fixture.detectChanges());
      const toggle = fixture.nativeElement.querySelector(
        '[aria-controls="opportunities-advanced-search"]',
      ) as HTMLButtonElement;
      toggle.click();
      await settleList(() => fixture.detectChanges());
      const hint = TestBed.inject(TranslocoService).translate(
        'opportunities.search.listRestricted',
      );
      const field = [
        ...(fixture.nativeElement.querySelectorAll('ui-field') as NodeListOf<HTMLElement>),
      ].find((item) =>
        item.textContent?.includes(
          TestBed.inject(TranslocoService).translate('opportunities.search.fields.tags.label'),
        ),
      )!;
      expect(field).toBeDefined();
      const input = field.querySelector('input')!;
      expect(input.disabled).toBe(true);
      expect(input.getAttribute('aria-describedby')).toBeTruthy();
      expect(
        field.querySelector('[data-ui-hint] ng-icon[name="tablerExclamationCircle"]'),
      ).not.toBeNull();
      expect(field.querySelector('[role="tooltip"]')?.textContent).toContain(hint);
    });
    it('keeps New opportunity in the approved quick modal', async () => {
      const open = vi
        .spyOn(OpportunityModal.prototype, 'openCreate')
        .mockImplementation(() => undefined);
      const fixture = TestBed.createComponent(OpportunitiesPage);
      fixture.componentRef.setInput('view', 'table');
      await settleList(() => fixture.detectChanges());
      fixture.componentInstance.openCreate();
      await settleList(() => fixture.detectChanges());
      expect(open).toHaveBeenCalledWith({ pipelineId: 'pipeline' });
    });
  });
});
