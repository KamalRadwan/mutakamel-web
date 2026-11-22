import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBackspace,
  tablerDialpad,
  tablerPhone,
  tablerPhoneEnd,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerUsersPlus,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../shared/ui/field/field';
import { AudioRow } from '../audio-row/audio-row';
import { CallRows } from '../call-rows/call-rows';
import { Keypad } from '../keypad/keypad';
import { StatusLine } from '../status-line/status-line';

type ConferenceSubView = 'main' | 'keypad' | 'addParty';

@Component({
  selector: 'app-conference',
  imports: [
    TranslocoPipe,
    NgIcon,
    Field,
    Dropdown,
    ConfirmDialog,
    CallRows,
    Keypad,
    AudioRow,
    StatusLine,
  ],
  providers: [
    provideIcons({
      tablerBackspace,
      tablerDialpad,
      tablerPhone,
      tablerPhoneEnd,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerUsersPlus,
    }),
  ],
  templateUrl: './conference.html',
  host: { class: 'flex min-w-0 grow shrink-0 flex-col gap-8' },
})
export class Conference {
  protected readonly phone = inject(PhoneState);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  protected readonly subView = signal<ConferenceSubView>('main');
  protected readonly partyNumber = signal('');
  private readonly chosenToneTarget = signal<string | null>(null);

  protected readonly participantCount = computed(() => this.phone.legs().length + 1);
  protected readonly atMaxParties = computed(() => this.phone.legs().length >= this.phone.maxParties);
  protected readonly allHeld = computed(() => {
    const legs = this.phone.legs();
    return legs.length > 0 && legs.every((leg) => leg.held);
  });

  protected readonly toneOptions = computed<DropdownOption<string>[]>(() =>
    this.phone.legs().map((leg) => ({
      value: leg.id,
      label: leg.displayName ? `${leg.displayName} (${leg.number})` : leg.number,
    })),
  );

  protected readonly selectedToneTarget = computed(() => {
    const legs = this.phone.legs();
    const chosen = this.chosenToneTarget();
    if (chosen && legs.some((leg) => leg.id === chosen)) return chosen;
    const focused = this.phone.focusedLegId();
    if (focused && legs.some((leg) => leg.id === focused)) return focused;
    return legs[0]?.id ?? '';
  });

  protected onSelectToneTarget(legId: string): void {
    this.chosenToneTarget.set(legId);
    this.phone.setToneTarget(legId);
  }

  protected toggleHoldAll(): void {
    if (this.allHeld()) {
      this.phone.resumeAll();
    } else {
      this.phone.holdAll();
    }
  }

  protected openAddParty(): void {
    this.partyNumber.set('');
    this.subView.set('addParty');
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
    this.subView.set('main');
  }

  protected async confirmEnd(): Promise<void> {
    const confirmed = await this.confirmDialog().open();
    if (confirmed) {
      this.phone.endConference();
    }
  }
}
