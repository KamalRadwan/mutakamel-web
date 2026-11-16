import { isUUIDv7 } from "@/lib/uuid";
import { DASHBOARDS_PATH, DASHBOARD_DESCRIPTION_MAX_LENGTH, DASHBOARD_NAME_MAX_LENGTH } from "./dashboard-contract";
import { boundedArray, finiteNumber, invalidResponse, record } from "./dashboard-parse";
import { DASHBOARD_WIDGET_LIMIT } from "./widget-contract";

const BLUEPRINTS_PATH = `${DASHBOARDS_PATH}/blueprints`;
const KEY_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
const MAX_REVISION = 2_147_483_647;

export type DashboardBlueprintAudience = "USER" | "TEAM_LEADER" | "CRM_ADMIN";
type AdoptionState = { state: "AVAILABLE" | "REMOVED" | "ADOPTED_ELSEWHERE" }
  | { state: "ADOPTED"; dashboardId: string; definitionRevision: number };

export interface DashboardBlueprint {
  key: string;
  definitionRevision: number;
  audience: DashboardBlueprintAudience;
  name: string;
  description: string;
  widgetCount: number;
  branchSelectionRequired: boolean;
  targets: { widgetName: string; target: number }[];
  adoption: AdoptionState;
}

function positiveInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

function label(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function parseAdoption(value: unknown): AdoptionState {
  const data = record(value);
  if (data?.state === "ADOPTED" && typeof data.dashboardId === "string" && isUUIDv7(data.dashboardId)
    && positiveInteger(data.definitionRevision, MAX_REVISION)) {
    return { state: data.state, dashboardId: data.dashboardId, definitionRevision: data.definitionRevision };
  }
  if ((data?.state === "AVAILABLE" || data?.state === "REMOVED" || data?.state === "ADOPTED_ELSEWHERE")
    && data.dashboardId === undefined && data.definitionRevision === undefined) {
    return { state: data.state };
  }
  return invalidResponse("dashboard blueprint adoption state");
}

export function parseDashboardBlueprintsResponse(value: unknown): DashboardBlueprint[] {
  const data = record(value);
  if (!boundedArray(data?.items, 256)) return invalidResponse("dashboard blueprint catalogue");
  const seen = new Set<string>();
  return data.items.map(value => {
    const item = record(value);
    if (!item || typeof item.key !== "string" || !KEY_PATTERN.test(item.key) || seen.has(item.key)
      || !positiveInteger(item.definitionRevision, MAX_REVISION)
      || (item.audience !== "USER" && item.audience !== "TEAM_LEADER" && item.audience !== "CRM_ADMIN")
      || !label(item.name, DASHBOARD_NAME_MAX_LENGTH) || typeof item.description !== "string"
      || item.description.length > DASHBOARD_DESCRIPTION_MAX_LENGTH || !positiveInteger(item.widgetCount, DASHBOARD_WIDGET_LIMIT)
      || typeof item.branchSelectionRequired !== "boolean"
      || !boundedArray(item.targets, item.widgetCount)) return invalidResponse("dashboard blueprint");
    const targets = item.targets.map(value => {
      const target = record(value);
      if (!target || !label(target.widgetName, DASHBOARD_NAME_MAX_LENGTH) || !finiteNumber(target.target) || target.target <= 0 || target.target > 1e12) {
        return invalidResponse("dashboard blueprint target");
      }
      return { widgetName: target.widgetName, target: target.target };
    });
    seen.add(item.key);
    return { key: item.key, definitionRevision: item.definitionRevision, audience: item.audience, name: item.name,
      description: item.description, widgetCount: item.widgetCount, branchSelectionRequired: item.branchSelectionRequired,
      targets, adoption: parseAdoption(item.adoption) };
  });
}

export function dashboardBlueprintsPath(branchId: string | null) {
  if (branchId === null) return BLUEPRINTS_PATH;
  if (!isUUIDv7(branchId)) throw new Error("Invalid dashboard blueprint branch.");
  return `${BLUEPRINTS_PATH}?${new URLSearchParams({ branchId })}`;
}

export function buildDashboardBlueprintAdoption(blueprint: DashboardBlueprint, branchId: string | null, name: string, confirmed: boolean) {
  if (!KEY_PATTERN.test(blueprint.key) || !positiveInteger(blueprint.definitionRevision, MAX_REVISION)
    || blueprint.adoption.state !== "AVAILABLE" || (branchId !== null && !isUUIDv7(branchId))) {
    throw new Error("CRM_DASHBOARD_BLUEPRINT_NOT_FOUND");
  }
  if (blueprint.branchSelectionRequired && branchId === null) throw new Error("CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED");
  if (blueprint.targets.length && !confirmed) throw new Error("CRM_DASHBOARD_BLUEPRINT_TARGET_CONFIRMATION_REQUIRED");
  const normalizedName = name.trim();
  if (normalizedName.length > DASHBOARD_NAME_MAX_LENGTH) throw new Error("Invalid dashboard blueprint name.");
  return {
    path: `${BLUEPRINTS_PATH}/${blueprint.key}/adoption`,
    body: { definitionRevision: blueprint.definitionRevision, ...(branchId ? { branchId } : {}),
      ...(blueprint.targets.length ? { confirmTargets: true } : {}), ...(normalizedName ? { name: normalizedName } : {}) },
  };
}

export function parseDashboardBlueprintReceipt(value: unknown, revision: number) {
  const data = record(value);
  if (!data || typeof data.dashboardId !== "string" || !isUUIDv7(data.dashboardId)
    || !positiveInteger(revision, MAX_REVISION) || data.definitionRevision !== revision || typeof data.created !== "boolean") {
    return invalidResponse("dashboard blueprint adoption receipt");
  }
  return { dashboardId: data.dashboardId, created: data.created };
}
