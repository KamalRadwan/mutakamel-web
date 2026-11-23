import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { pluralKey } from '../../../../../core/i18n/plural';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerCloudOff,
  tablerShieldCheck,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog, ConfirmTone } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import {
  ApiError,
  errorCodeOf,
  staffErrorMessage,
  listAllPages,
  roleHolderCount,
} from '../../shared/staff.api';
import { RolesApi } from '../roles.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import { Branch, Company, RoleBranchPermissions, STAFF_LIMITS } from '../../shared/staff.model';
import {
  TreeEntry,
  buildPermissionHierarchy,
  computeProfileChip,
  countEffectivePermissions,
  fromCatalogue,
  normalizeBranchPermissionIds,
} from '../permission-tree/permission-tree.model';
import {
  PermissionsSavedDialog,
  SavedPermissionsSummary,
} from '../permissions-saved-dialog/permissions-saved-dialog';
import { AssignStepPermissions, CopyBranchSource } from './step-permissions/step-permissions';
import { AssignStepReview, BranchReviewItem } from './step-review/step-review';
import { AssignStepScope } from './step-scope/step-scope';

type WizardStepId = 'scope' | 'permissions' | 'review';

interface ConfirmPrompt {
  tone: ConfirmTone;
  title: string;
  text: string;
  confirmLabel: string;
}

const WIZARD_STEPS: readonly { id: WizardStepId; labelKey: string; num: number }[] = [
  { id: 'scope', labelKey: 'perm.steps.scope', num: 1 },
  { id: 'permissions', labelKey: 'perm.steps.permissions', num: 2 },
  { id: 'review', labelKey: 'perm.steps.review', num: 3 },
];

