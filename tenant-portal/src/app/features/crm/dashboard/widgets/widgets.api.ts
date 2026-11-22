import {
  ApiError,
  type CursorPage,
  FAKE_NOW,
  cursorPageOf,
  fakeDelay,
  fakeDelayFor,
  fakeId,
  withRunSlot,
  pageOf,
} from '../../../../shared/widgets/dashboard/analytics-api';
import type { CatalogMetric, CatalogVisualization, ManualReference, SharePreview } from '../../../../shared/widgets/dashboard/analytics.model';
import { can, scopeLevels } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE, FAKE_TEAMS, fakeLang } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { fakeReceipt } from '../../../../shared/widgets/dashboard/fake/fake-receipts';
import {
  applyFakeCalculation,
  applyFakeFilterTreeScaling,
  applyFakeTeamDatasets,
  fakeExecution,
  fakeSharePreview,
} from '../../../../shared/widgets/dashboard/fake/fake-results';
import {
  allowedDatasetBasesForMetric,
  compatibleOperands,
  effectiveSeriesUnit,
} from './builder/builder-schemas';
import {
  FILTER_TREE_LIMITS,
  collectFilterLeaves,
  countFilterLeaves,
  filterTreeBytes,
  filterTreeDepth,
  filterTreeMetricKeys,
  filterTreeRecordType,
  isKnownFilterField,
  maxInListLength,
} from './builder/filter-tree';
import { WIDGET_STORE, type StoredWidget } from '../shared/widget-store.fake';
import { issueDetails } from '../shared/api-error-details';
import { DASHBOARD_STORE } from '../dashboards/dashboards.fake';
import {
  CLONE_IDEM,
  CREATE_IDEM,
  IMPACT_TTL_MS,
  INACTIVE_USER_IDS,
  LIFECYCLE_IMPACTS,
  PUBLISH_IDEM,
  PUBLISH_IMPACTS,
  RESTORE_IMPACTS,
  SHARE_IDEM,
  TRANSFER_IMPACTS,
  dashboardMeta,
  applyFakeSpecEffects,
  deleteUsage,
  deriveSourceResources,
  ensureUsageFor,
  fakeAlertRulesFor,
  fakeGovernedTargets,
  fakePublishDependentsFor,
  getUsageSummaryCounts,
  impactExpiresIso,
  initEmptyUsage,
  localizedDashboardName,
  personName,
  personTeamId,
} from './widgets.fake';
import type {
  ApplyLifecycleBody,
  ApplyLifecycleResult,
  DashboardFilters,
  DisplaySpec,
  DraftState,
  GovernedTargetOption,
  LifecycleImpact,
  LifecycleImpactBody,
  PanelOutcome,
  PublishImpact,
  PublishImpactBody,
  PublishWidgetBody,
  PublishWidgetResult,
  QuerySpec,
  RestoreVersionBody,
  RestoreVersionResult,
  Share,
  ShareListItem,
  TransferImpact,
  TransferImpactBody,
  TransferWidgetBody,
  TransferWidgetHead,
  TransferWidgetResult,
  VersionCompare,
  VersionSnapshot,
  Visualization,
  WidgetBody,
  WidgetDetail,
  WidgetExecution,
  WidgetListQuery,
  WidgetSourceResource,
  WidgetStatus,
  WidgetSummary,
  WidgetTabCounts,
  WidgetVersionsPage,
} from './widgets.model';

function findStoredWidget(id: string): StoredWidget {
  const widget = WIDGET_STORE.find((item) => item.summary.id === id);
  if (!widget || !isVisibleToViewer(widget)) {
    throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
  }
  return widget;
}

function isVisibleToViewer(widget: StoredWidget): boolean {
  const s = widget.summary;
  if (s.status === 'PUBLISHED') return true;
  if (s.ownerUserId === FAKE_ME.id) return true;
  if (s.isShared) return true;
  const myTeamId = personTeamId(FAKE_ME.id);
  return widget.shares.some(
    (share) =>
      (share.subjectType === 'USER' && share.subjectId === FAKE_ME.id) ||
      (share.subjectType === 'TEAM' && myTeamId !== null && share.subjectId === myTeamId),
  );
}

function isSharedWithViewer(widget: StoredWidget): boolean {
  const s = widget.summary;
  if (s.ownerUserId === FAKE_ME.id) return false;
  const myTeamId = personTeamId(FAKE_ME.id);
  const directGrant = widget.shares.some(
    (share) =>
      (share.subjectType === 'USER' && share.subjectId === FAKE_ME.id) ||
      (share.subjectType === 'TEAM' && myTeamId !== null && share.subjectId === myTeamId),
  );
  return directGrant || s.isShared;
}

function localizedSummary(summary: WidgetSummary): WidgetSummary {
  return {
    ...summary,
    ownerName: personName(summary.ownerUserId, summary.ownerName),
  };
}

function compareNewest(a: WidgetSummary, b: WidgetSummary): number {
  const byUpdate = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdate !== 0) return byUpdate;
  const byCreate = b.createdAt.localeCompare(a.createdAt);
  if (byCreate !== 0) return byCreate;
  return b.id.localeCompare(a.id);
}

function hasWriteAccess(widget: StoredWidget): boolean {
  return widget.summary.accessLevel === 'OWNER' || widget.summary.accessLevel === 'EDIT';
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Gateway check on the WRITE_SENSITIVE rows (create, clone, shares). */
/** Lifecycle (archive/restore): widget OWNER plus `crm.widgets.delete` (dashboard-widget-lifecycle.service.ts authorize()). */
function assertLifecycleAccess(widget: StoredWidget): void {
  if (!can('crm.widgets.delete') || widget.summary.accessLevel !== 'OWNER') {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
}

function dashboardOwnerId(dashboardId: string): string {
  return DASHBOARD_STORE.find((entry) => entry.detail.id === dashboardId)?.detail.ownerUserId ?? FAKE_ME.id;
}

function transferHead(widget: StoredWidget): TransferWidgetHead {
  return {
    id: widget.summary.id,
    ownerUserId: widget.summary.ownerUserId,
    ownerName: widget.summary.ownerName,
    name: localizedSummary(widget.summary).name,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    activeVersionNumber: widget.summary.versionNumber,
    draftRevision: widget.draft?.revision ?? null,
    archived: widget.summary.status === 'ARCHIVED',
  };
}

function requireValidIdemKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7.test(trimmed)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  return trimmed.toLowerCase();
}

/** Publish reads x-idempotency-key itself: a missing or non-UUIDv7 key is 422 CRM_WIDGET_PUBLISH_INVALID. */
function requirePublishKey(key: string): string {
  const trimmed = key.trim();
  if (!UUID_V7.test(trimmed)) {
    throw new ApiError(422, 'CRM_WIDGET_PUBLISH_INVALID');
  }
  return trimmed.toLowerCase();
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new ApiError(422, 'CRM_WIDGET_DRAFT_INVALID', issueDetails([{ path: 'name', code: trimmed.length < 1 ? 'required' : 'too_long' }]));
  }
  return trimmed;
}

/** Backend widget-draft-input.ts: serialized querySpec <= 64 KiB, displaySpec <= 32 KiB, counted in UTF-8 bytes. */
const QUERY_SPEC_MAX_BYTES = 65_536;
const DISPLAY_SPEC_MAX_BYTES = 32_768;

/** Text of a value as PostgreSQL prints jsonb::text: ", " between items and ": " after keys. */
function jsonbText(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined || typeof item === 'function' ? 'null' : jsonbText(item))).join(', ')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && typeof v !== 'function',
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${jsonbText(v)}`).join(', ')}}`;
}

/** Spec size as the backend counts it: octet_length(spec::jsonb::text), in UTF-8 bytes. */
function utf8Bytes(value: unknown): number {
  return new TextEncoder().encode(jsonbText(value ?? {})).length;
}

const SPEC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deterministicScalarForMetric(metricKey: string, currency: 'EGP' | 'USD'): number {
  let h = 2166136261;
  for (let i = 0; i < metricKey.length; i++) {
    h ^= metricKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const base = 40 + ((h >>> 0) % 180);
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === metricKey);
  if (metric?.unit === 'MONEY') {
    const scaled = base * 5000 * (currency === 'USD' ? 0.02 : 1);
    return Math.max(100, Math.round(scaled));
  }
  return base;
}

