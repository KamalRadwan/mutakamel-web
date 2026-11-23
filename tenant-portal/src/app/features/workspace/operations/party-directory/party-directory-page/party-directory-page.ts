import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowDown,
  tablerArrowUp,
  tablerArrowsSort,
  tablerBuilding,
  tablerChevronDown,
  tablerCloudOff,
  tablerEdit,
  tablerEye,
  tablerFilter,
  tablerLock,
  tablerPlus,
  tablerSearch,
  tablerTrash,
  tablerUser,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { PhoneActions, PhoneActionSource } from '../../../../../shared/widgets/phone-actions/phone-actions';
import { StaffSession } from '../../../staff/shared/staff-session';
import { SessionFailedState } from '../../shared/session-failed-state/session-failed-state';
import {
  ApiError,
  errorCodeOf,
  errorMessage,
  listAllPages,
  listBranches,
  listUsers,
} from '../../../staff/shared/staff.api';
import { Branch, TenantUser } from '../../../staff/shared/staff.model';
import { deleteParty, listParties, partyImageSrc, updateParty } from '../party-directory.api';
import {
  PARTY_ROLE_TYPES,
  PARTY_STATUSES,
  PARTY_TYPES,
  PartyListItem,
  PartyListRole,
  PartyRoleType,
  PartySortBy,
  PartyStatus,
  PartyType,
  SortDir,
} from '../party-directory.model';
import { PartyModal } from '../party-modal/party-modal';
import { correlationIdOf } from '../../../../../core/api/api-errors';

type FilterChipKey = 'type' | 'status' | 'role' | 'branch' | 'owner';

