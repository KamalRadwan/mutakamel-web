import { Component, Injectable, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TermSelections } from '../../../shared/terms/terms.model';
import type { DocumentKind } from '../../shared/document.model';
import { TERMS_NOTES_MAX_LENGTH, TermsSection } from './terms-section';

const TDPG_EN: Translation = {
  terms: {
    notes: 'Notes',
    notesHint: 'Free-text notes shown on the document. Up to {{max}} characters.',
    notesPlaceholder: 'Add notes...',
    none: '—',
  },
  validation: {
    notesMax: 'Up to {{max}} characters.',
  },
};

const TDPG_AR: Translation = {
  terms: {
    notes: 'ملاحظات',
    notesHint: 'ملاحظات نصية تظهر على المستند. بحد أقصى {{max}} حرف.',
    notesPlaceholder: 'أضف ملاحظات...',
    none: '—',
  },
  validation: {
    notesMax: 'بحد أقصى {{max}} حرف.',
  },
};

const SCOPED: Record<string, Translation> = {
  en: { tdpg: TDPG_EN },
  ar: { tdpg: TDPG_AR },
  'trade-documents-page/en': TDPG_EN,
  'trade-documents-page/ar': TDPG_AR,
};

@Injectable()
class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(SCOPED[path] ?? {});
  }
}

@Component({
  imports: [TermsSection],
  template: `
    <app-terms-section
      [kind]="kind()"
      [mode]="'new'"
      [(termSelections)]="selections"
      [(notes)]="notes"
    />
  `,
})
class Host {
  readonly termsSection = viewChild.required(TermsSection);
  readonly kind = signal<DocumentKind>('quotation');
  readonly selections = signal<TermSelections>({
    paymentTermId: 'term-c1-payment-net30',
    clauseIds: [],
  });
  readonly notes = signal('');
}

describe('TermsSection notes max length (§3)', () => {
  const fixtures: ComponentFixture<Host>[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    vi.useRealTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('caps terms notes at 800 characters across all four document kinds and refuses 801', async () => {
    expect(TERMS_NOTES_MAX_LENGTH).toBe(800);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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

    const kinds: readonly DocumentKind[] = ['quotation', 'sales-order', 'purchase-order', 'purchase-quotation'];
    const el = fixture.nativeElement as HTMLElement;

    for (const kind of kinds) {
      fixture.componentInstance.kind.set(kind);
      fixture.componentInstance.selections.set({
        paymentTermId: kind === 'quotation' ? 'term-c1-payment-net30' : undefined,
        clauseIds: [],
      });
      fixture.componentInstance.notes.set('x'.repeat(800));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(350);
      fixture.detectChanges();

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea[id$="-notes"]');
      expect(textarea).not.toBeNull();
      expect(textarea!.hasAttribute('maxlength')).toBe(false);
      expect(textarea!.getAttribute('aria-invalid')).toBeNull();

      const hint = el.querySelector<HTMLElement>('span[id$="-notes-hint"]');
      expect(hint?.textContent).toContain('Up to 800 characters.');

      const counters = Array.from(el.querySelectorAll<HTMLElement>('bdi[dir="ltr"]')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(counters).toContain('800 / 800');
      expect(el.querySelector('p[id$="-notes-error"]')).toBeNull();
      expect(fixture.componentInstance.termsSection().valid()).toBe(true);

      fixture.componentInstance.notes.set('x'.repeat(801));
      fixture.detectChanges();

      const overCounters = Array.from(el.querySelectorAll<HTMLElement>('bdi[dir="ltr"]')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(overCounters).toContain('801 / 800');
      expect(textarea!.getAttribute('aria-invalid')).toBe('true');
      const errorEl = el.querySelector<HTMLElement>('p[id$="-notes-error"]');
      expect(errorEl?.textContent).toContain('Up to 800 characters.');
      expect(fixture.componentInstance.termsSection().valid()).toBe(false);
    }
  });

  it('shows Arabic hint, counter and error text at 800 characters', async () => {
    localStorage.setItem('lang', 'ar');
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'ar', reRenderOnLangChange: true },
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
    const hint = el.querySelector<HTMLElement>('span[id$="-notes-hint"]');
    expect(hint?.textContent).toContain('بحد أقصى 800 حرف.');

    fixture.componentInstance.notes.set('x'.repeat(801));
    fixture.detectChanges();

    const counters = Array.from(el.querySelectorAll<HTMLElement>('bdi[dir="ltr"]')).map((node) =>
      node.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(counters).toContain('801 / 800');
    const errorEl = el.querySelector<HTMLElement>('p[id$="-notes-error"]');
    expect(errorEl?.textContent).toContain('بحد أقصى 800 حرف.');
    expect(fixture.componentInstance.termsSection().valid()).toBe(false);
  });
});
