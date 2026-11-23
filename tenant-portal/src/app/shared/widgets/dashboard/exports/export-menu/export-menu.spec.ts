import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TRANSLOCO_LOADER } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../../public/i18n/export-menu/en.json';
import ar from '../../../../../../../public/i18n/export-menu/ar.json';
import analyticsEn from '../../../../../../../public/i18n/analytics/en.json';
import analyticsAr from '../../../../../../../public/i18n/analytics/ar.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { bindCrmHttpForTest, crmQueries } from '../../../../../features/crm/shared/crm-http';
import { CrmHttpStub } from '../../../../../features/crm/shared/testing/crm-http-testing';
import { bindAnalyticsPermissions } from '../../analytics-permissions';
import { ExportMenu } from './export-menu';

const VIEWS = [['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']] as const;
describe.each(VIEWS)('ExportMenu (%s / %s)', (language, theme) => {
  let fixture: ComponentFixture<ExportMenu>;
  let stub: CrmHttpStub;
  let dispose: () => void;
  const notify = { success: vi.fn(), error: vi.fn() };
  const text = language === 'ar' ? ar : en;
  beforeEach(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    bindAnalyticsPermissions(() => ['crm.exports.create']);
    stub = new CrmHttpStub({ '/analytics/exports': {
      items: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null },
      capabilities: { formats: [{ format: 'PDF', available: false, reason: 'PDF_RENDERER_UNAVAILABLE' }] },
    } });
    dispose = bindCrmHttpForTest(stub);
    crmQueries().clear();
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: language, prodMode: true } }),
      { provide: TRANSLOCO_LOADER, useValue: { getTranslation: (path: string) => of(
        path.startsWith('export-menu/') ? text : path.startsWith('analytics/') ? (language === 'ar' ? analyticsAr : analyticsEn)
          : { exportMenu: text, analytics: language === 'ar' ? analyticsAr : analyticsEn },
      ) } },
      { provide: LanguageState, useValue: { current: signal(language) } },
      { provide: Notify, useValue: notify },
    ] });
    fixture = TestBed.createComponent(ExportMenu);
    fixture.componentRef.setInput('target', { reportKey: 'sales' });
    fixture.componentRef.setInput('period', { from: '2026-11-01', to: '2026-11-23' });
  });
  afterEach(() => {
    fixture.destroy(); dispose(); bindAnalyticsPermissions(() => []); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
  });
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(host().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  async function open() {
    fixture.detectChanges();
    await fixture.whenStable();
    host().querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(rows()[3]?.getAttribute('aria-busy')).toBe('false');
    });
  }
  async function chooseCsv() {
    await open();
    rows()[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host().querySelector('button')?.getAttribute('aria-busy')).toBe('false');
    });
  }

  it('queue limit', async () => {
    vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(429, 'CRM_EXPORT_QUEUE_LIMIT'));
    await chooseCsv();
    expect(notify.error).toHaveBeenCalledWith(text.queueLimit);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('pdf disabled with reason', async () => {
    const write = vi.spyOn(stub, 'write');
    await open();
    const pdf = rows()[2];
    expect(pdf.getAttribute('aria-disabled')).toBe('true');
    expect(pdf.title).toBe(text.pdfRendererUnavailable);
    expect(host().querySelector(`#${pdf.getAttribute('aria-describedby')}`)?.textContent).toBe(text.pdfRendererUnavailable);
    pdf.click();
    expect(write).not.toHaveBeenCalled();
    for (const row of rows()) expect(row.querySelector('ng-icon[name="tablerExclamationCircle"]')).toBeTruthy();
  });

  it('no polling', async () => {
    const read = vi.spyOn(stub, 'read');
    expect(read).not.toHaveBeenCalled();
    await open();
    expect(read).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    rows()[3].click();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(rows()[3]?.getAttribute('aria-busy')).toBe('false');
    });
    expect(read).toHaveBeenCalledTimes(2);
    host().querySelector<HTMLButtonElement>('button')!.click();
    await open();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('keeps the key and body after a lost response and uses a new key for changed filters', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));
    await chooseCsv();
    await chooseCsv();
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    expect(write.mock.calls[0][2]).toEqual(write.mock.calls[1][2]);
    fixture.componentRef.setInput('filters', { owner: 'me' });
    await chooseCsv();
    expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
  });

  it('queues with the active language and preserves a 401 key', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce({ status: 202, data: { exportId: 'export-1', status: 'QUEUED' }, etag: null, location: null });
    await chooseCsv();
    expect(notify.error).toHaveBeenCalledWith(text.notSaved);
    await chooseCsv();
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    expect(write.mock.calls[1][2]).toMatchObject({ locale: language, format: 'CSV' });
    expect(notify.success).toHaveBeenCalledWith(text.queued, text.findIt);
  });

  it('renders a retry state with the correlation id after a read failure', async () => {
    vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', undefined, { correlationId: 'export-request-1' }));
    await open();
    expect(host().querySelector('ui-full-state')).toBeTruthy();
    expect(host().textContent).toContain('export-request-1');
    expect(rows()[0].getAttribute('aria-disabled')).toBe('true');
  });

  it('updates PDF admission on Refresh', async () => {
    await open();
    vi.spyOn(stub, 'read').mockResolvedValueOnce({
      items: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null },
      capabilities: { formats: [{ format: 'PDF', available: true }] },
    });
    rows()[3].click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(rows()[2]?.getAttribute('aria-disabled')).toBeNull();
    });
  });

  it('stops writes after the module is disabled', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'CRM_MODULE_DISABLED'));
    await chooseCsv();
    expect(notify.error).toHaveBeenCalledWith(text.moduleDisabled);
    const trigger = host().querySelector<HTMLButtonElement>('button')!;
    expect(trigger.disabled).toBe(true);
    trigger.click();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not automatically resend an idempotency mismatch', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'GW.IDEM.MISMATCH'));
    await chooseCsv();
    expect(write).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledTimes(1);
    await open();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('includes Refresh in keyboard navigation and restores focus on Escape', async () => {
    await open();
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(rows()[3]);
    rows()[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host().querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(host().querySelector('button'));
  });

  it('hides the action without export permission', async () => {
    fixture.destroy();
    bindAnalyticsPermissions(() => []);
    fixture = TestBed.createComponent(ExportMenu);
    fixture.componentRef.setInput('target', { reportKey: 'sales' });
    fixture.componentRef.setInput('period', { from: '2026-11-01', to: '2026-11-23' });
    fixture.detectChanges();
    expect(host().querySelector('button')).toBeNull();
  });
});