function validateSpec(
  visualizationType: Visualization,
  querySpec: QuerySpec,
  opts: { requireName?: string; strictPublish?: boolean; displaySpec?: DisplaySpec } = {},
): { viz: CatalogVisualization; metrics: CatalogMetric[] } {
  if (opts.requireName !== undefined) {
    validateName(opts.requireName);
  }

  const viz = FAKE_CATALOG.visualizations.find((v) => v.key === visualizationType);
  if (!viz) {
    throw new ApiError(422, 'CRM_WIDGET_VISUALIZATION_INVALID', issueDetails([{ path: 'visualizationType', code: 'unknown' }]));
  }

  if (
    utf8Bytes(querySpec) > QUERY_SPEC_MAX_BYTES ||
    utf8Bytes(opts.displaySpec) > DISPLAY_SPEC_MAX_BYTES
  ) {
    throw new ApiError(422, 'CRM_DASHBOARD_SPEC_SIZE_VIOLATION');
  }

  const series = querySpec?.series ?? [];
  if (!Array.isArray(series) || series.length < 1 || series.length > 4) {
    throw new ApiError(422, 'CRM_WIDGET_SERIES_INVALID', issueDetails([{ path: 'querySpec.series', code: 'count_out_of_range' }]));
  }

  if (opts.strictPublish && (series.length < viz.minSeries || series.length > viz.maxSeries)) {
    throw new ApiError(422, 'CRM_WIDGET_SERIES_INVALID', issueDetails([{ path: 'querySpec.series', code: 'visualization_series_range' }]));
  }

  const metrics: CatalogMetric[] = [];
  for (let i = 0; i < series.length; i++) {
    const item = series[i];
    const metric = FAKE_CATALOG.metrics.find((m) => m.key === item?.metricKey);
    if (!metric || metric.availability !== 'AVAILABLE') {
      throw new ApiError(422, 'CRM_WIDGET_METRIC_INVALID', issueDetails([{ path: `querySpec.series.${i}.metricKey`, code: metric ? metric.availability.toLowerCase() : 'unknown' }]));
    }
    // An explicit visualization list wins (a rate metric is BAR by owner, LINE by time, a gauge as a scalar).
    const shapeOk = metric.visualizations?.length
      ? metric.visualizations.includes(viz.key)
      : viz.shapes.includes(metric.shape);
    if (!shapeOk) {
      throw new ApiError(422, 'CRM_WIDGET_SHAPE_INCOMPATIBLE', issueDetails([{ path: 'visualizationType', code: 'shape_incompatible' }]));
    }
    if (item.calculation) {
      const op = item.calculation.operation;
      const operands = compatibleOperands(metric, FAKE_CATALOG, visualizationType);
      if (
        (op !== 'RATIO' && op !== 'DIFFERENCE') ||
        !operands.some((c) => c.key === item.calculation!.operandMetricKey)
      ) {
        throw new ApiError(422, 'CRM_WIDGET_SERIES_INVALID', issueDetails([{ path: `querySpec.series.${i}.calculation`, code: 'incompatible' }]));
      }
    }
    metrics.push(metric);
  }

  // Top-N / group-rest is refused on enum or bounded (NATURAL) dimensions.
  for (const field of ['dimension', 'breakdown'] as const) {
    const grouping = querySpec[field];
    if (!grouping?.key) continue;
    const natural = FAKE_CATALOG.dimensions.find((d) => d.key === grouping.key)?.cardinality === 'NATURAL';
    const topN = field === 'breakdown' ? (grouping.topN ?? (grouping as { limit?: number }).limit) : grouping.topN;
    if (natural && (topN !== undefined || grouping.groupRest)) {
      throw new ApiError(422, 'CRM_WIDGET_DIMENSION_INVALID', issueDetails([{ path: `querySpec.${field}.topN`, code: 'top_n_not_allowed' }]));
    }
  }

  if (metrics.length > 1 && !viz.supportsMixedUnits) {
    const firstUnit = metrics[0].unit;
    if (metrics.some((m) => m.unit !== firstUnit)) {
      throw new ApiError(422, 'CRM_WIDGET_UNITS_INCOMPATIBLE', issueDetails([{ path: 'querySpec.series', code: 'units_incompatible' }]));
    }
  }

  if (querySpec.filterTree) {
    const recordType = filterTreeRecordType(filterTreeMetricKeys(series));
    if (!recordType) {
      throw new ApiError(422, 'CRM_WIDGET_FILTER_INVALID', issueDetails([{ path: 'querySpec.filterTree', code: 'unsupported_family' }]));
    }
    if (
      filterTreeDepth(querySpec.filterTree) > FILTER_TREE_LIMITS.maxDepth ||
      countFilterLeaves(querySpec.filterTree) > FILTER_TREE_LIMITS.maxLeaves ||
      maxInListLength(querySpec.filterTree) > FILTER_TREE_LIMITS.maxInValues ||
      filterTreeBytes(querySpec.filterTree) > FILTER_TREE_LIMITS.maxBytes
    ) {
      throw new ApiError(422, 'CRM_WIDGET_FILTER_TOO_COMPLEX', issueDetails([{ path: 'querySpec.filterTree', code: 'too_complex' }]));
    }
    for (const leaf of collectFilterLeaves(querySpec.filterTree)) {
      if (!isKnownFilterField(leaf.field, recordType)) {
        throw new ApiError(422, 'CRM_WIDGET_FILTER_INVALID', issueDetails([{ path: 'querySpec.filterTree', code: 'unknown_field', field: leaf.field }]));
      }
    }
  }

  if (querySpec.comparison?.type === 'DATASETS' && querySpec.comparison.basis === 'TEAM') {
    if (metrics.some((m) => !allowedDatasetBasesForMetric(m).includes('TEAM'))) {
      throw new ApiError(422, 'CRM_WIDGET_COMPARISON_UNSUPPORTED', issueDetails([{ path: 'querySpec.comparison', code: 'team_unsupported' }]));
    }
    const datasets = querySpec.comparison.datasets ?? [];
    if (datasets.length < 2 || datasets.length > 3) {
      throw new ApiError(422, 'CRM_WIDGET_COMPARISON_DATASETS_INVALID', issueDetails([{ path: 'querySpec.comparison.datasets', code: 'count_out_of_range' }]));
    }
    const seenTeams = new Set<string>();
    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      const teamId = ds?.teamId?.trim() ?? '';
      const label = ds?.label?.trim() ?? '';
      if (!teamId || !SPEC_UUID_RE.test(teamId) || seenTeams.has(teamId)) {
        throw new ApiError(422, 'CRM_WIDGET_COMPARISON_DATASETS_INVALID', issueDetails([{ path: `querySpec.comparison.datasets.${i}.teamId`, code: 'invalid_team' }]));
      }
      seenTeams.add(teamId);
      if (!label || label.length > 80) {
        throw new ApiError(422, 'CRM_WIDGET_COMPARISON_DATASETS_INVALID', issueDetails([{ path: `querySpec.comparison.datasets.${i}.label`, code: 'invalid_label' }]));
      }
    }
  }

  if (opts.displaySpec?.references && opts.displaySpec.references.length > 0) {
    const refs = opts.displaySpec.references;
    if (refs.length > 4) {
      throw new ApiError(422, 'CRM_WIDGET_DISPLAY_INVALID', issueDetails([{ path: 'displaySpec.references', code: 'too_many' }]));
    }
    const usedSeries = new Set<number>();
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!Number.isInteger(ref.seriesIndex) || ref.seriesIndex < 0 || ref.seriesIndex >= series.length) {
        throw new ApiError(422, 'CRM_WIDGET_DISPLAY_INVALID', issueDetails([{ path: `displaySpec.references.${i}.seriesIndex`, code: 'out_of_range' }]));
      }
      if (usedSeries.has(ref.seriesIndex)) {
        throw new ApiError(422, 'CRM_WIDGET_DISPLAY_INVALID', issueDetails([{ path: `displaySpec.references.${i}.seriesIndex`, code: 'duplicate' }]));
      }
      usedSeries.add(ref.seriesIndex);
      const expectedUnit = effectiveSeriesUnit(series[ref.seriesIndex], FAKE_CATALOG);
      if (
        ref.unit !== expectedUnit ||
        typeof ref.value !== 'number' ||
        !Number.isFinite(ref.value) ||
        ref.value < 0 ||
        ((expectedUnit === 'PERCENT' || expectedUnit === 'SCORE') && ref.value > 100)
      ) {
        throw new ApiError(422, 'CRM_WIDGET_DISPLAY_INVALID', issueDetails([{ path: `displaySpec.references.${i}.value`, code: 'invalid_value' }]));
      }
      const trimmedLabel = (ref.label ?? '').trim();
      if (!trimmedLabel || trimmedLabel.length > 40) {
        throw new ApiError(422, 'CRM_WIDGET_DISPLAY_INVALID', issueDetails([{ path: `displaySpec.references.${i}.label`, code: 'invalid_label' }]));
      }
    }
  }

  if (opts.strictPublish && viz.requiresTarget) {
    const cmp = querySpec.comparison;
    const hasStatic = cmp?.type === 'TARGET' && typeof cmp.target === 'number' && Number.isFinite(cmp.target);
    const hasGoverned = cmp?.type === 'GOVERNED_TARGET' && Boolean(cmp.governedTarget?.subjectId);
    if (!hasStatic && !hasGoverned) {
      throw new ApiError(422, 'CRM_WIDGET_TARGET_REQUIRED', issueDetails([{ path: 'querySpec.comparison', code: 'target_required' }]));
    }
  }

  return { viz, metrics };
}

function toDraftState(widget: StoredWidget): DraftState {
  return {
    widgetId: widget.summary.id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    activeVersionNumber: widget.summary.versionNumber,
    draft: widget.draft ? structuredClone(widget.draft) : null,
  };
}

