import en from '../../../../../../public/i18n/settings/en.json';
import ar from '../../../../../../public/i18n/settings/ar.json';
import { ApiError, crmSettingsError, errorMessage } from './settings-api';

describe('crmSettingsError', () => {
  function translator(messages: Record<string, string>) {
    return { translate: (key: string) => messages[key] ?? key };
  }

  describe.each([
    { language: 'en', direction: 'ltr', messages: en },
    { language: 'ar', direction: 'rtl', messages: ar },
  ])('$language ($direction)', ({ language, direction, messages }) => {
    describe.each(['light', 'dark'])('%s', (theme) => {
      const sharedMessages = Object.fromEntries(
        Object.entries(messages.errors).map(([key, value]) => [`settings.errors.${key}`, value]),
      );
      const t = translator(sharedMessages);
      let originalAttributes: (string | null)[];

      beforeEach(() => {
        originalAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
        document.documentElement.setAttribute('lang', language);
        document.documentElement.setAttribute('dir', direction);
        document.documentElement.setAttribute('data-theme', theme);
      });

      afterEach(() => {
        ['lang', 'dir', 'data-theme'].forEach((name, index) => {
          const original = originalAttributes[index];
          if (original === null) document.documentElement.removeAttribute(name);
          else document.documentElement.setAttribute(name, original);
        });
      });

      it('module off makes the page read-only', () => {
        for (const code of ['CRM_LEADS_DISABLED', 'CRM_OPPORTUNITIES_DISABLED'] as const) {
          const error = new ApiError(403, code, { companyId: ['019ae170-7000-7000-8000-000000000001'] });
          expect(crmSettingsError(t, error, 'record')).toEqual({
            message: messages.errors[code],
            readOnly: true,
            kind: 'forbidden',
            correlationId: null,
          });
        }
      });

      it('scoped denial', () => {
        expect(crmSettingsError(t, new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'), 'record')).toEqual({
          message: messages.errors.CRM_SCOPED_PERMISSION_DENIED,
          readOnly: false,
          kind: 'forbidden',
          correlationId: null,
        });
      });

      it('tag codes', () => {
        for (const [code, status] of [
          ['CRM_RECORD_TAG_ALREADY_ATTACHED', 409],
          ['CRM_TAG_UNKNOWN', 422],
          ['CRM_RECORD_TAG_NOT_FOUND', 404],
        ] as const) {
          expect(crmSettingsError(t, new ApiError(status, code), 'record')).toEqual({
            message: messages.errors[code],
            readOnly: false,
            kind: status === 404 ? 'not-found' : 'load-failure',
            correlationId: null,
          });
        }
      });

      it('page key still wins', () => {
        const pageMessage = language === 'ar' ? 'رسالة خاصة بالسجل.' : 'Record-specific message.';
        for (const code of ['CRM_LEADS_DISABLED', 'CRM_OPPORTUNITIES_DISABLED', 'CRM_SCOPED_PERMISSION_DENIED',
          'CRM_RECORD_TAG_ALREADY_ATTACHED', 'CRM_TAG_UNKNOWN', 'CRM_RECORD_TAG_NOT_FOUND']) {
          const pageTranslator = translator({ ...sharedMessages, [`record.errors.${code}`]: pageMessage });
          expect(crmSettingsError(pageTranslator, new ApiError(403, code), 'record').message).toBe(pageMessage);
        }
      });
    });
  });

  it('page key wins', () => {
    const t = translator({ 'general.errors.CRM_PERMISSION_DENIED': 'Page permission',
      'settings.errors.CRM_PERMISSION_DENIED': 'Shared permission' });
    expect(crmSettingsError(t, new ApiError(403, 'CRM_PERMISSION_DENIED'), 'general').message).toBe('Page permission');
  });

  it('shared key is the fallback', () => {
    const t = translator({ 'settings.errors.CRM_PERMISSION_DENIED': 'Shared permission' });
    expect(crmSettingsError(t, new ApiError(403, 'CRM_PERMISSION_DENIED'), 'general').message).toBe('Shared permission');
  });

  it('core message last', () => {
    const t = translator({ 'settings.errors.generic': 'Generic failure' });
    const error = new ApiError(500, 'UNKNOWN_CODE');
    expect(crmSettingsError(t, error, 'general').message).toBe(errorMessage(error, 'general', t));
    expect(crmSettingsError(t, error, 'general').message).toBe('Generic failure');
  });

  it('read-only plan flags the page', () => {
    for (const code of ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY']) {
      expect(crmSettingsError(translator({}), new ApiError(403, code), 'general').readOnly).toBe(true);
    }
    expect(crmSettingsError(translator({}), new ApiError(403, 'CRM_PERMISSION_DENIED'), 'general').readOnly).toBe(false);
  });

  it('keeps subscription and permission load errors forbidden', () => {
    for (const code of ['CRM_SUBSCRIPTION_BLOCKED', 'CRM_MODULE_DISABLED', 'CRM_MODULE_SEAT_REQUIRED',
      'CRM_FEATURE_DISABLED', 'CRM_PERMISSION_DENIED', 'MISSING_REQUIRED_PERMISSIONS', 'BRANCH_PERMISSION_DENIED',
      'BRANCH_ACCESS_DENIED', 'BRANCH_CONTEXT_REQUIRED']) {
      expect(crmSettingsError(translator({}), new ApiError(403, code), 'general').kind).toBe('forbidden');
    }
  });

  it('keeps service failures retryable and preserves the correlation id', () => {
    for (const code of ['ENTITLEMENT_UNAVAILABLE', 'CRM_SETTINGS_MISSING']) {
      const result = crmSettingsError(translator({}), new ApiError(503, code, undefined, { correlationId: 'ref-1' }), 'general');
      expect(result.kind).toBe('load-failure');
      expect(result.correlationId).toBe('ref-1');
    }
    expect(crmSettingsError(translator({}), new ApiError(0, 'NETWORK_ERROR'), 'general').kind).toBe('load-failure');
    expect(crmSettingsError(translator({}), new ApiError(404, 'NOT_FOUND'), 'general').kind).toBe('not-found');
  });

  it('passes details through for interpolated messages and supports function translators', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      key === 'settings.errors.REQUEST_PAYLOAD_BOUNDS_EXCEEDED' ? `Too large: ${params?.['max']}` : key;
    expect(crmSettingsError(t, new ApiError(400, 'REQUEST_PAYLOAD_BOUNDS_EXCEEDED', { max: ['10'] }), 'general').message)
      .toBe('Too large: 10');
  });
});
