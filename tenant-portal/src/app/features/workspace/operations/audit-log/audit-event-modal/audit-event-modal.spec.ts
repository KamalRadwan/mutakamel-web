import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enAudit from '../../../../../../../public/i18n/ws-audit-log/en.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Notify } from '../../../../../core/notify/notify';
import { AuditEvent } from '../audit-log.model';
import { AuditEventModal } from './audit-event-modal';

const event = { id: '019a7c20-0002-7000-8000-000000000002', actorLabel: 'Mona', action: 'UPDATE', entityType: 'Party', entityId: 'party', entityLabel: 'Nile', createdAt: new Date().toISOString(), sourceApp: null, sourceKind: null, sensitivity: null, outcome: null, correlationId: null, diff: [], before: null, after: null } as unknown as AuditEvent;
const translations: Record<string, Translation> = { en: enGlobal, 'ws-audit-log/en': enAudit, 'settings/en': enSettings };

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}

const dialogProto = HTMLDialogElement.prototype;
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close };
beforeEach(() => {
  dialogProto.showModal = function () { this.setAttribute('open', ''); };
  dialogProto.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
afterEach(() => { dialogProto.showModal = originalDialog.showModal; dialogProto.close = originalDialog.close; });

describe('AuditEventModal', () => {
  let fixture: ComponentFixture<AuditEventModal>;
  let modal: AuditEventModal;
  let http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AuditEventModal], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me: signal(null), selection: signal(null) } },
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: true }, loader: TestLoader }),
    ] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditEventModal);
    modal = fixture.componentInstance;
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); http.verify(); vi.restoreAllMocks(); });

  it('opens with the fetched event', async () => {
    modal.open(event);
    const request = http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`);
    request.flush({ success: true, data: { ...event, entityLabel: 'Fetched label' } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fetched label');
    expect(fixture.nativeElement.textContent).not.toContain('.null');
    expect(fixture.nativeElement.textContent).not.toContain('Show related events');
    modal.close();
    modal.open(event);
    http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`).flush({ success: true, data: event });
    await fixture.whenStable();
  });

  it('not found closes with a toast', async () => {
    modal.open(event);
    http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`).flush({ errorCode: 'AUDIT_EVENT_NOT_FOUND' }, { status: 404, statusText: 'Not found' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
    expect(TestBed.inject(Notify).toasts()[0]?.title).toContain('Audit event was not found');
  });

  it('a 5xx shows the modal load failure', async () => {
    modal.open(event);
    http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`).flush({ code: 'GW.UPSTREAM.FAILED', correlationId: 'ref-1' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(fixture.nativeElement.querySelector('ui-full-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ref-1');
    (fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement).click();
    http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`).flush({ success: true, data: event });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
  });

  it('redaction placeholders get labels', async () => {
    modal.open(event);
    http.expectOne(`/api/tenant/core/v1/audit/events/${event.id}`).flush({ success: true, data: { ...event, diff: [{ field: 'value', before: '[REDACTED]', after: '[TRUNCATED]' }] } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hidden (sensitive)');
    expect(fixture.nativeElement.textContent).toContain('Shortened');
    expect(modal['formatScalar']('prefix [REDACTED]')).toBe('prefix [REDACTED]');
  });
});
