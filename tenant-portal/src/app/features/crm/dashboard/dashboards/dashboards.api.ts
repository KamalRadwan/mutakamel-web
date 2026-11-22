import type {
  CrossFilter,
  DashboardFilters,
  DashboardRun,
  ManualReference,
  PanelOutcome,
  RuntimeFilters,
  Share,
  ShareListItem,
  SharePreview,
  Visualization,
  WidgetExecution,
} from '../../../../shared/widgets/dashboard/analytics.model';
import {
  ApiError,
  FAKE_NOW,
  cursorPageOf,
  fakeDelay,
  fakeDelayFor,
  fakeId,
  pageOf,
  withRunSlot,
  raceAbort,
  type CursorPage,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_CATALOG } from '../../../../shared/widgets/dashboard/fake/fake-catalog';
import {
  FAKE_BRANCHES,
  FAKE_ME,
  FAKE_PEOPLE,
  FAKE_TEAMS,
  fakeLang,
} from '../../../../shared/widgets/dashboard/fake/fake-org';
import {
  applyFakeCalculation,
  applyFakeCrossFilters,
  applyFakeFilterTreeScaling,
  applyFakeTeamDatasets,
  fakeDashboardRun,
  fakeSharePreview,
} from '../../../../shared/widgets/dashboard/fake/fake-results';
import { applyFakePanelMeta } from '../../../../shared/widgets/dashboard/fake/fake-closure';
import { countFilterLeaves } from '../widgets/builder/filter-tree';
import { applyFakeSpecEffects } from '../widgets/widgets.fake';
import { executionStateToPanel } from '../../../../shared/widgets/dashboard/panel-state';
import { WIDGET_STORE, embedded, type StoredWidget } from '../shared/widget-store.fake';
import {
  ADOPTED_BLUEPRINTS,
  BLUEPRINT_BASE_DASHBOARD_ID,
  BLUEPRINT_DEFINITIONS,
  DASHBOARD_SHARES,
  DASHBOARD_STORE,
  SEEDED_WIDGET_OVERRIDES,
  catalogVizSpec,
  materializeDetail,
  type StoredDashboard,
} from './dashboards.fake';
import type {
  BlueprintItem,
  DashboardDetail,
  DashboardSummary,
  DrillRecord,
  DrillResult,
  LayoutItem,
  NavigationItem,
  Placement,
  ScopeInspector,
  VersionBinding,
  VersionBindingResult,
  VersionPolicyProposal,
  BlueprintAdoptionResult,
} from './dashboards.model';

interface IdemEntry {
  fingerprint: string;
  result?: unknown;
  error?: ApiError;
}

const IDEMPOTENCY_LOG = new Map<string, IdemEntry>();
const STAT_CARD_KINDS = new Set<Visualization>(['METRIC_CARD', 'MULTI_KPI', 'PROGRESS_CARD']);

type BoxViolation = readonly [field: 'x' | 'y' | 'w' | 'h', code: string];
const MIN_SIZE_CODES = new Set(['min_width', 'min_height']);
const SIZE_CODES = new Set(['min_width', 'max_width', 'min_height', 'max_height']);

/** Every rule a box breaks, in the backend's order (layout-engine `validateBox`). */
function layoutBoxViolations(
  box: { x: number; y: number; w: number; h: number },
  spec: { minSize: { w: number; h: number }; maxSize?: { w: number; h: number } | null },
): BoxViolation[] {
  const columns = FAKE_CATALOG.grid.columns;
  const maxW = spec.maxSize?.w ?? columns;
  const maxH = spec.maxSize?.h ?? 1200;
  const violations: BoxViolation[] = [];
  if (box.x < 0 || box.x + box.w > columns) violations.push(['x', 'x_out_of_range']);
  if (box.y < 0) violations.push(['y', 'y_out_of_range']);
  if (box.w < spec.minSize.w) violations.push(['w', 'min_width']);
  if (box.w > maxW) violations.push(['w', 'max_width']);
  if (box.h < spec.minSize.h) violations.push(['h', 'min_height']);
  if (box.h > maxH) violations.push(['h', 'max_height']);
  return violations;
}

/**
 * 422 CRM_DASHBOARD_LAYOUT_SIZE_INVALID when a size rule in `sizeCodes` is broken: parallel `path`/`code` (one per
 * violation, paths relative to the body under `base`), plus one `placementId`, `minW`, `minH`. Any other violation
 * is 422 CRM_DASHBOARD_LAYOUT_POSITION_INVALID with no details.
 */
function assertLayoutBox(
  violations: readonly BoxViolation[],
  base: string,
  placementId: string,
  spec: { minSize: { w: number; h: number } },
  sizeCodes: ReadonlySet<string> = SIZE_CODES,
): void {
  if (violations.some(([, code]) => sizeCodes.has(code))) {
    throw new ApiError(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID', {
      path: violations.map(([field]) => (base ? `${base}.${field}` : field)),
      code: violations.map(([, code]) => code),
      placementId: [placementId],
      minW: [String(spec.minSize.w)],
      minH: [String(spec.minSize.h)],
    });
  }
  if (violations.length > 0) throw new ApiError(422, 'CRM_DASHBOARD_LAYOUT_POSITION_INVALID');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withIdempotency<T>(
  scope: string,
  key: string,
  payload: unknown,
  run: () => Promise<T>,
): Promise<T> {
  if (!key || !key.trim()) {
    await fakeDelay();
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7.test(key.trim())) {
    await fakeDelay();
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  const mapKey = `${scope}:${key.trim().toLowerCase()}`;
  const fingerprint = canonicalize(payload);
  const existing = IDEMPOTENCY_LOG.get(mapKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      await fakeDelay();
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    await fakeDelay();
    if (existing.error) {
      throw existing.error;
    }
    return structuredClone(existing.result as T);
  }

  // The gateway commits only 2xx responses: a failed request releases its lease and may be retried with the key.
  const result = await run();
  IDEMPOTENCY_LOG.set(mapKey, { fingerprint, result: structuredClone(result) });
  return result;
}

function findDashboardRecord(id: string): StoredDashboard {
  const found = DASHBOARD_STORE.find((entry) => entry.detail.id === id);
  if (!found) {
    throw new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND');
  }
  return found;
}

function assertWriteAccess(record: StoredDashboard): void {
  if (record.detail.accessLevel === 'VIEW') {
    throw new ApiError(403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED');
  }
}

function assertOwnerAccess(record: StoredDashboard): void {
  if (record.detail.accessLevel !== 'OWNER' && record.detail.ownerUserId !== FAKE_ME.id) {
    throw new ApiError(403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED');
  }
}

function assertLayoutUnlocked(record: StoredDashboard): void {
  if (record.detail.isLayoutLocked) {
    throw new ApiError(409, 'CRM_DASHBOARD_LAYOUT_LOCKED');
  }
}

function toSummary(stored: StoredDashboard): DashboardSummary {
  const detail = materializeDetail(stored);
  const {
    layoutCollisionMode: _collision,
    isLayoutLocked: _locked,
    breakpoints: _bp,
    layouts: _layouts,
    placements: _placements,
    unavailablePlacements: _unavail,
    widgets: _widgets,
    blueprintRevision: _blueprintRevision,
    templateVersionPolicy: _templatePolicy,
    ...rest
  } = detail;
  return { ...rest, lastOpenedAt: stored.lastOpenedAt };
}

function normalizeAndValidateName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { name: [trimmed.length < 1 ? 'min_length' : 'max_length'] });
  }
  return trimmed;
}

function validateDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length > 500) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { description: ['max_length'] });
  }
  return trimmed.length ? trimmed : null;
}

function assertUniqueOwnName(name: string, excludeId?: string): void {
  const target = name.toLowerCase();
  const conflict = DASHBOARD_STORE.some((entry) => {
    if (entry.detail.id === excludeId) return false;
    if (entry.detail.ownerUserId !== FAKE_ME.id) return false;
    const mat = materializeDetail(entry);
    return (
      entry.detail.name.trim().toLowerCase() === target ||
      mat.name.trim().toLowerCase() === target
    );
  });
  if (conflict) {
    throw new ApiError(409, 'CRM_DASHBOARD_NAME_CONFLICT');
  }
}

