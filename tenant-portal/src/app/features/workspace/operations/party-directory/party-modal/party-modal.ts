import { Component, ElementRef, computed, inject, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAddressBook,
  tablerAlertTriangle,
  tablerBuilding,
  tablerCloudOff,
  tablerFileText,
  tablerMapPin,
  tablerShieldLock,
  tablerUser,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, listAllPages, listBranches } from '../../../staff/shared/staff.api';
import { StaffSession } from '../../../staff/shared/staff-session';
import { Branch } from '../../../staff/shared/staff.model';
import {
  deleteParty,
  getDirectorySettings,
  getParty,
  updateParty,
} from '../party-directory.api';
import { PartyDetail, PartyType } from '../party-directory.model';
import { PartyAddressesTab } from './party-addresses-tab/party-addresses-tab';
import { PartyContactsTab } from './party-contacts-tab/party-contacts-tab';
import { PartyDetailsTab } from './party-details-tab/party-details-tab';
import {
  DEFAULT_PARTY_LIMITS,
  EditableModalTab,
  PARTY_STATUS_BADGE,
  PartyDirectoryLimits,
  canOnPartyBranch,
  resolvePartyError,
} from './party-modal.util';
import { PartyPeopleTab } from './party-people-tab/party-people-tab';
import { PartyRolesTab } from './party-roles-tab/party-roles-tab';

type PartyTabId = 'details' | 'contacts' | 'addresses' | 'roles' | 'people';

interface PartyTabDef {
  id: PartyTabId;
  labelKey: string;
  icon: string;
  count: number | null;
}

const SKELETON_ROWS = [0, 1, 2, 3] as const;

