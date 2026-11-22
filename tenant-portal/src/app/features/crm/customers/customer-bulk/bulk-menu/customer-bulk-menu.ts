import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService } from '@jsverse/transloco';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { RecordBulkMenu } from '../../../shared/record/bulk/record-bulk-menu/record-bulk-menu';
import { RecordBulkAction } from '../../../shared/record/bulk/record-bulk.model';
import { canManageStatus } from '../../customers.api';
import { CustomerCapabilities } from '../../customers.model';
import { CUSTOMERS_BULK_APP, CUSTOMERS_BULK_MODULE_ID } from '../customer-bulk.model';
import { CustomerSelection } from '../customer-selection';

export type CustomerBulkMenuAction = 'assign' | 'status' | 'activity' | 'delete';

@Component({
  selector: 'app-customer-bulk-menu',
  imports: [RecordBulkMenu],
  templateUrl: './customer-bulk-menu.html',
  host: { class: 'relative inline-flex shrink-0' },
})
export class CustomerBulkMenu {
  private readonly selection = inject(CustomerSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly count = input<number | null>(null);
  readonly capabilities = input<CustomerCapabilities | null>(null);
  readonly disabled = input(false);

  readonly action = output<CustomerBulkMenuAction>();

  protected readonly resolvedCount = computed(() => this.count() ?? this.selection?.count() ?? 0);

  protected readonly isBusy = computed(
    () => this.tracker?.hasActive(CUSTOMERS_BULK_APP, CUSTOMERS_BULK_MODULE_ID) ?? false,
  );

  protected readonly actions = computed<RecordBulkAction[]>(() => {
    this.i18n();
    const caps = this.capabilities();
    const canUpdate = caps !== null && caps.customerProfiles.update !== null;
    const canDelete = caps !== null && caps.customerProfiles.delete !== null;
    const hasStatusPerm = canManageStatus();
    const canStatus = canUpdate && hasStatusPerm;
    const canActivity = caps !== null;

    return [
      {
        id: 'assign',
        labelKey: 'customerBulk.menu.assign',
        icon: 'tablerUserShare',
        tone: 'blue',
        allowed: canUpdate,
        reasonKey: 'customerBulk.reason.noUpdate',
      },
      {
        id: 'status',
        labelKey: 'customerBulk.menu.status',
        icon: 'tablerArrowsExchange',
        tone: 'green',
        allowed: canStatus,
        reasonKey: canUpdate ? 'customerBulk.reason.noStatus' : 'customerBulk.reason.noUpdate',
      },
      {
        id: 'activity',
        labelKey: 'customerBulk.menu.activity',
        icon: 'tablerCalendarPlus',
        tone: 'teal',
        allowed: canActivity,
      },
      {
        id: 'delete',
        labelKey: 'customerBulk.menu.delete',
        icon: 'tablerTrash',
        tone: 'red',
        danger: true,
        allowed: canDelete,
        reasonKey: 'customerBulk.reason.noDelete',
      },
    ];
  });

  protected onRun(id: string): void {
    if (id === 'assign' || id === 'status' || id === 'activity' || id === 'delete') {
      this.action.emit(id);
    }
  }
}
