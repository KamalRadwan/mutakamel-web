import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBan,
  tablerBox,
  tablerCopy,
  tablerEye,
  tablerMinus,
  tablerPackages,
  tablerPencil,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerTool,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { tradeContext } from '../../../shared/trade-api';
import { formatDate, formatMoney } from '../../../shared/trade-format';
import { itemName, uomById } from '../../../shared/trade-foundation.api';
import type { ItemRow, Uom } from '../../../shared/trade-foundation.model';
import { itemThumbUrl, releaseThumbUrl } from '../../../shared/trade-image';
import {
  BADGE_CLASS,
  ITEM_KIND_KEY,
  ITEM_KIND_TILE,
  ITEM_STATUS_KEY,
  ITEM_STATUS_TONE,
  type TileSpec,
} from '../../../shared/trade-labels';
import { ItemSelection } from '../item-bulk/item-selection';
import { itemActions, type ItemActionId } from '../item-card/item-card';

@Component({
  selector: 'app-item-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox],
  providers: [
    provideIcons({
      tablerBox,
      tablerTool,
      tablerPackages,
      tablerEye,
      tablerPencil,
      tablerPlayerPlay,
      tablerPlayerPause,
      tablerCopy,
      tablerBan,
      tablerMinus,
    }),
  ],
  templateUrl: './item-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class ItemTable {
  private readonly scopeState = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  protected readonly selection = inject(ItemSelection, { optional: true });
  protected readonly language = inject(LanguageState).current;

  readonly items = input.required<readonly ItemRow[]>();
  readonly loading = input(false);
  readonly companyView = input(false);
  readonly canManage = input(true);
  readonly showThumbs = input(true);
  readonly uoms = input<ReadonlyMap<string, Uom>>(new Map());

  readonly open = output<ItemRow>();
  readonly action = output<{ item: ItemRow; action: ItemActionId }>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly kindKey = ITEM_KIND_KEY;
  protected readonly statusKey = ITEM_STATUS_KEY;

  private readonly thumbMapSignal = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly thumbMap = this.thumbMapSignal.asReadonly();
  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  protected readonly showSelection = computed(() => this.canManage() && this.selection !== null);
  protected readonly currentPageIds = computed<string[]>(() => this.items().map((item) => item.id));
  protected readonly pageState = computed<'none' | 'some' | 'all'>(() =>
    this.showSelection() && this.currentPageIds().length > 0
      ? this.selection!.pageState(this.currentPageIds())
      : 'none',
  );

  protected readonly gridCols = computed(() => {
    const select = this.showSelection();
    if (this.companyView()) {
      return select ? 'grid-cols-trade-item-company-row-select' : 'grid-cols-trade-item-company-row';
    }
    return select ? 'grid-cols-trade-item-row-select' : 'grid-cols-trade-item-row';
  });

  constructor() {
    let seq = 0;
    let activeUrls = new Map<string, string>();

    const updateMap = (next: Map<string, string>) => {
      for (const [id, url] of activeUrls.entries()) {
        if (next.get(id) !== url) {
          releaseThumbUrl(url);
        }
      }
      activeUrls = next;
      this.thumbMapSignal.set(next);
    };

    effect(() => {
      const list = this.items();
      const enabled = this.showThumbs();
      const ctx = tradeContext(this.scopeState, 'BRANCH');
      const loadId = ++seq;

      if (!enabled) {
        updateMap(new Map());
        return;
      }

      const targets = list.filter((row) => row.image !== null);
      if (targets.length === 0) {
        updateMap(new Map());
        return;
      }

      void Promise.all(
        targets.map(async (row) => [
          row.id,
          await itemThumbUrl(row.id, row.image, ctx).catch(() => null),
        ] as const),
      ).then((entries) => {
        if (loadId !== seq) {
          for (const [, url] of entries) {
            releaseThumbUrl(url);
          }
          return;
        }
        const next = new Map<string, string>();
        for (const [id, url] of entries) {
          if (url) next.set(id, url);
        }
        updateMap(next);
      });
    });

    effect(() => {
      const state = this.pageState();
      const inputEl = this.headerCheckboxEl()?.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.indeterminate = state === 'some';
      }
    });

    inject(DestroyRef).onDestroy(() => {
      seq += 1;
      for (const url of activeUrls.values()) {
        releaseThumbUrl(url);
      }
      activeUrls.clear();
    });
  }

  protected nameOf(item: ItemRow): string {
    return itemName(item, this.language());
  }

  protected tileFor(item: ItemRow): TileSpec {
    return ITEM_KIND_TILE[item.itemKind];
  }

  protected statusBadgeClass(item: ItemRow): string {
    return BADGE_CLASS[ITEM_STATUS_TONE[item.status]];
  }

  protected categoryPath(item: ItemRow): string {
    const summary = item.categorySummary;
    if (!summary || summary.path.length === 0) return '—';
    return summary.path.map((part) => part.name).join(' › ');
  }

  protected baseUnitName(item: ItemRow): string {
    const lang = this.language();
    const uom = this.uoms().get(item.baseUomId) ?? uomById(item.baseUomId);
    if (!uom) return item.baseUomId;
    return itemName(uom, lang) || uom.displayName;
  }

  protected priceText(item: ItemRow): string {
    const elig = item.eligibility;
    if (!elig) return '—';
    return formatMoney(elig.currencyCode, elig.salesPrice);
  }

  protected updatedText(item: ItemRow): string {
    return formatDate(item.updatedAt, this.language());
  }

  protected menuLabel(item: ItemRow): string {
    this.i18n();
    return this.transloco.translate('tradeItems.actions.label', { name: this.nameOf(item) });
  }

  protected actionsFor(item: ItemRow): ActionItem[] {
    this.i18n();
    return itemActions(item, this.canManage(), (key) => this.transloco.translate(key));
  }

  protected onActionSelected(item: ItemRow, selection: ActionSelection): void {
    this.action.emit({ item, action: selection.id as ItemActionId });
  }

  protected isSelected(id: string): boolean {
    return this.showSelection() ? this.selection!.pageState([id]) === 'all' : false;
  }

  protected togglePage(cb?: Checkbox): void {
    if (!this.showSelection() || this.items().length === 0) {
      cb?.checked.set(false);
      return;
    }
    const next = this.pageState() !== 'all';
    this.selection!.setRows([...this.items()], next);
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(item: ItemRow, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(item, shift);
    cb?.checked.set(this.isSelected(item.id));
  }

  protected onSelectCellClick(event: MouseEvent, item: ItemRow, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.showSelection()) return;
    if (event.target instanceof Element && event.target.closest('ui-checkbox')) return;
    this.applyRowSelection(item, event.shiftKey);
    cb?.checked.set(this.isSelected(item.id));
  }

  protected onRowKeydown(event: KeyboardEvent, item: ItemRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      if (this.showSelection()) {
        this.applyRowSelection(item, event.shiftKey);
      } else {
        this.open.emit(item);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.open.emit(item);
    }
  }

  private applyRowSelection(item: ItemRow, shiftKey: boolean): void {
    if (!this.showSelection()) return;
    const rows = this.items();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((row) => row.id === this.lastClickedId);
      const endIndex = rows.findIndex((row) => row.id === item.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        this.selection!.setRows(rows.slice(from, to + 1), true);
        this.lastClickedId = item.id;
        return;
      }
    }
    this.selection!.toggle(item);
    this.lastClickedId = item.id;
  }
}
