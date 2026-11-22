import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { createLeadStage, listLeadStages, reorderLeadStages, updateLeadStage } from '../lead-stages/lead-stages.api';
import { addPipelineStage } from '../pipelines/pipelines.api';
import { createTag, deleteTag, listTags, updateTag } from '../tags/tags.api';
import { SYSTEM_STAGE_IDS } from './opportunity-stages.fake';
import {
  createOpportunityStage,
  deleteOpportunityStage,
  listOpportunityStages,
  updateOpportunityStage,
} from './opportunity-stages.api';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

const MISSING_ID = '01950000-0000-7000-8000-0000000004ff';
const DEFAULT_PIPELINE_ID = '01950000-0000-7000-8000-000000000201';

describe('opportunity stages, lead stages and tags fakes follow the crm-app code', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('crm/opportunity-stages', () => {
    it('lists system stages first, then by English name', async () => {
      const list = await settle(listOpportunityStages());
      const system = list.filter((stage) => stage.isSystem).map((stage) => stage.nameEn);
      expect(system).toEqual([...system].sort((a, b) => a.localeCompare(b, 'en')));
      const firstCustom = list.findIndex((stage) => !stage.isSystem);
      if (firstCustom >= 0) expect(list.slice(firstCustom).every((stage) => !stage.isSystem)).toBe(true);
    });

    it('validates the body (400) before the 404 and the category rule', async () => {
      const error = await errorOf(updateOpportunityStage(MISSING_ID, { nameAr: '   ' }));
      expect([error?.status, error?.code, error?.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { nameAr: ['is_not_empty'] }]);
      const create = await errorOf(createOpportunityStage({ nameAr: 'أ', nameEn: '', flag: 'DISCOVERY', category: 'IN_PROGRESS' }));
      expect(create?.details).toEqual({ nameEn: ['is_not_empty'] });
    });

    it('answers OPPORTUNITY_STAGE_IN_USE with no details', async () => {
      const created = await settle(
        createOpportunityStage({ nameAr: 'مراجعة', nameEn: 'Review', flag: 'DISCOVERY', category: 'IN_PROGRESS' }),
      );
      await settle(addPipelineStage(DEFAULT_PIPELINE_ID, created.id));
      const error = await errorOf(deleteOpportunityStage(created.id));
      expect([error?.status, error?.code, error?.details]).toEqual([409, 'OPPORTUNITY_STAGE_IN_USE', undefined]);
      const system = await errorOf(updateOpportunityStage(SYSTEM_STAGE_IDS.QUALIFICATION, { isActive: false }));
      expect([system?.status, system?.code]).toEqual([422, 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED']);
    });

    it('treats isActive false on an inactive stage as no deactivation', async () => {
      const created = await settle(
        createOpportunityStage({ nameAr: 'تعليق', nameEn: 'Paused', flag: 'ON_HOLD', category: 'IN_PROGRESS' }),
      );
      await settle(updateOpportunityStage(created.id, { isActive: false }));
      const again = await settle(updateOpportunityStage(created.id, { isActive: false, nameEn: 'Paused 2' }));
      expect(again.nameEn).toBe('Paused 2');
    });
  });

  describe('crm/lead-stages', () => {
    it('answers DTO errors with 400 keyed by field (names are not trimmed by this DTO)', async () => {
      const error = await errorOf(createLeadStage({ nameAr: '', nameEn: 'x'.repeat(81), flag: 'CONTACTED', category: 'IN_PROGRESS' }));
      expect([error?.status, error?.details]).toEqual([400, { nameAr: ['is_not_empty'], nameEn: ['max_length'] }]);
    });

    it('lets OPEN through the DTO and refuses it with 422 LEAD_STAGE_CATEGORY_INVALID before the protected check', async () => {
      const error = await errorOf(createLeadStage({ nameAr: 'أ', nameEn: 'A', flag: 'NEW', category: 'OPEN' }));
      expect([error?.status, error?.code]).toEqual([422, 'LEAD_STAGE_CATEGORY_INVALID']);
      const unknown = await errorOf(
        createLeadStage({ nameAr: 'أ', nameEn: 'A', flag: 'CONTACTED', category: 'OTHER' as unknown as 'IN_PROGRESS' }),
      );
      expect([unknown?.status, unknown?.details]).toEqual([400, { category: ['is_enum'] }]);
    });

    it('validates an update before the 404', async () => {
      const error = await errorOf(updateLeadStage(MISSING_ID, { nameEn: '' }));
      expect([error?.status, error?.details]).toEqual([400, { nameEn: ['is_not_empty'] }]);
      const list = await settle(listLeadStages());
      expect(list[0]?.flag).toBe('NEW');
    });

    it('refuses a reorder with duplicate ids with 400 CRM_VALIDATION_FAILED {orderedIds:[array_unique]}', async () => {
      const ids = (await settle(listLeadStages())).map((stage) => stage.id);
      const duplicated = [...ids.slice(0, -1), ids[0]!];
      const error = await errorOf(reorderLeadStages(duplicated, crypto.randomUUID()));
      expect([error?.status, error?.code, error?.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { orderedIds: ['array_unique'] }]);
      const short = await errorOf(reorderLeadStages(ids.slice(1), crypto.randomUUID()));
      expect([short?.status, short?.code]).toEqual([422, 'LEAD_STAGE_REORDER_INVALID']);
    });
  });

  describe('crm/tags', () => {
    it('answers a blank name or a bad colour with 400 CRM_VALIDATION_FAILED keyed by field', async () => {
      const blank = await errorOf(createTag({ name: '   ' }));
      expect([blank?.status, blank?.code, blank?.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { name: ['is_not_empty'] }]);
      const colour = await errorOf(createTag({ name: 'Colour', backgroundColor: 'red', textColor: '#FFFFFF' }));
      expect(colour?.details).toEqual({ backgroundColor: ['matches'] });
    });

    it('checks the colour pair on the request only (422 CRM_TAG_COLOR_INCOMPLETE), before the 404', async () => {
      const tags = await settle(listTags());
      const coloured = tags.find((tag) => tag.backgroundColor !== null)!;
      const half = await errorOf(updateTag(coloured.id, { backgroundColor: '#112233' }));
      expect([half?.status, half?.code]).toEqual([422, 'CRM_TAG_COLOR_INCOMPLETE']);
      const missing = await errorOf(updateTag(MISSING_ID, { backgroundColor: '#112233' }));
      expect(missing?.code).toBe('CRM_TAG_COLOR_INCOMPLETE');
      const empty = await errorOf(updateTag(MISSING_ID, {}));
      expect(empty?.code).toBe('CRM_TAG_UPDATE_EMPTY');
    });

    it('stores colours upper-cased and clears them with a null pair', async () => {
      const created = await settle(createTag({ name: 'Spec colour', backgroundColor: '#aabbcc', textColor: '#112233' }));
      expect([created.backgroundColor, created.textColor]).toEqual(['#AABBCC', '#112233']);
      const cleared = await settle(updateTag(created.id, { backgroundColor: null, textColor: null }));
      expect([cleared.backgroundColor, cleared.textColor]).toEqual([null, null]);
      await settle(deleteTag(created.id));
    });

    it('sends the detach count as a decimal string array', async () => {
      const tags = await settle(listTags());
      const hot = tags.find((tag) => tag.name === 'Hot lead')!;
      const error = await errorOf(deleteTag(hot.id));
      expect([error?.status, error?.details]).toEqual([422, { count: ['140'] }]);
    });
  });
});
