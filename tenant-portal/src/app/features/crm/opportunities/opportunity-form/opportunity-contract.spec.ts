import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindRecordTest, OpportunityTransport, recordTestProviders, opportunity, pipeline } from '../opportunity-page/opportunity-test-support';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { draftFromRow, restoreNonClearableFields, toCreateBody, toPatchBody } from './opportunity-draft';
import { mapOpportunityApiError } from './opportunity-form-errors';
import { OpportunityLookups } from './opportunity-lookups';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  let transport: OpportunityTransport;
  let environment: ReturnType<typeof recordTestProviders>;
  let dispose: () => void;
  beforeEach(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    transport = new OpportunityTransport(); environment = recordTestProviders(transport);
    TestBed.configureTestingModule({ providers: [
      ...environment.providers, OpportunityMoves, OpportunityLookups,
      { provide: Notify, useValue: environment.notify },
      { provide: LanguageState, useValue: { current: signal(lang) } },
      { provide: TranslocoService, useValue: { translate: (key: string) => key, selectTranslate: () => of(''), getTranslation: () => ({}), getActiveLang: () => lang } },
    ] });
    dispose = bindRecordTest(transport);
  });
  afterEach(() => dispose());

  describe('OpportunityForm', () => {
    it('wave A clear rule', () => {
      const base = { ...draftFromRow(opportunity()), description: 'Keep', contactPartyId: 'contact', expectedCloseDate: '2026-12-01', probabilityPercent: '20' };
      const attempted = { ...base, description: '', contactPartyId: null, expectedCloseDate: null, probabilityPercent: '' };
      const result = restoreNonClearableFields(base, attempted);
      expect(result.draft).toEqual(base);
      expect(result.errors).toEqual({ description: 'oppForm.errors.cannotClear', contactPartyId: 'oppForm.errors.cannotClear', expectedCloseDate: 'oppForm.errors.cannotClear', probabilityPercent: 'oppForm.errors.cannotClear' });
      expect(toPatchBody(base, attempted, opportunity().updatedAt)).toBeNull();
      expect(toPatchBody(base, { ...base, amount: '', cardColor: null }, opportunity().updatedAt)).toMatchObject({ amount: null, currencyCode: null });
      expect(toCreateBody({ ...base, tagIds: ['tag'] })).not.toHaveProperty('tagIds');
    });

    it('create errors', () => {
      const cases: Record<string, string> = {
        CUSTOMER_PROFILE_NOT_FOUND: 'customerProfileId', LEAD_NOT_FOUND: 'leadId', PARTY_NOT_FOUND: 'contactPartyId',
        CUSTOMER_PROFILE_BLACKLISTED: 'customerProfileId', OPPORTUNITY_CREATE_STAGE_TERMINAL: 'stageId',
        OPPORTUNITY_OWNER_INELIGIBLE: 'ownerUserId', OPPORTUNITY_LEAD_CUSTOMER_MISMATCH: 'leadId',
        OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH: 'contactPartyId', OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED: 'currencyCode',
        OPPORTUNITY_PIPELINE_MISMATCH: 'stageId', CRM_BRANCH_MISMATCH: 'branchId', OPPORTUNITY_AMOUNT_SCALE_INVALID: 'amount',
      };
      for (const [code, field] of Object.entries(cases)) expect(mapOpportunityApiError(new ApiError(422, code))).toHaveProperty(field);
      expect(mapOpportunityApiError(ApiError.fromResponse(400, { errorCode: 'CRM_VALIDATION_FAILED', details: { title: ['invalid'], 'customFields.region': ['required'] } })))
        .toEqual({ title: 'oppForm.errors.invalid', 'customFields.region': 'oppForm.errors.invalid' });
    });

    it('customer picker without access', () => {
      bindAnalyticsPermissions(() => ['crm.opportunities.read.all']);
      const lookups = TestBed.inject(OpportunityLookups);
      expect(lookups.customerDenied()).toBe(true);
      expect(lookups.saveBlockedReason()).toBe('oppForm.lookups.denied');
    });
  });

  describe('OpportunityMoves', () => {
    it('lost needs a reason', async () => {
      const moves = TestBed.inject(OpportunityMoves);
      const pending = moves.move(opportunity(), pipeline.stages[1]);
      moves.resolveClose({});
      expect(moves.closeError()).toMatchObject({ field: 'note' });
      expect(transport.recordedWrites()).toEqual([]);
      moves.resolveClose({ lostReason: 'Price' });
      expect((await pending).kind).toBe('moved');
      expect(transport.recordedWrites()[0].body).toMatchObject({ lostReason: 'Price', expectedUpdatedAt: opportunity().updatedAt });
      expect(transport.recordedWrites()[0].body).not.toHaveProperty('lostReasonId');
    });

    it('stale move', async () => {
      transport.writeErrors.push(new ApiError(409, 'CRM.OPPORTUNITY.STALE_MOVE'));
      const outcome = await TestBed.inject(OpportunityMoves).move(opportunity(), { ...pipeline.stages[0], id: 'another' });
      expect(outcome).toEqual({ kind: 'failed', code: 'CRM.OPPORTUNITY.STALE_MOVE' });
      expect(environment.notify.error).not.toHaveBeenCalled();
    });

    it('transfer errors', async () => {
      const moves = TestBed.inject(OpportunityMoves);
      const pending = moves.transfer(opportunity(), [pipeline]);
      transport.writeErrors.push(new ApiError(422, 'OPPORTUNITY_PIPELINE_UNCHANGED'));
      moves.resolveTransfer({ pipelineId: pipeline.id, stageId: 'new' });
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(moves.transferError()).toMatchObject({ field: 'pipeline', message: 'oppMoves.transfer.unchanged' });
      transport.writeErrors.push(new ApiError(422, 'OPPORTUNITY_OWNER_INELIGIBLE'));
      moves.resolveTransfer({ pipelineId: 'other', stageId: 'new' });
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      expect(moves.transferError()).toMatchObject({ field: 'pipeline', message: 'oppMoves.transfer.ownerIneligible' });
      moves.resolveTransfer(null); expect(await pending).toEqual({ kind: 'cancelled' });
    });

    it('keeps the close form and key after an uncertain write', async () => {
      const moves = TestBed.inject(OpportunityMoves);
      const pending = moves.move(opportunity(), pipeline.stages[1]);
      transport.writeErrors.push(new ApiError(503, 'SERVER_ERROR'));
      moves.resolveClose({ lostReason: 'Price' });
      for (let index = 0; index < 6; index++) await Promise.resolve();
      expect(moves.closeRequest()).not.toBeNull();
      moves.resolveClose({ lostReason: 'Price' });
      expect((await pending).kind).toBe('moved');
      expect(transport.recordedWrites()[0].options.key).toBe(transport.recordedWrites()[1].options.key);
    });
  });
});
