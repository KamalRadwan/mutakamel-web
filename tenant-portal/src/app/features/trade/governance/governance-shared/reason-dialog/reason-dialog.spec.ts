import { Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGlobal from '../../../../../../../public/i18n/en.json';
import enGovernance from '../../../../../../../public/i18n/trade-governance/en.json';
import enShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { TradeReasonPicker } from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError } from '../../../shared/trade-api';
import { bindTradeHttpForTest } from '../../../shared/trade-http';
import { TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import { ReasonDialog } from './reason-dialog';

@Injectable()
class ReasonLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(path === 'trade-shared/en' ? enShared : {
      ...enGlobal, governance: enGovernance, tradeShared: enShared,
    });
  }
}

describe('Governance reasons from Documents API', () => {
  let fixture: ComponentFixture<ReasonDialog>;
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
    vi.spyOn(Modal.prototype, 'open').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' }, loader: ReasonLoader }),
      { provide: LanguageState, useValue: { current: signal('en') } },
    ] });
    TestBed.inject(TranslocoService).setTranslation({
      ...enGlobal, governance: enGovernance, tradeShared: enShared,
    }, 'en');
    fixture = TestBed.createComponent(ReasonDialog);
    fixture.componentRef.setInput('kind', 'POLICY_VERSION_REJECT');
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); dispose(); vi.restoreAllMocks(); });

  async function open() {
    await fixture.componentInstance.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(TradeReasonPicker)).componentInstance as TradeReasonPicker;
  }

  it('loads the live catalogue for this action and requires the selected reason note', async () => {
    stub.register('GET', '/reason-codes', { items: [{
      id: 'reason-1', kind: 'POLICY_VERSION_REJECT', code: 'NEEDS_REVISION',
      localizedNames: { en: 'Needs revision', ar: 'يحتاج مراجعة' }, requiresNote: true, isActive: true,
    }] });
    const picker = await open();
    expect(stub.recordedReads().every((read) => read.path === '/reason-codes' &&
      read.query?.['kind'] === 'POLICY_VERSION_REJECT' && read.query?.['includeInactive'] === false)).toBe(true);
    expect(stub.recordedReads().length).toBeGreaterThan(0);
    picker.value.set({ reasonCodeId: 'reason-1', note: '' });
    expect(picker.valid()).toBe(false);
    picker.value.set({ reasonCodeId: 'reason-1', note: 'Missing approval clause' });
    expect(picker.valid()).toBe(true);
  });

  it('keeps an empty live catalogue invalid without seeded choices', async () => {
    stub.register('GET', '/reason-codes', { items: [] });
    const picker = await open();
    picker.value.set({ reasonCodeId: 'unavailable-reason', note: '' });
    expect(picker.valid()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(enShared.reason.none);
  });

  it('shows the shared load error and retry when the reasons API fails', async () => {
    stub.register('GET', '/reason-codes', new ApiError(503, 'TRADE.UNAVAILABLE'));
    const picker = await open();
    expect(picker.valid()).toBe(false);
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain(enShared.common.loadFailed);
    expect(text).toContain(enShared.common.retry);
  });
});
