import {
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerPlayerPause } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  TradeReasonPicker,
  type ReasonPickerValue,
} from '../../../shared/pickers/reason-picker/reason-picker';
import { listReasons } from '../../../shared/trade-foundation.api';
import type { ReasonCode, ReasonKind } from '../../../shared/trade-foundation.model';

export interface ReasonDialogResult {
  reasonCode: string;
  reasonNote: string | null;
}

function emptyPickerValue(): ReasonPickerValue {
  return { reasonCodeId: null, note: '' };
}

@Component({
  selector: 'app-reason-dialog',
  imports: [TranslocoPipe, Button, Modal, TradeReasonPicker],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents-actions', alias: 'tda' },
    ),
  ],
  providers: [provideIcons({ tablerCircleX, tablerPlayerPause })],
  templateUrl: './reason-dialog.html',
})
export class ReasonDialog {
  private static nextId = 0;
  protected readonly uid = `doc-reason-${++ReasonDialog.nextId}`;

  private readonly modal = viewChild.required(Modal);
  private readonly picker = viewChild(TradeReasonPicker);

  readonly open = model(false);
  readonly reasonKind = input.required<ReasonKind>();
  readonly titleKey = input.required<string>();
  readonly textKey = input.required<string>();
  readonly confirmKey = input.required<string>();
  readonly danger = input(true);

  readonly confirmed = output<ReasonDialogResult>();

  protected readonly pickerValue = signal<ReasonPickerValue>(emptyPickerValue());
  protected readonly showErrors = signal(false);
  protected readonly submitting = signal(false);
  private readonly reasons = signal<ReasonCode[]>([]);
  private loadSeq = 0;
  private loadedKind: ReasonKind | null = null;

  protected readonly canConfirm = computed(
    () => !this.submitting() && (this.picker()?.valid() ?? false),
  );

  constructor() {
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (isOpen) {
          this.pickerValue.set(emptyPickerValue());
          this.showErrors.set(false);
          this.submitting.set(false);
          this.modal().open();
        } else {
          this.modal().close();
        }
      });
    });

    effect(() => {
      const isOpen = this.open();
      const kind = this.reasonKind();
      if (!isOpen) return;
      untracked(() => void this.loadReasons(kind));
    });
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.showErrors.set(true);
    if (!(this.picker()?.valid() ?? false)) return;

    const { reasonCodeId, note } = this.pickerValue();
    if (!reasonCodeId) return;

    const kind = this.reasonKind();
    let matched = this.reasons().find((reason) => reason.id === reasonCodeId);
    if (!matched || this.loadedKind !== kind) {
      this.submitting.set(true);
      try {
        const rows = await listReasons(kind);
        if (!this.open() || this.reasonKind() !== kind) return;
        this.reasons.set(rows);
        this.loadedKind = kind;
        matched = rows.find((reason) => reason.id === reasonCodeId);
      } catch {
        return;
      } finally {
        this.submitting.set(false);
      }
    }

    if (!matched || !this.open()) return;
    const trimmedNote = note.trim();
    this.open.set(false);
    this.confirmed.emit({
      reasonCode: matched.code,
      reasonNote: trimmedNote.length > 0 ? trimmedNote : null,
    });
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.open.set(false);
  }

  protected onModalClosed(): void {
    this.submitting.set(false);
    if (this.open()) {
      this.open.set(false);
    }
  }

  private async loadReasons(kind: ReasonKind): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const rows = await listReasons(kind);
      if (seq !== this.loadSeq) return;
      this.reasons.set(rows);
      this.loadedKind = kind;
    } catch {
      if (seq !== this.loadSeq) return;
      this.reasons.set([]);
      this.loadedKind = null;
    }
  }
}
