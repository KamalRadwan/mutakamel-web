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
  tablerExternalLink,
  tablerListDetails,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { Switch } from '../../../../shared/ui/switch/switch';
import {
  type ReasonPickerValue,
  TradeReasonPicker,
} from '../../shared/pickers/reason-picker/reason-picker';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { getMovementSource, reverseMovementSource } from '../inventory.api';
import {
  DECIMAL_PATTERN,
  type LedgerEntry,
  type MovementSource,
  type MovementSourceRecord,
  type ReverseMovementInput,
  type SourceLine,
} from '../inventory.model';
import { errorKey, formatQuantity, isForbiddenError, itemName } from '../inventory.service';
import { InventoryConflict } from '../inventory-shared/inventory-conflict/inventory-conflict';

const SCALE = 100_000_000n;
const WHOLE_DECIMAL_PATTERN = /^\d{1,16}(?:\.0{1,8})?$/;
const SKELETON_ROWS = [0, 1] as const;

interface TranslatedError {
  key: string;
  params?: Record<string, string | number>;
}

interface ReversibleLineView {
  line: SourceLine;
  remainingMicros: bigint;
  remainingText: string;
  isSerialized: boolean;
  eligibleSerials: readonly string[];
}

function emptyReason(): ReasonPickerValue {
  return { reasonCodeId: null, note: '' };
}

function toMicros(raw: string): bigint {
  const trimmed = raw.trim();
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return 0n;
  const neg = match[1] === '-';
  const intPart = BigInt(match[2]);
  const fracRaw = (match[3] ?? '').slice(0, 8).padEnd(8, '0');
  const abs = intPart * SCALE + BigInt(fracRaw);
  return neg ? -abs : abs;
}

