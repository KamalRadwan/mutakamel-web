import { isUUIDv7 } from "@/lib/uuid";
import { parseDashboardOrganizationScope } from "../dashboard-organization-scope";
import { boundedArray, civilDateRange, invalidResponse, nonEmptyString, record, timestamp } from "../dashboard-parse";
import { DATE_PRESETS, type DashboardFilterSelection } from "../dashboard-run-contract";

export const LEAD_INTAKE_ALLOCATION_PATH = "/api/tenant/crm/v1/dashboards/lead-intake-allocation-report";

export type IntakeRequest = {
  selection: DashboardFilterSelection;
  comparisonOwnerIds?: string[];
  queuePeriod?: { dateFrom: string; dateTo: string };
  cursors: (string | null)[];
};

const bad = () => invalidResponse("lead intake allocation");

function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : bad();
}

function nullableText(value: unknown) {
  return value === null || typeof value === "string" ? value : bad();
}

function period(value: unknown) {
  const item = record(value);
  const range = civilDateRange(value);
  if (!item || !range || !DATE_PRESETS.some(preset => preset === item.preset) || !nonEmptyString(item.timeZone)) return bad();
  return { ...range, timeZone: item.timeZone, preset: item.preset };
}

function rep(value: unknown) {
  const item = record(value);
  if (!item || !isUUIDv7(item.ownerId)) return bad();
  return { ownerId: item.ownerId, name: nullableText(item.name) };
}

function repCounts(value: unknown) {
  const item = record(value);
  if (!item) return bad();
  const created = count(item.created), converted = count(item.converted), remaining = count(item.remaining);
  const invalidIntervals = count(item.invalidIntervals), missingConversionDates = count(item.missingConversionDates);
  if (created !== converted + remaining || invalidIntervals + missingConversionDates > remaining) return bad();
  return { created, converted, remaining, invalidIntervals, missingConversionDates };
}

function intakeData(value: unknown, request: IntakeRequest) {
  const item = record(value);
  if (!item || !boundedArray(item.ownerOptions, 53) || !boundedArray(item.comparison, 3)) return bad();
  const total = count(item.total), unassigned = count(item.unassigned), other = count(item.other);
  const ownerOptions = item.ownerOptions.map(rep);
  const options = new Map(ownerOptions.map(option => [option.ownerId, option.name]));
  const comparison = item.comparison.map(value => ({ ...rep(value), ...repCounts(value) }));
  const selectedIds = request.comparisonOwnerIds ?? ownerOptions.slice(0, 3).map(owner => owner.ownerId);
  const comparisonTotals = repCounts(item.comparisonTotals);
  if (options.size !== ownerOptions.length || comparison.length !== selectedIds.length
    || !comparison.every((owner, index) => owner.ownerId === selectedIds[index] && options.get(owner.ownerId) === owner.name)
    || total !== unassigned + other + comparisonTotals.created) return bad();
  for (const key of ["created", "converted", "remaining", "invalidIntervals", "missingConversionDates"] as const) {
    if (comparison.reduce((sum, row) => sum + row[key], 0) !== comparisonTotals[key]) return bad();
  }
  return { total, unassigned, other, ownerOptions, comparison, comparisonTotals };
}

export function parseLeadIntakeAllocation(value: unknown, request: IntakeRequest) {
  const source = record(value);
  if (source?.reportKey !== "LEAD_INTAKE_ALLOCATION" || !timestamp(source.asOf)) return bad();
  const scope = parseDashboardOrganizationScope(source.scope, request.selection, bad);
  const range = period(source.range);
  if (range.preset !== (request.selection.datePreset ?? "LAST_MONTH")
    || (range.preset === "CUSTOM" && (range.from !== request.selection.dateFrom || range.to !== request.selection.dateTo))) return bad();
  if ((source.intake === null) !== (scope.selectedBranches.length === 0)) return bad();
  const intake = source.intake === null ? null : intakeData(source.intake, request);
  const queue = record(source.queue);
  if (!queue || !boundedArray(queue.branchIds, 500) || !queue.branchIds.every(isUUIDv7)
    || !boundedArray(queue.rows, 5)) return bad();
  const queueRange = period(queue.range);
  if (queueRange.timeZone !== range.timeZone || (request.queuePeriod && (queueRange.preset !== "CUSTOM"
    || queueRange.from !== request.queuePeriod.dateFrom || queueRange.to !== request.queuePeriod.dateTo))) return bad();
  const selectedBranches = new Set(scope.selectedBranches.map(branch => branch.id));
  const queueBranches = new Set(queue.branchIds);
  if (queueBranches.size !== queue.branchIds.length || !queue.branchIds.every(id => selectedBranches.has(id))
    || queue.partialAccess !== (queueBranches.size < selectedBranches.size)) return bad();
  const rows = queue.rows.map(value => {
    const row = record(value);
    if (!row || !isUUIDv7(row.id) || !isUUIDv7(row.branchId) || !queueBranches.has(row.branchId)
      || !timestamp(row.createdAt) || Date.parse(row.createdAt) > Date.parse(source.asOf as string)) return bad();
    return { id: row.id, branchId: row.branchId, title: nullableText(row.title), createdAt: row.createdAt,
      sourceNameEn: nullableText(row.sourceNameEn), sourceNameAr: nullableText(row.sourceNameAr) };
  });
  const total = queue.total === null ? null : count(queue.total);
  const nextCursor = queue.nextCursor === null ? null
    : typeof queue.nextCursor === "string" && /^[A-Za-z0-9_-]{1,512}$/u.test(queue.nextCursor) ? queue.nextCursor : bad();
  const expectedState = total === null ? "UNAVAILABLE" : total ? "READY" : "EMPTY";
  if (queue.state !== expectedState || (total === null) !== (queueBranches.size === 0)
    || rows.length > (total ?? 0) || new Set(rows.map(row => row.id)).size !== rows.length
    || (nextCursor && (rows.length !== 5 || nextCursor === request.cursors.at(-1)))) return bad();
  return { asOf: source.asOf, scope, range, intake,
    queue: { range: queueRange, state: expectedState, partialAccess: queue.partialAccess, total, rows, nextCursor } };
}

export type LeadIntakeAllocation = ReturnType<typeof parseLeadIntakeAllocation>;
