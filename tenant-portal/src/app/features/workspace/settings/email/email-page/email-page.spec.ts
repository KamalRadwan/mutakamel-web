import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/ws-email/en.json';
import settings from '../../../../../../../public/i18n/settings/en.json';
import global from '../../../../../../../public/i18n/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { CoreHttp } from '../../../../../core/api/core-http';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { EmailApi } from '../email.api';
import { emailGates, type TenantEmailConfig } from '../email.model';
import { EmailPage } from './email-page';

const config: TenantEmailConfig = {
  revision: 1,
  fromAddress: 'mail@example.test',
  fromName: 'Workspace',
  replyTo: null,
  senderDomain: 'example.test',
  providerDriver: 'smtp',
  credentialsMode: 'TENANT_ENCRYPTED_SMTP',
  providerCredentialsConfigured: true,
  providerCredentialsVersion: null,
  providerCredentialsRefFingerprint: null,
  smtpHost: 'smtp.example.test',
  smtpPort: 587,
  smtpSecure: true,
  smtpProtocol: 'smtp',
  smtpUsername: 'mail@example.test',
  smtpPasswordConfigured: true,
  feedbackProfile: 'CRM_FEEDBACK_V1',
  dkimSelector: 'mail',
  dkimVerified: false,
  verifiedAt: null,
  planDailyQuota: 1000,
  planRateLimitPerMin: 100,
  planQuotaRevision: 1,
  dailyQuota: null,
  rateLimitPerMin: null,
  effectiveDailyQuota: 1000,
  effectiveRateLimitPerMin: 100,
  status: 'SUSPENDED',
  updatedAt: '2026-11-23T00:00:00Z',
};
const user: TenantMe = {
  id: 'actor',
  email: 'manager@example.test',
  firstName: 'Manager',
  lastName: 'User',
  hasAvatar: false,
  isTenantOwner: true,
  mfaEnabled: false,
  mfaUpdatedAt: null,
  status: 'ACTIVE',
  permissions: ['workspace.email.read', 'workspace.email.manage'],
  permissionScopes: {},
  accessibleBranches: [],
  accessibleCompanies: [],
  accessibleBranchCompanies: [],
  seats: [],
  teamMemberships: [],
  accessScope: {
    mode: 'FULL',
    branchesTruncated: false,
    companiesTruncated: false,
    teamMembershipsTruncated: false,
    teamMembershipsTotal: 0,
  },
  featureEntitlements: {},
};

