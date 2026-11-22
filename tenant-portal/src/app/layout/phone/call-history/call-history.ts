import { Component, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerHistory } from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { listCallLogs, toCallLogTypeParam } from '../../../core/phone/phone.api';
import { Modal } from '../../../shared/ui/modal/modal';
import { CallLogLoader, CallLogQuery, CallLogRow } from '../../../shared/widgets/call-log/call-log.model';
import { CallLogTable } from '../../../shared/widgets/call-log/call-log-table/call-log-table';
import { toCallLogRow } from '../../../shared/widgets/call-log/call-log-type';

@Component({
  selector: 'app-call-history',
  imports: [TranslocoPipe, Modal, CallLogTable],
  providers: [
    provideTranslocoScope({ scope: 'web-phone-calls', alias: 'phoneCalls' }),
    provideIcons({ tablerHistory }),
  ],
  templateUrl: './call-history.html',
  styleUrl: './call-history.css',
})
export class CallHistory {
  protected readonly phone = inject(PhoneState);
  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly opened = signal(false);
  protected readonly reloadToken = signal(0);

  protected readonly loadCalls: CallLogLoader = async (query: CallLogQuery) => {
    const { types, ...rest } = query;
    const result = await listCallLogs({ ...rest, type: toCallLogTypeParam(types) });
    return {
      data: result.data.map(toCallLogRow),
      meta: result.meta,
    };
  };

  open(): void {
    this.opened.set(true);
    this.reloadToken.update((count) => count + 1);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.opened.set(false);
  }

  protected onCallBack(row: CallLogRow): void {
    this.close();
    this.phone.setTab('phone');
    void this.phone.call(row.number, row.record);
  }

  protected onOpenRecord(): void {
    this.close();
  }
}
