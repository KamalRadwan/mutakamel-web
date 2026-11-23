import { Component, Injector, computed, inject, runInInjectionContext, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArchive,
  tablerCalendar,
  tablerCalendarEvent,
  tablerCircleDot,
  tablerEdit,
  tablerEye,
  tablerHierarchy2,
  tablerLayoutRows,
  tablerLink,
  tablerListNumbers,
  tablerMail,
  tablerPhone,
  tablerRefresh,
  tablerSquareCheck,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { ApiError } from '../../../../core/api/api-errors';
import { tenantWide } from '../shared/settings-access';
import { customFieldsError } from './custom-fields-errors';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { CustomFieldSubmission, listCustomFields, updateCustomField } from './custom-fields.api';
import {
  CREATABLE_OWNER_TYPES,
  CreatableOwnerType,
  CustomField,
  FIELD_TYPE_ICONS,
  MAX_DEFINITIONS,
  OWNER_TYPE_LOOK,
  REQUIREMENT_OPERATIONS,
  globalRequirement,
  isChoicesType,
  matchesOwnerType,
  scopedRequirements,
} from './custom-fields.model';
import { CustomFieldModal } from './custom-field-modal/custom-field-modal';
import { RequirementsModal } from './requirements-modal/requirements-modal';

type OwnerTypeFilter = 'ALL' | CreatableOwnerType;
type StatusFilter = 'ACTIVE' | 'ARCHIVED' | 'ALL';

@Component({
  selector: 'app-custom-fields-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    SettingsFrame,
    Dropdown,
    FullState,
    ConfirmDialog,
    ActionsMenu,
    CustomFieldModal,
    RequirementsModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-custom-fields', alias: 'customFields' }),
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerArchive,
      tablerCalendar,
      tablerCalendarEvent,
      tablerCircleDot,
      tablerEdit,
      tablerEye,
      tablerHierarchy2,
      tablerLayoutRows,
      tablerLink,
      tablerListNumbers,
      tablerMail,
      tablerPhone,
      tablerRefresh,
      tablerSquareCheck,
      tablerTarget,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
    }),
  ],
  templateUrl: './custom-fields-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class CustomFieldsPage {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly injector = inject(Injector);
  private readonly archiveDialog = viewChild.required(ConfirmDialog);
  private readonly submissions = new Map<string, CustomFieldSubmission>();

  private readonly fieldModal = viewChild.required(CustomFieldModal);
  private readonly requirementsModal = viewChild.required(RequirementsModal);

  protected readonly readOnly = signal(false);
  protected readonly canRead = computed(() => runInInjectionContext(this.injector, () => tenantWide('crm.custom_fields.read')));
  protected readonly canManage = computed(() => !this.readOnly() && runInInjectionContext(this.injector, () => tenantWide('crm.custom_fields.manage')));
  protected readonly maxDefinitions = MAX_DEFINITIONS;
  protected readonly typeIcons = FIELD_TYPE_ICONS;
  protected readonly ownerLook = OWNER_TYPE_LOOK;
  protected readonly operations = REQUIREMENT_OPERATIONS;
  protected readonly isChoicesType = isChoicesType;

  protected readonly fields = signal<CustomField[]>([]);
  protected readonly loading = signal(false);
  private readonly loadError = signal<unknown | null>(null);
  protected readonly failure = computed(() => {
    this.i18n();
    const error = this.loadError();
    return error ? customFieldsError(this.transloco, error) : null;
  });
  protected readonly search = signal('');
  protected readonly ownerTypeFilter = signal<OwnerTypeFilter>('ALL');
  protected readonly statusFilter = signal<StatusFilter>('ACTIVE');
  protected readonly togglingIds = signal<ReadonlySet<string>>(new Set());

  private loadSeq = 0;

  protected readonly atLimit = computed(() => this.fields().length >= MAX_DEFINITIONS);

  protected readonly ownerFilterOptions = computed<DropdownOption<OwnerTypeFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('customFields.filters.allOwnerTypes') },
      ...CREATABLE_OWNER_TYPES.map((type) => ({
        value: type,
        label: this.transloco.translate(`customFields.ownerTypes.${type}`),
      })),
    ];
  });

  protected readonly statusFilterOptions = computed<DropdownOption<StatusFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ACTIVE', label: this.transloco.translate('settings.common.active') },
      { value: 'ARCHIVED', label: this.transloco.translate('settings.common.archived') },
      { value: 'ALL', label: this.transloco.translate('customFields.filters.allStatuses') },
    ];
  });

  protected readonly filteredFields = computed(() => {
    const term = this.search().trim().toLowerCase();
    const owner = this.ownerTypeFilter();
    const status = this.statusFilter();

    return this.fields().filter((field) => {
      if (status === 'ACTIVE' && !field.isActive) return false;
      if (status === 'ARCHIVED' && field.isActive) return false;
      if (owner !== 'ALL' && !matchesOwnerType(field.ownerType, owner)) return false;
      if (term) {
        const match =
          field.nameAr.toLowerCase().includes(term) ||
          field.nameEn.toLowerCase().includes(term) ||
          field.fieldKey.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  });

  constructor() {
    void this.loadFields();
  }

  protected async loadFields(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    if (!this.canRead()) {
      this.loadError.set(new ApiError(403, 'CRM_PERMISSION_DENIED'));
      this.loading.set(false);
      return;
    }
    try {
      const items = await listCustomFields();
      if (seq !== this.loadSeq) return;
      this.fields.set(items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (!(error instanceof ApiError && error.status === 401)) this.loadError.set(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected openCreate(): void {
    if (!this.canManage() || this.atLimit()) return;
    this.fieldModal().openCreate();
  }

  protected openEdit(field: CustomField): void {
    this.fieldModal().openEdit(field);
  }

  protected onFieldSaved(saved: CustomField): void {
    this.fields.update((list) => {
      const exists = list.some((item) => item.id === saved.id);
      const next = exists ? list.map((item) => (item.id === saved.id ? saved : item)) : [...list, saved];
      return [...next].sort(
        (a, b) => a.ownerType.localeCompare(b.ownerType) || a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey),
      );
    });
  }

  protected requiredOperationsFor(field: CustomField) {
    return this.operations.filter((op) => globalRequirement(field, op));
  }

  protected hasScopedRules(field: CustomField): boolean {
    return scopedRequirements(field).length > 0;
  }

  protected rowActions(field: CustomField): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('customFields.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('customFields.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'requirements',
        title: this.transloco.translate('customFields.actions.requirements'),
        icon: 'tablerAdjustmentsHorizontal',
        tile: field.isActive ? 'bg-icon-blue' : 'bg-icon-gray',
        disabled: !field.isActive,
        reason: field.isActive
          ? undefined
          : this.transloco.translate('customFields.actions.requirementsArchived'),
      },
      {
        id: 'toggleActive',
        title: this.transloco.translate(
          field.isActive ? 'customFields.actions.archive' : 'customFields.actions.restore',
        ),
        icon: field.isActive ? 'tablerArchive' : 'tablerRefresh',
        tile: field.isActive ? 'bg-icon-gray' : 'bg-icon-teal',
      },
    ];
  }

  protected onRowAction(field: CustomField, selection: ActionSelection): void {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openEdit(field);
      return;
    }
    if (!this.canManage()) return;
    if (selection.id === 'requirements') {
      if (!field.isActive) {
        this.notify.warning(this.transloco.translate('customFields.actions.requirementsArchived'));
        return;
      }
      this.requirementsModal().open(field);
    } else if (selection.id === 'toggleActive') {
      void this.toggleActive(field);
    }
  }

  private async toggleActive(field: CustomField): Promise<void> {
    if (!this.canManage() || this.togglingIds().has(field.id)) return;
    if (field.isActive && !await this.archiveDialog().open()) return;
    if (!this.canManage() || this.togglingIds().has(field.id)) return;
    const submission = this.submissions.get(field.id) ?? new CustomFieldSubmission();
    this.submissions.set(field.id, submission);
    this.setToggling(field.id, true);
    try {
      // PATCH returns the definition only, so keep the requirements already loaded.
      const updated: CustomField = {
        ...(await submission.run({ isActive: !field.isActive }, body => updateCustomField(field.id, body))),
        requirements: field.requirements,
      };
      this.submissions.delete(field.id);
      this.onFieldSaved(updated);
      this.notify.success(
        this.transloco.translate(updated.isActive ? 'customFields.toasts.restored' : 'customFields.toasts.archived'),
      );
    } catch (error) {
      const result = customFieldsError(this.transloco, error);
      if (result.readOnly) this.readOnly.set(true);
      this.notify.error(result.message);
      if (error instanceof ApiError && error.status === 404) await this.loadFields();
    } finally {
      this.setToggling(field.id, false);
    }
  }

  private setToggling(id: string, busy: boolean): void {
    this.togglingIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

}
