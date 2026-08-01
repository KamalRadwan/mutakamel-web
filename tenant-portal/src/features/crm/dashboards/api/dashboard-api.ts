"use client";

import { tenantApiFetch } from "@/shared/api/tenant-api-client";
import { normalizeDashboardFiltersForApi } from "../models/dashboard-model";
import type {
  CreateDashboardInput,
  CreateWidgetInput,
  CrmDashboard,
  CrmDashboardFilters,
  CrmDashboardNavigationItem,
  CrmDashboardWidget,
  DashboardCatalog,
  DashboardCatalogMetric,
  DashboardCatalogVisualization,
  DashboardDrilldownRequest,
  DashboardDrilldownResult,
  DashboardDrilldownRecord,
  DashboardP2EntityReference,
  DashboardP2Measure,
  DashboardP2Reference,
  DashboardP2Result,
  DashboardP2RowKind,
  DashboardPointSelection,
  DashboardQuerySpec,
  DashboardRunResult,
  DashboardResourceShare,
  DashboardShareTarget,
  DashboardUnavailablePlacement,
  DashboardWidgetResult,
  PreviewWidgetInput,
  ShareDashboardInput,
  UpdateWidgetResult,
} from "../models/dashboard-types";
import { isSafeCrmEntityHref } from "../models/dashboard-safe-href";
import { dashboardVisualizationTypes } from "../models/dashboard-types";

type NavigationResponse = {
  items: CrmDashboardNavigationItem[];
  activeDashboardId?: string;
};

export function shouldProvisionCanonicalDashboardTemplates(
  navigation: NavigationResponse | undefined,
  authorized: boolean,
) {
  return Boolean(authorized && navigation && navigation.items.length === 0);
}

export const canonicalDashboardTemplateKeys = [
  "CRM_DEFAULT",
  "SALES_PIPELINE",
  "LEAD_PERFORMANCE",
  "KPIS_TARGETS",
  "TRENDS_COMPARISONS",
  "DISTRIBUTION_RELATIONSHIPS",
  "PROCESS_OPERATIONS",
  "ACTIVITIES_PRODUCTIVITY",
  "CUSTOMER_INTELLIGENCE",
  "DATA_QUALITY",
  "ACTION_CENTER",
] as const satisfies readonly NonNullable<CreateDashboardInput["templateKey"]>[];

export type CanonicalDashboardProvisioningResult = {
  attempted: number;
  dashboards: CrmDashboard[];
  failures: Array<{
    templateKey: (typeof canonicalDashboardTemplateKeys)[number];
    error: unknown;
  }>;
};

const skippedCanonicalDashboardProvisioning: CanonicalDashboardProvisioningResult = {
  attempted: 0,
  dashboards: [],
  failures: [],
};
let canonicalDashboardProvisioningPromise: Promise<CanonicalDashboardProvisioningResult> | undefined;

/**
 * Ensures the approved dashboard set once per browser app load. The backend PUT
 * endpoint is idempotent per owner/template, and every template is isolated so
 * one stale or conflicting definition cannot prevent the remaining dashboards
 * from appearing.
 */
export function ensureCanonicalDashboardTemplates(
  authorized: boolean,
): Promise<CanonicalDashboardProvisioningResult> {
  if (!authorized) return Promise.resolve(skippedCanonicalDashboardProvisioning);
  if (canonicalDashboardProvisioningPromise) return canonicalDashboardProvisioningPromise;

  const provisioning = (async (): Promise<CanonicalDashboardProvisioningResult> => {
    const dashboards: CrmDashboard[] = [];
    const failures: CanonicalDashboardProvisioningResult["failures"] = [];
    for (const templateKey of canonicalDashboardTemplateKeys) {
      try {
        dashboards.push(normalizeDashboard(await tenantApiFetch<CrmDashboard>(
          `/crm/dashboards/from-template/${encodeURIComponent(templateKey)}`,
          {
            method: "PUT",
            body: {},
            errorMessage: false,
            successMessage: false,
          },
        )));
      } catch (error) {
        failures.push({ templateKey, error });
      }
    }
    return { attempted: canonicalDashboardTemplateKeys.length, dashboards, failures };
  })();
  canonicalDashboardProvisioningPromise = provisioning;
  void provisioning.then((result) => {
    if (result.failures.length && canonicalDashboardProvisioningPromise === provisioning) {
      canonicalDashboardProvisioningPromise = undefined;
    }
  });

  return provisioning;
}

export async function listDashboardNavigation(): Promise<NavigationResponse> {
  const payload = await tenantApiFetch<NavigationResponse | CrmDashboardNavigationItem[]>(
    "/crm/dashboards/navigation",
    { errorMessage: false },
  );
  return Array.isArray(payload) ? { items: payload } : payload;
}

export async function getDefaultDashboard(): Promise<CrmDashboard> {
  return normalizeDashboard(
    await tenantApiFetch<CrmDashboard>("/crm/dashboards/default", { errorMessage: false }),
  );
}

export async function getDashboard(dashboardId: string): Promise<CrmDashboard> {
  return normalizeDashboard(
    await tenantApiFetch<CrmDashboard>(`/crm/dashboards/${encodeURIComponent(dashboardId)}`, {
      errorMessage: false,
    }),
  );
}

export async function getDashboardCatalog(): Promise<DashboardCatalog> {
  return normalizeDashboardCatalog(
    await tenantApiFetch<unknown>("/crm/dashboards/catalog", { errorMessage: false }),
  );
}

export async function createDashboard(input: CreateDashboardInput): Promise<CrmDashboard> {
  return normalizeDashboard(await tenantApiFetch<CrmDashboard>("/crm/dashboards", {
    method: "POST",
    body: input.defaultFilters === undefined
      ? input
      : { ...input, defaultFilters: normalizeDashboardFiltersForApi(input.defaultFilters) },
    successMessage: "Dashboard created.",
  }));
}

export async function updateDashboard(
  dashboardId: string,
  input: Partial<Pick<CrmDashboard, "name" | "description" | "defaultFilters">> & { revision: number },
): Promise<CrmDashboard> {
  return normalizeDashboard(await tenantApiFetch<CrmDashboard>(`/crm/dashboards/${encodeURIComponent(dashboardId)}`, {
    method: "PATCH",
    body: input.defaultFilters === undefined
      ? input
      : { ...input, defaultFilters: normalizeDashboardFiltersForApi(input.defaultFilters) },
    successMessage: "Dashboard updated.",
  }));
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  await tenantApiFetch<void>(`/crm/dashboards/${encodeURIComponent(dashboardId)}`, {
    method: "DELETE",
    successMessage: "Dashboard deleted.",
  });
}

export async function duplicateDashboard(dashboardId: string, name?: string): Promise<CrmDashboard> {
  return normalizeDashboard(await tenantApiFetch<CrmDashboard>(
    `/crm/dashboards/${encodeURIComponent(dashboardId)}/duplicate`,
    {
      method: "POST",
      body: name ? { name } : {},
      successMessage: "Dashboard duplicated.",
    },
  ));
}

export async function setDefaultDashboard(dashboardId: string): Promise<void> {
  await tenantApiFetch<void>(`/crm/dashboards/${encodeURIComponent(dashboardId)}/default`, {
    method: "PUT",
    body: {},
    successMessage: "Default dashboard updated.",
  });
}

export async function setDashboardFavorite(dashboardId: string, favorite: boolean): Promise<void> {
  await tenantApiFetch<void>(`/crm/dashboards/${encodeURIComponent(dashboardId)}/favorite`, {
    method: "PUT",
    body: { favorite },
    successMessage: favorite ? "Dashboard added to favorites." : "Dashboard removed from favorites.",
  });
}

export async function saveDashboardLayout(
  dashboardId: string,
  revision: number,
  placements: CrmDashboard["placements"],
): Promise<CrmDashboard> {
  return normalizeDashboard(await tenantApiFetch<CrmDashboard>(
    `/crm/dashboards/${encodeURIComponent(dashboardId)}/layout`,
    {
      method: "PUT",
      body: {
        revision,
        placements: placements.map(({ id, x, y, width, height }) => ({
          placementId: id,
          x,
          y,
          width,
          height,
        })),
      },
      successMessage: "Dashboard layout saved.",
    },
  ));
}

export async function createWidget(input: CreateWidgetInput) {
  return normalizeDashboardWidget(await tenantApiFetch<unknown>("/crm/widgets", {
    method: "POST",
    body: input,
    successMessage: false,
  }));
}

/**
 * Creates a reusable widget and links it to a dashboard as one UI operation.
 * The API exposes those as two requests, so compensate the widget creation when
 * the placement fails instead of leaving an unreachable definition after every
 * retry.
 */
export async function createWidgetWithPlacement(
  dashboardId: string,
  input: CreateWidgetInput,
  placement?: Partial<Pick<CrmDashboard["placements"][number], "x" | "y" | "width" | "height">>,
) {
  const widget = await createWidget(input);
  try {
    const savedPlacement = await addWidgetPlacement(dashboardId, widget.id, placement);
    return { widget, placement: savedPlacement };
  } catch (caught) {
    try {
      await tenantApiFetch<void>(`/crm/widgets/${encodeURIComponent(widget.id)}`, {
        method: "DELETE",
        errorMessage: false,
        successMessage: false,
      });
    } catch {
      if (caught instanceof Error) {
        caught.message = `${caught.message} The unused widget could not be removed automatically.`;
      }
    }
    throw caught;
  }
}

