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
import {
  tablerArrowsExchange,
  tablerCheck,
  tablerChevronDown,
  tablerEdit,
  tablerTag,
} from '@ng-icons/tabler-icons';
import { listBulkJobs } from '../../../../../../shared/bulk-jobs/bulk-jobs.api';
import { type BulkJob, isBulkJobActive } from '../../../../../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import type { TradeContext } from '../../../../shared/trade-api';
import { ItemBulkCapabilitiesModal } from '../capabilities-modal/item-bulk-capabilities-modal';
import { ItemBulkCategoryModal } from '../category-modal/item-bulk-category-modal';
import { ItemBulkEnableModal } from '../enable-modal/item-bulk-enable-modal';
import {
  type BulkSubmitOutcome,
  type ItemBulkAction,
  type ItemBulkFilter,
  TRADE_ITEMS_BULK_APP,
  TRADE_ITEMS_BULK_MODULE_NAME,
} from '../item-bulk.model';
import { ItemSelection } from '../item-selection';
import { ItemBulkStatusModal } from '../status-modal/item-bulk-status-modal';

interface BulkMenuRow {
  id: ItemBulkAction;
  title: string;
  icon: string;
  tile: string;
}

interface Place {
  top: number;
  start: number;
}

@Component({
  selector: 'app-item-bulk-menu',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ItemBulkStatusModal,
    ItemBulkCategoryModal,
    ItemBulkEnableModal,
    ItemBulkCapabilitiesModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-items-bulk', alias: 'itemsBulk' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({
      tablerChevronDown,
      tablerArrowsExchange,
      tablerTag,
      tablerCheck,
      tablerEdit,
    }),
  ],
  templateUrl: './item-bulk-menu.html',
  host: {
    '[class]':
      "(selectedCount() > 0 && canManage()) || activeModal() !== null ? 'relative inline-flex shrink-0' : 'hidden'",
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ItemBulkMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly injectedSelection = inject(ItemSelection, { optional: true });

  private readonly trigger = viewChild<Button, ElementRef<HTMLButtonElement>>('trigger', {
    read: ElementRef,
  });
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly menuRows = viewChildren<ElementRef<HTMLButtonElement>>('menuRow');
  private readonly statusModal = viewChild.required(ItemBulkStatusModal);
  private readonly categoryModal = viewChild.required(ItemBulkCategoryModal);
  private readonly enableModal = viewChild.required(ItemBulkEnableModal);
  private readonly capabilitiesModal = viewChild.required(ItemBulkCapabilitiesModal);

  readonly selection = input<ItemSelection | null>(null);
  readonly context = input<TradeContext>({});
  readonly filter = input<ItemBulkFilter>({});
  readonly total = input(0);
  readonly canManage = input(true);

  readonly jobFinished = output<BulkJob>();

  protected readonly open = signal(false);
  protected readonly panelPlaced = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0 });
  protected readonly activeModal = signal<ItemBulkAction | null>(null);
  private readonly serverActive = signal(false);

  private panelSeq = 0;
  private activeCheckSeq = 0;
  private destroyed = false;
  private readonly seenFinishedIds = new Set<string>();

  protected readonly activeSelection = computed(() => this.selection() ?? this.injectedSelection);
  protected readonly selectedCount = computed(() => this.activeSelection()?.count() ?? 0);
  protected readonly isCompanyScope = computed(() => Boolean(this.context().companyId));
  /**
   * Status and category are item master actions: the backend runs them in tenant scope only, so they are
   * offered from the catalogue list, never from the company list (its QUERY selection is company-bound).
   */
  protected readonly canRunMasterActions = computed(() => this.filter().scope !== 'COMPANY');
  protected readonly busy = computed(
    () =>
      this.tracker.hasActive(TRADE_ITEMS_BULK_APP, TRADE_ITEMS_BULK_MODULE_NAME) ||
      this.serverActive(),
  );

  protected readonly items = computed<BulkMenuRow[]>(() => {
    this.i18n();
    const list: BulkMenuRow[] = [];
    if (this.canRunMasterActions()) {
      list.push(
        {
          id: 'SET_STATUS',
          title: this.transloco.translate('itemsBulk.action.SET_STATUS'),
          icon: 'tablerArrowsExchange',
          tile: 'bg-icon-violet',
        },
        {
          id: 'SET_CATEGORY',
          title: this.transloco.translate('itemsBulk.action.SET_CATEGORY'),
          icon: 'tablerTag',
          tile: 'bg-icon-orange',
        },
      );
    }

    if (this.isCompanyScope()) {
      list.push(
        {
          id: 'ENABLE_FOR_COMPANY',
          title: this.transloco.translate('itemsBulk.action.ENABLE_FOR_COMPANY'),
          icon: 'tablerCheck',
          tile: 'bg-icon-green',
        },
        {
          id: 'SET_CAPABILITIES',
          title: this.transloco.translate('itemsBulk.action.SET_CAPABILITIES'),
          icon: 'tablerEdit',
          tile: 'bg-icon-blue',
        },
      );
    }

    return list;
  });

  constructor() {
    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.seenFinishedIds.add(initialFinished.id);
    }

    effect(() => {
      this.context();
      untracked(() => void this.refreshServerActive());
    });

    effect(() => {
      if (this.busy() || this.selectedCount() === 0 || !this.canManage()) {
        untracked(() => this.close());
      }
    });

    effect(() => {
      const finished = this.tracker.finished();
      if (
        !finished ||
        finished.app !== TRADE_ITEMS_BULK_APP ||
        finished.module !== TRADE_ITEMS_BULK_MODULE_NAME
      ) {
        return;
      }
      if (this.seenFinishedIds.has(finished.id)) return;
      this.seenFinishedIds.add(finished.id);
      untracked(() => {
        this.serverActive.set(false);
        this.jobFinished.emit(finished);
      });
    });

    const onScroll = () => this.close();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  protected toggle(): void {
    if (this.busy() || this.selectedCount() === 0 || !this.canManage()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const triggerEl = this.trigger()?.nativeElement;
    if (!triggerEl) return;
    const seq = ++this.panelSeq;
    this.panelPlaced.set(false);
    this.place.set(this.initialPlace(triggerEl));
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

  protected onRowClick(item: BulkMenuRow, viaKeyboard = false): void {
    if (this.busy()) return;
    this.close();
    if (viaKeyboard) {
      this.trigger()?.nativeElement.focus();
    }
    this.openActionModal(item.id);
  }

  protected onModalClosed(): void {
    this.activeModal.set(null);
  }

  protected onSubmitted(outcome: BulkSubmitOutcome): void {
    // Clearing the selection removes this menu (and its trigger); hand focus to the toolbar.
    const focusReturn = this.host.nativeElement.closest<HTMLElement>('[data-bulk-focus-return]');
    this.activeSelection()?.clear();
    if (focusReturn) setTimeout(() => focusReturn.focus());
    if (outcome.finishedJob && !this.seenFinishedIds.has(outcome.finishedJob.id)) {
      this.seenFinishedIds.add(outcome.finishedJob.id);
      this.serverActive.set(false);
      this.jobFinished.emit(outcome.finishedJob);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.trigger()?.nativeElement.focus();
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

  private openActionModal(action: ItemBulkAction): void {
    this.activeModal.set(action);
    switch (action) {
      case 'SET_STATUS':
        if (this.canRunMasterActions()) {
          this.statusModal().open();
        } else {
          this.activeModal.set(null);
        }
        break;
      case 'SET_CATEGORY':
        if (this.canRunMasterActions()) {
          this.categoryModal().open();
        } else {
          this.activeModal.set(null);
        }
        break;
      case 'ENABLE_FOR_COMPANY':
        if (this.isCompanyScope()) {
          this.enableModal().open();
        } else {
          this.activeModal.set(null);
        }
        break;
      case 'SET_CAPABILITIES':
        if (this.isCompanyScope()) {
          this.capabilitiesModal().open();
        } else {
          this.activeModal.set(null);
        }
        break;
    }
  }

  private async refreshServerActive(): Promise<void> {
    const seq = ++this.activeCheckSeq;
    try {
      const page = await listBulkJobs(TRADE_ITEMS_BULK_APP, {
        scope: 'active',
        module: TRADE_ITEMS_BULK_MODULE_NAME,
        page: 1,
        limit: 10,
      });
      if (seq !== this.activeCheckSeq || this.destroyed) return;
      for (const job of page.items) {
        this.tracker.syncExternalJob(job);
      }
      this.serverActive.set(page.items.some((job) => isBulkJobActive(job.status)));
    } catch {
      // Keep tracker state when active-job check cannot complete.
    }
  }

  private afterRender(fn: () => void): void {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private initialPlace(triggerEl: HTMLElement): Place {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
    };
  }

  private placePanel(seq: number): void {
    if (seq !== this.panelSeq || !this.open() || this.panelPlaced()) return;
    const triggerEl = this.trigger()?.nativeElement;
    const panelEl = this.panelRef()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top =
      belowTop + panelRect.height > height - 8
        ? Math.max(8, rect.top - 4 - panelRect.height)
        : belowTop;
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
