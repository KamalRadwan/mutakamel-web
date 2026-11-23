import type { TranslocoService } from '@jsverse/transloco';
import { ApiError, fieldErrorsOf, isRetryableWriteError } from '../../../../core/api/api-errors';
import { crmSettingsError } from '../../settings/shared/settings-api';
import { CustomerDraft, DraftErrors, mapServerErrors } from './customer-draft';

/** One record error policy for the quick modal and full page. */
export function customerRecordError(error: unknown, transloco: TranslocoService, draft?: CustomerDraft) {
  const dictionary = transloco.getTranslation(transloco.getActiveLang());
  const translate = (key: string, params?: Record<string, unknown>): string =>
    dictionary[key] !== undefined ? transloco.translate(key, params) : key;
  const common = crmSettingsError(translate, error, 'customerForm');
  const fields: DraftErrors = mapServerErrors(error, draft);
  for (const path of Object.keys(fieldErrorsOf(error))) {
    const target = path === '_' ? 'form' : path.replace(/^primaryContact\./, '').replace(/^displayName$/, draft?.profileType === 'CORPORATE' ? 'companyName' : 'firstName');
    fields[target] ??= 'customerForm.server.CRM_VALIDATION_FAILED';
  }
  const code = error instanceof ApiError ? error.code : '';
  if ((code.startsWith('CUSTOM_FIELD_') || code.includes('.CUSTOM_FIELD_')) && Object.keys(fields).length === 0) {
    fields['form'] = 'customerForm.server.CUSTOM_FIELD_VALUE_INVALID';
  }
  const status = error instanceof ApiError ? error.status : null;
  const reloadRequired = code === 'GW.IDEM.MISMATCH' || code.endsWith('_IDEMPOTENCY_MISMATCH');
  const moduleDisabled = /^CRM_.*_DISABLED$/.test(code);
  let message = common.message;
  if (status === 401) message = transloco.translate('customerForm.server.notSaved');
  else if (moduleDisabled) message = transloco.translate('customerForm.server.moduleDisabled');
  else if (reloadRequired) message = transloco.translate('customerForm.server.reloadRequired');
  else if (status === 429) {
    const raw = error instanceof ApiError ? error.details?.['retryAfterSeconds'] ?? error.details?.['retryAfter'] : undefined;
    const seconds = Number(Array.isArray(raw) ? raw[0] : raw);
    message = Number.isFinite(seconds) && seconds >= 0
      ? transloco.translate('customerForm.server.rateLimited', { seconds }) : common.message;
  } else if (fields['form']?.startsWith('customerForm.')) message = transloco.translate(fields['form']);
  else if (code) {
    const key = `customerForm.server.${code}`;
    const translated = translate(key);
    if (translated !== key) message = translated;
    else {
      const recordKey = `customers.errors.${code}`;
      const recordMessage = translate(recordKey);
      if (recordMessage !== recordKey) message = recordMessage;
    }
  }
  if (code === 'CUSTOMER_PROFILE_SOURCE_LEAD_CONFLICT' && error instanceof ApiError) {
    const names = error.details?.['leadName'];
    if (Array.isArray(names)) message += ` ${names.filter((name) => typeof name === 'string').join(', ')}`;
  }
  return { ...common, message, fields, reloadRequired, readOnly: common.readOnly || moduleDisabled,
    keepKey: isRetryableWriteError(error) || status === 401 };
}
