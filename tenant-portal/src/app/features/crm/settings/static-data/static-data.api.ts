import { crmHttp, crmQueries } from '../../shared/crm-http';
import { AttachmentFamilyKey, CrmStaticData, Opt, StaticDataPagination } from './static-data.model';

function sanitizeOptions(list: readonly Opt[] | undefined): Opt[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const clean: Opt[] = [];
  for (const item of list) {
    const value = typeof item?.value === 'string' ? item.value.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const en = typeof item.label?.en === 'string' && item.label.en.trim() ? item.label.en : value;
    const ar = typeof item.label?.ar === 'string' && item.label.ar.trim() ? item.label.ar : value;
    clean.push({ value, label: { en, ar } });
  }
  return clean;
}

function sanitizeValues(list: readonly string[] | undefined): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of list) {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    clean.push(value);
  }
  return clean;
}

function sanitizeFamilyRecord(
  record: Partial<Record<AttachmentFamilyKey, string[]>> | undefined,
): Record<AttachmentFamilyKey, string[]> {
  return {
    pdf: sanitizeValues(record?.pdf),
    images: sanitizeValues(record?.images),
    word: sanitizeValues(record?.word),
    excel: sanitizeValues(record?.excel),
    text: sanitizeValues(record?.text),
  };
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function sanitizePagination(raw: Partial<StaticDataPagination> | undefined): StaticDataPagination {
  const maxPageSize = positiveInt(raw?.maxPageSize) ?? 100;
  const pageSizes = Array.isArray(raw?.pageSizes)
    ? raw.pageSizes.filter((size): size is number => positiveInt(size) !== null && size <= maxPageSize)
    : [];
  const sizes = pageSizes.length > 0 ? pageSizes : [maxPageSize];
  const requestedDefault = positiveInt(raw?.defaultPageSize);
  const defaultPageSize = requestedDefault !== null && sizes.includes(requestedDefault) ? requestedDefault : sizes[0];
  return { pageSizes: sizes, defaultPageSize, maxPageSize };
}

export function sanitizeStaticData(raw: CrmStaticData): CrmStaticData {
  const enums: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(raw.enums ?? {})) {
    enums[key] = sanitizeValues(list);
  }

  const enumOptions: Record<string, Opt[]> = {};
  for (const [key, list] of Object.entries(raw.enumOptions ?? {})) {
    enumOptions[key] = sanitizeOptions(list);
  }

  const maxSizeBytes =
    typeof raw.attachmentPolicy?.maxSizeBytes === 'number' &&
    Number.isFinite(raw.attachmentPolicy.maxSizeBytes) &&
    raw.attachmentPolicy.maxSizeBytes > 0
      ? raw.attachmentPolicy.maxSizeBytes
      : 0;

  return {
    pagination: sanitizePagination(raw.pagination),
    enums,
    enumOptions,
    attachmentPolicy: {
      maxSizeBytes,
      allowedMimeTypes: sanitizeFamilyRecord(raw.attachmentPolicy?.allowedMimeTypes),
      allowedExtensions: sanitizeFamilyRecord(raw.attachmentPolicy?.allowedExtensions),
      rejectedFamilies: sanitizeValues(raw.attachmentPolicy?.rejectedFamilies),
      familyLabels: sanitizeOptions(raw.attachmentPolicy?.familyLabels),
      rejectedFamilyLabels: sanitizeOptions(raw.attachmentPolicy?.rejectedFamilyLabels),
    },
    permissions: sanitizeValues(raw.permissions),
    permissionOptions: sanitizeOptions(raw.permissionOptions),
    ownerTypeOptions: sanitizeOptions(raw.ownerTypeOptions),
    eventOptions: sanitizeOptions(raw.eventOptions),
    derivedRules: {
      opportunityStatusByStageFlag: {
        WON: raw.derivedRules?.opportunityStatusByStageFlag?.WON ?? 'WON',
        LOST: raw.derivedRules?.opportunityStatusByStageFlag?.LOST ?? 'LOST',
        ON_HOLD: raw.derivedRules?.opportunityStatusByStageFlag?.ON_HOLD ?? 'ON_HOLD',
        default: raw.derivedRules?.opportunityStatusByStageFlag?.default ?? 'IN_PROGRESS',
      },
      leadConversionCopiesCustomFieldOwnerType:
        raw.derivedRules?.leadConversionCopiesCustomFieldOwnerType ?? 'LEAD_AND_PARTY',
    },
  };
}

/** GET /api/tenant/crm/v1/static-data */
export async function getCrmStaticData(): Promise<CrmStaticData> {
  const raw = await crmQueries().fetchQuery({
    queryKey: ['crm-settings', 'static-data'],
    queryFn: () => crmHttp().read<CrmStaticData>('/static-data'),
    staleTime: Infinity,
    // The shared client otherwise removes unobserved queries immediately.
    gcTime: Infinity,
  });
  return sanitizeStaticData(raw);
}

export async function reloadCrmStaticData(): Promise<CrmStaticData> {
  await crmQueries().invalidateQueries({ queryKey: ['crm-settings', 'static-data'] });
  return getCrmStaticData();
}
