import { Component, DOCUMENT, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerFileExport,
  tablerHistory,
  tablerLock,
  tablerRefresh,
  tablerSearch,
  tablerSettings,
  tablerX,
} from '@ng-icons/tabler-icons';
import { addDays, startOfDay, subDays } from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { DateRange, DateRangeValue } from '../../../../../shared/ui/date-range/date-range';
import {
  DEFAULT_FROM_TIME,
  DEFAULT_TO_TIME,
  countRangeDays,
  formatLocalDateTime,
  parseLocalDateTime,
} from '../../../../../shared/ui/date-range/date-range-presets';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { correlationIdOf, errorMessage } from '../../../../../core/api/api-errors';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch, WorkspaceUser } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { QuerySingleSelect } from '../../../../../shared/ui/query-builder/query-value/single-select/single-select';
import { QueryField } from '../../../../../shared/query-builder/query.model';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { AuditEventModal } from '../audit-event-modal/audit-event-modal';
import { AuditExportModal } from '../audit-export-modal/audit-export-modal';
import {
  AUDIT_LIMITS,
  AUDIT_OUTCOMES,
  AUDIT_SENSITIVITIES,
  AUDIT_SOURCE_APPS,
  AuditDeletedQuery,
  AuditEvent,
  AuditExportContext,
  AuditExportFilterSummaryItem,
  AuditExportFilters,
  AuditOutcome,
  AuditQuery,
  AuditSensitivity,
  AuditSourceApp,
  AuditViewMode,
  ApiError,
  auditExportErrorKey,
  avatarToneForName,
  errorCodeOf,
  formatAuditDateTime,
  humanizeActionCode,
  initialsForName,
  AuditLogApi,
} from '../audit-log.api';

type DateRangeErrorKind = 'required' | 'order' | 'max' | null;

interface AuditFilterState {
  range: DateRangeValue | null;
  mode: AuditViewMode;
  q: string;
  sourceApp: AuditSourceApp | '';
  outcome: AuditOutcome | '';
  sensitivity: AuditSensitivity | '';
  actorUserId: string;
  branchId: string;
  entityType: string;
  action: string;
  includeRequests: boolean;
  correlationId: string | null;
}

// BE-O5 is absent from committed backend main; do not send its query flag yet.
const INCLUDE_REQUESTS_AVAILABLE: boolean = false;

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const SOURCE_APP_SET = new Set<string>(AUDIT_SOURCE_APPS);
const OUTCOME_SET = new Set<string>(AUDIT_OUTCOMES);
const SENSITIVITY_SET = new Set<string>(AUDIT_SENSITIVITIES);
const LOCAL_DT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function defaultDateRange(): DateRangeValue {
  const today = startOfDay(new Date());
  const fromDate = subDays(today, AUDIT_LIMITS.defaultRangeDays - 1);
  return {
    from: formatLocalDateTime(fromDate, DEFAULT_FROM_TIME),
    to: formatLocalDateTime(today, DEFAULT_TO_TIME),
    preset: null,
  };
}