function uniqueCopyName(baseName: string): string {
  const suffix = fakeLang() === 'ar' ? 'نسخة' : 'Copy';
  const existingNames = new Set(
    DASHBOARD_STORE.filter((entry) => entry.detail.ownerUserId === FAKE_ME.id).flatMap((entry) => [
      entry.detail.name.trim().toLowerCase(),
      materializeDetail(entry).name.trim().toLowerCase(),
    ]),
  );
  const candidate1 = `${baseName} (${suffix})`.slice(0, 120);
  if (!existingNames.has(candidate1.toLowerCase())) return candidate1;
  for (let n = 2; n < 100; n++) {
    const candidate = `${baseName} (${suffix} ${n})`.slice(0, 120);
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName.slice(0, 100)} ${fakeId().slice(0, 8)}`;
}

function boxesOverlap(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function desktopLayout(record: StoredDashboard): LayoutItem[] {
  return record.detail.layouts['desktop']?.items ?? [];
}

function buildVersionBinding(
  record: StoredDashboard,
  placement: Placement,
  storedWidget: StoredWidget,
): VersionBinding {
  const activeVersion =
    storedWidget.summary.versionNumber ??
    storedWidget.versions[storedWidget.versions.length - 1]?.versionNumber ??
    1;
  const selectedVersion =
    placement.versionPolicy === 'PINNED' && placement.pinnedVersionNumber !== null
      ? placement.pinnedVersionNumber
      : activeVersion;
  const box = desktopLayout(record).find((item) => item.placementId === placement.id);

  return {
    dashboardId: record.detail.id,
    placementId: placement.id,
    widgetId: placement.widgetId,
    dashboardRevision: record.detail.revision,
    widgetRevision: storedWidget.summary.revision,
    governanceRevision: storedWidget.summary.governanceRevision,
    versionPolicy: placement.versionPolicy,
    pinnedVersionNumber: placement.pinnedVersionNumber,
    activeVersionNumber: activeVersion,
    selectedVersionNumber: selectedVersion,
    placement: box
      ? { x: box.x, y: box.y, w: box.w, h: box.h }
      : { x: 0, y: 0, w: 16, h: 37 },
  };
}

function findPlacementAndWidget(
  record: StoredDashboard,
  placementId: string,
): { placement: Placement; storedWidget: StoredWidget } {
  const placement = record.detail.placements.find((p) => p.id === placementId);
  if (!placement) {
    throw new ApiError(404, 'CRM_DASHBOARD_PLACEMENT_NOT_FOUND');
  }
  const storedWidget = WIDGET_STORE.find((w) => w.summary.id === placement.widgetId);
  if (!storedWidget) {
    throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
  }
  return { placement, storedWidget };
}

function catalogMetricOf(metricKey: string | undefined) {
  return metricKey ? FAKE_CATALOG.metrics.find((m) => m.key === metricKey) : undefined;
}

function cloneForBlueprint(
  source: StoredDashboard,
  newName: string,
  blueprintKey: string,
  definitionRevision: number,
): StoredDashboard {
  const isAr = fakeLang() === 'ar';
  const id = fakeId();
  const placementIdMap = new Map<string, string>();
  const newPlacements: Placement[] = source.detail.placements.map((p, idx) => {
    const newPlId = fakeId();
    placementIdMap.set(p.id, newPlId);
    const widgetEntry = WIDGET_STORE.find((w) => w.summary.id === p.widgetId);
    return {
      ...structuredClone(p),
      id: newPlId,
      dashboardId: id,
      widget: widgetEntry ? embedded(widgetEntry) : structuredClone(p.widget),
    };
  });

  const newDesktopItems: LayoutItem[] = desktopLayout(source)
    .filter((item) => placementIdMap.has(item.placementId))
    .map((item) => ({
      ...structuredClone(item),
      placementId: placementIdMap.get(item.placementId)!,
      origin: 'BLUEPRINT' as const,
    }));

  const detail: DashboardDetail = {
    ...structuredClone(source.detail),
    id,
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name: newName,
    description: isAr && source.descriptionAr ? source.descriptionAr : source.detail.description,
    // Adoption records `blueprint_key` and `blueprint_revision`; `source_template_key` is frozen (no new writes).
    sourceTemplateKey: null,
    blueprintKey,
    blueprintRevision: definitionRevision,
    templateVersionPolicy: null,
    revision: 1,
    createdAt: FAKE_NOW,
    updatedAt: FAKE_NOW,
    accessLevel: 'OWNER',
    isShared: false,
    isDefault: false,
    isFavorite: false,
    isLayoutLocked: false,
    placements: newPlacements,
    unavailablePlacements: [],
    layouts: {
      desktop: {
        origin: 'MATERIALIZED',
        items: newDesktopItems,
      },
    },
    widgets: newPlacements.map((p) => p.widget),
  };

  return {
    detail,
    lastOpenedAt: FAKE_NOW,
  };
}

/** The navigation query: no `search` (list route only). */
export type NavigationQuery = { kind?: 'DASHBOARD' | 'REPORT'; cursor?: string | null; limit?: number };

// GET {B}/dashboards?kind=&search=&cursor=&limit=  -> { items, nextCursor } (cursor = last id, UUIDv7; limit 1..100, default 50)
// `search` (lead decision 2026-11-22): optional, 1..120 characters, case-insensitive match on the dashboard name (ar or en).
export async function listDashboards(
  q: { kind?: 'DASHBOARD' | 'REPORT'; cursor?: string | null; limit?: number; search?: string } = {},
): Promise<CursorPage<DashboardSummary>> {
  await fakeDelay();
  const needle = (q.search ?? '').trim().toLowerCase();
  if (q.search !== undefined && (needle.length < 1 || needle.length > 120)) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { search: [needle.length < 1 ? 'min_length' : 'max_length'] });
  }
  const filtered = DASHBOARD_STORE.filter((entry) =>
    q.kind ? entry.detail.kind === q.kind : true,
  ).map(toSummary);
  const arNames = new Map(DASHBOARD_STORE.map((entry) => [entry.detail.id, entry.nameAr ?? '']));
  const matched = needle
    ? filtered.filter((item) =>
        [item.name, arNames.get(item.id) ?? ''].some((text) => text.toLowerCase().includes(needle)),
      )
    : filtered;
  return structuredClone(cursorPageOf(matched, q.cursor ?? null, q.limit ?? 50));
}

// GET {B}/dashboards/navigation?kind=&cursor=&limit=
// `search` belongs to the list route only: navigation refuses it (400 CRM_VALIDATION_FAILED, non-whitelisted
// property). The app never sends it; the fake takes a loose query so a stray `search` fails like the backend.
export async function getNavigation(q: NavigationQuery = {}): Promise<{
  items: NavigationItem[];
  nextCursor: string | null;
  activeDashboardId: string | null;
}> {
  await fakeDelay();
  if ('search' in q) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { search: ['whitelist_validation'] });
  }
  const dashboards = DASHBOARD_STORE.filter((entry) => entry.detail.kind === 'DASHBOARD');
  const items: NavigationItem[] = dashboards.map((entry) => {
    const mat = materializeDetail(entry);
    return {
      id: mat.id,
      name: mat.name,
      isDefault: mat.isDefault,
      isFavorite: mat.isFavorite,
      isShared: mat.isShared,
      accessLevel: mat.accessLevel,
      ownerUserId: mat.ownerUserId,
      ownerName: mat.ownerName,
      revision: mat.revision,
      updatedAt: mat.updatedAt,
    };
  });
  const activeDashboardId =
    items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? null;

  return structuredClone({
    items,
    nextCursor: null,
    activeDashboardId,
  });
}

// GET {B}/dashboards/default
export async function getDefaultDashboard(): Promise<DashboardDetail> {
  await fakeDelay();
  const found = DASHBOARD_STORE.find(
    (entry) => entry.detail.kind === 'DASHBOARD' && entry.detail.isDefault,
  );
  if (!found) {
    throw new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND');
  }
  found.lastOpenedAt = FAKE_NOW;
  return structuredClone(materializeDetail(found));
}

// GET {B}/dashboards/:id
export async function getDashboard(id: string): Promise<DashboardDetail> {
  await fakeDelay();
  const found = findDashboardRecord(id);
  found.lastOpenedAt = FAKE_NOW;
  return structuredClone(materializeDetail(found));
}

// POST {B}/dashboards  201 (header x-idempotency-key: gateway-enforced)
export async function createDashboard(
  body: { name: string; description?: string | null },
  key: string,
): Promise<DashboardDetail> {
  return withIdempotency('createDashboard', key, body, async () => {
    await fakeDelay();
    const name = normalizeAndValidateName(body.name ?? '');
    const description = validateDescription(body.description);
    assertUniqueOwnName(name);

    const id = fakeId();
    const stored: StoredDashboard = {
      detail: {
        id,
        ownerUserId: FAKE_ME.id,
        ownerName: FAKE_ME.name,
        name,
        description,
        defaultFilters: { datePreset: 'CURRENT_MONTH', compare: 'PREVIOUS_PERIOD' },
        sourceTemplateKey: null,
        schemaVersion: 2,
        revision: 1,
        createdAt: FAKE_NOW,
        updatedAt: FAKE_NOW,
        accessLevel: 'OWNER',
        isShared: false,
        isDefault: false,
        isFavorite: false,
        kind: 'DASHBOARD',
        blueprintKey: null,
        blueprintRevision: null,
        templateVersionPolicy: null,
        layoutCollisionMode: 'PUSH',
        isLayoutLocked: false,
        breakpoints: [
          {
            breakpointKey: 'desktop',
            gridColumns: FAKE_CATALOG.grid.columns,
            rowHeightPx: FAKE_CATALOG.grid.rowHeightPx,
            minViewportPx: 1024,
            derivesFromKey: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ],
        layouts: {
          desktop: {
            origin: 'MATERIALIZED',
            items: [],
          },
        },
        placements: [],
        unavailablePlacements: [],
        widgets: [],
      },
      lastOpenedAt: FAKE_NOW,
    };

    DASHBOARD_STORE.unshift(stored);
    return structuredClone(materializeDetail(stored));
  });
}

// PATCH {B}/dashboards/:id
export async function patchDashboard(
  id: string,
  body: {
    revision: number;
    name?: string;
    description?: string | null;
    defaultFilters?: DashboardFilters;
  },
): Promise<DashboardDetail> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertWriteAccess(record);
  if (body.revision !== record.detail.revision) {
    throw new ApiError(409, 'CRM_DASHBOARD_REVISION_CONFLICT');
  }

  if (body.name !== undefined) {
    const nextName = normalizeAndValidateName(body.name);
    assertUniqueOwnName(nextName, id);
    record.detail.name = nextName;
    delete record.nameAr;
  }
  if (body.description !== undefined) {
    record.detail.description = validateDescription(body.description);
    delete record.descriptionAr;
  }
  if (body.defaultFilters !== undefined) {
    record.detail.defaultFilters = structuredClone(body.defaultFilters);
  }

  record.detail.revision += 1;
  record.detail.updatedAt = FAKE_NOW;
  return structuredClone(materializeDetail(record));
}

// DELETE {B}/dashboards/:id
export async function deleteDashboard(id: string): Promise<void> {
  await fakeDelay();
  const idx = DASHBOARD_STORE.findIndex((entry) => entry.detail.id === id);
  if (idx === -1) {
    throw new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND');
  }
  assertOwnerAccess(DASHBOARD_STORE[idx]);
  DASHBOARD_STORE.splice(idx, 1);
  DASHBOARD_SHARES.delete(id);
  for (const [bpKey, adopted] of ADOPTED_BLUEPRINTS.entries()) {
    if (adopted.dashboardId === id) {
      ADOPTED_BLUEPRINTS.delete(bpKey);
    }
  }
}

// POST {B}/dashboards/:id/duplicate  (header x-idempotency-key: gateway-enforced)
export async function duplicateDashboard(
  id: string,
  name: string | null,
  key: string,
): Promise<DashboardDetail & { duplication: { omittedUnavailableWidgetCount?: number; warnings: string[] } }> {
  return withIdempotency(`duplicateDashboard:${id}`, key, { id, name }, async () => {
    await fakeDelay();
    const source = findDashboardRecord(id);
    const localizedSource = materializeDetail(source);
    const nextName =
      name !== null ? normalizeAndValidateName(name) : uniqueCopyName(localizedSource.name);
    if (name !== null) {
      assertUniqueOwnName(nextName);
    }

    const newId = fakeId();
    const placementIdMap = new Map<string, string>();
    const newPlacements: Placement[] = localizedSource.placements.map((p, idx) => {
      const newPlId = fakeId();
      placementIdMap.set(p.id, newPlId);
      return {
        ...structuredClone(p),
        id: newPlId,
        dashboardId: newId,
      };
    });
    const newLayoutItems: LayoutItem[] = (localizedSource.layouts['desktop']?.items ?? [])
      .filter((item) => placementIdMap.has(item.placementId))
      .map((item) => ({
        ...structuredClone(item),
        placementId: placementIdMap.get(item.placementId)!,
        origin: 'MANUAL' as const,
      }));

    const omittedCount = localizedSource.unavailablePlacements.length;
    const isAr = fakeLang() === 'ar';
    const copy: StoredDashboard = {
      detail: {
        ...structuredClone(localizedSource),
        id: newId,
        ownerUserId: FAKE_ME.id,
        ownerName: FAKE_ME.name,
        name: nextName,
        description: isAr && source.descriptionAr ? source.descriptionAr : localizedSource.description,
        sourceTemplateKey: source.detail.blueprintKey ?? source.detail.sourceTemplateKey,
        blueprintKey: null,
        blueprintRevision: null,
        templateVersionPolicy: null,
        revision: 1,
        createdAt: FAKE_NOW,
        updatedAt: FAKE_NOW,
        accessLevel: 'OWNER',
        isShared: false,
        isDefault: false,
        isFavorite: false,
        kind: 'DASHBOARD',
        isLayoutLocked: false,
        layouts: {
          desktop: {
            origin: 'MATERIALIZED',
            items: newLayoutItems,
          },
        },
        placements: newPlacements,
        unavailablePlacements: [],
        widgets: newPlacements.map((p) => p.widget),
      },
      lastOpenedAt: FAKE_NOW,
    };

    DASHBOARD_STORE.unshift(copy);
    const resultDetail = materializeDetail(copy);
    return structuredClone({
      ...resultDetail,
      duplication: {
        ...(omittedCount > 0 ? { omittedUnavailableWidgetCount: omittedCount } : {}),
        warnings: omittedCount > 0 ? ['UNAVAILABLE_WIDGETS_OMITTED'] : [],
      },
    });
  });
}

// PUT {B}/dashboards/:id/default  (header x-idempotency-key: gateway-enforced)
export async function setDefaultDashboard(id: string, key: string): Promise<DashboardDetail> {
  return withIdempotency(`setDefault:${id}`, key, { id }, async () => {
    await fakeDelay();
    const record = findDashboardRecord(id);
    if (record.detail.kind !== 'DASHBOARD') {
      throw new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND');
    }
    for (const entry of DASHBOARD_STORE) {
      entry.detail.isDefault = entry.detail.id === id;
    }
    return structuredClone(materializeDetail(record));
  });
}

// PUT {B}/dashboards/:id/favorite  (header x-idempotency-key: gateway-enforced)
export async function setFavoriteDashboard(
  id: string,
  favorite: boolean,
  key: string,
): Promise<DashboardDetail> {
  return withIdempotency(`setFavorite:${id}`, key, { id, favorite }, async () => {
    await fakeDelay();
    const record = findDashboardRecord(id);
    record.detail.isFavorite = Boolean(favorite);
    return structuredClone(materializeDetail(record));
  });
}

const CROSS_FILTER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateCrossFilters(crossFilters: readonly CrossFilter[] | undefined): void {
  if (!crossFilters || crossFilters.length === 0) return;
  if (crossFilters.length > 10) {
    throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
  }
  for (const sel of crossFilters) {
    if (!sel.placementId || !sel.field || !Array.isArray(sel.values) || sel.values.length === 0 || sel.values.length > 50) {
      throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
    }
    const isUuidField = sel.field === 'branch' || sel.field === 'company' || sel.field === 'owner';
    for (const val of sel.values) {
      if (typeof val !== 'string' || val.length === 0 || val.length > 200) {
        throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
      }
      if (isUuidField && !CROSS_FILTER_UUID_RE.test(val)) {
        throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
      }
    }
  }
}

function supportsCrossFilterField(
  field: string,
  viz: Visualization,
  dimKey: string | undefined,
  supportedFilters: readonly string[] | undefined,
  dimensions: readonly string[] | undefined,
): boolean {
  if (viz === 'ALERT_LIST') return false;
  if (field !== 'branch' && field !== 'company' && field !== 'owner') return false;
  if (dimKey === field || dimensions?.includes(field)) return true;
  if (field === 'branch') return Boolean(supportedFilters?.includes('branchId'));
  if (field === 'owner') return Boolean(supportedFilters?.includes('ownerUserId'));
  if (field === 'company') return Boolean(supportedFilters?.includes('companyId'));
  return false;
}

// POST {B}/dashboards/:id/run
export function runDashboard(
  id: string,
  body: { filters?: RuntimeFilters; crossFilters?: CrossFilter[]; widgetIds?: string[]; refresh?: boolean } = {},
  signal?: AbortSignal,
): Promise<DashboardRun> {
  return withRunSlot(() => raceAbort(() => runDashboardUnguarded(id, body), signal));
}

async function runDashboardUnguarded(
  id: string,
  body: { filters?: RuntimeFilters; crossFilters?: CrossFilter[]; widgetIds?: string[]; refresh?: boolean },
): Promise<DashboardRun> {
  if (body.widgetIds && body.widgetIds.length > 20) {
    await fakeDelay();
    throw new ApiError(422, 'CRM_DASHBOARD_RUN_PANEL_LIMIT_EXCEEDED');
  }

  validateCrossFilters(body.crossFilters);

  const record = DASHBOARD_STORE.find((entry) => entry.detail.id === id);
  if (!record) {
    await fakeDelay();
    throw new ApiError(404, 'CRM_DASHBOARD_NOT_FOUND');
  }

  const filterSet = body.widgetIds?.length ? new Set(body.widgetIds) : null;
  const targetPlacements = record.detail.placements.filter((p) =>
    filterSet ? filterSet.has(p.widgetId) : true,
  );
  const seedKey = body.widgetIds?.[0] ?? targetPlacements[0]?.widgetId ?? id;

  await fakeDelayFor('run', seedKey);

  const filters: RuntimeFilters = structuredClone(body.filters ?? {});
  const currency: 'EGP' | 'USD' = filters.currencyCode === 'USD' ? 'USD' : 'EGP';
  const specs = targetPlacements.map((p) => {
    const override = SEEDED_WIDGET_OVERRIDES[p.widgetId];
    return {
      widgetId: p.widgetId,
      kind: p.widget.visualizationType,
      state: override?.executionState ?? ('READY' as const),
    };
  });

  // Same branches as the fake scope inspector: all on own dashboards, the first two on shared ones (partialAccess).
  const readableBranchIds = record.detail.ownerUserId === FAKE_ME.id ? undefined : [FAKE_BRANCHES[0].id, FAKE_BRANCHES[1].id];
  const run = fakeDashboardRun(record.detail.id, record.detail.revision, specs, filters, readableBranchIds);

  const periodFrom = filters.dateFrom?.slice(0, 10);
  const periodTo = filters.dateTo?.slice(0, 10);
  const hasCustomPeriod =
    Boolean(periodFrom && /^\d{4}-\d{2}-\d{2}$/.test(periodFrom)) &&
    Boolean(periodTo && /^\d{4}-\d{2}-\d{2}$/.test(periodTo));

  const nextOutcomes: PanelOutcome[] = [];
  let budgetClipped = false;
  for (const placement of targetPlacements) {
    const wId = placement.widgetId;
    let exec: WidgetExecution | undefined = run.widgets[wId];
    const baseOutcome = run.panels.find((o) => o.panelKey === wId);
    const override = SEEDED_WIDGET_OVERRIDES[wId];
    const metricKeys = placement.widget.querySpec.series.map((s) => s.metricKey);
    const primaryMetric = catalogMetricOf(metricKeys[0]);
    const dimKey = placement.widget.querySpec.dimension?.key;
    let crossNotApplicable = false;

    if (exec) {
      exec.widgetRevision = placement.widget.revision;
      exec.versionNumber = placement.versionPolicy === 'PINNED' && placement.pinnedVersionNumber !== null
        ? placement.pinnedVersionNumber
        : placement.widget.versionNumber;
      if (hasCustomPeriod && exec.meta.effectivePeriod) {
        exec.meta.effectivePeriod = {
          ...exec.meta.effectivePeriod,
          from: periodFrom!,
          to: periodTo!,
        };
      }
      if (primaryMetric) {
        exec.meta.timeBasis = primaryMetric.timeModel;
      }

      const calc = placement.widget.querySpec.series[0]?.calculation;
      if (calc && exec.state === 'READY' && primaryMetric) {
        const isFixturePair =
          primaryMetric.key === 'crm.opportunities.open.count' &&
          calc.operandMetricKey === 'crm.opportunities.overdue_close.count';
        exec = applyFakeCalculation(
          exec,
          calc.operation,
          isFixturePair ? 100 : 120,
          isFixturePair ? 120 : 80,
          calc.operandMetricKey,
          primaryMetric.unit,
        );
      } else if (
        placement.widget.querySpec.comparison?.type === 'DATASETS' &&
        placement.widget.querySpec.comparison.basis === 'TEAM' &&
        exec.state === 'READY'
      ) {
        const teams = (placement.widget.querySpec.comparison.datasets ?? []).map((ds, idx) => ({
          teamId: ds.teamId ?? `team-${idx + 1}`,
          label: ds.label?.trim() || `Team ${idx + 1}`,
        }));
        exec = applyFakeTeamDatasets(exec, teams);
      }

      if (placement.widget.querySpec.filterTree && exec.state === 'READY') {
        exec = applyFakeFilterTreeScaling(exec, countFilterLeaves(placement.widget.querySpec.filterTree));
      }

      if (body.crossFilters && body.crossFilters.length > 0 && exec.state === 'READY') {
        const supported = body.crossFilters.every((cf) =>
          supportsCrossFilterField(
            cf.field,
            placement.widget.visualizationType,
            dimKey,
            primaryMetric?.supportedFilters,
            primaryMetric?.dimensions,
          ),
        );
        if (supported) {
          exec = applyFakeCrossFilters(exec, dimKey, body.crossFilters);
        } else {
          crossNotApplicable = true;
          exec.meta = {
            ...exec.meta,
            warnings: Array.from(new Set([...(exec.meta.warnings ?? []), 'CROSS_FILTER_NOT_APPLICABLE'])),
          };
        }
      }

      exec = applyFakeSpecEffects(exec, placement.widget.querySpec, currency, override?.targetScenario);
      if (override?.meta) {
        exec = applyFakePanelMeta(exec, override.meta);
      }
      if (override?.budgetClipped) {
        budgetClipped = true;
      }

      const manualRefs = placement.widget.displaySpec?.references;
      if (manualRefs && manualRefs.length > 0) {
        const mappedRefs: ManualReference[] = manualRefs.map((ref) => ({
          kind: 'MANUAL',
          seriesIndex: ref.seriesIndex,
          unit: ref.unit,
          value: ref.value,
          label: ref.label,
        }));
        exec.meta = {
          ...exec.meta,
          references: mappedRefs,
        };
      }

      if (exec.meta.unit === 'MONEY' && currency) {
        exec.meta.currency = currency;
      }

      if (override?.reasonCode && override.executionState !== 'READY') {
        exec.error = { code: override.reasonCode, ...(override.sourceKey ? { sourceKey: override.sourceKey } : {}) };
      }

      run.widgets[wId] = exec;
    }

    if (baseOutcome) {
      baseOutcome.metricKeys = metricKeys;
      if (override?.panelState) {
        baseOutcome.state = override.panelState;
      } else if (exec) {
        baseOutcome.state = executionStateToPanel(exec.state);
      }
      if (override?.budgetClipped && baseOutcome.state === 'READY') {
        baseOutcome.state = 'PARTIAL';
      }
      if (crossNotApplicable) {
        baseOutcome.warnings = Array.from(
          new Set([...(baseOutcome.warnings ?? []), 'CROSS_FILTER_NOT_APPLICABLE']),
        );
      }
      if (exec?.state === 'UNAVAILABLE' && exec.error?.code === 'SOURCE_NOT_READY' && exec.error.sourceKey === 'core.team_membership_history') {
        baseOutcome.unavailable = {
          reasonCode: 'SOURCE_NOT_READY',
          sourceKey: 'core.team_membership_history',
        };
      } else if (override?.reasonCode) {
        baseOutcome.unavailable = {
          reasonCode: override.reasonCode,
          ...(override.sourceKey ? { sourceKey: override.sourceKey } : {}),
        };
      }
      nextOutcomes.push(baseOutcome);
    }
  }

  run.panels = nextOutcomes;
  const timedOut = Object.values(run.widgets).some((w) => w.state === 'DEADLINE_EXCEEDED');
  const deadlineExceeded = timedOut || budgetClipped;
  run.budget = {
    deadlineMs: 20_000,
    elapsedMs: deadlineExceeded ? 20_000 : 480 + targetPlacements.length * 120,
    statementCount: Math.max(1, targetPlacements.length) * 3,
    deadlineExceeded,
  };
  // The run lists unavailable placements with their primary (desktop) box; the detail lists id/order/reason only.
  const runBoxes = new Map(desktopLayout(record).map((item) => [item.placementId, item]));
  run.unavailablePlacements = filterSet
    ? []
    : record.detail.unavailablePlacements.map((u) => {
        const box = runBoxes.get(u.id);
        return { ...u, x: box?.x ?? 0, y: box?.y ?? 0, width: box?.w ?? 0, height: box?.h ?? 0 };
      });

  return structuredClone(run);
}

// PUT {B}/dashboards/:id/layout  (header x-idempotency-key: gateway-enforced)
export async function saveLayout(
  id: string,
  body: {
    revision: number;
    breakpointKey: 'desktop';
    items: {
      placementId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      zIndex: number;
      isHidden: boolean;
    }[];
  },
  key: string,
): Promise<DashboardDetail & { adjusted: boolean }> {
  return withIdempotency(`saveLayout:${id}`, key, body, async () => {
    await fakeDelay();
    const record = findDashboardRecord(id);
    assertWriteAccess(record);
    assertLayoutUnlocked(record);

    if (body.breakpointKey !== 'desktop') {
      throw new ApiError(422, 'CRM_DASHBOARD_BREAKPOINT_UNKNOWN');
    }
    if (body.revision !== record.detail.revision) {
      throw new ApiError(409, 'CRM_DASHBOARD_LAYOUT_STALE');
    }
    if (body.items.length > 60) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED', { items: ['array_max_size'] });
    }

    const placementMap = new Map(record.detail.placements.map((p) => [p.id, p]));
    const storedLayoutMap = new Map(desktopLayout(record).map((item) => [item.placementId, item]));
    const nextItems: LayoutItem[] = [];

    for (const [index, raw] of body.items.entries()) {
      const placement = placementMap.get(raw.placementId);
      if (!placement) {
        throw new ApiError(404, 'CRM_DASHBOARD_PLACEMENT_NOT_FOUND');
      }
      const x = Math.trunc(raw.x);
      const y = Math.trunc(raw.y);
      const w = Math.trunc(raw.w);
      const h = Math.trunc(raw.h);

      if (![raw.x, raw.y, raw.w, raw.h].every(Number.isFinite)) {
        throw new ApiError(422, 'CRM_DASHBOARD_LAYOUT_POSITION_INVALID');
      }

      const spec = catalogVizSpec(placement.widget.visualizationType);
      const storedBox = storedLayoutMap.get(raw.placementId);
      // Moving or resubmitting a stored stat card keeps its published width (the backend drops only `min_width`).
      const unchangedStatSize =
        STAT_CARD_KINDS.has(placement.widget.visualizationType) &&
        storedBox !== undefined &&
        w === storedBox.w &&
        h === storedBox.h;
      const violations = layoutBoxViolations({ x, y, w, h }, spec).filter(
        ([, code]) => code !== 'min_width' || !unchangedStatSize,
      );
      assertLayoutBox(violations, `items.${index}`, raw.placementId, spec);

      nextItems.push({
        placementId: raw.placementId,
        x,
        y,
        w,
        h,
        zIndex: Math.trunc(raw.zIndex ?? 0),
        isHidden: Boolean(raw.isHidden),
        origin: 'MANUAL',
      });
    }

    nextItems.sort((a, b) => a.y - b.y || a.x - b.x || a.placementId.localeCompare(b.placementId));

    let adjusted = false;
    for (let i = 0; i < nextItems.length; i++) {
      for (let j = i + 1; j < nextItems.length; j++) {
        if (boxesOverlap(nextItems[i], nextItems[j])) {
          if (record.detail.layoutCollisionMode === 'BLOCK') {
            throw new ApiError(409, 'CRM_DASHBOARD_LAYOUT_OVERLAP');
          }
          if (record.detail.layoutCollisionMode === 'PUSH') {
            nextItems[j].y = nextItems[i].y + nextItems[i].h;
            adjusted = true;
          }
        }
      }
    }

    if (adjusted) {
      let changed = true;
      while (changed) {
        changed = false;
        nextItems.sort((a, b) => a.y - b.y || a.x - b.x);
        for (let i = 0; i < nextItems.length; i++) {
          for (let j = i + 1; j < nextItems.length; j++) {
            if (boxesOverlap(nextItems[i], nextItems[j])) {
              nextItems[j].y = nextItems[i].y + nextItems[i].h;
              changed = true;
            }
          }
        }
      }
    }

    record.detail.layouts['desktop'] = {
      origin: 'MATERIALIZED',
      items: nextItems,
    };
    record.detail.revision += 1;
    record.detail.updatedAt = FAKE_NOW;

    return structuredClone({
      ...materializeDetail(record),
      adjusted,
    });
  });
}

// POST {B}/dashboards/:id/placements  (header x-idempotency-key: gateway-enforced)
export async function addPlacement(
  id: string,
  body: { widgetId: string; x?: number; y?: number; w?: number; h?: number },
  key: string,
): Promise<Placement & { x: number; y: number; w: number; h: number; dashboardRevision: number }> {
  return withIdempotency(`addPlacement:${id}`, key, body, async () => {
    await fakeDelay();
    const record = findDashboardRecord(id);
    assertWriteAccess(record);
    assertLayoutUnlocked(record);

    if (record.detail.placements.length >= FAKE_CATALOG.grid.maxWidgets) {
      throw new ApiError(422, 'CRM_DASHBOARD_WIDGET_LIMIT_EXCEEDED');
    }
    if (record.detail.placements.some((p) => p.widgetId === body.widgetId)) {
      throw new ApiError(409, 'CRM_DASHBOARD_WIDGET_ALREADY_ADDED');
    }

    const storedWidget = WIDGET_STORE.find((w) => w.summary.id === body.widgetId);
    if (!storedWidget) {
      throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
    }
    if (storedWidget.summary.status !== 'PUBLISHED') {
      throw new ApiError(422, 'CRM_DASHBOARD_WIDGET_SELECTION_INVALID');
    }

    const widgetObj = embedded(storedWidget);
    const spec = catalogVizSpec(widgetObj.visualizationType);
    const existingItems = desktopLayout(record);
    const maxBottom = existingItems.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);

    const w = Math.trunc(body.w ?? spec.defaultSize.w);
    const h = Math.trunc(body.h ?? spec.defaultSize.h);
    const x = Math.trunc(body.x ?? 0);
    const y = Math.trunc(body.y ?? maxBottom);

    const placementId = fakeId();
    // Add: only a box below the minimum is a size error (paths sit at the body root: `w`, `h`).
    assertLayoutBox(layoutBoxViolations({ x, y, w, h }, spec), '', placementId, spec, MIN_SIZE_CODES);

    const placement: Placement = {
      id: placementId,
      dashboardId: record.detail.id,
      widgetId: widgetObj.id,
      sortOrder: record.detail.placements.length,
      versionPolicy: 'FOLLOW_ACTIVE',
      pinnedVersionNumber: null,
      widget: widgetObj,
    };

    record.detail.placements.push(placement);
    if (!record.detail.layouts['desktop']) {
      record.detail.layouts['desktop'] = { origin: 'MATERIALIZED', items: [] };
    }
    record.detail.layouts['desktop'].items.push({
      placementId,
      x,
      y,
      w,
      h,
      zIndex: 0,
      isHidden: false,
      origin: 'MANUAL',
    });
    if (!record.detail.widgets.some((wItem) => wItem.id === widgetObj.id)) {
      record.detail.widgets.push(widgetObj);
    }

    record.detail.revision += 1;
    record.detail.updatedAt = FAKE_NOW;

    return structuredClone({
      ...placement,
      x,
      y,
      w,
      h,
      dashboardRevision: record.detail.revision,
    });
  });
}

// DELETE {B}/dashboards/:id/placements/:placementId
export async function removePlacement(
  id: string,
  placementId: string,
): Promise<{ dashboardRevision: number }> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertWriteAccess(record);
  assertLayoutUnlocked(record);

  const plIdx = record.detail.placements.findIndex((p) => p.id === placementId);
  const unavailIdx = record.detail.unavailablePlacements.findIndex((u) => u.id === placementId);

  if (plIdx === -1 && unavailIdx === -1) {
    throw new ApiError(404, 'CRM_DASHBOARD_PLACEMENT_NOT_FOUND');
  }

  if (plIdx !== -1) {
    const [removed] = record.detail.placements.splice(plIdx, 1);
    const desktop = record.detail.layouts['desktop'];
    if (desktop) {
      desktop.items = desktop.items.filter((item) => item.placementId !== placementId);
    }
    if (!record.detail.placements.some((p) => p.widgetId === removed.widgetId)) {
      record.detail.widgets = record.detail.widgets.filter((w) => w.id !== removed.widgetId);
    }
  } else {
    record.detail.unavailablePlacements.splice(unavailIdx, 1);
  }

  record.detail.revision += 1;
  record.detail.updatedAt = FAKE_NOW;
  return { dashboardRevision: record.detail.revision };
}

// GET {B}/dashboards/:id/placements/:placementId/version-policy
export async function getVersionBinding(id: string, placementId: string): Promise<VersionBinding> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  const { placement, storedWidget } = findPlacementAndWidget(record, placementId);
  return structuredClone(buildVersionBinding(record, placement, storedWidget));
}

// POST {B}/dashboards/:id/placements/:placementId/version-policy/impact
export async function previewVersionPolicy(
  id: string,
  placementId: string,
  body: {
    versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
    pinnedVersionNumber: number | null;
    expectedDashboardRevision: number;
    expectedWidgetRevision: number;
    expectedGovernanceRevision: number;
  },
): Promise<{ current: VersionBinding; proposed: VersionPolicyProposal }> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertWriteAccess(record);
  const { placement, storedWidget } = findPlacementAndWidget(record, placementId);
  const current = buildVersionBinding(record, placement, storedWidget);
  return structuredClone({ current, proposed: planVersionPolicy(record, placementId, storedWidget, current, body) });
}

/**
 * dashboard-placement-version.service.ts validate() + plan(): PINNED needs a version number and FOLLOW_ACTIVE needs
 * null (422 INVALID); stale revisions are 409 STALE; a version above the active one or missing is 404
 * CRM_WIDGET_VERSION_NOT_FOUND. A box too small for the selected version moves to the bottom at the default size.
 */
function planVersionPolicy(
  record: StoredDashboard,
  placementId: string,
  storedWidget: StoredWidget,
  current: VersionBinding,
  body: {
    versionPolicy: unknown;
    pinnedVersionNumber: unknown;
    expectedDashboardRevision: unknown;
    expectedWidgetRevision: unknown;
    expectedGovernanceRevision: unknown;
  },
): VersionPolicyProposal {
  const revision = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
  const policy = body.versionPolicy;
  if (
    (policy !== 'FOLLOW_ACTIVE' && policy !== 'PINNED') ||
    (policy === 'PINNED' ? !revision(body.pinnedVersionNumber) : body.pinnedVersionNumber !== null) ||
    ![body.expectedDashboardRevision, body.expectedWidgetRevision, body.expectedGovernanceRevision].every(revision)
  ) {
    throw new ApiError(422, 'CRM_DASHBOARD_PLACEMENT_VERSION_INVALID');
  }
  if (
    body.expectedDashboardRevision !== current.dashboardRevision ||
    body.expectedWidgetRevision !== current.widgetRevision ||
    body.expectedGovernanceRevision !== current.governanceRevision
  ) {
    throw new ApiError(409, 'CRM_DASHBOARD_PLACEMENT_VERSION_STALE');
  }
  const pinned = policy === 'PINNED' ? (body.pinnedVersionNumber as number) : null;
  const selectedVersion = pinned ?? current.activeVersionNumber;
  const targetVersion = storedWidget.versions.find((v) => v.versionNumber === selectedVersion);
  if (selectedVersion > current.activeVersionNumber || !targetVersion) {
    throw new ApiError(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
  }
  const nextViz = targetVersion.snapshot.visualizationType;
  const spec = catalogVizSpec(nextViz);
  const fits =
    STAT_CARD_KINDS.has(nextViz) || (current.placement.w >= spec.minSize.w && current.placement.h >= spec.minSize.h);
  let nextBox = { ...current.placement };
  if (!fits) {
    const bottom = desktopLayout(record)
      .filter((item) => item.placementId !== placementId)
      .reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    nextBox = { x: 0, y: bottom, w: spec.defaultSize.w, h: spec.defaultSize.h };
  }
  const layoutChanged =
    nextBox.x !== current.placement.x ||
    nextBox.y !== current.placement.y ||
    nextBox.w !== current.placement.w ||
    nextBox.h !== current.placement.h;
  return {
    versionPolicy: policy,
    pinnedVersionNumber: pinned,
    selectedVersionNumber: selectedVersion,
    placement: nextBox,
    visualizationType: nextViz,
    layoutChanged,
    changed: layoutChanged || policy !== current.versionPolicy || pinned !== current.pinnedVersionNumber,
  };
}

// PATCH {B}/dashboards/:id/placements/:placementId/version-policy
export async function setVersionPolicy(
  id: string,
  placementId: string,
  body: {
    versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
    pinnedVersionNumber: number | null;
    expectedDashboardRevision: number;
    expectedWidgetRevision: number;
    expectedGovernanceRevision: number;
    expectedSelectedVersionNumber: number;
    expectedPlacement: { x: number; y: number; w: number; h: number };
  },
): Promise<VersionBindingResult> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertWriteAccess(record);
  if (!body.expectedPlacement || !Number.isSafeInteger(body.expectedSelectedVersionNumber)) {
    throw new ApiError(422, 'CRM_DASHBOARD_PLACEMENT_VERSION_INVALID');
  }
  const { placement, storedWidget } = findPlacementAndWidget(record, placementId);
  const current = buildVersionBinding(record, placement, storedWidget);
  const proposed = planVersionPolicy(record, placementId, storedWidget, current, body);
  const expected = body.expectedPlacement;
  if (
    proposed.selectedVersionNumber !== body.expectedSelectedVersionNumber ||
    proposed.placement.x !== expected.x ||
    proposed.placement.y !== expected.y ||
    proposed.placement.w !== expected.w ||
    proposed.placement.h !== expected.h
  ) {
    throw new ApiError(409, 'CRM_DASHBOARD_PLACEMENT_VERSION_STALE');
  }
  // A no-op keeps the dashboard revision (no bump, no audit).
  if (!proposed.changed) return structuredClone({ ...current, changed: false });

  placement.versionPolicy = proposed.versionPolicy;
  placement.pinnedVersionNumber = proposed.pinnedVersionNumber;
  const targetVersion = storedWidget.versions.find((v) => v.versionNumber === proposed.selectedVersionNumber);
  if (targetVersion) {
    placement.widget = {
      ...embedded(storedWidget),
      name: targetVersion.snapshot.name,
      visualizationType: targetVersion.snapshot.visualizationType,
      querySpec: structuredClone(targetVersion.snapshot.querySpec),
      displaySpec: structuredClone(targetVersion.snapshot.displaySpec),
      versionNumber: proposed.selectedVersionNumber,
    };
  }
  if (proposed.layoutChanged) {
    const layoutItem = desktopLayout(record).find((item) => item.placementId === placementId);
    if (layoutItem) Object.assign(layoutItem, proposed.placement);
  }

  record.detail.revision += 1;
  record.detail.updatedAt = FAKE_NOW;

  return structuredClone({ ...buildVersionBinding(record, placement, storedWidget), changed: true });
}

// POST {B}/dashboards/:id/widgets/:widgetId/drilldown
export function drilldown(
  id: string,
  widgetId: string,
  body: {
    pointKey: string;
    seriesKey?: string;
    cursor?: string | null;
    limit?: number;
    filters?: RuntimeFilters;
  },
  signal?: AbortSignal,
): Promise<DrillResult> {
  return withRunSlot(() => raceAbort(() => drilldownUnguarded(id, widgetId, body), signal));
}

async function drilldownUnguarded(
  id: string,
  widgetId: string,
  body: {
    pointKey: string;
    seriesKey?: string;
    cursor?: string | null;
    limit?: number;
    filters?: RuntimeFilters;
  },
): Promise<DrillResult> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  const placement = record.detail.placements.find((p) => p.widgetId === widgetId);
  if (!placement) {
    throw new ApiError(404, 'CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND');
  }

  const metricKey = placement.widget.querySpec.series[0]?.metricKey;
  const metric = catalogMetricOf(metricKey);
  if (!metric?.drilldown) {
    throw new ApiError(422, 'CRM_DASHBOARD_DRILLDOWN_UNSUPPORTED');
  }
  // Open activities and overdue tasks list exactly the rows the count includes for that user: without
  // the Core activity read key the count shows SOURCE_PERMISSION_REQUIRED and the drill is unsupported.
  if (metric.requiredResource === 'activities' && !can('core.activities.read')) {
    throw new ApiError(422, 'CRM_DASHBOARD_DRILLDOWN_UNSUPPORTED');
  }

  const isAr = fakeLang() === 'ar';
  const isLead = metric.requiredResource === 'leads';
  const currencyCode = body.filters?.currencyCode === 'USD' ? 'USD' : 'EGP';
  const currencyScale = currencyCode === 'USD' ? 0.02 : 1;

  const leadStagesEn = ['New', 'Contacted', 'Qualified', 'Converted'];
  const leadStagesAr = ['جديد', 'تم التواصل', 'مؤهل', 'محوّل'];
  const leadSourcesEn = ['Website', 'Referral', 'Outbound call', 'LinkedIn', 'Trade show'];
  const leadSourcesAr = ['الموقع الإلكتروني', 'إحالة', 'مكالمة صادرة', 'لينكدإن', 'معرض تجاري'];
  const oppStagesEn = ['Qualification', 'Proposal', 'Negotiation', 'Contract', 'Won'];
  const oppStagesAr = ['التأهيل', 'عرض السعر', 'التفاوض', 'التعاقد', 'رابح'];

  const accountsEn = [
    'Nile Systems',
    'Delta Retail',
    'Ofoq Cloud Suite',
    'Cairo Logistics',
    'Alexandria Port Trading',
    'Red Sea Resorts',
    'Giza Agri Supply',
    'Suez Steel Works',
    'Al-Ahram Pharma',
    'Sinai Solar Co.',
  ];
  const accountsAr = [
    'شركة النيل للأنظمة',
    'متاجر الدلتا',
    'حزمة أفق السحابية',
    'القاهرة للوجستيات',
    'تجارة ميناء الإسكندرية',
    'منتجعات البحر الأحمر',
    'إمدادات الجيزة الزراعية',
    'مصانع السويس للصلب',
    'الأهرام للأدوية',
    'سيناء للطاقة الشمسية',
  ];

  const allRecords: DrillRecord[] = [];
  for (let i = 0; i < 60; i++) {
    const owner = FAKE_PEOPLE[i % FAKE_PEOPLE.length];
    const branch = FAKE_BRANCHES[i % FAKE_BRANCHES.length];
    const day = String(1 + (i % 20)).padStart(2, '0');
    const account = isAr ? accountsAr[i % accountsAr.length] : accountsEn[i % accountsEn.length];

    if (isLead) {
      const stageIdx = i % leadStagesEn.length;
      const srcIdx = i % leadSourcesEn.length;
      allRecords.push({
        id: `01934b60-0000-7000-8000-${String(101 + i).padStart(12, '0')}`,
        entityType: 'LEAD',
        title: `${account} #${101 + i}`,
        status: stageIdx === 3 ? 'CONVERTED' : 'OPEN',
        stageName: isAr ? leadStagesAr[stageIdx] : leadStagesEn[stageIdx],
        ownerName: isAr ? owner.nameAr : owner.name,
        branchName: isAr ? branch.name.ar : branch.name.en,
        sourceName: isAr ? leadSourcesAr[srcIdx] : leadSourcesEn[srcIdx],
        createdAt: `2026-11-${day}T09:15:00.000Z`,
        ...(stageIdx === 3 ? { convertedAt: `2026-11-${day}T15:30:00.000Z` } : {}),
      });
    } else {
      const stageIdx = i % oppStagesEn.length;
      const rawAmount = (85_000 + (i % 9) * 45_000) * currencyScale;
      allRecords.push({
        id: `01934b60-0000-7000-8000-${String(401 + i).padStart(12, '0')}`,
        entityType: 'OPPORTUNITY',
        title: isAr ? `صفقة ${account} #${401 + i}` : `${account} deal #${401 + i}`,
        status: stageIdx === 4 ? 'WON' : 'OPEN',
        stageName: isAr ? oppStagesAr[stageIdx] : oppStagesEn[stageIdx],
        ownerName: isAr ? owner.nameAr : owner.name,
        branchName: isAr ? branch.name.ar : branch.name.en,
        pipelineName: isAr ? 'مسار المبيعات الرئيسي' : 'Enterprise pipeline',
        amount: Math.round(rawAmount),
        currencyCode,
        createdAt: `2026-11-${day}T10:00:00.000Z`,
        ...(stageIdx === 4 ? { closedAt: `2026-11-${day}T16:45:00.000Z` } : {}),
      });
    }
  }

  const limit = Math.min(25, Math.max(1, body.limit ?? 25));
  const page = pageOf(allRecords, body.cursor ?? null, limit);

  return structuredClone({
    dashboardId: record.detail.id,
    widgetId: placement.widgetId,
    placementId: placement.id,
    widgetRevision: placement.widget.revision,
    versionNumber:
      placement.versionPolicy === 'PINNED' && placement.pinnedVersionNumber !== null
        ? placement.pinnedVersionNumber
        : placement.widget.versionNumber,
    selection: {
      pointKey: body.pointKey,
      ...(body.seriesKey ? { seriesKey: body.seriesKey } : {}),
    },
    records: page.items,
    pageInfo: page.pageInfo,
  });
}