export async function previewWidget(
  input: PreviewWidgetInput,
  init: { signal?: AbortSignal } = {},
): Promise<DashboardWidgetResult> {
  const payload = await tenantApiFetch<unknown>("/crm/widgets/preview", {
    method: "POST",
    body: input,
    signal: init.signal,
    errorMessage: false,
    successMessage: false,
  });
  const normalized = normalizeDashboardRunResult(
    {
      id: "widget-preview",
      name: "Widget preview",
      accessLevel: "OWNER",
      revision: 1,
      placements: [],
    },
    { widgets: [payload] },
  );
  const result = Object.values(normalized.widgets)[0];
  if (!result) throw new Error("The preview response did not include a widget result.");
  return result;
}

export async function listAccessibleWidgets(): Promise<CrmDashboard["placements"][number]["widget"][]> {
  const payload = await tenantApiFetch<
    { items?: unknown[] }
    | unknown[]
  >("/crm/widgets", { errorMessage: false });
  return (Array.isArray(payload) ? payload : payload.items ?? []).map(normalizeDashboardWidget);
}

export async function getWidget(widgetId: string): Promise<CrmDashboard["placements"][number]["widget"]> {
  return normalizeDashboardWidget(await tenantApiFetch<unknown>(
    `/crm/widgets/${encodeURIComponent(widgetId)}`,
    { errorMessage: false },
  ));
}

export async function updateWidget(
  widgetId: string,
  input: CreateWidgetInput & { revision: number },
): Promise<UpdateWidgetResult> {
  const payload = await tenantApiFetch<unknown>(
    `/crm/widgets/${encodeURIComponent(widgetId)}`,
    {
      method: "PATCH",
      body: input,
      successMessage: "Widget updated.",
    },
  );
  const raw = record(payload);
  return {
    ...normalizeDashboardWidget(payload),
    ...(isStringNumberRecord(raw.dashboardRevisions) ? { dashboardRevisions: raw.dashboardRevisions } : {}),
    ...(Array.isArray(raw.layoutAdjustments)
      ? { layoutAdjustments: raw.layoutAdjustments.filter(isLayoutAdjustment) }
      : {}),
  };
}

export async function cloneWidget(widgetId: string, name?: string) {
  return normalizeDashboardWidget(await tenantApiFetch<unknown>(
    `/crm/widgets/${encodeURIComponent(widgetId)}/clone`,
    {
      method: "POST",
      body: name ? { name } : {},
      successMessage: false,
    },
  ));
}

export async function deleteWidget(widgetId: string): Promise<void> {
  await tenantApiFetch<void>(`/crm/widgets/${encodeURIComponent(widgetId)}`, {
    method: "DELETE",
    successMessage: "Widget deleted from every linked dashboard.",
  });
}

export async function addWidgetPlacement(
  dashboardId: string,
  widgetId: string,
  placement?: Partial<Pick<CrmDashboard["placements"][number], "x" | "y" | "width" | "height">>,
) {
  return tenantApiFetch<CrmDashboard["placements"][number]>(
    `/crm/dashboards/${encodeURIComponent(dashboardId)}/placements`,
    {
      method: "POST",
      body: { widgetId, ...placement },
      successMessage: "Widget added.",
    },
  );
}

export async function removeWidgetPlacement(dashboardId: string, placementId: string): Promise<void> {
  await tenantApiFetch<void>(
    `/crm/dashboards/${encodeURIComponent(dashboardId)}/placements/${encodeURIComponent(placementId)}`,
    { method: "DELETE", successMessage: "Widget removed from dashboard." },
  );
}

export async function runDashboard(
  dashboard: CrmDashboard,
  filters: CrmDashboardFilters,
  widgetIds?: string[],
): Promise<DashboardRunResult> {
  const result = await tenantApiFetch<unknown>(
    `/crm/dashboards/${encodeURIComponent(dashboard.id)}/run`,
    {
      method: "POST",
      body: {
        filters: normalizeDashboardFiltersForApi(filters),
        ...(widgetIds?.length ? { widgetIds } : {}),
      },
      errorMessage: false,
      successMessage: false,
    },
  );
  return normalizeDashboardRunResult(dashboard, result);
}

export async function drilldownDashboardWidget(
  dashboardId: string,
  widgetId: string,
  input: DashboardDrilldownRequest,
  init: { signal?: AbortSignal } = {},
): Promise<DashboardDrilldownResult> {
  const payload = await tenantApiFetch<unknown>(
    `/crm/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}/drilldown`,
    {
      method: "POST",
      body: {
        pointKey: input.pointKey,
        ...(input.seriesKey ? { seriesKey: input.seriesKey } : {}),
        ...(input.cursor ? { cursor: input.cursor } : {}),
        ...(input.limit ? { limit: input.limit } : {}),
        ...(input.expectedWidgetRevision
          ? { expectedWidgetRevision: input.expectedWidgetRevision }
          : {}),
        ...(input.filters
          ? { filters: normalizeDashboardFiltersForApi(input.filters) }
          : {}),
      },
      signal: init.signal,
      errorMessage: false,
      successMessage: false,
    },
  );
  return normalizeDashboardDrilldownResult(payload, { dashboardId, widgetId, selection: input });
}

export async function listShareTargetPage({
  resourceType = "dashboard",
  search,
  limit = 50,
  offset = 0,
}: {
  resourceType?: "dashboard" | "widget";
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: DashboardShareTarget[]; nextOffset?: number }> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search?.trim()) query.set("search", search.trim());
  const payload = await tenantApiFetch<
    { items?: DashboardShareTarget[]; nextOffset?: number; users?: Array<Omit<DashboardShareTarget, "type">>; teams?: Array<Omit<DashboardShareTarget, "type">> }
    | DashboardShareTarget[]
  >(
    `/crm/${resourceType === "dashboard" ? "dashboards" : "widgets"}/share-targets?${query.toString()}`,
    { errorMessage: false },
  );
  if (Array.isArray(payload)) return { items: payload };
  if (payload.items) return {
    items: payload.items,
    nextOffset: typeof payload.nextOffset === "number" ? payload.nextOffset : undefined,
  };
  return { items: [
    ...(payload.users ?? []).map((item) => ({ ...item, type: "USER" as const })),
    ...(payload.teams ?? []).map((item) => ({ ...item, type: "TEAM" as const })),
  ] };
}

export async function listDashboardShareTargets(): Promise<DashboardShareTarget[]> {
  return (await listShareTargetPage({ resourceType: "dashboard", limit: 100 })).items;
}

type DashboardShareResourceType = "dashboard" | "widget";

export async function listResourceShares(
  resourceType: DashboardShareResourceType,
  resourceId: string,
): Promise<DashboardResourceShare[]> {
  const payload = await tenantApiFetch<{ items?: DashboardResourceShare[] } | DashboardResourceShare[]>(
    resourceSharePath(resourceType, resourceId),
    { errorMessage: false },
  );
  return Array.isArray(payload) ? payload : payload.items ?? [];
}

export async function removeResourceShare(
  resourceType: DashboardShareResourceType,
  resourceId: string,
  shareId: string,
): Promise<void> {
  await tenantApiFetch<void>(
    `${resourceSharePath(resourceType, resourceId)}/${encodeURIComponent(shareId)}`,
    { method: "DELETE", successMessage: "Access removed." },
  );
}

export class DashboardBatchShareError extends Error {
  readonly rollbackComplete: boolean;
  readonly rollbackFailureCount: number;
  readonly originalError: unknown;

  constructor(originalError: unknown, rollbackFailureCount: number) {
    const rollbackComplete = rollbackFailureCount === 0;
    super(rollbackComplete
      ? "Access could not be shared with every selected target. Changes from this attempt were rolled back."
      : `Access could not be shared with every selected target, and ${rollbackFailureCount} ${rollbackFailureCount === 1 ? "change" : "changes"} could not be rolled back. Refresh Manage access and remove any unintended grants manually.`);
    this.name = "DashboardBatchShareError";
    this.rollbackComplete = rollbackComplete;
    this.rollbackFailureCount = rollbackFailureCount;
    this.originalError = originalError;
  }
}

export async function shareDashboard(dashboardId: string, input: ShareDashboardInput): Promise<void> {
  await shareResourceWithRollback("dashboard", dashboardId, input);
}

export async function shareWidget(widgetId: string, input: ShareDashboardInput): Promise<void> {
  await shareResourceWithRollback("widget", widgetId, input);
}

type AttemptedShare = {
  subjectId: string;
  previous?: DashboardResourceShare;
  appliedId?: string;
};

