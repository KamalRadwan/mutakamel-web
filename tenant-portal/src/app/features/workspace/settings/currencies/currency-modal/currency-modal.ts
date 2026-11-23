import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCurrencyDollar, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { coreFieldErrors, fieldMessages, hasOtherFields } from '../../core-response.model';

import { CurrenciesApi } from '../currencies.api';
import {
  CURRENCY_CODE_PATTERN,
  CURRENCY_LIMITS,
  CreateCurrencyBody,
  Currency,
  CurrencyCatalogueEntry,
  UpdateCurrencyBody,
  currencyErrorMessage,
  currencyPermissions,
  isSupportedCurrencyCode,
  isValidRateText,
  minorUnitsOf,
} from '../currencies.model';

/** CreateCurrencyDto / UpdateCurrencyDto fields the form shows. */
const DTO_FIELDS = ['code', 'name', 'symbol', 'exchangeRate'] as const;

type CurrencyModalMode = 'create' | 'edit' | 'reactivate';
type CurrencyFormField = 'code' | 'name' | 'symbol' | 'rate';

const CODE_SERVER_ERRORS: ReadonlySet<string> = new Set([
  'CURRENCY_CODE_INVALID',
  'CURRENCY_CODE_TAKEN',
]);

const RATE_SERVER_ERRORS: ReadonlySet<string> = new Set([
  'CURRENCY_EXCHANGE_RATE_REQUIRED',
  'CURRENCY_REBASE_OUT_OF_RANGE',
  'CURRENCY_REBASE_PRECISION_LOSS',
]);

@Component({
  selector: 'app-currency-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal, Switch, UnsavedDialog, SettingsNotice],
  providers: [provideIcons({ tablerCurrencyDollar, tablerLock })],
  templateUrl: './currency-modal.html',
})
export class CurrencyModal {
  private static nextId = 0;
  protected readonly uid = `currency-modal-${++CurrencyModal.nextId}`;

  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly api = inject(CurrenciesApi);
  private readonly me = inject(AuthSession).me;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly rateInput = viewChild<ElementRef<HTMLInputElement>>('rateInput');

  readonly canManage = input(false);
  readonly defaultCurrency = input<Currency | null>(null);
  readonly hasCurrencies = input(true);

  readonly saved = output<Currency>();
  readonly notFound = output<string>();

  protected readonly limits = CURRENCY_LIMITS;
  protected readonly mode = signal<CurrencyModalMode>('create');
  protected readonly baseCurrency = signal<Currency | null>(null);

  protected readonly codeDraft = signal('');
  protected readonly nameDraft = signal('');
  protected readonly symbolDraft = signal('');
  protected readonly rateDraft = signal('');
  protected readonly makeDefaultDraft = signal(false);

  protected readonly saving = signal(false);
  private readonly touched = signal<Partial<Record<CurrencyFormField, boolean>>>({});
  private readonly submitted = signal(false);
  private readonly serverCodeError = signal<string | null>(null);
  private readonly serverRateError = signal<string | null>(null);
  /** CORE_VALIDATION_FAILED messages per DTO field, already in the request language. */
  private readonly serverFieldErrors = signal<Partial<Record<(typeof DTO_FIELDS)[number], string>>>({});

  private nameManuallyEdited = false;
  private symbolManuallyEdited = false;
  private allowClose = false;
  private confirmingUnsaved = false;
  private pendingAction: { signature: string; key: string } | null = null;

  private readonly catalogue = resource({
    params: () => this.language(),
    loader: ({ params }) => this.api.listCurrencyCatalogue(params),
  });

  private readonly catalogueByCode = computed(() => {
    const map = new Map<string, CurrencyCatalogueEntry>();
    if (!this.catalogue.hasValue()) return map;
    for (const entry of this.catalogue.value()) {
      map.set(entry.code, entry);
    }
    return map;
  });

