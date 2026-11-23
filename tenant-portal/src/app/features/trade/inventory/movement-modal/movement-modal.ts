import {
  Component,
  DestroyRef,
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
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerBarcode,
  tablerBuildingWarehouse,
  tablerCalculator,
  tablerCopy,
  tablerExternalLink,
  tablerFileText,
  tablerTruck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { ApiError, tradeContext } from '../../shared/trade-api';
import { itemName as foundationItemName, listReasons, listUoms } from '../../shared/trade-foundation.api';
import type { ReasonCode, Uom } from '../../shared/trade-foundation.model';
import { getMovement } from '../inventory.api';
import type { LedgerEntryDetail } from '../inventory.model';
import {
  canReverseEntry,
  errorKey,
  factorText,
  formatDateTime,
  formatQuantity,
  isForbiddenError,
  itemName,
  movementGroup,
  shortId,
  signOf,
} from '../inventory.service';
import { InventoryQuantity } from '../inventory-shared/inventory-quantity/inventory-quantity';

const MAX_SERIAL_CHIPS = 50;
const SKELETON_ROWS = [0, 1, 2, 3] as const;
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatIsoDay(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const trimmed = raw.trim();
  const match = ISO_DAY_RE.exec(trimmed);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return trimmed;
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${String(dt.getFullYear()).padStart(4, '0')}`;
}

function formatSignedText(value: string, uomCode: string, lang: 'en' | 'ar'): string {
  const formatted = formatQuantity(value, lang);
  if (formatted === '—') return formatted;
  const s = signOf(value);
  const abs = s < 0 ? `\u2212${formatted.replace(/^-/, '')}` : s > 0 ? `+${formatted}` : formatted;
  return uomCode ? `${abs} ${uomCode}` : abs;
}

@Component({
  selector: 'app-movement-modal',
  imports: [TranslocoPipe, NgIcon, Button, Field, Modal, SectionBar, InventoryQuantity],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-movements', alias: 'invMoves' }),
    provideIcons({
      tablerTruck,
      tablerAlertTriangle,
      tablerCalculator,
      tablerBuildingWarehouse,
      tablerFileText,
      tablerBarcode,
      tablerCopy,
      tablerExternalLink,
      tablerArrowBackUp,
    }),
  ],
  templateUrl: './movement-modal.html',
})
export class MovementModal {
  private static nextId = 0;
  protected readonly uid = `movement-modal-${++MovementModal.nextId}`;

  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);

  readonly canAdjust = input(true);

  readonly closed = output<void>();
  readonly openMovement = output<string>();
  readonly openDecision = output<string>();
  readonly reverseRequested = output<LedgerEntryDetail>();
  readonly forbidden = output<void>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly maxSerialChips = MAX_SERIAL_CHIPS;

  protected readonly currentId = signal<string | null>(null);
  protected readonly movement = signal<LedgerEntryDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly errorMessageKey = signal('tradeInventory.errors.generic');

  private readonly uoms = signal<readonly Uom[]>([]);
  private readonly reversalReasons = signal<readonly ReasonCode[]>([]);

  private loadSeq = 0;
  private lookupsLoaded = false;
  private suppressClosed = false;
  private destroyed = false;

  protected readonly headerTile = computed(() => {
    const m = this.movement();
    if (!m) return 'bg-icon-gray';
    switch (movementGroup(m.movementType)) {
      case 'OPENING':
        return 'bg-icon-gray';
      case 'RECEIPT':
        return 'bg-icon-green';
      case 'DELIVERY':
        return 'bg-icon-blue';
      case 'REVERSAL':
        return 'bg-icon-red';
    }
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const m = this.movement();
    if (!m) return this.transloco.translate('invMoves.detail.title');
    return this.transloco.translate(`tradeInventory.badge.movement.${m.movementType}`);
  });

  protected readonly modalSubtitle = computed(() => {
    const m = this.movement();
    if (!m) return '';
    return `\u2066${formatDateTime(m.occurredAt)}\u2069`;
  });

  protected readonly itemLabel = computed(() => {
    const m = this.movement();
    if (!m) return '';
    const name = itemName(m.itemNames, this.language());
    return name ? `\u2066${m.itemCode}\u2069 — ${name}` : m.itemCode;
  });

  protected readonly baseQtyText = computed(() => {
    const m = this.movement();
    if (!m) return '';
    return formatSignedText(m.normalizedSignedQuantity, m.normalizedUomCode, this.language());
  });

  protected readonly baseQtyToneClass = computed(() => {
    const m = this.movement();
    if (!m) return 'text-text';
    const s = signOf(m.normalizedSignedQuantity);
    if (s > 0) return 'text-success-text';
    if (s < 0) return 'text-danger-text';
    return 'text-text';
  });

  protected readonly originalQtyText = computed(() => {
    const m = this.movement();
    if (!m) return '';
    return formatSignedText(m.signedQuantity, m.uomCode, this.language());
  });

  protected readonly uomById = computed(() => {
    const map = new Map<string, Uom>();
    for (const u of this.uoms()) {
      map.set(u.id, u);
    }
    return map;
  });

  protected readonly conversionText = computed(() => {
    this.i18n();
    const m = this.movement();
    if (!m) return '';
    const conv = m.uomConversion;
    if (!conv) {
      return this.transloco.translate('tradeInventory.common.baseUom');
    }
    const lang = this.language();
    const fromUom = this.uomById().get(conv.fromUomId);
    const toUom = this.uomById().get(conv.toUomId);
    const fromLabel = fromUom ? foundationItemName(fromUom, lang) || fromUom.displayName || conv.fromUomCode : conv.fromUomCode;
    const toLabel = toUom ? foundationItemName(toUom, lang) || toUom.displayName || conv.toUomCode : conv.toUomCode;
    const rawFactor = factorText(conv.factorNumerator, conv.factorDenominator);
    const factor = rawFactor.includes('/') ? rawFactor : formatQuantity(rawFactor, lang);
    return this.transloco.translate('invMoves.detail.conversionText', {
      n: conv.revisionNumber,
      from: fromLabel,
      factor,
      to: toLabel,
    });
  });

  protected readonly nodeLabel = computed(() => {
    const m = this.movement();
    if (!m) return '';
    return m.nodeCode ? `\u2066${m.nodeCode}\u2069 — ${m.nodeName}` : m.nodeName;
  });

  protected readonly periodDisplay = computed(() => {
    this.i18n();
    const m = this.movement();
    if (!m) return '';
    return m.periodCode?.trim() || this.transloco.translate('tradeInventory.common.none');
  });

  protected readonly sourceDocDisplay = computed(() => {
    this.i18n();
    const m = this.movement();
    if (!m) return '';
    return m.sourceNumber?.trim() || this.transloco.translate('tradeInventory.common.none');
  });

  protected readonly reversalOfDisplay = computed(() => {
    const id = this.movement()?.reversalOfId;
    return id ? shortId(id) : '';
  });

  protected readonly reversalReasonDisplay = computed(() => {
    const code = this.movement()?.tracking.reversalReasonCode?.trim();
    if (!code) return '';
    const upper = code.toUpperCase();
    const match = this.reversalReasons().find((r) => r.code.toUpperCase() === upper);
    if (match) {
      return foundationItemName(match, this.language()) || match.code;
    }
    return code;
  });

  protected readonly lotDisplay = computed(() => {
    this.i18n();
    const lot = this.movement()?.tracking.lotKey?.trim();
    return lot || this.transloco.translate('tradeInventory.common.none');
  });

  protected readonly expiryDisplay = computed(() => {
    this.i18n();
    const exp = this.movement()?.tracking.expiryDate;
    return formatIsoDay(exp) || this.transloco.translate('tradeInventory.common.none');
  });

  protected readonly serials = computed(() => this.movement()?.tracking.serialKeys ?? []);
  protected readonly visibleSerials = computed(() => this.serials().slice(0, MAX_SERIAL_CHIPS));
  protected readonly extraSerialCount = computed(() => Math.max(0, this.serials().length - MAX_SERIAL_CHIPS));

  protected readonly canReverse = computed(() => {
    const m = this.movement();
    return !!m && canReverseEntry(m, this.canAdjust(), m.source?.status);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq += 1;
    });
  }

  open(id: string): void {
    this.currentId.set(id);
    this.movement.set(null);
    this.loadFailed.set(false);
    this.loading.set(true);
    this.modal().open();
    void this.ensureLookups();
    void this.loadMovement(id);
  }

  reload(): void {
    const id = this.currentId();
    if (!id) return;
    this.loadFailed.set(false);
    this.loading.set(true);
    void this.loadMovement(id);
  }

  isViewingSource(sourceId: string): boolean {
    const m = this.movement();
    return Boolean(m && m.sourceId === sourceId);
  }

  close(): void {
    this.modal().close();
  }

  closeSilently(): void {
    this.loadSeq += 1;
    this.suppressClosed = true;
    try {
      this.modal().close();
    } finally {
      this.suppressClosed = false;
    }
  }

  protected onModalClosed(): void {
    this.loadSeq += 1;
    this.currentId.set(null);
    if (!this.suppressClosed) {
      this.closed.emit();
    }
  }

  protected onOpenMovement(id: string): void {
    this.openMovement.emit(id);
  }

  protected onOpenDecision(id: string): void {
    this.closeSilently();
    this.openDecision.emit(id);
  }

  protected onReverseClick(): void {
    const m = this.movement();
    if (!m || !this.canReverse()) return;
    this.reverseRequested.emit(m);
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected shortId(id: string): string {
    return shortId(id);
  }

  protected async copyText(value: string | null | undefined): Promise<void> {
    const clean = value?.trim();
    if (!clean) return;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clean);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
    } catch {
      this.notify.error(this.transloco.translate('tradeInventory.errors.generic'));
    }
  }

  private async ensureLookups(): Promise<void> {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    const ctx = tradeContext(this.scope, 'COMPANY');
    const [uomsRes, reasonsRes] = await Promise.allSettled([
      listUoms(undefined, ctx),
      listReasons('INVENTORY_REVERSAL', { includeInactive: true }, ctx),
    ]);
    if (this.destroyed) return;
    if (uomsRes.status === 'fulfilled') {
      this.uoms.set(uomsRes.value);
    }
    if (reasonsRes.status === 'fulfilled') {
      this.reversalReasons.set(reasonsRes.value);
    }
    if (uomsRes.status === 'rejected' || reasonsRes.status === 'rejected') {
      this.lookupsLoaded = false;
    }
  }

  private async loadMovement(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const detail = await getMovement(id, tradeContext(this.scope, 'BRANCH'));
      if (this.destroyed || seq !== this.loadSeq) return;
      this.movement.set(detail);
      this.loading.set(false);
    } catch (error) {
      if (this.destroyed || seq !== this.loadSeq) return;
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.closeSilently();
        this.forbidden.emit();
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        this.notify.error(this.transloco.translate(errorKey(error)));
        this.modal().close();
        return;
      }
      this.errorMessageKey.set(errorKey(error));
      this.loadFailed.set(true);
    }
  }
}