function flatten(data: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'string'
        ? [[path, value]]
        : Object.entries(flatten(value as Record<string, unknown>, path));
    }),
  );
}
const messages = flatten({ ...global, wsEmail: en, settings });
describe('EmailPage', () => {
  let fixture: ComponentFixture<EmailPage>;
  let component: EmailPage;
  let api: EmailApi;
  const me = signal<TenantMe>(user);
  const transport = { readWithEtag: vi.fn(), write: vi.fn() };
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    connectionLost: vi.fn(),
    connectionRestored: vi.fn(),
  };
  beforeEach(async () => {
    vi.resetAllMocks();
    me.set({ ...user });
    transport.readWithEtag.mockResolvedValue({ data: config, etag: '"1"' });
    transport.write.mockResolvedValue({
      data: { ...config, revision: 2 },
      etag: '"2"',
      status: 200,
    });
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', prodMode: true },
        }),
        { provide: TRANSLOCO_LOADER, useValue: { getTranslation: () => of({}) } },
        { provide: CoreHttp, useValue: transport },
        { provide: AuthSession, useValue: { me } },
        { provide: Notify, useValue: notify },
        { provide: LanguageState, useValue: { current: signal('en') } },
      ],
    });
    vi.spyOn(TestBed.inject(TranslocoService), 'translate').mockImplementation((key, params) => {
      let message = messages[String(key)] ?? String(key);
      for (const [name, value] of Object.entries(params ?? {}))
        message = message.replace('{{' + name + '}}', String(value));
      return message;
    });
    api = TestBed.inject(EmailApi);
    fixture = TestBed.createComponent(EmailPage);
    component = fixture.componentInstance;

    await render();
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('not entitled shows the plan state without a request', async () => {
    transport.readWithEtag.mockClear();
    fixture.destroy();
    me.set({ ...user, featureEntitlements: { 'crm.outbound_email': false } });
    fixture = TestBed.createComponent(EmailPage);
    component = fixture.componentInstance;
    await render();
    expect(component['fullState']()).toBe('notEntitled');
    expect(transport.readWithEtag).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(en.states.notEntitledTitle);
  });
  it('ACCESS_POLICY_BLOCKED shows the blocked state', async () => {
    transport.readWithEtag.mockRejectedValue(new ApiError(403, 'ACCESS_POLICY_BLOCKED'));
    fixture.destroy();
    fixture = TestBed.createComponent(EmailPage);
    component = fixture.componentInstance;
    await render();
    expect(component['fullState']()).toBe('blocked');
  });
  it('403 shows forbidden', async () => {
    transport.readWithEtag.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    fixture.destroy();
    fixture = TestBed.createComponent(EmailPage);
    component = fixture.componentInstance;
    await render();
    expect(component['fullState']()).toBe('forbidden');
  });
  it('503 codes map to their states', async () => {
    for (const [code, state] of [
      ['TENANT_EMAIL_CONFIG_NOT_READY', 'notReady'],
      ['TENANT_EMAIL_CONFIG_DEPENDENCY_UNAVAILABLE', 'failed'],
    ] as const) {
      transport.readWithEtag.mockRejectedValue(new ApiError(503, code));
      fixture.destroy();
      fixture = TestBed.createComponent(EmailPage);
      component = fixture.componentInstance;
      await render();
      expect(component['fullState']()).toBe(state);
      expect(notify.error).toHaveBeenCalled();
    }
  });
  it('5xx and offline show load-failure', async () => {
    for (const status of [500, 502, 0]) {
      transport.readWithEtag.mockRejectedValue(
        new ApiError(status, status === 0 ? 'NETWORK_ERROR' : 'COMMON.GENERIC.INTERNAL_ERROR'),
      );
      fixture.destroy();
      fixture = TestBed.createComponent(EmailPage);
      component = fixture.componentInstance;
      await render();
      expect(component['fullState']()).toBe('failed');
      expect(fixture.nativeElement.textContent).toContain(settings.common.retry);
    }
    expect(notify.connectionLost).toHaveBeenCalledTimes(1);
  });
  it('scoped manager sees read-only', async () => {
    me.set({
      ...user,
      isTenantOwner: false,
      permissionScopes: {
        'workspace.email.manage': { tenantWide: false, companyIds: ['one'], branchIds: [] },
      },
    });
    await render();
    expect(component['canManage']).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(en.common.readOnly);
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
  });
  it('428 shows a toast', async () => {
    transport.write.mockRejectedValueOnce(
      new ApiError(428, 'TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED'),
    );
    const conflict = vi.spyOn(component['conflictDialog'](), 'open');
    await component['toggleDeliveryStatus'](
      { ...config, status: 'ACTIVE', dkimVerified: true },
      false,
    );
    expect(notify.error).toHaveBeenCalledWith(settings.errors.generic);
    expect(conflict).not.toHaveBeenCalled();
  });
  it('scoped 403 turns the page read-only', async () => {
    transport.write.mockRejectedValueOnce(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    await component['toggleDeliveryStatus'](
      { ...config, status: 'ACTIVE', dkimVerified: true },
      false,
    );
    await render();
    expect(component['canManage']).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(en.needsTenantWide);
    expect(notify.error).toHaveBeenCalledWith(en.needsTenantWide);
  });
  it('idempotency codes are not conflicts', async () => {
    const conflict = vi.spyOn(component['conflictDialog'](), 'open');
    for (const [status, code, key] of [
      [409, 'GW.IDEM.IN_FLIGHT', 'idempotency'],
      [422, 'GW.IDEM.MISMATCH', 'idempotencyMismatch'],
      [409, 'IDEMPOTENCY_REQUEST_PROCESSING', 'idempotency'],
      [422, 'IDEMPOTENCY_BODY_MISMATCH', 'idempotencyMismatch'],
    ] as const) {
      transport.write.mockRejectedValueOnce(new ApiError(status, code));
      await component['toggleDeliveryStatus'](
        { ...config, status: 'ACTIVE', dkimVerified: true },
        false,
      );
      expect(notify.error).toHaveBeenLastCalledWith(messages[`settings.errors.${key}`]);
    }
    expect(conflict).not.toHaveBeenCalled();
  });
  it('send-test 429 shows the wait text', async () => {
    transport.write.mockRejectedValueOnce(new ApiError(429, 'EMAIL_TEST_RATE_LIMITED'));
    await component['sendTest']();
    expect(notify.error).toHaveBeenCalledWith(en.errors.EMAIL_TEST_RATE_LIMITED);
  });
  it('send-test confirms the signed-in recipient', async () => {
    await component['sendTest']();
    expect(notify.success).toHaveBeenCalledWith(en.sendTestDone.replace('{{email}}', user.email));
  });
  it('send-test is disabled while any editor has a draft', async () => {
    const smtp = component['smtpModal']();
    vi.spyOn(smtp['modal'](), 'open').mockImplementation(() => {});
    smtp.open();
    smtp['passwordDraft'].set('test-only-secret');
    await render();
    expect(component['hasDrafts']()).toBe(true);
    await component['sendTest']();
    expect(transport.write).not.toHaveBeenCalled();
    smtp.close = vi.fn();
  });
  it('managed provider card is read-only regardless of credentialsMode', async () => {
    component['onResultSaved']({ config: { ...config, providerDriver: 'ses' }, etag: '"1"' });
    await render();
    expect(fixture.nativeElement.textContent).toContain(en.managedBySupport);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.some((button) => button.textContent?.trim() === en.provider.change)).toBe(false);
  });
});
