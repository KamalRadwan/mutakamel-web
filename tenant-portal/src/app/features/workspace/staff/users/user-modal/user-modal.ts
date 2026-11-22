import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerCrown,
  tablerHistory,
  tablerPhone,
  tablerShieldLock,
  tablerUser,
  tablerUsersGroup,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, getUser } from '../../shared/staff.api';
import { StaffSession } from '../../shared/staff-session';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { TenantUser } from '../../shared/staff.model';
import { UserAppsTab } from '../user-apps-tab/user-apps-tab';
import { UserCallsTab } from '../user-calls-tab/user-calls-tab';
import { UserPhoneTab } from '../user-phone-tab/user-phone-tab';
import { UserProfileTab } from '../user-profile-tab/user-profile-tab';
import { UserRolesTab } from '../user-roles-tab/user-roles-tab';
import { UserTeamsTab } from '../user-teams-tab/user-teams-tab';
import {
  UserModalTab,
  avatarToneForName,
  resolveStaffError,
  userFullName,
  userInitials,
} from '../users-page/users.model';

const TABS: readonly { id: UserModalTab; labelKey: string; icon: string }[] = [
  { id: 'profile', labelKey: 'users.tabs.profile', icon: 'tablerUser' },
  { id: 'roles', labelKey: 'users.tabs.roles', icon: 'tablerShieldLock' },
  { id: 'teams', labelKey: 'users.tabs.teams', icon: 'tablerUsersGroup' },
  { id: 'apps', labelKey: 'users.tabs.apps', icon: 'tablerApps' },
  { id: 'phone', labelKey: 'users.tabs.phone', icon: 'tablerPhone' },
  { id: 'calls', labelKey: 'users.tabs.calls', icon: 'tablerHistory' },
];