  protected readonly isReadOnly = computed(() => !this.canManage() || !currencyPermissions(this.me()).manage);
  protected readonly isCreate = computed(() => this.mode() === 'create');
  protected readonly isEditingDefault = computed(
    () => this.mode() !== 'create' && Boolean(this.baseCurrency()?.isDefault),
  );
  protected readonly isRateDisabledOnCreate = computed(
    () => this.mode() === 'create' && !this.hasCurrencies(),
  );
  protected readonly isRateLocked = computed(
    () => this.isEditingDefault() || this.isRateDisabledOnCreate(),
  );

  protected readonly modalTitleKey = computed(() => {
    switch (this.mode()) {
      case 'create':
        return 'wsCurrencies.modal.createTitle';
      case 'reactivate':
        return 'wsCurrencies.modal.reactivateTitle';
      case 'edit':
        return 'wsCurrencies.modal.editTitle';
    }
  });

  protected readonly decimalsDisplay = computed(() => {
    if (this.mode() !== 'create') {
      const base = this.baseCurrency();
      return base ? String(base.decimalPlaces) : '';
    }
    const normalized = this.codeDraft().trim().toUpperCase();
    return CURRENCY_CODE_PATTERN.test(normalized) ? String(minorUnitsOf(normalized)) : '';
  });

  protected readonly rateDisplayValue = computed(() => {
    if (this.isRateDisabledOnCreate()) return '1';
    if (this.isEditingDefault()) return '1.00000000';
    return this.rateDraft();
  });

  protected readonly isMakeDefaultChecked = computed(() =>
    this.isCreate() ? (!this.hasCurrencies() ? true : this.makeDefaultDraft()) : false,
  );

  protected readonly rateEquation = computed(() => {
    if (this.isRateLocked()) return null;
    const base = this.defaultCurrency();
    if (!base) return null;
    const targetCode =
      this.mode() === 'create'
        ? this.codeDraft().trim().toUpperCase()
        : (this.baseCurrency()?.code ?? '');
    if (!CURRENCY_CODE_PATTERN.test(targetCode)) return null;
    const rateTrimmed = this.rateDraft().trim();
    if (!rateTrimmed) return null;

    const currentBase = this.baseCurrency();
    const matchesStored =
      this.mode() === 'edit' &&
      currentBase?.exchangeRate !== null &&
      currentBase?.exchangeRate !== undefined &&
      rateTrimmed === currentBase.exchangeRate;

    if (!matchesStored && !isValidRateText(rateTrimmed)) return null;
    if (this.mode() !== 'create' && currentBase && targetCode === base.code) return null;

    return {
      baseCode: base.code,
      rate: rateTrimmed,
      targetCode,
    };
  });

  private readonly clientErrors = computed<Partial<Record<CurrencyFormField, { key: string; params?: Record<string, number> }>>>(() => {
    const errors: Partial<Record<CurrencyFormField, { key: string; params?: Record<string, number> }>> = {};

    if (this.mode() === 'create') {
      const code = this.codeDraft().trim().toUpperCase();
      if (!CURRENCY_CODE_PATTERN.test(code) || !isSupportedCurrencyCode(code)) {
        errors.code = { key: 'codeFormat' };
      }
    }

    const name = this.nameDraft().trim();
    if (!name) {
      errors.name = { key: 'nameRequired' };
    } else if (Array.from(name).length > CURRENCY_LIMITS.name) {
      errors.name = { key: 'nameMax', params: { max: CURRENCY_LIMITS.name } };
    }

    const symbol = this.symbolDraft();
    if (Array.from(symbol).length > CURRENCY_LIMITS.symbol) {
      errors.symbol = { key: 'symbolMax', params: { max: CURRENCY_LIMITS.symbol } };
    }

    if (!this.isRateLocked()) {
      const rateText = this.rateDraft().trim();
      const base = this.baseCurrency();
      const unchangedStored =
        this.mode() === 'edit' &&
        base?.exchangeRate !== null &&
        base?.exchangeRate !== undefined &&
        rateText === base.exchangeRate;

      if (!unchangedStored) {
        const rateRequired =
          this.mode() === 'reactivate' ||
          (this.mode() === 'create' && this.hasCurrencies()) ||
          (this.mode() === 'edit' && Boolean(base && (base.status === 'ACTIVE' || base.exchangeRate !== null)));

        if (rateText) {
          if (!isValidRateText(rateText)) {
            errors.rate = { key: 'rateRangeInvalid' };
          }
        } else if (rateRequired) {
          errors.rate = { key: 'rateRangeInvalid' };
        }
      }
    }

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.clientErrors()).length === 0);

