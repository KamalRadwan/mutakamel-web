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
import { ConflictDialog } from './conflict-dialog';

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
describe('ConflictDialog', () => {
  let fixture: ComponentFixture<ConflictDialog>;
  let component: ConflictDialog;
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
    fixture = TestBed.createComponent(ConflictDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('canManage', true);
    await render();
    vi.spyOn(component['modal'](), 'open').mockImplementation(() => {});
    vi.spyOn(component['modal'](), 'close').mockImplementation(() => {});
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('stale revision opens the conflict dialog', async () => {
    component.open({ status: 409, patch: { fromName: 'Draft' } });
    await vi.waitFor(() => expect(component['busy']()).toBe(false));
    await render();
    expect(component['modal']().open).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(en.conflict.keep);
    expect(fixture.nativeElement.textContent).toContain(settings.common.reload);
    const adopted = vi.fn();
    component.adopted.subscribe(adopted);
    await component['loadLatest']();
    expect(adopted).toHaveBeenCalledWith({ config, etag: '"1"' });
    expect(component['patch']()).toBeNull();
  });
  it('keep my changes refetches the ETag and uses a new key', async () => {
    component.open({ status: 409, patch: { fromName: 'Draft' } });
    await vi.waitFor(() => expect(component['busy']()).toBe(false));
    await render();
    transport.readWithEtag.mockResolvedValueOnce({ data: { ...config, revision: 5 }, etag: '"5"' });
    await component['keepMyChanges']();
    expect(transport.write).toHaveBeenCalledWith(
      'PATCH',
      expect.any(String),
      { fromName: 'Draft' },
      expect.objectContaining({ ifMatch: '"5"', key: expect.any(String) }),
    );
    expect(component['patch']()).toBeNull();
  });
  it('discarding the conflict releases the password draft', () => {
    component.open({ status: 409, patch: { smtpPassword: 'test-only-secret' } });
    component.close();
    expect(component['patch']()).toBeNull();
    expect(component['saveOp']).toBeNull();
  });
  it('428 while keeping changes shows a generic toast', async () => {
    component.open({ status: 409, patch: { fromName: 'Draft' } });
    await vi.waitFor(() => expect(component['busy']()).toBe(false));
    transport.write.mockRejectedValueOnce(
      new ApiError(428, 'TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED'),
    );
    await component['keepMyChanges']();
    expect(notify.error).toHaveBeenCalledWith(settings.errors.generic);
    expect(component['patch']()).toEqual({ fromName: 'Draft' });
  });
});
