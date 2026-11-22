import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Service()
export class ThemeState {
  private readonly document = inject(DOCUMENT);

  readonly current = signal<Theme>(localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light');

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.current();
      localStorage.setItem(STORAGE_KEY, this.current());
    });
  }
}