  protected readonly dirty = computed(() => {
    if (this.isReadOnly()) return false;

    if (this.mode() === 'create') {
      const hasCode = this.codeDraft().trim().length > 0;
      const hasName = this.nameDraft().trim().length > 0;
      const hasSymbol = this.symbolDraft().length > 0;
      const hasRate = this.hasCurrencies() && this.rateDraft().trim().length > 0;
      const hasDefaultToggle = this.hasCurrencies() && this.makeDefaultDraft();
      return hasCode || hasName || hasSymbol || hasRate || hasDefaultToggle;
    }

    const base = this.baseCurrency();
    if (!base) return false;

    const nameChanged = this.nameDraft().trim() !== base.name;
    const symbolChanged = this.symbolDraft() !== (base.symbol ?? '');
    const rateChanged = !base.isDefault && this.rateDraft().trim() !== (base.exchangeRate ?? '');

    if (this.mode() === 'reactivate') {
      return base.exchangeRate !== null || nameChanged || symbolChanged || rateChanged;
    }
    return nameChanged || symbolChanged || rateChanged;
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.serverCodeError() ?? this.serverFieldErrors().code;
    if (server) return server;
    return this.resolveClientError('code');
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    return this.serverFieldErrors().name ?? this.resolveClientError('name');
  });

  protected readonly symbolError = computed(() => {
    this.i18n();
    return this.serverFieldErrors().symbol ?? this.resolveClientError('symbol');
  });

  protected readonly rateError = computed(() => {
    this.i18n();
    const server = this.serverRateError() ?? this.serverFieldErrors().exchangeRate;
    if (server) return server;
    return this.resolveClientError('rate');
  });

