import {
  ACTIVITY_STATUSES,
  ACTIVITY_TARGET_TYPES,
  Activity,
  ActivityAssigneesParams,
  ActivityCalendarParams,
  ActivityCalendarResponse,
  ActivityError,
  ActivityListParams,
  ActivityPage,
  ActivityScopeFilter,
  ActivityStatusSummary,
  ActivitySummary,
  ActivitySummaryScope,
  ActivityTargetOption,
  ActivityTargetSelector,
  ActivityTargetsParams,
  ActivityTypeDefinition,
  Assignee,
  CreateActivity,
  LIMITS,
  MEETING_URL,
  TYPE_LOOK,
  TargetApp,
  UpdateActivity,
  activityValidationError,
  dueState,
  isOpen,
} from './activities.model';

export const FAKE_CURRENT_USER_ID = 'u1';

const ASSIGNEES: Assignee[] = [
  { id: 'u1', name: 'Kamal Radwan' },
  { id: 'u2', name: 'Mona Adel' },
  { id: 'u3', name: 'Omar Fathy' },
];

const FAKE_USER_ALIASES: Record<string, string> = {
  'u-owner': 'u1',
  'u-mona': 'u2',
  'u-omar': 'u3',
};

const BRANCH_CAIRO = 'br-cai';
const BRANCH_ALEX = 'br-alx';
const COMPANY_ID = 'co-eg';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SUMMARY_MAX_SPAN = 48 * HOUR;
const CALENDAR_MAX_DAYS = 62;
const CALENDAR_ITEM_LIMIT = 500;
const TARGETS_LIMIT = 20;
const ASSIGNEES_LIMIT = 100;
const LIST_MAX_LIMIT = 100;
const SEARCH_MAX = 200;
const PICKER_SEARCH_MAX = 100;

const SEEDED_TARGETS: readonly ActivityTargetOption[] = [
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-001', label: 'Nile Logistics', branchId: BRANCH_CAIRO },
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-002', label: 'Delta Foods', branchId: BRANCH_CAIRO },
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-003', label: 'Cairo Steel', branchId: BRANCH_CAIRO },
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-004', label: 'Red Sea Resorts', branchId: BRANCH_CAIRO },
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-005', label: 'Pyramids Pharma', branchId: BRANCH_ALEX },
  { targetApp: 'CRM', targetType: 'LEAD', targetId: 'lead-006', label: 'Alexandria Textiles', branchId: BRANCH_ALEX },
  {
    targetApp: 'CRM',
    targetType: 'CUSTOMER_PROFILE',
    targetId: 'cust-001',
    label: 'Al-Ahram Construction',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'CRM',
    targetType: 'CUSTOMER_PROFILE',
    targetId: 'cust-002',
    label: 'Mediterranean Shipping Co.',
    branchId: BRANCH_ALEX,
  },
  {
    targetApp: 'CRM',
    targetType: 'OPPORTUNITY',
    targetId: 'opp-001',
    label: 'Nile Logistics Enterprise Rollout',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'CRM',
    targetType: 'OPPORTUNITY',
    targetId: 'opp-002',
    label: 'Alexandria Port Automation',
    branchId: BRANCH_ALEX,
  },
  {
    targetApp: 'CRM',
    targetType: 'PARTY',
    targetId: 'party-001',
    label: 'El-Nour Distribution Group',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'CRM',
    targetType: 'PARTY',
    targetId: 'party-002',
    label: 'Alexandria Maritime Services',
    branchId: BRANCH_ALEX,
  },
  {
    targetApp: 'CORE',
    targetType: 'PARTY',
    targetId: 'party-001',
    label: 'El-Nour Distribution Group',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'CORE',
    targetType: 'PARTY',
    targetId: 'party-002',
    label: 'Alexandria Maritime Services',
    branchId: BRANCH_ALEX,
  },
  {
    targetApp: 'CORE',
    targetType: 'PARTY',
    targetId: 'party-003',
    label: 'Sinai Packaging Supplies',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'TRADE',
    targetType: 'QUOTATION',
    targetId: 'qt-2026-014',
    label: 'QT-2026-014 · Al-Ahram Construction',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'TRADE',
    targetType: 'QUOTATION',
    targetId: 'qt-2026-019',
    label: 'QT-2026-019 · Mediterranean Shipping Co.',
    branchId: BRANCH_ALEX,
  },
  {
    targetApp: 'TRADE',
    targetType: 'SALES_ORDER',
    targetId: 'so-2026-008',
    label: 'SO-2026-008 · Al-Ahram Construction',
    branchId: BRANCH_CAIRO,
  },
  {
    targetApp: 'TRADE',
    targetType: 'SALES_ORDER',
    targetId: 'so-2026-011',
    label: 'SO-2026-011 · Alexandria Textiles',
    branchId: BRANCH_ALEX,
  },
];

/** Exactly `ActivitiesService.activityTypes()` (core-app); the UI draws icons from `TYPE_LOOK`, not `icon`. */
const ACTIVITY_TYPE_DEFINITIONS: readonly ActivityTypeDefinition[] = [
  { key: 'TODO', label: 'To-do', icon: 'check-square', defaultPriority: 'NORMAL' },
  { key: 'CALL', label: 'Call', icon: 'phone', defaultPriority: 'NORMAL' },
  { key: 'MEETING', label: 'Meeting', icon: 'users', defaultPriority: 'NORMAL' },
  { key: 'EMAIL', label: 'Email', icon: 'mail', defaultPriority: 'NORMAL' },
  { key: 'VISIT', label: 'Visit', icon: 'map-pin', defaultPriority: 'NORMAL' },
  { key: 'FOLLOW_UP', label: 'Follow-up', icon: 'clock', defaultPriority: 'NORMAL' },
  { key: 'OTHER', label: 'Other', icon: 'circle', defaultPriority: 'NORMAL' },
];

let fakeDelayMs = 300;

/** Test hook: 0 makes the fake resolve on the next tick. */
export function setFakeActivitiesDelay(ms: number): void {
  fakeDelayMs = ms;
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, fakeDelayMs));
}

