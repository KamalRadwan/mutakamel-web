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
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { FormField, form, readonly, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerHash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { errorCodeOf, errorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { coreFieldErrors } from '../../core-response.model';

/** CreateNumberingSequenceDto / UpdateNumberingSequenceDto field -> form field. */
const DTO_FIELD_MAP: Record<string, NumberingField> = {
  code: 'code',
  companyId: 'companyId',
  prefix: 'prefix',
  padding: 'padding',
  startValue: 'counter',
  nextValue: 'counter',
};
import { createNumbering, peekNumbering, updateNumbering } from '../numbering.api';
import {
  CompanyOption,
  CreateNumberingBody,
  NUMBERING_CODE_MAX,
  NUMBERING_CODE_PATTERN,
  NUMBERING_PADDING_MAX,
  NUMBERING_PADDING_MIN,
  NUMBERING_PREFIX_MAX,
  NUMBERING_PREFIX_PATTERN,
  NumberingAccess,
  NumberingSequence,
  UpdateNumberingBody,
  canManageScope,
  companyNameIn,
  compareCounters,
  formatNumber,
  isCounterString,
  stripLeadingZeros,
} from '../numbering.model';

type NumberingField = 'code' | 'companyId' | 'prefix' | 'padding' | 'counter';

interface NumberingDraft {
  code: string;
  companyId: string;
  prefix: string;
  padding: string;
  counter: string;
}

const WORKSPACE_SCOPE = '__workspace__';
const DIGITS_PATTERN = /^[0-9]+$/;

const EMPTY_DRAFT: NumberingDraft = {
  code: '',
  companyId: '',
  prefix: '',
  padding: '5',
  counter: '1',
};

function parsePadding(raw: string): number | null {
  const trimmed = raw.trim();
  if (!DIGITS_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (
    !Number.isInteger(parsed) ||
    parsed < NUMBERING_PADDING_MIN ||
    parsed > NUMBERING_PADDING_MAX
  ) {
    return null;
  }
  return parsed;
}

@Component({
  selector: 'app-numbering-modal',
  imports: [
    FormField,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    SettingsNotice,
  ],
  providers: [provideIcons({ tablerHash })],
  templateUrl: './numbering-modal.html',
})
export class NumberingModal {
  private static nextId = 0;
  protected readonly uid = `numbering-modal-${++NumberingModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly companies = input<CompanyOption[]>([]);
  readonly access = input<NumberingAccess>({ tenantWideManage: false, manageCompanyIds: [] });
  readonly canManage = input(true);

  readonly saved = output<{ sequence: NumberingSequence; isNew: boolean }>();
  readonly notFound = output<string>();

  protected readonly codeMax = NUMBERING_CODE_MAX;
  protected readonly prefixMax = NUMBERING_PREFIX_MAX;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseSequence = signal<NumberingSequence | null>(null);
  protected readonly serverErrors = signal<Partial<Record<NumberingField, string>>>({});
  /** CORE_VALIDATION_FAILED messages per form field, already in the request language. */
  private readonly serverTexts = signal<Partial<Record<NumberingField, string>>>({});
  protected readonly peekLoading = signal(false);
  protected readonly peekFormatted = signal<string | null>(null);
  protected readonly peekStatus = signal<'idle' | 'ready' | 'notFound' | 'failed'>('idle');

  private readonly defaultCreateCompany = signal('');
  private readonly draft = signal<NumberingDraft>({ ...EMPTY_DRAFT });

  protected readonly canEditCurrent = computed(() => {
    if (!this.canManage()) return false;
    const access = this.access();
    if (this.mode() === 'create') {
      return access.tenantWideManage || access.manageCompanyIds.length > 0;
    }
    const base = this.baseSequence();
    return base ? canManageScope(access, base.companyId) : false;
  });

  protected readonly numberingForm = form(this.draft, (path) => {
    readonly(path.code, { when: () => this.mode() === 'edit' || !this.canEditCurrent() });
    readonly(path.companyId, { when: () => this.mode() === 'edit' || !this.canEditCurrent() });
    readonly(path.prefix, { when: () => !this.canEditCurrent() });
    readonly(path.padding, { when: () => !this.canEditCurrent() });
    readonly(path.counter, { when: () => !this.canEditCurrent() });

    validate(path.code, ({ value }) => {
      if (this.mode() !== 'create') return undefined;
      const upper = value().trim().toUpperCase();
      if (!upper) return { kind: 'codeRequired' };
      if (upper.length > NUMBERING_CODE_MAX || !NUMBERING_CODE_PATTERN.test(upper)) {
        return { kind: 'codeFormat' };
      }
      return undefined;
    });

    validate(path.companyId, ({ value }) => {
      if (this.mode() !== 'create') return undefined;
      const chosen = value();
      if (!chosen) return { kind: 'companyRequired' };
      if (chosen === WORKSPACE_SCOPE && !this.access().tenantWideManage) {
        return { kind: 'companyRequired' };
      }
      return undefined;
    });

    validate(path.prefix, ({ value }) => {
      const raw = value();
      if (raw === '') return undefined;
      if (Array.from(raw).length > NUMBERING_PREFIX_MAX || !NUMBERING_PREFIX_PATTERN.test(raw)) {
        return { kind: 'prefixFormat' };
      }
      return undefined;
    });

    validate(path.padding, ({ value }) => {
      return parsePadding(value()) === null ? { kind: 'paddingRange' } : undefined;
    });

    validate(path.counter, ({ value }) => {
      const raw = value();
      if (!isCounterString(raw)) {
        return { kind: 'counterFormat' };
      }
      if (this.mode() === 'edit') {
        const base = this.baseSequence();
        if (base && compareCounters(raw, base.nextValue) < 0) {
          return { kind: 'counterLower' };
        }
      }
      return undefined;
    });
  });

  protected readonly saving = computed(() => this.numberingForm().submitting());
  protected readonly codeCount = computed(() => Array.from(this.draft().code.trim()).length);
  protected readonly prefixCount = computed(() => Array.from(this.draft().prefix).length);

  protected readonly createCompanyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const access = this.access();
    const manageable = new Set(access.manageCompanyIds);
    const options: DropdownOption<string>[] = [];
    if (access.tenantWideManage) {
      options.push({
        value: WORKSPACE_SCOPE,
        label: this.transloco.translate('wsNumbering.fields.allWorkspace'),
      });
    }
    for (const company of this.companies()) {
      if (company.active && manageable.has(company.id)) {
        options.push({
          value: company.id,
          label: companyNameIn(company, lang),
        });
      }
    }
    return options;
  });

  protected readonly editCompanyDisplay = computed(() => {
    this.i18n();
    const base = this.baseSequence();
    if (!base) return '';
    if (base.companyId === null) {
      return this.transloco.translate('wsNumbering.fields.allWorkspace');
    }
    const match = this.companies().find((company) => company.id === base.companyId);
    if (match) {
      return companyNameIn(match, this.language());
    }
    return this.transloco.translate('wsNumbering.scope.unknown');
  });

  protected readonly companyDescribedBy = computed(() => {
    const base = `${this.uid}-companyId-hint`;
    return this.errorOf('companyId') ? `${base} ${this.uid}-companyId-error` : base;
  });

  protected readonly draftPreview = computed<string | null>(() => {
    const value = this.draft();
    if (value.prefix !== '' && (Array.from(value.prefix).length > NUMBERING_PREFIX_MAX || !NUMBERING_PREFIX_PATTERN.test(value.prefix))) {
      return null;
    }
    const padding = parsePadding(value.padding);
    if (padding === null) return null;
    if (!isCounterString(value.counter)) return null;
    return formatNumber(value.prefix || null, padding, stripLeadingZeros(value.counter));
  });

  protected readonly dirty = computed(() => {
    if (!this.canEditCurrent()) return false;
    const current = this.draft();
    if (this.mode() === 'create') {
      return (
        current.code.trim() !== '' ||
        current.companyId !== this.defaultCreateCompany() ||
        current.prefix !== '' ||
        current.padding.trim() !== '5' ||
        current.counter !== '1'
      );
    }
    const base = this.baseSequence();
    if (!base) return false;
    const prefixDirty = current.prefix !== (base.prefix ?? '');
    const paddingTrimmed = current.padding.trim();
    const paddingDirty = DIGITS_PATTERN.test(paddingTrimmed)
      ? Number(paddingTrimmed) !== base.padding
      : paddingTrimmed !== String(base.padding);
    const counterDirty = isCounterString(current.counter)
      ? stripLeadingZeros(current.counter) !== base.nextValue
      : current.counter !== base.nextValue;
    return prefixDirty || paddingDirty || counterDirty;
  });

  private allowClose = false;
  private confirmingDiscard = false;
  private peekSeq = 0;
  private pendingIdem: { signature: string; key: string } | null = null;

  openCreate(defaults?: { companyId?: string | null }): void {
    this.allowClose = false;
    this.mode.set('create');
    this.baseSequence.set(null);
    this.serverErrors.set({});
    this.serverTexts.set({});
    this.peekSeq++;
    this.peekLoading.set(false);
    this.peekFormatted.set(null);
    this.peekStatus.set('idle');
    this.pendingIdem = null;

    const defaultCompany = this.resolveDefaultCreateCompany(defaults?.companyId);
    this.defaultCreateCompany.set(defaultCompany);
    this.numberingForm().reset({
      ...EMPTY_DRAFT,
      companyId: defaultCompany,
    });

    this.modal().open();
    this.focusControl('code');
  }

  openEdit(sequence: NumberingSequence): void {
    this.allowClose = false;
    this.mode.set('edit');
    this.baseSequence.set(sequence);
    this.serverErrors.set({});
    this.serverTexts.set({});
    this.pendingIdem = null;

    this.numberingForm().reset({
      code: sequence.code,
      companyId: sequence.companyId ?? WORKSPACE_SCOPE,
      prefix: sequence.prefix ?? '',
      padding: String(sequence.padding),
      counter: sequence.nextValue,
    });

    this.modal().open();
    void this.loadPeek(sequence.code, sequence.companyId);
    this.focusControl(this.canEditCurrent() ? 'prefix' : 'close-btn');
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.peekSeq++;
    this.modal().close();
  }

  protected errorOf(field: NumberingField): string | null {
    this.i18n();
    const serverText = this.serverTexts()[field];
    if (serverText) return serverText;
    const serverKey = this.serverErrors()[field];
    if (serverKey) {
      return this.transloco.translate(serverKey);
    }
    const state = this.numberingForm[field]();
    if (!state.touched()) return null;
    const error = state.errors()[0];
    if (!error) return null;
    if (error.kind === 'counterLower') {
      return this.transloco.translate('wsNumbering.validation.counterLower', {
        current: this.baseSequence()?.nextValue ?? '',
      });
    }
    return this.transloco.translate(`wsNumbering.validation.${error.kind}`);
  }

  protected onCodeInput(event: Event): void {
    if (this.mode() === 'edit' || !this.canEditCurrent()) return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      const start = inputEl.selectionStart;
      const end = inputEl.selectionEnd;
      inputEl.value = upper;
      if (start !== null && end !== null) {
        inputEl.setSelectionRange(start, end);
      }
      this.numberingForm.code().value.set(upper);
    }
    this.clearServerError('code');
  }

  protected onCompanyChange(value: string): void {
    if (this.mode() !== 'create' || !this.canEditCurrent()) return;
    this.numberingForm.companyId().value.set(value);
    this.numberingForm.companyId().markAsTouched();
    this.clearServerError('companyId');
  }

  protected onCounterInput(event: Event): void {
    if (!this.canEditCurrent()) return;
    const inputEl = event.target as HTMLInputElement;
    const digits = inputEl.value.replace(/[^0-9]/g, '').slice(0, 16);
    if (inputEl.value !== digits) {
      inputEl.value = digits;
      this.numberingForm.counter().value.set(digits);
    }
    this.clearServerError('counter');
  }

  protected clearServerError(field: NumberingField): void {
    if (!this.serverErrors()[field] && !this.serverTexts()[field]) return;
    this.serverErrors.update((current) => ({ ...current, [field]: undefined }));
    this.serverTexts.update((current) => ({ ...current, [field]: undefined }));
  }

  protected retryPeek(): void {
    const base = this.baseSequence();
    if (!base) return;
    void this.loadPeek(base.code, base.companyId);
  }

  protected undo(): void {
    if (this.saving()) return;
    const base = this.baseSequence();
    if (!base) return;
    this.serverErrors.set({});
    this.serverTexts.set({});
    this.pendingIdem = null;
    this.numberingForm().reset({
      code: base.code,
      companyId: base.companyId ?? WORKSPACE_SCOPE,
      prefix: base.prefix ?? '',
      padding: String(base.padding),
      counter: base.nextValue,
    });
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    if (!this.canEditCurrent() || this.saving()) return;
    if (this.mode() === 'edit' && !this.dirty()) return;

    this.serverErrors.set({});
    this.serverTexts.set({});

    void submit(this.numberingForm, {
      action: async () => {
        const value = this.draft();
        try {
          if (this.mode() === 'create') {
            const body: CreateNumberingBody = {
              code: value.code.trim().toUpperCase(),
              padding: parsePadding(value.padding) ?? 5,
              startValue: Number(stripLeadingZeros(value.counter)),
            };
            if (value.prefix !== '') {
              body.prefix = value.prefix;
            }
            if (value.companyId && value.companyId !== WORKSPACE_SCOPE) {
              body.companyId = value.companyId;
            }
            const key = this.keyForPayload('create', body);
            const created = await createNumbering(body, key);
            this.pendingIdem = null;
            this.notify.success(this.transloco.translate('wsNumbering.toast.created'));
            this.saved.emit({ sequence: created, isNew: true });
            this.closeImmediate();
            return undefined;
          }

          const base = this.baseSequence();
          if (!base) return undefined;

          const patch: UpdateNumberingBody = {};
          if (value.prefix !== (base.prefix ?? '')) {
            patch.prefix = value.prefix;
          }
          const nextPadding = parsePadding(value.padding);
          if (nextPadding !== null && nextPadding !== base.padding) {
            patch.padding = nextPadding;
          }
          const normalizedCounter = stripLeadingZeros(value.counter);
          if (normalizedCounter !== base.nextValue) {
            patch.nextValue = Number(normalizedCounter);
          }

          if (Object.keys(patch).length === 0) {
            this.closeImmediate();
            return undefined;
          }

          const key = this.keyForPayload(`update:${base.id}`, patch);
          const updated = await updateNumbering(base.id, patch, key);
          this.pendingIdem = null;
          this.baseSequence.set(updated);
          this.notify.success(this.transloco.translate('wsNumbering.toast.updated'));
          this.saved.emit({ sequence: updated, isNew: false });
          this.closeImmediate();
          return undefined;
        } catch (error) {
          this.handleSaveError(error);
          return undefined;
        }
      },
      onInvalid: () => this.focusFirstInvalid(),
    });
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.peekSeq++;
    this.baseSequence.set(null);
    this.pendingIdem = null;
  }

  private resolveDefaultCreateCompany(requested?: string | null): string {
    const options = this.createCompanyOptions();
    if (requested !== undefined) {
      if (requested === null) {
        if (options.some((opt) => opt.value === WORKSPACE_SCOPE)) {
          return WORKSPACE_SCOPE;
        }
      } else if (options.some((opt) => opt.value === requested)) {
        return requested;
      }
    }
    if (options.some((opt) => opt.value === WORKSPACE_SCOPE)) {
      return WORKSPACE_SCOPE;
    }
    return options[0]?.value ?? '';
  }

  private async loadPeek(code: string, companyId: string | null): Promise<void> {
    const seq = ++this.peekSeq;
    this.peekLoading.set(true);
    this.peekFormatted.set(null);
    this.peekStatus.set('idle');
    try {
      const peek = await peekNumbering(code, companyId);
      if (seq !== this.peekSeq) return;
      this.peekFormatted.set(peek.formatted);
      this.peekStatus.set('ready');
    } catch (error) {
      if (seq !== this.peekSeq) return;
      if (errorCodeOf(error) === 'SEQUENCE_NOT_FOUND') {
        this.peekStatus.set('notFound');
      } else {
        this.peekStatus.set('failed');
      }
    } finally {
      if (seq === this.peekSeq) {
        this.peekLoading.set(false);
      }
    }
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'SEQUENCE_CODE_TAKEN') {
      this.serverErrors.set({ code: 'wsNumbering.errors.SEQUENCE_CODE_TAKEN' });
      this.focusControl('code');
      return;
    }
    if (code === 'COMPANY_INVALID') {
      this.serverErrors.set({ companyId: 'wsNumbering.errors.COMPANY_INVALID' });
      this.focusControl('companyId');
      return;
    }
    if (code === 'SEQUENCE_VALUE_INVALID') {
      this.serverErrors.set({ counter: 'wsNumbering.errors.SEQUENCE_VALUE_INVALID' });
      this.focusControl('counter');
      return;
    }
    const fields = coreFieldErrors(error);
    if (fields) {
      const texts: Partial<Record<NumberingField, string>> = {};
      for (const [dtoField, messages] of Object.entries(fields)) {
        const field = DTO_FIELD_MAP[dtoField];
        if (field && !texts[field]) texts[field] = messages[0];
      }
      this.serverTexts.set(texts);
      const first = Object.keys(texts)[0] as NumberingField | undefined;
      if (first) this.focusControl(first);
      if (!first || Object.keys(fields).some((f) => !DTO_FIELD_MAP[f])) {
        this.notify.error(errorMessage(error, 'wsNumbering', this.transloco));
      }
      return;
    }
    if (code === 'SEQUENCE_NOT_FOUND' && this.mode() === 'edit') {
      const id = this.baseSequence()?.id ?? '';
      this.notify.error(errorMessage(error, 'wsNumbering', this.transloco));
      this.closeImmediate();
      this.notFound.emit(id);
      return;
    }
    this.notify.error(errorMessage(error, 'wsNumbering', this.transloco));
  }

  private keyForPayload(op: string, payload: unknown): string {
    const signature = `${op}:${JSON.stringify(payload)}`;
    if (!this.pendingIdem || this.pendingIdem.signature !== signature) {
      this.pendingIdem = { signature, key: newIdempotencyKey() };
    }
    return this.pendingIdem.key;
  }

  private focusFirstInvalid(): void {
    const order: readonly NumberingField[] = ['code', 'companyId', 'prefix', 'padding', 'counter'];
    for (const field of order) {
      if (this.numberingForm[field]().invalid()) {
        this.focusControl(field);
        return;
      }
    }
  }

  private focusControl(suffix: string): void {
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-${suffix}`)?.focus();
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
