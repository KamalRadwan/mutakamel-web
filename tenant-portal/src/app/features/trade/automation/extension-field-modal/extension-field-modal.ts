import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerPlus, tablerPuzzle, tablerTrash, tablerUsers } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../shared/ui/switch/switch';
import { TagPicker, type TagOption } from '../../../../shared/ui/tag-picker/tag-picker';
import type { ExtensionField, ExtensionObjectProperty, ExtensionProfile } from '../extensions.model';
import {
  DEFAULT_STRATEGIES,
  EXTENSION_COLLECTION_SCHEMA,
  EXTENSION_OBJECT_SCHEMA,
  EXTENSION_VALUE_SCHEMA_VERSION,
  FIELD_KEY,
  LIMITS,
  SCALAR_TYPES,
  VALUE_KINDS,
  VISIBILITY,
  fieldAllowedValues,
  fieldProperties,
  isReservedKey,
} from '../extensions.registry';

type TargetCode = ExtensionProfile['targetCode'];
type ValueKind = ExtensionField['valueKind'];
type ScalarType = NonNullable<ExtensionField['scalarType']>;
type FieldVisibility = ExtensionField['visibilityCode'];
type DefaultStrategy = ExtensionField['defaultStrategy'];
type ObjectProperty = ExtensionObjectProperty;

interface PropertyDraft {
  id: number;
  key: string;
  scalarType: ScalarType;
  isRequired: boolean;
  maxLengthText: string;
  decimalScaleText: string;
  minText: string;
  maxText: string;
  choices: string[];
  choicePool: string[];
}

const PROPERTY_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INT_RE = /^\d+$/;

function parseSignedDecimal(raw: string): { negative: boolean; intBig: bigint; frac: string } | null {
  const trimmed = raw.trim();
  if (!SIGNED_DECIMAL_RE.test(trimmed)) return null;
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const dot = unsigned.indexOf('.');
  const intPart = dot >= 0 ? unsigned.slice(0, dot) : unsigned;
  const fracPart = dot >= 0 ? unsigned.slice(dot + 1) : '';
  const frac = fracPart.replace(/0+$/, '');
  const intBig = BigInt(intPart);
  return { negative: negative && (intBig !== 0n || frac.length > 0), intBig, frac };
}

function compareSignedDecimals(a: string, b: string): number | null {
  const pa = parseSignedDecimal(a);
  const pb = parseSignedDecimal(b);
  if (!pa || !pb) return null;
  if (pa.negative !== pb.negative) return pa.negative ? -1 : 1;
  const sign = pa.negative ? -1 : 1;
  if (pa.intBig !== pb.intBig) {
    return (pa.intBig < pb.intBig ? -1 : 1) * sign;
  }
  const len = Math.max(pa.frac.length, pb.frac.length);
  const fa = pa.frac.padEnd(len, '0');
  const fb = pb.frac.padEnd(len, '0');
  if (fa === fb) return 0;
  return (fa < fb ? -1 : 1) * sign;
}

function isValidIsoDate(raw: string): boolean {
  const match = ISO_DATE_RE.exec(raw.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

function reservedSegmentOf(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed || !isReservedKey(trimmed)) return null;
  const dot = trimmed.indexOf('.');
  if (dot < 0) return trimmed;
  const ns = trimmed.slice(0, dot);
  const name = trimmed.slice(dot + 1);
  if (name && isReservedKey(`x.${name}`)) return name;
  if (ns && isReservedKey(`${ns}.x`)) return ns;
  return name || trimmed;
}

function parseIntInRange(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!INT_RE.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num < min || num > max) return null;
  return num;
}

function toTagOptions(values: readonly string[]): TagOption[] {
  return values.map((val) => ({
    id: val,
    name: val,
    backgroundColor: null,
    textColor: null,
  }));
}

let nextModalId = 0;
let nextPropId = 0;

