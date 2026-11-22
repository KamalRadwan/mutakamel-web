import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerLock, tablerLockOpen } from '@ng-icons/tabler-icons';
import { listBulkJobs } from '../../../../../../shared/bulk-jobs/bulk-jobs.api';
import type { BulkJob } from '../../../../../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import type { TradeContext } from '../../../../shared/trade-api';
import { type AccountListFilter, AccountSelection } from '../account-selection';
import {
  TRADE_ACCOUNTS_BULK_MODULE_ID,
  type TradeAccountsBulkAction,
} from '../accounts-bulk.descriptor';
import { AccountReasonModal } from '../reason-modal/account-reason-modal';

interface BulkMenuItem {
  id: TradeAccountsBulkAction;
  title: string;
  icon: string;
  tile: string;
  danger?: boolean;
}

interface Place {
  top: number;
  start: number;
}

@Component({
  selector: 'app-account-bulk-menu',
  imports: [NgIcon, TranslocoPipe, Button, AccountReasonModal],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-accounts-bulk', alias: 'accountsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
    ),
    provideIcons({ tablerChevronDown, tablerLock, tablerLockOpen }),
  ],
  templateUrl: './account-bulk-menu.html',
  host: {
    class: 'relative inline-flex shrink-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class AccountBulkMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injectedSelection = inject(AccountSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly trigger = viewChild.required<Button, ElementRef<HTMLButtonElement>>('trigger', {
    read: ElementRef,
  });
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly menuRows = viewChildren<ElementRef<HTMLButtonElement>>('menuRow');
  private readonly reasonModal = viewChild.required(AccountReasonModal);

  private panelSeq = 0;
  private lastEmittedFinishedKey: string | null = null;
  private destroyed = false;

  readonly selection = input<AccountSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly filter = input<AccountListFilter>({});
  readonly total = input(0);
  readonly size = input<'default' | 'small'>('default');

  readonly jobFinished = output<BulkJob>();

  protected readonly open = signal(false);
  protected readonly panelPlaced = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0 });

  protected readonly resolvedSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly resolvedCount = computed(() => this.resolvedSelection()?.count() ?? 0);

  protected readonly isBusy = computed(() => {
    this.tracker.jobs();
    return this.tracker.hasActive('trading', TRADE_ACCOUNTS_BULK_MODULE_ID);
  });

  protected readonly isDisabled = computed(
    () => this.isBusy() || this.resolvedCount() <= 0 || !this.context().companyId?.trim(),
  );

  protected readonly disabledReason = computed<string | null>(() => {
    this.i18n();
    if (this.isBusy()) {
      return this.transloco.translate('accountsBulk.busy');
    }
    if (!this.context().companyId?.trim()) {
      return this.transloco.translate('tradeShared.errors.TRADE_CONTEXT_MISSING_COMPANY');
    }
    return null;
  });

  protected readonly items = computed<BulkMenuItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'BLOCK',
        title: this.transloco.translate('accountsBulk.action.BLOCK'),
        icon: 'tablerLock',
        tile: 'bg-icon-red',
        danger: true,
      },
      {
        id: 'UNBLOCK',
        title: this.transloco.translate('accountsBulk.action.UNBLOCK'),
        icon: 'tablerLockOpen',
        tile: 'bg-icon-green',
      },
    ];
  });

  constructor() {
    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.lastEmittedFinishedKey = `${initialFinished.id}:${initialFinished.revision}`;
    }

    const onScroll = () => {
      if (this.open()) this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      document.removeEventListener('scroll', onScroll, { capture: true });
    });

    effect(() => {
      if (this.isBusy() && this.open()) {
        untracked(() => this.close());
      }
    });

    effect(() => {
      const finished = this.tracker.finished();
      if (!finished || finished.app !== 'trading' || finished.module !== TRADE_ACCOUNTS_BULK_MODULE_ID) {
        return;
      }
      untracked(() => this.emitJobFinished(finished));
    });

    void this.syncActiveJobs();
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.panelSeq;
    this.panelPlaced.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    this.afterRender(() => this.placePanel(seq));
  }

  protected close(): void {
    this.panelSeq++;
    this.open.set(false);
    this.panelPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onRowClick(item: BulkMenuItem, viaKeyboard = false): void {
    this.close();
    if (viaKeyboard) {
      this.trigger().nativeElement.focus();
    }
    this.reasonModal().open(item.id);
  }

  protected onJobSubmitted(): void {
    this.resolvedSelection()?.clear();
  }

  protected onImmediateJobFinished(job: BulkJob): void {
    this.emitJobFinished(job);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.trigger().nativeElement.focus();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;
    const rows = this.menuRows();
    const index = rows.findIndex((row) => row.nativeElement === target);
    if (index < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      rows[(index + 1) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      rows[(index - 1 + rows.length) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = this.items()[index];
      if (item) this.onRowClick(item, true);
    }
  }

  private emitJobFinished(job: BulkJob): void {
    const key = `${job.id}:${job.revision}`;
    if (this.lastEmittedFinishedKey === key) return;
    this.lastEmittedFinishedKey = key;
    this.jobFinished.emit(job);
  }

  private async syncActiveJobs(): Promise<void> {
    try {
      const page = await listBulkJobs('trading', {
        scope: 'active',
        module: TRADE_ACCOUNTS_BULK_MODULE_ID,
        page: 1,
        limit: 1,
      });
      if (this.destroyed) return;
      const active = page.items[0];
      if (active) {
        this.tracker.syncExternalJob(active);
      }
    } catch {
      // Ignore background active-job check failures.
    }
  }

  private afterRender(fn: () => void): void {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private initialPlace(): Place {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
    };
  }

  private placePanel(seq: number): void {
    if (seq !== this.panelSeq || !this.open() || this.panelPlaced()) return;
    const panelEl = this.panelRef()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top =
      belowTop + panelRect.height > height - 8 ? Math.max(8, rect.top - 4 - panelRect.height) : belowTop;
    const rawStart = rtl ? width - rect.right : rect.left;
    const maxStart = Math.max(8, width - 8 - panelRect.width);
    const start = Math.min(Math.max(8, rawStart), maxStart);

    this.place.set({ top, start });
    this.panelPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.classList.remove('invisible');

    this.menuRows()[0]?.nativeElement.focus();
  }
}
