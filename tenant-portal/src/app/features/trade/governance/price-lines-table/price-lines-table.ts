import {
  CdkDrag,
  type CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
} from '@angular/cdk/drag-drop';
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
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerBox,
  tablerCheck,
  tablerChevronDown,
  tablerCloudOff,
  tablerGripVertical,
  tablerLoader2,
  tablerPackages,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTool,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { rectInPage, viewport } from '../../../../shared/ui/overlay/zoom';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { type TradeContext, tradeContext } from '../../shared/trade-api';
import { itemName, searchItems } from '../../shared/trade-foundation.api';
import type { ItemKind, ItemRow, Uom } from '../../shared/trade-foundation.model';
import { ITEM_KIND_TILE, type TileSpec } from '../../shared/trade-labels';
import type { PriceVersionDetailEntry } from '../pricing.model';
import { formatMoney, formatQty } from '../../shared/trade-format';
import { formatUnitPrice } from '../pricing.service';

export interface PriceLineRow extends PriceVersionDetailEntry {
  isNew?: boolean;
}

export interface LineFieldErrors {
  itemId?: string;
  uomId?: string;
  minimumQuantity?: string;
  maximumQuantity?: string;
  unitPrice?: string;
  minimumAllowedPrice?: string;
  priority?: string;
}

const DECIMAL_RE = /^(0|[1-9]\d{0,15})(\.\d{1,8})?$/;
const SCALE = 8;
const SCALE_FACTOR = 100_000_000n;
const DEBOUNCE_MS = 250;

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function toScaled(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!DECIMAL_RE.test(trimmed)) return null;
  const [intPart, fracRaw = ''] = trimmed.split('.');
  const fracPart = fracRaw.slice(0, SCALE).padEnd(SCALE, '0');
  return BigInt(intPart) * SCALE_FACTOR + BigInt(fracPart);
}

function intervalsOverlap(
  minA: bigint,
  maxA: bigint | null,
  minB: bigint,
  maxB: bigint | null,
): boolean {
  const aBeforeB = maxA !== null && maxA <= minB;
  const bBeforeA = maxB !== null && maxB <= minA;
  return !aBeforeB && !bBeforeA;
}

export function validateLineRow(
  row: PriceLineRow,
  translate: (key: string, params?: Record<string, unknown>) => string,
): LineFieldErrors {
  const errs: LineFieldErrors = {};

  if (!row.itemId.trim()) {
    errs.itemId = translate('pricing.lines.errors.itemRequired');
  }
  if (!row.uomId.trim()) {
    errs.uomId = translate('pricing.lines.errors.unitRequired');
  }

  const minRaw = row.minimumQuantity.trim();
  const minScaled = minRaw ? toScaled(minRaw) : null;
  if (!minRaw) {
    errs.minimumQuantity = translate('pricing.lines.errors.minQtyRequired');
  } else if (minScaled === null) {
    errs.minimumQuantity = translate('pricing.lines.errors.invalidDecimal');
  }

  const maxRaw = row.maximumQuantity?.trim() ?? '';
  if (maxRaw) {
    const maxScaled = toScaled(maxRaw);
    if (maxScaled === null) {
      errs.maximumQuantity = translate('pricing.lines.errors.invalidDecimal');
    } else if (minScaled !== null && maxScaled <= minScaled) {
      errs.maximumQuantity = translate('pricing.lines.errors.maxAfterMin');
    }
  }

  const priceRaw = row.unitPrice.trim();
  const priceScaled = priceRaw ? toScaled(priceRaw) : null;
  if (!priceRaw) {
    errs.unitPrice = translate('pricing.lines.errors.unitPriceRequired');
  } else if (priceScaled === null) {
    errs.unitPrice = translate('pricing.lines.errors.invalidDecimal');
  }

  const floorRaw = row.minimumAllowedPrice?.trim() ?? '';
  if (floorRaw) {
    const floorScaled = toScaled(floorRaw);
    if (floorScaled === null) {
      errs.minimumAllowedPrice = translate('pricing.lines.errors.invalidDecimal');
    } else if (priceScaled !== null && floorScaled > priceScaled) {
      errs.minimumAllowedPrice = translate('pricing.lines.errors.floorExceedsPrice');
    }
  }

  if (!Number.isInteger(row.priority) || row.priority < 0 || row.priority > 10_000) {
    errs.priority = translate('pricing.lines.errors.priorityRange');
  }

  return errs;
}

