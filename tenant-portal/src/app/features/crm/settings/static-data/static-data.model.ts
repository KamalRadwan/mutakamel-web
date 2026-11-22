import { Language } from '../../../../core/i18n/language';
import { SettingsTranslator, errorMessage } from '../shared/settings-api';

export type L = { en: string; ar: string };
export type Opt = { value: string; label: L };

export const ENUM_KEYS = [
  'profileTypes',
  'customerStatuses',
  'leadStatuses',
  'leadStageFlags',
  'opportunityStatuses',
  'opportunityStageFlags',
  'customFieldOwnerTypes',
  'customFieldTypes',
  'fieldRequirementOperations',
  'activityTypes',
  'activityStatuses',
] as const;

export type EnumKey = (typeof ENUM_KEYS)[number];
export type AttachmentFamilyKey = 'pdf' | 'images' | 'word' | 'excel' | 'text';

// Backend static-data.service.ts: LIST_PAGE_SIZES, DEFAULT_LIST_PAGE_SIZE, PAGINATION_DEFAULTS.MAX_LIMIT.
export interface StaticDataPagination {
  pageSizes: number[];
  defaultPageSize: number;
  maxPageSize: number;
}

export interface CrmStaticData {
  pagination: StaticDataPagination;
  enums: Record<string, string[]>;
  enumOptions: Record<string, Opt[]>;
  attachmentPolicy: {
    maxSizeBytes: number;
    allowedMimeTypes: Record<AttachmentFamilyKey, string[]>;
    allowedExtensions: Record<AttachmentFamilyKey, string[]>;
    rejectedFamilies: string[];
    familyLabels: Opt[];
    rejectedFamilyLabels: Opt[];
  };
  permissions: string[];
  permissionOptions: Opt[];
  ownerTypeOptions: Opt[];
  eventOptions: Opt[];
  derivedRules: {
    opportunityStatusByStageFlag: {
      WON: 'WON';
      LOST: 'LOST';
      ON_HOLD: 'ON_HOLD';
      default: 'IN_PROGRESS';
    };
    leadConversionCopiesCustomFieldOwnerType: 'LEAD_AND_PARTY';
  };
}

export function labelIn(label: L, lang: Language): string {
  return lang === 'ar' ? label.ar : label.en;
}

export function formatSizeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function translateStaticDataError(error: unknown, t: SettingsTranslator): string {
  return errorMessage(error, 'staticData', t);
}
