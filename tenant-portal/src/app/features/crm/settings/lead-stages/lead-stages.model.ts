import { errorCodeOf } from '../shared/settings-api';

export type LeadStageFlag =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONVERTED'
  | 'NURTURING'
  | 'ON_HOLD';

export const LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = [
  'NEW',
  'CONTACTED',
  'QUALIFYING',
  'QUALIFIED',
  'NURTURING',
  'ON_HOLD',
  'DISQUALIFIED',
  'CONVERTED',
];

export const CUSTOM_LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = [
  'CONTACTED',
  'QUALIFYING',
  'QUALIFIED',
  'NURTURING',
  'ON_HOLD',
];

export const PROTECTED_LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = ['NEW', 'DISQUALIFIED', 'CONVERTED'];
export const TERMINAL_LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = ['DISQUALIFIED', 'CONVERTED'];

export type LeadStageCategory = 'IN_PROGRESS' | 'POSITIVE' | 'NEGATIVE';

export const LEAD_STAGE_CATEGORIES: readonly LeadStageCategory[] = ['IN_PROGRESS', 'POSITIVE', 'NEGATIVE'];

export const STAGE_CATEGORY_BADGE: Record<LeadStageCategory | 'OPEN', string> = {
  OPEN: 'bg-brand-soft text-on-brand-soft',
  IN_PROGRESS: 'bg-neutral-soft text-text',
  POSITIVE: 'bg-success-soft text-on-success-soft',
  NEGATIVE: 'bg-danger-soft text-on-danger-soft',
};

export const LEAD_STAGE_NAME_MAX = 80;
export const LEAD_STAGE_LIMIT = 500;

export interface LeadStage {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
  category: LeadStageCategory;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadStageInput {
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
  category: LeadStageCategory | 'OPEN';
  isDefault?: boolean;
}

export interface UpdateLeadStagePatch {
  nameAr?: string;
  nameEn?: string;
  flag?: LeadStageFlag;
  category?: LeadStageCategory | 'OPEN';
  isActive?: boolean;
}

export function isProtectedStage(stage: Pick<LeadStage, 'flag'>): boolean {
  return PROTECTED_LEAD_STAGE_FLAGS.includes(stage.flag);
}

export function isTerminalStage(stage: Pick<LeadStage, 'flag'>): boolean {
  return TERMINAL_LEAD_STAGE_FLAGS.includes(stage.flag);
}

export function stageNameIn(stage: Pick<LeadStage, 'nameAr' | 'nameEn'>, language: string): string {
  return language === 'ar' ? stage.nameAr : stage.nameEn;
}

export function stageErrorMessage(error: unknown, translate: (key: string) => string): string {
  const code = errorCodeOf(error);
  if (code) {
    for (const prefix of ['leadStages.errors.', 'settings.errors.']) {
      const key = `${prefix}${code}`;
      const translated = translate(key);
      if (translated !== key) return translated;
    }
  }
  return translate('settings.errors.generic');
}
