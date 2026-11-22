import type {
  ExecutionState,
  P2Unit,
  Panel,
  PanelCoverage,
  PanelOutcome,
  PanelState,
  P2Result,
  Reference,
  RunBudget,
  WidgetExecution,
} from './analytics.model';
import { ApiError } from './analytics-api';

/** 429: one user may have 3 runs, previews and drill-downs at once. Never a blocking error. */
export const RUN_CONCURRENCY_CODE = 'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED';

export type ViewStatus = 'loading' | PanelState;

export interface PanelView {
  status: ViewStatus;
  execution: WidgetExecution | null;
  reasonCode: string | null;
  sourceKey: string | null;
  coverage: PanelCoverage | null;
  receiptId: string | null;
  computedAt: string | null;
  experimental: boolean;
  /** Warning codes of the panel (meta.warnings plus run-level ones), for the widget hint. */
  warnings?: readonly string[];
  /** meta.partialAccess: some branches were left out because the user cannot read them. */
  partialAccess?: boolean;
  /** Still loading after a 429: the run waits and retries (shown as "retrying"). */
  retrying?: boolean;
}

export const LOADING_VIEW: PanelView = {
  status: 'loading',
  execution: null,
  reasonCode: null,
  sourceKey: null,
  coverage: null,
  receiptId: null,
  computedAt: null,
  experimental: false,
};

export const KNOWN_REASONS: readonly string[] = [
  'SOURCE_NOT_READY',
  'PERMISSION_REQUIRED',
  'METRIC_RETIRED',
  'METRIC_UNAVAILABLE',
  'BUDGET_EXHAUSTED',
  'CRM_DASHBOARD_STATEMENT_TIMEOUT',
  'CRM_SCOPED_PERMISSION_DENIED',
  'METRIC_EXECUTION_FAILED',
  'NO_METRICS',
  'LEGACY_UNAVAILABLE',
  'SOURCE_UNKNOWN',
  'NOT_FROZEN',
  'HISTORY_INCOMPLETE',
  'CALENDAR_HOURS_MISSING',
  'CALENDAR_UNAVAILABLE',
  'NO_BASELINE',
  'TERRITORY_CONFIG_MISSING',
  'REQUIRED_ROLE_POLICY_MISSING',
  'NET_AMOUNT_NOT_PUBLISHED',
  'PDF_RENDERER_UNAVAILABLE',
  'CAPTURE_NOT_DEPLOYED',
  'NO_ACTIVE_POLICY',
  'CONFIG_NOT_DESIGNED',
  'MODULE_NOT_RELEASED',
  'VIEW_NOT_RELEASED',
  'TRIGGER_NOT_RELEASED',
  'PROVIDER_WEBHOOK_MISSING',
  'READ_MODEL_NOT_DEPLOYED',
  'GRANT_PENDING',
  'RELATION_MISSING',
  'WIDGET_ACCESS_REVOKED',
  'WIDGET_PERMISSION_REQUIRED',
  'WIDGET_DELETED',
  'WIDGET_ARCHIVED',
  'WIDGET_NOT_PUBLISHED',
  'WIDGET_VERSION_UNAVAILABLE',
  'FILTER_TREE_NOT_APPLIED',
  'CROSS_FILTER_NOT_APPLICABLE',
  'UNAVAILABLE_WIDGETS_OMITTED',
  'SOURCE_PERMISSION_REQUIRED',
  'APPLICATION_NOT_SUBSCRIBED',
  'APPLICATION_SUSPENDED',
  'FEATURE_NOT_INCLUDED',
  'APPLICATION_UNAVAILABLE',
  'OTHER_CURRENCIES',
  'TARGET_NOT_SET',
  'RUN_BUDGET_CLIPPED',
  'UNKNOWN',
];

