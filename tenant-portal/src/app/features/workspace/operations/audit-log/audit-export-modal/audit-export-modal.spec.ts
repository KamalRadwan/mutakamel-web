import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import enGlobal from '../../../../../../../public/i18n/en.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import enAudit from '../../../../../../../public/i18n/ws-audit-log/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { AuditExportContext } from '../audit-log.model';
import { AuditExportModal } from './audit-export-modal';

const EXPORT_PATH = '/api/tenant/core/v1/audit/exports';
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const translations: Record<string, Translation> = {
  en: enGlobal,
  'ws-audit-log/en': enAudit,
  'settings/en': enSettings,
};

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return defer(() => Promise.resolve(translations[path] ?? {}));
  }
}

const dialogProto = HTMLDialogElement.prototype;
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close };

function csrfCookieName(): string {
  return document.location?.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
}

function setCsrfCookie(value = 'csrf-modal-token'): void {
  document.cookie = `${csrfCookieName()}=${value}; path=/`;
}

function clearCsrfCookie(): void {
  document.cookie = `${csrfCookieName()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function makeContext(overrides: Partial<AuditExportContext> = {}): AuditExportContext {
  return {
    query: {
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-08T00:00:00.000Z',
      sourceApp: 'CRM',
      outcome: 'SUCCESS',
    },
    dateRangeLabel: '1 Nov 2026 · 00:00 — 8 Nov 2026 · 00:00',
    filters: [
      { label: 'App', value: 'CRM' },
      { label: 'Outcome', value: 'Succeeded' },
    ],
    ...overrides,
  };
}

describe('AuditExportModal', () => {
  let fixture: ComponentFixture<AuditExportModal>;
  let modal: AuditExportModal;
  let http: HttpTestingController;
  let notify: Notify;

  beforeEach(async () => {
    dialogProto.showModal = function () {
      this.setAttribute('open', '');
    };
    dialogProto.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    setCsrfCookie();

    TestBed.configureTestingModule({
      imports: [AuditExportModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantScopeState, useValue: { me: signal(null), selection: signal(null) } },
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: true },
          loader: TestLoader,
        }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(Notify);
    fixture = TestBed.createComponent(AuditExportModal);
    modal = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    clearCsrfCookie();
    fixture.destroy();
    http.verify();
    dialogProto.showModal = originalDialog.showModal;
    dialogProto.close = originalDialog.close;
  });

  function submitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('div[modal-footer] button') as HTMLButtonElement;
  }

  it('shows the filters and the limits', () => {
    modal.open(makeContext());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(text).toContain('App');
    expect(text).toContain('CRM');
    expect(text).toContain('Outcome');
    expect(text).toContain('Succeeded');
    expect(text).toContain('Up to 92 days and 500 000 rows');
  });

  it('202 shows export started', async () => {
    modal.open(makeContext());
    fixture.detectChanges();
    submitButton().click();

    const request = http.expectOne((r) => r.method === 'POST' && r.url === EXPORT_PATH);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(UUID_V7_REGEX);
    request.flush(
      { success: true, data: { exportId: '019a7c20-0009-7000-8000-000000000009', status: 'QUEUED' } },
      { status: 202, statusText: 'Accepted' },
    );

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
    expect(notify.toasts()[0]?.type).toBe('success');
    expect(notify.toasts()[0]?.title).toBe('Export started. You will be notified when it is ready.');
  });

  it('range invalid is a date field message', async () => {
    const invalidEvents: string[] = [];
    const sub = modal.rangeInvalid.subscribe((msg) => invalidEvents.push(msg));
    try {
      modal.open(makeContext());
      fixture.detectChanges();
      submitButton().click();

      const request = http.expectOne(EXPORT_PATH);
      request.flush({ errorCode: 'AUDIT_EXPORT_RANGE_INVALID' }, { status: 400, statusText: 'Bad Request' });

      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
      expect(notify.toasts()).toEqual([]);
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Date range must be between 1 and 92 days.',
      );
      expect(invalidEvents).toEqual(['Date range must be between 1 and 92 days.']);
    } finally {
      sub.unsubscribe();
    }
  });

  it('forbidden toast', async () => {
    modal.open(makeContext());
    fixture.detectChanges();
    submitButton().click();

    http.expectOne(EXPORT_PATH).flush({ errorCode: 'AUDIT_EXPORT_FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notify.toasts()[0]?.type).toBe('error');
    expect(notify.toasts()[0]?.title).toBe('Only workspace-wide auditors can export');
  });

  it('in progress toast links to the running export', async () => {
    modal.open(makeContext());
    fixture.detectChanges();
    submitButton().click();

    http.expectOne(EXPORT_PATH).flush(
      {
        errorCode: 'AUDIT_EXPORT_IN_PROGRESS',
        details: { exportId: ['019a7c20-0010-7000-8000-000000000010'] },
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notify.toasts()[0]?.title).toBe('An export is already running');
    expect(notify.toasts()[0]?.text).toBe(
      '/workspace/operations/audit-log?exportId=019a7c20-0010-7000-8000-000000000010',
    );

    submitButton().click();
    http.expectOne(EXPORT_PATH).flush(
      { errorCode: 'AUDIT_EXPORT_IN_PROGRESS' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const latest = notify.toasts()[notify.toasts().length - 1];
    expect(latest?.title).toBe('An export is already running');
    expect(latest?.text).toBe('');
  });

  it('a 401 keeps the modal', async () => {
    modal.open(makeContext());
    fixture.detectChanges();
    submitButton().click();

    const first = http.expectOne(EXPORT_PATH);
    const firstKey = first.request.headers.get('x-idempotency-key');
    expect(firstKey).toMatch(UUID_V7_REGEX);
    first.flush({ errorCode: 'COMMON.GENERIC.UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(notify.toasts()[0]?.title).toBe('Not saved. Try again.');

    submitButton().click();
    const retry = http.expectOne(EXPORT_PATH);
    expect(retry.request.headers.get('x-idempotency-key')).toBe(firstKey);
    retry.flush(
      { success: true, data: { exportId: '019a7c20-0011-7000-8000-000000000011', status: 'QUEUED' } },
      { status: 202, statusText: 'Accepted' },
    );
    await fixture.whenStable();
  });

  it('retry reuses the key', async () => {
    const context = makeContext();
    modal.open(context);
    fixture.detectChanges();
    submitButton().click();

    const first = http.expectOne(EXPORT_PATH);
    const firstKey = first.request.headers.get('x-idempotency-key');
    const firstBody = first.request.body;
    expect(firstKey).toMatch(UUID_V7_REGEX);
    first.flush({ code: 'GW.UPSTREAM.FAILED' }, { status: 503, statusText: 'Service Unavailable' });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(notify.toasts()[0]?.type).toBe('error');

    submitButton().click();
    const second = http.expectOne(EXPORT_PATH);
    expect(second.request.headers.get('x-idempotency-key')).toBe(firstKey);
    expect(second.request.body).toEqual(firstBody);
    second.error(new ProgressEvent('error'), { status: 0, statusText: 'Network error' });

    await fixture.whenStable();
    fixture.detectChanges();

    submitButton().click();
    const third = http.expectOne(EXPORT_PATH);
    expect(third.request.headers.get('x-idempotency-key')).toBe(firstKey);
    expect(third.request.body).toEqual(firstBody);
    third.flush(
      { success: true, data: { exportId: '019a7c20-0012-7000-8000-000000000012', status: 'QUEUED' } },
      { status: 202, statusText: 'Accepted' },
    );
    await fixture.whenStable();

    // Changing the body for a new export action generates a fresh UUID v7 key.
    modal.open(makeContext({ query: { ...context.query, outcome: 'FAILURE' } }));
    fixture.detectChanges();
    submitButton().click();
    const changed = http.expectOne(EXPORT_PATH);
    expect(changed.request.headers.get('x-idempotency-key')).toMatch(UUID_V7_REGEX);
    expect(changed.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
    changed.flush(
      { success: true, data: { exportId: '019a7c20-0013-7000-8000-000000000013', status: 'QUEUED' } },
      { status: 202, statusText: 'Accepted' },
    );
    await fixture.whenStable();
  });
});
