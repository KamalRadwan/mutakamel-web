// Wire contract for the CRM dashboard builder.
//
// Transcribed from crm-app/src/crm/dashboards/dashboard-builder.controller.ts,
// dashboard-definitions.service.ts, dashboard-access.service.ts,
// dashboard-catalog.ts and dto/dashboard-builder.dto.ts. The semantic page is
// docs/api/crm-dashboards.md.
//
// **None of these 40 routes is `BRANCH_REQUIRED`.** 39 declare no
// `organizationScopeMode` at all and the drill-down declares `NONE`, so the
// scope headers must NOT be sent — S2's "every CRM list needs branchId" does
// not reach this family, and `branchId` here is an optional *filter*.

import { isUUIDv7 } from "@/lib/uuid";
import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  timestamp,
} from "./dashboard-parse";
import {
  DASHBOARD_WIDGET_LIMIT,
  encodeId,
  isAccessLevel,
  parseBox,
  parseWidgetDefinition,
  type ResourceAccessLevel,
  type WidgetDefinition,
} from "./widget-contract";

export const DASHBOARDS_PATH = "/api/tenant/crm/v1/dashboards";
export const DASHBOARDS_CATALOG_PATH = "/api/tenant/crm/v1/dashboards/catalog";
export const DASHBOARDS_NAVIGATION_PATH = "/api/tenant/crm/v1/dashboards/navigation";
export const DASHBOARDS_DEFAULT_PATH = "/api/tenant/crm/v1/dashboards/default";
export const DASHBOARD_SHARE_TARGETS_PATH =
  "/api/tenant/crm/v1/dashboards/share-targets";

export const DASHBOARD_NAME_MAX_LENGTH = 120;
export const DASHBOARD_DESCRIPTION_MAX_LENGTH = 500;
const MAX_DASHBOARDS_IN_RESPONSE = 500;

/** `CRM_DASHBOARD_TEMPLATE_KEYS` — dashboard-catalog.ts. */
export const DASHBOARD_TEMPLATE_KEYS = [
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
] as const;
export type DashboardTemplateKey = (typeof DASHBOARD_TEMPLATE_KEYS)[number];

/** `unavailablePlacements[].reason` — dashboard-access.service.ts. */
const UNAVAILABLE_PLACEMENT_REASONS = [
  "WIDGET_ACCESS_REVOKED",
  "WIDGET_PERMISSION_REQUIRED",
  "WIDGET_DELETED",
] as const;
type UnavailablePlacementReason = (typeof UNAVAILABLE_PLACEMENT_REASONS)[number];

export interface DashboardSummary {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  description: string | null;
  defaultFilters: Record<string, unknown>;
  sourceTemplateKey: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  accessLevel: ResourceAccessLevel;
  isShared: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  lastOpenedAt: string | null;
}

export interface DashboardPlacement {
  id: string;
  dashboardId: string;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  widget: WidgetDefinition;
}

interface UnavailablePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  reason: UnavailablePlacementReason;
}

export interface DashboardDetail extends DashboardSummary {
  placements: DashboardPlacement[];
  /**
   * Placements whose widget the viewer cannot see. Returned **empty to a VIEW
   * viewer** — `dashboard-definitions.service.ts` gates it on OWNER/EDIT — so
   * an empty array never proves the layout is complete.
   */
  unavailablePlacements: UnavailablePlacement[];
  /** Present only on `POST /:id/duplicate`. */
  duplication: { omittedUnavailableWidgetCount: number | null; warnings: string[] } | null;
}

/**
 * `GET /dashboards/navigation` — a narrower projection than the list, not a
 * subset of it: it carries no `description`, `defaultFilters`,
 * `sourceTemplateKey`, `createdAt` or `lastOpenedAt`.
 */
export interface DashboardNavigationItem {
  id: string;
  name: string;
  isDefault: boolean;
  isFavorite: boolean;
  isShared: boolean;
  accessLevel: ResourceAccessLevel;
  ownerUserId: string;
  ownerName: string | null;
  revision: number;
  updatedAt: string;
}

export interface DashboardNavigation {
  items: DashboardNavigationItem[];
  activeDashboardId: string | null;
}

export function dashboardPath(id: string): string {
  return `${DASHBOARDS_PATH}/${encodeId(id)}`;
}

export function dashboardRunPath(id: string): string {
  return `${dashboardPath(id)}/run`;
}

export function dashboardLayoutPath(id: string): string {
  return `${dashboardPath(id)}/layout`;
}

export function dashboardDefaultPath(id: string): string {
  return `${dashboardPath(id)}/default`;
}