@Component({
  selector: 'app-user-modal',
  imports: [
    NgIcon,
    NgTemplateOutlet,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Modal,
    StatusBadge,
    UnsavedDialog,
    UserProfileTab,
    UserRolesTab,
    UserTeamsTab,
    UserAppsTab,
    UserPhoneTab,
    UserCallsTab,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'staff', alias: 'staff' }, { scope: 'staff-users', alias: 'users' }),
    provideIcons({
      tablerCrown,
      tablerX,
      tablerUser,
      tablerShieldLock,
      tablerUsersGroup,
      tablerApps,
      tablerPhone,
      tablerHistory,
    }),
  ],
  templateUrl: './user-modal.html',
})
export class UserModal {
  private static nextId = 0;
  protected readonly uid = `user-modal-${++UserModal.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  protected readonly profileTab = viewChild<UserProfileTab>('profileTab');
  protected readonly phoneTab = viewChild<UserPhoneTab>('phoneTab');

  readonly knownUsers = input<TenantUser[]>([]);
  readonly statusActionsFor = input.required<(user: TenantUser) => ActionItem[]>();

  readonly statusActionSelected = output<{ user: TenantUser; actionId: string }>();
  readonly userUpdated = output<TenantUser>();
  readonly deletedRemotely = output<void>();

  protected readonly canViewPhone = computed(() => {
    this.session.me();
    return (
      this.session.can('webphone.extensions.read') ||
      this.session.can('webphone.extensions.manage')
    );
  });
  protected readonly canViewCalls = computed(() => {
    this.session.me();
    return this.session.can('webphone.call_logs.read');
  });
  protected readonly tabs = computed(() =>
    TABS.filter((tab) => {
      if (tab.id === 'phone') return this.canViewPhone();
      if (tab.id === 'calls') return this.canViewCalls();
      return true;
    }),
  );
  protected readonly user = signal<TenantUser | null>(null);
  protected readonly activeTab = signal<UserModalTab>('profile');
  protected readonly activeEditableTab = computed<UserProfileTab | UserPhoneTab | undefined>(() => {
    const current = this.activeTab();
    if (current === 'profile') return this.profileTab();
    if (current === 'phone') return this.phoneTab();
    return undefined;
  });

  protected readonly isSelf = computed(() => {
    const u = this.user();
    return Boolean(u && this.session.me()?.id === u.id);
  });

  private readonly userActions = computed(() => {
    const u = this.user();
    return u ? this.statusActionsFor()(u) : [];
  });

  /** Status actions stay in the header menu; Delete sits alone at the far end of the footer (03-components). */
  protected readonly headerActions = computed(() => this.userActions().filter((item) => item.id !== 'delete'));
  protected readonly deleteAction = computed(() => this.userActions().find((item) => item.id === 'delete') ?? null);

  protected onDeleteClick(user: TenantUser): void {
    const action = this.deleteAction();
    if (!action || action.disabled) return;
    this.statusActionSelected.emit({ user, actionId: action.id });
  }

  protected readonly rolesReadonly = computed(() => {
    const u = this.user();
    if (!u) return true;
    return (
      u.isTenantOwner ||
      this.isSelf() ||
      !this.session.can('users.user.assign_roles', { companyId: u.companyId, branchId: u.branchId })
    );
  });

  protected readonly rolesReadonlyReason = computed<string | null>(() => {
    this.i18n();
    const u = this.user();
    if (!u) return null;
    if (u.isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (this.isSelf()) return this.transloco.translate('staff.protected.self');
    if (!this.session.can('users.user.assign_roles', { companyId: u.companyId, branchId: u.branchId })) {
      return this.transloco.translate('staff.protected.scope');
    }
    return null;
  });

  protected readonly teamsReadonly = computed(() => {
    const u = this.user();
    if (!u) return true;
    return (
      u.isTenantOwner ||
      !this.session.can('users.user.manage_memberships', { companyId: u.companyId, branchId: u.branchId })
    );
  });

  protected readonly teamsReadonlyReason = computed<string | null>(() => {
    this.i18n();
    const u = this.user();
    if (!u) return null;
    if (u.isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (!this.session.can('users.user.manage_memberships', { companyId: u.companyId, branchId: u.branchId })) {
      return this.transloco.translate('staff.protected.scope');
    }
    return null;
  });

  protected readonly appsReadonly = computed(() => {
    const u = this.user();
    if (!u) return true;
    return u.isTenantOwner || !this.session.can('users.user.manage_modules');
  });

  protected readonly appsReadonlyReason = computed<string | null>(() => {
    this.i18n();
    const u = this.user();
    if (!u) return null;
    if (u.isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (!this.session.can('users.user.manage_modules')) {
      return this.transloco.translate('staff.protected.scope');
    }
    return null;
  });

  private allowClose = false;
  private confirmingUnsaved = false;
  private reloadSeq = 0;

  open(user: TenantUser, tab: UserModalTab = 'profile'): void {
    this.allowClose = false;
    this.user.set(user);
    const allowed =
      (tab !== 'phone' || this.canViewPhone()) &&
      (tab !== 'calls' || this.canViewCalls());
    this.activeTab.set(allowed ? tab : 'profile');
    this.modal().open();
  }

  syncUser(updated: TenantUser): void {
    if (this.user()?.id === updated.id) {
      this.user.set(updated);
    }
  }

  editingId(): string | null {
    return this.user()?.id ?? null;
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected fullName(user: TenantUser): string {
    return userFullName(user);
  }

  protected initials(user: TenantUser): string {
    return userInitials(user);
  }

  protected avatarTone(user: TenantUser): string {
    return avatarToneForName(userFullName(user));
  }

  protected onStatusAction(user: TenantUser, selection: ActionSelection): void {
    this.statusActionSelected.emit({ user, actionId: selection.id });
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const visibleTabs = this.tabs();
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
    const targetTab = visibleTabs[nextIndex];
    if (!targetTab) return;
    this.tabButtons()[nextIndex]?.nativeElement.focus();
    void this.selectTab(targetTab.id);
  }

  protected async selectTab(nextTab: UserModalTab): Promise<void> {
    if (nextTab === this.activeTab()) return;
    const editor = this.activeEditableTab();
    if (editor?.saving()) return;
    if (editor?.dirty()) {
      const ok = await this.resolveUnsavedChanges();
      if (!ok) return;
    }
    this.activeTab.set(nextTab);
  }

  protected onProfileSaved(updated: TenantUser): void {
    this.user.set(updated);
    this.userUpdated.emit(updated);
  }

  protected async reloadUser(): Promise<void> {
    const current = this.user();
    if (!current) return;
    const seq = ++this.reloadSeq;
    try {
      const fresh = await getUser(current.id);
      if (seq !== this.reloadSeq || this.user()?.id !== current.id) return;
      this.user.set(fresh);
      this.userUpdated.emit(fresh);
    } catch (error) {
      if (seq !== this.reloadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'TENANT_USER_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolveStaffError(error, this.transloco));
        this.onDeletedRemotely();
      }
    }
  }

  protected onDeletedRemotely(): void {
    this.closeImmediate();
    this.deletedRemotely.emit();
  }

  protected async requestClose(): Promise<void> {
    const editor = this.activeEditableTab();
    if (editor?.saving()) return;
    if (editor?.dirty()) {
      const ok = await this.resolveUnsavedChanges();
      if (!ok) return;
    }
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    const editor = this.activeEditableTab();
    if (!this.allowClose && editor?.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && editor?.dirty()) {
      this.modal().open();
      void this.confirmUnsavedAndClose();
      return;
    }
    this.allowClose = false;
    this.user.set(null);
    this.activeTab.set('profile');
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
