import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  Component,
  DestroyRef,
  Injector,
  type Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerCircleX,
  tablerDots,
  tablerGripVertical,
  tablerLoader2,
  tablerLock,
  tablerPlus,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Menu, type MenuItem } from '../../../../shared/ui/menu/menu';
import { TradeUomPicker } from '../../shared/pickers/uom-picker/uom-picker';
import { errorCodeOf, tradeContext } from '../../shared/trade-api';
import { formatDate, formatMoney, formatQty, formatUnitPrice } from '../../shared/trade-format';
import { getItemSummary, itemName, listUoms } from '../../shared/trade-foundation.api';
import type { ItemSummary, TaxDefault, Uom } from '../../shared/trade-foundation.model';
import { isDecimal } from '../shared/decimal';
import { KIND_CONFIG, type LineColumn } from '../shared/document-kinds';
import type {
  Dec,
  DiscountType,
  DocumentKind,
  EditableLine,
  PricingIntent,
  TaxCategory,
} from '../shared/document.model';
import {
  type OrderPricingPreviewBody,
  type OrderPricingPreviewLineInput,
  type QuotationPricingPreviewBody,
  type QuotationPricingPreviewLineInput,
  previewOrderPricing,
  previewQuotationPricing,
} from '../shared/documents.api';
import { ItemCell, type ItemCellPick } from './item-cell/item-cell';
import {
  type ComputedEditableLine,
  type LineFieldKey,
  MAX_DESCRIPTION_LENGTH,
  MAX_DOCUMENT_LINES,
  allowedUomIdsForSummary,
  createEmptyEditableLine,
  rateBpsFromPercentInput,
  ratePercentFromBps,
  recomputeLine,
  safeDec,
  safeIsZero,
  taxInputFromDefault,
  validateLineFields,
} from './line-math';
import { translationEvents } from '../../../../core/i18n/translation-events';

const PREVIEW_DEBOUNCE_MS = 400;
const NUMERIC_ALIGN_COLUMNS = new Set<LineColumn>(['quantity', 'price', 'discount', 'charge', 'taxRate', 'taxAmount', 'total']);

type PreviewPayload =
  | { kind: 'quotation'; body: QuotationPricingPreviewBody }
  | { kind: 'sales-order' | 'purchase-order'; body: OrderPricingPreviewBody }
  | null;

