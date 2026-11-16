import { isUUIDv7 } from "@/lib/uuid";
import { invalidResponse, record, timestamp } from "../dashboards/dashboard-parse";
import { isVisualization, normalizeWidgetDisplaySpec, widgetPath, type CrmVisualization } from "../dashboards/widget-contract";
import { isWidgetRevision } from "../dashboards/widget-library-contract";
import type { WidgetAuthoringInput } from "./widget-form";

export interface WidgetDraftContent {
  name: string;
  visualizationType: CrmVisualization | null;
  querySpec: Record<string, unknown>;
  displaySpec: Record<string, unknown>;
}

export interface WidgetDraft extends WidgetDraftContent {
  unsupportedVisualization?: string;
  draftId: string;
  revision: number;
  baseVersionNumber: number | null;
  schemaVersion: number;
  updatedAt: string;
  updatedByUserId: string;
}

export interface WidgetDraftState {
  widgetId: string;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number | null;
  draft: WidgetDraft | null;
}

export function widgetDraftPath(id: string) {
  return `${widgetPath(id)}/draft`;
}

function parseDraft(value: unknown): WidgetDraft {
  const row = record(value);
  if (!row || !isUUIDv7(row.draftId) || !isWidgetRevision(row.revision)
    || (row.baseVersionNumber !== null && !isWidgetRevision(row.baseVersionNumber))
    || typeof row.name !== "string" || (row.visualizationType !== null && (typeof row.visualizationType !== "string"
      || !row.visualizationType.trim() || Array.from(row.visualizationType).length > 40))
    || !isWidgetRevision(row.schemaVersion) || !timestamp(row.updatedAt) || !isUUIDv7(row.updatedByUserId)) invalidResponse("widget draft");
  const querySpec = record(row.querySpec);
  const displaySpec = record(row.displaySpec);
  if (!querySpec || !displaySpec) invalidResponse("widget draft content");
  const visualizationType = isVisualization(row.visualizationType) ? row.visualizationType : null;
  return { draftId: row.draftId, revision: row.revision, baseVersionNumber: row.baseVersionNumber,
    name: row.name, visualizationType, querySpec, displaySpec,
    ...(typeof row.visualizationType === "string" && !visualizationType ? { unsupportedVisualization: row.visualizationType } : {}),
    schemaVersion: row.schemaVersion, updatedAt: row.updatedAt, updatedByUserId: row.updatedByUserId };
}

export function parseWidgetDraftState(value: unknown): WidgetDraftState {
  const row = record(value);
  if (!row || !isUUIDv7(row.widgetId) || !isWidgetRevision(row.widgetRevision)
    || !isWidgetRevision(row.governanceRevision)
    || (row.activeVersionNumber !== null && !isWidgetRevision(row.activeVersionNumber))) invalidResponse("widget draft state");
  return { widgetId: row.widgetId, widgetRevision: row.widgetRevision, governanceRevision: row.governanceRevision,
    activeVersionNumber: row.activeVersionNumber, draft: row.draft === null ? null : parseDraft(row.draft) };
}

export function widgetDraftContent(input: WidgetAuthoringInput): WidgetDraftContent {
  return { name: input.name.trim(), visualizationType: input.visualizationType,
    querySpec: { ...input.querySpec }, displaySpec: normalizeWidgetDisplaySpec(input.displaySpec ?? {}) };
}

export function widgetDraftPrecondition(state: WidgetDraftState) {
  return { expectedWidgetRevision: state.widgetRevision, expectedDraftId: state.draft?.draftId ?? null,
    expectedDraftRevision: state.draft?.revision ?? 0 };
}