@Component({
  selector: 'app-assign-permissions-wizard',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Modal,
    UnsavedDialog,
    AssignStepScope,
    AssignStepPermissions,
    AssignStepReview,
    PermissionsSavedDialog,
    SeatImpact,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff-roles', alias: 'roles' },
      { scope: 'staff-permissions', alias: 'perm' },
      { scope: 'staff', alias: 'staff' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerCheck,
      tablerCloudOff,
      tablerShieldCheck,
      tablerX,
    }),
  ],
  templateUrl: './assign-wizard.html',
})
export class AssignPermissionsWizard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly api = inject(RolesApi);
  private readonly organization = inject(OrganizationReadApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  protected readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly modal = viewChild.required<Modal>('wizardModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly confirmDialogWrap = viewChild<ElementRef<HTMLElement>>('confirmDialogWrap');
  private readonly confirmDialog = viewChild.required<ConfirmDialog>('confirmDialog');
  private readonly savedDialog = viewChild.required(PermissionsSavedDialog);

  readonly saved = output<RoleBranchPermissions>();

  protected readonly steps = WIZARD_STEPS;

  protected readonly isOpen = signal(false);
  protected readonly roleId = signal<string | null>(null);
  private readonly readonlyRequested = signal(false);
  protected readonly readonly = computed(
    () =>
      this.readonlyRequested() ||
      Boolean(this.loaded()?.isSystem) ||
      !this.session.canUpdateBranchPermissions(),
  );
  protected readonly step = signal<WizardStepId>('scope');
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly guardBusy = signal(false);

  protected readonly loaded = signal<RoleBranchPermissions | null>(null);
  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly holderCount = signal(0);
  protected readonly seatBlocked = signal(false);

  protected readonly selectedCompanyIds = signal<string[]>([]);
  protected readonly selectedBranchIds = signal<string[]>([]);
  protected readonly draftPermissions = signal<Map<string, string[]>>(new Map());
  protected readonly currentBranchId = signal('');

  protected readonly autoSelectedCompanyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly invalidBranchIds = signal<ReadonlySet<string>>(new Set());
  protected readonly step1Attempted = signal(false);

  protected readonly confirmPrompt = signal<ConfirmPrompt>({
    tone: 'danger',
    title: '',
    text: '',
    confirmLabel: '',
  });

  private baseBranchIds: string[] = [];
  private basePermissions = new Map<string, string[]>();
  private baseSnapshot = '';
  private allowClose = false;
  private loadSeq = 0;
  private cascadeBodyJson: string | null = null;

  protected readonly roleName = computed(() => this.loaded()?.roleName ?? '');
  protected readonly profilesPayload = computed(() => this.buildProfilesPayload());
  protected readonly seatChanges = computed<SeatChange[] | null>(() => {
    const id = this.roleId();
    if (!id || this.readonly()) return null;
    return [{ kind: 'SET_ROLE_BRANCH_PROFILES', roleId: id, profiles: this.profilesPayload() }];
  });
  protected readonly limits = computed(
    () =>
      this.loaded()?.limits ?? {
        branches: STAFF_LIMITS.branchProfiles,
        permissionsPerBranch: STAFF_LIMITS.profilePermissions,
      },
  );
  protected readonly treeEntries = computed<TreeEntry[]>(() =>
    fromCatalogue(this.loaded()?.catalogue ?? []),
  );
  protected readonly hierarchy = computed(() =>
    buildPermissionHierarchy(this.treeEntries(), 'BRANCH'),
  );
  protected readonly branchById = computed(
    () => new Map(this.branches().map((branch) => [branch.id, branch])),
  );
  protected readonly companyById = computed(
    () => new Map(this.companies().map((company) => [company.id, company])),
  );
  protected readonly selectedBranchSet = computed(() => new Set(this.selectedBranchIds()));

  protected readonly dirty = computed(() => {
    if (this.readonly() || this.loading() || this.loadFailed() || !this.loaded()) return false;
    return (
      this.computeSnapshot(this.selectedBranchIds(), this.draftPermissions()) !== this.baseSnapshot
    );
  });

  protected readonly step1Invalid = computed(
    () =>
      !this.readonly() &&
      ((this.step1Attempted() && this.selectedBranchIds().length === 0) ||
        this.invalidBranchIds().size > 0),
  );

  protected readonly currentStepIndex = computed(() =>
    this.steps.findIndex((s) => s.id === this.step()),
  );

  protected readonly step2BranchOptions = computed<DropdownOption<string>[]>(() => {
    const companyMap = this.companyById();
    const branchMap = this.branchById();
    const list = this.readonly()
      ? this.branches()
      : this.selectedBranchIds()
          .map((id) => branchMap.get(id))
          .filter((b): b is Branch => b !== undefined);

    return list.map((branch) => {
      const companyName = companyMap.get(branch.companyId)?.name ?? '';
      return {
        value: branch.id,
        label: companyName ? `${branch.name} — ${companyName}` : branch.name,
      };
    });
  });

  protected readonly isCurrentBranchIncluded = computed(() => {
    const id = this.currentBranchId();
    return Boolean(id && this.selectedBranchSet().has(id));
  });

  protected readonly currentBranchSelectedIds = computed<string[]>(() => {
    const id = this.currentBranchId();
    if (!id || !this.selectedBranchSet().has(id)) return [];
    return this.draftPermissions().get(id) ?? [];
  });

  protected readonly otherCopyBranches = computed<CopyBranchSource[]>(() => {
    const currentId = this.currentBranchId();
    const branchMap = this.branchById();
    const companyMap = this.companyById();
    const hierarchy = this.hierarchy();
    const perms = this.draftPermissions();

    return this.selectedBranchIds()
      .filter((id) => id !== currentId)
      .map((id) => {
        const branch = branchMap.get(id);
        const companyName = branch ? (companyMap.get(branch.companyId)?.name ?? '') : '';
        const label = branch ? (companyName ? `${branch.name} — ${companyName}` : branch.name) : id;
        const count = countEffectivePermissions(hierarchy, new Set(perms.get(id) ?? []));
        return { branchId: id, label, count };
      });
  });

  protected readonly reviewItems = computed<BranchReviewItem[]>(() => {
    this.i18n();
    const entries = this.treeEntries();
    const branchMap = this.branchById();
    const companyMap = this.companyById();
    const draftMap = this.draftPermissions();
    const baseSet = new Set(this.baseBranchIds);
    const activeSet = this.selectedBranchSet();

    const orderedIds = [
      ...this.selectedBranchIds(),
      ...this.baseBranchIds.filter((id) => !activeSet.has(id)),
    ];

    return orderedIds.map((branchId) => {
      const branch = branchMap.get(branchId);
      const branchName = branch?.name ?? branchId;
      const companyName = branch ? (companyMap.get(branch.companyId)?.name ?? '') : '';

      if (!activeSet.has(branchId)) {
        const baseIds = new Set(
          normalizeBranchPermissionIds(entries, this.basePermissions.get(branchId) ?? [], 'BRANCH'),
        );
        return {
          branchId,
          branchName,
          companyName,
          chip: this.chipLabel(entries, new Set()),
          status: 'removed',
          permissionCount: 0,
          added: 0,
          removed: baseIds.size,
          unchanged: 0,
        };
      }

      const draftNormalized = normalizeBranchPermissionIds(
        entries,
        draftMap.get(branchId) ?? [],
        'BRANCH',
      );
      const draftSet = new Set(draftNormalized);
      const chip = this.chipLabel(entries, draftSet);

      if (!baseSet.has(branchId)) {
        return {
          branchId,
          branchName,
          companyName,
          chip,
          status: 'new',
          permissionCount: draftSet.size,
          added: draftSet.size,
          removed: 0,
          unchanged: 0,
        };
      }

      const baseNormalized = new Set(
        normalizeBranchPermissionIds(entries, this.basePermissions.get(branchId) ?? [], 'BRANCH'),
      );
      let added = 0;
      let unchanged = 0;
      for (const id of draftSet) {
        if (baseNormalized.has(id)) unchanged += 1;
        else added += 1;
      }
      let removed = 0;
      for (const id of baseNormalized) {
        if (!draftSet.has(id)) removed += 1;
      }

      return {
        branchId,
        branchName,
        companyName,
        chip,
        status: 'existing',
        permissionCount: draftSet.size,
        added,
        removed,
        unchanged,
      };
    });
  });

  constructor() {
    const onConfirmEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !this.guardBusy()) return;
      this.dismissConfirmDialog(event);
    };
    const onConfirmCancel = (event: Event) => {
      if (!this.guardBusy()) return;
      this.dismissConfirmDialog(event);
    };
    document.addEventListener('keydown', onConfirmEscape, { capture: true });
    document.addEventListener('cancel', onConfirmCancel, { capture: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onConfirmEscape, { capture: true });
      document.removeEventListener('cancel', onConfirmCancel, { capture: true });
    });
  }

  open(roleId: string, options?: { readonly?: boolean }): void {
    if (!this.session.canReadBranchPermissions()) return;
    this.allowClose = false;
    this.guardBusy.set(false);
    this.conflictOpen.set(false);
    this.roleId.set(roleId);
    this.readonlyRequested.set(Boolean(options?.readonly));
    this.step.set('scope');
    this.step1Attempted.set(false);
    this.invalidBranchIds.set(new Set());
    this.autoSelectedCompanyIds.set(new Set());
    this.seatBlocked.set(false);

    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.modal().open();
    }

    void this.load(roleId);
  }

  protected retryLoad(): void {
    const id = this.roleId();
    if (!id) return;
    void this.load(id);
  }

  protected isStepInvalid(stepId: WizardStepId): boolean {
    return stepId === 'scope' && this.step1Invalid();
  }

  protected isStepDone(stepIndex: number, stepId: WizardStepId): boolean {
    if (this.isStepInvalid(stepId)) return false;
    return stepIndex < this.currentStepIndex();
  }

  protected canClickStep(stepIndex: number, stepId: WizardStepId): boolean {
    if (this.loading() || this.loadFailed() || this.saving()) return false;
    if (this.readonly()) return stepId !== this.step();
    return this.isStepDone(stepIndex, stepId);
  }

  protected goToStep(target: WizardStepId): void {
    if (this.loading() || this.loadFailed() || this.saving()) return;
    if (target === 'review') {
      void this.goToReview();
      return;
    }
    if (target === 'permissions') {
      this.goToPermissions();
      return;
    }
    this.step.set('scope');
  }

  protected goToPermissions(focusBranchId?: string): void {
    if (
      !this.readonly() &&
      (this.selectedBranchIds().length === 0 || this.invalidBranchIds().size > 0)
    ) {
      this.step1Attempted.set(true);
      this.step.set('scope');
      return;
    }
    this.ensureValidCurrentBranch(focusBranchId);
    this.step.set('permissions');
  }

  protected goToReview(): void {
    if (
      !this.readonly() &&
      (this.selectedBranchIds().length === 0 || this.invalidBranchIds().size > 0)
    ) {
      this.step1Attempted.set(true);
      this.step.set('scope');
      return;
    }
    this.seatBlocked.set(false);
    this.step.set('review');
  }

  protected goBack(): void {
    const current = this.step();
    if (current === 'review') {
      this.seatBlocked.set(false);
      this.ensureValidCurrentBranch();
      this.step.set('permissions');
    } else if (current === 'permissions') {
      this.step.set('scope');
    }
  }

  protected onAddCompany(companyId: string): void {
    if (this.readonly() || this.selectedCompanyIds().includes(companyId)) return;

    this.selectedCompanyIds.update((list) => [...list, companyId]);

    const invalid = this.invalidBranchIds();
    const activeCompanyBranches = this.branches().filter(
      (b) => b.companyId === companyId && b.status === 'ACTIVE' && !invalid.has(b.id),
    );

    if (activeCompanyBranches.length === 1) {
      const onlyBranch = activeCompanyBranches[0];
      if (
        !this.selectedBranchSet().has(onlyBranch.id) &&
        this.selectedBranchIds().length < this.limits().branches
      ) {
        this.selectedBranchIds.update((list) => [...list, onlyBranch.id]);
        this.draftPermissions.update((map) => {
          const next = new Map(map);
          if (!next.has(onlyBranch.id)) next.set(onlyBranch.id, []);
          return next;
        });
        this.autoSelectedCompanyIds.update((set) => {
          const next = new Set(set);
          next.add(companyId);
          return next;
        });
      }
    }
  }

  protected async onRemoveCompany(companyId: string): Promise<void> {
    if (this.readonly()) return;
    const companyBranches = this.branches().filter(
      (b) => b.companyId === companyId && this.selectedBranchSet().has(b.id),
    );
    const affectedCount = companyBranches.reduce(
      (sum, branch) => sum + this.effectiveBranchPermissionCount(branch.id),
      0,
    );

    if (affectedCount > 0) {
      const companyName = this.companyById().get(companyId)?.name ?? '';
      const confirmed = await this.askConfirm({
        tone: 'danger',
        title: this.transloco.translate('perm.s1.removeCompanyTitle', { company: companyName }),
        text: this.transloco.translate(
          pluralKey('perm.s1.removeCompanyTextPlural', affectedCount, this.language()),
          { n: affectedCount },
        ),
        confirmLabel: this.transloco.translate('perm.s1.removeConfirm'),
      });
      if (!confirmed) return;
    }

    const removedBranchIds = new Set(companyBranches.map((b) => b.id));
    this.selectedCompanyIds.update((list) => list.filter((id) => id !== companyId));
    this.selectedBranchIds.update((list) => list.filter((id) => !removedBranchIds.has(id)));
    this.draftPermissions.update((map) => {
      const next = new Map(map);
      for (const id of removedBranchIds) next.delete(id);
      return next;
    });
    this.autoSelectedCompanyIds.update((set) => {
      if (!set.has(companyId)) return set;
      const next = new Set(set);
      next.delete(companyId);
      return next;
    });
    this.invalidBranchIds.update((set) => {
      const next = new Set(set);
      for (const id of removedBranchIds) next.delete(id);
      return next;
    });
  }

  protected async onToggleBranch(branchId: string): Promise<void> {
    if (this.readonly()) return;
    const branch = this.branchById().get(branchId);
    if (!branch) return;

    if (this.selectedBranchSet().has(branchId)) {
      const count = this.effectiveBranchPermissionCount(branchId);
      if (count > 0) {
        const confirmed = await this.askConfirm({
          tone: 'danger',
          title: this.transloco.translate('perm.s1.removeTitle', { branch: branch.name }),
          text: this.transloco.translate('perm.s1.removeText', { n: count }),
          confirmLabel: this.transloco.translate('perm.s1.removeConfirm'),
        });
        if (!confirmed) return;
      }

      this.selectedBranchIds.update((list) => list.filter((id) => id !== branchId));
      this.draftPermissions.update((map) => {
        const next = new Map(map);
        next.delete(branchId);
        return next;
      });
      this.invalidBranchIds.update((set) => {
        if (!set.has(branchId)) return set;
        const next = new Set(set);
        next.delete(branchId);
        return next;
      });
      this.autoSelectedCompanyIds.update((set) => {
        if (!set.has(branch.companyId)) return set;
        const next = new Set(set);
        next.delete(branch.companyId);
        return next;
      });
      return;
    }

    if (branch.status !== 'ACTIVE' || this.invalidBranchIds().has(branchId)) return;
    if (this.selectedBranchIds().length >= this.limits().branches) return;

    this.selectedBranchIds.update((list) => [...list, branchId]);
    this.draftPermissions.update((map) => {
      const next = new Map(map);
      if (!next.has(branchId)) next.set(branchId, []);
      return next;
    });
  }

  protected async onSelectAllCompanyBranches(companyId: string): Promise<void> {
    if (this.readonly()) return;
    const invalid = this.invalidBranchIds();
    const activeBranches = this.branches().filter(
      (b) => b.companyId === companyId && b.status === 'ACTIVE' && !invalid.has(b.id),
    );
    if (activeBranches.length === 0) return;

    const currentSet = this.selectedBranchSet();
    const allSelected = activeBranches.every((b) => currentSet.has(b.id));

    if (allSelected) {
      const totalPerms = activeBranches.reduce(
        (sum, b) => sum + this.effectiveBranchPermissionCount(b.id),
        0,
      );
      if (totalPerms > 0) {
        const companyName = this.companyById().get(companyId)?.name ?? '';
        const confirmed = await this.askConfirm({
          tone: 'danger',
          title: this.transloco.translate('perm.s1.removeCompanyTitle', { company: companyName }),
          text: this.transloco.translate(
            pluralKey('perm.s1.removeCompanyTextPlural', totalPerms, this.language()),
            { n: totalPerms },
          ),
          confirmLabel: this.transloco.translate('perm.s1.removeConfirm'),
        });
        if (!confirmed) return;
      }

      const removeSet = new Set(activeBranches.map((b) => b.id));
      this.selectedBranchIds.update((list) => list.filter((id) => !removeSet.has(id)));
      this.draftPermissions.update((map) => {
        const next = new Map(map);
        for (const id of removeSet) next.delete(id);
        return next;
      });
      this.autoSelectedCompanyIds.update((set) => {
        if (!set.has(companyId)) return set;
        const next = new Set(set);
        next.delete(companyId);
        return next;
      });
      return;
    }

    const maxBranches = this.limits().branches;
    const additions: string[] = [];
    let projected = this.selectedBranchIds().length;
    for (const branch of activeBranches) {
      if (currentSet.has(branch.id)) continue;
      if (projected >= maxBranches) break;
      additions.push(branch.id);
      projected += 1;
    }
    if (additions.length === 0) return;

    this.selectedBranchIds.update((list) => [...list, ...additions]);
    this.draftPermissions.update((map) => {
      const next = new Map(map);
      for (const id of additions) {
        if (!next.has(id)) next.set(id, []);
      }
      return next;
    });
  }

  protected onCurrentBranchPermissionsChange(nextIds: string[]): void {
    const branchId = this.currentBranchId();
    if (this.readonly() || !branchId || !this.selectedBranchSet().has(branchId)) return;
    this.draftPermissions.update((map) => {
      const next = new Map(map);
      next.set(branchId, nextIds);
      return next;
    });
  }

  protected async onCopyFromBranch(sourceBranchId: string): Promise<void> {
    const targetBranchId = this.currentBranchId();
    if (this.readonly() || !targetBranchId || !this.selectedBranchSet().has(targetBranchId)) return;
    const sourceBranch = this.branchById().get(sourceBranchId);
    const sourceName = sourceBranch?.name ?? sourceBranchId;

    const confirmed = await this.askConfirm({
      tone: 'warning',
      title: this.transloco.translate('perm.s2.copyTitle'),
      text: this.transloco.translate('perm.s2.copyConfirm', { branch: sourceName }),
      confirmLabel: this.transloco.translate('perm.s2.copyConfirmBtn'),
    });
    if (!confirmed) return;

    const copied = normalizeBranchPermissionIds(
      this.treeEntries(),
      this.draftPermissions().get(sourceBranchId) ?? [],
      'BRANCH',
    );
    this.draftPermissions.update((map) => {
      const next = new Map(map);
      next.set(targetBranchId, copied);
      return next;
    });
  }

  protected onReviewEditBranch(branchId: string): void {
    if (this.readonly()) return;
    this.currentBranchId.set(branchId);
    this.step.set('permissions');
  }

  protected async save(confirmAddonCascade = false): Promise<void> {
    const id = this.roleId();
    const currentLoaded = this.loaded();
    if (
      !id ||
      !currentLoaded ||
      this.readonly() ||
      this.saving() ||
      this.loading() ||
      this.loadFailed() ||
      this.seatBlocked() ||
      this.conflictOpen()
    ) {
      return;
    }

    if (this.selectedBranchIds().length === 0 || this.invalidBranchIds().size > 0) {
      this.step1Attempted.set(true);
      this.step.set('scope');
      return;
    }

    const body = {
      expectedRevision: currentLoaded.revision,
      catalogueRevision: currentLoaded.catalogueRevision,
      profiles: this.buildProfilesPayload(),
    };
    const bodyJson = JSON.stringify(body);
    if (confirmAddonCascade) this.cascadeBodyJson = bodyJson;
    const cascadeConfirmed = this.cascadeBodyJson === bodyJson;
    this.saving.set(true);

    try {
      const updated = await this.api.setBranchPermissions(id, body, {
        confirmAddonCascade: cascadeConfirmed,
      });

      const summary = this.buildSavedSummary(updated);
      this.closeImmediately();
      this.saved.emit(updated);
      this.savedDialog().open(summary);
    } catch (error) {
      const cascade = isCascadeRequired(error);
      if (cascade && !cascadeConfirmed) {
        this.saving.set(false);
        const confirmed = await this.openGuarded(() => this.cascadeConfirm.confirm(cascade.addons));
        if (confirmed) {
          await this.save(true);
        }
        return;
      }

      const seatMsg = seatErrorMessage(this.transloco, error);
      if (seatMsg) {
        this.notify.error(seatMsg);
        return;
      }

      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving() || this.guardBusy() || this.conflictOpen()) return;
    if (!(await this.confirmLeave())) return;
    this.closeImmediately();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && (this.guardBusy() || this.conflictOpen())) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.resetStateOnClose();
  }

  protected async reloadFromConflict(): Promise<void> {
    if (this.saving()) return;
    const id = this.roleId();
    this.conflictOpen.set(false);
    this.conflictModal().close();
    if (!id) return;
    this.step.set('scope');
    this.step1Attempted.set(false);
    this.invalidBranchIds.set(new Set());
    this.autoSelectedCompanyIds.set(new Set());
    await this.load(id);
  }

  protected async keepChangesFromConflict(): Promise<void> {
    const id = this.roleId();
    if (!id || this.saving()) return;
    const seq = this.loadSeq;
    this.saving.set(true);
    try {
      const latest = await this.api.getBranchPermissions(id);
      if (seq !== this.loadSeq || id !== this.roleId()) return;
      this.loaded.update((current) =>
        current
          ? {
              ...current,
              revision: latest.revision,
              catalogueRevision: latest.catalogueRevision,
            }
          : current,
      );
      this.conflictOpen.set(false);
      this.conflictModal().close();
    } catch (error) {
      this.notify.error(this.resolveErrorMessage(error, 'read'));
    } finally {
      this.saving.set(false);
    }
  }

  protected onConflictClosed(): void {
    if (this.conflictOpen()) {
      void this.reloadFromConflict();
    }
  }

  protected onViewPermissionsFromSaved(roleId: string): void {
    this.open(roleId, { readonly: true });
  }

  protected onConfirmDialogEscape(event: Event): void {
    this.dismissConfirmDialog(event);
  }

  private async load(roleId: string): Promise<void> {
    if (!this.session.canReadBranchPermissions()) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    try {
      const [permsData, companiesRaw, branchesRaw, holders] = await Promise.all([
        this.api.getBranchPermissions(roleId),
        listAllPages((q) => this.organization.listCompanies(q), { limit: 100 }),
        listAllPages((q) => this.organization.listBranches(q), { limit: 100 }),
        // FAKE-ONLY, no backend route: holderCount on GET /roles/:id (BE-S1); FE-S6b swaps it in
        roleHolderCount(roleId).catch(() => 0),
      ]);
      if (seq !== this.loadSeq || !this.session.canReadBranchPermissions()) return;

      const { companies, branches } = this.mergeMissingEntities(
        companiesRaw,
        branchesRaw,
        permsData,
      );

      this.loaded.set(permsData);
      this.companies.set(companies);
      this.branches.set(branches);
      this.holderCount.set(holders);

      const companyStatusMap = new Map(companies.map((c) => [c.id, c.status]));
      const branchStatusMap = new Map(branches.map((b) => [b.id, b.status]));
      const initialInvalid = new Set<string>();
      const baseIds = permsData.profiles.map((p) => p.branchId);
      const baseMap = new Map<string, string[]>();
      const draftMap = new Map<string, string[]>();
      const companyIds: string[] = [];
      const seenCompanies = new Set<string>();

      for (const profile of permsData.profiles) {
        baseMap.set(profile.branchId, [...profile.permissionIds]);
        draftMap.set(profile.branchId, [...profile.permissionIds]);
        if (
          !profile.isActive ||
          branchStatusMap.get(profile.branchId) !== 'ACTIVE' ||
          companyStatusMap.get(profile.companyId) !== 'ACTIVE'
        ) {
          initialInvalid.add(profile.branchId);
        }
        if (!seenCompanies.has(profile.companyId)) {
          seenCompanies.add(profile.companyId);
          companyIds.push(profile.companyId);
        }
      }

      this.baseBranchIds = baseIds;
      this.basePermissions = baseMap;
      this.baseSnapshot = this.computeSnapshot(baseIds, baseMap);

      this.invalidBranchIds.set(initialInvalid);
      this.selectedCompanyIds.set(companyIds);
      this.selectedBranchIds.set([...baseIds]);
      this.draftPermissions.set(draftMap);
      this.currentBranchId.set(baseIds[0] ?? branches[0]?.id ?? '');
      this.loading.set(false);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (
        (error instanceof ApiError && error.status === 403) ||
        errorCodeOf(error) === 'ROLE_BRANCH_OWNER_REQUIRED'
      ) {
        this.notify.error(this.resolveErrorMessage(error, 'read'));
        this.closeImmediately();
        return;
      }
      this.loading.set(false);
      this.loadFailed.set(true);
    }
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'ROLE_BRANCH_REVISION_CONFLICT' || code === 'ROLE_BRANCH_CATALOGUE_CHANGED') {
      this.conflictOpen.set(true);
      this.conflictModal().open();
      return;
    }

    if (code === 'ROLE_BRANCH_SCOPE_INVALID') {
      const nextInvalid = new Set(this.invalidBranchIds());
      const branchMap = this.branchById();
      for (const id of this.selectedBranchIds()) {
        if (branchMap.get(id)?.status !== 'ACTIVE') {
          nextInvalid.add(id);
        }
      }
      if (error instanceof ApiError && error.details) {
        const detailBranchId = error.details['branchId'];
        if (typeof detailBranchId === 'string') nextInvalid.add(detailBranchId);
        if (Array.isArray(detailBranchId)) {
          for (const id of detailBranchId) if (typeof id === 'string') nextInvalid.add(id);
        }
        const detailBranchIds = error.details['branchIds'];
        if (Array.isArray(detailBranchIds)) {
          for (const id of detailBranchIds) {
            if (typeof id === 'string') nextInvalid.add(id);
          }
        }
      }
      this.invalidBranchIds.set(nextInvalid);
      this.step.set('scope');
      this.notify.error(this.resolveErrorMessage(error));
      return;
    }

    if (code === 'ROLE_BRANCH_PERMISSION_INVALID') {
      this.ensureValidCurrentBranch();
      this.step.set('permissions');
      this.notify.error(this.resolveErrorMessage(error));
      return;
    }

    const message = this.resolveErrorMessage(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
    else this.notify.error(message);
  }

  private buildProfilesPayload(): { branchId: string; permissionIds: string[] }[] {
    const entries = this.treeEntries();
    const map = this.draftPermissions();
    return this.selectedBranchIds().map((branchId) => ({
      branchId,
      permissionIds: normalizeBranchPermissionIds(entries, map.get(branchId) ?? [], 'BRANCH'),
    }));
  }

  private buildSavedSummary(result: RoleBranchPermissions): SavedPermissionsSummary {
    const entries = fromCatalogue(result.catalogue);
    const branchMap = this.branchById();
    return {
      roleId: result.roleId,
      roleName: result.roleName,
      branches: result.profiles.map((profile) => ({
        branchId: profile.branchId,
        branchName: profile.branchName || branchMap.get(profile.branchId)?.name || profile.branchId,
        chip: this.chipLabel(entries, new Set(profile.permissionIds)),
      })),
    };
  }

  private chipLabel(entries: TreeEntry[], selectedSet: ReadonlySet<string>): string {
    return computeProfileChip(entries, selectedSet, this.language(), {
      full: (moduleName) => this.transloco.translate('perm.chip.full', { module: moduleName }),
      viewOnly: this.transloco.translate('perm.chip.viewOnly'),
      none: this.transloco.translate('perm.chip.none'),
      custom: this.transloco.translate('perm.chip.custom'),
    });
  }

  private effectiveBranchPermissionCount(branchId: string): number {
    return countEffectivePermissions(
      this.hierarchy(),
      new Set(this.draftPermissions().get(branchId) ?? []),
    );
  }

  private ensureValidCurrentBranch(preferredId?: string): void {
    const current = preferredId ?? this.currentBranchId();
    if (this.readonly()) {
      const all = this.branches();
      if (current && all.some((b) => b.id === current)) {
        this.currentBranchId.set(current);
      } else {
        this.currentBranchId.set(this.selectedBranchIds()[0] ?? all[0]?.id ?? '');
      }
      return;
    }

    const selected = this.selectedBranchIds();
    if (current && selected.includes(current)) {
      this.currentBranchId.set(current);
    } else {
      this.currentBranchId.set(selected[0] ?? '');
    }
  }

  private computeSnapshot(branchIds: string[], permissions: ReadonlyMap<string, string[]>): string {
    const sortedBranches = [...branchIds].sort();
    return JSON.stringify(
      sortedBranches.map((branchId) => ({
        branchId,
        ids: [...(permissions.get(branchId) ?? [])].sort(),
      })),
    );
  }

  private mergeMissingEntities(
    companies: Company[],
    branches: Branch[],
    permsData: RoleBranchPermissions,
  ): { companies: Company[]; branches: Branch[] } {
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const extraCompanies: Company[] = [];
    const extraBranches: Branch[] = [];

    for (const profile of permsData.profiles) {
      if (!companyMap.has(profile.companyId)) {
        const syntheticCompany: Company = {
          id: profile.companyId,
          code: profile.companyId,
          name: profile.companyName,
          legalName: null,
          taxNumber: null,
          countryCode: null,
          currencyCode: null,
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        };
        companyMap.set(profile.companyId, syntheticCompany);
        extraCompanies.push(syntheticCompany);
      }

      if (!branchMap.has(profile.branchId)) {
        const syntheticBranch: Branch = {
          id: profile.branchId,
          companyId: profile.companyId,
          code: profile.branchId,
          name: profile.branchName,
          address: null,
          phone: null,
          isHeadquarters: false,
          status: profile.isActive ? 'ACTIVE' : 'INACTIVE',
          createdAt: '',
          updatedAt: '',
        };
        branchMap.set(profile.branchId, syntheticBranch);
        extraBranches.push(syntheticBranch);
      }
    }

    return {
      companies: [...companies, ...extraCompanies],
      branches: [...branches, ...extraBranches],
    };
  }

  private async askConfirm(prompt: ConfirmPrompt): Promise<boolean> {
    this.confirmPrompt.set(prompt);
    await new Promise<void>((resolve) =>
      afterNextRender(() => resolve(), { injector: this.injector }),
    );
    return this.openGuarded(() => this.confirmDialog().open());
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.closeImmediately();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    const choice = await this.openGuarded(() => this.unsavedDialog().open());
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    if (this.selectedBranchIds().length === 0) {
      this.step1Attempted.set(true);
      this.step.set('scope');
    } else {
      this.goToReview();
    }
    return false;
  }

  private async openGuarded<T>(fn: () => Promise<T>): Promise<T> {
    this.guardBusy.set(true);
    try {
      return await fn();
    } finally {
      this.guardBusy.set(false);
    }
  }

  private dismissConfirmDialog(event: Event): void {
    const dialog =
      this.confirmDialogWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  closeImmediately(): void {
    this.allowClose = true;
    this.modal().close();
    this.resetStateOnClose();
  }

  private resetStateOnClose(): void {
    this.allowClose = false;
    this.loadSeq++;
    this.isOpen.set(false);
    this.conflictOpen.set(false);
    this.guardBusy.set(false);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.saving.set(false);
    this.loaded.set(null);
    this.companies.set([]);
    this.branches.set([]);
    this.holderCount.set(0);
    this.seatBlocked.set(false);
    this.selectedCompanyIds.set([]);
    this.selectedBranchIds.set([]);
    this.draftPermissions.set(new Map());
    this.currentBranchId.set('');
    this.autoSelectedCompanyIds.set(new Set());
    this.invalidBranchIds.set(new Set());
    this.step1Attempted.set(false);
    this.cascadeBodyJson = null;
    this.baseBranchIds = [];
    this.basePermissions = new Map();
    this.baseSnapshot = '';
  }

  private resolveErrorMessage(error: unknown, operation: 'read' | 'write' = 'write'): string {
    return staffErrorMessage(error, 'roles', this.transloco, operation);
  }
}
