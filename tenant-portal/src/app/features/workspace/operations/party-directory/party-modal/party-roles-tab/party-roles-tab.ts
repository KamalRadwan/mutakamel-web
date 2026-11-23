import { isPartyTenantWide } from '../party-modal.util';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerLock, tablerPlus, tablerShieldLock, tablerX } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../../shared/ui/field/field';
import { ApiError, errorCodeOf, isValidationError } from '../../../../../../core/api/api-errors';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';
import {
  WorkspaceBranch as Branch,
} from '../../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { PartyDirectoryApi } from '../../party-directory.api';
import { PartyDetail, PartyRole, PartyRoleType } from '../../party-directory.model';
import {
  PARTY_ROLE_TYPES,
  appSourceLabel,
  isAppManagedRole,
  canOnPartyBranch,
  resolvePartyError,
} from '../party-modal.util';

@Component({
  selector: 'app-party-roles-tab',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field],
  providers: [provideIcons({ tablerCheck, tablerLock, tablerPlus, tablerShieldLock, tablerX })],
  templateUrl: './party-roles-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
})
export class PartyRolesTab {
  private static nextId = 0;
  protected readonly uid = `party-roles-tab-${++PartyRolesTab.nextId}`;

  private readonly session = inject(TenantScopeState);
  private readonly api = inject(PartyDirectoryApi);
  private readonly notify = inject(Notify);
  private readonly removeConfirm = viewChild.required<ConfirmDialog>('removeConfirm');
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  readonly readonly = input(false);
  readonly party = input.required<PartyDetail>();
  readonly branches = input<Branch[]>([]);

  readonly partyUpdated = output<PartyDetail>();
  readonly deletedRemotely = output<void>();

  protected readonly adding = signal(false);
  protected readonly selectedRole = signal<PartyRoleType>('CUSTOMER');
  protected readonly selectedBranch = signal('');
  protected readonly savingAdd = signal(false);
  protected readonly removingRoleId = signal<string | null>(null);
  private readonly roleServerError = signal<{ message: string; role: PartyRoleType; branch: string } | null>(
    null,
  );

  private syncedPartyId: string | null = null;

