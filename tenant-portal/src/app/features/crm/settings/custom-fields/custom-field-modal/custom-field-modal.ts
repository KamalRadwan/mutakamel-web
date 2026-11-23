import {
  Component,
  DestroyRef,
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArrowBackUp,
  tablerCalendar,
  tablerCalendarEvent,
  tablerCheck,
  tablerChevronDown,
  tablerCircleDot,
  tablerEdit,
  tablerHierarchy2,
  tablerLayoutRows,
  tablerLink,
  tablerListNumbers,
  tablerMail,
  tablerPhone,
  tablerSquareCheck,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf, fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { CrmModules } from '../../../shared/crm-modules/crm-modules';
import { customFieldsError } from '../custom-fields-errors';
import { CustomFieldSubmission, createCustomField, updateCustomField } from '../custom-fields.api';
import {
  CREATABLE_OWNER_TYPES,
  CUSTOM_FIELD_TYPES,
  CreatableOwnerType,
  CreateCustomFieldInput,
  CustomField,
  CustomFieldDefinition,
  CustomFieldType,
  EditableFieldOption,
  FIELD_KEY_REGEX,
  FIELD_TYPE_ICONS,
  FieldOption,
  MAX_KEY_LEN,
  MAX_NAME_LEN,
  MAX_OPTIONS,
  MAX_PLACEHOLDER_LEN,
  OWNER_TYPE_LOOK,
  UpdateCustomFieldPatch,
  autoKeyFromEnglish,
  globalRequirement,
  isChoicesType,
  liveNormalizeFieldKey,
  normalizeFieldKey,
} from '../custom-fields.model';
import { FieldPreview } from '../field-preview/field-preview';
import { OptionsEditor } from '../options-editor/options-editor';

interface FieldDraft {
  ownerType: CreatableOwnerType;
  type: CustomFieldType;
  nameAr: string;
  nameEn: string;
  fieldKey: string;
  placeholderAr: string;
  placeholderEn: string;
  sortOrder: number;
  isActive: boolean;
}

const DEFAULT_SORT_ORDER = 100;

function emptyDraft(): FieldDraft {
  return {
    ownerType: 'LEAD',
    type: 'TEXT',
    nameAr: '',
    nameEn: '',
    fieldKey: '',
    placeholderAr: '',
    placeholderEn: '',
    sortOrder: DEFAULT_SORT_ORDER,
    isActive: true,
  };
}

function toEditableOptions(options: readonly FieldOption[]): EditableFieldOption[] {
  return options.map((opt) => ({ ...opt, uid: crypto.randomUUID(), isSaved: true }));
}

@Component({
  selector: 'app-custom-field-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Modal,
    Field,
    Dropdown,
    Switch,
    Button,
    ConfirmDialog,
    OptionsEditor,
    FieldPreview,
  ],
  providers: [
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerArrowBackUp,
      tablerCalendar,
      tablerCalendarEvent,
      tablerCheck,
      tablerChevronDown,
      tablerCircleDot,
      tablerEdit,
      tablerHierarchy2,
      tablerLayoutRows,
      tablerLink,
      tablerListNumbers,
      tablerMail,
      tablerPhone,
      tablerSquareCheck,
      tablerTarget,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
    }),
  ],
  templateUrl: './custom-field-modal.html',
  host: {
    '(document:click)': 'closeTypeMenuIfOutside($event)',
    '(window:resize)': 'typeMenuOpen.set(false)',
  },
})
export class CustomFieldModal {
  private static nextId = 0;
  protected readonly uid = `cf-modal-${++CustomFieldModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly injector = inject(Injector);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);
  private readonly typePicker = viewChild<ElementRef<HTMLElement>>('typePicker');
  private readonly typeTrigger = viewChild<ElementRef<HTMLButtonElement>>('typeTrigger');
  private readonly typeListEl = viewChild<ElementRef<HTMLElement>>('typeListEl');

  readonly canManage = input(false);
  readonly readOnly = output<void>();
  readonly reload = output<void>();
  private readonly modules = inject(CrmModules);
  private readonly submission = new CustomFieldSubmission();
  readonly saved = output<CustomField>();

  protected readonly maxNameLen = MAX_NAME_LEN;
  protected readonly maxKeyLen = MAX_KEY_LEN;
  protected readonly maxPlaceholderLen = MAX_PLACEHOLDER_LEN;
  protected readonly fieldTypes = CUSTOM_FIELD_TYPES;
  protected readonly typeIcons = FIELD_TYPE_ICONS;
  protected readonly ownerLook = OWNER_TYPE_LOOK;

  protected readonly editingField = signal<CustomField | null>(null);
  protected readonly draft = signal<FieldDraft>(emptyDraft());
  protected readonly draftOptions = signal<EditableFieldOption[]>([]);
  protected readonly moreOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly revealErrors = signal(false);
  protected readonly serverKeyError = signal<string | null>(null);
  protected readonly serverOptionsCode = signal<string | null>(null);
  protected readonly serverErrors = signal<Record<string, string[]>>({});
  protected readonly optionsError = computed(() => {
    this.i18n();
    const code = this.serverOptionsCode();
    return code ? this.transloco.translate(`customFields.errors.${code}`) : this.serverFieldError('options');
  });
  protected readonly inUseOptionKeys = signal<string[]>([]);
  protected readonly typeMenuOpen = signal(false);
  protected readonly typeMenuPlace = signal({ top: 0, start: 0, width: 240 });

  private keyManuallyEdited = false;
  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isEdit = computed(() => this.editingField() !== null);
  protected readonly currentType = computed(() => this.editingField()?.type ?? this.draft().type);
  protected readonly currentOwnerType = computed(() => this.editingField()?.ownerType ?? this.draft().ownerType);
  protected readonly hasOptions = computed(() => isChoicesType(this.currentType()));
  protected readonly requiredOnCreate = computed(() => {
    const current = this.editingField();
    return current ? globalRequirement(current, 'CREATE') : false;
  });

  protected readonly title = computed(() => {
    this.i18n();
    if (!this.isEdit()) return this.transloco.translate('customFields.modal.createTitle');
    return this.transloco.translate(
      this.canManage() ? 'customFields.modal.editTitle' : 'customFields.modal.viewTitle',
    );
  });

  protected readonly ownerTypeOptions = computed<DropdownOption<CreatableOwnerType>[]>(() => {
    this.i18n();
    return CREATABLE_OWNER_TYPES.filter(type =>
      (type !== 'LEAD' || this.modules.leadsAnywhere()) &&
      (type !== 'OPPORTUNITY' || this.modules.opportunitiesAnywhere())
    ).map((type) => ({
      value: type,
      label: this.transloco.translate(`customFields.ownerTypes.${type}`),
    }));
  });

  protected readonly dirty = computed(() => {
    const d = this.draft();
    const opts = this.draftOptions();
    const base = this.editingField();
    if (!base) {
      return Boolean(
        d.nameAr.trim() ||
          d.nameEn.trim() ||
          d.fieldKey.trim() ||
          d.placeholderAr.trim() ||
          d.placeholderEn.trim() ||
          d.sortOrder !== DEFAULT_SORT_ORDER ||
          d.ownerType !== this.ownerTypeOptions()[0].value ||
          d.type !== 'TEXT' ||
          opts.length > 0,
      );
    }

    if (normalizeFieldKey(d.fieldKey) !== base.fieldKey) return true;
    if (d.nameAr.trim() !== base.nameAr) return true;
    if (d.nameEn.trim() !== base.nameEn) return true;
    if ((d.placeholderAr.trim() || null) !== base.placeholderAr) return true;
    if ((d.placeholderEn.trim() || null) !== base.placeholderEn) return true;
    if (d.sortOrder !== base.sortOrder) return true;
    if (d.isActive !== base.isActive) return true;
    if (isChoicesType(base.type) && !this.optionsEqual(base.options, opts)) return true;
    return false;
  });

  protected readonly nameArError = computed(() => {
    this.i18n();
    const server = this.serverFieldError('nameAr');
    if (server) return server;
    if (!this.revealErrors()) return null;
    const val = this.draft().nameAr.trim();
    if (!val) return this.transloco.translate('customFields.validation.required');
    if (val.length > MAX_NAME_LEN) return this.transloco.translate('customFields.validation.maxLength', { max: MAX_NAME_LEN });
    return null;
  });

  protected readonly nameEnError = computed(() => {
    this.i18n();
    const server = this.serverFieldError('nameEn');
    if (server) return server;
    if (!this.revealErrors()) return null;
    const val = this.draft().nameEn.trim();
    if (!val) return this.transloco.translate('customFields.validation.required');
    if (val.length > MAX_NAME_LEN) return this.transloco.translate('customFields.validation.maxLength', { max: MAX_NAME_LEN });
    return null;
  });

  protected readonly keyError = computed(() => {
    this.i18n();
    const serverErr = this.serverKeyError() ?? this.serverFieldError('fieldKey');
    if (serverErr) return serverErr;
    if (!this.revealErrors()) return null;
    const normalized = normalizeFieldKey(this.draft().fieldKey);
    if (!normalized) return this.transloco.translate('customFields.validation.required');
    if (!FIELD_KEY_REGEX.test(normalized)) return this.transloco.translate('customFields.validation.keyInvalid');
    return null;
  });

  protected readonly placeholderArError = computed(() => {
    this.i18n();
    const server = this.serverFieldError('placeholderAr');
    if (server) return server;
    if (!this.revealErrors()) return null;
    if (this.draft().placeholderAr.trim().length > MAX_PLACEHOLDER_LEN) {
      return this.transloco.translate('customFields.validation.maxLength', { max: MAX_PLACEHOLDER_LEN });
    }
    return null;
  });

  protected readonly placeholderEnError = computed(() => {
    this.i18n();
    const server = this.serverFieldError('placeholderEn');
    if (server) return server;
    if (!this.revealErrors()) return null;
    if (this.draft().placeholderEn.trim().length > MAX_PLACEHOLDER_LEN) {
      return this.transloco.translate('customFields.validation.maxLength', { max: MAX_PLACEHOLDER_LEN });
    }
    return null;
  });

  protected readonly sortOrderValue = computed(() => {
    const val = this.draft().sortOrder;
    return Number.isFinite(val) ? val : '';
  });

  protected readonly sortOrderError = computed(() => {
    this.i18n();
    const server = this.serverFieldError('sortOrder');
    if (server) return server;
    if (!this.revealErrors()) return null;
    if (!Number.isInteger(this.draft().sortOrder) || this.draft().sortOrder < 1) return this.transloco.translate('customFields.validation.sortOrder');
    return null;
  });

  constructor() {
    void this.modules.ensureLoaded();
    const closeTypeMenu = () => this.typeMenuOpen.set(false);
    document.addEventListener('scroll', closeTypeMenu, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', closeTypeMenu, { capture: true }));
  }

  openCreate(): void {
    this.editingField.set(null);
    this.draft.set({ ...emptyDraft(), ownerType: this.ownerTypeOptions()[0].value });
    this.draftOptions.set([]);
    this.moreOpen.set(false);
    this.keyManuallyEdited = false;
    this.resetTransientState();
    this.modal().open();
  }

  openEdit(field: CustomField): void {
    this.editingField.set(field);
    this.loadFromField(field);
    this.moreOpen.set(Boolean(field.placeholderAr || field.placeholderEn || field.sortOrder !== DEFAULT_SORT_ORDER));
    this.keyManuallyEdited = true;
    this.resetTransientState();
    this.modal().open();
  }

  protected undo(): void {
    this.submission.reset();
    const base = this.editingField();
    if (base) {
      this.loadFromField(base);
      this.keyManuallyEdited = true;
    } else {
      this.draft.set({ ...emptyDraft(), ownerType: this.ownerTypeOptions()[0].value });
      this.draftOptions.set([]);
      this.keyManuallyEdited = false;
    }
    this.revealErrors.set(false);
    this.serverKeyError.set(null);
    this.serverErrors.set({});
    this.serverOptionsCode.set(null);
    this.inUseOptionKeys.set([]);
  }

  protected close(): void {
    this.typeMenuOpen.set(false);
    this.modal().close();
  }

  protected onNameArInput(value: string): void {
    this.draft.update((d) => ({ ...d, nameAr: value }));
  }

  protected onNameEnInput(value: string): void {
    this.draft.update((d) => {
      const nextKey = !this.isEdit() && !this.keyManuallyEdited ? autoKeyFromEnglish(value) : d.fieldKey;
      return { ...d, nameEn: value, fieldKey: nextKey };
    });
    if (!this.isEdit() && !this.keyManuallyEdited) {
      this.serverKeyError.set(null);
    this.serverErrors.set({});
    this.serverOptionsCode.set(null);
    }
  }

  protected onKeyInput(value: string): void {
    if (this.isEdit() || !this.canManage()) return;
    this.keyManuallyEdited = true;
    this.serverKeyError.set(null);
    this.serverErrors.set({});
    this.serverOptionsCode.set(null);
    this.draft.update((d) => ({ ...d, fieldKey: liveNormalizeFieldKey(value) }));
  }

  protected onKeyBlur(): void {
    if (this.isEdit() || !this.canManage()) return;
    this.draft.update((d) => ({ ...d, fieldKey: normalizeFieldKey(d.fieldKey).replace(/_+$/, '') }));
  }

  protected onOwnerTypeChange(ownerType: CreatableOwnerType): void {
    if (this.isEdit() || !this.canManage() || !this.ownerTypeOptions().some(option => option.value === ownerType)) return;
    this.draft.update((d) => ({ ...d, ownerType }));
  }

  protected toggleTypeMenu(): void {
    if (!this.canManage() || this.isEdit()) return;
    if (this.typeMenuOpen()) {
      this.typeMenuOpen.set(false);
      return;
    }
    this.placeTypeMenu();
    this.typeMenuOpen.set(true);
    afterNextRender(() => this.placeTypeMenu(), { injector: this.injector });
  }

  protected selectFieldType(type: CustomFieldType): void {
    this.draft.update((d) => ({ ...d, type }));
    if (!isChoicesType(type)) {
      this.inUseOptionKeys.set([]);
    }
    this.typeMenuOpen.set(false);
    this.typeTrigger()?.nativeElement.focus({ preventScroll: true });
  }

  protected onTypeMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.typeMenuOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.typeMenuOpen.set(false);
      this.typeTrigger()?.nativeElement.focus({ preventScroll: true });
    }
  }

  protected closeTypeMenuIfOutside(event: Event): void {
    const picker = this.typePicker()?.nativeElement;
    if (picker && !picker.contains(event.target as Node)) {
      this.typeMenuOpen.set(false);
    }
  }

  protected onPlaceholderChange(field: 'placeholderAr' | 'placeholderEn', value: string): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected onSortOrderChange(raw: string): void {
    const num = raw.trim() === '' ? Number.NaN : Number(raw);
    this.draft.update((d) => ({ ...d, sortOrder: num }));
  }

  protected onActiveChange(isActive: boolean): void {
    this.draft.update((d) => ({ ...d, isActive }));
  }

  protected onOptionsModelChange(options: EditableFieldOption[]): void {
    this.draftOptions.set(options);
    this.inUseOptionKeys.set([]);
    this.serverOptionsCode.set(null);
    this.serverErrors.set({});
  }

  protected restoreRemovedOptions(): void {
    const base = this.editingField();
    if (!base) return;
    const blocking = new Set(this.inUseOptionKeys());
    const current = this.draftOptions();
    const byKey = new Map(current.map((opt) => [opt.key.trim(), opt]));

    const restored = current.map((opt) => (blocking.has(opt.key.trim()) ? { ...opt, isActive: true } : opt));
    for (const orig of base.options) {
      if (blocking.has(orig.key) && !byKey.has(orig.key)) {
        restored.push({ ...orig, uid: crypto.randomUUID(), isSaved: true });
      }
    }

    restored.sort((a, b) => a.sortOrder - b.sortOrder);
    this.draftOptions.set(restored);
    this.inUseOptionKeys.set([]);
  }

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving()) return;
    this.revealErrors.set(true);
    this.serverKeyError.set(null);
    this.serverErrors.set({});
    this.serverOptionsCode.set(null);
    this.inUseOptionKeys.set([]);

    const normalizedKey = normalizeFieldKey(this.draft().fieldKey);
    if (normalizedKey !== this.draft().fieldKey) {
      this.draft.update((d) => ({ ...d, fieldKey: normalizedKey }));
    }

    if (!this.validateBeforeSubmit()) {
      if (this.placeholderArError() || this.placeholderEnError() || this.sortOrderError()) {
        this.moreOpen.set(true);
      }
      return;
    }

    const base = this.editingField();
    if (!base && !this.ownerTypeOptions().some(option => option.value === this.draft().ownerType)) return;
    this.saving.set(true);
    try {
      let result: CustomField;
      if (!base) {
        // A new definition has no requirement rows yet.
        result = { ...(await this.submitCreate()), requirements: [] };
        this.notify.success(this.transloco.translate('customFields.toasts.created'));
      } else {
        const patch = this.buildPatch(base);
        if (Object.keys(patch).length === 0) {
          this.allowClose = true;
          this.modal().close();
          return;
        }
        // PATCH returns the definition only, so keep the requirements already loaded.
        result = { ...(await this.submission.run(patch, body => updateCustomField(base.id, body))), requirements: base.requirements };
        this.notify.success(this.transloco.translate('customFields.toasts.saved'));
      }
      this.allowClose = true;
      this.saved.emit(result);
      this.modal().close();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected onModalClosed(): void {
    this.typeMenuOpen.set(false);
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscard();
      return;
    }
    this.allowClose = false;
  }

  private async confirmDiscard(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private validateBeforeSubmit(): boolean {
    if (this.nameArError() || this.nameEnError() || this.keyError()) return false;
    if (this.placeholderArError() || this.placeholderEnError() || this.sortOrderError()) return false;
    if (this.hasOptions()) {
      const opts = this.draftOptions();
      if (opts.length === 0 || opts.length > MAX_OPTIONS) return false;
      const seen = new Set<string>();
      for (const opt of opts) {
        const key = opt.key.trim();
        const ar = opt.nameAr.trim();
        const en = opt.nameEn.trim();
        if (!key || key.length > MAX_KEY_LEN || seen.has(key) || !ar || ar.length > MAX_NAME_LEN || !en || en.length > MAX_NAME_LEN) {
          return false;
        }
        if (!Number.isInteger(opt.sortOrder) || opt.sortOrder < 1) return false;
        seen.add(key);
      }
    }
    return true;
  }

  private submitCreate(): Promise<CustomFieldDefinition> {
    const d = this.draft();
    const placeholderAr = d.placeholderAr.trim();
    const placeholderEn = d.placeholderEn.trim();
    const body: CreateCustomFieldInput = {
      ownerType: d.ownerType,
      fieldKey: normalizeFieldKey(d.fieldKey),
      nameAr: d.nameAr.trim(),
      nameEn: d.nameEn.trim(),
      type: d.type,
      ...(placeholderAr ? { placeholderAr } : {}),
      ...(placeholderEn ? { placeholderEn } : {}),
      sortOrder: d.sortOrder,
      ...(isChoicesType(d.type) ? { options: this.cleanOptions(this.draftOptions()) } : {}),
    };
    return this.submission.run(body, createCustomField);
  }

  private buildPatch(base: CustomField): UpdateCustomFieldPatch {
    const d = this.draft();
    const patch: UpdateCustomFieldPatch = {};

    const nextNameAr = d.nameAr.trim();
    if (nextNameAr !== base.nameAr) patch.nameAr = nextNameAr;

    const nextNameEn = d.nameEn.trim();
    if (nextNameEn !== base.nameEn) patch.nameEn = nextNameEn;

    const nextPlaceholderAr = d.placeholderAr.trim() || null;
    if (nextPlaceholderAr !== base.placeholderAr) patch.placeholderAr = nextPlaceholderAr;

    const nextPlaceholderEn = d.placeholderEn.trim() || null;
    if (nextPlaceholderEn !== base.placeholderEn) patch.placeholderEn = nextPlaceholderEn;

    if (d.sortOrder !== base.sortOrder) patch.sortOrder = d.sortOrder;
    if (d.isActive !== base.isActive) patch.isActive = d.isActive;

    if (isChoicesType(base.type) && !this.optionsEqual(base.options, this.draftOptions())) {
      patch.options = this.cleanOptions(this.draftOptions());
    }

    return patch;
  }

  private cleanOptions(options: readonly EditableFieldOption[]): FieldOption[] {
    return options.map((opt) => ({
      key: opt.key.trim(),
      nameAr: opt.nameAr.trim(),
      nameEn: opt.nameEn.trim(),
      sortOrder: opt.sortOrder,
      isActive: opt.isActive,
    }));
  }

  private optionsEqual(a: readonly FieldOption[], b: readonly EditableFieldOption[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => {
      const other = b[idx];
      return (
        item.key === other.key.trim() &&
        item.nameAr === other.nameAr.trim() &&
        item.nameEn === other.nameEn.trim() &&
        item.sortOrder === other.sortOrder &&
        item.isActive === other.isActive
      );
    });
  }

  protected serverFieldError(field: string): string | null {
    return this.serverErrors()[field]?.join(' ') || null;
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'CUSTOM_FIELD_KEY_INVALID' || code === 'CUSTOM_FIELD_KEY_TAKEN') {
      this.serverKeyError.set(this.transloco.translate(`customFields.errors.${code}`));
      return;
    }
    if (code === 'CUSTOM_FIELD_OPTIONS_REQUIRED' || code === 'CUSTOM_FIELD_OPTIONS_INVALID') {
      this.serverOptionsCode.set(code);
      return;
    }
    if (code === 'CUSTOM_FIELD_OPTION_IN_USE') {
      const draft = new Map(this.draftOptions().map(option => [option.key.trim(), option]));
      const candidates = this.editingField()?.options.filter(option =>
        !draft.has(option.key) || (option.isActive && !draft.get(option.key)?.isActive),
      ).map(option => option.key) ?? [];
      this.inUseOptionKeys.set(candidates);
      return;
    }
    if (isValidationError(error)) {
      const errors = fieldErrorsOf(error);
      this.serverErrors.set(errors);
      if (Object.keys(errors).some(key => key.startsWith('placeholder') || key === 'sortOrder')) this.moreOpen.set(true);
      if (Object.keys(errors).some(key => key !== '_' &&
        (key in this.draft() || key === 'options' || key.startsWith('options.')))) return;
    }
    const result = customFieldsError(this.transloco, error);
    if (result.readOnly) this.readOnly.emit();
    this.notify.error(result.message);
    if (error instanceof ApiError && error.status === 404) this.reload.emit();
  }

  private loadFromField(field: CustomField): void {
    this.draft.set({
      ownerType: field.ownerType === 'LEAD_AND_PARTY' ? 'LEAD' : field.ownerType,
      type: field.type,
      nameAr: field.nameAr,
      nameEn: field.nameEn,
      fieldKey: field.fieldKey,
      placeholderAr: field.placeholderAr ?? '',
      placeholderEn: field.placeholderEn ?? '',
      sortOrder: field.sortOrder,
      isActive: field.isActive,
    });
    this.draftOptions.set(toEditableOptions(field.options));
  }

  private resetTransientState(): void {
    this.submission.reset();
    this.allowClose = false;
    this.saving.set(false);
    this.revealErrors.set(false);
    this.serverKeyError.set(null);
    this.serverErrors.set({});
    this.serverOptionsCode.set(null);
    this.inUseOptionKeys.set([]);
    this.typeMenuOpen.set(false);
  }

  private placeTypeMenu(): void {
    const trigger = this.typeTrigger()?.nativeElement;
    if (!trigger) return;
    const rect = rectInPage(trigger);
    const vp = viewport();
    const listHeight = this.typeListEl()?.nativeElement.offsetHeight || 280;
    const belowTop = rect.bottom + 4;
    const openAbove = belowTop + listHeight > vp.height - 8 && rect.top - 4 - listHeight >= 8;
    const top = openAbove ? Math.max(8, rect.top - 4 - listHeight) : belowTop;
    const rtl = getComputedStyle(trigger).direction === 'rtl';
    const rawStart = rtl ? vp.width - rect.right : rect.left;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, vp.width - rect.width - 8));
    this.typeMenuPlace.set({ top, start, width: rect.width });
  }
}
