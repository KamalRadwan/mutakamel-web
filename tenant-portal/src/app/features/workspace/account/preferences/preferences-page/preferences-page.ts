import { Component, computed, inject, signal } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerHome } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { ApiError } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AccountSection } from '../../shared/account-section/account-section';
import { AppearanceCard } from '../appearance-card/appearance-card';
import { PreferencesApi, preferencesErrorMessage } from '../preferences.api';
import { StartPage, TenantProfile, isStartPage } from '../preferences.model';
import { ProfileCard } from '../profile-card/profile-card';

const SKELETON_CARDS = [0, 1, 2] as const;

@Component({
  selector: 'app-preferences-page',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, AccountSection, ProfileCard, AppearanceCard],
  providers: [
    provideTranslocoScope({ scope: 'ws-account-preferences', alias: 'wsAccPrefs' }),
    provideIcons({ tablerHome, tablerCloudOff }),
  ],
  templateUrl: './preferences-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-12' },
})
export class PreferencesPage {
  private static nextId = 0;
  protected readonly uid = `preferences-page-${++PreferencesPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly api = inject(PreferencesApi);
  protected readonly me = inject(AuthSession).me;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly profile = signal<TenantProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly savingStartPage = signal(false);

  private loadSeq = 0;

  protected readonly startPage = computed<StartPage>(() => {
    const raw = this.profile()?.extensions['startPage'];
    return isStartPage(raw) ? raw : 'home';
  });

  protected readonly startPageOptions = computed<DropdownOption<StartPage>[]>(() => {
    this.i18n();
    return [
      { value: 'home', label: this.transloco.translate('wsAccPrefs.defaults.home') },
      { value: 'last', label: this.transloco.translate('wsAccPrefs.defaults.last') },
      { value: 'crm-leads', label: this.transloco.translate('wsAccPrefs.defaults.crmLeads') },
    ];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const profile = await this.api.getMyProfile();
      if (seq !== this.loadSeq) return;
      this.profile.set(profile);
      this.notify.connectionRestored();
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(
          this.transloco.translate('session.connectionLost.title'),
          this.transloco.translate('session.connectionLost.text'),
        );
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onProfileChange(next: TenantProfile): void {
    this.profile.set(next);
  }

  protected async onStartPageChange(next: StartPage): Promise<void> {
    const current = this.profile();
    if (!current || this.savingStartPage() || next === this.startPage()) return;

    this.profile.set({
      ...current,
      extensions: { ...current.extensions, startPage: next },
    });
    this.savingStartPage.set(true);

    try {
      // One start-page pick is one user action; a failure reverts the pick, so there is no retry to reuse a key for.
      const updated = await this.api.updateMyProfile({ extensions: { startPage: next } }, newIdempotencyKey());
      this.profile.set(updated);
      this.notify.success(this.transloco.translate('wsAccPrefs.toast.saved'));
    } catch (error) {
      // Revert only the start page: other keys may have changed meanwhile (for example the appearance card).
      this.profile.update((latest) =>
        latest ? { ...latest, extensions: { ...latest.extensions, startPage: current.extensions['startPage'] } } : latest,
      );
      this.notify.error(preferencesErrorMessage(error, this.transloco, 'write'));
    } finally {
      this.savingStartPage.set(false);
    }
  }
}
