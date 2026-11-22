import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Language, LanguageState } from './language';
import { PluralKeyPipe, pluralCategory, pluralKey } from './plural';

describe('plural helper', () => {
  it('maps Arabic numbers to the six CLDR categories', () => {
    const expected: Record<number, string> = {
      0: 'zero', 1: 'one', 2: 'two', 3: 'few', 10: 'few', 11: 'many', 99: 'many', 100: 'other', 102: 'other', 103: 'few', 111: 'many',
    };
    for (const [n, category] of Object.entries(expected)) {
      expect(pluralCategory(Number(n), 'ar')).toBe(category);
    }
  });

  it('uses only one/other in English', () => {
    expect(pluralCategory(0, 'en')).toBe('other');
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
  });

  it('builds the key from base and category', () => {
    expect(pluralKey('home.hero.subtitlePlural', 3, 'ar')).toBe('home.hero.subtitlePlural.few');
    expect(pluralKey('home.hero.subtitlePlural', 1, 'en')).toBe('home.hero.subtitlePlural.one');
  });

  it('falls back to other for bad input', () => {
    expect(pluralKey('k', Number.NaN, 'en')).toBe('k.other');
    expect(pluralKey('k', 5, 'xx')).toBe('k.other');
  });
});

describe('pluralKey edge cases', () => {
  it('treats non-finite counts as zero', () => {
    expect(pluralCategory(Number.POSITIVE_INFINITY, 'ar')).toBe('zero');
    expect(pluralCategory(Number.NaN, 'en')).toBe('other');
  });

  it('covers Arabic few/many boundaries and fractions', () => {
    expect(pluralCategory(1000, 'ar')).toBe('other');
    expect(pluralCategory(1003, 'ar')).toBe('few');
    expect(pluralCategory(1011, 'ar')).toBe('many');
    expect(pluralCategory(1.5, 'ar')).toBe('other');
    expect(pluralCategory(1.5, 'en')).toBe('other');
  });
});

describe('PluralKeyPipe', () => {
  const current = signal<Language>('en');

  beforeEach(() => {
    current.set('en');
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageState, useValue: { current } }],
    });
  });

  it('follows the active language', () => {
    const pipe = TestBed.runInInjectionContext(() => new PluralKeyPipe());
    expect(pipe.transform('items.count', 2)).toBe('items.count.other');
    current.set('ar');
    expect(pipe.transform('items.count', 2)).toBe('items.count.two');
    expect(pipe.transform('items.count', 0)).toBe('items.count.zero');
  });
});