// GET {B}/dashboards/:id/scope-inspector
export async function getScopeInspector(id: string): Promise<ScopeInspector> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  const isOwn = record.detail.ownerUserId === FAKE_ME.id;

  return structuredClone({
    userId: FAKE_ME.id,
    effectiveLevel: record.detail.accessLevel,
    capReason: null,
    branches: isOwn ? 'ALL' : [FAKE_BRANCHES[0].id, FAKE_BRANCHES[1].id],
    ownerMode: 'TEAM',
    sources: [
      { resource: 'leads', granted: true, scope: 'team' },
      { resource: 'opportunities', granted: true, scope: 'team' },
      { resource: 'activities', granted: true, scope: 'team' },
      { resource: 'customer_profiles', granted: false, scope: null },
      {
        resource: 'targets',
        granted: can('crm.targets.read'),
        scope: can('crm.targets.read') ? 'all' : null,
      },
    ],
    permissionRevision: 1,
  });
}

// GET {B}/dashboards/blueprints
export async function listBlueprints(branchId?: string): Promise<{ items: BlueprintItem[] }> {
  await fakeDelay();
  void branchId;
  const items: BlueprintItem[] = BLUEPRINT_DEFINITIONS.map((bp) => {
    const adopted = ADOPTED_BLUEPRINTS.get(bp.key);
    return {
      ...bp,
      adoption: adopted
        ? {
            state: 'ADOPTED',
            dashboardId: adopted.dashboardId,
            definitionRevision: adopted.definitionRevision,
          }
        : { state: 'AVAILABLE' },
    };
  });
  return structuredClone({ items });
}

