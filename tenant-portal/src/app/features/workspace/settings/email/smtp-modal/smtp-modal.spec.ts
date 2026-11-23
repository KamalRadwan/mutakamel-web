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
import { SmtpModal } from './smtp-modal';

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
  workspace: { timezone: 'UTC', defaultLanguage: 'en' },
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
describe('SmtpModal', () => {
  let fixture: ComponentFixture<SmtpModal>;
  let component: SmtpModal;
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
    fixture = TestBed.createComponent(SmtpModal);
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

  it('password is write-only', async () => {
    component.open();
    expect(component['passwordDraft']()).toBe('');
    expect(component['hasSavedPassword']()).toBe(true);
    component['hostDraft'].set('other.example.test');
    await component['save']();
    expect(transport.write.mock.calls[0][2]).not.toHaveProperty('smtpPassword');
    component.open();
    component['passwordDraft'].set('test-only-secret');
    await component['save']();
    expect(transport.write.mock.calls[1][2].smtpPassword).toBe('test-only-secret');
    expect(component['passwordDraft']()).toBe('');
    expect(component['saveOp']).toBeNull();
    expect(
      JSON.stringify(
        api['queries']
          .getQueryCache()
          .getAll()
          .map((q) => q.queryKey),
      ),
    ).not.toContain('test-only-secret');
    component.open();
    component['passwordDraft'].set('discard');
    component.close();
    expect(component['passwordDraft']()).toBe('');
    expect(component['saveOp']).toBeNull();
  });
  it('switching to smtp needs the full set', async () => {
    fixture.componentRef.setInput('config', {
      ...config,
      providerDriver: 'platform-shared',
      smtpHost: null,
      smtpUsername: null,
      smtpPasswordConfigured: false,
    });
    component.open(true);
    expect(component['canSubmit']()).toBe(false);
    component['hostDraft'].set('smtp.example.test');
    component['usernameDraft'].set('sender');
    component['passwordDraft'].set('test-only-secret');
    expect(component['canSubmit']()).toBe(true);
    await component['save']();
    expect(Object.keys(transport.write.mock.calls[0][2]).sort()).toEqual(
      [
        'providerDriver',
        'smtpHost',
        'smtpPort',
        'smtpSecure',
        'smtpProtocol',
        'smtpUsername',
        'smtpPassword',
      ].sort(),
    );
    expect(component['passwordDraft']()).toBe('');
  });
  it('401 keeps the form and key', async () => {
    component.open();
    component['passwordDraft'].set('test-only-secret');
    transport.write.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await component['save']();
    expect(component['topError']()).toBe(en.notSaved);
    expect(component['passwordDraft']()).toBe('test-only-secret');
    expect(component['modal']().close).not.toHaveBeenCalled();
    await component['save']();
    expect(transport.write.mock.calls[1]).toEqual(transport.write.mock.calls[0]);
  });
  it('connection test 422 texts', async () => {
    component.open();
    for (const code of [
      'TENANT_SMTP_CONNECTION_FAILED',
      'TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE',
    ] as const) {
      transport.write.mockRejectedValueOnce(new ApiError(422, code));
      await component['runConnectionTest']();
      expect(component['probeError']()).toBe(en.errors[code]);
    }
  });
  it('test needs saved settings', async () => {
    component.open();
    component['hostDraft'].set('draft.example.test');
    await component['runConnectionTest']();
    expect(transport.write).not.toHaveBeenCalled();
    expect(component['testButtonTitle']()).toBe(en.smtp.testNeedsSave);
  });
  it('canceling an unsaved close keeps the draft; discarding clears it', async () => {
    component.open();
    component['passwordDraft'].set('test-only-secret');
    const confirm = vi.spyOn(component['discardConfirm'](), 'open').mockResolvedValueOnce(false);
    await component['requestClose']();
    expect(component['passwordDraft']()).toBe('test-only-secret');
    expect(component['modal']().close).not.toHaveBeenCalled();
    confirm.mockResolvedValueOnce(true);
    await component['requestClose']();
    expect(component['passwordDraft']()).toBe('');
    expect(component['saveOp']).toBeNull();
    expect(component.hasUnsavedDraft()).toBe(false);
  });
});
