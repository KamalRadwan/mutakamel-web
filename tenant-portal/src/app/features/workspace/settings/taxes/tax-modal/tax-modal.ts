import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLock, tablerReceiptTax } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { coreFieldErrors, fieldMessages, hasOtherFields } from '../../core-response.model';

import { TaxesApi } from '../taxes.api';
import {
  CompanyOption,
  CreateTaxBody,
  TAX_LIMITS,
  Tax,
  UpdateTaxBody,
  taxPermissions,
  canManageTax,
  formatRate,
  isValidRateText,
  toCanonicalRate,
  translateTaxError,
} from '../taxes.model';

const DTO_FIELDS = ['code', 'name', 'rate', 'companyId', 'isInclusive', 'status'] as const;

type TaxFormField = 'scope' | 'code' | 'rate' | 'name';

const WORKSPACE_SCOPE = '__workspace__';

@Component({
  selector: 'app-tax-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    Modal,
    Switch,
    UnsavedDialog,
  ],
  providers: [provideIcons({ tablerReceiptTax, tablerLock })],
  templateUrl: './tax-modal.html',
})
export class TaxModal {
  private static nextId = 0;
  protected readonly uid = `tax-modal-${++TaxModal.nextId}`;

  private readonly api = inject(TaxesApi);
  private readonly auth = inject(AuthSession);
  private readonly permissions = computed(() => taxPermissions(this.auth.me()));
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly rateInput = viewChild<ElementRef<HTMLInputElement>>('rateInput');

  readonly canManage = input(true);
  readonly companies = input<CompanyOption[]>([]);
  readonly tenantWideAllowed = computed(() => this.permissions().tenantWideAllowed);

  readonly saved = output<Tax>();
  readonly notFound = output<string>();

  protected readonly limits = TAX_LIMITS;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseTax = signal<Tax | null>(null);

  protected readonly initialScope = signal('');
  protected readonly scopeDraft = signal('');
  protected readonly codeDraft = signal('');
  protected readonly rateDraft = signal('');
  protected readonly nameDraft = signal('');
  protected readonly isInclusiveDraft = signal(false);
  protected readonly isActiveDraft = signal(true);

  protected readonly touched = signal<Partial<Record<TaxFormField, boolean>>>({});
  protected readonly revealAllErrors = signal(false);
  protected readonly saving = signal(false);

  /** CORE_VALIDATION_FAILED messages per DTO field, already in the request language. */
  private readonly serverFieldErrors = signal<Partial<Record<(typeof DTO_FIELDS)[number], string>>>({});
  protected readonly serverScopeError = signal<string | null>(null);
  protected readonly serverCodeError = signal<string | null>(null);
  protected readonly serverActiveError = signal<string | null>(null);

  private allowClose = false;
  private confirmingUnsaved = false;
  private pendingKey: { bodyJson: string; key: string } | null = null;

  private readonly manageableActiveCompanies = computed(() =>
    this.companies().filter((company) => canManageTax({ companyId: company.id }, this.permissions()) && company.status !== 'INACTIVE'),
  );

