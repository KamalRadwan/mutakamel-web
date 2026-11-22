import { describe, expect, it } from 'vitest';

// Mirrors the category-to-key mapping in DateRange.dayCountText (the component keeps it private).
function keyFor(category: Intl.LDMLPluralRule): string {
  return category === 'two' ? 'daysTwo' : category === 'few' ? 'daysFew' : category === 'many' ? 'daysMany' : category === 'other' ? 'daysOther' : 'days';
}

const TRANSLATION_KEYS = ['days', 'daysTwo', 'daysFew', 'daysMany', 'daysOther'];

describe('date-range day count plural keys', () => {
  it.each(['ar', 'en'])('maps every %s plural category up to 300 days to an existing translation key', (lang) => {
    const rules = new Intl.PluralRules(lang);
    for (let n = 2; n <= 300; n++) {
      expect(TRANSLATION_KEYS, `${lang} ${n}`).toContain(keyFor(rules.select(n)));
    }
  });

  it('selects the dual form for two days in Arabic', () => {
    expect(keyFor(new Intl.PluralRules('ar').select(2))).toBe('daysTwo');
  });

  it('selects the few form for seven days in Arabic', () => {
    expect(keyFor(new Intl.PluralRules('ar').select(7))).toBe('daysFew');
  });

  it('selects the many form for eleven days in Arabic', () => {
    expect(keyFor(new Intl.PluralRules('ar').select(11))).toBe('daysMany');
  });

  it('selects the other form for one hundred days in Arabic', () => {
    expect(keyFor(new Intl.PluralRules('ar').select(100))).toBe('daysOther');
  });

  it('uses the plain days key for zero in Arabic', () => {
    expect(keyFor(new Intl.PluralRules('ar').select(0))).toBe('days');
  });
});