async function shareResourceWithRollback(
  resourceType: DashboardShareResourceType,
  resourceId: string,
  input: ShareDashboardInput,
): Promise<void> {
  const subjectIds = [...new Set(input.subjectIds)];
  if (!subjectIds.length) return;

  const sharesBefore = await listResourceShares(resourceType, resourceId);
  const beforeBySubject = new Map(
    sharesBefore
      .filter((share) => share.subjectType === input.subjectType)
      .map((share) => [share.subjectId, share]),
  );
  const attempted: AttemptedShare[] = [];

  try {
    for (const subjectId of subjectIds) {
      const step: AttemptedShare = { subjectId, previous: beforeBySubject.get(subjectId) };
      attempted.push(step);
      const applied = await postResourceShare(resourceType, resourceId, {
        subjectType: input.subjectType,
        subjectId,
        accessLevel: input.accessLevel,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      });
      step.appliedId = applied.id;
      if (!step.appliedId) throw new Error("The share response did not include an id.");
    }
  } catch (error) {
    const rollbackFailureCount = await rollbackAttemptedShares(
      resourceType,
      resourceId,
      input.subjectType,
      attempted,
    );
    throw new DashboardBatchShareError(error, rollbackFailureCount);
  }
}

async function rollbackAttemptedShares(
  resourceType: DashboardShareResourceType,
  resourceId: string,
  subjectType: ShareDashboardInput["subjectType"],
  attempted: AttemptedShare[],
): Promise<number> {
  let currentShares: DashboardResourceShare[] | undefined;
  try {
    currentShares = await listResourceShares(resourceType, resourceId);
  } catch {
    // Confirmed response ids and prior snapshots still allow a safe best-effort rollback.
  }

  let rollbackFailureCount = 0;
  for (const step of [...attempted].reverse()) {
    const current = currentShares?.find((share) => (
      share.subjectType === subjectType && share.subjectId === step.subjectId
    ));
    try {
      if (step.previous) {
        if (current && sameShareState(current, step.previous)) continue;
        await postResourceShare(resourceType, resourceId, {
          subjectType: step.previous.subjectType,
          subjectId: step.previous.subjectId,
          accessLevel: step.previous.accessLevel,
          ...(step.previous.expiresAt ? { expiresAt: step.previous.expiresAt } : {}),
        });
        continue;
      }

      const appliedId = step.appliedId ?? current?.id;
      if (!appliedId) {
        if (currentShares) continue;
        throw new Error("The applied share could not be identified for rollback.");
      }
      await deleteResourceShareSilently(resourceType, resourceId, appliedId);
    } catch {
      rollbackFailureCount += 1;
    }
  }
  return rollbackFailureCount;
}

function postResourceShare(
  resourceType: DashboardShareResourceType,
  resourceId: string,
  input: {
    subjectType: ShareDashboardInput["subjectType"];
    subjectId: string;
    accessLevel: ShareDashboardInput["accessLevel"];
    expiresAt?: string;
  },
) {
  return tenantApiFetch<DashboardResourceShare>(resourceSharePath(resourceType, resourceId), {
    method: "POST",
    body: input,
    errorMessage: false,
    successMessage: false,
  });
}

async function deleteResourceShareSilently(
  resourceType: DashboardShareResourceType,
  resourceId: string,
  shareId: string,
) {
  await tenantApiFetch<void>(`${resourceSharePath(resourceType, resourceId)}/${encodeURIComponent(shareId)}`, {
    method: "DELETE",
    errorMessage: false,
    successMessage: false,
  });
}

function resourceSharePath(resourceType: DashboardShareResourceType, resourceId: string) {
  return `/crm/${resourceType === "dashboard" ? "dashboards" : "widgets"}/${encodeURIComponent(resourceId)}/shares`;
}

function sameShareState(left: DashboardResourceShare, right: DashboardResourceShare) {
  return left.accessLevel === right.accessLevel
    && normalizedExpiry(left.expiresAt) === normalizedExpiry(right.expiresAt);
}

