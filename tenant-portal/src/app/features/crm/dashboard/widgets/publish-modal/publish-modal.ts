import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExclamationCircle, tablerSend } from '@ng-icons/tabler-icons';
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
import {
  errorCodeOf,
  newIdempotencyKey,
} from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { getDraft, publishImpact, publishWidget } from '../widgets.api';
import type { DraftState, PublishImpact } from '../widgets.model';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';

type ImpactDashboardRow = PublishImpact['dashboards'][number];
type DependentGroupKey = 'alertRules' | 'subscriptions' | 'reports';

@Component({
  selector: 'app-publish-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Button, Badge, DataTable, DataCell, FullState],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-widget-builder-2', alias: 'builder2' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerSend, tablerExclamationCircle }),
  ],
  templateUrl: './publish-modal.html',
})
export class PublishModal {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly builder2Scope = toSignal(selectScopeTranslation(this.transloco, 'crm-widget-builder-2', 'builder2'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));

  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly loadingImpact = signal(false);
  protected readonly impactError = signal<string | null>(null);
  protected readonly publishing = signal(false);
  protected readonly impact = signal<PublishImpact | null>(null);
  protected readonly activeHint = signal<string | null>(null);
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);
  readonly lastPublishedVersion = signal<number | null>(null);

  private currentWidgetId = '';
  private currentState: DraftState | null = null;
  private resolver: ((published: boolean) => void) | null = null;
  private impactSeq = 0;

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
      this.settle(false);
    });
  }

  open(widgetId: string, state: DraftState): Promise<boolean> {
    this.settle(false);
    this.currentWidgetId = widgetId;
    this.currentState = state;
    this.lastPublishedVersion.set(null);
    this.impact.set(null);
    this.impactError.set(null);
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
      const code = errorCodeOf(err);
      if (code === 'CRM_WIDGET_PUBLISH_FORBIDDEN') {
        this.analyticsScope();
        this.notify.error(this.transloco.translate(errorKey(code)));
        this.closeWith(false);
        return;
      }
      this.impactError.set(this.transloco.translate(errorKey(code)));
    }
  }

  protected async confirmPublish(): Promise<void> {
    const imp = this.impact();
    if (!imp || this.publishing() || this.loadingImpact()) return;

    this.publishing.set(true);
    try {
      const res = await publishWidget(
        this.currentWidgetId,
        {
          expectedWidgetRevision: imp.widgetRevision,
          expectedGovernanceRevision: imp.governanceRevision,
          expectedDraftId: imp.draftId,
          expectedDraftRevision: imp.draftRevision,
          impactId: imp.impactId,
        },
        newIdempotencyKey(),
      );
      this.lastPublishedVersion.set(res.versionNumber);
      this.publishing.set(false);
      this.closeWith(true);
    } catch (err: unknown) {
      this.publishing.set(false);
      const code = errorCodeOf(err);
      if (code === 'CRM_WIDGET_PUBLISH_IMPACT_STALE') {
        this.notify.warning(this.transloco.translate(errorKey(code)));
        // The impact was built from old revisions; read the draft again so the retry uses current ones.
        if (await this.refreshDraftState()) await this.loadImpact();
        return;
      }
      if (code === 'CRM_WIDGET_PUBLISH_FORBIDDEN') {
        this.notify.error(this.transloco.translate(errorKey(code)));
        this.closeWith(false);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(code)));
    }
  }

  private async refreshDraftState(): Promise<boolean> {
    try {
      this.currentState = await getDraft(this.currentWidgetId);
      return true;
    } catch (err: unknown) {
      this.impact.set(null);
      this.impactError.set(this.transloco.translate(errorKey(errorCodeOf(err))));
      return false;
    }
  }

  protected cancel(): void {
    if (this.publishing()) return;
    this.closeWith(false);
  }

  protected onModalClosed(): void {
    this.impactSeq++;
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
    this.modal().close();
    resolve?.(result);
  }

  private settle(result: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }
}