/** Adoption receipts by command checksum (`crm_dashboard_blueprint_adoptions.command_checksum`). */
const ADOPTION_RECEIPTS = new Map<string, { dashboardId: string; definitionRevision: number }>();

// PUT {B}/dashboards/blueprints/:blueprintKey/adoption  (header x-idempotency-key: gateway-enforced)
export async function adoptBlueprint(
  key: string,
  body: { definitionRevision: number; branchId?: string; confirmTargets?: true; name?: string },
  idemKey: string,
): Promise<BlueprintAdoptionResult> {
  return withIdempotency(`adoptBlueprint:${key}`, idemKey, { key, ...body }, async () => {
    await fakeDelay();
    const customName = body.name !== undefined ? normalizeAndValidateName(body.name) : null;
    // Idempotent by the command checksum (key, revision, branch, name, confirmTargets): a replay whose dashboard is
    // still live and owned returns it (created: false) before any other check (dashboard-blueprint.service.ts adopt()).
    const checksum = JSON.stringify({
      key,
      definitionRevision: body.definitionRevision,
      branchId: body.branchId?.toLowerCase() ?? null,
      name: customName,
      confirmTargets: body.confirmTargets === true,
    });
    const receipt = ADOPTION_RECEIPTS.get(checksum);
    if (
      receipt &&
      DASHBOARD_STORE.some((d) => d.detail.id === receipt.dashboardId && d.detail.ownerUserId === FAKE_ME.id)
    ) {
      return { dashboardId: receipt.dashboardId, definitionRevision: receipt.definitionRevision, created: false };
    }

    const bp = BLUEPRINT_DEFINITIONS.find((item) => item.key === key);
    if (!bp) {
      throw new ApiError(404, 'CRM_DASHBOARD_BLUEPRINT_NOT_FOUND');
    }
    if (bp.branchSelectionRequired && !body.branchId) {
      throw new ApiError(409, 'CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED');
    }
    if (body.definitionRevision !== bp.definitionRevision) {
      throw new ApiError(409, 'CRM_DASHBOARD_BLUEPRINT_REVISION_CHANGED');
    }
    if (bp.targets.length > 0 && body.confirmTargets !== true) {
      throw new ApiError(409, 'CRM_DASHBOARD_BLUEPRINT_TARGET_CONFIRMATION_REQUIRED');
    }

    const sourceId = BLUEPRINT_BASE_DASHBOARD_ID[key];
    const sourceDashboard = DASHBOARD_STORE.find((d) => d.detail.id === sourceId);
    if (!sourceDashboard) {
      throw new ApiError(404, 'CRM_DASHBOARD_BLUEPRINT_NOT_FOUND');
    }

    const isAr = fakeLang() === 'ar';
    const defaultName = isAr ? (bp.nameAr ?? bp.name) : bp.name;
    const chosenName = customName ?? defaultName;
    if (customName) {
      assertUniqueOwnName(customName);
    } else {
      assertUniqueOwnName(chosenName);
    }

    const cloned = cloneForBlueprint(
      sourceDashboard,
      chosenName,
      bp.key,
      bp.definitionRevision,
    );
    DASHBOARD_STORE.unshift(cloned);

    ADOPTION_RECEIPTS.set(checksum, { dashboardId: cloned.detail.id, definitionRevision: bp.definitionRevision });
    // The gallery shows the latest live adoption per blueprint.
    ADOPTED_BLUEPRINTS.set(key, { dashboardId: cloned.detail.id, definitionRevision: bp.definitionRevision });

    return {
      dashboardId: cloned.detail.id,
      definitionRevision: bp.definitionRevision,
      created: true,
    };
  });
}

