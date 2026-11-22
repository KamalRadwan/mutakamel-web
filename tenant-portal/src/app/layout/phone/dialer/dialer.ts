import { Component, ElementRef, computed, effect, inject, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerBackspace,
  tablerPhone,
  tablerPhoneEnd,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerUsersPlus,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { Field } from '../../../shared/ui/field/field';
import { AudioRow } from '../audio-row/audio-row';
import { Keypad } from '../keypad/keypad';
import { StatusLine } from '../status-line/status-line';

@Component({
  selector: 'app-dialer',
  imports: [TranslocoPipe, NgIcon, Field, Keypad, AudioRow, StatusLine],
  providers: [
    provideIcons({
      tablerArrowsExchange,
      tablerBackspace,
      tablerPhone,
      tablerPhoneEnd,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerUsersPlus,
    }),
  ],
  templateUrl: './dialer.html',
  host: {
    class: 'flex min-w-0 grow shrink-0 flex-col gap-8',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class Dialer {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly phone = inject(PhoneState);
  readonly openTransfer = output<void>();

  protected readonly addingParty = signal(false);
  protected readonly partyNumber = signal('');

  protected readonly leg = computed(() => this.phone.focusedLeg());

  protected readonly inCall = computed(() => {
    const state = this.phone.callState();
    return state === 'calling' || state === 'ringing' || state === 'active';
  });

  protected readonly isActive = computed(() => this.phone.callState() === 'active');

  protected readonly micBlockReasonKey = computed(() => {
    const notice = this.phone.mediaNotice();
    if (this.phone.micPermission() === 'denied' || notice === 'permissionDenied') {
      return 'webPhone.mediaNotice.permissionDenied';
    }
    if (notice === 'noMicrophone') {
      return 'webPhone.mediaNotice.noMicrophone';
    }
    return null;
  });

  protected readonly callDisabled = computed(() => !this.phone.dialValue() || this.micBlockReasonKey() !== null);

  constructor() {
    effect(() => {
      if (!this.isActive()) {
        this.addingParty.set(false);
      }
    });
  }

  protected openAddParty(): void {
    this.partyNumber.set('');
    this.addingParty.set(true);
  }

  protected onPartyInput(event: Event): void {
    this.partyNumber.set((event.target as HTMLInputElement).value);
  }

  protected pressPartyKey(key: string): void {
    this.partyNumber.update((current) => current + key);
  }

  protected deletePartyKey(): void {
    this.partyNumber.update((current) => current.slice(0, -1));
  }

  protected async submitAddParty(): Promise<void> {
    const target = this.partyNumber().trim();
    if (!target) return;
    await this.phone.addParty(target);
    this.addingParty.set(false);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.phone.panelOpen() || this.phone.tab() !== 'phone' || this.addingParty()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable || target.closest('input, textarea, select')) return;
      if (event.key === 'Enter' && target.closest('button, a, [role="button"], [role="tab"], [role="switch"]')) return;
      const inPanel = Boolean(target.closest('app-phone-panel') ?? this.host.nativeElement.contains(target));
      const isDocBody = target === target.ownerDocument.body || target === target.ownerDocument.documentElement;
      if (!inPanel && !isDocBody) return;
    }

    if (this.inCall()) {
      if (this.isActive() && /^[0-9*#]$/.test(event.key)) {
        event.preventDefault();
        this.phone.pressKey(event.key);
      }
      return;
    }

    if (/^[0-9*#+]$/.test(event.key)) {
      event.preventDefault();
      this.phone.pressKey(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.phone.deleteKey();
    } else if (event.key === 'Enter' && !this.callDisabled()) {
      event.preventDefault();
      void this.phone.call();
    }
  }
}
