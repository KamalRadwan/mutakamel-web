import { Component, DestroyRef, computed, effect, inject, input, output, untracked } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PhoneState } from '../../../core/phone/phone';
import { CallLogColumn, CallLogLoader, CallLogRow } from '../call-log/call-log.model';
import { CallLogTable } from '../call-log/call-log-table/call-log-table';
import { getPartyCallsSummary, listPartyCalls, toCallLogTypeParam } from './party-calls.api';
import { PartyCallPartyType, toPartyCallLogRow } from './party-calls.model';

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

  readonly partyType = input.required<'LEAD' | 'CUSTOMER_PROFILE' | 'PARTY' | 'OPPORTUNITY'>();
  readonly partyId = input.required<string>();
  readonly partyLabel = input.required<string>();
  readonly reloadToken = input(0);
  readonly total = output<number>();
  readonly missed = output<number>();

  protected readonly columns: CallLogColumn[] = [...PARTY_CALL_COLUMNS];

  private summarySeq = 0;

  protected readonly loadCalls = computed<CallLogLoader>(() => {
    const partyType = this.partyType();
    const partyId = this.partyId();
    return async (query) => {
      const result = await listPartyCalls({
        partyType,
        partyId,
        page: query.page,
        limit: query.limit,
        type: toCallLogTypeParam(query.types),
        from: query.from,
        to: query.to,
        q: query.q,
      });
      return {
        data: result.data.map(toPartyCallLogRow),
        meta: result.meta,
      };
    };
  });

  protected readonly errorText = (status: number): string | null =>
    status === 404 ? this.transloco.translate('partyCalls.errors.notFound') : null;

  constructor() {
    effect(() => {
      const partyType = this.partyType();
      const partyId = this.partyId();
      this.reloadToken();
      untracked(() => {
        void this.refreshSummary(partyType, partyId);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.summarySeq++;
    });
  }

  protected onCallBack(row: CallLogRow): void {
    void this.phone.call(row.number, {
      type: this.partyType(),
      id: this.partyId(),
      label: this.partyLabel(),
    });
  }

  private async refreshSummary(partyType: PartyCallPartyType, partyId: string): Promise<void> {
    const seq = ++this.summarySeq;
    try {
      const summary = await getPartyCallsSummary({ partyType, partyId });
      if (seq !== this.summarySeq) return;
      this.total.emit(summary.total);
      this.missed.emit(summary.missed);
    } catch (error) {
      if (seq !== this.summarySeq) return;
      if (typeof error === 'object' && error !== null && 'status' in error && (error as { status: unknown }).status === 404) {
        this.total.emit(0);
        this.missed.emit(0);
      }
    }
  }
}
