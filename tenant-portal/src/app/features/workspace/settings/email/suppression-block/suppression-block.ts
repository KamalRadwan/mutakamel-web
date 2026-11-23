import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerMailOff } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { isValidBareEmail } from '../email.model';
import { SuppressionModal } from '../suppression-modal/suppression-modal';

@Component({
  selector: 'app-suppression-block',
  imports: [NgIcon, TranslocoPipe, Button, Field, SettingsNotice, SuppressionModal],
  providers: [provideIcons({ tablerMailOff })],
  templateUrl: './suppression-block.html',
  host: { class: 'block' },
})
export class SuppressionBlock {
  private static nextId = 0;
  protected readonly uid = `ws-email-suppression-block-${++SuppressionBlock.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(SuppressionModal);

  readonly canLift = input(false);
  protected readonly serverAddressError = signal<string | null>(null);

  protected readonly addressDraft = signal('');
  protected readonly submitted = signal(false);
  protected readonly checking = signal(false);
  protected readonly locked = signal(false);

  protected readonly addressError = computed(() => {
    this.i18n();
    if (this.serverAddressError()) return this.serverAddressError();
    if (!this.submitted() || this.locked()) return null;
    const trimmed = this.addressDraft().trim();
    if (!trimmed || trimmed.length > 320 || !isValidBareEmail(trimmed)) {
      return this.transloco.translate('wsEmail.suppression.errors.invalidAddress');
    }
    return null;
  });

  protected onAddressInput(event: Event): void {
    this.serverAddressError.set(null);
    this.addressDraft.set((event.target as HTMLInputElement).value);
    this.submitted.set(false);
    this.modal().clearResults();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.locked() || this.checking()) return;

    this.submitted.set(true);
    if (this.addressError()) return;

    this.modal().open(this.addressDraft().trim());
  }

  protected onForbidden(): void {
    this.locked.set(true);
    this.submitted.set(false);
  }
}