function resolveSnapshot(widget: StoredWidget, versionNumber: number): VersionSnapshot {
  const found = widget.versions.find((v) => v.versionNumber === versionNumber);
  if (!found) throw new ApiError(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
  return {
    versionNumber: found.versionNumber,
    name: found.snapshot.name || found.name,
    visualizationType: found.snapshot.visualizationType,
    schemaVersion: found.snapshot.schemaVersion,
    querySpec: structuredClone(found.snapshot.querySpec),
    displaySpec: structuredClone(found.snapshot.displaySpec),
    publishedAt: found.publishedAt,
    provenance: found.provenance,
    description: found.snapshot.description,
    internalNotes: found.snapshot.internalNotes,
    changeSummary: found.snapshot.changeSummary,
    restoredFromVersionNumber: found.snapshot.restoredFromVersionNumber,
    authoredByUserId: found.snapshot.authoredByUserId,
  };
}

function filterWidgetsList(
  q: Pick<WidgetListQuery, 'search' | 'access' | 'status' | 'source' | 'ownerUserId'>,
): WidgetSummary[] {
  const search = q.search?.trim() ?? '';
  if (search.length > 120) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { search: ['max_length'] });
  }
  const searchLower = search.toLowerCase();
  const myTeamId = personTeamId(FAKE_ME.id);

  return WIDGET_STORE.filter((widget) => {
    if (!isVisibleToViewer(widget)) return false;
    const s = widget.summary;

    if (q.access === 'OWNED' && s.ownerUserId !== FAKE_ME.id) return false;
    if (q.access === 'SHARED' && !isSharedWithViewer(widget)) return false;
    if (q.access === 'TEAM' && (!myTeamId || personTeamId(s.ownerUserId) !== myTeamId)) return false;

    if (q.status && s.status !== q.status) return false;
    if (q.source && !s.sourceResources.includes(q.source as WidgetSourceResource)) return false;
    if (q.ownerUserId && s.ownerUserId !== q.ownerUserId) return false;

    if (searchLower && !s.name.toLowerCase().includes(searchLower)) {
      return false;
    }
    return true;
  })
    .map((widget) => localizedSummary(widget.summary))
    .sort(compareNewest);
}

// GET {B}/widgets?access=&status=&source=&ownerUserId=&search=&cursor=&limit=  -> { items, nextCursor } (cursor = last id, limit 1..100, default 50)
export async function listWidgets(q: WidgetListQuery): Promise<CursorPage<WidgetSummary>> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const limit = q.limit === undefined ? 50 : q.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { limit: [Number.isInteger(limit) ? (limit < 1 ? 'min' : 'max') : 'is_int'] });
  }
  if (q.cursor && !UUID_V7.test(q.cursor)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { cursor: ['is_uuid'] });
  }
  const filtered = filterWidgetsList(q);
  return structuredClone(cursorPageOf(filtered, q.cursor ?? null, limit));
}

// TODO(Phase 5): fake-only helper. No backend endpoint exists for library tab counters; derive them from the
// list response (or add a counts endpoint) when the real API lands. Does not invent DTO fields on WidgetSummary.
export async function getWidgetTabCounts(
  q: Pick<WidgetListQuery, 'search' | 'source' | 'ownerUserId' | 'status'>,
): Promise<WidgetTabCounts> {
  await fakeDelay(120);
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const base = {
    ...(q.search ? { search: q.search } : {}),
    ...(q.source ? { source: q.source } : {}),
    ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
  };
  return {
    mine: filterWidgetsList({ ...base, access: 'OWNED', ...(q.status ? { status: q.status } : {}) }).length,
    shared: filterWidgetsList({ ...base, access: 'SHARED', ...(q.status ? { status: q.status } : {}) }).length,
    published: filterWidgetsList({ ...base, status: 'PUBLISHED' }).length,
  };
}

// TODO(Phase 5): fake-only helper. No backend endpoint exists for the Used-on count pills; the live list DTO must
// carry the dashboard count (or a batch usage endpoint is needed). Keeps WidgetSummary exact to the live DTO.
export async function getWidgetUsageCounts(ids: readonly string[]): Promise<Record<string, number>> {
  await fakeDelay(80);
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const widget = WIDGET_STORE.find((item) => item.summary.id === id);
    counts[id] = widget ? getUsageSummaryCounts(widget).dashboardCount : 0;
  }
  return counts;
}

// GET {B}/widgets/owner-options
export async function listOwnerOptions(search = ''): Promise<CursorPage<{ id: string; name: string }>> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const q = search.trim().toLowerCase();
  const seen = new Map<string, string>();
  for (const widget of WIDGET_STORE) {
    if (!isVisibleToViewer(widget)) continue;
    const id = widget.summary.ownerUserId;
    if (seen.has(id)) continue;
    seen.set(id, personName(id, widget.summary.ownerName) ?? widget.summary.ownerName ?? id);
  }
  const items = Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  return structuredClone(cursorPageOf(items, null, 50));
}

// GET {B}/widgets/:id
export async function getWidget(id: string, usageCursor: string | null = null): Promise<WidgetDetail> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  const allPlacements = ensureUsageFor(widget);
  const visible = allPlacements.filter((p) => !p.hidden);
  // dashboard-widgets.service.ts usage(): the owner counts every placement (and the hidden ones); other readers
  // count only placements on dashboards they can see, and get no activeShareCount.
  const isOwner = widget.summary.accessLevel === 'OWNER';
  const counted = isOwner ? allPlacements : visible;
  const page = pageOf(visible, usageCursor, 20);
  const dashboardCount = new Set(counted.map((p) => p.dashboardId)).size;

  const detail: WidgetDetail = {
    ...localizedSummary(widget.summary),
    usage: {
      placementCount: counted.length,
      dashboardCount,
      ...(isOwner ? { activeShareCount: widget.shares.length } : {}),
      hiddenPlacementCount: isOwner ? allPlacements.length - visible.length : 0,
      placements: page.items.map((p) => {
        const meta = dashboardMeta(p.dashboardId);
        return {
          placementId: p.placementId,
          dashboardId: p.dashboardId,
          dashboardName: localizedDashboardName(meta),
          dashboardRevision: meta.revision,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
        };
      }),
      nextCursor: page.pageInfo.nextCursor,
    },
  };
  return structuredClone(detail);
}

// POST {B}/widgets  201 (header x-idempotency-key: the gateway requires it on this WRITE_SENSITIVE row; crm-app ignores it)
export async function createWidget(
  body: WidgetBody,
  key: string,
): Promise<DraftState & { activeVersionNumber: null }> {
  await fakeDelay();
  if (!can('crm.widgets.create')) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  const idemKey = requireValidIdemKey(key);
  const fingerprint = JSON.stringify(body);
  const existingIdem = CREATE_IDEM.get(idemKey);
  if (existingIdem) {
    if (existingIdem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return structuredClone(existingIdem.result);
  }

  validateSpec(body.visualizationType, body.querySpec, {
    requireName: body.name,
    displaySpec: body.displaySpec,
  });
  const name = validateName(body.name);
  const widgetId = fakeId();
  const draftId = fakeId();
  const sourceResources = deriveSourceResources(body.querySpec);
  const meName = personName(FAKE_ME.id, FAKE_ME.name);

  const draft = {
    draftId,
    revision: 1,
    baseVersionNumber: null,
    schemaVersion: 1,
    updatedAt: FAKE_NOW,
    updatedByUserId: FAKE_ME.id,
    createdAt: FAKE_NOW,
    createdByUserId: FAKE_ME.id,
    name,
    visualizationType: body.visualizationType,
    querySpec: structuredClone(body.querySpec),
    displaySpec: structuredClone(body.displaySpec ?? {}),
    description: body.description ?? null,
    internalNotes: body.internalNotes ?? null,
    changeSummary: body.changeSummary ?? null,
    restoredFromVersionNumber: null,
  };

  const summary: WidgetSummary = {
    id: widgetId,
    ownerUserId: FAKE_ME.id,
    ownerName: meName,
    name,
    visualizationType: body.visualizationType,
    querySpec: structuredClone(body.querySpec),
    displaySpec: structuredClone(body.displaySpec ?? {}),
    schemaVersion: 1,
    versionNumber: null,
    revision: 1,
    governanceRevision: 1,
    updatedAt: FAKE_NOW,
    createdAt: FAKE_NOW,
    accessLevel: 'OWNER',
    status: 'DRAFT',
    hasDraft: true,
    draftRevision: 1,
    sourceResources,
    isShared: false,
  };

  const stored: StoredWidget = {
    summary,
    draft,
    versions: [],
    shares: [],
  };

  WIDGET_STORE.unshift(stored);
  initEmptyUsage(widgetId);

  const result: DraftState & { activeVersionNumber: null } = {
    widgetId,
    widgetRevision: 1,
    governanceRevision: 1,
    activeVersionNumber: null,
    draft: structuredClone(draft),
  };
  CREATE_IDEM.set(idemKey, { fingerprint, result: structuredClone(result) });
  return structuredClone(result);
}

// GET {B}/widgets/:id/draft
export async function getDraft(id: string): Promise<DraftState> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  return structuredClone(toDraftState(widget));
}

