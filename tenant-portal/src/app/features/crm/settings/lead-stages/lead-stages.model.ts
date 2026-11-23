import { ApiError } from '../../../../core/api/api-errors';
import type { TranslocoService } from '@jsverse/transloco';
import type { SettingsTranslator } from '../shared/settings-api';
import { crmSettingsError } from '../shared/settings-api';

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

export const PROTECTED_LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = [
  'NEW',
  'DISQUALIFIED',
  'CONVERTED',
];
export const TERMINAL_LEAD_STAGE_FLAGS: readonly LeadStageFlag[] = ['DISQUALIFIED', 'CONVERTED'];

export type LeadStageCategory = 'IN_PROGRESS' | 'POSITIVE' | 'NEGATIVE';

export const LEAD_STAGE_CATEGORIES: readonly LeadStageCategory[] = [
  'IN_PROGRESS',
  'POSITIVE',
  'NEGATIVE',
];

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

export function stageErrorMessage(error: unknown, translate: SettingsTranslator): string {
  const t = typeof translate === 'function' ? translate : translate.translate.bind(translate);
  if (error instanceof ApiError && error.status === 401) return t('settings.errors.notSaved');
  if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'];
    return seconds
      ? t('settings.errors.rateLimitedIn', {
          seconds: Array.isArray(seconds) ? seconds[0] : seconds,
        })
      : t('settings.errors.rateLimited');
  }
  return crmSettingsError(translate, error, 'leadStages').message;
}

/** Shared error lookup probes fallbacks; absent keys are not missing UI translations. */
export function stageErrorTranslator(transloco: TranslocoService): SettingsTranslator {
  return (key, params) =>
    Object.hasOwn(transloco.getTranslation(transloco.getActiveLang()), key)
      ? transloco.translate(key, params)
      : key;
}
