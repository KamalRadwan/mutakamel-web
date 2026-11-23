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
import { SenderModal } from './sender-modal';

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
describe('SenderModal', () => {
  let fixture: ComponentFixture<SenderModal>;
  let component: SenderModal;
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
    fixture = TestBed.createComponent(SenderModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', { ...config });
    fixture.componentRef.setInput('etag', '"1"');
    fixture.componentRef.setInput('canManage', true);
    await render();
    vi.spyOn(component['modal'](), 'open').mockImplementation(() => {});
    vi.spyOn(component['modal'](), 'close').mockImplementation(() => {});
    vi.spyOn(component['suspendConfirm'](), 'open').mockResolvedValue(true);
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('sender change asks to confirm the suspension', async () => {
    component.open();
    component['fromAddressDraft'].set('new@example.test');
    const confirm = vi.mocked(component['suspendConfirm']().open);
    confirm.mockResolvedValueOnce(false);
    await component['save']();
    expect(confirm).toHaveBeenCalled();
    expect(transport.write).not.toHaveBeenCalled();
    await component['save']();
    expect(transport.write).toHaveBeenCalledWith(
      'PATCH',
      expect.any(String),
      { fromAddress: 'new@example.test' },
      expect.objectContaining({ ifMatch: '"1"', key: expect.any(String) }),
    );
  });
  it('422 codes map to fields', async () => {
    component.open();
    component['fromNameDraft'].set('Updated');
    transport.write.mockRejectedValueOnce(
      new ApiError(400, 'CORE_VALIDATION_FAILED', { fromName: ['Rejected'] }),
    );
    await component['save']();
    expect(component['fromNameError']()).toBeTruthy();
    for (const code of ['TENANT_EMAIL_CONFIG_INVALID', 'TENANT_EMAIL_CONFIG_SECRET_REF_INVALID']) {
      transport.write.mockRejectedValueOnce(new ApiError(422, code));
      await component['save']();
      expect(component['topError']()).toBe(messages[`wsEmail.errors.${code}`]);
    }
  });
  it('no-change answers show no changes', async () => {
    component.open();
    component['fromNameDraft'].set('Updated');
    for (const [status, code] of [
      [400, 'TENANT_EMAIL_CONFIG_EMPTY_PATCH'],
      [422, 'TENANT_EMAIL_CONFIG_NO_CHANGES'],
    ] as const) {
      transport.write.mockRejectedValueOnce(new ApiError(status, code));
      await component['save']();
      expect(component['topError']()).toBe(en.errors.noChanges);
    }
  });
  it('retry key changes only when body or If-Match changes', async () => {
    component.open();
    component['fromNameDraft'].set('Updated');
    transport.write.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await component['save']();
    await component['save']();
    expect(transport.write.mock.calls[1]).toEqual(transport.write.mock.calls[0]);
    component['fromNameDraft'].set('Another');
    await component['save']();
    expect(transport.write.mock.calls[2][3].key).not.toBe(transport.write.mock.calls[1][3].key);
    fixture.componentRef.setInput('etag', '"2"');
    await component['save']();
    expect(transport.write.mock.calls[3][3].key).not.toBe(transport.write.mock.calls[2][3].key);
  });
});
