import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerPhone,
  tablerPhoneIncoming,
  tablerPhoneOff,
  tablerPhoneOutgoing,
  tablerPhoneX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { CallLogColumn, CallLogRow as CallLogRowModel } from '../call-log.model';
import {
  callLogGridClass,
  callLogTypeLook,
  callRecordRoute,
  formatCallDateTime,
  formatCallDuration,
  formatCallTime,
} from '../call-log-type';

@Component({
  selector: 'app-call-log-row',
  imports: [RouterLink, TranslocoPipe, NgIcon],
  viewProviders: [
    provideTranslocoScope({ scope: 'call-log', alias: 'callLog' }),
  ],
  providers: [
    provideIcons({
      tablerPhone,
      tablerPhoneIncoming,
      tablerPhoneOutgoing,
      tablerPhoneOff,
      tablerPhoneX,
    }),
  ],
  templateUrl: './call-log-row.html',
  host: { class: 'contents' },
})
export class CallLogRow {
  private readonly language = inject(LanguageState);

  readonly item = input.required<CallLogRowModel>();
  readonly variant = input<'list' | 'table' | 'card'>('list');
  readonly columns = input<readonly CallLogColumn[]>(['type', 'party', 'date', 'duration', 'actions']);
  readonly canCallBack = input(true);
  readonly callBackDisabled = input(false);
  readonly busy = input(false);

  readonly callBack = output<CallLogRowModel>();
  readonly openRecord = output<NonNullable<CallLogRowModel['record']>>();

  protected readonly tableColumnsClass = computed(() => callLogGridClass(this.columns()));
  protected readonly hasPartyColumn = computed(() => this.columns().includes('party'));
  protected readonly look = computed(() => callLogTypeLook(this.item().type));
  protected readonly isBusy = computed(() => this.callBackDisabled() || this.busy());
  protected readonly partyDisplayName = computed(() => {
    const row = this.item();
    return row.record?.label || row.name || row.number;
  });
  protected readonly timeText = computed(() => formatCallTime(this.item().startedAt));
  protected readonly dateTimeText = computed(() => formatCallDateTime(this.item().startedAt, this.language.current()));
  protected readonly durationText = computed(() => formatCallDuration(this.item()));
  protected readonly recordRoute = computed(() => callRecordRoute(this.item().record));

  protected onCallBack(event: Event): void {
    event.stopPropagation();
    if (this.isBusy() || !this.canCallBack()) return;
    this.callBack.emit(this.item());
  }

  protected onOpenRecord(event: Event): void {
    event.stopPropagation();
    const rec = this.item().record;
    if (rec) {
      this.openRecord.emit(rec);
    }
  }
}
