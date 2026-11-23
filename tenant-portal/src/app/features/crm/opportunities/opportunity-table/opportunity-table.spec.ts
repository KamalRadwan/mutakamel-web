import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../core/api/api-errors';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { branchId, opportunity } from '../opportunity-page/opportunity-test-support';
import { OpportunitiesPage } from '../opportunities-page/opportunities-page';
import {
  configureListTest,
  settleList,
} from '../opportunities-page/opportunities-list-test-support';
import { OpportunityTable } from './opportunity-table';

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
])('%s / %s', (lang, theme) => {
  describe('OpportunityTable', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => {
      context = configureListTest(lang, theme);
    });
    afterEach(async () => {
      await context.dispose();
    });
    it('pages', async () => {
      const fixture = TestBed.createComponent(OpportunityTable);
      fixture.componentRef.setInput('body', { branchId });
      fixture.componentRef.setInput('stages', []);
      for (const size of [20, 50, 100]) {
        fixture.componentRef.setInput('pageSize', size);
        fixture.componentRef.setInput('page', 2);
        await settleList(() => fixture.detectChanges());
        const sent = context.transport
          .recordedWrites()
          .filter((write) => write.path === '/opportunities/search')
          .at(-1)!;
        expect(sent.body).toMatchObject({ page: 2, limit: size });
        expect(fixture.nativeElement.querySelector('ui-pagination')).not.toBeNull();
      }
    });
    it('opens the real record', async () => {
      const fixture = TestBed.createComponent(OpportunityTable);
      fixture.componentRef.setInput('body', { branchId });
      fixture.componentRef.setInput('stages', []);
      await settleList(() => fixture.detectChanges());
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const page = TestBed.createComponent(OpportunitiesPage);
      fixture.componentInstance.open.subscribe(({ row, nav }) =>
        page.componentInstance.openRecord(row, nav),
      );
      const row = fixture.nativeElement.querySelector('[role="row"][tabindex]') as HTMLElement;
      expect(row).not.toBeNull();
      row.click();
      expect(navigate).toHaveBeenCalledWith(['/crm/opportunities', opportunity().id]);
    });
    it('keeps row edits and refreshes only the stale token', async () => {
      const fixture = TestBed.createComponent(OpportunityTable);
      fixture.componentRef.setInput('body', { branchId });
      fixture.componentRef.setInput('stages', []);
      await settleList(() => fixture.detectChanges());
      context.transport.writeErrors.push(new ApiError(409, 'CRM.OPPORTUNITY.CONCURRENT_UPDATE'));
      const list = fixture.componentInstance.list;
      await list.rate(list.items()[0], 2);
      expect(list.conflict()).not.toBeNull();
      context.transport.row.updatedAt = '2026-11-23T06:00:00.000Z';
      context.transport.row.title = 'Changed by another user';
      await list.resolveConflict(false);
      expect(list.items()[0]).toMatchObject({
        importance: 2,
        updatedAt: context.transport.row.updatedAt,
        title: opportunity().title,
      });
      expect(list.conflict()).toBeNull();
    });
    it('shows full failure and permission states with a correlation id', async () => {
      const fixture = TestBed.createComponent(OpportunityTable);
      fixture.componentRef.setInput('body', { branchId });
      fixture.componentRef.setInput('stages', []);
      context.transport.searchFailure = new ApiError(503, 'SERVER_ERROR', undefined, {
        correlationId: 'list-correlation',
      });
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('list-correlation');
      context.transport.searchFailure = new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
      fixture.componentInstance.list.reload();
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('ui-full-state button')).toBeNull();
    });
    it('offers reload after an idempotency mismatch', async () => {
      const fixture = TestBed.createComponent(OpportunityTable);
      fixture.componentRef.setInput('body', { branchId });
      fixture.componentRef.setInput('stages', []);
      context.transport.searchFailure = new ApiError(422, 'GW.IDEM.MISMATCH');
      await settleList(() => fixture.detectChanges());
      const action = fixture.nativeElement.querySelector(
        'ui-full-state button',
      ) as HTMLButtonElement;
      expect(action.textContent?.trim()).toBe(lang === 'ar' ? 'إعادة التحميل' : 'Reload');
      expect(context.transport.recordedWrites()).toHaveLength(1);
    });
  });
});
