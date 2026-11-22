import { Component, ElementRef, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
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
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { errorCodeOf } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { listCustomFields, updateCustomField } from './custom-fields.api';
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
import { RecordValues } from './record-values/record-values';
import { RequirementsModal } from './requirements-modal/requirements-modal';

const CAN_MANAGE = true; // later from the session permissions

type PageTab = 'definitions' | 'values';
type OwnerTypeFilter = 'ALL' | CreatableOwnerType;
type StatusFilter = 'ACTIVE' | 'ARCHIVED' | 'ALL';

@Component({
  selector: 'app-custom-fields-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    SettingsFrame,
    Dropdown,
    Button,
    ActionsMenu,
    CustomFieldModal,
    RequirementsModal,
    RecordValues,
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
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CustomFieldsPage {
  private static nextId = 0;
  protected readonly uid = `cf-page-${++CustomFieldsPage.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly fieldModal = viewChild.required(CustomFieldModal);
  private readonly requirementsModal = viewChild.required(RequirementsModal);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  protected readonly canManage = CAN_MANAGE;
  protected readonly maxDefinitions = MAX_DEFINITIONS;
  protected readonly typeIcons = FIELD_TYPE_ICONS;
  protected readonly ownerLook = OWNER_TYPE_LOOK;
  protected readonly operations = REQUIREMENT_OPERATIONS;
  protected readonly isChoicesType = isChoicesType;

  protected readonly activeTab = signal<PageTab>('definitions');
  protected readonly fields = signal<CustomField[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
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
    this.failed.set(false);
    try {
      const items = await listCustomFields();
      if (seq !== this.loadSeq) return;
      this.fields.set(items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    const tabs: PageTab[] = ['definitions', 'values'];
    const currentIdx = tabs.indexOf(this.activeTab());
    const rtl = this.language() === 'ar';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === nextKey) nextIdx = (currentIdx + 1) % tabs.length;
    else if (event.key === prevKey) nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = tabs.length - 1;
    else return;

    event.preventDefault();
    this.activeTab.set(tabs[nextIdx]);
    this.tabButtons()[nextIdx]?.nativeElement.focus();
  }

  protected openCreate(): void {
    if (!this.canManage || this.atLimit()) return;
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
    if (!this.canManage) return;
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
    if (this.togglingIds().has(field.id)) return;
    this.setToggling(field.id, true);
    try {
      // PATCH returns the definition only, so keep the requirements already loaded.
      const updated: CustomField = {
        ...(await updateCustomField(field.id, { isActive: !field.isActive })),
        requirements: field.requirements,
      };
      this.onFieldSaved(updated);
      this.notify.success(
        this.transloco.translate(updated.isActive ? 'customFields.toasts.restored' : 'customFields.toasts.archived'),
      );
    } catch (error) {
      this.notify.error(this.resolveError(error));
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
}