export function dashboardFavoritePath(id: string): string {
  return `${dashboardPath(id)}/favorite`;
}

export function dashboardDuplicatePath(id: string): string {
  return `${dashboardPath(id)}/duplicate`;
}

export function dashboardPlacementsPath(id: string): string {
  return `${dashboardPath(id)}/placements`;
}

export function dashboardPlacementPath(id: string, placementId: string): string {
  return `${dashboardPath(id)}/placements/${encodeId(placementId)}`;
}

export function dashboardDrilldownPath(id: string, widgetId: string): string {
  return `${dashboardPath(id)}/widgets/${encodeId(widgetId)}/drilldown`;
}

export function dashboardFromTemplatePath(templateKey: DashboardTemplateKey): string {
  return `${DASHBOARDS_PATH}/from-template/${templateKey}`;
}

/**
 * `POST /dashboards` body — `CreateDashboardDto`.
 *
 * `defaultFilters` is omitted rather than sent empty: the DTO is
 * `@IsOptional()` and `validateDashboardFilters` rejects any key outside its
 * eleven-name allowlist with `422 CRM_WIDGET_FILTER_INVALID`.
 */
export function buildCreateDashboardRequest(input: {
  name: string;
  description: string;
  templateKey: DashboardTemplateKey | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { name: requiredName(input.name) };
  const description = input.description.trim();
  if (description.length > DASHBOARD_DESCRIPTION_MAX_LENGTH) {
    throw new Error("CRM_DASHBOARD_DESCRIPTION_TOO_LONG");
  }
  if (description.length > 0) body.description = description;
  if (input.templateKey) body.templateKey = input.templateKey;
  return body;
}

/**
 * `PATCH /dashboards/:id` body — `UpdateDashboardDto`.
 *
 * `revision` is required; a stale one is `409 CRM_DASHBOARD_REVISION_CONFLICT`.
 * `description` is sent even when empty — that is a legitimate clear, and the
 * DTO carries no `@IsNotEmpty`.
 */
export function buildUpdateDashboardRequest(input: {
  revision: number;
  name: string;
  description: string;
}): Record<string, unknown> {
  const description = input.description.trim();
  if (description.length > DASHBOARD_DESCRIPTION_MAX_LENGTH) {
    throw new Error("CRM_DASHBOARD_DESCRIPTION_TOO_LONG");
  }
  return { revision: input.revision, name: requiredName(input.name), description };
}

/** `POST /:id/duplicate` and `POST|PUT /from-template/:key` — `name` optional. */
export function buildNamedRequest(name: string): Record<string, unknown> {
  const trimmed = name.trim();
  return trimmed.length > 0 ? { name: requiredName(trimmed) } : {};
}

/** `POST /:id/placements` — `CreatePlacementDto`. Position is server-chosen when omitted. */
export function buildAddPlacementRequest(widgetId: string): Record<string, unknown> {
  if (!isUUIDv7(widgetId)) throw new Error("CRM_WIDGET_NOT_FOUND");
  return { widgetId };
}

/**
 * `PUT /:id/layout` — `UpdateDashboardLayoutDto`.
 *
 * The **complete visible placement set** is required: a subset, a duplicate or
 * an unknown id is `409 CRM_DASHBOARD_LAYOUT_STALE`. Overlap is
 * `409 CRM_DASHBOARD_LAYOUT_OVERLAP`, and it is checked against the *hidden*
 * placements too, which this screen cannot see or move.
 */
export function buildLayoutRequest(
  revision: number,
  placements: ReadonlyArray<{ id: string; x: number; y: number; width: number; height: number }>,
): Record<string, unknown> {
  if (placements.length > DASHBOARD_WIDGET_LIMIT) {
    throw new Error("CRM_DASHBOARD_WIDGET_LIMIT");
  }
  return {
    revision,
    placements: placements.map((placement) => ({
      placementId: placement.id,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    })),
  };
}

export function parseDashboardsResponse(payload: unknown): DashboardSummary[] {
  if (!boundedArray(payload, MAX_DASHBOARDS_IN_RESPONSE)) invalidResponse("dashboards");
  return payload.map(parseDashboardSummary);
}

export function parseNavigationResponse(payload: unknown): DashboardNavigation {
  const source = record(payload);
  if (!source || !boundedArray(source.items, MAX_DASHBOARDS_IN_RESPONSE)) {
    invalidResponse("dashboard navigation");
  }
  return {
    items: source.items.map(parseNavigationItem),
    activeDashboardId: isUUIDv7(source.activeDashboardId) ? source.activeDashboardId : null,
  };
}

function parseNavigationItem(payload: unknown): DashboardNavigationItem {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isUUIDv7(source.ownerUserId) ||
    !nonEmptyString(source.name) ||
    !finiteNumber(source.revision) ||
    !timestamp(source.updatedAt)
  ) {
    invalidResponse("dashboard navigation");
  }
  return {
    id: source.id,
    name: source.name,
    isDefault: source.isDefault === true,
    isFavorite: source.isFavorite === true,
    isShared: source.isShared === true,
    accessLevel: isAccessLevel(source.accessLevel) ? source.accessLevel : "VIEW",
    ownerUserId: source.ownerUserId,
    ownerName: optionalString(source.ownerName),
    revision: source.revision,
    updatedAt: source.updatedAt,
  };
}

