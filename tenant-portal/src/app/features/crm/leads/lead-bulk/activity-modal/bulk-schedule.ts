import { SelectedRow } from '../lead-bulk.model';

export type BatchOrder = 'table' | 'owner';
export type BatchAssigneeMode = 'owner' | 'me' | 'other';
export type GapPreset = '5' | '10' | '15' | '30' | '60' | 'custom';

/** Wire shape of `params.schedule` for the CRM `CREATE_ACTIVITY` bulk job (crm-leads-bulk.schemas.ts). */
export type BulkActivityAssignee = { mode: 'LEAD_OWNER' } | { mode: 'ME' } | { mode: 'USER'; userId: string };

export interface BulkActivityScheduleParams {
  startAt: string;
  gapMinutes: number;
  order: 'TABLE' | 'OWNER';
  assignee: BulkActivityAssignee;
  spacePerAssignee: boolean;
}

export interface BulkActivityScheduleInput {
  start: Date;
  gapMinutes: number;
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  chosenAssigneeId: string;
  spacePerAssignee: boolean;
}

/** Builds the strict backend schedule body from the modal's UI state. */
export function buildBulkActivitySchedule(input: BulkActivityScheduleInput): BulkActivityScheduleParams {
  const assignee: BulkActivityAssignee =
    input.assigneeMode === 'me'
      ? { mode: 'ME' }
      : input.assigneeMode === 'other'
        ? { mode: 'USER', userId: input.chosenAssigneeId }
        : { mode: 'LEAD_OWNER' };
  return {
    startAt: input.start.toISOString(),
    gapMinutes: input.gapMinutes,
    order: input.order === 'owner' ? 'OWNER' : 'TABLE',
    assignee,
    spacePerAssignee: input.assigneeMode === 'owner' ? input.spacePerAssignee : false,
  };
}

const ISO_OFFSET_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isStrictRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

/**
 * Mirrors the backend strict zod schedule schema: unknown keys (for example the old
 * `assigneeMode` / `assigneeUserId`) and lowercase enums are rejected. Returns null when invalid.
 */
export function parseBulkActivitySchedule(value: unknown): BulkActivityScheduleParams | null {
  if (!isStrictRecord(value, ['startAt', 'gapMinutes', 'order', 'assignee', 'spacePerAssignee'])) return null;
  const { startAt, gapMinutes, order, assignee, spacePerAssignee } = value;
  if (typeof startAt !== 'string' || !ISO_OFFSET_DATETIME.test(startAt) || Number.isNaN(Date.parse(startAt))) return null;
  if (typeof gapMinutes !== 'number' || !Number.isInteger(gapMinutes) || gapMinutes < 1 || gapMinutes > 1440) return null;
  if (order !== 'TABLE' && order !== 'OWNER') return null;
  if (typeof spacePerAssignee !== 'boolean') return null;
  const mode = assignee && typeof assignee === 'object' ? (assignee as Record<string, unknown>)['mode'] : undefined;
  let parsedAssignee: BulkActivityAssignee;
  if (mode === 'LEAD_OWNER' || mode === 'ME') {
    if (!isStrictRecord(assignee, ['mode'])) return null;
    parsedAssignee = { mode };
  } else if (mode === 'USER') {
    if (!isStrictRecord(assignee, ['mode', 'userId'])) return null;
    const userId = assignee['userId'];
    if (typeof userId !== 'string' || !userId.trim()) return null;
    parsedAssignee = { mode, userId };
  } else {
    return null;
  }
  return { startAt, gapMinutes, order, assignee: parsedAssignee, spacePerAssignee };
}

/** Maps the wire schedule back to the UI enums used by `computeBatchActivitySchedule`. */
export function fromBulkActivitySchedule(schedule: BulkActivityScheduleParams): {
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  chosenAssigneeId: string;
} {
  const { assignee } = schedule;
  return {
    order: schedule.order === 'OWNER' ? 'owner' : 'table',
    assigneeMode: assignee.mode === 'ME' ? 'me' : assignee.mode === 'USER' ? 'other' : 'owner',
    chosenAssigneeId: assignee.mode === 'USER' ? assignee.userId : '',
  };
}

export interface AssignableOwner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ScheduleInput {
  rows: readonly SelectedRow[];
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
  row: SelectedRow;
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
