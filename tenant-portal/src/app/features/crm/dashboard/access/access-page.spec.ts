import { Injectable, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, provideTransloco, type TranslocoLoader, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../public/i18n/en.json';
import ar from '../../../../../../public/i18n/ar.json';
import enAccess from '../../../../../../public/i18n/crm-access/en.json';
import arAccess from '../../../../../../public/i18n/crm-access/ar.json';
import enAnalytics from '../../../../../../public/i18n/analytics/en.json';
import arAnalytics from '../../../../../../public/i18n/analytics/ar.json';
import enRecord from '../../../../../../public/i18n/record-page/en.json';
import arRecord from '../../../../../../public/i18n/record-page/ar.json';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { accessMessage } from './access-errors';
import { AccessPage } from './access-page/access-page';
import type { AccessRequest, OwnerReview } from './access.model';
import { DecideModal } from './decide-modal/decide-modal';
import { RequestModal } from './request-modal/request-modal';
import { ReviewModal } from './review-modal/review-modal';

const request: AccessRequest = {
  id: 'request-id', requestNumber: 'REQ-0001', requesterUserId: 'requester', resourceType: 'DASHBOARD',
  resourceId: 'dashboard-id', resourceName: 'Sales', requestedLevel: 'EDIT', heldLevelAtRequest: 'NONE',
  purpose: 'Review results', requestedExpiresAt: null, status: 'PENDING', pendingUntil: '2099-12-01T00:00:00Z',
  decidedByUserId: null, decidedAt: null, decisionNote: null, grantedLevel: null, grantedExpiresAt: null,
  shareId: null, revision: 4, createdAt: '2026-11-01T00:00:00Z',
};
const review: OwnerReview = {
  id: 'review-id', resourceType: 'WIDGET', resourceId: 'widget-id', resourceName: 'Sales', ownerUserId: 'old-owner',
  triggerReason: 'OWNER_INACTIVE', status: 'OPEN', ownerStatusChangedAt: '2026-11-01T00:00:00Z',
  openedAt: '2026-11-01T00:00:00Z', reviewUntil: '2099-12-01T00:00:00Z',
  proposedOwnerUserId: 'new-owner', proposalReason: 'Handover', revision: 4,
};
const page = (items: unknown[]) => ({ items, pageInfo: { limit: 25, hasMore: false, nextCursor: null } });
const result = (data: unknown) => ({ status: 200, data, etag: null, location: null });
const permissions = ['crm.dashboards.read.own', 'crm.dashboards.share', 'crm.widgets.transfer_ownership'];
const messages: Record<string, Translation> = {
  en: { ...en, access: enAccess, analytics: enAnalytics, recordPage: enRecord },
  ar: { ...ar, access: arAccess, analytics: arAnalytics, recordPage: arRecord },
  'crm-access/en': enAccess, 'crm-access/ar': arAccess,
  'analytics/en': enAnalytics, 'analytics/ar': arAnalytics,
  'record-page/en': enRecord, 'record-page/ar': arRecord,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(messages[path] ?? {})); }
}

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`AccessPage ${lang} ${theme}`, () => {
    let stub: CrmHttpStub;
    let dispose: () => void;
    let fixtures: Record<string, unknown>;
    let previous: (string | null)[];
    let warning: ReturnType<typeof vi.spyOn>;
    const dialog = HTMLDialogElement.prototype;
    const original = { showModal: dialog.showModal, close: dialog.close };
    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      dialog.showModal = function () { this.open = true; };
      dialog.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
      previous = ['lang', 'dir', 'data-theme'].map(key => document.documentElement.getAttribute(key));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('data-theme', theme);
      bindAnalyticsPermissions(() => permissions);
      crmQueries().clear();
      fixtures = {
        '/dashboards/access-requests': page([request]), '/dashboards/access-requests/request-id': { ...request, revision: 5 },
        '/dashboards/owner-reviews': page([review]), '/dashboards/owner-reviews/review-id': { ...review, revision: 5 },
        '/widgets/widget-id/ownership-transfer/targets': { items: [{ id: 'new-owner', name: 'Owner' }], nextCursor: null },
      };
      stub = new CrmHttpStub(fixtures);
      dispose = bindCrmHttpForTest(stub);
      warning = vi.spyOn(console, 'warn');
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false }, loader: Loader }),
        { provide: LanguageState, useValue: { current: signal(lang) } },
        { provide: OrgApi, useValue: { now: () => '2026-11-23T00:00:00Z' } },
      ] });
    });
    afterEach(() => {
      const warnings = warning.mock.calls.flat().join(' ');
      expect(warnings).not.toMatch(/Missing hint|Missing translation/i);
      TestBed.resetTestingModule();
      dispose(); crmQueries().clear(); bindAnalyticsPermissions(() => []); vi.restoreAllMocks();
      if (original.showModal) dialog.showModal = original.showModal; else Reflect.deleteProperty(dialog, 'showModal');
      if (original.close) dialog.close = original.close; else Reflect.deleteProperty(dialog, 'close');
      ['lang', 'dir', 'data-theme'].forEach((key, i) => previous[i] === null ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, previous[i]!));
    });
    async function render<T>(type: Type<T>): Promise<ComponentFixture<T>> {
      await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
      const fixture = TestBed.createComponent(type);
      fixture.detectChanges(); await settle(fixture); return fixture;
    }
    async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
      await fixture.whenStable(); fixture.detectChanges();
    }
    const t = () => TestBed.inject(TranslocoService);

    it('request from forbidden state', async () => {
      const fixture = await render(RequestModal); const modal = fixture.componentInstance;
      modal.open('WIDGET', 'widget-id'); modal['purpose'].set('Review');
      const write = vi.spyOn(stub, 'write').mockResolvedValue(result(request));
      await modal['submit']();
      expect(write.mock.calls[0][2]).toEqual({ resourceType: 'WIDGET', resourceId: 'widget-id', requestedLevel: 'VIEW', purpose: 'Review', requestedExpiresAt: null });
      expect(write.mock.calls[0][3].key).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/);
      expect(write.mock.calls[0][3].scope).toBeUndefined();
    });

    it('decision', async () => {
      const fixture = await render(DecideModal);
      const modal = fixture.componentInstance;
      modal.open(request); await settle(fixture);
      modal['note'].set('Keep this note');
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_ACCESS_REQUEST_REVISION_STALE')).mockResolvedValue(result({ ...request, status: 'APPROVED', revision: 6 }));
      await modal['submit'](); await settle(fixture);
      expect(modal['conflictOpen']()).toBe(true);
      expect(fixture.nativeElement.querySelector('ui-conflict-dialog')).not.toBeNull();
      await modal['resolveConflict'](false);
      expect(modal['note']()).toBe('Keep this note');
      expect(modal['request']()?.revision).toBe(5);
      await modal['submit']();
      expect(write.mock.calls[1][2]).toMatchObject({ revision: 5, decision: 'APPROVED', note: 'Keep this note' });
      expect(write.mock.calls[1][3].ifMatch).toBe('"access-request:request-id:5"');
      modal.open(request); modal['decision'].set('REJECTED'); modal['note'].set('Not needed');
      await modal['submit']();
      expect(write.mock.calls[2][2]).toMatchObject({ decision: 'REJECTED', note: 'Not needed' });
    });

    it('request errors', async () => {
      const fixture = await render(RequestModal); const modal = fixture.componentInstance;
      modal.open('DASHBOARD', 'dashboard-id'); modal['purpose'].set('Review'); await settle(fixture);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_ACCESS_REQUEST_PENDING_EXISTS'));
      await modal['submit'](); await settle(fixture);
      expect(modal['levelError']()).toBe(t().translate('analytics.error.CRM_ACCESS_REQUEST_PENDING_EXISTS'));
      expect(modal['purpose']()).toBe('Review');
      write.mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { purpose: ['too_long'] }));
      await modal['submit'](); expect(modal['purposeError']()).toBeTruthy();
      const decisionFixture = await render(DecideModal); const decision = decisionFixture.componentInstance;
      decision.open(request); decision['decision'].set('REJECTED'); decision['note'].set('Reason');
      write.mockRejectedValueOnce(new ApiError(422, 'CRM_ACCESS_REQUEST_NOTE_REQUIRED'));
      await decision['submit']();
      expect(decision['noteError']()).toBe(t().translate('analytics.error.CRM_ACCESS_REQUEST_NOTE_REQUIRED'));
    });

    it('owner review transfer', async () => {
      const fixture = await render(ReviewModal); const modal = fixture.componentInstance;
      modal.open(review); await settle(fixture);
      expect(modal['owners']().map(row => row.id)).toEqual(['new-owner']);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE')).mockResolvedValue(result({ review: { ...review, status: 'TRANSFERRED' }, transfer: {} }));
      await modal['submitPrimary'](); await modal['submitPrimary']();
      expect(write.mock.calls[0][1]).toBe('/dashboards/owner-reviews/review-id/transfer');
      expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
      expect(write.mock.calls[0][3].key).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/);
      expect(write.mock.calls[0][3].scope).toBeUndefined();
      expect(write.mock.calls[0][3].ifMatch).toBe('"owner-review:review-id:4"');
      expect(TestBed.inject(Notify).toasts().some(row => row.title === t().translate('access.toast.transferred'))).toBe(true);
    });

    it('no picker, no counts', async () => {
      const read = vi.spyOn(stub, 'read');
      const fixture = await render(AccessPage);
      expect(fixture.componentInstance['tabs']().every(tab => tab.count === undefined)).toBe(true);
      expect(fixture.nativeElement.querySelector('app-request-modal')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain(t().translate('access.request.send'));
      expect(read.mock.calls.every(([path]) => path === '/dashboards/access-requests')).toBe(true);
      const form = await render(RequestModal);
      form.componentInstance.open('WIDGET', 'widget-id'); await settle(form);
      expect(form.nativeElement.querySelector('[role="listbox"]')).toBeNull();
      const resource = form.nativeElement.querySelector('input[readonly]') as HTMLInputElement;
      expect(resource.value).toBe('widget-id');
      expect(resource.getAttribute('aria-describedby')).toContain('-resource-hint');
    });

    it('keeps form and key after session or network failure, and blocks mismatched retries', async () => {
      const fixture = await render(RequestModal); const modal = fixture.componentInstance;
      modal.open('DASHBOARD', 'dashboard-id'); modal['purpose'].set('Review');
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED')).mockRejectedValueOnce(new ApiError(0, 'NETWORK')).mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
      await modal['submit']();
      expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(t().translate('access.errors.notSaved'));
      await modal['submit'](); await modal['submit'](); await modal['submit']();
      expect(write).toHaveBeenCalledTimes(3);
      expect(new Set(write.mock.calls.map(call => call[3].key)).size).toBe(1);
      expect(modal['readOnly']()).toBe(true);
      expect(modal['purpose']()).toBe('Review');
    });

    it.each(['CRM_DASHBOARDS_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('makes fields read-only for %s', async code => {
      const fixture = await render(RequestModal); const modal = fixture.componentInstance;
      modal.open('DASHBOARD', 'dashboard-id'); modal['purpose'].set('Review');
      vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(403, code));
      await modal['submit'](); await settle(fixture);
      expect(modal['readOnly']()).toBe(true);
      expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).readOnly).toBe(true);
    });

    it('links every modal label hint to its control', async () => {
      for (const type of [RequestModal, DecideModal, ReviewModal]) {
        const fixture = await render(type as Type<RequestModal | DecideModal | ReviewModal>);
        const component = fixture.componentInstance;
        if (component instanceof RequestModal) component.open('WIDGET', 'widget-id');
        else if (component instanceof DecideModal) component.open(request);
        else component.open(review);
        await settle(fixture);
        const fields = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          const control = field.querySelector('input, textarea, [role="radio"], button[aria-haspopup], ui-date-field button');
          expect(control, field.textContent ?? '').not.toBeNull();
          expect(control?.getAttribute('aria-describedby')).toContain('-hint');
        }
        fixture.destroy();
      }
    });

    it('shows correlated load failures with Retry and forbidden loads', async () => {
      vi.spyOn(stub, 'read').mockRejectedValue(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE', undefined, { correlationId: 'trace-1' }));
      const fixture = await render(AccessPage); const component = fixture.componentInstance;
      await expect.poll(() => component['loadError']()).toBe('load-failure');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('trace-1');
      vi.mocked(stub.read).mockRejectedValue(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
      await component['loadActiveTab'](); await settle(fixture);
      expect(component['loadError']()).toBe('forbidden');
      expect(accessMessage(t(), new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }))).toBe(t().translate('access.errors.rateLimited', { seconds: ['12'] }));
    });
  });
}
