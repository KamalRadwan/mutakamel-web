import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arTradeDocuments from '../../../../../../public/i18n/trade-documents/ar.json';
import enTradeDocuments from '../../../../../../public/i18n/trade-documents/en.json';
import arList from '../../../../../../public/i18n/trade-documents-list/ar.json';
import enList from '../../../../../../public/i18n/trade-documents-list/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { DocumentKind, PurchaseQuotation, Quotation } from '../shared/document.model';
import { DocumentList } from './document-list';
import { rowMenu } from './document-row-menu';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, tradeShared: enTradeShared, td: enTradeDocuments, tdl: enList },
  ar: { ...ar, tradeShared: arTradeShared, td: arTradeDocuments, tdl: arList },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-documents/en': enTradeDocuments,
  'trade-documents/ar': arTradeDocuments,
  'trade-documents-list/en': enList,
  'trade-documents-list/ar': arList,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeMe(keys: readonly string[]): TenantMe {
  const permissionScopes: TenantMe['permissionScopes'] = {};
  for (const key of keys) {
    permissionScopes[key] = { tenantWide: false, companyIds: [], branchIds: ['b1'] };
  }
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    accessibleCompanies: ['c1'],
    accessibleBranches: ['b1'],
    accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
    permissions: [...keys],
    permissionScopes,
  };
}

function makeQuotationRow(over: Partial<Quotation> = {}): Quotation {
  return {
    id: 'qt-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'ACCEPTED',
    documentNumber: 'QT-2026-0001',
    draftReference: 'REF-1',
    grandTotal: '1500',
    partySnapshot: { id: 'pty-1', displayName: 'Al Noor Trading' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: 'rev-1',
    crmCustomerProfileId: null,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    currentRevision: {
      id: 'rev-1',
      revisionNumber: 1,
      status: 'ACCEPTED',
      validUntil: '2026-12-31',
      priceLockExpiresAt: null,
    },
    ...over,
  };
}

function makePqRow(over: Partial<PurchaseQuotation> = {}): PurchaseQuotation {
  return {
    id: 'pq-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'sup-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'PQ-2026-0001',
    partySnapshot: { id: 'sup-1', displayName: 'Gulf Steel' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    reference: null,
    notes: null,
    validUntil: null,
    finalizedAt: null,
    convertedPurchaseOrderId: null,
    termsSnapshot: null,
    totalsSnapshot: {
      subtotal: '500',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '500',
      amountPaid: '0',
      amountDue: '500',
    },
    ...over,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DocumentList (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let stub: TradeHttpStub;
      let restoreHttp: () => void;
      let routeData$: BehaviorSubject<{ kind: DocumentKind }>;
      let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

      beforeEach(() => {
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        routeData$ = new BehaviorSubject<{ kind: DocumentKind }>({ kind: 'quotation' });
        queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
        me.set(
          makeMe([
            'trade.quotations.read',
            'trade.quotations.create',
            'trade.quotations.convert',
            'trade.sales_orders.create',
          ]),
        );

        stub = new TradeHttpStub({
          'GET /quotations': { items: [makeQuotationRow()], total: 1, page: 1, limit: 25 },
          'POST /quotations/status-counts': { total: 1, byStatus: { ACCEPTED: 1 } },
        });
        restoreHttp = bindTradeHttpForTest(stub);
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

      async function render(): Promise<ComponentFixture<DocumentList>> {
        TestBed.configureTestingModule({
          providers: [
            provideRouter([]),
            provideTransloco({
              config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false },
              loader: TestTranslocoLoader,
            }),
            {
              provide: ActivatedRoute,
              useValue: {
                data: routeData$.asObservable(),
                queryParamMap: queryParamMap$.asObservable(),
                snapshot: { data: routeData$.value, queryParamMap: queryParamMap$.value },
              },
            },
            { provide: TenantScopeState, useValue: { me } },
            {
              provide: ScopeState,
              useValue: {
                company: signal({ id: 'c1', nameEn: 'Company 1', nameAr: 'شركة 1', branches: [{ id: 'b1', nameEn: 'Branch 1', nameAr: 'فرع 1' }] }),
                branch: signal({ id: 'b1', nameEn: 'Branch 1', nameAr: 'فرع 1' }),
                companies: signal([]),
                branches: signal([]),
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: BulkJobsTracker, useValue: { finished: signal(null) } },
          ],
        });

        const transloco = TestBed.inject(TranslocoService);
        transloco.setActiveLang(lang);
        const fixture = TestBed.createComponent(DocumentList);
        fixture.detectChanges();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['listQuery'].isLoading()).toBe(false);
        });
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
      }

      it('loads quotations via GET /quotations and POST /quotations/status-counts with branch scope', async () => {
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain('QT-2026-0001');
        expect(el.textContent).toContain('Al Noor Trading');
        expect(el.textContent).toContain(t.translate('td.kinds.quotation.new'));
        expect(stub.recordedReads().map((r) => r.path)).toEqual(['/quotations']);
        expect(stub.recordedWrites().map((w) => `${w.method} ${w.path}`)).toEqual(['POST /quotations/status-counts']);
      });

      it('hides create button and convert row action when permissions are missing', async () => {
        me.set(makeMe(['trade.quotations.read']));
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(fixture.componentInstance['canCreate']()).toBe(false);
        expect(fixture.componentInstance['rowPerms']()).toEqual({ canPrint: true, canConvert: false });
        expect(el.textContent).not.toContain(t.translate('td.kinds.quotation.new'));

        const menu = rowMenu('quotation', makeQuotationRow(), fixture.componentInstance['rowPerms']());
        expect(menu.map((item) => item.id)).not.toContain('convert');
      });

      it('renders forbidden full-state and fires 0 HTTP requests when read grant is missing', async () => {
        me.set(makeMe([]));
        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const router = TestBed.inject(Router);
        const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

        const fullState = el.querySelector('ui-full-state');
        expect(fullState?.getAttribute('kind')).toBe('forbidden');
        expect(stub.recordedReads()).toEqual([]);
        expect(stub.recordedWrites()).toEqual([]);

        fixture.componentInstance['goHome']();
        expect(navSpy).toHaveBeenCalledWith('/');
      });

      it('renders forbidden full-state without error toast when server returns 403', async () => {
        stub.register('GET', '/quotations', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.querySelector('ui-full-state')?.getAttribute('kind')).toBe('forbidden');
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('handles nullable validUntil on purchase quotations (D-8) and falls back on unknown enum status', async () => {
        routeData$.next({ kind: 'purchase-quotation' });
        me.set(makeMe(['trade.purchase_quotations.read']));
        stub.register('GET', '/purchase-quotations', {
          items: [makePqRow({ lifecycleStatus: 'FUTURE_STATUS' as never, validUntil: null })],
          total: 1,
          page: 1,
          limit: 25,
        });
        stub.register('POST', '/purchase-quotations/status-counts', { total: 1, byStatus: {} });

        const fixture = await render();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain('PQ-2026-0001');
        expect(el.textContent).toContain('—');
        expect(el.textContent).toContain(t.translate('td.common.unknownStatus'));
        expect(el.textContent).not.toContain('td.status.FUTURE_STATUS');
      });
    });
  }
}
