import type { ScopeCompany } from '../../../../core/scope/scope';
import { templateFamilyMeta } from '../shared/template-family';
import type {
  TemplateAssignmentDto,
  TemplateDataSourceKey,
  TemplateDefinitionScope,
  TemplateDocumentType,
  TemplateScopeRef,
} from '../templates.api';
import type {
  AssignmentScopeOption,
  AssignmentSelectorOption,
  DocumentVisualDescriptor,
  OverlapCandidate,
} from './assignments.model';

/**
 * Every assignment selector the data-source registry lists. The enabled rows mirror backend
 * PRODUCTION_ASSIGNABLE_TEMPLATE_TUPLES (template-assignment-policy.ts); the others are listed
 * disabled with OWNER_RUNTIME_UNAVAILABLE and the API answers 422
 * CORE.TEMPLATE.ASSIGNMENT.OWNER_RUNTIME_UNAVAILABLE for them.
 */
export const ASSIGNMENT_SELECTOR_CATALOGUE: readonly AssignmentSelectorOption[] = [
  {
    adapterKey: 'TRADE_QUOTATION_PRINT_V1',
    documentType: 'QUOTATION',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_QUOTATION_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'TRADE_SALES_ORDER_PRINT_V1',
    documentType: 'SALES_ORDER',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_SALES_ORDER_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'TRADE_PURCHASE_ORDER_PRINT_V1',
    documentType: 'PURCHASE_ORDER',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_PURCHASE_ORDER_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'TRADE_PURCHASE_QUOTATION_PRINT_V1',
    documentType: 'PURCHASE_QUOTATION',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_PURCHASE_QUOTATION_PRINT_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'CRM_LEAD_OUTBOUND_EMAIL_V1',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    labelKey: 'assignments.adapters.CRM_LEAD_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    labelKey: 'assignments.adapters.CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    documentType: 'CRM_OUTBOUND_EMAIL',
    outputChannel: 'EMAIL',
    labelKey: 'assignments.adapters.CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
    productionAssignmentEnabled: true,
    productionDisabledReason: null,
  },
  {
    adapterKey: 'TRADE_INVOICE_PRINT_V1',
    documentType: 'INVOICE',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_INVOICE_PRINT_V1',
    productionAssignmentEnabled: false,
    productionDisabledReason: 'OWNER_RUNTIME_UNAVAILABLE',
  },
  {
    adapterKey: 'TRADE_CONTRACT_PRINT_V1',
    documentType: 'CONTRACT',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.TRADE_CONTRACT_PRINT_V1',
    productionAssignmentEnabled: false,
    productionDisabledReason: 'OWNER_RUNTIME_UNAVAILABLE',
  },
  {
    adapterKey: 'CORE_BUSINESS_LETTER_PRINT_V1',
    documentType: 'LETTER',
    outputChannel: 'PRINT',
    labelKey: 'assignments.adapters.CORE_BUSINESS_LETTER_PRINT_V1',
    productionAssignmentEnabled: false,
    productionDisabledReason: 'OWNER_RUNTIME_UNAVAILABLE',
  },
];

/** Selectors that can be assigned in production. */
export const SUPPORTED_ASSIGNMENT_SELECTORS: readonly AssignmentSelectorOption[] = ASSIGNMENT_SELECTOR_CATALOGUE.filter(
  (item) => item.productionAssignmentEnabled,
);

export const ASSIGNABLE_DOCUMENT_TYPES: ReadonlySet<TemplateDocumentType> = new Set(
  SUPPORTED_ASSIGNMENT_SELECTORS.map((item) => item.documentType),
);

export function isProductionAssignableAdapter(adapterKey: TemplateDataSourceKey): boolean {
  return SUPPORTED_ASSIGNMENT_SELECTORS.some((item) => item.adapterKey === adapterKey);
}

export function isProductionAssignableDocument(documentType: TemplateDocumentType): boolean {
  return ASSIGNABLE_DOCUMENT_TYPES.has(documentType);
}

