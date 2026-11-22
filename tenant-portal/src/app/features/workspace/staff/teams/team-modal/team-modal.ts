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
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import {
  ApiError,
  createTeam,
  errorCodeOf,
  errorMessage,
  getBranch,
  getDepartment,
  getTeam,
  getUser,
  listMemberships,
  listUsers,
  newIdempotencyKey,
  updateTeam,
} from '../../shared/staff.api';
import {
  CODE_PATTERN,
  MembershipRole,
  OrgCascadeValue,
  OrgStatus,
  STAFF_LIMITS,
  Team,
  TenantUser,
} from '../../shared/staff.model';

interface TeamPatch {
  name?: string;
  leadUserId?: string | null;
  status?: OrgStatus;
}

interface TeamMemberItem {
  user: TenantUser;
  role: MembershipRole | null;
}

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
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal, OrgCascade, StatusBadge, Switch],
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
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly staleDialog = viewChild.required<ConfirmDialog>('staleDialog');
  private readonly leadTrigger = viewChild<ElementRef<HTMLButtonElement>>('leadTrigger');
  private readonly leadMenuPanel = viewChild<ElementRef<HTMLElement>>('leadMenuPanel');
  private readonly leadSearchInput = viewChild<ElementRef<HTMLInputElement>>('leadSearchInput');

  readonly canManage = input(true);
  readonly knownUsers = input<TenantUser[]>([]);
  readonly saved = output<{ team: Team; isNew: boolean }>();
  readonly deleteRequested = output<Team>();
  readonly deactivateBlocked = output<{ team: Team; blockers: string[] }>();
  readonly deletedRemotely = output<void>();
  readonly staleScopeDetected = output<void>();

  protected readonly limits = STAFF_LIMITS;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseTeam = signal<Team | null>(null);
  protected readonly saving = signal(false);

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
  protected readonly membersTotal = signal(0);
  protected readonly members = signal<TeamMemberItem[]>([]);

  protected readonly touched = signal<{ code?: boolean; name?: boolean }>({});
  protected readonly submitAttempted = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
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
    if (!id) return null;
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
    if (!lead) return this.transloco.translate('teams.fields.noLead');
    const name = this.fullName(lead);
    return lead.jobTitle ? `${name} — ${lead.jobTitle}` : name;
  });

  protected readonly dirty = computed(() => {
    if (!this.canManage()) return false;
    const trimmedCode = this.code().trim();
    const trimmedName = this.name().trim();

    if (this.mode() === 'create') {
      const current = this.cascadeValue();
      const cascadeChanged =
        this.cascadeEditedByUser &&
        (current.companyId !== this.presetCascade.companyId ||
          current.branchId !== this.presetCascade.branchId ||
          current.departmentId !== this.presetCascade.departmentId);
      return cascadeChanged || trimmedCode !== '' || trimmedName !== '' || this.leadUserId() !== null;
    }

    const base = this.baseTeam();
    if (!base) return false;
    return (
      trimmedName !== base.name ||
      this.leadUserId() !== base.leadUserId ||
      (this.isActive() ? 'ACTIVE' : 'INACTIVE') !== base.status
    );
  });

  protected readonly cascadeErrors = computed<{ company?: string; branch?: string; department?: string }>(() => {
    this.i18n();
    if (this.mode() !== 'create' || !this.submitAttempted()) return {};
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
    this.membersTotal.set(0);
    this.membersLoading.set(false);
    this.resetValidation();
    this.resetIdempotency();
    this.modal().open();
    this.focusControl(initialCascade.departmentId ? `#${this.uid}-code` : undefined);
    void this.loadLeadOptions('');

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
    if (this.canManage()) {
      this.focusControl(`#${this.uid}-name`);
    }
    void this.loadLeadOptions('');
    void this.loadMembers(team.id);

    if (team.leadUserId) {
      void this.resolveLeadUser(team.leadUserId, seq);
    }
    if (!parents?.branchId || !parents?.companyId) {
      void this.resolveChainFromDepartment(team.departmentId, seq);
    }
  }

  syncTeam(updated: Team, parents?: { companyId?: string | null; branchId?: string | null }): void {
    if (this.baseTeam()?.id !== updated.id) return;
    const companyId = parents?.companyId ?? this.cascadeValue().companyId;
    const branchId = parents?.branchId ?? this.cascadeValue().branchId;
    this.baseTeam.set(updated);
    this.applyTeamToForm(updated, companyId, branchId);
    this.resetValidation();
    if (updated.leadUserId) {
      void this.resolveLeadUser(updated.leadUserId, this.openSeq);
    }
    void this.loadMembers(updated.id);
  }

  closeImmediate(): void {
    this.closeLeadMenu();
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.baseTeam()?.id ?? null;
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
  }

  protected markTouched(field: 'code' | 'name'): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected toggleLeadMenu(): void {
    if (!this.canManage() || this.saving()) return;
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
    if (!this.canManage()) return;
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

  protected undo(): void {
    const base = this.baseTeam();
    if (!base) return;
    this.applyTeamToForm(base, this.cascadeValue().companyId, this.cascadeValue().branchId);
    this.resetValidation();
    if (base.leadUserId) {
      void this.resolveLeadUser(base.leadUserId, this.openSeq);
    }
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canManage() || this.saving()) return;

    this.submitAttempted.set(true);
    this.codeServerError.set(null);
    this.leadServerError.set(null);

    const cascadeErrs = this.cascadeErrors();
    if (cascadeErrs.company || cascadeErrs.branch || cascadeErrs.department || this.codeError() || this.nameError()) {
      return;
    }

    const trimmedName = this.name().trim();

    if (this.mode() === 'create') {
      const departmentId = this.cascadeValue().departmentId;
      if (!departmentId) return;

      const body: {
        departmentId: string;
        code: string;
        name: string;
        leadUserId?: string | null;
      } = {
        departmentId,
        code: this.code().trim(),
        name: trimmedName,
      };
      if (this.leadUserId() !== null) {
        body.leadUserId = this.leadUserId();
      }

      this.saving.set(true);
      try {
        const created = await createTeam(body, this.idempotencyKeyFor('create', body));
        this.saved.emit({ team: created, isNew: true });
        this.notify.success(this.transloco.translate('teams.toast.created'));
        this.closeImmediate();
      } catch (error) {
        await this.handleSaveError(error, false);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const base = this.baseTeam();
    if (!base) return;

    const patch: TeamPatch = {};
    if (trimmedName !== base.name) patch.name = trimmedName;
    if (this.leadUserId() !== base.leadUserId) patch.leadUserId = this.leadUserId();
    const nextStatus: OrgStatus = this.isActive() ? 'ACTIVE' : 'INACTIVE';
    const isDeactivating = base.status === 'ACTIVE' && nextStatus === 'INACTIVE';
    const isActivating = base.status === 'INACTIVE' && nextStatus === 'ACTIVE';
    if (nextStatus !== base.status) patch.status = nextStatus;

    if (Object.keys(patch).length === 0) return;

    this.saving.set(true);
    try {
      const updated = await updateTeam(base.id, patch, this.idempotencyKeyFor(base.id, patch));
      this.saved.emit({ team: updated, isNew: false });
      this.notify.success(this.transloco.translate('teams.toast.saved'));
      this.closeImmediate();
    } catch (error) {
      await this.handleSaveError(error, isDeactivating, isActivating, base);
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

  protected requestDelete(): void {
    const base = this.baseTeam();
    if (!base || !this.canManage() || this.saving()) return;
    this.deleteRequested.emit(base);
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
    this.baseTeam.set(null);
    this.presetCascade = { ...EMPTY_CASCADE };
    this.cascadeEditedByUser = false;
    this.resolvedSelectedLead.set(null);
    this.members.set([]);
    this.membersTotal.set(0);
    this.resetValidation();
  }

  private async handleSaveError(
    error: unknown,
    isDeactivating: boolean,
    isActivating = false,
    base?: Team,
  ): Promise<void> {
    const code = errorCodeOf(error);
    if (code === 'ORG_CODE_TAKEN') {
      this.codeServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_BRANCH_SCOPE_STALE' || code === 'ORG_NODE_SCOPE_STALE') {
      if (await this.staleDialog().open()) {
        this.staleScopeDetected.emit();
        if (base) {
          try {
            const fresh = await getTeam(base.id);
            this.syncTeam(fresh);
          } catch (reloadError) {
            this.notify.error(this.resolveError(reloadError));
            this.closeImmediate();
          }
        }
      }
      return;
    }
    if (code === 'ORG_LEAD_BRANCH_REQUIRED' || code === 'ORG_LEAD_USER_NOT_FOUND') {
      this.leadServerError.set(this.resolveError(error));
      return;
    }
    if (code === 'ORG_LEAD_CHANGE_CONFLICT') {
      this.notify.error(this.transloco.translate('teams.retryLater'));
      return;
    }
    if (code === 'ORG_PARENT_INACTIVE') {
      if (isActivating) {
        this.isActive.set(false);
      }
      this.notify.error(this.resolveError(error));
      return;
    }
    if (code === 'ORG_NODE_NOT_EMPTY' && isDeactivating && base) {
      this.isActive.set(true);
      const rawBlockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      const blockers = Array.isArray(rawBlockers) ? rawBlockers.map(String) : [];
      this.deactivateBlocked.emit({ team: base, blockers });
      return;
    }
    this.notify.error(this.resolveError(error));
    if (code === 'ORG_NODE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
      this.deletedRemotely.emit();
      this.closeImmediate();
    }
  }

  private async loadLeadOptions(search: string): Promise<void> {
    const seq = ++this.leadSearchSeq;
    this.leadSearching.set(true);
    try {
      const page = await listUsers({
        status: 'ACTIVE',
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 20,
      });
      if (seq !== this.leadSearchSeq) return;
      this.leadOptions.set(page.data);
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

  private async resolveLeadUser(userId: string, seq: number): Promise<void> {
    const known =
      this.knownUsers().find((u) => u.id === userId) ??
      this.leadOptions().find((u) => u.id === userId);
    if (known) {
      this.resolvedSelectedLead.set(known);
      return;
    }
    try {
      const user = await getUser(userId);
      if (seq !== this.openSeq) return;
      this.resolvedSelectedLead.set(user);
    } catch {
      // Leave fallback if user cannot be loaded.
    }
  }

  private async loadMembers(teamId: string): Promise<void> {
    const seq = ++this.membersSeq;
    this.membersLoading.set(true);
    try {
      const page = await listUsers({ teamId, limit: 10 });
      if (seq !== this.membersSeq) return;
      this.membersTotal.set(page.meta.total);
      const membershipResults = await Promise.allSettled(page.data.map((user) => listMemberships(user.id)));
      if (seq !== this.membersSeq) return;
      const items: TeamMemberItem[] = page.data.map((user, index) => {
        const res = membershipResults[index];
        if (res.status === 'fulfilled') {
          const match = res.value.find((m) => m.teamId === teamId);
          return { user, role: match?.role ?? null };
        }
        return { user, role: null };
      });
      this.members.set(items);
    } catch {
      if (seq !== this.membersSeq) return;
      this.members.set([]);
      this.membersTotal.set(0);
    } finally {
      if (seq === this.membersSeq) {
        this.membersLoading.set(false);
      }
    }
  }

  private async resolveChainFromDepartment(departmentId: string, seq: number): Promise<void> {
    try {
      const dept = await getDepartment(departmentId);
      if (seq !== this.openSeq || this.cascadeEditedByUser) return;
      const branch = await getBranch(dept.branchId);
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
      const branch = await getBranch(branchId);
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
    this.codeServerError.set(null);
    this.leadServerError.set(null);
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(target: string, payload: unknown): string {
    const signature = `${target}:${JSON.stringify(payload)}`;
    if (signature !== this.lastPayloadSignature) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private resolveError(error: unknown): string {
    const msg = errorMessage(error, 'staff', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('staff.errors.generic');
    return fallback !== 'staff.errors.generic' ? fallback : msg;
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
