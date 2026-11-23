import { mockDialogsForTest } from '../../../../shared/ui/modal/testing/dialog-testing';
import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arBulk from '../../../../../../public/i18n/trade-documents-bulk/ar.json';
import enBulk from '../../../../../../public/i18n/trade-documents-bulk/en.json';
import arTradeDocuments from '../../../../../../public/i18n/trade-documents/ar.json';
import enTradeDocuments from '../../../../../../public/i18n/trade-documents/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { DocumentSelection } from '../shared/document-selection';
import type { DocumentKind } from '../shared/document.model';
import { DocumentBulkBar } from './bulk-bar/bulk-bar';
import { BulkParamsModal } from './bulk-params-modal/bulk-params-modal';
import { BULK_PRINT_NOT_READY_CODE, openBulkPrintArtifact } from './documents-bulk.descriptor';

mockDialogsForTest();

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, tradeShared: enTradeShared, td: enTradeDocuments, tdb: enBulk },
  ar: { ...ar, tradeShared: arTradeShared, td: arTradeDocuments, tdb: arBulk },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-documents/en': enTradeDocuments,
  'trade-documents/ar': arTradeDocuments,
  'trade-documents-bulk/en': enBulk,
  'trade-documents-bulk/ar': arBulk,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

const CTX = {
  companyId: '019a0000-0000-7000-8000-000000000001',
  branchId: '019a0000-0000-7000-8000-000000000002',
};

function makeMe(keys: readonly string[]): TenantMe {
  const permissionScopes: TenantMe['permissionScopes'] = {};
  for (const key of keys) {
    permissionScopes[key] = { tenantWide: false, companyIds: [], branchIds: [CTX.branchId] };
  }
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    accessibleCompanies: [CTX.companyId],
    accessibleBranches: [CTX.branchId],
    accessibleBranchCompanies: [{ companyId: CTX.companyId, branchId: CTX.branchId }],
    permissions: [...keys],
    permissionScopes,
  };
}