export const KNOWN_ERRORS: readonly string[] = [
  'GENERIC',
  'NETWORK',
  'CRM_VALIDATION_FAILED',
  'REQUEST_PAYLOAD_BOUNDS_EXCEEDED',
  'CRM_DASHBOARD_REVISION_MISMATCH',
  'CRM_DASHBOARD_LIST_CURSOR_INVALID',
  'CRM_DASHBOARD_DRILLDOWN_CURSOR_INVALID',
  'GW.IDEM.MISSING',
  'GW.IDEM.BAD_VALUE',
  'GW.IDEM.MISMATCH',
  'GW.IDEM.IN_FLIGHT',
  'GW.IDEM.UNAVAILABLE',
  'GW.REQUEST.INVALID',
  'GW.RATE.LIMIT_EXCEEDED',
  'GW.UPSTREAM.UNAVAILABLE',
  'CRM_DASHBOARD_FILTER_INVALID',
  'CRM_DASHBOARD_DATE_RANGE_EXCEEDED',
  'CRM_DASHBOARD_RUN_PANEL_LIMIT_EXCEEDED',
  'CRM_DASHBOARD_WIDGET_SELECTION_INVALID',
  'CRM_DASHBOARD_WIDGET_LIMIT_EXCEEDED',
  'CRM_DASHBOARD_LAYOUT_POSITION_INVALID',
  'CRM_DASHBOARD_LAYOUT_SIZE_INVALID',
  'CRM_DASHBOARD_BREAKPOINT_UNKNOWN',
  'CRM_DASHBOARD_TEMPLATE_INVALID',
  'CRM_DASHBOARD_PLACEMENT_VERSION_INVALID',
  'CRM_DASHBOARD_PLACEMENT_LIMIT',
  'CRM_DASHBOARD_DRILLDOWN_UNSUPPORTED',
  'CRM_DASHBOARD_DRILLDOWN_SELECTION_INVALID',
  'CRM_DASHBOARD_DRILLDOWN_CURRENCY_REQUIRED',
  'CRM_DASHBOARD_DRILLDOWN_DATE_RANGE_INVALID',
  'CRM_WIDGET_VISUALIZATION_INVALID',
  'CRM_WIDGET_SHAPE_INCOMPATIBLE',
  'CRM_WIDGET_SERIES_INVALID',
  'CRM_WIDGET_UNITS_INCOMPATIBLE',
  'CRM_WIDGET_AXIS_REQUIRED',
  'CRM_WIDGET_TARGET_REQUIRED',
  'CRM_WIDGET_TARGET_INVALID',
  'CRM_WIDGET_COMPARISON_UNSUPPORTED',
  'CRM_WIDGET_COMPARISON_DATASETS_INVALID',
  'CRM_WIDGET_TIME_GRAIN_REQUIRED',
  'CRM_WIDGET_DIMENSION_INVALID',
  'CRM_WIDGET_FILTER_INVALID',
  'CRM_WIDGET_FILTER_TOO_COMPLEX',
  'CRM_WIDGET_METRIC_INVALID',
  'CRM_WIDGET_ENGINE_INVALID',
  'CRM_WIDGET_DRAFT_INVALID',
  'CRM_WIDGET_PUBLISH_INVALID',
  'CRM_WIDGET_LIFECYCLE_INVALID',
  'CRM_WIDGET_VERSION_RESTORE_INVALID',
  'CRM_WIDGET_UNAVAILABLE',
  'CRM_WIDGET_TRANSFER_INVALID',
  'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE',
  'CRM_REPORT_PANEL_NOT_PAGEABLE',
  'CRM_REPORT_PANEL_NOT_PINNABLE',
  'CRM_TARGET_METRIC_NOT_TARGETABLE',
  'CRM_TARGET_CURRENCY_INVALID',
  'CRM_TARGET_VALUE_INVALID',
  'CRM_TARGET_PERIOD_INVALID',
  'CRM_TARGET_SUBJECT_INVALID',
  'CRM_TARGET_MEASURE_INVALID',
  'CRM_TARGET_TEAM_SET_INVALID',
  'CRM_TARGET_CORRECTION_REASON_REQUIRED',
  'CRM_TARGET_REJECT_NOTE_REQUIRED',
  'CRM_WORKING_CALENDAR_INVALID',
  'CRM_CALENDAR_HOURS_INVALID',
  'CRM_CALENDAR_TIME_ZONE_INVALID',
  'CRM_CALENDAR_WINDOW_OVERLAP',
  'CRM_SLA_POLICY_SHAPE_INVALID',
  'CRM_SLA_POLICY_QUALIFIER_UNKNOWN',
  'CRM_SLA_POLICY_BACKDATED',
  'CRM_SLA_BACKDATED',
  'CRM_SLA_QUALIFIER_UNKNOWN',
  'CRM_SLA_CLOCK_RANGE_EXCEEDED',
  'CRM_ALERT_UNIT_MISMATCH',
  'CRM_ALERT_SCHEDULE_INVALID',
  'CRM_ALERT_RECIPIENTS_INVALID',
  'CRM_SUBSCRIPTION_SCHEDULE_INVALID',
  'CRM_SUBSCRIPTION_RECIPIENTS_INVALID',
  'CRM_SUBSCRIPTION_ATTACHMENT_TTL_INVALID',
  'CRM_SUBSCRIPTION_TARGET_INVALID',
  'CRM_EXPORT_FORMAT_INVALID',
  'CRM_EXPORT_TARGET_INVALID',
  'CRM_ACCESS_REQUEST_ALREADY_GRANTED',
  'CRM_ACCESS_REQUEST_GRANT_EXCEEDS_REQUEST',
  'CRM_ACCESS_REQUEST_NOTE_REQUIRED',
  'CRM_SHARE_UPDATE_EMPTY',
  'CRM_SHARE_REVOKE_REASON_REQUIRED',
  'CRM_SHARE_EXPIRY_INVALID',
  'CRM_SHARE_SELF_INVALID',
  'CRM_SHARE_TARGET_INVALID',
  'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID',
  'CRM_OWNERSHIP_TARGET_INACTIVE',
  'CRM_DASHBOARD_DB_INVALID',
  'CRM_DASHBOARD_ACTOR_INVALID',
  'CRM_SCOPED_PERMISSION_DENIED',
  'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED',
  'CRM_DASHBOARD_DRILLDOWN_SOURCE_ACCESS_DENIED',
  'CRM_WIDGET_PUBLISH_FORBIDDEN',
  'CRM_WIDGET_LIFECYCLE_FORBIDDEN',
  'CRM_WIDGET_TRANSFER_FORBIDDEN',
  'CRM_WIDGET_VERSION_RESTORE_FORBIDDEN',
  'CRM_ALERT_OWNER_ACCESS_LOST',
  'CRM_SUBSCRIPTION_OWNER_ACCESS_LOST',
  'CRM_SUBSCRIPTION_BLOCKED',
  'CRM_SUBSCRIPTION_READ_ONLY',
  'CRM_DASHBOARD_NOT_FOUND',
  'CRM_DASHBOARD_BLUEPRINT_NOT_FOUND',
  'CRM_DASHBOARD_PLACEMENT_NOT_FOUND',
  'CRM_DASHBOARD_RESOURCE_NOT_FOUND',
  'CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND',
  'CRM_WIDGET_NOT_FOUND',
  'CRM_WIDGET_VERSION_NOT_FOUND',
  'CRM_TARGET_NOT_FOUND',
  'CRM_REPORT_NOT_FOUND',
  'CRM_READINESS_SOURCE_UNKNOWN',
  'CRM_ALERT_NOT_FOUND',
  'CRM_SUBSCRIPTION_NOT_FOUND',
  'CRM_EXPORT_NOT_FOUND',
  'CRM_ACCESS_REQUEST_NOT_FOUND',
  'CRM_OWNER_REVIEW_NOT_FOUND',
  'CRM_SHARE_NOT_FOUND',
  'CRM_EXPORT_EXPIRED',
  'CRM_EXPORT_QUEUE_LIMIT',
  'CRM_DASHBOARD_LAYOUT_OVERLAP',
  'CRM_DASHBOARD_LAYOUT_LOCKED',
  'CRM_DASHBOARD_NAME_CONFLICT',
  'CRM_DASHBOARD_WIDGET_ALREADY_ADDED',
  'CRM_DASHBOARD_WIDGET_LIMIT',
  'CRM_DASHBOARD_OWNER_LIMIT',
  'CRM_WIDGET_OWNER_LIMIT',
  'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED',
  'CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED',
  'CRM_DASHBOARD_BLUEPRINT_TARGET_CONFIRMATION_REQUIRED',
  'CRM_DASHBOARD_BLUEPRINT_ADOPTION_LIMIT',
  'CRM_DASHBOARD_PLACEMENT_VERSION_STALE',
  'CRM_WIDGET_DRAFT_CONFLICT',
  'CRM_WIDGET_DRAFT_BASE_CONFLICT',
  'CRM_WIDGET_PUBLISH_IMPACT_STALE',
  'CRM_WIDGET_LIFECYCLE_IMPACT_STALE',
  'CRM_WIDGET_TRANSFER_IMPACT_STALE',
  'CRM_WIDGET_VERSION_RESTORE_STALE',
  'CRM_WIDGET_VERSION_CONFLICT',
  'CRM_WIDGET_PUBLISH_IDEMPOTENCY_MISMATCH',
  'CRM_TARGET_DUPLICATE',
  'CRM_TARGET_NOT_DRAFT',
  'CRM_TARGET_LOCKED_SUBMITTED',
  'CRM_TARGET_NOT_SUBMITTED',
  'CRM_TARGET_PERIOD_CLOSED',
  'CRM_TARGET_PERIOD_OPEN',
  'CRM_TARGET_SECOND_CURRENCY_AFTER_R2',
  'CRM_ALERT_SUSPENDED',
  'CRM_ALERT_SOURCE_UNAVAILABLE',
  'CRM_SUBSCRIPTION_SUSPENDED',
  'CRM_EXPORT_NOT_READY',
  'CRM_EXPORT_NOT_CANCELLABLE',
  'CRM_EXPORT_PERMISSION_CHANGED',
  'CRM_ACCESS_REQUEST_PENDING_EXISTS',
  'CRM_ACCESS_REQUEST_EXPIRED',
  'CRM_SHARE_MANAGE_NOT_ENABLED',
  'CRM_OWNER_REVIEW_NOT_OPEN',
  'CRM_DASHBOARD_REVISION_CONFLICT',
  'CRM_DASHBOARD_LAYOUT_STALE',
  'CRM_WIDGET_REVISION_CONFLICT',
  'CRM_TARGET_REVISION_CONFLICT',
  'CRM_WORKING_CALENDAR_REVISION_CONFLICT',
  'CRM_ALERT_REVISION_STALE',
  'CRM_SUBSCRIPTION_REVISION_STALE',
  'CRM_EXPORT_REVISION_STALE',
  'CRM_ACCESS_REQUEST_REVISION_STALE',
  'CRM_OWNER_REVIEW_REVISION_STALE',
  'CRM_SLA_POLICY_STALE',
  'CRM_TEAM_SCOPE_NOT_READY',
  'CRM_TARGET_SOURCE_NOT_READY',
  'CRM_DASHBOARD_BLUEPRINTS_NOT_READY',
  'CRM_DASHBOARD_STATEMENT_TIMEOUT',
  'CRM_WIDGET_DISPLAY_INVALID',
  'CRM_SHARE_PREVIEW_LIMIT_EXCEEDED',
  'CRM_DASHBOARD_RUN_CONCURRENCY_EXCEEDED',
  'CRM_DASHBOARD_SPEC_SIZE_VIOLATION',
  // Guards, idempotency and service codes the dashboard and report pages can also meet.
  'CRM_PERMISSION_DENIED',
  'CRM_IDEMPOTENCY_KEY_INVALID',
  'CRM_IDEMPOTENCY_KEY_REUSED',
  'CRM_IDEMPOTENCY_IN_FLIGHT',
  'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
  'CRM_RECEIPT_NOT_FOUND',
  'CRM_RECEIPT_EXPIRED',
  'CRM_EXPLAIN_NOT_COMPARABLE',
  'CRM_FEATURE_DISABLED',
  'CRM_MODULE_DISABLED',
  'CRM_MODULE_SEAT_REQUIRED',
  'SEAT_OVER_CAPACITY_READ_ONLY',
  'BRANCH_ACCESS_DENIED',
  'BRANCH_PERMISSION_DENIED',
  'BRANCH_CONTEXT_REQUIRED',
  'CRM_DASHBOARD_DB_CONFLICT',
  'CRM_DASHBOARD_PLACEMENT_HISTORY_FORBIDDEN',
  'CRM_DASHBOARD_PLACEMENT_LAYOUT_LIMIT',
  'CRM_DASHBOARD_PLACEMENT_REVISION_LIMIT',
  'CRM_DASHBOARD_PLACEMENT_VERSION_FAILED',
  'CRM_DASHBOARD_TEMPLATE_BATCH_INSERT_FAILED',
  'CRM_DASHBOARD_WIDGET_PREPARATION_FAILED',
  'CRM_DASHBOARD_DRILLDOWN_PLAN_INVALID',
  'CRM_DASHBOARD_DRILLDOWN_RESULT_INVALID',
  'CRM_ACQUISITION_REPORT_UNAVAILABLE',
  'CRM_WIDGET_DRAFT_REVISION_LIMIT',
  'CRM_WIDGET_DRAFT_SAVE_FAILED',
  'CRM_WIDGET_EXECUTION_FAILED',
  'CRM_WIDGET_LIFECYCLE_CONSUMER_LIMIT',
  'CRM_WIDGET_LIFECYCLE_FAILED',
  'CRM_WIDGET_LIFECYCLE_REVISION_LIMIT',
  'CRM_WIDGET_PUBLICATION_CONSUMER_LIMIT',
  'CRM_WIDGET_PUBLICATION_LAYOUT_LIMIT',
  'CRM_WIDGET_PUBLICATION_REVISION_LIMIT',
  'CRM_WIDGET_PUBLISH_FAILED',
  'CRM_WIDGET_TRANSFER_FAILED',
  'CRM_WIDGET_TRANSFER_IMPACT_LIMIT',
  'CRM_WIDGET_TRANSFER_REVISION_LIMIT',
  'CRM_WIDGET_VERSION_RESTORE_DRAFT_EXISTS',
  'CRM_WIDGET_VERSION_RESTORE_FAILED',
  'CRM_REASON_REQUIRED',
];

