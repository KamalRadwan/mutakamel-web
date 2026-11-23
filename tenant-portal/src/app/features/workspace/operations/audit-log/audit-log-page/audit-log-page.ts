import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
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
import { listAllPages, listBranches, listUsers } from '../../../staff/shared/staff.api';
import { Branch, TenantUser } from '../../../staff/shared/staff.model';
import { StaffSession } from '../../../staff/shared/staff-session';
import { SessionFailedState } from '../../shared/session-failed-state/session-failed-state';
import { AuditEventModal } from '../audit-event-modal/audit-event-modal';
import {
  AUDIT_LIMITS,
  AUDIT_OUTCOMES,
  AUDIT_SENSITIVITIES,
  AUDIT_SOURCE_APPS,
  AuditDeletedQuery,
  AuditEvent,
  AuditOutcome,
  AuditQuery,
  AuditSensitivity,
  AuditSourceApp,
  AuditViewMode,
  ApiError,
  avatarToneForName,
  correlationIdOf,
  errorCodeOf,
  formatAuditDateTime,
  humanizeActionCode,
  initialsForName,
  listAuditEvents,
  listDeletedRecords,
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
    includeRequests: params.get('sourceKind') === 'HTTP_COMMAND',
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
    SessionFailedState,
    NgIcon,
    TranslocoPipe,
    AuditEventModal,
    Button,
    DateRange,
    Dropdown,
    Field,
    Segmented,
    Switch,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' }),
    provideIcons({
      tablerLock,
      tablerAlertTriangle,
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
  private readonly session = inject(StaffSession);

  protected readonly sessionFailed = computed(() => !this.session.me() && this.session.state() === 'failed');
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly eventModal = viewChild.required(AuditEventModal);

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

  protected readonly users = signal<TenantUser[]>([]);
  protected readonly branches = signal<Branch[]>([]);

  protected readonly canReadAudit = computed(() => {
    const me = this.session.me();
    // Until the session has loaded (or if loading failed) do not show the 403 state; the API decides.
    if (!me) return true;
    if (me.isTenantOwner) return true;
    if (this.session.isTenantWide('audit.read')) return true;
    const branchScope = me.permissionScopes['audit.read.branch'];
    if (branchScope && (branchScope.tenantWide || branchScope.branchIds.length > 0)) {
      return true;
    }
    return this.session.can('audit.read.own');
  });

  protected readonly isForbidden = computed(() => !this.canReadAudit() || this.forbidden());

  protected readonly dateRangeErrorKind = computed(() => validateDateRange(this.draftRange()));

  protected readonly dateRangeError = computed<string | null>(() => {
    this.i18n();
    const kind = this.dateRangeErrorKind();
    if (kind === 'required') return this.transloco.translate('wsAudit.validation.rangeRequired');
    if (kind === 'order') return this.transloco.translate('wsAudit.validation.rangeOrder');
    if (kind === 'max') return this.transloco.translate('wsAudit.validation.rangeMaxDays');
    return null;
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

  protected readonly userOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.users().map((user) => ({
      value: user.id,
      label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    }));
    const currentId = this.draftActorUserId();
    if (currentId && !list.some((opt) => opt.value === currentId)) {
      list.push({ value: currentId, label: currentId });
    }
    return [{ value: '', label: this.transloco.translate('wsAudit.filters.allUsers') }, ...list];
  });

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

  protected retrySession(): void {
    void this.session.load().catch(() => undefined);
  }

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }

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
    this.draftIncludeRequests.set(checked);
    this.commitDiscreteFilters();
  }

  protected onTextInput(which: 'q' | 'entityType' | 'action', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (which === 'q') this.draftQ.set(value);
    else if (which === 'entityType') this.draftEntityType.set(value);
    else this.draftAction.set(value);
  }

  protected clearTextField(which: 'q' | 'entityType' | 'action'): void {
    if (which === 'q') this.draftQ.set('');
    else if (which === 'entityType') this.draftEntityType.set('');
    else this.draftAction.set('');
    this.applyFilters();
  }

  protected applyFilters(): void {
    if (this.dateRangeErrorKind() !== null) return;
    const next: AuditFilterState = {
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
      includeRequests: this.draftIncludeRequests(),
      correlationId: this.draftCorrelationId(),
    };
    this.commitAndSync(next);
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
      includeRequests: event.sourceKind === 'HTTP_COMMAND',
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
      this.notify.error(this.resolveError(error));
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
    if (event.actorType !== 'USER') {
      return this.transloco.translate('wsAudit.actor.system');
    }
    if (event.actorLabel) return event.actorLabel;
    if (event.actorUserId) {
      return this.userNames().get(event.actorUserId) ?? event.actorUserId;
    }
    return this.transloco.translate('wsAudit.actor.system');
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

  private commitDiscreteFilters(): void {
    if (this.dateRangeErrorKind() !== null) return;
    const prev = this.applied();
    const next: AuditFilterState = {
      range: this.draftRange(),
      mode: this.draftMode(),
      q: this.draftMode() === 'deleted' ? prev.q : '',
      sourceApp: SOURCE_APP_SET.has(this.draftSourceApp()) ? (this.draftSourceApp() as AuditSourceApp) : '',
      outcome: OUTCOME_SET.has(this.draftOutcome()) ? (this.draftOutcome() as AuditOutcome) : '',
      sensitivity: SENSITIVITY_SET.has(this.draftSensitivity())
        ? (this.draftSensitivity() as AuditSensitivity)
        : '',
      actorUserId: this.draftActorUserId(),
      branchId: this.draftBranchId(),
      entityType: prev.entityType,
      action: prev.action,
      includeRequests: this.draftIncludeRequests(),
      correlationId: this.draftCorrelationId(),
    };
    this.commitAndSync(next);
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
      sourceKind: state.includeRequests ? 'HTTP_COMMAND' : null,
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
    if (state.includeRequests) q.sourceKind = 'HTTP_COMMAND';
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
      return listDeletedRecords(deletedQuery);
    }
    return listAuditEvents(query);
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
      const code = errorCodeOf(error);
      if ((error instanceof ApiError && error.status === 403) || code === 'MISSING_REQUIRED_PERMISSIONS') {
        this.forbidden.set(true);
        this.rows.set([]);
        this.nextCursor.set(null);
        return;
      }
      this.loadFailed.set(true);
      this.loadCorrelationId.set(correlationIdOf(error));
      this.rows.set([]);
      this.nextCursor.set(null);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadLookups(): Promise<void> {
    const [usersRes, branchesRes] = await Promise.allSettled([
      listAllPages(listUsers, { limit: 100 }),
      listAllPages(listBranches, { limit: 100 }),
    ]);
    if (usersRes.status === 'fulfilled') {
      this.users.set(usersRes.value);
    }
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    this.lookupsLoaded =
      usersRes.status === 'fulfilled' && branchesRes.status === 'fulfilled';
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const key = `wsAudit.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) return translated;
    }
    return this.transloco.translate('wsAudit.errors.generic');
  }
}
