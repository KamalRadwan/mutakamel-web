import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../public/i18n/ar.json';
import en from '../../../../../public/i18n/en.json';
import arSettings from '../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../public/i18n/settings/en.json';
import arTradeInvEvidence from '../../../../../public/i18n/trade-inventory-evidence/ar.json';
import enTradeInvEvidence from '../../../../../public/i18n/trade-inventory-evidence/en.json';
import arTradeInvMoves from '../../../../../public/i18n/trade-inventory-movements/ar.json';
import enTradeInvMoves from '../../../../../public/i18n/trade-inventory-movements/en.json';
import arTradeInvSetup from '../../../../../public/i18n/trade-inventory-setup/ar.json';
import enTradeInvSetup from '../../../../../public/i18n/trade-inventory-setup/en.json';
import arTradeInvStock from '../../../../../public/i18n/trade-inventory-stock/ar.json';
import enTradeInvStock from '../../../../../public/i18n/trade-inventory-stock/en.json';
import arTradeInvUom from '../../../../../public/i18n/trade-inventory-uom/ar.json';
import enTradeInvUom from '../../../../../public/i18n/trade-inventory-uom/en.json';
import arTradeInv from '../../../../../public/i18n/trade-inventory/ar.json';
import enTradeInv from '../../../../../public/i18n/trade-inventory/en.json';
import arTradeShared from '../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { FullState } from '../../../shared/ui/full-state/full-state';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest, tradeQueries } from '../shared/trade-http';
import { AvailabilityPage } from './availability-page/availability-page';
import { DecisionsPage } from './decisions-page/decisions-page';
import type {
  InventoryDecision,
  LedgerEntry,
  MovementSource,
  SerialUnit,
  UomConversionRevision,
} from './inventory.model';
import { MovementsPage } from './movements-page/movements-page';
import { NodesPage } from './nodes-page/nodes-page';
import { OpeningBalanceModal } from './opening-balance-modal/opening-balance-modal';
import { PeriodsPage } from './periods-page/periods-page';
import { ReverseModal } from './reverse-modal/reverse-modal';
import { SerialsPage } from './serials-page/serials-page';
import { UomConversionsPage } from './uom-conversions-page/uom-conversions-page';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    settings: enSettings,
    tradeShared: enTradeShared,
    tradeInventory: enTradeInv,
    invStock: enTradeInvStock,
    invSetup: enTradeInvSetup,
    invUom: enTradeInvUom,
    invMoves: enTradeInvMoves,
    invEvidence: enTradeInvEvidence,
  },
  ar: {
    ...ar,
    settings: arSettings,
    tradeShared: arTradeShared,
    tradeInventory: arTradeInv,
    invStock: arTradeInvStock,
    invSetup: arTradeInvSetup,
    invUom: arTradeInvUom,
    invMoves: arTradeInvMoves,
    invEvidence: arTradeInvEvidence,
  },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-inventory/en': enTradeInv,
  'trade-inventory/ar': arTradeInv,
  'trade-inventory-stock/en': enTradeInvStock,
  'trade-inventory-stock/ar': arTradeInvStock,
  'trade-inventory-setup/en': enTradeInvSetup,
  'trade-inventory-setup/ar': arTradeInvSetup,
  'trade-inventory-uom/en': enTradeInvUom,
  'trade-inventory-uom/ar': arTradeInvUom,
  'trade-inventory-movements/en': enTradeInvMoves,
  'trade-inventory-movements/ar': arTradeInvMoves,
  'trade-inventory-evidence/en': enTradeInvEvidence,
  'trade-inventory-evidence/ar': arTradeInvEvidence,
};

