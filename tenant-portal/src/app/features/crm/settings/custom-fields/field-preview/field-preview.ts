import { Component, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendar,
  tablerCalendarEvent,
  tablerCheck,
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
import { LanguageState } from '../../../../../core/i18n/language';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import {
  CustomFieldOwnerType,
  CustomFieldType,
  FIELD_TYPE_ICONS,
  FieldOption,
  OWNER_TYPE_LOOK,
  localizedName,
} from '../custom-fields.model';

@Component({
  selector: 'app-field-preview',
  imports: [NgIcon, TranslocoPipe, Field, Dropdown, Switch, DateField, TimeField],
  providers: [
    provideIcons({
      tablerEdit,
      tablerLayoutRows,
      tablerListNumbers,
      tablerCalendar,
      tablerCalendarEvent,
      tablerCircleDot,
      tablerHierarchy2,
      tablerSquareCheck,
      tablerLink,
      tablerMail,
      tablerPhone,
      tablerUserPlus,
      tablerUser,
      tablerUsers,
      tablerTarget,
      tablerCheck,
    }),
  ],
  templateUrl: './field-preview.html',
  host: { class: 'block' },
})
export class FieldPreview {
  private static nextId = 0;
  protected readonly uid = `cf-preview-${++FieldPreview.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly previewCard = viewChild<ElementRef<HTMLElement>>('previewCard');

  readonly nameAr = input('');
  readonly nameEn = input('');
  readonly fieldKey = input('');
  readonly ownerType = input<CustomFieldOwnerType>('LEAD');
  readonly type = input<CustomFieldType>('TEXT');
  readonly placeholderAr = input('');
  readonly placeholderEn = input('');
  readonly options = input<readonly FieldOption[]>([]);
  readonly requiredOnCreate = input(false);

  protected readonly typeIcons = FIELD_TYPE_ICONS;
  protected readonly ownerLook = OWNER_TYPE_LOOK;

  protected readonly previewBool = signal(true);
  protected readonly previewDate = signal<string | null>(null);
  protected readonly previewTime = signal<string | null>('09:00');
  protected readonly previewSelect = signal('');
  protected readonly previewMulti = signal<string[]>([]);

  constructor() {
    afterRenderEffect(() => {
      this.type();
      this.activeOptions();
      const card = this.previewCard()?.nativeElement;
      if (!card) return;
      for (const el of card.querySelectorAll<HTMLElement>('input, textarea, select, button')) {
        el.tabIndex = -1;
      }
    });
  }

  protected readonly displayLabel = computed(() => {
    const ar = this.nameAr().trim();
    const en = this.nameEn().trim();
    return this.language() === 'ar' ? ar || en : en || ar;
  });

  protected readonly displayHint = computed(() => {
    this.i18n();
    const name = this.displayLabel() || this.transloco.translate('customFields.modal.previewEmpty');
    const type = this.transloco.translate(`customFields.types.${this.type()}`);
    return this.transloco.translate('customFields.modal.previewHint', { name, type });
  });

  protected readonly displayPlaceholder = computed(() => {
    const ar = this.placeholderAr().trim();
    const en = this.placeholderEn().trim();
    return this.language() === 'ar' ? ar || en : en || ar;
  });

  protected readonly activeOptions = computed(() =>
    this.options().filter((opt) => opt.isActive && (opt.key.trim() || opt.nameAr.trim() || opt.nameEn.trim())),
  );

  protected readonly selectOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const placeholder = this.displayPlaceholder() || this.transloco.translate('customFields.modal.previewSelectPlaceholder');
    return [
      { value: '', label: placeholder },
      ...this.activeOptions().map((opt) => ({
        value: opt.key || opt.nameEn || opt.nameAr,
        label: localizedName(opt, lang) || opt.key,
      })),
    ];
  });

  protected optionLabel(option: FieldOption): string {
    return localizedName(option, this.language()) || option.key;
  }

  protected toggleMulti(key: string) {
    if (!key) return;
    this.previewMulti.update((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }
}