/** Dropdown options for every catalogue selector; disabled ones carry the translated reason as a tooltip. */
export function assignmentSelectorDropdownOptions(
  translate: (key: string) => string,
): { value: TemplateDataSourceKey; label: string; disabled?: boolean; title?: string }[] {
  return ASSIGNMENT_SELECTOR_CATALOGUE.map((item) => {
    const label = translate(item.labelKey);
    if (item.productionAssignmentEnabled) return { value: item.adapterKey, label };
    const reason = translate(`assignments.disabledReasons.${item.productionDisabledReason}`);
    return { value: item.adapterKey, label: `${label} (${reason})`, disabled: true, title: reason };
  });
}

export function scopeKeyOf(scope: TemplateScopeRef): string {
  if (scope.type === 'TENANT') return 'TENANT';
  if (scope.type === 'COMPANY') return `COMPANY:${scope.companyId}`;
  return `BRANCH:${scope.companyId}:${scope.branchId}`;
}

export function scopeKeyFromPortalSelection(companyId: string, branchId: string): string {
  return `BRANCH:${companyId}:${branchId}`;
}

/** Mirrors CORE.TEMPLATE.ASSIGNMENT.SCOPE_INVALID: a Company-owned template targets only that Company or its Branches. */
export function isAssignmentScopeAllowed(owner: TemplateDefinitionScope, target: TemplateScopeRef): boolean {
  if (owner.type === 'TENANT') return true;
  return target.type !== 'TENANT' && target.companyId === owner.companyId;
}

export function buildAssignmentScopeOptions(
  companies: readonly ScopeCompany[],
  lang: 'en' | 'ar',
  translate: (key: string) => string,
): AssignmentScopeOption[] {
  const options: AssignmentScopeOption[] = [
    {
      key: 'TENANT',
      scope: { type: 'TENANT' },
      icon: 'tablerWorld',
      tile: 'bg-icon-gray',
      label: translate('assignments.scopes.tenant'),
    },
  ];

  const seenCompanies = new Set<string>();
  const seenBranches = new Set<string>();

  for (const company of companies) {
    const companyLabel = lang === 'ar' ? company.nameAr : company.nameEn;

    if (!seenCompanies.has(company.id)) {
      seenCompanies.add(company.id);
      options.push({
        key: `COMPANY:${company.id}`,
        scope: { type: 'COMPANY', companyId: company.id },
        icon: 'tablerBuilding',
        tile: 'bg-icon-navy',
        label: companyLabel,
      });
    }

    for (const branch of company.branches) {
      const branchKey = `${company.id}:${branch.id}`;
      const branchLabel = lang === 'ar' ? branch.nameAr : branch.nameEn;

      if (!seenBranches.has(branchKey)) {
        seenBranches.add(branchKey);
        options.push({
          key: `BRANCH:${company.id}:${branch.id}`,
          scope: { type: 'BRANCH', companyId: company.id, branchId: branch.id },
          icon: 'tablerMapPin',
          tile: 'bg-icon-red',
          label: branchLabel,
        });
      }
    }
  }

  return options;
}

export function describeAssignmentScope(
  scope: TemplateScopeRef,
  options: readonly AssignmentScopeOption[],
  translate: (key: string) => string,
): { label: string; icon: string; tile: string } {
  const key = scopeKeyOf(scope);
  const found = options.find((opt) => opt.key === key);
  if (found) {
    return { label: found.label, icon: found.icon, tile: found.tile };
  }
  if (scope.type === 'TENANT') {
    return { label: translate('assignments.scopes.tenant'), icon: 'tablerWorld', tile: 'bg-icon-gray' };
  }
  if (scope.type === 'COMPANY') {
    return {
      label: translate('assignments.scopes.company'),
      icon: 'tablerBuilding',
      tile: 'bg-icon-navy',
    };
  }
  return {
    label: translate('assignments.scopes.branch'),
    icon: 'tablerMapPin',
    tile: 'bg-icon-red',
  };
}

