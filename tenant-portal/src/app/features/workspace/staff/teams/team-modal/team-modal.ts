import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerSearch,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf, fieldErrorsOf } from '../../../../../core/api/api-errors';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { OrganizationWriteApi, type CreateTeamBody, type UpdateTeamBody } from '../../shared/organization-write.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { staffErrorMessage } from '../../shared/staff.api';
import { StaffSession } from '../../shared/staff-session';
import { StaffUsersApi } from '../../users/users.api';
import {
  Branch,
  CODE_PATTERN,
  Company,
  Department,
  OrgCascadeValue,
  STAFF_LIMITS,
  Team,
  TenantUser,
} from '../../shared/staff.model';

interface MenuPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

const EMPTY_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

const SEARCH_DEBOUNCE_MS = 200;

@Component({
  selector: 'app-team-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, ConflictDialog, Switch, Field, Modal, OrgCascade, StatusBadge],
  providers: [provideIcons({ tablerArrowBackUp, tablerUsersGroup, tablerChevronDown, tablerSearch, tablerLoader2, tablerCheck })],
  templateUrl: './team-modal.html',
  host: {
    '(document:click)': 'closeLeadMenuIfOutside($event)',
    '(window:resize)': 'closeLeadMenu()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class TeamModal {
  private static nextId = 0;
  protected readonly uid = `team-modal-${++TeamModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly organization = inject(OrganizationReadApi);
  private readonly writeApi = inject(OrganizationWriteApi);
  private readonly session = inject(StaffSession);
  private readonly usersApi = inject(StaffUsersApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly leadTrigger = viewChild<ElementRef<HTMLButtonElement>>('leadTrigger');
  private readonly leadMenuPanel = viewChild<ElementRef<HTMLElement>>('leadMenuPanel');
  private readonly leadSearchInput = viewChild<ElementRef<HTMLInputElement>>('leadSearchInput');

  readonly companies = input.required<readonly Company[]>();
  readonly branches = input.required<readonly Branch[]>();
  readonly departments = input.required<readonly Department[]>();
  readonly createDepartments = input.required<readonly Department[]>();
  readonly knownUsers = input<TenantUser[]>([]);
  readonly canEdit = input(false, { alias: 'canManage' });
  readonly saved = output<Team>();
  readonly deleteRequested = output<Team>();
  readonly deactivateBlocked = output<{ team: Team; blockers: string[] }>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseTeam = signal<Team | null>(null);
  protected readonly saving = signal(false);
  protected readonly canManage = computed(() => this.mode() === 'create' ? this.createDepartments().length > 0 : this.canEdit());
  protected readonly branchOptions = computed(() => {
    if (this.mode() === 'edit') return this.branches();
    const ids = new Set(this.createDepartments().map((department) => department.branchId));
    return this.branches().filter((branch) => ids.has(branch.id));
  });
  protected readonly companyOptions = computed(() => {
    if (this.mode() === 'edit') return this.companies();
    const ids = new Set(this.branchOptions().map((branch) => branch.companyId));
    return this.companies().filter((company) => ids.has(company.id));
  });
  protected readonly departmentOptions = computed(() =>
    this.mode() === 'create' ? this.createDepartments() : this.departments(),
  );
  protected readonly canReadBranchUsers = computed(() => {
    const branchId = this.cascadeValue().branchId;
    return Boolean(branchId && this.session.can('users.user.read', { branchId }));
  });
  protected readonly canSelectLead = computed(() => {
    const { branchId, departmentId } = this.cascadeValue();
    return this.canManage() && this.canReadBranchUsers() && (this.mode() === 'edit' ||
      this.createDepartments().some((department) => department.id === departmentId && department.branchId === branchId));
  });


  protected readonly cascadeValue = signal<OrgCascadeValue>({ ...EMPTY_CASCADE });
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly leadUserId = signal<string | null>(null);
  protected readonly isActive = signal(true);

  protected readonly leadMenuOpen = signal(false);
  protected readonly leadMenuPlaced = signal(false);
  protected readonly leadMenuPlace = signal<MenuPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly leadSearch = signal('');
  protected readonly leadSearching = signal(false);
  protected readonly leadOptions = signal<TenantUser[]>([]);
  protected readonly resolvedSelectedLead = signal<TenantUser | null>(null);

  protected readonly membersLoading = signal(false);
  protected readonly membersTotal = signal<number | null>(null);
  protected readonly members = signal<TenantUser[]>([]);

  protected readonly touched = signal<{ code?: boolean; name?: boolean }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
  protected readonly conflictOpen = signal(false);
  protected readonly nameServerError = signal<string | null>(null);
  protected readonly departmentServerError = signal<string | null>(null);
  protected readonly leadServerError = signal<string | null>(null);

  private allowClose = false;
  private confirmingDiscard = false;
  private presetCascade: OrgCascadeValue = { ...EMPTY_CASCADE };
  private cascadeEditedByUser = false;
  private lastPayloadSignature = '';
  private lastIdempotencyKey = '';
  private openSeq = 0;
  private leadSearchSeq = 0;
  private leadMenuSeq = 0;
  private leadSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private membersSeq = 0;

  protected readonly nameCount = computed(() => Array.from(this.name()).length);

  protected readonly selectedLead = computed<TenantUser | null>(() => {
    const id = this.leadUserId();
    if (!id || !this.canReadBranchUsers()) return null;
    const resolved = this.resolvedSelectedLead();
    if (resolved?.id === id) return resolved;
    return (
      this.leadOptions().find((u) => u.id === id) ??
      this.knownUsers().find((u) => u.id === id) ??
      null
    );
  });

  protected readonly readonlyLeadText = computed(() => {
    this.i18n();
    const lead = this.selectedLead();
    if (!lead) return this.leadUserId() ? '—' : this.transloco.translate('teams.fields.noLead');
    const name = this.fullName(lead);
    return lead.jobTitle ? `${name} — ${lead.jobTitle}` : name;
  });

  protected readonly dirty = computed(() => {
    if (!this.canManage()) return false;
    if (this.mode() === 'edit') {
      const base = this.baseTeam();
      return Boolean(base && (this.name().trim() !== base.name.trim() || this.leadUserId() !== base.leadUserId ||
        (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status));
    }
    const trimmedCode = this.code().trim();
    const trimmedName = this.name().trim();

    const current = this.cascadeValue();
    const cascadeChanged = this.cascadeEditedByUser &&
      (current.companyId !== this.presetCascade.companyId || current.branchId !== this.presetCascade.branchId ||
        current.departmentId !== this.presetCascade.departmentId);
    return cascadeChanged || trimmedCode !== '' || trimmedName !== '' || this.leadUserId() !== null;
  });

  protected readonly cascadeErrors = computed<{ company?: string; branch?: string; department?: string }>(() => {
    this.i18n();
    if (this.mode() !== 'create') return {};
    if (this.departmentServerError()) return { department: this.departmentServerError()! };
    if (!this.submitAttempted()) return {};
    const current = this.cascadeValue();
    const errors: { company?: string; branch?: string; department?: string } = {};
    if (!current.companyId) {
      errors.company = this.transloco.translate('teams.validation.companyRequired');
    }
    if (!current.branchId) {
      errors.branch = this.transloco.translate('teams.validation.branchRequired');
    }
    if (!current.departmentId) {
      errors.department = this.transloco.translate('teams.validation.departmentRequired');
    }
    return errors;
  });

  protected readonly codeError = computed(() => {
    this.i18n();
    const server = this.codeServerError();
    if (server) return server;
    if (this.mode() !== 'create') return null;
    if (!this.submitAttempted() && !this.touched().code) return null;

    const trimmed = this.code().trim();
    if (!trimmed) return this.transloco.translate('teams.validation.codeRequired');
    if (!CODE_PATTERN.test(trimmed)) {
      return this.transloco.translate('teams.validation.codeInvalid');
    }
    return null;
  });

  protected readonly nameError = computed(() => {
    this.i18n();
    if (this.nameServerError()) return this.nameServerError();
    if (!this.submitAttempted() && !this.touched().name) return null;
    const trimmed = this.name().trim();
    if (!trimmed) return this.transloco.translate('teams.validation.nameRequired');
    if (Array.from(trimmed).length > STAFF_LIMITS.name) {
      return this.transloco.translate('teams.validation.nameMaxLength', { max: STAFF_LIMITS.name });
    }
    return null;
  });

  protected readonly leadError = computed(() => this.leadServerError());

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.leadMenuOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.leadMenuPanel()?.nativeElement.contains(target)) return;
      this.closeLeadMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (this.leadSearchTimer !== null) clearTimeout(this.leadSearchTimer);
    });
  }

  openCreate(preset?: { companyId?: string | null; branchId?: string | null; departmentId?: string | null }): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.closeLeadMenu();
    this.mode.set('create');
    this.baseTeam.set(null);
    this.cascadeEditedByUser = false;

    const initialCascade: OrgCascadeValue = {
      companyId: preset?.companyId || null,
      branchId: preset?.branchId || null,
      departmentId: preset?.departmentId || null,
      teamId: null,
    };
    this.presetCascade = { ...initialCascade };
    this.cascadeValue.set(initialCascade);
    this.code.set('');
    this.name.set('');
    this.leadUserId.set(null);
    this.resolvedSelectedLead.set(null);
    this.isActive.set(true);
    this.members.set([]);
    this.membersTotal.set(null);
    this.membersLoading.set(false);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    this.focusControl(initialCascade.departmentId ? `#${this.uid}-code` : undefined);

    if (initialCascade.departmentId && (!initialCascade.branchId || !initialCascade.companyId)) {
      void this.resolveChainFromDepartment(initialCascade.departmentId, seq);
    } else if (initialCascade.branchId && !initialCascade.companyId) {
      void this.resolveCompanyFromBranch(initialCascade.branchId, seq);
    }
  }

  openEdit(team: Team, parents?: { companyId?: string | null; branchId?: string | null }): void {
    const seq = ++this.openSeq;
    this.allowClose = false;
    this.closeLeadMenu();
    this.mode.set('edit');
    this.cascadeEditedByUser = false;
    this.baseTeam.set(team);
    this.applyTeamToForm(team, parents?.companyId ?? null, parents?.branchId ?? null);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    void this.loadDetails(team, seq);
  }

  editingId(): string | null {
    return this.baseTeam()?.id ?? null;
  }

  syncTeam(team: Team): void {
    if (this.editingId() !== team.id) return;
    this.baseTeam.set(team);
    const parents = this.cascadeValue();
    this.applyTeamToForm(team, parents.companyId, parents.branchId);
    this.resetValidation();
    this.resetIdempotency();
    if (team.leadUserId && this.canReadBranchUsers()) void this.resolveLeadUser(team.leadUserId, this.openSeq);
  }

  protected undo(): void {
    const base = this.baseTeam();
    if (!base || this.saving()) return;
    this.closeLeadMenu();
    this.syncTeam(base);
  }

  protected requestDelete(): void {
    const team = this.baseTeam();
    if (team && this.canManage() && !this.saving()) this.deleteRequested.emit(team);
  }

  closeImmediate(): void {
    this.closeLeadMenu();
    this.conflictOpen.set(false);
    this.allowClose = true;
    this.modal().close();
  }

  protected fullName(user: TenantUser): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  protected initials(user: TenantUser): string {
    const first = user.firstName.trim().charAt(0);
    const last = user.lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || '?';
  }

  protected onCascadeChange(next: OrgCascadeValue): void {
    const prev = this.cascadeValue();
    if (prev.branchId !== next.branchId) {
      this.closeLeadMenu();
      this.leadSearchSeq++;
      this.leadOptions.set([]);
      this.leadSearching.set(false);
      this.leadUserId.set(null);
      this.resolvedSelectedLead.set(null);
    }
    if (
      this.mode() === 'create' &&
      !this.cascadeEditedByUser &&
      this.code().trim() === '' &&
      this.name().trim() === '' &&
      this.leadUserId() === null &&
      ((prev.companyId === null && next.companyId !== null) ||
        (prev.branchId === null && next.branchId !== null) ||
        (prev.departmentId === null && next.departmentId !== null))
    ) {
      this.presetCascade = { ...next };
      this.cascadeValue.set(next);
      return;
    }
    this.cascadeEditedByUser = true;
    this.cascadeValue.set(next);
    this.leadServerError.set(null);
    this.departmentServerError.set(null);
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() !== 'create') return;
    const inputEl = event.target as HTMLInputElement;
    const upper = inputEl.value.toUpperCase();
    if (inputEl.value !== upper) {
      inputEl.value = upper;
    }
    this.code.set(upper);
    this.codeServerError.set(null);
  }

  protected onNameInput(event: Event): void {
    if (!this.canManage()) return;
    this.name.set((event.target as HTMLInputElement).value);
    this.nameServerError.set(null);
  }

  protected markTouched(field: 'code' | 'name'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected toggleLeadMenu(): void {
    if (!this.canSelectLead() || this.saving()) return;
    if (this.leadMenuOpen()) {
      this.closeLeadMenu();
      return;
    }
    const triggerEl = this.leadTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.leadMenuSeq;
    this.leadSearch.set('');
    this.leadMenuPlaced.set(false);
    this.leadMenuPlace.set(this.initialPlace(triggerEl));
    this.leadMenuOpen.set(true);
    void this.loadLeadOptions('');
    queueMicrotask(() => this.placeLeadMenu(seq));
    afterNextRender(
      () => {
        this.placeLeadMenu(seq);
        this.leadSearchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeLeadMenu(): void {
    this.leadMenuSeq++;
    this.leadMenuOpen.set(false);
    this.leadMenuPlaced.set(false);
  }

  protected closeLeadMenuIfOutside(event: Event): void {
    if (!this.leadMenuOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeLeadMenu();
      return;
    }
    if (
      this.leadTrigger()?.nativeElement.contains(target) ||
      this.leadMenuPanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closeLeadMenu();
  }

  protected onHostEscape(event: Event): void {
    if (!this.leadMenuOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeLeadMenu();
    this.leadTrigger()?.nativeElement.focus();
  }

  protected onLeadSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.leadSearch.set(term);
    if (this.leadSearchTimer !== null) {
      clearTimeout(this.leadSearchTimer);
      this.leadSearchTimer = null;
    }
    this.leadSearchTimer = setTimeout(() => {
      void this.loadLeadOptions(term);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onLeadMenuKeydown(event: KeyboardEvent): void {
    const panelEl = this.leadMenuPanel()?.nativeElement;
    if (!panelEl) return;
    const options = Array.from(panelEl.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length === 0) return;

    const currentIndex = options.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;
      options[next]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex <= 0) {
        this.leadSearchInput()?.nativeElement.focus();
      } else {
        options[currentIndex - 1]?.focus();
      }
    }
  }

  protected selectLead(user: TenantUser | null): void {
    if (!this.canSelectLead() || this.saving() || (user && (user.branchId !== this.cascadeValue().branchId || user.status !== 'ACTIVE'))) return;
    this.leadUserId.set(user?.id ?? null);
    this.resolvedSelectedLead.set(user);
    this.leadServerError.set(null);
    this.closeLeadMenu();
    this.leadTrigger()?.nativeElement.focus();
  }

  protected viewAllMembers(): void {
    const team = this.baseTeam();
    if (!team) return;
    this.closeImmediate();
    void this.router.navigate(['/workspace/staff/users'], {
      queryParams: { teamId: team.id },
    });
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving() || this.conflictOpen() || (this.mode() === 'edit' && !this.dirty())) return;
    this.submitAttempted.set(true);
    this.codeServerError.set(null);
    this.nameServerError.set(null);
    this.departmentServerError.set(null);
    this.leadServerError.set(null);
    const errors = this.cascadeErrors();
    if (errors.company || errors.branch || errors.department || this.codeError() || this.nameError()) return;

    const base = this.baseTeam();
    const { companyId, branchId, departmentId } = this.cascadeValue();
    const lead = this.leadUserId();
    if (lead && lead !== base?.leadUserId &&
        (!this.canSelectLead() || this.selectedLead()?.branchId !== branchId)) {
      this.leadServerError.set(staffErrorMessage('ORG_LEAD_BRANCH_REQUIRED', 'staff', this.transloco));
      return;
    }
    let body: CreateTeamBody | UpdateTeamBody;
    if (this.mode() === 'create') {
      const department = this.createDepartments().find((item) => item.id === departmentId && item.branchId === branchId);
      const branch = this.branchOptions().find((item) => item.id === branchId && item.companyId === companyId);
      if (!department || !branch) {
        this.notify.error(staffErrorMessage(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'), 'staff', this.transloco));
        return;
      }
      body = { departmentId: department.id, code: this.code().trim(), name: this.name().trim(),
        ...(lead ? { leadUserId: lead } : {}) };
    } else {
      if (!base) return;
      body = {};
      if (this.name().trim() !== base.name.trim()) body.name = this.name().trim();
      if (lead !== base.leadUserId) body.leadUserId = lead;
      const status = this.isActive() ? 'ACTIVE' : 'INACTIVE';
      if (status !== base.status) body.status = status;
    }
    this.saving.set(true);
    try {
      const key = this.idempotencyKeyFor(base?.id ?? 'create', body);
      const updated = base
        ? await this.writeApi.updateTeam(base.id, body, key)
        : await this.writeApi.createTeam(body as CreateTeamBody, key, branchId!);
      this.resetIdempotency();
      const toast = !base ? 'created' : Object.keys(body).length === 1 && 'status' in body
        ? body.status === 'ACTIVE' ? 'activated' : 'deactivated' : 'saved';
      this.notify.success(this.transloco.translate(`teams.toast.${toast}`));
      this.saved.emit(updated);
      this.closeImmediate();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    this.closeLeadMenu();
    if (this.canManage() && this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    this.closeLeadMenu();
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.openSeq++;
    this.leadSearchSeq++;
    this.membersSeq++;
    this.baseTeam.set(null);
    this.presetCascade = { ...EMPTY_CASCADE };
    this.cascadeEditedByUser = false;
    this.resolvedSelectedLead.set(null);
    this.members.set([]);
    this.membersTotal.set(null);
    this.resetValidation();
  }

  private handleSaveError(error: unknown): void {
    const code = errorCodeOf(error);
    const message = staffErrorMessage(error, 'staff', this.transloco, 'write');
    if (code === 'ORG_LEAD_USER_NOT_FOUND' || code === 'ORG_LEAD_BRANCH_REQUIRED') {
      this.leadServerError.set(message);
    } else if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(message);
    } else if (code === 'ORG_PARENT_INACTIVE') {
      const text = this.transloco.translate('teams.parentInactive');
      if (this.mode() === 'create') this.departmentServerError.set(text);
      else this.notify.error(text);
    } else if (code === 'ORG_NODE_NOT_EMPTY' && this.baseTeam() && !this.isActive()) {
      this.isActive.set(true);
      const blockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      this.deactivateBlocked.emit({ team: this.baseTeam()!, blockers: Array.isArray(blockers)
        ? blockers.filter((item): item is string => typeof item === 'string').slice(0, 1) : [] });
    } else if (code === 'ORG_LEAD_CHANGE_CONFLICT' || code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      this.conflictOpen.set(true);
    } else if (code === 'ORG_NODE_NOT_FOUND') {
      this.notify.error(message);
      this.closeImmediate();
      this.staleScopeDetected.emit();
    } else {
      const fields = fieldErrorsOf(error);
      this.nameServerError.set(fields['name']?.join(' ') || null);
      this.codeServerError.set(fields['code']?.join(' ') || null);
      this.leadServerError.set(fields['leadUserId']?.join(' ') || null);
      this.departmentServerError.set(fields['departmentId']?.join(' ') || null);
      if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
      else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
      else if (fields['_'] || !Object.keys(fields).length) this.notify.error(message);
    }
  }

  protected async reloadConflict(): Promise<void> {
    await this.resolveConflict(false);
  }

  protected async keepConflictChanges(): Promise<void> {
    await this.resolveConflict(true);
  }

  private async resolveConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const team = this.baseTeam();
    const seq = this.openSeq;
    this.saving.set(true);
    try {
      if (team) {
        const fresh = await this.organization.getTeam(team.id);
        if (seq !== this.openSeq) return;
        if (keepChanges) this.baseTeam.set(fresh);
        else this.syncTeam(fresh);
      } else if (!keepChanges) {
        this.openCreate(this.presetCascade);
      }
      this.resetIdempotency();
      if (!keepChanges) this.staleScopeDetected.emit();
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.notify.error(staffErrorMessage(error, 'staff', this.transloco));
      this.closeImmediate();
      this.staleScopeDetected.emit();
    } finally {
      this.saving.set(false);
    }
  }

  private async loadLeadOptions(search: string): Promise<void> {
    const seq = ++this.leadSearchSeq;
    const branchId = this.cascadeValue().branchId;
    if (!branchId || !this.canSelectLead()) {
      this.leadOptions.set([]);
      this.leadSearching.set(false);
      return;
    }
    const revision = this.session.scopeRevision();
    this.leadSearching.set(true);
    try {
      const page = await this.usersApi.listUsers({
        branchId,
        status: 'ACTIVE',
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 20,
      });
      if (seq !== this.leadSearchSeq) return;
      if (revision !== this.session.scopeRevision() || !this.canSelectLead()) return;
      this.leadOptions.set(page.data.filter((user) => user.branchId === branchId && user.status === 'ACTIVE'));
      if (this.leadMenuOpen()) {
        queueMicrotask(() => this.placeLeadMenu(this.leadMenuSeq));
      }
    } catch {
      if (seq !== this.leadSearchSeq) return;
      this.leadOptions.set([]);
    } finally {
      if (seq === this.leadSearchSeq) {
        this.leadSearching.set(false);
      }
    }
  }

  private async loadDetails(team: Team, seq: number): Promise<void> {
    const parents = this.cascadeValue();
    if (!parents.branchId || !parents.companyId) await this.resolveChainFromDepartment(team.departmentId, seq);
    if (seq !== this.openSeq || !this.canReadBranchUsers()) return;
    void this.loadMembers(team.id);
    if (team.leadUserId) void this.resolveLeadUser(team.leadUserId, seq);
  }

  private async resolveLeadUser(userId: string, seq: number): Promise<void> {
    const known =
      this.knownUsers().find((u) => u.id === userId) ??
      this.leadOptions().find((u) => u.id === userId);
    if (known) {
      this.resolvedSelectedLead.set(known);
      return;
    }
    try {
      const user = await this.usersApi.getUser(userId);
      if (seq !== this.openSeq || this.leadUserId() !== userId || !this.canReadBranchUsers()) return;
      this.resolvedSelectedLead.set(user);
    } catch {
      // Leave fallback if user cannot be loaded.
    }
  }

  private async loadMembers(teamId: string): Promise<void> {
    const seq = ++this.membersSeq;
    const revision = this.session.scopeRevision();
    this.members.set([]);
    this.membersTotal.set(null);
    this.membersLoading.set(true);
    try {
      const page = await this.usersApi.listUsers({ teamId, limit: 10 });
      if (seq !== this.membersSeq || revision !== this.session.scopeRevision()) return;
      this.membersTotal.set(page.meta.total);
      this.members.set(page.data);
    } catch {
      if (seq !== this.membersSeq) return;
      this.members.set([]);
      this.membersTotal.set(null);
    } finally {
      if (seq === this.membersSeq) {
        this.membersLoading.set(false);
      }
    }
  }

  private async resolveChainFromDepartment(departmentId: string, seq: number): Promise<void> {
    try {
      const dept = await this.organization.getDepartment(departmentId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const branch = await this.organization.getBranch(dept.branchId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const resolved: OrgCascadeValue = {
        companyId: branch.companyId,
        branchId: dept.branchId,
        departmentId,
        teamId: null,
      };
      this.presetCascade = { ...resolved };
      this.cascadeValue.set(resolved);
    } catch {
      // Fallback to OrgCascade or page lookups.
    }
  }

  private async resolveCompanyFromBranch(branchId: string, seq: number): Promise<void> {
    try {
      const branch = await this.organization.getBranch(branchId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const resolved: OrgCascadeValue = {
        companyId: branch.companyId,
        branchId,
        departmentId: null,
        teamId: null,
      };
      this.presetCascade = { ...resolved };
      this.cascadeValue.set(resolved);
    } catch {
      // Fallback to OrgCascade or page lookups.
    }
  }

  private applyTeamToForm(team: Team, companyId: string | null, branchId: string | null): void {
    this.cascadeValue.set({
      companyId,
      branchId,
      departmentId: team.departmentId,
      teamId: null,
    });
    this.code.set(team.code);
    this.name.set(team.name);
    this.leadUserId.set(team.leadUserId);
    this.resolvedSelectedLead.set(
      team.leadUserId ? (this.knownUsers().find((u) => u.id === team.leadUserId) ?? null) : null,
    );
    this.isActive.set(team.status === 'ACTIVE');
  }

  private initialPlace(triggerEl: HTMLElement): MenuPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeLeadMenu(seq: number): void {
    if (seq !== this.leadMenuSeq || !this.leadMenuOpen()) return;
    const triggerEl = this.leadTrigger()?.nativeElement;
    const panelEl = this.leadMenuPanel()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = panelRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? panelRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + panelRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - panelRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - panelRect.width));

    this.leadMenuPlace.set({ top, start, width: rect.width, maxHeight });
    this.leadMenuPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.style.minWidth = `${rect.width}px`;
    panelEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panelEl.classList.remove('invisible');
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.nameServerError.set(null);
    this.departmentServerError.set(null);
    this.codeServerError.set(null);
    this.leadServerError.set(null);
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(target: string, payload: CreateTeamBody | UpdateTeamBody): string {
    const signature = JSON.stringify({ target, payload });
    if (signature !== this.lastPayloadSignature) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private focusControl(selector?: string): void {
    if (!selector) return;
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
