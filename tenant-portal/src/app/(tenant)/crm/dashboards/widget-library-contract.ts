import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record, timestamp } from "./dashboard-parse";
import { parseDefinitionPage } from "./definition-pagination";
import { CRM_WIDGET_SOURCE_RESOURCES, WIDGETS_PATH, isAccessLevel, isVisualization, type WidgetDefinition, type WidgetSourceResource } from "./widget-contract";
import { parseWidgetDefinition, parseUsage } from "./widget-response";

type WidgetHead = Pick<WidgetDefinition, "id" | "ownerUserId" | "ownerName" | "name" | "revision" | "createdAt" | "updatedAt" | "accessLevel" | "isShared">;
type Publication = Pick<WidgetDefinition, "visualizationType" | "querySpec" | "displaySpec" | "schemaVersion">;

export type WidgetLibraryItem = WidgetHead & {
  governanceRevision: number;
  hasDraft: boolean | null;
  draftRevision: number | null;
  sourceResources?: WidgetSourceResource[];
} & (
  | (Publication & { status: "PUBLISHED" | "ARCHIVED"; versionNumber: number })
  | { status: "DRAFT" | "ARCHIVED"; versionNumber: null; visualizationType: WidgetDefinition["visualizationType"] | null; querySpec: null; displaySpec: null; schemaVersion: null }
);

// WidgetListQueryDto in crm-app.
export const WIDGET_LIBRARY_SEARCH_LIMIT = 120;
export const WIDGET_LIBRARY_ACCESS = ["OWNED", "SHARED", "TEAM"] as const;
export const WIDGET_LIBRARY_STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;
export const WIDGET_LIBRARY_SOURCES = [...CRM_WIDGET_SOURCE_RESOURCES, "unclassified"] as const;
export type WidgetLibraryFilters = {
  search: string;
  access: (typeof WIDGET_LIBRARY_ACCESS)[number] | null;
  status: (typeof WIDGET_LIBRARY_STATUSES)[number] | null;
  source: (typeof WIDGET_LIBRARY_SOURCES)[number] | null;
  ownerUserId: string | null;
};

export function widgetLibraryListPath(filters: WidgetLibraryFilters, cursor?: string): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.access) params.set("access", filters.access);
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.ownerUserId) params.set("ownerUserId", filters.ownerUserId);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `${WIDGETS_PATH}?${query}` : WIDGETS_PATH;
}

export const WIDGET_OWNER_OPTIONS_PATH = "/api/tenant/crm/v1/widgets/owner-options";
export function widgetOwnerOptionsPath(access: WidgetLibraryFilters["access"], search: string, cursor?: string): string {
  const params = new URLSearchParams();
  if (access) params.set("access", access);
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `${WIDGET_OWNER_OPTIONS_PATH}?${query}` : WIDGET_OWNER_OPTIONS_PATH;
}

export function parseWidgetOwnerOptions(value: unknown) {
  const page = parseDefinitionPage(value, item => {
    const row = record(item);
    if (!row || !isUUIDv7(row.id) || (row.name !== null && (typeof row.name !== "string" || !row.name.trim()))) {
      invalidResponse("widget owner option");
    }
    return { id: row.id, name: row.name };
  });
  if (new Set(page.items.map(row => row.id)).size !== page.items.length
    || (page.nextCursor && page.items.at(-1)?.id !== page.nextCursor)) invalidResponse("widget owner page");
  return page;
}

export function isWidgetRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function parseWidgetLibraryItem(value: unknown): WidgetLibraryItem {
  const row = record(value);
  if (!row || !isUUIDv7(row.id) || !isUUIDv7(row.ownerUserId)
    || (row.ownerName !== null && typeof row.ownerName !== "string")
    || typeof row.name !== "string" || !timestamp(row.createdAt) || !timestamp(row.updatedAt)
    || !isWidgetRevision(row.revision) || !isWidgetRevision(row.governanceRevision)
    || !isAccessLevel(row.accessLevel) || typeof row.isShared !== "boolean"
    || (row.status !== "DRAFT" && row.status !== "PUBLISHED" && row.status !== "ARCHIVED")
    || (row.draftRevision !== null && !isWidgetRevision(row.draftRevision))) invalidResponse("widget library");
  const canSeeDraft = row.accessLevel !== "VIEW";
  const hasDraft = canSeeDraft ? row.draftRevision !== null : null;
  if (row.hasDraft !== hasDraft
    || (!canSeeDraft && (row.draftRevision !== null || row.status !== "PUBLISHED"))) invalidResponse("widget library access");
  const resources = row.sourceResources;
  if (resources !== undefined && (!boundedArray(resources, CRM_WIDGET_SOURCE_RESOURCES.length)
    || !resources.every((resource): resource is WidgetSourceResource => CRM_WIDGET_SOURCE_RESOURCES.some(key => key === resource))
    || new Set(resources).size !== resources.length)) invalidResponse("widget library sources");
  const head = {
    id: row.id, ownerUserId: row.ownerUserId, ownerName: row.ownerName, name: row.name,
    revision: row.revision, governanceRevision: row.governanceRevision, createdAt: row.createdAt,
    updatedAt: row.updatedAt, accessLevel: row.accessLevel, isShared: row.isShared,
    hasDraft, draftRevision: row.draftRevision,
    ...(resources === undefined ? {} : { sourceResources: resources }),
  };
  if (row.versionNumber === null) {
    if (row.status === "PUBLISHED" || row.querySpec !== null || row.displaySpec !== null || row.schemaVersion !== null
      || (row.visualizationType !== null && !isVisualization(row.visualizationType))) invalidResponse("widget library draft");
    return { ...head, status: row.status, versionNumber: null, visualizationType: row.visualizationType, querySpec: null, displaySpec: null, schemaVersion: null };
  }
  if (row.status === "DRAFT" || !isWidgetRevision(row.versionNumber) || !isWidgetRevision(row.schemaVersion)
    || !record(row.displaySpec)) invalidResponse("widget library publication");
  return { ...parseWidgetDefinition(row), ...head, status: row.status, versionNumber: row.versionNumber };
}

export function parseWidgetLibraryResponse(value: unknown) {
  return parseDefinitionPage(value, parseWidgetLibraryItem);
}

export function parseWidgetLibraryDetail(value: unknown) {
  const row = record(value);
  if (!row) invalidResponse("widget library detail");
  const item = parseWidgetLibraryItem(row);
  const usage = row.usage === undefined ? null : parseUsage(row.usage);
  if (item.accessLevel !== "OWNER" && usage && (usage.hiddenPlacementCount !== 0 || usage.activeShareCount !== null)) {
    invalidResponse("widget usage access");
  }
  return { ...item, usage };
}

export type WidgetLibraryDetail = ReturnType<typeof parseWidgetLibraryDetail>;

export function isPlaceableWidget(widget: WidgetLibraryItem): widget is Extract<WidgetLibraryItem, { versionNumber: number }> {
  return widget.status === "PUBLISHED";
}
