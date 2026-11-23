import { Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { OpportunityRow } from '../opportunities.model';
import { pipeline } from '../opportunity-page/opportunity-test-support';
import { configureListTest, settleList } from '../opportunities-page/opportunities-list-test-support';
import { OpportunityCards } from './opportunity-cards';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('OpportunityCards', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => context = configureListTest(lang, theme));
    afterEach(async () => context.dispose());
    function create() {
      const fixture = TestBed.createComponent(OpportunityCards);
      fixture.componentRef.setInput('pipelineId', pipeline.id);
      fixture.componentRef.setInput('body', { branchId: context.transport.row.branchId });
      fixture.componentRef.setInput('stages', pipeline.stages);
      fixture.componentRef.setInput('capabilities', context.transport.caps);
      return fixture;
    }
    it('loads', async () => {
      const fixture = create();
      await settleList(() => fixture.detectChanges());
      expect(fixture.componentInstance.items()[0].title).toBe(context.transport.row.title);
      expect(fixture.nativeElement.querySelector('app-opportunity-card')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('ui-pagination')).not.toBeNull();
      const writes = context.transport.recordedWrites();
      expect(writes.every((call) => call.path === '/pipelines/pipeline/cards')).toBe(true);
      expect(writes[0].body).toMatchObject({ limit: 50 });
      expect(writes[0].options.key).toBeTruthy();
      expect(writes[0].options.scope).toBeUndefined();
      fixture.componentRef.setInput('page', 2);
      await settleList(() => fixture.detectChanges());
      expect(context.transport.recordedWrites().at(-1)?.body).toMatchObject({ limit: 50, cursor: 'card-next' });
      fixture.destroy();
    });

    it('shows a full load failure with correlation and retry', async () => {
      context.transport.writeErrorsByPath.set('/pipelines/pipeline/cards', new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'cards-503' }));
      const fixture = create();
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('cards-503');
      context.transport.writeErrorsByPath.clear();
      (fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement).click();
      await settleList(() => fixture.detectChanges());
      expect(fixture.componentInstance.items()).toHaveLength(1);
      fixture.destroy();
    });

    it('checks own and team action scope and becomes read-only on a subscription refusal', async () => {
      context.transport.caps.update = { scope: 'own', ownerUserIds: ['someone-else'] };
      const fixture = create();
      await settleList(() => fixture.detectChanges());
      const component = fixture.componentInstance as unknown as {
        canUpdate(row: OpportunityRow): boolean;
        list: { rate(row: OpportunityRow, value: number): Promise<void>; readOnly: Signal<boolean> };
      };
      expect(component.canUpdate(context.transport.row)).toBe(false);
      context.transport.caps.update = { scope: 'team', ownerUserIds: [context.transport.row.ownerUserId!] };
      expect(component.canUpdate(context.transport.row)).toBe(true);
      context.transport.writeErrors.push(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
      await component.list.rate(context.transport.row, 2);
      expect(component.list.readOnly()).toBe(true);
      expect(component.canUpdate(context.transport.row)).toBe(false);
      fixture.destroy();
    });
    it('shows the rate-limit wait in seconds', async () => {
      context.transport.writeErrorsByPath.set('/pipelines/pipeline/cards', new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] }));
      const fixture = create();
      await settleList(() => fixture.detectChanges());
      expect(fixture.nativeElement.querySelector('ui-full-state')?.textContent).toContain('17');
      fixture.destroy();
    });
  });
});