const KNOWN_REASON_SET = new Set<string>(KNOWN_REASONS);
const KNOWN_ERROR_SET = new Set<string>(KNOWN_ERRORS);

function splitCode(code: string | null): { base: string | null; suffix: string | null } {
  if (!code) return { base: null, suffix: null };
  const idx = code.indexOf(':');
  if (idx === -1) return { base: code, suffix: null };
  const base = code.slice(0, idx) || null;
  const suffix = code.slice(idx + 1) || null;
  return { base, suffix };
}

export function executionStateToPanel(s: ExecutionState): PanelState {
  switch (s) {
    case 'READY':
      return 'READY';
    case 'EMPTY':
      return 'EMPTY';
    case 'RETIRED':
      return 'RETIRED';
    case 'DEADLINE_EXCEEDED':
      return 'TIMEOUT';
    case 'FAILED':
      return 'ERROR';
    default:
      return (s as string) === 'DENIED' ? 'DENIED' : 'UNAVAILABLE';
  }
}

function decorateExecution(exec: WidgetExecution, extraWarnings?: readonly string[]): WidgetExecution {
  const manualRefs = exec.meta.references ?? [];
  const mergedWarnings = extraWarnings?.length
    ? Array.from(new Set([...(exec.meta.warnings ?? []), ...extraWarnings]))
    : exec.meta.warnings;

  const needsRefs = manualRefs.length > 0;
  const needsWarnings = Boolean(extraWarnings?.length && mergedWarnings.length !== (exec.meta.warnings ?? []).length);
  if (!needsRefs && !needsWarnings) {
    return exec;
  }

  const mappedRefs: Reference[] = manualRefs.map((ref, i) => ({
    key: `manual-${i}`,
    label: ref.label,
    kind: 'BENCHMARK' as const,
    value: ref.value,
    unit: ref.unit as P2Unit,
    ...(ref.unit === 'MONEY' && exec.meta.currency ? { currencyCode: exec.meta.currency } : {}),
  }));
  const meta = needsWarnings ? { ...exec.meta, warnings: mergedWarnings } : exec.meta;
  if (!needsRefs) {
    return { ...exec, meta };
  }

  const result = exec.result;
  if (result && 'shape' in result && resultTakesReferences(result)) {
    return { ...exec, meta, result: { ...result, references: appendRefs(result.references, mappedRefs) } };
  }
  // Series-based (legacy) executions carry no P2 result: the cartesian builder reads exec.references.
  return { ...exec, meta, references: appendRefs(exec.references, mappedRefs) };
}