  openCreate(): void {
    this.allowClose = false;
    this.mode.set('create');
    this.baseCurrency.set(null);
    this.resetCreateState();
    this.modal().open();
    if (!this.isReadOnly()) {
      afterNextRender(() => this.codeInput()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  openEdit(currency: Currency, options?: { reactivate?: boolean }): void {
    this.allowClose = false;
    const nextMode: CurrencyModalMode = options?.reactivate ? 'reactivate' : 'edit';
    this.mode.set(nextMode);
    this.baseCurrency.set(structuredClone(currency));
    this.resetEditState(currency);
    this.modal().open();
    if (!this.isReadOnly()) {
      afterNextRender(
        () => {
          if (nextMode === 'reactivate') {
            this.rateInput()?.nativeElement.focus();
          } else {
            this.nameInput()?.nativeElement.focus();
          }
        },
        { injector: this.injector },
      );
    }
  }

  protected onCodeInput(event: Event): void {
    if (this.isReadOnly() || this.mode() !== 'create') return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      inputEl.value = upper;
    }
    this.codeDraft.set(upper);
    this.serverCodeError.set(null);
    this.serverFieldErrors.update((e) => ({ ...e, code: undefined }));

    const trimmed = upper.trim();
    const match = CURRENCY_CODE_PATTERN.test(trimmed) ? this.catalogueByCode().get(trimmed) : undefined;
    if (match) {
      if (!this.nameManuallyEdited) {
        this.nameDraft.set(match.name.slice(0, CURRENCY_LIMITS.name));
      }
      if (!this.symbolManuallyEdited) {
        this.symbolDraft.set(match.symbol.slice(0, CURRENCY_LIMITS.symbol));
      }
    } else if (trimmed.length < CURRENCY_LIMITS.code) {
      if (!this.nameManuallyEdited) this.nameDraft.set('');
      if (!this.symbolManuallyEdited) this.symbolDraft.set('');
    }
  }

  protected onNameInput(event: Event): void {
    if (this.isReadOnly()) return;
    this.nameManuallyEdited = true;
    this.nameDraft.set((event.target as HTMLInputElement).value);
    this.serverFieldErrors.update((e) => ({ ...e, name: undefined }));
  }

  protected onSymbolInput(event: Event): void {
    if (this.isReadOnly()) return;
    this.symbolManuallyEdited = true;
    this.symbolDraft.set((event.target as HTMLInputElement).value);
    this.serverFieldErrors.update((e) => ({ ...e, symbol: undefined }));
  }

  protected onRateInput(event: Event): void {
    if (this.isReadOnly() || this.isRateLocked()) return;
    this.rateDraft.set((event.target as HTMLInputElement).value);
    this.serverRateError.set(null);
    this.serverFieldErrors.update((e) => ({ ...e, exchangeRate: undefined }));
  }

  protected onMakeDefaultChange(checked: boolean): void {
    if (this.isReadOnly() || this.mode() !== 'create' || !this.hasCurrencies()) return;
    this.makeDefaultDraft.set(checked);
    this.serverRateError.set(null);
  }

  protected markTouched(field: CurrencyFormField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected undo(): void {
    if (this.saving()) return;
    const base = this.baseCurrency();
    if (this.mode() === 'create' || !base) {
      this.resetCreateState();
      return;
    }
    this.resetEditState(base);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (!this.dirty() || this.isReadOnly()) {
      this.closeImmediate();
      return;
    }
    void this.confirmUnsavedAndClose();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty() && !this.isReadOnly()) {
      this.modal().open();
      void this.confirmUnsavedAndClose();
      return;
    }
    this.allowClose = false;
    this.pendingAction = null;
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.isReadOnly() || this.saving()) return;

    this.submitted.set(true);
    this.serverCodeError.set(null);
    this.serverRateError.set(null);

    if (!this.isValid()) return;

    if (this.mode() === 'create') {
      const payload = this.buildCreateBody();
      const key = this.keyForAction(`create:${JSON.stringify(payload)}`);
      this.saving.set(true);
      try {
        const created = await this.api.createCurrency(payload, key);
        this.pendingAction = null;
        this.notify.success(this.transloco.translate('wsCurrencies.toast.created', { code: created.code }));
        this.saved.emit(created);
        this.closeImmediate();
      } catch (error) {
        this.handleSaveError(error, null);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const base = this.baseCurrency();
    if (!base) return;
    const patch = this.buildUpdatePatch(base);
    if (Object.keys(patch).length === 0) {
      this.closeImmediate();
      return;
    }

    const actionMode = this.mode();
    const key = this.keyForAction(`${actionMode}:${base.id}:${JSON.stringify(patch)}`);
    this.saving.set(true);
    try {
      const updated = await this.api.updateCurrency(base.id, patch, key);
      this.pendingAction = null;
      this.notify.success(
        this.transloco.translate(
          actionMode === 'reactivate' ? 'wsCurrencies.toast.reactivated' : 'wsCurrencies.toast.updated',
          { code: updated.code },
        ),
      );
      this.saved.emit(updated);
      this.closeImmediate();
    } catch (error) {
      this.handleSaveError(error, base);
    } finally {
      this.saving.set(false);
    }
  }

  private buildCreateBody(): CreateCurrencyBody {
    const body: CreateCurrencyBody = {
      code: this.codeDraft().trim().toUpperCase(),
      name: this.nameDraft().trim(),
    };
    const symbol = this.symbolDraft();
    if (symbol) {
      body.symbol = symbol;
    }
    if (this.hasCurrencies()) {
      body.exchangeRate = Number(this.rateDraft().trim());
    }
    if (this.isMakeDefaultChecked()) {
      body.isDefault = true;
    }
    return body;
  }

  private buildUpdatePatch(base: Currency): UpdateCurrencyBody {
    const patch: UpdateCurrencyBody = {};
    const name = this.nameDraft().trim();
    if (name !== base.name) {
      patch.name = name;
    }

    const symbol = this.symbolDraft();
    if (symbol !== (base.symbol ?? '')) {
      patch.symbol = symbol;
    }

    if (!base.isDefault) {
      const rateText = this.rateDraft().trim();
      if (rateText !== (base.exchangeRate ?? '') && rateText) {
        patch.exchangeRate = Number(rateText);
      }
    }

    if (this.mode() === 'reactivate') {
      patch.status = 'ACTIVE';
    }

    return patch;
  }

  private handleSaveError(error: unknown, base: Currency | null): void {
    const code = errorCodeOf(error);
    if (code && CODE_SERVER_ERRORS.has(code)) {
      this.serverCodeError.set(code === 'CURRENCY_CODE_INVALID'
        ? this.transloco.translate('wsCurrencies.validation.unsupportedCode')
        : currencyErrorMessage(error, this.transloco));
      return;
    }
    if (code && RATE_SERVER_ERRORS.has(code)) {
      this.serverRateError.set(currencyErrorMessage(error, this.transloco));
      return;
    }
    const fields = coreFieldErrors(error);
    if (fields) {
      this.serverFieldErrors.set(fieldMessages(fields, DTO_FIELDS));
      if (hasOtherFields(fields, DTO_FIELDS)) this.notify.error(currencyErrorMessage(error, this.transloco, 'write'));
      return;
    }
    if (code === 'CURRENCY_NOT_FOUND') {
      this.pendingAction = null;
      this.notify.error(currencyErrorMessage(error, this.transloco));
      if (base) {
        this.notFound.emit(base.id);
      }
      this.closeImmediate();
      return;
    }
    this.notify.error(currencyErrorMessage(error, this.transloco, 'write'));
  }

  private resolveClientError(field: CurrencyFormField): string | null {
    const err = this.clientErrors()[field];
    if (!err) return null;
    if (!this.submitted() && !this.touched()[field]) return null;
    return this.transloco.translate(`wsCurrencies.validation.${err.key}`, err.params);
  }

  private keyForAction(signature: string): string {
    if (!this.pendingAction || this.pendingAction.signature !== signature) {
      this.pendingAction = { signature, key: newIdempotencyKey() };
    }
    return this.pendingAction.key;
  }

  private resetCreateState(): void {
    this.codeDraft.set('');
    this.nameDraft.set('');
    this.symbolDraft.set('');
    this.rateDraft.set('');
    this.makeDefaultDraft.set(false);
    this.nameManuallyEdited = false;
    this.symbolManuallyEdited = false;
    this.resetValidationState();
  }

  private resetEditState(currency: Currency): void {
    this.codeDraft.set(currency.code);
    this.nameDraft.set(currency.name);
    this.symbolDraft.set(currency.symbol ?? '');
    this.rateDraft.set(currency.exchangeRate ?? '');
    this.makeDefaultDraft.set(false);
    this.nameManuallyEdited = true;
    this.symbolManuallyEdited = true;
    this.resetValidationState();
  }

  private resetValidationState(): void {
    this.touched.set({});
    this.submitted.set(false);
    this.serverCodeError.set(null);
    this.serverRateError.set(null);
    this.serverFieldErrors.set({});
    this.pendingAction = null;
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  private async confirmUnsavedAndClose(): Promise<void> {
    if (this.confirmingUnsaved) return;
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'discard') {
        this.closeImmediate();
      } else if (choice === 'save') {
        void this.save();
      }
    } finally {
      this.confirmingUnsaved = false;
    }
  }
}
