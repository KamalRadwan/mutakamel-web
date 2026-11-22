import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArchive, tablerRestore } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { applyLifecycle, getWidget, lifecycleImpact } from '../widgets.api';
import type { LifecycleImpact, WidgetSummary } from '../widgets.model';

const MAX_REASON_LEN = 500;
const MAX_VISIBLE_DASHBOARDS = 5;

@Component({
  selector: 'app-widget-archive-modal',
  imports: [TranslocoPipe, Badge, Button, Field, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widgets', alias: 'widgets' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerArchive, tablerRestore }),
  ],
  templateUrl: './archive-modal.html',
  host: { class: 'contents' },
})
export class ArchiveModal {
  private static nextId = 0;
  protected readonly uid = `widget-archive-${++ArchiveModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly widget = signal<WidgetSummary | null>(null);
  protected readonly action = signal<'ARCHIVE' | 'RESTORE'>('ARCHIVE');
  protected readonly loadingImpact = signal(false);
  protected readonly submitting = signal(false);
  protected readonly impact = signal<LifecycleImpact | null>(null);
  protected readonly reason = signal('');

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

  protected readonly visibleDashboardNames = computed<string[]>(() =>
    this.dashboardNames().slice(0, MAX_VISIBLE_DASHBOARDS),
  );

  protected readonly extraDashboardsCount = computed<number>(() =>
    Math.max(0, this.dashboardNames().length - MAX_VISIBLE_DASHBOARDS),
  );

  protected readonly placementCount = computed<number>(() => {
    const imp = this.impact();
    if (!imp) return 0;
    return this.action() === 'ARCHIVE'
      ? imp.placements.length
      : imp.placements.filter((p) => p.eligibleToResume).length || imp.hiddenPlacementCount;
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
    if (this.reason().trim().length > MAX_REASON_LEN) {
      return this.transloco.translate('widgets.archiveModal.reasonTooLong');
    }
    return null;
  });

  protected readonly canSubmit = computed<boolean>(
    () => !this.loadingImpact() && !this.submitting() && this.impact() !== null && !this.reasonError(),
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
    this.impact.set(null);
    this.submitting.set(false);
    this.modal().open();

    void this.loadImpact(seq, widget, action, false);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
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
      if (
        code === 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE' ||
        code === 'CRM_WIDGET_REVISION_CONFLICT'
      ) {
        this.notify.warning(this.transloco.translate(errorKey(code)));
        await this.refreshAndReloadImpact(seq, currentWidget.id, action);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  private async loadImpact(
    seq: number,
    widget: WidgetSummary,
    action: 'ARCHIVE' | 'RESTORE',
    retryingConflict: boolean,
  ): Promise<void> {
    this.loadingImpact.set(true);
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
      const code = errorCodeOf(error);
      if (!retryingConflict && code === 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE') {
        this.notify.warning(this.transloco.translate(errorKey(code)));
        await this.refreshAndReloadImpact(seq, widget.id, action, true);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
      this.modal().close();
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
    retryingConflict = false,
  ): Promise<void> {
    this.loadingImpact.set(true);
    try {
      const fresh = await getWidget(widgetId);
      if (seq !== this.openSeq) return;
      this.widget.set(fresh);
      const nextAction: 'ARCHIVE' | 'RESTORE' = fresh.status === 'ARCHIVED' ? 'RESTORE' : action;
      this.action.set(nextAction);
      await this.loadImpact(seq, fresh, nextAction, retryingConflict);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      this.modal().close();
    }
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.settledResult = false;
    resolve?.(result);
  }
}
