import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  CallLogColumn,
  CallLogLoader,
  CallLogQuery,
  CallLogRow,
} from '../../../../../shared/widgets/call-log/call-log.model';
import { CallLogTable } from '../../../../../shared/widgets/call-log/call-log-table/call-log-table';
import { listUserCallLogs, toCallLogTypeParam } from '../../shared/staff-phone.api';
import { StaffUserCallLog } from '../../shared/staff-phone.model';
import { TenantUser } from '../../shared/staff.model';

function mapUserCallLogRow(row: StaffUserCallLog): CallLogRow {
  const isLead = row.sourceType === 'LEAD' && Boolean(row.sourceId) && Boolean(row.sourceLabel);
  const plainName =
    (row.sourceType && row.sourceType !== 'LEAD' ? row.sourceLabel : null) ??
    row.displayName ??
    row.sourceLabel;

  return {
    id: row.id,
    type: row.type,
    number: row.phoneNumber,
    name: plainName,
    startedAt: row.startedAt ?? row.createdAt,
    durationSeconds: row.durationSeconds,
    ownerName: row.ownerName,
    record: isLead ? { type: 'LEAD', id: row.sourceId!, label: row.sourceLabel! } : null,
    linkKind: null,
  };
}

@Component({
  selector: 'app-user-calls-tab',
  imports: [TranslocoPipe, CallLogTable],
  providers: [provideTranslocoScope('settings', 'staff', { scope: 'staff-users', alias: 'users' })],
  templateUrl: './user-calls-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 overflow-hidden' },
})
export class UserCallsTab {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly user = input.required<TenantUser>();
  readonly closeRequested = output<void>();

  protected readonly columns: CallLogColumn[] = ['type', 'party', 'date', 'duration'];
  protected readonly reloadToken = signal(0);
  private prevUserId: string | null = null;

  protected readonly errorText = computed<(status: number) => string | null>(() => {
    this.i18n();
    const message = this.transloco.translate('users.calls.noAccess');
    return (status: number) => (status === 403 ? message : null);
  });

  protected readonly loader: CallLogLoader = async (query: CallLogQuery) => {
    const { types, ...rest } = query;
    const result = await listUserCallLogs(this.user().id, { ...rest, type: toCallLogTypeParam(types) });
    return {
      data: result.data.map(mapUserCallLogRow),
      meta: result.meta,
    };
  };

  constructor() {
    effect(() => {
      const userId = this.user().id;
      if (this.prevUserId === null) {
        this.prevUserId = userId;
        return;
      }
      if (this.prevUserId !== userId) {
        this.prevUserId = userId;
        untracked(() => {
          this.reloadToken.update((count) => count + 1);
        });
      }
    });
  }

  protected onOpenRecord(record: NonNullable<CallLogRow['record']>): void {
    if (record.type !== 'LEAD') return;
    this.closeRequested.emit();
    void this.router.navigate(['/crm/leads', record.id]);
  }
}
