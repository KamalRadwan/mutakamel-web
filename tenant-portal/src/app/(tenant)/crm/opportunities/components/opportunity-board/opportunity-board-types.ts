import type { MoveToTarget } from "@/design-system";
import type { OpportunityCardPatch } from "../../opportunity-card-contract";
import type {
  OpportunityActionCapability, OpportunityBoard, OpportunityCardRecord,
  OpportunityPipeline, OpportunityStage,
} from "../../hooks/pipeline-types";

export interface QuickCreateOpportunityDraft {
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: string;
  currencyCode: string;
  probabilityPercent: string;
  expectedCloseDate: string;
  importance: string;
}

export interface OpportunityExecutiveBoardViewProps {
  pipeline: OpportunityPipeline | null;
  board: OpportunityBoard | null;
  branchId: string | null;
  isLoading: boolean;
  isMutating: boolean;
  loadingStageId: string | null;
  canCreate: boolean;
  createCapability: OpportunityActionCapability | null;
  canUpdate: (item: OpportunityCardRecord) => boolean;
  canDelete: (item: OpportunityCardRecord) => boolean;
  onOpen: (item: OpportunityCardRecord) => void;
  onOpenQuickModal?: (item: OpportunityCardRecord) => void;
  onOpenFullCreate?: (
    stageId?: string,
    draft?: QuickCreateOpportunityDraft,
  ) => void;
  onDelete: (item: OpportunityCardRecord) => void;
  onOpenActivities: (item: OpportunityCardRecord) => void;
  onCardChange: (
    opportunityId: string,
    patch: OpportunityCardPatch,
    item: OpportunityCardRecord,
  ) => void;
  onMoveCard: (
    cardId: string,
    sourceStageId: string,
    destStageId: string,
  ) => void;
  onLoadMoreStage: (stageId: string) => void;
  onRefreshBoard?: () => void;
  onForbidden?: () => void;
}

export interface OpportunityBoardQuickAddProps {
  pipeline: OpportunityPipeline;
  stage: OpportunityStage;
  branchId: string | null;
  createCapability: OpportunityActionCapability;
  onClose: () => void;
  onCreated: () => void;
  onForbidden?: () => void;
  onOpenFullForm: (draft: QuickCreateOpportunityDraft) => void;
}

export interface OpportunityBoardCardProps {
  item: OpportunityCardRecord;
  stage: OpportunityStage;
  isExpanded: boolean;
  canDrag: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onToggleExpand: () => void;
  onOpen: () => void;
  onOpenQuickModal: () => void;
  onDelete: () => void;
  onOpenActivities: () => void;
  onCardChange: (patch: OpportunityCardPatch) => void;
  onMove: (targetStageId: string) => void;
}
