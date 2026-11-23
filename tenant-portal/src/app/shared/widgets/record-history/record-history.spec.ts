import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import enHistory from '../../../../../public/i18n/record-history/en.json';
import enActivities from '../../../../../public/i18n/activities/en.json';
import enGlobal from '../../../../../public/i18n/en.json';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { RecordHistory } from './record-history';

const PATH = '/api/tenant/core/v1/audit/entities/Party/party';
const translations: Record<string, Translation> = { en: enGlobal, 'record-history/en': enHistory, 'activities/en': enActivities };

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}

describe('RecordHistory', () => {
  let fixture: ComponentFixture<RecordHistory>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RecordHistory], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me: signal(null), selection: signal(null) } },
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: true }, loader: TestLoader }),
    ] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecordHistory);
    fixture.componentRef.setInput('entityTypes', ['Party']);
    fixture.componentRef.setInput('entityId', 'party');
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  async function fail(status: number, code: string) {
    http.expectOne((r) => r.url === PATH).flush({ errorCode: code, correlationId: 'support-ref' }, { status, statusText: 'Failure' });
    await fixture.whenStable(); fixture.detectChanges();
  }

  it('a 400 shows the widget load failure', async () => {
    await fail(400, 'AUDIT_QUERY_INVALID');
    expect(fixture.nativeElement.querySelector('ui-full-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('support-ref');
  });
  it('a 403 hides the widget', async () => {
    await fail(403, 'MISSING_REQUIRED_PERMISSIONS');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
  it('a 5xx shows Retry', async () => {
    await fail(503, 'GW.UPSTREAM.FAILED');
    expect(fixture.nativeElement.querySelector('ui-full-state button')).toBeTruthy();
    (fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === PATH).flush({ success: true, data: { items: [], nextCursor: null } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
  });
  it('empty shows no history yet', async () => {
    http.expectOne((r) => r.url === PATH).flush({ success: true, data: { items: [], nextCursor: null } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(enHistory.empty);
  });
  it('redaction placeholders get labels', async () => {
    fixture.componentRef.setInput('valueLabel', () => 'host label');
    http.expectOne((r) => r.url === PATH).flush({ success: true, data: { items: [{ id: 'event-1', action: 'UPDATE', entityType: 'Party', entityId: 'party', entityLabel: 'Nile', actorLabel: 'Mona', actorType: 'USER', createdAt: new Date().toISOString(), outcome: null, diff: [{ field: 'phone', before: '[REDACTED]', after: '[TRUNCATED]' }], before: null, after: null }], nextCursor: null } });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hidden (sensitive)');
    expect(fixture.nativeElement.textContent).toContain('Shortened');
    expect(fixture.nativeElement.textContent).toContain('—');
    expect(fixture.nativeElement.textContent).not.toContain('host label');
  });
});