  protected readonly scopeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options: DropdownOption<string>[] = [];
    if (this.tenantWideAllowed()) {
      options.push({
        value: WORKSPACE_SCOPE,
        label: this.transloco.translate('wsTaxes.fields.workspaceWide'),
      });
    }
    for (const company of this.manageableActiveCompanies()) {
      options.push({ value: company.id, label: company.name });
    }
    return options;
  });

  protected readonly isEditable = computed(() => {
    if (!this.canManage()) return false;
    if (this.mode() === 'create') {
      return this.scopeOptions().length > 0;
    }
    const tax = this.baseTax();
    if (!tax) return false;
    return canManageTax(tax, this.permissions());
  });

  protected readonly editScopeLabel = computed(() => {
    this.i18n();
    const tax = this.baseTax();
    if (!tax) return '';
    if (tax.companyId === null) {
      return this.transloco.translate('wsTaxes.fields.workspaceWide');
    }
    const match = this.companies().find((company) => company.id === tax.companyId);
    return match ? match.name : this.transloco.translate('wsTaxes.companyFallback', { id: tax.companyId.slice(0, 8) });
  });

  private readonly selectedCreateScopeLabel = computed(() => {
    this.i18n();
    const scope = this.scopeDraft();
    if (scope === WORKSPACE_SCOPE) {
      return this.transloco.translate('wsTaxes.table.workspaceWide');
    }
    const match = this.companies().find((company) => company.id === scope);
    return match ? match.name : this.transloco.translate('wsTaxes.table.workspaceWide');
  });

  protected readonly validationErrors = computed<Partial<Record<TaxFormField, string>>>(() => {
    const errors: Partial<Record<TaxFormField, string>> = {};

    if (this.mode() === 'create') {
      if (!this.scopeOptions().some((option) => option.value === this.scopeDraft())) {
        errors.scope = 'scopeRequired';
      }
      const code = this.codeDraft().trim().toUpperCase();
      if (!code || code.length > TAX_LIMITS.code) {
        errors.code = 'codeRequired';
      }
    }

    const rate = this.rateDraft().trim();
    if (!rate) {
      errors.rate = 'rateRequired';
    } else if (!isValidRateText(rate)) {
      errors.rate = 'rateInvalid';
    }

    const name = this.nameDraft().trim();
    if (!name || name.length > TAX_LIMITS.name) {
      errors.name = 'nameRequired';
    }

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly scopeError = computed(() => {
    this.i18n();
    const server = this.serverScopeError() ?? this.serverFieldErrors().companyId;
    if (server) return server;
    return this.clientErrorText('scope');
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.serverCodeError() ?? this.serverFieldErrors().code;
    if (server) return server;
    return this.clientErrorText('code');
  });

  protected readonly rateError = computed(() => {
    this.i18n();
    return this.serverFieldErrors().rate ?? this.clientErrorText('rate');
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    return this.serverFieldErrors().name ?? this.clientErrorText('name');
  });

  protected readonly activeError = computed(() => {
    this.i18n();
    return this.serverActiveError() ?? this.serverFieldErrors().status ?? null;
  });

  protected readonly inclusiveError = computed(() => this.serverFieldErrors().isInclusive ?? null);
  protected readonly rateHint = computed(() => {
    this.i18n();
    const hint = this.transloco.translate('wsTaxes.fields.rateHint');
    return this.mode() === 'edit' ? `${hint} ${this.transloco.translate('wsTaxes.fields.rateEditHint')}` : hint;
  });

  protected readonly editPatch = computed<UpdateTaxBody>(() => {
    const base = this.baseTax();
    if (this.mode() !== 'edit' || !base) return {};
    const patch: UpdateTaxBody = {};

    const name = this.nameDraft().trim();
    if (name !== base.name) {
      patch.name = name;
    }

    const rateText = this.rateDraft().trim();
    if (isValidRateText(rateText)) {
      const rateNum = Number(rateText);
      if (toCanonicalRate(rateNum) !== base.rate) {
        patch.rate = rateNum;
      }
    }

    if (this.isInclusiveDraft() !== base.isInclusive) {
      patch.isInclusive = this.isInclusiveDraft();
    }

    const nextStatus = this.isActiveDraft() ? 'ACTIVE' : 'INACTIVE';
    if (nextStatus !== base.status) {
      patch.status = nextStatus;
    }

    return patch;
  });

  protected readonly dirty = computed(() => {
    if (!this.isEditable()) return false;
    if (this.mode() === 'create') {
      return (
        this.scopeDraft() !== this.initialScope() ||
        this.codeDraft().trim() !== '' ||
        this.rateDraft().trim() !== '' ||
        this.nameDraft().trim() !== '' ||
        this.isInclusiveDraft() !== false
      );
    }

    const base = this.baseTax();
    if (!base) return false;
    const rateText = this.rateDraft().trim();
    const rateChanged = isValidRateText(rateText)
      ? toCanonicalRate(Number(rateText)) !== base.rate
      : rateText !== formatRate(base.rate);

    return (
      this.nameDraft().trim() !== base.name ||
      rateChanged ||
      this.isInclusiveDraft() !== base.isInclusive ||
      (this.isActiveDraft() ? 'ACTIVE' : 'INACTIVE') !== base.status
    );
  });

  openCreate(): void {
    this.mode.set('create');
    this.baseTax.set(null);

    const options = this.scopeOptions();
    const defaultScope =
      options.length === 1 ? options[0].value : this.tenantWideAllowed() ? WORKSPACE_SCOPE : '';

    this.initialScope.set(defaultScope);
    this.scopeDraft.set(defaultScope);
    this.codeDraft.set('');
    this.rateDraft.set('');
    this.nameDraft.set('');
    this.isInclusiveDraft.set(false);
    this.isActiveDraft.set(true);

    this.pendingKey = null;
    this.resetErrors();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(tax: Tax): void {
    this.mode.set('edit');
    this.baseTax.set(tax);

    const scopeValue = tax.companyId ?? WORKSPACE_SCOPE;
    this.initialScope.set(scopeValue);
    this.scopeDraft.set(scopeValue);
    this.codeDraft.set(tax.code);
    this.rateDraft.set(formatRate(tax.rate));
    this.nameDraft.set(tax.name);
    this.isInclusiveDraft.set(tax.isInclusive);
    this.isActiveDraft.set(tax.status === 'ACTIVE');

    this.pendingKey = null;
    this.resetErrors();
    this.allowClose = false;
    this.modal().open();

    if (this.isEditable()) {
      afterNextRender(() => this.rateInput()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected onScopeChange(value: string): void {
    if (!this.isEditable() || this.mode() !== 'create' || this.saving()) return;
    this.scopeDraft.set(value);
    this.markTouched('scope');
    this.serverScopeError.set(null);
    this.serverCodeError.set(null);
    this.serverFieldErrors.set({});
  }

  protected onCodeInput(event: Event): void {
    if (!this.isEditable() || this.mode() !== 'create' || this.saving()) return;
    const target = event.target as HTMLInputElement;
    const upper = target.value.toUpperCase();
    if (target.value !== upper) {
      target.value = upper;
    }
    this.codeDraft.set(upper);
    this.serverCodeError.set(null);
    this.serverFieldErrors.set({});
  }

  protected onRateInput(event: Event): void {
    if (!this.isEditable() || this.saving()) return;
    this.rateDraft.set((event.target as HTMLInputElement).value);
    this.serverFieldErrors.set({});
  }

  protected onNameInput(event: Event): void {
    if (!this.isEditable() || this.saving()) return;
    this.nameDraft.set((event.target as HTMLInputElement).value);
    this.serverFieldErrors.set({});
  }

  protected onInclusiveChange(checked: boolean): void {
    if (!this.isEditable() || this.saving()) return;
    this.isInclusiveDraft.set(checked);
    this.serverFieldErrors.set({});
  }

  protected onActiveChange(checked: boolean): void {
    if (!this.isEditable() || this.mode() !== 'edit' || this.saving()) return;
    this.isActiveDraft.set(checked);
    this.serverActiveError.set(null);
    this.serverFieldErrors.set({});
  }

  protected markTouched(field: TaxFormField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected undo(): void {
    if (this.saving() || !this.isEditable()) return;
    if (this.mode() === 'create') {
      this.scopeDraft.set(this.initialScope());
      this.codeDraft.set('');
      this.rateDraft.set('');
      this.nameDraft.set('');
      this.isInclusiveDraft.set(false);
      this.isActiveDraft.set(true);
    } else {
      const base = this.baseTax();
      if (base) {
        this.rateDraft.set(formatRate(base.rate));
        this.nameDraft.set(base.name);
        this.isInclusiveDraft.set(base.isInclusive);
        this.isActiveDraft.set(base.status === 'ACTIVE');
      }
    }
    this.pendingKey = null;
    this.resetErrors();
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty() && this.isEditable()) {
      void this.confirmUnsavedClose();
      return;
    }
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty() && this.isEditable()) {
      this.modal().open();
      void this.confirmUnsavedClose();
      return;
    }
    this.allowClose = false;
  }

  protected async save(event?: Event): Promise<boolean> {
    event?.preventDefault();
    if (!this.isEditable() || this.saving()) return false;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return false;

    this.serverFieldErrors.set({});
    this.serverScopeError.set(null);
    this.serverCodeError.set(null);
    this.serverActiveError.set(null);

    if (this.mode() === 'edit') {
      const patch = this.editPatch();
      if (Object.keys(patch).length === 0) {
        this.closeImmediate();
        return true;
      }
    }

    const base = this.baseTax();
    const requestData = this.buildRequestPayload();
    const bodyJson = JSON.stringify(requestData);
    if (!this.pendingKey || this.pendingKey.bodyJson !== bodyJson) {
      this.pendingKey = { bodyJson, key: newIdempotencyKey() };
    }
    const idempotencyKey = this.pendingKey.key;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const created = await this.api.createTax(requestData as CreateTaxBody, idempotencyKey);
        this.pendingKey = null;
        this.notify.connectionRestored();
        this.notify.success(this.transloco.translate('wsTaxes.toast.created', { code: created.code }));
        this.saved.emit(created);
        this.closeImmediate();
        return true;
      }

      if (!base) return false;
      const updated = await this.api.updateTax(base.id, requestData as UpdateTaxBody, idempotencyKey);
      this.pendingKey = null;
      this.notify.connectionRestored();
      this.notify.success(this.transloco.translate('wsTaxes.toast.updated', { code: updated.code }));
      this.saved.emit(updated);
      this.closeImmediate();
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private buildRequestPayload(): CreateTaxBody | UpdateTaxBody {
    if (this.mode() === 'create') {
      const body: CreateTaxBody = {
        code: this.codeDraft().trim().toUpperCase(),
        name: this.nameDraft().trim(),
        rate: Number(this.rateDraft().trim()),
      };
      if (this.isInclusiveDraft()) {
        body.isInclusive = true;
      }
      const scope = this.scopeDraft();
      if (scope && scope !== WORKSPACE_SCOPE) {
        body.companyId = scope;
      }
      return body;
    }
    return this.editPatch();
  }

  private handleSaveError(error: unknown): void {
    if (error instanceof ApiError && error.status === 0) {
      this.notify.connectionLost(this.transloco.translate('session.connectionLost.title'),
        this.transloco.translate('session.connectionLost.text'));
      return;
    }
    if (error instanceof ApiError && error.status === 401) {
      this.notify.error(translateTaxError(error, this.transloco, 'write'));
      return;
    }
    const code = errorCodeOf(error);

    if (code === 'TAX_CODE_TAKEN') {
      this.serverCodeError.set(
        this.transloco.translate('wsTaxes.errors.TAX_CODE_TAKEN', {
          scope: this.selectedCreateScopeLabel(),
        }),
      );
      return;
    }

    if (code === 'COMPANY_INVALID') {
      if (this.mode() === 'create') {
        this.serverScopeError.set(translateTaxError(error, this.transloco, 'create'));
      } else {
        this.serverActiveError.set(translateTaxError(error, this.transloco, 'reactivate'));
      }
      return;
    }

    const fields = coreFieldErrors(error);
    if (fields) {
      this.serverFieldErrors.set(fieldMessages(fields, DTO_FIELDS));
      const displayedFields = this.mode() === 'create'
        ? DTO_FIELDS.filter((field) => field !== 'status')
        : DTO_FIELDS.filter((field) => field !== 'code' && field !== 'companyId');
      if (hasOtherFields(fields, displayedFields) || Object.keys(fields).length === 0) {
        this.notify.error(translateTaxError(error, this.transloco, 'write'));
      }
      return;
    }

    if (code === 'TAX_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
      this.pendingKey = null;
      this.notify.error(translateTaxError(error, this.transloco, 'write'));
      const base = this.baseTax();
      if (base) this.notFound.emit(base.id);
      this.closeImmediate();
      return;
    }

    this.notify.error(translateTaxError(error, this.transloco, 'write'));
  }

  private clientErrorText(field: TaxFormField): string | null {
    const key = this.validationErrors()[field];
    if (!key) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return this.transloco.translate(`wsTaxes.validation.${key}`);
  }

  private resetErrors(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverFieldErrors.set({});
    this.serverScopeError.set(null);
    this.serverCodeError.set(null);
    this.serverActiveError.set(null);
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  private async confirmUnsavedClose(): Promise<void> {
    if (this.confirmingUnsaved) return;
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'discard') {
        this.closeImmediate();
      } else if (choice === 'save') {
        await this.save();
      }
    } finally {
      this.confirmingUnsaved = false;
    }
  }
}