// PATCH {B}/widgets/:id  (saves the working draft)
export async function saveDraft(
  id: string,
  body: WidgetBody & {
    expectedWidgetRevision: number;
    expectedDraftId: string | null;
    expectedDraftRevision: number;
  },
): Promise<DraftState> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.update') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  if (body.expectedWidgetRevision !== widget.summary.revision) {
    throw new ApiError(409, 'CRM_WIDGET_REVISION_CONFLICT');
  }
  const currentDraftId = widget.draft?.draftId ?? null;
  const currentDraftRev = widget.draft?.revision ?? 0;
  if (body.expectedDraftId !== currentDraftId || body.expectedDraftRevision !== currentDraftRev) {
    throw new ApiError(409, 'CRM_WIDGET_DRAFT_CONFLICT');
  }

  validateSpec(body.visualizationType, body.querySpec, {
    requireName: body.name,
    displaySpec: body.displaySpec,
  });
  const name = validateName(body.name);
  const nextDraftRevision = currentDraftRev + 1;

  // Notes: an omitted field keeps the stored value; a new draft starts from the published description and notes.
  const prior = widget.draft;
  const published = widget.versions.find((v) => v.versionNumber === widget.summary.versionNumber)?.snapshot;
  widget.draft = {
    draftId: currentDraftId ?? fakeId(),
    revision: nextDraftRevision,
    baseVersionNumber: widget.summary.versionNumber,
    schemaVersion: 1,
    updatedAt: FAKE_NOW,
    updatedByUserId: FAKE_ME.id,
    createdAt: prior?.createdAt ?? FAKE_NOW,
    createdByUserId: prior ? prior.createdByUserId : FAKE_ME.id,
    name,
    visualizationType: body.visualizationType,
    querySpec: structuredClone(body.querySpec),
    displaySpec: structuredClone(body.displaySpec ?? {}),
    description: body.description !== undefined ? body.description : (prior?.description ?? published?.description ?? null),
    internalNotes:
      body.internalNotes !== undefined ? body.internalNotes : (prior?.internalNotes ?? published?.internalNotes ?? null),
    changeSummary: body.changeSummary !== undefined ? body.changeSummary : (prior?.changeSummary ?? null),
    restoredFromVersionNumber: prior?.restoredFromVersionNumber ?? null,
  };

  // Draft writes never change the widget head: `revision` stays (dashboard-widget-drafts.service.ts save()).
  widget.summary.hasDraft = true;
  widget.summary.draftRevision = nextDraftRevision;
  widget.summary.updatedAt = FAKE_NOW;

  if (widget.summary.status === 'DRAFT') {
    widget.summary.name = name;
    widget.summary.visualizationType = body.visualizationType;
    widget.summary.querySpec = structuredClone(body.querySpec);
    widget.summary.displaySpec = structuredClone(body.displaySpec ?? {});
    widget.summary.sourceResources = deriveSourceResources(body.querySpec);
  }

  return structuredClone(toDraftState(widget));
}

// POST {B}/widgets/:id/draft/discard  200
export async function discardDraft(
  id: string,
  body: { expectedWidgetRevision: number; expectedDraftId: string; expectedDraftRevision: number },
): Promise<DraftState> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.update') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  if (!widget.draft) {
    throw new ApiError(422, 'CRM_WIDGET_DRAFT_INVALID');
  }
  if (body.expectedWidgetRevision !== widget.summary.revision) {
    throw new ApiError(409, 'CRM_WIDGET_REVISION_CONFLICT');
  }
  if (body.expectedDraftId !== widget.draft.draftId || body.expectedDraftRevision !== widget.draft.revision) {
    throw new ApiError(409, 'CRM_WIDGET_DRAFT_CONFLICT');
  }

  widget.draft = null;
  widget.summary.hasDraft = false;
  widget.summary.draftRevision = null;
  // Discarding deletes the draft row only; the widget head keeps its revision.
  widget.summary.updatedAt = FAKE_NOW;

  return structuredClone(toDraftState(widget));
}

// POST {B}/widgets/preview
type PreviewBody = {
  name: string;
  visualizationType: Visualization;
  querySpec: QuerySpec;
  displaySpec?: DisplaySpec;
  filters?: DashboardFilters;
  refresh?: boolean;
};
type PreviewResult = WidgetExecution & { panels: PanelOutcome[]; receipts: { runId: string; receiptIds: string[] } };

export function previewWidget(body: PreviewBody, signal?: AbortSignal): Promise<PreviewResult> {
  return withRunSlot(() => previewWidgetUnguarded(body, signal));
}

async function previewWidgetUnguarded(body: PreviewBody, signal?: AbortSignal): Promise<PreviewResult> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const delayPromise = fakeDelayFor('run', `${body.visualizationType}:${body.name}`);
  if (signal) {
    let onAbort: (() => void) | undefined;
    try {
      await Promise.race([
        delayPromise,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  } else {
    await delayPromise;
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const { metrics } = validateSpec(body.visualizationType, body.querySpec, {
    displaySpec: body.displaySpec,
  });
  const lang = fakeLang();
  const currency =
    body.filters?.currencyCode === 'USD' || body.querySpec.filters?.currencyCode === 'USD'
      ? 'USD'
      : 'EGP';
  const cmpType = body.querySpec.comparison?.type;
  const comparison = cmpType === 'PREVIOUS_PERIOD' || cmpType === 'PREVIOUS_YEAR';

  let exec = fakeExecution(body.visualizationType, {
    id: 'preview',
    currency,
    comparison,
  });

  if (exec.series.length > 0 && body.querySpec.series.length > 0) {
    exec.series = exec.series.map((s, idx) => {
      const spec = body.querySpec.series[idx];
      const metric = metrics[idx] ?? metrics[0];
      const metricLabel = lang === 'ar' ? metric.labelAr : metric.labelEn;
      return {
        ...s,
        label: spec?.label?.trim() || metricLabel,
        unit: metric.unit,
        ...(spec?.axis ? { axis: spec.axis } : {}),
        ...(metric.unit === 'MONEY' ? { currency } : {}),
      };
    });
  }

  if (cmpType === 'TARGET' && typeof body.querySpec.comparison?.target === 'number') {
    exec.target = body.querySpec.comparison.target;
  }

  exec = applyFakeSpecEffects(exec, body.querySpec, currency);

  const primaryMetric = metrics[0];
  const firstCalc = body.querySpec.series[0]?.calculation;
  if (firstCalc) {
    const isFixturePair =
      primaryMetric.key === 'crm.opportunities.open.count' &&
      firstCalc.operandMetricKey === 'crm.opportunities.overdue_close.count';
    const numerator = isFixturePair
      ? 100
      : deterministicScalarForMetric(primaryMetric.key, currency);
    const denominator = isFixturePair
      ? 120
      : deterministicScalarForMetric(firstCalc.operandMetricKey, currency);
    exec = applyFakeCalculation(
      exec,
      firstCalc.operation,
      numerator,
      denominator,
      firstCalc.operandMetricKey,
      primaryMetric.unit,
    );
  } else if (cmpType === 'DATASETS' && body.querySpec.comparison?.basis === 'TEAM') {
    const teams = (body.querySpec.comparison.datasets ?? []).map((ds, idx) => ({
      teamId: ds.teamId ?? `team-${idx + 1}`,
      label: ds.label?.trim() || `Team ${idx + 1}`,
    }));
    exec = applyFakeTeamDatasets(exec, teams);
  }

  if (body.querySpec.filterTree && exec.state === 'READY') {
    exec = applyFakeFilterTreeScaling(exec, countFilterLeaves(body.querySpec.filterTree));
  }

  if (exec.meta.warnings.includes('FILTER_TREE_NOT_APPLIED')) {
    exec.meta = {
      ...exec.meta,
      warnings: exec.meta.warnings.filter((w) => w !== 'FILTER_TREE_NOT_APPLIED'),
    };
  }

  if (body.displaySpec?.references && body.displaySpec.references.length > 0) {
    const references: ManualReference[] = body.displaySpec.references.map((ref) => ({
      kind: 'MANUAL',
      seriesIndex: ref.seriesIndex,
      unit: ref.unit,
      value: ref.value,
      label: ref.label.trim(),
    }));
    exec.meta = {
      ...exec.meta,
      references,
    };
  }

  const receiptId = fakeReceipt(primaryMetric.key, {
    panelKey: 'preview',
    value: exec.value ?? exec.series[0]?.points[0]?.value ?? null,
    unit: exec.meta.unit ?? primaryMetric.unit,
    currencyCode: exec.meta.currency ?? (primaryMetric.unit === 'MONEY' ? currency : undefined),
  });

  const outcome: PanelOutcome = {
    panelKey: 'preview',
    metricKeys: metrics.map((m) => m.key),
    state: exec.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : exec.state === 'EMPTY' ? 'EMPTY' : 'READY',
    shape: exec.shape,
    ...(exec.state === 'UNAVAILABLE'
      ? {
          unavailable: {
            reasonCode: 'SOURCE_NOT_READY',
            sourceKey: 'core.team_membership_history',
          },
        }
      : {}),
    receiptId,
    cached: false,
    computedAt: FAKE_NOW,
    durationMs: 145,
  };

  return structuredClone({
    ...exec,
    panels: [outcome],
    receipts: { runId: fakeId(), receiptIds: [receiptId] },
  });
}

// POST {B}/widgets/:id/publish-impact  200
export async function publishImpact(id: string, body: PublishImpactBody): Promise<PublishImpact> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.publish') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_PUBLISH_FORBIDDEN');
  }
  if (!widget.draft) {
    throw new ApiError(422, 'CRM_WIDGET_PUBLISH_INVALID');
  }
  if (
    body.expectedWidgetRevision !== widget.summary.revision ||
    body.expectedGovernanceRevision !== widget.summary.governanceRevision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_REVISION_CONFLICT');
  }
  if (body.expectedDraftId !== widget.draft.draftId || body.expectedDraftRevision !== widget.draft.revision) {
    throw new ApiError(409, 'CRM_WIDGET_DRAFT_CONFLICT');
  }

  const vizType = widget.draft.visualizationType ?? widget.summary.visualizationType;
  if (!vizType) {
    throw new ApiError(422, 'CRM_WIDGET_VISUALIZATION_INVALID', issueDetails([{ path: 'visualizationType', code: 'required' }]));
  }
  const { viz } = validateSpec(vizType, widget.draft.querySpec, {
    requireName: widget.draft.name,
    strictPublish: true,
    displaySpec: widget.draft.displaySpec,
  });

  const placements = ensureUsageFor(widget).filter((p) => !p.hidden);
  const dashboardIds = Array.from(new Set(placements.map((p) => p.dashboardId)));
  const dashboards = dashboardIds.map((dashId) => {
    const meta = dashboardMeta(dashId);
    const usesFollow = placements.some((p) => p.dashboardId === dashId && p.versionPolicy === 'FOLLOW_ACTIVE');
    return {
      id: dashId,
      name: localizedDashboardName(meta),
      revision: meta.revision,
      affected: usesFollow,
    };
  });

  const adjustments = placements
    .filter((p) => p.versionPolicy === 'FOLLOW_ACTIVE' && (p.w < viz.minSize.w || p.h < viz.minSize.h))
    .slice(0, 2)
    .map((p) => ({
      placementId: p.placementId,
      dashboardId: p.dashboardId,
      x: p.x,
      y: p.y,
      w: Math.max(p.w, viz.minSize.w),
      h: Math.max(p.h, viz.minSize.h),
    }));

  const nextVersionNumber = (widget.summary.versionNumber ?? 0) + 1;
  const impactId = fakeId();
  PUBLISH_IMPACTS.set(impactId, {
    impactId,
    expiresAtMs: Date.now() + IMPACT_TTL_MS,
    widgetId: id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    draftId: widget.draft.draftId,
    draftRevision: widget.draft.revision,
    nextVersionNumber,
    adjustments,
  });

  const result: PublishImpact = {
    impactId,
    expiresAt: impactExpiresIso(),
    widgetId: id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    draftId: widget.draft.draftId,
    draftRevision: widget.draft.revision,
    nextVersionNumber,
    dashboards,
    layoutAdjustments: adjustments,
    ...fakePublishDependentsFor(id, dashboards.length),
  };
  return structuredClone(result);
}

