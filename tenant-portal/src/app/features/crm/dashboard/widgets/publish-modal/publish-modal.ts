import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExclamationCircle, tablerSend } from '@ng-icons/tabler-icons';
import { Router } from '@angular/router';
import { ApiError, isRetryableWriteError, isValidationError } from '../../../../../core/api/api-errors';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { RequestModal } from '../../access/request-modal/request-modal';
import { widgetConflict, widgetErrorMessage, widgetNeedsReload, widgetReadFailure, widgetWriteReadOnly, type WidgetReadFailure } from '../builder/builder-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import {
  DataCell,
  DataTable,
  type DataColumn,
} from '../../../../../shared/ui/data-table/data-table';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { getDraft, publishImpact, publishWidget } from '../widgets.api';
import type { DraftState, PublishImpact, PublishImpactBody, WidgetDetail } from '../widgets.model';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

type ImpactDashboardRow = PublishImpact['dashboards'][number];
type DependentGroupKey = 'alertRules' | 'subscriptions' | 'reports';

@Component({
  selector: 'app-publish-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Button, Badge, DataTable, DataCell, FullState, ConflictDialog, Field, RequestModal],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  providers: [
    provideIcons({ tablerSend, tablerExclamationCircle }),
  ],
  templateUrl: './publish-modal.html',
})
export class PublishModal {
  private static nextId = 0;
  protected readonly uid = `widget-publish-${++PublishModal.nextId}`;
  protected readonly usageFields = ['dashboardCount', 'placementCount', 'hiddenPlacementCount'] as const;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'));

  private readonly router = inject(Router);
  private readonly requestModal = viewChild(RequestModal);
  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly loadingImpact = signal(false);
  protected readonly impactError = signal<string | null>(null);
  protected readonly publishing = signal(false);
  protected readonly impact = signal<PublishImpact | null>(null);
  protected readonly activeHint = signal<string | null>(null);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly failure = signal<WidgetReadFailure | null>(null);
  protected readonly usage = signal<WidgetDetail['usage'] | null>(null);
  protected readonly canOpenReadiness = computed(() => can('crm.analytics.readiness.view'));
  protected readonly canPublish = computed(() => can('crm.widgets.publish'));
  readonly validationError = output<ApiError>();
  readonly becameReadOnly = output<void>();
  private conflictSettle: ((choice: 'reload' | 'keep' | 'dismiss') => void) | null = null;
  private publishAction: { body: PublishImpactBody & { impactId: string }; key: string } | null = null;
  readonly lastPublishedVersion = signal<number | null>(null);

  private currentWidgetId = '';
  private currentState: DraftState | null = null;
  private resolver: ((published: boolean) => void) | null = null;
  private impactSeq = 0;