function canonicalUserId(userId: string): string {
  return FAKE_USER_ALIASES[userId] ?? userId;
}

function userName(userId: string): string | null {
  const canonical = canonicalUserId(userId);
  return ASSIGNEES.find((user) => user.id === canonical)?.name ?? null;
}

function targetRoute(app: TargetApp, type: string, id: string): string {
  if (app === 'CRM') {
    if (type === 'LEAD') return `/crm/leads/${id}`;
    if (type === 'CUSTOMER_PROFILE') return `/crm/customers/${id}`;
    if (type === 'OPPORTUNITY') return `/crm/opportunities/${id}`;
    if (type === 'PARTY') return `/crm/parties/${id}`;
  }
  if (app === 'CORE' && type === 'PARTY') {
    return `/workspace/operations/party-directory/${id}`;
  }
  if (app === 'TRADE') {
    if (type === 'QUOTATION') return `/trade/documents/quotations/${id}`;
    if (type === 'SALES_ORDER') return `/trade/documents/sales-orders/${id}`;
  }
  return `/${app.toLowerCase()}/${type.toLowerCase()}/${id}`;
}

function findSeededTarget(app: TargetApp, type: string, id: string): ActivityTargetOption | undefined {
  return SEEDED_TARGETS.find(
    (entry) => entry.targetApp === app && entry.targetType === type && entry.targetId === id,
  );
}

function cloneActivity(item: Activity): Activity {
  return {
    ...item,
    targets: item.targets.map((target) => ({ ...target })),
  };
}

function assertTargetTuple(app: TargetApp, type: string): void {
  const allowed = ACTIVITY_TARGET_TYPES[app];
  if (!allowed || !allowed.includes(type)) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
}

function makeActivity(
  index: number,
  target: { app: TargetApp; type: string; id: string },
  overrides: Partial<Activity> & Pick<Activity, 'type' | 'subject' | 'status' | 'dueAt'>,
): Activity {
  const id = 'act-' + String(index).padStart(3, '0');
  const assigneeUserId = overrides.assigneeUserId ?? FAKE_CURRENT_USER_ID;
  const createdByUserId = overrides.createdByUserId ?? FAKE_CURRENT_USER_ID;
  const createdAt = overrides.createdAt ?? new Date(Date.now() - Math.max(1, 25 - index) * DAY).toISOString();
  const known = findSeededTarget(target.app, target.type, target.id);
  const branchId = overrides.branchId ?? known?.branchId ?? BRANCH_CAIRO;

  return {
    id,
    description: null,
    direction: null,
    priority: 'NORMAL',
    endsAt: null,
    reminderOffsetMinutes: null,
    reminderSentAt: null,
    location: null,
    meetingUrl: null,
    completedAt: null,
    cancelledAt: null,
    outcome: null,
    assigneeName: userName(assigneeUserId),
    createdByName: userName(createdByUserId),
    branchId,
    companyId: COMPANY_ID,
    version: overrides.status === 'PLANNED' ? 1 : 2,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    targets: [
      {
        id: 'tgt-' + id,
        role: 'PRIMARY',
        targetApp: target.app,
        targetType: target.type,
        targetId: target.id,
        label: known?.label ?? target.id,
        route: targetRoute(target.app, target.type, target.id),
        targetVersion: known ? '1' : null,
        unavailableAt: null,
      },
    ],
    ...overrides,
    assigneeUserId,
    createdByUserId,
  };
}

