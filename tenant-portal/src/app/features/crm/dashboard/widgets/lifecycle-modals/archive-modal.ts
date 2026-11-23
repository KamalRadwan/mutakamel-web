import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArchive, tablerRestore } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Router } from '@angular/router';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { applyLifecycle, getWidget, lifecycleImpact } from '../widgets.api';
import type { LifecycleImpact, WidgetSummary } from '../widgets.model';
import { widgetConflict, widgetErrorMessage, widgetNeedsReload, widgetReadFailure, widgetWriteReadOnly, type WidgetReadFailure } from '../builder/builder-errors';

const MAX_REASON_LEN = 500;

@Component({
  selector: 'app-widget-archive-modal',
  imports: [TranslocoPipe, Badge, Button, Field, Modal, ConflictDialog, FullState],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widgets', alias: 'widgets' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'crm-widget-page', alias: 'widgetPage' },
    ),
    provideIcons({ tablerArchive, tablerRestore }),
  ],
  templateUrl: './archive-modal.html',
  host: { class: 'contents' },
})
export class ArchiveModal {
  readonly becameReadOnly = output<void>();
  private static nextId = 0;
  protected readonly uid = `widget-archive-${++ArchiveModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly widget = signal<WidgetSummary | null>(null);
  protected readonly action = signal<'ARCHIVE' | 'RESTORE'>('ARCHIVE');
  protected readonly loadingImpact = signal(false);
  protected readonly submitting = signal(false);
  protected readonly impact = signal<LifecycleImpact | null>(null);
  protected readonly reason = signal('');
  protected readonly readOnly = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly readFailure = signal<WidgetReadFailure | null>(null);
  private readonly serverReasonError = signal(false);

  private openSeq = 0;
  private resolver: ((changed: boolean) => void) | null = null;
  private settledResult = false;

  protected readonly dashboardNames = computed<string[]>(() => {
    const imp = this.impact();
    if (!imp) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const p of imp.placements) {
      if (seen.has(p.dashboardId)) continue;
      seen.add(p.dashboardId);
      names.push(p.dashboardName);
    }
    return names;
  });

  protected readonly placementCount = computed<number>(() => {
    const imp = this.impact();
    if (!imp) return 0;
    return this.action() === 'ARCHIVE'
      ? imp.placements.length + imp.hiddenPlacementCount
      : imp.placements.filter((p) => p.eligibleToResume).length;
  });

  protected readonly alertRulesCount = computed<number>(() => this.impact()?.alertRules?.count ?? 0);

  protected readonly alertEffectKey = computed<string>(() => {
    const effect = this.impact()?.alertRules?.effect;
    return effect === 'OWNER_MUST_RESUME'
      ? 'widgets.archiveModal.ownerMustResume'
      : 'widgets.archiveModal.willSuspend';
  });

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    if (this.serverReasonError()) return this.transloco.translate('analytics.error.CRM_VALIDATION_FAILED');
    if (this.reason().trim().length > MAX_REASON_LEN) {
      return this.transloco.translate('widgets.archiveModal.reasonTooLong');
    }
    return null;
  });

  protected readonly canSubmit = computed<boolean>(
    () => !this.loadingImpact() && !this.submitting() && !this.readOnly() && !this.conflictOpen()
      && can('crm.widgets.delete') && this.widget()?.accessLevel === 'OWNER' && this.impact() !== null && !this.reasonError()
      && (this.action() !== 'ARCHIVE' || this.reason().trim().length > 0),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.openSeq++;
      this.settle(false);
    });
  }

  open(widget: WidgetSummary): Promise<boolean> {
    this.settle(false);
    this.settledResult = false;
    const seq = ++this.openSeq;
    const action: 'ARCHIVE' | 'RESTORE' = widget.status === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVE';

    this.widget.set(widget);
    this.action.set(action);
    this.reason.set('');
    this.serverReasonError.set(false);
    this.readOnly.set(false);
    this.conflictOpen.set(false);
    this.readFailure.set(null);
    this.impact.set(null);
    this.submitting.set(false);
    this.modal().open();

    void this.loadImpact(seq, widget, action);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onReasonInput(event: Event): void {
    this.serverReasonError.set(false);
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.conflictOpen.set(false);
    this.openSeq++;
    this.loadingImpact.set(false);
    this.submitting.set(false);
    this.settle(this.settledResult);
  }

  protected async submit(): Promise<void> {
    const currentWidget = this.widget();
    const currentImpact = this.impact();
    if (!currentWidget || !currentImpact || !this.canSubmit()) return;

    const seq = this.openSeq;
    const action = this.action();
    const trimmedReason = this.reason().trim();

    this.submitting.set(true);
    try {
      await applyLifecycle(currentWidget.id, {
        action,
        expectedWidgetRevision: currentImpact.widgetRevision,
        expectedGovernanceRevision: currentImpact.governanceRevision,
        impactId: currentImpact.impactId,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      if (seq !== this.openSeq) return;
      this.notify.success(
        this.transloco.translate(
          action === 'ARCHIVE'
            ? 'widgets.archiveModal.archivedToast'
            : 'widgets.archiveModal.restoredToast',
        ),
      );
      this.settledResult = true;
      this.modal().close();
    } catch (error) {
      if (seq !== this.openSeq) return;
      const code = errorCodeOf(error);
      if (widgetConflict(error)) {
        this.impact.set(null);
        this.conflictOpen.set(true);
        return;
      }
      if (fieldErrorsOf(error)['reason']) this.serverReasonError.set(true);
      else this.notify.error(widgetErrorMessage(error, this.transloco, 'widgetPage', true));
      if (widgetWriteReadOnly(error)) {
        this.readOnly.set(true);
        this.becameReadOnly.emit();
      }
      if (code === 'CRM_WIDGET_LIFECYCLE_CONSUMER_LIMIT' || widgetNeedsReload(error)) {
        this.impact.set(null);
        await this.refreshAndReloadImpact(seq, currentWidget.id, action);
      }
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  protected async resolveConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    if (!keepChanges) this.reason.set('');
    const current = this.widget();
    if (current) await this.refreshAndReloadImpact(this.openSeq, current.id, this.action());
  }

  protected failureText(): string {
    const failure = this.readFailure();
    return [failure?.message, failure?.correlationId
      ? this.transloco.translate('widgetPage.requests.correlation', { id: failure.correlationId }) : ''].filter(Boolean).join(' ');
  }

  protected failureAction(): string | null {
    return this.readFailure()?.kind === 'provisioning'
      ? can('crm.analytics.readiness.view') ? 'widgetPage.requests.readiness' : null
      : this.readFailure()?.kind === 'load-failure' ? 'analytics.common.retry' : null;
  }

  protected async retryImpact(): Promise<void> {
    if (this.readFailure()?.kind === 'provisioning' && can('crm.analytics.readiness.view')) {
      void this.router.navigateByUrl('/crm/settings/data-readiness');
      return;
    }
    const current = this.widget();
    if (current) await this.refreshAndReloadImpact(this.openSeq, current.id, this.action());
  }

  private async loadImpact(
    seq: number,
    widget: WidgetSummary,
    action: 'ARCHIVE' | 'RESTORE',
  ): Promise<void> {
    this.loadingImpact.set(true);
    this.readFailure.set(null);
    try {
      const imp = await lifecycleImpact(widget.id, {
        action,
        expectedWidgetRevision: widget.revision,
        expectedGovernanceRevision: widget.governanceRevision,
      });
      if (seq !== this.openSeq) return;
      this.impact.set(imp);
    } catch (error) {
      if (seq !== this.openSeq) return;
      if (widgetConflict(error)) {
        this.impact.set(null);
        this.conflictOpen.set(true);
        return;
      }
      this.readFailure.set(widgetReadFailure(error, this.transloco, 'widgetPage'));
    } finally {
      if (seq === this.openSeq) {
        this.loadingImpact.set(false);
      }
    }
  }

  private async refreshAndReloadImpact(
    seq: number,
    widgetId: string,
    action: 'ARCHIVE' | 'RESTORE',
  ): Promise<void> {
    this.loadingImpact.set(true);
    try {
      const fresh = await getWidget(widgetId);
      if (seq !== this.openSeq) return;
      this.widget.set(fresh);
      const nextAction: 'ARCHIVE' | 'RESTORE' = fresh.status === 'ARCHIVED' ? 'RESTORE' : action;
      this.action.set(nextAction);
      await this.loadImpact(seq, fresh, nextAction);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.readFailure.set(widgetReadFailure(error, this.transloco, 'widgetPage'));
    } finally {
      if (seq === this.openSeq) this.loadingImpact.set(false);
    }
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.settledResult = false;
    resolve?.(result);
  }
}
