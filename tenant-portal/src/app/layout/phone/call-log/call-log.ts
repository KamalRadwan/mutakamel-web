import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerHistory, tablerRefresh } from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';
import { listCallLogs } from '../../../core/phone/phone.api';
import { Button } from '../../../shared/ui/button/button';
import { CallHistory } from '../call-history/call-history';
import { CallLogRow } from '../../../shared/widgets/call-log/call-log-row/call-log-row';
import {
  CallLogDayKey,
  CallLogRow as CallLogRowModel,
  callLogDayGroup,
  toCallLogRow,
} from '../../../shared/widgets/call-log/call-log-type';

interface CallLogGroup {
  readonly key: CallLogDayKey;
  readonly items: CallLogRowModel[];
}

const PAGE_LIMIT = 20;
const SCROLL_THRESHOLD_PX = 24;
const DAY_ORDER: readonly CallLogDayKey[] = ['today', 'yesterday', 'earlier'];
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6] as const;

@Component({
  selector: 'app-call-log',
  imports: [TranslocoPipe, NgIcon, Button, CallLogRow, CallHistory],
  providers: [
    provideTranslocoScope({ scope: 'web-phone-calls', alias: 'phoneCalls' }),
    provideIcons({ tablerHistory, tablerRefresh }),
  ],
  templateUrl: './call-log.html',
  host: { class: 'flex h-full min-h-0 flex-col' },
})
export class CallLog {
  protected readonly phone = inject(PhoneState);
  private readonly historyModal = viewChild.required<CallHistory>('historyModal');

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly items = signal<CallLogRowModel[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly failed = signal(false);

  private requestSeq = 0;
  private initializedTab = false;

  protected readonly groups = computed<CallLogGroup[]>(() => {
    const now = new Date();
    const buckets: Record<CallLogDayKey, CallLogRowModel[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const item of this.items()) {
      buckets[callLogDayGroup(item.startedAt, now)].push(item);
    }
    return DAY_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }));
  });

  constructor() {
    void this.reload();
    effect(() => {
      const activeTab = this.phone.tab();
      if (!this.initializedTab) {
        this.initializedTab = true;
        return;
      }
      if (activeTab === 'calls') {
        untracked(() => {
          void this.reload();
        });
      }
    });
  }

  protected async reload(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.loadingMore.set(false);
    this.failed.set(false);
    this.page.set(1);

    try {
      const result = await listCallLogs({ page: 1, limit: PAGE_LIMIT });
      if (seq !== this.requestSeq) return;
      this.items.set(result.data.map(toCallLogRow));
      this.total.set(result.meta.total);
    } catch {
      if (seq !== this.requestSeq) return;
      this.items.set([]);
      this.total.set(0);
      this.failed.set(true);
    } finally {
      if (seq === this.requestSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD_PX) {
      void this.loadMore();
    }
  }

  protected openHistory(): void {
    this.historyModal().open();
  }

  protected onCallBack(row: CallLogRowModel): void {
    this.phone.setTab('phone');
    void this.phone.call(row.number, row.record);
  }

  private async loadMore(): Promise<void> {
    if (this.loading() || this.loadingMore() || this.failed()) return;
    if (this.items().length >= this.total()) return;

    const seq = ++this.requestSeq;
    const nextPage = this.page() + 1;
    this.loadingMore.set(true);

    try {
      const result = await listCallLogs({ page: nextPage, limit: PAGE_LIMIT });
      if (seq !== this.requestSeq) return;
      this.page.set(nextPage);
      const nextRows = result.data.map(toCallLogRow);
      this.items.update((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const added = nextRows.filter((row) => !seen.has(row.id));
        return [...prev, ...added];
      });
      this.total.set(result.meta.total);
    } catch {
      // Keep already loaded rows visible if fetching a subsequent page fails.
    } finally {
      if (seq === this.requestSeq) {
        this.loadingMore.set(false);
      }
    }
  }
}
