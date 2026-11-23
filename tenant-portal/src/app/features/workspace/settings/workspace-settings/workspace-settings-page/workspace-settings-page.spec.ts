import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import generalEn from '../../../../../../../public/i18n/ws-general/en.json';
import generalAr from '../../../../../../../public/i18n/ws-general/ar.json';
import sessionEn from '../../../../../../../public/i18n/ws-session/en.json';
import sessionAr from '../../../../../../../public/i18n/ws-session/ar.json';
import recordEn from '../../../../../../../public/i18n/record-page/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { WorkspaceSettingsApi } from '../workspace-settings.api';
import type {
  SessionPolicy,
  UpdateSessionPolicyRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceSettings,
} from '../workspace-settings.model';
import { WorkspaceSettingsPage, workspaceSettingsLeaveGuard } from './workspace-settings-page';

const translations: Record<string, Translation> = {
  en: globalEn,
  'ws-general/en': generalEn,
  'ws-session/en': sessionEn,
  'record-page/en': recordEn,
};
@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(translations[path] ?? {}));
  }
}
const settings: WorkspaceSettings = {
  id: 'settings',
  defaultLanguage: 'en',
  defaultCurrencyCode: 'EGP',
  timezone: 'Africa/Cairo',
  allowSupport: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
};
const defaults = {
  accessTokenTtlSeconds: 900,
  idleTimeoutSeconds: 259200,
  absoluteTimeoutSeconds: 2592000,
};
const policy: SessionPolicy = {
  override: { ...defaults, accessTokenTtlSeconds: 1200 },
  effective: { ...defaults, accessTokenTtlSeconds: 1200 },
  defaults,
  limits: {
    accessTokenTtlSeconds: { min: 60, max: 86400 },
    idleTimeoutSeconds: { min: 300, max: 2592000 },
    absoluteTimeoutSeconds: { min: 1800, max: 31536000 },
  },
};
const etag = `"${'a'.repeat(64)}"`;
const nextEtag = `"${'b'.repeat(64)}"`;
const currencies = [
  {
    id: 'egp',
    code: 'EGP',
    name: 'Egyptian Pound',
    symbol: 'E£',
    isDefault: true,
    status: 'ACTIVE' as const,
  },
  {
    id: 'usd',
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    isDefault: false,
    status: 'ACTIVE' as const,
  },
];
const permissions = [
  'workspace.read',
  'workspace.manage',
  'workspace.session-policy.manage',
  'currencies.currency.manage',
];
function user(owner = true, grants = permissions, tenantWide = true): TenantMe {
  return {
    id: 'actor',
    isTenantOwner: owner,
    permissions: grants,
    email: 'owner@example.test',
    firstName: 'Workspace',
    lastName: 'Owner',
    hasAvatar: false,
    workspace: { timezone: 'UTC', defaultLanguage: 'en' },
    mfaEnabled: false,
    mfaUpdatedAt: null,
    status: 'ACTIVE',
    accessibleBranches: [],
    accessibleCompanies: [],
    accessibleBranchCompanies: [],
    seats: [],
    teamMemberships: [],
    featureEntitlements: {},
    accessScope: {
      mode: 'FULL',
      branchesTruncated: false,
      companiesTruncated: false,
      teamMembershipsTruncated: false,
      teamMembershipsTotal: 0,
    },
    permissionScopes: Object.fromEntries(
      grants.map((key) => [key, { tenantWide, companyIds: [], branchIds: [] }]),
    ),
  };
}
const originalDialog = {
  showModal: HTMLDialogElement.prototype.showModal,
  close: HTMLDialogElement.prototype.close,
};

