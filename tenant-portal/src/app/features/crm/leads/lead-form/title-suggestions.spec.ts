import { describe, expect, it } from 'vitest';
import { JOB_TITLE_SUGGESTIONS, TITLE_SUGGESTIONS, filterSuggestions, suggestionsForLanguage } from './title-suggestions';

describe('suggestionsForLanguage', () => {
  const list = [{ en: 'Mr', ar: 'السيد' }];

  it('returns Arabic labels for ar', () => {
    expect(suggestionsForLanguage(list, 'ar')).toEqual(['السيد']);
  });

  it('returns English labels for en and any other language', () => {
    expect(suggestionsForLanguage(list, 'en')).toEqual(['Mr']);
    expect(suggestionsForLanguage(list, 'fr')).toEqual(['Mr']);
  });

  it('has an Arabic and an English label for every built-in suggestion', () => {
    for (const item of [...TITLE_SUGGESTIONS, ...JOB_TITLE_SUGGESTIONS]) {
      expect(item.en.trim()).not.toBe('');
      expect(item.ar.trim()).not.toBe('');
    }
  });
});

describe('filterSuggestions', () => {
  const items = ['Sales Manager', 'مدير المبيعات', 'Engineer'];

  it('returns everything for a blank query', () => {
    expect(filterSuggestions(items, '   ')).toEqual(items);
  });

  it('matches case-insensitively as a substring', () => {
    expect(filterSuggestions(items, 'MANAG')).toEqual(['Sales Manager']);
  });

  it('matches Arabic text ignoring diacritics on either side', () => {
    expect(filterSuggestions(['مُدِير'], 'مدير')).toEqual(['مُدِير']);
    expect(filterSuggestions(['مدير'], 'مُدِير')).toEqual(['مدير']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterSuggestions(items, 'zzz')).toEqual([]);
  });

  it('returns a copy for a blank query', () => {
    expect(filterSuggestions(items, '')).not.toBe(items);
  });
});