type ReferenceResult = Extract<P2Result, { references?: Reference[] }>;

function resultTakesReferences(result: P2Result): result is ReferenceResult {
  return result.shape === 'HIERARCHY' || result.shape === 'BINNED_DISTRIBUTION' || result.shape === 'WATERFALL';
}

/** Appends manual references to the existing ones; a manual ref already present (same key) is not repeated. */
function appendRefs(existing: readonly Reference[] | undefined, manual: readonly Reference[]): Reference[] {
  const base = existing ?? [];
  return [...base, ...manual.filter((m) => !base.some((r) => r.key === m.key))];
}

const APPLICATION_STATES: readonly string[] = [
  'APPLICATION_NOT_SUBSCRIBED',
  'APPLICATION_SUSPENDED',
  'FEATURE_NOT_INCLUDED',
];

function hasNoValues(exec: WidgetExecution | null): boolean {
  if (!exec) return true;
  if (exec.value != null || exec.rows?.length || exec.result) return false;
  return !exec.series.some((s) => s.points.some((p) => p.value != null));
}

/**
 * Applies the panel meta rules: an application state shows "unavailable" with the reason and no numbers;
 * SOURCE_PERMISSION_REQUIRED with no data shows the permission state; meta.partialAccess becomes a flag.
 */
function refineView(view: PanelView, runWarnings: readonly string[] = []): PanelView {
  const exec = view.execution;
  const warnings = Array.from(new Set([...(exec?.meta.warnings ?? []), ...runWarnings]));
  const availability = exec?.meta.availability;
  const resultPartial = exec?.result && 'partialAccess' in exec.result ? exec.result.partialAccess : false;
  const partialAccess = Boolean(exec?.meta.partialAccess || resultPartial);
  const base: PanelView = { ...view, warnings, partialAccess };

  if (availability && APPLICATION_STATES.includes(availability)) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      execution: null,
      reasonCode: availability,
      sourceKey: null,
      warnings: Array.from(new Set([...warnings, 'APPLICATION_UNAVAILABLE'])),
    };
  }
  if (
    warnings.includes('SOURCE_PERMISSION_REQUIRED') &&
    (view.status === 'READY' || view.status === 'PARTIAL' || view.status === 'EMPTY') &&
    hasNoValues(exec)
  ) {
    return { ...base, status: 'DENIED', reasonCode: 'SOURCE_PERMISSION_REQUIRED', sourceKey: null };
  }
  return base;
}

