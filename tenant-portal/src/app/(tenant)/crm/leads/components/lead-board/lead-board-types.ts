import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import type { LeadCardPatch } from "../../lead-card-contract";
import type { CreateLeadRequest, QuickCreateLeadDraft } from "../../lead-create-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";

export interface LeadExecutiveBoardViewProps {
  stages: readonly LeadStage[];
  items: readonly LeadItem[];
  totals?: ReadonlyMap<string, number>;
  branchId: string | null;
  canCreate: boolean;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  isMovePending: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenLead: (lead: LeadItem) => void;
  onOpenQuickModal: (lead: LeadItem) => void;
  onOpenActivities: (lead: LeadItem) => void;
  onDeleteLead: (lead: LeadItem) => void;
  onMoveStage: (leadId: string, toStageId: string, lead?: LeadItem) => void;
  onCardChange: (leadId: string, patch: LeadCardPatch, lead: LeadItem) => void;
  onOpenCreateModal: (stageId: string | null, draft?: QuickCreateLeadDraft) => void;
  onQuickCreateLead: (payload: CreateLeadRequest, rating?: number) => Promise<boolean>;
  hasMoreStage: (stageId: string) => boolean;
  isLoadingMoreStage: (stageId: string) => boolean;
  onLoadMoreStage: (stageId: string) => void;
}

export interface LeadBoardQuickAddProps {
  stage: LeadStage;
  branchId: string;
  sources: ReadonlyArray<AcquisitionSource>;
  onCancel: () => void;
  onOpenFullModal: (draft: QuickCreateLeadDraft) => void;
  onSubmit: (payload: CreateLeadRequest, rating?: number) => Promise<boolean>;
}