@Component({
  selector: 'app-document-lines',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    NgIcon,
    TranslocoPipe,
    Button,
    DateField,
    Dropdown,
    Menu,
    TradeUomPicker,
    ItemCell,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-lines', alias: 'tdlines' },
    ),
    provideIcons({
      tablerArrowDown,
      tablerArrowUp,
      tablerCircleX,
      tablerDots,
      tablerGripVertical,
      tablerLoader2,
      tablerLock,
      tablerPlus,
      tablerTrash,
      tablerX,
    }),
  ],
  templateUrl: './document-lines.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class DocumentLines {
  private static nextId = 0;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState);

  private readonly itemCells = viewChildren(ItemCell);

  protected readonly uid = `doc-lines-${++DocumentLines.nextId}`;
  protected readonly maxLines = MAX_DOCUMENT_LINES;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
  protected readonly formatMoney = formatMoney;
  protected readonly formatUnitPrice = formatUnitPrice;
  protected readonly formatQty = formatQty;
  protected readonly formatDate = formatDate;

  readonly kind = input.required<DocumentKind>();
  readonly lines = model.required<EditableLine[]>();
  readonly currencyCode = input.required<string>();
  readonly editable = input(true);
  readonly structureLocked = input(false);
  readonly discountMode = input<'none' | 'line'>('none');
  readonly partyId = input<string | null>(null);
  readonly lineErrors = input<Record<string, string>>({});
  readonly pricingIntent = input<PricingIntent>({ mode: 'NONE' });
  readonly sourceQuotationId = input<string | null>(null);
  readonly sourcePurchaseQuotationId = input<string | null>(null);

  readonly addItem = output<void>();

  private readonly _lastFingerprint = signal<string | null>(null);
  readonly lastFingerprint: Signal<string | null> = this._lastFingerprint.asReadonly();

  protected readonly pricingLoading = signal(false);
  private readonly uomsById = signal<Record<string, Uom>>({});
  private readonly itemSummaries = signal<Record<string, ItemSummary>>({});
  private readonly previewLineTotals = signal<Record<string, Dec>>({});
  private readonly taxRateDrafts = signal<Record<string, string>>({});
  private readonly touchedCells = signal<Record<string, true>>({});

  private readonly inFlightItems = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;
  private lastSentSignature = '';
  private prevPricingMode: PricingIntent['mode'] | null = null;
  private prevPricingScope: PricingIntent['scope'] | undefined = undefined;

  protected readonly tradeCtx = computed(() => tradeContext(this.scope, 'BRANCH'));
  protected readonly isOrder = computed(() => this.kind() === 'sales-order' || this.kind() === 'purchase-order');
  protected readonly isPurchase = computed(
    () => this.kind() === 'purchase-order' || this.kind() === 'purchase-quotation',
  );
  protected readonly itemPurpose = computed<'SALES' | 'PURCHASE'>(() =>
    this.isPurchase() ? 'PURCHASE' : 'SALES',
  );
  protected readonly canModifyRows = computed(() => this.editable() && !this.structureLocked());
  protected readonly atLineLimit = computed(() => this.lines().length >= MAX_DOCUMENT_LINES);

  protected readonly visibleColumns = computed<LineColumn[]>(() => {
    const kind = this.kind();
    const base = KIND_CONFIG[kind].lineColumns;
    if (kind === 'quotation') {
      return this.discountMode() === 'line' ? base : base.filter((col) => col !== 'discount');
    }
    if (kind === 'sales-order') {
      const showDiscount =
        this.discountMode() === 'line' || this.lines().some((line) => !safeIsZero(line.discountTotal));
      return showDiscount ? base : base.filter((col) => col !== 'discount');
    }
    return base;
  });

  protected readonly gridColumns = computed<string>(() => {
    const orderLike = this.isOrder();
    const tracks: string[] = [];
    if (this.canModifyRows()) {
      tracks.push('32px');
    }
    tracks.push('36px');

    for (const col of this.visibleColumns()) {
      tracks.push(columnTrack(col, orderLike));
    }

    if (this.canModifyRows()) {
      tracks.push('72px');
    }
    return tracks.join(' ');
  });

  protected readonly computedRows = computed<ComputedEditableLine[]>(() => {
    const kind = this.kind();
    const currency = this.currencyCode();
    return this.lines().map((line) => recomputeLine(kind, line, currency));
  });

  protected readonly taxCategoryOptions = computed<DropdownOption<TaxCategory | null>[]>(() => {
    this.i18n();
    return [
      { value: 'STANDARD', label: this.transloco.translate('tdlines.tax.STANDARD') },
      { value: 'ZERO', label: this.transloco.translate('tdlines.tax.ZERO') },
      { value: 'EXEMPT', label: this.transloco.translate('tdlines.tax.EXEMPT') },
    ];
  });

  private readonly previewPayload = computed<PreviewPayload>(() =>
    this.buildPreviewPayload(this.lines()),
  );

  private readonly previewSignature = computed(() => {
    const payload = this.previewPayload();
    return payload ? JSON.stringify(payload) : '';
  });

  constructor() {
    void this.loadUoms();

    effect(() => {
      const ctx = this.tradeCtx();
      const lines = this.lines();
      const cached = untracked(() => this.itemSummaries());
      const companyKey = ctx.companyId ?? '';

      for (const line of lines) {
        const itemId = line.itemId;
        if (!itemId) continue;
        const cacheKey = `${companyKey}:${itemId}`;
        if (cached[cacheKey] || this.inFlightItems.has(cacheKey)) continue;
        this.inFlightItems.add(cacheKey);
        void getItemSummary(ctx, itemId)
          .then((summary) => {
            this.itemSummaries.update((curr) => ({ ...curr, [cacheKey]: summary }));
          })
          .catch(() => {
            // Hydrating existing lines best-effort; explicit pick errors surface in ItemCell.
          })
          .finally(() => {
            this.inFlightItems.delete(cacheKey);
          });
      }
    });

    effect(() => {
      const intent = this.pricingIntent();
      const kind = this.kind();
      const editable = this.editable();
      const prevMode = this.prevPricingMode;
      const prevScope = this.prevPricingScope;
      this.prevPricingMode = intent.mode;
      this.prevPricingScope = intent.scope;

      if (!editable || kind !== 'quotation' || prevMode === null) return;
      const leftDiscount = prevMode === 'DISCOUNT' && intent.mode !== 'DISCOUNT';
      const leftLineScope =
        prevMode === 'DISCOUNT' &&
        prevScope === 'LINE' &&
        intent.mode === 'DISCOUNT' &&
        intent.scope !== 'LINE';

      if (leftDiscount || leftLineScope) {
        untracked(() => {
          const current = this.lines();
          if (current.some((l) => l.discount !== null || !safeIsZero(l.discountTotal))) {
            this.previewLineTotals.set({});
            this.lines.set(
              current.map((line) => ({
                ...line,
                discount: null,
                discountTotal: '0',
              })),
            );
          }
        });
      }
    });

    effect(() => {
      const editable = this.editable();
      const kind = this.kind();
      const payload = this.previewPayload();
      const sig = this.previewSignature();

      if (!editable || kind === 'purchase-quotation') {
        this.clearDebounce();
        return;
      }

      if (!payload || payload.body.lines.length === 0) {
        this.clearDebounce();
        this.lastSentSignature = '';
        untracked(() => {
          this._lastFingerprint.set(null);
          this.pricingLoading.set(false);
        });
        return;
      }

      if (sig === this.lastSentSignature) return;

      this.clearDebounce();
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        void this.runPricingPreview(sig, payload);
      }, PREVIEW_DEBOUNCE_MS);
    });

    this.destroyRef.onDestroy(() => {
      this.clearDebounce();
      this.previewSeq++;
    });
  }

  refreshPricing(): void {
    this.clearDebounce();
    if (!this.editable() || this.kind() === 'purchase-quotation') {
      return;
    }
    const payload = this.buildPreviewPayload(this.lines());
    if (!payload || payload.body.lines.length === 0) {
      this._lastFingerprint.set(null);
      this.lastSentSignature = '';
      return;
    }
    const sig = JSON.stringify(payload);
    this.lastSentSignature = '';
    void this.runPricingPreview(sig, payload);
  }

  protected isNumericColumn(col: LineColumn): boolean {
    return NUMERIC_ALIGN_COLUMNS.has(col);
  }

  protected cellId(line: EditableLine, field: string): string {
    return `${this.uid}-${line.clientLineId}-${field}`;
  }

  protected errorId(line: EditableLine, field: string): string {
    return `${this.cellId(line, field)}-error`;
  }

  protected isLineComplete(line: EditableLine): boolean {
    return Boolean(line.itemId && line.uomId && isDecimal(line.quantity, { positive: true, maxDecimals: 8 }));
  }

  protected taxDefaultFor(line: EditableLine): TaxDefault | null | undefined {
    if (!line.itemId || !this.isOrder()) return undefined;
    const companyKey = this.tradeCtx().companyId ?? '';
    const summary = this.itemSummaries()[`${companyKey}:${line.itemId}`];
    if (!summary) return undefined;
    return this.isPurchase() ? summary.purchaseTaxDefault : summary.salesTaxDefault;
  }

  protected uomLabel(uomId: string | null): string {
    if (!uomId) return '—';
    const uom = this.uomsById()[uomId];
    if (!uom) return uomId;
    const localized = itemName(uom, this.lang.current()) || uom.displayName;
    return `${uom.code} — ${localized}`;
  }

  protected discountValueInput(line: EditableLine): string {
    return line.discount?.value ?? '';
  }

  protected discountType(line: EditableLine): DiscountType {
    return line.discount?.type ?? 'PERCENT';
  }

  protected taxRateInputValue(line: EditableLine): string {
    const draft = this.taxRateDrafts()[line.clientLineId];
    if (draft !== undefined) return draft;
    if (!line.tax || line.tax.category !== 'STANDARD') return '0';
    return ratePercentFromBps(line.tax.rateBps);
  }

  protected taxRateDisplay(line: EditableLine): Dec {
    if (!line.tax || line.tax.category !== 'STANDARD') return '0';
    return ratePercentFromBps(line.tax.rateBps);
  }

  protected displayLineTotal(line: EditableLine, computedRow: ComputedEditableLine): Dec | null {
    if (this.kind() === 'quotation') {
      const fromPreview = this.previewLineTotals()[line.clientLineId];
      if (fromPreview !== undefined) return fromPreview;
    }
    return line.unitPrice === null ? null : computedRow.lineTotal;
  }

  protected errorFor(line: EditableLine, field: LineFieldKey): string | null {
    this.i18n();
    const companyKey = this.tradeCtx().companyId ?? '';
    const summary = line.itemId ? this.itemSummaries()[`${companyKey}:${line.itemId}`] : undefined;
    const taxDefault = summary ? (this.isPurchase() ? summary.purchaseTaxDefault : summary.salesTaxDefault) : null;
    const allowedUomIds = summary ? allowedUomIdsForSummary(summary) : null;

    const local = validateLineFields(this.kind(), line, {
      inclusiveTax: taxDefault?.isInclusive === true,
      allowedUomIds,
      discountMode: this.discountMode(),
      currencyCode: this.currencyCode(),
    });

    if (field === 'taxRate' && this.isOrder() && line.tax?.category === 'STANDARD' && !line.taxLocked) {
      const draft = this.taxRateDrafts()[line.clientLineId];
      if (draft !== undefined && rateBpsFromPercentInput(draft) === null) {
        return this.transloco.translate('tdlines.errors.taxRate');
      }
    }

    const fieldErr = local[field];
    if (fieldErr) {
      const requiresTouch =
        fieldErr.key === 'tdlines.errors.itemRequired' ||
        fieldErr.key === 'tdlines.errors.unitRequired' ||
        fieldErr.key === 'tdlines.errors.taxCategoryRequired';
      const touched = this.touchedCells()[this.touchKey(line.clientLineId, field)] === true;
      if (!requiresTouch || touched) {
        return this.transloco.translate(fieldErr.key, fieldErr.params);
      }
    }

    const external = this.lineErrors()[line.clientLineId];
    if (external) {
      const attachToDiscount = this.kind() === 'quotation' && this.discountMode() === 'line';
      if (attachToDiscount && field === 'discount') return external;
      if (!attachToDiscount && field === 'item') return external;
    }

    return null;
  }

  protected addLine(): void {
    if (!this.canModifyRows() || this.atLineLimit()) return;
    const nextLine = createEmptyEditableLine();
    this.lines.set([...this.lines(), nextLine]);
    this.addItem.emit();

    afterNextRender(
      () => {
        const cells = this.itemCells();
        cells[cells.length - 1]?.focus();
      },
      { injector: this.injector },
    );
  }

  protected removeLine(index: number): void {
    if (!this.canModifyRows()) return;
    const current = this.lines();
    const target = current[index];
    if (!target || target.locked) return;

    const next = current.filter((_, i) => i !== index);
    this.clearLineCaches(target.clientLineId);
    this.lines.set(next);
  }

  protected onDrop(event: CdkDragDrop<EditableLine[]>): void {
    if (!this.canModifyRows()) return;
    if (event.previousIndex === event.currentIndex) return;
    const next = [...this.lines()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.lines.set(next);
  }

  protected rowMenuItems(index: number): MenuItem[] {
    this.i18n();
    const total = this.lines().length;
    const line = this.lines()[index];
    const items: MenuItem[] = [];

    if (index > 0) {
      items.push({
        id: 'moveUp',
        label: this.transloco.translate('tdlines.moveUp'),
        icon: 'tablerArrowUp',
      });
    }
    if (index < total - 1) {
      items.push({
        id: 'moveDown',
        label: this.transloco.translate('tdlines.moveDown'),
        icon: 'tablerArrowDown',
      });
    }
    if (!line?.locked) {
      items.push({
        id: 'remove',
        label: this.transloco.translate('tdlines.remove'),
        icon: 'tablerTrash',
        danger: true,
        divider: items.length > 0,
      });
    }
    return items;
  }

  protected onRowMenuAction(index: number, actionId: string): void {
    switch (actionId) {
      case 'moveUp':
        this.moveLine(index, -1);
        break;
      case 'moveDown':
        this.moveLine(index, 1);
        break;
      case 'remove':
        this.removeLine(index);
        break;
    }
  }

  protected onItemPicked(index: number, pick: ItemCellPick): void {
    if (!this.canModifyRows()) return;
    const current = this.lines();
    const line = current[index];
    if (!line || line.locked) return;

    this.markTouched(line.clientLineId, 'item');
    this.clearLineCaches(line.clientLineId);

    if (!pick.itemId || !pick.summary) {
      this.patchLine(index, {
        itemId: pick.itemId,
        itemLabel: '',
        description: '',
        uomId: null,
        unitPrice: null,
        discountTotal: '0',
        maxDiscountAmount: null,
        maxDiscountPercent: null,
        ...(this.isOrder() ? { tax: null, taxLocked: false } : {}),
      });
      return;
    }

    const summary = pick.summary;
    const companyKey = this.tradeCtx().companyId ?? '';
    this.itemSummaries.update((curr) => ({ ...curr, [`${companyKey}:${summary.id}`]: summary }));

    const localizedName = itemName(summary, this.lang.current()) || summary.displayName;
    const defaultUom = this.isPurchase()
      ? summary.defaultPurchaseUomId || summary.baseUomId
      : summary.defaultUomId || summary.baseUomId;

    let orderTaxPatch: Partial<Pick<EditableLine, 'tax' | 'taxLocked'>> = {};
    if (this.isOrder()) {
      const rawDefault = this.isPurchase() ? summary.purchaseTaxDefault : summary.salesTaxDefault;
      const derived = taxInputFromDefault(rawDefault);
      orderTaxPatch = { tax: derived.tax, taxLocked: derived.taxLocked };
    }

    this.patchLine(index, {
      itemId: summary.id,
      itemLabel: `${summary.sku} · ${localizedName}`,
      description: localizedName,
      uomId: defaultUom,
      unitPrice: null,
      discountTotal: '0',
      maxDiscountAmount: null,
      maxDiscountPercent: null,
      ...orderTaxPatch,
    });
  }

  protected onDescriptionInput(index: number, event: Event): void {
    if (!this.editable()) return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    const description = (event.target as HTMLInputElement).value;
    this.markTouched(line.clientLineId, 'description');
    this.patchLine(index, { description });
  }

  protected onQuantityInput(index: number, event: Event): void {
    if (!this.canModifyRows()) return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    const quantity = (event.target as HTMLInputElement).value;
    this.markTouched(line.clientLineId, 'quantity');
    this.clearPreviewLineTotal(line.clientLineId);
    this.patchLine(index, { quantity });
  }

  protected onUnitChange(index: number, uomId: string | null): void {
    if (!this.canModifyRows()) return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    this.markTouched(line.clientLineId, 'unit');
    this.clearPreviewLineTotal(line.clientLineId);
    this.patchLine(index, { uomId, unitPrice: null });
  }

  protected onDiscountTypeChange(index: number, type: DiscountType): void {
    if (!this.editable() || this.kind() !== 'quotation') return;
    const line = this.lines()[index];
    if (!line || line.locked || line.discount?.type === type) return;
    this.markTouched(line.clientLineId, 'discount');
    this.clearPreviewLineTotal(line.clientLineId);
    this.patchLine(index, {
      discount: { type, value: line.discount?.value ?? '0' },
    });
  }

  protected onDiscountTypeKeydown(index: number, event: KeyboardEvent, currentType: DiscountType): void {
    const nextKey = this.lang.current() === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = this.lang.current() === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === nextKey || event.key === prevKey || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.onDiscountTypeChange(index, currentType === 'PERCENT' ? 'AMOUNT' : 'PERCENT');
    }
  }

  protected onDiscountValueInput(index: number, event: Event): void {
    if (!this.editable() || this.kind() !== 'quotation') return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    const raw = (event.target as HTMLInputElement).value;
    const currentType = this.discountType(line);
    this.markTouched(line.clientLineId, 'discount');
    this.clearPreviewLineTotal(line.clientLineId);
    this.patchLine(index, {
      discount:
        raw === ''
          ? currentType === 'AMOUNT'
            ? { type: 'AMOUNT', value: '' }
            : null
          : { type: currentType, value: raw },
    });
  }

  protected onChargeInput(index: number, event: Event): void {
    if (!this.editable() || !this.isOrder()) return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    const chargeTotal = (event.target as HTMLInputElement).value;
    this.markTouched(line.clientLineId, 'charge');
    this.patchLine(index, { chargeTotal });
  }

  protected onTaxCategoryChange(index: number, category: TaxCategory | null): void {
    if (!category || !this.editable() || !this.isOrder()) return;
    const line = this.lines()[index];
    if (!line || line.locked || line.taxLocked) return;
    this.markTouched(line.clientLineId, 'taxCategory');
    this.clearTaxRateDraft(line.clientLineId);
    const rateBps =
      category === 'STANDARD'
        ? line.tax?.category === 'STANDARD'
          ? line.tax.rateBps
          : 0
        : 0;
    this.patchLine(index, {
      tax: { category, rateBps },
    });
  }

  protected onTaxRateInput(index: number, event: Event): void {
    if (!this.editable() || !this.isOrder()) return;
    const line = this.lines()[index];
    if (!line || line.locked || line.taxLocked || line.tax?.category !== 'STANDARD') return;

    const raw = (event.target as HTMLInputElement).value;
    this.markTouched(line.clientLineId, 'taxRate');
    this.taxRateDrafts.update((curr) => ({ ...curr, [line.clientLineId]: raw }));

    const parsedBps = rateBpsFromPercentInput(raw);
    if (parsedBps !== null && parsedBps !== line.tax.rateBps) {
      this.patchLine(index, {
        tax: { category: 'STANDARD', rateBps: parsedBps },
      });
    }
  }

  protected onTaxRateBlur(index: number): void {
    const line = this.lines()[index];
    if (!line) return;
    this.markTouched(line.clientLineId, 'taxRate');
    const draft = this.taxRateDrafts()[line.clientLineId];
    if (draft !== undefined && rateBpsFromPercentInput(draft) !== null) {
      this.clearTaxRateDraft(line.clientLineId);
    }
  }

  protected onExpectedDateChange(index: number, expectedDate: string | null): void {
    if (!this.editable() || this.kind() !== 'purchase-order') return;
    const line = this.lines()[index];
    if (!line || line.locked) return;
    this.patchLine(index, { expectedDate });
  }

  protected markCellTouched(line: EditableLine, field: LineFieldKey): void {
    this.markTouched(line.clientLineId, field);
  }

  private moveLine(index: number, delta: number): void {
    if (!this.canModifyRows()) return;
    const current = this.lines();
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    moveItemInArray(next, index, target);
    this.lines.set(next);
  }

  private patchLine(index: number, patch: Partial<EditableLine>): void {
    const current = this.lines();
    const existing = current[index];
    if (!existing) return;
    const next = current.map((line, i) => (i === index ? { ...line, ...patch } : line));
    this.lines.set(next);
  }

  private touchKey(clientLineId: string, field: LineFieldKey): string {
    return `${clientLineId}:${field}`;
  }

  private markTouched(clientLineId: string, field: LineFieldKey): void {
    const key = this.touchKey(clientLineId, field);
    if (this.touchedCells()[key]) return;
    this.touchedCells.update((curr) => ({ ...curr, [key]: true }));
  }

  private clearPreviewLineTotal(clientLineId: string): void {
    if (this.previewLineTotals()[clientLineId] === undefined) return;
    this.previewLineTotals.update((curr) => {
      const next = { ...curr };
      delete next[clientLineId];
      return next;
    });
  }

  private clearTaxRateDraft(clientLineId: string): void {
    if (this.taxRateDrafts()[clientLineId] === undefined) return;
    this.taxRateDrafts.update((curr) => {
      const next = { ...curr };
      delete next[clientLineId];
      return next;
    });
  }

  private clearLineCaches(clientLineId: string): void {
    this.clearPreviewLineTotal(clientLineId);
    this.clearTaxRateDraft(clientLineId);
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async loadUoms(): Promise<void> {
    try {
      const uoms = await listUoms();
      const map: Record<string, Uom> = {};
      for (const uom of uoms) {
        map[uom.id] = uom;
      }
      this.uomsById.set(map);
    } catch {
      // Optional cache for read-only UOM labels; picker handles its own load/retry.
    }
  }

  private buildPreviewPayload(lines: readonly EditableLine[]): PreviewPayload {
    const kind = this.kind();
    const currencyCode = this.currencyCode();
    if (!currencyCode || kind === 'purchase-quotation') {
      return null;
    }

    if (kind === 'quotation') {
      const previewLines: QuotationPricingPreviewLineInput[] = [];
      const intent = this.pricingIntent();
      for (const line of lines) {
        if (!line.itemId || !line.uomId || !isDecimal(line.quantity, { positive: true, maxDecimals: 8 })) {
          continue;
        }
        const rawDiscount = line.discount;
        const validDiscount =
          intent.mode === 'DISCOUNT' &&
          (intent.scope ?? 'LINE') === 'LINE' &&
          rawDiscount !== null &&
          rawDiscount.value.trim() !== '' &&
          isDecimal(rawDiscount.value, { maxDecimals: 8 })
            ? { type: rawDiscount.type, value: rawDiscount.value }
            : null;

        previewLines.push({
          clientLineId: line.clientLineId,
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: line.quantity,
          discount: validDiscount,
        });
      }

      return {
        kind: 'quotation',
        body: {
          partyId: this.partyId(),
          currencyCode,
          lines: previewLines,
          pricing: intent,
        },
      };
    }

    const previewLines: OrderPricingPreviewLineInput[] = [];
    for (const line of lines) {
      if (!line.itemId || !line.uomId || !isDecimal(line.quantity, { positive: true, maxDecimals: 8 })) {
        continue;
      }
      const charge =
        line.chargeTotal.trim() !== '' && isDecimal(line.chargeTotal, { maxDecimals: 8 })
          ? line.chargeTotal
          : '0';

      previewLines.push({
        clientLineId: line.clientLineId,
        itemId: line.itemId,
        uomId: line.uomId,
        quantity: line.quantity,
        ...((this.structureLocked() || line.locked) && line.unitPrice !== null
          ? { unitPrice: line.unitPrice }
          : {}),
        ...(kind === 'sales-order' ? { discountTotal: safeDec(line.discountTotal) } : {}),
        chargeTotal: charge,
        tax: line.tax,
      });
    }

    return {
      kind,
      body: {
        partyId: this.partyId(),
        currencyCode,
        lines: previewLines,
        ...(this.sourceQuotationId() ? { sourceQuotationId: this.sourceQuotationId() } : {}),
        ...(this.sourcePurchaseQuotationId()
          ? { sourcePurchaseQuotationId: this.sourcePurchaseQuotationId() }
          : {}),
      },
    };
  }

  private async runPricingPreview(sig: string, payload: Exclude<PreviewPayload, null>): Promise<void> {
    const seq = ++this.previewSeq;
    this.lastSentSignature = sig;
    this.pricingLoading.set(true);

    try {
      if (payload.kind === 'quotation') {
        const res = await previewQuotationPricing(payload.body);
        if (seq !== this.previewSeq) return;

        this._lastFingerprint.set(res.fingerprint);
        const byId = new Map(res.lines.map((l) => [l.clientLineId, l]));
        const nextTotals: Record<string, Dec> = {};
        for (const item of res.lines) {
          nextTotals[item.clientLineId] = item.lineTotal;
        }
        this.previewLineTotals.set(nextTotals);

        const current = this.lines();
        let changed = false;
        const nextLines = current.map((line) => {
          const hit = byId.get(line.clientLineId);
          if (!hit) return line;
          if (
            line.unitPrice === hit.unitPrice &&
            line.discountTotal === hit.discountTotal &&
            line.maxDiscountAmount === hit.maxDiscountAmount &&
            line.maxDiscountPercent === hit.maxDiscountPercent
          ) {
            return line;
          }
          changed = true;
          return {
            ...line,
            unitPrice: hit.unitPrice,
            discountTotal: hit.discountTotal,
            maxDiscountAmount: hit.maxDiscountAmount,
            maxDiscountPercent: hit.maxDiscountPercent,
          };
        });

        if (changed) {
          const nextPayload = this.buildPreviewPayload(nextLines);
          this.lastSentSignature = nextPayload ? JSON.stringify(nextPayload) : sig;
          this.lines.set(nextLines);
        }
        return;
      }

      const res = await previewOrderPricing(payload.kind, payload.body);
      if (seq !== this.previewSeq) return;

      this._lastFingerprint.set(res.fingerprint);
      const byId = new Map(res.lines.map((l) => [l.clientLineId, l]));
      const current = this.lines();
      let changed = false;

      const nextLines = current.map((line) => {
        const hit = byId.get(line.clientLineId);
        if (!hit) return line;

        const shouldFillTax = !line.tax && hit.taxDefault !== null;
        const nextTax = shouldFillTax
          ? { category: hit.taxDefault!.category, rateBps: hit.taxDefault!.rateBps }
          : line.tax;
        const nextTaxLocked = shouldFillTax ? true : line.taxLocked;
        const nextUnitPrice = this.structureLocked() || line.locked ? line.unitPrice : hit.unitPrice;

        if (
          line.unitPrice === nextUnitPrice &&
          line.tax === nextTax &&
          line.taxLocked === nextTaxLocked
        ) {
          return line;
        }
        changed = true;
        return {
          ...line,
          unitPrice: nextUnitPrice,
          tax: nextTax,
          taxLocked: nextTaxLocked,
        };
      });

      if (changed) {
        const nextPayload = this.buildPreviewPayload(nextLines);
        this.lastSentSignature = nextPayload ? JSON.stringify(nextPayload) : sig;
        this.lines.set(nextLines);
      }
    } catch (error) {
      if (seq !== this.previewSeq) return;
      this.lastSentSignature = '';
      const code = errorCodeOf(error);
      const translated = code ? this.transloco.translate(`td.errors.${code}`) : '';
      const message =
        translated && translated !== `td.errors.${code}`
          ? translated
          : this.transloco.translate('td.errors.generic');
      this.notify.error(message);
    } finally {
      if (seq === this.previewSeq) {
        this.pricingLoading.set(false);
      }
    }
  }
}

function columnTrack(col: LineColumn, orderLike: boolean): string {
  switch (col) {
    case 'item':
      return orderLike ? 'minmax(190px,1.6fr)' : 'minmax(200px,1.6fr)';
    case 'description':
      return 'minmax(160px,1.2fr)';
    case 'quantity':
      return orderLike ? '80px' : '100px';
    case 'unit':
      return orderLike ? '80px' : '100px';
    case 'price':
      return orderLike ? '120px' : '130px';
    case 'discount':
      return orderLike ? '110px' : '150px';
    case 'charge':
      return '110px';
    case 'taxCategory':
      return '130px';
    case 'taxRate':
      return '90px';
    case 'taxAmount':
      return '120px';
    case 'expectedDate':
      return '130px';
    case 'receivingNode':
      return '140px';
    case 'total':
      return orderLike ? '140px' : '150px';
  }
}
