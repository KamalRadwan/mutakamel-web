import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerInfoCircle,
  tablerRefresh,
  tablerStack2,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { StatCard } from '../../../../shared/ui/stat-card/stat-card';
import { errorCodeOf, tradeContext } from '../../shared/trade-api';
import { itemName, listUoms } from '../../shared/trade-foundation.api';
import type { Uom } from '../../shared/trade-foundation.model';
import { getAvailability } from '../inventory.api';
import type { Availability } from '../inventory.model';
import { errorKey, errorReason, formatQuantity } from '../inventory.service';

export interface StockCheckRequest {
  nodeId: string;
  itemId: string;
  lotKey?: string | null;
  uomId?: string | null;
  itemCode?: string;
  nodeName?: string;
}

const SCALE = 100_000_000n;
const DECIMAL_INPUT_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

function toMicros(raw: string): bigint {
  const match = DECIMAL_INPUT_PATTERN.exec(raw.trim());
  if (!match) return 0n;
  const neg = match[1] === '-';
  const intPart = BigInt(match[2]);
  const fracRaw = (match[3] ?? '').slice(0, 8).padEnd(8, '0');
  const abs = intPart * SCALE + BigInt(fracRaw);
  return neg ? -abs : abs;
}

function clampPercent(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n || numerator <= 0n) return 0;
  const pct = Number((numerator * 100n) / denominator);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return pct >= 100 ? 100 : pct;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

@Component({
  selector: 'app-stock-check-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, StatCard],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerInfoCircle,
      tablerRefresh,
      tablerStack2,
    }),
  ],
  templateUrl: './stock-check-modal.html',
})
export class StockCheckModal {
  private static nextId = 0;
  protected readonly uid = `stock-check-modal-${++StockCheckModal.nextId}`;

  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('dialog');

  readonly closed = output<void>();

  protected readonly request = signal<StockCheckRequest | null>(null);
  protected readonly availability = signal<Availability | null>(null);
  protected readonly loading = signal(false);
  protected readonly nodeNotFound = signal(false);
  protected readonly ambiguousUom = signal(false);
  protected readonly loadErrorKey = signal<string | null>(null);
  protected readonly selectedUomId = signal('');
  protected readonly uomsLoading = signal(false);
  private readonly uoms = signal<Uom[]>([]);

  private isOpen = false;
  private loadSeq = 0;
  private uomLoadSeq = 0;

  protected readonly subtitle = computed(() => {
    const req = this.request();
    const avail = this.availability();
    const code = avail?.itemCode || req?.itemCode || '';
    const node = avail?.nodeName || req?.nodeName || '';
    const parts = [code, node, req?.lotKey ?? ''].filter(Boolean);
    return parts.join(' · ');
  });

  protected formatQty(value: string): string {
    return formatQuantity(value, this.language());
  }

  protected readonly onHandPercent = computed(() => {
    const avail = this.availability();
    if (!avail) return 0;
    return toMicros(avail.onHandQuantity) > 0n ? 100 : 0;
  });

  protected readonly reservedPercent = computed(() => {
    const avail = this.availability();
    if (!avail) return 0;
    const onHand = toMicros(avail.onHandQuantity);
    if (onHand <= 0n) return 0;
    return clampPercent(toMicros(avail.reservedQuantity), onHand);
  });

  protected readonly availablePercent = computed(() => {
    const avail = this.availability();
    if (!avail) return 0;
    const onHand = toMicros(avail.onHandQuantity);
    if (onHand <= 0n) return 0;
    return clampPercent(toMicros(avail.availableQuantity), onHand);
  });

