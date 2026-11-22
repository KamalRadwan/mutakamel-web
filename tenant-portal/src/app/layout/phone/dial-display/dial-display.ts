import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBackspace,
  tablerCopy,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { sourceRoute } from '../status-line/status-line';

type CallSourceType = NonNullable<ReturnType<PhoneState['dialSource']>>['type'];

const SOURCE_ICON: Record<CallSourceType, string> = {
  LEAD: 'tablerUserPlus',
  CUSTOMER_PROFILE: 'tablerUsers',
  OPPORTUNITY: 'tablerTarget',
  PARTY: 'tablerUser',
};

@Component({
  selector: 'app-dial-display',
  imports: [RouterLink, TranslocoPipe, NgIcon],
  providers: [
    provideIcons({
      tablerBackspace,
      tablerCopy,
      tablerTarget,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './dial-display.html',
  host: { class: 'flex min-w-0 shrink-0 flex-col gap-8' },
})
export class DialDisplay {
  protected readonly phone = inject(PhoneState);
  protected readonly sourceRoute = sourceRoute;

  protected readonly leg = computed(() => this.phone.focusedLeg());

  protected readonly inCall = computed(() => {
    const state = this.phone.callState();
    if (state === 'calling' || state === 'ringing' || state === 'active') return true;
    return this.phone.legs().some((l) => l.state === 'calling' || l.state === 'ringing' || l.state === 'active');
  });

  protected readonly isActive = computed(() => this.phone.callState() === 'active');

  protected readonly displayNumber = computed(() =>
    this.inCall() ? (this.leg()?.number ?? this.phone.dialValue()) : this.phone.dialValue(),
  );

  protected readonly callName = computed(() => {
    const current = this.leg();
    if (!current) return null;
    const candidate = (current.displayName || current.source?.label || '').trim();
    return candidate && candidate !== current.number ? candidate : null;
  });

  protected readonly callSource = computed(() => this.leg()?.source ?? null);

  protected readonly callDisabled = computed(() => {
    const notice = this.phone.mediaNotice();
    const micBlocked =
      this.phone.micPermission() === 'denied' || notice === 'permissionDenied' || notice === 'noMicrophone';
    return !this.phone.dialValue() || micBlocked;
  });

  protected sourceIcon(type: CallSourceType): string {
    return SOURCE_ICON[type];
  }

  protected onInput(event: Event): void {
    if (this.inCall()) return;
    const value = (event.target as HTMLInputElement).value;
    this.phone.dialValue.set(value);
  }

  protected onDialInputKeydown(event: KeyboardEvent): void {
    if (this.inCall()) {
      if (this.isActive() && !event.ctrlKey && !event.metaKey && !event.altKey && /^[0-9*#]$/.test(event.key)) {
        event.preventDefault();
        this.phone.pressKey(event.key);
      }
      return;
    }
    if (event.key === 'Enter' && !this.callDisabled()) {
      event.preventDefault();
      void this.phone.call();
    }
  }
}