describe('WorkspaceSettingsPage', () => {
  let fixture: ComponentFixture<WorkspaceSettingsPage>;
  let page: WorkspaceSettingsPage;
  let host: HTMLElement;
  const me = signal<TenantMe>(user());
  const auth = {
    me,
    requestVersion: vi.fn(() => ({ generation: 1, revision: 1 })),
    reloadProfile: vi.fn(async () => undefined),
  };
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    connectionLost: vi.fn(),
    connectionRestored: vi.fn(),
  };
  const api = {
    getSettings: vi.fn(async () => ({ ...settings })),
    getSessionPolicy: vi.fn(async () => ({ data: structuredClone(policy), etag })),
    listActiveCurrencies: vi.fn(async () => [...currencies]),
    listTimezones: vi.fn(async () => [
      { value: 'Africa/Cairo', label: 'Africa/Cairo', offset: '+02:00' },
    ]),
    updateSettings: vi.fn(async (body: UpdateWorkspaceSettingsRequest, _key: string) => ({
      ...settings,
      ...body,
    })),
    updateSessionPolicy: vi.fn(
      async (body: UpdateSessionPolicyRequest, _key: string, _etag: string) => ({
        data: {
          ...structuredClone(policy),
          override: body.override,
          effective: body.override ?? defaults,
        },
        etag: nextEtag,
      }),
    ),
    setDefaultCurrency: vi.fn(async (_id: string, _key: string) => undefined),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    me.set(user());
    api.getSettings.mockResolvedValue({ ...settings });
    api.getSessionPolicy.mockResolvedValue({ data: structuredClone(policy), etag });
    api.listActiveCurrencies.mockResolvedValue([...currencies]);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WorkspaceSettingsApi, useValue: api },
        { provide: AuthSession, useValue: auth },
        { provide: Notify, useValue: notify },
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
      ],
    });
    fixture = TestBed.createComponent(WorkspaceSettingsPage);
    page = fixture.componentInstance;
    host = fixture.nativeElement;
  });
  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    HTMLDialogElement.prototype.showModal = originalDialog.showModal;
    HTMLDialogElement.prototype.close = originalDialog.close;
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function sessionInput(value = '1500') {
    const input = host.querySelector<HTMLInputElement>('input[id$="-accessTokenTtlSeconds"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  async function generalFailure(error: ApiError) {
    await render();
    page['onAllowSupportChange'](false);
    api.updateSettings.mockRejectedValueOnce(error);
    await page['saveGeneral']();
    await render();
  }
  async function sessionFailure(error: ApiError) {
    await render();
    sessionInput();
    api.updateSessionPolicy.mockRejectedValueOnce(error);
    await page['saveSession']();
    await render();
  }

  it('403 on load shows the forbidden page', async () => {
    api.getSettings.mockRejectedValueOnce(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await render();
    expect(host.textContent).toContain(generalEn.states.forbiddenTitle);
    expect(host.querySelector('[data-card]')).toBeNull();
  });
  it('does not issue reads without workspace.read', async () => {
    me.set(user(false, []));
    await render();
    expect(api.getSettings).not.toHaveBeenCalled();
    expect(host.textContent).toContain(generalEn.states.forbiddenTitle);
  });
  it('TENANT_NOT_READY shows the not-ready state', async () => {
    api.getSettings.mockRejectedValueOnce(new ApiError(503, 'TENANT_NOT_READY'));
    await render();
    expect(host.textContent).toContain(generalEn.states.notReadyTitle);
  });
  it.each([503, 0])('5xx and offline show load-failure with retry (%s)', async (status) => {
    api.getSettings.mockRejectedValueOnce(
      new ApiError(status, status ? 'GW.UPSTREAM.FAILED' : 'NETWORK_ERROR'),
    );
    await render();
    expect(host.textContent).toContain(generalEn.states.failedTitle);
    if (!status) expect(notify.connectionLost).toHaveBeenCalledTimes(1);
    host.querySelector<HTMLButtonElement>('button')!.click();
    await render();
    expect(host.querySelector('[data-card="general"]')).toBeTruthy();
  });
  it('general save reloads the profile (WG-7)', async () => {
    await render();
    sessionInput();
    page['onAllowSupportChange'](false);
    await expect(page['saveGeneral']()).resolves.toBe(true);
    await render();
    expect(api.updateSettings).toHaveBeenCalledWith({ allowSupport: false }, expect.any(String));
    expect(auth.reloadProfile).toHaveBeenCalledExactlyOnceWith({ generation: 1, revision: 1 });
    expect(page['generalDirty']()).toBe(false);
    expect(page['sessionDirty']()).toBe(true);
    expect(api.updateSessionPolicy).not.toHaveBeenCalled();
  });
  it('TIMEZONE_INVALID is a field message', async () => {
    await generalFailure(new ApiError(422, 'TIMEZONE_INVALID'));
    expect(page['generalErrors']()['timezone']).toBe(generalEn.errors.TIMEZONE_INVALID);
    expect(host.textContent).toContain(generalEn.errors.TIMEZONE_INVALID);
  });
  it('LANGUAGE_INVALID is a field message', async () => {
    await generalFailure(new ApiError(422, 'LANGUAGE_INVALID'));
    expect(page['generalErrors']()['defaultLanguage']).toBe(generalEn.errors.LANGUAGE_INVALID);
  });
  it('settings validation errors map to fields', async () => {
    await generalFailure(
      new ApiError(400, 'CORE_VALIDATION_FAILED', {
        defaultLanguage: ['language message'],
        timezone: ['timezone message'],
        allowSupport: ['boolean message'],
        _: ['form message'],
      }),
    );
    for (const text of ['language message', 'timezone message', 'boolean message', 'form message'])
      expect(host.textContent).toContain(text);
    expect(
      Array.from(host.querySelectorAll('[role="alert"]')).some((element) =>
        element.textContent?.includes('form message'),
      ),
    ).toBe(true);
  });
  it('scoped manage turns the general card read-only', async () => {
    await generalFailure(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    expect(page['canManage']()).toBe(false);
    expect(page['canManageSession']()).toBe(true);
    expect(host.textContent).toContain(generalEn.needsTenantWide);
    expect(host.querySelector('[data-card="general"] footer')).toBeNull();
  });
  it('ACCESS_POLICY_BLOCKED turns both cards read-only', async () => {
    await generalFailure(new ApiError(403, 'ACCESS_POLICY_BLOCKED'));
    expect(page['canManage']()).toBe(false);
    expect(page['canManageSession']()).toBe(false);
    expect(host.textContent).toContain(generalEn.planReadOnly);
    expect(host.querySelector('[data-card="session"] footer')).toBeNull();
  });
  it.each(['GW.IDEM.IN_FLIGHT', 'GW.IDEM.MISMATCH'])(
    'idempotency codes use the core mapper (%s)',
    async (code) => {
      await generalFailure(new ApiError(code.endsWith('MISMATCH') ? 422 : 409, code));
      const key = api.updateSettings.mock.calls[0][1];
      expect(notify.error.mock.calls[0][1]).toBe(
        code.endsWith('MISMATCH')
          ? globalEn.apiErrors.idempotencyMismatch
          : globalEn.apiErrors.idempotency,
      );
      expect(page['generalDirty']()).toBe(true);
      await page['saveGeneral']();
      expect(api.updateSettings.mock.calls[1][1]).toBe(key);
    },
  );
  it('401 on general save keeps the draft', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    await generalFailure(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    expect(notify.error).toHaveBeenCalledWith(generalEn.toast.failedTitle, generalEn.notSaved);
    expect(page['allowSupportDraft']()).toBe(false);
    expect(page['generalDirty']()).toBe(true);
    const first = api.updateSettings.mock.calls[0];
    await page['saveGeneral']();
    expect(api.updateSettings.mock.calls[1]).toEqual(first);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('429 on save shows the rate text', async () => {
    await generalFailure(
      new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }),
    );
    expect(notify.error.mock.calls[0][1]).toContain('12');
    expect(notify.error.mock.calls[0][1]).not.toContain('rateLimited');
  });
  it('403 on session policy hides the card', async () => {
    api.getSessionPolicy.mockRejectedValueOnce(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await render();
    expect(host.querySelector('[data-card="session"]')).toBeNull();
    page['onAllowSupportChange'](false);
    await expect(page['saveGeneral']()).resolves.toBe(true);
  });
  it('non-owner sees a read-only session card', async () => {
    me.set(user(false, ['workspace.read', 'workspace.manage']));
    await render();
    expect(host.textContent).toContain(sessionEn.ownerOnly);
    expect(
      host.querySelector<HTMLInputElement>('input[id$="-accessTokenTtlSeconds"]')?.readOnly,
    ).toBe(true);
    expect(host.querySelector('[data-card="session"] footer')).toBeNull();
    expect(page['canManage']()).toBe(true);
  });
  it('scoped grants cannot edit while tenant-wide session grants can', async () => {
    me.set(user(false, permissions, false));
    await render();
    expect(page['canManage']()).toBe(false);
    expect(page['canManageSession']()).toBe(false);
    expect(page['canManageCurrency']()).toBe(false);
    me.set(user(false));
    await render();
    expect(page['canManageSession']()).toBe(true);
  });
  it('restore defaults sends override null after confirm', async () => {
    await render();
    const confirm = vi
      .spyOn(ConfirmDialog.prototype, 'open')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await page['restoreDefaults']();
    expect(api.updateSessionPolicy).not.toHaveBeenCalled();
    await page['restoreDefaults']();
    await render();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(api.updateSessionPolicy).toHaveBeenCalledWith(
      { override: null },
      expect.any(String),
      etag,
    );
    expect(page['savedPolicy']()?.etag).toBe(nextEtag);
    expect(page['savedPolicy']()?.data.override).toBeNull();
    expect(host.querySelector('[data-card="session"] footer')?.textContent).not.toContain(
      sessionEn.restoreDefaults,
    );
  });
  it('limit exceeded shows the range on the field', async () => {
    await sessionFailure(
      new ApiError(422, 'SESSION_POLICY_LIMIT_EXCEEDED', { accessTokenTtlSeconds: ['60–86400'] }),
    );
    expect(host.textContent).toContain('Enter a value between 60–86400');
  });
  it('idle over absolute is a field message', async () => {
    await sessionFailure(new ApiError(422, 'SESSION_POLICY_IDLE_EXCEEDS_ABSOLUTE'));
    expect(page['sessionFields']().find((field) => field.key === 'idleTimeoutSeconds')?.error).toBe(
      sessionEn.errors.SESSION_POLICY_IDLE_EXCEEDS_ABSOLUTE,
    );
  });
  it.each([412, 409])('stale session policy opens the conflict modal (%s)', async (status) => {
    await sessionFailure(
      new ApiError(
        status,
        status === 412
          ? 'SESSION_POLICY_PRECONDITION_FAILED'
          : 'SESSION_POLICY_IDEMPOTENCY_CONFLICT',
      ),
    );
    expect(host.querySelector('ui-conflict-dialog dialog[open]')).toBeTruthy();
    const firstKey = api.updateSessionPolicy.mock.calls[0][1];
    api.getSessionPolicy.mockResolvedValue({
      data: { ...policy, effective: { ...defaults, accessTokenTtlSeconds: 1800 } },
      etag: nextEtag,
    });
    await page['resolveConflict'](true);
    await render();
    expect(page['sessionFields']()[0].text).toBe('1500');
    expect(page['savedPolicy']()?.etag).toBe(nextEtag);
    await page['saveSession']();
    expect(api.updateSessionPolicy.mock.calls[1][0]).toEqual({
      override: { ...policy.effective, accessTokenTtlSeconds: 1500 },
    });
    expect(api.updateSessionPolicy.mock.calls[1][1]).not.toBe(firstKey);
    expect(api.updateSessionPolicy.mock.calls[1][2]).toBe(nextEtag);
    sessionInput('1600');
    await page['resolveConflict'](false);
    await render();
    expect(page['sessionFields']()[0].text).toBe('1800');
    expect(page['sessionDirty']()).toBe(false);
  });
  it.each([
    new ApiError(428, 'SESSION_POLICY_PRECONDITION_REQUIRED'),
    new ApiError(400, 'SESSION_POLICY_INVALID_ETAG'),
  ])('428 shows a toast (%s)', async (error) => {
    await sessionFailure(error);
    expect(notify.error).toHaveBeenCalledWith(
      sessionEn.saveFailed,
      sessionEn.errors.SESSION_POLICY_PRECONDITION_REQUIRED,
    );
    expect(page['conflictOpen']()).toBe(false);
  });
  it('401 on session save keeps the draft', async () => {
    await sessionFailure(new ApiError(401, 'UNAUTHORIZED'));
    expect(notify.error).toHaveBeenCalledWith(sessionEn.saveFailed, sessionEn.notSaved);
    expect(page['sessionDirty']()).toBe(true);
    const first = api.updateSessionPolicy.mock.calls[0];
    await page['saveSession']();
    expect(api.updateSessionPolicy.mock.calls[1]).toEqual(first);
  });
  it('an in-flight gateway session write keeps its key without opening the stale dialog', async () => {
    await sessionFailure(new ApiError(409, 'GW.IDEM.IN_FLIGHT'));
    expect(page['conflictOpen']()).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(sessionEn.saveFailed, globalEn.apiErrors.idempotency);
    const first = api.updateSessionPolicy.mock.calls[0];
    await page['saveSession']();
    expect(api.updateSessionPolicy.mock.calls[1]).toEqual(first);
  });
  it('currency managers get the inline default select', async () => {
    await render();
    expect(host.querySelector('#' + page['uid'] + '-currency-select')).toBeTruthy();
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    page['onAllowSupportChange'](false);
    api.getSettings.mockResolvedValue({ ...settings, defaultCurrencyCode: 'USD' });
    await page['changeCurrency']('usd');
    await render();
    expect(api.setDefaultCurrency).toHaveBeenCalledWith('usd', expect.any(String));
    expect(api.getSettings).toHaveBeenCalledTimes(2);
    expect(page['saved']()?.defaultCurrencyCode).toBe('USD');
    expect(page['generalDirty']()).toBe(true);
    expect(page['allowSupportDraft']()).toBe(false);
  });
  it.each([403, 503])('currency list failure falls back to the link (%s)', async (status) => {
    api.listActiveCurrencies.mockRejectedValueOnce(
      new ApiError(status, 'MISSING_REQUIRED_PERMISSIONS'),
    );
    await render();
    expect(host.querySelector('[id$="-currency-select"]')).toBeNull();
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/workspace/settings/currencies');
    expect(host.textContent).toContain('EGP');
    expect(host.textContent).toContain(generalEn.currency.changeInCurrencies);
  });
  it.each([409, 404])('set-default failure reverts the select (%s)', async (status) => {
    await render();
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    api.setDefaultCurrency.mockRejectedValueOnce(
      new ApiError(status, status === 409 ? 'CURRENCY_INACTIVE_DEFAULT' : 'CURRENCY_NOT_FOUND'),
    );
    const dropdown = page['currencyDropdown']()!;
    dropdown.value.set('usd');
    await page['changeCurrency']('usd');
    await render();
    expect(dropdown.value()).toBe('egp');
    expect(page['saved']()?.defaultCurrencyCode).toBe('EGP');
    expect(notify.error).toHaveBeenCalled();
    const key = api.setDefaultCurrency.mock.calls[0][1];
    await page['changeCurrency']('usd');
    expect(api.setDefaultCurrency.mock.calls[1][1]).toBe(key);
  });
  it('leave guard covers both cards', async () => {
    await render();
    const dialog = vi.spyOn(UnsavedDialog.prototype, 'open').mockResolvedValue('cancel');
    page['onAllowSupportChange'](false);
    await expect(page.confirmLeave()).resolves.toBe(false);
    page['undoGeneral']();
    sessionInput();
    await expect(page.confirmLeave()).resolves.toBe(false);
    expect(dialog).toHaveBeenCalledTimes(2);
    dialog.mockResolvedValue('save');
    page['onAllowSupportChange'](false);
    await expect(page.confirmLeave()).resolves.toBe(true);
    expect(api.updateSettings).toHaveBeenCalledTimes(1);
    expect(api.updateSessionPolicy).toHaveBeenCalledTimes(1);
    expect(typeof workspaceSettingsLeaveGuard).toBe('function');
  });
  it('independent undo and changed bodies rotate only their own held keys', async () => {
    await render();
    page['onAllowSupportChange'](false);
    sessionInput();
    api.updateSettings.mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
    await page['saveGeneral']();
    const key = api.updateSettings.mock.calls[0][1];
    page['onTimezoneChange']('UTC');
    await page['saveGeneral']();
    expect(api.updateSettings.mock.calls[1][1]).not.toBe(key);
    expect(api.updateSettings.mock.calls[1][0]).toEqual({ timezone: 'UTC', allowSupport: false });
    expect(page['sessionDirty']()).toBe(true);
    page['undoSession']();
    expect(page['sessionDirty']()).toBe(false);
  });
  it('session hints include limits and defaults, and both scopes keep matching language keys', async () => {
    await render();
    for (const field of page['sessionFields']()) {
      expect(field.hint).toContain(String(policy.defaults[field.key]));
      expect(field.hint).toContain(String(policy.limits[field.key].min));
      expect(field.hint).toContain(String(policy.limits[field.key].max));
    }
    function keys(value: object, prefix = ''): string[] {
      return Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' && child !== null
          ? keys(child, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    }
    expect(keys(generalEn).sort()).toEqual(keys(generalAr).sort());
    expect(keys(sessionEn).sort()).toEqual(keys(sessionAr).sort());
  });
});