interface ActiveFilterChip {
  key: FilterChipKey;
  label: string;
  valueLabel: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

const AVATAR_TONES = [
  'bg-icon-blue',
  'bg-icon-navy',
  'bg-icon-teal',
  'bg-icon-green',
  'bg-icon-orange',
  'bg-icon-red',
  'bg-icon-violet',
  'bg-icon-gray',
] as const;

function parsePage(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-party-directory-page',
  imports: [
    SessionFailedState,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Pagination,
    PartyModal,
    PhoneActions,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArrowDown,
      tablerArrowUp,
      tablerArrowsSort,
      tablerBuilding,
      tablerChevronDown,
      tablerCloudOff,
      tablerEdit,
      tablerEye,
      tablerFilter,
      tablerLock,
      tablerPlus,
      tablerSearch,
      tablerTrash,
      tablerUser,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './party-directory-page.html',
  host: {
    class: 'flex flex-1 shrink-0 flex-col gap-8 p-12',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeNewMenu()',
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class PartyDirectoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);

  protected readonly sessionFailed = computed(() => !this.session.me() && this.session.state() === 'failed');
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly partyModal = viewChild(PartyModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly inUseDialog = viewChild.required<Modal>('inUseDialog');
  private readonly newMenuPanel = viewChild<ElementRef<HTMLElement>>('newMenuPanel');
  private readonly newMenuRows = viewChildren<ElementRef<HTMLButtonElement>>('newMenuRow');

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly searchDraft = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(parsePage(this.route.snapshot.queryParamMap.get('page')));
  protected readonly pageSize = signal(parsePageSize(this.route.snapshot.queryParamMap.get('size')));
  protected readonly sortBy = signal<PartySortBy>('displayName');
  protected readonly sortDir = signal<SortDir>('ASC');

  protected readonly filtersOpen = signal(false);
  protected readonly typeFilter = signal<'ALL' | PartyType>('ALL');
  protected readonly statusFilter = signal<'ALL' | PartyStatus>('ALL');
  protected readonly roleFilter = signal<'ALL' | PartyRoleType>('ALL');
  // Core's party list has no shared-only filter (PartyQueryDto): ALL or one branch id.
  protected readonly branchFilter = signal<'ALL' | string>('ALL');
  protected readonly ownerFilter = signal<'ALL' | string>('ALL');

  protected readonly rows = signal<PartyListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly errorCorrelationId = signal<string | null>(null);

  protected readonly branches = signal<Branch[]>([]);
  protected readonly users = signal<TenantUser[]>([]);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly brokenImageIds = signal<ReadonlySet<string>>(new Set());

  protected readonly pendingDeleteParty = signal<PartyListItem | null>(null);
  protected readonly pendingInUseParty = signal<PartyListItem | null>(null);
  protected readonly settingInactive = signal(false);

  protected readonly newMenuOpen = signal(false);
  protected readonly newMenuPlaced = signal(false);
  protected readonly newMenuSource = signal<'toolbar' | 'empty'>('toolbar');
  protected readonly newMenuPlace = signal({ top: 0, start: 0 });

  private newMenuTriggerEl: HTMLElement | null = null;
  private newMenuSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkId = '';

  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));
  private readonly userMap = computed(() => new Map(this.users().map((u) => [u.id, u])));

  protected readonly canRead = computed(
    () =>
      // Until the session has loaded (or if loading failed) do not show the 403 state; the API decides.
      !this.session.me() ||
      this.session.isTenantWide('directory.party.read') ||
      this.session.can('directory.party.read') ||
      this.branches().some((b) => this.session.can('directory.party.read', { branchId: b.id })),
  );

  protected readonly canManageAny = computed(
    () =>
      this.session.isTenantWide('directory.party.manage') ||
      this.session.can('directory.party.manage') ||
      this.branches().some((b) => this.session.can('directory.party.manage', { branchId: b.id })),
  );

  protected readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.typeFilter() !== 'ALL') count++;
    if (this.statusFilter() !== 'ALL') count++;
    if (this.roleFilter() !== 'ALL') count++;
    if (this.branchFilter() !== 'ALL') count++;
    if (this.ownerFilter() !== 'ALL') count++;
    return count;
  });

  protected readonly hasActiveQuery = computed(
    () => this.search().trim().length > 0 || this.activeFilterCount() > 0,
  );

  protected readonly isFirstUseEmpty = computed(
    () =>
      !this.loading() &&
      !this.loadFailed() &&
      !this.forbidden() &&
      this.canRead() &&
      this.rows().length === 0 &&
      !this.hasActiveQuery(),
  );

  protected readonly isFilteredEmpty = computed(
    () =>
      !this.loading() &&
      !this.loadFailed() &&
      !this.forbidden() &&
      this.canRead() &&
      this.rows().length === 0 &&
      this.hasActiveQuery(),
  );

  protected readonly typeOptions = computed<DropdownOption<'ALL' | PartyType>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsParty.filters.all') },
      ...PARTY_TYPES.map((type) => ({
        value: type,
        label: this.transloco.translate(`wsParty.types.${type}`),
      })),
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<'ALL' | PartyStatus>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsParty.filters.all') },
      ...PARTY_STATUSES.map((status) => ({
        value: status,
        label: this.transloco.translate(`wsParty.status.${status}`),
      })),
    ];
  });

  protected readonly roleOptions = computed<DropdownOption<'ALL' | PartyRoleType>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsParty.filters.all') },
      ...PARTY_ROLE_TYPES.map((role) => ({
        value: role,
        label: this.transloco.translate(`wsParty.roles.${role}`),
      })),
    ];
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsParty.filters.all') },
      ...this.branches().map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ];
  });

  protected readonly ownerOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('wsParty.filters.all') },
      ...this.users().map((user) => ({
        value: user.id,
        label: this.userFullName(user),
      })),
    ];
  });

  protected readonly activeFilterChips = computed<ActiveFilterChip[]>(() => {
    this.i18n();
    const chips: ActiveFilterChip[] = [];

    const type = this.typeFilter();
    if (type !== 'ALL') {
      chips.push({
        key: 'type',
        label: this.transloco.translate('wsParty.filters.type'),
        valueLabel: this.transloco.translate(`wsParty.types.${type}`),
      });
    }

    const status = this.statusFilter();
    if (status !== 'ALL') {
      chips.push({
        key: 'status',
        label: this.transloco.translate('wsParty.filters.status'),
        valueLabel: this.transloco.translate(`wsParty.status.${status}`),
      });
    }

    const role = this.roleFilter();
    if (role !== 'ALL') {
      chips.push({
        key: 'role',
        label: this.transloco.translate('wsParty.filters.role'),
        valueLabel: this.transloco.translate(`wsParty.roles.${role}`),
      });
    }

    const branch = this.branchFilter();
    if (branch !== 'ALL') {
      chips.push({
        key: 'branch',
        label: this.transloco.translate('wsParty.filters.branch'),
        valueLabel: this.branchMap().get(branch)?.name ?? branch,
      });
    }

    const owner = this.ownerFilter();
    if (owner !== 'ALL') {
      const user = this.userMap().get(owner);
      chips.push({
        key: 'owner',
        label: this.transloco.translate('wsParty.filters.owner'),
        valueLabel: user ? this.userFullName(user) : owner,
      });
    }

    return chips;
  });

  protected retrySession(): void {
    void this.session.load().catch(() => undefined);
  }

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }
    void this.loadLookups();

    const onCaptureScroll = () => this.closeNewMenu();
    document.addEventListener('scroll', onCaptureScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onCaptureScroll, { capture: true });
      this.clearSearchTimer();
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;
      const nextPage = parsePage(params.get('page'));
      const nextSize = parsePageSize(params.get('size'));
      untracked(() => {
        if (nextPage !== this.page()) this.page.set(nextPage);
        if (nextSize !== this.pageSize()) this.pageSize.set(nextSize);
      });
    });

    effect(() => {
      const me = this.session.me();
      if (!me || !this.canRead()) return;

      const search = this.search().trim();
      const partyType = this.typeFilter();
      const status = this.statusFilter();
      const roleType = this.roleFilter();
      const branch = this.branchFilter();
      const owner = this.ownerFilter();
      const sortBy = this.sortBy();
      const sortDir = this.sortDir();
      const page = this.page();
      const pageSize = this.pageSize();

      const signature = `${search}|${partyType}|${status}|${roleType}|${branch}|${owner}|${sortBy}|${sortDir}`;
      const criteriaChanged = this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== signature;
      this.prevCriteriaSignature = signature;

      if (criteriaChanged && page !== DEFAULT_PAGE) {
        untracked(() => this.setPage(DEFAULT_PAGE, true));
        return;
      }

      void untracked(() =>
        this.loadList({
          search,
          partyType,
          status,
          roleType,
          branch,
          owner,
          sortBy,
          sortDir,
          page,
          pageSize,
        }),
      );
    });

    effect(() => {
      const params = this.queryParams();
      const modal = this.partyModal();
      const me = this.session.me();
      if (!params || !modal || !me || !this.canRead()) return;

      const deepLinkId = params.get('party')?.trim() ?? '';
      if (!deepLinkId) {
        this.handledDeepLinkId = '';
        return;
      }
      if (deepLinkId === this.handledDeepLinkId) return;
      this.handledDeepLinkId = deepLinkId;

      untracked(() => {
        modal.openParty(deepLinkId);
        this.clearQueryParams(['party']);
      });
    });
  }

  protected reload(): void {
    void this.loadLookups();
    if (!this.canRead()) return;
    void this.loadList({
      search: this.search().trim(),
      partyType: this.typeFilter(),
      status: this.statusFilter(),
      roleType: this.roleFilter(),
      branch: this.branchFilter(),
      owner: this.ownerFilter(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected onSearchInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.searchDraft.set(next);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      if (this.search() !== next) {
        this.search.set(next);
        this.setPage(DEFAULT_PAGE, true);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  protected commitSearchNow(): void {
    this.clearSearchTimer();
    const next = this.searchDraft();
    if (this.search() !== next) {
      this.search.set(next);
      this.setPage(DEFAULT_PAGE, true);
    }
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.searchDraft.set('');
    if (this.search() !== '') {
      this.search.set('');
      this.setPage(DEFAULT_PAGE, true);
    }
  }

  protected setTypeFilter(value: 'ALL' | PartyType): void {
    if (value === this.typeFilter()) return;
    this.typeFilter.set(value);
    this.setPage(DEFAULT_PAGE, true);
  }

  protected setStatusFilter(value: 'ALL' | PartyStatus): void {
    if (value === this.statusFilter()) return;
    this.statusFilter.set(value);
    this.setPage(DEFAULT_PAGE, true);
  }

  protected setRoleFilter(value: 'ALL' | PartyRoleType): void {
    if (value === this.roleFilter()) return;
    this.roleFilter.set(value);
    this.setPage(DEFAULT_PAGE, true);
  }

  protected setBranchFilter(value: string): void {
    if (value === this.branchFilter()) return;
    this.branchFilter.set(value);
    this.setPage(DEFAULT_PAGE, true);
  }

  protected setOwnerFilter(value: string): void {
    if (value === this.ownerFilter()) return;
    this.ownerFilter.set(value);
    this.setPage(DEFAULT_PAGE, true);
  }

  protected removeChip(key: FilterChipKey): void {
    switch (key) {
      case 'type':
        this.setTypeFilter('ALL');
        break;
      case 'status':
        this.setStatusFilter('ALL');
        break;
      case 'role':
        this.setRoleFilter('ALL');
        break;
      case 'branch':
        this.setBranchFilter('ALL');
        break;
      case 'owner':
        this.setOwnerFilter('ALL');
        break;
    }
  }

  protected clearAllFilters(): void {
    this.typeFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.roleFilter.set('ALL');
    this.branchFilter.set('ALL');
    this.ownerFilter.set('ALL');
    this.setPage(DEFAULT_PAGE, true);
  }

  protected clearAllFiltersAndSearch(): void {
    this.clearSearchTimer();
    this.searchDraft.set('');
    this.search.set('');
    this.clearAllFilters();
  }

  protected toggleSort(field: PartySortBy): void {
    if (this.sortBy() === field) {
      this.sortDir.update((dir) => (dir === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      this.sortBy.set(field);
      this.sortDir.set(field === 'displayName' ? 'ASC' : 'DESC');
    }
    this.setPage(DEFAULT_PAGE, true);
  }

  protected ariaSortFor(field: PartySortBy): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== field) return 'none';
    return this.sortDir() === 'ASC' ? 'ascending' : 'descending';
  }

  protected sortIconFor(field: PartySortBy): string {
    if (this.sortBy() !== field) return 'tablerArrowsSort';
    return this.sortDir() === 'ASC' ? 'tablerArrowUp' : 'tablerArrowDown';
  }

  protected setPage(nextPage: number, replaceUrl = false): void {
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped !== this.page()) {
      this.page.set(clamped);
    }
    this.syncPaginationParams(clamped, this.pageSize(), replaceUrl);
  }

  protected setPageSize(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(DEFAULT_PAGE);
    this.syncPaginationParams(DEFAULT_PAGE, nextSize, false);
  }

  protected toggleNewMenu(event: Event, triggerEl: HTMLElement, source: 'toolbar' | 'empty'): void {
    event.stopPropagation();
    if (!this.canManageAny()) return;
    if (this.newMenuOpen() && this.newMenuSource() === source) {
      this.closeNewMenu();
      return;
    }

    this.newMenuTriggerEl = triggerEl;
    this.newMenuSource.set(source);
    const seq = ++this.newMenuSeq;
    this.newMenuPlaced.set(false);
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(triggerEl).direction === 'rtl';
    this.newMenuPlace.set({
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
    });
    this.newMenuOpen.set(true);

    const place = () => this.placeNewMenu(seq, triggerEl);
    queueMicrotask(place);
    afterNextRender(place, { injector: this.injector });
  }

  protected closeNewMenu(): void {
    if (!this.newMenuOpen()) return;
    this.newMenuSeq++;
    this.newMenuOpen.set(false);
    this.newMenuPlaced.set(false);
  }

  protected onDocumentClick(event: Event): void {
    if (!this.newMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const panel = this.newMenuPanel()?.nativeElement;
    if (panel?.contains(target) || this.newMenuTriggerEl?.contains(target)) {
      return;
    }
    this.closeNewMenu();
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (!this.newMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const trigger = this.newMenuTriggerEl;
      this.closeNewMenu();
      trigger?.focus();
      return;
    }

    if (event.key === 'Tab') {
      this.closeNewMenu();
      return;
    }

    const rows = this.newMenuRows();
    const index = rows.findIndex((row) => row.nativeElement === target);
    if (index < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      rows[(index + 1) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      rows[(index - 1 + rows.length) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      rows[0]?.nativeElement.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      rows[rows.length - 1]?.nativeElement.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const type: PartyType = index === 1 ? 'ORGANIZATION' : 'PERSON';
      this.chooseNewParty(type);
    }
  }

  protected chooseNewParty(type: PartyType): void {
    this.closeNewMenu();
    if (!this.canManageAny()) return;
    this.partyModal()?.openNew(type);
  }

  protected openParty(id: string): void {
    this.partyModal()?.openParty(id);
  }

  protected onRowKeydown(event: KeyboardEvent, party: PartyListItem): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openParty(party.id);
    }
  }

  protected partyAvatarSrc(party: PartyListItem): string | null {
    if (this.brokenImageIds().has(party.id)) return null;
    return partyImageSrc(party);
  }

  protected onImageError(partyId: string): void {
    this.brokenImageIds.update((current) => {
      if (current.has(partyId)) return current;
      const next = new Set(current);
      next.add(partyId);
      return next;
    });
  }

  protected partyInitials(party: PartyListItem): string {
    const words = party.displayName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
    }
    return party.displayName.trim().slice(0, 2).toUpperCase() || '?';
  }

  protected preferredPhone(party: PartyListItem): string | null {
    const mobile = party.contactMethods.find((cm) => cm.methodType === 'MOBILE');
    if (mobile) return mobile.value;
    const phone = party.contactMethods.find((cm) => cm.methodType === 'PHONE');
    return phone?.value ?? null;
  }

  protected phoneSource(party: PartyListItem): PhoneActionSource {
    return { type: 'PARTY', id: party.id, label: party.displayName };
  }

  protected preferredEmail(party: PartyListItem): string | null {
    return party.contactMethods.find((cm) => cm.methodType === 'EMAIL')?.value ?? null;
  }

  protected visibleRoles(party: PartyListItem): PartyListRole[] {
    return party.roles.slice(0, 2);
  }

  protected extraRoleCount(party: PartyListItem): number {
    return Math.max(0, party.roles.length - 2);
  }

  protected extraRolesTitle(party: PartyListItem): string {
    return party.roles
      .slice(2)
      .map((r) => this.transloco.translate(`wsParty.roles.${r.roleType}`))
      .join(', ');
  }

  protected isAppManaged(role: PartyListRole): boolean {
    return role.appSource !== null && role.appSource !== 'core-app';
  }

  protected roleManagedTitle(role: PartyListRole): string | null {
    if (!this.isAppManaged(role)) return null;
    return this.transloco.translate(
      role.appSource === 'crm-app' ? 'wsParty.managedByCrm' : 'wsParty.managedByApp',
    );
  }

  protected branchName(branchId: string | null): string {
    if (branchId === null) {
      return this.transloco.translate('wsParty.shared');
    }
    return this.branchMap().get(branchId)?.name ?? '—';
  }

  protected ownerFor(party: PartyListItem): TenantUser | null {
    if (!party.ownerUserId) return null;
    return this.userMap().get(party.ownerUserId) ?? null;
  }

  protected userFullName(user: TenantUser): string {
    const full = `${user.firstName} ${user.lastName}`.trim();
    return full || user.email;
  }

  protected userInitials(user: TenantUser): string {
    const first = user.firstName.trim().charAt(0);
    const last = user.lastName.trim().charAt(0);
    const combined = `${first}${last}`.toUpperCase();
    return combined || user.email.trim().charAt(0).toUpperCase() || '?';
  }

  protected ownerAvatarTone(user: TenantUser): string {
    const name = this.userFullName(user);
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return AVATAR_TONES[hash % AVATAR_TONES.length];
  }

  protected statusBadgeClass(status: PartyStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success text-on-success';
      case 'BLOCKED':
        return 'bg-danger text-on-danger';
      case 'INACTIVE':
        return 'bg-neutral-soft text-text-muted';
    }
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected actionsFor(party: PartyListItem): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('wsParty.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canManageAny()) {
      const allowed = this.canManageParty(party);
      const busy = this.busyIds().has(party.id);
      const disabledReason = !allowed
        ? t(party.branchId === null ? 'wsParty.actions.noPermissionShared' : 'wsParty.actions.noPermissionBranch')
        : undefined;

      items.push(
        {
          id: 'edit',
          title: t('wsParty.actions.edit'),
          icon: 'tablerEdit',
          tile: 'bg-icon-orange',
        },
        {
          id: 'delete',
          title: t('wsParty.actions.delete'),
          icon: 'tablerTrash',
          tile: !allowed || busy ? 'bg-icon-gray' : 'bg-icon-red',
          danger: true,
          disabled: !allowed || busy,
          reason: disabledReason,
        },
      );
    }

    return items;
  }

  protected onRowAction(party: PartyListItem, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openParty(party.id);
        break;
      case 'delete':
        if (this.canManageParty(party)) {
          void this.requestDelete(party);
        }
        break;
    }
  }

  protected async requestDelete(party: PartyListItem): Promise<void> {
    if (!this.canManageParty(party) || this.busyIds().has(party.id)) return;
    this.pendingDeleteParty.set(party);
    const confirmed = await this.deleteConfirm().open();
    if (!confirmed) {
      this.pendingDeleteParty.set(null);
      return;
    }

    this.setBusy(party.id, true);
    try {
      await deleteParty(party.id);
      this.notify.success(this.transloco.translate('wsParty.toast.deleted'));
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'DIRECTORY_PARTY_IN_USE') {
        this.pendingInUseParty.set(party);
        this.inUseDialog().open();
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(party.id, false);
      this.pendingDeleteParty.set(null);
    }
  }

  protected async confirmSetInactive(): Promise<void> {
    const party = this.pendingInUseParty();
    if (!party || this.settingInactive()) return;
    this.settingInactive.set(true);
    try {
      await updateParty(party.id, { status: 'INACTIVE' });
      this.inUseDialog().close();
      this.notify.success(this.transloco.translate('wsParty.toast.setInactive'));
      this.reload();
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.settingInactive.set(false);
    }
  }

  protected onInUseDialogClosed(): void {
    this.pendingInUseParty.set(null);
    this.settingInactive.set(false);
  }

  private canManageParty(party: PartyListItem): boolean {
    if (party.branchId === null) {
      return this.session.isTenantWide('directory.party.manage');
    }
    return this.session.can('directory.party.manage', { branchId: party.branchId });
  }

  private placeNewMenu(seq: number, triggerEl: HTMLElement): void {
    if (seq !== this.newMenuSeq || !this.newMenuOpen() || this.newMenuPlaced()) return;
    const panelEl = this.newMenuPanel()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(triggerEl).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top = belowTop + panelRect.height > height - 8 ? Math.max(8, rect.top - 4 - panelRect.height) : belowTop;
    const rawStart = rtl ? width - rect.right : rect.left;
    const maxStart = Math.max(8, width - 8 - panelRect.width);
    const start = Math.min(Math.max(8, rawStart), maxStart);

    this.newMenuPlace.set({ top, start });
    this.newMenuPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.classList.remove('invisible');

    this.newMenuRows()[0]?.nativeElement.focus();
  }

  private async loadLookups(): Promise<void> {
    const [branchesRes, usersRes] = await Promise.allSettled([
      listAllPages(listBranches, { limit: 100 }),
      listAllPages(listUsers, { limit: 100 }),
    ]);
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    if (usersRes.status === 'fulfilled') {
      this.users.set(usersRes.value);
    }
  }

  private async loadList(params: {
    search: string;
    partyType: 'ALL' | PartyType;
    status: 'ALL' | PartyStatus;
    roleType: 'ALL' | PartyRoleType;
    branch: string;
    owner: string;
    sortBy: PartySortBy;
    sortDir: SortDir;
    page: number;
    pageSize: number;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.forbidden.set(false);
    this.errorCorrelationId.set(null);

    try {
      const baseQuery = {
        sortBy: params.sortBy,
        sortDir: params.sortDir,
        ...(params.search ? { search: params.search } : {}),
        ...(params.partyType !== 'ALL' ? { partyType: params.partyType } : {}),
        ...(params.status !== 'ALL' ? { status: params.status } : {}),
        ...(params.roleType !== 'ALL' ? { roleType: params.roleType } : {}),
        ...(params.owner !== 'ALL' ? { ownerUserId: params.owner } : {}),
      };

      const result = await listParties({
        ...baseQuery,
        ...(params.branch !== 'ALL' ? { branchId: params.branch } : {}),
        page: params.page,
        limit: params.pageSize,
      });
      if (seq !== this.loadSeq) return;
      this.rows.set(result.data);
      this.total.set(result.meta.total);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 403) {
        this.forbidden.set(true);
        this.rows.set([]);
        this.total.set(0);
        return;
      }
      this.loadFailed.set(true);
      this.errorCorrelationId.set(this.extractCorrelationId(error));
      this.rows.set([]);
      this.total.set(0);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private syncPaginationParams(page: number, pageSize: number, replaceUrl: boolean): void {
    const currentPageParam = parsePage(this.route.snapshot.queryParamMap.get('page'));
    const currentSizeParam = parsePageSize(this.route.snapshot.queryParamMap.get('size'));
    if (currentPageParam === page && currentSizeParam === pageSize) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: page === DEFAULT_PAGE ? null : page,
        size: pageSize === DEFAULT_PAGE_SIZE ? null : pageSize,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private clearQueryParams(keys: string[]): void {
    const clear: Record<string, null> = {};
    for (const key of keys) clear[key] = null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clear,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private extractCorrelationId(error: unknown): string | null {
    return correlationIdOf(error);
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private resolveError(error: unknown): string {
    const msg = errorMessage(error, 'wsParty', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('wsParty.errors.generic');
    return fallback !== 'wsParty.errors.generic' ? fallback : msg;
  }
}
