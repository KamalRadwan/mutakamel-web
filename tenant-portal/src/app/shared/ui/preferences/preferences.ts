import { Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLanguage, tablerMoon, tablerSun } from '@ng-icons/tabler-icons';
import { Language, LanguageState } from '../../../core/i18n/language';
import { ThemeState } from '../../../core/theme/theme';
import { Dropdown, DropdownOption, DropdownTone } from '../dropdown/dropdown';

const LANGUAGES: DropdownOption<Language>[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

@Component({
  selector: 'ui-preferences',
  imports: [Dropdown, NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerLanguage, tablerMoon, tablerSun })],
  templateUrl: './preferences.html',
  host: { class: 'flex items-center gap-8' },
})
export class Preferences {
  readonly tone = input<DropdownTone>('surface');

  protected readonly language = inject(LanguageState);
  protected readonly theme = inject(ThemeState);
  protected readonly languages = LANGUAGES;

  protected toggleTheme() {
    this.theme.current.set(this.theme.current() === 'light' ? 'dark' : 'light');
  }
}
