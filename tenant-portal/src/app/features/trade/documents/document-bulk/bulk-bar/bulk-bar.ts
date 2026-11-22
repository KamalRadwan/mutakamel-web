import {
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBan,
  tablerDots,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPrinter,
  tablerRubberStamp,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { KIND_CONFIG, kindFromSegment } from '../../shared/document-kinds';
import type { DocumentKind, ListQuery } from '../../shared/document.model';
import type { DocumentSelection } from '../../shared/document-selection';
import { invalidateDocumentQueries } from '../../shared/documents.api';
import { BulkParamsModal } from '../bulk-params-modal/bulk-params-modal';
import {
  DOCUMENT_BULK_ACTIONS,
  type DocumentBulkAction,
  type DocumentBulkActionSpec,
} from '../documents-bulk.descriptor';

// later from the session: the action permission (PRINT = the document read permission, RELEASE_HOLD =
// trade.sales_orders.hold) plus trade.bulk_jobs.run; the handlers refuse either missing with 403 TRADE.AUTH.TARGET_DENIED.
const PERMS: Readonly<Record<DocumentKind, Readonly<Partial<Record<DocumentBulkAction, boolean>>>>> = {
  quotation: { SEND: true, PRINT: true, CANCEL: true },
  'sales-order': { HOLD: true, RELEASE_HOLD: true, PRINT: true, CANCEL: true },
  'purchase-order': { SUBMIT: true, PRINT: true, CANCEL: true },
  'purchase-quotation': { ISSUE: true, PRINT: true, CANCEL: true },
};

interface MenuPlace {
  top: number;
  end: number;
}

function kindFromBulkModule(moduleName: string): DocumentKind | null {
  const prefix = 'trading.';
  if (!moduleName.startsWith(prefix)) return null;
  return kindFromSegment(moduleName.slice(prefix.length));
}

let finishInvalidatorInstalled = false;

function ensureFinishInvalidator(envInjector: EnvironmentInjector, tracker: BulkJobsTracker): void {
  if (finishInvalidatorInstalled) return;
  finishInvalidatorInstalled = true;

  let lastFinishedId: string | null = tracker.finished()?.id ?? null;
  runInInjectionContext(envInjector, () => {
    effect(() => {
      const finished = tracker.finished();
      if (!finished || finished.app !== 'trading' || finished.id === lastFinishedId) return;
      lastFinishedId = finished.id;
      const finishedKind = kindFromBulkModule(finished.module);
      if (finishedKind) {
        untracked(() => invalidateDocumentQueries(finishedKind));
      }
    });
  });
}

@Component({
  selector: 'app-document-bulk-bar',
  imports: [NgIcon, TranslocoPipe, Button, BulkParamsModal],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-bulk', alias: 'tdb' },
    ),
    provideIcons({
      tablerSend,
      tablerPrinter,
      tablerBan,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerRubberStamp,
      tablerDots,
    }),
  ],
  templateUrl: './bulk-bar.html',
  host: {
    class: 'block shrink-0',
    '(document:click)': 'closeMenuIfOutside($event)',
    '(window:resize)': 'closeMenu()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DocumentBulkBar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly transloco = inject(TranslocoService);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly i18n = translationEvents(this.transloco);

  private readonly paramsModal = viewChild.required(BulkParamsModal);
  private readonly moreTrigger = viewChild<ElementRef<HTMLButtonElement>>('moreTrigger');
  private readonly morePanel = viewChild<ElementRef<HTMLElement>>('morePanel');
  private readonly menuRows = viewChildren<ElementRef<HTMLButtonElement>>('menuRow');

  readonly kind = input.required<DocumentKind>();
  readonly selection = input.required<DocumentSelection>();
  readonly query = input.required<ListQuery>();
  readonly total = input(0);

  readonly done = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly menuPlaced = signal(false);
  protected readonly menuPlace = signal<MenuPlace>({ top: 0, end: 0 });

  private menuSeq = 0;
  private lastEmittedFinishedId: string | null = this.tracker.finished()?.id ?? null;

  protected readonly selectedCount = computed(() => this.selection().count(this.total()));
  protected readonly canSelectAll = computed(
    () => this.selection().mode() === 'ids' && this.total() > this.selectedCount(),
  );
  protected readonly tooMany = computed(() => this.selection().exceedsLimit(this.total()));
  protected readonly busy = computed(() => this.tracker.hasActive('trading'));
  protected readonly actionsDisabled = computed(
    () => this.selectedCount() <= 0 || this.tooMany() || this.busy(),
  );

  protected readonly disabledTooltip = computed<string | null>(() => {
    this.i18n();
    if (this.busy()) return this.transloco.translate('tdb.bar.busy');
    if (this.tooMany()) return this.transloco.translate('tdb.bar.tooMany');
    return null;
  });

  private readonly permittedActions = computed<readonly DocumentBulkActionSpec[]>(() => {
    const kind = this.kind();
    const perms = PERMS[kind];
    return DOCUMENT_BULK_ACTIONS[kind].filter((spec) => perms[spec.id] === true);
  });

  protected readonly barActions = computed<readonly DocumentBulkActionSpec[]>(() =>
    this.permittedActions().filter((spec) => spec.placement === 'bar'),
  );

  protected readonly menuActions = computed<readonly DocumentBulkActionSpec[]>(() =>
    this.permittedActions().filter((spec) => spec.placement === 'menu'),
  );

  constructor() {
    ensureFinishInvalidator(this.envInjector, this.tracker);

    const onScroll = (event: Event) => {
      if (!this.menuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.morePanel()?.nativeElement.contains(target)) return;
      this.closeMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));

    effect(() => {
      if (this.actionsDisabled() && this.menuOpen()) {
        untracked(() => this.closeMenu());
      }
    });

    effect(() => {
      const finished = this.tracker.finished();
      const moduleName = `trading.${KIND_CONFIG[this.kind()].segment}`;
      if (
        !finished ||
        finished.app !== 'trading' ||
        finished.module !== moduleName ||
        finished.id === this.lastEmittedFinishedId
      ) {
        return;
      }
      this.lastEmittedFinishedId = finished.id;
      untracked(() => this.done.emit());
    });
  }

  protected selectAll(): void {
    this.selection().selectAll();
  }

  protected clearSelection(): void {
    this.closeMenu();
    this.selection().clear();
  }

  protected openAction(action: DocumentBulkAction): void {
    if (this.actionsDisabled()) return;
    this.closeMenu();
    this.paramsModal().open(action);
  }

  protected toggleMenu(): void {
    if (this.actionsDisabled() || this.menuActions().length === 0) return;
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    const trigger = this.moreTrigger()?.nativeElement;
    if (!trigger) return;

    const seq = ++this.menuSeq;
    this.menuPlaced.set(false);
    this.menuPlace.set(this.initialPlace(trigger));
    this.menuOpen.set(true);
    this.afterRender(() => this.placeMenu(seq, trigger));
  }

  protected closeMenu(): void {
    this.menuSeq++;
    this.menuOpen.set(false);
    this.menuPlaced.set(false);
  }

  protected closeMenuIfOutside(event: Event): void {
    if (!this.menuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  protected onMenuRowClick(spec: DocumentBulkActionSpec, viaKeyboard = false): void {
    if (this.actionsDisabled()) return;
    this.closeMenu();
    if (viaKeyboard) {
      this.moreTrigger()?.nativeElement.focus();
    }
    this.paramsModal().open(spec.id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu();
      this.moreTrigger()?.nativeElement.focus();
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
    } else if (event.key === 'Home') {
      event.preventDefault();
      rows[0]?.nativeElement.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      rows[rows.length - 1]?.nativeElement.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = this.menuActions()[index];
      if (item) this.onMenuRowClick(item, true);
    }
  }

  private afterRender(fn: () => void): void {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private initialPlace(trigger: HTMLElement): MenuPlace {
    const rect = rectInPage(trigger);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      end: rtl ? rect.left : width - rect.right,
    };
  }

  private placeMenu(seq: number, trigger: HTMLElement): void {
    if (seq !== this.menuSeq || !this.menuOpen() || this.menuPlaced()) return;
    const panelEl = this.morePanel()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(trigger);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top =
      belowTop + panelRect.height > height - 8 ? Math.max(8, rect.top - 4 - panelRect.height) : belowTop;
    const rawEnd = rtl ? rect.left : width - rect.right;
    const maxEnd = Math.max(8, width - 8 - panelRect.width);
    const end = Math.min(Math.max(8, rawEnd), maxEnd);

    this.menuPlace.set({ top, end });
    this.menuPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineEnd = `${end}px`;
    panelEl.classList.remove('invisible');

    this.menuRows()[0]?.nativeElement.focus();
  }
}