function seed(): Activity[] {
  const nowDate = new Date();
  const now = nowDate.getTime();
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const nextMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1).getTime();

  const todayDueMs = Math.max(todayStart, Math.min(now + 10 * MIN, nextMidnight - 10 * MIN));
  const todayEndMs = Math.max(todayDueMs + 30 * MIN, now + 45 * MIN);
  const todayTodoDueMs = Math.max(todayStart, Math.min(now + 15 * MIN, nextMidnight - 5 * MIN));
  const todaySecondDueMs = Math.max(todayStart, Math.min(now + 20 * MIN, nextMidnight - 8 * MIN));
  const todayThirdDueMs = Math.max(todayStart, Math.min(now + 35 * MIN, nextMidnight - 4 * MIN));
  const todayFourthDueMs = Math.max(todayStart, Math.min(now + 50 * MIN, nextMidnight - 2 * MIN));
  const completedTodayIso = new Date(Math.floor((todayStart + now) / 2)).toISOString();

  return [
    makeActivity(1, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'CALL',
      subject: 'Confirm ERP rollout timeline and branches',
      description: 'Review branch count and warehouse requirements with procurement.',
      direction: 'OUTBOUND',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(now - DAY).toISOString(),
      endsAt: new Date(now - DAY + 30 * MIN).toISOString(),
      reminderOffsetMinutes: 15,
      meetingUrl: 'https://meet.example.com/nile-intro',
      assigneeUserId: 'u1',
    }),
    makeActivity(2, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'MEETING',
      subject: 'Technical demo for finance and operations',
      description: 'Present inventory, invoicing, and CRM integration.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      dueAt: new Date(todayDueMs).toISOString(),
      endsAt: new Date(todayEndMs).toISOString(),
      reminderOffsetMinutes: 30,
      location: 'Cairo HQ, Room 4B',
      meetingUrl: 'https://meet.example.com/nile-erp',
      assigneeUserId: 'u2',
    }),
    makeActivity(3, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'VISIT',
      subject: 'On-site warehouse assessment',
      description: 'Inspect barcode scanning workflow and stock zones.',
      priority: 'NORMAL',
      status: 'PLANNED',
      dueAt: new Date(now + 2 * DAY).toISOString(),
      endsAt: new Date(now + 2 * DAY + HOUR).toISOString(),
      reminderOffsetMinutes: 60,
      location: '10th of Ramadan Industrial City',
      assigneeUserId: 'u3',
    }),
    makeActivity(4, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'CALL',
      subject: 'Initial qualification call',
      direction: 'OUTBOUND',
      priority: 'NORMAL',
      status: 'DONE',
      dueAt: new Date(todayStart + 10 * MIN).toISOString(),
      endsAt: new Date(todayStart + 40 * MIN).toISOString(),
      completedAt: completedTodayIso,
      outcome: 'Completed as planned',
      assigneeUserId: 'u1',
    }),
    makeActivity(5, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'EMAIL',
      subject: 'Send pricing proposal and SLA',
      direction: 'OUTBOUND',
      priority: 'HIGH',
      status: 'DONE',
      dueAt: new Date(now - 2 * DAY).toISOString(),
      completedAt: new Date(now - 2 * DAY + 15 * MIN).toISOString(),
      outcome: 'Summary and next steps sent',
      assigneeUserId: 'u1',
    }),
    makeActivity(6, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'TODO',
      subject: 'Prepare ERP module comparison sheet',
      priority: 'NORMAL',
      status: 'DONE',
      dueAt: new Date(now - 4 * DAY).toISOString(),
      completedAt: new Date(now - 4 * DAY + 2 * HOUR).toISOString(),
      outcome: 'Shared matrix with sales engineering team.',
      assigneeUserId: 'u2',
    }),
    makeActivity(7, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'FOLLOW_UP',
      subject: 'Check feedback after brochure delivery',
      priority: 'LOW',
      status: 'DONE',
      dueAt: new Date(now - 5 * DAY).toISOString(),
      completedAt: new Date(now - 5 * DAY + HOUR).toISOString(),
      outcome: 'Follow-up needed next week',
      assigneeUserId: 'u1',
    }),
    makeActivity(8, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'MEETING',
      subject: 'Preliminary stakeholder alignment',
      priority: 'NORMAL',
      status: 'CANCELLED',
      dueAt: new Date(now - 3 * DAY).toISOString(),
      endsAt: new Date(now - 3 * DAY + HOUR).toISOString(),
      location: 'Maadi Business Park',
      cancelledAt: new Date(now - 3 * DAY - HOUR).toISOString(),
      outcome: 'Rescheduled to another time',
      assigneeUserId: 'u2',
    }),
    makeActivity(9, { app: 'CRM', type: 'LEAD', id: 'lead-001' }, {
      type: 'OTHER',
      subject: 'Verify trade registration documents',
      priority: 'LOW',
      status: 'CANCELLED',
      dueAt: new Date(now - 6 * DAY).toISOString(),
      cancelledAt: new Date(now - 6 * DAY - 30 * MIN).toISOString(),
      outcome: 'Handled on another channel',
      assigneeUserId: 'u3',
    }),
    makeActivity(10, { app: 'CRM', type: 'LEAD', id: 'lead-002' }, {
      type: 'FOLLOW_UP',
      subject: 'Follow up on cold-chain quote revision',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(now - 2 * DAY).toISOString(),
      assigneeUserId: 'u1',
    }),
    makeActivity(11, { app: 'CRM', type: 'LEAD', id: 'lead-002' }, {
      type: 'VISIT',
      subject: 'Distribution hub discovery visit',
      priority: 'NORMAL',
      status: 'DONE',
      dueAt: new Date(now - DAY - 3 * HOUR).toISOString(),
      endsAt: new Date(now - DAY - 2 * HOUR).toISOString(),
      location: 'Mansoura Industrial Zone',
      completedAt: new Date(now - DAY - 2 * HOUR).toISOString(),
      outcome: 'Completed as planned',
      assigneeUserId: 'u2',
    }),
    makeActivity(12, { app: 'CRM', type: 'LEAD', id: 'lead-004' }, {
      type: 'TODO',
      subject: 'Draft multi-property licensing quote',
      description: 'Include Red Sea Resorts properties in Hurghada and Sharm.',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(todayTodoDueMs).toISOString(),
      assigneeUserId: 'u1',
    }),
    makeActivity(13, { app: 'CRM', type: 'LEAD', id: 'lead-005' }, {
      type: 'EMAIL',
      subject: 'Send compliance checklist to QA lead',
      direction: 'OUTBOUND',
      priority: 'NORMAL',
      status: 'PLANNED',
      dueAt: new Date(now + 3 * DAY).toISOString(),
      reminderOffsetMinutes: 1440,
      assigneeUserId: 'u3',
    }),
    makeActivity(14, { app: 'CRM', type: 'LEAD', id: 'lead-006' }, {
      type: 'CALL',
      subject: 'Inbound inquiry regarding textile ERP',
      direction: 'INBOUND',
      priority: 'LOW',
      status: 'CANCELLED',
      dueAt: new Date(now - DAY - 5 * HOUR).toISOString(),
      endsAt: new Date(now - DAY - 4.5 * HOUR).toISOString(),
      cancelledAt: new Date(now - DAY - 6 * HOUR).toISOString(),
      outcome: 'No longer needed',
      assigneeUserId: 'u2',
    }),
    makeActivity(15, { app: 'CRM', type: 'CUSTOMER_PROFILE', id: 'cust-001' }, {
      type: 'CALL',
      subject: 'Quarterly account health check-in',
      description: 'Confirm renewal timeline and additional branch seats.',
      direction: 'OUTBOUND',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(now - 6 * HOUR).toISOString(),
      endsAt: new Date(now - 5.5 * HOUR).toISOString(),
      reminderOffsetMinutes: 15,
      assigneeUserId: 'u2',
    }),
    makeActivity(16, { app: 'CRM', type: 'CUSTOMER_PROFILE', id: 'cust-002' }, {
      type: 'MEETING',
      subject: 'Alexandria port rollout kick-off',
      description: 'Align customs integration milestones with client operations lead.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      dueAt: new Date(todaySecondDueMs).toISOString(),
      endsAt: new Date(todaySecondDueMs + HOUR).toISOString(),
      reminderOffsetMinutes: 30,
      location: 'Alexandria Marina Hub',
      meetingUrl: 'https://meet.example.com/med-shipping',
      assigneeUserId: 'u1',
    }),
    makeActivity(17, { app: 'TRADE', type: 'QUOTATION', id: 'qt-2026-014' }, {
      type: 'FOLLOW_UP',
      subject: 'Follow up on quotation QT-2026-014 approval',
      description: 'Verify final discount terms with procurement committee.',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(todayThirdDueMs).toISOString(),
      reminderOffsetMinutes: 15,
      assigneeUserId: 'u1',
    }),
    makeActivity(18, { app: 'TRADE', type: 'QUOTATION', id: 'qt-2026-019' }, {
      type: 'EMAIL',
      subject: 'Dispatch revised commercial terms for QT-2026-019',
      direction: 'OUTBOUND',
      priority: 'NORMAL',
      status: 'PLANNED',
      dueAt: new Date(now + 4 * DAY).toISOString(),
      reminderOffsetMinutes: 60,
      assigneeUserId: 'u3',
    }),
    makeActivity(19, { app: 'TRADE', type: 'SALES_ORDER', id: 'so-2026-008' }, {
      type: 'VISIT',
      subject: 'Pre-delivery site readiness inspection',
      description: 'Inspect loading bay and barcode scanners prior to dispatch.',
      priority: 'NORMAL',
      status: 'PLANNED',
      dueAt: new Date(now + 5 * DAY).toISOString(),
      endsAt: new Date(now + 5 * DAY + 90 * MIN).toISOString(),
      location: 'Sixth of October Industrial Park',
      assigneeUserId: 'u2',
    }),
    makeActivity(20, { app: 'CRM', type: 'OPPORTUNITY', id: 'opp-001' }, {
      type: 'MEETING',
      subject: 'Executive commercial sign-off review',
      priority: 'HIGH',
      status: 'PLANNED',
      dueAt: new Date(now + DAY).toISOString(),
      endsAt: new Date(now + DAY + 45 * MIN).toISOString(),
      meetingUrl: 'https://meet.example.com/nile-exec',
      assigneeUserId: 'u1',
    }),
    makeActivity(21, { app: 'CORE', type: 'PARTY', id: 'party-001' }, {
      type: 'TODO',
      subject: 'Validate tax card and VAT registration certificate',
      priority: 'NORMAL',
      status: 'DONE',
      dueAt: new Date(todayStart + 15 * MIN).toISOString(),
      completedAt: completedTodayIso,
      outcome: 'Completed as planned',
      assigneeUserId: 'u3',
    }),
    makeActivity(22, { app: 'TRADE', type: 'SALES_ORDER', id: 'so-2026-011' }, {
      type: 'CALL',
      subject: 'Coordinate partial shipment schedule with warehouse',
      direction: 'OUTBOUND',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      dueAt: new Date(now - DAY - 2 * HOUR).toISOString(),
      endsAt: new Date(now - DAY - 90 * MIN).toISOString(),
      assigneeUserId: 'u3',
    }),
    makeActivity(23, { app: 'CORE', type: 'PARTY', id: 'party-002' }, {
      type: 'OTHER',
      subject: 'Archive duplicate shipping branch profile',
      priority: 'LOW',
      status: 'CANCELLED',
      dueAt: new Date(now - 3 * DAY - 2 * HOUR).toISOString(),
      cancelledAt: new Date(now - 3 * DAY - 3 * HOUR).toISOString(),
      outcome: 'Handled on another channel',
      assigneeUserId: 'u2',
    }),
    makeActivity(24, { app: 'CRM', type: 'OPPORTUNITY', id: 'opp-002' }, {
      type: 'FOLLOW_UP',
      subject: 'Confirm hardware BOM sign-off for port terminals',
      priority: 'URGENT',
      status: 'PLANNED',
      dueAt: new Date(todayFourthDueMs).toISOString(),
      reminderOffsetMinutes: 10,
      assigneeUserId: 'u1',
    }),
  ];
}

