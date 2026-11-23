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
import type { DocumentKind, PurchaseQuotationDetail, QuotationDetail, SalesOrderDetail } from '../shared/document.model';
import { emptyDraft } from './document-draft';
import { DocumentPage } from './document-page';
import { HeaderFields } from './header-fields/header-fields';

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
    grandTotal: '200',
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
      subtotal: '200',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '0',
      roundingTotal: '0',
      grandTotal: '200',
      amountPaid: '0',
      amountDue: '200',
      currencyDecimalPlaces: 2,
    },
    lines: [
      {
        id: 'sol-1',
        clientLineId: 'cl-so-1',
        itemCompanyProfileId: 'cp-hidden-uuid',
        printLineNumber: 1,
        descriptionSnapshot: null,
        uomId: 'uom-1',
        uomLabel: '',
        orderedQuantity: '2',
        allocatedQuantity: '0',
        fulfilledQuantity: '0',
        invoicedQuantity: '0',
        cancelledQuantity: '0',
        unitPrice: '100',
        discountTotal: null,
        chargeTotal: null,
        taxTotal: null,
        lineTotal: '200',
        taxSnapshot: null,
        itemLabel: '',
      },
    ],
    reasonHistory: [],
  };
}

function makeQuotationWithLineDiscount(): QuotationDetail {
  return {
    id: 'qt-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'DRAFT',
    documentNumber: 'QT-2026-0001',
    draftReference: null,
    grandTotal: '1000',
    partySnapshot: { id: 'pty-1', displayName: 'Al Noor Trading' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: null,
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: null,
    revisions: [
      {
        id: 'rev-1',
        version: 1,
        quotationId: 'qt-1',
        revisionNumber: 1,
        status: 'DRAFT',
        validUntil: '2026-12-31',
        subtotal: '1000',
        discountTotal: '0',
        grandTotal: '1000',
        pricingMode: 'DISCOUNT',
        discountSnapshot: {
          pricing: { mode: 'DISCOUNT', scope: 'LINE' },
          currencyDecimalPlaces: 2,
        },
        termsSnapshot: { schemaVersion: 2, selections: [] },
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-23T10:00:00.000Z',
      },
    ],
    currentLines: [],
    reasonHistory: [],
  };
}

function makePqWithoutDecimals(): PurchaseQuotationDetail {
  return {
    id: 'pq-1',
    version: 1,
    companyId: 'c1',
    branchId: 'b1',
    partyId: 'sup-1',
    currencyCode: 'KWD',
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
    },
    lines: [],
    reasonHistory: [],
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`DocumentPage read paths & HeaderFields (${lang} ${theme})`, () => {
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

        routeData$ = new BehaviorSubject<{ kind: DocumentKind }>({ kind: 'sales-order' });
        paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'so-1' }));
        queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
        me.set(
          makeMe([
            'trade.sales_orders.read',
            'trade.quotations.read',
            'trade.quotations.create',
            'trade.quotations.update',
            'trade.purchase_quotations.read',
          ]),
        );

        stub = new TradeHttpStub({
          'GET /sales-orders/so-1': makeSalesOrderDetail(),
          'GET /terms/options': { PAYMENT: [], DELIVERY: [], WARRANTY: [], RETURNS: [], GENERAL: [] },
          'GET /quotations/customer-options': {
            items: [
              {
                partyId: 'pty-ok',
                displayName: 'Eligible Org',
                crmStatus: 'ACTIVE',
                commercialAccountStatus: 'ACTIVE',
                eligibilitySource: 'COMMERCIAL_ACCOUNT',
              },
              {
                partyId: 'pty-blocked',
                displayName: 'Blocked Org',
                crmStatus: 'INACTIVE',
                commercialAccountStatus: 'BLOCKED',
                eligibilitySource: 'COMMERCIAL_ACCOUNT',
                denialCode: 'TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED',
              },
            ],
            nextCursor: null,
          },
          'GET /quotations/contact-options': {
            partyType: 'ORGANIZATION',
            items: [
              {
                partyId: 'cnt-1',
                displayName: 'Sara Ali',
                relationshipType: 'BILLING_CONTACT',
                relationshipLabel: null,
                isPrimary: true,
                email: null,
                mobile: null,
                phone: null,
              },
            ],
            nextCursor: null,
          },
          'GET /quotations/discount-policy': {
            hasApplyPermission: true,
            canApply: true,
            canManage: false,
            configured: false,
            limit: null,
          },
          'GET /quotations/qt-1': makeQuotationWithLineDiscount(),
          'GET /purchase-quotations/pq-1': makePqWithoutDecimals(),
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
                company: signal({ id: 'c1', nameEn: 'Company 1', nameAr: 'شركة 1', branches: [{ id: 'b1', nameEn: 'Branch 1', nameAr: 'فرع 1' }] }),
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

      it('renders forbidden state when read grant is absent without issuing requests', async () => {
        me.set(makeMe([]));
        const fixture = await renderPage();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain(t.translate('tdpg.errors.forbiddenTitle'));
        expect(stub.recordedReads()).toEqual([]);
      });

      it('renders forbidden state on server 403 without error toast', async () => {
        stub.register('GET', '/sales-orders/so-1', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const notifyError = vi.spyOn(Notify.prototype, 'error');

        const fixture = await renderPage();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain(t.translate('tdpg.errors.forbiddenTitle'));
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('shows "—" instead of itemCompanyProfileId for SO lines without itemLabel (D-1) and makes 0 item lookups', async () => {
        const fixture = await renderPage();
        const el = fixture.nativeElement as HTMLElement;

        expect(el.textContent).toContain('SO-2026-0001');
        expect(el.textContent).not.toContain('cp-hidden-uuid');
        expect(stub.recordedReads().filter((r) => r.path.startsWith('/items') || r.path.startsWith('/catalog'))).toEqual([]);
      });

      it('renders no-limit items note when discountPolicy.limit is null (D-5)', async () => {
        routeData$.next({ kind: 'quotation' });
        paramMap$.next(convertToParamMap({ id: 'qt-1' }));

        const fixture = await renderPage();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain(t.translate('tdpg.itemsNote.lineDiscountNoLimit'));
      });

      it('falls back to unknownStatus when document lifecycleStatus is unrecognized', async () => {
        stub.register('GET', '/sales-orders/so-1', {
          ...makeSalesOrderDetail(),
          lifecycleStatus: 'FUTURE_STATE' as never,
        });

        const fixture = await renderPage();
        const el = fixture.nativeElement as HTMLElement;
        const t = TestBed.inject(TranslocoService);

        expect(el.textContent).toContain(t.translate('td.common.unknownStatus'));
        expect(el.textContent).not.toContain('td.status.FUTURE_STATE');
      });

      it('falls back to currency decimal places when PQ totalsSnapshot omits currencyDecimalPlaces (D-10)', async () => {
        routeData$.next({ kind: 'purchase-quotation' });
        paramMap$.next(convertToParamMap({ id: 'pq-1' }));

        const fixture = await renderPage();
        expect(fixture.componentInstance['activeCurrencyDecimalPlaces']()).toBe(3);
      });

      it('disables customer options with denialCode and handles Trade D-4 contact-options + PERSON', async () => {
        configureTestingModule();
        const fixture = TestBed.createComponent(HeaderFields);
        fixture.componentRef.setInput('kind', 'quotation');
        fixture.componentRef.setInput('mode', 'new');
        fixture.componentRef.setInput('draft', emptyDraft('quotation'));
        fixture.detectChanges();

        const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
        trigger?.click();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['customers']().length).toBe(2);
        });

        const t = TestBed.inject(TranslocoService);
        const menuText = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(menuText).toContain('Blocked Org');
        expect(menuText).toContain(t.translate('td.errors.TRADE.QUOTE.COMMERCIAL_ACCOUNT_BLOCKED'));

        const blockedBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li[role="option"] button'))[1] as HTMLButtonElement;
        expect(blockedBtn.disabled).toBe(true);

        const okBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li[role="option"] button'))[0] as HTMLButtonElement;
        okBtn.click();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['contacts']().length).toBe(1);
        });

        expect(stub.recordedReads().some((r) => r.path === '/quotations/contact-options')).toBe(true);
        expect(fixture.componentInstance['contactOptions']()).toEqual([
          {
            value: 'cnt-1',
            label: `Sara Ali — ${t.translate('tdpg.fields.contactRole.BILLING_CONTACT')}`,
          },
        ]);

        // Switch response to PERSON partyType and reload customer contacts
        stub.register('GET', '/quotations/contact-options', {
          partyType: 'PERSON',
          items: [],
          nextCursor: null,
        });
        fixture.componentInstance['retryContacts']();
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['isPersonCustomer']()).toBe(true);
        });
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          t.translate('tdpg.fields.contactNotNeeded'),
        );
      });
    });
  }
}