function normalizedExpiry(value: string | undefined) {
  if (!value) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

export function isSystemDashboard(dashboard: CrmDashboard) {
  return Boolean(dashboard.isSystemDefault);
}

function normalizeDashboard(dashboard: CrmDashboard): CrmDashboard {
  return {
    ...dashboard,
    defaultFilters: dashboard.defaultFilters === undefined
      ? undefined
      : normalizeDashboardFiltersForApi(dashboard.defaultFilters),
    accessLevel: dashboard.accessLevel ?? "OWNER",
    revision: Number(dashboard.revision ?? 1),
    placements: (dashboard.placements ?? []).map((placement) => {
      const widget = normalizeDashboardWidget(placement.widget);
      return {
        ...placement,
        dashboardId: placement.dashboardId ?? dashboard.id,
        width: Number(placement.width),
        height: Number(placement.height),
        x: Number(placement.x),
        y: Number(placement.y),
        widget,
      };
    }),
    unavailablePlacements: normalizeUnavailablePlacements(dashboard.unavailablePlacements),
  };
}

export function normalizeDashboardWidget(value: unknown): CrmDashboardWidget {
  const widget = record(value);
  const id = requiredText(widget.id, "widget id", 160);
  const name = requiredText(widget.name, "widget name", 120);
  const visualizationType = string(widget.visualizationType);
  if (!dashboardVisualizationTypes.includes(visualizationType as CrmDashboardWidget["visualizationType"])) {
    throw invalidDashboardContract("widget visualization type");
  }
  const display = record(widget.displaySpec);
  const accessLevel = string(widget.accessLevel);
  return {
    ...(widget as CrmDashboardWidget),
    id,
    name,
    visualizationType: visualizationType as CrmDashboardWidget["visualizationType"],
    querySpec: normalizeDashboardQuerySpec(widget.querySpec),
    displaySpec: {
      ...(optionalText(display.title, 120) ? { title: optionalText(display.title, 120) } : {}),
      ...(optionalText(display.subtitle, 300) ? { subtitle: optionalText(display.subtitle, 300) } : {}),
      ...(isHexColor(display.color) ? { color: display.color } : {}),
      ...(isHexColor(display.targetColor) ? { targetColor: display.targetColor } : {}),
      ...(optionalText(display.numberFormat, 80) ? { numberFormat: optionalText(display.numberFormat, 80) } : {}),
      ...(optionalText(display.legendPosition, 80) ? { legendPosition: optionalText(display.legendPosition, 80) } : {}),
      ...(display.options && typeof display.options === "object" && !Array.isArray(display.options)
        ? { options: display.options as Record<string, unknown> }
        : {}),
    },
    ...(isPositiveInteger(widget.schemaVersion) ? { schemaVersion: widget.schemaVersion } : {}),
    ...(isPositiveInteger(widget.revision) ? { revision: widget.revision } : {}),
    ...(["OWNER", "EDIT", "VIEW"].includes(accessLevel)
      ? { accessLevel: accessLevel as CrmDashboardWidget["accessLevel"] }
      : {}),
  };
}

export function normalizeDashboardQuerySpec(value: unknown): DashboardQuerySpec {
  const query = record(value);
  if (!Array.isArray(query.series) || query.series.length < 1 || query.series.length > 4) {
    throw invalidDashboardContract("widget series");
  }
  const series = query.series.map((candidate) => {
    const item = record(candidate);
    const metricKey = string(item.metricKey);
    if (!/^crm\.[a-z0-9_.]{3,116}$/.test(metricKey)) throw invalidDashboardContract("metric key");
    const axis = string(item.axis);
    const aggregation = string(item.aggregation);
    return {
      metricKey,
      ...(["LEFT", "RIGHT"].includes(axis) ? { axis: axis as "LEFT" | "RIGHT" } : {}),
      ...(optionalText(item.label, 80) ? { label: optionalText(item.label, 80) } : {}),
      ...(isHexColor(item.color) ? { color: item.color } : {}),
      ...(["COUNT", "SUM", "AVERAGE", "MIN", "MAX", "PERCENT"].includes(aggregation)
        ? { aggregation: aggregation as NonNullable<DashboardQuerySpec["series"][number]["aggregation"]> }
        : {}),
    };
  });
  const engine = string(query.engine) || "LEGACY_V1";
  if (!(["LEGACY_V1", "SEMANTIC_V1"] as const).includes(engine as "LEGACY_V1" | "SEMANTIC_V1")) {
    throw invalidDashboardContract("query engine");
  }
  const dimension = record(query.dimension);
  const dimensionKey = optionalText(dimension.key, 40);
  const grain = string(dimension.grain);
  const comparison = record(query.comparison);
  const comparisonType = string(comparison.type);
  if (comparisonType === "TARGET" && !isPositiveFinite(comparison.target)) {
    throw invalidDashboardContract("target comparison");
  }
  const normalized: DashboardQuerySpec = {
    ...(query.engine ? { engine: engine as "LEGACY_V1" | "SEMANTIC_V1" } : {}),
    series,
    ...(dimensionKey
      ? {
          dimension: {
            key: dimensionKey,
            ...(["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"].includes(grain)
              ? { grain: grain as NonNullable<DashboardQuerySpec["dimension"]>["grain"] }
              : {}),
          },
        }
      : {}),
    ...(query.filters && typeof query.filters === "object" && !Array.isArray(query.filters)
      ? { filters: normalizeDashboardFiltersForApi(query.filters) }
      : {}),
    ...(["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR", "TARGET"].includes(comparisonType)
      ? {
          comparison: {
            type: comparisonType as NonNullable<DashboardQuerySpec["comparison"]>["type"],
            ...(comparisonType === "TARGET" && isPositiveFinite(comparison.target)
              ? { target: comparison.target }
              : {}),
          },
        }
      : {}),
  };
  const hasSemanticFields = query.semanticVersion !== undefined
    || query.source !== undefined
    || query.semanticFilters !== undefined
    || query.topN !== undefined
    || query.maxPoints !== undefined;
  if (engine === "LEGACY_V1") {
    if (hasSemanticFields) throw invalidDashboardContract("legacy query semantic fields");
    return normalized;
  }
  if (query.semanticVersion !== 1 || !["leads", "opportunities"].includes(string(query.source))) {
    throw invalidDashboardContract("semantic query version or source");
  }
  const semanticFilters = normalizeSemanticFilters(query.semanticFilters);
  if (query.topN !== undefined && !isBoundedIntegerValue(query.topN, 100)) {
    throw invalidDashboardContract("semantic top N");
  }
  if (query.maxPoints !== undefined && !isBoundedIntegerValue(query.maxPoints, 1000)) {
    throw invalidDashboardContract("semantic point limit");
  }
  return {
    ...normalized,
    engine: "SEMANTIC_V1",
    semanticVersion: 1,
    source: string(query.source) as "leads" | "opportunities",
    ...(semanticFilters.length ? { semanticFilters } : {}),
    ...(isBoundedIntegerValue(query.topN, 100) ? { topN: query.topN } : {}),
    ...(isBoundedIntegerValue(query.maxPoints, 1000) ? { maxPoints: query.maxPoints } : {}),
  };
}

export function normalizeDashboardRunResult(dashboard: CrmDashboard, payload: unknown): DashboardRunResult {
  const result = record(payload);
  const revision = optionalNumber(result.revision);
  const rawWidgets = Array.isArray(result.widgets)
    ? result.widgets
    : Object.values(record(result.widgets));
  const widgets = Object.fromEntries(rawWidgets.map((rawWidget, widgetIndex) => {
    const widget = record(rawWidget);
    const widgetId = string(widget.widgetId) || dashboard.placements[widgetIndex]?.widgetId || `widget-${widgetIndex}`;
    const shape = dashboardShape(widget.shape);
    const rawSeries = Array.isArray(widget.series) ? widget.series.map(record) : [];
    const series = rawSeries.map((item, seriesIndex) => normalizeExecutorSeries(item, shape, seriesIndex));
    if (shape === "TIME_SERIES") alignCanonicalComparisonSeries(rawSeries, series);
    const primary = rawSeries[0] ?? {};
    const comparison = record(primary.comparison);
    const comparisonData = comparison.data;
    if (comparisonData !== undefined && (shape === "TIME_SERIES" || shape === "CATEGORY")) {
      const comparisonSeries = normalizeExecutorSeries({
        ...primary,
        label: `${string(primary.label) || "Series"} · previous`,
        data: comparisonData,
      }, shape, series.length);
      if (shape === "TIME_SERIES" && series[0]?.points.length) {
        comparisonSeries.points = comparisonSeries.points.map((point, pointIndex) => {
          const currentBucket = series[0]?.points[pointIndex];
          return currentBucket
            ? {
                ...point,
                key: currentBucket.key,
                label: currentBucket.label,
                meta: { ...point.meta, comparisonPeriodLabel: point.label },
              }
            : point;
        });
      }
      series.push(comparisonSeries);
    }
    const meta = record(widget.meta);
    const rawError = record(widget.error);
    const typedResultCandidate = normalizeDashboardP2Result(widget.result);
    const typedResult = typedResultCandidate?.shape === shape ? typedResultCandidate : undefined;
    const malformedTypedResult = widget.result !== undefined && !typedResult;
    const currencies = stringArray(meta.currencies);
    const widgetUnit = string(meta.unit) || string(primary.unit) || undefined;
    const widgetCurrency = string(meta.currency) || (currencies.length === 1 ? currencies[0] : undefined);
    const normalized: DashboardWidgetResult = {
      widgetId,
      shape,
      value: optionalNumber(widget.value) ?? scalarDataValue(primary.data),
      previousValue: optionalNumber(widget.previousValue)
        ?? (comparisonData === undefined ? undefined : scalarDataValue(comparisonData)),
      target: optionalNumber(widget.target)
        ?? (string(comparison.type) === "TARGET" ? number(comparison.value) : undefined),
      details: Object.keys(record(widget.details)).length ? record(widget.details) : undefined,
      rows: shape === "ROWS"
        ? (Array.isArray(widget.rows) ? rows(widget.rows) : rows(primary.data))
        : undefined,
      ...(typedResult ? { result: typedResult } : {}),
      series: series.map((item) => ({
        ...item,
        currency: item.currency ?? (item.unit === "MONEY" || widgetUnit === "MONEY" ? widgetCurrency : undefined),
      })),
      meta: {
        unit: widgetUnit,
        currency: widgetCurrency,
        generatedAt: string(meta.generatedAt) || undefined,
        warnings: stringArray(meta.warnings),
      },
      error: rawError.message || rawError.code
        ? {
            code: string(rawError.code).slice(0, 80) || undefined,
            message: string(rawError.message).slice(0, 240) || "The report could not be executed. Try refreshing this widget.",
          }
        : malformedTypedResult
          ? {
              code: "CRM_WIDGET_RESULT_INVALID",
              message: "The report returned an invalid data shape and was not displayed.",
            }
        : undefined,
    };
    return [widgetId, normalized];
  }));
  const resolvedFilterRecord = record(result.filters);
  const resolvedFilters = normalizeDashboardFiltersForApi(resolvedFilterRecord);
  for (const key of ["dateFrom", "dateTo"] as const) {
    const value = string(resolvedFilterRecord[key]);
    if (value && Number.isFinite(Date.parse(value))) resolvedFilters[key] = value;
  }
  const resolvedScope = Array.isArray(result.scope)
    ? result.scope.flatMap((item) => {
        const entry = record(item);
        const branchId = string(entry.branchId);
        const scope = string(entry.scope);
        return branchId && scope ? [{ branchId, scope }] : [];
      })
    : undefined;
  const comparisonCompatibility = normalizeComparisonCompatibility(result.comparisonCompatibility);
  return {
    dashboardId: string(result.dashboardId) || dashboard.id,
    ...(revision !== undefined ? { revision } : {}),
    generatedAt: string(result.generatedAt) || new Date().toISOString(),
    ...(Object.keys(resolvedFilters).length ? { filters: resolvedFilters } : {}),
    ...(resolvedScope ? { scope: resolvedScope } : {}),
    ...(comparisonCompatibility ? { comparisonCompatibility } : {}),
    widgets,
    ...(Array.isArray(result.unavailablePlacements)
      ? { unavailablePlacements: normalizeUnavailablePlacements(result.unavailablePlacements) }
      : {}),
  };
}

export function normalizeDashboardCatalog(payload: unknown): DashboardCatalog {
  const source = record(payload);
  if (!Array.isArray(source.metrics) || !Array.isArray(source.visualizations)) {
    throw invalidDashboardContract("catalog collections");
  }
  const metrics = source.metrics.map(normalizeCatalogMetric);
  const visualizations = source.visualizations
    .map(normalizeCatalogVisualization)
    .filter((visualization) => visualization.key !== "CALENDAR" && visualization.key !== "CALENDAR_HEATMAP");
  const semanticQuery = source.semanticQuery === undefined
    ? undefined
    : normalizeSemanticQueryCatalog(source.semanticQuery);
  return {
    metrics,
    visualizations,
    ...(semanticQuery ? { semanticQuery } : {}),
    ...(Array.isArray(source.dimensions)
      ? {
          dimensions: source.dimensions.flatMap((candidate) => {
            const dimension = record(candidate);
            const key = optionalText(dimension.key, 40);
            const grains = stringArray(dimension.grains).filter((grain) => (
              ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"].includes(grain)
            ));
            return key ? [{ key, grains }] : [];
          }),
        }
      : {}),
    ...(Array.isArray(source.templates)
      ? { templates: source.templates as DashboardCatalog["templates"] }
      : {}),
    ...(source.grid && typeof source.grid === "object" && !Array.isArray(source.grid)
      ? { grid: source.grid as DashboardCatalog["grid"] }
      : {}),
  };
}

export function normalizeDashboardP2Result(value: unknown): DashboardP2Result | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    const source = strictRecord(value, "typed widget result");
    const shape = string(source.shape);
    if (shape === "HIERARCHY") return normalizeHierarchyResult(source);
    if (shape === "BINNED_DISTRIBUTION") return normalizeBinnedDistributionResult(source);
    if (shape === "WATERFALL") return normalizeWaterfallResult(source);
    if (shape === "EVENT_STREAM") return normalizeEventStreamResult(source);
    if (shape === "ROWS") return normalizeP2RowsResult(source);
    return undefined;
  } catch {
    return undefined;
  }
}