  protected readonly roles = computed(() => this.party().roles);

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    this.session.me();
    const options: DropdownOption<string>[] = [];
    if (this.readonly() || !canOnPartyBranch(this.session, 'directory.role.manage', this.party().branchId)) return options;
    if (isPartyTenantWide(this.session, 'directory.role.manage')) {
      options.push({
        value: '',
        label: this.transloco.translate('wsPartyModal.roles.allBranches'),
      });
    }
    for (const branch of this.branches()) {
      if (
        branch.status === 'ACTIVE' &&
        canOnPartyBranch(this.session, 'directory.role.manage', branch.id)
      ) {
        options.push({ value: branch.id, label: branch.name });
      }
    }
    return options;
  });

  protected readonly canAddAnyRole = computed(() => this.branchOptions().length > 0);

  protected readonly roleOptions = computed<DropdownOption<PartyRoleType>[]>(() => {
    this.i18n();
    return PARTY_ROLE_TYPES.map((role) => ({
      value: role,
      label: this.transloco.translate(`wsParty.roles.${role}`),
    }));
  });

  protected readonly roleError = computed(() => {
    const server = this.roleServerError();
    if (
      server &&
      server.role === this.selectedRole() &&
      server.branch === this.selectedBranch()
    ) {
      return server.message;
    }
    return null;
  });

  constructor() {
    effect(() => {
      const id = this.party().id;
      if (id !== this.syncedPartyId) {
        this.syncedPartyId = id;
        untracked(() => {
          this.adding.set(false);
          this.roleServerError.set(null);
        });
      }
    });
  }

  protected branchLabel(branchId: string | null): string {
    this.i18n();
    if (!branchId) return this.transloco.translate('wsPartyModal.roles.allBranches');
    return this.branches().find((b) => b.id === branchId)?.name ?? branchId;
  }

  protected isAppManaged(appSource: string | null): boolean {
    return isAppManagedRole(appSource);
  }

  protected sourceText(appSource: string | null): string {
    this.i18n();
    return appSourceLabel(appSource, this.transloco);
  }

  protected canRemove(role: PartyRole): boolean {
    this.session.me();
    return (
      !this.readonly() &&
      canOnPartyBranch(this.session, 'directory.role.manage', this.party().branchId) &&
      !isAppManagedRole(role.appSource) &&
      canOnPartyBranch(this.session, 'directory.role.manage', role.branchId)
    );
  }

  protected openAddForm(): void {
    if (!this.canAddAnyRole() || this.savingAdd() || this.removingRoleId() !== null) return;
    const opts = this.branchOptions();
    const partyBranch = this.party().branchId;
    const defaultBranch =
      partyBranch && opts.some((o) => o.value === partyBranch)
        ? partyBranch
        : (opts[0]?.value ?? '');
    const targetBranch = defaultBranch || null;
    const unusedRole = PARTY_ROLE_TYPES.find(
      (roleType) => !this.roles().some((r) => r.roleType === roleType && r.branchId === targetBranch),
    );
    this.selectedBranch.set(defaultBranch);
    this.selectedRole.set(unusedRole ?? 'CUSTOMER');
    this.roleServerError.set(null);
    this.adding.set(true);
  }

  protected cancelAdd(): void {
    if (this.savingAdd()) return;
    this.adding.set(false);
    this.roleServerError.set(null);
  }

  protected onRoleChange(role: PartyRoleType): void {
    this.selectedRole.set(role);
    this.roleServerError.set(null);
  }

  protected onBranchChange(branch: string): void {
    this.selectedBranch.set(branch);
    this.roleServerError.set(null);
  }

  protected async saveAdd(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canAddAnyRole() || this.savingAdd() || this.removingRoleId() !== null) return;

    const roleType = this.selectedRole();
    const branchVal = this.selectedBranch();
    if (!this.branchOptions().some((option) => option.value === branchVal)) return;
    this.roleServerError.set(null);
    this.savingAdd.set(true);

    try {
      await this.api.addRole(this.party().id, {
        roleType,
        ...(branchVal ? { branchId: branchVal } : {}),
      });
      const fresh = await this.api.getParty(this.party().id);
      this.partyUpdated.emit(fresh);
      this.adding.set(false);
      this.notify.success(this.transloco.translate('wsPartyModal.roles.added'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PARTY_ROLE_ALREADY_EXISTS' || code === 'PARTY_ROLE_METADATA_INVALID' || isValidationError(error)) {
        this.roleServerError.set({
          message: resolvePartyError(error, this.transloco),
          role: roleType,
          branch: branchVal,
        });
        return;
      }
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.deletedRemotely.emit();
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
    } finally {
      this.savingAdd.set(false);
    }
  }

  protected async removeRole(role: PartyRole): Promise<void> {
    if (!this.canRemove(role) || this.savingAdd() || this.removingRoleId() !== null) return;
    const confirmed = await this.removeConfirm().open();
    if (!confirmed) return;
    this.removingRoleId.set(role.id);
    try {
      await this.api.deleteRole(role.id);
      const fresh = await this.api.getParty(this.party().id);
      this.partyUpdated.emit(fresh);
      this.notify.success(this.transloco.translate('wsPartyModal.roles.removed'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PARTY_NOT_FOUND' || (error instanceof ApiError && error.status === 404 && !code?.includes('ROLE'))) {
        this.notify.error(resolvePartyError(error, this.transloco));
        this.deletedRemotely.emit();
        return;
      }
      this.notify.error(resolvePartyError(error, this.transloco));
      if (code === 'PARTY_ROLE_NOT_FOUND') {
        try { this.partyUpdated.emit(await this.api.getParty(this.party().id)); }
        catch (failure) { this.notify.error(resolvePartyError(failure, this.transloco, 'read')); }
      }
    } finally {
      this.removingRoleId.set(null);
    }
  }
}
