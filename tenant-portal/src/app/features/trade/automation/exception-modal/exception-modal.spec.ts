import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arTradeAutoTower from '../../../../../../public/i18n/trade-auto-tower/ar.json';
import enTradeAutoTower from '../../../../../../public/i18n/trade-auto-tower/en.json';
import arTradeAutomation from '../../../../../../public/i18n/trade-automation/ar.json';
import enTradeAutomation from '../../../../../../public/i18n/trade-automation/en.json';
import arTradeShared from '../../../../../../public/i18n/trade-shared/ar.json';
import enTradeShared from '../../../../../../public/i18n/trade-shared/en.json';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { TradeReasonPicker } from '../../shared/pickers/reason-picker/reason-picker';
import { ApiError } from '../../shared/trade-api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { bindTradeHttpForTest, tradeQueries } from '../../shared/trade-http';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { EvidenceEditor } from '../evidence-editor/evidence-editor';
import type { TowerException } from '../tower.model';
import { ExceptionModal } from './exception-modal';

const COMPANY_ID = '018f0000-0000-7000-8000-000000000010';
const BRANCH_ID = '018f0000-0000-7000-8000-000000000001';
const EXC_ID = '0193a000-0000-7000-8000-000000000101';

const TRANSLATIONS: Record<string, Translation> = {
  en: {
    ...en,
    tradeShared: enTradeShared,
    automation: enTradeAutomation,
    tower: enTradeAutoTower,
  },
  ar: {
    ...ar,
    tradeShared: arTradeShared,
    automation: arTradeAutomation,
    tower: arTradeAutoTower,
  },
  'trade-shared/en': enTradeShared,
  'trade-shared/ar': arTradeShared,
  'trade-automation/en': enTradeAutomation,
  'trade-automation/ar': arTradeAutomation,
  'trade-auto-tower/en': enTradeAutoTower,
  'trade-auto-tower/ar': enTradeAutoTower,
};

@Injectable()
class ExceptionModalTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(TRANSLATIONS[path] ?? {});
  }
}

