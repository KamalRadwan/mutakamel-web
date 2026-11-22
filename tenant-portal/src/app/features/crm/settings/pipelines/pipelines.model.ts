import { OpportunityStageFlag, StageCategory } from '../opportunity-stages/opportunity-stages.model';

export type PipelineAccessMode = 'ALL' | 'RESTRICTED';

export interface PipelineStage {
  id: string;
  pipelineId: string;
  opportunityStageId: string;
  rank: number;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
  isSystem: boolean;
}

export interface PipelineAssignments {
  accessMode: PipelineAccessMode;
  userIds: string[];
  teamIds: string[];
}

export interface Pipeline {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  accessMode: PipelineAccessMode;
  stages: PipelineStage[];
  assignments: PipelineAssignments;
  createdAt: string;
  updatedAt: string;
}

/** PipelineView from the read routes (GET crm/pipelines, GET crm/pipelines/:id): no `assignments`. */
export type PipelineReadView = Omit<Pipeline, 'assignments'>;

export interface AssignmentUserOption {
  id: string;
  label: string;
  status: 'ACTIVE' | 'INVITED';
}

export interface AssignmentTeamOption {
  id: string;
  label: string;
  code: string;
  status: 'ACTIVE';
}

export interface AssignmentOptions {
  users: AssignmentUserOption[];
  teams: AssignmentTeamOption[];
}

export interface CreatePipelineInput {
  code: string;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  isDefault?: boolean;
  stageIds?: string[];
}

export interface UpdatePipelineInput {
  nameAr?: string;
  nameEn?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ReplaceAssignmentsInput {
  accessMode: PipelineAccessMode;
  userIds: string[];
  teamIds: string[];
}

export const PIPELINE_CODE_PATTERN = /^[A-Z][A-Z0-9_-]*$/;
export const PIPELINE_CODE_MAX = 48;
export const PIPELINE_NAME_MAX = 80;
export const PIPELINE_DESCRIPTION_MAX = 2000;
export const PIPELINE_MAX_COUNT = 100;
export const PIPELINE_STAGE_MAX_COUNT = 100;
export const PIPELINE_ASSIGNMENT_MAX_COUNT = 100;
export const PIPELINE_SEARCH_MAX = 80;

export function nameIn(item: { nameAr: string; nameEn: string }, language: string): string {
  return language === 'ar' ? item.nameAr : item.nameEn;
}
