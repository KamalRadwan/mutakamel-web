import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerAdjustmentsHorizontal } from '@ng-icons/tabler-icons';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import type {
  TemplateDefinitionScopeType,
  TemplateDocumentType,
  TemplateLayoutMode,
  TemplateLifecycleStatus,
  TemplateLocale,
  TemplateOutputChannel,
} from '../../templates.model';
import { LibraryDateRangeField, LibraryDateRangeValue, emptyDateRange } from '../date-range-field/date-range-field';

export interface LibraryFilters {
  documentType: TemplateDocumentType | null;
  outputChannel: TemplateOutputChannel | null;
  layoutMode: TemplateLayoutMode | null;
  lifecycleStatus: TemplateLifecycleStatus | null;
  locale: TemplateLocale | null;
  definitionScopeType: TemplateDefinitionScopeType | null;
  hasPublishedVersion: boolean | null;
  dateRange: LibraryDateRangeValue;
}

export function emptyLibraryFilters(): LibraryFilters {
  return {
    documentType: null,
    outputChannel: null,
    layoutMode: null,
    lifecycleStatus: null,
    locale: null,
    definitionScopeType: null,
    hasPublishedVersion: null,
    dateRange: emptyDateRange(),
  };
}

const ANY_OPTION = 'ALL';

const DOCUMENT_TYPES: readonly TemplateDocumentType[] = [
  'QUOTATION',
  'PURCHASE_QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'INVOICE',
  'CONTRACT',
  'LETTER',
  'CRM_OUTBOUND_EMAIL',
];

const OUTPUT_CHANNELS: readonly TemplateOutputChannel[] = ['PRINT', 'EMAIL'];

const LAYOUT_MODES: readonly TemplateLayoutMode[] = [
  'HYBRID_DOCUMENT',
  'FLOW_DOCUMENT',
  'FIXED_CANVAS',
  'EMAIL_FLOW',
];

const LIFECYCLE_STATUSES: readonly TemplateLifecycleStatus[] = ['ACTIVE', 'ARCHIVED'];

const LOCALES: readonly TemplateLocale[] = ['en-US', 'ar-EG'];