export function hasLineErrors(errors: LineFieldErrors): boolean {
  return Boolean(
    errors.itemId ||
      errors.uomId ||
      errors.minimumQuantity ||
      errors.maximumQuantity ||
      errors.unitPrice ||
      errors.minimumAllowedPrice ||
      errors.priority,
  );
}

@Component({
  selector: 'app-price-lines-table',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Dropdown,
    Pagination,
  ],
  providers: [
    provideIcons({
      tablerArrowDown,
      tablerArrowUp,
      tablerBox,
      tablerCheck,
      tablerChevronDown,
      tablerCloudOff,
      tablerGripVertical,
      tablerLoader2,
      tablerPackages,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerTool,
      tablerTrash,
      tablerX,
    }),
  ],
  templateUrl: './price-lines-table.html',
  host: {
    class: 'flex flex-col gap-8',
    '(document:click)': 'closeItemIfOutside($event)',
    '(window:resize)': 'closeItemMenu(true)',
  },
})
export class PriceLinesTable {
  private static nextId = 0;
  protected readonly uid = `gov-price-lines-${++PriceLinesTable.nextId}`;
  protected readonly itemListId = `${this.uid}-item-list`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  protected readonly lang = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly itemListRef = viewChild<ElementRef<HTMLElement>>('itemList');

  readonly entries = input.required<readonly PriceLineRow[]>();
  readonly allUpserts = input<readonly PriceLineRow[]>([]);
  readonly uoms = input.required<readonly Uom[]>();
  readonly currencyCode = input.required<string>();
  readonly editable = input(false);
  readonly canViewCost = input(false);
  readonly loading = input(false);
  readonly loadFailed = input(false);
  readonly total = input(0);
  readonly page = model(1);
  readonly pageSize = model(50);
  readonly search = input('');
  readonly uomFilter = input('');
  readonly makerCheckerCaption = input<string | null>(null);
  readonly serverOverlapErrors = input<ReadonlyMap<string, number>>(new Map());
  readonly focusRowId = input<string | null>(null);
  readonly showAllErrors = input(false);

  readonly searchChange = output<string>();
  readonly uomFilterChange = output<string>();
  readonly retry = output<void>();
  readonly entryChange = output<PriceLineRow>();
  readonly entryRemove = output<string>();
  readonly addLine = output<void>();
  readonly reorder = output<{ fromIndex: number; toIndex: number }>();
  readonly focusHandled = output<void>();

  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly pageSizes = [25, 50, 100];

  protected readonly searchDraft = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly touchedRows = signal<ReadonlySet<string>>(new Set());
  private readonly priorityRawById = signal<Readonly<Record<string, string>>>({});
  private readonly focusedPriceField = signal<string | null>(null);

