import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { FormField, disabled, form, max, min } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBraces, tablerChevronRight, tablerSearch } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { Modal } from '../../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../../shared/ui/segmented/segmented';
import type {
  TemplateAllowedFormatKind,
  TemplateBinding,
  TemplateBindingFormat,
  TemplateBindingNullBehavior,
  TemplateDateStyle,
  TemplateFieldDataType,
  TemplateSchemaField,
  TemplateTextTransform,
  TemplateTimeStyle,
} from '../../../templates.model';
import { DesignerState, SchemaDataType, SchemaField } from '../../designer-state';
import { isInHeaderOrFooterZone } from '../../document-ops';
import {
  SYSTEM_PAGE_FIELDS,
  formatDateExample,
  formatTimeExample,
  humanizeFieldFallback,
  normalizeSearchText,
} from '../field-helpers';
import { FieldRow } from '../field-row/field-row';

export interface FieldPickOptions {
  purpose: 'DATA_FIELD' | 'BINDING' | 'PATH';
  accept: 'SCALAR' | 'ARRAY' | 'ROW_SCALAR' | 'URL' | 'ANY';
  rowArrayPath?: string;
  dataTypes?: readonly SchemaDataType[];
  initial?: TemplateBinding | { path: string };
  titleKey?: string;
}

export interface FieldPickResult {
  path: string;
  field: SchemaField;
  binding?: TemplateBinding;
  label?: string;
  labelPosition?: 'BEFORE' | 'ABOVE';
  separator?: string;
}

interface DataFieldEditDefaults {
  label?: string;
  labelPosition?: 'BEFORE' | 'ABOVE';
  separator?: string;
  inHeaderOrFooter?: boolean;
}

interface EvaluatedFieldItem {
  field: TemplateSchemaField;
  label: string;
  groupKey: string;
  isObject: boolean;
  disabled: boolean;
  disabledReason: string | null;
}

interface FieldGroup {
  key: string;
  label: string;
  items: EvaluatedFieldItem[];
}

interface PickerFormModel {
  searchQuery: string;
  fallbackText: string;
  minFraction: number | null;
  maxFraction: number | null;
  useGrouping: boolean;
  trueText: string;
  falseText: string;
  dfLabel: string;
  dfSeparator: string;
}

type FormatChoice = 'NONE' | 'TEXT' | 'NUMBER' | 'CURRENCY' | 'PERCENTAGE' | 'DATE' | 'DATETIME' | 'BOOLEAN';

const DEFAULT_NULL_BEHAVIOR: TemplateBindingNullBehavior = 'EMPTY';

@Component({
  selector: 'app-tpl-field-picker',
  imports: [FormField, NgIcon, TranslocoPipe, Button, Checkbox, Dropdown, Field, Modal, Segmented, FieldRow],
  providers: [provideIcons({ tablerBraces, tablerChevronRight, tablerSearch })],
  templateUrl: './field-picker.html',
  host: { class: 'contents' },
})
export class FieldPicker {
  protected readonly state = inject(DesignerState);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('pickerModal');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly listContainer = viewChild<ElementRef<HTMLElement>>('listContainer');

  private resolver: ((result: FieldPickResult | null) => void) | null = null;
  private pendingDataFieldDefaults: DataFieldEditDefaults | null = null;

  protected readonly options = signal<FieldPickOptions | null>(null);
  protected readonly isEditDataField = signal(false);
  protected readonly editInHeaderOrFooter = signal(false);

  protected readonly reqFilter = signal<string | null>('ALL');
  protected readonly drillPrefix = signal<string | null>(null);
  protected readonly missingPathError = signal<string | null>(null);

  protected readonly selectedPath = signal<string | null>(null);
  protected readonly highlightedPath = signal<string | null>(null);

  // Binding settings (non-Signal-Forms dropdown/segmented state)
  protected readonly formatChoice = signal<FormatChoice>('NONE');
  protected readonly textTransform = signal<TemplateTextTransform>('NONE');
  protected readonly currencyCodePath = signal<string>('');
  protected readonly dateStyle = signal<TemplateDateStyle | 'DEFAULT'>('DEFAULT');
  protected readonly timeStyle = signal<TemplateTimeStyle>('SHORT');
  protected readonly nullBehavior = signal<TemplateBindingNullBehavior>(DEFAULT_NULL_BEHAVIOR);
  protected readonly dfLabelPosition = signal<'BEFORE' | 'ABOVE'>('BEFORE');

  protected readonly pickerModel = signal<PickerFormModel>({
    searchQuery: '',
    fallbackText: '',
    minFraction: 0,
    maxFraction: 2,
    useGrouping: true,
    trueText: '',
    falseText: '',
    dfLabel: '',
    dfSeparator: ': ',
  });