// POST {B}/widgets/:id/publish  200 (header x-idempotency-key, checked by crm-app; the gateway row is idempotent:false)
export async function publishWidget(
  id: string,
  body: PublishWidgetBody,
  key: string,
): Promise<PublishWidgetResult> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.publish') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_PUBLISH_FORBIDDEN');
  }

  const idemKey = requirePublishKey(key);
  const fingerprint = JSON.stringify({ id, body });
  const prevIdem = PUBLISH_IDEM.get(idemKey);
  if (prevIdem) {
    if (prevIdem.fingerprint !== fingerprint) {
      throw new ApiError(409, 'CRM_WIDGET_PUBLISH_IDEMPOTENCY_MISMATCH');
    }
    return structuredClone({ ...prevIdem.result, replayed: true });
  }

  const impact = PUBLISH_IMPACTS.get(body.impactId);
  if (
    !impact ||
    impact.widgetId !== id ||
    impact.expiresAtMs < Date.now() ||
    !widget.draft ||
    impact.widgetRevision !== widget.summary.revision ||
    impact.governanceRevision !== widget.summary.governanceRevision ||
    impact.draftId !== widget.draft.draftId ||
    impact.draftRevision !== widget.draft.revision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_PUBLISH_IMPACT_STALE');
  }

  const rawBody = body as Record<string, unknown>;
  if (
    (typeof rawBody['expectedWidgetRevision'] === 'number' &&
      rawBody['expectedWidgetRevision'] !== widget.summary.revision) ||
    (typeof rawBody['expectedDraftRevision'] === 'number' &&
      rawBody['expectedDraftRevision'] !== widget.draft.revision)
  ) {
    throw new ApiError(409, 'CRM_WIDGET_PUBLISH_IMPACT_STALE');
  }

  const draft = widget.draft;
  const vizType = draft.visualizationType ?? widget.summary.visualizationType;
  if (!vizType) {
    throw new ApiError(422, 'CRM_WIDGET_VISUALIZATION_INVALID');
  }

  PUBLISH_IMPACTS.delete(body.impactId);

  const versionNumber = impact.nextVersionNumber;
  widget.versions.push({
    versionNumber,
    name: draft.name,
    publishedAt: FAKE_NOW,
    provenance: draft.restoredFromVersionNumber
      ? 'RESTORE'
      : versionNumber === 1
        ? 'INITIAL'
        : 'PUBLISH',
    snapshot: {
      name: draft.name,
      visualizationType: vizType,
      schemaVersion: draft.schemaVersion,
      querySpec: structuredClone(draft.querySpec),
      displaySpec: structuredClone(draft.displaySpec),
      description: draft.description,
      internalNotes: draft.internalNotes ?? null,
      changeSummary: draft.changeSummary,
      restoredFromVersionNumber: draft.restoredFromVersionNumber,
      authoredByUserId: draft.createdByUserId,
    },
  });

  widget.summary.name = draft.name;
  widget.summary.visualizationType = vizType;
  widget.summary.querySpec = structuredClone(draft.querySpec);
  widget.summary.displaySpec = structuredClone(draft.displaySpec);
  widget.summary.sourceResources = deriveSourceResources(draft.querySpec);
  widget.summary.status = 'PUBLISHED';
  widget.summary.versionNumber = versionNumber;
  widget.summary.revision += 1;
  widget.summary.hasDraft = false;
  widget.summary.draftRevision = null;
  widget.summary.updatedAt = FAKE_NOW;
  widget.draft = null;

  const placements = ensureUsageFor(widget);
  const dashboardRevisions: Record<string, number> = {};
  for (const adj of impact.adjustments) {
    const p = placements.find((item) => item.placementId === adj.placementId);
    if (p) {
      p.w = adj.w;
      p.h = adj.h;
      const meta = dashboardMeta(p.dashboardId);
      meta.revision += 1;
      dashboardRevisions[meta.id] = meta.revision;
    }
  }

  const result: PublishWidgetResult = {
    widgetId: id,
    versionNumber,
    widgetRevision: widget.summary.revision,
    sourceDraftId: draft.draftId,
    sourceDraftRevision: draft.revision,
    publishedAt: FAKE_NOW,
    dashboardRevisions,
    replayed: false,
  };
  PUBLISH_IDEM.set(idemKey, { fingerprint, result: structuredClone(result) });
  return structuredClone(result);
}

// GET {B}/widgets/:id/versions
export async function listVersions(id: string, beforeVersion?: number): Promise<WidgetVersionsPage> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  if (widget.summary.versionNumber === null) {
    // Never published: the backend answers the head with no items.
    return { widgetId: id, widgetRevision: widget.summary.revision, activeVersionNumber: null, items: [], nextBeforeVersion: null };
  }
  const sorted = widget.versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .filter((v) => (beforeVersion !== undefined ? v.versionNumber < beforeVersion : true));

  const pageItems = sorted.slice(0, 20).map((v) => ({
    versionNumber: v.versionNumber,
    name: v.name,
    publishedAt: v.publishedAt,
    provenance: v.provenance,
  }));
  const hasMore = sorted.length > 20;

  return structuredClone({
    widgetId: id,
    widgetRevision: widget.summary.revision,
    activeVersionNumber: widget.summary.versionNumber,
    items: pageItems,
    nextBeforeVersion: hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].versionNumber : null,
  });
}

