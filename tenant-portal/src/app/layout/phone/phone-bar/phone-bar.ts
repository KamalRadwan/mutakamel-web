import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronUp,
  tablerLoader2,
  tablerMicrophone,
  tablerMicrophoneOff,
  tablerPhoneEnd,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-phone-bar',
  imports: [TranslocoPipe, NgIcon, ConfirmDialog],
  providers: [
    provideIcons({
      tablerChevronUp,
      tablerLoader2,
      tablerMicrophone,
      tablerMicrophoneOff,
      tablerPhoneEnd,
    }),
  ],
  templateUrl: './phone-bar.html',
})
export class PhoneBar {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly buttonRef = viewChild<ElementRef<HTMLButtonElement>>('btn');
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  protected readonly phone = inject(PhoneState);

  protected readonly isCallingOrRinging = computed(() => {
    const state = this.phone.callState();
    return state === 'calling' || state === 'ringing';
  });

  protected readonly isConference = computed(() => this.phone.mode() === 'conference');
  protected readonly participantCount = computed(() => this.phone.legs().length + 1);

  protected readonly peerHasName = computed(() =>
    Boolean((this.phone.focusedLeg() ?? this.phone.legs()[0])?.displayName),
  );

  protected readonly peerName = computed(() => {
    this.i18n();
    const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
    return leg ? leg.displayName || leg.number : this.transloco.translate('webPhone.title');
  });

  protected readonly conferenceLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('webPhone.conference.header', { n: this.participantCount() });
  });

  protected readonly hangupLabel = computed(() => {
    this.i18n();
    if (this.isConference()) {
      return this.transloco.translate('webPhone.conference.endForAll');
    }
    return this.transloco.translate('webPhone.pill.hangupWith', { name: this.peerName() });
  });

  protected readonly dotClass = computed(() => {
    if (this.phone.ringing()) return 'bg-on-success';
    const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
    if (this.phone.busy() && leg?.held) return 'bg-warning';
    const conn = this.phone.connection();
    const code = this.phone.status().code;
    if (this.phone.paused() || !this.phone.configured() || conn === 'offline' || conn === 'idle') {
      return 'bg-status-none';
    }
    if (conn === 'registered') return 'bg-success';
    if (conn === 'loading' || conn === 'ready' || conn === 'connecting' || code === 'failingOver') {
      return 'bg-warning';
    }
    return 'bg-danger';
  });

  protected readonly badgeText = computed(() => {
    const count = this.phone.missedCount();
    return count > 99 ? '99+' : String(count);
  });

  protected readonly formattedTime = computed(() => {
    const total = Math.max(0, Math.floor(this.phone.timer()));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
  });

  protected readonly statusWord = computed(() => {
    this.i18n();
    return this.transloco.translate(`webPhone.launcher.${this.statusKey()}`);
  });

  /** The last call's ended summary while the phone is idle (kept in the bar after the panel folds); missed calls win. */
  protected readonly endedInfo = computed(() =>
    !this.phone.busy() && !this.phone.ringing() && this.phone.missedCount() === 0 ? this.phone.ended() : null,
  );

  protected readonly endedWord = computed(() => {
    this.i18n();
    const ended = this.endedInfo();
    return ended ? this.transloco.translate(`webPhone.ended.reasons.${ended.reason}`) : '';
  });

  protected readonly ariaLabel = computed(() => {
    this.i18n();
    const ringing = this.phone.ringing();
    if (ringing) {
      const name = ringing.displayName || ringing.number;
      const incoming = this.transloco.translate('webPhone.launcher.incomingFrom', { name });
      return this.transloco.translate('webPhone.bar.openLabel', { status: incoming });
    }
    if (this.phone.busy()) {
      const time = this.isCallingOrRinging()
        ? this.transloco.translate('webPhone.pill.calling')
        : this.formattedTime();
      if (this.isConference()) {
        return this.transloco.translate('webPhone.bar.openConference', {
          n: this.participantCount(),
          time,
        });
      }
      return this.transloco.translate('webPhone.bar.openInCall', {
        name: this.peerName(),
        time,
      });
    }
    const ended = this.endedInfo();
    if (ended) {
      const status = `${ended.name || ended.number} · ${this.endedWord()}`;
      return this.transloco.translate('webPhone.bar.openLabel', { status });
    }
    return this.transloco.translate('webPhone.bar.openLabel', { status: this.statusWord() });
  });

  focus(): void {
    this.buttonRef()?.nativeElement.focus();
  }

  protected onOpen(event?: Event): void {
    event?.stopPropagation();
    this.phone.open();
  }

  protected onToggleMute(event: Event): void {
    event.stopPropagation();
    this.phone.toggleMute();
  }

  protected async onHangup(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.phone.mode() === 'conference') {
      const confirmed = await this.confirmDialog().open();
      if (confirmed) this.phone.endConference();
      return;
    }
    this.phone.hangup();
  }

  private statusKey(): string {
    if (this.phone.paused()) return 'paused';
    const conn = this.phone.connection();
    if (conn === 'registered') return 'registered';
    if (conn === 'connecting' || conn === 'loading' || conn === 'ready' || this.phone.status().code === 'failingOver') {
      return 'connecting';
    }
    if (conn === 'error') return 'error';
    return 'offline';
  }
}
