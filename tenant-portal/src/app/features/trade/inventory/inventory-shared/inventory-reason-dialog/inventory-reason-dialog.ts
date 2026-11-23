import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle } from '@ng-icons/tabler-icons';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  type ReasonPickerValue,
  TradeReasonPicker,
} from '../../../shared/pickers/reason-picker/reason-picker';
import { tradeContext } from '../../../shared/trade-api';
import { listReasons } from '../../../shared/trade-foundation.api';
import type { ReasonCode } from '../../../shared/trade-foundation.model';
import type { InventoryReasonKind } from '../../inventory.model';

function emptyChoice(): ReasonPickerValue {
  return { reasonCodeId: null, note: '' };
}

@Component({
  selector: 'app-inventory-reason-dialog',
  imports: [Modal, Button, TradeReasonPicker, TranslocoPipe],
  providers: [provideIcons({ tablerAlertTriangle })],
  templateUrl: './inventory-reason-dialog.html',
})
export class InventoryReasonDialog {
  private readonly scope = inject(ScopeState);
  private readonly modal = viewChild.required<Modal>('dialog');
  private readonly picker = viewChild(TradeReasonPicker);

  readonly kind = input.required<InventoryReasonKind>();
  readonly title = input('');
  readonly message = input('');
  readonly subtitle = input('');
  readonly confirmLabel = input('');
  readonly tone = input<'danger' | 'primary'>('primary');
  readonly pending = input(false);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly choice = signal<ReasonPickerValue>(emptyChoice());
  protected readonly showErrors = signal(false);
  protected readonly resolving = signal(false);
  private readonly loadedReasons = signal<readonly ReasonCode[]>([]);

  protected readonly pickerValid = computed(() => this.picker()?.valid() ?? false);

  private loadSeq = 0;
  private suppressCancelled = false;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const kind = this.kind();
      if (!open) return;
      untracked(() => void this.loadReasonsForOpen(kind));
    });
  }

  open(): void {
    this.choice.set(emptyChoice());
    this.showErrors.set(false);
    this.loadedReasons.set([]);
    this.isOpen.set(true);
    this.modal().open();
  }

  close(): void {
    this.suppressCancelled = true;
    try {
      this.modal().close();
    } finally {
      this.suppressCancelled = false;
    }
  }

  protected async onConfirm(): Promise<void> {
    if (this.pending() || this.resolving()) return;
    this.showErrors.set(true);
    if (!this.pickerValid()) return;

    const reasonCodeId = this.choice().reasonCodeId;
    if (!reasonCodeId) return;

    let matched = this.loadedReasons().find((reason) => reason.id === reasonCodeId);
    if (!matched) {
      const seq = this.loadSeq;
      this.resolving.set(true);
      try {
        const fresh = await listReasons(this.kind(), undefined, tradeContext(this.scope, 'COMPANY'));
        if (seq !== this.loadSeq || !this.isOpen()) return;
        this.loadedReasons.set(fresh);
        matched = fresh.find((reason) => reason.id === reasonCodeId);
      } catch {
        return;
      } finally {
        this.resolving.set(false);
      }
    }

    if (!matched) return;
    this.confirmed.emit(matched.code);
  }

  protected onCancelClick(): void {
    if (this.pending() || this.resolving()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.suppressCancelled && (this.pending() || this.resolving())) {
      this.modal().open();
      return;
    }
    this.loadSeq += 1;
    this.isOpen.set(false);
    this.loadedReasons.set([]);
    this.showErrors.set(false);
    if (!this.suppressCancelled) {
      this.cancelled.emit();
    }
  }

  private async loadReasonsForOpen(kind: InventoryReasonKind): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const rows = await listReasons(kind, undefined, tradeContext(this.scope, 'COMPANY'));
      if (seq !== this.loadSeq) return;
      this.loadedReasons.set(rows);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadedReasons.set([]);
    }
  }
}