  protected currentWidgetName(): string {
    return this.currentState?.draft?.name ?? '';
  }

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.builder2Scope();
    this.language();
    const nextVersion =
      this.impact()?.nextVersionNumber ?? ((this.currentState?.activeVersionNumber ?? 0) + 1);
    return this.transloco.translate('builder2.publish.publishTitle', { n: nextVersion });
  });

  protected readonly dashboardColumns = computed<readonly DataColumn[]>(() => {
    this.i18n();
    this.builder2Scope();
    this.language();
    return [
      {
        key: 'name',
        label: this.transloco.translate('builder2.publish.dashboardName'),
        width: 3,
      },
      {
        key: 'affected',
        label: this.transloco.translate('builder2.publish.status'),
        width: 1,
        align: 'end',
      },
    ];
  });

  protected readonly validUntilText = computed(() => {
    this.i18n();
    this.builder2Scope();
    const lang = this.language();
    const expiresAt = this.impact()?.expiresAt;
    if (!expiresAt) return '';
    return this.transloco.translate('builder2.publish.validUntilValue', {
      time: formatDateTime(expiresAt, lang),
    });
  });

  protected readonly dependentGroups = computed(() => {
    this.i18n();
    this.builder2Scope();
    this.language();
    const deps = this.impact()?.dependents;
    if (!deps) return [];

    const specs: { key: DependentGroupKey; labelKey: string }[] = [
      { key: 'alertRules', labelKey: 'builder2.publish.alertRules' },
      { key: 'subscriptions', labelKey: 'builder2.publish.subscriptions' },
      { key: 'reports', labelKey: 'builder2.publish.reports' },
    ];

    return specs
      .map((s) => ({
        key: s.key,
        label: this.transloco.translate(s.labelKey),
        count: deps[s.key].count,
        // Report dependents are blueprints, keyed by `blueprintKey` (no id).
        items: (s.key === 'reports'
          ? deps.reports.items.map((item) => ({ id: item.blueprintKey, name: item.name }))
          : deps[s.key].items.map((item) => ({ id: item.id, name: item.name }))
        ).slice(0, 50),
      }))
      .filter((g) => g.count > 0 || g.items.length > 0);
  });

  protected readonly dashboardRowKey = (row: ImpactDashboardRow): string => row.id;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.impactSeq++;
      this.settleConflict('dismiss');
      this.settle(false);
    });
  }

  open(widgetId: string, state: DraftState, usage: WidgetDetail['usage'] | null = null): Promise<boolean> {
    this.settle(false);
    this.settleConflict('dismiss');
    this.publishAction = null;
    this.usage.set(usage);
    this.currentWidgetId = widgetId;
    this.currentState = state;
    this.lastPublishedVersion.set(null);
    this.impact.set(null);
    this.impactError.set(null);
    this.failure.set(null);
    this.publishing.set(false);
    this.modal().open();
    void this.loadImpact();

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  protected async loadImpact(): Promise<void> {
    const state = this.currentState;
    const draft = state?.draft;
    if (!this.currentWidgetId || !state || !draft) {
      this.impactError.set(this.transloco.translate('builder2.publish.loadFailed'));
      return;
    }

    const seq = ++this.impactSeq;
    this.loadingImpact.set(true);
    this.impact.set(null);
    this.publishAction = null;
    this.failure.set(null);
    this.impactError.set(null);

    try {
      const result = await publishImpact(this.currentWidgetId, {
        expectedWidgetRevision: state.widgetRevision,
        expectedGovernanceRevision: state.governanceRevision,
        expectedDraftId: draft.draftId,
        expectedDraftRevision: draft.revision,
      });
      if (seq !== this.impactSeq) return;
      this.impact.set(result);
      this.loadingImpact.set(false);
    } catch (err: unknown) {
      if (seq !== this.impactSeq) return;
      this.loadingImpact.set(false);
      this.impact.set(null);
      if (widgetConflict(err)) {
        await this.resolveConflict(err);
      } else if (err instanceof ApiError && (err.status === 422 || isValidationError(err))) {
        this.validationError.emit(err);
        this.notify.error(widgetErrorMessage(err, this.transloco, 'builder2'));
        this.closeWith(false);
      } else {
        this.setReadFailure(err);
      }
    }
  }

  protected async confirmPublish(): Promise<void> {
    const imp = this.impact();
    if (!imp || this.publishing() || this.loadingImpact() || !can('crm.widgets.publish')) return;

    this.publishAction ??= {
      body: {
        expectedWidgetRevision: imp.widgetRevision,
        expectedGovernanceRevision: imp.governanceRevision,
        expectedDraftId: imp.draftId,
        expectedDraftRevision: imp.draftRevision,
        impactId: imp.impactId,
      },
      key: newIdempotencyKey(),
    };
    this.publishing.set(true);
    const seq = this.impactSeq;
    try {
      const res = await publishWidget(this.currentWidgetId, this.publishAction.body, this.publishAction.key);
      if (seq !== this.impactSeq) return;
      this.publishAction = null;
      this.lastPublishedVersion.set(res.versionNumber);
      this.publishing.set(false);
      this.closeWith(true);
    } catch (err: unknown) {
      if (seq !== this.impactSeq) return;
      this.publishing.set(false);
      if (!isRetryableWriteError(err) && !(err instanceof ApiError && err.status === 401)) this.publishAction = null;
      if (widgetWriteReadOnly(err)) this.becameReadOnly.emit();
      if (widgetNeedsReload(err)) {
        this.impact.set(null);
        this.setReadFailure(err);
        this.notify.error(widgetErrorMessage(err, this.transloco, 'builder2', true));
      } else if (widgetConflict(err)) {
        await this.resolveConflict(err);
      } else if (err instanceof ApiError && (err.status === 422 || isValidationError(err))) {
        this.validationError.emit(err);
        this.notify.error(widgetErrorMessage(err, this.transloco, 'builder2', true));
        this.closeWith(false);
      } else {
        this.notify.error(widgetErrorMessage(err, this.transloco, 'builder2', true));
        if (err instanceof ApiError && err.status === 403) this.closeWith(false);
      }
    }
  }

  protected async reloadImpact(): Promise<void> {
    if (await this.refreshDraftState()) await this.loadImpact();
  }

  protected onFailureAction(): void {
    if (this.failure()?.kind === 'provisioning' && this.canOpenReadiness()) {
      void this.router.navigateByUrl('/crm/settings/data-readiness');
    } else if (this.failure()?.requestAccess) {
      this.requestModal()?.open('WIDGET', this.currentWidgetId);
    } else {
      void this.reloadImpact();
    }
  }

  protected settleConflict(choice: 'reload' | 'keep' | 'dismiss'): void {
    const settle = this.conflictSettle;
    this.conflictSettle = null;
    this.conflictOpen.set(false);
    settle?.(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    if (!open) this.settleConflict('dismiss');
  }

  private async resolveConflict(error: unknown): Promise<void> {
    const seq = this.impactSeq;
    this.publishAction = null;
    this.impact.set(null);
    this.setReadFailure(error);
    this.conflictOpen.set(true);
    const choice = await new Promise<'reload' | 'keep' | 'dismiss'>((resolve) => this.conflictSettle = resolve);
    if (seq !== this.impactSeq || choice === 'dismiss') return;
    await this.reloadImpact();
  }

  private setReadFailure(error: unknown): void {
    const failure = widgetReadFailure(error, this.transloco, 'builder2');
    this.failure.set(failure);
    this.impactError.set(failure.message + (failure.correlationId
      ? ' ' + this.transloco.translate('builder2.requests.correlation', { id: failure.correlationId }) : ''));
  }

  private async refreshDraftState(): Promise<boolean> {
    try {
      this.currentState = await getDraft(this.currentWidgetId);
      return true;
    } catch (err: unknown) {
      this.impact.set(null);
      this.setReadFailure(err);
      return false;
    }
  }

  protected cancel(): void {
    if (this.publishing()) return;
    this.closeWith(false);
  }

  protected onModalClosed(): void {
    this.impactSeq++;
    this.settleConflict('dismiss');
    this.settle(false);
  }

  protected isDashboardAffected(row: unknown): boolean {
    if (!row || typeof row !== 'object') return false;
    return Boolean((row as ImpactDashboardRow).affected);
  }

  protected dashboardNameFor(dashboardId: string): string {
    return (
      this.impact()?.dashboards.find((d) => d.id === dashboardId)?.name ?? dashboardId
    );
  }

  protected showHint(key: string, triggerEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tip = rectInPage(tipEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }

    const top = Math.max(8, rect.bottom - tip.height);
    this.tooltipPlace.set({ top, start });
    this.activeHint.set(key);
    this.tipPlaced.set(true);
  }

  protected hideHint(): void {
    this.activeHint.set(null);
    this.tipPlaced.set(false);
  }

  private closeWith(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.impactSeq++;
    this.modal().close();
    resolve?.(result);
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }
}
