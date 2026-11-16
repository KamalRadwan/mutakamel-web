import { dashboardPath } from "./dashboard-contract";
import { invalidResponse, record } from "./dashboard-parse";
import { isWidgetRevision } from "./widget-library-contract";
import { encodeId, isVisualization, parseBox } from "./widget-contract";

export type PlacementVersionChoice =
  | { versionPolicy: "FOLLOW_ACTIVE"; pinnedVersionNumber: null }
  | { versionPolicy: "PINNED"; pinnedVersionNumber: number };

type PlacementVersionTarget = { dashboardId: string; placementId: string; widgetId: string };
type Box = NonNullable<ReturnType<typeof parseBox>>;
type Selection = PlacementVersionChoice & { selectedVersionNumber: number; placement: Box };
type Binding = Selection & PlacementVersionTarget & {
  dashboardRevision: number;
  widgetRevision: number;
  governanceRevision: number;
  activeVersionNumber: number;
};

export type PlacementVersionBinding = Binding;
export type PlacementVersionImpact = ReturnType<typeof parsePlacementVersionImpact>;

export function placementVersionPath({ dashboardId, placementId }: PlacementVersionTarget, impact = false) {
  return `${dashboardPath(dashboardId)}/placements/${encodeId(placementId)}/version-policy${impact ? "/impact" : ""}`;
}

function sameBox(a: Box, b: Box) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function sameSelection(a: Selection, b: Selection) {
  return a.versionPolicy === b.versionPolicy && a.pinnedVersionNumber === b.pinnedVersionNumber
    && a.selectedVersionNumber === b.selectedVersionNumber && sameBox(a.placement, b.placement);
}

function parseSelection(source: Record<string, unknown>, active: number): Selection {
  const { versionPolicy, pinnedVersionNumber, selectedVersionNumber } = source;
  const placement = parseBox(source.placement);
  if (!placement || !Object.values(placement).every(Number.isSafeInteger)
    || placement.x < 0 || placement.y < 0 || placement.y > 2_147_483_647
    || placement.width < 1 || placement.x + placement.width > 12 || placement.height < 1 || placement.height > 24
    || !isWidgetRevision(selectedVersionNumber) || selectedVersionNumber > active) invalidResponse("placement version selection");
  if (versionPolicy === "FOLLOW_ACTIVE" && pinnedVersionNumber === null && selectedVersionNumber === active) {
    return { versionPolicy, pinnedVersionNumber, selectedVersionNumber, placement };
  }
  if (versionPolicy === "PINNED" && selectedVersionNumber === pinnedVersionNumber) {
    return { versionPolicy, pinnedVersionNumber: selectedVersionNumber, selectedVersionNumber, placement };
  }
  return invalidResponse("placement version policy");
}

export function parsePlacementVersionBinding(value: unknown, target: PlacementVersionTarget): Binding {
  const source = record(value);
  if (!source || source.dashboardId !== target.dashboardId || source.placementId !== target.placementId
    || source.widgetId !== target.widgetId || !isWidgetRevision(source.dashboardRevision)
    || !isWidgetRevision(source.widgetRevision) || !isWidgetRevision(source.governanceRevision)
    || !isWidgetRevision(source.activeVersionNumber)) invalidResponse("placement version binding");
  return { dashboardId: target.dashboardId, placementId: target.placementId, widgetId: target.widgetId,
    dashboardRevision: source.dashboardRevision, widgetRevision: source.widgetRevision,
    governanceRevision: source.governanceRevision, activeVersionNumber: source.activeVersionNumber,
    ...parseSelection(source, source.activeVersionNumber) };
}

export function placementVersionReviewBody(current: Binding, choice: PlacementVersionChoice) {
  return { versionPolicy: choice.versionPolicy, pinnedVersionNumber: choice.pinnedVersionNumber, expectedDashboardRevision: current.dashboardRevision,
    expectedWidgetRevision: current.widgetRevision, expectedGovernanceRevision: current.governanceRevision };
}

export function parsePlacementVersionImpact(value: unknown, current: Binding, choice: PlacementVersionChoice) {
  const source = record(value);
  const proposed = record(source?.proposed);
  const read = parsePlacementVersionBinding(source?.current, current);
  if (!proposed || read.dashboardRevision !== current.dashboardRevision || read.widgetRevision !== current.widgetRevision
    || read.governanceRevision !== current.governanceRevision || read.activeVersionNumber !== current.activeVersionNumber
    || !sameSelection(read, current) || !isVisualization(proposed.visualizationType)) invalidResponse("placement version impact");
  const selection = parseSelection(proposed, current.activeVersionNumber);
  const layoutChanged = !sameBox(selection.placement, current.placement);
  const changed = !sameSelection(selection, current);
  if (selection.versionPolicy !== choice.versionPolicy || selection.pinnedVersionNumber !== choice.pinnedVersionNumber
    || proposed.layoutChanged !== layoutChanged || proposed.changed !== changed) invalidResponse("placement version proposal");
  return { ...selection, visualizationType: proposed.visualizationType, layoutChanged, changed };
}

export function placementVersionConfirmBody(current: Binding, impact: PlacementVersionImpact) {
  return { ...placementVersionReviewBody(current, impact),
    expectedSelectedVersionNumber: impact.selectedVersionNumber, expectedPlacement: impact.placement };
}

export function verifyPlacementVersionReceipt(value: unknown, current: Binding, impact: PlacementVersionImpact) {
  const receipt = parsePlacementVersionBinding(value, current);
  if (record(value)?.changed !== impact.changed || receipt.dashboardRevision !== current.dashboardRevision + Number(impact.changed)
    || receipt.widgetRevision !== current.widgetRevision || receipt.governanceRevision !== current.governanceRevision
    || receipt.activeVersionNumber !== current.activeVersionNumber || !sameSelection(receipt, impact)) {
    invalidResponse("placement version receipt");
  }
  return receipt;
}
