import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerX } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  type ReasonPickerValue,
  TradeReasonPicker,
} from '../../../shared/pickers/reason-picker/reason-picker';
import { listReasons } from '../../../shared/trade-foundation.api';
import type { ReasonCode, ReasonKind } from '../../../shared/trade-foundation.model';

export interface ReasonDialogResult {
  reasonCode: string;
  reasonNote: string;
}

@Component({
  selector: 'app-reason-dialog',
  imports: [TranslocoPipe, Button, Modal, TradeReasonPicker],
  providers: [provideIcons({ tablerArrowBackUp, tablerX })],
  templateUrl: './reason-dialog.html',
})
export class ReasonDialog {
  private static nextId = 0;
  protected readonly uid = `gov-reason-dialog-${++ReasonDialog.nextId}`;

  private readonly modal = viewChild.required(Modal);
  private readonly picker = viewChild(TradeReasonPicker);

  readonly title = input('');
  readonly text = input('');
  readonly kind = input.required<ReasonKind>();
  readonly required = input(true);
  readonly confirmLabel = input('');
  readonly tone = input<'danger' | 'primary'>('danger');
  readonly loading = input(false);

  readonly confirmed = output<ReasonDialogResult>();
  readonly cancelled = output<void>();

  protected readonly dialogOpen = signal(false);
  protected readonly choice = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly submitted = signal(false);
  private readonly reasons = signal<ReasonCode[]>([]);

  private loadSeq = 0;
  private confirmedClosing = false;

  protected readonly confirmDisabled = computed(
    () => this.loading() || !(this.picker()?.valid() ?? false),
  );

  async open(): Promise<void> {
    this.confirmedClosing = false;
    this.choice.set({ reasonCodeId: null, note: '' });
    this.submitted.set(false);
    this.reasons.set([]);
    this.dialogOpen.set(true);

    this.modal().open();

    const seq = ++this.loadSeq;
    try {
      const rows = await listReasons(this.kind());
      if (seq !== this.loadSeq) return;
      this.reasons.set(rows);
    } catch {
      if (seq !== this.loadSeq) return;
      this.reasons.set([]);
    }
  }

  close(): void {
    this.modal().close();
  }

  protected async confirm(): Promise<void> {
    this.submitted.set(true);
    if (this.loading()) return;

    const picker = this.picker();
    if (!picker || !picker.valid()) return;

    const pickedId = this.choice().reasonCodeId;
    if (!pickedId) return;

    const kind = this.kind();
    let matched = this.reasons().find((r) => r.id === pickedId && r.kind === kind);
    if (!matched) {
      const fresh = await listReasons(kind).catch((): ReasonCode[] => []);
      this.reasons.set(fresh);
      matched = fresh.find((r) => r.id === pickedId && r.kind === kind);
    }
    if (!matched) return;

    const payload: ReasonDialogResult = {
      reasonCode: matched.code,
      reasonNote: this.choice().note.trim(),
    };
    this.confirmedClosing = true;
    this.modal().close();
    this.confirmed.emit(payload);
  }

  protected cancel(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.dialogOpen.set(false);
    if (this.confirmedClosing) {
      this.confirmedClosing = false;
      return;
    }
    this.cancelled.emit();
  }
}
