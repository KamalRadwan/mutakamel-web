import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCopy } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, fieldErrorsOf, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { cloneWidget, getWidget } from '../widgets.api';
import { widgetErrorMessage, widgetNeedsReload, widgetWriteReadOnly } from '../builder/builder-errors';
import type { WidgetSummary } from '../widgets.model';

const MAX_NAME_LEN = 120;

@Component({
  selector: 'app-widget-clone-modal',
  imports: [TranslocoPipe, Button, Field, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widgets', alias: 'widgets' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'crm-widget-page', alias: 'widgetPage' },
    ),
    provideIcons({ tablerCopy }),
  ],
  templateUrl: './clone-modal.html',
  host: { class: 'contents' },
})
export class CloneModal {
  readonly becameReadOnly = output<void>();
  private static nextId = 0;
  protected readonly uid = `widget-clone-${++CloneModal.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly widget = signal<WidgetSummary | null>(null);
  protected readonly name = signal('');
  protected readonly touched = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly readOnly = signal(false);
  private readonly serverNameError = signal(false);
  private cloneIntent: { name: string; key: string } | null = null;

  private openSeq = 0;
  private resolver: ((cloned: boolean) => void) | null = null;
  private settledResult = false;

  protected readonly nameError = computed<string | null>(() => {
    this.i18n();
    const trimmed = this.name().trim();
    if (this.serverNameError()) return this.transloco.translate('analytics.error.CRM_VALIDATION_FAILED');
    if (trimmed.length > MAX_NAME_LEN) {
      return this.transloco.translate('widgets.cloneModal.nameTooLong');
    }
    if ((this.touched() || this.submitAttempted()) && trimmed.length === 0) {
      return this.transloco.translate('widgets.cloneModal.nameRequired');
    }
    return null;
  });

  protected readonly canSubmit = computed<boolean>(() => {
    const len = this.name().trim().length;
    return !this.submitting() && !this.readOnly() && can('crm.widgets.create') && len >= 1 && len <= MAX_NAME_LEN;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.openSeq++;
      this.settle(false);
    });
  }

  open(widget: WidgetSummary): Promise<boolean> {
    this.settle(false);
    this.settledResult = false;
    ++this.openSeq;

    const prefilled = this.transloco
      .translate('widgets.cloneModal.copyName', { name: widget.name })
      .slice(0, MAX_NAME_LEN);

    this.widget.set(widget);
    this.name.set(prefilled);
    this.touched.set(false);
    this.submitAttempted.set(false);
    this.submitting.set(false);
    this.readOnly.set(false);
    this.cloneIntent = null;
    this.serverNameError.set(false);
    this.modal().open();

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onNameInput(event: Event): void {
    this.serverNameError.set(false);
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onNameBlur(): void {
    this.touched.set(true);
  }

  protected onFormSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.openSeq++;
    this.submitting.set(false);
    this.settle(this.settledResult);
  }

  protected async submit(): Promise<void> {
    this.submitAttempted.set(true);
    const source = this.widget();
    if (!source || !this.canSubmit()) return;

    const seq = this.openSeq;
    const targetName = this.name().trim();
    this.submitting.set(true);
    if (this.cloneIntent?.name !== targetName) this.cloneIntent = { name: targetName, key: newIdempotencyKey() };
    try {
      const cloned = await cloneWidget(source.id, targetName, this.cloneIntent.key);
      if (seq !== this.openSeq) return;
      this.notify.success(this.transloco.translate('widgets.cloneModal.clonedToast'));
      this.settledResult = true;
      this.modal().close();
      void this.router.navigate(['/crm/dashboard/widgets', cloned.widgetId, 'builder']);
    } catch (error) {
      if (seq !== this.openSeq) return;
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.cloneIntent = null;
      if (fieldErrorsOf(error)['name']) this.serverNameError.set(true);
      else this.notify.error(widgetErrorMessage(error, this.transloco, 'widgetPage', true));
      if (widgetWriteReadOnly(error) || widgetNeedsReload(error)) this.readOnly.set(true);
      if (widgetWriteReadOnly(error)) this.becameReadOnly.emit();
      if (widgetNeedsReload(error)) {
        try {
          const fresh = await getWidget(source.id);
          if (seq === this.openSeq) this.widget.set(fresh);
        } catch (loadError) {
          if (seq === this.openSeq) this.notify.error(widgetErrorMessage(loadError, this.transloco, 'widgetPage'));
        }
      }
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.settledResult = false;
    resolve?.(result);
  }
}
