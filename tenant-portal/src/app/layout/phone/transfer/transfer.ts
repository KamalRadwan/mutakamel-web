import { Component, ViewEncapsulation, computed, inject, output, signal } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerBackspace,
  tablerLoader2,
  tablerPhone,
} from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { Field } from '../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { AudioRow } from '../audio-row/audio-row';
import { Keypad } from '../keypad/keypad';
import { StatusLine } from '../status-line/status-line';

type TransferKind = 'consult' | 'blind';

@Component({
  selector: 'app-transfer',
  imports: [TranslocoPipe, NgIcon, Field, Segmented, Keypad, AudioRow, StatusLine],
  providers: [provideIcons({ tablerArrowsExchange, tablerBackspace, tablerLoader2, tablerPhone })],
  templateUrl: './transfer.html',
  styleUrl: './transfer.css',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'flex min-w-0 grow shrink-0 flex-col gap-8' },
})
export class Transfer {
  private readonly transloco = inject(TranslocoService);
  private readonly translation = translationEvents(this.transloco);
  protected readonly phone = inject(PhoneState);

  readonly cancelled = output<void>();

  protected readonly transferKind = signal<string | null>('consult');

  protected readonly typeOptions = computed<readonly SegmentedOption[]>(() => {
    this.translation();
    return [
      { value: 'consult', label: this.transloco.translate('webPhone.transfer.talkFirst') },
      { value: 'blind', label: this.transloco.translate('webPhone.transfer.direct') },
    ];
  });

  protected readonly transferring = computed(() => this.phone.status().code === 'transferring');
  protected readonly isDirect = computed(() => (this.transferKind() as TransferKind | null) === 'blind');

  protected readonly callTargetParts = computed(() => {
    this.translation();
    const sentinel = '\uE000';
    const raw = this.transloco.translate('webPhone.transfer.callTarget', { target: sentinel });
    const idx = raw.indexOf(sentinel);
    const target = this.phone.transferValue().trim();
    if (idx === -1) {
      return { before: raw, target: '', after: '' };
    }
    return {
      before: raw.slice(0, idx),
      target,
      after: raw.slice(idx + sentinel.length),
    };
  });

  protected onInput(event: Event): void {
    this.phone.transferValue.set((event.target as HTMLInputElement).value);
  }

  protected pressKey(key: string): void {
    this.phone.transferValue.update((current) => current + key);
  }

  protected deleteKey(): void {
    this.phone.transferValue.update((current) => current.slice(0, -1));
  }

  protected async submit(): Promise<void> {
    const target = this.phone.transferValue().trim();
    if (!target || this.transferring()) return;
    if (this.isDirect()) {
      this.phone.blindTransfer(target);
      return;
    }
    await this.phone.startConsult(target);
    this.cancelled.emit();
  }
}
