import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arTradeDocuments from '../../../../../../public/i18n/trade-documents/ar.json';
import enTradeDocuments from '../../../../../../public/i18n/trade-documents/en.json';
import arLines from '../../../../../../public/i18n/trade-documents-lines/ar.json';
import enLines from '../../../../../../public/i18n/trade-documents-lines/en.json';
import arPage from '../../../../../../public/i18n/trade-documents-page/ar.json';
import enPage from '../../../../../../public/i18n/trade-documents-page/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { CurrentUser } from '../../../../core/auth/current-user';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ApiError } from '../../shared/trade-api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type {
  DocumentKind,
  PurchaseQuotationDetail,
  QuotationDetail,
  SalesOrderDetail,
} from '../shared/document.model';
import { DocumentPage } from './document-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: { ...en, tradeShared: enTradeShared, td: enTradeDocuments, tdpg: enPage, tdlines: enLines },
  ar: { ...ar, tradeShared: arTradeShared, td: arTradeDocuments, tdpg: arPage, tdlines: arLines },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-documents/en': enTradeDocuments,
  'trade-documents/ar': arTradeDocuments,
  'trade-documents-page/en': enPage,
  'trade-documents-page/ar': arPage,
  'trade-documents-lines/en': enLines,
  'trade-documents-lines/ar': arLines,
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

