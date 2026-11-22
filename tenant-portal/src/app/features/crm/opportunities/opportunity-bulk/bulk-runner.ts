import { TranslocoService } from '@jsverse/transloco';
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
import { newIdempotencyKey } from '../../settings/shared/settings-api';
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
  return tracker.submit(CRM_OPPORTUNITIES_BULK_APP, body);
}

export function submitOpportunityBulkJobDirect(
  body: BulkJobSubmit,
  key = newIdempotencyKey(),
): Promise<BulkJobSubmitResult> {
  return submitBulkJob(CRM_OPPORTUNITIES_BULK_APP, body, key);
}

export function translateOpportunityBulkError(transloco: TranslocoService, code: string | null): string {
  if (code) {
    for (const prefix of ['oppBulk.codes.', 'opportunities.errors.', 'bulkJobs.codes.']) {
      const key = `${prefix}${code}`;
      const translated = transloco.translate(key, { max: OPPORTUNITY_SELECTION_LIMIT });
      if (translated && translated !== key) return translated;
    }
    const shared = opportunitySharedErrorKey(code);
    if (shared) return transloco.translate(shared);
  }
  return transloco.translate('oppBulk.codes.generic');
}