let activities: Activity[] = seed();
let nextSeq = 25;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface IdempotencyRecord {
  fingerprint: string;
  response: Activity;
}

/** `activity_idempotency`: scoped by actor + operation (+ activity id for mutations) + key. */
const idempotencyStore = new Map<string, IdempotencyRecord>();

/** Test hook: restores the seed, the sequence and the idempotency store. */
export function resetActivitiesFake(): void {
  activities = seed();
  nextSeq = 25;
  idempotencyStore.clear();
  fakeDelayMs = 300;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

/**
 * `ActivityIdempotencyService.execute`: a UUIDv7 key is required (422 ACTIVITY_IDEMPOTENCY_KEY_INVALID);
 * the same key with the same request replays the stored response; with a different request it is
 * 422 ACTIVITY_IDEMPOTENCY_MISMATCH. Failed work is rolled back, so errors are never stored.
 * `undefined` key = in-repo fake callers (bulk fake modules) that bypass the HTTP layer.
 */
function withIdempotency(
  operation: string,
  idempotencyKey: string | undefined,
  request: unknown,
  work: () => Activity,
): Activity {
  if (idempotencyKey === undefined) return work();
  const key = idempotencyKey.toLowerCase();
  if (!UUID_V7.test(key)) {
    throw new ActivityError('ACTIVITY_IDEMPOTENCY_KEY_INVALID');
  }
  const storeKey = `${FAKE_CURRENT_USER_ID}:${operation}:${key}`;
  const fingerprint = stableJson(request);
  const stored = idempotencyStore.get(storeKey);
  if (stored) {
    if (stored.fingerprint !== fingerprint) {
      throw new ActivityError('ACTIVITY_IDEMPOTENCY_MISMATCH');
    }
    return cloneActivity(stored.response);
  }
  const response = work();
  idempotencyStore.set(storeKey, { fingerprint, response: cloneActivity(response) });
  return response;
}

/** `parseIfMatch` in activities.controller.ts: a positive safe integer, else 428. */
function assertVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ActivityError('ACTIVITY_VERSION_REQUIRED');
  }
}

/** class-validator `@IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(n)` on the raw value. */
function assertRequiredText(value: unknown, max: number, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || !/\S/u.test(value)) {
    throw activityValidationError(field, `${field} should not be empty`);
  }
  if (value.length > max) {
    throw activityValidationError(field, `${field} must be shorter than or equal to ${max} characters`);
  }
}