/** Translation keys of the warnings worth showing next to a ready panel (unknown codes are skipped). */
export function warningReasonKeys(view: PanelView): string[] {
  return (view.warnings ?? [])
    .filter((code) => KNOWN_REASON_SET.has(code) && code !== 'UNKNOWN')
    .map((code) => `analytics.reason.${code}`);
}

export function viewFromRun(exec: WidgetExecution, outcome?: PanelOutcome, budget?: RunBudget): PanelView {
  const clipped =
    budget?.deadlineExceeded && (exec.state === 'READY' || exec.state === 'DEADLINE_EXCEEDED')
      ? ['RUN_BUDGET_CLIPPED']
      : [];
  return refineView(rawViewFromRun(exec, outcome), clipped);
}

function rawViewFromRun(exec: WidgetExecution, outcome?: PanelOutcome): PanelView {
  const execution = decorateExecution(exec, outcome?.warnings);
  if (outcome) {
    const reasonCode = outcome.unavailable?.reasonCode ?? execution.error?.code ?? null;
    const { suffix } = splitCode(reasonCode);
    return {
      status: outcome.state,
      execution,
      reasonCode,
      sourceKey: outcome.unavailable?.sourceKey ?? execution.error?.sourceKey ?? suffix,
      coverage: outcome.coverage ?? null,
      receiptId: outcome.receiptId ?? null,
      computedAt: outcome.computedAt ?? execution.meta.generatedAt ?? null,
      experimental: outcome.experimental ?? false,
    };
  }
  const reasonCode = execution.error?.code ?? null;
  const { suffix } = splitCode(reasonCode);
  return {
    status: executionStateToPanel(execution.state),
    execution,
    reasonCode,
    sourceKey: execution.error?.sourceKey ?? suffix,
    coverage: null,
    receiptId: null,
    computedAt: execution.meta.generatedAt ?? null,
    experimental: false,
  };
}

