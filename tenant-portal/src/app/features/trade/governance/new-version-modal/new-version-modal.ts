import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerVersions, tablerX } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { cloneVersion, getPriceBook, listPriceBooks } from '../pricing.api';
import type {
  AdjustmentMode,
  CloneSourceMode,
  CloneVersionInput,
  PricePurpose,
  RoundingMode,
  SavedPriceVersion,
} from '../pricing.model';

export interface NewVersionPreset {
  sourceMode?: CloneSourceMode;
  sourceVersionId?: string | null;
}

export interface NewVersionModalConfig {
  bookId: string;
  bookVersion: number;
  purpose: PricePurpose;
  currencyCode: string;
  currencyDecimals: number;
  preset?: NewVersionPreset | null;
}

export function resolvePricingError(transloco: TranslocoService, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return transloco.translate('tradeShared.errors.network');
  }
  const lang = transloco.getActiveLang();
  const dict = transloco.getTranslation(lang);
  const reason = error.details?.['reason']?.[0];
  const underscores = error.code.replaceAll('.', '_');
  // Pricing reasons live in the price scopes (priceErrors); whichever scope the page loaded answers.
  const priceScopes = ['pricing', 'priceBooks', 'priceEval'];
  const candidates: string[] = [];
  if (reason) {
    candidates.push(...priceScopes.map((scope) => `${scope}.priceErrors.${error.code}.${reason}`));
    candidates.push(`governance.errors.${error.code}.${reason}`);
    candidates.push(`governance.errors.${underscores}_${reason}`);
  }
  candidates.push(...priceScopes.map((scope) => `${scope}.priceErrors.${error.code}`));
  candidates.push(`governance.errors.${error.code}`);
  candidates.push(`governance.errors.${underscores}`);
  candidates.push(`tradeShared.errors.${underscores}`);
  if (error.status === 403) {
    candidates.push('tradeShared.errors.permission');
  }
  if (error.status === 404) {
    candidates.push('tradeShared.errors.notFound');
  }
  candidates.push('settings.errors.generic', 'tradeShared.errors.generic');

  for (const key of candidates) {
    if (typeof dict[key] === 'string' && dict[key].length > 0) {
      return transloco.translate(key);
    }
  }
  return transloco.translate('tradeShared.errors.generic');
}

interface SourceVersionChoice {
  id: string;
  label: string;
  isCurrentBook: boolean;
}

const SIGNED_DECIMAL_RE = /^[+-]?(0|[1-9]\d{0,15})(\.\d{1,8})?$/;
const MAX_NOTES = 500;

