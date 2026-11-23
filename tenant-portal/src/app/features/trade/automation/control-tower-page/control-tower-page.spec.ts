import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arTradeAutoTower from '../../../../../../public/i18n/trade-auto-tower/ar.json';
import enTradeAutoTower from '../../../../../../public/i18n/trade-auto-tower/en.json';
import arTradeAutomation from '../../../../../../public/i18n/trade-automation/ar.json';
import enTradeAutomation from '../../../../../../public/i18n/trade-automation/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Dropdown } from '../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ApiError } from '../../shared/trade-api';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import type { TowerCounts, TowerException, TowerExceptionPage } from '../tower.model';
import { ControlTowerPage } from './control-tower-page';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID_1 = '018f0000-0000-7000-8000-000000000001';
const BRANCH_ID_2 = '018f0000-0000-7000-8000-000000000002';
const EXC_ID = '0193a000-0000-7000-8000-000000000101';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    settings: enSettings,
    tradeShared: enTradeShared,
    automation: enTradeAutomation,
    tower: enTradeAutoTower,
  },
  ar: {
    ...ar,
    settings: arSettings,
    tradeShared: arTradeShared,
    automation: arTradeAutomation,
    tower: arTradeAutoTower,
  },
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-automation/en': enTradeAutomation,
  'trade-automation/ar': arTradeAutomation,
  'trade-auto-tower/en': enTradeAutoTower,
  'trade-auto-tower/ar': arTradeAutoTower,
};

