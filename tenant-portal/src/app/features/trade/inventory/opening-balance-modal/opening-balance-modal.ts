import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerPlus, tablerX } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { TradeItemPicker } from '../../shared/pickers/item-picker/item-picker';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { getItem, itemName, listUoms, searchItemSummaries } from '../../shared/trade-foundation.api';
import type { ItemDetail, ItemKind, Uom } from '../../shared/trade-foundation.model';
import { listNodes, recordOpeningBalance } from '../inventory.api';
import {
  DECIMAL_PATTERN,
  INVENTORY_LIMITS,
  type FulfillmentNode,
  type InventoryTracking,
  type OpeningBalanceResult,
} from '../inventory.model';
import { errorKey, errorReason, signOf } from '../inventory.service';

type OpeningField = 'node' | 'item' | 'uom' | 'quantity' | 'effectiveAt' | 'lotKey' | 'serials';

interface TranslatedError {
  key: string;
  params?: Record<string, number>;
}

const PRODUCT_KINDS: readonly ItemKind[] = ['PRODUCT'];
const WHOLE_DECIMAL_PATTERN = /^\d{1,16}(?:\.0{1,8})?$/;

function toLocalDateAndTime(date: Date): { date: string; time: string } {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

function fromLocalDateAndTime(dateStr: string | null, timeStr: string | null): Date | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
    return null;
  }
  return result;
}

function parseSerialLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseWholeQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!WHOLE_DECIMAL_PATTERN.test(trimmed)) return null;
  const intPart = trimmed.split('.')[0];
  const parsed = Number(intPart);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