function makeQuotationDetail(): QuotationDetail {
  return {
    id: 'qt-1',
    version: 2,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: null,
    draftReference: 'REF-1',
    grandTotal: '100',
    partySnapshot: { id: 'pty-1', displayName: 'Al Noor Trading' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: null,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    currentRevision: {
      id: 'rev-1',
      revisionNumber: 1,
      status: 'DRAFT',
      validUntil: '2026-12-31',
      priceLockExpiresAt: null,
    },
    revisions: [
      {
        id: 'rev-1',
        version: 1,
        quotationId: 'qt-1',
        revisionNumber: 1,
        status: 'DRAFT',
        validUntil: '2026-12-31',
        subtotal: '100',
        discountTotal: '0',
        grandTotal: '100',
        pricingMode: 'NONE',
        discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
        termsSnapshot: {
          schemaVersion: 2,
          clauses: [],
          paymentTermId: 'term-pay-1',
        },
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-23T10:00:00.000Z',
      },
    ],
    currentLines: [
      {
        id: 'ql-1',
        clientLineId: 'cl-q-1',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel Bar',
        discountTotal: '0',
        discountSnapshot: { itemId: 'itm-1', maxDiscountAmount: '100', maxDiscountPercent: '100', discount: null },
        taxSnapshot: { sku: 'ST', uomCode: 'PCS', itemDisplayName: 'Steel Bar' },
        itemLabel: 'Steel Bar',
        uomId: 'uom-1',
        quantity: '1',
        unitPrice: '100',
        lineTotal: '100',
      },
    ],
    reasonHistory: [],
  };
}

function makeSalesOrderDetail(): SalesOrderDetail {
  return {
    id: 'so-1',
    version: 2,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'SO-2026-0001',
    draftReference: null,
    grandTotal: '100',
    partySnapshot: { id: 'pty-1', displayName: 'Al Noor Trading' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    extensionValues: {},
    confirmationStatus: 'NOT_STARTED',
    holdStatus: 'NONE',
    fulfillmentStatus: 'NONE',
    billingStatus: 'NONE',
    sourceQuotationId: null,
    sourceQuotationRevisionId: null,
    termsSnapshot: null,
    totalsSnapshot: {
      subtotal: '100',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '100',
      amountPaid: '0',
      amountDue: '100',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'sol-1',
        clientLineId: 'cl-so-1',
        itemId: 'itm-1',
        itemLabel: 'Steel Bar',
        uomId: 'uom-1',
        uomLabel: 'PCS',
        itemCompanyProfileId: 'profile-1',
        printLineNumber: 1,
        descriptionSnapshot: 'Steel Bar',
        orderedQuantity: '2',
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '50',
        discountTotal: '0',
        chargeTotal: '0',
        taxTotal: '0',
        lineTotal: '100',
        taxSnapshot: null,
      },
    ],
    reasonHistory: [],
  };
}

function makePurchaseQuotationIssued(): PurchaseQuotationDetail {
  return {
    id: 'pq-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'sup-1',
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'ISSUED',
    documentNumber: 'PQ-2026-0001',
    partySnapshot: { id: 'sup-1', displayName: 'Gulf Steel' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    reference: null,
    notes: null,
    validUntil: null,
    finalizedAt: '2026-11-23T10:00:00.000Z',
    convertedPurchaseOrderId: null,
    termsSnapshot: null,
    totalsSnapshot: {
      subtotal: '100',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '100',
      amountPaid: '0',
      amountDue: '100',
      currencyDecimalPlaces: 2,
    },
    lines: [],
    reasonHistory: [],
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DocumentPage DC-2 write & permission wiring (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let stub: TradeHttpStub;
      let restoreHttp: () => void;
      let routeData$: BehaviorSubject<{ kind: DocumentKind }>;
      let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
      let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        routeData$ = new BehaviorSubject<{ kind: DocumentKind }>({ kind: 'quotation' });
        paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'qt-1' }));
        queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
        me.set(
          makeMe([
            'trade.quotations.read',
            'trade.quotations.create',
            'trade.quotations.update',
            'trade.quotations.send',
            'trade.sales_orders.read',
            'trade.sales_orders.confirm',
            'trade.purchase_quotations.read',
            'trade.purchase_orders.create',
          ]),
        );

        stub = new TradeHttpStub({
          'GET /quotations/qt-1': makeQuotationDetail(),
          'GET /sales-orders/so-1': makeSalesOrderDetail(),
          'GET /purchase-quotations/pq-1': makePurchaseQuotationIssued(),
          'GET /terms/options': { PAYMENT: [], DELIVERY: [], WARRANTY: [], RETURNS: [], GENERAL: [] },
          'GET /quotations/customer-options': { items: [], nextCursor: null },
          'GET /quotations/contact-options': { partyType: 'ORGANIZATION', items: [], nextCursor: null },
          'GET /quotations/discount-policy': {
            hasApplyPermission: false,
            canApply: false,
            canManage: false,
            configured: false,
            limit: null,
          },
          'GET /reasons': { items: [] },
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

      function configureTestingModule(): void {
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
                paramMap: paramMap$.asObservable(),
                queryParamMap: queryParamMap$.asObservable(),
                snapshot: {
                  data: routeData$.value,
                  paramMap: paramMap$.value,
                  queryParamMap: queryParamMap$.value,
                },
              },
            },
            { provide: TenantScopeState, useValue: { me } },
            {
              provide: ScopeState,
              useValue: {
                company: signal({
                  id: 'c1',
                  nameEn: 'Company 1',
                  nameAr: 'شركة 1',
                  branches: [{ id: 'b1', nameEn: 'Branch 1', nameAr: 'فرع 1' }],
                }),
                branch: signal({ id: 'b1', nameEn: 'Branch 1', nameAr: 'فرع 1' }),
                companies: signal([]),
                branches: signal([]),
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: CurrentUser, useValue: { user: signal({ email: 'user@example.com' }) } },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(lang);
      }

      async function renderPage(): Promise<ComponentFixture<DocumentPage>> {
        configureTestingModule();
        const fixture = TestBed.createComponent(DocumentPage);
        fixture.detectChanges();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['loading']()).toBe(false);
        });
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
      }

      it('gates action bar actions from live branchGrants including PQ convert and .update -> .delete fallback', async () => {
        const fixture = await renderPage();
        const actions = fixture.componentInstance['headerActions']().map((item) => item.action);
        expect(actions).toContain('send');
        expect(actions).toContain('deleteDraft');
        expect(actions).not.toContain('cancel');

        me.set(makeMe(['trade.quotations.read']));
        fixture.detectChanges();
        expect(fixture.componentInstance['headerActions']()).toEqual([]);

        routeData$.next({ kind: 'purchase-quotation' });
        paramMap$.next(convertToParamMap({ id: 'pq-1' }));
        me.set(makeMe(['trade.purchase_quotations.read', 'trade.purchase_orders.create']));
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['detail']()?.id).toBe('pq-1');
        });
        const withoutConvert = fixture.componentInstance['headerActions']().map((item) => item.action);
        expect(withoutConvert).not.toContain('convertToPurchaseOrder');
        expect(withoutConvert).not.toContain('createPurchaseOrderDirect');

        me.set(
          makeMe([
            'trade.purchase_quotations.read',
            'trade.purchase_quotations.convert',
            'trade.purchase_orders.create',
          ]),
        );
        fixture.detectChanges();
        const withConvert = fixture.componentInstance['headerActions']().map((item) => item.action);
        expect(withConvert).toContain('convertToPurchaseOrder');
        expect(withConvert).toContain('createPurchaseOrderDirect');
      });

      it('renders forbidden state without error toast when command returns 403 TRADE.AUTH.TARGET_DENIED', async () => {
        stub.register('POST', '/quotations/qt-1/send', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await renderPage();
        await fixture.componentInstance['onActionBarRun']('send');
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);
        expect(el.textContent).toContain(t.translate('tdpg.errors.forbiddenTitle'));
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('renders TR-D9 link to /trade/settings/terms and disables Save when company has zero PAYMENT terms', async () => {
        paramMap$.next(convertToParamMap({}));
        const fixture = await renderPage();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['paymentTermsMissing']()).toBe(true);
        });

        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);
        const link = el.querySelector<HTMLAnchorElement>('a[href="/trade/settings/terms"]');
        expect(link).not.toBeNull();
        expect(link?.textContent?.trim()).toContain(t.translate('tdpg.terms.addPaymentTermsLink'));

        const disabledSave = Array.from(el.querySelectorAll<HTMLButtonElement>('button[disabled]')).find(
          (btn) => btn.textContent?.trim() === t.translate('tdpg.save.create.quotation'),
        );
        expect(disabledSave).toBeTruthy();
        expect(disabledSave?.disabled).toBe(true);
      });

      it('opens ConflictDialog on 409 TRADE.CONCURRENCY.STALE_VERSION command error without error toast', async () => {
        stub.register('POST', '/quotations/qt-1/send', new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await renderPage();
        await fixture.componentInstance['onActionBarRun']('send');
        fixture.detectChanges();

        expect(fixture.componentInstance['conflictOpen']()).toBe(true);
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('handles price lock reload warning, cost unavailable banner, expired toast and inventory line error', async () => {
        const notifyWarn = vi.spyOn(Notify.prototype, 'warning');
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        stub.register('POST', '/quotations/qt-1/send', new ApiError(409, 'TRADE.PRICE.LOCK_EXPIRED'));
        const fixture = await renderPage();
        const t = TestBed.inject(TranslocoService);

        await fixture.componentInstance['onActionBarRun']('send');
        expect(notifyWarn).toHaveBeenCalledWith(t.translate('tdpg.toast.priceLockReload'));

        stub.register('POST', '/quotations/qt-1/send', new ApiError(422, 'TRADE.PRICE.COST_UNAVAILABLE'));
        await fixture.componentInstance['onActionBarRun']('send');
        fixture.detectChanges();
        expect(fixture.componentInstance['itemsBarNote']()).toBe(
          t.translate('tdpg.errors.TRADE.PRICE.COST_UNAVAILABLE'),
        );
        expect(notifyError).toHaveBeenCalledWith(t.translate('tdpg.errors.TRADE.PRICE.COST_UNAVAILABLE'));

        stub.register('POST', '/quotations/qt-1/send', new ApiError(422, 'TRADE.QUOTE.EXPIRED'));
        await fixture.componentInstance['onActionBarRun']('send');
        expect(notifyError).toHaveBeenCalledWith(t.translate('tdpg.errors.TRADE.QUOTE.EXPIRED'));

        routeData$.next({ kind: 'sales-order' });
        paramMap$.next(convertToParamMap({ id: 'so-1' }));
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['detail']()?.id).toBe('so-1');
        });

        stub.register(
          'POST',
          '/sales-orders/so-1/confirm',
          new ApiError(422, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY', { lineIndex: ['0'] }),
        );
        await fixture.componentInstance['executeCommand']('confirm');
        fixture.detectChanges();

        expect(fixture.componentInstance['translatedLineErrors']()['cl-so-1']).toBe(
          t.translate('tdpg.errors.TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY'),
        );
        expect(notifyError).toHaveBeenCalledWith(
          t.translate('tdpg.errors.TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY'),
        );
      });
    });
  }
}
