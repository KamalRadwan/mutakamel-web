import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { SYSTEM_STAGE_IDS } from '../opportunity-stages/opportunity-stages.fake';
import {
  addPipelineStage,
  assignmentOptions,
  createPipeline,
  deletePipeline,
  getPipelineConfiguration,
  listPipelinesConfiguration,
  listPipelinesForRead,
  removePipelineStage,
  reorderPipelineStages,
  replaceAssignments,
  updatePipeline,
} from './pipelines.api';

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

const DEFAULT_ID = '01950000-0000-7000-8000-000000000201';
const MISSING_ID = '01950000-0000-7000-8000-0000000002ff';

describe('pipelines fake follows crm-app pipelines.controller / pipelines.service', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('GET crm/pipelines (listPipelinesForRead, crm.pipelines.read)', () => {
    it('returns active pipelines ordered by code, without assignments', async () => {
      const list = await settle(listPipelinesForRead());
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((item) => item.isActive)).toBe(true);
      expect(list.every((item) => !('assignments' in item))).toBe(true);
      const codes = list.map((item) => item.code);
      expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b, 'en')));
    });
  });

  describe('POST crm/pipelines', () => {
    it('answers DTO errors with 400 CRM_VALIDATION_FAILED keyed by field, before the code check', async () => {
      const error = await errorOf(createPipeline({ code: 'DEFAULT', nameAr: '  ', nameEn: 'x'.repeat(81) }));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(error?.details).toEqual({ nameAr: ['is_not_empty'], nameEn: ['max_length'] });
    });

    it('rejects a code that breaks the pattern and duplicated stage ids in the pipe', async () => {
      const error = await errorOf(
        createPipeline({
          code: '1BAD',
          nameAr: 'أ',
          nameEn: 'A',
          stageIds: [SYSTEM_STAGE_IDS.NEW, SYSTEM_STAGE_IDS.NEW],
        }),
      );
      expect(error?.status).toBe(400);
      expect(error?.details).toEqual({ code: ['matches'], stageIds: ['array_unique'] });
    });

    it('answers a taken code with 409 PIPELINE_CODE_TAKEN', async () => {
      const error = await errorOf(createPipeline({ code: ' default ', nameAr: 'أ', nameEn: 'A' }));
      expect([error?.status, error?.code]).toEqual([409, 'PIPELINE_CODE_TAKEN']);
    });
  });

  describe('PATCH crm/pipelines/:id', () => {
    it('validates the body before the 404', async () => {
      const error = await errorOf(updatePipeline(MISSING_ID, { nameEn: '' }));
      expect(error?.status).toBe(400);
      expect(Object.keys(fieldErrorsOf(error))).toEqual(['nameEn']);
    });

    it('refuses to deactivate the default pipeline with 422', async () => {
      const error = await errorOf(updatePipeline(DEFAULT_ID, { isActive: false }));
      expect([error?.status, error?.code]).toEqual([422, 'PIPELINE_DEFAULT_DEACTIVATE']);
    });
  });

  describe('DELETE and stage memberships', () => {
    it('answers PIPELINE_STAGE_IN_USE with no details', async () => {
      const error = await errorOf(removePipelineStage(DEFAULT_ID, 'ps-def-2'));
      expect([error?.status, error?.code, error?.details]).toEqual([409, 'PIPELINE_STAGE_IN_USE', undefined]);
    });

    it('answers an unknown membership with 404 PIPELINE_STAGE_NOT_FOUND', async () => {
      const error = await errorOf(removePipelineStage(DEFAULT_ID, 'ps-missing'));
      expect([error?.status, error?.code]).toEqual([404, 'PIPELINE_STAGE_NOT_FOUND']);
    });

    it('refuses to remove a NEW/WON/LOST membership with 422 PIPELINE_STAGE_REQUIRED', async () => {
      const error = await errorOf(removePipelineStage(DEFAULT_ID, 'ps-def-1'));
      expect([error?.status, error?.code]).toEqual([422, 'PIPELINE_STAGE_REQUIRED']);
    });

    it('answers an already assigned stage with 409 before the semantic duplicate', async () => {
      const error = await errorOf(addPipelineStage(DEFAULT_ID, SYSTEM_STAGE_IDS.NEW));
      expect([error?.status, error?.code]).toEqual([409, 'PIPELINE_STAGE_ALREADY_ASSIGNED']);
    });

    it('refuses to delete the default pipeline with 422 PIPELINE_DEFAULT_DELETE', async () => {
      const error = await errorOf(deletePipeline(DEFAULT_ID));
      expect([error?.status, error?.code]).toEqual([422, 'PIPELINE_DEFAULT_DELETE']);
    });
  });

  describe('PATCH crm/pipelines/:id/stages/reorder', () => {
    it('answers an empty or duplicated orderedIds with 400 keyed by orderedIds', async () => {
      const empty = await errorOf(reorderPipelineStages(DEFAULT_ID, [], newIdempotencyKey()));
      expect([empty?.status, empty?.details]).toEqual([400, { orderedIds: ['array_not_empty'] }]);
      const dup = await errorOf(reorderPipelineStages(DEFAULT_ID, ['ps-def-1', 'ps-def-1'], newIdempotencyKey()));
      expect([dup?.status, dup?.details]).toEqual([400, { orderedIds: ['array_unique'] }]);
    });

    it('needs every membership with NEW first (422 PIPELINE_STAGE_REORDER_INVALID), then writes dense ranks', async () => {
      const pipeline = await settle(getPipelineConfiguration(DEFAULT_ID));
      const ids = pipeline.stages.map((stage) => stage.id);
      const partial = await errorOf(reorderPipelineStages(DEFAULT_ID, ids.slice(1), newIdempotencyKey()));
      expect([partial?.status, partial?.code]).toEqual([422, 'PIPELINE_STAGE_REORDER_INVALID']);
      const newLast = await errorOf(reorderPipelineStages(DEFAULT_ID, [...ids.slice(1), ids[0]], newIdempotencyKey()));
      expect(newLast?.code).toBe('PIPELINE_STAGE_REORDER_INVALID');

      const swapped = [ids[0], ids[2], ids[1], ...ids.slice(3)];
      const saved = await settle(reorderPipelineStages(DEFAULT_ID, swapped, newIdempotencyKey()));
      expect(saved.map((stage) => stage.id)).toEqual(swapped);
      expect(saved.map((stage) => stage.rank)).toEqual(swapped.map((_, index) => index + 1));
      await settle(reorderPipelineStages(DEFAULT_ID, ids, newIdempotencyKey()));
    });
  });

  describe('assignments', () => {
    it('lists options sorted by label and refuses a search over 80 characters', async () => {
      const options = await settle(assignmentOptions());
      const labels = options.users.map((user) => user.label.toLowerCase());
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
      const error = await errorOf(assignmentOptions('x'.repeat(81)));
      expect([error?.status, error?.details]).toEqual([400, { search: ['max_length'] }]);
    });

    it('answers PUT with the assignments view, not the pipeline', async () => {
      const list = await settle(listPipelinesConfiguration());
      const created =
        list.find((item) => item.code === 'SPEC-ASSIGN') ??
        (await settle(createPipeline({ code: 'SPEC-ASSIGN', nameAr: 'اختبار', nameEn: 'Spec' })));
      const view = await settle(
        replaceAssignments(created.id, { accessMode: 'RESTRICTED', userIds: ['u2', 'u1'], teamIds: [] }, newIdempotencyKey()),
      );
      expect(view).toEqual({ accessMode: 'RESTRICTED', userIds: ['u1', 'u2'], teamIds: [] });
    });

    it('uses the backend codes for duplicates, bad targets and the default pipeline', async () => {
      const dup = await errorOf(
        replaceAssignments(DEFAULT_ID, { accessMode: 'RESTRICTED', userIds: ['u1', 'u1'], teamIds: [] }, newIdempotencyKey()),
      );
      expect([dup?.status, dup?.details]).toEqual([400, { userIds: ['array_unique'] }]);

      const restricted = await errorOf(
        replaceAssignments(DEFAULT_ID, { accessMode: 'RESTRICTED', userIds: ['u1'], teamIds: [] }, newIdempotencyKey()),
      );
      expect(restricted?.code).toBe('PIPELINE_DEFAULT_RESTRICTED');

      const list = await settle(listPipelinesConfiguration());
      const other = list.find((item) => item.id !== DEFAULT_ID)!;
      const users = await errorOf(
        replaceAssignments(other.id, { accessMode: 'RESTRICTED', userIds: ['nobody'], teamIds: [] }, newIdempotencyKey()),
      );
      expect([users?.status, users?.code]).toEqual([422, 'PIPELINE_ASSIGNMENT_USERS_INVALID']);
      const teams = await errorOf(
        replaceAssignments(other.id, { accessMode: 'RESTRICTED', userIds: [], teamIds: ['nope'] }, newIdempotencyKey()),
      );
      expect(teams?.code).toBe('PIPELINE_ASSIGNMENT_TEAMS_INVALID');
      const mode = await errorOf(replaceAssignments(other.id, { accessMode: 'RESTRICTED', userIds: [], teamIds: [] }, newIdempotencyKey()));
      expect(mode?.code).toBe('PIPELINE_ASSIGNMENTS_INVALID');
    });
  });
});
