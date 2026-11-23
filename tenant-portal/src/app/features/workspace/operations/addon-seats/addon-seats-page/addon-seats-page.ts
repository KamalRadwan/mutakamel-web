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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerApps,
  tablerArmchair,
  tablerCalculator,
  tablerCheck,
  tablerChevronDown,
  tablerLoader2,
  tablerLock,
  tablerRefresh,
  tablerSearch,
  tablerShoppingCart,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { moduleTileOf, seatInitials } from '../../../seats/seats.model';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { ApiError, correlationIdOf, errorCodeOf, errorMessage, isRetryableWriteError,
  writeErrorMessage } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceApp, WorkspaceUser } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { AddonSeatsApi } from '../addon-seats.api';
import {
  AddonAssignment,
  AddonOption,
  AddonPageMeta,
} from '../addon-seats.model';

interface PickerPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

interface RemoveTarget {
  assignmentId: string;
  assignmentRevision: string;
  allowanceRevision: string;
  addonKey: string;
  applicationKey: string;
}

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

const PAGE_SIZES = [20, 50, 100];
const OPTIONS_SKELETON_ROWS = [1, 2, 3, 4] as const;
const ASSIGNMENTS_SKELETON_ROWS = [1, 2, 3] as const;
const SEARCH_DEBOUNCE_MS = 200;

const EMPTY_META: AddonPageMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

