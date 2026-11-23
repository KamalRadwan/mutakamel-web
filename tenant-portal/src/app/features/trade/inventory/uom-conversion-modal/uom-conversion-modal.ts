import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange, tablerCheck, tablerCopy, tablerEqual } from '@ng-icons/tabler-icons';
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
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { TradeItemPicker } from '../../shared/pickers/item-picker/item-picker';
import { type TradeContext, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { getItem, listReasons, listReferenceData, listUoms } from '../../shared/trade-foundation.api';
import type { ItemDetail, ItemKind, Owner, ReasonCode, Uom } from '../../shared/trade-foundation.model';
import { createUomConversion, listUomConversions } from '../inventory.api';
import {
  type CreateUomConversionBody,
  FACTOR_PATTERN,
  type UomConversionRevision,
} from '../inventory.model';
import {
  convertPreview,
  errorKey,
  errorReason,
  factorText,
  formatDateTime,
  formatQuantity,
  isForbiddenError,
  itemName,
  shortId,
} from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';

type ModalMode = 'create' | 'view';
type FieldErrorKey = 'item' | 'fromUnit' | 'numerator' | 'denominator' | 'effectiveFrom';

interface ConversionPreview {
  from: string;
  to: string;
  factor: string;
  ten: string;
  exact: boolean;
}

const SCALE = 100_000_000n;
const PRODUCT_KINDS: readonly ItemKind[] = ['PRODUCT'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localNowParts(): { date: string; time: string } {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  };
}

function localPartsToUtcIso(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const dt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hours ||
    dt.getMinutes() !== minutes
  ) {
    return null;
  }
  return dt.toISOString();
}

function isolateCode(code: string | null | undefined, name: string): string {
  const cleanCode = code?.trim() ?? '';
  if (!cleanCode && !name) return '—';
  if (!cleanCode) return name;
  if (!name || name === cleanCode) return cleanCode;
  return `\u2066${cleanCode}\u2069 — ${name}`;
}

