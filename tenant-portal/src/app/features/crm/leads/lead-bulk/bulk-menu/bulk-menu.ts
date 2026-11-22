import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { RecordBulkAction } from '../../../shared/record/bulk/record-bulk.model';
import { RecordBulkMenu } from '../../../shared/record/bulk/record-bulk-menu/record-bulk-menu';
import { LeadCapabilities } from '../../leads.model';
import { LeadSelection } from '../lead-selection';

export type BulkActionId = 'assign' | 'stage' | 'activity' | 'delete';

@Component({
  selector: 'app-lead-bulk-menu',
  imports: [RecordBulkMenu],
  viewProviders: [
    provideTranslocoScope(
      'leads',
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'lead-bulk-bar', alias: 'bulkBar' },
    ),
  ],
  templateUrl: './bulk-menu.html',
  host: { class: 'relative inline-flex shrink-0' },
})
export class BulkMenu {
  private readonly selection = inject(LeadSelection, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly scopeLoaded = toSignal(
    this.transloco.selectTranslate('menu.assign', {}, { scope: 'lead-bulk-bar', alias: 'bulkBar' }),
  );

  readonly count = input<number | null>(null);
  readonly capabilities = input<LeadCapabilities | null>(null);
  readonly canUpdate = input<boolean | null>(null);
  readonly canDelete = input<boolean | null>(null);
  readonly canCreateActivity = input<boolean | null>(null);
  readonly disabled = input(false);
  readonly disabledReason = input<string | null>(null);

  readonly action = output<BulkActionId>();
  readonly selected = output<ActionSelection>();

  protected readonly resolvedCount = computed(() => this.count() ?? this.selection?.count() ?? 0);

  private readonly allowUpdate = computed(() => {
    const explicit = this.canUpdate();
    if (explicit !== null) return explicit;
    const caps = this.capabilities();
    return caps ? caps.update !== null : true;
  });

  private readonly allowDelete = computed(() => {
    const explicit = this.canDelete();
    if (explicit !== null) return explicit;
    const caps = this.capabilities();
    return caps ? caps.delete !== null : true;
  });

  private readonly allowActivity = computed(() => {
    const explicit = this.canCreateActivity();
    if (explicit !== null) return explicit;
    const caps = this.capabilities() as
      (LeadCapabilities & { activity?: unknown; createActivity?: unknown }) | null;
    if (!caps) return true;
    if ('activity' in caps) return caps.activity !== null && caps.activity !== false;
    if ('createActivity' in caps)
      return caps.createActivity !== null && caps.createActivity !== false;
    return caps.update !== null || caps.create !== null;
  });

  protected readonly actions = computed<RecordBulkAction[]>(() => {
    this.scopeLoaded();
    const canUpdate = this.allowUpdate();
    const canDelete = this.allowDelete();
    const canActivity = this.allowActivity();
    return [
      {
        id: 'assign',
        labelKey: 'bulkBar.menu.assign',
        icon: 'tablerUserShare',
        tone: 'blue',
        allowed: canUpdate,
        reasonKey: 'bulkBar.reason.noUpdate',
      },
      {
        id: 'stage',
        labelKey: 'bulkBar.menu.stage',
        icon: 'tablerArrowsExchange',
        tone: 'green',
        allowed: canUpdate,
        reasonKey: 'bulkBar.reason.noUpdate',
      },
      {
        id: 'activity',
        labelKey: 'bulkBar.menu.activity',
        icon: 'tablerCalendarPlus',
        tone: 'teal',
        allowed: canActivity,
        reasonKey: 'bulkBar.reason.noActivity',
      },
      {
        id: 'delete',
        labelKey: 'bulkBar.menu.delete',
        icon: 'tablerTrash',
        tone: 'red',
        danger: true,
        allowed: canDelete,
        reasonKey: 'bulkBar.reason.noDelete',
      },
    ];
  });

  protected onRun(actionId: string): void {
    const id = actionId as BulkActionId;
    this.action.emit(id);
    this.selected.emit({ id });
  }
}