export function viewFromPanel(panel: Panel): PanelView {
  return refineView(rawViewFromPanel(panel));
}

function rawViewFromPanel(panel: Panel): PanelView {
  const exec = panel.result ? decorateExecution(panel.result) : null;
  const reasonCode = panel.unavailable?.reasonCode ?? exec?.error?.code ?? null;
  const { suffix } = splitCode(reasonCode);
  return {
    status: panel.state,
    execution: exec,
    reasonCode,
    sourceKey: panel.unavailable?.sourceKey ?? exec?.error?.sourceKey ?? suffix,
    coverage: panel.coverage ?? null,
    receiptId: panel.receiptId ?? null,
    computedAt: panel.computedAt ?? exec?.meta.generatedAt ?? null,
    experimental: panel.experimental ?? false,
  };
}

export function isRetryable(v: PanelView): boolean {
  return v.status === 'TIMEOUT' || v.status === 'ERROR';
}

/** True for the friendly "too many runs at once" state (429), retried after a short delay. */
export function isThrottled(v: PanelView): boolean {
  return v.status === 'ERROR' && v.reasonCode === RUN_CONCURRENCY_CODE;
}

export function reasonKey(code: string | null): string {
  const { base } = splitCode(code);
  const resolved = base && KNOWN_REASON_SET.has(base) ? base : 'UNKNOWN';
  return `analytics.reason.${resolved}`;
}