export function normalizeDashboardDrilldownResult(
  payload: unknown,
  expected: { dashboardId: string; widgetId: string; selection: DashboardPointSelection },
): DashboardDrilldownResult {
  const source = strictRecord(payload, "drilldown response");
  const selection = strictRecord(source.selection, "drilldown selection");
  const pageInfo = strictRecord(source.pageInfo, "drilldown page info");
  if (
    source.dashboardId !== expected.dashboardId
    || source.widgetId !== expected.widgetId
    || selection.pointKey !== expected.selection.pointKey
    || (selection.seriesKey ?? undefined) !== (expected.selection.seriesKey ?? undefined)
  ) {
    throw invalidDashboardContract("drilldown identity");
  }
  const limit = strictInteger(pageInfo.limit, 1, 100, "drilldown limit");
  if (typeof pageInfo.hasMore !== "boolean") throw invalidDashboardContract("drilldown pagination");
  const nextCursor = pageInfo.nextCursor === null
    ? null
    : requiredText(pageInfo.nextCursor, "drilldown cursor", 1024);
  if (nextCursor && !/^[A-Za-z0-9_-]+$/.test(nextCursor)) throw invalidDashboardContract("drilldown cursor");
  if (pageInfo.hasMore && !nextCursor) throw invalidDashboardContract("drilldown continuation cursor");
  if (!Array.isArray(source.records) || source.records.length > limit) {
    throw invalidDashboardContract("drilldown records");
  }
  return {
    dashboardId: expected.dashboardId,
    widgetId: expected.widgetId,
    placementId: requiredText(source.placementId, "drilldown placement id", 160),
    widgetRevision: strictInteger(source.widgetRevision, 1, Number.MAX_SAFE_INTEGER, "widget revision"),
    selection: {
      pointKey: expected.selection.pointKey,
      ...(expected.selection.seriesKey ? { seriesKey: expected.selection.seriesKey } : {}),
    },
    records: source.records.map(normalizeDrilldownRecord),
    pageInfo: { limit, hasMore: pageInfo.hasMore, nextCursor },
  };
}

function normalizeCatalogMetric(value: unknown): DashboardCatalogMetric {
  const metric = strictRecord(value, "catalog metric");
  const unit = oneOf(metric.unit, ["COUNT", "MONEY", "PERCENT", "DURATION", "SCORE"] as const, "metric unit");
  const shape = oneOf(metric.shape, [
    "SCALAR", "TIME_SERIES", "CATEGORY", "XY", "INTERVAL", "GRAPH", "ROWS",
    "HIERARCHY", "BINNED_DISTRIBUTION", "WATERFALL", "EVENT_STREAM",
  ] as const, "metric shape");
  if (!Array.isArray(metric.dimensions) || typeof metric.supportsPeriodComparison !== "boolean") {
    throw invalidDashboardContract("catalog metric metadata");
  }
  const requiredResource = string(metric.requiredResource);
  const rowKind = string(metric.rowKind);
  return {
    key: requiredText(metric.key, "metric key", 120),
    labelAr: requiredText(metric.labelAr, "Arabic metric label", 200),
    labelEn: requiredText(metric.labelEn, "English metric label", 200),
    unit,
    shape,
    dimensions: metric.dimensions.map((item) => requiredText(item, "metric dimension", 40)),
    ...(["leads", "opportunities", "activities", "customer_profiles"].includes(requiredResource)
      ? { requiredResource: requiredResource as DashboardCatalogMetric["requiredResource"] }
      : {}),
    ...(["ALERT", "RANKED", "SCORECARD"].includes(rowKind)
      ? { rowKind: rowKind as DashboardCatalogMetric["rowKind"] }
      : {}),
    ...(isPositiveInteger(metric.semanticVersion) ? { semanticVersion: metric.semanticVersion } : {}),
    ...(optionalText(metric.timeModel, 40) ? { timeModel: metric.timeModel as DashboardCatalogMetric["timeModel"] } : {}),
    ...(optionalText(metric.dateField, 80) ? { dateField: optionalText(metric.dateField, 80) } : {}),
    ...(optionalText(metric.formulaKey, 160) ? { formulaKey: optionalText(metric.formulaKey, 160) } : {}),
    ...(Array.isArray(metric.supportedFilters) ? { supportedFilters: stringArray(metric.supportedFilters) } : {}),
    ...(Array.isArray(metric.comparisonTypes)
      ? {
          comparisonTypes: stringArray(metric.comparisonTypes).filter((candidate): candidate is "NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET" => (
            ["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR", "TARGET"].includes(candidate)
          )),
        }
      : {}),
    ...(optionalText(metric.currencyPolicy, 40) ? { currencyPolicy: metric.currencyPolicy as DashboardCatalogMetric["currencyPolicy"] } : {}),
    ...(Array.isArray(metric.accessResources)
      ? {
          accessResources: stringArray(metric.accessResources).filter((candidate): candidate is "leads" | "opportunities" | "activities" | "customer_profiles" => (
            ["leads", "opportunities", "activities", "customer_profiles"].includes(candidate)
          )),
        }
      : {}),
    ...(optionalText(metric.emptyValuePolicy, 40) ? { emptyValuePolicy: metric.emptyValuePolicy as DashboardCatalogMetric["emptyValuePolicy"] } : {}),
    supportsPeriodComparison: metric.supportsPeriodComparison,
  };
}

function normalizeCatalogVisualization(value: unknown): DashboardCatalogVisualization {
  const visualization = strictRecord(value, "catalog visualization");
  const key = oneOf(visualization.key, dashboardVisualizationTypes, "visualization key");
  if (!Array.isArray(visualization.shapes) || typeof visualization.supportsPeriodComparison !== "boolean") {
    throw invalidDashboardContract("visualization metadata");
  }
  const shapeValues = visualization.shapes.map((shape) => oneOf(shape, [
    "SCALAR", "TIME_SERIES", "CATEGORY", "XY", "INTERVAL", "GRAPH", "ROWS",
    "HIERARCHY", "BINNED_DISTRIBUTION", "WATERFALL", "EVENT_STREAM",
  ] as const, "visualization shape"));
  return {
    key,
    shapes: shapeValues,
    minW: strictInteger(visualization.minW, 1, 12, "minimum width"),
    minH: strictInteger(visualization.minH, 1, 24, "minimum height"),
    defaultW: strictInteger(visualization.defaultW, 1, 12, "default width"),
    defaultH: strictInteger(visualization.defaultH, 1, 24, "default height"),
    maxW: strictInteger(visualization.maxW, 1, 12, "maximum width"),
    maxH: strictInteger(visualization.maxH, 1, 24, "maximum height"),
    minSeries: strictInteger(visualization.minSeries, 1, 12, "minimum series"),
    maxSeries: strictInteger(visualization.maxSeries, 1, 12, "maximum series"),
    ...(typeof visualization.requiresTarget === "boolean" ? { requiresTarget: visualization.requiresTarget } : {}),
    ...(typeof visualization.supportsDualAxis === "boolean" ? { supportsDualAxis: visualization.supportsDualAxis } : {}),
    ...(typeof visualization.supportsMixedUnits === "boolean" ? { supportsMixedUnits: visualization.supportsMixedUnits } : {}),
    ...(typeof visualization.supportsReferences === "boolean" ? { supportsReferences: visualization.supportsReferences } : {}),
    ...(Array.isArray(visualization.supportedTransforms)
      ? { supportedTransforms: stringArray(visualization.supportedTransforms).filter((item): item is "PERCENT_OF_CATEGORY" => item === "PERCENT_OF_CATEGORY") }
      : {}),
    ...(Array.isArray(visualization.rowKinds)
      ? {
          rowKinds: stringArray(visualization.rowKinds).filter((item): item is DashboardP2RowKind => (
            ["ALERT", "RANKED", "SCORECARD"].includes(item)
          )),
        }
      : {}),
    supportsPeriodComparison: visualization.supportsPeriodComparison,
  };
}

