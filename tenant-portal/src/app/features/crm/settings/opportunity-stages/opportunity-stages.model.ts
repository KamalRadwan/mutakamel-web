export type OpportunityStageFlag =
  | 'NEW'
  | 'DISCOVERY'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CONTRACTING'
  | 'ON_HOLD'
  | 'WON'
  | 'LOST';

export type StageCategory = 'OPEN' | 'IN_PROGRESS' | 'POSITIVE' | 'NEGATIVE';

export interface OpportunityStage {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityStageInput {
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
}

export interface UpdateOpportunityStageInput {
  nameAr?: string;
  nameEn?: string;
  flag?: OpportunityStageFlag;
  category?: StageCategory;
  isActive?: boolean;
}

export interface StageUsagePipeline {
  id: string;
  nameAr: string;
  nameEn: string;
}

export const OPPORTUNITY_STAGE_FLAGS: readonly OpportunityStageFlag[] = [
  'NEW',
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CONTRACTING',
  'ON_HOLD',
  'WON',
  'LOST',
];

export const STAGE_CATEGORIES: readonly StageCategory[] = ['OPEN', 'IN_PROGRESS', 'POSITIVE', 'NEGATIVE'];

/** Allowed categories per flag: NEW → [OPEN]; WON → [POSITIVE]; LOST → [NEGATIVE]; others → [IN_PROGRESS, POSITIVE, NEGATIVE]. */
export function allowedCategories(flag: OpportunityStageFlag): readonly StageCategory[] {
  switch (flag) {
    case 'NEW':
      return ['OPEN'];
    case 'WON':
      return ['POSITIVE'];
    case 'LOST':
      return ['NEGATIVE'];
    default:
      return ['IN_PROGRESS', 'POSITIVE', 'NEGATIVE'];
  }
}