export function errorKey(code: string | null): string {
  const { base } = splitCode(code);
  const resolved = base && KNOWN_ERROR_SET.has(base) ? base : 'GENERIC';
  return `analytics.error.${resolved}`;
}

function firstDetail(error: ApiError, key: string): string | null {
  const value = (error.details as Record<string, unknown> | undefined)?.[key];
  const first = Array.isArray(value) ? value[0] : undefined;
  return typeof first === 'string' && first.trim() ? first.trim() : null;
}

/**
 * The text of an error, using the string details its code carries (5xx carry none):
 * CRM_DASHBOARD_DATE_RANGE_EXCEEDED `maxDays` ("up to N days"), CRM_EXPORT_FORMAT_INVALID `reason`.
 * Anything else, or a detail that is missing or malformed, falls back to `errorKey(code)`.
 */
export function errorText(error: unknown): { key: string; params?: Record<string, string> } {
  const code = error instanceof ApiError ? error.code : null;
  if (!(error instanceof ApiError) || error.status >= 500) return { key: errorKey(code) };
  if (code === 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED') {
    const maxDays = firstDetail(error, 'maxDays');
    if (maxDays && /^\d+$/.test(maxDays)) return { key: 'analytics.errorDetail.dateRangeMax', params: { maxDays } };
  }
  if (code === 'CRM_EXPORT_FORMAT_INVALID') {
    const reason = firstDetail(error, 'reason');
    if (reason === 'pdf_renderer_unavailable') return { key: reasonKey('PDF_RENDERER_UNAVAILABLE') };
    if (reason === 'spec_too_large') return { key: 'analytics.errorDetail.exportSpecTooLarge' };
  }
  return { key: errorKey(code) };
}
