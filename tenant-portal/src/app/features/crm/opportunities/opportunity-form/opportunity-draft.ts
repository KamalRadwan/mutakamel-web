import type { TranslocoService } from '@jsverse/transloco';
import {
  OPPORTUNITY_LIMITS,
  type CardColor,
  type CreateOpportunityBody,
  type CustomFieldDef,
  type CustomerOption,
  type OpportunityRow,
  type PipelineView,
  type UpdateOpportunityBody,
} from '../opportunities.model';

export interface OpportunityDraft {
  branchId: string | null;
  companyId: string | null;
  customerProfileId: string | null;
  customerLabel: string;
  customerStatus: CustomerOption['status'] | null;
  contactPartyId: string | null;
  leadId: string | null;
  pipelineId: string | null;
  stageId: string | null;
  title: string;
  description: string;
  amount: string; // '' = none; decimal string
  currencyCode: string | null;
  expectedCloseDate: string | null; // 'YYYY-MM-DD'
  probabilityPercent: string; // '' = none; digits only in the input
  ownerUserId: string | null;
  importance: number;
  cardColor: CardColor | null;
  tagIds: string[];
  customFields: Record<string, unknown>;
}

export type DraftErrors = Record<string, string>;

export type OpportunityFormSection = 'classification' | 'deal' | 'customer' | 'custom' | 'more';

export interface EmptyOpportunityDraftContext {
  branchId: string | null;
  companyId: string | null;
  ownerUserId: string | null;
  pipeline: PipelineView | null;
  stageId?: string | null;
  customer?: CustomerOption | null;
  defaultCurrency: string | null;
}

export const SECTION_OF_FIELD: Record<string, OpportunityFormSection> = {
  companyId: 'classification',
  branchId: 'classification',
  ownerUserId: 'classification',
  pipelineId: 'classification',
  stageId: 'classification',
  amount: 'classification',
  currencyCode: 'classification',
  probabilityPercent: 'classification',
  expectedCloseDate: 'classification',
  tagIds: 'classification',
  importance: 'classification',
  cardColor: 'classification',
  title: 'deal',
  description: 'deal',
  customerProfileId: 'customer',
  contactPartyId: 'customer',
  customFields: 'custom',
  leadId: 'more',
};

const AMOUNT_RE = /^\d{1,16}(\.\d{1,8})?$/;
const INT_DIGITS_RE = /^\d+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^[+\d\s().-]+$/;
const CUSTOM_TEXT_MAX = 500;
const CUSTOM_TEXTAREA_MAX = 5000;

export function firstOpenStageId(pipeline: PipelineView | null): string | null {
  if (!pipeline) return null;
  const stages = pipeline.stages
    .filter((stage) => stage.isActive && stage.flag !== 'WON' && stage.flag !== 'LOST')
    .slice()
    .sort((a, b) => a.rank - b.rank);
  return stages[0]?.id ?? null;
}

export function emptyDraft(ctx: EmptyOpportunityDraftContext): OpportunityDraft {
  const requestedStageId = ctx.stageId ?? null;
  let stageId = requestedStageId;
  if (ctx.pipeline) {
    const matched = requestedStageId
      ? ctx.pipeline.stages.find((s) => s.id === requestedStageId && s.isActive && s.flag !== 'WON' && s.flag !== 'LOST')
      : undefined;
    stageId = matched ? matched.id : firstOpenStageId(ctx.pipeline);
  } else if (!stageId) {
    stageId = null;
  }

  const customer = ctx.customer ?? null;

  return {
    branchId: ctx.branchId,
    companyId: ctx.companyId,
    customerProfileId: customer?.id ?? null,
    customerLabel: customer?.displayName ?? '',
    customerStatus: customer?.status ?? null,
    contactPartyId: customer?.profileType === 'INDIVIDUAL' ? customer.partyId : null,
    leadId: null,
    pipelineId: ctx.pipeline?.id ?? null,
    stageId,
    title: '',
    description: '',
    amount: '',
    currencyCode: ctx.defaultCurrency ?? null,
    expectedCloseDate: null,
    probabilityPercent: '',
    ownerUserId: ctx.ownerUserId,
    importance: 0,
    cardColor: null,
    tagIds: [],
    customFields: {},
  };
}