  protected readonly uomOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const options: DropdownOption<string>[] = [];
    if (!this.selectedUomId()) {
      options.push({
        value: '',
        label: this.transloco.translate('invStock.check.chooseUnitPlaceholder'),
        disabled: true,
      });
    }
    for (const uom of this.uoms()) {
      const name = itemName(uom, lang) || uom.displayName;
      options.push({
        value: uom.id,
        label: `\u2066${uom.code}\u2069 — ${name}`,
      });
    }
    return options;
  });

  open(request: StockCheckRequest): void {
    this.request.set(request);
    this.availability.set(null);
    this.nodeNotFound.set(false);
    this.ambiguousUom.set(false);
    this.loadErrorKey.set(null);
    this.selectedUomId.set(request.uomId ?? '');
    this.uoms.set([]);
    this.isOpen = true;
    this.modal().open();
    void this.fetchAvailability(request.uomId || undefined);
  }

  close(): void {
    this.modal().close();
  }

  protected refresh(): void {
    const req = this.request();
    if (!req || this.loading()) return;
    const uomId = this.selectedUomId() || req.uomId || undefined;
    void this.fetchAvailability(uomId);
  }

  protected onUomSelected(uomId: string): void {
    if (!uomId || this.loading()) return;
    this.selectedUomId.set(uomId);
    void this.fetchAvailability(uomId);
  }

  protected onModalClosed(): void {
    this.isOpen = false;
    this.loadSeq += 1;
    this.uomLoadSeq += 1;
    this.loading.set(false);
    this.uomsLoading.set(false);
    this.closed.emit();
  }

  protected nodeDisplay(avail: Availability): string {
    if (avail.nodeCode && avail.nodeName) {
      return `\u2066${avail.nodeCode}\u2069 · ${avail.nodeName}`;
    }
    return avail.nodeName || avail.nodeCode || this.transloco.translate('tradeInventory.common.none');
  }

  protected formatAdvisoryTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `\u2066${pad2(date.getHours())}:${pad2(date.getMinutes())}\u2069`;
  }

  protected formatFullDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  private async fetchAvailability(uomId?: string): Promise<void> {
    const req = this.request();
    if (!req) return;

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.nodeNotFound.set(false);
    this.loadErrorKey.set(null);

    try {
      const result = await getAvailability({
        nodeId: req.nodeId,
        itemId: req.itemId,
        ...(uomId ? { uomId } : {}),
        ...(req.lotKey ? { lotKey: req.lotKey } : {}),
      });
      if (seq !== this.loadSeq || !this.isOpen) return;
      this.availability.set(result);
      this.ambiguousUom.set(false);
      if (result.uomId && !this.selectedUomId()) {
        this.selectedUomId.set(result.uomId);
      }
    } catch (error) {
      if (seq !== this.loadSeq || !this.isOpen) return;
      const code = errorCodeOf(error);

      if (code === 'TRADE.INVENTORY.NODE_NOT_FOUND') {
        this.availability.set(null);
        this.ambiguousUom.set(false);
        this.nodeNotFound.set(true);
        return;
      }

      if (code === 'TRADE.INVENTORY.QUANTITY_INVALID' && errorReason(error) === 'uom_required_for_ambiguous_balance') {
        this.availability.set(null);
        this.ambiguousUom.set(true);
        void this.loadUnitOptions(req.itemId);
        return;
      }

      const key = errorKey(error);
      if (this.availability()) {
        this.notify.error(this.transloco.translate(key));
      } else {
        this.loadErrorKey.set(key);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadUnitOptions(itemId: string): Promise<void> {
    const seq = ++this.uomLoadSeq;
    this.uomsLoading.set(true);
    try {
      const ctx = tradeContext(this.scope, 'COMPANY');
      let list = await listUoms({ itemId }, ctx);
      if (list.length === 0) {
        list = await listUoms({ status: 'ACTIVE' });
      }
      if (seq !== this.uomLoadSeq || !this.isOpen) return;
      this.uoms.set(list);
    } catch {
      if (seq !== this.uomLoadSeq || !this.isOpen) return;
      try {
        const fallback = await listUoms({ status: 'ACTIVE' });
        if (seq !== this.uomLoadSeq || !this.isOpen) return;
        this.uoms.set(fallback);
      } catch {
        if (seq === this.uomLoadSeq) {
          this.uoms.set([]);
        }
      }
    } finally {
      if (seq === this.uomLoadSeq) {
        this.uomsLoading.set(false);
      }
    }
  }
}