@Component({
  selector: 'app-opening-balance-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    DateField,
    TimeField,
    Dropdown,
    Field,
    Modal,
    TradeItemPicker,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-stock', alias: 'invStock' }),
    provideIcons({ tablerAlertTriangle, tablerPlus, tablerX }),
  ],
  templateUrl: './opening-balance-modal.html',
})
export class OpeningBalanceModal {
  private static nextId = 0;
  protected readonly uid = `opening-balance-modal-${++OpeningBalanceModal.nextId}`;

  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('dialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly quantityConflictModal = viewChild.required<Modal>('quantityConflictModal');
  private readonly quantityInput = viewChild<ElementRef<HTMLInputElement>>('quantityInput');

  readonly presetNodeId = input<string | null>(null);
  readonly presetItemId = input<string | null>(null);

  readonly saved = output<OpeningBalanceResult>();
  readonly closed = output<void>();

  protected readonly limits = INVENTORY_LIMITS;
  protected readonly productKinds = PRODUCT_KINDS;

  protected readonly activeNodes = signal<FulfillmentNode[]>([]);
  protected readonly nodesLoading = signal(false);
  protected readonly nonTrackedItemIds = signal<readonly string[]>([]);

  protected readonly selectedItem = signal<ItemDetail | null>(null);
  protected readonly itemLoading = signal(false);
  protected readonly itemUoms = signal<Uom[]>([]);

  protected readonly nodeId = signal('');
  protected readonly itemId = signal<string | null>(null);
  protected readonly uomId = signal('');
  protected readonly quantity = signal('');
  protected readonly effectiveDate = signal<string | null>(null);
  protected readonly effectiveTime = signal<string | null>(null);
  protected readonly lotKey = signal('');
  protected readonly expiryDate = signal<string | null>(null);
  protected readonly serialsText = signal('');

  protected readonly saving = signal(false);
  private readonly submitted = signal(false);
  private readonly touched = signal<Partial<Record<OpeningField, boolean>>>({});
  private readonly serverErrors = signal<Partial<Record<OpeningField, TranslatedError>>>({});

  private isOpen = false;
  private allowClose = false;
  private confirmingDiscard = false;
  private operationKey = '';
  private idempotencyKey = '';
  private nodesSeq = 0;
  private excludeSeq = 0;
  private itemSeq = 0;

  private initialNodeId = '';
  private initialItemId: string | null = null;
  private initialEffectiveDate: string | null = null;
  private initialEffectiveTime: string | null = null;

  protected readonly companyContext = computed(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly trackingMode = computed<'NONE' | 'LOT' | 'SERIAL'>(() => {
    const mode = this.selectedItem()?.companyProfile?.trackingMode;
    return mode === 'LOT' || mode === 'SERIAL' ? mode : 'NONE';
  });

  protected readonly parsedSerials = computed(() => parseSerialLines(this.serialsText()));

  protected readonly expectedSerialCount = computed<number>(() => {
    if (this.trackingMode() !== 'SERIAL') return 0;
    const whole = parseWholeQuantity(this.quantity());
    if (whole === null || whole > INVENTORY_LIMITS.serialKeys) return 0;
    return whole;
  });

  protected readonly nodeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.activeNodes();
    if (list.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('invStock.opening.noActiveNodes'),
          disabled: true,
        },
      ];
    }
    const options: DropdownOption<string>[] = [];
    if (!this.nodeId()) {
      options.push({
        value: '',
        label: this.transloco.translate('invStock.opening.nodePlaceholder'),
        disabled: true,
      });
    }
    for (const node of list) {
      options.push({
        value: node.id,
        label: `\u2066${node.code}\u2069 — ${node.name}`,
      });
    }
    return options;
  });

  protected readonly uomOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const list = this.itemUoms();
    if (list.length === 0) {
      return [
        {
          value: '',
          label: this.transloco.translate('invStock.opening.unitPlaceholder'),
          disabled: true,
        },
      ];
    }
    return list.map((uom) => ({
      value: uom.id,
      label: `\u2066${uom.code}\u2069 — ${itemName(uom, lang) || uom.displayName}`,
    }));
  });

  protected readonly dirty = computed(() => {
    if (this.nodeId() !== this.initialNodeId) return true;
    if (this.itemId() !== this.initialItemId) return true;
    const item = this.selectedItem();
    if (item && this.uomId() && this.uomId() !== item.baseUomId) return true;
    if (this.quantity().trim().length > 0) return true;
    if (this.effectiveDate() !== this.initialEffectiveDate) return true;
    if (this.effectiveTime() !== this.initialEffectiveTime) return true;
    if (this.lotKey().length > 0) return true;
    if (this.expiryDate() !== null) return true;
    if (this.serialsText().length > 0) return true;
    return false;
  });

  private readonly clientErrors = computed<Partial<Record<OpeningField, TranslatedError>>>(() => {
    const errors: Partial<Record<OpeningField, TranslatedError>> = {};

    if (!this.nodeId().trim()) {
      errors.node = { key: 'invStock.opening.errors.required' };
    }

    const pickedItemId = this.itemId();
    const item = this.selectedItem();
    if (!pickedItemId) {
      errors.item = { key: 'invStock.opening.errors.required' };
    } else if (item && item.id === pickedItemId && !item.companyProfile?.trackInventory) {
      errors.item = { key: 'invStock.opening.errors.itemNotTracked' };
    }

    if (!this.uomId().trim()) {
      errors.uom = { key: 'invStock.opening.errors.required' };
    }

    const rawQty = this.quantity().trim();
    const mode = this.trackingMode();
    if (!rawQty) {
      errors.quantity = { key: 'invStock.opening.errors.required' };
    } else if (!DECIMAL_PATTERN.test(rawQty) || signOf(rawQty) <= 0) {
      errors.quantity = { key: 'invStock.opening.errors.quantityInvalid' };
    } else if (mode === 'SERIAL') {
      const whole = parseWholeQuantity(rawQty);
      if (whole === null) {
        errors.quantity = { key: 'invStock.opening.errors.quantityWhole' };
      } else if (whole > INVENTORY_LIMITS.serialKeys) {
        errors.quantity = { key: 'invStock.opening.errors.quantityMaxSerials' };
      }
    }

    if (!fromLocalDateAndTime(this.effectiveDate(), this.effectiveTime())) {
      errors.effectiveAt = { key: 'invStock.opening.errors.dateInvalid' };
    }

    if (mode === 'LOT') {
      const trimmedLot = this.lotKey().trim();
      if (!trimmedLot) {
        errors.lotKey = { key: 'invStock.opening.errors.required' };
      } else if (trimmedLot.length > INVENTORY_LIMITS.lotKey) {
        errors.lotKey = { key: 'invStock.opening.errors.lotTooLong' };
      }
    } else if (mode === 'SERIAL') {
      const serials = this.parsedSerials();
      if (serials.length === 0) {
        errors.serials = { key: 'invStock.opening.errors.required' };
      } else if (serials.some((sk) => sk.toLowerCase() === 'none')) {
        errors.serials = { key: 'invStock.opening.errors.serialNone' };
      } else if (serials.some((sk) => sk.length > INVENTORY_LIMITS.serialKeyLength)) {
        errors.serials = { key: 'invStock.opening.errors.serialTooLong' };
      } else if (new Set(serials).size !== serials.length) {
        errors.serials = { key: 'invStock.opening.errors.serialDuplicate' };
      } else if (serials.length > INVENTORY_LIMITS.serialKeys) {
        errors.serials = { key: 'invStock.opening.errors.serialMax' };
      } else {
        const expected = parseWholeQuantity(rawQty);
        if (expected !== null && expected <= INVENTORY_LIMITS.serialKeys && serials.length !== expected) {
          errors.serials = { key: 'invStock.opening.errors.serialCountMismatch', params: { count: expected } };
        }
      }
    }

    return errors;
  });

  protected readonly nodeError = computed(() => this.resolveFieldError('node'));
  protected readonly itemError = computed(() => this.resolveFieldError('item', true));
  protected readonly uomError = computed(() => this.resolveFieldError('uom'));
  protected readonly quantityError = computed(() => this.resolveFieldError('quantity'));
  protected readonly effectiveAtError = computed(() => this.resolveFieldError('effectiveAt'));
  protected readonly lotKeyError = computed(() => this.resolveFieldError('lotKey'));
  protected readonly serialsError = computed(() => this.resolveFieldError('serials'));

  open(preset?: { nodeId?: string | null; itemId?: string | null }): void {
    const startNodeId = preset?.nodeId ?? this.presetNodeId() ?? '';
    const startItemId = preset?.itemId ?? this.presetItemId() ?? null;
    const now = toLocalDateAndTime(new Date());

    this.initialNodeId = startNodeId;
    this.initialItemId = startItemId;
    this.initialEffectiveDate = now.date;
    this.initialEffectiveTime = now.time;

    this.nodeId.set(startNodeId);
    this.itemId.set(startItemId);
    this.selectedItem.set(null);
    this.itemUoms.set([]);
    this.uomId.set('');
    this.quantity.set('');
    this.effectiveDate.set(now.date);
    this.effectiveTime.set(now.time);
    this.lotKey.set('');
    this.expiryDate.set(null);
    this.serialsText.set('');

    this.submitted.set(false);
    this.touched.set({});
    this.serverErrors.set({});
    this.saving.set(false);
    this.allowClose = false;

    this.operationKey = newIdempotencyKey();
    this.idempotencyKey = newIdempotencyKey();
    this.isOpen = true;
    this.modal().open();

    void this.loadActiveNodes();
    void this.loadNonTrackedExclusions();
    if (startItemId) {
      void this.loadItemDetail(startItemId, false);
    }

    afterNextRender(() => {
      if (startNodeId && startItemId) {
        this.quantityInput()?.nativeElement.focus();
      }
    }, { injector: this.injector });
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected describedBy(suffix: string, hasError: boolean): string {
    const hintId = `${this.uid}-${suffix}-hint`;
    return hasError ? `${hintId} ${this.uid}-${suffix}-error` : hintId;
  }

  protected markTouched(field: OpeningField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onNodeChange(value: string): void {
    if (this.saving()) return;
    this.nodeId.set(value);
    this.markTouched('node');
    this.clearServerError('node');
  }

  protected onItemChange(nextItemId: string | null): void {
    if (this.saving()) return;
    const prevItemId = this.itemId();
    this.itemId.set(nextItemId);
    this.clearServerError('item');
    this.clearServerError('uom');
    this.clearServerError('lotKey');
    this.clearServerError('serials');

    if (!nextItemId) {
      this.itemSeq += 1;
      if (prevItemId) this.markTouched('item');
      this.selectedItem.set(null);
      this.itemUoms.set([]);
      this.uomId.set('');
      this.lotKey.set('');
      this.expiryDate.set(null);
      this.serialsText.set('');
      return;
    }

    if (nextItemId !== prevItemId) {
      this.lotKey.set('');
      this.expiryDate.set(null);
      this.serialsText.set('');
    }
    void this.loadItemDetail(nextItemId, false);
  }

  protected onUomChange(value: string): void {
    if (this.saving()) return;
    this.uomId.set(value);
    this.markTouched('uom');
    this.clearServerError('uom');
  }

  protected onQuantityInput(event: Event): void {
    if (this.saving()) return;
    this.quantity.set((event.target as HTMLInputElement).value);
    this.clearServerError('quantity');
  }

  protected onEffectiveDateChange(value: string | null): void {
    if (this.saving()) return;
    this.effectiveDate.set(value);
    this.markTouched('effectiveAt');
    this.clearServerError('effectiveAt');
  }

  protected onEffectiveTimeChange(value: string | null): void {
    if (this.saving()) return;
    this.effectiveTime.set(value);
    this.markTouched('effectiveAt');
    this.clearServerError('effectiveAt');
  }

  protected onLotKeyInput(event: Event): void {
    if (this.saving()) return;
    this.lotKey.set((event.target as HTMLInputElement).value);
    this.clearServerError('lotKey');
  }

  protected onExpiryDateChange(value: string | null): void {
    if (this.saving()) return;
    this.expiryDate.set(value);
  }

  protected clearExpiryDate(): void {
    if (this.saving()) return;
    this.expiryDate.set(null);
  }

  protected onSerialsInput(event: Event): void {
    if (this.saving()) return;
    this.serialsText.set((event.target as HTMLTextAreaElement).value);
    this.clearServerError('serials');
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.saving() || this.itemLoading()) return;

    this.submitted.set(true);
    this.serverErrors.set({});

    const item = this.selectedItem();
    if (Object.keys(this.clientErrors()).length > 0 || !item || !item.companyProfile) {
      return;
    }

    const effective = fromLocalDateAndTime(this.effectiveDate(), this.effectiveTime());
    if (!effective) return;

    const tracking: InventoryTracking = {};
    if (this.trackingMode() === 'LOT') {
      tracking.lotKey = this.lotKey().trim();
      const exp = this.expiryDate()?.trim();
      if (exp) tracking.expiryDate = exp;
    } else if (this.trackingMode() === 'SERIAL') {
      tracking.serialKeys = this.parsedSerials();
    }

    this.saving.set(true);
    try {
      const result = await recordOpeningBalance(
        {
          nodeId: this.nodeId().trim(),
          itemId: item.id,
          uomId: this.uomId().trim(),
          quantity: this.quantity().trim(),
          itemProfileVersion: item.companyProfile.version,
          businessEffectiveAt: effective.toISOString(),
          operationKey: this.operationKey,
          tracking,
        },
        this.idempotencyKey,
      );
      if (!this.isOpen) return;
      this.notify.success(this.transloco.translate('invStock.opening.recorded'));
      this.saved.emit(result);
      this.close();
    } catch (error) {
      if (!this.isOpen) return;
      this.handleSubmitError(error, item.id);
    } finally {
      this.saving.set(false);
    }
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.isOpen = false;
    this.nodesSeq += 1;
    this.excludeSeq += 1;
    this.itemSeq += 1;
    this.closed.emit();
  }

  protected closeQuantityConflict(): void {
    this.quantityConflictModal().close();
  }

  private resolveFieldError(field: OpeningField, showImmediate = false): string | null {
    this.i18n();
    const serverErr = this.serverErrors()[field];
    if (serverErr) {
      return this.transloco.translate(serverErr.key, serverErr.params);
    }

    const clientErr = this.clientErrors()[field];
    if (!clientErr) return null;

    if (showImmediate && clientErr.key === 'invStock.opening.errors.itemNotTracked') {
      return this.transloco.translate(clientErr.key, clientErr.params);
    }

    if (!this.submitted() && !this.touched()[field]) {
      return null;
    }
    return this.transloco.translate(clientErr.key, clientErr.params);
  }

  private clearServerError(field: OpeningField): void {
    this.serverErrors.update((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private handleSubmitError(error: unknown, currentItemId: string): void {
    const code = errorCodeOf(error);

    if (code === 'TRADE.INVENTORY.PERIOD_CONFLICT') {
      this.serverErrors.set({ effectiveAt: { key: errorKey(error) } });
      return;
    }

    if (code === 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED') {
      this.serverErrors.set({ item: { key: 'invStock.opening.errors.itemNotTracked' } });
      return;
    }

    if (code === 'TRADE.INVENTORY.TRACKING_REQUIRED' || code === 'TRADE.INVENTORY.TRACKING_UNSUPPORTED') {
      if (this.trackingMode() === 'LOT') {
        this.serverErrors.set({ lotKey: { key: errorKey(error) } });
        return;
      }
      if (this.trackingMode() === 'SERIAL') {
        this.serverErrors.set({ serials: { key: errorKey(error) } });
        return;
      }
    }

    if (code === 'TRADE.INVENTORY.SERIAL_CONFLICT') {
      this.serverErrors.set({ serials: { key: 'invStock.opening.errors.serialConflict' } });
      return;
    }

    if (code === 'TRADE.INVENTORY.UOM_CONVERSION_INVALID' && errorReason(error) === 'non_exact_result') {
      this.serverErrors.set({ quantity: { key: errorKey(error) } });
      return;
    }

    if (code === 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE') {
      this.serverErrors.set({ uom: { key: 'invStock.opening.errors.uomConversionUnavailable' } });
      return;
    }

    if (code === 'TRADE.INVENTORY.QUANTITY_CONFLICT') {
      this.quantityConflictModal().open();
      return;
    }

    if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
      this.notify.error(this.transloco.translate(errorKey(error)));
      void this.loadItemDetail(currentItemId, true);
      return;
    }

    if (code === 'TRADE.VALIDATION_FAILED' && error instanceof ApiError && error.details) {
      const nextErrors: Partial<Record<OpeningField, TranslatedError>> = {};
      if (error.details['quantity']) nextErrors.quantity = { key: 'invStock.opening.errors.quantityInvalid' };
      if (error.details['itemId']) nextErrors.item = { key: 'invStock.opening.errors.itemNotTracked' };
      if (error.details['uomId']) nextErrors.uom = { key: 'invStock.opening.errors.required' };
      if (error.details['businessEffectiveAt']) nextErrors.effectiveAt = { key: 'invStock.opening.errors.dateInvalid' };
      if (Object.keys(nextErrors).length > 0) {
        this.serverErrors.set(nextErrors);
        return;
      }
    }

    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private async loadActiveNodes(): Promise<void> {
    const seq = ++this.nodesSeq;
    this.nodesLoading.set(true);
    try {
      const list = await listNodes();
      if (seq !== this.nodesSeq || !this.isOpen) return;
      const active = list.filter((node) => node.status === 'ACTIVE');
      this.activeNodes.set(active);
      const current = this.nodeId();
      if (current && !active.some((node) => node.id === current)) {
        this.nodeId.set('');
        if (this.initialNodeId === current) {
          this.initialNodeId = '';
        }
      }
    } catch (error) {
      if (seq !== this.nodesSeq || !this.isOpen) return;
      this.activeNodes.set([]);
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.nodesSeq) {
        this.nodesLoading.set(false);
      }
    }
  }

  private async loadNonTrackedExclusions(): Promise<void> {
    const seq = ++this.excludeSeq;
    const ctx = this.companyContext();
    if (!ctx.companyId) {
      this.nonTrackedItemIds.set([]);
      return;
    }
    try {
      const excluded: string[] = [];
      let page = 1;
      let total = 0;
      do {
        const res = await searchItemSummaries(ctx, { itemKind: 'PRODUCT', page, limit: 100 });
        if (seq !== this.excludeSeq || !this.isOpen) return;
        total = res.total;
        for (const item of res.items) {
          if (!item.companyProfile?.trackInventory) {
            excluded.push(item.id);
          }
        }
        if (res.items.length === 0) break;
        page += 1;
      } while ((page - 1) * 100 < total);
      if (seq === this.excludeSeq && this.isOpen) {
        this.nonTrackedItemIds.set(excluded);
      }
    } catch {
      if (seq === this.excludeSeq) {
        this.nonTrackedItemIds.set([]);
      }
    }
  }

  private async loadItemDetail(id: string, preserveSelection: boolean): Promise<void> {
    const seq = ++this.itemSeq;
    const ctx = this.companyContext();
    this.itemLoading.set(true);
    try {
      const [detail, uoms] = await Promise.all([getItem(ctx, id), listUoms({ itemId: id }, ctx)]);
      if (seq !== this.itemSeq || !this.isOpen || this.itemId() !== id) return;

      const prevMode = this.selectedItem()?.companyProfile?.trackingMode;
      this.selectedItem.set(detail);

      const orderedIds: string[] = [];
      const addUnique = (candidate: string | null | undefined) => {
        if (candidate && !orderedIds.includes(candidate)) {
          orderedIds.push(candidate);
        }
      };
      addUnique(detail.baseUomId);
      addUnique(detail.companyProfile?.defaultSalesUomId);
      addUnique(detail.companyProfile?.defaultPurchaseUomId);

      const byId = new Map(uoms.map((u) => [u.id, u]));
      const orderedUoms = orderedIds
        .map((uid) => byId.get(uid))
        .filter((u): u is Uom => u !== undefined);

      this.itemUoms.set(orderedUoms);

      const currentUom = this.uomId();
      if (preserveSelection && currentUom && orderedUoms.some((u) => u.id === currentUom)) {
        this.uomId.set(currentUom);
      } else {
        this.uomId.set(orderedUoms.some((u) => u.id === detail.baseUomId) ? detail.baseUomId : (orderedUoms[0]?.id ?? ''));
      }

      const nextMode = detail.companyProfile?.trackingMode;
      if (preserveSelection && prevMode && prevMode !== nextMode) {
        this.lotKey.set('');
        this.expiryDate.set(null);
        this.serialsText.set('');
      }
    } catch (error) {
      if (seq !== this.itemSeq || !this.isOpen) return;
      this.selectedItem.set(null);
      this.itemUoms.set([]);
      this.uomId.set('');
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.itemSeq) {
        this.itemLoading.set(false);
      }
    }
  }
}
