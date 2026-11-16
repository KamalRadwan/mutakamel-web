import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, nonEmptyString, record, stringArray } from "../dashboard-parse";
import { branchCohortQuery, parseCohortReportContext, type BranchCohortFilters } from "./branch-cohort-report-contract";

const REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-team-cohort";
const fail = () => invalidResponse("lead team cohort report");
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export interface TeamCohortFilters extends BranchCohortFilters {
  teamIds: string[];
  branchIds: string[];
}

export function teamCohortQuery(filters: TeamCohortFilters) {
  const path = branchCohortQuery(filters, REPORT_PATH);
  const branchSelection = filters.branchIds.length ? `&branchIds=${encodeURIComponent(filters.branchIds.join(","))}` : "";
  const teamSelection = filters.teamIds.length ? `&teamIds=${encodeURIComponent(filters.teamIds.join(","))}` : "";
  return `${path}${branchSelection}${teamSelection}`;
}

function teamCounts(value: Record<string, unknown>) {
  const { created, converted, rate } = value;
  if (!count(created) || !count(converted) || converted > created) return fail();
  const expectedRate = created === 0 ? null : Math.round(10_000 * converted / created) / 100;
  if (rate !== expectedRate) return fail();
  return { created, converted, rate: expectedRate };
}

export function parseTeamCohortReport(value: unknown, filters: TeamCohortFilters) {
  const { root, branchById, companyId, branchId, context } = parseCohortReportContext(value, filters, fail);
  const { state, warnings } = root;
  if ((state !== "READY" && state !== "EMPTY" && state !== "UNAVAILABLE") || !stringArray(warnings, 10)
    || root.membershipBasis !== "CURRENT_COVERAGE" || root.aggregation !== "NON_ADDITIVE"
    || !boundedArray(root.teamOptions, 500) || !boundedArray(root.rows, 3) || !boundedArray(root.selectedTeamIds, 3)
    || !root.selectedTeamIds.every(isUUIDv7) || !boundedArray(root.selectedBranchIds, 20) || !root.selectedBranchIds.every(isUUIDv7)) return fail();

  const selectedBranchIds = root.selectedBranchIds;
  const chosenBranches = new Set(selectedBranchIds);
  if (selectedBranchIds.length !== filters.branchIds.length || chosenBranches.size !== selectedBranchIds.length
    || selectedBranchIds.some((id, index) => id !== filters.branchIds[index]?.toLowerCase()
      || !branchById.has(id) || (companyId && branchById.get(id)?.companyId !== companyId))) return fail();

  const teamOptions = root.teamOptions.map((value) => {
    const option = record(value);
    if (!option || !isUUIDv7(option.id) || !nonEmptyString(option.label) || !boundedArray(option.branchIds, 500)
      || !option.branchIds.length || !option.branchIds.every(isUUIDv7) || new Set(option.branchIds).size !== option.branchIds.length) return fail();
    for (const id of option.branchIds) {
      const branch = branchById.get(id);
      if (!branch || (companyId && branch.companyId !== companyId) || (branchId && branch.id !== branchId)
        || (chosenBranches.size && !chosenBranches.has(id))) return fail();
    }
    return { id: option.id, label: option.label, branchIds: option.branchIds };
  });
  const optionById = new Map(teamOptions.map((team) => [team.id, team]));
  const selectedTeamIds = root.selectedTeamIds;
  const expectedIds = filters.teamIds.length ? filters.teamIds.map((id) => id.toLowerCase()) : teamOptions.slice(0, 2).map((team) => team.id);
  if (optionById.size !== teamOptions.length || new Set(selectedTeamIds).size !== selectedTeamIds.length
    || expectedIds.length !== selectedTeamIds.length || selectedTeamIds.some((id, index) => id !== expectedIds[index] || !optionById.has(id))
    || root.rows.length !== selectedTeamIds.length) return fail();

  const rows = root.rows.map((value, index) => {
    const row = record(value);
    if (!row || typeof row.teamId !== "string" || row.teamId !== selectedTeamIds[index]) return fail();
    const team = optionById.get(row.teamId);
    if (!team) return fail();
    return { team, ...teamCounts(row) };
  });
  if (state === "UNAVAILABLE") {
    if (selectedTeamIds.length || root.totals !== null) return fail();
    return { ...context, state, warnings, teamOptions, selectedTeamIds, selectedBranchIds, rows, totals: null };
  }

  const summary = record(root.totals);
  if (!summary || (state === "READY" && !rows.length)) return fail();
  const totals = teamCounts(summary);
  const { overlapCreated, overlapConverted, duplicateCreated, duplicateConverted, invalidIntervals } = summary;
  const extra = Math.max(0, rows.length - 1);
  if (!count(overlapCreated) || !count(overlapConverted) || !count(duplicateCreated) || !count(duplicateConverted) || !count(invalidIntervals)
    || (state === "READY") !== (totals.created > 0) || rows.some((row) => row.created > totals.created || row.converted > totals.converted)
    || rows.reduce((sum, row) => sum + row.created, 0) !== totals.created + duplicateCreated
    || rows.reduce((sum, row) => sum + row.converted, 0) !== totals.converted + duplicateConverted
    || overlapCreated > totals.created || overlapConverted > totals.converted || overlapConverted > overlapCreated
    || duplicateCreated < overlapCreated || duplicateCreated > overlapCreated * extra
    || duplicateConverted < overlapConverted || duplicateConverted > overlapConverted * extra
    || duplicateConverted > duplicateCreated || invalidIntervals > totals.created - totals.converted) return fail();
  const exactlyThree = { created: duplicateCreated - overlapCreated, converted: duplicateConverted - overlapConverted };
  const exactlyTwo = { created: overlapCreated - exactlyThree.created, converted: overlapConverted - exactlyThree.converted };
  if (exactlyTwo.converted > exactlyTwo.created || exactlyThree.converted > exactlyThree.created
    || totals.converted - overlapConverted > totals.created - overlapCreated
    || rows.some((row) => exactlyThree.created > row.created || exactlyThree.converted > row.converted)) return fail();
  return { ...context, state, warnings, teamOptions, selectedTeamIds, selectedBranchIds, rows,
    totals: { ...totals, overlapCreated, overlapConverted, duplicateCreated, duplicateConverted, invalidIntervals },
    overlapByTeamCount: { exactlyTwo, exactlyThree } };
}

export type TeamCohortReport = ReturnType<typeof parseTeamCohortReport>;
