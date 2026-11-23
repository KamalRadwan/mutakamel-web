import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerPalette } from '@ng-icons/tabler-icons';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Language, LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Theme, ThemeState } from '../../../../../core/theme/theme';
import { ViewScale, ViewSize } from '../../../../../core/view/view-scale';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { AccountSection } from '../../shared/account-section/account-section';
import { PreferencesApi } from '../preferences.api';
import { TenantProfile, TenantProfilePatch } from '../preferences.model';

const LANGUAGE_OPTIONS: readonly SegmentedOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'ar';
}

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

function isViewSize(value: string | null): value is ViewSize {
  return value === 'auto' || value === 'small' || value === 'balanced' || value === 'large';
}

@Component({
  selector: 'app-appearance-card',
  imports: [TranslocoPipe, Field, Segmented, AccountSection],
  providers: [provideIcons({ tablerPalette })],
  templateUrl: './appearance-card.html',
})
export class AppearanceCard {
  private static nextId = 0;
  protected readonly uid = `appearance-card-${++AppearanceCard.nextId}`;

  protected readonly language = inject(LanguageState);
  protected readonly theme = inject(ThemeState);
  protected readonly viewScale = inject(ViewScale);
  private readonly notify = inject(Notify);
  private readonly api = inject(PreferencesApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly profile = input.required<TenantProfile>();
  readonly profileChange = output<TenantProfile>();

  protected readonly languageOptions = LANGUAGE_OPTIONS;

  protected readonly themeOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'light', label: this.transloco.translate('wsAccPrefs.appearance.light') },
      { value: 'dark', label: this.transloco.translate('wsAccPrefs.appearance.dark') },
    ];
  });

  protected readonly viewSizeOptions = computed<readonly SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'auto', label: this.transloco.translate('view.auto') },
      { value: 'small', label: this.transloco.translate('view.small') },
      { value: 'balanced', label: this.transloco.translate('view.balanced') },
      { value: 'large', label: this.transloco.translate('view.large') },
    ];
  });

  protected onLanguageChange(value: string | null): void {
    if (!isLanguage(value) || value === this.language.current()) return;
    this.language.current.set(value);
    void this.persist({ language: value });
  }

  protected onThemeChange(value: string | null): void {
    if (!isTheme(value) || value === this.theme.current()) return;
    this.theme.current.set(value);
    void this.persist({ themeKey: value });
  }

  protected onViewSizeChange(value: string | null): void {
    if (!isViewSize(value) || value === this.viewScale.size()) return;
    this.viewScale.set(value);
    void this.persist({ extensions: { viewSize: value } });
  }

  private async persist(patch: TenantProfilePatch): Promise<void> {
    try {
      // Each appearance change is its own user action (no retry: failure keeps the device-only value).
      const updated = await this.api.updateMyProfile(patch, newIdempotencyKey());
      this.profileChange.emit(updated);
    } catch {
      this.notify.warning(this.transloco.translate('wsAccPrefs.toast.deviceOnly'));
    }
  }
}