@Injectable()
class TowerTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeException(overrides: Partial<TowerException> = {}): TowerException {
  return {
    id: EXC_ID,
    version: 1,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID_1,
    sourceOwner: 'TRADE',
    sourceType: 'OWNER_TRANSPORT_EXHAUSTED' === overrides.category ? 'BUSINESS_PDF_RENDER' : 'QUOTATION_PDF_RENDER',
    sourceId: '0193a000-0000-7000-8000-000000000201',
    sourceVersion: 1,
    category: 'OWNER_TRANSPORT_EXHAUSTED',
    severity: 'CRITICAL',
    status: 'OPEN',
    retryClass: 'TRANSIENT',
    safeErrorCode: 'TRADE.OWNER.TRANSPORT_TIMEOUT',
    intentKey: null,
    correlationId: 'corr-ct-001',
    assignedUserId: null,
    resolvedAt: null,
    resolutionReasonCode: null,
    source: {
      type: 'QUOTATION_PDF_RENDER',
      id: '0193a000-0000-7000-8000-000000000201',
      label: 'QT-2026-0142',
      documentType: 'QUOTATION',
      documentNumber: 'QT-2026-0142',
      link: { kind: 'QUOTATION', id: '0193a000-0000-7000-8000-000000000301' },
    },
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeCounts(total = 1): TowerCounts {
  return {
    total,
    byStatus: {
      OPEN: total,
      ACKNOWLEDGED: 0,
      ACTION_PENDING: 0,
      RECONCILIATION_PENDING: 0,
      RESOLVED: 0,
      QUARANTINED: 0,
    },
    bySeverity: { INFO: 0, WARNING: 0, HIGH: 0, CRITICAL: total },
    byCategory: {
      PROFILE_ACTIVATION_CONFLICT: 0,
      RESULT_CONFLICT: 0,
      OWNER_TRANSPORT_EXHAUSTED: total,
      DATA_CORRECTION_REQUIRED: 0,
    },
    resolvedToday: 0,
  };
}

function makePage(items: TowerException[] = [makeException()]): TowerExceptionPage {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 24,
    asOf: '2026-11-23T12:00:00.000Z',
  };
}

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ControlTowerPage (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ControlTowerPage>;
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
      const me = signal<TenantMe | null>(FAKE_TENANT_ME);
      const selection = signal<{ companyId: string; branchId: string | null } | null>({
        companyId: COMPANY_ID,
        branchId: null,
      });

      const companyBranches = [
        { id: BRANCH_ID_1, nameEn: 'Cairo Branch', nameAr: 'فرع القاهرة' },
        { id: BRANCH_ID_2, nameEn: 'Alex Branch', nameAr: 'فرع الإسكندرية' },
      ];

      function setPermissions(options: { read?: boolean; resolve?: boolean } = {}): void {
        const { read = true, resolve = true } = options;
        const permissions: string[] = [];
        const permissionScopes: TenantMe['permissionScopes'] = {};

        if (read) {
          permissions.push('trade.control_tower.read');
          permissionScopes['trade.control_tower.read'] = {
            tenantWide: true,
            companyIds: [COMPANY_ID],
            branchIds: [BRANCH_ID_1, BRANCH_ID_2],
          };
        }
        if (resolve) {
          permissions.push('trade.control_tower.resolve');
          permissionScopes['trade.control_tower.resolve'] = {
            tenantWide: true,
            companyIds: [COMPANY_ID],
            branchIds: [BRANCH_ID_1, BRANCH_ID_2],
          };
        }

        me.set({
          ...FAKE_TENANT_ME,
          isTenantOwner: false,
          permissions,
          permissionScopes,
        });
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
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        previousLang = document.documentElement.lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', theme);

        setPermissions();
        stub = new TradeHttpStub({
          'GET /control-tower/exceptions/counts': makeCounts(1),
          'GET /control-tower/exceptions': makePage(),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ControlTowerPage],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: TowerTranslocoLoader,
            }),
            {
              provide: TenantScopeState,
              useValue: {
                me,
                selection,
                showScopeSwitcher: signal(false),
                branchesFor: () => [BRANCH_ID_1, BRANCH_ID_2],
                selectCompany: () => {},
                selectBranch: () => {},
              },
            },
            {
              provide: ScopeState,
              useValue: {
                companies: signal([]),
                branches: signal(companyBranches),
                company: signal({
                  id: COMPANY_ID,
                  nameEn: 'Acme',
                  nameAr: 'أكمي',
                  branches: companyBranches,
                }),
                branch: signal({ id: '', nameEn: '', nameAr: '' }),
                hasChoice: signal(true),
                selectCompany: () => {},
                selectBranch: () => {},
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(lang === 'ar' ? ar : en),
            settings: lang === 'ar' ? arSettings : enSettings,
            tradeShared: lang === 'ar' ? arTradeShared : enTradeShared,
            automation: lang === 'ar' ? arTradeAutomation : enTradeAutomation,
            tower: lang === 'ar' ? arTradeAutoTower : enTradeAutoTower,
          },
          lang,
        );
      });

      afterEach(() => {
        fixture?.destroy();
        tradeQueries().clear();
        dispose();
        vi.restoreAllMocks();
        TestBed.resetTestingModule();
        if (originalDialog.showModal) dialogProto['showModal'] = originalDialog.showModal;
        else Reflect.deleteProperty(dialogProto, 'showModal');
        if (originalDialog.close) dialogProto['close'] = originalDialog.close;
        else Reflect.deleteProperty(dialogProto, 'close');
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
        document.documentElement.lang = previousLang;
      });

      async function flushPage(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
      }

      it('loads counts in one request, preserves asOf, shows safeErrorCode verbatim, and keeps "!" hints', async () => {
        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const reads = stub.recordedReads();
        expect(reads.filter((r) => r.path === '/control-tower/exceptions/counts')).toHaveLength(1);
        expect(reads.filter((r) => r.path === '/control-tower/exceptions')).toHaveLength(1);

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('TRADE.OWNER.TRANSPORT_TIMEOUT');
        expect((fixture.componentInstance as unknown as { asOf: () => string | null }).asOf()).toBe(
          '2026-11-23T12:00:00.000Z',
        );

        const fields = fixture.debugElement.queryAll(By.css('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.query(By.css('[data-ui-hint]'))).not.toBeNull();
        }
      });

      it('hides bulk resolve (B13) and retry (ق7) and never calls /bulk-jobs or /retry', async () => {
        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('app-tower-bulk-bar')).toBeNull();
        expect(el.querySelectorAll('ui-checkbox')).toHaveLength(0);
        expect(el.textContent).not.toContain('Retry');
        expect(el.textContent).not.toContain('إعادة المحاولة');
        expect(stub.recordedWrites()).toEqual([]);
      });

      it('applies the branch filter (g2) to both counts and list in COMPANY scope', async () => {
        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const dropdowns = fixture.debugElement.queryAll(By.directive(Dropdown));
        expect(dropdowns.length).toBe(4);

        stub.reset();
        fixture.componentRef.setInput('branch', BRANCH_ID_1);
        await flushPage();

        const reads = stub.recordedReads();
        expect(reads).toEqual(
          expect.arrayContaining([
            {
              path: '/control-tower/exceptions/counts',
              query: { branchId: BRANCH_ID_1 },
              scope: { companyId: COMPANY_ID },
            },
            {
              path: '/control-tower/exceptions',
              query: {
                status: 'OPEN,ACKNOWLEDGED',
                branchId: BRANCH_ID_1,
                page: 1,
                limit: 24,
              },
              scope: { companyId: COMPANY_ID },
            },
          ]),
        );
      });

      it('renders forbidden state with zero HTTP calls when trade.control_tower.read is missing', async () => {
        setPermissions({ read: false, resolve: false });
        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        expect(stub.recordedReads()).toEqual([]);
        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
      });

      it('renders forbidden state without an error toast when server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/control-tower/exceptions', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('sets canResolve false when trade.control_tower.resolve is missing', async () => {
        setPermissions({ read: true, resolve: false });
        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        expect(
          (fixture.componentInstance as unknown as { canResolve: () => boolean }).canResolve(),
        ).toBe(false);
      });

      it('renders the not-ready state on 503 PROJECTION_UNAVAILABLE or OWNER_UNAVAILABLE', async () => {
        stub.register(
          'GET',
          '/control-tower/exceptions',
          new ApiError(503, 'TRADE.CONTROL_TOWER.PROJECTION_UNAVAILABLE'),
        );
        stub.register(
          'GET',
          '/control-tower/exceptions/counts',
          new ApiError(503, 'TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE'),
        );

        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('provisioning');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          TRANSLATIONS[lang]['tower']['errors']['TRADE_CONTROL_TOWER_PROJECTION_UNAVAILABLE'],
        );
      });

      it('attaches QUERY_INVALID error directly to the filter field', async () => {
        stub.register(
          'GET',
          '/control-tower/exceptions',
          new ApiError(400, 'TRADE.CONTROL_TOWER.QUERY_INVALID', { category: ['invalid'] }),
        );

        fixture = TestBed.createComponent(ControlTowerPage);
        await flushPage();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain(
          TRANSLATIONS[lang]['tower']['errors']['TRADE_CONTROL_TOWER_QUERY_INVALID'],
        );
      });
    });
  }
}