/** class-validator `@IsString() @MaxLength(n)` when present (null and undefined skip). */
function assertOptionalText(value: unknown, max: number, field: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    throw activityValidationError(field, `${field} must be a string`);
  }
  if (value.length > max) {
    throw activityValidationError(field, `${field} must be shorter than or equal to ${max} characters`);
  }
}

/** `@IsDateString({ strict: true })`. */
function assertIsoDate(value: unknown, field: string): number {
  const ms = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw activityValidationError(field, `${field} must be a valid ISO 8601 date string`);
  }
  return ms;
}

/** `optionalText` in activity.rules.ts: trimmed, blank means absent. */
function optionalText(value: string | null | undefined): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

interface NormalizedScope {
  branchId?: string;
  assigneeUserId?: string;
  targetApp?: TargetApp;
  targetType?: string;
  targetId?: string;
  types?: readonly Activity['type'][];
  priorities?: readonly Activity['priority'][];
  dueFromMs?: number;
  dueToMs?: number;
  search?: string;
}

function normalizeTarget(target: ActivityTargetSelector): { targetApp: TargetApp; targetType: string; targetId: string } {
  if ('targetApp' in target) {
    return target;
  }
  return { targetApp: target.app, targetType: target.type, targetId: target.id };
}

function matchesTargetExact(
  activity: Activity,
  target: { targetApp: TargetApp; targetType: string; targetId: string },
): boolean {
  return activity.targets.some(
    (item) =>
      item.targetApp === target.targetApp &&
      item.targetType === target.targetType &&
      item.targetId === target.targetId,
  );
}

function parseScopeFilter(scope: ActivityScopeFilter & { app?: TargetApp; type?: string; id?: string }): NormalizedScope {
  const targetApp = scope.targetApp ?? scope.app;
  const targetType = scope.targetType ?? scope.type;
  const targetId = scope.targetId ?? scope.id;

  // DTO first (400), then activity.rules (422, message only).
  assertOptionalText(targetType, 40, 'targetType');
  assertOptionalText(scope.search, SEARCH_MAX, 'search');
  const dueFromMs = scope.dueFrom !== undefined ? assertIsoDate(scope.dueFrom, 'dueFrom') : undefined;
  const dueToMs = scope.dueTo !== undefined ? assertIsoDate(scope.dueTo, 'dueTo') : undefined;

  if (targetApp === undefined && (targetType !== undefined || targetId !== undefined)) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
  if (targetId !== undefined && targetType === undefined) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
  if (targetApp !== undefined && targetType !== undefined) {
    assertTargetTuple(targetApp, targetType);
  }
  if (dueFromMs !== undefined && dueToMs !== undefined && dueFromMs >= dueToMs) {
    throw new ActivityError('ACTIVITY_INVALID');
  }

  const cleanSearch = scope.search?.trim().toLowerCase();

  return {
    ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
    ...(scope.assigneeUserId !== undefined ? { assigneeUserId: canonicalUserId(scope.assigneeUserId) } : {}),
    ...(targetApp !== undefined ? { targetApp } : {}),
    ...(targetType !== undefined ? { targetType } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(scope.types !== undefined ? { types: scope.types } : {}),
    ...(scope.priorities !== undefined ? { priorities: scope.priorities } : {}),
    ...(dueFromMs !== undefined ? { dueFromMs } : {}),
    ...(dueToMs !== undefined ? { dueToMs } : {}),
    ...(cleanSearch ? { search: cleanSearch } : {}),
  };
}

function matchesScope(item: Activity, scope: NormalizedScope): boolean {
  if (scope.branchId !== undefined && item.branchId !== scope.branchId) {
    return false;
  }
  if (scope.assigneeUserId !== undefined && canonicalUserId(item.assigneeUserId) !== scope.assigneeUserId) {
    return false;
  }
  if (scope.targetApp !== undefined) {
    const hasTarget = item.targets.some(
      (target) =>
        target.targetApp === scope.targetApp &&
        (scope.targetType === undefined || target.targetType === scope.targetType) &&
        (scope.targetId === undefined || target.targetId === scope.targetId),
    );
    if (!hasTarget) return false;
  }
  if (scope.types && scope.types.length > 0 && !scope.types.includes(item.type)) {
    return false;
  }
  if (scope.priorities && scope.priorities.length > 0 && !scope.priorities.includes(item.priority)) {
    return false;
  }
  const dueMs = Date.parse(item.dueAt);
  if (scope.dueFromMs !== undefined && dueMs < scope.dueFromMs) {
    return false;
  }
  if (scope.dueToMs !== undefined && dueMs >= scope.dueToMs) {
    return false;
  }
  if (scope.search !== undefined && !item.subject.toLowerCase().includes(scope.search)) {
    return false;
  }
  return true;
}

function compareDueAsc(a: Activity, b: Activity): number {
  const diff = Date.parse(a.dueAt) - Date.parse(b.dueAt);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

/** `@IsUrl({ protocols: ['http','https'], require_protocol: true }) @Matches(/^https?:\/\/\S+$/) @MaxLength(2048)`. */
function assertMeetingUrl(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') throw activityValidationError('meetingUrl', 'meetingUrl must be a string');
  const url = value.trim();
  if (url === '') return;
  let valid = url.length <= LIMITS.meetingUrl && MEETING_URL.test(url);
  if (valid) {
    try {
      valid = new URL(url).hostname.includes('.');
    } catch {
      valid = false;
    }
  }
  if (!valid) throw activityValidationError('meetingUrl', 'meetingUrl must be a URL address');
}

/** `@IsInt() @Min(0) @Max(40320)` when present. */
function assertReminder(minutes: unknown): void {
  if (minutes === undefined || minutes === null) return;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > LIMITS.reminderMax) {
    throw activityValidationError('reminderOffsetMinutes', 'reminderOffsetMinutes must not be greater than 40320');
  }
}

/** `@Type(() => Date) @IsDate()`. */
function assertDate(value: unknown, field: string): number {
  const ms = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) throw activityValidationError(field, `${field} must be a Date instance`);
  return ms;
}