describe('openBulkPrintArtifact', () => {
  let httpStub: TradeHttpStub;
  let restoreHttp: () => void;

  beforeEach(() => {
    httpStub = new TradeHttpStub();
    restoreHttp = bindTradeHttpForTest(httpStub);
  });

  afterEach(() => {
    restoreHttp();
    vi.restoreAllMocks();
  });

  it('fetches a fresh signed URL each click with BRANCH scope and opens it once (no caching)', async () => {
    httpStub.register('GET', '/documents/bulk-prints/job-1/artifact', {
      downloadUrl: 'https://files.example.test/bulk-1.zip?sig=first',
      downloadExpiresAt: '2026-11-23T23:00:00.000Z',
    });
    const winOpen = vi.spyOn(window, 'open').mockReturnValue(null);

    const first = await openBulkPrintArtifact('job-1', CTX);
    expect(first).toEqual({
      ready: true,
      artifact: {
        downloadUrl: 'https://files.example.test/bulk-1.zip?sig=first',
        downloadExpiresAt: '2026-11-23T23:00:00.000Z',
      },
    });
    expect(winOpen).toHaveBeenCalledTimes(1);
    expect(winOpen).toHaveBeenCalledWith('https://files.example.test/bulk-1.zip?sig=first', '_blank', 'noopener');

    httpStub.register('GET', '/documents/bulk-prints/job-1/artifact', {
      downloadUrl: 'https://files.example.test/bulk-1.zip?sig=second',
      downloadExpiresAt: '2026-11-23T23:05:00.000Z',
    });
    const second = await openBulkPrintArtifact('job-1', CTX);
    expect(second).toEqual({
      ready: true,
      artifact: {
        downloadUrl: 'https://files.example.test/bulk-1.zip?sig=second',
        downloadExpiresAt: '2026-11-23T23:05:00.000Z',
      },
    });
    expect(httpStub.recordedReads()).toEqual([
      { path: '/documents/bulk-prints/job-1/artifact', query: undefined, scope: CTX },
      { path: '/documents/bulk-prints/job-1/artifact', query: undefined, scope: CTX },
    ]);
  });

  it('returns ready: false on 409 ARTIFACT_NOT_READY and rethrows 404 BULK_JOB_NOT_FOUND', async () => {
    httpStub.register('GET', '/documents/bulk-prints/job-2/artifact', new ApiError(409, BULK_PRINT_NOT_READY_CODE));
    await expect(openBulkPrintArtifact('job-2', CTX)).resolves.toEqual({
      ready: false,
      messageKey: `tdb.errors.${BULK_PRINT_NOT_READY_CODE}`,
    });

    httpStub.register('GET', '/documents/bulk-prints/job-missing/artifact', new ApiError(404, 'BULK_JOB_NOT_FOUND'));
    await expect(openBulkPrintArtifact('job-missing', CTX)).rejects.toMatchObject({
      status: 404,
      code: 'BULK_JOB_NOT_FOUND',
    });
  });
});

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DocumentBulkBar & BulkParamsModal (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let httpStub: TradeHttpStub;
      let coreStub: TradeCoreStub;
      let restoreHttp: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

      beforeEach(() => {
        TestBed.resetTestingModule();
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        me.set(makeMe([]));
        httpStub = new TradeHttpStub();
        coreStub = new TradeCoreStub({
          'GET /api/tenant/core/v1/templates/assignments': {
            items: [
              {
                assignmentId: 'asg-1',
                definitionId: 'def-1',
                versionId: 'ver-print-1',
                versionNumber: 2,
                documentType: 'QUOTATION',
                outputChannel: 'PRINT',
                adapterKey: 'TRADE_QUOTATION_PRINT_V1',
                locale: 'ar-EG',
                priority: 5,
                isDefault: true,
                status: 'ACTIVE',
              },
            ],
            pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
          },
          'GET /api/tenant/core/v1/templates': {
            items: [{ templateId: 'def-1', name: 'Arabic Quote Template' }],
            pageInfo: { limit: 100, hasNextPage: false, nextCursor: null },
          },
        });
        restoreHttp = bindTradeHttpForTest(httpStub, coreStub);

        TestBed.configureTestingModule({
          providers: [
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
              loader: TestTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: { me } },
            {
              provide: ScopeState,
              useValue: {
                company: signal({ id: CTX.companyId, nameEn: 'Co', nameAr: 'شركة', branches: [] }),
                branch: signal({ id: CTX.branchId, nameEn: 'Br', nameAr: 'فرع' }),
                companies: signal([]),
                branches: signal([]),
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            {
              provide: BulkJobsTracker,
              useValue: {
                hasActive: () => false,
                finished: signal(null),
                ensureScopesForModule: async () => undefined,
                syncExternalJob: () => undefined,
              },
            },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(lang);
      });

      afterEach(() => {
        TestBed.resetTestingModule();
        restoreHttp();
        vi.restoreAllMocks();
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('requires trade.bulk_jobs.run plus each action permission in active branch', () => {
        const selection = new DocumentSelection();
        selection.toggle('qt-1');

        const fixture: ComponentFixture<DocumentBulkBar> = TestBed.createComponent(DocumentBulkBar);
        fixture.componentRef.setInput('kind', 'quotation' satisfies DocumentKind);
        fixture.componentRef.setInput('selection', selection);
        fixture.componentRef.setInput('query', { page: 1, limit: 25 });
        fixture.componentRef.setInput('total', 1);
        fixture.detectChanges();

        const bar = fixture.componentInstance as unknown as {
          barActions(): { id: string }[];
          menuActions(): { id: string }[];
        };

        // Missing trade.bulk_jobs.run even if action permissions exist
        me.set(makeMe(['trade.quotations.read', 'trade.quotations.send', 'trade.quotations.cancel']));
        fixture.detectChanges();
        expect(bar.barActions()).toEqual([]);
        expect(bar.menuActions()).toEqual([]);

        // trade.bulk_jobs.run + read only -> only PRINT
        me.set(makeMe(['trade.bulk_jobs.run', 'trade.quotations.read']));
        fixture.detectChanges();
        expect(bar.barActions().map((a) => a.id)).toEqual(['PRINT']);
        expect(bar.menuActions()).toEqual([]);

        // sales-order HOLD & RELEASE_HOLD both use trade.sales_orders.hold
        fixture.componentRef.setInput('kind', 'sales-order' satisfies DocumentKind);
        me.set(makeMe(['trade.bulk_jobs.run', 'trade.sales_orders.hold']));
        fixture.detectChanges();
        expect(bar.barActions().map((a) => a.id)).toEqual(['HOLD', 'RELEASE_HOLD']);
      });

      it('BulkParamsModal loads templates via Core with ScopeState and tolerates 403 with Default template enabled', async () => {
        const selection = new DocumentSelection();
        selection.toggle('qt-1');
        const fixture = TestBed.createComponent(BulkParamsModal);
        fixture.componentRef.setInput('kind', 'quotation' satisfies DocumentKind);
        fixture.componentRef.setInput('selection', selection);
        fixture.componentRef.setInput('query', { page: 1, limit: 25 });
        fixture.componentRef.setInput('total', 1);
        fixture.detectChanges();

        const modal = fixture.componentInstance as unknown as {
          open(action: 'PRINT'): void;
          close(): void;
          templates(): { versionId: string; name: string }[];
          templatesError(): boolean;
          canSubmit(): boolean;
        };

        modal.open('PRINT');
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(modal.templates().length).toBe(1);
        });
        expect(modal.templates()[0]).toMatchObject({ versionId: 'ver-print-1', name: 'Arabic Quote Template' });
        expect(modal.canSubmit()).toBe(true);
        modal.close();

        coreStub.register('GET', '/api/tenant/core/v1/templates/assignments', new ApiError(403, 'FORBIDDEN'));
        modal.open('PRINT');
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(modal.canSubmit()).toBe(true);
        });
        expect(modal.templates()).toEqual([]);
        expect(modal.templatesError()).toBe(false);
        modal.close();
      });
    });
  }
}