function makeDetail(overrides: Partial<TowerException> = {}): TowerException {
  return {
    id: EXC_ID,
    version: 2,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
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
    allowedResolutionCodes: ['OWNER_RESULT_APPLIED'],
    attempts: [
      {
        id: 'att-001',
        ownerCode: 'accounting-ledger',
        sourceType: 'QUOTATION_PDF_RENDER',
        sourceId: '0193a000-0000-7000-8000-000000000201',
        sourceVersion: 1,
        status: 'EXHAUSTED',
        retryClass: 'TRANSIENT',
        attemptCount: 3,
        nextAttemptAt: null,
        lastErrorCode: 'UPSTREAM_TIMEOUT',
        version: 3,
        updatedAt: '2026-11-23T09:50:00.000Z',
      },
    ],
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

const RESOLVE_REASON: ReasonCode = {
  id: '0193a000-0000-7000-8000-000000000901',
  kind: 'CONTROL_TOWER_RESOLVE',
  code: 'CONFIRMED_WITH_OWNER',
  localizedNames: { en: 'Confirmed with owner', ar: 'تم التأكيد مع الوحدة المالكة' },
  requiresNote: false,
  isActive: true,
  sortOrder: 1,
  isSystem: false,
  version: 1,
  updatedAt: '2026-11-23T08:00:00.000Z',
};

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ExceptionModal (${lang} ${theme})`, () => {
      let fixture: ComponentFixture<ExceptionModal>;
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

        stub = new TradeHttpStub({
          'GET /control-tower/exceptions/:id': makeDetail(),
          'GET /reason-codes': { items: [RESOLVE_REASON] },
          'POST /control-tower/exceptions/:id/resolve': makeDetail({
            version: 3,
            status: 'RESOLVED',
            resolutionReasonCode: 'CONFIRMED_WITH_OWNER',
          }),
        });
        dispose = bindTradeHttpForTest(stub);

        TestBed.configureTestingModule({
          imports: [ExceptionModal],
          providers: [
            provideRouter([]),
            provideTransloco({
              config: {
                availableLangs: ['en', 'ar'],
                defaultLang: lang,
                reRenderOnLangChange: true,
              },
              loader: ExceptionModalTranslocoLoader,
            }),
            { provide: LanguageState, useValue: { current: signal(lang) } },
          ],
        });

        TestBed.inject(TranslocoService).setTranslation(
          {
            ...(lang === 'ar' ? ar : en),
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

      async function flushModal(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
      }

      function createModal(canResolve = true): void {
        fixture = TestBed.createComponent(ExceptionModal);
        fixture.componentRef.setInput('exceptionId', EXC_ID);
        fixture.componentRef.setInput('context', { companyId: COMPANY_ID, branchId: BRANCH_ID });
        fixture.componentRef.setInput('canResolve', canResolve);
      }

      it('shows safeErrorCode verbatim, keeps "!" hints on all fields, and hides Retry (ق7)', async () => {
        createModal(true);
        await flushModal();

        const el = fixture.nativeElement as HTMLElement;
        const problemInput = el.querySelector<HTMLInputElement>('input[value="TRADE.OWNER.TRANSPORT_TIMEOUT"]');
        expect(problemInput).not.toBeNull();
        expect(el.textContent).toContain('UPSTREAM_TIMEOUT');
        expect(el.textContent).not.toContain('Retry');
        expect(el.textContent).not.toContain('إعادة المحاولة');

        const fields = fixture.debugElement.queryAll(By.css('ui-field'));
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(field.query(By.css('[data-ui-hint]'))).not.toBeNull();
        }
      });

      it('resolves with CONTROL_TOWER_RESOLVE reasonCode, UUIDv7 key, If-Match, and exception scope', async () => {
        createModal(true);
        await flushModal();

        const picker = fixture.debugElement.query(By.directive(TradeReasonPicker))
          .componentInstance as TradeReasonPicker;
        picker.value.set({ reasonCodeId: RESOLVE_REASON.id, note: 'owner applied' });

        const editor = fixture.debugElement.query(By.directive(EvidenceEditor))
          .componentInstance as EvidenceEditor;
        editor.value.set({ ticket: 'INC-101' });
        fixture.detectChanges();

        const resolvedSpy = vi.fn();
        fixture.componentInstance.resolved.subscribe(resolvedSpy);

        const submitBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((btn) =>
          btn.textContent?.includes(TRANSLATIONS[lang]['tower']['modal']['markAsResolved']),
        );
        expect(submitBtn).toBeTruthy();
        submitBtn!.click();
        await flushModal();

        const writes = stub.recordedWrites();
        expect(writes).toHaveLength(1);
        expect(writes[0].method).toBe('POST');
        expect(writes[0].path).toBe(`/control-tower/exceptions/${EXC_ID}/resolve`);
        expect(writes[0].ifMatch).toBe('"2"');
        expect(writes[0].key).toBeTruthy();
        expect(writes[0].scope).toEqual({ companyId: COMPANY_ID, branchId: BRANCH_ID });
        expect(writes[0].body).toEqual({
          resolutionCode: 'OWNER_RESULT_APPLIED',
          reasonCode: 'CONFIRMED_WITH_OWNER',
          note: 'owner applied',
          evidence: { ticket: 'INC-101' },
        });
        expect(resolvedSpy).toHaveBeenCalledTimes(1);
      });

      it('does not resend a resolution after GW.IDEM.MISMATCH, but permits a changed payload', async () => {
        createModal(true);
        await flushModal();

        const picker = fixture.debugElement.query(By.directive(TradeReasonPicker))
          .componentInstance as TradeReasonPicker;
        picker.value.set({ reasonCodeId: RESOLVE_REASON.id, note: '' });
        const editor = fixture.debugElement.query(By.directive(EvidenceEditor))
          .componentInstance as EvidenceEditor;
        editor.value.set({ ticket: 'INC-MISMATCH' });
        fixture.detectChanges();
        stub.register(
          'POST',
          '/control-tower/exceptions/:id/resolve',
          new ApiError(409, 'GW.IDEM.MISMATCH'),
        );

        const submitBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((btn) =>
          btn.textContent?.includes(TRANSLATIONS[lang]['tower']['modal']['markAsResolved']),
        )!;
        submitBtn.click();
        await flushModal();
        submitBtn.click();
        await flushModal();
        expect(stub.recordedWrites()).toHaveLength(1);

        editor.value.set({ ticket: 'INC-CHANGED' });
        fixture.detectChanges();
        submitBtn.click();
        await flushModal();
        expect(stub.recordedWrites()).toHaveLength(2);
        expect(stub.recordedWrites()[1].key).not.toBe(stub.recordedWrites()[0].key);
      });

      it('shows server validation at resolution, reason and evidence fields without a toast', async () => {
        createModal(true);
        await flushModal();
        const errorSpy = vi.spyOn(TestBed.inject(Notify), 'error');
        const picker = fixture.debugElement.query(By.directive(TradeReasonPicker))
          .componentInstance as TradeReasonPicker;
        picker.value.set({ reasonCodeId: RESOLVE_REASON.id, note: '' });
        const editor = fixture.debugElement.query(By.directive(EvidenceEditor))
          .componentInstance as EvidenceEditor;
        editor.value.set({ ticket: 'INC-VALIDATION' });
        fixture.detectChanges();
        stub.register('POST', '/control-tower/exceptions/:id/resolve', new ApiError(
          400, 'TRADE.VALIDATION_FAILED', {
            resolutionCode: ['Invalid resolution'],
            reasonCode: ['Inactive reason'],
            evidence: ['Invalid evidence'],
          },
        ));
        const submitBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((btn) =>
          btn.textContent?.includes(TRANSLATIONS[lang]['tower']['modal']['markAsResolved']),
        )!;
        submitBtn.click();
        await flushModal();
        expect(picker.error()).toBe('Inactive reason');
        expect(editor.error()).toBe('Invalid evidence');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Invalid resolution');
        expect(errorSpy).not.toHaveBeenCalled();

        editor.value.set({ ticket: 'INC-FIXED' });
        await flushModal();
        expect(picker.error()).toBeNull();
        expect(editor.error()).toBeNull();
      });

      it('hides the resolve section when canResolve is false', async () => {
        createModal(false);
        await flushModal();

        expect(fixture.debugElement.query(By.directive(TradeReasonPicker))).toBeNull();
        expect(fixture.debugElement.query(By.directive(EvidenceEditor))).toBeNull();
      });

      it('shows forbidden state without an error toast when server returns 403', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');
        stub.register('GET', '/control-tower/exceptions/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));

        createModal(true);
        const forbiddenSpy = vi.fn();
        fixture.componentInstance.forbidden.subscribe(forbiddenSpy);
        await flushModal();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('forbidden');
        expect(forbiddenSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('opens conflict state and refetches on 409 TARGET_STALE', async () => {
        createModal(true);
        await flushModal();

        const picker = fixture.debugElement.query(By.directive(TradeReasonPicker))
          .componentInstance as TradeReasonPicker;
        picker.value.set({ reasonCodeId: RESOLVE_REASON.id, note: '' });
        const editor = fixture.debugElement.query(By.directive(EvidenceEditor))
          .componentInstance as EvidenceEditor;
        editor.value.set({ ticket: 'INC-102' });
        fixture.detectChanges();

        const refreshedSpy = vi.fn();
        fixture.componentInstance.refreshed.subscribe(refreshedSpy);

        stub.reset();
        stub.register(
          'POST',
          '/control-tower/exceptions/:id/resolve',
          new ApiError(409, 'TRADE.CONTROL_TOWER.TARGET_STALE'),
        );
        stub.register('GET', '/control-tower/exceptions/:id', makeDetail({ version: 3 }));

        const submitBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((btn) =>
          btn.textContent?.includes(TRANSLATIONS[lang]['tower']['modal']['markAsResolved']),
        );
        submitBtn!.click();
        await flushModal();

        const conflictDe = fixture.debugElement.query(By.directive(ConflictDialog));
        expect(conflictDe).not.toBeNull();
        const conflictDialogEl = conflictDe.query(By.css('dialog'))?.nativeElement as HTMLDialogElement | undefined;
        expect(conflictDialogEl?.hasAttribute('open')).toBe(true);
        expect(refreshedSpy).toHaveBeenCalledTimes(1);
        expect(
          stub.recordedReads().filter((r) => r.path === `/control-tower/exceptions/${EXC_ID}`),
        ).toHaveLength(1);
      });

      it('shows the not-ready state on 503 OWNER_UNAVAILABLE', async () => {
        stub.register(
          'GET',
          '/control-tower/exceptions/:id',
          new ApiError(503, 'TRADE.CONTROL_TOWER.OWNER_UNAVAILABLE'),
        );

        createModal(true);
        await flushModal();

        const fullState = fixture.debugElement.query(By.directive(FullState));
        expect(fullState).not.toBeNull();
        expect((fullState.componentInstance as FullState).kind()).toBe('provisioning');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          TRANSLATIONS[lang]['tower']['errors']['TRADE_CONTROL_TOWER_OWNER_UNAVAILABLE'],
        );
      });

      it('shows the action error toast on OWNER_RESULT_REJECTED', async () => {
        const notify = TestBed.inject(Notify);
        const errorSpy = vi.spyOn(notify, 'error');

        createModal(true);
        await flushModal();

        const picker = fixture.debugElement.query(By.directive(TradeReasonPicker))
          .componentInstance as TradeReasonPicker;
        picker.value.set({ reasonCodeId: RESOLVE_REASON.id, note: '' });
        const editor = fixture.debugElement.query(By.directive(EvidenceEditor))
          .componentInstance as EvidenceEditor;
        editor.value.set({ ticket: 'INC-103' });
        fixture.detectChanges();

        stub.register(
          'POST',
          '/control-tower/exceptions/:id/resolve',
          new ApiError(422, 'TRADE.CONTROL_TOWER.OWNER_RESULT_REJECTED'),
        );

        const submitBtn = Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((btn) =>
          btn.textContent?.includes(TRANSLATIONS[lang]['tower']['modal']['markAsResolved']),
        );
        submitBtn!.click();
        await flushModal();

        expect(errorSpy).toHaveBeenCalledWith(
          TRANSLATIONS[lang]['tower']['errors']['TRADE_CONTROL_TOWER_OWNER_RESULT_REJECTED'],
        );
      });
    });
  }
}
