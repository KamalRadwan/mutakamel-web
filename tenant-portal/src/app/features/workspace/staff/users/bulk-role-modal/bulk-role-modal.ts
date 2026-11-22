import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe, pluralKey } from '../../../../../core/i18n/plural';
import { provideIcons } from '@ng-icons/core';
import { tablerShieldLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { listBranches, listCompanies, listRoles, newIdempotencyKey } from '../../shared/staff.api';
import { DryRunReport } from '../../../seats/dry-run-report/dry-run-report';
import { seatErrorMessage } from '../../../seats/seat-errors';
import { bulkAssignRole } from '../../../seats/seats.api';
import { SeatPreview } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import { Branch, Company, Role, ScopeTarget } from '../../shared/staff.model';
import { resolveStaffError } from '../users-page/users.model';

function isAssignableRole(role: Role): boolean {
  return role.name !== 'Tenant Super Admin' && role.nameI18n?.en !== 'Tenant Super Admin';
}

@Component({
  selector: 'app-bulk-role-modal',
  imports: [TranslocoPipe, PluralKeyPipe, Button, Dropdown, DryRunReport, Field, Modal, Segmented],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerShieldLock }),
  ],
  templateUrl: './bulk-role-modal.html',
})
export class BulkRoleModal {
  private static nextId = 0;
  protected readonly uid = `bulk-role-modal-${++BulkRoleModal.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');

  readonly companies = input<Company[]>([]);
  readonly branches = input<Branch[]>([]);
  readonly roles = input<Role[]>([]);

  readonly assigned = output<void>();

  protected readonly userIds = signal<string[]>([]);
  protected readonly selectedRoleId = signal('');
  protected readonly scopeTarget = signal<ScopeTarget>('BRANCH');
  protected readonly selectedCompanyId = signal('');
  protected readonly selectedBranchId = signal('');

  protected readonly checking = signal(false);
  protected readonly assigning = signal(false);
  protected readonly dryRunResult = signal<SeatPreview | null>(null);

  private readonly loadedRoles = signal<Role[] | null>(null);
  private readonly loadedCompanies = signal<Company[] | null>(null);
  private readonly loadedBranches = signal<Branch[] | null>(null);

  private openSeq = 0;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  protected readonly busy = computed(() => this.checking() || this.assigning());
  protected readonly isOwner = computed(() => this.session.isOwner());

  protected readonly availableRoles = computed<Role[]>(() => {
    const list = this.loadedRoles() ?? this.roles();
    return list.filter(isAssignableRole);
  });

  protected readonly activeCompanies = computed<Company[]>(() => {
    const list = this.loadedCompanies() ?? this.companies();
    return list.filter((c) => c.status === 'ACTIVE');
  });

  protected readonly activeBranches = computed<Branch[]>(() => {
    const list = this.loadedBranches() ?? this.branches();
    return list.filter((b) => b.status === 'ACTIVE');
  });

  protected readonly roleOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.availableRoles().map((r) => ({
      value: r.id,
      label: r.nameI18n?.[lang] || r.name,
    }));
  });

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const list: SegmentedOption[] = [
      { value: 'BRANCH', label: this.transloco.translate('users.bulk.scopeBranch') },
    ];
    if (this.isOwner()) {
      list.push(
        { value: 'COMPANY', label: this.transloco.translate('users.bulk.scopeCompany') },
        { value: 'TENANT', label: this.transloco.translate('users.bulk.scopeWorkspace') },
      );
    }
    return list;
  });

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() =>
    this.activeCompanies().map((c) => ({ value: c.id, label: c.name })),
  );

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    const companyId = this.selectedCompanyId();
    return this.activeBranches()
      .filter((b) => !companyId || b.companyId === companyId)
      .map((b) => ({ value: b.id, label: b.name }));
  });

  protected readonly hasValidSelection = computed(() => {
    if (!this.userIds().length || !this.selectedRoleId()) return false;
    const target = this.scopeTarget();
    if (target === 'COMPANY') return Boolean(this.selectedCompanyId());
    if (target === 'BRANCH') return Boolean(this.selectedBranchId());
    return true;
  });

  protected readonly canCheck = computed(() => this.hasValidSelection() && !this.busy());

  protected readonly canAssign = computed(
    () => this.hasValidSelection() && !this.busy() && this.dryRunResult()?.ok === true,
  );

  open(userIds: string[]): void {
    if (!userIds.length) return;
    const seq = ++this.openSeq;
    this.userIds.set([...userIds]);
    this.scopeTarget.set('BRANCH');
    this.dryRunResult.set(null);
    this.clearIdempotency();
    this.syncDefaultSelections();
    this.modal().open();
    void this.loadLookups(seq);
  }

  protected close(): void {
    if (this.busy()) return;
    this.modal().close();
  }

  protected onClosed(): void {
    this.openSeq++;
    this.userIds.set([]);
    this.dryRunResult.set(null);
    this.clearIdempotency();
  }

  protected onRoleChange(roleId: string): void {
    if (roleId === this.selectedRoleId()) return;
    this.selectedRoleId.set(roleId);
    this.resetDryRun();
  }

  protected onScopeChange(value: string | null): void {
    if (value !== 'TENANT' && value !== 'COMPANY' && value !== 'BRANCH') return;
    if (!this.isOwner() && value !== 'BRANCH') return;
    if (value === this.scopeTarget()) return;
    this.scopeTarget.set(value);
    if ((value === 'COMPANY' || value === 'BRANCH') && !this.selectedCompanyId()) {
      this.selectedCompanyId.set(this.activeCompanies()[0]?.id ?? '');
    }
    if (value === 'BRANCH') {
      const firstBranch = this.activeBranches().find((b) => b.companyId === this.selectedCompanyId());
      this.selectedBranchId.set(firstBranch?.id ?? this.activeBranches()[0]?.id ?? '');
    }
    this.resetDryRun();
  }

  protected onCompanyChange(companyId: string): void {
    if (companyId === this.selectedCompanyId()) return;
    this.selectedCompanyId.set(companyId);
    const firstBranch = this.activeBranches().find((b) => b.companyId === companyId);
    this.selectedBranchId.set(firstBranch?.id ?? '');
    this.resetDryRun();
  }

  protected onBranchChange(branchId: string): void {
    if (branchId === this.selectedBranchId()) return;
    this.selectedBranchId.set(branchId);
    this.resetDryRun();
  }

  protected async checkSeats(): Promise<void> {
    if (!this.canCheck()) return;
    const body = this.buildPayload(true);
    this.checking.set(true);
    try {
      const result = await bulkAssignRole(body, newIdempotencyKey());
      this.dryRunResult.set(result);
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.checking.set(false);
    }
  }

  protected async assign(): Promise<void> {
    if (!this.canAssign()) return;
    const body = this.buildPayload(false);
    const key = this.idempotencyKeyFor(body);
    this.assigning.set(true);
    try {
      const result = await bulkAssignRole(body, key);
      if (!result.ok) {
        this.dryRunResult.set(result);
        return;
      }
      const count = this.userIds().length;
      this.clearIdempotency();
      this.notify.success(this.transloco.translate(pluralKey('users.bulk.donePlural', count, this.language()), { n: count }));
      this.modal().close();
      this.assigned.emit();
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.assigning.set(false);
    }
  }

  private buildPayload(dryRun: boolean): Parameters<typeof bulkAssignRole>[0] {
    const target = this.scopeTarget();
    const scope: Parameters<typeof bulkAssignRole>[0]['scope'] = { target };
    if (target === 'COMPANY') {
      scope.companyId = this.selectedCompanyId();
    } else if (target === 'BRANCH') {
      scope.companyId = this.selectedCompanyId() || undefined;
      scope.branchId = this.selectedBranchId();
    }
    return {
      roleId: this.selectedRoleId(),
      scope,
      userIds: [...this.userIds()],
      dryRun,
    };
  }

  private async loadLookups(seq: number): Promise<void> {
    const [rolesRes, companiesRes, branchesRes] = await Promise.allSettled([
      listRoles({ limit: 100 }),
      listCompanies({ status: 'ACTIVE', limit: 100 }),
      listBranches({ status: 'ACTIVE', limit: 100 }),
    ]);
    if (seq !== this.openSeq) return;
    if (rolesRes.status === 'fulfilled') this.loadedRoles.set(rolesRes.value.data);
    if (companiesRes.status === 'fulfilled') this.loadedCompanies.set(companiesRes.value.data);
    if (branchesRes.status === 'fulfilled') this.loadedBranches.set(branchesRes.value.data);
    this.syncDefaultSelections();
  }

  private syncDefaultSelections(): void {
    const roles = this.availableRoles();
    if (!roles.some((r) => r.id === this.selectedRoleId())) {
      this.selectedRoleId.set(roles[0]?.id ?? '');
    }
    const companies = this.activeCompanies();
    if (!companies.some((c) => c.id === this.selectedCompanyId())) {
      this.selectedCompanyId.set(companies[0]?.id ?? '');
    }
    const branchList = this.branchOptions();
    if (!branchList.some((b) => b.value === this.selectedBranchId())) {
      this.selectedBranchId.set(branchList[0]?.value ?? '');
    }
  }

  private resetDryRun(): void {
    this.dryRunResult.set(null);
    this.clearIdempotency();
  }

  private idempotencyKeyFor(body: unknown): string {
    const fingerprint = `bulk:${JSON.stringify(body)}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private clearIdempotency(): void {
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
  }

  private resolveError(error: unknown): string {
    return seatErrorMessage(this.transloco, error) ?? resolveStaffError(error, this.transloco);
  }
}