  protected readonly pickerForm = form(this.pickerModel, (p) => {
    disabled(p.fallbackText, () => this.nullBehavior() !== 'FALLBACK');
    min(p.minFraction, 0);
    max(p.minFraction, 8);
    min(p.maxFraction, 0);
    max(p.maxFraction, 8);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.settle(null));
  }

  /**
   * Opens the field picker modal and resolves with the selected field/binding or `null` if cancelled.
   */
  open(options: FieldPickOptions): Promise<FieldPickResult | null> {
    const schema = this.state.schema();
    if (!schema) {
      this.pendingDataFieldDefaults = null;
      this.notify.error(this.transloco.translate('tplFields.schemaUnavailable'));
      return Promise.resolve(null);
    }

    this.settle(null);

    const defaults = this.pendingDataFieldDefaults;
    this.pendingDataFieldDefaults = null;

    this.options.set(options);
    this.isEditDataField.set(options.purpose === 'DATA_FIELD' && (defaults !== null || options.initial !== undefined));
    this.editInHeaderOrFooter.set(Boolean(defaults?.inHeaderOrFooter));
    this.reqFilter.set('ALL');
    this.drillPrefix.set(null);
    this.missingPathError.set(null);

    this.resetBindingControls();
    this.dfLabelPosition.set(defaults?.labelPosition ?? 'BEFORE');
    this.pickerModel.update((m) => ({
      ...m,
      searchQuery: '',
      dfLabel: defaults?.label ?? '',
      dfSeparator: defaults?.separator ?? ': ',
    }));

    const initialPath = options.initial?.path?.trim() ?? '';
    if (initialPath) {
      const matched = this.findFieldByPath(initialPath);
      if (!matched) {
        this.selectedPath.set(null);
        this.highlightedPath.set(null);
        this.missingPathError.set(this.transloco.translate('tplFields.picker.missing', { path: initialPath }));
      } else {
        this.selectedPath.set(matched.path);
        this.highlightedPath.set(matched.path);
        const parentObj = this.findParentObjectPath(matched.path, schema.fields);
        if (parentObj && options.accept !== 'ROW_SCALAR') {
          this.drillPrefix.set(parentObj);
        }
        if ('nullBehavior' in (options.initial ?? {})) {
          this.applyInitialBinding(options.initial as TemplateBinding, matched);
        } else {
          this.applyDefaultFormatForField(matched);
        }
      }
    } else {
      this.selectedPath.set(null);
      this.highlightedPath.set(null);
    }

    this.modal().open();

    return new Promise<FieldPickResult | null>((resolve) => {
      this.resolver = resolve;
    });
  }

  /**
   * Opens the picker in DATA_FIELD edit mode with pre-populated label properties.
   */
  openDataFieldEdit(options: FieldPickOptions, defaults: DataFieldEditDefaults): Promise<FieldPickResult | null> {
    this.pendingDataFieldDefaults = defaults;
    return this.open(options);
  }

  protected readonly modalTitle = computed(() => {
    this.language();
    this.i18n();
    const opts = this.options();
    if (!opts) return '';
    if (opts.titleKey) {
      return this.transloco.translate(`tplFields.${opts.titleKey}`);
    }
    if (opts.purpose === 'DATA_FIELD') {
      return this.transloco.translate(opts.initial ? 'tplFields.picker.editTitle' : 'tplFields.picker.insertTitle');
    }
    if (opts.purpose === 'BINDING') {
      return this.transloco.translate('tplFields.picker.editTitle');
    }
    return this.transloco.translate('tplFields.picker.chooseTitle');
  });

  protected readonly confirmLabel = computed(() => {
    this.language();
    this.i18n();
    const opts = this.options();
    if (!opts) return '';
    if (opts.purpose === 'DATA_FIELD') {
      return this.transloco.translate(opts.initial ? 'tplFields.picker.apply' : 'tplFields.picker.insert');
    }
    if (opts.purpose === 'BINDING') {
      return this.transloco.translate('tplFields.picker.apply');
    }
    return this.transloco.translate('tplFields.picker.choose');
  });