@Component({
  selector: 'app-addon-seats-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    Button,
    ConfirmDialog,
    Field,
    Pagination,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'ws-addon-seats', alias: 'wsAddonSeats' },
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerApps,
      tablerArmchair,
      tablerCalculator,
      tablerCheck,
      tablerChevronDown,
      tablerLoader2,
      tablerLock,
      tablerRefresh,
      tablerSearch,
      tablerShoppingCart,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './addon-seats-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-12',
    '(document:click)': 'closePickerIfOutside($event)',
    '(window:resize)': 'closePicker()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class AddonSeatsPage {
  private static nextId = 0;
  protected readonly uid = `addon-seats-page-${++AddonSeatsPage.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly scope = inject(TenantScopeState);
  private readonly api = inject(AddonSeatsApi);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly userTrigger = viewChild<ElementRef<HTMLButtonElement>>('userTrigger');
  private readonly pickerPanel = viewChild<ElementRef<HTMLElement>>('pickerPanel');
  private readonly userSearchInput = viewChild<ElementRef<HTMLInputElement>>('userSearchInput');
  private readonly removeConfirm = viewChild.required<ConfirmDialog>('removeConfirm');

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly optionsSkeletonRows = OPTIONS_SKELETON_ROWS;
  protected readonly assignmentsSkeletonRows = ASSIGNMENTS_SKELETON_ROWS;

  protected readonly canRead = computed(
    () =>
      // Until the session has loaded (or if loading failed) do not show the 403 state; the API decides.
      !this.scope.me() ||
      this.hasTenantPermission('applications.addon_seats.read') ||
      this.hasTenantPermission('applications.addon_seats.manage'),
  );
  protected readonly canManage = computed(
    () => this.hasTenantPermission('applications.addon_seats.manage'),
  );
  protected readonly forbiddenFromApi = signal(false);
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbiddenFromApi());

  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly selectedUser = signal<WorkspaceUser | null>(null);
  protected readonly resolvingUser = signal(false);

  protected readonly pickerOpen = signal(false);
  protected readonly pickerPlaced = signal(false);
  protected readonly pickerPlace = signal<PickerPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly userSearch = signal('');
  protected readonly usersSearching = signal(false);
  protected readonly userOptions = signal<WorkspaceUser[]>([]);
  protected readonly pickerForbidden = signal(false);
  protected readonly missingParentSeat = signal(false);

  protected readonly options = signal<AddonOption[]>([]);
  protected readonly optionsMeta = signal<AddonPageMeta>(EMPTY_META);
  protected readonly optionsPage = signal(1);
  protected readonly optionsPageSize = signal(20);
  protected readonly optionsLoading = signal(false);
  protected readonly optionsFailed = signal(false);
  protected readonly optionsFailedStatus = signal<number | null>(null);
  protected readonly optionsCorrelationId = signal<string | null>(null);

  protected readonly assignments = signal<AddonAssignment[]>([]);
  protected readonly assignmentsMeta = signal<AddonPageMeta>(EMPTY_META);
  protected readonly assignmentsPage = signal(1);
  protected readonly assignmentsPageSize = signal(20);
  protected readonly assignmentsLoading = signal(false);
  protected readonly assignmentsFailed = signal(false);
  protected readonly assignmentsFailedStatus = signal<number | null>(null);
  protected readonly assignmentsCorrelationId = signal<string | null>(null);

  protected readonly busyActionKey = signal<string | null>(null);
  protected readonly pendingRemove = signal<RemoveTarget | null>(null);

  private readonly apps = signal<ReadonlyMap<string, WorkspaceApp>>(new Map());

  protected readonly optionsColumns = computed(() =>
    this.canManage()
      ? 'grid-cols-ws-addon-option-row-manage'
      : 'grid-cols-ws-addon-option-row',
  );

  protected readonly assignmentsColumns = computed(() =>
    this.canManage()
      ? 'grid-cols-ws-addon-assignment-row-manage'
      : 'grid-cols-ws-addon-assignment-row',
  );

  protected readonly bothFailed = computed(
    () =>
      this.optionsFailed() &&
      this.assignmentsFailed() &&
      !this.optionsLoading() &&
      !this.assignmentsLoading(),
  );

  protected readonly combinedFailedStatus = computed(() =>
    this.optionsFailedStatus() === 503 || this.assignmentsFailedStatus() === 503 ? 503 : null,
  );

  protected readonly combinedCorrelationId = computed(
    () => this.optionsCorrelationId() ?? this.assignmentsCorrelationId(),
  );

  protected readonly anyLoading = computed(
    () => this.optionsLoading() || this.assignmentsLoading() || this.resolvingUser(),
  );

  protected readonly targetActive = computed(() => {
    const firstOption = this.options()[0];
    if (firstOption) return firstOption.targetActive;
    const user = this.selectedUser();
    return user ? user.status === 'ACTIVE' : true;
  });

  protected readonly selectedUserDisplayName = computed(() => {
    const user = this.selectedUser();
    return user ? this.fullName(user) : (this.selectedUserId() ?? '');
  });

  protected readonly pendingRemoveAddonName = computed(() => {
    const target = this.pendingRemove();
    return target ? this.addonLabel(target.addonKey) : '';
  });

  private userSearchSeq = 0;
  private pickerSeq = 0;
  private resolveUserSeq = 0;
  private optionsSeq = 0;
  private assignmentsSeq = 0;
  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private handledQueryUserId: string | null | undefined = undefined;
  private writeKeyCache: { fingerprint: string; key: string } | null = null;

  constructor() {
    void this.loadModuleMetadata();

    const onScroll = (event: Event) => {
      if (!this.pickerOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.pickerPanel()?.nativeElement.contains(target)) return;
      this.closePicker();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (this.userSearchTimer !== null) clearTimeout(this.userSearchTimer);
    });

    effect(() => {
      const canRead = this.canRead();
      const params = this.queryParams();
      if (!canRead || !params) return;
      const queryUserId = params.get('userId')?.trim() || null;
      if (queryUserId === this.handledQueryUserId) return;
      this.handledQueryUserId = queryUserId;

      untracked(() => {
        if (queryUserId) {
          void this.selectUserById(queryUserId);
        } else if (this.selectedUserId() !== null) {
          this.resetSelectedUserState();
        }
      });
    });

    effect(() => {
      const userId = this.selectedUserId();
      const page = this.optionsPage();
      const limit = this.optionsPageSize();
      const canRead = this.canRead();

      untracked(() => {
        if (!userId || !canRead) {
          this.options.set([]);
          this.optionsMeta.set(EMPTY_META);
          this.optionsLoading.set(false);
          this.optionsFailed.set(false);
          return;
        }
        void this.loadOptions(userId, page, limit);
      });
    });

    effect(() => {
      const userId = this.selectedUserId();
      const page = this.assignmentsPage();
      const limit = this.assignmentsPageSize();
      const canRead = this.canRead();

      untracked(() => {
        if (!userId || !canRead) {
          this.assignments.set([]);
          this.assignmentsMeta.set(EMPTY_META);
          this.assignmentsLoading.set(false);
          this.assignmentsFailed.set(false);
          return;
        }
        void this.loadAssignments(userId, page, limit);
      });
    });
  }

  protected togglePicker(): void {
    if (this.pickerOpen()) {
      this.closePicker();
      return;
    }
    const triggerEl = this.userTrigger()?.nativeElement;
    if (!triggerEl) return;

    const seq = ++this.pickerSeq;
    this.userSearch.set('');
    this.pickerPlaced.set(false);
    this.pickerPlace.set(this.initialPickerPlace(triggerEl));
    this.pickerOpen.set(true);
    void this.searchUsers('');
    queueMicrotask(() => this.placePicker(seq));
    afterNextRender(
      () => {
        this.placePicker(seq);
        this.userSearchInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected closePicker(): void {
    this.pickerSeq++;
    this.pickerOpen.set(false);
    this.pickerPlaced.set(false);
  }

  protected closePickerIfOutside(event: Event): void {
    if (!this.pickerOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closePicker();
      return;
    }
    if (
      this.userTrigger()?.nativeElement.contains(target) ||
      this.pickerPanel()?.nativeElement.contains(target)
    ) {
      return;
    }
    this.closePicker();
  }

  protected onHostEscape(event: Event): void {
    if (!this.pickerOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closePicker();
    this.userTrigger()?.nativeElement.focus();
  }

  protected onUserSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.userSearch.set(term);
    if (this.userSearchTimer !== null) {
      clearTimeout(this.userSearchTimer);
      this.userSearchTimer = null;
    }
    this.userSearchTimer = setTimeout(() => {
      void this.searchUsers(term);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onPickerKeydown(event: KeyboardEvent): void {
    const panelEl = this.pickerPanel()?.nativeElement;
    if (!panelEl) return;
    const buttons = Array.from(panelEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentIndex <= 0) {
        this.userSearchInput()?.nativeElement.focus();
      } else {
        buttons[currentIndex - 1]?.focus();
      }
    }
  }

  protected chooseUser(user: WorkspaceUser): void {
    this.closePicker();
    this.userTrigger()?.nativeElement.focus();
    if (this.selectedUserId() === user.id) return;

    this.handledQueryUserId = user.id;
    this.writeKeyCache = null;
    this.forbiddenFromApi.set(false);
    this.missingParentSeat.set(false);
    this.optionsPage.set(1);
    this.assignmentsPage.set(1);
    this.selectedUser.set(user);
    this.selectedUserId.set(user.id);
    this.syncQueryUserId(user.id);
  }

  protected clearUser(event: Event): void {
    event.stopPropagation();
    this.closePicker();
    this.handledQueryUserId = null;
    this.resetSelectedUserState();
    this.syncQueryUserId(null);
    this.userTrigger()?.nativeElement.focus();
  }

  protected reloadAll(): void {
    const userId = this.selectedUserId();
    if (!userId) return;
    this.forbiddenFromApi.set(false);
    void this.resolveUser(userId);
    void this.reloadUserTables(userId);
  }

  protected reloadOptions(): void {
    const userId = this.selectedUserId();
    if (!userId) return;
    void this.loadOptions(userId, this.optionsPage(), this.optionsPageSize());
  }

  protected reloadAssignments(): void {
    const userId = this.selectedUserId();
    if (!userId) return;
    void this.loadAssignments(userId, this.assignmentsPage(), this.assignmentsPageSize());
  }

  protected onOptionsPageSizeChange(size: number): void {
    if (size === this.optionsPageSize()) return;
    this.optionsPageSize.set(size);
    this.optionsPage.set(1);
  }

  protected onAssignmentsPageSizeChange(size: number): void {
    if (size === this.assignmentsPageSize()) return;
    this.assignmentsPageSize.set(size);
    this.assignmentsPage.set(1);
  }

  protected fullName(user: Pick<WorkspaceUser, 'firstName' | 'lastName' | 'email'>): string {
    const full = `${user.firstName} ${user.lastName}`.trim();
    return full || user.email;
  }

  protected initials(user: Pick<WorkspaceUser, 'firstName' | 'lastName' | 'email'>): string {
    return seatInitials(this.fullName(user)) || '?';
  }

  protected avatarTone(user: Pick<WorkspaceUser, 'firstName' | 'lastName' | 'email'>): string {
    const name = this.fullName(user);
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return AVATAR_TONES[hash % AVATAR_TONES.length];
  }

  protected tileFor(applicationKey: string) {
    return moduleTileOf(applicationKey);
  }

  protected appLabel(applicationKey: string): string {
    this.i18n();
    return this.apps().get(applicationKey)?.nameI18n[this.language()] || applicationKey;
  }

  protected addonLabel(addonKey: string): string {
    this.i18n();
    const key = `wsAddonSeats.addons.${addonKey}`;
    const translated = this.transloco.translate(key);
    if (typeof translated === 'string' && translated && translated !== key) {
      return translated;
    }
    const fallbackKey = 'wsAddonSeats.addons.unknown';
    const fallback = this.transloco.translate(fallbackKey, { key: addonKey });
    return typeof fallback === 'string' && fallback && fallback !== fallbackKey ? fallback : addonKey;
  }

  protected isOptionReady(option: AddonOption): boolean {
    const s = option.localState;
    return (
      s.parentReadiness === 'READY' &&
      s.addonReadiness === 'READY' &&
      !s.parentDenied &&
      !s.addonDenied &&
      !s.adoptionPending
    );
  }

  protected readinessReason(option: AddonOption): string {
    this.i18n();
    const s = option.localState;
    const app = this.appLabel(option.applicationKey);
    const reasons: string[] = [];

    if (s.addonDenied) {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.addonDenied'));
    }
    if (s.parentDenied) {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.parentDenied', { app }));
    }
    if (s.adoptionPending) {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.adoptionPending'));
    }
    if (s.capacityChangePending) {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.capacityChangePending'));
    }
    if (s.addonReadiness === 'BLOCKED') {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.addonBlocked'));
    } else if (s.addonReadiness === 'NOT_READY') {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.addonNotReady'));
    }
    if (s.parentReadiness === 'BLOCKED') {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.parentBlocked', { app }));
    } else if (s.parentReadiness === 'NOT_READY') {
      reasons.push(this.transloco.translate('wsAddonSeats.options.reasons.parentNotReady', { app }));
    }

    return reasons.join(' ');
  }

  protected assignDisabledReason(option: AddonOption): string | null {
    this.i18n();
    if (!this.canManage()) {
      return this.transloco.translate('wsAddonSeats.options.reasons.noManagePermission');
    }
    if (!option.parentAssignment) {
      return this.transloco.translate('wsAddonSeats.options.reasons.needParentSeat', {
        app: this.appLabel(option.applicationKey),
      });
    }
    if (!option.targetActive) {
      return this.transloco.translate('wsAddonSeats.options.reasons.userNotActive');
    }
    if (option.seats && option.seats.used >= option.seats.total) {
      return this.transloco.translate('wsAddonSeats.options.reasons.noFreeSeats');
    }
    if (!this.isOptionReady(option)) {
      return this.readinessReason(option);
    }
    return null;
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

  protected async assign(option: AddonOption): Promise<void> {
    if (!this.canManage() || this.busyActionKey() || !option.parentAssignment) return;
    if (this.assignDisabledReason(option) !== null) return;

    const userId = option.userId;
    const body = {
      addonSelectionId: option.addonSelectionId,
      expectedAllowanceRevision: option.allowanceRevision,
      expectedParentAssignmentRevision: option.parentAssignment.revision,
    };
    const fingerprint = `assign:${userId}:${JSON.stringify(body)}`;
    const key = this.idempotencyKeyFor(fingerprint);

    const addonName = this.addonLabel(option.addonKey);
    const appName = this.appLabel(option.applicationKey);
    const userName = this.selectedUserDisplayName();

    this.busyActionKey.set(`assign:${option.addonSelectionId}`);
    try {
      const receipt = await this.api.assignAddon(userId, body, key);
      this.writeKeyCache = null;
      this.missingParentSeat.set(false);
      if (receipt.changed) {
        this.notify.success(
          this.transloco.translate('wsAddonSeats.toast.assigned', {
            addon: addonName,
            user: userName,
          }),
        );
      } else {
        this.notify.info(
          this.transloco.translate('wsAddonSeats.toast.alreadyAssigned', {
            addon: addonName,
            user: userName,
          }),
        );
      }
      await this.reloadUserTables(userId);
    } catch (error) {
      this.handleWriteError(error, {
        kind: 'assign',
        userId,
        addonName,
        appName,
        applicationKey: option.applicationKey,
        userName,
      });
    } finally {
      this.busyActionKey.set(null);
    }
  }

  protected requestRemoveFromOption(option: AddonOption): void {
    if (!option.assignment) return;
    void this.requestRemove({
      assignmentId: option.assignment.id,
      assignmentRevision: option.assignment.revision,
      allowanceRevision: option.allowanceRevision,
      addonKey: option.addonKey,
      applicationKey: option.applicationKey,
    });
  }

  protected requestRemoveFromAssignment(row: AddonAssignment): void {
    void this.requestRemove({
      assignmentId: row.assignmentId,
      assignmentRevision: row.assignmentRevision,
      allowanceRevision: row.allowanceRevision,
      addonKey: row.addonKey,
      applicationKey: row.applicationKey,
    });
  }

  private async requestRemove(target: RemoveTarget): Promise<void> {
    const userId = this.selectedUserId();
    if (!userId || !this.canManage() || this.busyActionKey()) return;

    this.pendingRemove.set(target);
    const confirmed = await this.removeConfirm().open();
    if (!confirmed) {
      this.pendingRemove.set(null);
      return;
    }

    const query = {
      expectedAssignmentRevision: target.assignmentRevision,
      expectedAllowanceRevision: target.allowanceRevision,
    };
    const fingerprint = `remove:${userId}:${target.assignmentId}:${JSON.stringify(query)}`;
    const key = this.idempotencyKeyFor(fingerprint);

    const addonName = this.addonLabel(target.addonKey);
    const appName = this.appLabel(target.applicationKey);
    const userName = this.selectedUserDisplayName();

    this.busyActionKey.set(`remove:${target.assignmentId}`);
    try {
      const receipt = await this.api.removeAddon(userId, target.assignmentId, query, key);
      this.writeKeyCache = null;
      if (receipt.changed) {
        this.notify.success(
          this.transloco.translate('wsAddonSeats.toast.removed', {
            addon: addonName,
            user: userName,
          }),
        );
      } else {
        this.notify.info(
          this.transloco.translate('wsAddonSeats.toast.alreadyRemoved', {
            addon: addonName,
            user: userName,
          }),
        );
      }
      await this.reloadUserTables(userId);
    } catch (error) {
      this.handleWriteError(error, {
        kind: 'remove',
        userId,
        addonName,
        appName,
        applicationKey: target.applicationKey,
        userName,
      });
    } finally {
      this.busyActionKey.set(null);
      this.pendingRemove.set(null);
    }
  }

  private handleWriteError(
    error: unknown,
    ctx: { kind: 'assign' | 'remove'; userId: string; addonName: string; appName: string; applicationKey: string; userName: string },
  ): void {
    const code = errorCodeOf(error);
    const status = error instanceof ApiError ? error.status : null;
    const inFlight = code === 'GW.IDEM.IN_FLIGHT' || !!code?.match(/IDEMPOTENCY.*IN_FLIGHT$/);
    if (status !== 401 && !inFlight && !isRetryableWriteError(error)) {
      this.writeKeyCache = null;
    }

    if (inFlight) {
      this.notify.error(this.transloco.translate('wsAddonSeats.errors.GW.IDEM.IN_FLIGHT'));
      return;
    }

    if (code === 'SEAT_LIMIT_REACHED') {
      const parentOverCapacity = this.selectedUser()?.seats?.some(
        (seat) => seat.moduleKey === ctx.applicationKey && seat.accessState === 'OVER_CAPACITY',
      );
      this.notify.error(
        this.transloco.translate(parentOverCapacity
          ? 'wsAddonSeats.errors.APP_SEAT_LIMIT_REACHED' : 'wsAddonSeats.errors.SEAT_LIMIT_REACHED', {
          addon: ctx.addonName,
        }),
      );
      void this.reloadUserTables(ctx.userId);
      return;
    }

    if (code === 'ASSIGNMENT_NOT_FOUND') {
      if (ctx.kind === 'assign') {
        this.missingParentSeat.set(true);
        this.notify.error(
          this.transloco.translate('wsAddonSeats.errors.ASSIGNMENT_NOT_FOUND', {
            user: ctx.userName,
            app: ctx.appName,
          }),
        );
      } else {
        this.notify.info(this.transloco.translate('wsAddonSeats.errors.ASSIGNMENT_ALREADY_GONE'));
      }
      void this.reloadUserTables(ctx.userId);
      return;
    }

    if (code && code.endsWith('_REVISION_STALE')) {
      this.notify.warning(this.transloco.translate('wsAddonSeats.errors.REVISION_STALE'));
      void this.reloadUserTables(ctx.userId);
      return;
    }

    if (code === 'APPLICATION_ALLOWANCE_NOT_READY') {
      this.notify.error(
        this.transloco.translate('wsAddonSeats.errors.APPLICATION_ALLOWANCE_NOT_READY'),
      );
      void this.reloadUserTables(ctx.userId);
      return;
    }

    this.notify.error(writeErrorMessage(error, 'wsAddonSeats', this.transloco));
  }

  private async selectUserById(userId: string): Promise<void> {
    if (this.selectedUserId() !== userId) this.writeKeyCache = null;
    this.forbiddenFromApi.set(false);
    this.missingParentSeat.set(false);
    this.optionsPage.set(1);
    this.assignmentsPage.set(1);
    this.selectedUserId.set(userId);

    const cached =
      this.userOptions().find((u) => u.id === userId) ??
      (this.selectedUser()?.id === userId ? this.selectedUser() : null);
    if (cached) {
      this.selectedUser.set(cached);
      return;
    }
    this.selectedUser.set(null);
    await this.resolveUser(userId);
  }

  private async resolveUser(userId: string): Promise<void> {
    const seq = ++this.resolveUserSeq;
    this.resolvingUser.set(true);
    try {
      const user = await this.lookups.user(userId);
      if (seq !== this.resolveUserSeq || this.selectedUserId() !== userId) return;
      this.selectedUser.set(user);
    } catch (error) {
      if (seq !== this.resolveUserSeq || this.selectedUserId() !== userId) return;
      const code = errorCodeOf(error);
      if (code === 'TENANT_USER_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.notify.error(this.transloco.translate('wsAddonSeats.errors.TENANT_USER_NOT_FOUND'));
        this.handledQueryUserId = null;
        this.resetSelectedUserState();
        this.syncQueryUserId(null);
      } else if (error instanceof ApiError && error.status === 403) {
        this.selectedUser.set(null);
      }
    } finally {
      if (seq === this.resolveUserSeq) {
        this.resolvingUser.set(false);
      }
    }
  }

  private async loadModuleMetadata(): Promise<void> {
    try {
      const apps = await this.lookups.appsOverview();
      this.apps.set(new Map(apps.map((app) => [app.moduleKey, app])));
    } catch {
      // Display names are optional; the module key remains usable if the lookup fails.
    }
  }

  private async searchUsers(search: string): Promise<void> {
    const seq = ++this.userSearchSeq;
    this.usersSearching.set(true);
    this.pickerForbidden.set(false);
    try {
      const page = await this.lookups.users({
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 50,
      });
      if (seq !== this.userSearchSeq) return;
      this.userOptions.set(page.data);
      if (this.pickerOpen()) {
        queueMicrotask(() => this.placePicker(this.pickerSeq));
      }
    } catch (error) {
      if (seq !== this.userSearchSeq) return;
      this.userOptions.set([]);
      this.pickerForbidden.set(error instanceof ApiError && error.status === 403);
    } finally {
      if (seq === this.userSearchSeq) {
        this.usersSearching.set(false);
      }
    }
  }

  private async reloadUserTables(userId: string): Promise<void> {
    await Promise.all([
      this.loadOptions(userId, this.optionsPage(), this.optionsPageSize()),
      this.loadAssignments(userId, this.assignmentsPage(), this.assignmentsPageSize()),
    ]);
  }

  private async loadOptions(userId: string, page: number, limit: number): Promise<void> {
    const seq = ++this.optionsSeq;
    this.optionsLoading.set(true);
    this.optionsFailed.set(false);
    this.optionsFailedStatus.set(null);
    this.optionsCorrelationId.set(null);

    try {
      const res = await this.api.listAddonOptions(userId, page, limit);
      if (seq !== this.optionsSeq || this.selectedUserId() !== userId) return;
      if (page > res.meta.totalPages && res.meta.totalPages >= 1) {
        this.optionsPage.set(res.meta.totalPages);
        return;
      }
      this.options.set(res.data);
      this.optionsMeta.set(res.meta);
    } catch (error) {
      if (seq !== this.optionsSeq || this.selectedUserId() !== userId) return;
      if (error instanceof ApiError && error.status === 403 && !error.code.startsWith('TENANT_MAINTENANCE_')) {
        this.forbiddenFromApi.set(true);
        return;
      }
      if (error instanceof ApiError && error.status > 0 && error.status < 500) {
        this.notify.error(errorMessage(error, 'wsAddonSeats', this.transloco));
        return;
      }
      this.optionsFailed.set(true);
      this.optionsFailedStatus.set(error instanceof ApiError ? error.status : null);
      this.optionsCorrelationId.set(correlationIdOf(error));
    } finally {
      if (seq === this.optionsSeq) {
        this.optionsLoading.set(false);
      }
    }
  }

  private async loadAssignments(userId: string, page: number, limit: number): Promise<void> {
    const seq = ++this.assignmentsSeq;
    this.assignmentsLoading.set(true);
    this.assignmentsFailed.set(false);
    this.assignmentsFailedStatus.set(null);
    this.assignmentsCorrelationId.set(null);

    try {
      const res = await this.api.listAddonAssignments(userId, page, limit);
      if (seq !== this.assignmentsSeq || this.selectedUserId() !== userId) return;
      if (page > res.meta.totalPages && res.meta.totalPages >= 1) {
        this.assignmentsPage.set(res.meta.totalPages);
        return;
      }
      this.assignments.set(res.data);
      this.assignmentsMeta.set(res.meta);
    } catch (error) {
      if (seq !== this.assignmentsSeq || this.selectedUserId() !== userId) return;
      if (error instanceof ApiError && error.status === 403 && !error.code.startsWith('TENANT_MAINTENANCE_')) {
        this.forbiddenFromApi.set(true);
        return;
      }
      if (error instanceof ApiError && error.status > 0 && error.status < 500) {
        this.notify.error(errorMessage(error, 'wsAddonSeats', this.transloco));
        return;
      }
      this.assignmentsFailed.set(true);
      this.assignmentsFailedStatus.set(error instanceof ApiError ? error.status : null);
      this.assignmentsCorrelationId.set(correlationIdOf(error));
    } finally {
      if (seq === this.assignmentsSeq) {
        this.assignmentsLoading.set(false);
      }
    }
  }

  private resetSelectedUserState(): void {
    this.writeKeyCache = null;
    this.missingParentSeat.set(false);
    this.selectedUserId.set(null);
    this.selectedUser.set(null);
    this.options.set([]);
    this.optionsMeta.set(EMPTY_META);
    this.optionsFailed.set(false);
    this.optionsFailedStatus.set(null);
    this.optionsCorrelationId.set(null);
    this.assignments.set([]);
    this.assignmentsMeta.set(EMPTY_META);
    this.assignmentsFailed.set(false);
    this.assignmentsFailedStatus.set(null);
    this.assignmentsCorrelationId.set(null);
  }

  private syncQueryUserId(userId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private idempotencyKeyFor(fingerprint: string): string {
    if (this.writeKeyCache?.fingerprint === fingerprint) {
      return this.writeKeyCache.key;
    }
    const key = newIdempotencyKey();
    this.writeKeyCache = { fingerprint, key };
    return key;
  }

  private hasTenantPermission(key: string): boolean {
    const me = this.scope.me();
    return me?.isTenantOwner === true ||
      (me?.permissions.includes(key) === true && me.permissionScopes[key]?.tenantWide === true);
  }

  protected userStatusTone(status: WorkspaceUser['status']): string {
    switch (status) {
      case 'ACTIVE': return 'bg-success text-on-success';
      case 'INVITED': return 'bg-brand-soft text-on-brand-soft';
      case 'SUSPENDED': return 'bg-neutral-soft text-warning-text';
      default: return 'bg-neutral-soft text-text-muted';
    }
  }

  private initialPickerPlace(triggerEl: HTMLElement): PickerPlace {
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

  private placePicker(seq: number): void {
    if (seq !== this.pickerSeq || !this.pickerOpen()) return;
    const triggerEl = this.userTrigger()?.nativeElement;
    const panelEl = this.pickerPanel()?.nativeElement;
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

    this.pickerPlace.set({ top, start, width: rect.width, maxHeight });
    this.pickerPlaced.set(true);
  }
}
