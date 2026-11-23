import { TranslocoService } from '@jsverse/transloco';
import { ApiError, fieldErrorsOf, isValidationError } from '../../../../core/api/api-errors';
import { crmSettingsError } from '../../settings/shared/settings-api';
import { LeadCustomField, nameIn } from '../leads.model';
import { DraftErrors, LeadDraft } from './lead-draft';

export function leadServerError(
  transloco: TranslocoService, error: unknown, draft: LeadDraft,
  customFields: readonly LeadCustomField[] = [], contactIndex?: number,
) {
  // Optional domain translations must not trigger Transloco's missing-key warning.
  const translate = (key: string, params?: Record<string, unknown>) => {
    let dictionary: unknown = transloco.getTranslation(transloco.getActiveLang());
    const path = key.split('.');
    while (dictionary && typeof dictionary === 'object' && path.length) {
      if (Object.hasOwn(dictionary, path.join('.'))) return transloco.translate(key, params);
      dictionary = (dictionary as Record<string, unknown>)[path.shift()!];
    }
    return key;
  };
  const mapped = crmSettingsError(translate, error, 'leadForm');
  const code = error instanceof ApiError ? error.code : '';
  const details = error instanceof ApiError ? error.details : undefined;
  const first = (key: string) => {
    const value = details?.[key];
    return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : typeof value === 'string' ? value : '';
  };
  const errors: DraftErrors = {};
  const rawFieldKeys = details?.['fieldKey'];
  const fieldKeys = (Array.isArray(rawFieldKeys) ? rawFieldKeys : [rawFieldKeys])
    .filter((key): key is string => typeof key === 'string' && key.length > 0);
  const fieldKey = fieldKeys[0] ?? '';
  const customField = customFields.find((field) => field.fieldKey === fieldKey || field.id === fieldKey);
  const params: Record<string, unknown> = { field: customField ? nameIn(customField, transloco.getActiveLang()) : fieldKey };
  const domainKey = `leadForm.server.${code}`;
  const domainMessage = translate(domainKey, params);
  let message = domainMessage !== domainKey ? domainMessage : mapped.message;
  if (code.startsWith('CUSTOM_FIELD_') && !fieldKey) message = translate('leadForm.write.customFieldsInvalid');
  let fieldMessageKey = domainMessage !== domainKey ? domainKey : 'invalid';
  const serverField = (field: string) => { errors[field] = fieldMessageKey; };

  if (isValidationError(error)) {
    for (const [path, messages] of Object.entries(fieldErrorsOf(error))) {
      if (path === '_') continue;
      const field = path.replace(/^contactChange\.contact\./, `contacts.${contactIndex ?? 0}.`);
      errors[field] = messages.some((value) => /required|not.?empty/i.test(value)) ? 'required' : 'invalid';
    }
  }
  if (['CUSTOM_FIELD_REQUIRED', 'CUSTOM_FIELD_VALUE_INVALID', 'CUSTOM_FIELD_INVALID'].includes(code)) {
    for (const key of fieldKeys) {
      const field = customFields.find((field) => field.fieldKey === key || field.id === key);
      errors[`customFields.${field?.fieldKey ?? key}`] = code === 'CUSTOM_FIELD_REQUIRED' ? 'required' : domainKey;
    }
  }
  const fields: Record<string, string[]> = {
    LEAD_COMPANY_NAME_REQUIRED: ['companyName'], LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN: ['companyName'],
    LEAD_EXISTING_COMPANY_INVALID: ['existingCompanyPartyId'], LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH: ['existingCompanyPartyId'],
    LEAD_INDIVIDUAL_FIELDS_FORBIDDEN: ['companyName'], LEAD_CORPORATE_FIELDS_FORBIDDEN: ['firstName'],
    LEAD_CONTACT_REQUIRED: ['contacts'], LEAD_PRIMARY_CONTACT_REQUIRED: ['contacts'],
    LEAD_CONTACT_PRIMARY_INVALID: ['contacts'], LEAD_CONTACT_NAME_REQUIRED: [`contacts.${contactIndex ?? 0}.firstName`],
    LEAD_PRIMARY_PHONE_CONFLICT: [draft.leadProfileType === 'CORPORATE' ? 'companyPhones.0' : 'phones.0'],
    LEAD_EXPECTED_VALUE_INVALID: ['expectedValue'], LEAD_EXPECTED_VALUE_CURRENCY_PAIR: ['expectedValue', 'currencyCode'],
    CRM_CURRENCY_INVALID: ['currencyCode'], LEAD_STAGE_INVALID: ['stageId'], LEAD_STAGE_NOT_FOUND: ['stageId'],
    LEAD_CREATE_DISQUALIFIED: ['stageId'], LEAD_CONVERSION_REQUIRED: ['stageId'],
    CRM_ACQUISITION_SOURCE_INACTIVE: ['acquisitionSourceId'], CRM_ACQUISITION_SOURCE_NOT_FOUND: ['acquisitionSourceId'],
    CRM_TAG_UNKNOWN: ['tagIds'], PARTY_CONTACT_LIMIT_EXCEEDED: ['contacts'],
  };
  for (const field of fields[code] ?? []) serverField(field);
  if (code === 'LEAD_PHONE_INVALID') {
    serverField(contactIndex !== undefined ? `contacts.${contactIndex}.phones.0`
      : draft.leadProfileType === 'CORPORATE' ? 'companyPhones.0' : 'phones.0');
  }
  if (code.startsWith('LEAD_ADDRESS_GEO_') || code === 'GEO_HIERARCHY_INVALID') {
    const field = first('field').replace(/^address\./, '');
    serverField(`address.${Object.hasOwn(draft.address, field) ? field : 'countryId'}`);
  }
  if (code === 'PARTY_DUPLICATE_CONTACT_METHOD') {
    const level = first('level').toUpperCase();
    if (['COMPANY', 'BRANCH', 'USER', 'SAME_OWNER'].includes(level)) {
      const key = `leadForm.write.duplicate.${level}`;
      const text = translate(key);
      if (text !== key) { fieldMessageKey = key; message = text; }
    }
    const methods = details?.['methodType'];
    const types = (Array.isArray(methods) ? methods : [methods]).map((value) => String(value).toUpperCase());
    const phone = types.some((value) => ['PHONE', 'MOBILE', 'WHATSAPP'].includes(String(value)));
    const email = types.includes('EMAIL');
    if (contactIndex !== undefined) {
      if (phone) serverField(`contacts.${contactIndex}.phones.0`);
      if (email) serverField(`contacts.${contactIndex}.email`);
    } else if (draft.leadProfileType === 'INDIVIDUAL') {
      if (phone) serverField('phones.0');
      if (email) serverField('email');
    } else {
      if (phone && draft.companyPhones.some((value) => value.trim())) serverField('companyPhones.0');
      if (email && draft.companyEmail.trim()) serverField('companyEmail');
      draft.contacts.forEach((contact, index) => {
        if (phone && contact.phones.some((value) => value.trim())) serverField(`contacts.${index}.phones.0`);
        if (email && contact.email.trim()) serverField(`contacts.${index}.email`);
      });
    }
  }
  const mismatch = code === 'GW.IDEM.MISMATCH' || code.endsWith('_IDEMPOTENCY_MISMATCH');
  if (mismatch) message = translate('leadForm.write.mismatch');
  if (error instanceof ApiError && error.status === 401) message = translate('leadForm.write.notSaved');
  if (error instanceof ApiError && error.status === 429) {
    const seconds = first('retryAfterSeconds');
    message = translate(seconds ? 'leadForm.write.rateLimitedIn' : 'leadForm.write.rateLimited', { seconds });
  }
  return { ...mapped, message, errors, mismatch,
    readOnly: mapped.readOnly || code === 'LEAD_ALREADY_CONVERTED' || mismatch,
    notFound: error instanceof ApiError && error.status === 404 && code === 'LEAD_NOT_FOUND',
    conflict: code === 'CRM.LEAD.CONCURRENT_UPDATE',
  };
}