function approxTenBigInt(num: string, den: string): string {
  const n = BigInt(num.trim());
  const d = BigInt(den.trim());
  const rounded = (10n * n * SCALE + d / 2n) / d;
  const intPart = rounded / SCALE;
  const fracPart = (rounded % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  const intFormatted = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${intFormatted}.${fracPart}` : intFormatted;
}

@Component({
  selector: 'app-uom-conversion-modal',
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
    SettingsNotice,
    TradeItemPicker,
    InventoryBadge,
  ],
  providers: [provideIcons({ tablerArrowsExchange, tablerCheck, tablerCopy, tablerEqual })],
  templateUrl: './uom-conversion-modal.html',
})
export class UomConversionModal {
  private static nextId = 0;
  protected readonly uid = `uom-conversion-modal-${++UomConversionModal.nextId}`;

  private readonly language = inject(LanguageState).current;
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('dialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canGovern = input(true);

  readonly created = output<UomConversionRevision>();
  readonly publishRequested = output<UomConversionRevision>();
  readonly retireRequested = output<UomConversionRevision>();
  readonly closed = output<void>();
  readonly forbidden = output<void>();

  protected readonly productKinds = PRODUCT_KINDS;
  protected readonly companyCtx = computed<TradeContext>(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly mode = signal<ModalMode>('create');
  protected readonly viewing = signal<UomConversionRevision | null>(null);
  private readonly isPrefillRevision = signal(false);

  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly itemDetail = signal<ItemDetail | null>(null);
  protected readonly loadingItem = signal(false);
  protected readonly fromUomId = signal('');
  protected readonly factorNumerator = signal('');
  protected readonly factorDenominator = signal('1');
  protected readonly effectiveDate = signal<string | null>(null);
  protected readonly effectiveTime = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly touched = signal<Partial<Record<FieldErrorKey, boolean>>>({});
  protected readonly serverErrors = signal<Partial<Record<FieldErrorKey, string>>>({});
  protected readonly publishedPredecessor = signal<UomConversionRevision | null>(null);
  protected readonly copiedId = signal(false);

  private readonly uoms = signal<Uom[]>([]);
  private readonly publishReasons = signal<ReasonCode[]>([]);
  private readonly retireReasons = signal<ReasonCode[]>([]);
  private readonly owners = signal<Owner[]>([]);

  private readonly initialSnapshot = signal('');
  private itemLoadSeq = 0;
  private predecessorSeq = 0;
  private lookupsSeq = 0;
  private pendingPrefillFromUomId: string | null = null;
  private capturePrefillSnapshot = false;
  private allowClose = false;
  private confirmingDiscard = false;
  private lastSubmitFingerprint = '';
  private lastIdempotencyKey = '';
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly uomById = computed(() => {
    const map = new Map<string, Uom>();
    for (const uom of this.uoms()) {
      map.set(uom.id, uom);
    }
    return map;
  });

  private readonly candidateFromUomIds = computed<string[]>(() => {
    const detail = this.itemDetail();
    if (!detail?.companyProfile) return [];
    const baseId = detail.baseUomId;
    const ids: string[] = [];
    for (const candidate of [detail.companyProfile.defaultSalesUomId, detail.companyProfile.defaultPurchaseUomId]) {
      if (candidate && candidate !== baseId && !ids.includes(candidate)) {
        ids.push(candidate);
      }
    }
    return ids;
  });

  protected readonly itemNotStockTracked = computed(() => {
    const detail = this.itemDetail();
    return Boolean(detail && (!detail.companyProfile || !detail.companyProfile.trackInventory));
  });

  protected readonly noOtherUnits = computed(() => {
    const detail = this.itemDetail();
    return Boolean(detail && detail.companyProfile?.trackInventory && this.candidateFromUomIds().length === 0);
  });

  protected readonly fromUnitOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const map = this.uomById();
    const candidates = this.candidateFromUomIds();
    if (candidates.length === 0) {
      return [{ value: '', label: this.transloco.translate('tradeInventory.common.none'), disabled: true }];
    }
    const opts: DropdownOption<string>[] = candidates.map((id) => {
      const uom = map.get(id);
      const label = uom ? isolateCode(uom.code, itemName(uom.localizedNames, lang) || uom.displayName) : id;
      return { value: id, label };
    });
    if (!this.fromUomId()) {
      return [
        { value: '', label: this.transloco.translate('invUom.modal.selectFromUnit'), disabled: true },
        ...opts,
      ];
    }
    return opts;
  });

  protected readonly baseUnitLabel = computed(() => {
    this.i18n();
    const detail = this.itemDetail();
    if (!detail) return '';
    const uom = this.uomById().get(detail.baseUomId);
    if (!uom) return detail.baseUomId;
    return isolateCode(uom.code, itemName(uom.localizedNames, this.language()) || uom.displayName);
  });

  protected readonly noOtherUnitsNote = computed<string | null>(() => {
    this.i18n();
    if (!this.noOtherUnits()) return null;
    return this.transloco.translate('invUom.modal.noOtherUnits');
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'view') {
      return this.transloco.translate('invUom.modal.viewTitle', { n: this.viewing()?.revisionNumber ?? '' });
    }
    return this.transloco.translate(this.isPrefillRevision() ? 'invUom.modal.newRevisionTitle' : 'invUom.modal.newTitle');
  });

  protected readonly modalSubtitle = computed(() => {
    const rev = this.viewing();
    if (this.mode() !== 'view' || !rev) return '';
    const name = itemName(rev.itemNames, this.language());
    const display = isolateCode(rev.itemCode, name);
    return display === '—' ? '' : display;
  });

  protected readonly itemError = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const serverKey = this.serverErrors().item;
    if (serverKey) return this.transloco.translate(serverKey);
    if (this.itemNotStockTracked()) {
      return this.transloco.translate('invUom.validation.itemNotStockTracked');
    }
    if ((this.submitted() || this.touched().item) && !this.selectedItemId()) {
      return this.transloco.translate('tradeShared.common.required');
    }
    return null;
  });

  protected readonly fromUnitError = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const serverKey = this.serverErrors().fromUnit;
    if (serverKey) return this.transloco.translate(serverKey);
    if (this.noOtherUnits() || this.itemNotStockTracked()) return null;
    if ((this.submitted() || this.touched().fromUnit) && !this.fromUomId()) {
      return this.transloco.translate('tradeShared.common.required');
    }
    return null;
  });

  protected readonly numeratorError = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const serverKey = this.serverErrors().numerator;
    if (serverKey) return this.transloco.translate(serverKey);
    if (!(this.submitted() || this.touched().numerator)) return null;
    const trimmed = this.factorNumerator().trim();
    if (!trimmed) return this.transloco.translate('tradeShared.common.required');
    if (!FACTOR_PATTERN.test(trimmed)) return this.transloco.translate('invUom.validation.positiveInteger');
    return null;
  });

  protected readonly denominatorError = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const serverKey = this.serverErrors().denominator;
    if (serverKey) return this.transloco.translate(serverKey);
    if (!(this.submitted() || this.touched().denominator)) return null;
    const trimmed = this.factorDenominator().trim();
    if (!trimmed) return this.transloco.translate('tradeShared.common.required');
    if (!FACTOR_PATTERN.test(trimmed)) return this.transloco.translate('invUom.validation.positiveInteger');
    return null;
  });

  protected readonly effectiveFromError = computed<string | null>(() => {
    this.i18n();
    if (this.mode() !== 'create') return null;
    const serverKey = this.serverErrors().effectiveFrom;
    if (serverKey) return this.transloco.translate(serverKey);
    if (!(this.submitted() || this.touched().effectiveFrom)) return null;
    if (!this.effectiveDate() || !this.effectiveTime()) {
      return this.transloco.translate('tradeShared.common.required');
    }
    if (!localPartsToUtcIso(this.effectiveDate(), this.effectiveTime())) {
      return this.transloco.translate('invUom.validation.invalidDate');
    }
    return null;
  });

  protected readonly itemDescribedBy = computed(() => {
    const hint = `${this.uid}-item-hint`;
    return this.itemError() ? `${hint} ${this.uid}-item-error` : hint;
  });

  protected readonly fromUnitDescribedBy = computed(() => {
    const hint = `${this.uid}-from-uom-hint`;
    return this.fromUnitError() ? `${hint} ${this.uid}-from-uom-error` : hint;
  });

  protected readonly effectiveDescribedBy = computed(() => {
    const hint = `${this.uid}-effective-hint`;
    return this.effectiveFromError() ? `${hint} ${this.uid}-effective-error` : hint;
  });

  protected readonly preview = computed<ConversionPreview | null>(() => {
    const lang = this.language();
    const map = this.uomById();

    let fromId: string | null = null;
    let fromFallback = '';
    let toId: string | null = null;
    let toFallback = '';
    let num = '';
    let den = '';

    if (this.mode() === 'view') {
      const rev = this.viewing();
      if (!rev) return null;
      fromId = rev.fromUomId;
      fromFallback = rev.fromUomCode ?? '';
      toId = rev.toUomId;
      toFallback = rev.toUomCode ?? '';
      num = rev.factorNumerator;
      den = rev.factorDenominator;
    } else {
      const detail = this.itemDetail();
      fromId = this.fromUomId() || null;
      toId = detail?.baseUomId ?? null;
      num = this.factorNumerator().trim();
      den = this.factorDenominator().trim();
    }

    if (!fromId || !toId || !FACTOR_PATTERN.test(num) || !FACTOR_PATTERN.test(den)) {
      return null;
    }

    const fromUom = map.get(fromId);
    const toUom = map.get(toId);
    const fromLabel = fromUom
      ? itemName(fromUom.localizedNames, lang) || fromUom.displayName || fromUom.code
      : fromFallback || fromId;
    const toLabel = toUom
      ? itemName(toUom.localizedNames, lang) || toUom.displayName || toUom.code
      : toFallback || toId;

    const rawFactor = factorText(num, den);
    const factor = rawFactor.includes('/') ? rawFactor : formatQuantity(rawFactor, lang);
    const tenRaw = convertPreview('10', num, den);
    const exact = tenRaw !== null;
    const ten = exact ? formatQuantity(tenRaw, lang) : approxTenBigInt(num, den);

    return {
      from: fromLabel,
      to: toLabel,
      factor: `\u2066${factor}\u2069`,
      ten: `\u2066${ten}\u2069`,
      exact,
    };
  });

  private readonly dirty = computed(() => {
    if (this.mode() !== 'create') return false;
    return this.snapshot() !== this.initialSnapshot();
  });

  constructor() {
    effect(() => {
      if (this.mode() !== 'create') {
        untracked(() => this.publishedPredecessor.set(null));
        return;
      }
      const detail = this.itemDetail();
      const profileId = detail?.companyProfile?.id;
      const fromId = this.fromUomId();
      const toId = detail?.baseUomId;
      if (!profileId || !fromId || !toId || fromId === toId) {
        untracked(() => this.publishedPredecessor.set(null));
        return;
      }
      untracked(() => void this.loadPublishedPredecessor(profileId, fromId, toId));
    });

    this.destroyRef.onDestroy(() => {
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });
  }

  openCreate(prefill?: UomConversionRevision): void {
    const now = localNowParts();
    this.itemLoadSeq++;
    this.predecessorSeq++;
    this.mode.set('create');
    this.viewing.set(null);
    this.isPrefillRevision.set(Boolean(prefill));
    this.submitted.set(false);
    this.touched.set({});
    this.serverErrors.set({});
    this.saving.set(false);
    this.publishedPredecessor.set(null);
    this.effectiveDate.set(now.date);
    this.effectiveTime.set(now.time);
    this.allowClose = false;
    this.lastSubmitFingerprint = '';
    this.lastIdempotencyKey = '';

    if (prefill) {
      this.selectedItemId.set(prefill.itemId ?? null);
      this.itemDetail.set(null);
      this.fromUomId.set('');
      this.factorNumerator.set(prefill.factorNumerator);
      this.factorDenominator.set(prefill.factorDenominator);
      this.pendingPrefillFromUomId = prefill.fromUomId;
      this.capturePrefillSnapshot = true;
      this.initialSnapshot.set(this.snapshot());
      if (prefill.itemId) {
        void this.loadItemDetail(prefill.itemId);
      } else {
        this.loadingItem.set(false);
      }
    } else {
      this.selectedItemId.set(null);
      this.itemDetail.set(null);
      this.loadingItem.set(false);
      this.fromUomId.set('');
      this.factorNumerator.set('');
      this.factorDenominator.set('1');
      this.pendingPrefillFromUomId = null;
      this.capturePrefillSnapshot = false;
      this.initialSnapshot.set(this.snapshot());
    }

    void this.loadUomLookup();
    this.modal().open();
  }

  openView(revision: UomConversionRevision): void {
    this.itemLoadSeq++;
    this.predecessorSeq++;
    this.mode.set('view');
    this.viewing.set(revision);
    this.isPrefillRevision.set(false);
    this.submitted.set(false);
    this.touched.set({});
    this.serverErrors.set({});
    this.saving.set(false);
    this.copiedId.set(false);
    this.allowClose = false;

    void this.loadViewLookups();
    this.modal().open();
  }

  updateViewing(revision: UomConversionRevision): void {
    if (this.mode() === 'view' && this.viewing()?.id === revision.id) {
      this.viewing.set(revision);
    }
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onItemSelected(itemId: string | null): void {
    if (this.saving()) return;
    this.capturePrefillSnapshot = false;
    this.pendingPrefillFromUomId = null;
    this.selectedItemId.set(itemId);
    this.touched.update((prev) => ({ ...prev, item: true }));
    this.clearServerErrors('item', 'fromUnit');
    this.publishedPredecessor.set(null);
    this.fromUomId.set('');

    if (!itemId) {
      this.itemLoadSeq++;
      this.loadingItem.set(false);
      this.itemDetail.set(null);
      return;
    }

    void this.loadItemDetail(itemId);
  }

  protected onFromUomChange(next: string): void {
    if (this.saving()) return;
    this.capturePrefillSnapshot = false;
    this.fromUomId.set(next);
    this.touched.update((prev) => ({ ...prev, fromUnit: true }));
    this.clearServerErrors('fromUnit');
  }

  protected onFactorInput(field: 'numerator' | 'denominator', event: Event): void {
    if (this.saving()) return;
    this.capturePrefillSnapshot = false;
    const value = (event.target as HTMLInputElement).value;
    if (field === 'numerator') {
      this.factorNumerator.set(value);
    } else {
      this.factorDenominator.set(value);
    }
    this.clearServerErrors(field);
  }

  protected onEffectiveDateChange(next: string | null): void {
    this.capturePrefillSnapshot = false;
    this.effectiveDate.set(next);
    this.touched.update((prev) => ({ ...prev, effectiveFrom: true }));
    this.clearServerErrors('effectiveFrom');
  }

  protected onEffectiveTimeChange(next: string | null): void {
    this.capturePrefillSnapshot = false;
    this.effectiveTime.set(next);
    this.touched.update((prev) => ({ ...prev, effectiveFrom: true }));
    this.clearServerErrors('effectiveFrom');
  }

  protected markTouched(field: FieldErrorKey): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.mode() !== 'create' || this.saving() || this.loadingItem()) return;

    this.submitted.set(true);
    this.serverErrors.set({});

    const detail = this.itemDetail();
    const profile = detail?.companyProfile;
    const itemId = this.selectedItemId();
    const fromId = this.fromUomId();
    const num = this.factorNumerator().trim();
    const den = this.factorDenominator().trim();
    const effIso = localPartsToUtcIso(this.effectiveDate(), this.effectiveTime());

    if (
      !itemId ||
      !detail ||
      !profile ||
      !profile.trackInventory ||
      this.noOtherUnits() ||
      !fromId ||
      !FACTOR_PATTERN.test(num) ||
      !FACTOR_PATTERN.test(den) ||
      !effIso
    ) {
      return;
    }

    const body: CreateUomConversionBody = {
      itemCompanyProfileId: profile.id,
      fromUomId: fromId,
      toUomId: detail.baseUomId,
      factorNumerator: num,
      factorDenominator: den,
      effectiveFrom: effIso,
    };

    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastSubmitFingerprint || !this.lastIdempotencyKey) {
      this.lastSubmitFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createUomConversion(body, this.lastIdempotencyKey, this.companyCtx());
      this.lastSubmitFingerprint = '';
      this.lastIdempotencyKey = '';
      this.notify.success(this.transloco.translate('invUom.modal.created', { n: created.revisionNumber }));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(created);
    } catch (error) {
      this.handleCreateError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected requestPublishFromView(): void {
    const rev = this.viewing();
    if (!rev || !this.canGovern() || rev.status !== 'DRAFT') return;
    this.publishRequested.emit(rev);
  }

  protected requestRetireFromView(): void {
    const rev = this.viewing();
    if (!rev || !this.canGovern() || rev.status !== 'PUBLISHED') return;
    this.retireRequested.emit(rev);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty()) {
      await this.confirmDiscardAndClose();
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
    this.itemLoadSeq++;
    this.predecessorSeq++;
    this.viewing.set(null);
    this.itemDetail.set(null);
    this.selectedItemId.set(null);
    this.closed.emit();
  }

  protected viewItemDisplay(rev: UomConversionRevision): string {
    return isolateCode(rev.itemCode, itemName(rev.itemNames, this.language()));
  }

  protected viewUnitDisplay(uomId: string, code: string | null): string {
    const cleanCode = code?.trim() || '';
    const uom = this.uomById().get(uomId);
    if (!uom) return cleanCode || uomId || '—';
    return isolateCode(cleanCode || uom.code, itemName(uom.localizedNames, this.language()) || uom.displayName);
  }

  protected viewDateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  protected viewShortId(id: string): string {
    return shortId(id);
  }

  protected viewUser(userId: string | null): string {
    this.i18n();
    if (!userId) return this.transloco.translate('tradeInventory.common.none');
    const matched = this.owners().find((owner) => owner.id === userId);
    return matched?.name ?? userId;
  }

  protected viewReason(kind: 'INVENTORY_UOM_PUBLISH' | 'INVENTORY_UOM_RETIRE', code: string | null): string {
    this.i18n();
    if (!code) return this.transloco.translate('tradeInventory.common.none');
    const list = kind === 'INVENTORY_UOM_PUBLISH' ? this.publishReasons() : this.retireReasons();
    const matched = list.find((reason) => reason.code === code);
    if (!matched) return code;
    const lang = this.language();
    return matched.localizedNames[lang]?.trim() || matched.localizedNames['en']?.trim() || matched.code;
  }

  protected async copyRevisionId(id: string): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(id);
      this.copiedId.set(true);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => {
        this.copyTimer = null;
        this.copiedId.set(false);
      }, 1500);
    } catch {
      // Clipboard API unavailable in restricted contexts.
    }
  }

  private async loadItemDetail(itemId: string): Promise<void> {
    const seq = ++this.itemLoadSeq;
    this.loadingItem.set(true);
    try {
      const detail = await getItem(this.companyCtx(), itemId);
      if (seq !== this.itemLoadSeq || this.selectedItemId() !== itemId) return;
      this.itemDetail.set(detail);

      const candidates = this.candidateFromUomIds();
      const prefillId = this.pendingPrefillFromUomId;
      this.pendingPrefillFromUomId = null;

      if (prefillId && candidates.includes(prefillId)) {
        this.fromUomId.set(prefillId);
      } else if (candidates.length === 1) {
        this.fromUomId.set(candidates[0]);
      } else {
        this.fromUomId.set('');
      }

      if (this.capturePrefillSnapshot) {
        this.capturePrefillSnapshot = false;
        this.initialSnapshot.set(this.snapshot());
      }
    } catch (error) {
      if (seq !== this.itemLoadSeq) return;
      this.itemDetail.set(null);
      this.fromUomId.set('');
      this.pendingPrefillFromUomId = null;
      if (isForbiddenError(error)) {
        this.close();
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.itemLoadSeq) {
        this.loadingItem.set(false);
      }
    }
  }

  private async loadPublishedPredecessor(
    itemCompanyProfileId: string,
    fromUomId: string,
    toUomId: string,
  ): Promise<void> {
    const seq = ++this.predecessorSeq;
    try {
      const page = await listUomConversions(
        {
          itemCompanyProfileId,
          fromUomId,
          toUomId,
          status: 'PUBLISHED',
          page: 1,
          limit: 1,
        },
        this.companyCtx(),
      );
      if (seq !== this.predecessorSeq) return;
      this.publishedPredecessor.set(page.items[0] ?? null);
    } catch {
      if (seq !== this.predecessorSeq) return;
      this.publishedPredecessor.set(null);
    }
  }

  private async loadUomLookup(): Promise<void> {
    const seq = ++this.lookupsSeq;
    try {
      const rows = await listUoms(undefined, this.companyCtx());
      if (seq !== this.lookupsSeq) return;
      this.uoms.set(rows);
    } catch {
      // Non-blocking lookup; unit codes remain visible as fallback.
    }
  }

  private async loadViewLookups(): Promise<void> {
    const seq = ++this.lookupsSeq;
    const ctx = this.companyCtx();
    const [uomRes, pubRes, retRes, refRes] = await Promise.allSettled([
      listUoms(undefined, ctx),
      listReasons('INVENTORY_UOM_PUBLISH', { includeInactive: true }, ctx),
      listReasons('INVENTORY_UOM_RETIRE', { includeInactive: true }, ctx),
      listReferenceData(ctx),
    ]);
    if (seq !== this.lookupsSeq) return;
    if (uomRes.status === 'fulfilled') this.uoms.set(uomRes.value);
    if (pubRes.status === 'fulfilled') this.publishReasons.set(pubRes.value);
    if (retRes.status === 'fulfilled') this.retireReasons.set(retRes.value);
    if (refRes.status === 'fulfilled') this.owners.set(refRes.value.owners);
  }

  private handleCreateError(error: unknown): void {
    if (isForbiddenError(error)) {
      this.close();
      this.forbidden.emit();
      return;
    }
    const code = errorCodeOf(error);
    const reason = errorReason(error);
    if (reason === 'identity_not_required') {
      this.serverErrors.set({
        fromUnit: 'tradeInventory.errors.TRADE_INVENTORY_UOM_CONVERSION_INVALID.IDENTITY_NOT_REQUIRED',
      });
      return;
    }
    if (reason === 'uom_not_registered_for_item') {
      this.serverErrors.set({
        fromUnit: 'tradeInventory.errors.TRADE_INVENTORY_UOM_CONVERSION_INVALID.UOM_NOT_REGISTERED_FOR_ITEM',
      });
      return;
    }
    if (code === 'TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE') {
      this.serverErrors.set({ fromUnit: errorKey(error) });
      return;
    }
    if (code === 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED') {
      this.serverErrors.set({ item: 'invUom.validation.itemNotStockTracked' });
      return;
    }
    if (code === 'TRADE.INVENTORY.ITEM_TRACKING_CONFLICT') {
      this.serverErrors.set({ item: errorKey(error) });
      return;
    }
    if (reason === 'non_exact_result') {
      this.serverErrors.set({ numerator: 'invUom.validation.nonExactResult' });
      return;
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private clearServerErrors(...fields: FieldErrorKey[]): void {
    const current = this.serverErrors();
    if (fields.every((field) => !current[field])) return;
    const next = { ...current };
    for (const field of fields) {
      delete next[field];
    }
    this.serverErrors.set(next);
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

  private snapshot(): string {
    return JSON.stringify({
      itemId: this.selectedItemId(),
      fromUomId: this.fromUomId(),
      num: this.factorNumerator(),
      den: this.factorDenominator(),
      date: this.effectiveDate(),
      time: this.effectiveTime(),
    });
  }
}