/** The part of a session company that maps a branch to its company. */
export interface CompanyBranches {
  id: string;
  branches: readonly { id: string }[];
}

/** The company that owns `branchId` in the session scope, or null when none does. */
export function companyIdForBranch(
  branchId: string | null | undefined,
  companies: readonly CompanyBranches[],
): string | null {
  if (!branchId) return null;
  return companies.find((company) => company.branches.some((branch) => branch.id === branchId))?.id ?? null;
}

/**
 * Edit draft for a loaded record. The row carries no company id, so it comes from the
 * session companies (`ScopeState.companies()`) that own the row's branch.
 */
export function draftFromRow(
  row: OpportunityRow,
  companies: readonly CompanyBranches[] = [],
  customFields: Record<string, unknown> = row.customFields ?? {},
): OpportunityDraft {
  return {
    branchId: row.branchId,
    companyId: companyIdForBranch(row.branchId, companies),
    customerProfileId: row.customerProfileId,
    customerLabel: row.customerDisplayName ?? '',
    customerStatus: null,
    contactPartyId: row.contactPartyId,
    leadId: row.leadId,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    title: row.title,
    description: row.description ?? '',
    amount: row.amount ?? '',
    currencyCode: row.currencyCode,
    expectedCloseDate: row.expectedCloseDate,
    probabilityPercent:
      row.probabilityPercent === null || row.probabilityPercent === undefined ? '' : String(row.probabilityPercent),
    ownerUserId: row.ownerUserId,
    importance: row.importance,
    cardColor: row.cardColor,
    tagIds: row.tags.map((tag) => tag.id),
    customFields: { ...customFields },
  };
}

export function validateDraft(
  d: OpportunityDraft,
  mode: 'create' | 'edit',
  customFieldDefs: readonly CustomFieldDef[],
  pipeline?: PipelineView | null,
): DraftErrors {
  const errors: DraftErrors = {};

  if (mode === 'create') {
    if (!d.branchId?.trim()) {
      errors['branchId'] = 'oppForm.errors.required';
    }
    if (!d.customerProfileId?.trim()) {
      errors['customerProfileId'] = 'oppForm.errors.required';
    } else if (d.customerStatus === 'BLACKLISTED') {
      errors['customerProfileId'] = 'oppForm.errors.customerBlacklisted';
    }
    if (!d.pipelineId?.trim()) {
      errors['pipelineId'] = 'oppForm.errors.required';
    }
    if (!d.stageId?.trim()) {
      errors['stageId'] = 'oppForm.errors.required';
    } else if (pipeline) {
      const stage = pipeline.stages.find((s) => s.id === d.stageId);
      if (!stage || !stage.isActive) {
        errors['stageId'] = 'oppForm.errors.stageInvalid';
      } else if (stage.flag === 'WON' || stage.flag === 'LOST') {
        errors['stageId'] = 'oppForm.errors.stageTerminal';
      }
    }
  }

  const title = d.title.trim();
  if (!title) {
    errors['title'] = 'oppForm.errors.required';
  } else if (title.length > OPPORTUNITY_LIMITS.title) {
    errors['title'] = `oppForm.errors.tooLong:${OPPORTUNITY_LIMITS.title}`;
  }

  if (d.description.trim().length > OPPORTUNITY_LIMITS.description) {
    errors['description'] = `oppForm.errors.tooLong:${OPPORTUNITY_LIMITS.description}`;
  }

  const amount = d.amount.trim();
  const currency = d.currencyCode?.trim() ?? '';
  if (amount) {
    if (!AMOUNT_RE.test(amount)) {
      errors['amount'] = 'oppForm.errors.amountInvalid';
    }
    if (!currency) {
      errors['currencyCode'] = 'oppForm.errors.amountCurrencyRequired';
    }
  }

  const probability = d.probabilityPercent.trim();
  if (probability) {
    if (!INT_DIGITS_RE.test(probability)) {
      errors['probabilityPercent'] = 'oppForm.errors.probabilityInvalid';
    } else {
      const num = Number(probability);
      if (!Number.isInteger(num) || num < OPPORTUNITY_LIMITS.probabilityMin || num > OPPORTUNITY_LIMITS.probabilityMax) {
        errors['probabilityPercent'] = 'oppForm.errors.probabilityInvalid';
      }
    }
  }

  const closeDate = d.expectedCloseDate?.trim() ?? '';
  if (closeDate && !isValidIsoDate(closeDate)) {
    errors['expectedCloseDate'] = 'oppForm.errors.dateInvalid';
  }

  if (d.tagIds.length > OPPORTUNITY_LIMITS.tags) {
    errors['tagIds'] = 'oppForm.errors.tagsMax';
  }

  for (const cf of customFieldDefs) {
    const required = mode === 'create' ? cf.requiredOnCreate : cf.requiredOnUpdate;
    const cfError = validateCustomField(cf, d.customFields[cf.fieldKey], required);
    if (cfError) {
      errors[`customFields.${cf.fieldKey}`] = cfError;
    }
  }

  return errors;
}

