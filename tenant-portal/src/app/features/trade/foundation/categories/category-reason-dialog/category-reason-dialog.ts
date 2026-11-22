import { Component, computed, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerToggleRight, tablerTrash } from '@ng-icons/tabler-icons';
import type { ReasonKind } from '../../../shared/trade-foundation.model';
import { type ReasonPickerValue, TradeReasonPicker } from '../../../shared/pickers/reason-picker/reason-picker';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import type { CategoryReasonPayload } from '../categories.model';

export type CategoryReasonMode = 'deactivate' | 'activate' | 'delete';

@Component({
  selector: 'app-category-reason-dialog',
  imports: [TranslocoPipe, Button, Modal, TradeReasonPicker],
  providers: [provideIcons({ tablerToggleRight, tablerTrash })],
  templateUrl: './category-reason-dialog.html',
})
export class CategoryReasonDialog {
  private static nextId = 0;
  protected readonly uid = `category-reason-${++CategoryReasonDialog.nextId}`;

  private readonly modal = viewChild.required(Modal);
  private readonly picker = viewChild(TradeReasonPicker);

  readonly confirmed = output<CategoryReasonPayload>();

  protected readonly mode = signal<CategoryReasonMode>('deactivate');
  protected readonly targetName = signal('');
  protected readonly isOpen = signal(false);
  protected readonly pickerValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly showErrors = signal(false);
  protected readonly submitting = signal(false);

  protected readonly reasonKind = computed<ReasonKind>(() =>
    this.mode() === 'delete' ? 'CATEGORY_DELETE' : 'CATEGORY_STATUS',
  );

  protected readonly pickerValid = computed(() => this.picker()?.valid() ?? false);

  protected readonly modalIcon = computed(() => (this.mode() === 'delete' ? 'tablerTrash' : 'tablerToggleRight'));

  protected readonly modalTile = computed(() => {
    switch (this.mode()) {
      case 'delete':
        return 'bg-icon-red';
      case 'activate':
        return 'bg-icon-green';
      case 'deactivate':
        return 'bg-icon-orange';
    }
  });

  protected readonly titleKey = computed(() => {
    switch (this.mode()) {
      case 'delete':
        return 'tradeCategories.reason.deleteTitle';
      case 'activate':
        return 'tradeCategories.reason.activateTitle';
      case 'deactivate':
        return 'tradeCategories.reason.deactivateTitle';
    }
  });

  protected readonly textKey = computed(() => {
    switch (this.mode()) {
      case 'delete':
        return 'tradeCategories.reason.deleteText';
      case 'activate':
        return 'tradeCategories.reason.activateText';
      case 'deactivate':
        return 'tradeCategories.reason.deactivateText';
    }
  });

  protected readonly confirmKey = computed(() => {
    switch (this.mode()) {
      case 'delete':
        return 'tradeCategories.actions.delete';
      case 'activate':
        return 'tradeCategories.actions.activate';
      case 'deactivate':
        return 'tradeCategories.actions.deactivate';
    }
  });

  open(opts: { mode: CategoryReasonMode; name: string }): void {
    this.mode.set(opts.mode);
    this.targetName.set(opts.name);
    this.pickerValue.set({ reasonCodeId: null, note: '' });
    this.showErrors.set(false);
    this.submitting.set(false);
    this.isOpen.set(true);
    this.modal().open();
  }

  setSubmitting(busy: boolean): void {
    this.submitting.set(busy);
  }

  close(): void {
    this.submitting.set(false);
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.isOpen.set(false);
    this.submitting.set(false);
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.showErrors.set(true);
    if (!this.pickerValid()) return;
    const { reasonCodeId, note } = this.pickerValue();
    if (!reasonCodeId) return;
    const trimmedNote = note.trim();
    this.confirmed.emit(trimmedNote.length > 0 ? { reasonCodeId, reasonNote: trimmedNote } : { reasonCodeId });
  }
}
