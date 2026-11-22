import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type Language = 'ar' | 'en';

const STORAGE_KEY = 'lang';

@Service()
export class LanguageState {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  readonly current = signal<Language>(readStored());

  constructor() {
    effect(() => {
      const language = this.current();
      this.document.documentElement.lang = language;
      this.document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      this.transloco.setActiveLang(language);
      localStorage.setItem(STORAGE_KEY, language);
    });
  }
}

function readStored(): Language {
  return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
}