export function toCreateBody(d: OpportunityDraft): CreateOpportunityBody {
  const body: CreateOpportunityBody = {
    branchId: (d.branchId ?? '').trim(),
    customerProfileId: (d.customerProfileId ?? '').trim(),
    pipelineId: (d.pipelineId ?? '').trim(),
    stageId: (d.stageId ?? '').trim(),
    title: d.title.trim(),
  };

  const leadId = trimOrUndefined(d.leadId);
  const contactPartyId = trimOrUndefined(d.contactPartyId);
  const description = trimOrUndefined(d.description);
  const ownerUserId = trimOrUndefined(d.ownerUserId);
  const expectedCloseDate = trimOrUndefined(d.expectedCloseDate);
  if (leadId) body.leadId = leadId;
  if (contactPartyId) body.contactPartyId = contactPartyId;
  if (description) body.description = description;
  if (ownerUserId) body.ownerUserId = ownerUserId;
  if (expectedCloseDate) body.expectedCloseDate = expectedCloseDate;

  if (d.importance > 0) {
    body.importance = d.importance;
  }
  if (d.cardColor !== null) {
    body.cardColor = d.cardColor;
  }

  const amount = trimOrUndefined(d.amount);
  const currencyCode = trimOrUndefined(d.currencyCode);
  if (amount) {
    body.amount = amount;
    if (currencyCode) {
      body.currencyCode = currencyCode;
    }
  }

  const probability = parseProbability(d.probabilityPercent);
  if (probability !== null) {
    body.probabilityPercent = probability;
  }

  if (d.tagIds.length > 0) {
    body.tagIds = [...d.tagIds];
  }

  const customFields = cleanCustomFields(d.customFields);
  if (customFields) {
    body.customFields = customFields;
  }

  return body;
}

/**
 * PATCH body for an edit, or null when no PATCH field changed.
 *
 * Tags are NOT part of this body: the backend `UpdateOpportunityDto` has no `tagIds`.
 * Hosts (the o5 modal and the o6 page) must call `saveTags(id, base.tagIds, d.tagIds)`
 * from `./opportunity-tags-diff` after the PATCH succeeds. A tags-only edit returns
 * null here but `isDirty` is still true, so the host must skip the PATCH and still
 * call `saveTags`; never treat a null body as "nothing to save".
 */