// GET {B}/dashboards/:id/shares
export async function listDashboardShares(id: string): Promise<ShareListItem[]> {
  await fakeDelay();
  findDashboardRecord(id);
  return structuredClone(DASHBOARD_SHARES.get(id) ?? []);
}

// POST {B}/dashboards/:id/shares  201 (header x-idempotency-key: gateway-enforced)
export async function addDashboardShare(
  id: string,
  body: {
    subjectType: 'USER' | 'TEAM';
    subjectId: string;
    accessLevel: 'VIEW' | 'EDIT';
    expiresAt?: string | null;
  },
  key: string,
): Promise<Share> {
  return withIdempotency(`addShare:${id}`, key, body, async () => {
    await fakeDelay();
    const record = findDashboardRecord(id);
    assertOwnerAccess(record);

    if (body.subjectType === 'USER' && body.subjectId === record.detail.ownerUserId) {
      throw new ApiError(422, 'CRM_SHARE_SELF_INVALID');
    }

    let expiresAt: string | null = null;
    if (body.expiresAt) {
      const expTime = Date.parse(body.expiresAt);
      const nowTime = Date.parse(FAKE_NOW);
      if (Number.isNaN(expTime) || expTime <= nowTime) {
        throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
      }
      expiresAt = body.expiresAt;
    }

    const isAr = fakeLang() === 'ar';
    let subjectName: string | null = null;
    let subjectEmail: string | null = null;
    let context = isAr ? FAKE_BRANCHES[0].name.ar : FAKE_BRANCHES[0].name.en;

    if (body.subjectType === 'USER') {
      const person = FAKE_PEOPLE.find((p) => p.id === body.subjectId);
      if (!person) {
        throw new ApiError(422, 'CRM_SHARE_TARGET_INVALID');
      }
      subjectName = isAr ? person.nameAr : person.name;
      subjectEmail = person.email;
      const br = FAKE_BRANCHES.find((b) => b.id === person.branchId);
      if (br) context = isAr ? br.name.ar : br.name.en;
    } else {
      const team = FAKE_TEAMS.find((t) => t.id === body.subjectId);
      if (!team) {
        throw new ApiError(422, 'CRM_SHARE_TARGET_INVALID');
      }
      subjectName = isAr ? team.name.ar : team.name.en;
      const br = FAKE_BRANCHES.find((b) => b.id === team.branchId);
      if (br) context = isAr ? br.name.ar : br.name.en;
    }

    const list = DASHBOARD_SHARES.get(id) ?? [];
    const existingIdx = list.findIndex(
      (s) => s.subjectType === body.subjectType && s.subjectId === body.subjectId,
    );
    const shareItem: ShareListItem = {
      id: existingIdx >= 0 ? list[existingIdx].id : fakeId(),
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      accessLevel: body.accessLevel,
      sharedByUserId: FAKE_ME.id,
      expiresAt,
      createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : FAKE_NOW,
      updatedAt: FAKE_NOW,
      effectiveAccessLevel: body.accessLevel,
      subjectName,
      subjectEmail,
      context,
      effectiveAccessSource: 'Direct grant',
    };

    if (existingIdx >= 0) {
      list[existingIdx] = shareItem;
    } else {
      list.push(shareItem);
    }
    DASHBOARD_SHARES.set(id, list);
    record.detail.isShared = list.length > 0;

    const {
      effectiveAccessLevel: _eff,
      subjectName: _sn,
      subjectEmail: _se,
      context: _ctx,
      effectiveAccessSource: _src,
      ...share
    } = shareItem;
    return structuredClone(share);
  });
}

