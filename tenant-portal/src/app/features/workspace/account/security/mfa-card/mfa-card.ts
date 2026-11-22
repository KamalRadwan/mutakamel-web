import { Component, computed, inject, input, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerShieldCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { AccountSection } from '../../shared/account-section/account-section';
import { MfaModal } from '../mfa-modal/mfa-modal';
import { SecurityMe } from '../security.model';

const EMAIL_SENTINEL = '\u0000';

@Component({
  selector: 'app-mfa-card',
  imports: [TranslocoPipe, Button, AccountSection, MfaModal],
  providers: [provideIcons({ tablerShieldCheck })],
  templateUrl: './mfa-card.html',
})
export class MfaCard {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly mfaModal = viewChild.required(MfaModal);

  readonly me = input<SecurityMe | null>(null);

  protected readonly explainParts = computed(() => {
    this.i18n();
    const raw = this.transloco.translate('wsAccSec.mfa.explain', { email: EMAIL_SENTINEL });
    const index = raw.indexOf(EMAIL_SENTINEL);
    if (index < 0) return { before: raw, hasEmail: false, after: '' };
    return {
      before: raw.slice(0, index),
      hasEmail: true,
      after: raw.slice(index + EMAIL_SENTINEL.length),
    };
  });

  protected readonly formattedUpdatedAt = computed(() => {
    const iso = this.me()?.mfaUpdatedAt;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  });

  protected openModal(): void {
    const current = this.me();
    if (!current) return;
    this.mfaModal().open(!current.mfaEnabled, current.email);
  }
}
