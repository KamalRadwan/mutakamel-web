import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, model } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCircleX } from '@ng-icons/tabler-icons';
import { GeoCountry } from '../../../../../core/geo/geo.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { RECORD_PAGE_GRID } from '../../../../../shared/ui/record-layout/record-layout';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { PhoneInput } from '../../../../../shared/ui/phone-input/phone-input';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { CustomFieldDef } from './custom-field.model';

const TEXT_MAX = 500;
const TEXTAREA_MAX = 5000;

@Component({
  selector: 'app-record-custom-fields',
  imports: [NgTemplateOutlet, TranslocoPipe, Field, DateField, TimeField, Switch, Dropdown, Checkbox, PhoneInput],
  providers: [
    provideTranslocoScope({ scope: 'record-fields', alias: 'recordFields' }),
    provideIcons({ tablerCircleX }),
  ],
  templateUrl: './record-custom-fields.html',
  host: {
    '[class]': "layout() === 'page' && scope() === 'required' ? 'contents' : 'block'",
  },
})
export class RecordCustomFields {
  private static nextId = 0;
  protected readonly uid = `rf-custom-${++RecordCustomFields.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly fields = input.required<readonly CustomFieldDef[]>();
  readonly values = model.required<Record<string, unknown>>();
  readonly layout = input<'modal' | 'page'>('modal');
  readonly errors = input<Partial<Record<string, string>>>({});
  readonly readonly = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly scope = input<'required' | 'others' | 'all'>('all');
  /** One column, for the narrow classification side column. */
  readonly stacked = input(false);
  readonly countries = input<GeoCountry[]>([]);

  protected readonly pageGrid = RECORD_PAGE_GRID;
  protected readonly textMax = TEXT_MAX;
  protected readonly textareaMax = TEXTAREA_MAX;

  protected readonly visibleFields = computed<CustomFieldDef[]>(() => {
    const list = this.fields();
    if (!list || list.length === 0) return [];
    const scope = this.scope();
    return list
      .filter((field) => {
        if (scope === 'all') return true;
        // A field required on create OR update stays under Expected value so it never jumps columns.
        const sideField = field.requiredOnCreate || field.requiredOnUpdate;
        return scope === 'required' ? sideField : !sideField;
      })
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected isRequired(field: CustomFieldDef): boolean {
    return this.mode() === 'create' ? field.requiredOnCreate : field.requiredOnUpdate;
  }

  protected fieldLabel(field: CustomFieldDef): string {
    return this.language() === 'ar' ? field.nameAr : field.nameEn;
  }

  protected fieldPlaceholder(field: CustomFieldDef): string {
    return (this.language() === 'ar' ? field.placeholderAr : field.placeholderEn) ?? '';
  }

  protected fieldHint(field: CustomFieldDef): string {
    this.i18n();
    const placeholder = this.fieldPlaceholder(field).trim();
    const base = placeholder || this.transloco.translate(`recordFields.custom.typeHint.${field.type}`);
    if (!this.isRequired(field)) return base;
    const reqKey =
      this.mode() === 'edit' ? 'recordFields.custom.requiredOnUpdateHint' : 'recordFields.custom.requiredHint';
    return `${base} ${this.transloco.translate(reqKey)}`;
  }

  protected fieldError(field: CustomFieldDef): string | null {
    this.i18n();
    const errs = this.errors();
    const raw = errs[`customFields.${field.fieldKey}`] ?? errs[field.fieldKey];
    if (!raw) return null;

    const [codePart, suffixMax] = raw.split(':');
    const defaultMax = field.type === 'TEXTAREA' ? TEXTAREA_MAX : TEXT_MAX;
    const max = suffixMax !== undefined ? Number(suffixMax) : defaultMax;
    const params = { max, field: this.fieldLabel(field) };

    if (codePart.includes('.')) {
      const translated = this.transloco.translate(codePart, params);
      return translated === codePart ? raw : translated;
    }

    const key = `recordFields.errors.${codePart}`;
    const translated = this.transloco.translate(key, params);
    return translated === key ? raw : translated;
  }

  protected stringValue(fieldKey: string): string {
    const raw = this.values()[fieldKey];
    if (raw === null || raw === undefined) return '';
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
  }

  protected boolValue(fieldKey: string): boolean {
    return Boolean(this.values()[fieldKey]);
  }

  protected datePart(fieldKey: string): string | null {
    const raw = this.stringValue(fieldKey).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return localIsoDate(parsed);
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    return match ? match[1] : null;
  }

  protected timePart(fieldKey: string): string | null {
    const raw = this.stringValue(fieldKey).trim();
    if (!raw || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return localIsoTime(parsed);
    const match = /[T ](\d{2}:\d{2})/.exec(raw);
    return match ? match[1] : null;
  }

  protected selectOptions(field: CustomFieldDef): DropdownOption<string>[] {
    this.i18n();
    const lang = this.language();
    const noneOption: DropdownOption<string> = {
      value: '',
      label: this.transloco.translate('recordFields.custom.none'),
    };
    const items = field.options.map((opt) => ({
      value: opt.key,
      label: lang === 'ar' ? opt.nameAr : opt.nameEn,
    }));
    return [noneOption, ...items];
  }

  protected optionLabel(option: { key: string; nameAr: string; nameEn: string }): string {
    return this.language() === 'ar' ? option.nameAr : option.nameEn;
  }

  protected hasMultiValue(fieldKey: string, optionKey: string): boolean {
    const raw = this.values()[fieldKey];
    return Array.isArray(raw) && raw.includes(optionKey);
  }

  protected onTextInput(fieldKey: string, event: Event): void {
    if (this.readonly()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.setFieldValue(fieldKey, value);
  }

  protected onDateTimeDateChange(fieldKey: string, nextDate: string | null): void {
    if (this.readonly()) return;
    if (!nextDate) {
      this.setFieldValue(fieldKey, null);
      return;
    }
    const time = this.timePart(fieldKey) ?? '00:00';
    this.setFieldValue(fieldKey, toIsoDateTime(nextDate, time));
  }

  protected onDateTimeTimeChange(fieldKey: string, nextTime: string | null): void {
    if (this.readonly()) return;
    const currentDate = this.datePart(fieldKey);
    if (!nextTime) {
      this.setFieldValue(fieldKey, currentDate ? toIsoDateTime(currentDate, '00:00') : null);
      return;
    }
    const date = currentDate ?? localIsoDate(new Date());
    this.setFieldValue(fieldKey, toIsoDateTime(date, nextTime));
  }

  protected toggleMultiValue(fieldKey: string, optionKey: string, checked: boolean): void {
    if (this.readonly()) return;
    const raw = this.values()[fieldKey];
    const current = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
    const next = checked
      ? (current.includes(optionKey) ? current : [...current, optionKey])
      : current.filter((item) => item !== optionKey);
    this.setFieldValue(fieldKey, next);
  }

  protected setFieldValue(fieldKey: string, value: unknown): void {
    if (this.readonly()) return;
    this.values.update((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  }
}

function localIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localIsoTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toIsoDateTime(date: string, time: string): string {
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? `${date}T${time}` : parsed.toISOString();
}