// POST {B}/widgets/:id/versions/compare  body { leftVersionNumber, rightVersionNumber }  200
export async function compareVersions(id: string, left: number, right: number): Promise<VersionCompare> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1 || left === right) {
    throw new ApiError(422, 'CRM_WIDGET_VERSION_RESTORE_INVALID');
  }
  const activeVersion = widget.summary.versionNumber;
  if (activeVersion === null || Math.max(left, right) > activeVersion) {
    throw new ApiError(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
  }
  const leftSnap = resolveSnapshot(widget, left);
  const rightSnap = resolveSnapshot(widget, right);

  const changedSections: VersionCompare['changedSections'] = [];
  if (leftSnap.name !== rightSnap.name) changedSections.push('NAME');
  if (leftSnap.visualizationType !== rightSnap.visualizationType) changedSections.push('VISUALIZATION');
  if (leftSnap.schemaVersion !== rightSnap.schemaVersion) changedSections.push('SCHEMA');
  if (JSON.stringify(leftSnap.querySpec) !== JSON.stringify(rightSnap.querySpec)) changedSections.push('QUERY');
  if (JSON.stringify(leftSnap.displaySpec) !== JSON.stringify(rightSnap.displaySpec)) changedSections.push('DISPLAY');
  if (
    leftSnap.description !== rightSnap.description ||
    leftSnap.internalNotes !== rightSnap.internalNotes ||
    leftSnap.changeSummary !== rightSnap.changeSummary
  ) {
    changedSections.push('NOTES');
  }

  // The state follows the update permission and the draft only; an archived head still compares (`archived`).
  let restoreState: VersionCompare['restoreState'] = 'AVAILABLE';
  if (!can('crm.widgets.update') || !hasWriteAccess(widget)) {
    restoreState = 'PERMISSION_REQUIRED';
  } else if (widget.draft !== null) {
    restoreState = 'DRAFT_EXISTS';
  }

  let proof: VersionCompare['proof'] = null;
  if (restoreState === 'AVAILABLE') {
    const impactId = fakeId();
    RESTORE_IMPACTS.set(impactId, {
      impactId,
      expiresAtMs: Date.now() + IMPACT_TTL_MS,
      widgetId: id,
      leftVersionNumber: left,
      rightVersionNumber: right,
      widgetRevision: widget.summary.revision,
      governanceRevision: widget.summary.governanceRevision,
    });
    proof = { impactId, expiresAt: impactExpiresIso() };
  }

  return structuredClone({
    widgetId: id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    activeVersionNumber: activeVersion,
    archived: widget.summary.status === 'ARCHIVED',
    left: leftSnap,
    right: rightSnap,
    changedSections,
    restoreState,
    proof,
  });
}

// POST {B}/widgets/:id/versions/restore-draft  200
export async function restoreVersionToDraft(id: string, body: RestoreVersionBody): Promise<RestoreVersionResult> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.update') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_VERSION_RESTORE_FORBIDDEN');
  }
  if (widget.draft !== null) {
    throw new ApiError(409, 'CRM_WIDGET_VERSION_RESTORE_DRAFT_EXISTS');
  }
  if (body.acknowledged !== true) {
    throw new ApiError(422, 'CRM_WIDGET_VERSION_RESTORE_INVALID');
  }
  const proof = RESTORE_IMPACTS.get(body.impactId);
  if (
    !proof ||
    proof.widgetId !== id ||
    proof.expiresAtMs < Date.now() ||
    proof.leftVersionNumber !== body.leftVersionNumber ||
    proof.rightVersionNumber !== body.rightVersionNumber ||
    proof.widgetRevision !== body.expectedWidgetRevision ||
    proof.governanceRevision !== body.expectedGovernanceRevision ||
    widget.summary.revision !== body.expectedWidgetRevision ||
    widget.summary.governanceRevision !== body.expectedGovernanceRevision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_VERSION_RESTORE_STALE');
  }
  if (
    body.sourceVersionNumber !== body.leftVersionNumber &&
    body.sourceVersionNumber !== body.rightVersionNumber
  ) {
    throw new ApiError(422, 'CRM_WIDGET_VERSION_RESTORE_INVALID');
  }

  const snap = resolveSnapshot(widget, body.sourceVersionNumber);
  RESTORE_IMPACTS.delete(body.impactId);

  // The stored version seeds the draft with its description and internal notes; the head revision stays.
  widget.draft = {
    draftId: fakeId(),
    revision: 1,
    baseVersionNumber: widget.summary.versionNumber,
    schemaVersion: snap.schemaVersion,
    updatedAt: FAKE_NOW,
    updatedByUserId: FAKE_ME.id,
    createdAt: FAKE_NOW,
    createdByUserId: FAKE_ME.id,
    name: snap.name,
    visualizationType: snap.visualizationType,
    querySpec: structuredClone(snap.querySpec),
    displaySpec: structuredClone(snap.displaySpec),
    description: snap.description,
    internalNotes: snap.internalNotes,
    changeSummary: null,
    restoredFromVersionNumber: snap.versionNumber,
  };
  widget.summary.hasDraft = true;
  widget.summary.draftRevision = 1;
  widget.summary.updatedAt = FAKE_NOW;

  return structuredClone({ ...toDraftState(widget), restoredFromVersionNumber: snap.versionNumber });
}

// POST {B}/widgets/:id/lifecycle-impact  200
export async function lifecycleImpact(id: string, body: LifecycleImpactBody): Promise<LifecycleImpact> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  assertLifecycleAccess(widget);
  if (body.action !== 'ARCHIVE' && body.action !== 'RESTORE') {
    throw new ApiError(422, 'CRM_WIDGET_LIFECYCLE_INVALID');
  }
  // dashboard-widget-lifecycle.service.ts snapshot(): a stale head, or a head already in the target state, is 409.
  if (
    body.expectedWidgetRevision !== widget.summary.revision ||
    body.expectedGovernanceRevision !== widget.summary.governanceRevision ||
    (widget.summary.status === 'ARCHIVED') === (body.action === 'ARCHIVE')
  ) {
    throw new ApiError(409, 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE');
  }

  // Every consuming placement the actor can see; the others are only counted (hiddenPlacementCount).
  const allPlacements = ensureUsageFor(widget);
  const relevantPlacements = allPlacements.filter((p) => !p.hidden);
  const hiddenPlacementCount = allPlacements.length - relevantPlacements.length;

  const impactId = fakeId();
  LIFECYCLE_IMPACTS.set(impactId, {
    impactId,
    expiresAtMs: Date.now() + IMPACT_TTL_MS,
    widgetId: id,
    action: body.action,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
  });

  const result: LifecycleImpact = {
    impactId,
    expiresAt: impactExpiresIso(),
    widgetId: id,
    action: body.action,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    activeVersionNumber: widget.summary.versionNumber,
    hiddenPlacementCount,
    placements: relevantPlacements.map((p) => {
      const meta = dashboardMeta(p.dashboardId);
      return {
        dashboardId: p.dashboardId,
        dashboardName: localizedDashboardName(meta),
        dashboardRevision: meta.revision,
        placementId: p.placementId,
        versionPolicy: p.versionPolicy,
        versionNumber: p.versionNumber,
        // RESTORE only: the dashboard owner is active and can still see the widget, and a version is placed.
        eligibleToResume:
          body.action === 'RESTORE' && p.versionNumber !== null && !INACTIVE_USER_IDS.has(dashboardOwnerId(p.dashboardId)),
      };
    }),
    alertRules: fakeAlertRulesFor(id, body.action, relevantPlacements.length > 0),
  };
  return structuredClone(result);
}

// POST {B}/widgets/:id/lifecycle  200
export async function applyLifecycle(id: string, body: ApplyLifecycleBody): Promise<ApplyLifecycleResult> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  assertLifecycleAccess(widget);
  // ConfirmWidgetLifecycleDto: reason required (non-blank) to ARCHIVE, at most 500 characters.
  const lifecycleReason = body.reason?.trim() ?? '';
  if ((body.action === 'ARCHIVE' || body.reason !== undefined) && !lifecycleReason) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { reason: ['matches'] });
  }
  if (lifecycleReason.length > 500) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { reason: ['max_length'] });
  }

  const impact = LIFECYCLE_IMPACTS.get(body.impactId);
  if (
    !impact ||
    impact.widgetId !== id ||
    impact.action !== body.action ||
    impact.expiresAtMs < Date.now() ||
    impact.widgetRevision !== body.expectedWidgetRevision ||
    impact.governanceRevision !== body.expectedGovernanceRevision ||
    widget.summary.revision !== body.expectedWidgetRevision ||
    widget.summary.governanceRevision !== body.expectedGovernanceRevision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE');
  }

  LIFECYCLE_IMPACTS.delete(body.impactId);
  // Every consuming dashboard head is bumped; placements stay (they show the archived placeholder).
  const affectedDashboards = new Set(ensureUsageFor(widget).map((p) => p.dashboardId));
  for (const dashId of affectedDashboards) {
    dashboardMeta(dashId).revision += 1;
  }

  const nextStatus: WidgetStatus =
    body.action === 'ARCHIVE' ? 'ARCHIVED' : widget.summary.versionNumber === null ? 'DRAFT' : 'PUBLISHED';
  widget.summary.status = nextStatus;
  widget.summary.revision += 1;
  widget.summary.governanceRevision += 1;
  widget.summary.updatedAt = FAKE_NOW;

  return {
    widgetId: id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    activeVersionNumber: widget.summary.versionNumber,
    status: nextStatus,
    affectedDashboardCount: affectedDashboards.size,
  };
}

// DELETE {B}/widgets/:id  204
export async function deleteWidget(id: string): Promise<void> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.delete') || widget.summary.accessLevel !== 'OWNER') {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  const placements = ensureUsageFor(widget);
  if (
    (widget.summary.status !== 'DRAFT' && widget.summary.status !== 'ARCHIVED') ||
    placements.length > 0
  ) {
    throw new ApiError(422, 'CRM_WIDGET_LIFECYCLE_INVALID');
  }

  const idx = WIDGET_STORE.findIndex((item) => item.summary.id === id);
  if (idx !== -1) {
    WIDGET_STORE.splice(idx, 1);
  }
  deleteUsage(id);
}