export function describeAssignmentDocument(
  documentType: TemplateDocumentType,
  adapterKey?: TemplateDataSourceKey,
): DocumentVisualDescriptor {
  const meta = templateFamilyMeta(documentType);
  const labelKey = adapterKey
    ? `assignments.adapters.${adapterKey}`
    : `assignments.documents.${documentType}`;
  return { icon: meta.icon, tile: meta.tile, labelKey };
}

export function formatEffectiveRange(
  effectiveFrom: string,
  effectiveTo: string | null,
  lang: 'en' | 'ar',
): string {
  const fromDate = new Date(effectiveFrom);
  const arrow = lang === 'ar' ? '←' : '→';
  if (Number.isNaN(fromDate.getTime())) return effectiveFrom;

  const fullFmt = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (!effectiveTo) {
    return `${fullFmt.format(fromDate)} ${arrow}`;
  }

  const toDate = new Date(effectiveTo);
  if (Number.isNaN(toDate.getTime())) {
    return `${fullFmt.format(fromDate)} ${arrow}`;
  }

  return `${fullFmt.format(fromDate)} ${arrow} ${fullFmt.format(toDate)}`;
}

export function formatShortDate(isoOrDate: string, lang: 'en' | 'ar'): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
    ? new Date(`${isoOrDate}T00:00:00.000Z`)
    : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function todayDateInput(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoToDateInput(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim());
  return match ? match[1] : null;
}

export function isoToEndDateInput(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  const midnightMatch = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/.exec(trimmed);
  if (midnightMatch) {
    const year = Number(midnightMatch[1]);
    const month = Number(midnightMatch[2]);
    const day = Number(midnightMatch[3]);
    const prevDay = new Date(Date.UTC(year, month - 1, day - 1));
    return prevDay.toISOString().slice(0, 10);
  }
  return isoToDateInput(trimmed);
}

export function dateInputToStartIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

export function dateInputToEndIso(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return `${dateStr}T00:00:00.000Z`;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return nextDay.toISOString();
}

export function dateTimeToIso(dateStr: string, timeStr: string | null): string {
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr.trim()) ? timeStr.trim() : '00:00';
  return `${dateStr}T${time}:00.000Z`;
}

/**
 * Checks whether an ACTIVE default assignment overlaps another ACTIVE default assignment
 * with identical selector identity and priority on [effectiveFrom, effectiveTo).
 */
export function hasDefaultAssignmentOverlap(
  candidate: OverlapCandidate,
  existing: readonly TemplateAssignmentDto[],
  excludeAssignmentId?: string | null,
): boolean {
  if (!candidate.isDefault || candidate.status !== 'ACTIVE') return false;
  const candidateScopeKey = scopeKeyOf(candidate.scope);
  const candFrom = Date.parse(candidate.effectiveFrom);
  const candTo = candidate.effectiveTo ? Date.parse(candidate.effectiveTo) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(candFrom) || Number.isNaN(candTo)) return false;

  for (const row of existing) {
    if (excludeAssignmentId && row.assignmentId === excludeAssignmentId) continue;
    if (row.status !== 'ACTIVE' || !row.isDefault) continue;
    if (scopeKeyOf(row.scope) !== candidateScopeKey) continue;
    if (row.documentType !== candidate.documentType) continue;
    if (row.outputChannel !== candidate.outputChannel) continue;
    if (row.adapterKey !== candidate.adapterKey) continue;
    if (row.locale !== candidate.locale) continue;
    if (row.priority !== candidate.priority) continue;

    const rowFrom = Date.parse(row.effectiveFrom);
    const rowTo = row.effectiveTo ? Date.parse(row.effectiveTo) : Number.POSITIVE_INFINITY;
    if (Number.isNaN(rowFrom) || Number.isNaN(rowTo)) continue;

    if (candFrom < rowTo && rowFrom < candTo) {
      return true;
    }
  }
  return false;
}

export function translateAssignmentError(
  error: unknown,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string {
  const code =
    typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;
  if (code) {
    const key = `assignments.errors.${code}`;
    const resolved = translate(key);
    if (resolved && resolved !== key) return resolved;
  }
  return translate('assignments.errors.generic');
}