/** `assertActivityWindow` (422): end after start, at most 14 days. */
function assertWindow(dueMs: number, endsAt: string | null | undefined): void {
  if (endsAt === undefined || endsAt === null) return;
  const endMs = Date.parse(endsAt);
  if (endMs <= dueMs || endMs - dueMs > LIMITS.maxDays * DAY) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
}

/** `mutate` in activities.service.ts: not found (404), then version (409), then open (409). */
function requireEditable(id: string, version: number): Activity {
  const existing = activities.find((item) => item.id === id);
  if (!existing) {
    throw new ActivityError('ACTIVITY_NOT_FOUND');
  }
  if (existing.version !== version) {
    throw new ActivityError('ACTIVITY_VERSION_CONFLICT');
  }
  if (!isOpen(existing)) {
    throw new ActivityError('ACTIVITY_TERMINAL');
  }
  return existing;
}

export async function fakeList(params: ActivityListParams = {}): Promise<ActivityPage> {
  await wait();
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  if (!Number.isInteger(page) || page < 1) throw activityValidationError('page', 'page must not be less than 1');
  if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX_LIMIT) {
    throw activityValidationError('limit', 'limit must not be greater than 100');
  }
  const scope = parseScopeFilter(params);
  const statuses = params.statuses;
  const sortDir = params.sortDir ?? 'ASC';
  const now = new Date();

  const filtered = activities
    .filter((item) => matchesScope(item, scope))
    .filter((item) => !statuses || statuses.length === 0 || statuses.includes(item.status))
    .filter((item) => {
      if (params.overdue === undefined) return true;
      const itemOverdue = dueState(item, now) === 'OVERDUE';
      return params.overdue ? itemOverdue : !itemOverdue;
    })
    .sort((a, b) => (sortDir === 'DESC' ? compareDueAsc(b, a) : compareDueAsc(a, b)));

  // ActivityPageDto (totalPages >= 1) as Core's envelope delivers it: data = items, counters in meta.
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const start = (page - 1) * limit;

  return {
    data: filtered.slice(start, start + limit).map(cloneActivity),
    meta: {
      page,
      limit,
      total: filtered.length,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function fakeSummary(
  scope: ActivitySummaryScope = {},
  dayStart?: string,
  dayEnd?: string,
): Promise<ActivitySummary> {
  await wait();
  // ActivitySummaryQueryDto: dayStart and dayEnd are required ISO strings (400).
  const startMs = assertIsoDate(dayStart, 'dayStart');
  const endMs = assertIsoDate(dayEnd, 'dayEnd');
  const parsedScope = parseScopeFilter(scope);
  if (endMs <= startMs || endMs - startMs > SUMMARY_MAX_SPAN) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
  const nowMs = Date.now();

  let overdue = 0;
  let today = 0;
  let upcoming = 0;
  let completedToday = 0;

  const byStatusMap = new Map<ActivityStatusSummary['status'], ActivityStatusSummary>(
    ACTIVITY_STATUSES.map((status) => [status, { status, total: 0, overdue: 0, today: 0, upcoming: 0 }]),
  );

  for (const item of activities) {
    if (!matchesScope(item, parsedScope)) continue;
    const bucket = byStatusMap.get(item.status)!;
    bucket.total++;

    if (isOpen(item)) {
      const effectiveEndMs = Date.parse(item.endsAt ?? item.dueAt);
      const dueMs = Date.parse(item.dueAt);
      if (effectiveEndMs < nowMs) {
        overdue++;
        bucket.overdue++;
      } else if (dueMs < endMs) {
        today++;
        bucket.today++;
      } else {
        upcoming++;
        bucket.upcoming++;
      }
    } else if (item.status === 'DONE' && item.completedAt) {
      const completedMs = Date.parse(item.completedAt);
      if (completedMs >= startMs && completedMs < endMs) {
        completedToday++;
      }
    }
  }

  return {
    overdue,
    today,
    upcoming,
    completedToday,
    byStatus: ACTIVITY_STATUSES.map((status) => byStatusMap.get(status)!),
  };
}

export async function fakeCalendar(params: ActivityCalendarParams): Promise<ActivityCalendarResponse> {
  await wait();
  const fromMs = assertIsoDate(params.from, 'from');
  const toMs = assertIsoDate(params.to, 'to');
  const scope = parseScopeFilter(params);
  if (toMs <= fromMs || toMs - fromMs > CALENDAR_MAX_DAYS * DAY) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
  const statuses = params.statuses;
  const now = new Date();

  const matched = activities
    .filter((item) => matchesScope(item, scope))
    .filter((item) => !statuses || statuses.length === 0 || statuses.includes(item.status))
    .filter((item) => {
      if (params.overdue === undefined) return true;
      const itemOverdue = dueState(item, now) === 'OVERDUE';
      return params.overdue ? itemOverdue : !itemOverdue;
    })
    .filter((item) => {
      const startMs = Date.parse(item.dueAt);
      const endMs = item.endsAt ? Date.parse(item.endsAt) : startMs;
      return startMs < toMs && endMs >= fromMs;
    })
    .sort(compareDueAsc);

  return {
    items: matched.slice(0, CALENDAR_ITEM_LIMIT).map(cloneActivity),
    truncated: matched.length > CALENDAR_ITEM_LIMIT,
  };
}

export async function fakeTargets(params: ActivityTargetsParams): Promise<ActivityTargetOption[]> {
  await wait();
  assertRequiredText(params.targetType, 40, 'targetType');
  assertOptionalText(params.search, PICKER_SEARCH_MAX, 'search');
  assertTargetTuple(params.targetApp, params.targetType);
  const cleanSearch = params.search?.trim().toLowerCase() ?? '';

  return SEEDED_TARGETS.filter(
    (item) =>
      item.targetApp === params.targetApp &&
      item.targetType === params.targetType &&
      (!params.branchId || item.branchId === params.branchId) &&
      (!cleanSearch || item.label.toLowerCase().includes(cleanSearch)),
  )
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, TARGETS_LIMIT)
    .map((item) => ({ ...item }));
}

export async function fakeActivityTypes(): Promise<ActivityTypeDefinition[]> {
  await wait();
  return ACTIVITY_TYPE_DEFINITIONS.map((def) => ({ ...def }));
}

export async function fakeCount(target: ActivityTargetSelector): Promise<number> {
  await wait();
  const normalized = normalizeTarget(target);
  return activities.filter((item) => matchesTargetExact(item, normalized)).length;
}

export async function fakeGet(id: string): Promise<Activity> {
  await wait();
  const found = activities.find((item) => item.id === id);
  if (!found) {
    throw new ActivityError('ACTIVITY_NOT_FOUND');
  }
  return cloneActivity(found);
}

/** `GET activities/assignees`: ActivityAssigneesQueryDto requires targetApp, targetType and targetId (400). */
export async function fakeAssignees(target?: ActivityAssigneesParams): Promise<Assignee[]> {
  await wait();
  if (!target) {
    throw activityValidationError('targetApp', 'targetApp must be one of the following values: CRM, CORE, TRADE');
  }
  assertRequiredText(target.targetType, 40, 'targetType');
  if (!target.targetId?.trim()) throw activityValidationError('targetId', 'targetId must be a UUID');
  assertOptionalText(target.search, PICKER_SEARCH_MAX, 'search');
  assertTargetTuple(target.targetApp, target.targetType);
  const cleanSearch = target.search?.trim().toLowerCase() ?? '';

  return ASSIGNEES.filter((user) => !cleanSearch || user.name.toLowerCase().includes(cleanSearch))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, ASSIGNEES_LIMIT)
    .map((user) => ({ ...user }));
}

