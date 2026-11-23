import { TranslocoService } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { ApiError, errorCodeOf, fieldErrorsOf, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { submitBulkJob } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import {
  BulkJobSelection,
  BulkJobSubmit,
  BulkJobSubmitResult,
} from '../../../../shared/bulk-jobs/bulk-jobs.model';
import {
  ActivityDirection,
  ActivityPriority,
  ActivityType,
} from '../../../../shared/widgets/activities/activities.model';
import { selectionBranchMismatch } from '../../shared/lookups/selection-branch';
import { crmQueries } from '../../shared/crm-http';
import { opportunitySharedErrorKey } from '../opportunities.api';
import { BatchAssigneeMode, BatchOrder } from './activity-modal/bulk-schedule';
import { OPPORTUNITY_SELECTION_LIMIT } from './opportunity-selection';

export const CRM_OPPORTUNITIES_BULK_APP = 'crm' as const;
export const CRM_OPPORTUNITIES_BULK_MODULE_ID = 'crm.opportunities' as const;

export interface AssignOpportunityBulkParams {
  ownerUserId: string;
}

export interface MoveStageOpportunityBulkParams {
  pipelineId: string;
  stageId: string;
  winReasonId?: string;
  lostReasonId?: string;
  lostReason?: string;
  reason?: string;
}

export interface CreateActivityOpportunityCommonParams {
  type: ActivityType;
  subject: string;
  description?: string | null;
  direction?: ActivityDirection | null;
  priority?: ActivityPriority;
  reminderOffsetMinutes?: number | null;
  location?: string | null;
  meetingUrl?: string | null;
  durationMinutes: number | null;
}

export type CreateActivityOpportunityAssignee =
  | { mode: 'LEAD_OWNER' }
  | { mode: 'ME' }
  | { mode: 'USER'; userId: string };

// Wire shape of the backend strict schedule schema (crm-leads-bulk.schemas.ts).
export interface CreateActivityOpportunityScheduleParams {
  startAt: string;
  gapMinutes: number;
  order: 'TABLE' | 'OWNER';
  assignee: CreateActivityOpportunityAssignee;
  spacePerAssignee: boolean;
}

export interface CreateActivityOpportunityBulkParams {
  activity: CreateActivityOpportunityCommonParams;
  schedule: CreateActivityOpportunityScheduleParams;
}

export interface ActivityScheduleFormValue {
  startAt: string;
  gapMinutes: number;
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  assigneeUserId?: string;
  spacePerAssignee: boolean;
}

export function toWireActivitySchedule(form: ActivityScheduleFormValue): CreateActivityOpportunityScheduleParams {
  const assignee: CreateActivityOpportunityAssignee =
    form.assigneeMode === 'other'
      ? { mode: 'USER', userId: form.assigneeUserId ?? '' }
      : form.assigneeMode === 'me'
        ? { mode: 'ME' }
        : { mode: 'LEAD_OWNER' };
  return {
    startAt: form.startAt,
    gapMinutes: form.gapMinutes,
    order: form.order === 'owner' ? 'OWNER' : 'TABLE',
    assignee,
    spacePerAssignee: form.assigneeMode === 'owner' ? form.spacePerAssignee : false,
  };
}

export interface DeleteOpportunityBulkParams {
  reason?: string;
}

export function opportunityBulkScope(branchId: string): { branchId?: string } {
  const clean = branchId.trim();
  return clean ? { branchId: clean } : {};
}

export function buildAssignBulkJob(
  branchId: string,
  selection: BulkJobSelection,
  params: AssignOpportunityBulkParams,
): BulkJobSubmit {
  return {
    module: CRM_OPPORTUNITIES_BULK_MODULE_ID,
    action: 'ASSIGN',
    scope: opportunityBulkScope(branchId),
    selection,
    params: {
      ownerUserId: params.ownerUserId,
    },
  };
}

/**
 * Stage-modal params for MOVE_STAGE. LOST: lostReasonId (+ note as reason) or the note as lostReason.
 * WON and every normal stage: optional winReasonId (WON only) and the typed note as reason (backend accepts it).
 */
export function moveStageParamsFor(
  stage: { id: string; flag: string },
  pipelineId: string,
  reasonId: string,
  note: string,
): MoveStageOpportunityBulkParams {
  const id = reasonId.trim();
  const trimmedNote = note.trim();
  if (stage.flag === 'LOST') {
    return id
      ? { pipelineId, stageId: stage.id, lostReasonId: id, ...(trimmedNote ? { reason: trimmedNote } : {}) }
      : { pipelineId, stageId: stage.id, lostReason: trimmedNote };
  }
  return {
    pipelineId,
    stageId: stage.id,
    ...(stage.flag === 'WON' && id ? { winReasonId: id } : {}),
    ...(trimmedNote ? { reason: trimmedNote } : {}),
  };
}

export function buildMoveStageBulkJob(
  branchId: string,
  selection: BulkJobSelection,
  params: MoveStageOpportunityBulkParams,
): BulkJobSubmit {
  return {
    module: CRM_OPPORTUNITIES_BULK_MODULE_ID,
    action: 'MOVE_STAGE',
    scope: opportunityBulkScope(branchId),
    selection,
    params: {
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      ...(params.winReasonId ? { winReasonId: params.winReasonId } : {}),
      ...(params.lostReasonId ? { lostReasonId: params.lostReasonId } : {}),
      ...(params.lostReason ? { lostReason: params.lostReason } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
    },
  };
}

export function buildCreateActivityBulkJob(
  branchId: string,
  selection: BulkJobSelection,
  params: CreateActivityOpportunityBulkParams,
): BulkJobSubmit {
  return {
    module: CRM_OPPORTUNITIES_BULK_MODULE_ID,
    action: 'CREATE_ACTIVITY',
    scope: opportunityBulkScope(branchId),
    selection,
    params: {
      activity: params.activity,
      schedule: params.schedule,
    },
  };
}

export function buildDeleteBulkJob(
  branchId: string,
  selection: BulkJobSelection,
  params?: DeleteOpportunityBulkParams,
): BulkJobSubmit {
  const cleanReason = params?.reason?.trim();
  return {
    module: CRM_OPPORTUNITIES_BULK_MODULE_ID,
    action: 'DELETE',
    scope: opportunityBulkScope(branchId),
    selection,
    params: cleanReason ? { reason: cleanReason } : {},
  };
}

export function submitOpportunityBulkJob(
  tracker: BulkJobsTracker,
  body: BulkJobSubmit,
): Promise<BulkJobSubmitResult> {
  assertOpportunityBulkBranch(body);
  return tracker.submit(CRM_OPPORTUNITIES_BULK_APP, body, { idempotencyKey: newIdempotencyKey() });
}

export function submitOpportunityBulkJobDirect(
  body: BulkJobSubmit,
  key = newIdempotencyKey(),
): Promise<BulkJobSubmitResult> {
  assertOpportunityBulkBranch(body);
  return submitBulkJob(CRM_OPPORTUNITIES_BULK_APP, body, key);
}

function assertOpportunityBulkBranch(body: BulkJobSubmit): void {
  const branchId = body.scope.branchId ?? '';
  // Opportunities uses flat search filters on the wire; XR-LK checks the Leads search wrapper.
  const selection: BulkJobSelection = body.selection.kind === 'QUERY'
    ? { ...body.selection, query: { search: body.selection.query } }
    : body.selection;
  if (!branchId || selectionBranchMismatch(selection, branchId)) {
    throw new ApiError(403, 'BRANCH_SCOPE_MISMATCH');
  }
}

/** One modal intent: keep its exact key/body on an uncertain response, until success or an edit. */
export class OpportunityBulkSubmission {
  private pending: { bodyJson: string; key: string } | null = null;
  private mismatch: ApiError | null = null;
  readonly readOnly = signal(false);

  reset(): void {
    this.pending = null;
  }

  async submit(tracker: BulkJobsTracker, body: BulkJobSubmit): Promise<BulkJobSubmitResult> {
    if (this.mismatch) throw this.mismatch;
    assertOpportunityBulkBranch(body);
    const bodyJson = JSON.stringify(body);
    const request = this.pending?.bodyJson === bodyJson
      ? this.pending : { bodyJson, key: newIdempotencyKey() };
    this.pending = request;
    try {
      // NONE: only scope.branchId in the body; shared Staff transport owns the HTTP request.
      const result = await tracker.submit('crm', JSON.parse(request.bodyJson), { idempotencyKey: request.key });
      this.pending = null;
      await crmQueries().cancelQueries({ queryKey: ['crm-opportunities'] });
      await crmQueries().invalidateQueries({ queryKey: ['crm-opportunities'] });
      return result;
    } catch (error) {
      const code = errorCodeOf(error);
      if (error instanceof ApiError && (code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH'))) {
        this.mismatch = error;
      }
      if (['CRM_OPPORTUNITIES_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(code ?? '')) {
        this.readOnly.set(true);
      }
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pending = null;
      throw error;
    }
  }
}

export function opportunityBulkErrorMessage(transloco: TranslocoService, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return transloco.translate('apiErrors.notSaved');
    if (error.status === 429) {
      const seconds = error.details?.['retryAfterSeconds'];
      return Array.isArray(seconds) && typeof seconds[0] === 'string'
        ? transloco.translate('apiErrors.rateLimitedIn', { seconds: seconds[0] })
        : transloco.translate('apiErrors.rateLimited');
    }
    if (error.code === 'BULK_SELECTION_TOO_LARGE' || error.code === 'OPPORTUNITY_SELECTION_TOO_LARGE') {
      const max = error.details?.['max'];
      return transloco.translate('oppBulk.codes.OPPORTUNITY_SELECTION_TOO_LARGE', {
        max: Array.isArray(max) && typeof max[0] === 'string' ? max[0] : OPPORTUNITY_SELECTION_LIMIT,
      });
    }
  }
  return translateOpportunityBulkError(transloco, errorCodeOf(error));
}

export function opportunityBulkFieldError(transloco: TranslocoService, error: unknown, ...paths: string[]): string | null {
  const fields = fieldErrorsOf(error);
  return paths.some((path) => path in fields || `params.${path}` in fields)
    ? transloco.translate('apiErrors.validation') : null;
}

export function translateOpportunityBulkError(transloco: TranslocoService, code: string | null): string {
  if (code === 'BRANCH_SCOPE_MISMATCH') code = 'CRM_BRANCH_MISMATCH';
  if (code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH')) {
    return transloco.translate('apiErrors.idempotencyMismatch');
  }
  if (code) {
    const translations = transloco.getTranslation(transloco.getActiveLang());
    for (const prefix of ['oppBulk.codes.', 'opportunities.errors.', 'bulkJobs.codes.']) {
      const key = `${prefix}${code}`;
      if (!(key in translations)) continue;
      const translated = transloco.translate(key, { max: OPPORTUNITY_SELECTION_LIMIT });
      if (translated && translated !== key) return translated;
    }
    const shared = opportunitySharedErrorKey(code);
    if (shared) return transloco.translate(shared);
  }
  return transloco.translate('oppBulk.codes.generic');
}