function todayIsoDate(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function combineDateTimeIso(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!dm) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec((timeStr ?? '00:00').trim());
  const hh = tm ? Number(tm[1]) : 0;
  const mm = tm ? Number(tm[2]) : 0;
  const date = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hh, mm, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

@Component({
  selector: 'app-new-version-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TimeField,
  ],
  providers: [provideIcons({ tablerVersions, tablerX })],
  templateUrl: './new-version-modal.html',
})
export class NewVersionModal {
  private static nextId = 0;
  protected readonly uid = `gov-new-ver-${++NewVersionModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  readonly bookId = input('');
  readonly bookVersion = input(1);
  readonly purpose = input<PricePurpose>('SALES');
  readonly currencyCode = input('EGP');
  readonly currencyDecimals = input(3);
  readonly preset = input<NewVersionPreset | null>(null);

  readonly created = output<{ bookId: string; version: SavedPriceVersion }>();
  readonly conflictReload = output<void>();

  protected readonly maxNotes = MAX_NOTES;

  private readonly activeConfig = signal<NewVersionModalConfig>({
    bookId: '',
    bookVersion: 1,
    purpose: 'SALES',
    currencyCode: 'EGP',
    currencyDecimals: 3,
    preset: null,
  });

  protected readonly loadingSources = signal(false);
  protected readonly sourceChoices = signal<SourceVersionChoice[]>([]);

  protected readonly sourceMode = signal<CloneSourceMode>('CLONE_VERSION');
  protected readonly sourceVersionId = signal('');
  protected readonly includePromotions = signal(true);
  protected readonly fromDate = signal<string | null>(todayIsoDate());
  protected readonly fromTime = signal<string | null>('00:00');
  protected readonly toDate = signal<string | null>(null);
  protected readonly toTime = signal<string | null>(null);
  protected readonly adjustmentMode = signal<AdjustmentMode>('NONE');
  protected readonly adjustmentValue = signal('');
  protected readonly roundingMode = signal<RoundingMode>('NONE');
  protected readonly notes = signal('');

  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  private readonly discardPromptOpen = signal(false);

  private initialSnapshot = '';
  private idempotencyKey: string | null = null;
  private lastFingerprint: string | null = null;
  private allowClose = false;
  private loadSeq = 0;

  protected readonly isClone = computed(() => this.sourceMode() === 'CLONE_VERSION');
  protected readonly isEmpty = computed(() => this.sourceMode() === 'EMPTY_DRAFT');
  protected readonly showsAdjustment = computed(() => !this.isEmpty());
  protected readonly showsChangeValue = computed(
    () => this.showsAdjustment() && this.adjustmentMode() !== 'NONE',
  );
  protected readonly lowDecimals = computed(() => this.activeConfig().currencyDecimals < 2);

  protected readonly dirty = computed(() => this.currentSnapshot() !== this.initialSnapshot);

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'CLONE_VERSION', label: this.transloco.translate('priceBooks.newVersion.modes.CLONE_VERSION') },
      { value: 'SEED_FROM_CATALOG', label: this.transloco.translate('priceBooks.newVersion.modes.SEED_FROM_CATALOG') },
      { value: 'EMPTY_DRAFT', label: this.transloco.translate('priceBooks.newVersion.modes.EMPTY_DRAFT') },
    ];
  });

  protected readonly sourceVersionOptions = computed<DropdownOption<string>[]>(() =>
    this.sourceChoices().map((item) => ({
      value: item.id,
      label: item.label,
    })),
  );

  protected readonly adjustmentOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'NONE', label: this.transloco.translate('priceBooks.newVersion.adjustments.NONE') },
      { value: 'PERCENTAGE', label: this.transloco.translate('priceBooks.newVersion.adjustments.PERCENTAGE') },
      { value: 'FIXED_DELTA', label: this.transloco.translate('priceBooks.newVersion.adjustments.FIXED_DELTA') },
    ];
  });

  protected readonly roundingOptions = computed<DropdownOption<RoundingMode>[]>(() => {
    this.i18n();
    const disableFrac = this.lowDecimals();
    return [
      { value: 'NONE', label: this.transloco.translate('priceBooks.newVersion.roundings.NONE') },
      { value: 'NEAREST_1', label: this.transloco.translate('priceBooks.newVersion.roundings.NEAREST_1') },
      {
        value: 'NEAREST_0_50',
        label: this.transloco.translate('priceBooks.newVersion.roundings.NEAREST_0_50'),
        disabled: disableFrac,
      },
      {
        value: 'END_95',
        label: this.transloco.translate('priceBooks.newVersion.roundings.END_95'),
        disabled: disableFrac,
      },
    ];
  });

  protected readonly sourceVersionError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.isClone()) return null;
    if (!this.sourceVersionId().trim()) {
      return this.transloco.translate('priceBooks.newVersion.errors.sourceRequired');
    }
    return null;
  });

  protected readonly effectiveFromError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (!combineDateTimeIso(this.fromDate(), this.fromTime())) {
      return this.transloco.translate('priceBooks.newVersion.errors.effectiveFromRequired');
    }
    return null;
  });

  protected readonly effectiveToError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.toDate()) return null;
    const fromIso = combineDateTimeIso(this.fromDate(), this.fromTime());
    const toIso = combineDateTimeIso(this.toDate(), this.toTime() ?? '23:59');
    if (!fromIso || !toIso) return null;
    if (Date.parse(toIso) <= Date.parse(fromIso)) {
      return this.transloco.translate('priceBooks.newVersion.errors.effectiveToAfterFrom');
    }
    return null;
  });

  protected readonly changeValueError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showsChangeValue()) return null;
    const raw = this.adjustmentValue().trim();
    if (!raw || !SIGNED_DECIMAL_RE.test(raw)) {
      return this.transloco.translate('priceBooks.newVersion.errors.changeValueInvalid');
    }
    return null;
  });

  protected readonly notesError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.notes().trim().length > MAX_NOTES) {
      return this.transloco.translate('priceBooks.newVersion.errors.notesMax');
    }
    return null;
  });

  async open(override?: NewVersionModalConfig): Promise<void> {
    const cfg: NewVersionModalConfig = {
      bookId: override?.bookId ?? this.bookId(),
      bookVersion: override?.bookVersion ?? this.bookVersion(),
      purpose: override?.purpose ?? this.purpose(),
      currencyCode: override?.currencyCode ?? this.currencyCode(),
      currencyDecimals: override?.currencyDecimals ?? this.currencyDecimals(),
      preset: override?.preset !== undefined ? override.preset : this.preset(),
    };
    this.activeConfig.set(cfg);
    this.allowClose = false;

    const initialMode: CloneSourceMode = cfg.preset?.sourceMode ?? 'CLONE_VERSION';
    this.sourceMode.set(initialMode);
    this.sourceVersionId.set(cfg.preset?.sourceVersionId ?? '');
    this.includePromotions.set(true);
    this.fromDate.set(todayIsoDate());
    this.fromTime.set('00:00');
    this.toDate.set(null);
    this.toTime.set(null);
    this.adjustmentMode.set('NONE');
    this.adjustmentValue.set('');
    this.roundingMode.set('NONE');
    this.notes.set('');
    this.submitted.set(false);
    this.idempotencyKey = null;
    this.lastFingerprint = null;
    this.initialSnapshot = this.currentSnapshot();

    this.modal().open();
    await this.loadSourceVersions(cfg);
  }

  protected onModeChange(value: string | null): void {
    if (value === 'CLONE_VERSION' || value === 'SEED_FROM_CATALOG' || value === 'EMPTY_DRAFT') {
      this.sourceMode.set(value);
      if (value === 'CLONE_VERSION' && !this.sourceVersionId()) {
        const first = this.sourceChoices()[0];
        if (first) {
          this.sourceVersionId.set(first.id);
        }
      }
    }
  }

  protected onSourceVersionChange(id: string): void {
    this.sourceVersionId.set(id);
  }

  protected onFromDateChange(value: string | null): void {
    this.fromDate.set(value);
  }

  protected onFromTimeChange(value: string | null): void {
    this.fromTime.set(value ?? '00:00');
  }

  protected onToDateChange(value: string | null): void {
    this.toDate.set(value);
    if (value && !this.toTime()) {
      this.toTime.set('23:59');
    } else if (!value) {
      this.toTime.set(null);
    }
  }

  protected onToTimeChange(value: string | null): void {
    this.toTime.set(value);
  }

  protected clearTo(): void {
    this.toDate.set(null);
    this.toTime.set(null);
  }

  protected onAdjustmentModeChange(value: string | null): void {
    if (value === 'NONE' || value === 'PERCENTAGE' || value === 'FIXED_DELTA') {
      this.adjustmentMode.set(value);
      if (value === 'NONE') {
        this.adjustmentValue.set('');
      }
    }
  }

  protected onAdjustmentValueInput(event: Event): void {
    this.adjustmentValue.set((event.target as HTMLInputElement).value);
  }

  protected onRoundingChange(value: RoundingMode): void {
    this.roundingMode.set(value);
  }

  protected onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value.slice(0, MAX_NOTES));
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.submitted.set(true);

    if (
      this.sourceVersionError() ||
      this.effectiveFromError() ||
      this.effectiveToError() ||
      this.changeValueError() ||
      this.notesError()
    ) {
      return;
    }

    const fromIso = combineDateTimeIso(this.fromDate(), this.fromTime());
    if (!fromIso) return;
    const toIso = this.toDate() ? combineDateTimeIso(this.toDate(), this.toTime() ?? '23:59') : null;

    const mode = this.sourceMode();
    const notesText = this.notes().trim();
    const body: CloneVersionInput = {
      sourceMode: mode,
      effectiveFrom: fromIso,
      effectiveTo: toIso,
      ...(notesText ? { notes: notesText } : {}),
    };

    if (mode === 'CLONE_VERSION') {
      body.sourceVersionId = this.sourceVersionId();
      body.includePromotions = this.includePromotions();
    }

    if (mode !== 'EMPTY_DRAFT') {
      body.adjustmentMode = this.adjustmentMode();
      if (this.adjustmentMode() !== 'NONE') {
        body.adjustmentValue = this.adjustmentValue().trim();
      }
      body.roundingMode = this.lowDecimals() && (this.roundingMode() === 'NEAREST_0_50' || this.roundingMode() === 'END_95')
        ? 'NONE'
        : this.roundingMode();
    }

    const cfg = this.activeConfig();
    const fingerprint = JSON.stringify({ bookId: cfg.bookId, body });
    if (!this.idempotencyKey || this.lastFingerprint !== fingerprint) {
      this.idempotencyKey = newIdempotencyKey();
      this.lastFingerprint = fingerprint;
    }

    this.saving.set(true);
    try {
      const version = await cloneVersion(cfg.bookId, body, cfg.bookVersion, this.idempotencyKey);
      this.notify.success(this.transloco.translate('priceBooks.toasts.versionCreated'));
      this.allowClose = true;
      this.modal().close();
      this.created.emit({ bookId: cfg.bookId, version });
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async onConflictReload(): Promise<void> {
    const cfg = this.activeConfig();
    try {
      const fresh = await getPriceBook(cfg.bookId);
      this.activeConfig.update((c) => ({ ...c, bookVersion: fresh.book.version }));
      this.idempotencyKey = null;
      this.conflictReload.emit();
    } catch (error) {
      this.notify.error(resolvePricingError(this.transloco, error));
    }
  }

  protected async onConflictKeep(): Promise<void> {
    const cfg = this.activeConfig();
    try {
      const fresh = await getPriceBook(cfg.bookId);
      this.activeConfig.update((c) => ({ ...c, bookVersion: fresh.book.version }));
      this.idempotencyKey = null;
    } catch (error) {
      this.notify.error(resolvePricingError(this.transloco, error));
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    await this.confirmDiscardAndClose();
  }

  protected onModalClosed(): void {
    if (this.allowClose) {
      this.allowClose = false;
      return;
    }
    if (this.dirty() && !this.discardPromptOpen()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
    }
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.discardPromptOpen()) return;
    this.discardPromptOpen.set(true);
    try {
      const confirmed = await this.discardDialog().open();
      if (confirmed) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.discardPromptOpen.set(false);
    }
  }

  private async loadSourceVersions(cfg: NewVersionModalConfig): Promise<void> {
    if (!cfg.bookId) return;
    const seq = ++this.loadSeq;
    this.loadingSources.set(true);
    try {
      const [currentBook, samePurposeBooks] = await Promise.all([
        getPriceBook(cfg.bookId),
        listPriceBooks({ purpose: cfg.purpose, limit: 100 }),
      ]);
      if (seq !== this.loadSeq) return;

      this.activeConfig.update((c) => ({ ...c, bookVersion: currentBook.book.version }));

      const choices: SourceVersionChoice[] = [];
      const currentVersions = currentBook.versions.slice().sort((a, b) => b.versionNumber - a.versionNumber);
      for (const v of currentVersions) {
        const statusText = this.transloco.translate(`governance.status.price.${v.status}`);
        choices.push({
          id: v.id,
          label: this.transloco.translate('priceBooks.newVersion.thisBookVersion', {
            n: v.versionNumber,
            status: statusText,
          }),
          isCurrentBook: true,
        });
      }

      const otherBooks = samePurposeBooks.items.filter(
        (b) => b.id !== cfg.bookId && b.currencyCode === cfg.currencyCode,
      );
      for (const book of otherBooks) {
        const sorted = book.versions.slice().sort((a, b) => b.versionNumber - a.versionNumber);
        for (const v of sorted) {
          choices.push({
            id: v.id,
            label: this.transloco.translate('priceBooks.newVersion.otherBookVersion', {
              code: book.code,
              n: v.versionNumber,
            }),
            isCurrentBook: false,
          });
        }
      }

      this.sourceChoices.set(choices);
      const presetId = cfg.preset?.sourceVersionId;
      if (presetId && choices.some((c) => c.id === presetId)) {
        this.sourceVersionId.set(presetId);
      } else if (choices.length > 0) {
        this.sourceVersionId.set(choices[0].id);
      } else {
        this.sourceVersionId.set('');
        if (!cfg.preset?.sourceMode) {
          this.sourceMode.set('SEED_FROM_CATALOG');
        }
      }
      this.initialSnapshot = this.currentSnapshot();
    } catch (error) {
      if (seq === this.loadSeq) {
        this.notify.error(resolvePricingError(this.transloco, error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingSources.set(false);
      }
    }
  }

  private currentSnapshot(): string {
    return JSON.stringify({
      sourceMode: this.sourceMode(),
      sourceVersionId: this.sourceVersionId(),
      includePromotions: this.includePromotions(),
      fromDate: this.fromDate(),
      fromTime: this.fromTime(),
      toDate: this.toDate(),
      toTime: this.toTime(),
      adjustmentMode: this.adjustmentMode(),
      adjustmentValue: this.adjustmentValue(),
      roundingMode: this.roundingMode(),
      notes: this.notes(),
    });
  }
}