/** class-validator `CreateActivityDto` (400), in declaration order. */
function validateCreateDto(body: CreateActivity): void {
  if (!body.target) throw activityValidationError('target', 'target should not be null or undefined');
  assertRequiredText(body.target.type, 40, 'target.type');
  if (typeof body.target.id !== 'string' || !body.target.id.trim()) {
    throw activityValidationError('target.id', 'target.id must be a UUID');
  }
  assertRequiredText(body.subject, LIMITS.subject, 'subject');
  assertOptionalText(body.description, LIMITS.description, 'description');
  assertDate(body.dueAt, 'dueAt');
  assertReminder(body.reminderOffsetMinutes);
  if (body.endsAt !== undefined && body.endsAt !== null) assertDate(body.endsAt, 'endsAt');
  assertOptionalText(body.location, LIMITS.location, 'location');
  assertMeetingUrl(body.meetingUrl);
  assertOptionalText(body.outcome, LIMITS.outcome, 'outcome');
}

/** class-validator `UpdateActivityDto` (400). */
function validateUpdateDto(changes: UpdateActivity): void {
  if (changes.subject !== undefined) assertRequiredText(changes.subject, LIMITS.subject, 'subject');
  assertOptionalText(changes.description, LIMITS.description, 'description');
  if (changes.dueAt !== undefined) assertDate(changes.dueAt, 'dueAt');
  assertReminder(changes.reminderOffsetMinutes);
  if (changes.endsAt !== undefined && changes.endsAt !== null) assertDate(changes.endsAt, 'endsAt');
  assertOptionalText(changes.location, LIMITS.location, 'location');
  assertMeetingUrl(changes.meetingUrl);
}

/**
 * `POST tenant/activities`. `idempotencyKey` is the `x-idempotency-key` header (the api layer always sends one).
 * Order: DTO (400) → idempotency (422) → target tuple (422) → schedule rules (422).
 */
export async function fakeCreate(body: CreateActivity, idempotencyKey?: string): Promise<Activity> {
  await wait();
  validateCreateDto(body);
  return withIdempotency('activity.create', idempotencyKey, body, () => {
    assertTargetTuple(body.target.app, body.target.type);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const status = body.status ?? 'PLANNED';
    const dueMs = Date.parse(body.dueAt);
    const outcome = optionalText(body.outcome);

    // assertCreateSchedule
    if (status === 'PLANNED' && dueMs <= now) throw new ActivityError('ACTIVITY_INVALID');
    if (status === 'DONE' && dueMs > now + 5 * MIN) throw new ActivityError('ACTIVITY_INVALID');
    if (outcome !== null && status !== 'DONE') throw new ActivityError('ACTIVITY_INVALID');
    assertWindow(dueMs, body.endsAt);

    const id = 'act-' + String(nextSeq++).padStart(3, '0');
    const assigneeUserId = body.assigneeUserId ?? FAKE_CURRENT_USER_ID;
    const knownTarget = findSeededTarget(body.target.app, body.target.type, body.target.id);
    const created: Activity = {
      id,
      type: body.type,
      subject: body.subject.trim(),
      description: optionalText(body.description),
      direction: body.direction ?? null,
      priority: body.priority ?? 'NORMAL',
      status,
      dueAt: body.dueAt,
      endsAt: body.endsAt ?? null,
      reminderOffsetMinutes: body.reminderOffsetMinutes ?? null,
      reminderSentAt: null,
      location: optionalText(body.location),
      meetingUrl: optionalText(body.meetingUrl),
      completedAt: status === 'DONE' ? nowIso : null,
      cancelledAt: null,
      outcome: status === 'DONE' ? outcome : null,
      assigneeUserId,
      assigneeName: userName(assigneeUserId),
      createdByUserId: FAKE_CURRENT_USER_ID,
      createdByName: userName(FAKE_CURRENT_USER_ID),
      branchId: knownTarget?.branchId ?? BRANCH_CAIRO,
      companyId: COMPANY_ID,
      // CREATED is always PLANNED; starting or logging it is a second lifecycle step.
      version: status === 'PLANNED' ? 1 : 2,
      createdAt: nowIso,
      updatedAt: nowIso,
      targets: [
        {
          id: 'tgt-' + id,
          role: 'PRIMARY',
          targetApp: body.target.app,
          targetType: body.target.type,
          targetId: body.target.id,
          label: knownTarget?.label ?? body.target.id,
          route: targetRoute(body.target.app, body.target.type, body.target.id),
          targetVersion: knownTarget ? '1' : null,
          unavailableAt: null,
        },
      ],
    };

    activities = [created, ...activities];
    return cloneActivity(created);
  });
}

