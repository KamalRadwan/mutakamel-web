import type { SelectedOpportunity } from '../../opportunities.model';

export type BatchOrder = 'table' | 'owner';
export type BatchAssigneeMode = 'owner' | 'me' | 'other';
export type GapPreset = '5' | '10' | '15' | '30' | '60' | 'custom';

export interface AssignableOwner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ScheduleInput {
  rows: readonly SelectedOpportunity[];
  start: Date;
  gapMinutes: number;
  durationMinutes: number | null;
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  chosenAssigneeId: string;
  spacePerAssignee: boolean;
  currentUserId: string;
  currentUserName: string;
  ownerNames: ReadonlyMap<string, string>;
}

export interface ScheduledActivityRow {
  row: SelectedOpportunity;
  assigneeUserId: string;
  assigneeName: string;
  dueDate: Date;
  endDate: Date | null;
  dueAt: string;
  endsAt: string | null;
}

export interface ComputedBatchSchedule {
  items: ScheduledActivityRow[];
  firstStart: Date | null;
  lastStart: Date | null;
  lastMoment: Date | null;
  runsPastMidnight: boolean;
  noOwnerCount: number;
}

const MIN_MS = 60_000;

/** Pure schedule computation shared by preview and submit/worker fake so all produce identical timestamps. */
export function computeBatchActivitySchedule(input: ScheduleInput): ComputedBatchSchedule {
  const {
    rows,
    start,
    gapMinutes,
    durationMinutes,
    order,
    assigneeMode,
    chosenAssigneeId,
    spacePerAssignee,
    currentUserId,
    currentUserName,
    ownerNames,
  } = input;

  let noOwnerCount = 0;
  const indexed = rows.map((row, index) => {
    if (!row.ownerUserId) noOwnerCount++;
    const assigneeUserId =
      assigneeMode === 'me'
        ? currentUserId
        : assigneeMode === 'other'
          ? chosenAssigneeId || currentUserId
          : row.ownerUserId || currentUserId;
    const assigneeName =
      ownerNames.get(assigneeUserId) ?? (assigneeUserId === currentUserId ? currentUserName : assigneeUserId);
    return { row, index, assigneeUserId, assigneeName };
  });

  if (order === 'owner') {
    indexed.sort((a, b) => {
      const nameDiff = a.assigneeName.localeCompare(b.assigneeName);
      if (nameDiff !== 0) return nameDiff;
      const idDiff = a.assigneeUserId.localeCompare(b.assigneeUserId);
      return idDiff !== 0 ? idDiff : a.index - b.index;
    });
  }

  const groupCounters = new Map<string, number>();
  const startMs = start.getTime();
  const durationMs = durationMinutes !== null && durationMinutes > 0 ? durationMinutes * MIN_MS : null;
  const perAssignee = assigneeMode === 'owner' && spacePerAssignee;

  const items: ScheduledActivityRow[] = indexed.map((entry) => {
    const groupKey = perAssignee ? entry.assigneeUserId : '__all__';
    const k = groupCounters.get(groupKey) ?? 0;
    groupCounters.set(groupKey, k + 1);

    const dueMs = startMs + k * gapMinutes * MIN_MS;
    const dueDate = new Date(dueMs);
    const endDate = durationMs !== null ? new Date(dueMs + durationMs) : null;
    return {
      row: entry.row,
      assigneeUserId: entry.assigneeUserId,
      assigneeName: entry.assigneeName,
      dueDate,
      endDate,
      dueAt: dueDate.toISOString(),
      endsAt: endDate ? endDate.toISOString() : null,
    };
  });

  if (items.length === 0) {
    return {
      items: [],
      firstStart: null,
      lastStart: null,
      lastMoment: null,
      runsPastMidnight: false,
      noOwnerCount,
    };
  }

  let firstStart = items[0].dueDate;
  let lastStart = items[0].dueDate;
  let lastMoment = items[0].endDate ?? items[0].dueDate;

  for (const item of items) {
    if (item.dueDate.getTime() < firstStart.getTime()) firstStart = item.dueDate;
    if (item.dueDate.getTime() > lastStart.getTime()) lastStart = item.dueDate;
    const itemEnd = item.endDate ?? item.dueDate;
    if (itemEnd.getTime() > lastMoment.getTime()) lastMoment = itemEnd;
  }

  const nextMidnightMs = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
  const runsPastMidnight = lastStart.getTime() >= nextMidnightMs || lastMoment.getTime() > nextMidnightMs;

  return { items, firstStart, lastStart, lastMoment, runsPastMidnight, noOwnerCount };
}
