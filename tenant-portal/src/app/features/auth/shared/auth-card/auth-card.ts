import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../core/i18n/transloco-scope';
import { ThemeState } from '../../../../core/theme/theme';
import { Preferences } from '../../../../shared/ui/preferences/preferences';

@Component({
  selector: 'app-auth-card',
  imports: [TranslocoPipe, Preferences],
  viewProviders: [provideTranslocoScopeInherited('auth')],
  templateUrl: './auth-card.html',
  host: { class: 'block' },
})
export class AuthCard {
  private readonly theme = inject(ThemeState);

  readonly title = input.required<string>();
  readonly subtitle = input('');

  protected readonly logo = computed(
    () => `assets/brand/logo-horizontal-${this.theme.current() === 'dark' ? 'light' : 'dark'}.png`,
  );
}
