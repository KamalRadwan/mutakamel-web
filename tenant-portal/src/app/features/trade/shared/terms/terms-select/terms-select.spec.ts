import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TERM_LIMITS, type TermOptions, type TermSelections, type TradeTerm } from '../terms.model';
import { TradeTermsSelect } from './terms-select';
import { bindTradeHttpForTest } from '../../trade-http';
import { TradeHttpStub } from '../../testing/trade-http-testing';

const TSET_EN: Translation = {
  select: {
    paymentLabel: 'Payment terms',
    paymentHintSales: 'When and how the customer pays.',
    paymentHintPurchase: 'When and how we pay the supplier.',
    deliveryLabel: 'Delivery terms',
    deliveryHint: 'Where and when goods are handed over.',
    warrantyLabel: 'Warranty terms',
    warrantyHint: 'The warranty you give on the items.',
    clausesLabel: 'Terms and conditions',
    clausesHint: 'Extra clauses printed in this order.',
    inactive: 'Inactive',
    groupReturns: 'Return policy',
    groupGeneral: 'Terms and conditions',
    placeholder: 'Select…',
    clausesPlaceholder: 'Add terms…',
    searchPlaceholder: 'Search',
    clear: 'Clear',
    removeClause: 'Remove {{name}}',
    clauseMenu: 'Reorder {{name}}',
    maxReached: 'Up to {{max}} clauses.',
    noMatches: 'No matching terms.',
    loading: 'Loading…',
    loadFailed: 'Could not load terms.',
    retry: 'Try again',
  },
};

const SCOPED: Record<string, Translation> = {
  en: { tset: TSET_EN },
  'trade-settings/en': TSET_EN,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(SCOPED[path] ?? {});
  }
}

@Component({
  imports: [TradeTermsSelect],
  template: `
    <app-trade-terms-select
      documentType="QUOTATION"
      [(value)]="value"
      idPrefix="test-terms"
    />
  `,
})
class Host {
  readonly select = viewChild.required(TradeTermsSelect);
  readonly value = signal<TermSelections>({
    paymentTermId: 'term-c1-payment-net30',
    deliveryTermId: 'term-c1-delivery-site14',
    warrantyTermId: 'term-c1-warranty-w12',
    clauseIds: [
      'term-c1-returns-ret14',
      'term-c1-general-gen',
      'term-c1-general-conf',
      'term-c1-general-force',
    ],
  });
}

function termOption(id: string, termType: TradeTerm['termType']): TradeTerm {
  return {
    id, termType, side: 'SALES', code: id.toUpperCase(), displayName: id,
    localizedNames: { en: id }, localizedTexts: { en: id },
    dueDays: termType === 'PAYMENT' ? 30 : null, incotermCode: null,
    isDefault: termType === 'PAYMENT', isActive: true, sortOrder: 0,
    version: 1, updatedAt: '2026-11-24T00:00:00Z',
  };
}

const TERM_OPTIONS: TermOptions = {
  byType: {
    PAYMENT: [termOption('term-c1-payment-net30', 'PAYMENT')],
    DELIVERY: [termOption('term-c1-delivery-site14', 'DELIVERY')],
    WARRANTY: [termOption('term-c1-warranty-w12', 'WARRANTY')],
    RETURNS: [termOption('term-c1-returns-ret14', 'RETURNS')],
    GENERAL: ['gen', 'conf', 'force', 'extra'].map((code) => termOption(`term-c1-general-${code}`, 'GENERAL')),
  },
  defaults: { PAYMENT: 'term-c1-payment-net30' },
};

describe('TradeTermsSelect max clauses enforcement (§6)', () => {
  const fixtures: ComponentFixture<Host>[] = [];
  let dispose: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    dispose = bindTradeHttpForTest(new TradeHttpStub({ 'GET /terms/options': TERM_OPTIONS }));
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.destroy();
    }
    dispose();
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('caps clauses at 4, sets the maxReached tooltip, and disables adding a 5th clause', async () => {
    expect(TERM_LIMITS.maxClauses).toBe(4);

    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const clausesInput = el.querySelector<HTMLInputElement>('#test-terms-clauses');
    if (!clausesInput?.parentElement) throw new Error('Missing clauses field');
    expect(clausesInput.readOnly).toBe(true);
    expect(clausesInput.getAttribute('title')).toBe('Up to 4 clauses.');

    clausesInput.parentElement.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(50);
    fixture.detectChanges();

    const options = Array.from(el.querySelectorAll<HTMLElement>('ul[aria-multiselectable="true"] li[role="option"]'));
    expect(options.length).toBeGreaterThan(4);

    const unselectedOption = options.find((opt) => opt.getAttribute('aria-selected') === 'false');
    if (!unselectedOption) throw new Error('Missing unselected clause');
    expect(unselectedOption.getAttribute('aria-disabled')).toBe('true');

    // Clicking a disabled 5th clause leaves selection unchanged at 4.
    unselectedOption.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toHaveLength(4);

    // Dropping back to 3 clauses re-enables unselected options so a 4th can be added.
    fixture.componentInstance.value.update((curr) => ({
      ...curr,
      clauseIds: (curr.clauseIds ?? []).slice(0, 3),
    }));
    fixture.detectChanges();

    const reenabledOption = Array.from(
      el.querySelectorAll<HTMLElement>('ul[aria-multiselectable="true"] li[role="option"]'),
    ).find((opt) => opt.getAttribute('aria-selected') === 'false');
    if (!reenabledOption) throw new Error('Missing enabled clause');
    expect(reenabledOption.getAttribute('aria-disabled')).toBeNull();

    reenabledOption.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toHaveLength(4);
  });

  it('handles omitted selections and clauses through adding, removing, defaults and clearing', async () => {
    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.componentInstance.value.set({});
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    expect(fixture.componentInstance.select().valid()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('#test-terms-clauses');
    if (!input?.parentElement) throw new Error('Missing clauses field');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    input.parentElement.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(50);
    fixture.detectChanges();
    const option = el.querySelector<HTMLElement>('ul[aria-multiselectable="true"] li[role="option"]');
    if (!option) throw new Error('Missing clause option');
    option.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toHaveLength(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toEqual([]);
    fixture.componentInstance.select().applyDefaults();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().paymentTermId).toBeTruthy();
    const clear = el.querySelector<HTMLButtonElement>('button[aria-label="Clear"]');
    if (!clear) throw new Error('Missing payment clear button');
    clear.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().paymentTermId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(fixture.componentInstance.value()))).not.toHaveProperty('paymentTermId');
  });
});
