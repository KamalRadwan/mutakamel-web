import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { provideTranslocoScopeInherited } from '../../../../core/i18n/transloco-scope';
import { ThemeState } from '../../../../core/theme/theme';
import { Preferences } from '../../../../shared/ui/preferences/preferences';

@Component({
  selector: 'app-auth-card',
  imports: [NgOptimizedImage, TranslocoPipe, Preferences],
  viewProviders: [provideTranslocoScopeInherited('auth')],
  templateUrl: './auth-card.html',
  styleUrls: ['./auth-card.css', './auth-preferences.css'],
  host: { class: 'block' },
})
export class AuthCard {
  private readonly language = inject(LanguageState);
  protected readonly theme = inject(ThemeState);

  readonly title = input.required<string>();
  readonly subtitle = input('');

  protected readonly ribbon = computed(() => `assets/auth/login-ribbon-${this.theme.current()}.webp`);
  protected readonly copyrightYear = computed(() =>
    new Intl.NumberFormat(this.language.current() === 'ar' ? 'ar-EG' : 'en', { useGrouping: false })
      .format(new Date().getFullYear()),
  );
}
