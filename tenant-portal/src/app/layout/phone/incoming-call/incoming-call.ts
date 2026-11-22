import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerBellOff,
  tablerPhone,
  tablerPhoneIncoming,
  tablerPhoneOff,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { AudioRow } from '../audio-row/audio-row';
import { StatusLine } from '../status-line/status-line';

type CallLeg = ReturnType<PhoneState['legs']>[number];
type CallSource = NonNullable<CallLeg['source']>;

const SOURCE_ICON: Record<CallSource['type'], string> = {
  LEAD: 'tablerUserPlus',
  CUSTOMER_PROFILE: 'tablerUsers',
  OPPORTUNITY: 'tablerTarget',
  PARTY: 'tablerUser',
};

@Component({
  selector: 'app-incoming-call',
  imports: [RouterLink, TranslocoPipe, NgIcon, AudioRow, StatusLine],
  providers: [
    provideIcons({
      tablerArrowsExchange,
      tablerBellOff,
      tablerPhone,
      tablerPhoneIncoming,
      tablerPhoneOff,
      tablerTarget,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
    }),
  ],
  templateUrl: './incoming-call.html',
  host: {
    '[class]': "floating() ? 'block' : embedded() ? 'flex shrink-0 flex-col gap-8' : 'flex grow shrink-0 flex-col gap-8'",
  },
})
export class IncomingCall {
  protected readonly phone = inject(PhoneState);

  readonly floating = input(false);
  readonly embedded = input(false);
  readonly answerAndTransfer = output<void>();
  readonly dismissed = output<void>();

  protected readonly ringing = computed(() => this.phone.ringing());

  protected sourceIcon(type: CallSource['type']): string {
    return SOURCE_ICON[type];
  }

  protected sourceRoute(source: CallSource): string[] {
    switch (source.type) {
      case 'LEAD':
        return ['/crm/leads', source.id];
      case 'CUSTOMER_PROFILE':
        return ['/crm/customers', source.id];
      case 'OPPORTUNITY':
        return ['/crm/opportunities', source.id];
      case 'PARTY':
        return ['/workspace/operations/party-directory'];
    }
  }

  protected onAnswer(event?: Event): void {
    event?.stopPropagation();
    this.phone.answer();
    this.phone.open('phone');
  }

  protected onDecline(event?: Event): void {
    event?.stopPropagation();
    this.phone.decline();
  }

  protected onSilence(event?: Event): void {
    event?.stopPropagation();
    this.phone.silenceRing();
    if (this.floating()) {
      this.dismissed.emit();
    }
  }

  protected onAnswerAndTransfer(event?: Event): void {
    event?.stopPropagation();
    this.phone.answer();
    this.phone.open('phone');
    this.answerAndTransfer.emit();
  }
}