export function toPatchBody(
  base: OpportunityDraft,
  d: OpportunityDraft,
  expectedUpdatedAt: string,
): UpdateOpportunityBody | null {
  const body: UpdateOpportunityBody = { expectedUpdatedAt };
  let changed = false;

  const baseTitle = base.title.trim();
  const nextTitle = d.title.trim();
  if (baseTitle !== nextTitle) {
    body.title = nextTitle;
    changed = true;
  }

  const baseDescription = trimOrNull(base.description);
  const nextDescription = trimOrNull(d.description);
  if (baseDescription !== nextDescription) {
    body.description = nextDescription;
    changed = true;
  }

  const baseAmount = trimOrNull(base.amount);
  const nextAmount = trimOrNull(d.amount);
  const baseCurrency = trimOrNull(base.currencyCode);
  const nextCurrency = trimOrNull(d.currencyCode);
  if (baseAmount !== null && nextAmount === null) {
    body.amount = null;
    body.currencyCode = null;
    changed = true;
  } else {
    if (baseAmount !== nextAmount) {
      body.amount = nextAmount;
      changed = true;
    }
    if (baseCurrency !== nextCurrency) {
      body.currencyCode = nextCurrency;
      changed = true;
    }
  }

  const nextOwnerId = trimOrUndefined(d.ownerUserId);
  if (nextOwnerId && nextOwnerId !== trimOrUndefined(base.ownerUserId)) {
    body.ownerUserId = nextOwnerId;
    changed = true;
  }

  const baseContactId = trimOrNull(base.contactPartyId);
  const nextContactId = trimOrNull(d.contactPartyId);
  if (baseContactId !== nextContactId) {
    body.contactPartyId = nextContactId;
    changed = true;
  }

  const baseCloseDate = trimOrNull(base.expectedCloseDate);
  const nextCloseDate = trimOrNull(d.expectedCloseDate);
  if (baseCloseDate !== nextCloseDate) {
    body.expectedCloseDate = nextCloseDate;
    changed = true;
  }

  const baseProb = trimOrNull(base.probabilityPercent);
  const nextProb = trimOrNull(d.probabilityPercent);
  if (baseProb !== nextProb) {
    body.probabilityPercent = nextProb === null ? null : parseProbability(nextProb);
    changed = true;
  }

  const changedCustomFields: Record<string, unknown> = {};
  let hasCustomChanges = false;
  const cfKeys = new Set([...Object.keys(base.customFields), ...Object.keys(d.customFields)]);
  for (const key of cfKeys) {
    if (!customValuesEqual(base.customFields[key], d.customFields[key])) {
      const cleaned = cleanCustomValue(d.customFields[key]);
      changedCustomFields[key] = cleaned === undefined ? null : cleaned;
      hasCustomChanges = true;
    }
  }
  if (hasCustomChanges) {
    body.customFields = changedCustomFields;
    changed = true;
  }

  return changed ? body : null;
}

export function isDirty(base: OpportunityDraft, d: OpportunityDraft): boolean {
  return !(
    trimOrNull(base.branchId) === trimOrNull(d.branchId) &&
    trimOrNull(base.companyId) === trimOrNull(d.companyId) &&
    trimOrNull(base.customerProfileId) === trimOrNull(d.customerProfileId) &&
    trimOrNull(base.contactPartyId) === trimOrNull(d.contactPartyId) &&
    trimOrNull(base.leadId) === trimOrNull(d.leadId) &&
    trimOrNull(base.pipelineId) === trimOrNull(d.pipelineId) &&
    base.title.trim() === d.title.trim() &&
    base.description.trim() === d.description.trim() &&
    base.amount.trim() === d.amount.trim() &&
    trimOrNull(base.currencyCode) === trimOrNull(d.currencyCode) &&
    trimOrNull(base.expectedCloseDate) === trimOrNull(d.expectedCloseDate) &&
    base.probabilityPercent.trim() === d.probabilityPercent.trim() &&
    trimOrNull(base.ownerUserId) === trimOrNull(d.ownerUserId) &&
    sameStringSet(base.tagIds, d.tagIds) &&
    customFieldsEqual(base.customFields, d.customFields)
  );
}

