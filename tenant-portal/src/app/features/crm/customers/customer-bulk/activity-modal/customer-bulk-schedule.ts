import {
  CustomerBulkActivityAssignee,
  CustomerBulkActivityParams,
  SelectedCustomerRow,
} from '../customer-bulk.model';

export type BatchOrder = 'table' | 'owner';
export type BatchAssigneeMode = 'owner' | 'me' | 'other';
export type GapPreset = '5' | '10' | '15' | '30' | '60' | 'custom';

export interface CustomerScheduleInput {
  rows: readonly SelectedCustomerRow[];
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

export interface ScheduledCustomerActivityRow {
  row: SelectedCustomerRow;
  assigneeUserId: string;
  assigneeName: string;
  dueDate: Date;
  endDate: Date | null;
  dueAt: string;
  endsAt: string | null;
}

export interface ComputedCustomerBatchSchedule {
  items: ScheduledCustomerActivityRow[];
  firstStart: Date | null;
  lastStart: Date | null;
  lastMoment: Date | null;
  runsPastMidnight: boolean;
  noOwnerCount: number;
}

export type CustomerWireSchedule = CustomerBulkActivityParams['schedule'];

const MIN_MS = 60_000;
const STEP_MINUTES = 15;
const MAX_GAP_MINUTES = 1440;

const SCHEDULE_KEYS = new Set(['startAt', 'gapMinutes', 'order', 'assignee', 'spacePerAssignee']);
const LEAD_OWNER_KEYS = new Set(['mode']);
const ME_KEYS = new Set(['mode']);
const USER_KEYS = new Set(['mode', 'userId']);

/** Default batch activity start: now rounded up to the next 15-minute mark. */
export function roundUpTo15Minutes(now = new Date()): Date {
  const stepMs = STEP_MINUTES * MIN_MS;
  return new Date(Math.ceil((now.getTime() + 1) / stepMs) * stepMs);
}

/** Pure schedule computation shared by preview and fake worker so all produce identical timestamps. */
export function computeCustomerBatchActivitySchedule(
  input: CustomerScheduleInput,
): ComputedCustomerBatchSchedule {
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

  const items: ScheduledCustomerActivityRow[] = indexed.map((entry) => {
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

export function toWireCustomerActivitySchedule(input: {
  startAt: string;
  gapMinutes: number;
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  chosenAssigneeId: string;
  spacePerAssignee: boolean;
}): CustomerWireSchedule {
  const assignee: CustomerBulkActivityAssignee =
    input.assigneeMode === 'me'
      ? { mode: 'ME' }
      : input.assigneeMode === 'other'
        ? { mode: 'USER', userId: input.chosenAssigneeId }
        : { mode: 'LEAD_OWNER' };

  return {
    startAt: input.startAt,
    gapMinutes: input.gapMinutes,
    order: input.order === 'owner' ? 'OWNER' : 'TABLE',
    assignee,
    spacePerAssignee: input.assigneeMode === 'owner' ? input.spacePerAssignee : false,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function hasOnlyAllowedKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(obj).every((key) => allowed.has(key));
}

export function parseCustomerBulkActivitySchedule(raw: unknown): CustomerWireSchedule | null {
  const obj = asObject(raw);
  if (!obj || !hasOnlyAllowedKeys(obj, SCHEDULE_KEYS)) return null;

  const startAt = typeof obj['startAt'] === 'string' ? obj['startAt'].trim() : '';
  if (!startAt || Number.isNaN(Date.parse(startAt))) return null;

  const gapMinutes = obj['gapMinutes'];
  if (typeof gapMinutes !== 'number' || !Number.isInteger(gapMinutes) || gapMinutes < 1 || gapMinutes > MAX_GAP_MINUTES) {
    return null;
  }

  const order = obj['order'];
  if (order !== 'TABLE' && order !== 'OWNER') return null;

  const spacePerAssignee = obj['spacePerAssignee'];
  if (typeof spacePerAssignee !== 'boolean') return null;

  const assigneeObj = asObject(obj['assignee']);
  if (!assigneeObj) return null;

  let assignee: CustomerBulkActivityAssignee;
  switch (assigneeObj['mode']) {
    case 'LEAD_OWNER':
      if (!hasOnlyAllowedKeys(assigneeObj, LEAD_OWNER_KEYS)) return null;
      assignee = { mode: 'LEAD_OWNER' };
      break;
    case 'ME':
      if (!hasOnlyAllowedKeys(assigneeObj, ME_KEYS)) return null;
      assignee = { mode: 'ME' };
      break;
    case 'USER': {
      if (!hasOnlyAllowedKeys(assigneeObj, USER_KEYS)) return null;
      const userId = typeof assigneeObj['userId'] === 'string' ? assigneeObj['userId'].trim() : '';
      if (!userId) return null;
      assignee = { mode: 'USER', userId };
      break;
    }
    default:
      return null;
  }

  return { startAt, gapMinutes, order, assignee, spacePerAssignee };
}

export function fromWireCustomerActivitySchedule(schedule: CustomerWireSchedule): {
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  chosenAssigneeId: string;
} {
  const order: BatchOrder = schedule.order === 'OWNER' ? 'owner' : 'table';
  switch (schedule.assignee.mode) {
    case 'ME':
      return { order, assigneeMode: 'me', chosenAssigneeId: '' };
    case 'USER':
      return { order, assigneeMode: 'other', chosenAssigneeId: schedule.assignee.userId };
    case 'LEAD_OWNER':
      return { order, assigneeMode: 'owner', chosenAssigneeId: '' };
  }
}
