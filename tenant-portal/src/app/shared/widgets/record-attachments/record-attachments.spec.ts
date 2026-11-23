import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../public/i18n/record-attachments/en.json';
import ar from '../../../../../public/i18n/record-attachments/ar.json';
import enGlobal from '../../../../../public/i18n/en.json';
import arGlobal from '../../../../../public/i18n/ar.json';
import { ApiError } from '../../../core/api/api-errors';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, type CrmHttpTransport } from '../../../features/crm/shared/crm-http';
import { ConfirmDialog } from '../../ui/confirm-dialog/confirm-dialog';
import { RecordAttachments } from './record-attachments';
import type { RecordAttachment, RecordAttachmentPage } from './record-attachments.model';

const BRANCH = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa01';
const SOURCE = '0192b7ea-7c4f-7a7d-9c9f-51c7f2b3aa02';
const ROW: RecordAttachment = {
  id: SOURCE, branchId: BRANCH, sourceType: 'LEAD', sourceId: SOURCE, fileName: 'offer.pdf',
  mimeType: 'application/pdf', sizeBytes: 3, uploadedByUserId: SOURCE,
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
};
function page(items = [ROW], total = items.length): RecordAttachmentPage {
  return { items, total, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false };
}
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    const translation = path.includes('/') ? (path.endsWith('ar') ? ar : en) : (path === 'ar' ? arGlobal : enGlobal);
    return defer(() => Promise.resolve(translation as Translation));
  }
}
interface Internals {
  onPicked(file: File): void;
  retryUpload(id: string): void;
  dismissUpload(id: string): void;
  loadMore(): void;
  remove(row: RecordAttachment): Promise<void>;
  uploads(): { id: string; error: string | null; retryable: boolean }[];
  items(): RecordAttachment[];
  total(): number;
  loading(): boolean;
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    describe('RecordAttachments ' + lang + ' ' + theme, () => {
      let fixture: ComponentFixture<RecordAttachments>;
      let component: Internals;
      let dispose: () => void;
      const selected = signal<{ companyId: string; branchId: string | null }>({ companyId: SOURCE, branchId: BRANCH });
      const branchCompanies = signal<ReadonlyMap<string, string>>(new Map([[BRANCH, SOURCE]]));
      let read = vi.fn();
      let write = vi.fn();
      let multipart = vi.fn();
      let notify: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
      let warnings: ReturnType<typeof vi.spyOn>;

      async function render(): Promise<void> {
        fixture.detectChanges();
        for (let i = 0; i < 20; i++) await Promise.resolve();
        await fixture.whenStable();
        fixture.detectChanges();
      }
      async function setup(): Promise<void> {
        const transloco = TestBed.inject(TranslocoService);
        await firstValueFrom(transloco.load(lang));
        await firstValueFrom(transloco.load('record-attachments/' + lang));
        fixture = TestBed.createComponent(RecordAttachments);
        fixture.componentRef.setInput('sourceType', 'LEAD');
        fixture.componentRef.setInput('sourceId', SOURCE);
        fixture.componentRef.setInput('branchId', BRANCH);
        fixture.componentRef.setInput('canCreate', true);
        fixture.componentRef.setInput('canDelete', true);
        component = fixture.componentInstance as unknown as Internals;
        await render();
      }
      beforeEach(() => {
        TestBed.resetTestingModule();
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.dataset['theme'] = theme;
        selected.set({ companyId: SOURCE, branchId: BRANCH });
        branchCompanies.set(new Map([[BRANCH, SOURCE]]));
        read = vi.fn().mockResolvedValue(page());
        write = vi.fn().mockResolvedValue({ status: 204, data: undefined });
        multipart = vi.fn().mockResolvedValue({ status: 201, data: { ...ROW, id: 'new-file' } });
        notify = { error: vi.fn(), success: vi.fn() };
        dispose = bindCrmHttpForTest({
          read, write, writeMultipart: multipart, readBlob: vi.fn(),
        } as unknown as CrmHttpTransport);
        warnings = vi.spyOn(console, 'warn');
        TestBed.configureTestingModule({
          imports: [RecordAttachments],
          providers: [
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
              loader: Loader,
            }),
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: Notify, useValue: notify },
            { provide: TenantScopeState, useValue: { selection: selected, branchCompanies } },
          ],
        });
      });
      afterEach(() => {
        fixture?.destroy();
        dispose();
        const ownWarnings = warnings.mock.calls.filter((args: unknown[]) => /Missing hint|Missing translation|not found/i.test(args.join(' ')));
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
        expect(ownWarnings).toEqual([]);
      });

      it('lists by source', async () => {
        read.mockResolvedValueOnce({ ...page([ROW], 2), hasNext: true, totalPages: 2 });
        await setup();
        expect(read).toHaveBeenCalledWith('/attachments', {
          branchId: BRANCH, sourceType: 'LEAD', sourceId: SOURCE, page: 1, limit: 20,
        });
        expect(fixture.nativeElement.textContent).toContain('offer.pdf');
        const counts: number[] = [];
        fixture.componentInstance.countChange.subscribe(count => counts.push(count));
        read.mockResolvedValueOnce({ ...page([{ ...ROW, id: 'second', fileName: 'second.pdf' }], 2), page: 2 });
        component.loadMore();
        await render();
        expect(component.items()).toHaveLength(2);
        expect(component.total()).toBe(2);
        expect(counts).toEqual([2]);
        expect(fixture.nativeElement.textContent).toContain('second.pdf');
        const browse = fixture.nativeElement.querySelector('ui-file-drop button') as HTMLButtonElement;
        expect(browse.getAttribute('aria-describedby')).toContain('-hint');
        expect(fixture.nativeElement.querySelector('[data-ui-hint]')).not.toBeNull();
        expect(fixture.nativeElement.textContent).not.toMatch(/recordAttachments\./);
      });

      it('upload errors', async () => {
        await setup();
        const translations = lang === 'ar' ? ar : en;
        for (const [status, code, message] of [
          [413, 'CRM_ATTACHMENT_FILE_TOO_LARGE', translations.errors.CRM_ATTACHMENT_FILE_TOO_LARGE],
          [415, 'CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED', translations.errors.CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED],
          [507, 'UNRECOGNISED_STORAGE_CODE', translations.errors.STORAGE_CAPACITY_EXCEEDED],
          [404, 'CRM_SOURCE_NOT_FOUND', translations.errors.CRM_SOURCE_NOT_FOUND],
          [422, 'CRM_SOURCE_BRANCH_MISMATCH', translations.errors.CRM_SOURCE_BRANCH_MISMATCH],
        ] as const) {
          multipart.mockRejectedValueOnce(new ApiError(status, code));
          component.onPicked(new File(['pdf'], 'offer.pdf', { type: 'application/pdf' }));
          await render();
          expect(component.uploads()[0].error).toBe(message);
          expect(fixture.nativeElement.textContent).toContain(message);
          expect(notify.error).toHaveBeenLastCalledWith(message);
          component.dismissUpload(component.uploads()[0].id);
          await render();
        }
      });

      it('delete 404', async () => {
        await setup();
        const confirm = fixture.debugElement.query(By.directive(ConfirmDialog)).componentInstance as ConfirmDialog;
        vi.spyOn(confirm, 'open').mockResolvedValue(true);
        write.mockRejectedValueOnce(new ApiError(404, 'CRM_ATTACHMENT_NOT_FOUND'));
        await component.remove(ROW);
        await render();
        expect(component.items()).toHaveLength(0);
        expect(component.total()).toBe(0);
        expect(notify.success).toHaveBeenCalled();
        expect(notify.error).not.toHaveBeenCalled();
      });

      it('respects the page flags', async () => {
        await setup();
        fixture.componentRef.setInput('canUpload', true);
        fixture.componentRef.setInput('canCreate', false);
        fixture.componentRef.setInput('canDelete', false);
        await render();
        expect(fixture.nativeElement.querySelector('ui-file-drop')).toBeNull();
        expect(fixture.nativeElement.querySelector('ng-icon[name="tablerTrash"]')).toBeNull();
        component.onPicked(new File(['pdf'], 'offer.pdf'));
        await component.remove(ROW);
        expect(multipart).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
      });

      it('keeps the upload key and file for a transient retry and a 401', async () => {
        await setup();
        for (const status of [0, 500, 401]) {
          multipart.mockRejectedValueOnce(new ApiError(status, 'FAILED'));
          const file = new File(['pdf'], 'offer.pdf', { type: 'application/pdf' });
          component.onPicked(file);
          await render();
          const failed = component.uploads()[0];
          expect(failed.retryable).toBe(true);
          const call = multipart.mock.calls.at(-1)!;
          component.retryUpload(failed.id);
          await render();
          const retry = multipart.mock.calls.at(-1)!;
          expect(retry[2]).toEqual(call[2]);
          expect((retry[1] as FormData).get('file')).toMatchObject({ name: file.name, size: file.size, type: file.type });
          expect(component.uploads()).toHaveLength(0);
        }
      });

      it('never retries a mismatched upload and reloads the list', async () => {
        await setup();
        multipart.mockRejectedValueOnce(new ApiError(422, 'CRM_ATTACHMENT_IDEMPOTENCY_MISMATCH'));
        component.onPicked(new File(['pdf'], 'offer.pdf'));
        await render();
        const failed = component.uploads()[0];
        expect(failed.retryable).toBe(false);
        expect(read).toHaveBeenCalledTimes(2);
        component.retryUpload(failed.id);
        await render();
        expect(multipart).toHaveBeenCalledTimes(1);
      });

      it('switches to read-only after a module or seat rejection', async () => {
        await setup();
        multipart.mockRejectedValueOnce(new ApiError(403, 'SEAT_OVER_CAPACITY_READ_ONLY'));
        component.onPicked(new File(['pdf'], 'offer.pdf'));
        await render();
        expect(fixture.nativeElement.querySelector('ui-file-drop')).toBeNull();
        expect(fixture.nativeElement.querySelector('ng-icon[name="tablerTrash"]')).toBeNull();
        component.onPicked(new File(['pdf'], 'next.pdf'));
        expect(multipart).toHaveBeenCalledTimes(1);
      });

      it('does not count a replayed upload twice when it is already listed', async () => {
        await setup();
        multipart.mockResolvedValueOnce({ status: 201, data: ROW });
        component.onPicked(new File(['pdf'], 'offer.pdf', { type: 'application/pdf' }));
        await render();
        expect(component.items()).toHaveLength(1);
        expect(component.total()).toBe(1);
      });

      it('renders forbidden and load-failure states with retry and correlation id', async () => {
        read.mockRejectedValueOnce(new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED'));
        await setup();
        expect(fixture.nativeElement.querySelector('ui-full-state')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('ui-file-drop')).toBeNull();
        fixture.destroy();
        read.mockRejectedValueOnce(new ApiError(503, 'FAILED', undefined, { correlationId: 'trace-attachments' }));
        await setup();
        expect(fixture.nativeElement.textContent).toContain('trace-attachments');
        read.mockResolvedValueOnce(page());
        (fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement).click();
        await render();
        expect(component.items()).toHaveLength(1);
      });

      it('makes no request for missing or ambiguous session branches and drops stale responses', async () => {
        selected.set({ companyId: SOURCE, branchId: null });
        await setup();
        expect(read).not.toHaveBeenCalled();
        expect(fixture.nativeElement.textContent).toContain((lang === 'ar' ? ar : en).chooseBranch);
        selected.set({ companyId: SOURCE, branchId: BRANCH });
        branchCompanies.set(new Map());
        await render();
        expect(read).not.toHaveBeenCalled();
        let resolve!: (value: RecordAttachmentPage) => void;
        read.mockImplementationOnce(() => new Promise<RecordAttachmentPage>(done => { resolve = done; }));
        branchCompanies.set(new Map([[BRANCH, SOURCE]]));
        fixture.detectChanges();
        expect(read).toHaveBeenCalledTimes(1);
        selected.set({ companyId: SOURCE, branchId: null });
        fixture.detectChanges();
        resolve(page());
        await render();
        expect(component.items()).toHaveLength(0);
        expect(component.loading()).toBe(false);
      });
    });
  }
}
