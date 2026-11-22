import { LeadStatus, StageFlag } from '../leads.model';

export interface SelectedRow {
  id: string;
  displayName: string;
  ownerUserId: string | null;
  stageId: string;
  stageFlag: StageFlag;
  status: LeadStatus;
  updatedAt?: string;
}

export const SELECTION_LIMIT = 10000;
export const DELETE_TYPED_CONFIRM_FROM = 50;
export const FALLBACK_PAGE_SIZES = [20, 50, 100];
