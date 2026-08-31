import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import {
  DASHBOARD_LIMITS,
  DASHBOARD_SHAREABLE_ACCESS_LEVELS,
  DASHBOARD_SHARE_SUBJECT_TYPES,
  type DashboardPlacement,
  type DashboardShareSubjectType,
  type DashboardShareableAccessLevel,
  type DashboardVisualizationType,
} from "./analytics-contract";

// Request bodies for the dashboard and widget writes. Kept beside the
// contract rather than inside it because these are form-to-wire builders, not
// response types.
//
// The DTO facts that shape them, all read from
// trade-app/src/modules/dashboards/dto/dashboard.dto.ts:
//
//   * `SetDashboardDefaultDto` and `SetDashboardFavoriteDto` require a
//     `context` object — `{ kind, companyId? }` — and the favourite one adds a
//     boolean. Neither is an empty POST.
//   * `BulkUpsertSharesDto` requires `resourceRevision` (int >= 1) alongside
//     the changes; the revision is a THIRD concurrency token, in the body,
//     with no If-Match on that route.
//   * `PreviewWidgetDto` extends `CreateWidgetDto` **and adds a required
//     `requestId` UUID v7** — the API page does not mention it, and omitting
//     it is a 400.
//   * `RunDashboardDto.requestId` is likewise a required UUID v7; the run
//     takes no idempotency key because that id is its de-duplication token.

export interface DashboardScopeTargetInput {
  companyId: string;
  branchIds: string[];
}

export function buildCreateDashboardRequest(
  name: string,
  description: string,
  scopeTargets: readonly DashboardScopeTargetInput[],
) {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > DASHBOARD_LIMITS.nameMaxLength) {
    throw new Error("ANALYTICS_FORM_NAME");
  }
  if (
    scopeTargets.length < 1 ||
    scopeTargets.length > DASHBOARD_LIMITS.maxExplicitCompanyScopes ||
    !scopeTargets.every((target) => isUUIDv7(target.companyId))
  ) {
    throw new Error("ANALYTICS_FORM_SCOPE");
  }
  const body: Record<string, unknown> = {
    name: trimmed,
    scopeCoverage:
      scopeTargets.length === 1 ? "SINGLE_COMPANY" : "MULTI_COMPANY_AUTHORIZED_UNION",
    scopeTargets: scopeTargets.map((target) =>
      target.branchIds.length > 0
        ? { companyId: target.companyId, branchIds: target.branchIds }
        : { companyId: target.companyId },
    ),
  };
  const trimmedDescription = description.trim();
  if (trimmedDescription.length > DASHBOARD_LIMITS.descriptionMaxLength) {
    throw new Error("ANALYTICS_FORM_NAME");
  }
  if (trimmedDescription.length > 0) body.description = trimmedDescription;
  return body;
}

export function buildFromTemplateRequest(name: string) {
  const trimmed = name.trim();
  if (trimmed.length === 0) return {};
  if (trimmed.length > DASHBOARD_LIMITS.nameMaxLength) throw new Error("ANALYTICS_FORM_NAME");
  return { name: trimmed };
}

export function buildDuplicateRequest(name: string) {
  return buildFromTemplateRequest(name);
}

/** The preference context a set-default / set-favorite write must carry. */
export function preferenceContext(companyId: string | null) {
  return companyId === null
    ? { kind: "CONSOLIDATED" as const }
    : { kind: "COMPANY" as const, companyId };
}

export function buildSetDefaultRequest(companyId: string | null) {
  return { context: preferenceContext(companyId) };
}

export function buildSetFavoriteRequest(companyId: string | null, favorite: boolean) {
  return { context: preferenceContext(companyId), favorite };
}

/** `RunDashboardDto` — `requestId` required, everything else optional. */
export function buildRunRequest() {
  return { requestId: generateUUIDv7() };
}

/** Every placement in a layout write carries all five coordinates. */
export function buildLayoutRequest(placements: readonly DashboardPlacement[]) {
  if (placements.length > DASHBOARD_LIMITS.maxPlacements) {
    throw new Error("ANALYTICS_FORM_LAYOUT");
  }
  return {
    placements: placements.map((placement) => ({
      placementId: placement.id,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      sortOrder: placement.sortOrder,
    })),
  };
}

export function buildPlacementRequest(widgetId: string) {
  if (!isUUIDv7(widgetId)) throw new Error("ANALYTICS_FORM_METRIC");
  return { widgetId };
}

export interface ShareChangeInput {
  subjectId: string;
  subjectType: DashboardShareSubjectType;
  accessLevel: DashboardShareableAccessLevel;
}

export function buildBulkSharesRequest(
  resourceRevision: number,
  changes: readonly ShareChangeInput[],
) {
  if (
    changes.length < 1 ||
    changes.length > DASHBOARD_LIMITS.maxShareTargets ||
    !changes.every(
      (change) =>
        isUUIDv7(change.subjectId) &&
        DASHBOARD_SHARE_SUBJECT_TYPES.includes(change.subjectType) &&
        DASHBOARD_SHAREABLE_ACCESS_LEVELS.includes(change.accessLevel),
    )
  ) {
    throw new Error("ANALYTICS_FORM_SHARE");
  }
  if (!Number.isSafeInteger(resourceRevision) || resourceRevision < 1) {
    throw new Error("ANALYTICS_FORM_SHARE");
  }
  return { resourceRevision, changes: changes.map((change) => ({ ...change })) };
}

export interface WidgetSeriesInput {
  metricKey: string;
  label: string;
}

/**
 * `CreateWidgetDto` needs all four keys, and `querySpec.series` needs at least
 * one entry whose `metricKey` matches `^trade\.[a-z0-9_.]+$` — a key picked
 * from the catalogue always does, an invented one does not.
 */
export function buildWidgetRequest(
  name: string,
  visualizationType: DashboardVisualizationType,
  series: readonly WidgetSeriesInput[],
  displayTitle: string,
) {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > DASHBOARD_LIMITS.nameMaxLength) {
    throw new Error("ANALYTICS_FORM_NAME");
  }
  if (series.length < 1 || series.length > DASHBOARD_LIMITS.maxWidgetSeries) {
    throw new Error("ANALYTICS_FORM_METRIC");
  }
  if (!series.every((entry) => /^trade\.[a-z0-9_.]+$/u.test(entry.metricKey))) {
    throw new Error("ANALYTICS_FORM_METRIC");
  }
  const displaySpec: Record<string, unknown> = {};
  const title = displayTitle.trim();
  if (title.length > 0) displaySpec.title = title;
  return {
    name: trimmed,
    visualizationType,
    querySpec: {
      series: series.map((entry) =>
        entry.label.trim().length > 0
          ? { metricKey: entry.metricKey, label: entry.label.trim() }
          : { metricKey: entry.metricKey },
      ),
    },
    displaySpec,
  };
}

/** A preview is the full widget definition plus its own `requestId`. */
export function buildWidgetPreviewRequest(
  name: string,
  visualizationType: DashboardVisualizationType,
  series: readonly WidgetSeriesInput[],
  displayTitle: string,
) {
  return {
    ...buildWidgetRequest(name, visualizationType, series, displayTitle),
    requestId: generateUUIDv7(),
  };
}

export function buildCloneWidgetRequest(name: string) {
  return buildFromTemplateRequest(name);
}
