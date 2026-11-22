import { TranslocoService } from '@jsverse/transloco';
import { errorCodeOf } from '../shared/settings-api';

export const LEAD_SOURCE_NAME_MAX = 120;
export const LEAD_SOURCE_LIMIT = 500;
export const LEAD_SOURCE_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const LEAD_SOURCE_ICON_ACCEPT =
  '.png,.jpg,.jpeg,.ico,image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon';

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
  const code = errorCodeOf(error);
  if (code) {
    const key = `leadSources.errors.${code}`;
    const translated = transloco.translate(key);
    if (translated !== key) {
      return translated;
    }
  }
  return transloco.translate('settings.errors.generic');
}
