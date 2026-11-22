import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
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
  tablerSearch,
  tablerSquareCheck,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { errorCodeOf } from '../../shared/settings-api';
import { listBranches, listSampleRecords, listValues, saveValue } from '../custom-fields.api';
import {
  CREATABLE_OWNER_TYPES,
  CreatableOwnerType,
  CustomField,
  CustomFieldValueScalar,
  FIELD_TYPE_ICONS,
  MAX_TEXTAREA_LEN,
  MAX_TEXT_LEN,
  SampleBranch,
  SampleRecord,
  isClearedValue,
  isRequiredForOperation,
  localizedName,
  matchesOwnerType,
  validateCustomFieldValue,
} from '../custom-fields.model';

@Component({
  selector: 'app-record-values',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Switch, DateField, TimeField],
  providers: [
    provideIcons({
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
      tablerSearch,
      tablerSquareCheck,
      tablerX,
    }),
  ],
  templateUrl: './record-values.html',
  host: {
    class: 'flex flex-col gap-10',
    '(document:click)': 'closeRecordMenuIfOutside($event)',
  },
})
export class RecordValues {
  private static nextId = 0;
  protected readonly uid = `cf-values-${++RecordValues.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly recordPicker = viewChild<ElementRef<HTMLElement>>('recordPicker');

  readonly fields = input.required<CustomField[]>();
  readonly canManage = input(true);

  protected readonly typeIcons = FIELD_TYPE_ICONS;
  protected readonly branches = signal<SampleBranch[]>([]);
  protected readonly selectedBranchId = signal('');
  protected readonly selectedOwnerType = signal<CreatableOwnerType>('LEAD');
  protected readonly records = signal<SampleRecord[]>([]);
  protected readonly selectedRecordId = signal('');
  protected readonly recordMenuOpen = signal(false);
  protected readonly recordSearch = signal('');

  protected readonly loadingValues = signal(false);
  protected readonly valuesFailed = signal(false);
  protected readonly savedMap = signal<Record<string, CustomFieldValueScalar>>({});
  protected readonly draftMap = signal<Record<string, CustomFieldValueScalar>>({});
  protected readonly rowErrors = signal<Record<string, string | null>>({});
  protected readonly savingIds = signal<ReadonlySet<string>>(new Set());

  private recordsSeq = 0;
  private valuesSeq = 0;

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.branches().map((branch) => ({
      value: branch.id,
      label: localizedName(branch, lang),
    }));
  });

  protected readonly ownerTypeOptions = computed<DropdownOption<CreatableOwnerType>[]>(() => {
    this.i18n();
    return CREATABLE_OWNER_TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`customFields.ownerTypes.${type}`),
    }));
  });

  protected readonly filteredRecords = computed(() => {
    const term = this.recordSearch().trim().toLowerCase();
    const list = this.records();
    if (!term) return list;
    return list.filter(
      (record) =>
        record.nameAr.toLowerCase().includes(term) ||
        record.nameEn.toLowerCase().includes(term) ||
        record.code.toLowerCase().includes(term),
    );
  });

  protected readonly selectedRecord = computed(
    () => this.records().find((record) => record.id === this.selectedRecordId()) ?? null,
  );

  protected readonly applicableFields = computed(() => {
    const target = this.selectedOwnerType();
    return this.fields()
      .filter((field) => field.isActive && matchesOwnerType(field.ownerType, target))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey));
  });

  constructor() {
    void this.initBranches();

    effect(() => {
      const branchId = this.selectedBranchId();
      const ownerType = this.selectedOwnerType();
      if (!branchId) return;
      untracked(() => void this.loadRecords(branchId, ownerType));
    });

    effect(() => {
      const branchId = this.selectedBranchId();
      const ownerType = this.selectedOwnerType();
      const recordId = this.selectedRecordId();
      if (!branchId || !recordId) {
        untracked(() => {
          this.savedMap.set({});
          this.draftMap.set({});
          this.rowErrors.set({});
          this.valuesFailed.set(false);
        });
        return;
      }
      untracked(() => void this.loadValues(branchId, ownerType, recordId));
    });
  }

  protected onBranchChange(branchId: string): void {
    if (branchId === this.selectedBranchId()) return;
    this.selectedBranchId.set(branchId);
    this.selectedRecordId.set('');
    this.recordSearch.set('');
    this.recordMenuOpen.set(false);
  }

  protected onOwnerTypeChange(ownerType: CreatableOwnerType): void {
    if (ownerType === this.selectedOwnerType()) return;
    this.selectedOwnerType.set(ownerType);
    this.selectedRecordId.set('');
    this.recordSearch.set('');
    this.recordMenuOpen.set(false);
  }

  protected toggleRecordMenu(): void {
    this.recordMenuOpen.update((open) => !open);
  }

  protected chooseRecord(record: SampleRecord): void {
    this.selectedRecordId.set(record.id);
    this.recordMenuOpen.set(false);
    this.recordSearch.set('');
  }

  protected onRecordKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.recordMenuOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.recordMenuOpen.set(false);
    }
  }

  protected closeRecordMenuIfOutside(event: Event): void {
    const el = this.recordPicker()?.nativeElement;
    if (el && !el.contains(event.target as Node)) {
      this.recordMenuOpen.set(false);
    }
  }

  protected fieldLabel(field: CustomField): string {
    return localizedName(field, this.language());
  }

  protected fieldHint(field: CustomField): string {
    this.i18n();
    const name = this.fieldLabel(field);
    const type = this.transloco.translate(`customFields.types.${field.type}`);
    return this.transloco.translate(`customFields.values.typeHints.${field.type}`, { name, type });
  }

  protected fieldMax(field: CustomField): number | null {
    if (field.type === 'TEXT') return MAX_TEXT_LEN;
    if (field.type === 'TEXTAREA') return MAX_TEXTAREA_LEN;
    return null;
  }

  protected fieldCount(field: CustomField): number | null {
    if (field.type === 'TEXT' || field.type === 'TEXTAREA') {
      return this.stringDraft(field.id).length;
    }
    return null;
  }

  protected fieldPlaceholder(field: CustomField): string {
    return (this.language() === 'ar' ? field.placeholderAr || field.placeholderEn : field.placeholderEn || field.placeholderAr) ?? '';
  }

  protected recordLabel(record: SampleRecord): string {
    return localizedName(record, this.language());
  }

  protected isRequired(field: CustomField): boolean {
    return isRequiredForOperation(field, 'UPDATE', this.selectedOwnerType());
  }

  protected draftOf(fieldId: string): CustomFieldValueScalar {
    return this.draftMap()[fieldId] ?? null;
  }

  protected stringDraft(fieldId: string): string {
    const val = this.draftOf(fieldId);
    return val === null || val === undefined ? '' : String(val);
  }

  protected dateDraft(fieldId: string): string | null {
    const val = this.draftOf(fieldId);
    if (typeof val !== 'string' || !val) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return null;
    return this.formatLocalDate(parsed);
  }

  protected timeDraft(fieldId: string): string | null {
    const val = this.draftOf(fieldId);
    if (typeof val !== 'string' || !val) return null;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  }

  protected multiDraft(fieldId: string): string[] {
    const val = this.draftOf(fieldId);
    return Array.isArray(val) ? val : [];
  }

  protected selectOptionsFor(field: CustomField): DropdownOption<string>[] {
    this.i18n();
    const lang = this.language();
    const unset = this.fieldPlaceholder(field) || this.transloco.translate('customFields.values.unset');
    return [
      { value: '', label: unset },
      ...field.options
        .filter((opt) => opt.isActive)
        .map((opt) => ({ value: opt.key, label: localizedName(opt, lang) })),
    ];
  }

  protected selectedOptionLabel(field: CustomField): string {
    const key = this.stringDraft(field.id);
    if (!key) return this.transloco.translate('customFields.values.unset');
    const found = field.options.find((opt) => opt.key === key);
    return found ? localizedName(found, this.language()) : key;
  }

  protected optionLabel(option: { nameAr: string; nameEn: string; key: string }): string {
    return localizedName(option, this.language()) || option.key;
  }

  protected visibleMultiOptions(field: CustomField) {
    const selected = new Set(this.multiDraft(field.id));
    return field.options.filter((opt) => opt.isActive || selected.has(opt.key));
  }

  protected setDraft(fieldId: string, value: CustomFieldValueScalar): void {
    this.draftMap.update((map) => ({ ...map, [fieldId]: value }));
    this.rowErrors.update((map) => ({ ...map, [fieldId]: null }));
  }

  protected onDateTimeDateChange(fieldId: string, dateIso: string | null): void {
    if (!dateIso) {
      this.setDraft(fieldId, null);
      return;
    }
    const time = this.timeDraft(fieldId) || '00:00';
    this.setDraft(fieldId, this.combineLocalDateTime(dateIso, time));
  }

  protected onDateTimeTimeChange(fieldId: string, timeHm: string | null): void {
    if (!timeHm) return;
    const dateIso = this.dateDraft(fieldId) || this.formatLocalDate(new Date());
    this.setDraft(fieldId, this.combineLocalDateTime(dateIso, timeHm));
  }

  protected toggleMultiOption(fieldId: string, key: string): void {
    if (!this.canManage()) return;
    const current = this.multiDraft(fieldId);
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    this.setDraft(fieldId, next.length ? next : null);
  }

  protected isRowSaving(fieldId: string): boolean {
    return this.savingIds().has(fieldId);
  }

  protected isRowCleared(field: CustomField): boolean {
    return isClearedValue(this.draftOf(field.id), field.type);
  }

  protected isRowDirty(field: CustomField): boolean {
    const saved = this.savedMap()[field.id] ?? null;
    const draft = this.draftOf(field.id);
    if (Array.isArray(saved) || Array.isArray(draft)) {
      const a = Array.isArray(saved) ? saved : [];
      const b = Array.isArray(draft) ? draft : [];
      return a.length !== b.length || a.some((item, idx) => item !== b[idx]);
    }
    if (field.type === 'NUMBER') {
      const a = saved === null || saved === '' ? null : Number(saved);
      const b = draft === null || draft === '' ? null : Number(draft);
      return a !== b;
    }
    return saved !== draft;
  }

  protected async saveRow(field: CustomField): Promise<void> {
    if (!this.canManage() || this.isRowSaving(field.id)) return;
    const branchId = this.selectedBranchId();
    const ownerId = this.selectedRecordId();
    if (!branchId || !ownerId) return;

    const raw = this.draftOf(field.id);
    const cleared = isClearedValue(raw, field.type);

    if (cleared && this.isRequired(field)) {
      this.setRowError(field.id, this.transloco.translate('customFields.errors.CUSTOM_FIELD_REQUIRED'));
      return;
    }
    if (!cleared && !validateCustomFieldValue(field, raw)) {
      this.setRowError(field.id, this.clientValidationMessage(field));
      return;
    }

    const payloadValue: CustomFieldValueScalar = cleared
      ? null
      : field.type === 'NUMBER'
        ? Number(raw)
        : raw;

    this.setRowSaving(field.id, true);
    try {
      const saved = await saveValue({
        branchId,
        fieldDefinitionId: field.id,
        ownerType: this.selectedOwnerType(),
        ownerId,
        value: payloadValue,
      });
      const stored = saved ? saved.value : null;
      this.savedMap.update((map) => ({ ...map, [field.id]: stored }));
      this.draftMap.update((map) => ({ ...map, [field.id]: Array.isArray(stored) ? [...stored] : stored }));
      this.setRowError(field.id, null);
      this.notify.success(
        this.transloco.translate(saved ? 'customFields.values.saved' : 'customFields.values.cleared'),
      );
    } catch (error) {
      this.handleRowError(field.id, error);
    } finally {
      this.setRowSaving(field.id, false);
    }
  }

  protected async clearRow(field: CustomField): Promise<void> {
    if (!this.canManage() || this.isRowSaving(field.id)) return;
    const branchId = this.selectedBranchId();
    const ownerId = this.selectedRecordId();
    if (!branchId || !ownerId) return;

    this.setRowSaving(field.id, true);
    try {
      await saveValue({
        branchId,
        fieldDefinitionId: field.id,
        ownerType: this.selectedOwnerType(),
        ownerId,
        value: null,
      });
      this.savedMap.update((map) => ({ ...map, [field.id]: null }));
      this.draftMap.update((map) => ({ ...map, [field.id]: null }));
      this.setRowError(field.id, null);
      this.notify.success(this.transloco.translate('customFields.values.cleared'));
    } catch (error) {
      this.handleRowError(field.id, error);
    } finally {
      this.setRowSaving(field.id, false);
    }
  }

  protected retryValues(): void {
    const branchId = this.selectedBranchId();
    const recordId = this.selectedRecordId();
    if (branchId && recordId) {
      void this.loadValues(branchId, this.selectedOwnerType(), recordId);
    }
  }

  private async initBranches(): Promise<void> {
    try {
      const branches = await listBranches();
      this.branches.set(branches);
      if (branches.length > 0 && !this.selectedBranchId()) {
        this.selectedBranchId.set(branches[0].id);
      }
    } catch {
      this.notify.error(this.transloco.translate('settings.errors.generic'));
    }
  }

  private async loadRecords(branchId: string, ownerType: CreatableOwnerType): Promise<void> {
    const seq = ++this.recordsSeq;
    try {
      const items = await listSampleRecords(branchId, ownerType);
      if (seq !== this.recordsSeq) return;
      this.records.set(items);
    } catch (error) {
      if (seq === this.recordsSeq) {
        this.records.set([]);
        this.notify.error(this.resolveError(error));
      }
    }
  }

  private async loadValues(branchId: string, ownerType: CreatableOwnerType, ownerId: string): Promise<void> {
    const seq = ++this.valuesSeq;
    this.loadingValues.set(true);
    this.valuesFailed.set(false);
    try {
      const rows = await listValues(branchId, ownerType, ownerId);
      if (seq !== this.valuesSeq) return;
      const saved: Record<string, CustomFieldValueScalar> = {};
      const draft: Record<string, CustomFieldValueScalar> = {};
      for (const row of rows) {
        saved[row.fieldDefinitionId] = row.value;
        draft[row.fieldDefinitionId] = Array.isArray(row.value) ? [...row.value] : row.value;
      }
      this.savedMap.set(saved);
      this.draftMap.set(draft);
      this.rowErrors.set({});
    } catch (error) {
      if (seq !== this.valuesSeq) return;
      this.valuesFailed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.valuesSeq) {
        this.loadingValues.set(false);
      }
    }
  }

  private handleRowError(fieldId: string, error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'CUSTOM_FIELD_VALUE_INVALID' || code === 'CUSTOM_FIELD_REQUIRED' || code === 'CUSTOM_FIELD_INACTIVE') {
      this.setRowError(fieldId, this.transloco.translate(`customFields.errors.${code}`));
      return;
    }
    this.notify.error(this.resolveError(error));
  }

  private clientValidationMessage(field: CustomField): string {
    switch (field.type) {
      case 'NUMBER':
        return this.transloco.translate('customFields.validation.invalidNumber');
      case 'URL':
        return this.transloco.translate('customFields.validation.invalidUrl');
      case 'EMAIL':
        return this.transloco.translate('customFields.validation.invalidEmail');
      case 'PHONE':
        return this.transloco.translate('customFields.validation.invalidPhone');
      case 'DATE':
      case 'DATETIME':
        return this.transloco.translate('customFields.validation.invalidDate');
      case 'SELECT':
      case 'MULTI_SELECT':
        return this.transloco.translate('customFields.validation.invalidOption');
      default:
        return this.transloco.translate('customFields.errors.CUSTOM_FIELD_VALUE_INVALID');
    }
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const key = `customFields.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) return translated;
      if (code === 'CUSTOM_FIELD_NOT_FOUND') return this.transloco.translate('settings.errors.notFound');
    }
    return this.transloco.translate('settings.errors.generic');
  }

  private setRowError(fieldId: string, message: string | null): void {
    this.rowErrors.update((map) => ({ ...map, [fieldId]: message }));
  }

  private setRowSaving(fieldId: string, busy: boolean): void {
    this.savingIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(fieldId);
      else next.delete(fieldId);
      return next;
    });
  }

  private formatLocalDate(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private combineLocalDateTime(dateIso: string, timeHm: string): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const [hh, mm] = timeHm.split(':').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? `${dateIso}T${timeHm}:00.000Z` : dt.toISOString();
  }
}