// POST {B}/widgets/:id/clone  201 (header x-idempotency-key: gateway-enforced)
export async function cloneWidget(id: string, name: string | null, key: string): Promise<DraftState> {
  await fakeDelay();
  if (!can('crm.widgets.create')) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  const idemKey = requireValidIdemKey(key);
  const fingerprint = JSON.stringify({ id, name });
  const prevIdem = CLONE_IDEM.get(idemKey);
  if (prevIdem) {
    if (prevIdem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return structuredClone(prevIdem.result);
  }

  const source = findStoredWidget(id);
  // The copy starts from the ACTIVE publication (dashboard-widgets.service.ts clone()/activePublication()).
  const publication = source.versions.find((v) => v.versionNumber === source.summary.versionNumber)?.snapshot;
  if (!publication || source.summary.status === 'ARCHIVED') {
    if (source.summary.accessLevel === 'VIEW') throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
    throw new ApiError(422, 'CRM_WIDGET_UNAVAILABLE');
  }
  let targetName: string;
  if (name === null) {
    // Server default: the first 115 characters of the published name plus " Copy".
    targetName = `${Array.from(publication.name).slice(0, 115).join('')} Copy`;
  } else {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', {
        name: [trimmed.length < 1 ? 'min_length' : 'max_length'],
      });
    }
    targetName = trimmed;
  }

  const baseViz = publication.visualizationType;
  const baseQuery = structuredClone(publication.querySpec);
  const baseDisplay = structuredClone(publication.displaySpec);
  const newId = fakeId();
  const meName = personName(FAKE_ME.id, FAKE_ME.name);

  const summary: WidgetSummary = {
    id: newId,
    ownerUserId: FAKE_ME.id,
    ownerName: meName,
    name: targetName,
    visualizationType: baseViz,
    querySpec: baseQuery,
    displaySpec: baseDisplay,
    schemaVersion: 1,
    versionNumber: null,
    revision: 1,
    governanceRevision: 1,
    updatedAt: FAKE_NOW,
    createdAt: FAKE_NOW,
    accessLevel: 'OWNER',
    status: 'DRAFT',
    hasDraft: true,
    draftRevision: 1,
    sourceResources: deriveSourceResources(baseQuery),
    isShared: false,
  };

  const cloned: StoredWidget = {
    summary,
    draft: {
      draftId: fakeId(),
      revision: 1,
      baseVersionNumber: null,
      schemaVersion: 1,
      updatedAt: FAKE_NOW,
      updatedByUserId: FAKE_ME.id,
      createdAt: FAKE_NOW,
      createdByUserId: FAKE_ME.id,
      name: targetName,
      visualizationType: baseViz,
      querySpec: structuredClone(baseQuery),
      displaySpec: structuredClone(baseDisplay),
      // The viewer-facing description travels with the copy; internal notes never do.
      description: publication.description,
      internalNotes: null,
      changeSummary: null,
      restoredFromVersionNumber: null,
    },
    versions: [],
    shares: [],
  };

  WIDGET_STORE.unshift(cloned);
  initEmptyUsage(newId);

  const out = toDraftState(cloned);
  CLONE_IDEM.set(idemKey, { fingerprint, result: structuredClone(out) });
  return structuredClone(out);
}

// GET {B}/widgets/:id/ownership-transfer/targets?search=&cursor=&limit= (limit max 50)
export async function listTransferTargets(
  id: string,
  search = '',
): Promise<CursorPage<{ id: string; name: string }>> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  const q = search.trim().toLowerCase();
  const lang = fakeLang();

  const candidates = FAKE_PEOPLE.filter((p) => p.id !== widget.summary.ownerUserId)
    .map((p) => ({
      id: p.id,
      name: lang === 'ar' ? p.nameAr : p.name,
      searchText: `${p.name} ${p.nameAr} ${p.email}`.toLowerCase(),
    }))
    .filter((entry) => (q ? entry.searchText.includes(q) : true))
    .map(({ id: personId, name }) => ({ id: personId, name }));

  return structuredClone(cursorPageOf(candidates, null, 50));
}

// POST {B}/widgets/:id/ownership-transfer/impact  200
export async function transferImpact(id: string, body: TransferImpactBody): Promise<TransferImpact> {
  await fakeDelay();
  // An admin action: `crm.widgets.transfer_ownership` (tenant), not widget ownership.
  if (!can('crm.widgets.transfer_ownership')) {
    throw new ApiError(403, 'CRM_WIDGET_TRANSFER_FORBIDDEN');
  }
  const widget = findStoredWidget(id);
  if (
    body.expectedWidgetRevision !== widget.summary.revision ||
    body.expectedGovernanceRevision !== widget.summary.governanceRevision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_TRANSFER_IMPACT_STALE');
  }
  if (body.targetUserId === widget.summary.ownerUserId) {
    throw new ApiError(422, 'CRM_WIDGET_TRANSFER_INVALID');
  }
  const target = FAKE_PEOPLE.find((p) => p.id === body.targetUserId);
  if (!target || INACTIVE_USER_IDS.has(target.id)) {
    throw new ApiError(422, 'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE');
  }

  const placements = ensureUsageFor(widget).filter((p) => !p.hidden);
  const impactId = fakeId();
  TRANSFER_IMPACTS.set(impactId, {
    impactId,
    expiresAtMs: Date.now() + IMPACT_TTL_MS,
    widgetId: id,
    targetUserId: body.targetUserId,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
  });

  const dashboardCount = new Set(placements.map((p) => p.dashboardId)).size;
  return structuredClone({
    impactId,
    expiresAt: impactExpiresIso(),
    widget: transferHead(widget),
    target: { id: target.id, name: personName(target.id, target.name) ?? target.name },
    affectedPlacementCount: placements.length,
    retainedShareCount: widget.shares.length,
    dashboardOwnerAccessLostCount: widget.summary.isShared ? 0 : Math.min(1, dashboardCount),
    dashboardOwnerAccessRestoredCount: 0,
    dashboardReadersMayNeedShareCount: widget.summary.isShared ? 0 : dashboardCount,
    sharesRevokedOnTransfer: false,
  });
}

// PATCH {B}/widgets/:id/ownership-transfer
export async function transferWidget(id: string, body: TransferWidgetBody): Promise<TransferWidgetResult> {
  await fakeDelay();
  if (!can('crm.widgets.transfer_ownership')) {
    throw new ApiError(403, 'CRM_WIDGET_TRANSFER_FORBIDDEN');
  }
  const widget = findStoredWidget(id);

  const reason = (body.reason ?? '').trim();
  if (reason.length < 1 || reason.length > 500) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', {
      reason: [reason.length < 1 ? 'matches' : 'max_length'],
    });
  }
  if (body.acknowledged !== true) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { acknowledged: ['is_in'] });
  }
  if (body.targetUserId === widget.summary.ownerUserId) {
    throw new ApiError(422, 'CRM_WIDGET_TRANSFER_INVALID');
  }
  const target = FAKE_PEOPLE.find((p) => p.id === body.targetUserId);
  if (!target || INACTIVE_USER_IDS.has(body.targetUserId)) {
    // Widget targets answer the widget code; CRM_OWNERSHIP_TARGET_INACTIVE is the dashboard route's.
    throw new ApiError(422, 'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE');
  }

  const impact = TRANSFER_IMPACTS.get(body.impactId);
  if (
    !impact ||
    impact.widgetId !== id ||
    impact.targetUserId !== body.targetUserId ||
    impact.expiresAtMs < Date.now() ||
    impact.widgetRevision !== body.expectedWidgetRevision ||
    impact.governanceRevision !== body.expectedGovernanceRevision ||
    widget.summary.revision !== body.expectedWidgetRevision ||
    widget.summary.governanceRevision !== body.expectedGovernanceRevision
  ) {
    throw new ApiError(409, 'CRM_WIDGET_TRANSFER_IMPACT_STALE');
  }

  TRANSFER_IMPACTS.delete(body.impactId);

  // Shares are kept (O-7 off); no share is created for the previous owner, who loses the owner path.
  const placements = ensureUsageFor(widget).filter((p) => !p.hidden);
  const dashboardCount = new Set(placements.map((p) => p.dashboardId)).size;
  const previousOwnerUserId = widget.summary.ownerUserId;
  widget.summary.ownerUserId = target.id;
  widget.summary.ownerName = personName(target.id, target.name);
  widget.summary.accessLevel = target.id === FAKE_ME.id ? 'OWNER' : isSharedWithViewer(widget) ? 'EDIT' : 'VIEW';
  widget.summary.isShared = target.id !== FAKE_ME.id;
  widget.summary.revision += 1;
  widget.summary.governanceRevision += 1;
  widget.summary.updatedAt = FAKE_NOW;

  return {
    widgetId: id,
    previousOwnerUserId,
    ownerUserId: target.id,
    widgetRevision: widget.summary.revision,
    governanceRevision: widget.summary.governanceRevision,
    affectedPlacementCount: placements.length,
    retainedShareCount: widget.shares.length,
    revokedShareCount: 0,
    dashboardOwnerAccessLostCount: Math.min(1, dashboardCount),
    dashboardOwnerAccessRestoredCount: 0,
    dashboardReadersMayNeedShareCount: dashboardCount,
    ownerReviewId: body.ownerReviewId ?? null,
  };
}

