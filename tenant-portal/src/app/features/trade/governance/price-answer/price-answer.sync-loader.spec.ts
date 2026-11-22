import { Component, Injectable, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PRICING_ENGINE_VERSION, type PricingDecision } from '../pricing.model';
import { PriceAnswer } from './price-answer';

/** Answers synchronously, so translationLoadSuccess fires while the template is rendering. */
@Injectable()
class SyncLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const ar = path.endsWith('/ar');
    if (!path.startsWith('trade-gov-price-eval/')) return of({});
    return of({ answer: { title: ar ? 'الإجابة' : 'Answer', unitFallback: ar ? 'وحدة' : 'unit' } });
  }
}

const DECISION: PricingDecision = {
  decisionId: '0193a000-0000-7000-8000-00000000d001',
  priceBookSource: 'ACCOUNT',
  engineVersion: PRICING_ENGINE_VERSION,
  decisionType: 'PURCHASE_PRICE',
  outcome: 'ALLOW',
  unitPrice: '90',
  currencyCode: 'EGP',
  priceBookId: '0193a000-0000-7000-8000-00000000b001',
  priceBookVersionId: '0193a000-0000-7000-8000-00000000v001',
  priceBookVersion: 3,
  checksum: 'sha256:abc',
  matchedEntryId: '0193a000-0000-7000-8000-00000000e001',
  baselineUnitPrice: '100',
  minimumAllowedPrice: null,
  matchedPromotions: [],
  rejectedPromotions: [],
  components: [],
  rejectedCandidates: [],
  inputFingerprint: 'f'.repeat(64),
  evaluatedAt: '2026-11-21T10:00:00.000Z',
  taxFinal: false,
};

@Component({
  imports: [PriceAnswer],
  template: `<app-price-answer [decision]="decision()" />`,
})
class Host {
  readonly answer = viewChild.required(PriceAnswer);
  readonly decision = signal<PricingDecision | null>(DECISION);
}

describe('PriceAnswer with a synchronous translation loader', () => {
  it('renders without NG0600 and re-translates on language change', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: SyncLoader,
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();
    const unitLabel = () =>
      (fixture.componentInstance.answer() as unknown as { resolvedUnitLabel(): string }).resolvedUnitLabel();
    expect(unitLabel()).toBe('unit');

    TestBed.inject(TranslocoService).setActiveLang('ar');
    await fixture.whenStable();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(unitLabel()).toBe('وحدة');
    fixture.destroy();
  });
});