function normalizeSemanticQueryCatalog(value: unknown): NonNullable<DashboardCatalog["semanticQuery"]> {
  const semantic = strictRecord(value, "semantic query catalog");
  const limits = strictRecord(semantic.limits, "semantic query limits");
  if (semantic.engine !== "SEMANTIC_V1" || semantic.semanticVersion !== 1) {
    throw invalidDashboardContract("semantic query version");
  }
  if (!Array.isArray(semantic.sources) || !Array.isArray(semantic.metricKeys)) {
    throw invalidDashboardContract("semantic query catalog lists");
  }
  const sources = semantic.sources.map((source) => oneOf(source, ["leads", "opportunities"] as const, "semantic source"));
  const metricKeys = semantic.metricKeys.map((metricKey) => {
    const normalized = requiredText(metricKey, "semantic metric key", 120);
    if (!/^crm\.[a-z0-9_.]+$/.test(normalized)) throw invalidDashboardContract("semantic metric key");
    return normalized;
  });
  return {
    engine: "SEMANTIC_V1",
    semanticVersion: 1,
    sources: Array.from(new Set(sources)),
    metricKeys: Array.from(new Set(metricKeys)),
    limits: {
      maxSeries: strictInteger(limits.maxSeries, 1, 4, "semantic max series"),
      maxDimensions: strictInteger(limits.maxDimensions, 1, 1, "semantic max dimensions"),
      maxFilters: strictInteger(limits.maxFilters, 1, 10, "semantic max filters"),
      maxInValues: strictInteger(limits.maxInValues, 1, 100, "semantic max IN values"),
      maxDateRangeYears: strictInteger(limits.maxDateRangeYears, 1, 10, "semantic max date range"),
      maxTopN: strictInteger(limits.maxTopN, 1, 100, "semantic max top N"),
      maxPoints: strictInteger(limits.maxPoints, 1, 1000, "semantic max points"),
      maxAccessBranches: strictInteger(limits.maxAccessBranches, 1, 10_000, "semantic branch limit"),
      maxAccessOwnersPerBranch: strictInteger(limits.maxAccessOwnersPerBranch, 1, 10_000, "semantic owner limit"),
      maxAccessPipelines: strictInteger(limits.maxAccessPipelines, 1, 10_000, "semantic pipeline limit"),
    },
  };
}

function normalizeHierarchyResult(source: Record<string, unknown>): DashboardP2Result {
  const { unit, currencyCode } = normalizeUnitCurrency(source);
  if (!Array.isArray(source.nodes) || source.nodes.length > 200) throw invalidDashboardContract("hierarchy nodes");
  const nodes = source.nodes.map((candidate) => {
    const node = strictRecord(candidate, "hierarchy node");
    return {
      id: contractKey(node.id, "hierarchy node id"),
      ...(node.parentId === undefined ? {} : { parentId: contractKey(node.parentId, "hierarchy parent id") }),
      label: requiredText(node.label, "hierarchy node label", 200),
      value: strictFinite(node.value, "hierarchy node value", 0),
      depth: strictInteger(node.depth, 0, 3, "hierarchy depth"),
      ...(node.entityRef === undefined ? {} : { entityRef: normalizeEntityReference(node.entityRef) }),
    };
  });
  ensureUnique(nodes.map((node) => node.id), "hierarchy node ids");
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (!node.parentId && node.depth !== 0) throw invalidDashboardContract("hierarchy root depth");
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (!parent || parent.id === node.id || node.depth !== parent.depth + 1) {
        throw invalidDashboardContract("hierarchy parent relation");
      }
    }
  }
  return {
    shape: "HIERARCHY",
    unit,
    ...(currencyCode ? { currencyCode } : {}),
    nodes,
    ...normalizeOptionalReferences(source.references, currencyCode),
  };
}

function normalizeBinnedDistributionResult(source: Record<string, unknown>): DashboardP2Result {
  const { unit, currencyCode } = normalizeUnitCurrency(source);
  if (!Array.isArray(source.bins) || source.bins.length < 5 || source.bins.length > 50) {
    throw invalidDashboardContract("distribution bins");
  }
  const bins = source.bins.map((candidate) => {
    const bin = strictRecord(candidate, "distribution bin");
    const kind = oneOf(bin.kind, ["STANDARD", "UNDERFLOW", "OVERFLOW"] as const, "distribution bin kind");
    const lowerBound = bin.lowerBound === undefined ? undefined : strictFinite(bin.lowerBound, "lower bound");
    const upperBound = bin.upperBound === undefined ? undefined : strictFinite(bin.upperBound, "upper bound");
    if (kind === "STANDARD" && (lowerBound === undefined || upperBound === undefined || lowerBound >= upperBound)) {
      throw invalidDashboardContract("standard bin boundaries");
    }
    if (kind === "UNDERFLOW" && (lowerBound !== undefined || upperBound === undefined)) {
      throw invalidDashboardContract("underflow boundaries");
    }
    if (kind === "OVERFLOW" && (lowerBound === undefined || upperBound !== undefined)) {
      throw invalidDashboardContract("overflow boundaries");
    }
    return {
      key: contractKey(bin.key, "bin key"),
      label: requiredText(bin.label, "bin label", 120),
      order: strictInteger(bin.order, 0, 49, "bin order"),
      kind,
      ...(lowerBound === undefined ? {} : { lowerBound }),
      ...(upperBound === undefined ? {} : { upperBound }),
      count: strictInteger(bin.count, 0, Number.MAX_SAFE_INTEGER, "bin count"),
    };
  }).toSorted((left, right) => left.order - right.order);
  ensureUnique(bins.map((bin) => bin.key), "bin keys");
  let previousUpper: number | undefined;
  bins.forEach((bin, index) => {
    if (bin.order !== index) throw invalidDashboardContract("bin order");
    if (bin.kind === "UNDERFLOW" && index !== 0) throw invalidDashboardContract("underflow order");
    if (bin.kind === "OVERFLOW" && index !== bins.length - 1) throw invalidDashboardContract("overflow order");
    const lower = bin.kind === "UNDERFLOW" ? undefined : bin.lowerBound;
    if (lower !== undefined && previousUpper !== undefined && lower !== previousUpper) {
      throw invalidDashboardContract("adjacent bin boundaries");
    }
    previousUpper = bin.upperBound;
  });
  const totalCount = bins.reduce((total, bin) => total + bin.count, 0);
  if (source.totalCount !== totalCount) throw invalidDashboardContract("distribution total");
  return {
    shape: "BINNED_DISTRIBUTION",
    unit,
    ...(currencyCode ? { currencyCode } : {}),
    bins,
    totalCount,
    ...normalizeOptionalReferences(source.references, currencyCode),
  };
}

function normalizeWaterfallResult(source: Record<string, unknown>): DashboardP2Result {
  const { unit, currencyCode } = normalizeUnitCurrency(source);
  if (!Array.isArray(source.steps) || source.steps.length > 50) throw invalidDashboardContract("waterfall steps");
  let cumulativeValue = 0;
  const steps = source.steps.map((candidate, index) => {
    const step = strictRecord(candidate, "waterfall step");
    const kind = oneOf(step.kind, ["START", "DELTA", "SUBTOTAL", "TOTAL"] as const, "waterfall kind");
    const order = strictInteger(step.order, 0, 49, "waterfall order");
    if (order !== index || (index === 0 && kind !== "START") || (index > 0 && kind === "START")) {
      throw invalidDashboardContract("waterfall sequence");
    }
    const value = strictFinite(step.value, "waterfall value");
    if (kind === "START") cumulativeValue = value;
    else if (kind === "DELTA") cumulativeValue += value;
    else if (!approximatelyEqual(value, cumulativeValue)) throw invalidDashboardContract("waterfall subtotal");
    if (!approximatelyEqual(strictFinite(step.cumulativeValue, "waterfall cumulative value"), cumulativeValue)) {
      throw invalidDashboardContract("waterfall cumulative value");
    }
    return {
      key: contractKey(step.key, "waterfall key"),
      label: requiredText(step.label, "waterfall label", 120),
      order,
      kind,
      value,
      cumulativeValue,
    };
  });
  ensureUnique(steps.map((step) => step.key), "waterfall keys");
  return {
    shape: "WATERFALL",
    unit,
    ...(currencyCode ? { currencyCode } : {}),
    steps,
    ...normalizeOptionalReferences(source.references, currencyCode),
  };
}

function normalizeEventStreamResult(source: Record<string, unknown>): DashboardP2Result {
  if (!Array.isArray(source.events) || source.events.length > 100 || typeof source.partialAccess !== "boolean") {
    throw invalidDashboardContract("event stream");
  }
  const events = source.events.map((candidate) => {
    const event = strictRecord(candidate, "event stream item");
    return {
      id: contractKey(event.id, "event id"),
      occurredAt: isoTimestamp(event.occurredAt, "event timestamp"),
      kind: contractKey(event.kind, "event kind"),
      title: requiredText(event.title, "event title", 200),
      ...(optionalText(event.description, 1000) ? { description: optionalText(event.description, 1000) } : {}),
      severity: oneOf(event.severity, ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const, "event severity"),
      entityRef: normalizeEntityReference(event.entityRef),
    };
  });
  ensureUnique(events.map((event) => event.id), "event ids");
  return { shape: "EVENT_STREAM", events, partialAccess: source.partialAccess };
}