// PATCH {B}/dashboards/:id/shares/:shareId
export async function updateDashboardShare(
  id: string,
  shareId: string,
  body: { revision?: number; accessLevel?: 'VIEW' | 'EDIT'; expiresAt?: string | null },
): Promise<Share> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertOwnerAccess(record);

  if (body.accessLevel === undefined && body.expiresAt === undefined) {
    throw new ApiError(422, 'CRM_SHARE_UPDATE_EMPTY');
  }

  const list = DASHBOARD_SHARES.get(id) ?? [];
  const item = list.find((s) => s.id === shareId);
  if (!item) {
    throw new ApiError(404, 'CRM_SHARE_NOT_FOUND');
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null) {
      item.expiresAt = null;
    } else {
      const expTime = Date.parse(body.expiresAt);
      if (Number.isNaN(expTime) || expTime <= Date.parse(FAKE_NOW)) {
        throw new ApiError(422, 'CRM_SHARE_EXPIRY_INVALID');
      }
      item.expiresAt = body.expiresAt;
    }
  }

  if (body.accessLevel !== undefined) {
    item.accessLevel = body.accessLevel;
    item.effectiveAccessLevel = body.accessLevel;
  }
  item.updatedAt = FAKE_NOW;

  const {
    effectiveAccessLevel: _eff,
    subjectName: _sn,
    subjectEmail: _se,
    context: _ctx,
    effectiveAccessSource: _src,
    ...share
  } = item;
  return structuredClone(share);
}

