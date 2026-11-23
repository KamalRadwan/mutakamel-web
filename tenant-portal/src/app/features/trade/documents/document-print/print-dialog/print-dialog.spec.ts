import { LanguageState } from '../../../../../core/i18n/language';
import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../../public/i18n/ar.json';
import en from '../../../../../../../public/i18n/en.json';
import arTradeDocuments from '../../../../../../../public/i18n/trade-documents/ar.json';
import enTradeDocuments from '../../../../../../../public/i18n/trade-documents/en.json';
import arPrint from '../../../../../../../public/i18n/trade-documents-print/ar.json';
import enPrint from '../../../../../../../public/i18n/trade-documents-print/en.json';
import arTradeShared from '../../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ApiError } from '../../../shared/trade-api';
import { bindTradeHttpForTest } from '../../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import type { DocumentKind, PrintTemplateOption, RenderJob } from '../../shared/document.model';
import { PrintDialog, type PrintSource } from './print-dialog';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, tradeShared: enTradeShared, td: enTradeDocuments, tdp: enPrint },
  ar: { ...ar, tradeShared: arTradeShared, td: arTradeDocuments, tdp: arPrint },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-documents/en': enTradeDocuments,
  'trade-documents/ar': arTradeDocuments,
  'trade-documents-print/en': enPrint,
  'trade-documents-print/ar': arPrint,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

@Component({
  imports: [PrintDialog],
  template: `<app-print-dialog [kind]="kind()" [documentId]="documentId()" [source]="source()" />`,
})
class Host {
  readonly dialog = viewChild.required(PrintDialog);
  readonly kind = signal<DocumentKind>('purchase-order');
  readonly documentId = signal('po-1');
  readonly source = signal<PrintSource>({ sourceVersion: 4 });
}

interface DialogInternals {
  choices(): { id: string; kind: string }[];
  selectedChoice(): string | null;
  templates(): PrintTemplateOption[];
  canPrint(): boolean;
  phase(): string;
  templateErrorKey(): string | null;
  selectChoice(id: string): void;
  print(): Promise<void>;
  loadTemplates(): Promise<void>;
  onModalClosed(): void;
}