// GET {B}/widgets/:id/shares
export async function listWidgetShares(id: string): Promise<ShareListItem[]> {
  await fakeDelay();
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const widget = findStoredWidget(id);
  const lang = fakeLang();
  const localized = widget.shares.map((s) => {
    if (s.subjectType === 'USER') {
      const person = FAKE_PEOPLE.find((p) => p.id === s.subjectId);
      return {
        ...s,
        subjectName: person ? (lang === 'ar' ? person.nameAr : person.name) : s.subjectName,
        subjectEmail: person?.email ?? s.subjectEmail,
      };
    }
    const team = FAKE_TEAMS.find((t) => t.id === s.subjectId);
    return {
      ...s,
      subjectName: team ? (lang === 'ar' ? team.name.ar : team.name.en) : s.subjectName,
    };
  });
  return structuredClone(localized);
}

// POST {B}/widgets/:id/shares  201 (header x-idempotency-key: gateway-enforced)
export async function addWidgetShare(
  id: string,
  body: { subjectType: 'USER' | 'TEAM'; subjectId: string; accessLevel: 'VIEW' | 'EDIT'; expiresAt?: string | null },
  key: string,
): Promise<Share> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.share') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  const idemKey = requireValidIdemKey(key);
  const fingerprint = JSON.stringify({ id, body });
  const prev = SHARE_IDEM.get(idemKey);
  if (prev) {
    if (prev.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return structuredClone(prev.result);
  }

  if (body.subjectType === 'USER' && body.subjectId === widget.summary.ownerUserId) {
    throw new ApiError(422, 'CRM_SHARE_SELF_INVALID');
  }

  const expiresAt = body.expiresAt ?? null;
  if (expiresAt !== null) {
    const ts = Date.parse(expiresAt);
    if (!Number.isFinite(ts) || ts <= Date.parse(FAKE_NOW)) {
      throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
    }
  }

  let subjectName: string | null = null;
  let subjectEmail: string | null = null;
  if (body.subjectType === 'USER') {
    const person = FAKE_PEOPLE.find((p) => p.id === body.subjectId);
    if (!person) throw new ApiError(422, 'CRM_SHARE_TARGET_INVALID');
    subjectName = fakeLang() === 'ar' ? person.nameAr : person.name;
    subjectEmail = person.email;
  } else {
    const team = FAKE_TEAMS.find((t) => t.id === body.subjectId);
    if (!team) throw new ApiError(422, 'CRM_SHARE_TARGET_INVALID');
    subjectName = fakeLang() === 'ar' ? team.name.ar : team.name.en;
  }

  const existing = widget.shares.find(
    (s) => s.subjectType === body.subjectType && s.subjectId === body.subjectId,
  );
  if (existing) {
    existing.accessLevel = body.accessLevel;
    existing.effectiveAccessLevel = body.accessLevel;
    existing.expiresAt = expiresAt;
    existing.updatedAt = FAKE_NOW;
    widget.summary.governanceRevision += 1;
    widget.summary.isShared = true;
    SHARE_IDEM.set(idemKey, { fingerprint, result: structuredClone(existing) });
    return structuredClone(existing);
  }

  const shareItem: ShareListItem = {
    id: fakeId(),
    subjectType: body.subjectType,
    subjectId: body.subjectId,
    accessLevel: body.accessLevel,
    sharedByUserId: FAKE_ME.id,
    expiresAt,
    createdAt: FAKE_NOW,
    updatedAt: FAKE_NOW,
    effectiveAccessLevel: body.accessLevel,
    subjectName,
    subjectEmail,
    context: '',
    effectiveAccessSource: 'Direct grant',
  };

  widget.shares.push(shareItem);
  widget.summary.isShared = true;
  widget.summary.governanceRevision += 1;

  const share: Share = {
    id: shareItem.id,
    subjectType: shareItem.subjectType,
    subjectId: shareItem.subjectId,
    accessLevel: shareItem.accessLevel,
    sharedByUserId: shareItem.sharedByUserId,
    expiresAt: shareItem.expiresAt,
    createdAt: shareItem.createdAt,
    updatedAt: shareItem.updatedAt,
  };
  SHARE_IDEM.set(idemKey, { fingerprint, result: structuredClone(share) });
  return structuredClone(share);
}

// PATCH {B}/widgets/:id/shares/:shareId
export async function updateWidgetShare(
  id: string,
  shareId: string,
  body: { revision?: number; accessLevel?: 'VIEW' | 'EDIT'; expiresAt?: string | null },
): Promise<Share> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.share') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  if (body.accessLevel === undefined && body.expiresAt === undefined) {
    throw new ApiError(422, 'CRM_SHARE_UPDATE_EMPTY');
  }
  const share = widget.shares.find((s) => s.id === shareId);
  if (!share) {
    throw new ApiError(404, 'CRM_SHARE_NOT_FOUND');
  }
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    const ts = Date.parse(body.expiresAt);
    if (!Number.isFinite(ts) || ts <= Date.parse(FAKE_NOW)) {
      throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
    }
  }
  if (body.accessLevel !== undefined) {
    share.accessLevel = body.accessLevel;
    share.effectiveAccessLevel = body.accessLevel;
  }
  if (body.expiresAt !== undefined) {
    share.expiresAt = body.expiresAt;
  }
  share.updatedAt = FAKE_NOW;
  widget.summary.governanceRevision += 1;

  return structuredClone({
    id: share.id,
    subjectType: share.subjectType,
    subjectId: share.subjectId,
    accessLevel: share.accessLevel,
    sharedByUserId: share.sharedByUserId,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  });
}

// DELETE {B}/widgets/:id/shares/:shareId?reason=  204
export async function revokeWidgetShare(
  id: string,
  shareId: string,
  reason: 'OWNER_REVOKED' | 'ADMIN_REVOKED',
): Promise<void> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.share') || !hasWriteAccess(widget)) {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  if (reason !== 'OWNER_REVOKED' && reason !== 'ADMIN_REVOKED') {
    throw new ApiError(422, 'CRM_SHARE_REVOKE_REASON_REQUIRED');
  }
  const idx = widget.shares.findIndex((s) => s.id === shareId);
  if (idx === -1) {
    throw new ApiError(404, 'CRM_SHARE_NOT_FOUND');
  }
  widget.shares.splice(idx, 1);
  widget.summary.isShared = widget.shares.length > 0;
  widget.summary.governanceRevision += 1;
}

// GET {B}/targets?metricKey=&periodGrain=&approvalState=APPROVED
export async function listGovernedTargets(
  metricKey: string,
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR',
): Promise<GovernedTargetOption[]> {
  await fakeDelay();
  if (!can('crm.targets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  return structuredClone(fakeGovernedTargets(metricKey, periodGrain));
}

export interface BranchOption {
  id: string;
  name: { en: string; ar: string };
}

export interface PipelineOption {
  id: string;
  key: 'standard' | 'corporate' | 'renewals';
}

// TODO(Phase 5): GET {B}/org/branches limited to the caller's branch grants. The fake mirrors that
// rule: callers with company-wide scope see every branch, everyone else only their own.
export async function listGrantedBranches(): Promise<BranchOption[]> {
  await fakeDelay(60);
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const allBranches = scopeLevels().includes('all');
  const ownBranchId = FAKE_PEOPLE.find((p) => p.id === FAKE_ME.id)?.branchId ?? null;
  return structuredClone(FAKE_BRANCHES.filter((b) => allBranches || b.id === ownBranchId));
}

// TODO(Phase 5): replace with the CRM pipelines endpoint; these ids are fake-only.
export async function listPipelineOptions(): Promise<PipelineOption[]> {
  await fakeDelay(60);
  return [
    { id: '01934b10-0000-7000-8000-000000000401', key: 'standard' },
    { id: '01934b10-0000-7000-8000-000000000402', key: 'corporate' },
    { id: '01934b10-0000-7000-8000-000000000403', key: 'renewals' },
  ];
}

// GET {B}/widgets/:id/shares/preview?subjectType=USER|TEAM&subjectId=
export async function previewWidgetShare(
  id: string,
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
): Promise<SharePreview> {
  await fakeDelay(120);
  const widget = findStoredWidget(id);
  // Facts §10: the share preview is for the definition owner holding crm.dashboards.share.
  if (widget.summary.ownerUserId !== FAKE_ME.id || !can('crm.dashboards.share')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const existing = widget.shares.find(
    (s) => s.subjectType === subjectType && s.subjectId === subjectId,
  );
  return fakeSharePreview(subjectType, subjectId, {
    existingAccessLevel: existing?.accessLevel,
    isOwner: subjectType === 'USER' && subjectId === widget.summary.ownerUserId,
    metricKeys: (widget.summary.querySpec?.series ?? []).map((s) => s.metricKey),
  });
}

// TODO(Phase 5): fake-only synchronous lookup. The live share list must return the sharer's display name.
export function userDisplayName(userId: string, lang: 'ar' | 'en'): string | null {
  const person = FAKE_PEOPLE.find((item) => item.id === userId);
  if (!person) return null;
  return lang === 'ar' ? person.nameAr : person.name;
}