function toLocalDateTime(date: Date, time: string): Date {
  const [hoursRaw, minutesRaw] = time.split(':').map(Number);
  const hours = Number.isFinite(hoursRaw) ? hoursRaw : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizeUrlDateTime(raw: string | null, fallbackTime: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (LOCAL_DT_PATTERN.test(trimmed)) {
    const parsed = parseLocalDateTime(trimmed, fallbackTime);
    return parsed ? formatLocalDateTime(parsed.date, parsed.time) : null;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  const date = new Date(timestamp);
  return formatLocalDateTime(date, formatClock(date));
}

function validateDateRange(range: DateRangeValue | null): DateRangeErrorKind {
  if (!range || !range.from || !range.to) return 'required';
  const parsedFrom = parseLocalDateTime(range.from, DEFAULT_FROM_TIME);
  const parsedTo = parseLocalDateTime(range.to, DEFAULT_TO_TIME);
  if (!parsedFrom || !parsedTo) return 'required';

  const fromDt = toLocalDateTime(parsedFrom.date, parsedFrom.time);
  const toDt = toLocalDateTime(parsedTo.date, parsedTo.time);
  if (fromDt.getTime() >= toDt.getTime()) return 'order';

  if (countRangeDays(parsedFrom.date, parsedTo.date) > AUDIT_LIMITS.maxRangeDays) {
    return 'max';
  }
  return null;
}

function toApiIsoRange(range: DateRangeValue): { from: string; to: string } | null {
  if (validateDateRange(range) !== null) return null;
  const parsedFrom = parseLocalDateTime(range.from, DEFAULT_FROM_TIME);
  const parsedTo = parseLocalDateTime(range.to, DEFAULT_TO_TIME);
  if (!parsedFrom || !parsedTo) return null;

  const fromDt = toLocalDateTime(parsedFrom.date, parsedFrom.time);
  const toDt = toLocalDateTime(parsedTo.date, parsedTo.time);
  return {
    from: fromDt.toISOString(),
    to: new Date(toDt.getTime() + 60_000).toISOString(),
  };
}

function parseFiltersFromParams(params: ParamMap): AuditFilterState {
  const rawFrom = params.get('from');
  const rawTo = params.get('to');

  let range: DateRangeValue | null;
  if (rawFrom === null && rawTo === null) {
    range = defaultDateRange();
  } else {
    const from = normalizeUrlDateTime(rawFrom, DEFAULT_FROM_TIME);
    const to = normalizeUrlDateTime(rawTo, DEFAULT_TO_TIME);
    range = from && to ? { from, to, preset: null } : null;
  }

  const mode: AuditViewMode = params.get('show') === 'deleted' ? 'deleted' : 'all';
  const rawApp = params.get('sourceApp') ?? '';
  const rawOutcome = params.get('outcome') ?? '';
  const rawSensitivity = params.get('sensitivity') ?? '';

  return {
    range,
    mode,
    q: mode === 'deleted' ? (params.get('q') ?? '').slice(0, AUDIT_LIMITS.deletedQueryPrefix) : '',
    sourceApp: SOURCE_APP_SET.has(rawApp) ? (rawApp as AuditSourceApp) : '',
    outcome: OUTCOME_SET.has(rawOutcome) ? (rawOutcome as AuditOutcome) : '',
    sensitivity: SENSITIVITY_SET.has(rawSensitivity) ? (rawSensitivity as AuditSensitivity) : '',
    actorUserId: params.get('actorUserId') ?? '',
    branchId: params.get('branchId') ?? '',
    entityType: (params.get('entityType') ?? '').slice(0, AUDIT_LIMITS.entityType),
    action: (params.get('action') ?? '').slice(0, AUDIT_LIMITS.action),
    includeRequests: INCLUDE_REQUESTS_AVAILABLE && params.get('includeRequests') === 'true',
    correlationId: params.get('correlationId') || null,
  };
}

function serializeFilterKey(state: AuditFilterState): string {
  return JSON.stringify([
    state.range?.from ?? '',
    state.range?.to ?? '',
    state.mode,
    state.q.trim(),
    state.sourceApp,
    state.outcome,
    state.sensitivity,
    state.actorUserId,
    state.branchId,
    state.entityType.trim(),
    state.action.trim(),
    state.includeRequests,
    state.correlationId ?? '',
  ]);
}

@Component({
  selector: 'app-audit-log-page',
  imports: [
    FullState,
    QuerySingleSelect,
    NgIcon,
    TranslocoPipe,
    AuditEventModal,
    AuditExportModal,
    Button,
    DateRange,
    Dropdown,
    Field,
    Segmented,
    Switch,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' }, { scope: 'ui-query-value', alias: 'qv' }),
    provideIcons({
      tablerLock,
      tablerAlertTriangle,
      tablerFileExport,
      tablerHistory,
      tablerRefresh,
      tablerX,
      tablerSettings,
      tablerSearch,
    }),
  ],
  templateUrl: './audit-log-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class AuditLogPage {
  private static nextId = 0;
  protected readonly uid = `ws-audit-${++AuditLogPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly scope = inject(TenantScopeState);
  private readonly api = inject(AuditLogApi);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly includeRequestsAvailable = INCLUDE_REQUESTS_AVAILABLE;
  private filterTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly eventModal = viewChild.required(AuditEventModal);
  private readonly exportModal = viewChild(AuditExportModal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly limits = AUDIT_LIMITS;
  private readonly initialState = parseFiltersFromParams(this.route.snapshot.queryParamMap);

  protected readonly draftRange = signal<DateRangeValue | null>(this.initialState.range);
  protected readonly draftMode = signal<AuditViewMode>(this.initialState.mode);
  protected readonly draftQ = signal(this.initialState.q);
  protected readonly draftSourceApp = signal<string>(this.initialState.sourceApp);
  protected readonly draftOutcome = signal<string>(this.initialState.outcome);
  protected readonly draftSensitivity = signal<string>(this.initialState.sensitivity);
  protected readonly draftActorUserId = signal(this.initialState.actorUserId);
  protected readonly draftBranchId = signal(this.initialState.branchId);
  protected readonly draftEntityType = signal(this.initialState.entityType);
  protected readonly draftAction = signal(this.initialState.action);
  protected readonly draftIncludeRequests = signal(this.initialState.includeRequests);
  protected readonly draftCorrelationId = signal<string | null>(this.initialState.correlationId);

  protected readonly applied = signal<AuditFilterState>(this.initialState);

  protected readonly rows = signal<AuditEvent[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadCorrelationId = signal<string | null>(null);
  protected readonly forbidden = signal(false);

  protected readonly users = signal<WorkspaceUser[]>([]);
  protected readonly branches = signal<WorkspaceBranch[]>([]);

  protected readonly canReadAudit = computed(() => {
    const me = this.scope.me();
    // Until the session has loaded (or if loading failed) do not show the 403 state; the API decides.
    if (!me) return true;
    if (me.isTenantOwner) return true;
    if (me.permissions.includes('audit.read') && me.permissionScopes['audit.read']?.tenantWide) return true;
    const branchScope = me.permissionScopes['audit.read.branch'];
    if (me.permissions.includes('audit.read.branch') && branchScope && (branchScope.tenantWide || branchScope.branchIds.length > 0)) {
      return true;
    }
    return me.permissions.includes('audit.read.own');
  });

  protected readonly isForbidden = computed(() => !this.canReadAudit() || this.forbidden());

  protected readonly canExportAudit = computed(() => {
    const me = this.scope.me();
    if (!me) return false;
    if (me.isTenantOwner) return true;
    return me.permissions.includes('audit.read') && me.permissionScopes['audit.read']?.tenantWide === true;
  });

  protected readonly exportRangeError = signal<string | null>(null);
  protected readonly dateRangeErrorKind = computed(() => validateDateRange(this.draftRange()));

  protected readonly dateRangeError = computed<string | null>(() => {
    this.i18n();
    const kind = this.dateRangeErrorKind();
    if (kind === 'required') return this.transloco.translate('wsAudit.validation.rangeRequired');
    if (kind === 'order') return this.transloco.translate('wsAudit.validation.rangeOrder');
    if (kind === 'max') return this.transloco.translate('wsAudit.validation.rangeMaxDays');
    return this.exportRangeError();
  });

  protected readonly dateRangeDescribedBy = computed(() =>
    this.dateRangeError() ? `${this.uid}-range-hint ${this.uid}-range-error` : `${this.uid}-range-hint`,
  );

  protected readonly modeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'all', label: this.transloco.translate('wsAudit.filters.showAll') },
      { value: 'deleted', label: this.transloco.translate('wsAudit.filters.showDeleted') },
    ];
  });

  protected readonly appOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsAudit.filters.allApps') },
      ...AUDIT_SOURCE_APPS.map((app) => ({
        value: app,
        label: this.transloco.translate(`wsAudit.apps.${app}`),
      })),
    ];
  });

  protected readonly outcomeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsAudit.filters.allOutcomes') },
      ...AUDIT_OUTCOMES.map((outcome) => ({
        value: outcome,
        label: this.transloco.translate(`wsAudit.outcomes.${outcome}`),
      })),
    ];
  });

  protected readonly sensitivityOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsAudit.filters.allSensitivities') },
      ...AUDIT_SENSITIVITIES.map((level) => ({
        value: level,
        label: this.transloco.translate(`wsAudit.sensitivities.${level}`),
      })),
    ];
  });

  protected readonly actorLookupDenied = signal(false);
  protected readonly actorField = computed<QueryField>(() => {
    this.i18n();
    return {
      id: 'auditActor', kind: 'enum', placement: 'root',
      label: this.transloco.translate('wsAudit.filters.user'),
      hint: this.transloco.translate('wsAudit.filters.userHint'),
      options: this.users().map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim() || user.email })),
      specialOptions: [{ value: '', label: this.transloco.translate('wsAudit.filters.allUsers') }],
      searchOptions: this.searchActors,
    };
  });

  protected readonly searchActors = async (search: string) => {
    try {
      const page = await this.lookups.users({ search, limit: 20 });
      if (this.destroyRef.destroyed) return [];
      this.actorLookupDenied.set(false);
      this.users.update((current) => [...new Map([...current, ...page.data].map((user) => [user.id, user])).values()]);
      return page.data.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}`.trim() || user.email }));
    } catch (error) {
      if (this.destroyRef.destroyed) return [];
      if (error instanceof ApiError && error.status === 403) this.actorLookupDenied.set(true);
      else this.notify.error(this.resolveError(error));
      return [];
    }
  };

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.branches().map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));
    const currentId = this.draftBranchId();
    if (currentId && !list.some((opt) => opt.value === currentId)) {
      list.push({ value: currentId, label: currentId });
    }
    return [{ value: '', label: this.transloco.translate('wsAudit.filters.allBranches') }, ...list];
  });

  protected readonly userNames = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const user of this.users()) {
      const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      map.set(user.id, fullName);
    }
    return map;
  });

  protected readonly branchNames = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const branch of this.branches()) {
      map.set(branch.id, branch.name);
    }
    return map;
  });

  private loadSeq = 0;
  private lookupsLoaded = false;
  private lastSyncedUrlKey = serializeFilterKey(this.initialState);
  private handledExportId: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loadSeq++;
      if (this.filterTimer !== null) clearTimeout(this.filterTimer);
    });

    if (
      !this.route.snapshot.queryParamMap.has('from') ||
      !this.route.snapshot.queryParamMap.has('to')
    ) {
      this.syncUrlParams(this.initialState);
    }

    effect(() => {
      const allowed = this.canReadAudit();
      if (!allowed) {
        this.rows.set([]);
        this.nextCursor.set(null);
        return;
      }
      untracked(() => {
        if (!this.lookupsLoaded) {
          void this.loadLookups();
        }
      });
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;
      const parsed = parseFiltersFromParams(params);
      const key = serializeFilterKey(parsed);
      if (key === this.lastSyncedUrlKey) return;
      this.lastSyncedUrlKey = key;
      untracked(() => {
        this.applyStateToDraft(parsed);
        this.applied.set(parsed);
      });
    });

    effect(() => {
      const state = this.applied();
      const allowed = this.canReadAudit();
      if (!allowed) return;
      untracked(() => {
        this.forbidden.set(false);
        void this.fetchInitial(state);
      });
    });

    effect(() => {
      const exportId = this.queryParams()?.get('exportId')?.trim() || null;
      if (!exportId) {
        this.handledExportId = null;
        return;
      }
      if (exportId === this.handledExportId) return;
      this.handledExportId = exportId;
      untracked(() => {
        void this.processExportParam(exportId);
      });
    });
  }

  protected reload(): void {
    if (!this.canReadAudit() || this.dateRangeErrorKind() !== null) return;
    if (!this.lookupsLoaded) {
      void this.loadLookups();
    }
    this.forbidden.set(false);
    void this.fetchInitial(this.applied());
  }

  protected onRangePicked(range: DateRangeValue | null): void {
    this.draftRange.set(range);
    this.exportRangeError.set(null);
    if (validateDateRange(range) !== null) {
      return;
    }
    this.commitDiscreteFilters();
  }

  protected onModeChange(value: string | null): void {
    const nextMode: AuditViewMode = value === 'deleted' ? 'deleted' : 'all';
    this.draftMode.set(nextMode);
    if (nextMode === 'all') {
      this.draftQ.set('');
    }
    this.commitDiscreteFilters();
  }

  protected onDropdownChange(
    which: 'sourceApp' | 'outcome' | 'sensitivity' | 'actorUserId' | 'branchId',
    value: string,
  ): void {
    switch (which) {
      case 'sourceApp':
        this.draftSourceApp.set(value);
        break;
      case 'outcome':
        this.draftOutcome.set(value);
        break;
      case 'sensitivity':
        this.draftSensitivity.set(value);
        break;
      case 'actorUserId':
        this.draftActorUserId.set(value);
        break;
      case 'branchId':
        this.draftBranchId.set(value);
        break;
    }
    this.commitDiscreteFilters();
  }

  protected onIncludeRequestsChange(checked: boolean): void {
    if (!this.includeRequestsAvailable) return;
    this.draftIncludeRequests.set(checked);
    this.commitDiscreteFilters();
  }

  protected onTextInput(which: 'q' | 'entityType' | 'action', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (which === 'q') this.draftQ.set(value);
    else if (which === 'entityType') this.draftEntityType.set(value);
    else this.draftAction.set(value);
    this.scheduleFilters();
  }

  protected clearTextField(which: 'q' | 'entityType' | 'action'): void {
    if (which === 'q') this.draftQ.set('');
    else if (which === 'entityType') this.draftEntityType.set('');
    else this.draftAction.set('');
    this.applyFilters();
  }

  protected applyFilters(): void {
    if (this.filterTimer !== null) clearTimeout(this.filterTimer);
    this.filterTimer = null;
    if (this.dateRangeErrorKind() !== null) return;
    this.commitAndSync(this.buildFilterStateFromDraft());
  }

  protected openExportModal(): void {
    if (!this.canExportAudit() || this.dateRangeErrorKind() !== null) return;
    const context = this.buildExportContext(this.buildFilterStateFromDraft());
    if (!context) return;
    this.exportModal()?.open(context);
  }

  protected onExportRangeInvalid(message: string): void {
    this.exportRangeError.set(message);
  }

  private buildFilterStateFromDraft(): AuditFilterState {
    return {
      range: this.draftRange(),
      mode: this.draftMode(),
      q: this.draftMode() === 'deleted' ? this.draftQ().trim() : '',
      sourceApp: SOURCE_APP_SET.has(this.draftSourceApp()) ? (this.draftSourceApp() as AuditSourceApp) : '',
      outcome: OUTCOME_SET.has(this.draftOutcome()) ? (this.draftOutcome() as AuditOutcome) : '',
      sensitivity: SENSITIVITY_SET.has(this.draftSensitivity())
        ? (this.draftSensitivity() as AuditSensitivity)
        : '',
      actorUserId: this.draftActorUserId(),
      branchId: this.draftBranchId(),
      entityType: this.draftEntityType().trim(),
      action: this.draftAction().trim(),
      includeRequests: this.includeRequestsAvailable && this.draftIncludeRequests(),
      correlationId: this.draftCorrelationId(),
    };
  }

  protected clearFilters(): void {
    const resetState: AuditFilterState = {
      range: defaultDateRange(),
      mode: 'all',
      q: '',
      sourceApp: '',
      outcome: '',
      sensitivity: '',
      actorUserId: '',
      branchId: '',
      entityType: '',
      action: '',
      includeRequests: false,
      correlationId: null,
    };
    this.applyStateToDraft(resetState);
    this.commitAndSync(resetState);
  }

  protected clearCorrelationFilter(): void {
    this.draftCorrelationId.set(null);
    if (this.dateRangeErrorKind() !== null) {
      this.applied.update((current) => ({ ...current, correlationId: null }));
      return;
    }
    this.commitAndSync({ ...this.applied(), correlationId: null });
  }

  protected onShowRelated(event: AuditEvent): void {
    if (!event.correlationId) return;
    const widenedRange = this.widenRangeAroundEvent(event.createdAt);
    const next: AuditFilterState = {
      range: widenedRange,
      mode: 'all',
      q: '',
      sourceApp: '',
      outcome: '',
      sensitivity: '',
      actorUserId: '',
      branchId: '',
      entityType: '',
      action: '',
      includeRequests: this.includeRequestsAvailable,
      correlationId: event.correlationId,
    };
    this.applyStateToDraft(next);
    this.commitAndSync(next);
  }

  protected openEvent(event: AuditEvent): void {
    this.eventModal().open(event);
  }

  protected onRowKeydown(event: KeyboardEvent, item: AuditEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openEvent(item);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loading() || this.loadingMore()) return;

    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await this.executeQuery(this.applied(), cursor);
      if (seq !== this.loadSeq) return;
      this.rows.update((current) => {
        const seen = new Set(current.map((item) => item.id));
        const extra = page.items.filter((item) => !seen.has(item.id));
        return [...current, ...extra];
      });
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 400 &&
          ['CORE_VALIDATION_FAILED', 'AUDIT_QUERY_INVALID'].includes(error.code)) {
        this.nextCursor.set(null);
        await this.fetchInitial(this.applied());
      } else {
        this.handleLoadError(error);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected formatDateTime(iso: string): string {
    return formatAuditDateTime(iso, this.language());
  }

  protected actorDisplay(event: AuditEvent): string {
    return event.actorLabel ?? this.transloco.translate('wsAudit.actor.system');
  }

  protected actorInitials(event: AuditEvent): string {
    return initialsForName(this.actorDisplay(event));
  }

  protected actorAvatarTone(event: AuditEvent): string {
    return avatarToneForName(this.actorDisplay(event));
  }

  protected translateAction(code: string): string {
    const key = `wsAudit.actions.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : humanizeActionCode(code);
  }

  protected translateEntityType(type: string): string {
    const key = `wsAudit.entityTypes.${type}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : type;
  }

  protected recordPrimaryLabel(event: AuditEvent): string {
    return event.entityLabel || event.entityId || '—';
  }

  private scheduleFilters(): void {
    if (this.filterTimer !== null) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.applyFilters(), 300);
  }

  private commitDiscreteFilters(): void {
    this.scheduleFilters();
  }

  private commitAndSync(next: AuditFilterState): void {
    const nextKey = serializeFilterKey(next);
    const sameAsApplied = nextKey === serializeFilterKey(this.applied());
    this.lastSyncedUrlKey = nextKey;
    this.syncUrlParams(next);

    if (sameAsApplied) {
      void this.fetchInitial(next);
    } else {
      this.applied.set(next);
    }
  }

  private applyStateToDraft(state: AuditFilterState): void {
    this.exportRangeError.set(null);
    this.draftRange.set(state.range);
    this.draftMode.set(state.mode);
    this.draftQ.set(state.q);
    this.draftSourceApp.set(state.sourceApp);
    this.draftOutcome.set(state.outcome);
    this.draftSensitivity.set(state.sensitivity);
    this.draftActorUserId.set(state.actorUserId);
    this.draftBranchId.set(state.branchId);
    this.draftEntityType.set(state.entityType);
    this.draftAction.set(state.action);
    this.draftIncludeRequests.set(state.includeRequests);
    this.draftCorrelationId.set(state.correlationId);
  }

  private syncUrlParams(state: AuditFilterState): void {
    const queryParams: Record<string, string | null> = {
      from: state.range?.from || null,
      to: state.range?.to || null,
      show: state.mode === 'deleted' ? 'deleted' : null,
      q: state.mode === 'deleted' && state.q ? state.q : null,
      sourceApp: state.sourceApp || null,
      outcome: state.outcome || null,
      sensitivity: state.sensitivity || null,
      actorUserId: state.actorUserId || null,
      branchId: state.branchId || null,
      entityType: state.entityType || null,
      action: state.action || null,
      sourceKind: null,
      includeRequests: this.includeRequestsAvailable && state.includeRequests ? 'true' : null,
      correlationId: state.correlationId || null,
    };

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private widenRangeAroundEvent(createdAt: string): DateRangeValue {
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return defaultDateRange();
    }
    const eventDay = startOfDay(parsed);
    const targetFrom = subDays(eventDay, 1);
    const targetTo = addDays(eventDay, 1);

    const current = this.draftRange();
    if (current && validateDateRange(current) === null) {
      const parsedCurFrom = parseLocalDateTime(current.from, DEFAULT_FROM_TIME);
      const parsedCurTo = parseLocalDateTime(current.to, DEFAULT_TO_TIME);
      if (parsedCurFrom && parsedCurTo) {
        const curFrom = parsedCurFrom.date;
        const curTo = parsedCurTo.date;
        const widenedFrom = curFrom.getTime() < targetFrom.getTime() ? curFrom : targetFrom;
        const widenedTo = curTo.getTime() > targetTo.getTime() ? curTo : targetTo;
        if (countRangeDays(widenedFrom, widenedTo) <= AUDIT_LIMITS.maxRangeDays) {
          return {
            from: formatLocalDateTime(
              widenedFrom,
              widenedFrom.getTime() === curFrom.getTime() ? parsedCurFrom.time : DEFAULT_FROM_TIME,
            ),
            to: formatLocalDateTime(
              widenedTo,
              widenedTo.getTime() === curTo.getTime() ? parsedCurTo.time : DEFAULT_TO_TIME,
            ),
            preset: null,
          };
        }
      }
    }

    return {
      from: formatLocalDateTime(targetFrom, DEFAULT_FROM_TIME),
      to: formatLocalDateTime(targetTo, DEFAULT_TO_TIME),
      preset: null,
    };
  }

  private buildApiQuery(state: AuditFilterState, cursor?: string): AuditQuery | null {
    if (!state.range) return null;
    const isoRange = toApiIsoRange(state.range);
    if (!isoRange) return null;

    const q: AuditQuery = {
      limit: AUDIT_LIMITS.defaultLimit,
      from: isoRange.from,
      to: isoRange.to,
    };
    if (cursor) q.cursor = cursor;
    if (state.sourceApp) q.sourceApp = state.sourceApp;
    if (state.outcome) q.outcome = state.outcome;
    if (state.sensitivity) q.sensitivity = state.sensitivity;
    if (state.actorUserId) q.actorUserId = state.actorUserId;
    if (state.branchId) q.branchId = state.branchId;
    if (state.entityType) q.entityType = state.entityType;
    if (state.action) q.action = state.action;
    if (this.includeRequestsAvailable && state.includeRequests) q.includeRequests = true;
    if (state.correlationId) q.correlationId = state.correlationId;
    return q;
  }

  private async executeQuery(state: AuditFilterState, cursor?: string) {
    const query = this.buildApiQuery(state, cursor);
    if (!query) {
      return { items: [] as AuditEvent[], nextCursor: null };
    }
    if (state.mode === 'deleted') {
      const deletedQuery: AuditDeletedQuery = state.q ? { ...query, q: state.q } : query;
      return this.api.listDeletedRecords(deletedQuery);
    }
    return this.api.listAuditEvents(query);
  }

  private async fetchInitial(state: AuditFilterState): Promise<void> {
    if (!state.range || validateDateRange(state.range) !== null) {
      this.loading.set(false);
      this.loadFailed.set(false);
      this.rows.set([]);
      this.nextCursor.set(null);
      return;
    }

    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadingMore.set(false);
    this.loadFailed.set(false);
    this.loadCorrelationId.set(null);

    try {
      const page = await this.executeQuery(state);
      if (seq !== this.loadSeq) return;
      this.rows.set(page.items);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.handleLoadError(error);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private handleLoadError(error: unknown): void {
    const code = errorCodeOf(error);
    const forbidden = error instanceof ApiError && error.status === 403 &&
      !['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'].includes(code ?? '');
    this.forbidden.set(forbidden);
    this.loadFailed.set(!forbidden);
    this.loadCorrelationId.set(correlationIdOf(error));
    this.rows.set([]);
    this.nextCursor.set(null);
    if (error instanceof ApiError && (error.status === 429 ||
        ['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED', 'ACCESS_POLICY_UNAVAILABLE'].includes(code ?? ''))) {
      this.notify.error(this.resolveError(error));
    }
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoaded = true;
    try {
      const branches = await this.lookups.allBranches();
      if (!this.destroyRef.destroyed) this.branches.set(branches);
    } catch {
      this.lookupsLoaded = false;
    }
  }

  private buildExportContext(state: AuditFilterState): AuditExportContext | null {
    if (!state.range) return null;
    const isoRange = toApiIsoRange(state.range);
    if (!isoRange) return null;

    const query: AuditExportFilters = {
      from: isoRange.from,
      to: isoRange.to,
    };
    const filters: AuditExportFilterSummaryItem[] = [];

    if (state.mode === 'deleted') {
      query.deletedOnly = true;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.show'),
        value: this.transloco.translate('wsAudit.filters.showDeleted'),
      });
      if (state.q) {
        query.q = state.q;
        filters.push({
          label: this.transloco.translate('wsAudit.filters.deletedPrefix'),
          value: state.q,
        });
      }
    }
    if (state.sourceApp) {
      query.sourceApp = state.sourceApp;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.app'),
        value: this.transloco.translate(`wsAudit.apps.${state.sourceApp}`),
      });
    }
    if (state.outcome) {
      query.outcome = state.outcome;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.outcome'),
        value: this.transloco.translate(`wsAudit.outcomes.${state.outcome}`),
      });
    }
    if (state.sensitivity) {
      query.sensitivity = state.sensitivity;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.sensitivity'),
        value: this.transloco.translate(`wsAudit.sensitivities.${state.sensitivity}`),
      });
    }
    if (state.actorUserId) {
      query.actorUserId = state.actorUserId;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.user'),
        value: this.userNames().get(state.actorUserId) ?? state.actorUserId,
      });
    }
    if (state.branchId) {
      query.branchId = state.branchId;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.branch'),
        value: this.branchNames().get(state.branchId) ?? state.branchId,
      });
    }
    if (state.entityType) {
      query.entityType = state.entityType;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.entityType'),
        value: this.translateEntityType(state.entityType),
      });
    }
    if (state.action) {
      query.action = state.action;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.action'),
        value: state.action,
        ltr: true,
      });
    }
    if (this.includeRequestsAvailable && state.includeRequests) {
      query.includeRequests = true;
      filters.push({
        label: this.transloco.translate('wsAudit.filters.includeRequests'),
        value: this.transloco.translate('settings.common.yes'),
      });
    }
    if (state.correlationId) {
      query.correlationId = state.correlationId;
      filters.push({
        label: this.transloco.translate('wsAudit.modal.facts.correlationId'),
        value: state.correlationId,
        ltr: true,
      });
    }

    return {
      query,
      dateRangeLabel: `${this.formatDateTime(isoRange.from)} — ${this.formatDateTime(isoRange.to)}`,
      filters,
    };
  }

  private async processExportParam(exportId: string): Promise<void> {
    try {
      const job = await this.api.getAuditExport(exportId);
      if (this.destroyRef.destroyed) return;

      if (job.status === 'READY') {
        const blob = await this.api.downloadAuditExport(exportId);
        if (this.destroyRef.destroyed) return;
        this.triggerCsvDownload(blob, job.fileName || `audit-${exportId}.csv`);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { exportId: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      } else if (job.status === 'QUEUED' || job.status === 'RUNNING') {
        this.notify.info(this.transloco.translate('wsAudit.export.preparing'));
      } else if (job.status === 'FAILED') {
        const title = this.transloco.translate(auditExportErrorKey(job.errorCode));
        const text = job.correlationId
          ? this.transloco.translate('settings.common.correlationId', { id: job.correlationId })
          : '';
        this.notify.error(title, text);
      } else if (job.status === 'EXPIRED') {
        this.notify.error(this.transloco.translate('wsAudit.errors.AUDIT_EXPORT_EXPIRED'));
      }
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (error instanceof ApiError && error.status === 404) {
        this.notify.error(this.transloco.translate('wsAudit.export.notFound'));
      } else if (error instanceof ApiError && (error.status === 410 || error.code === 'AUDIT_EXPORT_EXPIRED')) {
        this.notify.error(this.transloco.translate('wsAudit.errors.AUDIT_EXPORT_EXPIRED'));
      } else {
        const corrId = correlationIdOf(error);
        const text = corrId ? this.transloco.translate('settings.common.correlationId', { id: corrId }) : '';
        this.notify.error(this.resolveError(error), text);
      }
    }
  }

  private triggerCsvDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const link = this.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      this.document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private resolveError(error: unknown): string {
    return errorMessage(error, 'wsAudit', this.transloco);
  }
}