// DELETE {B}/dashboards/:id/shares/:shareId?reason=  204
export async function revokeDashboardShare(
  id: string,
  shareId: string,
  reason: 'OWNER_REVOKED' | 'ADMIN_REVOKED',
): Promise<void> {
  await fakeDelay();
  if (reason !== 'OWNER_REVOKED' && reason !== 'ADMIN_REVOKED') {
    throw new ApiError(422, 'CRM_SHARE_REVOKE_REASON_REQUIRED');
  }
  const record = findDashboardRecord(id);
  assertOwnerAccess(record);

  const list = DASHBOARD_SHARES.get(id) ?? [];
  const next = list.filter((s) => s.id !== shareId);
  if (next.length === list.length) {
    throw new ApiError(404, 'CRM_SHARE_NOT_FOUND');
  }
  DASHBOARD_SHARES.set(id, next);
  record.detail.isShared = next.length > 0;
}

// GET {B}/widgets?status=PUBLISHED&search=&cursor=&limit=
export async function listAddableWidgets(
  q: { search?: string; cursor?: string | null; limit?: number } = {},
): Promise<CursorPage<ReturnType<typeof embedded> & { accessLevel: 'OWNER' | 'EDIT' | 'VIEW' }>> {
  await fakeDelay();
  const term = (q.search ?? '').trim().toLowerCase();
  const published = WIDGET_STORE.filter((w) => w.summary.status === 'PUBLISHED')
    .map((w) => {
      const emb = embedded(w);
      return {
        ...emb,
        accessLevel: w.summary.accessLevel,
        _rawName: w.summary.name.toLowerCase(),
      };
    })
    .filter((item) =>
      term
        ? item.name.toLowerCase().includes(term) || item._rawName.includes(term)
        : true,
    )
    .map(({ _rawName: _ignored, ...rest }) => rest);

  return structuredClone(cursorPageOf(published, q.cursor ?? null, q.limit ?? 20));
}

// GET {B}/dashboards/:id/shares/preview?subjectType=USER|TEAM&subjectId=
export async function previewDashboardShare(
  id: string,
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
): Promise<SharePreview> {
  await fakeDelay();
  const record = findDashboardRecord(id);
  assertOwnerAccess(record);
  if (!can('crm.dashboards.share')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const existing = (DASHBOARD_SHARES.get(id) ?? []).find(
    (s) => s.subjectType === subjectType && s.subjectId === subjectId,
  );
  return fakeSharePreview(subjectType, subjectId, {
    existingAccessLevel: existing?.accessLevel,
    isOwner: subjectType === 'USER' && subjectId === record.detail.ownerUserId,
    metricKeys: record.detail.placements.flatMap((p) => p.widget.querySpec.series.map((s) => s.metricKey)),
  });
}