function saveActivity(updated: Activity): Activity {
  activities = activities.map((item) => (item.id === updated.id ? updated : item));
  return cloneActivity(updated);
}

/** `PATCH tenant/activities/:id`: DTO (400) → If-Match (428) → empty (422) → idempotency → 404 → 409 → rules. */
export async function fakeUpdate(
  id: string,
  version: number,
  changes: UpdateActivity,
  idempotencyKey?: string,
): Promise<Activity> {
  await wait();
  validateUpdateDto(changes);
  assertVersion(version);
  if (Object.values(changes).every((value) => value === undefined)) {
    throw new ActivityError('ACTIVITY_INVALID');
  }
  return withIdempotency(`activity.update:${id}`, idempotencyKey, { expectedVersion: version, request: changes }, () => {
    const existing = requireEditable(id, version);
    const dueAt = changes.dueAt ?? existing.dueAt;
    // applyActivityChanges: only a PLANNED activity that is re-timed must lie ahead.
    if (existing.status === 'PLANNED' && changes.dueAt !== undefined && Date.parse(changes.dueAt) !== Date.parse(existing.dueAt)) {
      if (Date.parse(changes.dueAt) <= Date.now()) throw new ActivityError('ACTIVITY_INVALID');
    }
    const endsAt = changes.endsAt !== undefined ? changes.endsAt : existing.endsAt;
    assertWindow(Date.parse(dueAt), endsAt);

    const assigneeUserId = changes.assigneeUserId ?? existing.assigneeUserId;
    const reminderOffsetMinutes =
      changes.reminderOffsetMinutes !== undefined ? changes.reminderOffsetMinutes : existing.reminderOffsetMinutes;
    const next: Activity = {
      ...existing,
      type: changes.type ?? existing.type,
      subject: changes.subject !== undefined ? changes.subject.trim() : existing.subject,
      description: changes.description !== undefined ? optionalText(changes.description) : existing.description,
      direction: changes.direction !== undefined ? changes.direction : existing.direction,
      priority: changes.priority ?? existing.priority,
      dueAt,
      endsAt,
      reminderOffsetMinutes,
      location: changes.location !== undefined ? optionalText(changes.location) : existing.location,
      meetingUrl: changes.meetingUrl !== undefined ? optionalText(changes.meetingUrl) : existing.meetingUrl,
      assigneeUserId,
      assigneeName: userName(assigneeUserId),
    };
    const reminderChanged =
      Date.parse(dueAt) !== Date.parse(existing.dueAt) ||
      reminderOffsetMinutes !== existing.reminderOffsetMinutes ||
      assigneeUserId !== existing.assigneeUserId;
    if (reminderChanged) next.reminderSentAt = null;

    const fields: (keyof Activity)[] = [
      'type', 'subject', 'description', 'direction', 'priority', 'dueAt', 'endsAt',
      'reminderOffsetMinutes', 'location', 'meetingUrl', 'assigneeUserId',
    ];
    // No real change: no save and no version bump.
    if (fields.every((field) => next[field] === existing[field])) return cloneActivity(existing);
    return saveActivity({ ...next, version: existing.version + 1, updatedAt: new Date().toISOString() });
  });
}

/** `POST tenant/activities/:id/status` (200). The current status is a no-op without a version bump. */
export async function fakeSetStatus(
  id: string,
  version: number,
  status: 'PLANNED' | 'IN_PROGRESS',
  idempotencyKey?: string,
): Promise<Activity> {
  await wait();
  if (status !== 'PLANNED' && status !== 'IN_PROGRESS') {
    throw activityValidationError('status', 'status must be one of the following values: PLANNED, IN_PROGRESS');
  }
  assertVersion(version);
  return withIdempotency(`activity.status:${id}`, idempotencyKey, { expectedVersion: version, request: { status } }, () => {
    const existing = requireEditable(id, version);
    if (existing.status === status) return cloneActivity(existing);
    return saveActivity({ ...existing, status, version: existing.version + 1, updatedAt: new Date().toISOString() });
  });
}

/** `POST tenant/activities/:id/complete` (200), body `{ outcome? }` (max 2000). */
export async function fakeComplete(
  id: string,
  version: number,
  outcome?: string | null,
  idempotencyKey?: string,
): Promise<Activity> {
  await wait();
  assertOptionalText(outcome, LIMITS.outcome, 'outcome');
  assertVersion(version);
  const request = outcome === undefined || outcome === null ? {} : { outcome };
  return withIdempotency(`activity.complete:${id}`, idempotencyKey, { expectedVersion: version, request }, () => {
    const existing = requireEditable(id, version);
    const nowIso = new Date().toISOString();
    return saveActivity({
      ...existing,
      status: 'DONE',
      completedAt: nowIso,
      outcome: optionalText(outcome),
      version: existing.version + 1,
      updatedAt: nowIso,
    });
  });
}

/** `POST tenant/activities/:id/cancel` (200), body `{ reason? }` (max 2000); the reason is stored in `outcome`. */
export async function fakeCancel(
  id: string,
  version: number,
  reason?: string | null,
  idempotencyKey?: string,
): Promise<Activity> {
  await wait();
  assertOptionalText(reason, LIMITS.outcome, 'reason');
  assertVersion(version);
  const request = reason === undefined || reason === null ? {} : { reason };
  return withIdempotency(`activity.cancel:${id}`, idempotencyKey, { expectedVersion: version, request }, () => {
    const existing = requireEditable(id, version);
    const nowIso = new Date().toISOString();
    return saveActivity({
      ...existing,
      status: 'CANCELLED',
      cancelledAt: nowIso,
      outcome: optionalText(reason),
      version: existing.version + 1,
      updatedAt: nowIso,
    });
  });
}

export function fakeBumpVersion(id: string): void {
  activities = activities.map((item) => (item.id === id ? { ...item, version: item.version + 1 } : item));
}