@Component({
  selector: 'app-extension-field-modal',
  imports: [
    NgTemplateOutlet,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TagPicker,
  ],
  providers: [provideIcons({ tablerCircleX, tablerPlus, tablerPuzzle, tablerTrash, tablerUsers })],
  templateUrl: './extension-field-modal.html',
})
export class ExtensionFieldModal {
  protected readonly uid = `ext-field-modal-${++nextModalId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild(Modal);
  private readonly discardDialog = viewChild<ConfirmDialog>('discardDialog');

  readonly inline = input(false);
  readonly targetCode = input<TargetCode>('CATALOG_ITEM');
  readonly existingKeys = input<readonly string[]>([]);

  readonly saved = output<ExtensionField>();

  protected readonly limits = LIMITS;

  private readonly modalTargetCode = signal<TargetCode>('CATALOG_ITEM');
  private readonly modalExistingKeys = signal<readonly string[]>([]);
  private readonly editingOriginal = signal<ExtensionField | null>(null);
  protected readonly isEdit = computed(() => !this.inline() && this.editingOriginal() !== null);
  protected readonly activeTargetCode = computed(() =>
    this.inline() ? this.targetCode() : this.modalTargetCode(),
  );
  protected readonly activeExistingKeys = computed(() =>
    this.inline() ? this.existingKeys() : this.modalExistingKeys(),
  );
  protected readonly isItemTarget = computed(() => this.activeTargetCode() === 'CATALOG_ITEM');

  protected readonly fieldKey = signal('');
  protected readonly visibility = signal<FieldVisibility>('USER');
  protected readonly valueKind = signal<ValueKind>('SCALAR');
  protected readonly scalarType = signal<ScalarType>('STRING');
  protected readonly maxLengthText = signal('');
  protected readonly maxItemsText = signal('10');
  protected readonly decimalScaleText = signal(String(LIMITS.decimalScale));
  protected readonly minText = signal('');
  protected readonly maxText = signal('');
  protected readonly choices = signal<string[]>([]);
  private readonly choicePool = signal<string[]>([]);

  protected readonly defaultStrategy = signal<DefaultStrategy>('NONE');
  protected readonly defaultScalarText = signal('');
  protected readonly defaultBoolStr = signal<string | null>(null);
  protected readonly defaultDateStr = signal<string | null>(null);
  protected readonly defaultListValues = signal<string[]>([]);
  private readonly defaultListPool = signal<string[]>([]);

  protected readonly isRequired = signal(false);
  protected readonly isSearchable = signal(false);
  protected readonly properties = signal<PropertyDraft[]>([this.newPropertyDraft()]);

  protected readonly submitted = signal(false);
  private readonly keyTouched = signal(false);
  private initialSnapshot = '';
  private allowClose = false;
  private confirmingLeave = false;

  protected readonly createChoiceFn = async (name: string): Promise<TagOption> => {
    const clean = name.trim();
    const existing = this.choicePool().find((item) => item.toLowerCase() === clean.toLowerCase());
    if (existing) {
      return { id: existing, name: existing, backgroundColor: null, textColor: null };
    }
    this.choicePool.update((pool) => [...pool, clean]);
    return { id: clean, name: clean, backgroundColor: null, textColor: null };
  };

  protected readonly createDefaultListItemFn = async (name: string): Promise<TagOption> => {
    const clean = name.trim();
    const existing = this.defaultListPool().find((item) => item === clean);
    if (existing) {
      return { id: existing, name: existing, backgroundColor: null, textColor: null };
    }
    this.defaultListPool.update((pool) => [...pool, clean]);
    return { id: clean, name: clean, backgroundColor: null, textColor: null };
  };

  protected readonly propChoiceCreator = (propId: number) => {
    return async (name: string): Promise<TagOption> => {
      const clean = name.trim();
      const target = this.properties().find((p) => p.id === propId);
      const existing = target?.choicePool.find((item) => item.toLowerCase() === clean.toLowerCase());
      if (existing) {
        return { id: existing, name: existing, backgroundColor: null, textColor: null };
      }
      this.properties.update((rows) =>
        rows.map((row) => (row.id === propId ? { ...row, choicePool: [...row.choicePool, clean] } : row)),
      );
      return { id: clean, name: clean, backgroundColor: null, textColor: null };
    };
  };

  protected readonly modalTitle = computed(() => {
    this.i18n();
    return this.transloco.translate(this.isEdit() ? 'extensions.field.editTitle' : 'extensions.field.createTitle');
  });

  protected readonly submitLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.isEdit() ? 'extensions.field.saveSubmit' : 'extensions.field.addSubmit');
  });

  protected readonly visibilityOptions = computed<DropdownOption<FieldVisibility>[]>(() => {
    this.i18n();
    return VISIBILITY.map((value) => ({
      value,
      label: this.transloco.translate(`extensions.visibility.${value}`),
    }));
  });

  protected readonly kindOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return VALUE_KINDS.map((value) => ({
      value,
      label: this.transloco.translate(`extensions.kinds.${value}`),
    }));
  });

  protected readonly scalarTypeOptions = computed<DropdownOption<ScalarType>[]>(() => {
    this.i18n();
    return SCALAR_TYPES.map((value) => ({
      value,
      label: this.transloco.translate(`extensions.scalarTypes.${value}`),
    }));
  });

  protected readonly defaultStrategyOptions = computed<DropdownOption<DefaultStrategy>[]>(() => {
    this.i18n();
    const strategies: readonly DefaultStrategy[] =
      this.defaultStrategy() === 'OWNER_DERIVED'
        ? [...DEFAULT_STRATEGIES, 'OWNER_DERIVED']
        : DEFAULT_STRATEGIES;
    return strategies.map((value) => ({
      value,
      label: this.transloco.translate(`extensions.defaultStrategy.${value}`),
    }));
  });

  protected readonly booleanOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'true', label: this.transloco.translate('extensions.field.defaultValue.yes') },
      { value: 'false', label: this.transloco.translate('extensions.field.defaultValue.no') },
    ];
  });

  protected readonly choiceTagOptions = computed<TagOption[]>(() => {
    const merged = Array.from(new Set([...this.choicePool(), ...this.choices()]));
    return toTagOptions(merged);
  });

  protected readonly choiceDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.choices().map((c) => ({ value: c, label: c })),
  );

  protected readonly defaultListTagOptions = computed<TagOption[]>(() => {
    this.i18n();
    if (this.scalarType() === 'ENUM') {
      return toTagOptions(this.choices());
    }
    if (this.scalarType() === 'BOOLEAN') {
      return [
        {
          id: 'true',
          name: this.transloco.translate('extensions.field.defaultValue.yes'),
          backgroundColor: null,
          textColor: null,
        },
        {
          id: 'false',
          name: this.transloco.translate('extensions.field.defaultValue.no'),
          backgroundColor: null,
          textColor: null,
        },
      ];
    }
    const merged = Array.from(new Set([...this.defaultListPool(), ...this.defaultListValues()]));
    return toTagOptions(merged);
  });

  protected readonly showScalarOrCollection = computed(() => this.valueKind() !== 'OBJECT');
  protected readonly showMaxLength = computed(
    () => this.showScalarOrCollection() && (this.scalarType() === 'STRING' || this.scalarType() === 'ENUM'),
  );
  protected readonly showMaxItems = computed(() => this.valueKind() === 'COLLECTION');
  protected readonly showDecimalExtras = computed(
    () => this.showScalarOrCollection() && this.scalarType() === 'DECIMAL',
  );
  protected readonly showChoices = computed(
    () => this.showScalarOrCollection() && this.scalarType() === 'ENUM',
  );
  protected readonly showDefaultValue = computed(
    () => this.showScalarOrCollection() && this.defaultStrategy() === 'LITERAL',
  );

  protected readonly keyError = computed<string | null>(() => {
    this.i18n();
    const raw = this.fieldKey().trim();
    const reserved = reservedSegmentOf(raw);
    if (reserved) {
      return this.transloco.translate('extensions.field.errors.keyReserved', { segment: reserved });
    }
    if (!this.submitted() && !this.keyTouched()) return null;
    if (!raw) {
      return this.submitted() ? this.transloco.translate('extensions.field.errors.keyRequired') : null;
    }
    if (!FIELD_KEY.test(raw)) {
      return this.transloco.translate('extensions.field.errors.keyPattern');
    }
    const originalKey = this.editingOriginal()?.fieldKey.toLowerCase();
    const lower = raw.toLowerCase();
    const conflict = this.activeExistingKeys().some((k) => {
      const candidate = k.toLowerCase();
      if (originalKey && candidate === originalKey) return false;
      return candidate === lower;
    });
    if (conflict) {
      return this.transloco.translate('extensions.field.errors.keyDuplicate');
    }
    return null;
  });

  protected readonly maxLengthError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showMaxLength()) return null;
    const raw = this.maxLengthText().trim();
    if (!raw) return null;
    if (parseIntInRange(raw, 1, LIMITS.maxLength) === null) {
      return this.transloco.translate('extensions.field.errors.maxLengthRange');
    }
    return null;
  });

  protected readonly maxItemsError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showMaxItems()) return null;
    if (parseIntInRange(this.maxItemsText(), 1, LIMITS.maxItems) === null) {
      return this.transloco.translate('extensions.field.errors.maxItemsRange');
    }
    return null;
  });

  protected readonly decimalScaleError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showDecimalExtras()) return null;
    if (parseIntInRange(this.decimalScaleText(), 0, LIMITS.decimalScale) === null) {
      return this.transloco.translate('extensions.field.errors.decimalScaleRange');
    }
    return null;
  });

  protected readonly minError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showDecimalExtras()) return null;
    const raw = this.minText().trim();
    if (!raw) return null;
    if (!parseSignedDecimal(raw)) {
      return this.transloco.translate('extensions.field.errors.decimalInvalid');
    }
    return null;
  });

  protected readonly maxError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showDecimalExtras()) return null;
    const raw = this.maxText().trim();
    if (!raw) return null;
    if (!parseSignedDecimal(raw)) {
      return this.transloco.translate('extensions.field.errors.decimalInvalid');
    }
    const minRaw = this.minText().trim();
    if (minRaw && parseSignedDecimal(minRaw)) {
      const cmp = compareSignedDecimals(minRaw, raw);
      if (cmp !== null && cmp > 0) {
        return this.transloco.translate('extensions.field.errors.minGreaterThanMax');
      }
    }
    return null;
  });

  protected readonly choicesError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showChoices()) return null;
    const list = this.choices();
    if (list.length === 0) {
      return this.transloco.translate('extensions.field.errors.choicesRequired');
    }
    if (list.length > LIMITS.enumValues) {
      return this.transloco.translate('extensions.field.errors.choicesMax');
    }
    const maxLen = parseIntInRange(this.maxLengthText(), 1, LIMITS.maxLength);
    if (maxLen !== null && list.some((c) => c.length > maxLen)) {
      return this.transloco.translate('extensions.field.errors.choiceTooLong');
    }
    return null;
  });

  protected readonly defaultValueError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || !this.showDefaultValue()) return null;
    const type = this.scalarType();
    if (this.valueKind() === 'COLLECTION') {
      const items = this.defaultListValues();
      if (items.length === 0) {
        return this.transloco.translate('extensions.field.errors.defaultRequired');
      }
      const maxItems = parseIntInRange(this.maxItemsText(), 1, LIMITS.maxItems) ?? LIMITS.maxItems;
      if (items.length > maxItems) {
        return this.transloco.translate('extensions.field.errors.defaultTooManyItems', { max: maxItems });
      }
      for (const item of items) {
        const itemErr = this.validateScalarStringValue(type, item);
        if (itemErr) return itemErr;
      }
      return null;
    }

    if (type === 'BOOLEAN') {
      const val = this.defaultBoolStr();
      if (val !== 'true' && val !== 'false') {
        return this.transloco.translate('extensions.field.errors.defaultInvalidBoolean');
      }
      return null;
    }
    if (type === 'DATE') {
      const val = this.defaultDateStr();
      if (!val) {
        return this.transloco.translate('extensions.field.errors.defaultRequired');
      }
      if (!isValidIsoDate(val)) {
        return this.transloco.translate('extensions.field.errors.defaultInvalidDate');
      }
      return null;
    }
    const text = this.defaultScalarText().trim();
    if (!text) {
      return this.transloco.translate('extensions.field.errors.defaultRequired');
    }
    return this.validateScalarStringValue(type, text);
  });

  protected readonly groupError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted() || this.valueKind() !== 'OBJECT') return null;
    if (this.properties().length === 0) {
      return this.transloco.translate('extensions.field.group.emptyError');
    }
    return null;
  });

  protected readonly dirty = computed(() => this.snapshot() !== this.initialSnapshot);

  constructor() {
    effect(() => {
      const isItems = this.isItemTarget();
      if (!isItems) {
        untracked(() => {
          if (this.isSearchable()) {
            this.isSearchable.set(false);
          }
        });
      }
    });
  }

  openCreate(targetCode: TargetCode, existingKeys: readonly string[]): void {
    this.editingOriginal.set(null);
    this.modalTargetCode.set(targetCode);
    this.modalExistingKeys.set([...existingKeys]);
    this.resetState(targetCode);
    this.allowClose = false;
    this.modal()?.open();
  }

  openEdit(field: ExtensionField, targetCode: TargetCode, existingKeys: readonly string[]): void {
    this.editingOriginal.set(field);
    this.modalTargetCode.set(targetCode);
    this.modalExistingKeys.set([...existingKeys]);
    this.loadField(field, targetCode);
    this.allowClose = false;
    this.modal()?.open();
  }

  reset(targetCode?: TargetCode): void {
    this.editingOriginal.set(null);
    if (targetCode) {
      this.modalTargetCode.set(targetCode);
    }
    this.resetState(targetCode ?? this.activeTargetCode());
  }

  isDirty(): boolean {
    return this.dirty();
  }

  validateAndBuild(): ExtensionField | null {
    this.submitted.set(true);
    this.keyTouched.set(true);

    if (this.keyError()) return null;

    const kind = this.valueKind();
    const target = this.activeTargetCode();
    const searchable = target === 'CATALOG_ITEM' ? this.isSearchable() : false;
    const baseKey = this.fieldKey().trim();
    const orig = this.editingOriginal();

    if (kind === 'OBJECT') {
      if (this.groupError() || !this.allPropertiesValid()) {
        return null;
      }
      const objectProperties = this.properties().map((p) => this.buildProperty(p));
      return {
        ...(orig?.id ? { id: orig.id } : {}),
        ...(orig?.ordinal !== undefined ? { ordinal: orig.ordinal } : {}),
        fieldKey: baseKey,
        valueKind: 'OBJECT',
        scalarType: null,
        schemaCode: EXTENSION_OBJECT_SCHEMA,
        schemaVersion: EXTENSION_VALUE_SCHEMA_VERSION,
        visibilityCode: this.visibility(),
        isRequired: this.isRequired(),
        isSearchable: searchable,
        defaultStrategy: 'NONE',
        defaultValue: null,
        maxLength: null,
        maxItems: null,
        decimalScale: null,
        minimumDecimal: null,
        maximumDecimal: null,
        constraintPayload: { properties: objectProperties },
      } as ExtensionField;
    }

    if (
      this.maxLengthError() ||
      this.maxItemsError() ||
      this.decimalScaleError() ||
      this.minError() ||
      this.maxError() ||
      this.choicesError() ||
      this.defaultValueError()
    ) {
      return null;
    }

    const type = this.scalarType();
    const maxLength =
      type === 'STRING' || type === 'ENUM'
        ? parseIntInRange(this.maxLengthText(), 1, LIMITS.maxLength)
        : null;
    const maxItems =
      kind === 'COLLECTION' ? parseIntInRange(this.maxItemsText(), 1, LIMITS.maxItems) : null;
    const decimalScale =
      type === 'DECIMAL' ? parseIntInRange(this.decimalScaleText(), 0, LIMITS.decimalScale) : null;
    const minimumDecimal = type === 'DECIMAL' && this.minText().trim() ? this.minText().trim() : null;
    const maximumDecimal = type === 'DECIMAL' && this.maxText().trim() ? this.maxText().trim() : null;
    const isCollection = kind === 'COLLECTION';

    const strategy = this.defaultStrategy();
    const defaultValue = strategy === 'LITERAL' ? this.buildDefaultValue(kind, type) : null;

    return {
      ...(orig?.id ? { id: orig.id } : {}),
      ...(orig?.ordinal !== undefined ? { ordinal: orig.ordinal } : {}),
      fieldKey: baseKey,
      valueKind: kind,
      scalarType: type,
      schemaCode: isCollection ? EXTENSION_COLLECTION_SCHEMA : null,
      schemaVersion: isCollection ? EXTENSION_VALUE_SCHEMA_VERSION : null,
      visibilityCode: this.visibility(),
      isRequired: this.isRequired(),
      isSearchable: searchable,
      defaultStrategy: strategy,
      defaultValue,
      maxLength,
      maxItems,
      decimalScale,
      minimumDecimal,
      maximumDecimal,
      constraintPayload: type === 'ENUM' ? { allowedValues: [...this.choices()] } : {},
    } as ExtensionField;
  }

  protected onKeyInput(event: Event): void {
    this.fieldKey.set((event.target as HTMLInputElement).value);
  }

  protected onTextInput(target: { set(v: string): void }, event: Event): void {
    target.set((event.target as HTMLInputElement).value);
  }

  protected onPropKeyInput(propId: number, event: Event): void {
    this.updatePropKey(propId, (event.target as HTMLInputElement).value);
  }

  protected onPropTextInput(
    propId: number,
    field: 'maxLengthText' | 'decimalScaleText' | 'minText' | 'maxText',
    event: Event,
  ): void {
    this.updatePropText(propId, field, (event.target as HTMLInputElement).value);
  }

  protected onKeyBlur(): void {
    this.keyTouched.set(true);
  }

  protected onKindChange(next: string | null): void {
    if (next !== 'SCALAR' && next !== 'COLLECTION' && next !== 'OBJECT') return;
    if (next === this.valueKind()) return;
    this.valueKind.set(next);
    if (next === 'OBJECT') {
      this.defaultStrategy.set('NONE');
      if (this.properties().length === 0) {
        this.properties.set([this.newPropertyDraft()]);
      }
    } else if (next === 'COLLECTION') {
      if (parseIntInRange(this.maxItemsText(), 1, LIMITS.maxItems) === null) {
        this.maxItemsText.set('10');
      }
      this.defaultListValues.set([]);
      this.defaultListPool.set([]);
    }
  }

  protected onScalarTypeChange(next: ScalarType): void {
    if (next === this.scalarType()) return;
    this.scalarType.set(next);
    this.defaultScalarText.set('');
    this.defaultBoolStr.set(next === 'BOOLEAN' ? 'false' : null);
    this.defaultDateStr.set(null);
    this.defaultListValues.set([]);
    this.defaultListPool.set([]);
    if (next === 'DECIMAL' && parseIntInRange(this.decimalScaleText(), 0, LIMITS.decimalScale) === null) {
      this.decimalScaleText.set(String(LIMITS.decimalScale));
    }
  }

  protected onDefaultStrategyChange(next: DefaultStrategy): void {
    this.defaultStrategy.set(next);
    if (next === 'LITERAL' && this.scalarType() === 'BOOLEAN' && this.defaultBoolStr() === null) {
      this.defaultBoolStr.set('false');
    }
  }

  protected onChoicesChange(next: string[]): void {
    const deduped = Array.from(new Set(next.map((s) => s.trim()).filter(Boolean)));
    this.choices.set(deduped);
    if (this.scalarType() === 'ENUM') {
      if (this.valueKind() === 'SCALAR' && this.defaultScalarText() && !deduped.includes(this.defaultScalarText())) {
        this.defaultScalarText.set('');
      }
      if (this.valueKind() === 'COLLECTION') {
        this.defaultListValues.update((list) => list.filter((item) => deduped.includes(item)));
      }
    }
  }

  protected addProperty(): void {
    if (this.properties().length >= LIMITS.objectProperties) return;
    this.properties.update((rows) => [...rows, this.newPropertyDraft()]);
  }

  protected removeProperty(propId: number): void {
    if (this.properties().length <= 1) return;
    this.properties.update((rows) => rows.filter((r) => r.id !== propId));
  }

  protected updatePropKey(propId: number, key: string): void {
    this.properties.update((rows) => rows.map((r) => (r.id === propId ? { ...r, key } : r)));
  }

  protected updatePropType(propId: number, scalarType: ScalarType): void {
    this.properties.update((rows) =>
      rows.map((r) =>
        r.id === propId
          ? {
              ...r,
              scalarType,
              decimalScaleText: r.decimalScaleText || String(LIMITS.decimalScale),
            }
          : r,
      ),
    );
  }

  protected updatePropRequired(propId: number, isRequired: boolean): void {
    this.properties.update((rows) => rows.map((r) => (r.id === propId ? { ...r, isRequired } : r)));
  }

  protected updatePropText(
    propId: number,
    field: 'maxLengthText' | 'decimalScaleText' | 'minText' | 'maxText',
    val: string,
  ): void {
    this.properties.update((rows) => rows.map((r) => (r.id === propId ? { ...r, [field]: val } : r)));
  }

  protected updatePropChoices(propId: number, next: string[]): void {
    const deduped = Array.from(new Set(next.map((s) => s.trim()).filter(Boolean)));
    this.properties.update((rows) =>
      rows.map((r) =>
        r.id === propId
          ? {
              ...r,
              choices: deduped,
              choicePool: Array.from(new Set([...r.choicePool, ...deduped])),
            }
          : r,
      ),
    );
  }

  protected propChoiceOptions(prop: PropertyDraft): TagOption[] {
    return toTagOptions(Array.from(new Set([...prop.choicePool, ...prop.choices])));
  }

  protected propKeyError(prop: PropertyDraft): string | null {
    this.i18n();
    const raw = prop.key.trim();
    if (!this.submitted()) return null;
    if (!raw) {
      return this.transloco.translate('extensions.field.errors.propKeyRequired');
    }
    if (!PROPERTY_KEY_RE.test(raw)) {
      return this.transloco.translate('extensions.field.errors.propKeyPattern');
    }
    const lower = raw.toLowerCase();
    const dupCount = this.properties().filter((p) => p.key.trim().toLowerCase() === lower).length;
    if (dupCount > 1) {
      return this.transloco.translate('extensions.field.errors.propKeyDuplicate');
    }
    return null;
  }

  protected propMaxLengthError(prop: PropertyDraft): string | null {
    this.i18n();
    if (!this.submitted() || (prop.scalarType !== 'STRING' && prop.scalarType !== 'ENUM')) return null;
    const raw = prop.maxLengthText.trim();
    if (!raw) return null;
    return parseIntInRange(raw, 1, LIMITS.maxLength) === null
      ? this.transloco.translate('extensions.field.errors.maxLengthRange')
      : null;
  }

  protected propDecimalScaleError(prop: PropertyDraft): string | null {
    this.i18n();
    if (!this.submitted() || prop.scalarType !== 'DECIMAL') return null;
    return parseIntInRange(prop.decimalScaleText, 0, LIMITS.decimalScale) === null
      ? this.transloco.translate('extensions.field.errors.decimalScaleRange')
      : null;
  }

  protected propMinError(prop: PropertyDraft): string | null {
    this.i18n();
    if (!this.submitted() || prop.scalarType !== 'DECIMAL') return null;
    const raw = prop.minText.trim();
    if (!raw) return null;
    return parseSignedDecimal(raw) ? null : this.transloco.translate('extensions.field.errors.decimalInvalid');
  }

  protected propMaxError(prop: PropertyDraft): string | null {
    this.i18n();
    if (!this.submitted() || prop.scalarType !== 'DECIMAL') return null;
    const raw = prop.maxText.trim();
    if (!raw) return null;
    if (!parseSignedDecimal(raw)) {
      return this.transloco.translate('extensions.field.errors.decimalInvalid');
    }
    const minRaw = prop.minText.trim();
    if (minRaw && parseSignedDecimal(minRaw)) {
      const cmp = compareSignedDecimals(minRaw, raw);
      if (cmp !== null && cmp > 0) {
        return this.transloco.translate('extensions.field.errors.minGreaterThanMax');
      }
    }
    return null;
  }

  protected propChoicesError(prop: PropertyDraft): string | null {
    this.i18n();
    if (!this.submitted() || prop.scalarType !== 'ENUM') return null;
    if (prop.choices.length === 0) {
      return this.transloco.translate('extensions.field.errors.choicesRequired');
    }
    if (prop.choices.length > LIMITS.enumValues) {
      return this.transloco.translate('extensions.field.errors.choicesMax');
    }
    const maxLen = parseIntInRange(prop.maxLengthText, 1, LIMITS.maxLength);
    if (maxLen !== null && prop.choices.some((c) => c.length > maxLen)) {
      return this.transloco.translate('extensions.field.errors.choiceTooLong');
    }
    return null;
  }

  protected isFirstPropOfKind(index: number, type: ScalarType): boolean {
    const rows = this.properties();
    return rows.findIndex((r) => r.scalarType === type) === index;
  }

  protected submitModal(): void {
    const built = this.validateAndBuild();
    if (!built) return;
    this.allowClose = true;
    this.modal()?.close();
    this.saved.emit(built);
  }

  protected async requestClose(): Promise<void> {
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal()?.close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal()?.open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal()?.close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (this.confirmingLeave) return false;
    const dialog = this.discardDialog();
    if (!dialog) return true;
    this.confirmingLeave = true;
    try {
      return await dialog.open();
    } finally {
      this.confirmingLeave = false;
    }
  }

  private validateScalarStringValue(type: ScalarType, raw: string): string | null {
    switch (type) {
      case 'STRING': {
        const maxLen = parseIntInRange(this.maxLengthText(), 1, LIMITS.maxLength);
        if (maxLen !== null && raw.length > maxLen) {
          return this.transloco.translate('extensions.field.errors.defaultTooLong');
        }
        return null;
      }
      case 'DECIMAL': {
        const parsed = parseSignedDecimal(raw);
        if (!parsed) {
          return this.transloco.translate('extensions.field.errors.defaultInvalidDecimal');
        }
        const scale = parseIntInRange(this.decimalScaleText(), 0, LIMITS.decimalScale) ?? LIMITS.decimalScale;
        if (parsed.frac.length > scale) {
          return this.transloco.translate('extensions.field.errors.defaultDecimalScale', { scale });
        }
        const minRaw = this.minText().trim();
        if (minRaw && parseSignedDecimal(minRaw)) {
          const cmp = compareSignedDecimals(raw, minRaw);
          if (cmp !== null && cmp < 0) {
            return this.transloco.translate('extensions.field.errors.defaultOutOfRange');
          }
        }
        const maxRaw = this.maxText().trim();
        if (maxRaw && parseSignedDecimal(maxRaw)) {
          const cmp = compareSignedDecimals(raw, maxRaw);
          if (cmp !== null && cmp > 0) {
            return this.transloco.translate('extensions.field.errors.defaultOutOfRange');
          }
        }
        return null;
      }
      case 'DATE':
        return isValidIsoDate(raw) ? null : this.transloco.translate('extensions.field.errors.defaultInvalidDate');
      case 'UUID':
        return UUID_RE.test(raw.trim()) ? null : this.transloco.translate('extensions.field.errors.defaultInvalidUuid');
      case 'ENUM':
        return this.choices().includes(raw)
          ? null
          : this.transloco.translate('extensions.field.errors.defaultChoiceMissing');
      case 'BOOLEAN':
        return raw === 'true' || raw === 'false'
          ? null
          : this.transloco.translate('extensions.field.errors.defaultInvalidBoolean');
    }
  }

  private buildDefaultValue(kind: ValueKind, type: ScalarType): unknown {
    if (kind === 'COLLECTION') {
      const items = this.defaultListValues();
      if (type === 'BOOLEAN') {
        return items.map((item) => item === 'true');
      }
      return [...items];
    }
    if (type === 'BOOLEAN') {
      return this.defaultBoolStr() === 'true';
    }
    if (type === 'DATE') {
      return this.defaultDateStr();
    }
    return this.defaultScalarText().trim();
  }

  private allPropertiesValid(): boolean {
    for (const prop of this.properties()) {
      if (
        this.propKeyError(prop) ||
        this.propMaxLengthError(prop) ||
        this.propDecimalScaleError(prop) ||
        this.propMinError(prop) ||
        this.propMaxError(prop) ||
        this.propChoicesError(prop)
      ) {
        return false;
      }
    }
    return true;
  }

  private buildProperty(prop: PropertyDraft): ObjectProperty {
    const type = prop.scalarType;
    return {
      key: prop.key.trim(),
      scalarType: type,
      isRequired: prop.isRequired,
      maxLength:
        type === 'STRING' || type === 'ENUM'
          ? parseIntInRange(prop.maxLengthText, 1, LIMITS.maxLength)
          : null,
      decimalScale:
        type === 'DECIMAL'
          ? parseIntInRange(prop.decimalScaleText, 0, LIMITS.decimalScale) ?? LIMITS.decimalScale
          : null,
      minimumDecimal: type === 'DECIMAL' && prop.minText.trim() ? prop.minText.trim() : null,
      maximumDecimal: type === 'DECIMAL' && prop.maxText.trim() ? prop.maxText.trim() : null,
      allowedValues: type === 'ENUM' ? [...prop.choices] : null,
    };
  }

  private newPropertyDraft(seed?: ObjectProperty): PropertyDraft {
    const choices = seed?.allowedValues ? [...seed.allowedValues] : [];
    return {
      id: ++nextPropId,
      key: seed?.key ?? '',
      scalarType: seed?.scalarType ?? 'STRING',
      isRequired: seed?.isRequired ?? false,
      maxLengthText: seed?.maxLength != null ? String(seed.maxLength) : '',
      decimalScaleText:
        seed?.decimalScale != null ? String(seed.decimalScale) : String(LIMITS.decimalScale),
      minText: seed?.minimumDecimal ?? '',
      maxText: seed?.maximumDecimal ?? '',
      choices,
      choicePool: [...choices],
    };
  }

  private resetState(target: TargetCode): void {
    this.fieldKey.set('');
    this.visibility.set('USER');
    this.valueKind.set('SCALAR');
    this.scalarType.set('STRING');
    this.maxLengthText.set('');
    this.maxItemsText.set('10');
    this.decimalScaleText.set(String(LIMITS.decimalScale));
    this.minText.set('');
    this.maxText.set('');
    this.choices.set([]);
    this.choicePool.set([]);
    this.defaultStrategy.set('NONE');
    this.defaultScalarText.set('');
    this.defaultBoolStr.set(null);
    this.defaultDateStr.set(null);
    this.defaultListValues.set([]);
    this.defaultListPool.set([]);
    this.isRequired.set(false);
    this.isSearchable.set(target === 'CATALOG_ITEM' ? false : false);
    this.properties.set([this.newPropertyDraft()]);
    this.submitted.set(false);
    this.keyTouched.set(false);
    this.initialSnapshot = this.snapshot();
  }

  private loadField(field: ExtensionField, target: TargetCode): void {
    const choices = fieldAllowedValues(field);
    this.fieldKey.set(field.fieldKey);
    this.visibility.set(field.visibilityCode);
    this.valueKind.set(field.valueKind);
    this.scalarType.set(field.scalarType ?? 'STRING');
    this.maxLengthText.set(field.maxLength != null ? String(field.maxLength) : '');
    this.maxItemsText.set(field.maxItems != null ? String(field.maxItems) : '10');
    this.decimalScaleText.set(
      field.decimalScale != null ? String(field.decimalScale) : String(LIMITS.decimalScale),
    );
    this.minText.set(field.minimumDecimal ?? '');
    this.maxText.set(field.maximumDecimal ?? '');
    this.choices.set(choices);
    this.choicePool.set([...choices]);
    this.defaultStrategy.set(field.valueKind === 'OBJECT' ? 'NONE' : field.defaultStrategy);

    this.defaultScalarText.set('');
    this.defaultBoolStr.set(null);
    this.defaultDateStr.set(null);
    this.defaultListValues.set([]);
    this.defaultListPool.set([]);

    if (field.defaultStrategy === 'LITERAL' && field.valueKind !== 'OBJECT') {
      if (field.valueKind === 'COLLECTION' && Array.isArray(field.defaultValue)) {
        const list = field.defaultValue.map((item) => String(item));
        this.defaultListValues.set(list);
        this.defaultListPool.set([...list]);
      } else if (field.scalarType === 'BOOLEAN') {
        this.defaultBoolStr.set(field.defaultValue === true || field.defaultValue === 'true' ? 'true' : 'false');
      } else if (field.scalarType === 'DATE') {
        this.defaultDateStr.set(field.defaultValue ? String(field.defaultValue) : null);
      } else if (field.defaultValue !== null && field.defaultValue !== undefined) {
        this.defaultScalarText.set(String(field.defaultValue));
      }
    }

    this.isRequired.set(field.isRequired);
    this.isSearchable.set(target === 'CATALOG_ITEM' ? field.isSearchable : false);
    this.properties.set(
      field.valueKind === 'OBJECT' && fieldProperties(field).length
        ? fieldProperties(field).map((p) => this.newPropertyDraft(p))
        : [this.newPropertyDraft()],
    );
    this.submitted.set(false);
    this.keyTouched.set(false);
    this.initialSnapshot = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify({
      fieldKey: this.fieldKey(),
      visibility: this.visibility(),
      valueKind: this.valueKind(),
      scalarType: this.scalarType(),
      maxLengthText: this.maxLengthText(),
      maxItemsText: this.maxItemsText(),
      decimalScaleText: this.decimalScaleText(),
      minText: this.minText(),
      maxText: this.maxText(),
      choices: this.choices(),
      defaultStrategy: this.defaultStrategy(),
      defaultScalarText: this.defaultScalarText(),
      defaultBoolStr: this.defaultBoolStr(),
      defaultDateStr: this.defaultDateStr(),
      defaultListValues: this.defaultListValues(),
      isRequired: this.isRequired(),
      isSearchable: this.isSearchable(),
      properties: this.properties().map((p) => ({
        key: p.key,
        scalarType: p.scalarType,
        isRequired: p.isRequired,
        maxLengthText: p.maxLengthText,
        decimalScaleText: p.decimalScaleText,
        minText: p.minText,
        maxText: p.maxText,
        choices: p.choices,
      })),
    });
  }
}