export function resolveOpportunityError(
  raw: string | undefined,
  transloco: TranslocoService,
  fallbackMax?: number,
): string | null {
  if (!raw) return null;
  const [codePart, suffixMax] = raw.split(':');
  const resolvedMax = suffixMax !== undefined ? Number(suffixMax) : fallbackMax;
  const params = resolvedMax !== undefined && Number.isFinite(resolvedMax) ? { max: resolvedMax } : undefined;

  if (codePart.includes('.')) {
    const direct = transloco.translate(codePart, params);
    return direct !== codePart ? direct : codePart;
  }

  const formKey = `oppForm.errors.${codePart}`;
  const formMsg = transloco.translate(formKey, params);
  if (formMsg !== formKey) return formMsg;

  const moduleKey = `opportunities.errors.${codePart}`;
  const moduleMsg = transloco.translate(moduleKey, params);
  if (moduleMsg !== moduleKey) return moduleMsg;

  return codePart;
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function parseProbability(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !INT_DIGITS_RE.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

function cleanCustomValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : [...value];
  }
  return value;
}

function cleanCustomFields(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(raw)) {
    const cleaned = cleanCustomValue(val);
    if (cleaned !== undefined) {
      out[key] = cleaned;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

function customValuesEqual(a: unknown, b: unknown): boolean {
  const ca = cleanCustomValue(a);
  const cb = cleanCustomValue(b);
  if (ca === cb) return true;
  if (Array.isArray(ca) && Array.isArray(cb)) {
    return ca.length === cb.length && ca.every((item, index) => item === cb[index]);
  }
  return false;
}

function customFieldsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!customValuesEqual(a[key], b[key])) return false;
  }
  return true;
}

export function isValidIsoDate(raw: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidIsoDateTime(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(raw)) {
    return false;
  }
  return !Number.isNaN(Date.parse(raw));
}

function isValidHttpUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizePhoneChars(raw: string): string {
  const stripped = raw.replace(/[^\d+]/g, '');
  const withPlus = stripped.startsWith('00') ? '+' + stripped.slice(2) : stripped;
  return withPlus.startsWith('+') ? '+' + withPlus.slice(1).replace(/\+/g, '') : withPlus.replace(/\+/g, '');
}

function isEmptyCustomValue(value: unknown, type: CustomFieldDef['type']): boolean {
  if (value === null || value === undefined) return true;
  if (type === 'BOOLEAN') return false;
  if (type === 'MULTI_SELECT') return Array.isArray(value) && value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function validateCustomField(cf: CustomFieldDef, value: unknown, required: boolean): string | null {
  if (isEmptyCustomValue(value, cf.type)) {
    return required ? 'oppForm.errors.required' : null;
  }
  switch (cf.type) {
    case 'TEXT':
      return typeof value === 'string' && value.trim().length > CUSTOM_TEXT_MAX
        ? `oppForm.errors.tooLong:${CUSTOM_TEXT_MAX}`
        : null;
    case 'TEXTAREA':
      return typeof value === 'string' && value.trim().length > CUSTOM_TEXTAREA_MAX
        ? `oppForm.errors.tooLong:${CUSTOM_TEXTAREA_MAX}`
        : null;
    case 'NUMBER': {
      const num =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value.trim())
            : Number.NaN;
      return Number.isFinite(num) ? null : 'oppForm.errors.cfNumber';
    }
    case 'DATE':
      return typeof value === 'string' && isValidIsoDate(value.trim()) ? null : 'oppForm.errors.cfDate';
    case 'DATETIME':
      return typeof value === 'string' && isValidIsoDateTime(value.trim()) ? null : 'oppForm.errors.cfDate';
    case 'URL':
      return typeof value === 'string' && isValidHttpUrl(value.trim()) ? null : 'oppForm.errors.cfUrl';
    case 'EMAIL':
      return typeof value === 'string' && EMAIL_RE.test(value.trim()) ? null : 'oppForm.errors.cfEmail';
    case 'PHONE': {
      if (typeof value !== 'string') return 'oppForm.errors.cfPhone';
      const trimmed = value.trim();
      if (!PHONE_CHARS_RE.test(trimmed)) return 'oppForm.errors.cfPhone';
      const digits = normalizePhoneChars(trimmed).replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15 ? null : 'oppForm.errors.cfPhone';
    }
    case 'BOOLEAN':
    case 'SELECT':
    case 'MULTI_SELECT':
      return null;
  }
}
