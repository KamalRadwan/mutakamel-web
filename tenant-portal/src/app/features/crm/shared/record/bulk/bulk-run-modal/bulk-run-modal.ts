import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoScopeInherited } from '../../../../../../core/i18n/transloco-scope';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArchive,
  tablerArrowsExchange,
  tablerCalendarPlus,
  tablerCheck,
  tablerEdit,
  tablerFileExport,
  tablerLoader2,
  tablerLock,
  tablerMail,
  tablerSend,
  tablerTrash,
  tablerUserShare,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal, ModalSize } from '../../../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-bulk-run-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'record-bulk', alias: 'recordBulk' })],
  providers: [
    provideIcons({
      tablerLoader2,
      tablerUserShare,
      tablerArrowsExchange,
      tablerCalendarPlus,
      tablerTrash,
      tablerArchive,
      tablerEdit,
      tablerCheck,
      tablerAlertTriangle,
      tablerLock,
      tablerFileExport,
      tablerSend,
      tablerMail,
      tablerUsers,
    }),
  ],
  templateUrl: './bulk-run-modal.html',
})
export class BulkRunModal {
  private static nextId = 0;
  protected readonly uid = `bulk-run-modal-${++BulkRunModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  // Ensure the record-bulk scope loads even when callers override every default label.
  private readonly scopeLoaded = toSignal(
    this.transloco.selectTranslate('run.cancel', {}, { scope: 'record-bulk', alias: 'recordBulk' }),
  );
  private readonly modal = viewChild.required(Modal);

  readonly size = input<ModalSize>('form');
  readonly icon = input('');
  readonly tile = input('bg-icon-blue');
  readonly title = input.required<string>();
  readonly count = input(0);
  readonly summary = input<string | null>(null);
  readonly tone = input<'brand' | 'danger'>('brand');
  readonly dismissable = input<boolean | null>(null);
  readonly resolving = input(false);
  readonly submitting = input(false);
  readonly canSubmit = input(true);
  readonly closeOnCancel = input(true);
  readonly submitLabel = input<string | null>(null);
  readonly cancelLabel = input<string | null>(null);
  readonly typedConfirm = input(0);
  readonly typedConfirmLabel = input<string | null>(null);
  readonly typedConfirmHint = input<string | null>(null);
  readonly typedConfirmWords = input<readonly string[]>(['delete', 'حذف']);

  readonly submit = output<void>();
  readonly cancel = output<void>();
  readonly closed = output<void>();

  protected readonly confirmText = signal('');

  protected readonly resolvedSummary = computed(() => {
    this.i18n();
    this.scopeLoaded();
    return this.summary() ?? this.transloco.translate('recordBulk.run.count', { n: this.count() });
  });

  protected readonly resolvedSubmitLabel = computed(() => {
    this.i18n();
    this.scopeLoaded();
    return this.submitLabel() ?? this.transloco.translate('recordBulk.run.submit');
  });

  protected readonly resolvedCancelLabel = computed(() => {
    this.i18n();
    this.scopeLoaded();
    return this.cancelLabel() ?? this.transloco.translate('recordBulk.run.cancel');
  });

  protected readonly resolvedTypedConfirmLabel = computed(() => {
    this.i18n();
    this.scopeLoaded();
    return this.typedConfirmLabel() ?? this.transloco.translate('recordBulk.run.typeLabel');
  });

  protected readonly resolvedTypedConfirmHint = computed(() => {
    this.i18n();
    this.scopeLoaded();
    return this.typedConfirmHint() ?? this.transloco.translate('recordBulk.run.typeHint');
  });

  protected readonly resolvedDismissable = computed(() => {
    const explicit = this.dismissable();
    if (explicit !== null) return explicit;
    return this.tone() !== 'danger' && !this.submitting() && !this.resolving();
  });

  protected readonly needsTypedConfirm = computed(
    () => this.typedConfirm() > 0 && this.count() >= this.typedConfirm(),
  );

  protected readonly typedConfirmValid = computed(() => {
    if (!this.needsTypedConfirm()) return true;
    const clean = this.confirmText().trim().toLowerCase();
    return this.typedConfirmWords().some((word) => word.trim().toLowerCase() === clean);
  });

  protected readonly submitDisabled = computed(
    () => this.submitting() || this.resolving() || !this.canSubmit() || !this.typedConfirmValid(),
  );

  open(): void {
    this.confirmText.set('');
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onConfirmInput(event: Event): void {
    this.confirmText.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(): void {
    if (this.submitDisabled()) return;
    this.submit.emit();
  }

  protected onCancel(): void {
    if (this.submitting()) return;
    this.cancel.emit();
    if (this.closeOnCancel()) {
      this.close();
    }
  }

  protected onClosed(): void {
    this.confirmText.set('');
    this.closed.emit();
  }
}
