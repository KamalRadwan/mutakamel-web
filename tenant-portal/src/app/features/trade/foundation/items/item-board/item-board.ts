import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBan,
  tablerChevronsLeft,
  tablerChevronsRight,
  tablerInbox,
  tablerPlus,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage } from '../../../../../shared/ui/overlay/zoom';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError, errorCodeOf, type TradeContext } from '../../../shared/trade-api';
import { itemName } from '../../../shared/trade-foundation.api';
import type { ItemRow, ItemStatus } from '../../../shared/trade-foundation.model';
import { ALLOWED_ITEM_STATUS_MOVES, ITEM_STATUS_KEY } from '../../../shared/trade-labels';
import { ItemCard, type ItemActionId } from '../item-card/item-card';
import { getItemDetail, itemErrorKey, listItems, moveItemStatus } from '../items.api';
import { actionKey } from '../../action-keys';
import { ITEM_BOARD_PAGE, ITEM_STATUSES, type ItemListFilter, type ItemStatusReason } from '../items.model';

export interface DraggedItem {
  itemId: string;
  fromStatus: ItemStatus;
  height: number;
}

interface BoardLane {
  status: ItemStatus;
  items: ItemRow[];
  total: number;
  page: number;
}

const COLLAPSED_KEY = 'trade.items.board.collapsed';

const STATUS_BAR_CLASS: Record<ItemStatus, string> = {
  DRAFT: 'bg-status-none',
  ACTIVE: 'bg-success',
  INACTIVE: 'bg-border-field',
  DISCONTINUED: 'bg-danger',
};

function isDraggedItem(data: Record<string | symbol, unknown>): data is Record<string | symbol, unknown> & DraggedItem {
  return typeof data['itemId'] === 'string' && typeof data['fromStatus'] === 'string';
}

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

function readCollapsed(): ReadonlySet<ItemStatus> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (raw === null) return new Set<ItemStatus>(['DISCONTINUED']);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) {
      return new Set<ItemStatus>(['DISCONTINUED']);
    }
    const valid = parsed.filter((s): s is ItemStatus => (ITEM_STATUSES as readonly string[]).includes(s));
    return new Set<ItemStatus>(valid);
  } catch {
    return new Set<ItemStatus>(['DISCONTINUED']);
  }
}

function writeCollapsed(ids: ReadonlySet<ItemStatus>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

@Directive({
  selector: '[itemDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class ItemDrag {
  readonly itemDrag = input.required<string>();
  readonly itemStatus = input.required<ItemStatus>();
  readonly dragDisabled = input(false);
  readonly dragStateChange = output<boolean>();

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      let pressed: Element | null = null;
      const restore = () => {
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        element.draggable = true;
      };
      const onPointerDown = (event: PointerEvent) => {
        pressed =
          event.target instanceof Element
            ? event.target
            : event.target instanceof Node
              ? event.target.parentElement
              : null;
        if (!pressed?.closest('[data-no-drag]')) return;
        element.draggable = false;
        document.addEventListener('pointerup', restore, { once: true });
        document.addEventListener('pointercancel', restore, { once: true });
      };
      element.addEventListener('pointerdown', onPointerDown, true);

      const cleanup = draggable({
        element,
        canDrag: () => !this.dragDisabled() && !pressed?.closest('[data-no-drag]'),
        getInitialData: () => ({
          itemId: this.itemDrag(),
          fromStatus: this.itemStatus(),
          height: element.offsetHeight,
        }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({ element: source.element, input: location.current.input });
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: (args) => {
              const { x, y } = offset(args);
              const frame = parseFloat(getComputedStyle(args.container.firstElementChild!).paddingTop);
              return { x: x + frame, y: y + frame };
            },
            render: ({ container }) => {
              const frame = document.createElement('div');
              frame.className = 'drag-preview-frame';
              const copy = element.cloneNode(true) as HTMLElement;
              copy.style.width = `${element.offsetWidth}px`;
              copy.classList.add('drag-preview');
              frame.append(copy);
              container.append(frame);
            },
          });
        },
        onDragStart: () => {
          this.dragging.set(true);
          this.dragStateChange.emit(true);
        },
        onDrop: () => {
          this.dragging.set(false);
          this.dragStateChange.emit(false);
        },
      });

      destroyRef.onDestroy(() => {
        element.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        cleanup();
      });
    });
  }
}

@Directive({
  selector: '[itemDrop]',
  exportAs: 'itemDrop',
})
export class ItemDrop {
  readonly itemDrop = input.required<ItemStatus>();
  readonly dropped = output<DraggedItem>();