  protected readonly reqOptions = computed<SegmentedOption[]>(() => {
    this.language();
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('tplFields.picker.all') },
      { value: 'REQUIRED', label: this.transloco.translate('tplFields.picker.required') },
      { value: 'OPTIONAL', label: this.transloco.translate('tplFields.picker.optional') },
    ];
  });

  protected readonly allowSystemPageFields = computed(() => {
    const opts = this.options();
    const doc = this.state.document();
    if (!opts || !doc || this.state.channel() !== 'PRINT') return false;
    if (opts.purpose !== 'DATA_FIELD') return false;
    if (opts.accept !== 'SCALAR' && opts.accept !== 'ANY') return false;
    if (opts.dataTypes && opts.dataTypes.length > 0) return false;
    if (doc.layoutMode === 'FIXED_CANVAS') return true;
    if (this.editInHeaderOrFooter()) return true;
    return this.state.selectedNodes().some((n) => isInHeaderOrFooterZone(doc, n.id));
  });

  protected readonly objectPaths = computed<ReadonlySet<string>>(() => {
    const schema = this.state.schema();
    if (!schema) return new Set<string>();
    const set = new Set<string>();
    for (const f of schema.fields) {
      if (f.dataType === 'OBJECT') {
        set.add(f.path);
      }
    }
    return set;
  });

  protected readonly breadcrumbs = computed<{ path: string | null; label: string }[]>(() => {
    this.language();
    this.i18n();
    const prefix = this.drillPrefix();
    const root = { path: null, label: this.transloco.translate('tplFields.picker.allFields') };
    if (!prefix) return [root];

    const schema = this.state.schema();
    const crumbs: { path: string | null; label: string }[] = [root];
    const parts = prefix.split('.');
    for (let i = 0; i < parts.length; i++) {
      const p = parts.slice(0, i + 1).join('.');
      const matched = schema?.fields.find((f) => f.path === p);
      if (matched || i === parts.length - 1) {
        crumbs.push({
          path: p,
          label: matched ? this.translateFieldLabel(matched) : humanizeFieldFallback(p),
        });
      }
    }
    return crumbs;
  });

  protected readonly visibleGroups = computed<FieldGroup[]>(() => {
    this.language();
    this.i18n();
    const schema = this.state.schema();
    const opts = this.options();
    if (!schema || !opts) return [];

    const prefix = this.drillPrefix();
    const query = normalizeSearchText(this.pickerModel().searchQuery.trim());
    const req = this.reqFilter() ?? 'ALL';
    const objPaths = this.objectPaths();

    const rawCandidates: { field: TemplateSchemaField; forceGroup?: string }[] = [];

    if (!prefix && this.allowSystemPageFields()) {
      for (const pf of SYSTEM_PAGE_FIELDS) {
        rawCandidates.push({ field: pf, forceGroup: 'page' });
      }
    }

    if (opts.accept === 'ROW_SCALAR') {
      const arrPath = opts.rowArrayPath?.replace(/\[\]$/, '') ?? '';
      const rowPrefix = arrPath ? `${arrPath}[].` : '';
      for (const f of schema.fields) {
        if (!rowPrefix) {
          if (f.path.includes('[].')) rawCandidates.push({ field: f });
        } else if (f.path.startsWith(rowPrefix)) {
          rawCandidates.push({ field: f });
        }
      }
    } else {
      for (const f of schema.fields) {
        if (f.path.includes('[]')) continue;
        if (prefix) {
          if (!f.path.startsWith(`${prefix}.`)) continue;
          const rest = f.path.slice(prefix.length + 1);
          const hasCloserObj = Array.from(objPaths).some(
            (op) => op.length > prefix.length && f.path.startsWith(`${op}.`),
          );
          if (hasCloserObj) continue;
          if (!rest) continue;
        } else if (!query) {
          const nestedUnderObject = Array.from(objPaths).some((op) => f.path.startsWith(`${op}.`));
          if (nestedUnderObject) continue;
        }
        rawCandidates.push({ field: f });
      }
    }

    const groupsMap = new Map<string, FieldGroup>();

    for (const { field, forceGroup } of rawCandidates) {
      const isReq = !field.nullable && !field.parentNullable;
      if (req === 'REQUIRED' && !isReq) continue;
      if (req === 'OPTIONAL' && isReq) continue;

      const label = this.translateFieldLabel(field);
      if (query) {
        const hayLabel = normalizeSearchText(label);
        const hayPath = normalizeSearchText(field.path);
        if (!hayLabel.includes(query) && !hayPath.includes(query)) continue;
      }

      const isObject = field.dataType === 'OBJECT';
      const { disabled, disabledReason } = this.evaluateAccept(field, opts);
      const groupKey = forceGroup ?? this.groupKeyOf(field.path);

      let group = groupsMap.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          label: this.translateGroupLabel(groupKey),
          items: [],
        };
        groupsMap.set(groupKey, group);
      }

      group.items.push({
        field,
        label,
        groupKey,
        isObject,
        disabled,
        disabledReason,
      });
    }

    return Array.from(groupsMap.values());
  });

  protected readonly flatVisibleItems = computed<EvaluatedFieldItem[]>(() => {
    return this.visibleGroups().flatMap((g) => g.items);
  });

  protected readonly countLine = computed(() => {
    this.language();
    this.i18n();
    const schema = this.state.schema();
    if (!schema) return '';
    const sourceKey = `tplFields.sources.${schema.adapterKey}`;
    const sourceTranslated = this.transloco.translate(sourceKey);
    const source = sourceTranslated && sourceTranslated !== sourceKey ? sourceTranslated : schema.adapterKey;
    const total = schema.fieldCount;
    const isFiltered =
      this.pickerModel().searchQuery.trim().length > 0 || (this.reqFilter() ?? 'ALL') !== 'ALL' || this.drillPrefix() !== null;
    if (!isFiltered) {
      return this.transloco.translate('tplFields.picker.count', { source, n: total });
    }
    return this.transloco.translate('tplFields.picker.countFiltered', {
      shown: this.flatVisibleItems().length,
      n: total,
    });
  });

  protected readonly selectedField = computed<TemplateSchemaField | null>(() => {
    const path = this.selectedPath();
    const opts = this.options();
    if (!path || !opts) return null;
    return this.findFieldByPath(path, opts);
  });

  protected readonly showBindingSettings = computed(() => {
    const opts = this.options();
    const field = this.selectedField();
    return Boolean(opts && opts.purpose !== 'PATH' && field && field.dataType !== 'OBJECT');
  });

  protected readonly showDataFieldLabelRow = computed(() => {
    return this.options()?.purpose === 'DATA_FIELD' && this.isEditDataField() && this.showBindingSettings();
  });

  protected readonly formatKind = computed<'NONE' | 'TEXT' | 'NUMBER_LIKE' | 'CURRENCY' | 'DATE' | 'DATETIME' | 'BOOLEAN'>(() => {
    const field = this.selectedField();
    if (!field) return 'NONE';
    if (field.dataType === 'STRING') {
      return field.allowedFormats.includes('TEXT') ? 'TEXT' : 'NONE';
    }
    if (field.dataType === 'DATE') {
      return field.allowedFormats.includes('DATE') ? 'DATE' : 'NONE';
    }
    if (field.dataType === 'DATETIME') {
      return field.allowedFormats.includes('DATETIME') ? 'DATETIME' : 'NONE';
    }
    if (field.dataType === 'BOOLEAN') {
      return field.allowedFormats.includes('BOOLEAN') ? 'BOOLEAN' : 'NONE';
    }
    if (field.dataType === 'CURRENCY') {
      return 'CURRENCY';
    }
    if (field.dataType === 'NUMBER' || field.dataType === 'DECIMAL' || field.dataType === 'PERCENTAGE') {
      return field.allowedFormats.some((f) => f === 'NUMBER' || f === 'PERCENTAGE') ? 'NUMBER_LIKE' : 'NONE';
    }
    return 'NONE';
  });

  protected readonly textTransformOptions = computed<DropdownOption<TemplateTextTransform>[]>(() => {
    this.language();
    this.i18n();
    return (['NONE', 'UPPERCASE', 'LOWERCASE'] as const).map((val) => ({
      value: val,
      label: this.transloco.translate(`tplFields.format.transform.${val}`),
    }));
  });

  protected readonly formatDropdownOptions = computed<DropdownOption<FormatChoice>[]>(() => {
    this.language();
    this.i18n();
    const field = this.selectedField();
    if (!field) return [];
    const options: DropdownOption<FormatChoice>[] = [
      { value: 'NONE', label: this.transloco.translate('tplFields.format.kind.NONE') },
    ];
    for (const fmt of field.allowedFormats) {
      if (fmt === 'NUMBER' || fmt === 'CURRENCY' || fmt === 'PERCENTAGE' || fmt === 'BOOLEAN') {
        options.push({
          value: fmt,
          label: this.transloco.translate(`tplFields.format.kind.${fmt}`),
        });
      }
    }
    return options;
  });

  protected readonly dateStyleOptions = computed<DropdownOption<TemplateDateStyle | 'DEFAULT'>[]>(() => {
    const lang = this.language();
    this.i18n();
    return [
      { value: 'DEFAULT', label: this.transloco.translate('tplFields.format.none') },
      ...(['SHORT', 'MEDIUM', 'LONG'] as const).map((style) => ({
        value: style,
        label: `${this.transloco.translate(`tplFields.format.dateStyle.${style}`)} · ${formatDateExample(style, lang)}`,
      })),
    ];
  });

  protected readonly timeStyleOptions = computed<DropdownOption<TemplateTimeStyle>[]>(() => {
    const lang = this.language();
    this.i18n();
    return (['SHORT', 'MEDIUM'] as const).map((style) => ({
      value: style,
      label: `${this.transloco.translate(`tplFields.format.timeStyle.${style}`)} · ${formatTimeExample(style, lang)}`,
    }));
  });

  protected readonly nullBehaviorOptions = computed<DropdownOption<TemplateBindingNullBehavior>[]>(() => {
    this.language();
    this.i18n();
    return (['EMPTY', 'FALLBACK', 'ERROR'] as const).map((val) => ({
      value: val,
      label: this.transloco.translate(`tplFields.when.${val}`),
    }));
  });

  protected readonly currencyCodePathOptions = computed<DropdownOption<string>[]>(() => {
    this.language();
    this.i18n();
    const schema = this.state.schema();
    const list: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('tplFields.format.currencyFromNone') },
    ];
    if (!schema) return list;
    for (const f of schema.fields) {
      if (f.dataType === 'STRING' && !f.path.includes('[]')) {
        list.push({
          value: f.path,
          label: `${this.translateFieldLabel(f)} (${f.path})`,
        });
      }
    }
    return list;
  });

  protected readonly labelPositionOptions = computed<DropdownOption<'BEFORE' | 'ABOVE'>[]>(() => {
    this.language();
    this.i18n();
    return (['BEFORE', 'ABOVE'] as const).map((pos) => ({
      value: pos,
      label: this.transloco.translate(`tplFields.dataField.position.${pos}`),
    }));
  });

  protected readonly showFractionControls = computed(() => {
    const choice = this.formatChoice();
    return (
      this.showBindingSettings() &&
      (choice === 'NUMBER' || choice === 'CURRENCY' || choice === 'PERCENTAGE')
    );
  });

  protected readonly showCurrencyFromControl = computed(() => {
    return this.showBindingSettings() && this.formatChoice() === 'CURRENCY';
  });

  protected readonly showBooleanControls = computed(() => {
    return this.showBindingSettings() && this.formatChoice() === 'BOOLEAN';
  });

  protected readonly showDateTimeSubControl = computed(() => {
    return (
      this.showBindingSettings() &&
      this.formatKind() === 'DATETIME' &&
      this.dateStyle() !== 'DEFAULT'
    );
  });

  protected readonly fallbackError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showBindingSettings() || this.nullBehavior() !== 'FALLBACK') return null;
    const text = this.pickerModel().fallbackText;
    if (!text.trim()) return this.transloco.translate('tplFields.fallback.required');
    if (text.length > 500) return this.transloco.translate('tplFields.fallback.tooLong');
    return null;
  });

  protected readonly minDecimalsError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showFractionControls()) return null;
    if (this.pickerForm.minFraction().errors().some((e) => e.kind === 'parse')) {
      return this.transloco.translate('tplFields.format.decimalsRangeError');
    }
    const minVal = this.pickerModel().minFraction;
    if (minVal === null || !Number.isInteger(minVal) || minVal < 0 || minVal > 8) {
      return this.transloco.translate('tplFields.format.decimalsRangeError');
    }
    const maxVal = this.pickerModel().maxFraction;
    if (maxVal !== null && Number.isInteger(maxVal) && minVal > maxVal) {
      return this.transloco.translate('tplFields.format.decimalsOrderError');
    }
    return null;
  });

  protected readonly maxDecimalsError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showFractionControls()) return null;
    if (this.pickerForm.maxFraction().errors().some((e) => e.kind === 'parse')) {
      return this.transloco.translate('tplFields.format.decimalsRangeError');
    }
    const maxVal = this.pickerModel().maxFraction;
    if (maxVal === null || !Number.isInteger(maxVal) || maxVal < 0 || maxVal > 8) {
      return this.transloco.translate('tplFields.format.decimalsRangeError');
    }
    return null;
  });

  protected readonly trueTextError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showBooleanControls()) return null;
    const text = this.pickerModel().trueText;
    if (!text.trim()) return this.transloco.translate('tplFields.format.booleanRequired');
    return text.length > 200 ? this.transloco.translate('tplFields.format.booleanTooLong') : null;
  });

  protected readonly falseTextError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showBooleanControls()) return null;
    const text = this.pickerModel().falseText;
    if (!text.trim()) return this.transloco.translate('tplFields.format.booleanRequired');
    return text.length > 200 ? this.transloco.translate('tplFields.format.booleanTooLong') : null;
  });

  protected readonly dfLabelError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showDataFieldLabelRow()) return null;
    return this.pickerModel().dfLabel.length > 500 ? this.transloco.translate('tplFields.dataField.labelTooLong') : null;
  });

  protected readonly dfSeparatorError = computed<string | null>(() => {
    this.language();
    this.i18n();
    if (!this.showDataFieldLabelRow()) return null;
    return this.pickerModel().dfSeparator.length > 20 ? this.transloco.translate('tplFields.dataField.separatorTooLong') : null;
  });

  protected readonly canSubmit = computed(() => {
    const field = this.selectedField();
    const opts = this.options();
    if (!field || !opts || field.dataType === 'OBJECT') return false;
    if (this.evaluateAccept(field, opts).disabled) return false;
    if (opts.purpose === 'PATH') return true;
    const { fallbackText } = this.pickerModel();
    if (this.nullBehavior() === 'FALLBACK' && (!fallbackText.trim() || fallbackText.length > 500)) {
      return false;
    }
    if (this.minDecimalsError() || this.maxDecimalsError()) return false;
    if (this.trueTextError() || this.falseTextError()) return false;
    if (this.dfLabelError() || this.dfSeparatorError()) return false;
    return true;
  });

  protected typeLabel(dataType: TemplateFieldDataType): string {
    return this.transloco.translate(`tplFields.type.${dataType}`);
  }

  protected onRowPicked(item: EvaluatedFieldItem): void {
    if (item.disabled) return;
    if (item.isObject) {
      this.drillPrefix.set(item.field.path);
      this.highlightedPath.set(null);
      return;
    }

    if (this.selectedPath() === item.field.path) {
      this.highlightedPath.set(item.field.path);
      return;
    }

    this.missingPathError.set(null);
    this.selectedPath.set(item.field.path);
    this.highlightedPath.set(item.field.path);

    if (this.options()?.purpose !== 'PATH') {
      this.applyDefaultFormatForField(item.field);
    }
  }

  protected onBreadcrumbClick(path: string | null): void {
    this.drillPrefix.set(path);
    this.highlightedPath.set(null);
  }

  protected onNullBehaviorChange(next: TemplateBindingNullBehavior): void {
    this.nullBehavior.set(next);
    if (next !== 'FALLBACK') {
      this.pickerModel.update((m) => ({ ...m, fallbackText: '' }));
    }
  }

  protected onModalKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const searchEl = this.searchInput()?.nativeElement;
    const listEl = this.listContainer()?.nativeElement;
    const inSearch = Boolean(target && searchEl && target === searchEl);
    const inListbox = Boolean(target && listEl && listEl.contains(target) && target.closest('[role="option"]'));

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!inSearch && !inListbox) return;
      const items = this.flatVisibleItems();
      if (items.length === 0) return;
      event.preventDefault();

      const currentPath = this.highlightedPath() ?? this.selectedPath();
      const currentIdx = currentPath ? items.findIndex((i) => i.field.path === currentPath) : -1;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIdx =
        currentIdx < 0
          ? delta > 0
            ? 0
            : items.length - 1
          : (currentIdx + delta + items.length) % items.length;
      const next = items[nextIdx];
      this.highlightedPath.set(next.field.path);
      this.scrollRowIntoView(next.field.path, inListbox);
      return;
    }

    if (event.key === 'Enter' && inSearch) {
      const targetPath = this.highlightedPath() ?? this.selectedPath();
      if (!targetPath) return;
      const item = this.flatVisibleItems().find((i) => i.field.path === targetPath);
      if (item && !item.disabled) {
        event.preventDefault();
        this.onRowPicked(item);
      }
      return;
    }

    const tag = target?.tagName ?? '';
    const inEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (
      !inEditable &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.length === 1 &&
      /\S/.test(event.key)
    ) {
      searchEl?.focus();
    }
  }

  protected submit(): void {
    const field = this.selectedField();
    const opts = this.options();
    if (!field || !opts || !this.canSubmit()) return;

    if (opts.purpose === 'PATH') {
      this.settle({ path: field.path, field });
      this.modal().close();
      return;
    }

    const { fallbackText, dfLabel, dfSeparator } = this.pickerModel();
    const behavior = this.nullBehavior();
    const format = this.buildFormatPayload(field);
    const binding: TemplateBinding = {
      path: field.path,
      nullBehavior: behavior,
      ...(behavior === 'FALLBACK' ? { fallback: fallbackText.trim() } : {}),
      ...(format ? { format } : {}),
    };

    const result: FieldPickResult = {
      path: field.path,
      field,
      binding,
    };

    if (opts.purpose === 'DATA_FIELD' && this.isEditDataField()) {
      const lbl = dfLabel.trim();
      if (lbl) {
        result.label = lbl;
        result.labelPosition = this.dfLabelPosition();
        result.separator = dfSeparator;
      }
    }

    this.settle(result);
    this.modal().close();
  }

  protected cancel(): void {
    this.settle(null);
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.settle(null);
  }

  private settle(result: FieldPickResult | null): void {
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }

  private scrollRowIntoView(path: string, moveFocus = false): void {
    const container = this.listContainer()?.nativeElement;
    if (!container) return;
    const el = container.querySelector(`[data-field-path="${CSS.escape(path)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' });
      if (moveFocus) {
        el.focus({ preventScroll: true });
      }
    }
  }

  private findFieldByPath(path: string, _opts?: FieldPickOptions): TemplateSchemaField | null {
    const schema = this.state.schema();
    const inSchema = schema?.fields.find((f) => f.path === path);
    if (inSchema) return inSchema;
    if (this.allowSystemPageFields()) {
      return SYSTEM_PAGE_FIELDS.find((f) => f.path === path) ?? null;
    }
    return null;
  }

  private findParentObjectPath(path: string, fields: readonly TemplateSchemaField[]): string | null {
    const objPaths = fields.filter((f) => f.dataType === 'OBJECT').map((f) => f.path);
    let best: string | null = null;
    for (const op of objPaths) {
      if (path.startsWith(`${op}.`) && (!best || op.length > best.length)) {
        best = op;
      }
    }
    return best;
  }

  private evaluateAccept(
    field: TemplateSchemaField,
    opts: FieldPickOptions,
  ): { disabled: boolean; disabledReason: string | null } {
    if (field.dataType === 'OBJECT') {
      return { disabled: false, disabledReason: null };
    }

    if (opts.dataTypes && opts.dataTypes.length > 0 && !opts.dataTypes.includes(field.dataType)) {
      if (field.dataType === 'ARRAY') {
        return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.listOnly') };
      }
      return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.typeNotAllowed') };
    }

    switch (opts.accept) {
      case 'SCALAR':
      case 'ROW_SCALAR':
        if (field.dataType === 'ARRAY') {
          return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.listOnly') };
        }
        if (field.dataType === 'IMAGE') {
          return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.imageOnly') };
        }
        return { disabled: false, disabledReason: null };
      case 'ARRAY':
        if (field.dataType !== 'ARRAY') {
          return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.arrayOnly') };
        }
        return { disabled: false, disabledReason: null };
      case 'URL':
        // TemplateSchemaField exposes valueEncoding without a URL-specific encoding enum value,
        // so STRING fields are permitted for URL links.
        if (field.dataType !== 'STRING') {
          return { disabled: true, disabledReason: this.transloco.translate('tplFields.picker.urlOnly') };
        }
        return { disabled: false, disabledReason: null };
      case 'ANY':
      default:
        return { disabled: false, disabledReason: null };
    }
  }

  private groupKeyOf(path: string): string {
    const cleaned = path.replace(/\[\].*$/, '');
    const first = cleaned.split('.')[0] ?? path;
    return first;
  }

  private translateGroupLabel(groupKey: string): string {
    const key = `tplFields.group.${groupKey}`;
    const translated = this.transloco.translate(key);
    if (translated && translated !== key) return translated;
    return humanizeFieldFallback(groupKey);
  }

  private translateFieldLabel(field: TemplateSchemaField): string {
    const scopedKey = `tplFields.labels.${field.labelKey}`;
    const scoped = this.transloco.translate(scopedKey);
    if (scoped && scoped !== scopedKey) return scoped;
    const direct = this.transloco.translate(field.labelKey);
    if (direct && direct !== field.labelKey) return direct;
    return humanizeFieldFallback(field.path);
  }

  private resetBindingControls(): void {
    this.formatChoice.set('NONE');
    this.textTransform.set('NONE');
    this.currencyCodePath.set('');
    this.dateStyle.set('DEFAULT');
    this.timeStyle.set('SHORT');
    this.nullBehavior.set('EMPTY');
    this.pickerModel.update((m) => ({
      ...m,
      minFraction: 0,
      maxFraction: 2,
      useGrouping: true,
      trueText: '',
      falseText: '',
      fallbackText: '',
    }));
  }

  private applyDefaultFormatForField(field: TemplateSchemaField): void {
    this.formatChoice.set('NONE');
    this.textTransform.set('NONE');
    this.dateStyle.set('DEFAULT');
    this.timeStyle.set('SHORT');
    this.currencyCodePath.set('');
    this.pickerModel.update((m) => ({
      ...m,
      minFraction: 0,
      maxFraction: field.dataType === 'NUMBER' ? 0 : 2,
      useGrouping: true,
      trueText: '',
      falseText: '',
    }));
  }

  private applyInitialBinding(binding: TemplateBinding, field: TemplateSchemaField): void {
    this.applyDefaultFormatForField(field);
    this.nullBehavior.set(binding.nullBehavior ?? 'EMPTY');
    this.pickerModel.update((m) => ({
      ...m,
      fallbackText: binding.nullBehavior === 'FALLBACK' ? (binding.fallback ?? '') : '',
    }));

    const fmt = binding.format;
    if (!fmt) return;

    switch (fmt.kind) {
      case 'TEXT':
        this.formatChoice.set('TEXT');
        this.textTransform.set(fmt.transform ?? 'NONE');
        break;
      case 'NUMBER':
        this.formatChoice.set('NUMBER');
        this.pickerModel.update((m) => ({
          ...m,
          minFraction: fmt.minFractionDigits ?? 0,
          maxFraction: fmt.maxFractionDigits ?? 2,
          useGrouping: fmt.useGrouping ?? true,
        }));
        break;
      case 'CURRENCY':
        this.formatChoice.set('CURRENCY');
        this.currencyCodePath.set(fmt.currencyCodePath ?? '');
        this.pickerModel.update((m) => ({
          ...m,
          minFraction: fmt.minFractionDigits ?? 2,
          maxFraction: fmt.maxFractionDigits ?? 2,
          useGrouping: fmt.useGrouping ?? true,
        }));
        break;
      case 'PERCENTAGE':
        this.formatChoice.set('PERCENTAGE');
        this.pickerModel.update((m) => ({
          ...m,
          minFraction: fmt.minFractionDigits ?? 0,
          maxFraction: fmt.maxFractionDigits ?? 2,
          useGrouping: fmt.useGrouping ?? true,
        }));
        break;
      case 'DATE':
        this.formatChoice.set('DATE');
        this.dateStyle.set(fmt.dateStyle);
        break;
      case 'DATETIME':
        this.formatChoice.set('DATETIME');
        this.dateStyle.set(fmt.dateStyle);
        this.timeStyle.set(fmt.timeStyle);
        break;
      case 'BOOLEAN':
        this.formatChoice.set('BOOLEAN');
        this.pickerModel.update((m) => ({
          ...m,
          trueText: fmt.trueText,
          falseText: fmt.falseText,
        }));
        break;
    }
  }

  private buildFormatPayload(field: TemplateSchemaField): TemplateBindingFormat | undefined {
    const kind = this.formatKind();
    if (kind === 'TEXT') {
      const t = this.textTransform();
      return t === 'NONE' ? undefined : { kind: 'TEXT', transform: t };
    }
    if (kind === 'DATE') {
      const ds = this.dateStyle();
      return ds === 'DEFAULT' ? undefined : { kind: 'DATE', dateStyle: ds };
    }
    if (kind === 'DATETIME') {
      const ds = this.dateStyle();
      return ds === 'DEFAULT' ? undefined : { kind: 'DATETIME', dateStyle: ds, timeStyle: this.timeStyle() };
    }

    const choice = this.formatChoice();
    if (choice === 'NONE') return undefined;

    const m = this.pickerModel();
    const minDigits = m.minFraction ?? 0;
    const maxDigits = m.maxFraction ?? 2;

    if (choice === 'NUMBER' && field.allowedFormats.includes('NUMBER')) {
      return {
        kind: 'NUMBER',
        minFractionDigits: minDigits,
        maxFractionDigits: maxDigits,
        useGrouping: m.useGrouping,
      };
    }
    if (choice === 'PERCENTAGE' && field.allowedFormats.includes('PERCENTAGE')) {
      return {
        kind: 'PERCENTAGE',
        minFractionDigits: minDigits,
        maxFractionDigits: maxDigits,
        useGrouping: m.useGrouping,
      };
    }
    if (choice === 'CURRENCY' && field.allowedFormats.includes('CURRENCY')) {
      const codePath = this.currencyCodePath().trim();
      return {
        kind: 'CURRENCY',
        ...(codePath ? { currencyCodePath: codePath } : {}),
        minFractionDigits: minDigits,
        maxFractionDigits: maxDigits,
        useGrouping: m.useGrouping,
      };
    }
    if (choice === 'BOOLEAN' && field.allowedFormats.includes('BOOLEAN')) {
      return {
        kind: 'BOOLEAN',
        trueText: m.trueText.trim(),
        falseText: m.falseText.trim(),
      };
    }

    return undefined;
  }
}

export type AllowedFormatType = TemplateAllowedFormatKind;
