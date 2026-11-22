import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerFileText, tablerLoader2, tablerLock, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf } from '../../../shared/trade-api';
import { createTerm, deleteTerm, getTerm, makeDefaultTerm, updateTerm } from '../../../shared/terms/terms.api';
import { settingsErrorText } from '../../settings-errors';
import { SettingsMutationKeys } from '../../settings-mutation-keys';
import {
  INCOTERMS,
  TERM_CODE_PATTERN,
  TERM_LIMITS,
  TERM_SIDES,
  type Incoterm,
  type TermInput,
  type TermPatch,
  type TermSide,
  type TermType,
  type TradeTerm,
} from '../../../shared/terms/terms.model';
import { translationEvents } from '../../../../../core/i18n/translation-events';

type TermField = 'code' | 'nameAr' | 'nameEn' | 'dueDays' | 'sortOrder' | 'textAr' | 'textEn';

export type RowConflictAction =
  | { kind: 'active'; isActive: boolean }
  | { kind: 'makeDefault' }
  | { kind: 'delete' };

interface TermFormValue {
  code: string;
  side: TermSide;
  dueDays: string;
  incotermCode: Incoterm | '';
  nameAr: string;
  nameEn: string;
  sortOrder: string;
  textAr: string;
  textEn: string;
  isDefault: boolean;
  isActive: boolean;
}

const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 1_000_000;

function createEmptyForm(defaultOrder: number, defaultSide: TermSide): TermFormValue {
  return {
    code: '',
    side: defaultSide,
    dueDays: '',
    incotermCode: '',
    nameAr: '',
    nameEn: '',
    sortOrder: String(defaultOrder),
    textAr: '',
    textEn: '',
    isDefault: false,
    isActive: true,
  };
}

