import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerDeviceDesktop, tablerDeviceMobile, tablerWorld } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Button } from '../../../../../../shared/ui/button/button';
import {
  AuthSession,
  expiresAt,
  formatRelativeTime,
  formatSessionDate,
  formatSessionDateTime,
  lastActive,
  sessionDeviceIcon,
} from '../sessions.model';

@Component({
  selector: 'app-session-row',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [provideIcons({ tablerWorld, tablerDeviceMobile, tablerDeviceDesktop })],
  templateUrl: './session-row.html',
  host: { class: 'block' },
})
export class SessionRow {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState);
  private readonly i18n = translationEvents(this.transloco);

  readonly session = input.required<AuthSession>();
  readonly busy = input(false);

  readonly end = output<void>();

  /** Bumped every minute so the relative "last active" time stays current. */
  private readonly minuteTick = signal(0);

  constructor() {
    const timer = setInterval(() => this.minuteTick.update((n) => n + 1), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected readonly deviceIcon = computed(() => sessionDeviceIcon(this.session().clientType));

  protected readonly deviceName = computed(() => {
    this.i18n();
    const s = this.session();
    return s.deviceLabel?.trim() || this.transloco.translate(`wsAccSessions.client.${s.clientType}`);
  });

  protected readonly metaParams = computed(() => {
    this.minuteTick();
    const s = this.session();
    const lang = this.language.current();
    return {
      signedIn: formatSessionDate(s.createdAt, lang),
      active: formatRelativeTime(lastActive(s), lang),
      expires: formatSessionDateTime(expiresAt(s), lang),
    };
  });

  protected onEnd(): void {
    if (!this.busy()) {
      this.end.emit();
    }
  }
}
