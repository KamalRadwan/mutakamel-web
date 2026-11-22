import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArchive, tablerArrowBackUp, tablerUpload } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';

export type FunctionReasonMode = 'publish' | 'archive' | 'restore';

export interface FunctionReasonOptions {
  mode: FunctionReasonMode;
  functionName: string;
  versionNumber?: number;
}

@Component({
  selector: 'app-function-reason-modal',
  imports: [TranslocoPipe, Button, Field, Modal],
  providers: [provideIcons({ tablerUpload, tablerArchive, tablerArrowBackUp })],
  templateUrl: './function-reason-modal.html',
})
export class FunctionReasonModal {
  private static nextId = 0;
  protected readonly uid = `fn-reason-modal-${++FunctionReasonModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('reasonModal');

  protected readonly options = signal<FunctionReasonOptions>({
    mode: 'publish',
    functionName: '',
  });
  protected readonly text = signal('');
  protected readonly attempted = signal(false);

  private resolver: ((value: string | null) => void) | null = null;
  private isOpen = false;

  protected readonly modalIcon = computed(() => {
    switch (this.options().mode) {
      case 'publish':
        return 'tablerUpload';
      case 'archive':
        return 'tablerArchive';
      case 'restore':
        return 'tablerArrowBackUp';
    }
  });

  protected readonly modalTile = computed(() => {
    switch (this.options().mode) {
      case 'publish':
        return 'bg-icon-blue';
      case 'archive':
        return 'bg-icon-orange';
      case 'restore':
        return 'bg-icon-teal';
    }
  });

  protected readonly textError = computed(() => {
    this.i18n();
    this.language();
    if (!this.attempted()) return null;
    const trimmed = this.text().trim();
    if (!trimmed) {
      return this.transloco.translate(`tplFunctions.reasonModal.${this.options().mode}.required`);
    }
    if (trimmed.length > 1000) {
      return this.transloco.translate('tplFunctions.reasonModal.tooLong');
    }
    return null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle(null));
  }

  open(options: FunctionReasonOptions): Promise<string | null> {
    this.settle(null);
    this.options.set(options);
    this.text.set('');
    this.attempted.set(false);
    this.isOpen = true;
    this.modal().open();
    return new Promise<string | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onTextInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    this.attempted.set(true);
    const trimmed = this.text().trim();
    if (!trimmed || trimmed.length > 1000) return;
    this.isOpen = false;
    this.modal().close();
    this.settle(trimmed);
  }

  protected cancel(): void {
    this.isOpen = false;
    this.modal().close();
    this.settle(null);
  }

  protected onModalClosed(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.settle(null);
    }
  }

  private settle(value: string | null): void {
    const res = this.resolver;
    this.resolver = null;
    res?.(value);
  }
}
