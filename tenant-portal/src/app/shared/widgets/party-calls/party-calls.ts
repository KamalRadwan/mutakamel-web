import { Component, DestroyRef, Injector, computed, inject, input, output, runInInjectionContext } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PhoneState } from '../../../core/phone/phone';
import { settingsTimeZone } from '../../../features/crm/settings/shared/settings-time-zone';
import { CallLogColumn, CallLogLoader, CallLogRow } from '../call-log/call-log.model';
import { CallLogTable } from '../call-log/call-log-table/call-log-table';
import { getPartyCallsSummary, listPartyCalls, toCallLogTypeParam } from './party-calls.api';
import { toPartyCallLogRow } from './party-calls.model';

const PARTY_CALL_COLUMNS: readonly CallLogColumn[] = ['type', 'owner', 'date', 'duration', 'actions'];

@Component({
  selector: 'app-party-calls',
  imports: [TranslocoPipe, CallLogTable],
  providers: [provideTranslocoScope({ scope: 'party-calls', alias: 'partyCalls' })],
  templateUrl: './party-calls.html',
  host: { class: 'flex h-full min-h-0 flex-1 flex-col gap-8 overflow-hidden' },
})
export class PartyCalls {
  protected readonly phone = inject(PhoneState);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolveTimeZone = () => runInInjectionContext(this.injector, settingsTimeZone);

  readonly partyType = input.required<'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY'>();
  readonly partyId = input.required<string>();
  readonly partyLabel = input.required<string>();
  readonly reloadToken = input(0);
  readonly total = output<number>();
  readonly missed = output<number>();

  protected readonly columns: CallLogColumn[] = [...PARTY_CALL_COLUMNS];

  protected readonly loadCalls = computed<CallLogLoader>(() => {
    const partyType = this.partyType();
    const partyId = this.partyId();
    return async (query) => {
      try {
        const [result, summary] = await Promise.all([
          listPartyCalls({
            partyType,
            partyId,
            page: query.page,
            limit: query.limit,
            type: toCallLogTypeParam(query.types),
            from: query.from,
            to: query.to,
            q: query.q,
          }),
          getPartyCallsSummary({ partyType, partyId }),
        ]);
        if (!this.destroyRef.destroyed && this.partyType() === partyType && this.partyId() === partyId) {
          this.total.emit(summary.total);
          this.missed.emit(summary.missed);
        }
        return { data: result.data.map(toPartyCallLogRow), meta: result.meta };
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404
          && !this.destroyRef.destroyed && this.partyType() === partyType && this.partyId() === partyId) {
          this.total.emit(0);
          this.missed.emit(0);
        }
        throw error;
      }
    };
  });

  protected readonly errorText = (status: number): string | null =>
    status === 404 ? this.transloco.translate('partyCalls.errors.notFound') : null;

  protected onCallBack(row: CallLogRow): void {
    void this.phone.call(row.number, {
      type: this.partyType(),
      id: this.partyId(),
      label: this.partyLabel(),
    });
  }
}