@Injectable()
class InventoryTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function buildMe(keys: readonly string[], companyIds: string[] = ['c1'], branchIds: string[] = ['b1']): TenantMe {
  const permissionScopes: TenantMe['permissionScopes'] = {};
  for (const key of keys) {
    permissionScopes[key] = { tenantWide: false, companyIds, branchIds };
  }
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    accessibleCompanies: ['c1'],
    accessibleBranches: ['b1', 'b2'],
    accessibleBranchCompanies: [
      { companyId: 'c1', branchId: 'b1' },
      { companyId: 'c1', branchId: 'b2' },
    ],
    permissions: [...keys],
    permissionScopes,
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`Inventory pages & modals (${lang} ${theme})`, () => {
      let stub: TradeHttpStub;
      let dispose: () => void;
      let previousTheme: string | null;
      let previousDir: string;
      let previousLang: string;
      const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
      const originalDialog = {
        showModal: dialogProto['showModal'],
        close: dialogProto['close'],
      };
      const me = signal<TenantMe | null>(
        buildMe([
          'trade.inventory.read',
          'trade.inventory.nodes.manage',
          'trade.inventory.opening_balance',
          'trade.inventory.adjust',
          'trade.inventory.governance.manage',
        ]),
      );

      function setupTestBed(component: unknown): void {
        TestBed.configureTestingModule({
          imports: [component as never],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: InventoryTranslocoLoader,
            }),
            { provide: TenantScopeState, useValue: {
              me,
              selection: signal({ companyId: 'c1', branchId: 'b1' }),
              branchesFor: (companyId: string) => companyId === 'c1' ? ['b1', 'b2'] : [],
              showScopeSwitcher: signal(false),
            } },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });
        TestBed.inject(TranslocoService).setTranslation(TRANSLATIONS[lang], lang);
      }

      beforeEach(() => {
        globalThis.ResizeObserver ??= class {
          observe() {}
          unobserve() {}
          disconnect() {}
        } as never;
        dialogProto['showModal'] = function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        };
        dialogProto['close'] = function (this: HTMLDialogElement) {
          if (!this.hasAttribute('open')) return;
          this.removeAttribute('open');
          this.dispatchEvent(new Event('close'));
        };
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        me.set(
          buildMe([
            'trade.inventory.read',
            'trade.inventory.nodes.manage',
            'trade.inventory.opening_balance',
            'trade.inventory.adjust',
            'trade.inventory.governance.manage',
          ]),
        );

        stub = new TradeHttpStub({
          'GET /inventory/balances': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/nodes': [],
          'GET /inventory/company-nodes': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/periods': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/uom-conversions': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/movements': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/serials': { items: [], total: 0, page: 1, limit: 50 },
          'GET /inventory/decisions': { items: [], total: 0, page: 1, limit: 50 },
          'GET /items': { items: [], total: 0, page: 1, limit: 50 },
          'GET /items/reference-data': { categories: [], taxes: [], uoms: [], owners: [] },
          'GET /reason-codes': { items: [] },
        });
        dispose = bindTradeHttpForTest(stub);
      });

      afterEach(() => {
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        localStorage.removeItem('scope');
        sessionStorage.removeItem('scope');
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      it('renders "—" for nullable join fields in UomConversionsPage and SerialsPage', async () => {
        const nullConv: UomConversionRevision = {
          id: 'conv-null',
          companyId: 'c1',
          itemCompanyProfileId: 'prof-1',
          fromUomId: 'u-box',
          toUomId: 'u-pcs',
          revisionNumber: 1,
          factorNumerator: '12',
          factorDenominator: '1',
          status: 'DRAFT',
          effectiveFrom: '2026-11-01T00:00:00.000Z',
          contentHash: 'h1',
          publishedAt: null,
          publishedBy: null,
          retiredAt: null,
          retiredBy: null,
          version: 1,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          itemId: null,
          itemCode: null,
          itemNames: null,
          fromUomCode: null,
          toUomCode: null,
          publishReasonCode: null,
          retireReasonCode: null,
        };
        stub.register('GET', '/inventory/uom-conversions', {
          items: [nullConv],
          total: 1,
          page: 1,
          limit: 50,
        });
        setupTestBed(UomConversionsPage);
        const uomFixture: ComponentFixture<UomConversionsPage> = TestBed.createComponent(UomConversionsPage);
        uomFixture.detectChanges();
        await vi.waitFor(() => expect(uomFixture.componentInstance['loading']()).toBe(false));
        uomFixture.detectChanges();
        const uomText = (uomFixture.nativeElement as HTMLElement).textContent ?? '';
        expect(uomText).toContain('—');
        expect(uomText).toContain('1 — = 12 —');
        uomFixture.destroy();

        TestBed.resetTestingModule();
        const nullSerial: SerialUnit = {
          id: 'ser-null',
          companyId: 'c1',
          itemId: 'i-1',
          itemCompanyProfileId: 'prof-1',
          serialKey: 'SN-NULL-01',
          state: 'ON_HAND',
          currentFulfillmentNodeId: null,
          currentUomId: null,
          currentReservationId: null,
          firstLedgerEntryId: 'l1',
          currentLedgerEntryId: 'l1',
          lastTransitionAt: '2026-11-20T08:00:00.000Z',
          version: 1,
          itemCode: null,
          itemNames: null,
          currentNodeCode: null,
          currentNodeName: null,
          currentUomCode: null,
        };
        stub.register('GET', '/inventory/serials', {
          items: [nullSerial],
          total: 1,
          page: 1,
          limit: 50,
        });
        setupTestBed(SerialsPage);
        const serFixture: ComponentFixture<SerialsPage> = TestBed.createComponent(SerialsPage);
        serFixture.detectChanges();
        await vi.waitFor(() => expect(serFixture.componentInstance['loading']()).toBe(false));
        serFixture.detectChanges();
        const serText = (serFixture.nativeElement as HTMLElement).textContent ?? '';
        expect(serText).toContain('SN-NULL-01');
        expect(serText).toContain('—');
        serFixture.destroy();
      });

      it('renders "—" when result.outcome is missing and fallback label for unknown aggregateType on DecisionsPage', async () => {
        const decision: InventoryDecision = {
          id: 'dec-missing-outcome',
          decisionType: 'INVENTORY_NEGATIVE',
          aggregateType: 'CUSTOM_UNKNOWN' as never,
          aggregateId: '01935008-9827-71ac-8815-c0ac81c3e2dd',
          companyId: 'c1',
          branchId: 'b1',
          policyVersions: [
            {
              type: 'POLICY_VERSION',
              policyKind: 'INVENTORY_NEGATIVE',
              definitionId: 'def-1',
              definitionCode: 'NEG_POLICY',
              id: 'ver-1',
              version: 1,
              contentHash: 'hash',
              registryVersion: '1',
            },
          ],
          matchedRules: [],
          result: { selectedValue: null },
          explanation: 'Fallback explanation',
          evaluatedAt: '2026-11-20T08:00:00.000Z',
          correlationId: 'corr-1',
        };
        stub.register('GET', '/inventory/decisions', {
          items: [decision],
          total: 1,
          page: 1,
          limit: 50,
        });
        setupTestBed(DecisionsPage);
        const fixture = TestBed.createComponent(DecisionsPage);
        fixture.detectChanges();
        await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
        fixture.detectChanges();

        expect(fixture.componentInstance['outcomeBadgeValue'](decision)).toBeNull();
        expect(fixture.componentInstance['aggregateTypeLabel'](decision.aggregateType)).toBe(
          (TRANSLATIONS[lang]['invEvidence'] as Record<string, Record<string, string>>)['aggregateTypes'][
            'unknown'
          ],
        );
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('—');
        expect(text).toContain(
          (TRANSLATIONS[lang]['invEvidence'] as Record<string, Record<string, string>>)['aggregateTypes'][
            'unknown'
          ],
        );
        fixture.destroy();
      });

      it('maps NODE_INVALID, ITEM_TRACKING_CONFLICT and INSUFFICIENT_AVAILABILITY to their fields on OpeningBalanceModal and ReverseModal, preserving hints', async () => {
        stub.register('GET', '/inventory/nodes', [
          {
            id: 'node-1',
            companyId: 'c1',
            code: 'WH-1',
            name: 'Main',
            nodeType: 'WAREHOUSE',
            status: 'ACTIVE',
            timezone: 'UTC',
            version: 1,
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            createdBy: null,
            updatedBy: null,
          },
        ]);
        stub.register('GET', '/items/:id', {
          id: 'item-1',
          canonicalCode: 'ITM-1',
          localizedNames: { en: 'Water', ar: 'ماء' },
          baseUomId: 'uom-1',
          itemKind: 'PRODUCT',
          status: 'ACTIVE',
          companyProfile: {
            id: 'prof-1',
            companyId: 'c1',
            trackInventory: true,
            trackingMode: 'NONE',
            version: 1,
            defaultSalesUomId: null,
            defaultPurchaseUomId: null,
          },
        });
        stub.register('GET', '/catalog/uoms', {
          items: [
            {
              id: 'uom-1',
              code: 'PCS',
              displayName: 'Piece',
              localizedNames: { en: 'Piece', ar: 'قطعة' },
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          limit: 100,
        });

        setupTestBed(OpeningBalanceModal);
        const obFixture = TestBed.createComponent(OpeningBalanceModal);
        const ob = obFixture.componentInstance;
        ob.open({ nodeId: 'node-1', itemId: 'item-1' });
        obFixture.detectChanges();
        await vi.waitFor(() => expect(ob['nodesLoading']()).toBe(false));
        await vi.waitFor(() => expect(ob['itemLoading']()).toBe(false));
        obFixture.detectChanges();

        const fields = (obFixture.nativeElement as HTMLElement).querySelectorAll('ui-field');
        expect(fields.length).toBeGreaterThan(0);
        for (const field of Array.from(fields)) {
          expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
        }

        ob['quantity'].set('5');
        stub.register('POST', '/inventory/opening-balances', new ApiError(422, 'TRADE.INVENTORY.NODE_INVALID'));
        await ob['submit']();
        expect(ob['nodeError']()).toContain(
          (TRANSLATIONS[lang]['tradeInventory'] as Record<string, Record<string, string>>)['errors'][
            'TRADE_INVENTORY_NODE_INVALID'
          ],
        );

        stub.register(
          'POST',
          '/inventory/opening-balances',
          new ApiError(422, 'TRADE.INVENTORY.ITEM_TRACKING_CONFLICT'),
        );
        await ob['submit']();
        expect(ob['itemError']()).toContain(
          (TRANSLATIONS[lang]['tradeInventory'] as Record<string, Record<string, string>>)['errors'][
            'TRADE_INVENTORY_ITEM_TRACKING_CONFLICT'
          ],
        );

        stub.register(
          'POST',
          '/inventory/opening-balances',
          new ApiError(409, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY'),
        );
        await ob['submit']();
        expect(ob['quantityError']()).toContain(
          (TRANSLATIONS[lang]['tradeInventory'] as Record<string, Record<string, string>>)['errors'][
            'TRADE_INVENTORY_INSUFFICIENT_AVAILABILITY'
          ],
        );
        ob.close();
        obFixture.destroy();

        TestBed.resetTestingModule();
        stub.register('GET', '/reason-codes', {
          items: [
            {
              id: 'r1',
              code: 'DAMAGED',
              kind: 'INVENTORY_REVERSAL',
              localizedNames: { en: 'Damaged', ar: 'تالف' },
              requiresNote: false,
              isActive: true,
              version: 1,
            },
          ],
        });
        const source: MovementSource = {
          id: 'rcpt-1',
          kind: 'RECEIPT',
          status: 'POSTED',
          branchId: 'b1',
          fulfillmentNodeId: 'node-1',
          nodeCode: 'WH-1',
          nodeName: 'Main',
          documentId: 'doc-1',
          documentNumber: 'RC-1',
          operationKey: '01900000-0000-7000-8000-000000000001',
          businessEffectiveAt: '2026-11-20T08:00:00.000Z',
          postedAt: '2026-11-20T08:00:00.000Z',
          inventoryPeriodId: 'per-1',
          policyDecisionReceiptId: null,
          lineCount: 1,
          version: 1,
          createdAt: '2026-11-20T08:00:00.000Z',
          createdBy: null,
          lines: [
            {
              id: 'line-1',
              documentLineId: 'dl-1',
              itemCompanyProfileId: 'prof-1',
              itemId: 'item-1',
              itemCode: 'ITM-1',
              itemNames: { en: 'Water', ar: 'ماء' },
              uomId: 'uom-1',
              uomCode: 'PCS',
              quantity: '10',
              normalizedUomId: 'uom-1',
              normalizedUomCode: 'PCS',
              normalizedQuantity: '10',
              reversedQuantity: '0',
              normalizedReversedQuantity: '0',
              descriptionSnapshot: null,
              tracking: {},
              reversedSerialKeys: [],
              ledgerEntryId: 'l1',
              policyDecisionReceiptId: null,
              version: 1,
            },
          ],
        };
        const entry = {
          id: 'l1',
          movementType: 'PURCHASE_RECEIPT',
          sourceType: 'RECEIPT',
          sourceId: 'rcpt-1',
          sourceNumber: 'RC-1',
        } as LedgerEntry;
        stub.register('GET', '/inventory/receipts/:id', source);
        stub.register(
          'POST',
          '/inventory/receipts/:id/reverse',
          new ApiError(409, 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY'),
        );

        setupTestBed(ReverseModal);
        const revFixture = TestBed.createComponent(ReverseModal);
        const rev = revFixture.componentInstance;
        rev.open(entry);
        revFixture.detectChanges();
        await vi.waitFor(() => expect(rev['loadingSource']()).toBe(false));
        rev['reason'].set({ reasonCodeId: 'r1', note: '' });
        revFixture.detectChanges();
        await vi.waitFor(() => expect(rev['pickerValid']()).toBe(true));
        await rev['submit']();
        expect(rev['reverseAllRemaining']()).toBe(false);
        expect(rev['lineQuantityError'](rev['reversibleLines']()[0])).toContain(
          (TRANSLATIONS[lang]['tradeInventory'] as Record<string, Record<string, string>>)['errors'][
            'TRADE_INVENTORY_INSUFFICIENT_AVAILABILITY'
          ],
        );
        rev.closeSilently();
        revFixture.destroy();
      });

      it('maps real UoM conversion error codes (UOM_CONVERSION_INVALID and 404 SCOPE_NOT_FOUND) without using fake NOT_FOUND', async () => {
        const rev: UomConversionRevision = {
          id: 'conv-1',
          companyId: 'c1',
          itemCompanyProfileId: 'prof-1',
          fromUomId: 'u-box',
          toUomId: 'u-pcs',
          revisionNumber: 1,
          factorNumerator: '12',
          factorDenominator: '1',
          status: 'DRAFT',
          effectiveFrom: '2026-11-01T00:00:00.000Z',
          contentHash: 'h1',
          publishedAt: null,
          publishedBy: null,
          retiredAt: null,
          retiredBy: null,
          version: 1,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          itemId: 'i1',
          itemCode: 'ITM-1',
          itemNames: { en: 'Item', ar: 'صنف' },
          fromUomCode: 'BOX',
          toUomCode: 'PCS',
          publishReasonCode: null,
          retireReasonCode: null,
        };
        stub.register('GET', '/inventory/uom-conversions', {
          items: [rev],
          total: 1,
          page: 1,
          limit: 50,
        });
        setupTestBed(UomConversionsPage);
        const fixture = TestBed.createComponent(UomConversionsPage);
        const page = fixture.componentInstance;
        fixture.detectChanges();
        await vi.waitFor(() => expect(page['loading']()).toBe(false));

        page['reasonAction'].set({
          kind: 'INVENTORY_UOM_PUBLISH',
          mode: 'publish',
          row: rev,
          predecessorRevision: null,
        });
        stub.register(
          'POST',
          '/inventory/uom-conversions/:id/publish',
          new ApiError(422, 'TRADE.INVENTORY.UOM_CONVERSION_INVALID', {
            reason: ['effective_from_not_after_predecessor'],
          }),
        );
        await page['onReasonConfirmed']('PACK');
        expect(page['transitionAlertKey']()).toBe(
          'invUom.transitionAlert.EFFECTIVE_FROM_NOT_AFTER_PREDECESSOR',
        );

        const errSpy = vi.spyOn(TestBed.inject(Notify), 'error');
        page['reasonAction'].set({
          kind: 'INVENTORY_UOM_PUBLISH',
          mode: 'publish',
          row: rev,
          predecessorRevision: null,
        });
        stub.register(
          'POST',
          '/inventory/uom-conversions/:id/publish',
          new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND'),
        );
        await page['onReasonConfirmed']('PACK');
        expect(errSpy).toHaveBeenCalledWith(
          (TRANSLATIONS[lang]['tradeInventory'] as Record<string, Record<string, string>>)['errors'][
            'TRADE_INVENTORY_SCOPE_NOT_FOUND'
          ],
        );
        fixture.destroy();
      });

      it('enforces read/write permissions and handles server 403 across all 7 inventory pages without error toasts', async () => {
        me.set(buildMe([]));
        const pages = [
          AvailabilityPage,
          NodesPage,
          PeriodsPage,
          UomConversionsPage,
          MovementsPage,
          SerialsPage,
          DecisionsPage,
        ] as const;

        for (const Comp of pages) {
          setupTestBed(Comp);
          const f = TestBed.createComponent(Comp as never);
          f.detectChanges();
          const fullState = f.debugElement.query(By.directive(FullState))?.componentInstance as
            | FullState
            | undefined;
          expect(fullState?.kind()).toBe('forbidden');
          expect(stub.recordedReads()).toHaveLength(0);
          f.destroy();
          TestBed.resetTestingModule();
        }

        me.set(buildMe(['trade.inventory.read']));
        for (const [Comp, flags] of [
          [AvailabilityPage, ['canOpening']],
          [NodesPage, ['canManage']],
          [PeriodsPage, ['canGovern']],
          [UomConversionsPage, ['canGovern']],
          [MovementsPage, ['canOpening', 'canAdjust']],
        ] as const) {
          setupTestBed(Comp);
          const fixture = TestBed.createComponent(Comp as never);
          fixture.detectChanges();
          for (const flag of flags) {
            expect((fixture.componentInstance as Record<string, () => boolean>)[flag]()).toBe(false);
          }
          fixture.destroy();
          TestBed.resetTestingModule();
          tradeQueries().clear();
        }

        for (const [Comp, path] of [
          [AvailabilityPage, '/inventory/balances'],
          [NodesPage, '/inventory/company-nodes'],
          [PeriodsPage, '/inventory/periods'],
          [UomConversionsPage, '/inventory/uom-conversions'],
          [MovementsPage, '/inventory/movements'],
          [SerialsPage, '/inventory/serials'],
          [DecisionsPage, '/inventory/decisions'],
        ] as const) {
          stub.register('GET', path, new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
          setupTestBed(Comp);
          const errSpy = vi.spyOn(TestBed.inject(Notify), 'error');
          const fixture = TestBed.createComponent(Comp as never);
          fixture.detectChanges();
          const instance = fixture.componentInstance as Record<string, () => boolean>;
          await vi.waitFor(() => expect(instance['loading']()).toBe(false));
          fixture.detectChanges();
          const state = fixture.debugElement.query(By.directive(FullState))?.componentInstance as FullState | undefined;
          expect(state?.kind()).toBe('forbidden');
          expect(instance['loadFailed']()).toBe(false);
          expect(errSpy).not.toHaveBeenCalled();
          fixture.destroy();
          TestBed.resetTestingModule();
          tradeQueries().clear();
        }
      });
    });
  }
}