function termToForm(term: TradeTerm): TermFormValue {
  return {
    code: term.code,
    side: term.side,
    dueDays: term.dueDays !== null ? String(term.dueDays) : '',
    incotermCode: term.incotermCode ?? '',
    nameAr: term.localizedNames['ar'] ?? '',
    nameEn: term.localizedNames['en'] ?? '',
    sortOrder: String(term.sortOrder),
    textAr: term.localizedTexts['ar'] ?? '',
    textEn: term.localizedTexts['en'] ?? '',
    isDefault: term.isDefault,
    isActive: term.isActive,
  };
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function computeEditPatch(base: TradeTerm, value: TermFormValue): TermPatch {
  const patch: TermPatch = {};

  if (value.side !== base.side) {
    patch.side = value.side;
  }

  const nameAr = value.nameAr.trim();
  const nameEn = value.nameEn.trim();
  if (nameAr !== (base.localizedNames['ar'] ?? '') || nameEn !== (base.localizedNames['en'] ?? '')) {
    patch.localizedNames = { ...base.localizedNames, ar: nameAr, en: nameEn };
  }

  const textAr = value.textAr.trim();
  const textEn = value.textEn.trim();
  if (textAr !== (base.localizedTexts['ar'] ?? '') || textEn !== (base.localizedTexts['en'] ?? '')) {
    patch.localizedTexts = { ...base.localizedTexts, ar: textAr, en: textEn };
  }

  if (base.termType === 'PAYMENT') {
    const dueTrimmed = value.dueDays.trim();
    const dueVal = dueTrimmed === '' ? null : parseWholeNumber(dueTrimmed);
    if (dueTrimmed === '' ? base.dueDays !== null : dueVal !== null && dueVal !== base.dueDays) {
      patch.dueDays = dueVal;
    }
  }

  if (base.termType === 'DELIVERY') {
    const nextIncoterm: Incoterm | null = value.incotermCode || null;
    if (nextIncoterm !== base.incotermCode) {
      patch.incotermCode = nextIncoterm;
    }
  }

  const orderVal = parseWholeNumber(value.sortOrder);
  if (orderVal !== null && orderVal !== base.sortOrder) {
    patch.sortOrder = orderVal;
  }

  if (value.isActive !== base.isActive) {
    patch.isActive = value.isActive;
  }

  return patch;
}

@Component({
  selector: 'app-term-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    UnsavedDialog,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-settings', alias: 'tset' },
      { scope: 'trade-settings-terms', alias: 'tterms' },
    ),
    provideIcons({ tablerAlertTriangle, tablerFileText, tablerLoader2, tablerLock, tablerTrash }),
  ],
  templateUrl: './term-modal.html',
})
export class TermModal {
  private static nextId = 0;
  protected readonly uid = `term-modal-${++TermModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('termModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  readonly canManage = input(true);
  readonly saved = output<TradeTerm>();
  readonly reloaded = output<TradeTerm>();
  readonly deleted = output<string>();

  protected readonly limits = TERM_LIMITS;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly termType = signal<TermType>('PAYMENT');
  protected readonly baseTerm = signal<TradeTerm | null>(null);
  protected readonly form = signal<TermFormValue>(createEmptyForm(10, 'SALES'));
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly conflictBusy = signal(false);

  private readonly touched = signal<Partial<Record<TermField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverCodeErrorKey = signal<string | null>(null);
  private readonly pendingRowConflict = signal<RowConflictAction | null>(null);

  private defaultOrder = 10;
  private defaultSide: TermSide = 'SALES';
  private allowClose = false;
  private confirmingDiscard = false;
  private destroyed = false;
  private readonly mutationKeys = new SettingsMutationKeys();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const lang = this.language();
    if (this.mode() === 'create') {
      return this.transloco.translate('tterms.modal.newTitle');
    }
    const base = this.baseTerm();
    if (!base) return '';
    return base.localizedNames[lang] || base.localizedNames['en'] || base.displayName || base.code;
  });

  protected readonly sideOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const disabled = !this.canManage() || this.saving() || this.deleting();
    return TERM_SIDES.map((value) => ({
      value,
      label: this.transloco.translate(`tset.sides.${value}`),
      disabled,
    }));
  });

  protected readonly incotermOptions = computed<DropdownOption<Incoterm | ''>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tterms.modal.incotermNone') },
      ...INCOTERMS.map((code) => ({
        value: code,
        label: `${code} · ${this.transloco.translate(`tset.incoterms.${code}`)}`,
      })),
    ];
  });

  protected readonly defaultSwitchDisabled = computed(
    () =>
      !this.canManage() ||
      this.saving() ||
      this.deleting() ||
      !this.form().isActive ||
      (this.mode() === 'edit' && Boolean(this.baseTerm()?.isDefault)),
  );

  protected readonly defaultHintKey = computed(() => {
    if (!this.form().isActive) return 'tterms.modal.hints.defaultInactive';
    if (this.mode() === 'edit' && this.baseTerm()?.isDefault) return 'tterms.modal.hints.defaultAlready';
    return 'tterms.modal.hints.default';
  });

  protected readonly validationErrors = computed<
    Partial<Record<TermField, { key: string; params?: Record<string, number> }>>
  >(() => {
    const value = this.form();
    const type = this.termType();
    const errors: Partial<Record<TermField, { key: string; params?: Record<string, number> }>> = {};

    if (this.mode() === 'create') {
      const code = value.code.trim().toUpperCase();
      if (!code) {
        errors.code = { key: 'required' };
      } else if (!TERM_CODE_PATTERN.test(code)) {
        errors.code = { key: 'codePattern' };
      }
    }

    const nameAr = value.nameAr.trim();
    if (!nameAr) {
      errors.nameAr = { key: 'required' };
    } else if (nameAr.length > TERM_LIMITS.nameMax) {
      errors.nameAr = { key: 'maxLength', params: { max: TERM_LIMITS.nameMax } };
    }

    const nameEn = value.nameEn.trim();
    if (!nameEn) {
      errors.nameEn = { key: 'required' };
    } else if (nameEn.length > TERM_LIMITS.nameMax) {
      errors.nameEn = { key: 'maxLength', params: { max: TERM_LIMITS.nameMax } };
    }

    if (type === 'PAYMENT') {
      const dueRaw = value.dueDays.trim();
      if (dueRaw !== '') {
        const parsed = parseWholeNumber(dueRaw);
        if (parsed === null || parsed < TERM_LIMITS.dueDaysMin || parsed > TERM_LIMITS.dueDaysMax) {
          errors.dueDays = {
            key: 'dueDaysRange',
            params: { min: TERM_LIMITS.dueDaysMin, max: TERM_LIMITS.dueDaysMax },
          };
        }
      }
    }

    const orderRaw = value.sortOrder.trim();
    if (!orderRaw) {
      errors.sortOrder = { key: 'required' };
    } else {
      const parsed = parseWholeNumber(orderRaw);
      if (parsed === null || parsed < SORT_ORDER_MIN || parsed > SORT_ORDER_MAX) {
        errors.sortOrder = {
          key: 'sortOrderRange',
          params: { min: SORT_ORDER_MIN, max: SORT_ORDER_MAX },
        };
      }
    }

    const textAr = value.textAr.trim();
    if (!textAr) {
      errors.textAr = { key: 'required' };
    } else if (textAr.length > TERM_LIMITS.textMax) {
      errors.textAr = { key: 'maxLength', params: { max: TERM_LIMITS.textMax } };
    }

    const textEn = value.textEn.trim();
    if (!textEn) {
      errors.textEn = { key: 'required' };
    } else if (textEn.length > TERM_LIMITS.textMax) {
      errors.textEn = { key: 'maxLength', params: { max: TERM_LIMITS.textMax } };
    }

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly editPatch = computed<TermPatch>(() => {
    const base = this.baseTerm();
    if (this.mode() !== 'edit' || !base) return {};
    return computeEditPatch(base, this.form());
  });

  protected readonly wantsMakeDefault = computed(
    () => this.form().isActive && this.form().isDefault && (this.mode() === 'create' || !this.baseTerm()?.isDefault),
  );

  protected readonly dirty = computed(() => {
    const value = this.form();
    if (this.mode() === 'edit') {
      const base = this.baseTerm();
      if (!base) return false;
      const dueChanged =
        base.termType === 'PAYMENT' && value.dueDays.trim() !== (base.dueDays !== null ? String(base.dueDays) : '');
      const incotermChanged = base.termType === 'DELIVERY' && (value.incotermCode || null) !== base.incotermCode;
      const orderChanged = value.sortOrder.trim() !== String(base.sortOrder);
      return (
        value.side !== base.side ||
        value.nameAr.trim() !== (base.localizedNames['ar'] ?? '') ||
        value.nameEn.trim() !== (base.localizedNames['en'] ?? '') ||
        value.textAr.trim() !== (base.localizedTexts['ar'] ?? '') ||
        value.textEn.trim() !== (base.localizedTexts['en'] ?? '') ||
        dueChanged ||
        incotermChanged ||
        orderChanged ||
        value.isActive !== base.isActive ||
        this.wantsMakeDefault()
      );
    }

    const orderChanged = value.sortOrder.trim() !== String(this.defaultOrder);
    return Boolean(
      value.code.trim() ||
        value.side !== this.defaultSide ||
        value.dueDays.trim() ||
        value.incotermCode !== '' ||
        value.nameAr.trim() ||
        value.nameEn.trim() ||
        value.textAr.trim() ||
        value.textEn.trim() ||
        orderChanged ||
        value.isDefault ||
        !value.isActive,
    );
  });

  openCreate(termType: TermType, nextOrder: number, defaultSide: TermSide = 'SALES'): void {
    this.mode.set('create');
    this.termType.set(termType);
    this.baseTerm.set(null);
    this.defaultOrder = nextOrder;
    this.defaultSide = defaultSide;
    this.form.set(createEmptyForm(nextOrder, defaultSide));
    this.mutationKeys.clearAll();
    this.pendingRowConflict.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(term: TradeTerm): void {
    this.mode.set('edit');
    this.termType.set(term.termType);
    this.baseTerm.set(term);
    this.form.set(termToForm(term));
    this.mutationKeys.clearAll();
    this.pendingRowConflict.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openConflictFromRow(term: TradeTerm, action: RowConflictAction): void {
    this.baseTerm.set(term);
    this.termType.set(term.termType);
    this.pendingRowConflict.set(action);
    this.conflictModal().open();
  }

  protected errorText(field: TermField): string | null {
    this.i18n();
    if (field === 'code' && this.serverCodeErrorKey()) {
      return this.transloco.translate(this.serverCodeErrorKey()!);
    }
    const err = this.validationErrors()[field];
    if (!err) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return this.transloco.translate(`tterms.validation.${err.key}`, err.params);
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() === 'edit') return;
    const target = event.target as HTMLInputElement;
    const upper = target.value.toUpperCase();
    if (target.value !== upper) target.value = upper;
    this.form.update((current) => ({ ...current, code: upper }));
    this.serverCodeErrorKey.set(null);
  }

  protected onFieldInput(
    field: 'nameAr' | 'nameEn' | 'dueDays' | 'sortOrder' | 'textAr' | 'textEn',
    event: Event,
  ): void {
    if (!this.canManage()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  protected setSide(value: string | null): void {
    if (!this.canManage() || this.saving() || this.deleting()) return;
    if (value !== 'SALES' && value !== 'PURCHASE' && value !== 'BOTH') return;
    this.form.update((current) => ({ ...current, side: value }));
  }

  protected setIncoterm(value: Incoterm | ''): void {
    if (!this.canManage() || this.saving() || this.deleting()) return;
    this.form.update((current) => ({ ...current, incotermCode: value }));
  }

  protected setDefault(checked: boolean): void {
    if (this.defaultSwitchDisabled()) return;
    this.form.update((current) => ({ ...current, isDefault: checked }));
  }

  protected setActive(checked: boolean): void {
    if (!this.canManage() || this.saving() || this.deleting()) return;
    const baseDefault = this.mode() === 'edit' ? Boolean(this.baseTerm()?.isDefault) : false;
    this.form.update((current) => ({
      ...current,
      isActive: checked,
      isDefault: checked ? current.isDefault || baseDefault : false,
    }));
  }

  protected markTouched(field: TermField): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected undo(): void {
    if (this.saving() || this.deleting()) return;
    const base = this.baseTerm();
    if (this.mode() === 'edit' && base) {
      this.form.set(termToForm(base));
    } else {
      this.form.set(createEmptyForm(this.defaultOrder, this.defaultSide));
    }
    this.mutationKeys.clearAll();
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving() || this.deleting()) return;
    if (!this.canManage() || !this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    void this.confirmModalClose();
  }

  protected onModalClosed(): void {
    if (this.saving() || this.deleting()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
  }

  protected async save(): Promise<boolean> {
    if (!this.canManage() || this.saving() || this.deleting() || !this.dirty()) return false;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return false;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const value = this.form();
        const type = this.termType();
        const dueRaw = value.dueDays.trim();
        const payload: TermInput = {
          termType: type,
          side: value.side,
          code: value.code.trim().toUpperCase(),
          localizedNames: { ar: value.nameAr.trim(), en: value.nameEn.trim() },
          localizedTexts: { ar: value.textAr.trim(), en: value.textEn.trim() },
          ...(type === 'PAYMENT' && dueRaw !== '' ? { dueDays: Number(dueRaw) } : {}),
          ...(type === 'DELIVERY' && value.incotermCode ? { incotermCode: value.incotermCode } : {}),
          sortOrder: Number(value.sortOrder.trim()),
          isActive: value.isActive,
        };
        let result = await createTerm(payload, this.mutationKeys.for('create', payload), this.scope);
        this.mutationKeys.clear('create');

        if (value.isActive && value.isDefault) {
          try {
            result = await this.makeDefault(result);
          } catch (defaultError) {
            this.mode.set('edit');
            this.baseTerm.set(result);
            this.form.set({ ...termToForm(result), isDefault: true });
            this.resetValidation();
            this.saved.emit(result);
            this.handleSaveError(defaultError);
            return false;
          }
        }

        if (this.destroyed) return true;
        this.saved.emit(result);
        this.notify.success(this.transloco.translate('tterms.toasts.created'));
        this.allowClose = true;
        this.modal().close();
        return true;
      }

      const base = this.baseTerm();
      const patch = this.editPatch();
      const needDefault = this.wantsMakeDefault();
      if (!base || (Object.keys(patch).length === 0 && !needDefault)) return false;

      let current = base;
      const hadPatch = Object.keys(patch).length > 0;
      if (hadPatch) {
        current = await this.update(base, patch);
      }
      if (needDefault) {
        try {
          current = await this.makeDefault(current);
        } catch (defaultError) {
          if (hadPatch) {
            this.baseTerm.set(current);
            this.form.set({ ...termToForm(current), isDefault: true });
            this.resetValidation();
            this.saved.emit(current);
          }
          this.handleSaveError(defaultError);
          return false;
        }
      }

      if (this.destroyed) return true;
      this.baseTerm.set(current);
      this.form.set(termToForm(current));
      this.resetValidation();
      this.saved.emit(current);
      this.notify.success(this.transloco.translate('tterms.toasts.updated'));
      this.allowClose = true;
      this.modal().close();
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestDelete(): Promise<void> {
    const base = this.baseTerm();
    if (!this.canManage() || this.mode() !== 'edit' || !base || base.isDefault || this.saving() || this.deleting()) {
      return;
    }
    const confirmed = await this.deleteDialog().open();
    if (!confirmed || this.destroyed) return;

    this.deleting.set(true);
    try {
      const removed = await this.remove(base);
      if (this.destroyed) return;
      this.deleted.emit(removed.id);
      this.notify.success(this.transloco.translate('tterms.toasts.deleted'));
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingRowConflict.set({ kind: 'delete' });
        this.conflictModal().open();
        return;
      }
      this.notify.error(settingsErrorText(error, this.transloco));
      if (code === 'TRADE.TERMS.NOT_FOUND') {
        this.deleted.emit(base.id);
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.deleting.set(false);
    }
  }

  protected onConflictClosed(): void {
    if (this.conflictBusy()) {
      this.conflictModal().open();
      return;
    }
    this.pendingRowConflict.set(null);
  }

  protected async reloadLatest(): Promise<void> {
    const base = this.baseTerm();
    if (!base || this.conflictBusy()) return;
    const fromRow = this.pendingRowConflict() !== null;
    this.conflictBusy.set(true);
    try {
      const fresh = await getTerm(base.id, this.scope);
      if (this.destroyed) return;
      this.conflictModal().close();
      this.pendingRowConflict.set(null);
      this.baseTerm.set(fresh);
      if (!fromRow) {
        this.form.set(termToForm(fresh));
        this.resetValidation();
      }
      this.reloaded.emit(fresh);
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(settingsErrorText(error, this.transloco));
      if (code === 'TRADE.TERMS.NOT_FOUND') {
        this.conflictModal().close();
        this.pendingRowConflict.set(null);
        this.deleted.emit(base.id);
        if (!fromRow) {
          this.allowClose = true;
          this.modal().close();
        }
      }
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async keepMyChanges(): Promise<void> {
    const base = this.baseTerm();
    if (!base || this.conflictBusy()) return;
    const rowAction = this.pendingRowConflict();
    this.conflictBusy.set(true);
    try {
      const fresh = await getTerm(base.id, this.scope);
      if (this.destroyed) return;

      if (rowAction) {
        if (rowAction.kind === 'delete') {
          const removed = await this.remove(fresh);
          if (this.destroyed) return;
          this.conflictModal().close();
          this.pendingRowConflict.set(null);
          this.deleted.emit(removed.id);
          this.notify.success(this.transloco.translate('tterms.toasts.deleted'));
          if (this.mode() === 'edit' && this.baseTerm()?.id === fresh.id) {
            this.allowClose = true;
            this.modal().close();
          }
          return;
        }

        const updated =
          rowAction.kind === 'makeDefault'
            ? await this.makeDefault(fresh)
            : await this.update(fresh, { isActive: rowAction.isActive });
        if (this.destroyed) return;
        this.conflictModal().close();
        this.pendingRowConflict.set(null);
        this.baseTerm.set(updated);
        this.saved.emit(updated);
        this.notify.success(
          this.transloco.translate(
            rowAction.kind === 'makeDefault'
              ? 'tterms.toasts.madeDefault'
              : updated.isActive
                ? 'tterms.toasts.activated'
                : 'tterms.toasts.deactivated',
          ),
        );
        return;
      }

      const patch = computeEditPatch(fresh, this.form());
      const needDefault = this.form().isActive && this.form().isDefault && !fresh.isDefault;
      let current = fresh;
      const hadPatch = Object.keys(patch).length > 0;
      if (hadPatch) {
        current = await this.update(fresh, patch);
      }
      if (needDefault) {
        try {
          current = await this.makeDefault(current);
        } catch (defaultError) {
          if (hadPatch) {
            this.baseTerm.set(current);
            this.saved.emit(current);
          }
          this.notify.error(settingsErrorText(defaultError, this.transloco));
          return;
        }
      }
      if (this.destroyed) return;
      this.conflictModal().close();
      this.pendingRowConflict.set(null);
      this.baseTerm.set(current);
      this.form.set(termToForm(current));
      this.resetValidation();
      this.saved.emit(current);
      this.notify.success(this.transloco.translate('tterms.toasts.updated'));
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      this.notify.error(settingsErrorText(error, this.transloco));
      if (code === 'TRADE.TERMS.NOT_FOUND') {
        this.conflictModal().close();
        this.pendingRowConflict.set(null);
        this.deleted.emit(base.id);
        if (!rowAction) {
          this.allowClose = true;
          this.modal().close();
        }
      }
    } finally {
      this.conflictBusy.set(false);
    }
  }

  /** PATCH with one Idempotency-Key per action: a retry of the same version and patch reuses it. */
  private async update(term: TradeTerm, patch: TermPatch): Promise<TradeTerm> {
    const operation = `update:${term.id}`;
    const key = this.mutationKeys.for(operation, { version: term.version, patch });
    const updated = await updateTerm(term.id, term.version, patch, this.scope, key);
    this.mutationKeys.clear(operation);
    return updated;
  }

  private async makeDefault(term: TradeTerm): Promise<TradeTerm> {
    const operation = `make-default:${term.id}`;
    const key = this.mutationKeys.for(operation, { version: term.version });
    const updated = await makeDefaultTerm(term.id, term.version, this.scope, key);
    this.mutationKeys.clear(operation);
    return updated;
  }

  private async remove(term: TradeTerm): Promise<TradeTerm> {
    const operation = `delete:${term.id}`;
    const key = this.mutationKeys.for(operation, { version: term.version });
    const removed = await deleteTerm(term.id, term.version, this.scope, key);
    this.mutationKeys.clear(operation);
    return removed;
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'TRADE.TERMS.CODE_TAKEN') {
      this.serverCodeErrorKey.set('tset.errors.TRADE_TERMS_CODE_TAKEN');
      return;
    }
    if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
      this.pendingRowConflict.set(null);
      this.conflictModal().open();
      return;
    }
    this.notify.error(settingsErrorText(error, this.transloco));
  }

  private resetValidation(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverCodeErrorKey.set(null);
  }

  private async confirmModalClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (this.destroyed) return;
      if (choice === 'discard') {
        this.allowClose = true;
        this.modal().close();
      } else if (choice === 'save') {
        await this.save();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
