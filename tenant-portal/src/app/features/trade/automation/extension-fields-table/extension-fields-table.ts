import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCircleX, tablerEdit, tablerInbox, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Switch } from '../../../../shared/ui/switch/switch';
import { formatDate } from '../../shared/trade-format';
import type { ExtensionField, ExtensionProfile } from '../extensions.model';
import { LIMITS } from '../extensions.registry';

type TargetCode = ExtensionProfile['targetCode'];

let nextTableId = 0;

@Component({
  selector: 'app-extension-fields-table',
  imports: [NgIcon, TranslocoPipe, Button, Switch, ActionsMenu],
  providers: [provideIcons({ tablerCircleX, tablerEdit, tablerInbox, tablerPlus, tablerTrash })],
  templateUrl: './extension-fields-table.html',
})
export class ExtensionFieldsTable {
  protected readonly uid = `ext-fields-table-${++nextTableId}`;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly fields = input.required<readonly ExtensionField[]>();
  readonly targetCode = input.required<TargetCode>();
  readonly readonly = input(false);
  readonly diagnostics = input<Readonly<Record<string, readonly string[]>>>({});
  readonly maxFields = input(LIMITS.fieldsPerProfile);
  readonly showAddButton = input(true);

  readonly addField = output<void>();
  readonly editField = output<number>();
  readonly removeField = output<number>();
  readonly toggleRequired = output<{ index: number; isRequired: boolean }>();
  readonly toggleSearchable = output<{ index: number; isSearchable: boolean }>();

  protected readonly isItemTarget = computed(() => this.targetCode() === 'CATALOG_ITEM');
  protected readonly atMax = computed(() => this.fields().length >= this.maxFields());
  protected readonly gridCols = computed(() =>
    this.readonly() ? 'grid-cols-auto-ext-field-row' : 'grid-cols-auto-ext-field-row-actions',
  );

  protected typeLabel(field: ExtensionField): string {
    this.i18n();
    this.language();
    if (field.valueKind === 'OBJECT') {
      const count = field.constraintPayload.properties?.length ?? 0;
      return this.transloco.translate('extensions.typeBadge.groupOf', { count });
    }
    const scalarLabel = field.scalarType
      ? this.transloco.translate(`extensions.scalarTypes.${field.scalarType}`)
      : '';
    if (field.valueKind === 'COLLECTION') {
      return this.transloco.translate('extensions.typeBadge.listOf', { type: scalarLabel });
    }
    return scalarLabel;
  }

  protected defaultDisplay(field: ExtensionField): { text: string; ltr: boolean } {
    this.i18n();
    const lang = this.language();
    if (field.valueKind === 'OBJECT' || field.defaultStrategy !== 'LITERAL') {
      return { text: this.transloco.translate('extensions.fields.none'), ltr: false };
    }
    const val = field.defaultValue;
    if (val === null || val === undefined || val === '') {
      return { text: this.transloco.translate('extensions.fields.none'), ltr: false };
    }
    if (field.valueKind === 'COLLECTION' && Array.isArray(val)) {
      if (val.length === 0) {
        return { text: this.transloco.translate('extensions.fields.none'), ltr: false };
      }
      if (field.scalarType === 'BOOLEAN') {
        const text = val
          .map((item) =>
            this.transloco.translate(item === true || item === 'true' ? 'extensions.fields.yes' : 'extensions.fields.no'),
          )
          .join(', ');
        return { text, ltr: false };
      }
      if (field.scalarType === 'DATE') {
        const text = val.map((item) => formatDate(String(item), lang)).join(', ');
        return { text, ltr: false };
      }
      return { text: val.map((item) => String(item)).join(', '), ltr: field.scalarType !== 'STRING' };
    }
    if (field.scalarType === 'BOOLEAN') {
      const truthy = val === true || val === 'true';
      return {
        text: this.transloco.translate(truthy ? 'extensions.fields.yes' : 'extensions.fields.no'),
        ltr: false,
      };
    }
    if (field.scalarType === 'DATE') {
      return { text: formatDate(String(val), lang), ltr: false };
    }
    const str = String(val);
    return {
      text: str,
      ltr: field.scalarType === 'DECIMAL' || field.scalarType === 'UUID' || field.scalarType === 'ENUM',
    };
  }

  protected rowDiagnostics(field: ExtensionField): readonly string[] {
    return this.diagnostics()[field.fieldKey] ?? [];
  }

  protected diagnosticText(code: string): string {
    this.i18n();
    this.language();
    const key = `extensions.diagnostics.${code}`;
    const translated = this.transloco.translate(key);
    if (translated !== key) return translated;
    return this.transloco.translate('extensions.diagnostics.fallback', { code });
  }

  protected actionsFor(field: ExtensionField): ActionItem[] {
    this.i18n();
    this.language();
    const canRemove = this.fields().length > 1;
    return [
      {
        id: 'edit',
        title: this.transloco.translate('extensions.fields.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'remove',
        title: this.transloco.translate('extensions.fields.remove'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: !canRemove,
        ...(canRemove ? {} : { reason: this.transloco.translate('extensions.fields.minOneField') }),
      },
    ];
  }

  protected menuLabelFor(field: ExtensionField): string {
    this.i18n();
    this.language();
    return this.transloco.translate('extensions.fields.menuLabel', { key: field.fieldKey });
  }

  protected requiredLabel(field: ExtensionField): string {
    this.i18n();
    this.language();
    return this.transloco.translate('extensions.fields.requiredFor', { key: field.fieldKey });
  }

  protected searchableLabel(field: ExtensionField): string {
    this.i18n();
    this.language();
    return this.transloco.translate('extensions.fields.searchableFor', { key: field.fieldKey });
  }

  protected onActionSelected(index: number, selection: ActionSelection): void {
    if (selection.id === 'edit') {
      this.editField.emit(index);
    } else if (selection.id === 'remove') {
      this.removeField.emit(index);
    }
  }

  protected onRequiredChange(index: number, next: boolean): void {
    if (this.readonly()) return;
    this.toggleRequired.emit({ index, isRequired: next });
  }

  protected onSearchableChange(index: number, next: boolean): void {
    if (this.readonly() || !this.isItemTarget()) return;
    this.toggleSearchable.emit({ index, isSearchable: next });
  }
}
