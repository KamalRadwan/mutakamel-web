import { Injectable, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../public/i18n/en.json';
import arGlobal from '../../../../../../public/i18n/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enEmail from '../../../../../../public/i18n/settings-outbound-emails/en.json';
import arEmail from '../../../../../../public/i18n/settings-outbound-emails/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { CrmHttp, bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { ComposeModal } from './compose-modal/compose-modal';
import { EmailDetailModal } from './email-detail-modal/email-detail-modal';
import { OutboundEmailsPage } from './outbound-emails-page';
import { emailOptions, emailPreview, getEmail, listEmails, listSourceRecords, retryEmail, sendEmail, senderStatus } from './outbound-emails.api';
import { EmailDetail, EmailOptionsResponse, SendEmailRequest, SenderStatusConfig, canRetryEmail,
  emailDateBound, feedbackReasonKey, mayOfferRetry, shortEmailRef } from './outbound-emails.model';
import { RetryModal } from './retry-modal/retry-modal';
import { SourceLookup, searchSourceRecords } from './source-lookup';

const BRANCH = '01934b10-0000-7000-8000-000000000901';
const OTHER = '01934b10-0000-7000-8000-000000000902';
const ID = '01934b10-0000-7000-8000-000000000903';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const body: SendEmailRequest = { sourceType: 'LEAD', sourceId: ID, recipient: { kind: 'SOURCE_PRIMARY_CONTACT' } };
const accepted = { outboundEmailId: ID, activityId: OTHER, status: 'QUEUED' as const };
const options: EmailOptionsResponse = {
  sourceType: 'LEAD', sourceId: ID, resolvedLocale: 'en',
  recipients: [{ reference: { kind: 'SOURCE_PRIMARY_CONTACT' }, displayName: 'Contact', maskedAddress: 'c***@example.com', isPrimary: true }],
  templates: [], assignedTemplateVersionId: null, availability: [],
};
const preview = { subject: 'Subject', preheader: null, bodyHtml: '<p>Hello</p>', bodyText: 'Hello' };
const sender: SenderStatusConfig = { status: 'ACTIVE', fromName: 'Sender', fromAddress: 's@example.com',
  providerDriver: 'ses', dkimVerified: true, providerCredentialsConfigured: true,
  feedbackProfile: 'CRM_FEEDBACK_V1', canSendCrm: true };
const detail: EmailDetail = {
  ...accepted, sourceType: 'LEAD', sourceId: ID, status: 'FAILED',
  template: { templateDefinitionId: ID, templateVersionId: OTHER, versionNumber: 1,
    documentType: 'CRM_OUTBOUND_EMAIL', outputChannel: 'EMAIL', layoutMode: 'EMAIL_FLOW', locale: 'en', direction: 'LTR',
    dataSourceKey: 'lead', dataSourceSchemaVersion: 1, dataSourceSchemaChecksum: 'schema', templateContentChecksum: 'template',
    compiledChecksum: 'compiled', compilerFingerprint: 'compiler', lifecycleStatus: 'PUBLISHED' },
  recipient: { displayName: 'Contact', maskedAddress: 'c***@example.com', kind: 'TO' },
  sender: { displayName: 'Sender', maskedAddress: 's***@example.com', maskedReplyTo: null }, senderConfigRevision: 1,
  content: { state: 'AVAILABLE', subject: 'Subject', preheader: null, html: '<p>Hello</p>', text: 'Hello', contentChecksum: 'checksum' },
  statusRevision: 1, provider: null, failure: { code: 'FAILED', automaticRetryExhausted: true, failedAt: '2026-11-20T00:00:00Z' },
  feedback: [], timeline: [{ state: 'QUEUED', occurredAt: '2026-11-20T00:00:00Z' }],
  requestedAt: '2026-11-20T00:00:00Z', sentAt: null, failedAt: '2026-11-20T00:00:00Z', retryOfId: null, retriedById: null,
  contentRetentionDays: 45, contentRetentionUntil: '2027-01-04T00:00:00Z', contentRetentionPolicyRevision: 2,
};
const translations: Record<string, Translation> = {
  en: { ...enGlobal, settings: enSettings, outboundEmails: enEmail },
  ar: { ...arGlobal, settings: arSettings, outboundEmails: arEmail },
  'settings/en': enSettings, 'settings/ar': arSettings,
  'settings-outbound-emails/en': enEmail, 'settings-outbound-emails/ar': arEmail,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`${lang} ${theme}`, () => {
    const me = signal<TenantMe | null>(null);
    const selection = signal<{ companyId: string; branchId: string | null }>({ companyId: ID, branchId: BRANCH });
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    let stub: CrmHttpStub;
    let dispose: () => void;
    let fixtures: Record<string, unknown>;
    const coreRead = vi.fn<CoreHttp['read']>();
    const dialog = HTMLDialogElement.prototype;
    const originalDialog = { showModal: dialog.showModal, close: dialog.close };
    let previousTheme: string | null;
    let previousDir: string;

    function grants(keys = ['crm.activities.read.team', 'crm.email.send.own', 'crm.leads.read.team']) {
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: keys,
        permissionScopes: Object.fromEntries(keys.map((key) => [key, { tenantWide: false, companyIds: [], branchIds: [BRANCH] }])),
        accessibleBranchCompanies: [], accessScope: { ...FAKE_TENANT_ME.accessScope, branchesTruncated: false } });
    }

    beforeEach(async () => {
      grants();
      selection.set({ companyId: ID, branchId: BRANCH });
      previousTheme = document.documentElement.getAttribute('data-theme');
      previousDir = document.documentElement.dir;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      dialog.showModal = function () { this.setAttribute('open', ''); };
      dialog.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      fixtures = { '/outbound-emails': { items: [], nextCursor: null, hasNext: false, limit: 25 },
        [`/outbound-emails/${ID}`]: detail };
      stub = new CrmHttpStub(fixtures);
      dispose = bindCrmHttpForTest(stub);
      vi.spyOn(stub, 'write').mockImplementation(async <T>(_method: unknown, path: string) => ({
        status: 202, data: (path.endsWith('/search') ? { items: [{ id: ID, displayName: 'Record', title: 'Opportunity' }] }
          : path.endsWith('/options') ? options : path.endsWith('/preview') ? preview : accepted) as T,
        etag: null, location: null,
      }));
      coreRead.mockResolvedValue(sender);
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true,
          prodMode: true, missingHandler: { logMissingKey: true } }, loader: Loader }),
        { provide: TenantScopeState, useValue: { me, selection } },
        { provide: CoreHttp, useValue: { read: coreRead } },
        { provide: LanguageState, useValue: { current: signal(lang) } },
        { provide: Notify, useValue: notify },
        { provide: WorkspaceLookups, useValue: { allBranches: vi.fn().mockResolvedValue([
          { id: BRANCH, name: 'Branch A' }, { id: OTHER, name: 'Branch B' }]) } },
      ] });
      TestBed.inject(TranslocoService).setActiveLang(lang);
      await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
    });

    afterEach(() => {
      TestBed.resetTestingModule();
      dispose();
      vi.restoreAllMocks();
      vi.clearAllMocks();
      dialog.showModal = originalDialog.showModal;
      dialog.close = originalDialog.close;
      if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', previousTheme);
      document.documentElement.dir = previousDir;
    });

    async function settle<T>(fixture: ComponentFixture<T>) {
      for (let pass = 0; pass < 3; pass++) {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      fixture.detectChanges();
    }
    async function render<T>(component: Type<T>) {
      const fixture = TestBed.createComponent(component);
      await settle(fixture);
      return fixture;
    }
    async function compose() {
      const fixture = await render(ComposeModal);
      fixture.componentInstance.open();
      await settle(fixture);
      fixture.componentInstance['selectedRecordId'].set(ID);
      await fixture.componentInstance['nextFromRecord']();
      await fixture.componentInstance['nextFromOptions']();
      await settle(fixture);
      return fixture;
    }

    describe('OutboundEmailsPage', () => {
      it('branch grant opens the log', async () => {
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.componentInstance['canRead']).toBe(true);
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeTruthy();
      });
      it('branch send grant shows send', async () => {
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.componentInstance['canManage']()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain((lang === 'en' ? enEmail : arEmail).newEmail);
      });
      it('no send without the key', async () => {
        grants(['crm.activities.read.team', 'crm.leads.read.team']);
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.componentInstance['canManage']()).toBe(false);
        expect(fixture.componentInstance['rowActions']({ status: 'FAILED' } as never).some((item) => item.id === 'retry')).toBe(false);
        expect(fixture.nativeElement.querySelector('app-settings-frame > div').textContent).not.toContain((lang === 'en' ? enEmail : arEmail).newEmail);
      });
      it('invalid cursor restarts', async () => {
        const read = vi.spyOn(stub, 'read').mockImplementation(async <T>(_path: string, query?: Record<string, unknown>) => {
          if (query?.['cursor']) throw new ApiError(400, 'CRM.EMAIL.INVALID_CURSOR');
          return { items: [], hasNext: true, nextCursor: 'cursor', limit: 25 } as T;
        });
        const fixture = await render(OutboundEmailsPage);
        await fixture.componentInstance['loadList'](false);
        expect(read.mock.calls.at(-1)?.[1]?.['cursor']).toBeNull();
        expect(fixture.componentInstance['failed']()).toBe(false);
      });
      it('no zone uses UTC and says so', async () => {
        const fixture = await render(OutboundEmailsPage);
        fixture.componentInstance['fromDate'].set('2026-11-20');
        fixture.componentInstance['toDate'].set('2026-11-20');
        expect(fixture.componentInstance['buildFilter']()).toEqual({ requestedFrom: '2026-11-20T00:00:00.000Z', requestedTo: '2026-11-21T00:00:00.000Z' });
        expect(fixture.componentInstance['dateHint']('fromDateHint')).toContain((lang === 'en' ? enEmail : arEmail).filters.utcHint);
        expect(fixture.componentInstance['rangeError']()).toBeNull();
      });
      it('retention note hidden without settings read', async () => {
        const read = vi.spyOn(stub, 'read');
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.componentInstance['retentionDays']()).toBeNull();
        expect(read.mock.calls.some(([path]) => path === '/settings')).toBe(false);
        expect(fixture.nativeElement.textContent).not.toContain((lang === 'en' ? enEmail : arEmail).changeRetention);
      });
      it('load failures show a full state and correlation id', async () => {
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'request-1' }));
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.nativeElement.querySelector('ui-full-state')).toBeTruthy();
        expect(fixture.nativeElement.textContent).toContain('request-1');
      });
      it('permission failures show forbidden', async () => {
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(403, 'BRANCH_PERMISSION_DENIED'));
        const fixture = await render(OutboundEmailsPage);
        expect(fixture.componentInstance['featureDisabled']()).toBe(true);
      });
    });

    describe('SenderStatus', () => {
      it('hidden without the core key', async () => {
        const fixture = await render(OutboundEmailsPage);
        expect(coreRead).not.toHaveBeenCalled();
        expect(fixture.nativeElement.querySelector('app-sender-status section')).toBeNull();
        grants(['crm.activities.read.team', 'workspace.email.read']);
        coreRead.mockRejectedValue(new ApiError(403, 'CRM_FEATURE_DISABLED'));
        const second = await render(OutboundEmailsPage);
        expect(second.componentInstance['failed']()).toBe(false);
        expect(second.nativeElement.querySelector('app-sender-status section')).toBeNull();
      });
      it('needs the CRM feedback profile', async () => {
        coreRead.mockResolvedValue({ ...sender, feedbackProfile: 'OTHER' });
        const result = await TestBed.runInInjectionContext(() => senderStatus());
        expect(result.canSendCrm).toBe(false);
        expect(coreRead).toHaveBeenCalledWith('/api/tenant/core/v1/email-config');
      });
    });

    describe('ComposeModal', () => {
      it('send errors in the modal', async () => {
        const fixture = await compose();
        for (const code of ['SOURCE_INELIGIBLE', 'RECIPIENT_INVALID', 'RECIPIENT_SUPPRESSED', 'SENDER_UNVERIFIED',
          'TEMPLATE_NOT_SENDABLE', 'TEMPLATE_RENDER_FAILED', 'CONTENT_LIMIT_EXCEEDED']) {
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(422, `CRM.EMAIL.${code}`));
          await fixture.componentInstance['send']();
          expect(fixture.componentInstance['modalError']()).toBe(TestBed.inject(TranslocoService).translate(`outboundEmails.errors.CRM.EMAIL.${code}`));
          expect(fixture.nativeElement.querySelector('dialog[open]')).toBeTruthy();
        }
      });
      it('rate limit minutes', async () => {
        const fixture = await compose();
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(429, 'CRM.EMAIL.SEND_RATE_LIMITED', { retryAfterSeconds: ['121'] }));
        await fixture.componentInstance['send']();
        expect(fixture.componentInstance['modalError']()).toContain('3');
      });
      it('mismatch never resends', async () => {
        const fixture = await compose();
        const modal = fixture.componentInstance;
        const key = modal['sendKey'];
        const refresh = vi.spyOn(modal.refreshLog, 'emit');
        const before = vi.mocked(stub.write).mock.calls.length;
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(422, 'CRM.EMAIL.IDEMPOTENCY_MISMATCH'));
        await modal['send']();
        await settle(fixture);
        expect(vi.mocked(stub.write).mock.calls.length).toBe(before + 1);
        expect(refresh).toHaveBeenCalledOnce();
        expect(notify.warning).toHaveBeenCalledWith((lang === 'en' ? enEmail : arEmail).errors.CRM.EMAIL.IDEMPOTENCY_MISMATCH);
        expect(modal['sendKey']).toBe('');
        expect(modal['selectedRecordId']()).toBe(ID);
        expect(modal['preview']()).toEqual(preview);
        expect(fixture.nativeElement.querySelector('dialog[open]')).toBeTruthy();
        await modal['send']();
        expect(vi.mocked(stub.write).mock.calls.at(-1)?.[3]?.key).not.toBe(key);
      });
      it('record types follow read keys', async () => {
        const fixture = await render(ComposeModal);
        expect(fixture.componentInstance['sourceTypeOptions']().map((item) => item.value)).toEqual(['LEAD']);
      });
      it('uses the assigned template unless an explicit version is picked', async () => {
        const fixture = await render(ComposeModal);
        const modal = fixture.componentInstance;
        modal.open();
        await settle(fixture);
        modal['selectedRecordId'].set(ID);
        vi.mocked(stub.write).mockResolvedValueOnce({ status: 200, etag: null, location: null,
          data: { ...options, assignedTemplateVersionId: OTHER,
            templates: [{ templateId: ID, templateVersionId: OTHER, code: 'welcome', name: 'Welcome', versionNumber: 2,
              locale: lang, direction: lang === 'ar' ? 'RTL' : 'LTR', selection: 'EFFECTIVE_ASSIGNMENT' }] } });
        await modal['nextFromRecord']();
        expect(modal['selectedTemplateId']()).toBe('');
        await modal['nextFromOptions']();
        expect(vi.mocked(stub.write).mock.calls.at(-1)?.[2]).not.toHaveProperty('templateVersionId');
        modal['selectedTemplateId'].set(OTHER);
        await modal['nextFromOptions']();
        expect(vi.mocked(stub.write).mock.calls.at(-1)?.[2]).toHaveProperty('templateVersionId', OTHER);
      });
      it('no branch disables record search', async () => {
        selection.set({ companyId: ID, branchId: null });
        const fixture = await render(ComposeModal);
        fixture.componentInstance.open();
        await settle(fixture);
        const trigger = fixture.nativeElement.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
        expect(trigger.disabled).toBe(true);
        expect(fixture.nativeElement.textContent).toContain((lang === 'en' ? enEmail : arEmail).source.noBranchHint);
        expect(stub.write).not.toHaveBeenCalled();
      });
      it('branch change clears the record', async () => {
        const fixture = await compose();
        fixture.componentInstance['onBranchChange'](OTHER);
        await settle(fixture);
        expect(fixture.componentInstance['selectedRecordId']()).toBe('');
        expect(fixture.componentInstance['options']()).toBeNull();
      });
      it('read-only write failure keeps values and removes Send', async () => {
        const fixture = await compose();
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await fixture.componentInstance['send']();
        await settle(fixture);
        expect(fixture.componentInstance['readOnly']()).toBe(true);
        expect(fixture.componentInstance['selectedRecordId']()).toBe(ID);
      });
    });

    describe('OutboundEmailsApi', () => {
      it('load more resends the filters', async () => {
        const read = vi.spyOn(stub, 'read');
        const filter = { status: 'FAILED' as const, sourceType: 'LEAD' as const, sourceId: ID,
          requestedFrom: '2026-11-20T00:00:00Z', requestedTo: '2026-11-21T00:00:00Z' };
        await listEmails(filter, 'next');
        expect(read).toHaveBeenCalledWith('/outbound-emails', { ...filter, cursor: 'next', limit: 25 });
      });
      it('same day range is exclusive', () => {
        expect(emailDateBound('2026-11-20', 'Africa/Cairo')).toBe('2026-11-19T22:00:00.000Z');
        expect(emailDateBound('2026-11-20', 'Africa/Cairo', true)).toBe('2026-11-20T22:00:00.000Z');
        expect(emailDateBound('2026-04-24', 'Africa/Cairo')).toBe('2026-04-23T22:00:00.000Z');
      });
      it('send retry reuses the key', async () => {
        const fixture = await compose();
        const modal = fixture.componentInstance;
        for (const status of [0, 503, 401]) {
          const key = modal['sendKey'];
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(status, 'NETWORK_ERROR'));
          await modal['send']();
          expect(modal['sendKey']).toBe(key);
          const first = vi.mocked(stub.write).mock.calls.at(-1)!;
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(status, 'NETWORK_ERROR'));
          await modal['send']();
          const second = vi.mocked(stub.write).mock.calls.at(-1)!;
          expect(second[3].key).toBe(first[3].key);
          expect(second[2]).toEqual(first[2]);
          expect(second[3].key).toMatch(uuid);
        }
      });
      it('changed body gets a new key', async () => {
        const fixture = await compose();
        const modal = fixture.componentInstance;
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
        await modal['send']();
        const key = modal['sendKey'];
        modal['selectedTemplateId'].set(OTHER);
        await modal['send']();
        expect(vi.mocked(stub.write).mock.calls.at(-1)?.[3].key).not.toBe(key);
      });
      it('options and preview retries keep their key until the body changes', async () => {
        for (const operation of [emailOptions, emailPreview]) {
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
          await expect(operation(body)).rejects.toHaveProperty('status', 0);
          const first = vi.mocked(stub.write).mock.calls.at(-1)!;
          await operation(body);
          expect(vi.mocked(stub.write).mock.calls.at(-1)?.[3].key).toBe(first[3].key);
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
          await expect(operation(body)).rejects.toHaveProperty('status', 503);
          const previous = vi.mocked(stub.write).mock.calls.at(-1)!;
          await operation({ ...body, locale: 'ar' });
          expect(vi.mocked(stub.write).mock.calls.at(-1)?.[3].key).not.toBe(previous[3].key);
        }
      });
      it('sends no scope headers', async () => {
        await emailOptions({ sourceType: 'LEAD', sourceId: ID });
        await emailPreview(body);
        await sendEmail(body, newIdempotencyKey());
        await retryEmail(ID, 'Fixed', newIdempotencyKey());
        await getEmail(ID);
        await searchSourceRecords('LEAD', BRANCH, 'Record', 1);
        for (const call of vi.mocked(stub.write).mock.calls) {
          expect(call[3].scope).toBeUndefined();
          expect(call[3].key).toMatch(uuid);
        }
        expect(vi.mocked(stub.write).mock.calls.find((call) => call[1] === '/outbound-emails')?.[2]).not.toHaveProperty('templateVersionId');
      });
    });

    describe('SourceLookup', () => {
      it('searches within the session branch', async () => {
        expect(await TestBed.runInInjectionContext(() => listSourceRecords('LEAD'))).toEqual([{ id: ID, type: 'LEAD', name: 'Record' }]);
        expect(stub.write).toHaveBeenCalledWith('POST', '/leads/search',
          { branchId: BRANCH, search: '', searchField: 'lead', page: 1, limit: 25 }, { key: expect.stringMatching(uuid) });
        expect(await searchSourceRecords('CUSTOMER_PROFILE', BRANCH, 'Contact', 2)).toEqual([{ id: ID, type: 'CUSTOMER_PROFILE', name: 'Record' }]);
        expect(await searchSourceRecords('OPPORTUNITY', BRANCH, 'Office', 1)).toEqual([{ id: ID, type: 'OPPORTUNITY', name: 'Opportunity' }]);
      });
      it('branch choices follow grants unless truncated', async () => {
        grants(['crm.leads.read.team', 'org.branch.read']);
        const lookup = TestBed.runInInjectionContext(() => new SourceLookup());
        await lookup.loadBranches();
        expect(lookup.branchesFor('LEAD').map((branch) => branch.id)).toEqual([BRANCH]);
        me.update((current) => ({ ...current!, accessScope: { ...current!.accessScope, branchesTruncated: true } }));
        expect(lookup.branchesFor('LEAD').map((branch) => branch.id)).toEqual([BRANCH, OTHER]);
      });
    });

    describe('EmailDetailModal', () => {
      it('redacted content hides retry', async () => {
        fixtures[`/outbound-emails/${ID}`] = { ...detail, content: { state: 'REDACTED_BY_RETENTION', redactedAt: '2026-11-22T00:00:00Z' } };
        const fixture = await render(EmailDetailModal);
        fixture.componentRef.setInput('canManage', true);
        await fixture.componentInstance.open(ID);
        await settle(fixture);
        expect(fixture.componentInstance['canRetry']()).toBe(false);
        expect(fixture.nativeElement.textContent).toContain((lang === 'en' ? enEmail : arEmail).detail.redactedNotice.split('{{')[0]);
        expect(fixture.componentInstance['detail']()?.contentRetentionDays).toBe(45);
      });
      it('not found closes the modal with a toast', async () => {
        vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(404, 'CRM.EMAIL.SOURCE_NOT_FOUND'));
        const fixture = await render(EmailDetailModal);
        await fixture.componentInstance.open(ID);
        expect(fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
        expect(notify.error).toHaveBeenCalled();
      });
    });

    describe('RetryModal', () => {
      it('retry outcomes', async () => {
        const fixture = await render(RetryModal);
        const modal = fixture.componentInstance;
        const refreshed = vi.spyOn(modal.retried, 'emit');
        modal.open(detail);
        modal['reason'].set('Mailbox fixed');
        await modal['submit']();
        expect(refreshed).toHaveBeenCalledWith(ID);
        for (const code of ['RETRY_NOT_ALLOWED', 'RETRY_ALREADY_CREATED']) {
          modal.open(detail);
          modal['reason'].set('Fixed');
          vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(409, `CRM.EMAIL.${code}`));
          await modal['submit']();
          expect(notify.error).toHaveBeenCalledWith(TestBed.inject(TranslocoService).translate(`outboundEmails.errors.CRM.EMAIL.${code}`));
          expect(refreshed).toHaveBeenCalledWith('');
        }
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { reason: ['Reason rejected'] }));
        await modal['submit']();
        expect(modal['reasonError']()).toBe('Reason rejected');
      });
      it('network retries keep key and body, and a changed reason gets a new key', async () => {
        const fixture = await render(RetryModal);
        const modal = fixture.componentInstance;
        modal.open(detail);
        modal['onReasonInput']({ target: { value: 'Fixed mailbox' } } as unknown as Event);
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
        await modal['submit']();
        const first = vi.mocked(stub.write).mock.calls.at(-1)!;
        vi.mocked(stub.write).mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
        await modal['submit']();
        const second = vi.mocked(stub.write).mock.calls.at(-1)!;
        expect(second[3].key).toBe(first[3].key);
        expect(second[2]).toEqual(first[2]);
        modal['onReasonInput']({ target: { value: 'Fixed domain' } } as unknown as Event);
        await modal['submit']();
        expect(vi.mocked(stub.write).mock.calls.at(-1)?.[3].key).not.toBe(first[3].key);
      });
    });
  });
}

