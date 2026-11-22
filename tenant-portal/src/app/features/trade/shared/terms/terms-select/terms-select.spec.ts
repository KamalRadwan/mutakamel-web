import { Component, Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TERM_LIMITS, type TermSelections } from '../terms.model';
import { TradeTermsSelect } from './terms-select';

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

describe('TradeTermsSelect max clauses enforcement (§6)', () => {
  const fixtures: ComponentFixture<Host>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('caps clauses at 4, sets the maxReached tooltip, and disables adding a 5th clause', async () => {
    expect(TERM_LIMITS.maxClauses).toBe(4);

    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: TestTranslocoLoader,
        }),
      ],
    });

    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const clausesInput = el.querySelector<HTMLInputElement>('#test-terms-clauses')!;
    expect(clausesInput).not.toBeNull();
    expect(clausesInput.readOnly).toBe(true);
    expect(clausesInput.getAttribute('title')).toBe('Up to 4 clauses.');

    clausesInput.parentElement!.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(50);
    fixture.detectChanges();

    const options = Array.from(el.querySelectorAll<HTMLElement>('ul[aria-multiselectable="true"] li[role="option"]'));
    expect(options.length).toBeGreaterThan(4);

    const unselectedOption = options.find((opt) => opt.getAttribute('aria-selected') === 'false')!;
    expect(unselectedOption).toBeDefined();
    expect(unselectedOption.getAttribute('aria-disabled')).toBe('true');

    // Clicking a disabled 5th clause leaves selection unchanged at 4.
    unselectedOption.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toHaveLength(4);

    // Dropping back to 3 clauses re-enables unselected options so a 4th can be added.
    fixture.componentInstance.value.update((curr) => ({
      ...curr,
      clauseIds: curr.clauseIds.slice(0, 3),
    }));
    fixture.detectChanges();

    const reenabledOption = Array.from(
      el.querySelectorAll<HTMLElement>('ul[aria-multiselectable="true"] li[role="option"]'),
    ).find((opt) => opt.getAttribute('aria-selected') === 'false')!;
    expect(reenabledOption.getAttribute('aria-disabled')).toBeNull();

    reenabledOption.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().clauseIds).toHaveLength(4);
  });
});