function normalizeP2RowsResult(source: Record<string, unknown>): DashboardP2Result {
  const rowKind = oneOf(source.rowKind, ["ALERT", "RANKED", "SCORECARD"] as const, "row kind");
  if (!Array.isArray(source.rows)) throw invalidDashboardContract("typed rows");
  if (rowKind === "ALERT") {
    if (source.rows.length > 100 || typeof source.partialAccess !== "boolean") {
      throw invalidDashboardContract("alert rows");
    }
    const rows = source.rows.map((candidate) => {
      const row = strictRecord(candidate, "alert row");
      return {
        id: contractKey(row.id, "alert id"),
        severity: oneOf(row.severity, ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const, "alert severity"),
        reasonCode: contractKey(row.reasonCode, "alert reason"),
        title: requiredText(row.title, "alert title", 200),
        occurredAt: isoTimestamp(row.occurredAt, "alert timestamp"),
        ...(row.dueAt === undefined ? {} : { dueAt: isoTimestamp(row.dueAt, "alert due timestamp") }),
        entityRef: normalizeEntityReference(row.entityRef),
      };
    });
    ensureUnique(rows.map((row) => row.id), "alert ids");
    return { shape: "ROWS", rowKind, rows, partialAccess: source.partialAccess };
  }
  if (rowKind === "RANKED") {
    if (source.rows.length > 100) throw invalidDashboardContract("ranked rows");
    const rows = source.rows.map((candidate) => {
      const row = strictRecord(candidate, "ranked row");
      if (!Array.isArray(row.secondaryMeasures) || row.secondaryMeasures.length > 5) {
        throw invalidDashboardContract("ranked secondary measures");
      }
      return {
        id: contractKey(row.id, "ranked row id"),
        rank: strictInteger(row.rank, 1, 100, "rank"),
        label: requiredText(row.label, "ranked row label", 200),
        primaryMeasure: normalizeP2Measure(row.primaryMeasure),
        secondaryMeasures: row.secondaryMeasures.map(normalizeP2Measure),
        ...(row.entityRef === undefined ? {} : { entityRef: normalizeEntityReference(row.entityRef) }),
      };
    });
    ensureUnique(rows.map((row) => row.id), "ranked row ids");
    ensureSingleCurrency(rows.flatMap((row) => [row.primaryMeasure, ...row.secondaryMeasures]));
    return { shape: "ROWS", rowKind, rows };
  }
  if (source.rows.length > 50) throw invalidDashboardContract("scorecard rows");
  const rows = source.rows.map((candidate) => {
    const row = strictRecord(candidate, "scorecard row");
    if (!Array.isArray(row.measures) || row.measures.length < 1 || row.measures.length > 6) {
      throw invalidDashboardContract("scorecard measures");
    }
    return {
      id: contractKey(row.id, "scorecard row id"),
      label: requiredText(row.label, "scorecard row label", 200),
      status: oneOf(row.status, ["ON_TRACK", "AT_RISK", "OFF_TRACK", "UNKNOWN"] as const, "scorecard status"),
      measures: row.measures.map(normalizeP2Measure),
      ...(row.entityRef === undefined ? {} : { entityRef: normalizeEntityReference(row.entityRef) }),
    };
  });
  ensureUnique(rows.map((row) => row.id), "scorecard row ids");
  ensureSingleCurrency(rows.flatMap((row) => row.measures));
  return { shape: "ROWS", rowKind, rows };
}

function normalizeP2Measure(value: unknown): DashboardP2Measure {
  const measure = strictRecord(value, "dashboard measure");
  const { unit, currencyCode } = normalizeUnitCurrency(measure);
  const references = normalizeReferences(measure.references, currencyCode);
  return {
    key: contractKey(measure.key, "measure key"),
    label: requiredText(measure.label, "measure label", 120),
    value: strictFinite(measure.value, "measure value"),
    unit,
    ...(currencyCode ? { currencyCode } : {}),
    ...(references.length ? { references } : {}),
  };
}

function normalizeReferences(value: unknown, currencyCode?: string): DashboardP2Reference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw invalidDashboardContract("dashboard references");
  const references = value.map((candidate) => {
    const reference = strictRecord(candidate, "dashboard reference");
    const normalizedUnit = normalizeUnitCurrency(reference);
    return {
      key: contractKey(reference.key, "reference key"),
      label: requiredText(reference.label, "reference label", 120),
      kind: oneOf(reference.kind, ["TARGET", "BENCHMARK", "THRESHOLD_MIN", "THRESHOLD_MAX"] as const, "reference kind"),
      value: strictFinite(reference.value, "reference value"),
      unit: normalizedUnit.unit,
      ...(normalizedUnit.currencyCode ? { currencyCode: normalizedUnit.currencyCode } : {}),
    };
  });
  ensureUnique(references.map((reference) => reference.key), "reference keys");
  const currencies = new Set([currencyCode, ...references.map((reference) => reference.currencyCode)].filter(Boolean));
  if (currencies.size > 1) throw invalidDashboardContract("reference currency isolation");
  return references;
}

function normalizeOptionalReferences(value: unknown, currencyCode?: string) {
  const references = normalizeReferences(value, currencyCode);
  return references.length ? { references } : {};
}

function normalizeEntityReference(value: unknown): DashboardP2EntityReference {
  const entity = strictRecord(value, "entity reference");
  const href = optionalText(entity.href, 500);
  return {
    type: oneOf(entity.type, ["LEAD", "OPPORTUNITY", "ACTIVITY", "TASK", "CUSTOMER_PROFILE", "CALENDAR_EVENT"] as const, "entity type"),
    id: contractKey(entity.id, "entity id"),
    ...(href && isSafeCrmEntityHref(href) ? { href } : {}),
  };
}

function normalizeUnitCurrency(value: Record<string, unknown>): {
  unit: DashboardP2Measure["unit"];
  currencyCode?: string;
} {
  const unit = oneOf(value.unit, ["COUNT", "MONEY", "PERCENT", "DURATION", "SCORE"] as const, "dashboard unit");
  const currencyCode = value.currencyCode === undefined ? undefined : string(value.currencyCode).trim().toUpperCase();
  if (unit === "MONEY" && !/^[A-Z]{3}$/.test(currencyCode ?? "")) throw invalidDashboardContract("money currency");
  if (unit !== "MONEY" && currencyCode) throw invalidDashboardContract("non-money currency");
  return { unit, ...(currencyCode ? { currencyCode } : {}) };
}

function ensureSingleCurrency(measures: DashboardP2Measure[]) {
  const currencies = new Set(measures.flatMap((measure) => [
    measure.currencyCode,
    ...(measure.references ?? []).map((reference) => reference.currencyCode),
  ]).filter(Boolean));
  if (currencies.size > 1) throw invalidDashboardContract("measure currency isolation");
}

function normalizeDrilldownRecord(value: unknown): DashboardDrilldownRecord {
  const source = strictRecord(value, "drilldown record");
  const normalized: DashboardDrilldownRecord = {
    id: requiredText(source.id, "drilldown record id", 160),
  };
  for (const field of [
    "entityType", "title", "status", "stageName", "ownerName", "branchName", "pipelineName",
    "sourceName", "activityType", "reason", "currencyCode",
  ] as const) {
    const value = optionalText(source[field], 500);
    if (value) normalized[field] = value;
  }
  for (const field of ["amount", "value"] as const) {
    if (source[field] !== undefined) normalized[field] = strictFinite(source[field], `drilldown ${field}`);
  }
  if (source.rank !== undefined) {
    normalized.rank = strictInteger(source.rank, 0, Number.MAX_SAFE_INTEGER, "drilldown rank");
  }
  for (const field of [
    "occurredAt", "createdAt", "updatedAt", "dueAt", "closedAt", "convertedAt",
  ] as const) {
    if (source[field] !== undefined) normalized[field] = isoTimestamp(source[field], `drilldown ${field}`);
  }
  return normalized;
}

function normalizeComparisonCompatibility(value: unknown): DashboardRunResult["comparisonCompatibility"] {
  if (value === undefined || value === null) return undefined;
  const source = record(value);
  if (!Array.isArray(source.requestedTypes)) return undefined;
  const requestedTypes = stringArray(source.requestedTypes).filter((item): item is "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" => (
    item === "PREVIOUS_PERIOD" || item === "PREVIOUS_YEAR"
  ));
  const list = (field: "appliedWidgetIds" | "partiallyAppliedWidgetIds" | "skippedWidgetIds") => (
    Array.isArray(source[field]) ? stringArray(source[field]).filter(Boolean).slice(0, 100) : undefined
  );
  const appliedWidgetIds = list("appliedWidgetIds");
  const partiallyAppliedWidgetIds = list("partiallyAppliedWidgetIds");
  const skippedWidgetIds = list("skippedWidgetIds");
  if (!requestedTypes.length || !appliedWidgetIds || !partiallyAppliedWidgetIds || !skippedWidgetIds) return undefined;
  const allIds = [...appliedWidgetIds, ...partiallyAppliedWidgetIds, ...skippedWidgetIds];
  if (new Set(allIds).size !== allIds.length) return undefined;
  return { requestedTypes: Array.from(new Set(requestedTypes)), appliedWidgetIds, partiallyAppliedWidgetIds, skippedWidgetIds };
}