const CTX = { companyId: '019a0000-0000-7000-8000-000000000001', branchId: '019a0000-0000-7000-8000-000000000002' };

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`PrintDialog live wiring (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<Host>;
      let dialog: DialogInternals;
      let httpStub: TradeHttpStub;
      let coreStub: TradeCoreStub;
      let restoreHttp: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

      beforeEach(async () => {
        TestBed.resetTestingModule();
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        coreStub = new TradeCoreStub({
          'GET /api/tenant/core/v1/templates/assignments': {
            items: [
              {
                assignmentId: 'asg-1',
                definitionId: 'def-1',
                versionId: 'ver-1',
                versionNumber: 3,
                documentType: 'PURCHASE_ORDER',
                outputChannel: 'PRINT',
                adapterKey: 'TRADE_PURCHASE_ORDER_PRINT_V1',
                locale: 'en-US',
                priority: 10,
                isDefault: true,
                status: 'ACTIVE',
              },
            ],
            pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
          },
          'GET /api/tenant/core/v1/templates': {
            items: [{ templateId: 'def-1', name: 'Corporate Purchase Order' }],
            pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
          },
        });

        httpStub = new TradeHttpStub();
        restoreHttp = bindTradeHttpForTest(httpStub, coreStub);

        TestBed.configureTestingModule({
          imports: [Host],
          providers: [
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
              loader: TestTranslocoLoader,
            }),
            {
              provide: ScopeState,
              useValue: {
                company: signal({ id: CTX.companyId, nameEn: 'Co', nameAr: 'شركة', branches: [] }),
                branch: signal({ id: CTX.branchId, nameEn: 'Br', nameAr: 'فرع' }),
                companies: signal([]),
                branches: signal([]),
              },
            },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(lang);
        TestBed.inject(LanguageState).current.set(lang);

        fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        dialog = fixture.componentInstance.dialog() as unknown as DialogInternals;
        await dialog.loadTemplates();
        fixture.detectChanges();
      });

      afterEach(() => {
        dialog.onModalClosed();
        fixture.destroy();
        TestBed.resetTestingModule();
        restoreHttp();
        vi.restoreAllMocks();
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('loads Core print templates, selects Default first, and runs render -> job -> readBlob -> objectUrl -> revoke', async () => {
        expect(dialog.choices()[0]).toEqual({ id: 'default', kind: 'default' });
        expect(dialog.templates()).toEqual([
          {
            templateId: 'def-1',
            versionId: 'ver-1',
            name: 'Corporate Purchase Order',
            locale: 'en-US',
            versionNumber: 3,
          },
        ]);
        expect(dialog.selectedChoice()).toBe('default');
        expect(dialog.canPrint()).toBe(true);

        const completedJob: RenderJob = {
          renderJobId: 'rj-1',
          status: 'COMPLETED',
          attemptCount: 1,
          statusUrl: '/api/tenant/trade/v1/purchase-orders/po-1/render-jobs/rj-1',
        };
        const pdfBlob = new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' });
        httpStub.register('POST', '/purchase-orders/po-1/render-pdf', completedJob);
        httpStub.register('GET', '/purchase-orders/po-1/render-jobs/rj-1/artifact', pdfBlob);

        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-po-1');
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const winOpen = vi.spyOn(window, 'open').mockReturnValue(null);
        const notifySuccess = vi.spyOn(Notify.prototype, 'success');

        await dialog.print();

        expect(httpStub.recordedWrites()).toEqual([
          {
            method: 'POST',
            path: '/purchase-orders/po-1/render-pdf',
            body: {
              sourceVersion: 4,
              purpose: 'PURCHASE_ORDER',
              locale: lang === 'ar' ? 'ar-EG' : 'en-US',
            },
            query: undefined,
            key: expect.any(String),
            ifMatch: undefined,
            scope: CTX,
          },
        ]);
        expect(httpStub.recordedReads()).toEqual([
          {
            path: '/purchase-orders/po-1/render-jobs/rj-1/artifact',
            query: undefined,
            scope: CTX,
          },
        ]);
        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(winOpen).toHaveBeenCalledWith('blob:pdf-po-1', '_blank', 'noopener');
        expect(notifySuccess).toHaveBeenCalled();

        fixture.destroy();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf-po-1');
      });

      it('shows noDefaultAssignment on 422 and prints built-in quotation with revisionId (no sourceVersion)', async () => {
        httpStub.register(
          'POST',
          '/purchase-orders/po-1/render-pdf',
          new ApiError(422, 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE', {
            reason: ['no_eligible_default_assignment'],
          }),
        );

        await dialog.print();
        expect(dialog.templateErrorKey()).toBe('td.errors.noDefaultAssignment');
        expect(dialog.phase()).toBe('idle');

        fixture.componentInstance.kind.set('quotation');
        fixture.componentInstance.documentId.set('qt-1');
        fixture.componentInstance.source.set({ revisionId: 'rev-1' });
        fixture.detectChanges();
        await dialog.loadTemplates();
        dialog.selectChoice('built-in');

        const completedJob: RenderJob = {
          renderJobId: 'rj-qt-1',
          status: 'COMPLETED',
          attemptCount: 1,
          statusUrl: '/api/tenant/trade/v1/quotations/qt-1/render-jobs/rj-qt-1',
        };
        httpStub.register('POST', '/quotations/qt-1/render-pdf', completedJob);
        httpStub.register(
          'GET',
          '/quotations/qt-1/render-jobs/rj-qt-1/artifact',
          new Blob(['%PDF-1.4 qt'], { type: 'application/pdf' }),
        );
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-qt-1');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(window, 'open').mockReturnValue(null);

        await dialog.print();

        const lastWrite = httpStub.recordedWrites().at(-1);
        expect(lastWrite?.path).toBe('/quotations/qt-1/render-pdf');
        expect(lastWrite?.body).toEqual({
          revisionId: 'rev-1',
          purpose: 'CUSTOMER_QUOTATION',
          templateChoice: 'BUILT_IN',
          locale: lang === 'ar' ? 'ar-EG' : 'en-US',
        });
        expect((lastWrite?.body as Record<string, unknown>)['sourceVersion']).toBeUndefined();
      });

      it('shows the forbidden state for a PDF 403 without an error toast', async () => {
        const notifyError = vi.spyOn(Notify.prototype, 'error');
        await dialog.loadTemplates();
        httpStub.register('POST', '/purchase-orders/po-1/render-pdf', new ApiError(403, 'FORBIDDEN'));
        await dialog.print();
        fixture.detectChanges();
        expect(dialog.phase()).toBe('forbidden');
        expect(dialog.canPrint()).toBe(false);
        expect((fixture.nativeElement as HTMLElement).querySelector('ui-full-state')).not.toBeNull();
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('handles 403 template list without error toast, 503 unavailable inline, and translates tdp.errors codes', async () => {
        const notifyError = vi.spyOn(Notify.prototype, 'error');
        coreStub.register('GET', '/api/tenant/core/v1/templates/assignments', new ApiError(403, 'FORBIDDEN'));
        await dialog.loadTemplates();
        expect(dialog.selectedChoice()).toBe('default');
        expect(dialog.canPrint()).toBe(true);
        expect(notifyError).not.toHaveBeenCalled();

        httpStub.register('POST', '/purchase-orders/po-1/render-pdf', new ApiError(503, 'TRADE.QUOTE.PDF_BUNDLE_UNAVAILABLE'));
        await dialog.print();
        expect(dialog.phase()).toBe('unavailable');
        expect(notifyError).not.toHaveBeenCalled();

        httpStub.register('POST', '/purchase-orders/po-1/render-pdf', {
          renderJobId: 'rj-fail',
          status: 'FAILED',
          attemptCount: 1,
          failure: { code: 'TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED', terminal: true },
          statusUrl: '/api/tenant/trade/v1/purchase-orders/po-1/render-jobs/rj-fail',
        });
        const t = TestBed.inject(TranslocoService);
        await dialog.print();
        expect(dialog.phase()).toBe('failed');
        expect(notifyError).toHaveBeenCalledWith(t.translate('tdp.errors.TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED'));
      });
    });
  }
}
