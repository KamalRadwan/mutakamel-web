import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArrowBackUp, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { fakeId } from '../../shared/settings-api';
import { EditableFieldOption, MAX_KEY_LEN, MAX_NAME_LEN, MAX_OPTIONS } from '../custom-fields.model';

export interface OptionRowErrors {
  key: string | null;
  nameAr: string | null;
  nameEn: string | null;
  sortOrder: string | null;
}

@Component({
  selector: 'app-options-editor',
  imports: [NgIcon, TranslocoPipe, Button, Field, Switch],
  providers: [provideIcons({ tablerPlus, tablerTrash, tablerArrowBackUp, tablerAlertTriangle })],
  templateUrl: './options-editor.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OptionsEditor {
  private readonly transloco = inject(TranslocoService);

  readonly options = model.required<EditableFieldOption[]>();
  readonly readOnly = input(false);
  readonly showErrors = input(false);
  readonly inUseOptionKeys = input<string[]>([]);

  readonly restoreRemoved = output<void>();

  protected readonly maxOptions = MAX_OPTIONS;
  protected readonly maxKeyLen = MAX_KEY_LEN;
  protected readonly maxNameLen = MAX_NAME_LEN;

  protected readonly duplicateKeys = computed(() => {
    const counts = new Map<string, number>();
    for (const option of this.options()) {
      const key = option.key.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicates = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) duplicates.add(key);
    }
    return duplicates;
  });

  protected addOption() {
    if (this.readOnly() || this.options().length >= MAX_OPTIONS) return;
    const nextOrder = this.options().reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
    this.options.update((list) => [
      ...list,
      {
        uid: fakeId(),
        isSaved: false,
        key: '',
        nameAr: '',
        nameEn: '',
        sortOrder: nextOrder,
        isActive: true,
      },
    ]);
  }

  protected removeOption(uid: string) {
    if (this.readOnly()) return;
    this.options.update((list) => list.filter((opt) => opt.uid !== uid || opt.isSaved));
  }

  protected updateText(uid: string, field: 'key' | 'nameAr' | 'nameEn', value: string) {
    if (this.readOnly()) return;
    this.options.update((list) =>
      list.map((opt) => {
        if (opt.uid !== uid) return opt;
        if (field === 'key' && opt.isSaved) return opt;
        return { ...opt, [field]: value };
      }),
    );
  }

  protected updateOrder(uid: string, raw: string) {
    if (this.readOnly()) return;
    const parsed = raw.trim() === '' ? Number.NaN : Number(raw);
    this.options.update((list) => list.map((opt) => (opt.uid === uid ? { ...opt, sortOrder: parsed } : opt)));
  }

  protected orderValue(sortOrder: number): string | number {
    return Number.isFinite(sortOrder) ? sortOrder : '';
  }

  protected updateActive(uid: string, isActive: boolean) {
    if (this.readOnly()) return;
    this.options.update((list) => list.map((opt) => (opt.uid === uid ? { ...opt, isActive } : opt)));
  }

  protected errorsFor(option: EditableFieldOption): OptionRowErrors {
    const key = option.key.trim();
    const isDuplicate = key !== '' && this.duplicateKeys().has(key);
    const showAll = this.showErrors();

    let keyError: string | null = null;
    if (isDuplicate) keyError = this.transloco.translate('customFields.validation.optionKeyDuplicate');
    else if (showAll && !key) keyError = this.transloco.translate('customFields.validation.optionKeyRequired');
    else if (key.length > MAX_KEY_LEN) {
      keyError = this.transloco.translate('customFields.validation.maxLength', { max: MAX_KEY_LEN });
    }

    let nameArError: string | null = null;
    if (showAll && !option.nameAr.trim()) nameArError = this.transloco.translate('customFields.validation.required');
    else if (option.nameAr.trim().length > MAX_NAME_LEN) {
      nameArError = this.transloco.translate('customFields.validation.maxLength', { max: MAX_NAME_LEN });
    }

    let nameEnError: string | null = null;
    if (showAll && !option.nameEn.trim()) nameEnError = this.transloco.translate('customFields.validation.required');
    else if (option.nameEn.trim().length > MAX_NAME_LEN) {
      nameEnError = this.transloco.translate('customFields.validation.maxLength', { max: MAX_NAME_LEN });
    }

    let sortOrderError: string | null = null;
    if (showAll && (!Number.isInteger(option.sortOrder) || option.sortOrder < 1)) {
      sortOrderError = this.transloco.translate('customFields.validation.optionOrderInvalid');
    }

    return { key: keyError, nameAr: nameArError, nameEn: nameEnError, sortOrder: sortOrderError };
  }
}