function alignCanonicalComparisonSeries(
  rawSeries: Array<Record<string, unknown>>,
  series: DashboardWidgetResult["series"],
) {
  rawSeries.forEach((candidate, comparisonIndex) => {
    const comparisonBase = comparisonSeriesBase(candidate);
    if (!comparisonBase) return;
    const currentIndex = rawSeries.findIndex((current, index) => (
      index !== comparisonIndex
      && !comparisonSeriesBase(current)
      && seriesIdentifiers(current).includes(comparisonBase)
    ));
    if (currentIndex < 0 || !series[currentIndex]?.points.length) return;
    series[comparisonIndex].points = series[comparisonIndex].points.map((point, pointIndex) => {
      const currentPoint = series[currentIndex].points[pointIndex];
      return currentPoint
        ? {
            ...point,
            key: currentPoint.key,
            label: currentPoint.label,
            meta: {
              ...point.meta,
              comparisonOriginalKey: point.key,
              comparisonOriginalLabel: point.label,
            },
          }
        : point;
    });
  });
}

function comparisonSeriesBase(item: Record<string, unknown>) {
  for (const identifier of seriesIdentifiers(item)) {
    const match = identifier.match(/^(.*?)(?:[\s·:._/-]+)previous_(?:period|year)$/i);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function seriesIdentifiers(item: Record<string, unknown>) {
  return [string(item.key), string(item.metricKey), string(item.label)]
    .filter(Boolean)
    .map((value) => value.trim().toLocaleLowerCase());
}

function normalizeUnavailablePlacements(value: unknown): DashboardUnavailablePlacement[] {
  const allowedReasons = new Set<DashboardUnavailablePlacement["reason"]>([
    "WIDGET_ACCESS_REVOKED",
    "WIDGET_PERMISSION_REQUIRED",
    "WIDGET_DELETED",
  ]);
  return rows(value).flatMap((placement) => {
    const id = string(placement.id);
    const reason = string(placement.reason) as DashboardUnavailablePlacement["reason"];
    if (!id || !allowedReasons.has(reason)) return [];
    return [{
      id,
      x: Math.max(0, number(placement.x)),
      y: Math.max(0, number(placement.y)),
      width: Math.max(1, Math.min(12, number(placement.width))),
      height: Math.max(1, Math.min(24, number(placement.height))),
      sortOrder: optionalNumber(placement.sortOrder),
      reason,
    }];
  });
}

function normalizeExecutorSeries(
  item: Record<string, unknown>,
  shape: DashboardWidgetResult["shape"],
  index: number,
) {
  const metricKey = string(item.metricKey) || `series-${index}`;
  if (Array.isArray(item.points)) {
    const rawAxis = string(item.axis);
    const labelAr = string(item.labelAr) || undefined;
    const labelEn = string(item.labelEn) || undefined;
    return {
      key: string(item.key) || metricKey,
      label: string(item.label) || labelEn || labelAr || metricKey,
      ...(labelAr ? { labelAr } : {}),
      ...(labelEn ? { labelEn } : {}),
      unit: string(item.unit) || undefined,
      currency: string(item.currency) || undefined,
      axis: rawAxis === "RIGHT" ? "RIGHT" as const : rawAxis === "LEFT" ? "LEFT" as const : undefined,
      points: rows(item.points).map((point, pointIndex) => {
        const pointLabelAr = string(point.labelAr) || undefined;
        const pointLabelEn = string(point.labelEn) || undefined;
        return {
          key: string(point.key) || String(pointIndex),
          label: string(point.label) || pointLabelEn || pointLabelAr || `Value ${pointIndex + 1}`,
          ...(pointLabelAr ? { labelAr: pointLabelAr } : {}),
          ...(pointLabelEn ? { labelEn: pointLabelEn } : {}),
          value: number(point.value),
          secondaryValue: optionalNumber(point.secondaryValue),
          size: optionalNumber(point.size),
          start: string(point.start) || undefined,
          end: string(point.end) || undefined,
          color: string(point.color) || undefined,
          href: string(point.href) || undefined,
          meta: record(point.meta),
        };
      }),
    };
  }
  const data = item.data;
  const graph = record(data);
  let dataRows = rows(data);
  if (shape === "GRAPH") {
    const nodes = new Map(rows(graph.nodes).map((node) => [string(node.id), string(node.label) || string(node.id)]));
    dataRows = rows(graph.edges).map((edge, edgeIndex) => ({
      id: `${string(edge.source)}-${string(edge.target)}-${edgeIndex}`,
      label: `${nodes.get(string(edge.source)) ?? string(edge.source)} → ${nodes.get(string(edge.target)) ?? string(edge.target)}`,
      value: number(edge.value),
      source: edge.source,
      target: edge.target,
    }));
  } else if (!dataRows.length && data && typeof data === "object") {
    dataRows = [record(data)];
  }
  const rawAxis = string(item.axis);
  const labelAr = string(item.labelAr) || undefined;
  const labelEn = string(item.labelEn) || undefined;
  return {
    key: metricKey,
    label: string(item.label) || labelEn || labelAr || metricKey,
    ...(labelAr ? { labelAr } : {}),
    ...(labelEn ? { labelEn } : {}),
    unit: string(item.unit) || undefined,
    currency: string(item.currency) || undefined,
    axis: rawAxis === "RIGHT" ? "RIGHT" as const : rawAxis === "LEFT" ? "LEFT" as const : undefined,
    points: dataRows.map((row, pointIndex) => {
      const x = row.x;
      const pointLabelAr = string(row.labelAr) || undefined;
      const pointLabelEn = string(row.labelEn) || undefined;
      const pointLabel = string(row.label)
        || pointLabelEn
        || pointLabelAr
        || string(row.currencyCode)
        || string(x)
        || `Value ${pointIndex + 1}`;
      return {
        key: string(row.id) || string(x) || String(pointIndex),
        label: pointLabel,
        ...(pointLabelAr ? { labelAr: pointLabelAr } : {}),
        ...(pointLabelEn ? { labelEn: pointLabelEn } : {}),
        value: shape === "XY" ? number(row.x) : number(row.value),
        secondaryValue: shape === "XY" ? number(row.y) : undefined,
        size: shape === "XY" ? number(row.size) : undefined,
        start: shape === "INTERVAL" ? string(row.start) || undefined : undefined,
        end: shape === "INTERVAL" ? string(row.end) || undefined : undefined,
        meta: row,
      };
    }),
  };
}

function scalarDataValue(data: unknown): number | undefined {
  const direct = record(data);
  if (Object.hasOwn(direct, "value")) return number(direct.value);
  const first = rows(data)[0];
  return first ? number(first.value) : undefined;
}

function normalizeSemanticFilters(value: unknown): NonNullable<DashboardQuerySpec["semanticFilters"]> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) throw invalidDashboardContract("semantic filters");
  return value.map((candidate) => {
    const filter = strictRecord(candidate, "semantic filter");
    const field = oneOf(filter.field, ["status", "stageId", "sourceId"] as const, "semantic filter field");
    const operator = oneOf(filter.operator, ["EQ", "IN"] as const, "semantic filter operator");
    if (!Array.isArray(filter.values) || filter.values.length < 1 || filter.values.length > 100) {
      throw invalidDashboardContract("semantic filter values");
    }
    return {
      field,
      operator,
      values: filter.values.map((item) => requiredText(item, "semantic filter value", 80)),
    };
  });
}

function strictRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidDashboardContract(label);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw invalidDashboardContract(label);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw invalidDashboardContract(label);
  return normalized;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) throw invalidDashboardContract(label);
  return value as Values[number];
}

function strictFinite(value: unknown, label: string, minimum = -Number.MAX_VALUE): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw invalidDashboardContract(label);
  }
  return value;
}

function strictInteger(value: unknown, minimum: number, maximum: number, label: string): number {
  const normalized = strictFinite(value, label, minimum);
  if (!Number.isInteger(normalized) || normalized > maximum) throw invalidDashboardContract(label);
  return normalized;
}

function contractKey(value: unknown, label: string): string {
  const normalized = requiredText(value, label, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(normalized)) throw invalidDashboardContract(label);
  return normalized;
}

function isoTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw invalidDashboardContract(label);
  return new Date(value).toISOString();
}

function ensureUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw invalidDashboardContract(label);
}

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.000001;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isBoundedIntegerValue(value: unknown, maximum: number): value is number {
  return isPositiveInteger(value) && value <= maximum;
}

function isStringNumberRecord(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(isPositiveInteger);
}

function isLayoutAdjustment(value: unknown): value is NonNullable<UpdateWidgetResult["layoutAdjustments"]>[number] {
  const candidate = record(value);
  return Boolean(string(candidate.placementId))
    && Boolean(string(candidate.dashboardId))
    && [candidate.x, candidate.y, candidate.width, candidate.height].every((item) => (
      typeof item === "number" && Number.isInteger(item)
    ));
}

function invalidDashboardContract(field: string) {
  return new Error(`The CRM dashboard response contained an invalid ${field}.`);
}

function dashboardShape(value: unknown): DashboardWidgetResult["shape"] {
  return [
    "SCALAR",
    "TIME_SERIES",
    "CATEGORY",
    "XY",
    "INTERVAL",
    "GRAPH",
    "ROWS",
    "HIERARCHY",
    "BINNED_DISTRIBUTION",
    "WATERFALL",
    "EVENT_STREAM",
  ].includes(string(value))
    ? string(value) as DashboardWidgetResult["shape"]
    : "ROWS";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function number(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "value" in value) return number((value as { value?: unknown }).value);
  return 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
