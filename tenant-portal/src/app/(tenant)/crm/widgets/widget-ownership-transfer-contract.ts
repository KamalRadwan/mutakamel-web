import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, nonEmptyString, record, timestamp } from "../dashboards/dashboard-parse";
import { WIDGETS_PATH, widgetPath } from "../dashboards/widget-contract";
import { isWidgetRevision } from "../dashboards/widget-library-contract";

export const WIDGET_TRANSFER_REASON_LIMIT = 500;
export const WIDGET_TRANSFER_LIST_PATH = `${WIDGETS_PATH}/ownership-transfers`;
const PAGE_LIMIT = 50;
const IMPACT_LIMIT = 1000;

export function widgetTransferPath(id: string, action?: "targets" | "impact") {
  return `${widgetPath(id)}/ownership-transfer${action ? `/${action}` : ""}`;
}

export function widgetTransferSearchPath(path: string, search: string, cursor?: string) {
  const query = new URLSearchParams();
  const term = Array.from(search.trim()).slice(0, 120).join("");
  if (term) query.set("search", term);
  if (cursor) query.set("cursor", cursor);
  return query.size ? `${path}?${query}` : path;
}

export function parseTransferWidget(value: unknown, expectedId?: string) {
  const row = record(value);
  if (!row || !isUUIDv7(row.id) || expectedId && row.id !== expectedId || !isUUIDv7(row.ownerUserId)
    || row.ownerName !== null && !nonEmptyString(row.ownerName) || !nonEmptyString(row.name)
    || !isWidgetRevision(row.widgetRevision) || !isWidgetRevision(row.governanceRevision)
    || row.activeVersionNumber !== null && !isWidgetRevision(row.activeVersionNumber)
    || row.draftRevision !== null && !isWidgetRevision(row.draftRevision)
    || typeof row.archived !== "boolean") invalidResponse("widget transfer metadata");
  return { id: row.id, name: row.name, ownerUserId: row.ownerUserId, ownerName: row.ownerName,
    widgetRevision: row.widgetRevision, governanceRevision: row.governanceRevision,
    activeVersionNumber: row.activeVersionNumber, draftRevision: row.draftRevision, archived: row.archived };
}

function parseTransferTarget(value: unknown) {
  const row = record(value);
  if (!row || !isUUIDv7(row.id) || !nonEmptyString(row.name)) invalidResponse("widget transfer target");
  return { id: row.id, name: row.name };
}

function parsePage<T extends { id: string }>(value: unknown, parseItem: (item: unknown) => T, cursor?: string) {
  const page = record(value);
  if (!page || !boundedArray(page.items, PAGE_LIMIT) || page.nextCursor !== null && !isUUIDv7(page.nextCursor)) {
    invalidResponse("widget transfer page");
  }
  const items = page.items.map(parseItem);
  let before = cursor;
  for (const row of items) {
    if (before && row.id >= before) invalidResponse("widget transfer page order");
    before = row.id;
  }
  if (page.nextCursor !== null && page.nextCursor !== items.at(-1)?.id) invalidResponse("widget transfer next cursor");
  return { items, nextCursor: page.nextCursor };
}

export function parseTransferWidgetPage(value: unknown, cursor?: string) {
  return parsePage(value, parseTransferWidget, cursor);
}

export function parseTransferTargetPage(value: unknown, ownerId: string, cursor?: string) {
  return parsePage(value, (item) => {
    const target = parseTransferTarget(item);
    if (target.id === ownerId) invalidResponse("widget transfer current owner as target");
    return target;
  }, cursor);
}

export type TransferWidget = ReturnType<typeof parseTransferWidget>;
export type TransferTarget = ReturnType<typeof parseTransferTarget>;

export function transferPrecondition(widget: TransferWidget, target: TransferTarget) {
  return { targetUserId: target.id, expectedWidgetRevision: widget.widgetRevision, expectedGovernanceRevision: widget.governanceRevision };
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > IMPACT_LIMIT) invalidResponse("widget transfer count");
  return value;
}

function impactCounts(row: Record<string, unknown>) {
  const counts = { affectedPlacementCount: count(row.affectedPlacementCount), retainedShareCount: count(row.retainedShareCount),
    dashboardOwnerAccessLostCount: count(row.dashboardOwnerAccessLostCount), dashboardOwnerAccessRestoredCount: count(row.dashboardOwnerAccessRestoredCount),
    dashboardReadersMayNeedShareCount: count(row.dashboardReadersMayNeedShareCount) };
  if (counts.dashboardOwnerAccessLostCount + counts.dashboardOwnerAccessRestoredCount + counts.dashboardReadersMayNeedShareCount
    > counts.affectedPlacementCount) invalidResponse("widget transfer aggregate impact");
  return counts;
}

export function parseTransferImpact(value: unknown, current: TransferWidget, selected: TransferTarget) {
  const row = record(value);
  if (!row || !isUUIDv7(row.impactId) || !timestamp(row.expiresAt)) invalidResponse("widget transfer proof");
  const widget = parseTransferWidget(row.widget, current.id);
  const target = parseTransferTarget(row.target);
  if (widget.ownerUserId !== current.ownerUserId || widget.widgetRevision !== current.widgetRevision
    || widget.governanceRevision !== current.governanceRevision || widget.activeVersionNumber !== current.activeVersionNumber
    || widget.archived !== current.archived || target.id !== selected.id || target.id === widget.ownerUserId) invalidResponse("widget transfer impact scope");
  return { impactId: row.impactId, expiresAt: row.expiresAt, widget, target, ...impactCounts(row) };
}

export type TransferImpact = ReturnType<typeof parseTransferImpact>;

export function verifyTransferReceipt(value: unknown, impact: TransferImpact) {
  const row = record(value);
  const { widget, target } = impact;
  if (!row || row.widgetId !== widget.id || row.ownerUserId !== target.id || row.previousOwnerUserId !== widget.ownerUserId
    || row.widgetRevision !== widget.widgetRevision + 1 || row.governanceRevision !== widget.governanceRevision + 1) invalidResponse("widget transfer receipt");
  const counts = impactCounts(row);
  if (Object.entries(counts).some(([key, actual]) => impact[key as keyof typeof counts] !== actual)) invalidResponse("widget transfer receipt impact");
}