export function parseDashboardDetailResponse(payload: unknown): DashboardDetail {
  const source = record(payload);
  if (
    !source ||
    !boundedArray(source.placements, DASHBOARD_WIDGET_LIMIT) ||
    !boundedArray(source.unavailablePlacements, DASHBOARD_WIDGET_LIMIT)
  ) {
    invalidResponse("dashboard");
  }
  const duplication = record(source.duplication);
  return {
    ...parseDashboardSummary(source),
    placements: source.placements.map(parsePlacement),
    unavailablePlacements: source.unavailablePlacements.flatMap(parseUnavailablePlacement),
    duplication: duplication
      ? {
          omittedUnavailableWidgetCount: finiteNumber(duplication.omittedUnavailableWidgetCount)
            ? duplication.omittedUnavailableWidgetCount
            : null,
          warnings: Array.isArray(duplication.warnings)
            ? duplication.warnings.filter((warning): warning is string => typeof warning === "string")
            : [],
        }
      : null,
  };
}

/** `DELETE /:id/placements/:placementId` answers **200** with the new revision. */
export function parseDashboardRevisionResponse(payload: unknown): number {
  const source = record(payload);
  if (!source || !finiteNumber(source.dashboardRevision)) {
    invalidResponse("dashboard revision");
  }
  return source.dashboardRevision;
}

function parseDashboardSummary(payload: unknown): DashboardSummary {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isUUIDv7(source.ownerUserId) ||
    !nonEmptyString(source.name) ||
    !finiteNumber(source.revision) ||
    !timestamp(source.updatedAt)
  ) {
    invalidResponse("dashboard");
  }
  return {
    id: source.id,
    ownerUserId: source.ownerUserId,
    ownerName: optionalString(source.ownerName),
    name: source.name,
    description: optionalString(source.description),
    defaultFilters: record(source.defaultFilters) ?? {},
    sourceTemplateKey: optionalString(source.sourceTemplateKey),
    revision: source.revision,
    createdAt: timestamp(source.createdAt) ? source.createdAt : source.updatedAt,
    updatedAt: source.updatedAt,
    accessLevel: isAccessLevel(source.accessLevel) ? source.accessLevel : "VIEW",
    isShared: source.isShared === true,
    isDefault: source.isDefault === true,
    isFavorite: source.isFavorite === true,
    lastOpenedAt: timestamp(source.lastOpenedAt) ? source.lastOpenedAt : null,
  };
}

function parsePlacement(payload: unknown): DashboardPlacement {
  const source = record(payload);
  const box = parseBox(payload);
  if (
    !source ||
    !box ||
    !isUUIDv7(source.id) ||
    !isUUIDv7(source.dashboardId) ||
    !isUUIDv7(source.widgetId)
  ) {
    invalidResponse("dashboard placement");
  }
  return {
    id: source.id,
    dashboardId: source.dashboardId,
    widgetId: source.widgetId,
    ...box,
    sortOrder: finiteNumber(source.sortOrder) ? source.sortOrder : 0,
    widget: parseWidgetDefinition(source.widget),
  };
}

function parseUnavailablePlacement(payload: unknown): UnavailablePlacement[] {
  const source = record(payload);
  const box = parseBox(payload);
  if (!source || !box || !isUUIDv7(source.id) || !isUnavailableReason(source.reason)) return [];
  return [{
    id: source.id,
    ...box,
    sortOrder: finiteNumber(source.sortOrder) ? source.sortOrder : 0,
    reason: source.reason,
  }];
}

function isUnavailableReason(value: unknown): value is UnavailablePlacementReason {
  return UNAVAILABLE_PLACEMENT_REASONS.includes(value as UnavailablePlacementReason);
}

function requiredName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > DASHBOARD_NAME_MAX_LENGTH) {
    throw new Error("CRM_DASHBOARD_NAME_INVALID");
  }
  return trimmed;
}
