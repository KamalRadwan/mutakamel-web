import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerBuildingSkyscraper } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import { OrganizationWriteApi, type CreateCompanyBody } from '../../shared/organization-write.api';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { staffErrorMessage } from '../../shared/staff.api';
import { CODE_PATTERN, Company, Currency, OrgStatus, STAFF_LIMITS } from '../../shared/staff.model';

interface CompanyPatch {
  name?: string;
  legalName?: string | null;
  taxNumber?: string | null;
  currencyCode?: string;
  status?: OrgStatus;
}

@Component({
  selector: 'app-company-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, SeatImpact, StatusBadge, Switch],
  providers: [provideIcons({ tablerArrowBackUp, tablerBuildingSkyscraper })],
  templateUrl: './company-modal.html',
})
export class CompanyModal {
  private static nextId = 0;
  protected readonly uid = `company-modal-${++CompanyModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly session = inject(StaffSession);
  private readonly organization = inject(OrganizationWriteApi);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canEdit = input(true, { alias: 'canManage' });
  readonly canCreate = input(false);
  readonly canManage = computed(() => this.mode() === 'create' ? this.canCreate() : this.canEdit());
  readonly currencies = input<Currency[]>([]);

  readonly saved = output<{ company: Company; isNew: boolean }>();
  readonly deleteRequested = output<Company>();
  readonly deactivateBlocked = output<{ company: Company; blockers: string[] }>();
  readonly unavailable = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseCompany = signal<Company | null>(null);
  protected readonly saving = signal(false);
  protected readonly seatBlocked = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly statusSeatChanges = computed<SeatChange[] | null>(() => {
    const base = this.baseCompany();
    if (this.mode() !== 'edit' || !base) return null;
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    if (nextStatus === base.status) return null;
    return [{ kind: 'ORG_STATUS', companyId: base.id, status: nextStatus }];
  });
  protected readonly statusBlocked = computed(
    () => this.mode() === 'edit' && this.baseCompany()?.status === 'INACTIVE' && this.isActive() && this.seatBlocked(),
  );

  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly legalName = signal('');
  protected readonly taxNumber = signal('');
  protected readonly currencyCode = signal('');
  protected readonly isActive = signal(true);

  protected readonly touched = signal<{
    code?: boolean;
    name?: boolean;
    legalName?: boolean;
    taxNumber?: boolean;
  }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
  protected readonly currencyServerError = signal<string | null>(null);
  private readonly serverFields = signal<Record<string, string[]>>({});

  private allowClose = false;
  private confirmingDiscard = false;
  private lastPayloadSignature = '';
  private lastIdempotencyKey = '';
  private cascadeIdempotencyKey = '';

  protected readonly nameCount = computed(() => Array.from(this.name()).length);
  protected readonly legalNameCount = computed(() => Array.from(this.legalName()).length);

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const active = this.currencies().filter((c) => c.status === 'ACTIVE');
    const code = this.currencyCode();
    if (!this.canManage() && code && !active.some((currency) => currency.code === code)) {
      return [{ value: code, label: code }];
    }
    return [
      ...(this.mode() === 'edit' && this.baseCompany()?.currencyCode
        ? [] : [{ value: '', label: this.transloco.translate('companies.fields.currencyDefault') }]),
      ...active.map((currency) => ({
        value: currency.code,
        label: `${currency.code} — ${currency.name}`,
      })),
    ];
  });

  protected readonly dirty = computed(() => {
    if (!this.canManage()) return false;
    const trimmedName = this.name().trim();
    const trimmedLegal = this.legalName().trim();
    const trimmedTax = this.taxNumber().trim();
    const currency = this.currencyCode();

    if (this.mode() === 'create') {
      return (
        this.code().trim() !== '' ||
        trimmedName !== '' ||
        trimmedLegal !== '' ||
        trimmedTax !== '' ||
        currency !== ''
      );
    }

    const base = this.baseCompany();
    if (!base) return false;
    return (
      trimmedName !== base.name ||
      (trimmedLegal || null) !== base.legalName ||
      (trimmedTax || null) !== base.taxNumber ||
      (currency || null) !== base.currencyCode ||
      (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status
    );
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server) return server;
    if (this.mode() !== 'create') return null;
    if (!this.submitAttempted() && !this.touched().code) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('companies.validation.required');
    if (trimmed.length > STAFF_LIMITS.code) {
      return this.transloco.translate('companies.validation.maxLength', { max: STAFF_LIMITS.code });
    }
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('companies.validation.codePattern');
    }
    return null;
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    const server = this.serverFields()['name']?.[0];
    if (server) return server;
    if (!this.submitAttempted() && !this.touched().name) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('companies.validation.required');
    if (Array.from(trimmed).length > STAFF_LIMITS.name) {
      return this.transloco.translate('companies.validation.maxLength', { max: STAFF_LIMITS.name });
    }
    return null;
  });

  protected readonly legalNameError = computed(() => {
    this.i18n();
    const server = this.serverFields()['legalName']?.[0];
    if (server) return server;
    if (!this.submitAttempted() && !this.touched().legalName) return null;
    const trimmed = this.legalName().trim();
    if (Array.from(trimmed).length > STAFF_LIMITS.legalName) {
      return this.transloco.translate('companies.validation.maxLength', { max: STAFF_LIMITS.legalName });
    }
    return null;
  });

  protected readonly taxError = computed(() => {
    this.i18n();
    const server = this.serverFields()['taxNumber']?.[0];
    if (server) return server;
    if (!this.submitAttempted() && !this.touched().taxNumber) return null;
    const trimmed = this.taxNumber().trim();
    if (Array.from(trimmed).length > STAFF_LIMITS.taxNumber) {
      return this.transloco.translate('companies.validation.maxLength', { max: STAFF_LIMITS.taxNumber });
    }
    return null;
  });

  protected readonly currencyError = computed(() => this.currencyServerError());

  openCreate(): void {
    this.allowClose = false;
    this.mode.set('create');
    this.baseCompany.set(null);
    this.code.set('');
    this.name.set('');
    this.legalName.set('');
    this.taxNumber.set('');
    this.currencyCode.set('');
    this.isActive.set(true);
    this.seatBlocked.set(false);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    this.focusControl(`#${this.uid}-code`);
  }

  openEdit(company: Company): void {
    this.allowClose = false;
    this.mode.set('edit');
    this.baseCompany.set(company);
    this.seatBlocked.set(false);
    this.applyCompanyToForm(company);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    if (this.canManage()) {
      this.focusControl(`#${this.uid}-name`);
    }
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.baseCompany()?.id ?? null;
  }

  syncCompany(updated: Company): void {
    if (this.baseCompany()?.id !== updated.id) return;
    this.baseCompany.set(updated);
    this.applyCompanyToForm(updated);
    this.resetValidation();
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() !== 'create') return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      inputEl.value = upper;
    }
    this.code.set(upper);
    this.codeServerError.set(null);
  }

  protected onNameInput(event: Event): void {
    if (!this.canManage()) return;
    this.name.set((event.target as HTMLInputElement).value);
    this.serverFields.update((fields) => ({ ...fields, name: [] }));
  }

  protected onLegalNameInput(event: Event): void {
    if (!this.canManage()) return;
    this.legalName.set((event.target as HTMLInputElement).value);
    this.serverFields.update((fields) => ({ ...fields, legalName: [] }));
  }

  protected onTaxInput(event: Event): void {
    if (!this.canManage()) return;
    this.taxNumber.set((event.target as HTMLInputElement).value);
    this.serverFields.update((fields) => ({ ...fields, taxNumber: [] }));
  }

  protected onCurrencyChange(next: string): void {
    if (!this.canManage() || this.saving() || (!next && this.baseCompany()?.currencyCode)) return;
    this.currencyCode.set(next);
    this.currencyServerError.set(null);
  }

  protected markTouched(field: 'code' | 'name' | 'legalName' | 'taxNumber'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected undo(): void {
    const base = this.baseCompany();
    if (!base) return;
    this.seatBlocked.set(false);
    this.applyCompanyToForm(base);
    this.resetValidation();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving() || this.statusBlocked()) return;

    this.submitAttempted.set(true);
    this.codeServerError.set(null);
    this.currencyServerError.set(null);
    this.serverFields.set({});

    if (this.codeError() || this.nameError() || this.legalNameError() || this.taxError()) {
      return;
    }

    const trimmedName = this.name().trim();
    const trimmedLegal = this.legalName().trim();
    const trimmedTax = this.taxNumber().trim();
    const currency = this.currencyCode();

    if (this.mode() === 'create') {
      const trimmedCode = this.code().trim();
      const body: CreateCompanyBody = {
        code: trimmedCode,
        name: trimmedName,
      };
      if (trimmedLegal) body.legalName = trimmedLegal;
      if (trimmedTax) body.taxNumber = trimmedTax;
      if (currency) body.currencyCode = currency;

      this.saving.set(true);
      try {
        const created = await this.organization.createCompany(body, this.idempotencyKeyFor('create', body));
        this.resetIdempotency();
        this.saved.emit({ company: created, isNew: true });
        this.notify.success(this.transloco.translate('companies.toast.created'));
        this.closeImmediate();
      } catch (error) {
        this.handleSaveError(error, false);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const base = this.baseCompany();
    if (!base) return;

    const patch: CompanyPatch = {};
    if (trimmedName !== base.name) patch.name = trimmedName;
    const nextLegal = trimmedLegal || null;
    if (nextLegal !== base.legalName) patch.legalName = nextLegal;
    const nextTax = trimmedTax || null;
    if (nextTax !== base.taxNumber) patch.taxNumber = nextTax;
    if (currency && currency !== base.currencyCode) patch.currencyCode = currency;
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    const isDeactivating = base.status === 'ACTIVE' && nextStatus === 'INACTIVE';
    if (nextStatus !== base.status) patch.status = nextStatus;

    if (Object.keys(patch).length === 0) return;

    this.saving.set(true);
    try {
      let updated: Company;
      try {
        updated = await this.organization.updateCompany(base.id, patch, this.idempotencyKeyFor(base.id, patch));
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed || !this.canManage()) return;
        updated = await this.organization.updateCompany(base.id, patch, this.idempotencyKeyFor(base.id, patch, true), {
          confirmAddonCascade: true,
        });
      }
      this.resetIdempotency();
      this.saved.emit({ company: updated, isNew: false });
      this.notify.success(this.transloco.translate('companies.toast.saved'));
      this.closeImmediate();
    } catch (error) {
      this.handleSaveError(error, isDeactivating, base);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.canManage() && this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected requestDelete(): void {
    const base = this.baseCompany();
    if (!base || !this.canManage() || this.saving()) return;
    this.deleteRequested.emit(base);
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.baseCompany.set(null);
    this.seatBlocked.set(false);
    this.resetValidation();
  }

  private handleSaveError(error: unknown, isDeactivating: boolean, base?: Company): void {
    const code = errorCodeOf(error);
    if (isValidationError(error)) {
      const fields = fieldErrorsOf(error);
      this.serverFields.set(fields);
      this.codeServerError.set(fields['code']?.[0] ?? null);
      this.currencyServerError.set(fields['currencyCode']?.[0] ?? null);
      if (!fields['_']?.length && Object.keys(fields).some((field) =>
        ['code', 'name', 'legalName', 'taxNumber', 'currencyCode'].includes(field))) return;
    }
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'CURRENCY_NOT_ENABLED') {
      this.currencyServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_NODE_NOT_EMPTY' && isDeactivating && base) {
      this.isActive.set(true);
      const rawBlockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      const blockers = Array.isArray(rawBlockers) ? rawBlockers.map(String) : [];
      this.deactivateBlocked.emit({ company: base, blockers });
      return;
    }
    if (code === 'ORG_NODE_NOT_FOUND') {
      this.closeImmediate();
      this.unavailable.emit();
    }
    if (error instanceof ApiError && error.status === 0) return;
    const message = this.resolveError(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
    else this.notify.error(message);
  }

  private applyCompanyToForm(company: Company): void {
    this.code.set(company.code);
    this.name.set(company.name);
    this.legalName.set(company.legalName ?? '');
    this.taxNumber.set(company.taxNumber ?? '');
    this.currencyCode.set(company.currencyCode ?? '');
    this.isActive.set(company.status === 'ACTIVE');
  }

  private resetValidation(): void {
    this.serverFields.set({});
    this.touched.set({});
    this.submitAttempted.set(false);
    this.codeServerError.set(null);
    this.currencyServerError.set(null);
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
    this.cascadeIdempotencyKey = '';
  }

  private idempotencyKeyFor(target: string, payload: unknown, cascade = false): string {
    const signature = `${target}:${JSON.stringify(payload)}`;
    if (signature !== this.lastPayloadSignature) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
      this.cascadeIdempotencyKey = '';
    }
    if (cascade) return this.cascadeIdempotencyKey ||= newIdempotencyKey();
    return this.lastIdempotencyKey;
  }

  private resolveError(error: unknown): string {
    const seatMsg = seatErrorMessage(this.transloco, error);
    if (seatMsg) return seatMsg;
    return staffErrorMessage(error, 'staff', this.transloco, 'write');
  }

  private focusControl(selector: string): void {
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
