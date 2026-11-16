import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record, timestamp } from "../dashboards/dashboard-parse";
import { widgetPath } from "../dashboards/widget-contract";
import { isWidgetRevision } from "../dashboards/widget-library-contract";
import { sameWidgetValue } from "./hooks/widget-requests";
import { parseWidgetDraftState } from "./widget-draft-contract";
import { parseWidgetHistoryEntry } from "./widget-history-contract";

const SECTIONS = ["NAME", "VISUALIZATION", "SCHEMA", "QUERY", "DISPLAY"] as const;
type VersionSection = typeof SECTIONS[number];
type RestoreState = "AVAILABLE" | "DRAFT_EXISTS" | "PERMISSION_REQUIRED";
export type VersionPair = { leftVersionNumber: number; rightVersionNumber: number };

export function widgetVersionCommandPath(widgetId: string, action: "compare" | "restore-draft") {
  return `${widgetPath(widgetId)}/versions/${action}`;
}

function parseVersion(value: unknown, expectedVersion: number) {
  const entry = parseWidgetHistoryEntry(value);
  const row = record(value);
  const querySpec = record(row?.querySpec);
  const displaySpec = record(row?.displaySpec);
  if (!row || !querySpec || !displaySpec || entry.versionNumber !== expectedVersion || !isWidgetRevision(row.schemaVersion)
    || typeof row.visualizationType !== "string" || !row.visualizationType.trim() || Array.from(row.visualizationType).length > 40) {
    invalidResponse("widget publication snapshot");
  }
  return { ...entry, schemaVersion: row.schemaVersion, visualizationType: row.visualizationType, querySpec, displaySpec };
}

function isSection(value: unknown): value is VersionSection {
  return (SECTIONS as readonly unknown[]).includes(value);
}

export function parseWidgetVersionComparison(value: unknown, widgetId: string, pair: VersionPair) {
  const row = record(value);
  if (!row || row.widgetId !== widgetId || !isWidgetRevision(row.widgetRevision) || !isWidgetRevision(row.governanceRevision)
    || !isWidgetRevision(row.activeVersionNumber) || typeof row.archived !== "boolean"
    || pair.leftVersionNumber === pair.rightVersionNumber || Math.max(pair.leftVersionNumber, pair.rightVersionNumber) > row.activeVersionNumber
    || !boundedArray(row.changedSections, SECTIONS.length) || !row.changedSections.every(isSection)
    || new Set(row.changedSections).size !== row.changedSections.length
    || (row.restoreState !== "AVAILABLE" && row.restoreState !== "DRAFT_EXISTS" && row.restoreState !== "PERMISSION_REQUIRED")) {
    invalidResponse("widget version comparison");
  }
  const left = parseVersion(row.left, pair.leftVersionNumber);
  const right = parseVersion(row.right, pair.rightVersionNumber);
  const restoreState: RestoreState = row.restoreState;
  const proof = record(row.proof);
  const sections = row.changedSections;
  if (sections.includes("NAME") !== (left.name !== right.name)
    || sections.includes("VISUALIZATION") !== (left.visualizationType !== right.visualizationType)
    || sections.includes("SCHEMA") !== (left.schemaVersion !== right.schemaVersion)
    || (!sections.includes("QUERY") && !sameWidgetValue(left.querySpec, right.querySpec))
    || (!sections.includes("DISPLAY") && !sameWidgetValue(left.displaySpec, right.displaySpec))) invalidResponse("widget comparison differences");
  if (restoreState === "AVAILABLE") {
    if (!proof || !isUUIDv7(proof.impactId) || !timestamp(proof.expiresAt)) invalidResponse("widget restore proof");
  } else if (row.proof !== null) invalidResponse("widget restore state");
  return { widgetId, widgetRevision: row.widgetRevision, governanceRevision: row.governanceRevision,
    activeVersionNumber: row.activeVersionNumber, archived: row.archived, left, right, sections, restoreState,
    proof: proof && isUUIDv7(proof.impactId) && timestamp(proof.expiresAt) ? { impactId: proof.impactId, expiresAt: proof.expiresAt } : null };
}

export type WidgetVersionComparison = ReturnType<typeof parseWidgetVersionComparison>;
export type WidgetVersionSnapshot = ReturnType<typeof parseVersion>;

export function widgetVersionRestoreBody(comparison: WidgetVersionComparison, source: number) {
  if (!comparison.proof || (source !== comparison.left.versionNumber && source !== comparison.right.versionNumber)) {
    invalidResponse("widget restore command");
  }
  return { leftVersionNumber: comparison.left.versionNumber, rightVersionNumber: comparison.right.versionNumber, sourceVersionNumber: source,
    expectedWidgetRevision: comparison.widgetRevision, expectedGovernanceRevision: comparison.governanceRevision,
    impactId: comparison.proof.impactId, acknowledged: true as const };
}

export function verifyWidgetVersionRestore(value: unknown, comparison: WidgetVersionComparison, source: number, actorId?: string) {
  if (source !== comparison.left.versionNumber && source !== comparison.right.versionNumber) invalidResponse("widget restore source");
  const state = parseWidgetDraftState(value);
  const selected = source === comparison.left.versionNumber ? comparison.left : comparison.right;
  const draft = state.draft;
  if (!draft || state.widgetId !== comparison.widgetId || state.widgetRevision !== comparison.widgetRevision
    || state.governanceRevision !== comparison.governanceRevision || state.activeVersionNumber !== comparison.activeVersionNumber
    || draft.baseVersionNumber !== comparison.activeVersionNumber || draft.revision !== 1
    || draft.updatedByUserId !== actorId || record(value)?.restoredFromVersionNumber !== selected.versionNumber
    || draft.name !== selected.name || (draft.unsupportedVisualization ?? draft.visualizationType) !== selected.visualizationType
    || draft.schemaVersion !== selected.schemaVersion || !sameWidgetValue(draft.querySpec, selected.querySpec)
    || !sameWidgetValue(draft.displaySpec, selected.displaySpec)) invalidResponse("widget restore receipt");
  return state;
}
