import { ApiError, crmSettingsError, errorMessage } from './settings-api';

describe('crmSettingsError', () => {
  function translator(messages: Record<string, string>) {
    return { translate: (key: string) => messages[key] ?? key };
  }

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
