import type { DraftErrors } from './opportunity-draft';

/**
 * Maps a backend (crm-app opportunities) error to the form field it belongs to, so hosts
 * can show it under that field and call `focusFirstError(errors)`. Returns null when the
 * error has no field; the host then shows it as a toast.
 *
 * Values are error strings for `resolveOpportunityError`: a bare code resolves through
 * `oppForm.errors.<code>` then `opportunities.errors.<code>`; a dotted value is an i18n key.
 */

/** Backend codes (crm-error-catalog.ts, opportunities.service.ts) → draft field. */
const FIELD_OF_CODE: Record<string, string> = {
  OPPORTUNITY_OWNER_INELIGIBLE: 'ownerUserId',
  OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED: 'currencyCode',
  OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH: 'contactPartyId',
  OPPORTUNITY_CREATE_STAGE_TERMINAL: 'stageId',
  PIPELINE_STAGE_NOT_FOUND: 'stageId',
  CUSTOMER_PROFILE_BLACKLISTED: 'customerProfileId',
  CUSTOMER_PROFILE_NOT_FOUND: 'customerProfileId',
  PARTY_NOT_FOUND: 'contactPartyId',
};

/** Custom-field codes (custom-field-write.helper.ts) → message for the custom field. */
const CUSTOM_FIELD_MESSAGE: Record<string, string> = {
  CUSTOM_FIELD_REQUIRED: 'oppForm.errors.required',
  CUSTOM_FIELD_VALUE_REQUIRED: 'oppForm.errors.required',
  CUSTOM_FIELD_VALUE_INVALID: 'oppForm.errors.cfInvalid',
  CUSTOM_FIELD_INVALID: 'oppForm.errors.cfUnavailable',
  CUSTOM_FIELD_INACTIVE: 'oppForm.errors.cfUnavailable',
};

/** Draft fields a validation `details` path may name directly. */
const DRAFT_FIELDS = new Set([
  'branchId',
  'customerProfileId',
  'contactPartyId',
  'leadId',
  'pipelineId',
  'stageId',
  'title',
  'description',
  'amount',
  'currencyCode',
  'expectedCloseDate',
  'probabilityPercent',
  'ownerUserId',
  'tagIds',
]);

export interface OpportunityApiErrorLike {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export function mapOpportunityApiError(error: unknown): DraftErrors | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message, details } = error as OpportunityApiErrorLike;
  if (!code) return null;

  const field = FIELD_OF_CODE[code];
  if (field) {
    const value = code === 'CUSTOMER_PROFILE_BLACKLISTED' ? 'oppForm.errors.customerBlacklisted' : code;
    return { [field]: value };
  }

  const cfMessage = CUSTOM_FIELD_MESSAGE[code];
  if (cfMessage) {
    const key = customFieldKeyFrom(details, message);
    return { [key ? `customFields.${key}` : 'customFields']: cfMessage };
  }

  return fieldsFromDetails(details);
}

/** `details.path` / `details.field` ('customFields.<key>' or '<key>'), else the backend message "Custom field '<key>' …". */
function customFieldKeyFrom(details: Record<string, unknown> | undefined, message: string | undefined): string | null {
  for (const raw of [details?.['path'], details?.['field']]) {
    if (typeof raw === 'string' && raw.trim()) {
      const path = raw.trim();
      return path.startsWith('customFields.') ? path.slice('customFields.'.length) : path;
    }
  }
  const match = typeof message === 'string' ? /^Custom field '([^']+)'/.exec(message) : null;
  return match?.[1] ?? null;
}

/** Validation errors whose `details` keys (or `path`) name draft fields or `customFields.<key>`. */
function fieldsFromDetails(details: Record<string, unknown> | undefined): DraftErrors | null {
  if (!details) return null;
  const out: DraftErrors = {};
  const paths = Object.keys(details).filter((key) => key !== 'path' && key !== 'field');
  for (const raw of [details['path'], details['field']]) {
    if (typeof raw === 'string') paths.push(raw);
  }
  for (const path of paths) {
    if (path.startsWith('customFields.') || DRAFT_FIELDS.has(path)) {
      out[path] = 'oppForm.errors.invalid';
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