  // Shared item search combobox popover across editable rows
  protected readonly activeItemRowId = signal<string | null>(null);
  private readonly activeItemBoxEl = signal<HTMLElement | null>(null);
  protected readonly itemEditing = signal(false);
  protected readonly itemQuery = signal('');
  private readonly itemDebouncedQuery = signal('');
  protected readonly itemResults = signal<ItemRow[]>([]);
  protected readonly itemLoading = signal(false);
  protected readonly itemLoadError = signal(false);
  protected readonly itemPlaced = signal(false);
  protected readonly itemPlace = signal<ListPlace>({ top: 0, start: 0, width: 240, maxHeight: null });
  protected readonly itemActiveIndex = signal(0);
  private readonly itemRetryTick = signal(0);
  private itemFetchSeq = 0;
  private itemListSeq = 0;
  private itemDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly companyContext = computed<TradeContext>(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly gridTemplate = computed(() => {
    const cost = this.canViewCost();
    if (this.editable()) {
      return cost ? 'grid-cols-trade-price-line-row-edit-cost' : 'grid-cols-trade-price-line-row-edit';
    }
    return cost ? 'grid-cols-trade-price-line-row-cost' : 'grid-cols-trade-price-line-row';
  });

  protected readonly unitFilterOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    const allLabel = this.transloco.translate('pricing.lines.allUnits');
    const seen = new Set<string>();
    const list: DropdownOption<string>[] = [{ value: '', label: allLabel }];
    for (const u of this.uoms()) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      list.push({
        value: u.id,
        label: itemName(u, language) || u.displayName || u.code,
      });
    }
    return list;
  });

  protected readonly rowErrorsMap = computed<ReadonlyMap<string, LineFieldErrors>>(() => {
    this.i18n();
    const rows = this.entries();
    const offPageUpserts = this.allUpserts();
    const serverOverlaps = this.serverOverlapErrors();
    const touched = this.touchedRows();
    const showAll = this.showAllErrors();
    const startLine = (this.page() - 1) * this.pageSize();

    const translate = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params);

    const map = new Map<string, LineFieldErrors>();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const serverLine = serverOverlaps.get(row.id);
      const shouldShow = showAll || touched.has(row.id) || serverLine !== undefined;
      if (!shouldShow) continue;

      const errs = validateLineRow(row, translate);

      if (!errs.minimumQuantity) {
        if (serverLine !== undefined) {
          errs.minimumQuantity = translate('pricing.lines.errors.overlapsLine', { n: serverLine });
        } else if (row.itemId && row.uomId) {
          const minA = toScaled(row.minimumQuantity);
          const maxA = row.maximumQuantity?.trim() ? toScaled(row.maximumQuantity) : null;
          if (minA !== null) {
            let overlapLine: number | null = null;
            for (let j = 0; j < rows.length; j += 1) {
              if (i === j) continue;
              const other = rows[j];
              if (
                other.itemId !== row.itemId ||
                other.uomId !== row.uomId ||
                other.priority !== row.priority
              ) {
                continue;
              }
              const minB = toScaled(other.minimumQuantity);
              const maxB = other.maximumQuantity?.trim() ? toScaled(other.maximumQuantity) : null;
              if (minB !== null && intervalsOverlap(minA, maxA, minB, maxB)) {
                overlapLine = startLine + j + 1;
                break;
              }
            }
            if (overlapLine === null) {
              const pageIds = new Set(rows.map((r) => r.id));
              const offIdx = offPageUpserts.findIndex((other) => {
                if (other.id === row.id || pageIds.has(other.id)) return false;
                if (
                  other.itemId !== row.itemId ||
                  other.uomId !== row.uomId ||
                  other.priority !== row.priority
                ) {
                  return false;
                }
                const minB = toScaled(other.minimumQuantity);
                const maxB = other.maximumQuantity?.trim() ? toScaled(other.maximumQuantity) : null;
                return minB !== null && intervalsOverlap(minA, maxA, minB, maxB);
              });
              if (offIdx >= 0) {
                overlapLine = this.total() > 0 ? this.total() : offIdx + 1;
              }
            }
            if (overlapLine !== null) {
              errs.minimumQuantity = translate('pricing.lines.errors.overlapsLine', {
                n: overlapLine,
              });
            }
          }
        }
      }

      map.set(row.id, errs);
    }
    return map;
  });

  protected readonly safeItemActiveIndex = computed(() => {
    const count = this.itemResults().length;
    if (count === 0) return -1;
    const idx = this.itemActiveIndex();
    return idx >= 0 && idx < count ? idx : 0;
  });

  protected readonly activeItemRow = computed<PriceLineRow | null>(() => {
    const rowId = this.activeItemRowId();
    if (!rowId) return null;
    return this.entries().find((r) => r.id === rowId) ?? null;
  });

  protected readonly activeItemDescendant = computed(() => {
    if (!this.activeItemRowId() || this.itemLoading() || this.itemLoadError()) return null;
    const idx = this.safeItemActiveIndex();
    return idx >= 0 ? this.itemOptionId(idx) : null;
  });

  constructor() {
    effect(() => {
      const incoming = this.search();
      untracked(() => {
        if (this.searchTimer === null && this.searchDraft() !== incoming) {
          this.searchDraft.set(incoming);
        }
      });
    });

    effect(() => {
      const rowId = this.focusRowId();
      const rows = this.entries();
      if (!rowId) return;
      if (!rows.some((r) => r.id === rowId)) return;
      afterNextRender(
        () => {
          const input = this.host.nativeElement.querySelector<HTMLInputElement>(`#line-item-${rowId}`);
          if (input) {
            input.scrollIntoView({ block: 'nearest' });
            input.focus();
            this.focusHandled.emit();
          }
        },
        { injector: this.injector },
      );
    });

    effect(() => {
      const activeRowId = this.activeItemRowId();
      const search = this.itemDebouncedQuery();
      const ctx = this.companyContext();
      const _retry = this.itemRetryTick();
      if (!activeRowId) return;
      untracked(() => void this.loadItems(ctx, search));
    });

    effect(() => {
      const activeRowId = this.activeItemRowId();
      this.itemLoading();
      this.itemLoadError();
      this.itemResults();
      if (activeRowId) {
        untracked(() => this.scheduleItemPlace());
      }
    });

    const onScroll = (event: Event) => {
      if (!this.activeItemRowId()) return;
      const target = event.target;
      const list = this.itemListRef()?.nativeElement;
      const box = this.activeItemBoxEl();
      if (target instanceof Node && (list?.contains(target) || box?.contains(target))) return;
      this.closeItemMenu(true);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
      this.clearItemDebounce();
      document.removeEventListener('scroll', onScroll, { capture: true });
    });
  }

  protected lineNumber(index: number): number {
    return (this.page() - 1) * this.pageSize() + index + 1;
  }

  protected rowErrors(rowId: string): LineFieldErrors {
    return this.rowErrorsMap().get(rowId) ?? {};
  }

  protected uomOptionsForRow(row: PriceLineRow): DropdownOption<string>[] {
    this.i18n();
    const language = this.lang();
    const options: DropdownOption<string>[] = [];
    if (!row.uomId) {
      options.push({
        value: '',
        label: this.transloco.translate('pricing.lines.selectUnit'),
        disabled: true,
      });
    }
    for (const u of this.uoms()) {
      if (u.status === 'RETIRED' && u.id !== row.uomId) continue;
      options.push({
        value: u.id,
        label: itemName(u, language) || u.displayName || u.code,
      });
    }
    if (row.uomId && !options.some((opt) => opt.value === row.uomId)) {
      options.push({
        value: row.uomId,
        label: row.uomLocalizedNames?.[language] || row.uomLocalizedNames?.['en'] || row.uomCode || row.uomId,
      });
    }
    return options;
  }

  protected itemDisplayName(row: PriceLineRow): string {
    const language = this.lang();
    const names = row.itemLocalizedNames;
    return names?.[language] || names?.['en'] || names?.['ar'] || '';
  }

  protected uomDisplayName(row: PriceLineRow): string {
    const language = this.lang();
    const names = row.uomLocalizedNames;
    return names?.[language] || names?.['en'] || names?.['ar'] || row.uomCode || '—';
  }

  protected formattedUnitPrice(row: PriceLineRow): string {
    return formatUnitPrice(this.currencyCode(), row.unitPrice);
  }

  protected formattedFloorPrice(row: PriceLineRow): string {
    return row.minimumAllowedPrice ? formatUnitPrice(this.currencyCode(), row.minimumAllowedPrice) : '—';
  }

  protected formattedCost(row: PriceLineRow): string {
    return formatMoney(this.currencyCode(), row.standardCost);
  }

  protected formattedQty(val: string | null): string {
    return formatQty(val);
  }

  protected priorityDisplay(row: PriceLineRow): string {
    const raw = this.priorityRawById()[row.id];
    return raw !== undefined ? raw : String(row.priority);
  }

  protected showFloorCurrency(row: PriceLineRow): boolean {
    const isFocused = this.focusedPriceField() === `${row.id}:floor`;
    return isFocused || Boolean(row.minimumAllowedPrice?.trim());
  }

  protected rowMenuItems(index: number, count: number): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'moveUp',
        title: this.transloco.translate('pricing.lines.moveUp'),
        icon: 'tablerArrowUp',
        tile: 'bg-icon-gray',
        disabled: index === 0,
      },
      {
        id: 'moveDown',
        title: this.transloco.translate('pricing.lines.moveDown'),
        icon: 'tablerArrowDown',
        tile: 'bg-icon-gray',
        disabled: index >= count - 1,
      },
      {
        id: 'remove',
        title: this.transloco.translate('pricing.lines.removeLine'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  }

  protected onRowAction(row: PriceLineRow, index: number, selection: ActionSelection): void {
    if (selection.id === 'moveUp' && index > 0) {
      this.reorder.emit({ fromIndex: index, toIndex: index - 1 });
    } else if (selection.id === 'moveDown' && index < this.entries().length - 1) {
      this.reorder.emit({ fromIndex: index, toIndex: index + 1 });
    } else if (selection.id === 'remove') {
      this.removeRow(row.id);
    }
  }

  protected onDrop(event: CdkDragDrop<readonly PriceLineRow[]>): void {
    if (!this.editable()) return;
    if (event.previousIndex !== event.currentIndex) {
      this.reorder.emit({ fromIndex: event.previousIndex, toIndex: event.currentIndex });
    }
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchDraft.set(value);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.searchChange.emit(value);
    }, DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.searchChange.emit('');
  }

  protected onUomFilterChange(value: string): void {
    this.uomFilterChange.emit(value);
  }

  protected onUomChange(row: PriceLineRow, nextUomId: string): void {
    if (!nextUomId || nextUomId === row.uomId) return;
    const found = this.uoms().find((u) => u.id === nextUomId);
    this.markTouched(row.id);
    this.entryChange.emit({
      ...row,
      uomId: nextUomId,
      uomCode: found?.code ?? row.uomCode,
      uomLocalizedNames: found ? { ...found.localizedNames } : row.uomLocalizedNames,
    });
  }

  protected onMinQtyInput(row: PriceLineRow, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.markTouched(row.id);
    this.entryChange.emit({ ...row, minimumQuantity: val });
  }

  protected onMaxQtyInput(row: PriceLineRow, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.markTouched(row.id);
    this.entryChange.emit({ ...row, maximumQuantity: val.trim() ? val : null });
  }

  protected onUnitPriceInput(row: PriceLineRow, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.markTouched(row.id);
    this.entryChange.emit({ ...row, unitPrice: val });
  }

  protected onFloorPriceInput(row: PriceLineRow, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.markTouched(row.id);
    this.entryChange.emit({ ...row, minimumAllowedPrice: val.trim() ? val : null });
  }

  protected onPriorityInput(row: PriceLineRow, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.priorityRawById.update((map) => ({ ...map, [row.id]: raw }));
    this.markTouched(row.id);
    const trimmed = raw.trim();
    const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : -1;
    this.entryChange.emit({ ...row, priority: parsed });
  }

  protected onPriorityBlur(row: PriceLineRow): void {
    this.markTouched(row.id);
    const raw = this.priorityRawById()[row.id];
    if (raw !== undefined && /^\d+$/.test(raw.trim())) {
      const n = Number(raw.trim());
      if (n >= 0 && n <= 10_000) {
        this.priorityRawById.update((map) => {
          const next = { ...map };
          delete next[row.id];
          return next;
        });
      }
    }
  }

  protected setFocusedPriceField(key: string | null): void {
    this.focusedPriceField.set(key);
  }

  protected removeRow(rowId: string): void {
    if (this.activeItemRowId() === rowId) {
      this.closeItemMenu(true);
    }
    this.entryRemove.emit(rowId);
  }

  // Item search combobox methods
  protected itemOptionId(index: number): string {
    return `${this.uid}-item-opt-${index}`;
  }

  protected itemRowName(item: ItemRow): string {
    return itemName(item, this.lang());
  }

  protected tileFor(kind: ItemKind): TileSpec {
    return ITEM_KIND_TILE[kind];
  }

  protected itemInputText(row: PriceLineRow): string {
    if (this.activeItemRowId() === row.id && this.itemEditing()) {
      return this.itemQuery();
    }
    return this.itemDisplayName(row);
  }

  protected itemRowClasses(item: ItemRow, index: number, currentItemId: string): string {
    const selected = currentItemId === item.id;
    const active = this.safeItemActiveIndex() === index;
    if (selected) {
      return active
        ? 'cursor-pointer bg-brand-soft text-on-brand-soft ring-2 ring-focus-halo'
        : 'cursor-pointer bg-brand-soft text-on-brand-soft';
    }
    return active ? 'cursor-pointer bg-row-hover text-text' : 'cursor-pointer text-text hover:bg-row-hover';
  }

  protected onItemBoxClick(row: PriceLineRow, boxEl: HTMLElement): void {
    if (!this.editable()) return;
    const input = boxEl.querySelector<HTMLInputElement>('input');
    input?.focus();
    this.openItemMenu(row, boxEl);
  }

  protected onItemFocus(row: PriceLineRow, boxEl: HTMLElement): void {
    if (!this.editable()) return;
    this.activeItemBoxEl.set(boxEl);
  }

  protected onItemInput(row: PriceLineRow, boxEl: HTMLElement, event: Event): void {
    if (!this.editable()) return;
    const text = (event.target as HTMLInputElement).value;
    this.itemEditing.set(true);
    this.itemQuery.set(text);
    this.itemActiveIndex.set(0);
    if (this.activeItemRowId() !== row.id) {
      this.openItemMenu(row, boxEl);
    }
    this.clearItemDebounce();
    this.itemDebounceTimer = setTimeout(() => {
      this.itemDebounceTimer = null;
      this.itemDebouncedQuery.set(text);
    }, DEBOUNCE_MS);
  }

  protected onItemKeydown(row: PriceLineRow, boxEl: HTMLElement, event: KeyboardEvent): void {
    if (!this.editable()) return;
    const isOpen = this.activeItemRowId() === row.id;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!isOpen) {
          this.itemActiveIndex.set(0);
          this.openItemMenu(row, boxEl);
          return;
        }
        const count = this.itemResults().length;
        if (count > 0) {
          const next = (this.safeItemActiveIndex() + 1) % count;
          this.itemActiveIndex.set(next);
          document.getElementById(this.itemOptionId(next))?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) {
          this.itemActiveIndex.set(0);
          this.openItemMenu(row, boxEl);
          return;
        }
        const count = this.itemResults().length;
        if (count > 0) {
          const prev = (this.safeItemActiveIndex() - 1 + count) % count;
          this.itemActiveIndex.set(prev);
          document.getElementById(this.itemOptionId(prev))?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'Enter': {
        if (!isOpen) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.itemLoadError()) {
          this.retryItems();
          return;
        }
        const items = this.itemResults();
        const idx = this.safeItemActiveIndex();
        if (idx >= 0 && idx < items.length) {
          this.chooseItem(items[idx]);
        }
        break;
      }
      case 'Escape': {
        if (!isOpen) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeItemMenu(true);
        break;
      }
      case 'Tab': {
        if (isOpen) {
          this.closeItemMenu(true);
        }
        break;
      }
    }
  }

  protected chooseItem(item: ItemRow): void {
    const rowId = this.activeItemRowId();
    if (!rowId) return;
    const row = this.entries().find((r) => r.id === rowId);
    if (!row) {
      this.closeItemMenu(true);
      return;
    }

    const nextUomId = row.uomId || item.eligibility?.defaultSalesUomId || item.baseUomId;
    const uom = this.uoms().find((u) => u.id === nextUomId);
    this.markTouched(row.id);
    this.entryChange.emit({
      ...row,
      itemId: item.id,
      itemCode: item.canonicalCode,
      itemLocalizedNames: { ...item.localizedNames },
      uomId: nextUomId,
      uomCode: uom?.code ?? row.uomCode,
      uomLocalizedNames: uom ? { ...uom.localizedNames } : row.uomLocalizedNames,
      catalogSalesPrice: item.eligibility?.salesPrice ?? row.catalogSalesPrice,
    });
    this.closeItemMenu(true);
    this.host.nativeElement.querySelector<HTMLInputElement>(`#line-item-${row.id}`)?.focus();
  }

  protected retryItems(): void {
    this.itemRetryTick.update((n) => n + 1);
  }

  protected closeItemIfOutside(event: Event): void {
    if (!this.activeItemRowId()) return;
    const target = event.target as Node | null;
    const list = this.itemListRef()?.nativeElement;
    const box = this.activeItemBoxEl();
    if (target && (list?.contains(target) || box?.contains(target))) return;
    this.closeItemMenu(true);
  }

  protected closeItemMenu(restore: boolean): void {
    this.clearItemDebounce();
    this.itemListSeq++;
    const rowId = this.activeItemRowId();
    this.activeItemRowId.set(null);
    this.activeItemBoxEl.set(null);
    this.itemPlaced.set(false);
    if (restore) {
      this.itemEditing.set(false);
      this.itemQuery.set('');
      this.itemDebouncedQuery.set('');
      if (rowId) {
        const row = this.entries().find((r) => r.id === rowId);
        const input = this.host.nativeElement.querySelector<HTMLInputElement>(`#line-item-${rowId}`);
        if (row && input) {
          input.value = this.itemDisplayName(row);
        }
      }
    }
  }

  protected markTouched(rowId: string): void {
    this.touchedRows.update((set) => {
      if (set.has(rowId)) return set;
      const next = new Set(set);
      next.add(rowId);
      return next;
    });
  }

  private openItemMenu(row: PriceLineRow, boxEl: HTMLElement): void {
    this.activeItemBoxEl.set(boxEl);
    this.itemPlaced.set(false);
    this.itemPlace.set(this.initialItemPlace(boxEl));
    this.activeItemRowId.set(row.id);
    this.scheduleItemPlace();
  }

  private async loadItems(ctx: TradeContext, search: string): Promise<void> {
    const seq = ++this.itemFetchSeq;
    this.itemLoading.set(true);
    this.itemLoadError.set(false);
    try {
      const page = await searchItems(ctx, {
        search: search.trim() || undefined,
        limit: 20,
      });
      if (seq !== this.itemFetchSeq) return;
      this.itemResults.set(page.items);
      this.itemActiveIndex.set(0);
    } catch {
      if (seq !== this.itemFetchSeq) return;
      this.itemResults.set([]);
      this.itemLoadError.set(true);
    } finally {
      if (seq === this.itemFetchSeq) {
        this.itemLoading.set(false);
      }
    }
  }

  private clearItemDebounce(): void {
    if (this.itemDebounceTimer !== null) {
      clearTimeout(this.itemDebounceTimer);
      this.itemDebounceTimer = null;
    }
  }

  private scheduleItemPlace(): void {
    const seq = ++this.itemListSeq;
    queueMicrotask(() => this.placeItemList(seq));
    afterNextRender(() => this.placeItemList(seq), { injector: this.injector });
  }

  private initialItemPlace(boxEl: HTMLElement): ListPlace {
    const rect = rectInPage(boxEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeItemList(seq: number): void {
    if (seq !== this.itemListSeq || !this.activeItemRowId()) return;
    const boxEl = this.activeItemBoxEl();
    const listEl = this.itemListRef()?.nativeElement;
    if (!boxEl || !listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(boxEl);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.itemPlace.set({ top, start, width: rect.width, maxHeight });
    this.itemPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
