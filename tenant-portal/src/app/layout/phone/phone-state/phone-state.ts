import { Component, DOCUMENT, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBuilding,
  tablerCreditCard,
  tablerLoader2,
  tablerLock,
  tablerMicrophone2,
  tablerMicrophoneOff,
  tablerPhoneOff,
  tablerPlugConnectedX,
  tablerServer,
  tablerWifiOff,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { Button } from '../../../shared/ui/button/button';
import { PhoneBlock } from '../call-log-type';

@Component({
  selector: 'app-phone-state',
  imports: [TranslocoPipe, NgIcon, Button],
  providers: [
    provideTranslocoScope({ scope: 'web-phone-calls', alias: 'phoneCalls' }),
    provideIcons({
      tablerServer,
      tablerPlugConnectedX,
      tablerWifiOff,
      tablerLock,
      tablerPhoneOff,
      tablerMicrophoneOff,
      tablerMicrophone2,
      tablerLoader2,
      tablerCreditCard,
      tablerBuilding,
    }),
  ],
  templateUrl: './phone-state.html',
  host: { class: 'flex grow shrink-0 flex-col items-center justify-center gap-8 p-16 text-center' },
})
export class PhoneStateView {
  protected readonly phone = inject(PhoneState);
  private readonly document = inject(DOCUMENT);

  readonly block = input.required<PhoneBlock>();

  /** `scopeMismatch`: the page holds another workspace session, so only a full reload picks up the active tenant. */
  protected reloadPage(): void {
    this.document.location.reload();
  }
}
