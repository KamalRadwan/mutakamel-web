// The workspace's FilterBar: which filters it offers, and how they travel
// between FilterBar's values and the address bar.

import type { Day } from "date-fns";
import type { DateRangePresetId, FilterDef, FilterValue, FilterValues } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import { ACTIVITY_PRIORITIES, ACTIVITY_STATUSES, ACTIVITY_TYPES } from "../activity-contract";
import { fromLocalDate, toLocalDate } from "../activity-form";
import { activityLabel } from "../activity-presentation";
import { ACTIVITY_QUERY, type ActivityQueryUpdates, type ActivityWorkspaceFilters } from "./activity-workspace-url";

const FILTER = {
  type: "type",
  status: "status",
  priority: "priority",
  mine: "mine",
  overdue: "overdue",
  due: "due",
} as const;

// Forward-looking first: an activity is mostly planned work, so "what is coming"
// is asked more often than "what was due".
const DUE_PRESETS: readonly DateRangePresetId[] = [
  "today",
  "thisWeek",
  "next7Days",
  "next30Days",
  "thisMonth",
  "last7Days",
  "last30Days",
];

/**
 * The filters on offer. The due-date range is left out of the calendar, whose
 * own navigation owns the range; `weekStartsOn` is the calendar's, so "This
 * week" means the same seven days in both.
 */
export function activityFilterDefs(t: Dictionary, weekStartsOn: Day, withDueRange: boolean): FilterDef[] {
  const copy = t.activities;
  const labels = copy.workspace.filters;
  const listLabels = {
    emptyLabel: t.common.noData,
    moreLabel: t.filters.more,
    removeLabel: t.filters.remove,
    overflowLabel: t.filters.overflow,
    clearAllLabel: t.filters.clearAll,
  };
  const defs: FilterDef[] = [
    {
      id: FILTER.type,
      kind: "multiSelect",
      label: labels.type,
      options: ACTIVITY_TYPES.map((value) => ({ value, label: activityLabel(copy, "types", value) })),
      labels: listLabels,
    },
    {
      id: FILTER.status,
      kind: "multiSelect",
      label: labels.status,
      options: ACTIVITY_STATUSES.map((value) => ({ value, label: activityLabel(copy, "statuses", value) })),
      labels: listLabels,
    },
    {
      id: FILTER.priority,
      kind: "multiSelect",
      label: labels.priority,
      options: ACTIVITY_PRIORITIES.map((value) => ({ value, label: activityLabel(copy, "priorities", value) })),
      labels: listLabels,
    },
    { id: FILTER.mine, kind: "boolean", label: labels.mine, trueLabel: labels.yes, falseLabel: labels.no },
    { id: FILTER.overdue, kind: "boolean", label: labels.overdue, trueLabel: labels.yes, falseLabel: labels.no },
  ];
  if (withDueRange) {
    defs.push({
      id: FILTER.due,
      kind: "dateRange",
      label: labels.due,
      presetLabels: copy.workspace.datePresets,
      presets: DUE_PRESETS,
      weekStartsOn,
      clearLabel: formatTemplate(t.filters.remove, { label: labels.due }),
    });
  }
  return defs;
}

function localMidnightIso(day: string | null): string | undefined {
  return day ? fromLocalDate(day)?.toISOString() : undefined;
}

/** The URL's filter state as FilterBar's values. The due range is a pair of whole local days. */
export function activityFilterValues(filters: ActivityWorkspaceFilters, withDueRange: boolean): FilterValues {
  return {
    [FILTER.type]: filters.types.length > 0 ? { kind: "multiSelect", values: [...filters.types] } : undefined,
    [FILTER.status]: filters.statuses.length > 0 ? { kind: "multiSelect", values: [...filters.statuses] } : undefined,
    [FILTER.priority]: filters.priorities.length > 0 ? { kind: "multiSelect", values: [...filters.priorities] } : undefined,
    [FILTER.mine]: filters.mine ? { kind: "boolean", value: true } : undefined,
    [FILTER.overdue]: filters.overdue ? { kind: "boolean", value: true } : undefined,
    [FILTER.due]: withDueRange && (filters.dueFrom || filters.dueTo)
      ? { kind: "dateRange", from: localMidnightIso(filters.dueFrom), to: localMidnightIso(filters.dueTo) }
      : undefined,
  };
}

function listOf(value: FilterValue | undefined): string | null {
  return value?.kind === "multiSelect" && value.values.length > 0 ? value.values.join(",") : null;
}

// A switched-off boolean clears rather than storing "false": no filter and a
// false filter are the same query, and only one of them should be a chip.
function flagOf(value: FilterValue | undefined): string | null {
  return value?.kind === "boolean" && value.value ? "true" : null;
}

// The picker hands back instants — a preset's end is 23:59:59.999, a picked
// day is its midnight. Both are kept as the local day they fall on.
function dayOf(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : toLocalDate(date);
}

/**
 * FilterBar's next values as URL writes. Without the due-range filter on offer
 * its keys are left alone — FilterBar reports only the filters it drew, and an
 * absent one would otherwise read as "cleared".
 */
export function activityFilterUpdates(values: FilterValues, withDueRange: boolean): ActivityQueryUpdates {
  const due = values[FILTER.due];
  return {
    [ACTIVITY_QUERY.types]: listOf(values[FILTER.type]),
    [ACTIVITY_QUERY.statuses]: listOf(values[FILTER.status]),
    [ACTIVITY_QUERY.priorities]: listOf(values[FILTER.priority]),
    [ACTIVITY_QUERY.mine]: flagOf(values[FILTER.mine]),
    [ACTIVITY_QUERY.overdue]: flagOf(values[FILTER.overdue]),
    ...(withDueRange
      ? {
          [ACTIVITY_QUERY.dueFrom]: due?.kind === "dateRange" ? dayOf(due.from) : null,
          [ACTIVITY_QUERY.dueTo]: due?.kind === "dateRange" ? dayOf(due.to) : null,
        }
      : {}),
  };
}
