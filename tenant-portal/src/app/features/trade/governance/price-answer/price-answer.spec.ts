import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRICING_ENGINE_VERSION,
  type PriceEntry,
  type PricingDecision,
  type PromotionRule,
} from '../pricing.model';
import { PriceAnswer, type PriceAnswerContext } from './price-answer';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  /** Async like the HTTP loader, so load events never fire during a render. */
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

const BOOK_ID = '0193a000-0000-7000-8000-00000000b001';
const VERSION_ID = '0193a000-0000-7000-8000-00000000v001';
const ENTRY_ID = '0193a000-0000-7000-8000-00000000e001';
const OTHER_ENTRY_ID = '0193a000-0000-7000-8000-00000000e002';
const PROMO_VERSION_ID = '0193a000-0000-7000-8000-00000000p001';

/** A decision exactly as POST /pricing/evaluate returns it. */
const DECISION: PricingDecision = {
  decisionId: '0193a000-0000-7000-8000-00000000d001',
  priceBookSource: 'ACCOUNT',
  engineVersion: PRICING_ENGINE_VERSION,
  decisionType: 'PURCHASE_PRICE',
  outcome: 'ALLOW',
  unitPrice: '90',
  currencyCode: 'EGP',
  priceBookId: BOOK_ID,
  priceBookVersionId: VERSION_ID,
  priceBookVersion: 3,
  checksum: 'sha256:abc',
  matchedEntryId: ENTRY_ID,
  baselineUnitPrice: '100',
  minimumAllowedPrice: '80',
  matchedPromotions: [
    {
      promotionDefinitionId: 'pd-ten',
      promotionVersionId: PROMO_VERSION_ID,
      code: 'TEN',
      discountAmount: '10',
    },
  ],
  rejectedPromotions: [{ promotionVersionId: 'pv-2', code: 'VIP', reason: 'ACCOUNT_REQUIRED' }],
  components: [
    { kind: 'BASE_PRICE', referenceId: ENTRY_ID, amount: '100' },
    { kind: 'PROMOTION_DISCOUNT', referenceId: PROMO_VERSION_ID, amount: '10' },
  ],
  rejectedCandidates: [{ entryId: OTHER_ENTRY_ID, reason: 'LOWER_PRECEDENCE' }],
  inputFingerprint: 'f'.repeat(64),
  evaluatedAt: '2026-11-21T10:00:00.000Z',
  taxFinal: false,
};

function entry(id: string, unitPrice: string, minimumQuantity: string, priority: number): PriceEntry {
  return {
    id,
    version: 1,
    itemCompanyProfileId: 'cp-1',
    itemId: 'item-1',
    itemCode: 'ITEM-1',
    itemLocalizedNames: { en: 'Item', ar: 'صنف' },
    uomId: 'uom-1',
    uomCode: 'PCS',
    uomDisplayName: 'Piece',
    uomLocalizedNames: { en: 'Piece', ar: 'قطعة' },
    currencyCode: 'EGP',
    minimumQuantity,
    maximumQuantity: null,
    unitPrice,
    minimumAllowedPrice: null,
    priority,
    standardCost: null,
    catalogSalesPrice: null,
  };
}

const PROMOTION = {
  id: PROMO_VERSION_ID,
  code: 'TEN',
  benefit: { type: 'PERCENTAGE', value: '10.00' },
} as PromotionRule;

const CONTEXT: PriceAnswerContext = {
  book: { id: BOOK_ID, code: 'PB-SUP', name: 'Suppliers', localizedNames: { en: 'Supplier book', ar: 'دفتر الموردين' } },
  entries: [entry(ENTRY_ID, '100', '1', 100), entry(OTHER_ENTRY_ID, '120', '1', 200)],
  promotions: [PROMOTION],
};

@Component({
  imports: [PriceAnswer],
  template: `<app-price-answer [decision]="decision()" [context]="context()" unitLabel="Piece" />`,
})
class Host {
  readonly answer = viewChild.required(PriceAnswer);
  readonly decision = signal<PricingDecision | null>(DECISION);
  readonly context = signal<PriceAnswerContext | null>(CONTEXT);
}

describe('PriceAnswer (backend PricingDecision)', () => {
  const fixtures: ComponentFixture<Host>[] = [];

  async function mount(): Promise<ComponentFixture<Host>> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixtures.push(fixture);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    return fixture;
  }

  const text = (f: ComponentFixture<Host>) => (f.nativeElement as HTMLElement).textContent ?? '';

  /** Protected members used by the template; read through a narrow view. */
  interface AnswerInternals {
    bookDisplayName(): string;
    matchedLineText(): string;
  }
  const internals = (f: ComponentFixture<Host>) => f.componentInstance.answer() as unknown as AnswerInternals;
  const short = (id: string) => `${id.slice(0, 4)}…${id.slice(-4)}`;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
  });

  afterEach(() => {
    while (fixtures.length > 0) fixtures.pop()!.destroy();
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('shows unitPrice, the promotion percent from the version, the book name and the candidate price', async () => {
    const f = await mount();
    const content = text(f);
    expect(content).toContain('EGP 90');
    expect(content).toContain('EGP 100');
    expect(content).toContain('(10%)');
    expect(content).toContain('EGP 120');
    expect(content).toContain('VIP');
    expect(internals(f).bookDisplayName()).toBe('Supplier book');
    expect(internals(f).matchedLineText()).not.toContain(short(ENTRY_ID));
  });

  it('falls back to short ids when the version context could not be read', async () => {
    const f = await mount();
    f.componentInstance.context.set(null);
    f.detectChanges();
    const content = text(f);
    expect(content).toContain('EGP 90');
    expect(content).not.toContain('(10%)');
    expect(content).not.toContain('EGP 120');
    expect(content).toContain(short(OTHER_ENTRY_ID));
    expect(internals(f).bookDisplayName()).toBe(short(BOOK_ID));
    expect(internals(f).matchedLineText()).toBe(short(ENTRY_ID));
  });
});
