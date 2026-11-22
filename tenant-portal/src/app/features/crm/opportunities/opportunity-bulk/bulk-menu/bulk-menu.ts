import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { RecordBulkMenu } from '../../../shared/record/bulk/record-bulk-menu/record-bulk-menu';
import { RecordBulkAction } from '../../../shared/record/bulk/record-bulk.model';
import type { OpportunityCapabilities } from '../../opportunities.model';
import { CRM_OPPORTUNITIES_BULK_APP, CRM_OPPORTUNITIES_BULK_MODULE_ID } from '../bulk-runner';
import { OpportunitySelection } from '../opportunity-selection';

export type OpportunityBulkMenuAction = 'assign' | 'stage' | 'activity' | 'delete';

@Component({
  selector: 'app-opportunity-bulk-menu',
  imports: [RecordBulkMenu],
  // viewProviders, not providers: the scope must not leak to the host's own pipes such as
  // 'oppBulk.job.busy' | transloco on opportunities-page (same fix as the lead bulk-menu).
  viewProviders: [provideTranslocoScope('opportunities', { scope: 'opportunity-bulk', alias: 'oppBulk' })],
  templateUrl: './bulk-menu.html',
  host: { class: 'relative inline-flex shrink-0' },
})
export class OpportunityBulkMenu {
  private readonly selection = inject(OpportunitySelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly scopeLoaded = toSignal(
    this.transloco.selectTranslate('menu.assign', {}, { scope: 'opportunity-bulk', alias: 'oppBulk' }),
  );

  readonly count = input<number | null>(null);
  readonly capabilities = input<OpportunityCapabilities | null>(null);
  readonly disabled = input(false);
  readonly disabledReason = input<string | null>(null);
  readonly busy = input<boolean | null>(null);

  readonly action = output<OpportunityBulkMenuAction>();
  readonly selected = output<ActionSelection>();

  protected readonly resolvedCount = computed(() => this.count() ?? this.selection?.count() ?? 0);

  protected readonly isBusy = computed(
    () =>
      this.busy() ??
      this.tracker?.hasActive(CRM_OPPORTUNITIES_BULK_APP, CRM_OPPORTUNITIES_BULK_MODULE_ID) ??
      false,
  );

  protected readonly isDisabled = computed(() => this.disabled() || this.isBusy());

  protected readonly resolvedBusyReason = computed<string | null>(() => {
    this.scopeLoaded();
    const explicit = this.disabledReason();
    if (explicit) return explicit;
    if (this.isBusy() || this.disabled()) {
      return this.transloco.translate('oppBulk.job.busy');
    }
    return null;
  });

  protected readonly actions = computed<RecordBulkAction[]>(() => {
    this.scopeLoaded();
    const caps = this.capabilities();
    const list: RecordBulkAction[] = [];

    if (!caps || caps.bulk.assign !== null) {
      list.push({
        id: 'assign',
        labelKey: 'oppBulk.menu.assign',
        icon: 'tablerUserShare',
        tone: 'blue',
        allowed: true,
      });
    }
    if (!caps || caps.bulk.moveStage !== null) {
      list.push({
        id: 'stage',
        labelKey: 'oppBulk.menu.stage',
        icon: 'tablerArrowsExchange',
        tone: 'green',
        allowed: true,
      });
    }
    if (!caps || caps.bulk.createActivity !== null) {
      list.push({
        id: 'activity',
        labelKey: 'oppBulk.menu.activity',
        icon: 'tablerCalendarPlus',
        tone: 'teal',
        allowed: true,
      });
    }
    if (!caps || caps.bulk.delete !== null) {
      list.push({
        id: 'delete',
        labelKey: 'oppBulk.menu.delete',
        icon: 'tablerTrash',
        tone: 'red',
        danger: true,
        allowed: true,
      });
    }

    return list;
  });

  protected onRun(actionId: string): void {
    const id = actionId as OpportunityBulkMenuAction;
    this.action.emit(id);
    this.selected.emit({ id });
  }
}
