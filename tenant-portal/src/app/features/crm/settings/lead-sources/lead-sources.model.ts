import { TranslocoService } from '@jsverse/transloco';
import { ApiError, isRetryableWriteError, writeErrorMessage } from '../../../../core/api/api-errors';
import { crmSettingsError } from '../shared/settings-api';

export const LEAD_SOURCE_NAME_MAX = 120;
export const LEAD_SOURCE_LIMIT = 500;
export const LEAD_SOURCE_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const LEAD_SOURCE_ICON_ACCEPT = '.png,.jpg,.jpeg,.ico';

export interface LeadSource {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadSourceInput {
  nameAr: string;
  nameEn: string;
  isActive?: boolean;
}

export interface UpdateLeadSourceInput {
  nameAr?: string;
  nameEn?: string;
  isActive?: boolean;
}

export function nameIn(source: Pick<LeadSource, 'nameAr' | 'nameEn'>, language: string): string {
  return language === 'ar' ? source.nameAr : source.nameEn;
}

export function translateSourceError(error: unknown, transloco: TranslocoService): string {
  const translate = sourceTranslator(transloco);
  return error instanceof ApiError && error.status === 401
    ? writeErrorMessage(error, 'leadSources', translate)
    : crmSettingsError(translate, error, 'leadSources').message;
}

export function sourceError(error: unknown, transloco: TranslocoService) {
  return crmSettingsError(sourceTranslator(transloco), error, 'leadSources');
}

function sourceTranslator(transloco: TranslocoService) {
  return (key: string, params?: Record<string, unknown>): string => {
    const translations = transloco.getTranslation(transloco.getActiveLang());
    return Object.hasOwn(translations, key) ? transloco.translate(key, params) : key;
  };
}

export function keepSourceWriteKey(error: unknown): boolean {
  return isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401);
}
