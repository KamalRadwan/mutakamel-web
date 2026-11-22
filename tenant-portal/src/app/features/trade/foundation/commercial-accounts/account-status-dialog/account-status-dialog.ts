import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { tablerLock, tablerLockOpen } from '@ng-icons/tabler-icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import type { ReasonKind } from '../../../shared/trade-foundation.model';
import { type ReasonPickerValue, TradeReasonPicker } from '../../../shared/pickers/reason-picker/reason-picker';
import {
  type AccountStatusTransitionInput,
  type AccountWithParty,
  partyDisplayName,
} from '../commercial-accounts.model';

const MAX_EVIDENCE_LENGTH = 240;

function emptyReasonValue(): ReasonPickerValue {
  return { reasonCodeId: null, note: '' };
}

@Component({
  selector: 'app-account-status-dialog',
  imports: [TranslocoPipe, Button, Field, Modal, TradeReasonPicker],
  providers: [provideIcons({ tablerLock, tablerLockOpen })],
  templateUrl: './account-status-dialog.html',
})
export class AccountStatusDialog {
  private static nextId = 0;

  private readonly language = inject(LanguageState).current;
  private readonly modal = viewChild.required(Modal);
  private readonly reasonPicker = viewChild(TradeReasonPicker);

  protected readonly uid = `account-status-dialog-${++AccountStatusDialog.nextId}`;
  protected readonly maxEvidenceLength = MAX_EVIDENCE_LENGTH;

  readonly mode = input<'block' | 'unblock'>('block');
  readonly account = input<AccountWithParty | null>(null);
  readonly saving = input(false);

  readonly confirmed = output<AccountStatusTransitionInput>();
  readonly cancelled = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly reasonValue = signal<ReasonPickerValue>(emptyReasonValue());
  protected readonly evidenceRef = signal('');
  protected readonly attempted = signal(false);

  private submittedConfirm = false;

  protected readonly reasonKind = computed<ReasonKind>(() =>
    this.mode() === 'block' ? 'ACCOUNT_BLOCK' : 'ACCOUNT_UNBLOCK',
  );

  protected readonly subtitle = computed(() => {
    const acc = this.account();
    return acc ? partyDisplayName(acc.party, this.language()) || acc.partyId : '';
  });

  protected readonly pickerValid = computed(() => this.reasonPicker()?.valid() ?? false);

  open(): void {
    this.submittedConfirm = false;
    this.reasonValue.set(emptyReasonValue());
    this.evidenceRef.set('');
    this.attempted.set(false);
    this.isOpen.set(true);
    this.modal().open();
  }

  close(): void {
    this.submittedConfirm = true;
    this.modal().close();
  }

  protected onEvidenceInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_EVIDENCE_LENGTH);
    this.evidenceRef.set(value);
  }

  protected submit(): void {
    if (this.saving()) return;
    this.attempted.set(true);
    if (!this.pickerValid()) return;
    const reasonCodeId = this.reasonValue().reasonCodeId?.trim();
    if (!reasonCodeId) return;

    const reasonNote = this.reasonValue().note.trim();
    const evidenceRef = this.evidenceRef().trim();
    this.submittedConfirm = true;
    this.confirmed.emit({
      reasonCodeId,
      ...(reasonNote ? { reasonNote } : {}),
      ...(evidenceRef ? { evidenceRef } : {}),
    });
  }

  protected requestCancel(): void {
    if (this.saving()) return;
    this.submittedConfirm = false;
    this.modal().close();
  }

  protected onModalClosed(): void {
    const wasConfirmed = this.submittedConfirm;
    this.submittedConfirm = false;
    this.isOpen.set(false);
    if (!wasConfirmed) {
      this.cancelled.emit();
    }
  }
}