@Component({
  selector: 'app-library-filters-modal',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal, LibraryDateRangeField],
  providers: [provideIcons({ tablerAdjustmentsHorizontal })],
  templateUrl: './library-filters-modal.html',
})
export class LibraryFiltersModal {
  private static nextId = 0;
  protected readonly uid = `tpl-lib-filters-${++LibraryFiltersModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');

  readonly applied = output<LibraryFilters>();
  readonly closed = output<void>();

  protected readonly draftDocumentType = signal<string>(ANY_OPTION);
  protected readonly draftOutputChannel = signal<string>(ANY_OPTION);
  protected readonly draftLayoutMode = signal<string>(ANY_OPTION);
  protected readonly draftLifecycleStatus = signal<string>(ANY_OPTION);
  protected readonly draftLocale = signal<string>(ANY_OPTION);
  protected readonly draftScopeType = signal<string>(ANY_OPTION);
  protected readonly draftHasPublished = signal<string>(ANY_OPTION);
  protected readonly draftDateRange = signal<LibraryDateRangeValue>(emptyDateRange());

  protected readonly documentTypeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      ...DOCUMENT_TYPES.map((value) => ({
        value,
        label: this.transloco.translate(`templates.families.${value}`),
      })),
    ];
  });

  protected readonly outputChannelOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      ...OUTPUT_CHANNELS.map((value) => ({
        value,
        label: this.transloco.translate(`templates.channels.${value}`),
      })),
    ];
  });

  protected readonly layoutModeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      ...LAYOUT_MODES.map((value) => ({
        value,
        label: this.transloco.translate(`templates.layouts.${value}`),
      })),
    ];
  });

  protected readonly lifecycleOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      ...LIFECYCLE_STATUSES.map((value) => ({
        value,
        label: this.transloco.translate(`templates.lifecycle.${value}`),
      })),
    ];
  });

  protected readonly localeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      ...LOCALES.map((value) => ({
        value,
        label: this.transloco.translate(`templates.locales.${value}`),
      })),
    ];
  });

  protected readonly scopeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      { value: 'TENANT', label: this.transloco.translate('templatesLibrary.filtersModal.scopeTenant') },
      { value: 'COMPANY', label: this.transloco.translate('templatesLibrary.filtersModal.scopeCompany') },
    ];
  });

  protected readonly publishedOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: ANY_OPTION, label: this.transloco.translate('templatesLibrary.filtersModal.any') },
      { value: 'YES', label: this.transloco.translate('templatesLibrary.filtersModal.yes') },
      { value: 'NO', label: this.transloco.translate('templatesLibrary.filtersModal.no') },
    ];
  });

  protected readonly hasDraftFilters = computed(
    () =>
      this.draftDocumentType() !== ANY_OPTION ||
      this.draftOutputChannel() !== ANY_OPTION ||
      this.draftLayoutMode() !== ANY_OPTION ||
      this.draftLifecycleStatus() !== ANY_OPTION ||
      this.draftLocale() !== ANY_OPTION ||
      this.draftScopeType() !== ANY_OPTION ||
      this.draftHasPublished() !== ANY_OPTION ||
      Boolean(this.draftDateRange().updatedFrom && this.draftDateRange().updatedTo),
  );

  open(current: LibraryFilters): void {
    this.draftDocumentType.set(current.documentType ?? ANY_OPTION);
    this.draftOutputChannel.set(current.outputChannel ?? ANY_OPTION);
    this.draftLayoutMode.set(current.layoutMode ?? ANY_OPTION);
    this.draftLifecycleStatus.set(current.lifecycleStatus ?? ANY_OPTION);
    this.draftLocale.set(current.locale ?? ANY_OPTION);
    this.draftScopeType.set(current.definitionScopeType ?? ANY_OPTION);
    this.draftHasPublished.set(
      current.hasPublishedVersion === null ? ANY_OPTION : current.hasPublishedVersion ? 'YES' : 'NO',
    );
    this.draftDateRange.set({ ...current.dateRange });
    this.modal().open();
  }

  protected resetDraft(): void {
    this.draftDocumentType.set(ANY_OPTION);
    this.draftOutputChannel.set(ANY_OPTION);
    this.draftLayoutMode.set(ANY_OPTION);
    this.draftLifecycleStatus.set(ANY_OPTION);
    this.draftLocale.set(ANY_OPTION);
    this.draftScopeType.set(ANY_OPTION);
    this.draftHasPublished.set(ANY_OPTION);
    this.draftDateRange.set(emptyDateRange());
  }

  protected cancel(): void {
    this.modal().close();
  }

  protected applyFilters(): void {
    const pub = this.draftHasPublished();
    const next: LibraryFilters = {
      documentType: this.draftDocumentType() === ANY_OPTION ? null : (this.draftDocumentType() as TemplateDocumentType),
      outputChannel:
        this.draftOutputChannel() === ANY_OPTION ? null : (this.draftOutputChannel() as TemplateOutputChannel),
      layoutMode: this.draftLayoutMode() === ANY_OPTION ? null : (this.draftLayoutMode() as TemplateLayoutMode),
      lifecycleStatus:
        this.draftLifecycleStatus() === ANY_OPTION ? null : (this.draftLifecycleStatus() as TemplateLifecycleStatus),
      locale: this.draftLocale() === ANY_OPTION ? null : (this.draftLocale() as TemplateLocale),
      definitionScopeType:
        this.draftScopeType() === ANY_OPTION ? null : (this.draftScopeType() as TemplateDefinitionScopeType),
      hasPublishedVersion: pub === ANY_OPTION ? null : pub === 'YES',
      dateRange: { ...this.draftDateRange() },
    };
    this.modal().close();
    this.applied.emit(next);
  }
}