function fromMicros(value: bigint): string {
  if (value <= 0n) return '0';
  const intPart = value / SCALE;
  const fracPart = (value % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart.toString();
}

function parseWholePositive(raw: string): number | null {
  const trimmed = raw.trim();
  if (!WHOLE_DECIMAL_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed.split('.')[0]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

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

function resolveSourceKind(entry: LedgerEntry): 'RECEIPT' | 'DELIVERY' | null {
  if (entry.movementType !== 'PURCHASE_RECEIPT' && entry.movementType !== 'SALES_DELIVERY') {
    return null;
  }
  if (entry.sourceType === 'RECEIPT' || entry.movementType === 'PURCHASE_RECEIPT') {
    return 'RECEIPT';
  }
  if (entry.sourceType === 'DELIVERY' || entry.movementType === 'SALES_DELIVERY') {
    return 'DELIVERY';
  }
  return null;
}

function extractDecisionId(error: ApiError): string | null {
  const details = error.details as Record<string, unknown> | undefined;
  const raw = details?.['decisionReceiptId'];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    const trimmed = raw[0].trim();
    return trimmed || null;
  }
  return null;
}

@Component({
  selector: 'app-reverse-modal',
  imports: [
    TranslocoPipe,
    NgIcon,
    Button,
    Checkbox,
    DateField,
    TimeField,
    Field,
    Modal,
    SectionBar,
    Switch,
    TradeReasonPicker,
    InventoryConflict,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-movements', alias: 'invMoves' }),
    provideIcons({
      tablerArrowBackUp,
      tablerAlertTriangle,
      tablerExternalLink,
      tablerListDetails,
    }),
  ],
  templateUrl: './reverse-modal.html',
})
export class ReverseModal {
  private static nextId = 0;
  protected readonly uid = `reverse-modal-${++ReverseModal.nextId}`;

  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('dialog');
  private readonly warningAlert = viewChild.required<Modal>('warningAlert');
  private readonly conflictDialog = viewChild.required<InventoryConflict>('conflictDialog');
  private readonly reasonPicker = viewChild(TradeReasonPicker);

  readonly movement = input<LedgerEntry | null>(null);

  /** The raw records the reverse endpoint returns; the host re-fetches read projections for display. */
  readonly reversed = output<MovementSourceRecord>();
  readonly closed = output<void>();
  readonly openDecision = output<string>();
  readonly forbidden = output<void>();

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly isOpen = signal(false);
  protected readonly activeEntry = signal<LedgerEntry | null>(null);
  protected readonly sourceKind = signal<'RECEIPT' | 'DELIVERY'>('RECEIPT');
  protected readonly source = signal<MovementSource | null>(null);
  protected readonly loadingSource = signal(false);
  protected readonly sourceLoadFailed = signal(false);
  protected readonly sourceErrorKey = signal('tradeInventory.errors.generic');

  protected readonly reason = signal<ReasonPickerValue>(emptyReason());
  protected readonly effectiveDate = signal<string | null>(null);
  protected readonly effectiveTime = signal<string | null>(null);
  protected readonly reverseAllRemaining = signal(true);
  protected readonly lineQtyInputs = signal<Record<string, string>>({});
  protected readonly lineSerialSelections = signal<Record<string, readonly string[]>>({});
  protected readonly lineTouched = signal<Record<string, boolean>>({});

  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly dateTouched = signal(false);
  private readonly serverDateError = signal<string | null>(null);
  protected readonly serverReasonError = signal<string | null>(null);
  private readonly serverLineQtyErrors = signal<Record<string, TranslatedError>>({});
  private readonly serverLineSerialErrors = signal<Record<string, TranslatedError>>({});

  protected readonly warningMessage = signal('');
  protected readonly warningDecisionId = signal<string | null>(null);

  private readonly loadedReasons = signal<readonly ReasonCode[]>([]);

  private idempotencyKey = '';
  private sourceSeq = 0;
  private reasonsSeq = 0;
  private suppressClosed = false;
  private destroyed = false;

  protected readonly pickerValid = computed(() => this.reasonPicker()?.valid() ?? false);

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const key =
      this.sourceKind() === 'DELIVERY' ? 'invMoves.reverse.titleDelivery' : 'invMoves.reverse.titleReceipt';
    return this.transloco.translate(key);
  });

  protected readonly modalSubtitle = computed(() => {
    const docNum = this.source()?.documentNumber || this.activeEntry()?.sourceNumber || '';
    return docNum ? `\u2066${docNum}\u2069` : '';
  });

  protected readonly reversibleLines = computed<ReversibleLineView[]>(() => {
    const src = this.source();
    if (!src) return [];
    const views: ReversibleLineView[] = [];
    for (const line of src.lines) {
      // Reversal line quantities are in the document's own unit (line.uomId), not the base unit.
      const totalMicros = toMicros(line.quantity);
      const reversedMicros = toMicros(line.reversedQuantity);
      const remainingMicros = totalMicros - reversedMicros;
      if (remainingMicros <= 0n) continue;

      const allSerials = line.tracking.serialKeys ?? [];
      const reversedSet = new Set(line.reversedSerialKeys);
      const eligibleSerials = allSerials.filter((sk) => !reversedSet.has(sk));

      views.push({
        line,
        remainingMicros,
        remainingText: fromMicros(remainingMicros),
        isSerialized: allSerials.length > 0,
        eligibleSerials,
      });
    }
    return views;
  });

  private readonly clientDateError = computed<string | null>(() => {
    this.i18n();
    if (!fromLocalDateAndTime(this.effectiveDate(), this.effectiveTime())) {
      return this.transloco.translate('invMoves.reverse.errors.dateInvalid');
    }
    return null;
  });

  protected readonly effectiveAtError = computed(() => {
    const server = this.serverDateError();
    if (server) return server;
    if (!this.submitted() && !this.dateTouched()) return null;
    return this.clientDateError();
  });

  private readonly lineValidation = computed(() => {
    const qtyErrors: Record<string, TranslatedError> = {};
    const serialErrors: Record<string, TranslatedError> = {};
    const lines = this.reversibleLines();
    if (this.reverseAllRemaining() || lines.length === 0) {
      return { qtyErrors, serialErrors, positiveCount: lines.length };
    }

    const qtyMap = this.lineQtyInputs();
    const serialMap = this.lineSerialSelections();
    let positiveCount = 0;

    for (const item of lines) {
      const id = item.line.id;
      const raw = (qtyMap[id] ?? '').trim();
      const picked = serialMap[id] ?? [];

      if (!raw) {
        if (item.isSerialized && picked.length > 0) {
          serialErrors[id] = { key: 'invMoves.reverse.errors.serialClearWhenZero' };
        }
        continue;
      }

      if (!DECIMAL_PATTERN.test(raw)) {
        qtyErrors[id] = { key: 'invMoves.reverse.errors.quantityInvalid' };
        continue;
      }

      const micros = toMicros(raw);
      if (micros === 0n) {
        if (item.isSerialized && picked.length > 0) {
          serialErrors[id] = { key: 'invMoves.reverse.errors.serialClearWhenZero' };
        }
        continue;
      }

      if (micros > item.remainingMicros) {
        qtyErrors[id] = {
          key: 'invMoves.reverse.errors.quantityExceeds',
          params: { n: formatQuantity(item.remainingText, this.language()) },
        };
        continue;
      }

      if (item.isSerialized) {
        const whole = parseWholePositive(raw);
        if (whole === null) {
          qtyErrors[id] = { key: 'invMoves.reverse.errors.quantityWhole' };
          continue;
        }
        positiveCount += 1;
        if (picked.length !== whole) {
          serialErrors[id] = {
            key: 'invMoves.reverse.errors.serialCountMismatch',
            params: { count: whole },
          };
        }
      } else {
        positiveCount += 1;
      }
    }

    if (positiveCount === 0 && Object.keys(qtyErrors).length === 0 && lines.length > 0) {
      qtyErrors[lines[0].line.id] = { key: 'invMoves.reverse.errors.atLeastOneLine' };
    }

    return { qtyErrors, serialErrors, positiveCount };
  });

  protected readonly submitDisabled = computed(() => {
    if (this.submitting() || this.loadingSource() || this.sourceLoadFailed()) return true;
    if (!this.source() || this.reversibleLines().length === 0) return true;
    return !this.pickerValid();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.sourceSeq += 1;
      this.reasonsSeq += 1;
    });
  }

  open(entry?: LedgerEntry): void {
    const target = entry ?? this.movement();
    if (!target || !target.sourceId) return;
    const kind = resolveSourceKind(target);
    if (!kind) return;

    const now = toLocalDateAndTime(new Date());
    this.activeEntry.set(target);
    this.sourceKind.set(kind);
    this.source.set(null);
    this.sourceLoadFailed.set(false);
    this.loadingSource.set(true);

    this.reason.set(emptyReason());
    this.effectiveDate.set(now.date);
    this.effectiveTime.set(now.time);
    this.reverseAllRemaining.set(true);
    this.lineQtyInputs.set({});
    this.lineSerialSelections.set({});
    this.lineTouched.set({});

    this.submitted.set(false);
    this.submitting.set(false);
    this.dateTouched.set(false);
    this.serverDateError.set(null);
    this.serverReasonError.set(null);
    this.serverLineQtyErrors.set({});
    this.serverLineSerialErrors.set({});
    this.warningMessage.set('');
    this.warningDecisionId.set(null);

    this.idempotencyKey = newIdempotencyKey();
    this.isOpen.set(true);
    this.modal().open();

    void this.loadReversalReasons();
    void this.loadSource(kind, target.sourceId);
  }

  close(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  closeSilently(): void {
    this.sourceSeq += 1;
    this.reasonsSeq += 1;
    this.suppressClosed = true;
    try {
      this.modal().close();
    } finally {
      this.suppressClosed = false;
    }
  }

  protected reloadSource(): void {
    const target = this.activeEntry();
    if (!target?.sourceId) return;
    this.sourceLoadFailed.set(false);
    this.loadingSource.set(true);
    void this.loadSource(this.sourceKind(), target.sourceId);
  }

  protected onModalClosed(): void {
    if (!this.suppressClosed && this.submitting()) {
      this.modal().open();
      return;
    }
    this.sourceSeq += 1;
    this.reasonsSeq += 1;
    this.isOpen.set(false);
    if (!this.suppressClosed) {
      this.closed.emit();
    }
  }

  protected onReasonChange(next: ReasonPickerValue): void {
    this.reason.set(next);
    this.serverReasonError.set(null);
  }

  protected onEffectiveDateChange(value: string | null): void {
    if (this.submitting()) return;
    this.effectiveDate.set(value);
    this.dateTouched.set(true);
    this.serverDateError.set(null);
  }

  protected onEffectiveTimeChange(value: string | null): void {
    if (this.submitting()) return;
    this.effectiveTime.set(value);
    this.dateTouched.set(true);
    this.serverDateError.set(null);
  }

  protected onReverseAllChange(checked: boolean): void {
    if (this.submitting()) return;
    this.reverseAllRemaining.set(checked);
    this.serverLineQtyErrors.set({});
    this.serverLineSerialErrors.set({});
  }

  protected lineQuantityValue(lineId: string): string {
    return this.lineQtyInputs()[lineId] ?? '';
  }

  protected onLineQuantityInput(lineId: string, event: Event): void {
    if (this.submitting()) return;
    const nextVal = (event.target as HTMLInputElement).value;
    this.lineQtyInputs.update((prev) => ({ ...prev, [lineId]: nextVal }));
    this.clearLineServerErrors(lineId);
  }

  protected markLineTouched(lineId: string): void {
    this.lineTouched.update((prev) => (prev[lineId] ? prev : { ...prev, [lineId]: true }));
  }

  protected pickedSerials(lineId: string): readonly string[] {
    return this.lineSerialSelections()[lineId] ?? [];
  }

  protected isSerialPicked(lineId: string, serialKey: string): boolean {
    return this.pickedSerials(lineId).includes(serialKey);
  }

  protected toggleSerial(lineId: string, serialKey: string, checked: boolean): void {
    if (this.submitting()) return;
    this.lineTouched.update((prev) => (prev[lineId] ? prev : { ...prev, [lineId]: true }));
    this.lineSerialSelections.update((prev) => {
      const current = prev[lineId] ?? [];
      const next = checked
        ? current.includes(serialKey)
          ? current
          : [...current, serialKey]
        : current.filter((item) => item !== serialKey);
      return { ...prev, [lineId]: next };
    });
    this.clearLineServerErrors(lineId);
  }

  protected lineExpectedSerialCount(item: ReversibleLineView): number {
    if (!item.isSerialized) return 0;
    const raw = this.lineQuantityValue(item.line.id);
    return parseWholePositive(raw) ?? 0;
  }

  protected lineQuantityLabel(item: ReversibleLineView): string {
    this.i18n();
    const lang = this.language();
    const name = itemName(item.line.itemNames, lang);
    const itemLabel = name ? `\u2066${item.line.itemCode}\u2069 — ${name}` : item.line.itemCode;
    const rem = `${formatQuantity(item.remainingText, lang)} ${item.line.uomCode}`;
    return this.transloco.translate('invMoves.reverse.lineQtyLabel', {
      item: itemLabel,
      n: rem,
    });
  }

  protected lineQuantityError(item: ReversibleLineView): string | null {
    this.i18n();
    const server = this.serverLineQtyErrors()[item.line.id];
    if (server) {
      return this.transloco.translate(server.key, server.params);
    }
    if (!this.submitted() && !this.lineTouched()[item.line.id]) return null;
    const client = this.lineValidation().qtyErrors[item.line.id];
    return client ? this.transloco.translate(client.key, client.params) : null;
  }

  protected lineSerialsError(item: ReversibleLineView): string | null {
    this.i18n();
    const server = this.serverLineSerialErrors()[item.line.id];
    if (server) {
      return this.transloco.translate(server.key, server.params);
    }
    const client = this.lineValidation().serialErrors[item.line.id];
    if (!client) return null;
    if (!this.submitted()) {
      const expected = this.lineExpectedSerialCount(item);
      const picked = this.pickedSerials(item.line.id).length;
      if (picked <= expected) return null;
    }
    return this.transloco.translate(client.key, client.params);
  }

  protected describedBy(suffix: string, hasError: boolean): string {
    const hintId = `${this.uid}-${suffix}-hint`;
    return hasError ? `${hintId} ${this.uid}-${suffix}-error` : hintId;
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.submitting() || this.loadingSource() || this.sourceLoadFailed()) return;

    const src = this.source();
    if (!src || this.reversibleLines().length === 0) return;

    this.submitted.set(true);
    this.serverDateError.set(null);
    this.serverReasonError.set(null);
    this.serverLineQtyErrors.set({});
    this.serverLineSerialErrors.set({});

    if (!this.pickerValid()) return;
    const effective = fromLocalDateAndTime(this.effectiveDate(), this.effectiveTime());
    if (!effective) return;

    if (!this.reverseAllRemaining()) {
      const validation = this.lineValidation();
      if (
        Object.keys(validation.qtyErrors).length > 0 ||
        Object.keys(validation.serialErrors).length > 0 ||
        validation.positiveCount === 0
      ) {
        return;
      }
    }

    const reasonCodeId = this.reason().reasonCodeId;
    if (!reasonCodeId) return;

    this.submitting.set(true);
    try {
      const reasonCode = await this.resolveReasonCode(reasonCodeId);
      if (this.destroyed || !this.isOpen()) return;
      if (!reasonCode) {
        this.serverReasonError.set(
          this.transloco.translate('tradeInventory.errors.TRADE_REASON_NOT_FOUND'),
        );
        return;
      }

      const body: ReverseMovementInput = {
        reasonCode,
        businessEffectiveAt: effective.toISOString(),
      };

      if (!this.reverseAllRemaining()) {
        const lines: NonNullable<ReverseMovementInput['lines']> = [];
        for (const item of this.reversibleLines()) {
          const raw = this.lineQuantityValue(item.line.id).trim();
          if (!raw || toMicros(raw) <= 0n) continue;
          if (item.isSerialized) {
            lines.push({
              lineId: item.line.id,
              quantity: raw,
              serialKeys: [...this.pickedSerials(item.line.id)],
            });
          } else {
            lines.push({
              lineId: item.line.id,
              quantity: raw,
            });
          }
        }
        body.lines = lines;
      }

      const updated = await reverseMovementSource(
        this.sourceKind(),
        src.id,
        src.version,
        body,
        this.idempotencyKey,
        tradeContext(this.scope, 'BRANCH'),
      );
      if (this.destroyed || !this.isOpen()) return;

      this.submitting.set(false);
      this.notify.success(this.transloco.translate('invMoves.reverse.recorded'));
      this.reversed.emit(updated);
      this.modal().close();
    } catch (error) {
      if (this.destroyed || !this.isOpen()) return;
      this.submitting.set(false);
      this.handleSubmitError(error);
    } finally {
      if (!this.destroyed) {
        this.submitting.set(false);
      }
    }
  }

  protected async onConflictReload(): Promise<void> {
    const target = this.activeEntry();
    if (!target?.sourceId) return;
    this.idempotencyKey = newIdempotencyKey();
    this.serverDateError.set(null);
    this.serverReasonError.set(null);
    this.serverLineQtyErrors.set({});
    this.serverLineSerialErrors.set({});
    this.loadingSource.set(true);
    this.sourceLoadFailed.set(false);
    await this.loadSource(this.sourceKind(), target.sourceId);
  }

  protected closeWarningAlert(): void {
    this.warningAlert().close();
  }

  protected onOpenWarningDecision(): void {
    const decisionId = this.warningDecisionId();
    this.warningAlert().close();
    if (!decisionId) return;
    this.closeSilently();
    this.openDecision.emit(decisionId);
  }

  private clearLineServerErrors(lineId: string): void {
    this.serverLineQtyErrors.update((prev) => {
      if (!prev[lineId]) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    this.serverLineSerialErrors.update((prev) => {
      if (!prev[lineId]) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  private handleSubmitError(error: unknown): void {
    if (isForbiddenError(error)) {
      this.closeSilently();
      this.forbidden.emit();
      return;
    }

    const code = errorCodeOf(error);

    if (code === 'TRADE.INVENTORY.PERIOD_CONFLICT') {
      this.serverDateError.set(this.transloco.translate(errorKey(error)));
      return;
    }

    if (
      code === 'TRADE.REASON.NOT_FOUND' ||
      code === 'TRADE.REASON.INACTIVE' ||
      code === 'TRADE.REASON.KIND_INVALID'
    ) {
      this.serverReasonError.set(this.transloco.translate(errorKey(error)));
      return;
    }

    if (code === 'TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY') {
      const lines = this.reversibleLines();
      if (lines.length > 0) {
        if (this.reverseAllRemaining()) {
          this.reverseAllRemaining.set(false);
        }
        const errMap: Record<string, TranslatedError> = {};
        for (const item of lines) {
          const raw = this.lineQuantityValue(item.line.id).trim();
          if (!raw || toMicros(raw) > 0n) {
            errMap[item.line.id] = { key: errorKey(error) };
          }
        }
        if (Object.keys(errMap).length === 0) {
          errMap[lines[0].line.id] = { key: errorKey(error) };
        }
        this.serverLineQtyErrors.set(errMap);
        return;
      }
    }

    if (code === 'TRADE.INVENTORY.ITEM_TRACKING_CONFLICT') {
      const lines = this.reversibleLines();
      if (lines.length > 0) {
        if (this.reverseAllRemaining()) {
          this.reverseAllRemaining.set(false);
        }
        const serialized = lines.filter((item) => item.isSerialized);
        const targets = serialized.length > 0 ? serialized : lines;
        const errMap: Record<string, TranslatedError> = {};
        for (const item of targets) {
          const raw = this.lineQuantityValue(item.line.id).trim();
          if (!raw || toMicros(raw) > 0n) {
            errMap[item.line.id] = { key: errorKey(error) };
          }
        }
        if (Object.keys(errMap).length === 0) {
          errMap[targets[0].line.id] = { key: errorKey(error) };
        }
        if (serialized.length > 0) {
          this.serverLineSerialErrors.set(errMap);
        } else {
          this.serverLineQtyErrors.set(errMap);
        }
        return;
      }
    }

    if (code === 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED') {
      this.warningMessage.set(this.transloco.translate('invMoves.reverse.notAllowed'));
      this.warningDecisionId.set(null);
      this.warningAlert().open();
      return;
    }

    if (code === 'TRADE.INVENTORY.POLICY_REJECTED') {
      this.warningMessage.set(this.transloco.translate(errorKey(error)));
      this.warningDecisionId.set(error instanceof ApiError ? extractDecisionId(error) : null);
      this.warningAlert().open();
      return;
    }

    if (code === 'TRADE.INVENTORY.TRACKING_REQUIRED') {
      const serialized = this.reversibleLines().filter((item) => item.isSerialized);
      if (serialized.length > 0) {
        if (this.reverseAllRemaining()) {
          this.reverseAllRemaining.set(false);
        }
        const errMap: Record<string, TranslatedError> = {};
        for (const item of serialized) {
          const raw = this.lineQuantityValue(item.line.id).trim();
          if (this.reverseAllRemaining() || !raw || toMicros(raw) > 0n) {
            errMap[item.line.id] = { key: errorKey(error) };
          }
        }
        if (Object.keys(errMap).length === 0) {
          errMap[serialized[0].line.id] = { key: errorKey(error) };
        }
        this.serverLineSerialErrors.set(errMap);
        return;
      }
    }

    if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
      this.conflictDialog().open();
      return;
    }

    if (code === 'TRADE.VALIDATION_FAILED' && error instanceof ApiError && error.details) {
      if (error.details['businessEffectiveAt']) {
        this.serverDateError.set(this.transloco.translate('invMoves.reverse.errors.dateInvalid'));
        return;
      }
    }

    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private async resolveReasonCode(reasonCodeId: string): Promise<string | null> {
    const cached = this.loadedReasons().find((r) => r.id === reasonCodeId);
    if (cached) return cached.code;
    const fresh = await listReasons('INVENTORY_REVERSAL', undefined, tradeContext(this.scope, 'COMPANY'));
    if (this.destroyed || !this.isOpen()) return null;
    this.loadedReasons.set(fresh);
    return fresh.find((r) => r.id === reasonCodeId)?.code ?? null;
  }

  private async loadReversalReasons(): Promise<void> {
    const seq = ++this.reasonsSeq;
    try {
      const rows = await listReasons('INVENTORY_REVERSAL', undefined, tradeContext(this.scope, 'COMPANY'));
      if (this.destroyed || seq !== this.reasonsSeq || !this.isOpen()) return;
      this.loadedReasons.set(rows);
    } catch {
      if (this.destroyed || seq !== this.reasonsSeq) return;
      this.loadedReasons.set([]);
    }
  }

  private async loadSource(kind: 'RECEIPT' | 'DELIVERY', sourceId: string): Promise<void> {
    const seq = ++this.sourceSeq;
    try {
      const src = await getMovementSource(kind, sourceId, tradeContext(this.scope, 'BRANCH'));
      if (this.destroyed || seq !== this.sourceSeq || !this.isOpen()) return;
      this.source.set(src);
      this.sourceKind.set(src.kind);
      this.loadingSource.set(false);
    } catch (error) {
      if (this.destroyed || seq !== this.sourceSeq || !this.isOpen()) return;
      this.loadingSource.set(false);
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
      this.sourceErrorKey.set(errorKey(error));
      this.sourceLoadFailed.set(true);
    }
  }
}
