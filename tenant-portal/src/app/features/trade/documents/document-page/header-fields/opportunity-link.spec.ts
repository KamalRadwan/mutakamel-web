import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../../public/i18n/ar.json';
import en from '../../../../../../../public/i18n/en.json';
import arTradeDocuments from '../../../../../../../public/i18n/trade-documents/ar.json';
import enTradeDocuments from '../../../../../../../public/i18n/trade-documents/en.json';
import arLines from '../../../../../../../public/i18n/trade-documents-lines/ar.json';
import enLines from '../../../../../../../public/i18n/trade-documents-lines/en.json';
import arPage from '../../../../../../../public/i18n/trade-documents-page/ar.json';
import enPage from '../../../../../../../public/i18n/trade-documents-page/en.json';
import arTradeShared from '../../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import { CurrentUser } from '../../../../../core/auth/current-user';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../../../../crm/shared/crm-http';
import { CrmHttpStub } from '../../../../crm/shared/testing/crm-http-testing';
import { bindTradeHttpForTest } from '../../../shared/trade-http';
import { TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import type { DocumentKind, QuotationDetail, SalesOrderDetail } from '../../shared/document.model';
import { emptyDraft } from '../document-draft';
import { DocumentPage } from '../document-page';
import { HeaderFields } from './header-fields';

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

function makeQuotation(overrides: Record<string, unknown> = {}): QuotationDetail {
  return {
    id: 'qt-1',
    version: 1,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
    partyId: 'pty-1',
    contactPartyId: null,
    currencyCode: 'EGP',
    businessDate: '2026-11-23',
    lifecycleStatus: 'SENT',
    documentNumber: 'QT-2026-0001',
    draftReference: null,
    grandTotal: '100',
    partySnapshot: { id: 'pty-1', displayName: 'Al Noor Trading' },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    extensionValues: {},
    currentRevisionId: 'rev-1',
    acceptedRevisionId: null,
    crmCustomerProfileId: 'prof-1',
    approvalStatus: 'NOT_REQUIRED',
    sourceCrmOpportunityId: 'opp-1',
    revisions: [
      {
        id: 'rev-1',
        version: 1,
        quotationId: 'qt-1',
        revisionNumber: 1,
        status: 'SENT',
        validUntil: '2026-12-31',
        subtotal: '100',
        discountTotal: '0',
        grandTotal: '100',
        pricingMode: 'NONE',
        discountSnapshot: { pricing: { mode: 'NONE' }, currencyDecimalPlaces: 2 },
        termsSnapshot: { schemaVersion: 2, selections: [] },
        sentAt: '2026-11-23T10:00:00.000Z',
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
        createdAt: '2026-11-23T10:00:00.000Z',
      },
    ],
    currentLines: [],
    reasonHistory: [],
    ...overrides,
  } as QuotationDetail;
}

function makeSalesOrder(overrides: Record<string, unknown> = {}): SalesOrderDetail {
  return {
    id: 'so-1',
    version: 1,
    companyId: CTX.companyId,
    branchId: CTX.branchId,
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
    sourceQuotationId: 'qt-1',
    sourceQuotationRevisionId: 'rev-1',
    termsSnapshot: null,
    totalsSnapshot: null,
    lines: [],
    reasonHistory: [],
    ...overrides,
  } as SalesOrderDetail;
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`Opportunity picker & badge (${lang} ${theme})`, () => {
      const me = signal<TenantMe | null>(null);
      let tradeStub: TradeHttpStub;
      let crmStub: CrmHttpStub;
      let restoreTrade: () => void;
      let restoreCrm: () => void;
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
        me.set(makeMe(['trade.quotations.read', 'trade.quotations.update', 'trade.sales_orders.read']));

        tradeStub = new TradeHttpStub({
          'GET /terms/options': { byType: { PAYMENT: [], DELIVERY: [], WARRANTY: [], RETURNS: [], GENERAL: [] } },
          'GET /quotations/customer-options': { items: [], nextCursor: null },
          'GET /quotations/contact-options': { partyType: 'ORGANIZATION', items: [], nextCursor: null },
          'GET /quotations/discount-policy': {
            hasApplyPermission: false,
            canApply: false,
            canManage: false,
            configured: false,
            limit: null,
          },
          'GET /quotations/qt-1': makeQuotation(),
          'GET /sales-orders/so-1': makeSalesOrder(),
        });
        crmStub = new CrmHttpStub({
          '/opportunities': {
            items: [{ id: 'opp-1', title: 'Enterprise Deal', status: 'IN_PROGRESS' }],
            total: 1,
            page: 1,
            limit: 100,
          },
        });
        restoreTrade = bindTradeHttpForTest(tradeStub);
        restoreCrm = bindCrmHttpForTest(crmStub);

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
                company: signal({ id: CTX.companyId, nameEn: 'Co', nameAr: 'شركة', branches: [] }),
                branch: signal({ id: CTX.branchId, nameEn: 'Br', nameAr: 'فرع' }),
                companies: signal([]),
                branches: signal([]),
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: CurrentUser, useValue: { user: signal({ email: 'user@example.com' }) } },
          ],
        });
        TestBed.inject(TranslocoService).setActiveLang(lang);
      });

      afterEach(() => {
        TestBed.resetTestingModule();
        restoreTrade();
        restoreCrm();
        vi.restoreAllMocks();
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      async function renderPage(): Promise<ComponentFixture<DocumentPage>> {
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

      it('shows picker permission hint on 403 from CRM /opportunities without error toast', async () => {
        const notifyError = vi.spyOn(Notify.prototype, 'error');
        vi.spyOn(crmStub, 'read').mockRejectedValue(new CoreApiError(403, 'FORBIDDEN'));

        const fixture = TestBed.createComponent(HeaderFields);
        const draft = emptyDraft('quotation');
        draft.header = { ...draft.header, partyId: 'pty-1', crmCustomerProfileId: 'prof-1' };
        fixture.componentRef.setInput('kind', 'quotation');
        fixture.componentRef.setInput('mode', 'new');
        fixture.componentRef.setInput('draft', draft);
        fixture.detectChanges();

        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['opportunitiesForbidden']()).toBe(true);
        });

        const t = TestBed.inject(TranslocoService);
        const oppTrigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
          'button[id$="-sourceCrmOpportunityId"]',
        );
        oppTrigger?.click();
        fixture.detectChanges();

        const elText = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(elText).toContain(t.translate('tdpg.fields.opportunityPermissionHint'));
        expect(notifyError).not.toHaveBeenCalled();
      });

      it('renders opportunity badge name from BE-TR-OPP sourceCrmOpportunity on quotation and sales-order without getOpportunity call', async () => {
        tradeStub.register(
          'GET',
          '/quotations/qt-1',
          makeQuotation({
            sourceCrmOpportunity: {
              id: 'opp-1',
              name: 'Enterprise Deal',
              stageName: { en: 'Proposal', ar: 'عرض' },
              available: true,
            },
          }),
        );

        const fixture = await renderPage();
        fixture.componentInstance['resolvedHeaderOpportunity'].set({
          id: 'opp-1', name: 'Picker name must not override the projection', stageName: '', status: 'IN_PROGRESS',
        });
        fixture.detectChanges();
        const badge = (fixture.nativeElement as HTMLElement).querySelector('a[href="/crm/opportunities/opp-1"]');
        expect(badge?.textContent?.trim()).toBe('Enterprise Deal');
        expect(crmStub.recordedReads()).toEqual([]);

        routeData$.next({ kind: 'sales-order' });
        paramMap$.next(convertToParamMap({ id: 'so-1' }));
        tradeStub.register(
          'GET',
          '/sales-orders/so-1',
          makeSalesOrder({
            sourceCrmOpportunity: {
              id: 'opp-so-1',
              name: 'Order Linked Deal',
              available: true,
            },
          }),
        );
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['detail']()?.id).toBe('so-1');
        });
        const soBadge = (fixture.nativeElement as HTMLElement).querySelector('a[href="/crm/opportunities/opp-so-1"]');
        expect(soBadge?.textContent?.trim()).toBe('Order Linked Deal');
      });

      it('shows "Linked opportunity" when sourceCrmOpportunity is available:false or absent (pre BE-TR-OPP)', async () => {
        const t = TestBed.inject(TranslocoService);
        tradeStub.register(
          'GET',
          '/quotations/qt-1',
          makeQuotation({ sourceCrmOpportunity: { id: 'opp-1', available: false } }),
        );
        const fixture = await renderPage();
        const unavailableBadge = (fixture.nativeElement as HTMLElement).querySelector('a[href="/crm/opportunities/opp-1"]');
        expect(unavailableBadge?.textContent?.trim()).toBe(t.translate('tdpg.header.linkedOpportunity'));

        tradeStub.register('GET', '/quotations/qt-2', makeQuotation({ id: 'qt-2' }));
        paramMap$.next(convertToParamMap({ id: 'qt-2' }));
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(fixture.componentInstance['detail']()?.id).toBe('qt-2');
        });
        const preOppBadge = (fixture.nativeElement as HTMLElement).querySelector('a[href="/crm/opportunities/opp-1"]');
        expect(preOppBadge?.textContent?.trim()).toBe(t.translate('tdpg.header.linkedOpportunity'));
      });
    });
  }
}