@Component({
  selector: 'app-party-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Modal,
    UnsavedDialog,
    PartyDetailsTab,
    PartyContactsTab,
    PartyAddressesTab,
    PartyRolesTab,
    PartyPeopleTab,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'ws-party-directory', alias: 'wsParty' },
      { scope: 'ws-party-modal', alias: 'wsPartyModal' },
    ),
    provideIcons({
      tablerAddressBook,
      tablerAlertTriangle,
      tablerBuilding,
      tablerCloudOff,
      tablerFileText,
      tablerMapPin,
      tablerShieldLock,
      tablerUser,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './party-modal.html',
})
export class PartyModal {
  private static nextId = 0;
  protected readonly uid = `party-modal-${++PartyModal.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  protected readonly detailsTab = viewChild<PartyDetailsTab>('detailsTab');
  protected readonly contactsTab = viewChild<PartyContactsTab>('contactsTab');
  protected readonly addressesTab = viewChild<PartyAddressesTab>('addressesTab');

  readonly changed = output<{ id: string; deleted?: boolean }>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly statusBadgeClasses = PARTY_STATUS_BADGE;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly isOpen = signal(false);
  protected readonly partyType = signal<PartyType>('PERSON');
  protected readonly party = signal<PartyDetail | null>(null);
  protected readonly activeTab = signal<PartyTabId>('details');
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly deleting = signal(false);
  protected readonly settingInactive = signal(false);

  protected readonly branches = signal<Branch[]>([]);
  protected readonly limits = signal<PartyDirectoryLimits>(DEFAULT_PARTY_LIMITS);

  protected readonly activeEditableTab = computed<EditableModalTab | undefined>(() => {
    switch (this.activeTab()) {
      case 'details':
        return this.detailsTab();
      case 'contacts':
        return this.contactsTab();
      case 'addresses':
        return this.addressesTab();
      default:
        return undefined;
    }
  });

  protected readonly busy = computed(
    () => (this.activeEditableTab()?.saving() ?? false) || this.deleting() || this.settingInactive(),
  );

  protected readonly tabs = computed<PartyTabDef[]>(() => {
    if (this.mode() === 'create') return [];
    const current = this.party();
    if (!current) return [];
    const items: PartyTabDef[] = [
      { id: 'details', labelKey: 'wsPartyModal.tabs.details', icon: 'tablerFileText', count: null },
      {
        id: 'contacts',
        labelKey: 'wsPartyModal.tabs.contacts',
        icon: 'tablerAddressBook',
        count: current.contactMethods.length,
      },
      {
        id: 'addresses',
        labelKey: 'wsPartyModal.tabs.addresses',
        icon: 'tablerMapPin',
        count: current.addresses.length,
      },
      {
        id: 'roles',
        labelKey: 'wsPartyModal.tabs.roles',
        icon: 'tablerShieldLock',
        count: current.roles.length,
      },
    ];
    if (current.partyType === 'ORGANIZATION') {
      items.push({
        id: 'people',
        labelKey: 'wsPartyModal.tabs.people',
        icon: 'tablerUsers',
        count: null,
      });
    }
    return items;
  });

  protected readonly canManageCurrentParty = computed(() => {
    this.session.me();
    if (this.mode() === 'create') {
      return (
        this.session.isTenantWide('directory.party.manage') ||
        this.branches().some(
          (b) => b.status === 'ACTIVE' && this.session.can('directory.party.manage', { branchId: b.id }),
        )
      );
    }
    const current = this.party();
    if (!current) return false;
    return canOnPartyBranch(this.session, 'directory.party.manage', current.branchId);
  });

  protected readonly detailsReadonly = computed(() => {
    if (this.mode() === 'create') return false;
    return !this.canManageCurrentParty();
  });

  protected readonly contactsReadonly = computed(() => {
    this.session.me();
    const current = this.party();
    if (!current) return true;
    return !canOnPartyBranch(this.session, 'directory.contact.manage', current.branchId);
  });

  protected readonly addressesReadonly = computed(() => {
    this.session.me();
    const current = this.party();
    if (!current) return true;
    return !canOnPartyBranch(this.session, 'directory.address.manage', current.branchId);
  });

  protected readonly peopleReadonly = computed(() => {
    this.session.me();
    const current = this.party();
    if (!current) return true;
    return !canOnPartyBranch(this.session, 'directory.relationship.manage', current.branchId);
  });

  protected readonly headerTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'create') {
      return this.transloco.translate(
        this.partyType() === 'ORGANIZATION'
          ? 'wsPartyModal.title.newOrganization'
          : 'wsPartyModal.title.newPerson',
      );
    }
    return this.party()?.displayName || this.transloco.translate('wsPartyModal.title.loading');
  });

  protected readonly headerTileClass = computed(() =>
    this.partyType() === 'ORGANIZATION' ? 'bg-icon-navy' : 'bg-icon-blue',
  );

  protected readonly headerIcon = computed(() =>
    this.partyType() === 'ORGANIZATION' ? 'tablerBuilding' : 'tablerUser',
  );

  protected readonly detailsDirty = computed(() => this.detailsTab()?.dirty() ?? false);
  protected readonly detailsSaving = computed(() => this.detailsTab()?.saving() ?? false);

  private currentPartyId: string | null = null;
  private loadSeq = 0;
  private lookupsSeq = 0;
  private allowClose = false;
  private confirmingUnsaved = false;

  openParty(id: string): void {
    this.allowClose = false;
    this.isOpen.set(true);
    this.mode.set('edit');
    this.party.set(null);
    this.activeTab.set('details');
    this.currentPartyId = id;
    this.modal().open();
    void this.loadLookups();
    void this.loadParty(id);
  }

  openNew(type: PartyType): void {
    this.allowClose = false;
    this.loadSeq++;
    this.currentPartyId = null;
    this.isOpen.set(true);
    this.mode.set('create');
    this.partyType.set(type);
    this.party.set(null);
    this.activeTab.set('details');
    this.loading.set(false);
    this.loadFailed.set(false);
    this.modal().open();
    void this.loadLookups();
  }

  protected retryLoad(): void {
    if (this.currentPartyId) {
      void this.loadParty(this.currentPartyId);
    }
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const visibleTabs = this.tabs();
    if (visibleTabs.length === 0) return;
    const rtl = this.language() === 'ar';
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = rtl
        ? (index - 1 + visibleTabs.length) % visibleTabs.length
        : (index + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = rtl
        ? (index + 1) % visibleTabs.length
        : (index - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const target = visibleTabs[nextIndex];
    if (!target) return;
    this.tabButtons()[nextIndex]?.nativeElement.focus();
    void this.selectTab(target.id);
  }

  protected async selectTab(nextTab: PartyTabId): Promise<void> {
    if (nextTab === this.activeTab()) return;
    const editor = this.activeEditableTab();
    if (editor?.saving()) return;
    if (editor?.dirty()) {
      const ok = await this.resolveUnsavedChanges();
      if (!ok) {
        // Keep focus on the tab that is still selected, not on the one the user tried to open.
        const activeIndex = this.tabs().findIndex((tab) => tab.id === this.activeTab());
        this.tabButtons()[activeIndex]?.nativeElement.focus();
        return;
      }
    }
    this.activeTab.set(nextTab);
  }

  protected onPartyCreated(created: PartyDetail): void {
    this.currentPartyId = created.id;
    this.mode.set('edit');
    this.partyType.set(created.partyType);
    this.party.set(created);
    this.activeTab.set('details');
    this.changed.emit({ id: created.id });
  }

  protected onPartyUpdated(updated: PartyDetail): void {
    this.partyType.set(updated.partyType);
    this.party.set(updated);
    this.changed.emit({ id: updated.id });
  }

  protected onPeopleChanged(): void {
    const id = this.party()?.id;
    if (id) {
      this.changed.emit({ id });
    }
  }

  protected async openLinkedPerson(personId: string): Promise<void> {
    if (this.busy()) return;
    const editor = this.activeEditableTab();
    if (editor?.dirty()) {
      const ok = await this.resolveUnsavedChanges();
      if (!ok) return;
    }
    this.currentPartyId = personId;
    this.mode.set('edit');
    this.partyType.set('PERSON');
    this.party.set(null);
    this.activeTab.set('details');
    void this.loadParty(personId);
  }

  protected onDeletedRemotely(): void {
    const id = this.currentPartyId;
    this.closeImmediate();
    if (id) {
      this.changed.emit({ id, deleted: true });
    }
  }

  protected saveDetails(): void {
    void this.detailsTab()?.save();
  }

  protected undoDetails(): void {
    this.detailsTab()?.undo();
  }

  protected async requestDelete(): Promise<void> {
    const current = this.party();
    if (!current || this.mode() !== 'edit' || !this.canManageCurrentParty() || this.busy()) return;

    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await deleteParty(current.id);
      this.notify.success(this.transloco.translate('wsPartyModal.toast.deleted'));
      this.closeImmediate();
      this.changed.emit({ id: current.id, deleted: true });
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'DIRECTORY_PARTY_IN_USE') {
        this.inUseModal().open();
        return;
      }
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.onDeletedRemotely();
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.deleting.set(false);
    }
  }

  protected async setInactiveFromAlert(): Promise<void> {
    const current = this.party();
    if (!current || current.status === 'INACTIVE' || this.settingInactive()) return;

    this.settingInactive.set(true);
    try {
      const updated = await updateParty(current.id, { status: 'INACTIVE' });
      this.party.set(updated);
      this.inUseModal().close();
      this.notify.success(this.transloco.translate('wsPartyModal.toast.setInactive'));
      this.changed.emit({ id: updated.id });
    } catch (error) {
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.settingInactive.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.busy()) return;
    const editor = this.activeEditableTab();
    if (editor?.dirty()) {
      const ok = await this.resolveUnsavedChanges();
      if (!ok) return;
    }
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.busy()) {
      this.modal().open();
      return;
    }
    const editor = this.activeEditableTab();
    if (!this.allowClose && editor?.dirty()) {
      this.modal().open();
      void this.confirmUnsavedAndClose();
      return;
    }
    this.allowClose = false;
    this.isOpen.set(false);
    this.loadSeq++;
    this.currentPartyId = null;
    this.party.set(null);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.activeTab.set('details');
  }

  private closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  private async loadParty(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const detail = await getParty(id);
      if (seq !== this.loadSeq) return;
      this.partyType.set(detail.partyType);
      this.party.set(detail);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.closeImmediate();
        return;
      }
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadLookups(): Promise<void> {
    const seq = ++this.lookupsSeq;
    const canReadSettings = this.session.isTenantWide('directory.settings.manage');
    const [branchesRes, settingsRes] = await Promise.allSettled([
      listAllPages((q) => listBranches(q)),
      canReadSettings ? getDirectorySettings() : Promise.resolve(DEFAULT_PARTY_LIMITS),
    ]);
    if (seq !== this.lookupsSeq) return;
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    if (settingsRes.status === 'fulfilled' && settingsRes.value) {
      this.limits.set({
        maxContactMethodsPerParty:
          settingsRes.value.maxContactMethodsPerParty ?? DEFAULT_PARTY_LIMITS.maxContactMethodsPerParty,
        maxAddressesPerParty:
          settingsRes.value.maxAddressesPerParty ?? DEFAULT_PARTY_LIMITS.maxAddressesPerParty,
      });
    } else {
      this.limits.set(DEFAULT_PARTY_LIMITS);
    }
  }

  private async confirmUnsavedAndClose(): Promise<void> {
    if (await this.resolveUnsavedChanges()) {
      this.closeImmediate();
    }
  }

  private async resolveUnsavedChanges(): Promise<boolean> {
    if (this.confirmingUnsaved) return false;
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      const editor = this.activeEditableTab();
      if (choice === 'discard') {
        editor?.undo();
        return true;
      }
      if (!editor) return true;
      return await editor.save();
    } finally {
      this.confirmingUnsaved = false;
    }
  }
}