describe('OutboundEmailsApi HTTP headers', () => {
  it('sends UUID v7 keys, CSRF and no organization headers through the real transport', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    document.cookie = 'mutakamel-http-tenant-csrf=test-csrf; path=/';
    const dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
    const http = TestBed.inject(HttpTestingController);
    try {
      const key = newIdempotencyKey();
      const pending = sendEmail(body, key);
      const request = http.expectOne('/api/tenant/crm/v1/outbound-emails');
      expect(request.request.headers.get('x-idempotency-key')).toMatch(uuid);
      expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
      expect(request.request.headers.has('x-mutakamel-company-id')).toBe(false);
      expect(request.request.headers.has('x-mutakamel-branch-id')).toBe(false);
      request.flush(accepted, { status: 202, statusText: 'Accepted' });
      await expect(pending).resolves.toEqual(accepted);
      http.verify();
    } finally {
      dispose();
      document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
      TestBed.resetTestingModule();
    }
  });
});

describe('Outbound email model helpers', () => {
  it('keeps the existing retry, feedback and short reference rules', () => {
    expect(shortEmailRef(ID)).toBe('0193…0903');
    expect(shortEmailRef('short')).toBe('short');
    expect(shortEmailRef(null)).toBe('—');
    expect(feedbackReasonKey('HARD_BOUNCE')).toBe('HARD_BOUNCE');
    expect(feedbackReasonKey('unknown')).toBe('UNSPECIFIED');
    expect(mayOfferRetry({ status: 'FAILED' })).toBe(true);
    expect(mayOfferRetry({ status: 'SENT' })).toBe(false);
    expect(canRetryEmail(detail)).toBe(true);
    expect(canRetryEmail({ ...detail, retriedById: OTHER })).toBe(false);
  });
});
