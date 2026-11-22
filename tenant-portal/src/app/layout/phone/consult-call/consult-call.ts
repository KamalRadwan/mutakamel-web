import { Component, computed, inject, signal } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerArrowsUpDown,
  tablerDialpad,
  tablerPhoneEnd,
  tablerUsersPlus,
  tablerX,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { AudioRow } from '../audio-row/audio-row';
import { CallRows } from '../call-rows/call-rows';
import { Keypad } from '../keypad/keypad';
import { StatusLine } from '../status-line/status-line';

@Component({
  selector: 'app-consult-call',
  imports: [TranslocoPipe, NgIcon, CallRows, Keypad, AudioRow, StatusLine],
  providers: [
    provideIcons({
      tablerArrowsExchange,
      tablerArrowsUpDown,
      tablerDialpad,
      tablerPhoneEnd,
      tablerUsersPlus,
      tablerX,
    }),
  ],
  templateUrl: './consult-call.html',
  host: { class: 'flex min-w-0 grow shrink-0 flex-col gap-8' },
})
export class ConsultCall {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly phone = inject(PhoneState);
  protected readonly showKeypad = signal(false);

  protected readonly consultLeg = computed(
    () => this.phone.legs().find((leg) => leg.role === 'consult') ?? null,
  );

  protected readonly canCompleteTransfer = computed(
    () => this.consultLeg()?.state === 'active',
  );

  protected readonly focusedHasName = computed(() => Boolean(this.phone.focusedLeg()?.displayName));

  protected readonly focusedName = computed(() => {
    const leg = this.phone.focusedLeg();
    return leg ? leg.displayName || leg.number : '';
  });

  protected readonly hangupWithParts = computed(() => {
    this.i18n();
    const sentinel = '\uE000';
    const raw = this.transloco.translate('webPhone.consult.hangupWith', { name: sentinel });
    const idx = raw.indexOf(sentinel);
    const name = this.focusedName();
    if (idx === -1) {
      return { before: raw, name: '', after: '' };
    }
    return {
      before: raw.slice(0, idx),
      name,
      after: raw.slice(idx + sentinel.length),
    };
  });

  protected onFocusLeg(legId: string): void {
    if (legId !== this.phone.focusedLegId()) {
      this.phone.swapLegs();
    }
  }
}