  readonly over = signal<DraggedItem | null>(null);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          isDraggedItem(source.data) && ALLOWED_ITEM_STATUS_MOVES[source.data.fromStatus].includes(this.itemDrop()),
        getData: () => ({ status: this.itemDrop() }),
        onDragEnter: ({ source }) => this.enter(source.data),
        onDragLeave: () => this.over.set(null),
        onDrop: ({ source }) => {
          this.over.set(null);
          if (
            isDraggedItem(source.data) &&
            ALLOWED_ITEM_STATUS_MOVES[source.data.fromStatus].includes(this.itemDrop())
          ) {
            this.dropped.emit(source.data);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }

  private enter(data: Record<string | symbol, unknown>): void {
    if (isDraggedItem(data) && ALLOWED_ITEM_STATUS_MOVES[data.fromStatus].includes(this.itemDrop())) {
      this.over.set(data);
    }
  }
}

@Component({
  selector: 'app-item-board',
  imports: [NgIcon, TranslocoPipe, Button, Modal, TradeReasonPicker, UnsavedDialog, ItemCard, ItemDrag, ItemDrop],
  providers: [
    provideIcons({
      tablerPlus,
      tablerBan,
      tablerChevronsLeft,
      tablerChevronsRight,
      tablerInbox,
      tablerAlertTriangle,
      tablerRefresh,
    }),
  ],
  templateUrl: './item-board.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class ItemBoard {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly boardRoot = viewChild<ElementRef<HTMLElement>>('boardRoot');
  private readonly discontinueModal = viewChild.required<Modal>('discontinueModal');
  protected readonly discontinueReasonPicker = viewChild<TradeReasonPicker>('discontinueReasonPicker');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');

  readonly context = input.required<TradeContext>();
  readonly filter = input.required<ItemListFilter>();
  readonly companyView = input(false);
  readonly canManage = input(true);
  readonly showThumbs = input(true);
  readonly companyName = input('');
  readonly hasFilters = input(false);
  readonly refreshToken = input(0);

  readonly create = output<void>();
  readonly open = output<ItemRow>();
  readonly clearSearch = output<void>();
  readonly countsChanged = output<void>();
  readonly forbidden = output<void>();

  protected readonly skeletonCards = [1, 2, 3];
  protected readonly statusKey = ITEM_STATUS_KEY;
  protected readonly statusBarClass = STATUS_BAR_CLASS;

  protected readonly columnMinHeight = signal(0);
  protected readonly collapsed = signal<ReadonlySet<ItemStatus>>(readCollapsed());
  protected readonly lanes = signal<BoardLane[]>(
    ITEM_STATUSES.map((status) => ({ status, items: [], total: 0, page: 1 })),
  );
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly loadingMore = signal<ItemStatus | null>(null);
  protected readonly draggingFrom = signal<ItemStatus | null>(null);
  protected readonly discontinueTargetName = signal('');
  protected readonly discontinueOpen = signal(false);
  protected readonly discontinueSubmitted = signal(false);
  protected readonly discontinueReason = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  private discontinueResolver: ((reason: ItemStatusReason | null) => void) | null = null;

  private readonly moveBusyIds = new Set<string>();
  private loadSeq = 0;

  protected readonly allEmpty = computed(
    () => !this.loading() && !this.failed() && this.lanes().every((lane) => lane.total === 0),
  );

  constructor() {
    effect(() => {
      const ctx = this.context();
      const filter = this.filter();
      this.refreshToken();
      this.language();
      untracked(() => void this.loadBoard(ctx, filter));
    });

    effect(() => {
      this.lanes();
      this.loading();
      this.failed();
      setTimeout(() => requestAnimationFrame(() => this.measureColumns()));
    });

    effect((onCleanup) => {
      const board = this.boardRoot()?.nativeElement;
      if (!board) return;
      const main = board.closest('main');
      const observer = new ResizeObserver(() => this.measureColumns());
      if (main) observer.observe(main);
      const page = board.parentElement;
      if (page) observer.observe(page);
      observer.observe(board);
      this.measureColumns();
      onCleanup(() => observer.disconnect());
    });

    inject(DestroyRef).onDestroy(() => this.settleDiscontinue(null));
  }

  refresh(): void {
    void this.loadBoard(this.context(), this.filter());
  }

  listIdsFor(itemId: string | null): string[] {
    const current = this.lanes();
    if (itemId) {
      const lane = current.find((entry) => entry.items.some((item) => item.id === itemId));
      if (lane) return lane.items.map((item) => item.id);
    }
    return current.flatMap((entry) => entry.items.map((item) => item.id));
  }

  protected retry(): void {
    this.refresh();
  }

  protected toggleCollapse(status: ItemStatus): void {
    const next = new Set(this.collapsed());
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    this.collapsed.set(next);
    writeCollapsed(next);
  }

  protected onDragState(fromStatus: ItemStatus | null): void {
    this.draggingFrom.set(fromStatus);
  }

  protected isIllegalTarget(targetStatus: ItemStatus): boolean {
    const from = this.draggingFrom();
    if (!from || from === targetStatus) return false;
    return !ALLOWED_ITEM_STATUS_MOVES[from].includes(targetStatus);
  }

  protected illegalTitle(targetStatus: ItemStatus): string | null {
    this.i18n();
    const from = this.draggingFrom();
    if (!from || from === targetStatus) return null;
    if (ALLOWED_ITEM_STATUS_MOVES[from].includes(targetStatus)) return null;
    return this.transloco.translate('tradeItems.board.illegal', {
      from: this.transloco.translate(ITEM_STATUS_KEY[from]),
      to: this.transloco.translate(ITEM_STATUS_KEY[targetStatus]),
    });
  }

  protected onDropped(toStatus: ItemStatus, dragged: DraggedItem): void {
    this.draggingFrom.set(null);
    const fromLane = this.lanes().find((lane) => lane.status === dragged.fromStatus);
    const item = fromLane?.items.find((entry) => entry.id === dragged.itemId);
    if (!item) return;
    void this.moveStatus(item, toStatus);
  }

  protected onCardAction(item: ItemRow, action: ItemActionId): void {
    switch (action) {
      case 'open':
      case 'edit':
        this.open.emit(item);
        break;
      case 'activate':
        void this.moveStatus(item, 'ACTIVE');
        break;
      case 'deactivate':
        void this.moveStatus(item, 'INACTIVE');
        break;
      case 'discontinue':
        void this.moveStatus(item, 'DISCONTINUED');
        break;
      case 'copyCode':
        void this.copyCode(item.canonicalCode);
        break;
    }
  }

  protected async loadMore(lane: BoardLane): Promise<void> {
    if (this.loadingMore() === lane.status || lane.items.length >= lane.total) return;
    const seq = this.loadSeq;
    const nextPage = lane.page + 1;
    this.loadingMore.set(lane.status);
    try {
      const page = await listItems(this.context(), {
        ...this.filter(),
        status: lane.status,
        page: nextPage,
        limit: ITEM_BOARD_PAGE,
      });
      if (seq !== this.loadSeq) return;
      this.lanes.update((lanes) =>
        lanes.map((entry) => {
          if (entry.status !== lane.status) return entry;
          const existingIds = new Set(entry.items.map((item) => item.id));
          const merged = [...entry.items, ...page.items.filter((item) => !existingIds.has(item.id))];
          return { ...entry, items: merged, total: page.total, page: nextPage };
        }),
      );
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      if (this.loadingMore() === lane.status) {
        this.loadingMore.set(null);
      }
    }
  }

  private async loadBoard(ctx: TradeContext, filter: ItemListFilter): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const pages = await Promise.all(
        ITEM_STATUSES.map((status) =>
          listItems(ctx, {
            ...filter,
            status,
            page: 1,
            limit: ITEM_BOARD_PAGE,
          }),
        ),
      );
      if (seq !== this.loadSeq) return;
      this.lanes.set(
        ITEM_STATUSES.map((status, index) => ({
          status,
          items: pages[index].items,
          total: pages[index].total,
          page: 1,
        })),
      );
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.failed.set(true);
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async reloadColumns(statuses: readonly ItemStatus[]): Promise<void> {
    const unique = Array.from(new Set(statuses));
    const seq = this.loadSeq;
    try {
      const pages = await Promise.all(
        unique.map((status) =>
          listItems(this.context(), {
            ...this.filter(),
            status,
            page: 1,
            limit: ITEM_BOARD_PAGE,
          }),
        ),
      );
      if (seq !== this.loadSeq) return;
      const byStatus = new Map(unique.map((status, index) => [status, pages[index]]));
      this.lanes.update((lanes) =>
        lanes.map((lane) => {
          const page = byStatus.get(lane.status);
          return page ? { ...lane, items: page.items, total: page.total, page: 1 } : lane;
        }),
      );
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    }
  }

  protected confirmDiscontinue(): void {
    this.discontinueSubmitted.set(true);
    if (!this.discontinueReasonPicker()?.valid()) return;
    const val = this.discontinueReason();
    if (!val.reasonCodeId) return;
    const note = val.note.trim();
    this.settleDiscontinue({
      reasonCodeId: val.reasonCodeId,
      ...(note ? { reasonNote: note } : {}),
    });
    this.discontinueModal().close();
  }

  protected cancelDiscontinue(): void {
    this.settleDiscontinue(null);
    this.discontinueModal().close();
  }

  protected onDiscontinueClosed(): void {
    this.discontinueOpen.set(false);
    this.settleDiscontinue(null);
  }

  private promptDiscontinueReason(item: ItemRow): Promise<ItemStatusReason | null> {
    this.settleDiscontinue(null);
    this.discontinueTargetName.set(itemName(item, this.language()));
    this.discontinueReason.set({ reasonCodeId: null, note: '' });
    this.discontinueSubmitted.set(false);
    this.discontinueOpen.set(true);
    this.discontinueModal().open();
    return new Promise<ItemStatusReason | null>((resolve) => {
      this.discontinueResolver = resolve;
    });
  }

  private settleDiscontinue(result: ItemStatusReason | null): void {
    const resolve = this.discontinueResolver;
    this.discontinueResolver = null;
    resolve?.(result);
  }

  private async moveStatus(item: ItemRow, toStatus: ItemStatus): Promise<void> {
    const fromStatus = item.status;
    if (fromStatus === toStatus || !ALLOWED_ITEM_STATUS_MOVES[fromStatus].includes(toStatus)) {
      return;
    }
    if (this.moveBusyIds.has(item.id)) {
      return;
    }

    let reason: ItemStatusReason | undefined;
    if (toStatus === 'DISCONTINUED') {
      const picked = await this.promptDiscontinueReason(item);
      if (!picked) return;
      reason = picked;
    }

    this.moveBusyIds.add(item.id);
    const before = this.lanes();
    const optimistic: ItemRow = { ...item, status: toStatus };

    this.lanes.set(
      before.map((lane) => {
        if (lane.status === fromStatus) {
          return {
            ...lane,
            items: lane.items.filter((entry) => entry.id !== item.id),
            total: Math.max(0, lane.total - 1),
          };
        }
        if (lane.status === toStatus) {
          return {
            ...lane,
            items: [optimistic, ...lane.items],
            total: lane.total + 1,
          };
        }
        return lane;
      }),
    );

    try {
      const itemMove = actionKey('status', item.id, item.version, toStatus, reason);
      const saved = await moveItemStatus(item.id, item.version, toStatus, itemMove.key, reason);
      itemMove.done();
      this.lanes.update((lanes) =>
        lanes.map((lane) =>
          lane.status === toStatus
            ? {
                ...lane,
                items: lane.items.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        status: saved.status,
                        version: saved.version,
                        updatedAt: saved.updatedAt,
                      }
                    : entry,
                ),
              }
            : lane,
        ),
      );
      this.countsChanged.emit();
    } catch (error) {
      this.lanes.set(before);
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const choice = await this.conflictDialog().open();
        if (choice === 'save') {
          await this.reloadColumns([fromStatus, toStatus]);
          this.countsChanged.emit();
        } else if (choice === 'discard') {
          try {
            const fresh = await getItemDetail(this.context(), item.id);
            const freshMove = actionKey('status', fresh.id, fresh.version, toStatus, reason);
            await moveItemStatus(fresh.id, fresh.version, toStatus, freshMove.key, reason);
            freshMove.done();
            await this.reloadColumns([fromStatus, toStatus]);
            this.countsChanged.emit();
          } catch (retryError) {
            if (isForbiddenError(retryError)) {
              this.forbidden.emit();
              return;
            }
            this.notify.error(this.transloco.translate(itemErrorKey(retryError)));
            await this.reloadColumns([fromStatus, toStatus]);
          }
        }
      } else if (isForbiddenError(error)) {
        this.forbidden.emit();
      } else {
        this.notify.error(this.transloco.translate(itemErrorKey(error)));
      }
    } finally {
      this.moveBusyIds.delete(item.id);
    }
  }

  private async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(code);
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    } catch {
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    }
  }

  private measureColumns(): void {
    const board = this.boardRoot()?.nativeElement;
    if (!board) return;
    const main = board.closest('main');
    if (!main) return;
    const offsetInMain = rectInPage(board).top - rectInPage(main).top + main.scrollTop;
    const scrollbar = board.offsetHeight - board.clientHeight;
    const mainPadBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0;
    const bottomGap = 8 + 12 + scrollbar + mainPadBottom;
    const min = Math.max(0, Math.floor(main.clientHeight - offsetInMain - bottomGap));
    this.columnMinHeight.set(min);
    requestAnimationFrame(() => {
      if (board.offsetHeight - board.clientHeight !== scrollbar) {
        this.measureColumns();
      }
    });
  }
}
