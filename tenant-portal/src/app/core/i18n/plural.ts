import { Pipe, PipeTransform, inject } from '@angular/core';
import { Language, LanguageState } from './language';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const ARABIC_CATEGORIES: readonly PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
const ENGLISH_CATEGORIES: readonly PluralCategory[] = ['one', 'other'];

const rulesByLang = new Map<string, Intl.PluralRules>();

function rulesFor(lang: string): Intl.PluralRules {
  let rules = rulesByLang.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    rulesByLang.set(lang, rules);
  }
  return rules;
}

/** Plural category of `n` in `lang`; categories the language does not use collapse to 'other'. */
export function pluralCategory(n: number, lang: Language | string): PluralCategory {
  const category = rulesFor(lang).select(Number.isFinite(n) ? n : 0) as PluralCategory;
  const allowed = lang === 'ar' ? ARABIC_CATEGORIES : ENGLISH_CATEGORIES;
  return allowed.includes(category) ? category : 'other';
}

/** `base.<category>` for the count, e.g. pluralKey('home.hero.subtitlePlural', 3, 'ar') -> '...subtitlePlural.few'. */
export function pluralKey(base: string, n: number, lang: Language | string): string {
  return `${base}.${pluralCategory(n, lang)}`;
}

/** Template form: `'scope.key' | pluralKey: n` follows the active language. */
@Pipe({ name: 'pluralKey', pure: false })
export class PluralKeyPipe implements PipeTransform {
  private readonly language = inject(LanguageState);

  transform(base: string, n: number): string {
    return pluralKey(base, n, this.language.current());
  }
}
