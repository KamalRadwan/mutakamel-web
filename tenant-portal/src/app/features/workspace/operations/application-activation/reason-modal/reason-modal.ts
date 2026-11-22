import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerBuildingStore, tablerPuzzle } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import {
  ACTIVATION_REASON_MAX,
  ACTIVATION_REASON_MIN,
  CONTROL_CHAR_PATTERN,
} from '../activation.model';

export interface ReasonModalRequest {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  icon?: string;
  tile?: string;
}

export type ReasonSubmitHandler = (reason: string, idempotencyKey: string) => Promise<boolean>;

@Component({
  selector: 'app-activation-reason-modal',
  imports: [TranslocoPipe, Button, Field, Modal],
  providers: [provideIcons({ tablerPuzzle, tablerBuildingStore })],
  templateUrl: './reason-modal.html',
})
export class ReasonModal {
  private static nextId = 0;
  protected readonly uid = `activation-reason-modal-${++ReasonModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly maxReason = ACTIVATION_REASON_MAX;
  protected readonly title = signal('');
  protected readonly confirmLabel = signal('');
  protected readonly danger = signal(false);
  protected readonly icon = signal('tablerPuzzle');
  protected readonly tile = signal('bg-icon-green');

  protected readonly reason = signal('');
  protected readonly touched = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);

  // UTF-16 units, the same count the backend applies to the 3..500 limit.
  protected readonly reasonCount = computed(() => this.reason().length);

  protected readonly reasonError = computed(() => {
    this.i18n();
    if (!this.touched() && !this.submitAttempted()) return null;

    const trimmed = this.reason().trim();
    if (!trimmed) {
      return this.transloco.translate('wsActivation.validation.reasonRequired');
    }
    if (CONTROL_CHAR_PATTERN.test(trimmed)) {
      return this.transloco.translate('wsActivation.validation.reasonNoControlChars');
    }
    const len = trimmed.length;
    if (len < ACTIVATION_REASON_MIN) {
      return this.transloco.translate('wsActivation.validation.reasonMin', {
        min: ACTIVATION_REASON_MIN,
      });
    }
    if (len > ACTIVATION_REASON_MAX) {
      return this.transloco.translate('wsActivation.validation.reasonMax', {
        max: ACTIVATION_REASON_MAX,
      });
    }
    return null;
  });

  private submitHandler: ReasonSubmitHandler | null = null;
  private allowClose = false;
  private lastSubmittedReason = '';
  private lastIdempotencyKey = '';

  open(request: ReasonModalRequest, onSubmit: ReasonSubmitHandler): void {
    this.allowClose = false;
    this.submitHandler = onSubmit;
    this.title.set(request.title);
    this.confirmLabel.set(request.confirmLabel);
    this.danger.set(Boolean(request.danger));
    this.icon.set(request.icon ?? 'tablerPuzzle');
    this.tile.set(request.tile ?? (request.danger ? 'bg-icon-red' : 'bg-icon-green'));
    this.reason.set('');
    this.touched.set(false);
    this.submitAttempted.set(false);
    this.submitting.set(false);
    this.lastSubmittedReason = '';
    this.lastIdempotencyKey = '';

    this.modal().open();
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLTextAreaElement>(`#${this.uid}-reason`)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected markTouched(): void {
    this.touched.set(true);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting() || !this.submitHandler) return;

    this.submitAttempted.set(true);
    if (this.reasonError()) return;

    const trimmed = this.reason().trim();
    if (trimmed !== this.lastSubmittedReason || !this.lastIdempotencyKey) {
      this.lastSubmittedReason = trimmed;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.submitting.set(true);
    try {
      const shouldClose = await this.submitHandler(trimmed, this.lastIdempotencyKey);
      if (shouldClose) {
        this.closeImmediate();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.submitting()) {
      this.modal().open();
      return;
    }
    this.allowClose = false;
    this.submitHandler = null;
    this.reason.set('');
    this.touched.set(false);
    this.submitAttempted.set(false);
    this.lastSubmittedReason = '';
    this.lastIdempotencyKey = '';
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }
}
