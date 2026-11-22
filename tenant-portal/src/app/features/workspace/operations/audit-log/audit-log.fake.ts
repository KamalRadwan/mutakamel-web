import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB } from '../../../crm/customers/customers.fake';
import { fakeGetLead, fakeLeadPartyId } from '../../../crm/leads/leads.fake';
import { ACME_OPPORTUNITY_ID, fakeAllOpportunityRows } from '../../../crm/opportunities/opportunities.fake';
import { opportunityRef } from '../../../crm/opportunities/opportunities.model';
import { ApiError } from '../../staff/shared/staff.api';
import { buildActorMeSync } from '../../staff/shared/staff.fake';
import { Me } from '../../staff/shared/staff.model';
import {
  AUDIT_LIMITS,
  AUDIT_OUTCOMES,
  AUDIT_SENSITIVITIES,
  AUDIT_SOURCE_APPS,
  AUDIT_SOURCE_KINDS,
  AUDIT_HISTORY_CATEGORIES,
  AuditDeletedQuery,
  AuditDiffItem,
  AuditEvent,
  AuditHistoryCategory,
  AuditHistoryChange,
  AuditHistoryGroup,
  AuditHistoryPage,
  AuditHistorySubjectKind,
  AuditOutcome,
  AuditPage,
  AuditQuery,
  AuditRelatedHistoryQuery,
  computeEventDiff,
  RecordHistoryQuery,
  RecordHistoryTarget,
  AuditSensitivity,
  AuditSourceApp,
  AuditSourceKind,
} from './audit-log.model';

const TENANT_ID = '019a4f10-0000-7000-8000-000000000001';

const APP_SET = new Set<string>(AUDIT_SOURCE_APPS);
const KIND_SET = new Set<string>(AUDIT_SOURCE_KINDS);
const OUTCOME_SET = new Set<string>(AUDIT_OUTCOMES);
const SENSITIVITY_SET = new Set<string>(AUDIT_SENSITIVITIES);

interface FakeActorProfile {
  id: string;
  name: string;
  branchId: string;
}

const FAKE_ACTORS: readonly FakeActorProfile[] = [
  { id: 'u-owner', name: 'Kamal Radwan', branchId: 'br-cai' },
  { id: 'u-mona', name: 'Mona El-Sayed', branchId: 'br-cai' },
  { id: 'u-omar', name: 'Omar Fathy', branchId: 'br-cai' },
  { id: 'u-nada', name: 'Nada Ibrahim', branchId: 'br-cai' },
  { id: 'u-youssef', name: 'Youssef Adel', branchId: 'br-cai' },
  { id: 'u-faisal', name: 'Faisal Al-Dosari', branchId: 'br-ruh' },
  { id: 'u-hany', name: 'Hany Nabil', branchId: 'br-alx' },
];

const BRANCH_IDS = ['br-cai', 'br-alx', 'br-mns', 'br-ruh', 'br-jed'] as const;

const IPS = ['196.219.44.18', '41.44.112.90', '154.178.63.12', '82.148.99.205', '102.45.18.77'] as const;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
] as const;

const DELETED_LABELS = [
  { label: 'Nile Logistics', entityType: 'Party', app: 'CRM' as const },
  { label: 'Nile Delta Foods', entityType: 'Lead', app: 'CRM' as const },
  { label: 'Nile Valley Trading', entityType: 'Party', app: 'TRADE' as const },
  { label: 'Delta Medical Supplies', entityType: 'Lead', app: 'CRM' as const },
  { label: 'Cairo Tech Solutions', entityType: 'Opportunity', app: 'CRM' as const },
  { label: 'Red Sea Shipping', entityType: 'Party', app: 'CORE' as const },
  { label: 'Sahara Solar Energy', entityType: 'Quotation', app: 'TRADE' as const },
  { label: 'Pharaoh Packaging', entityType: 'Activity', app: 'CRM' as const },
  { label: 'Alexandria Port Services', entityType: 'Party', app: 'CORE' as const },
  { label: 'Riyadh Oasis Group', entityType: 'Lead', app: 'CRM' as const },
  { label: 'Obsolete Sales Rep Draft', entityType: 'Role', app: 'CORE' as const },
  { label: 'Legacy Warehouse Order #408', entityType: 'Invoice', app: 'ACCOUNTING' as const },
] as const;

const ENTITY_SAMPLES: readonly {
  entityType: string;
  labels: readonly string[];
  app: AuditSourceApp;
}[] = [
  {
    entityType: 'Lead',
    labels: [
      'Al-Ahram Construction',
      'Nile Logistics',
      'Sinai Pharmaceuticals',
      'Delta Agro Industries',
      'Upper Egypt Textiles',
      'Gulf Horizon Ventures',
    ],
    app: 'CRM',
  },
  {
    entityType: 'Party',
    labels: [
      'MedCoast Distributors',
      'Nile Valley Trading',
      'Pyramid Steel Co.',
      'Jeddah Freight Partners',
      'Suez Maritime Agency',
    ],
    app: 'CORE',
  },
  {
    entityType: 'TenantUser',
    labels: ['Omar Fathy', 'Nada Ibrahim', 'Hany Nabil', 'Noura Al-Otaibi', 'Faisal Al-Dosari'],
    app: 'CORE',
  },
  {
    entityType: 'Role',
    labels: ['Sales manager', 'Sales rep', 'Branch accountant', 'HR viewer'],
    app: 'CORE',
  },
  {
    entityType: 'Activity',
    labels: [
      'Quarterly contract follow-up call',
      'Onboarding kickoff meeting',
      'Send revised proposal email',
      'Warehouse inspection visit',
    ],
    app: 'CRM',
  },
  {
    entityType: 'CrmNote',
    labels: [
      'Procurement timeline note',
      'Credit terms call summary',
      'Decision maker introduction',
    ],
    app: 'CRM',
  },
  {
    entityType: 'Opportunity',
    labels: ['Annual ERP Rollout — Cairo', 'Fleet Expansion Q4', 'POS Hardware Supply'],
    app: 'CRM',
  },
  {
    entityType: 'Quotation',
    labels: ['QT-2026-0412', 'QT-2026-0418', 'QT-2026-0425'],
    app: 'TRADE',
  },
  {
    entityType: 'Invoice',
    labels: ['INV-2026-1094', 'INV-2026-1102', 'INV-2026-1118'],
    app: 'ACCOUNTING',
  },
  {
    entityType: 'Branch',
    labels: ['Cairo HQ', 'Alexandria', 'Riyadh HQ', 'Jeddah'],
    app: 'CORE',
  },
  {
    entityType: 'Company',
    labels: ['Mutakamel Egypt', 'Mutakamel KSA'],
    app: 'CORE',
  },
  {
    entityType: 'AddonSeat',
    labels: ['CRM Outbound Email — Nada Ibrahim', 'Trade Seat — Faisal Al-Dosari'],
    app: 'CORE',
  },
  {
    entityType: 'Session',
    labels: ['Web Portal Session', 'Mobile Companion Session'],
    app: 'GATEWAY',
  },
  {
    entityType: 'Template',
    labels: ['Tax Invoice A4', 'Welcome Onboarding Email'],
    app: 'WORKER',
  },
];

const ACTION_SCENARIOS: readonly {
  action: string;
  entityType: string;
  app: AuditSourceApp;
  kind: AuditSourceKind;
  sensitivity: AuditSensitivity;
}[] = [
  { action: 'LEAD_STAGE_CHANGED', entityType: 'Lead', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'LEAD_CREATED', entityType: 'Lead', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'LOW' },
  { action: 'LEAD_UPDATED', entityType: 'Lead', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'LEAD_ASSIGNED', entityType: 'Lead', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'LEAD_CONVERTED', entityType: 'Lead', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'PARTY_CREATED', entityType: 'Party', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'LOW' },
  { action: 'PARTY_UPDATED', entityType: 'Party', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'ACTIVITY_CREATED', entityType: 'Activity', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'LOW' },
  { action: 'ACTIVITY_COMPLETED', entityType: 'Activity', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'LOW' },
  { action: 'CREATE', entityType: 'CrmNote', app: 'CRM', kind: 'DOMAIN_MUTATION', sensitivity: 'LOW' },
  { action: 'UPDATE', entityType: 'Branch', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'USER_INVITED', entityType: 'TenantUser', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'USER_SUSPENDED', entityType: 'TenantUser', app: 'HR', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'USER_ACTIVATED', entityType: 'TenantUser', app: 'HR', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'ROLE_ASSIGNED', entityType: 'Role', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'Role', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'SEAT_ALLOCATED', entityType: 'AddonSeat', app: 'CORE', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'QUOTATION_CREATED', entityType: 'Quotation', app: 'TRADE', kind: 'DOMAIN_MUTATION', sensitivity: 'NORMAL' },
  { action: 'INVOICE_ISSUED', entityType: 'Invoice', app: 'ACCOUNTING', kind: 'DOMAIN_MUTATION', sensitivity: 'HIGH' },
  { action: 'JOURNAL_POSTED', entityType: 'Invoice', app: 'ACCOUNTING', kind: 'BROKER_CONSUMER', sensitivity: 'NORMAL' },
  { action: 'LOGIN_SUCCEEDED', entityType: 'Session', app: 'GATEWAY', kind: 'SECURITY_EVENT', sensitivity: 'NORMAL' },
  { action: 'LOGIN_FAILED', entityType: 'Session', app: 'GATEWAY', kind: 'SECURITY_EVENT', sensitivity: 'HIGH' },
  { action: 'SESSION_REVOKED', entityType: 'Session', app: 'REALTIME', kind: 'SECURITY_EVENT', sensitivity: 'HIGH' },
  { action: 'WEBHOOK_DELIVERY_RETRIED', entityType: 'Template', app: 'WORKER', kind: 'CRON_JOB', sensitivity: 'LOW' },
  { action: 'TAX_PROFILE_SYNCED', entityType: 'Company', app: 'ACCOUNTING', kind: 'DB_FALLBACK', sensitivity: 'LOW' },
];

const FAILURE_REASONS = [
  'Invalid credentials provided for tenant portal session',
  'Branch addon seat capacity reached for CRM module',
  'Missing required permissions to modify system role profile',
  'Optimistic lock version mismatch on target record',
  'Target branch is inactive and cannot accept assignments',
] as const;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededUuid(index: number, salt: number, rng: () => number): string {
  const tsPart = (0x019a5000 + index).toString(16).padStart(8, '0').slice(-8);
  const mid = (salt & 0xffff).toString(16).padStart(4, '0');
  const v7 = `7${Math.floor(rng() * 0x0fff)
    .toString(16)
    .padStart(3, '0')}`;
  const clk = `${(8 + Math.floor(rng() * 4)).toString(16)}${Math.floor(rng() * 0x0fff)
    .toString(16)
    .padStart(3, '0')}`;
  const tailA = Math.floor(rng() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  const tailB = (index * 7919 + salt).toString(16).padStart(6, '0').slice(-6);
  return `${tsPart}-${mid}-${v7}-${clk}-${tailA}${tailB}`;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function buildMutationPayload(
  action: string,
  entityType: string,
  index: number,
  rng: () => number,
): {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: AuditDiffItem[] | null;
  changedFields: string[] | null;
} {
  if (action === 'LOGIN_SUCCEEDED' || action === 'LOGIN_FAILED' || action === 'SESSION_REVOKED') {
    return { before: null, after: null, diff: null, changedFields: null };
  }

  if (action === 'SOFT_DELETE' || action === 'DELETE') {
    const before = { status: 'ACTIVE', deletedAt: null, archivedReason: null };
    const after = { status: 'DELETED', deletedAt: '2026-11-19T10:15:00.000Z', archivedReason: 'Requested by branch manager' };
    return {
      before,
      after,
      diff: [
        { field: 'status', before: 'ACTIVE', after: 'DELETED' },
        { field: 'deletedAt', before: null, after: '2026-11-19T10:15:00.000Z' },
        { field: 'archivedReason', before: null, after: 'Requested by branch manager' },
      ],
      changedFields: ['status', 'deletedAt', 'archivedReason'],
    };
  }

  if (action === 'LEAD_STAGE_CHANGED') {
    const stages = ['New', 'Qualified', 'Proposal sent', 'Negotiation', 'Converted'];
    const sIdx = index % (stages.length - 1);
    const prevStage = stages[sIdx];
    const nextStage = stages[sIdx + 1];
    const before = { stage: prevStage, probability: 25 + sIdx * 15 };
    const after = { stage: nextStage, probability: 40 + sIdx * 15 };
    return {
      before,
      after,
      diff: [
        { field: 'stage', before: prevStage, after: nextStage },
        { field: 'probability', before: before.probability, after: after.probability },
      ],
      changedFields: ['stage', 'probability'],
    };
  }

  if (action === 'ROLE_PERMISSIONS_UPDATED' || action === 'ROLE_ASSIGNED') {
    const before = {
      permissionMode: 'BRANCH',
      profileSummary: { branchId: 'br-cai', keys: ['crm.leads.read.own', 'crm.activities.read'] },
    };
    const after = {
      permissionMode: 'BRANCH',
      profileSummary: {
        branchId: 'br-cai',
        keys: ['crm.leads.read.all', 'crm.activities.read.all', 'crm.opportunities.read.all'],
      },
    };
    return {
      before,
      after,
      diff: [
        {
          field: 'profileSummary',
          before: before.profileSummary,
          after: after.profileSummary,
        },
      ],
      changedFields: ['profileSummary'],
    };
  }

  if (index % 7 === 0) {
    // Intentionally omit `diff` to exercise client-side computation from `before` and `after`.
    const before = {
      ownerName: 'Omar Fathy',
      creditLimit: 50000,
      billingAddress: { country: 'EG', city: 'Cairo', district: 'Maadi' },
      notes: 'Initial onboarding inquiry pending tax registration verification',
    };
    const after = {
      ownerName: 'Mona El-Sayed',
      creditLimit: 120000,
      billingAddress: { country: 'EG', city: 'Cairo', district: 'Nasr City' },
      notes: 'Verified commercial registry and approved credit tier B for quarterly orders',
    };
    return {
      before,
      after,
      diff: null,
      changedFields: ['ownerName', 'creditLimit', 'billingAddress', 'notes'],
    };
  }

  if (entityType === 'Party' || entityType === 'Lead') {
    const before = {
      phone: '+201005550111',
      tier: 'Standard',
      address: { country: 'EG', city: 'Alexandria', street: 'Corniche Rd 14' },
      summary: 'Follow up after Q4 procurement tender opens across Delta branches',
    };
    const after = {
      phone: '+201005550199',
      tier: 'Enterprise',
      address: { country: 'EG', city: 'Cairo', street: 'El-Tahrir Sq 8' },
      summary: 'Enterprise multi-branch contract approved by commercial committee with annual billing terms',
    };
    return {
      before,
      after,
      diff: [
        { field: 'phone', before: before.phone, after: after.phone },
        { field: 'tier', before: before.tier, after: after.tier },
        { field: 'address', before: before.address, after: after.address },
        { field: 'summary', before: before.summary, after: after.summary },
      ],
      changedFields: ['phone', 'tier', 'address', 'summary'],
    };
  }

  const amountBefore = Math.floor(rng() * 15000) + 2000;
  const amountAfter = amountBefore + 3500;
  const before = { status: 'DRAFT', amount: amountBefore, remarks: null };
  const after = { status: 'ACTIVE', amount: amountAfter, remarks: 'Approved during operational review' };
  return {
    before,
    after,
    diff: [
      { field: 'status', before: 'DRAFT', after: 'ACTIVE' },
      { field: 'amount', before: amountBefore, after: amountAfter },
      { field: 'remarks', before: null, after: 'Approved during operational review' },
    ],
    changedFields: ['status', 'amount', 'remarks'],
  };
}

function createSeedEvents(): AuditEvent[] {
  const rng = createRng(20261121);
  const nowMs = Date.now();
  const events: AuditEvent[] = [];
  let seq = 1;

  const pushEvent = (partial: {
    ageMinutes: number;
    actor: FakeActorProfile | null;
    actorType?: string;
    action: string;
    entityType: string;
    entityLabel: string | null;
    sourceApp: AuditSourceApp;
    sourceKind: AuditSourceKind;
    outcome?: AuditOutcome;
    sensitivity?: AuditSensitivity;
    branchId?: string | null;
    subjectOwnerUserId?: string | null;
    onBehalfOfUserId?: string | null;
    correlationId?: string | null;
    reason?: string | null;
    payload?: {
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      diff: AuditDiffItem[] | null;
      changedFields: string[] | null;
    };
    extraMeta?: Record<string, unknown>;
  }) => {
    const idx = seq++;
    const createdAt = new Date(nowMs - partial.ageMinutes * 60_000).toISOString();
    const id = seededUuid(idx, 0x101, rng);
    const outcome: AuditOutcome = partial.outcome ?? 'SUCCESS';
    const sensitivity: AuditSensitivity = partial.sensitivity ?? 'NORMAL';
    const payload =
      partial.payload ?? buildMutationPayload(partial.action, partial.entityType, idx, rng);

    const metadata: Record<string, unknown> = {
      _audit: {
        schemaVersion: 1,
        producer: `${partial.sourceApp.toLowerCase()}-service`,
        recordedAt: createdAt,
      },
      source: partial.sourceKind,
      ...(partial.extraMeta ?? {}),
    };

    events.push({
      id,
      tenantId: TENANT_ID,
      actorUserId: partial.actor ? partial.actor.id : null,
      actorType: partial.actorType ?? (partial.actor ? 'USER' : 'SYSTEM'),
      actorLabel: partial.actor ? partial.actor.name : null,
      action: partial.action,
      entityType: partial.entityType,
      entityId: seededUuid(idx, 0x202, rng),
      before: payload.before,
      after: payload.after,
      diff: payload.diff,
      changedFields: payload.changedFields,
      correlationId: partial.correlationId ?? seededUuid(idx, 0x303, rng),
      ip: partial.actor ? pick(IPS, rng) : null,
      userAgent: partial.actor ? pick(USER_AGENTS, rng) : null,
      metadata,
      schemaVersion: 1,
      sourceApp: partial.sourceApp,
      sourceKind: partial.sourceKind,
      outcome,
      sensitivity,
      branchId: partial.branchId !== undefined ? partial.branchId : (partial.actor?.branchId ?? 'br-cai'),
      subjectOwnerUserId:
        partial.subjectOwnerUserId !== undefined
          ? partial.subjectOwnerUserId
          : (partial.actor?.id ?? 'u-owner'),
      entityLabel: partial.entityLabel,
      onBehalfOfUserId: partial.onBehalfOfUserId ?? null,
      sourceEventId: seededUuid(idx, 0x404, rng),
      requestId: seededUuid(idx, 0x505, rng),
      operationId: seededUuid(idx, 0x606, rng),
      idempotencyKey:
        partial.sourceKind === 'DOMAIN_MUTATION' || partial.sourceKind === 'HTTP_COMMAND'
          ? seededUuid(idx, 0x707, rng)
          : null,
      reason: partial.reason ?? (outcome === 'FAILURE' ? pick(FAILURE_REASONS, rng) : null),
      createdAt,
    });
  };

  // 1. Correlated multi-event clusters (to make "Show related events" rich and realistic).
  const clusters: readonly {
    baseAgeMinutes: number;
    actor: FakeActorProfile;
    branchId: string;
    records: readonly {
      offsetMinutes: number;
      action: string;
      entityType: string;
      entityLabel: string;
      sourceApp: AuditSourceApp;
      sourceKind: AuditSourceKind;
      sensitivity: AuditSensitivity;
      outcome?: AuditOutcome;
      reason?: string;
    }[];
  }[] = [
    {
      baseAgeMinutes: 45,
      actor: FAKE_ACTORS[1],
      branchId: 'br-cai',
      records: [
        {
          offsetMinutes: 0,
          action: 'LEAD_STAGE_CHANGED',
          entityType: 'Lead',
          entityLabel: 'Al-Ahram Construction',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'NORMAL',
        },
        {
          offsetMinutes: 1,
          action: 'ACTIVITY_CREATED',
          entityType: 'Activity',
          entityLabel: 'Proposal walkthrough with Al-Ahram',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'LOW',
        },
        {
          offsetMinutes: 2,
          action: 'HTTP_PATCH_LEAD',
          entityType: 'Lead',
          entityLabel: 'Al-Ahram Construction',
          sourceApp: 'GATEWAY',
          sourceKind: 'HTTP_COMMAND',
          sensitivity: 'LOW',
        },
        {
          offsetMinutes: 3,
          action: 'NOTIFICATION_DISPATCHED',
          entityType: 'Activity',
          entityLabel: 'Proposal walkthrough with Al-Ahram',
          sourceApp: 'WORKER',
          sourceKind: 'BROKER_CONSUMER',
          sensitivity: 'LOW',
        },
      ],
    },
    {
      baseAgeMinutes: 320,
      actor: FAKE_ACTORS[0],
      branchId: 'br-cai',
      records: [
        {
          offsetMinutes: 0,
          action: 'SOFT_DELETE',
          entityType: 'Party',
          entityLabel: 'Nile Logistics',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'HIGH',
        },
        {
          offsetMinutes: 1,
          action: 'ACTIVITY_CANCELLED',
          entityType: 'Activity',
          entityLabel: 'Renewal call — Nile Logistics',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'NORMAL',
        },
        {
          offsetMinutes: 2,
          action: 'HTTP_DELETE_PARTY',
          entityType: 'Party',
          entityLabel: 'Nile Logistics',
          sourceApp: 'GATEWAY',
          sourceKind: 'HTTP_COMMAND',
          sensitivity: 'HIGH',
        },
      ],
    },
    {
      baseAgeMinutes: 980,
      actor: FAKE_ACTORS[3],
      branchId: 'br-cai',
      records: [
        {
          offsetMinutes: 0,
          action: 'ROLE_ASSIGNED',
          entityType: 'Role',
          entityLabel: 'Sales manager — Mona El-Sayed',
          sourceApp: 'CORE',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'HIGH',
        },
        {
          offsetMinutes: 1,
          action: 'SEAT_ALLOCATED',
          entityType: 'AddonSeat',
          entityLabel: 'CRM Seat — Mona El-Sayed',
          sourceApp: 'CORE',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'NORMAL',
        },
        {
          offsetMinutes: 2,
          action: 'HTTP_PUT_ASSIGNMENTS',
          entityType: 'TenantUser',
          entityLabel: 'Mona El-Sayed',
          sourceApp: 'GATEWAY',
          sourceKind: 'HTTP_COMMAND',
          sensitivity: 'NORMAL',
        },
      ],
    },
    {
      baseAgeMinutes: 2800,
      actor: FAKE_ACTORS[2],
      branchId: 'br-cai',
      records: [
        {
          offsetMinutes: 0,
          action: 'QUOTATION_CREATED',
          entityType: 'Quotation',
          entityLabel: 'QT-2026-0412',
          sourceApp: 'TRADE',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'NORMAL',
        },
        {
          offsetMinutes: 1,
          action: 'INVOICE_ISSUED',
          entityType: 'Invoice',
          entityLabel: 'INV-2026-1094',
          sourceApp: 'ACCOUNTING',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'HIGH',
        },
        {
          offsetMinutes: 2,
          action: 'JOURNAL_POSTED',
          entityType: 'Invoice',
          entityLabel: 'INV-2026-1094',
          sourceApp: 'ACCOUNTING',
          sourceKind: 'BROKER_CONSUMER',
          sensitivity: 'NORMAL',
        },
      ],
    },
    {
      baseAgeMinutes: 6400,
      actor: FAKE_ACTORS[5],
      branchId: 'br-ruh',
      records: [
        {
          offsetMinutes: 0,
          action: 'LEAD_CONVERTED',
          entityType: 'Lead',
          entityLabel: 'Gulf Horizon Ventures',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'HIGH',
        },
        {
          offsetMinutes: 1,
          action: 'PARTY_CREATED',
          entityType: 'Party',
          entityLabel: 'Gulf Horizon Ventures',
          sourceApp: 'CORE',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'NORMAL',
        },
      ],
    },
    {
      baseAgeMinutes: 18500,
      actor: FAKE_ACTORS[6],
      branchId: 'br-alx',
      records: [
        {
          offsetMinutes: 0,
          action: 'SOFT_DELETE',
          entityType: 'Lead',
          entityLabel: 'Nile Delta Foods',
          sourceApp: 'CRM',
          sourceKind: 'DOMAIN_MUTATION',
          sensitivity: 'HIGH',
        },
        {
          offsetMinutes: 1,
          action: 'HTTP_DELETE_LEAD',
          entityType: 'Lead',
          entityLabel: 'Nile Delta Foods',
          sourceApp: 'GATEWAY',
          sourceKind: 'HTTP_COMMAND',
          sensitivity: 'NORMAL',
        },
      ],
    },
  ];

  for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
    const cluster = clusters[cIdx];
    const correlationId = seededUuid(9000 + cIdx, 0x999, rng);
    for (const rec of cluster.records) {
      pushEvent({
        ageMinutes: cluster.baseAgeMinutes + rec.offsetMinutes,
        actor: rec.sourceKind === 'BROKER_CONSUMER' ? null : cluster.actor,
        actorType: rec.sourceKind === 'BROKER_CONSUMER' ? 'BROKER' : 'USER',
        action: rec.action,
        entityType: rec.entityType,
        entityLabel: rec.entityLabel,
        sourceApp: rec.sourceApp,
        sourceKind: rec.sourceKind,
        sensitivity: rec.sensitivity,
        outcome: rec.outcome ?? 'SUCCESS',
        reason: rec.reason ?? null,
        branchId: cluster.branchId,
        subjectOwnerUserId: cluster.actor.id,
        correlationId,
        extraMeta:
          rec.sourceKind === 'HTTP_COMMAND'
            ? { method: 'POST', route: `/api/tenant/core/v1/${rec.entityType.toLowerCase()}`, statusCode: 200 }
            : undefined,
      });
    }
  }

  // 2. Explicit deletion records across last 7 days and 8..30 days.
  for (let i = 0; i < 24; i++) {
    const sample = DELETED_LABELS[i % DELETED_LABELS.length];
    const actor = FAKE_ACTORS[i % FAKE_ACTORS.length];
    const inFirstWeek = i < 12;
    const ageMinutes = inFirstWeek
      ? 120 + i * 720 + Math.floor(rng() * 180)
      : 10_500 + (i - 12) * 2600 + Math.floor(rng() * 400);
    pushEvent({
      ageMinutes,
      actor,
      action: i % 4 === 0 ? 'DELETE' : 'SOFT_DELETE',
      entityType: sample.entityType,
      entityLabel: sample.label,
      sourceApp: sample.app,
      sourceKind: 'DOMAIN_MUTATION',
      sensitivity: i % 2 === 0 ? 'HIGH' : 'NORMAL',
      outcome: 'SUCCESS',
      branchId: actor.branchId,
      subjectOwnerUserId: actor.id,
      onBehalfOfUserId: i % 5 === 0 ? 'u-owner' : null,
    });
  }

  // 3. Explicit HTTP_COMMAND rows across last 30 days (hidden unless sourceKind=HTTP_COMMAND).
  for (let i = 0; i < 22; i++) {
    const actor = FAKE_ACTORS[i % FAKE_ACTORS.length];
    const sample = ENTITY_SAMPLES[i % ENTITY_SAMPLES.length];
    const inFirstWeek = i < 11;
    const ageMinutes = inFirstWeek
      ? 90 + i * 820 + Math.floor(rng() * 120)
      : 10_400 + (i - 11) * 2900 + Math.floor(rng() * 300);
    const failed = i % 7 === 6;
    pushEvent({
      ageMinutes,
      actor,
      action: failed ? 'HTTP_COMMAND_REJECTED' : 'HTTP_COMMAND_EXECUTED',
      entityType: sample.entityType,
      entityLabel: pick(sample.labels, rng),
      sourceApp: 'GATEWAY',
      sourceKind: 'HTTP_COMMAND',
      sensitivity: failed ? 'HIGH' : 'LOW',
      outcome: failed ? 'FAILURE' : 'SUCCESS',
      branchId: actor.branchId,
      subjectOwnerUserId: actor.id,
      payload: { before: null, after: null, diff: null, changedFields: null },
      extraMeta: {
        httpMethod: i % 3 === 0 ? 'DELETE' : i % 2 === 0 ? 'PATCH' : 'POST',
        path: `/api/tenant/core/v1/${sample.entityType.toLowerCase()}s`,
        statusCode: failed ? 422 : 200,
      },
    });
  }

  // 4. Fill remaining events up to 300 across the last 30 days (roughly 105 in the first 7 days).
  while (events.length < 300) {
    const idx = events.length;
    const inFirstWeek = idx < 135;
    const ageMinutes = inFirstWeek
      ? 15 + Math.floor(rng() * (7 * 24 * 60 - 30))
      : 7 * 24 * 60 + Math.floor(rng() * (23 * 24 * 60));

    const scenario = ACTION_SCENARIOS[idx % ACTION_SCENARIOS.length];
    const sample = ENTITY_SAMPLES.find((s) => s.entityType === scenario.entityType) ?? ENTITY_SAMPLES[0];
    const isSystem =
      scenario.kind === 'CRON_JOB' ||
      scenario.kind === 'BROKER_CONSUMER' ||
      scenario.kind === 'DB_FALLBACK' ||
      idx % 13 === 0;
    const actor = isSystem ? null : FAKE_ACTORS[idx % FAKE_ACTORS.length];
    const actorType =
      scenario.kind === 'CRON_JOB'
        ? 'CRON'
        : scenario.kind === 'BROKER_CONSUMER'
          ? 'BROKER'
          : isSystem
            ? 'SYSTEM'
            : 'USER';

    const failed = scenario.action === 'LOGIN_FAILED' || idx % 11 === 0;
    const branchId = isSystem ? (idx % 3 === 0 ? null : pick(BRANCH_IDS, rng)) : actor!.branchId;
    const ownerId = actor ? actor.id : FAKE_ACTORS[idx % FAKE_ACTORS.length].id;
    const onBehalf = actor && idx % 14 === 0 ? 'u-owner' : null;

    pushEvent({
      ageMinutes,
      actor,
      actorType,
      action: scenario.action,
      entityType: scenario.entityType,
      entityLabel: pick(sample.labels, rng),
      sourceApp: scenario.app,
      sourceKind: scenario.kind,
      outcome: failed ? 'FAILURE' : 'SUCCESS',
      sensitivity: failed && idx % 2 === 0 ? 'HIGH' : scenario.sensitivity,
      branchId,
      subjectOwnerUserId: ownerId,
      onBehalfOfUserId: onBehalf,
    });
  }

  events.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  return events;
}

// ---------------------------------------------------------------------------------------------------------------
// CRM record history seed: audit events for the CRM fakes' own records (leads, customers, opportunities), so the
// Lead / Customer / Opportunity History tabs show data in fake mode. Ids come from the CRM fakes' exported seeds.
// ---------------------------------------------------------------------------------------------------------------

type CrmRootType = 'Lead' | 'CustomerProfile' | 'Opportunity';

interface CrmRootSeed {
  entityType: CrmRootType;
  entityId: string;
  label: string;
  branchId: string;
  /** The record's own party (organization or person), when it has one. */
  partyId: string | null;
  contacts: readonly { partyId: string; displayName: string }[];
}

/** Lead snapshots read once from the leads fake (its seed is not exported, so `fakeGetLead` is the reader). */
let crmLeadRoots: Promise<CrmRootSeed[]> | null = null;

function loadCrmLeadRoots(): Promise<CrmRootSeed[]> {
  // Lead ids = the source leads of the seeded customers (`CUSTOMERS_FAKE_DB[].sourceLeadId`; includes lead-001).
  const leadIds = Array.from(
    new Set(CUSTOMERS_FAKE_DB.map((customer) => customer.sourceLeadId).filter((id): id is string => Boolean(id))),
  ).slice(0, 4);
  crmLeadRoots ??= Promise.allSettled(leadIds.map((id) => fakeGetLead(id))).then((results) =>
    results
      .filter((result) => result.status === 'fulfilled')
      .map(({ value: lead }) => ({
        entityType: 'Lead' as const,
        entityId: lead.id,
        label: lead.displayName,
        branchId: lead.branchId,
        partyId: lead.partyId ?? null,
        contacts: lead.contacts.map((contact) => ({ partyId: contact.partyId, displayName: contact.displayName })),
      })),
  );
  return crmLeadRoots;
}

function crmCustomerRoots(): CrmRootSeed[] {
  const acme = CUSTOMERS_FAKE_DB.find((customer) => customer.id === ACME_CUSTOMER_ID);
  const others = CUSTOMERS_FAKE_DB.filter(
    (customer) => customer.id !== ACME_CUSTOMER_ID && customer.contacts.length > 0,
  ).slice(0, 2);
  return [...(acme ? [acme] : []), ...others].map((customer) => ({
    entityType: 'CustomerProfile' as const,
    entityId: customer.id,
    label: customer.displayName,
    branchId: customer.branchId,
    partyId: customer.partyId,
    contacts: customer.contacts.map((contact) => ({ partyId: contact.partyId, displayName: contact.displayName })),
  }));
}

function crmOpportunityRoots(): CrmRootSeed[] {
  const rows = fakeAllOpportunityRows();
  const picked = [
    rows.find((row) => row.id === ACME_OPPORTUNITY_ID),
    rows.find((row) => opportunityRef(row.id) === 'OP-30008'),
    rows.find((row) => row.id !== ACME_OPPORTUNITY_ID && opportunityRef(row.id) !== 'OP-30008'),
  ];
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of picked) {
    if (row) unique.set(row.id, row);
  }
  return [...unique.values()].map((row) => ({
    entityType: 'Opportunity' as const,
    entityId: row.id,
    label: `${opportunityRef(row.id)} · ${row.title}`,
    branchId: row.branchId,
    partyId: row.customerPartyId,
    contacts: row.primaryContact?.partyId
      ? [{ partyId: row.primaryContact.partyId, displayName: row.primaryContact.displayName }]
      : [],
  }));
}

/** Seeded lead id -> its contact party ids (the record route's "CRM projection" of lead parties). */
let crmLeadContactPartyIds = new Map<string, string[]>();

/** Event id -> `<rootType>:<rootId>` for seeded CRM events that belong to a root record (activities, documents). */
let crmRootLinks = new Map<string, string>();

function rootKey(entityType: string, entityId: string): string {
  const canonical = entityType.endsWith('Entity') ? entityType.slice(0, -6) : entityType;
  return `${canonical}:${entityId}`;
}

const CRM_ROOT_ACTIONS: Record<CrmRootType, { created: string; updated: string; stage: string }> = {
  Lead: { created: 'LEAD_CREATED', updated: 'LEAD_UPDATED', stage: 'LEAD_STAGE_CHANGED' },
  CustomerProfile: {
    created: 'CUSTOMER_PROFILE_CREATED',
    updated: 'CUSTOMER_PROFILE_UPDATED',
    stage: 'CUSTOMER_PROFILE_STATUS_CHANGED',
  },
  Opportunity: { created: 'OPPORTUNITY_CREATED', updated: 'OPPORTUNITY_UPDATED', stage: 'OPPORTUNITY_STAGE_CHANGED' },
};

interface CrmPayload {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: AuditDiffItem[] | null;
  changedFields: string[] | null;
}

function created(after: Record<string, unknown>): CrmPayload {
  return { before: null, after, diff: null, changedFields: Object.keys(after) };
}

function changed(before: Record<string, unknown>, after: Record<string, unknown>): CrmPayload {
  const fields = Object.keys(after);
  return {
    before,
    after,
    diff: fields.map((field) => ({ field, before: before[field] ?? null, after: after[field] })),
    changedFields: fields,
  };
}

function rootPayloads(root: CrmRootSeed): { created: CrmPayload; updated: CrmPayload; stage: CrmPayload } {
  switch (root.entityType) {
    case 'Lead':
      return {
        created: created({ displayName: root.label, status: 'OPEN', stage: 'New', rating: 1 }),
        updated: changed(
          { interestSummary: 'ERP licences', expectedValue: null, rating: 1 },
          { interestSummary: 'ERP licences and POS hardware', expectedValue: '125000.00000000', rating: 3 },
        ),
        stage: changed({ stage: 'New', stageFlag: 'NEW' }, { stage: 'Qualified', stageFlag: 'QUALIFIED' }),
      };
    case 'CustomerProfile':
      return {
        created: created({ displayName: root.label, profileType: 'CORPORATE', status: 'PROSPECT' }),
        updated: changed({ rating: 1, cardColor: null }, { rating: 3, cardColor: 'GREEN' }),
        stage: changed({ status: 'PROSPECT' }, { status: 'ACTIVE_CUSTOMER' }),
      };
    case 'Opportunity':
      return {
        created: created({ title: root.label, status: 'OPEN', stage: 'Discovery', amount: '180000.00000000' }),
        updated: changed(
          { amount: '180000.00000000', expectedCloseDate: '2026-12-15', probabilityPercent: 25 },
          { amount: '215000.00000000', expectedCloseDate: '2026-12-31', probabilityPercent: 60 },
        ),
        stage: changed({ stage: 'Discovery', stageFlag: 'DISCOVERY' }, { stage: 'Proposal', stageFlag: 'PROPOSAL' }),
      };
  }
}

const DAY_MINUTES = 24 * 60;

function buildCrmEvents(roots: readonly CrmRootSeed[]): AuditEvent[] {
  const rng = createRng(20261122);
  const nowMs = Date.now();
  const events: AuditEvent[] = [];
  let seq = 20_000;

  const push = (input: {
    root: CrmRootSeed;
    ageMinutes: number;
    actor: FakeActorProfile;
    action: string;
    entityType: string;
    entityId: string;
    entityLabel: string;
    sourceApp?: AuditSourceApp;
    correlationId: string;
    payload: CrmPayload;
    /** Activities and documents belong to the root record (they carry no party id). */
    linkToRoot?: boolean;
  }) => {
    const idx = seq++;
    const createdAt = new Date(nowMs - input.ageMinutes * 60_000).toISOString();
    const sourceApp = input.sourceApp ?? 'CRM';
    const id = seededUuid(idx, 0x111, rng);
    if (input.linkToRoot) crmRootLinks.set(id, rootKey(input.root.entityType, input.root.entityId));
    events.push({
      id,
      tenantId: TENANT_ID,
      actorUserId: input.actor.id,
      actorType: 'USER',
      actorLabel: input.actor.name,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.payload.before,
      after: input.payload.after,
      diff: input.payload.diff,
      changedFields: input.payload.changedFields,
      correlationId: input.correlationId,
      ip: pick(IPS, rng),
      userAgent: pick(USER_AGENTS, rng),
      metadata: {
        _audit: { schemaVersion: 1, producer: `${sourceApp.toLowerCase()}-service`, recordedAt: createdAt },
        source: 'DOMAIN_MUTATION',
      },
      schemaVersion: 1,
      sourceApp,
      sourceKind: 'DOMAIN_MUTATION',
      outcome: 'SUCCESS',
      sensitivity: 'NORMAL',
      branchId: input.root.branchId,
      subjectOwnerUserId: input.actor.id,
      entityLabel: input.entityLabel,
      onBehalfOfUserId: null,
      sourceEventId: seededUuid(idx, 0x414, rng),
      requestId: seededUuid(idx, 0x515, rng),
      operationId: seededUuid(idx, 0x616, rng),
      idempotencyKey: seededUuid(idx, 0x717, rng),
      reason: null,
      createdAt,
    });
  };

  roots.forEach((root, rootIndex) => {
    const actor = FAKE_ACTORS[rootIndex % FAKE_ACTORS.length];
    const peer = FAKE_ACTORS[(rootIndex + 1) % FAKE_ACTORS.length];
    const base = DAY_MINUTES * (12 + rootIndex * 2);
    const actions = CRM_ROOT_ACTIONS[root.entityType];
    const payloads = rootPayloads(root);
    const correlation = (n: number) => seededUuid(30_000 + rootIndex * 10 + n, 0x919, rng);
    const self = { root, entityType: root.entityType, entityId: root.entityId, entityLabel: root.label };

    // 1. Created.
    push({ ...self, ageMinutes: base, actor, action: actions.created, correlationId: correlation(1), payload: payloads.created });

    // 2. Contact added: the contact party and its relationship to the record's party, in one request.
    const contact = root.contacts[0];
    if (contact) {
      const contactCorrelation = correlation(2);
      push({
        root,
        ageMinutes: base - 30,
        actor,
        action: 'CONTACT_CREATED',
        entityType: 'Party',
        entityId: contact.partyId,
        entityLabel: contact.displayName,
        correlationId: contactCorrelation,
        payload: created({ displayName: contact.displayName, partyType: 'PERSON' }),
      });
      if (root.partyId && root.partyId !== contact.partyId) {
        push({
          root,
          ageMinutes: base - 30,
          actor,
          action: 'PARTY_RELATIONSHIP_CREATED',
          entityType: 'PartyRelationship',
          entityId: root.partyId,
          entityLabel: contact.displayName,
          correlationId: contactCorrelation,
          payload: created({ relatedPartyId: contact.partyId, relationshipType: 'CONTACT_PERSON', isPrimary: true }),
        });
      }
    }

    // 3. Activity planned, then completed.
    const activityId = seededUuid(40_000 + rootIndex, 0xa0a, rng);
    const activityLabel = `Discovery call — ${root.label}`;
    const activity = { root, entityType: 'Activity', entityId: activityId, entityLabel: activityLabel, linkToRoot: true };
    push({
      ...activity,
      ageMinutes: base - DAY_MINUTES,
      actor: peer,
      action: 'ACTIVITY_CREATED',
      correlationId: correlation(3),
      payload: created({ type: 'CALL', subject: activityLabel, status: 'PLANNED' }),
    });
    push({
      ...activity,
      ageMinutes: base - DAY_MINUTES * 2,
      actor: peer,
      action: 'ACTIVITY_COMPLETED',
      correlationId: correlation(4),
      payload: changed({ status: 'PLANNED', outcome: null }, { status: 'COMPLETED', outcome: 'Interested' }),
    });

    // 4. Updated (changedFields + diff), 5. stage (customers: status) change.
    push({ ...self, ageMinutes: base - DAY_MINUTES * 3, actor: peer, action: actions.updated, correlationId: correlation(5), payload: payloads.updated });
    push({ ...self, ageMinutes: base - DAY_MINUTES * 4, actor, action: actions.stage, correlationId: correlation(6), payload: payloads.stage });

    // 6. Trade / accounting documents of the record.
    if (root.entityType === 'Opportunity') {
      push({
        root,
        ageMinutes: base - DAY_MINUTES * 5,
        actor,
        action: 'QUOTATION_CREATED',
        entityType: 'Quotation',
        entityId: seededUuid(41_000 + rootIndex, 0xb0b, rng),
        entityLabel: `QT-2026-${String(500 + rootIndex).padStart(4, '0')}`,
        sourceApp: 'TRADE',
        correlationId: correlation(7),
        linkToRoot: true,
        payload: created({ status: 'DRAFT', total: '215000.00000000' }),
      });
    }
    if (root.entityType === 'CustomerProfile') {
      push({
        root,
        ageMinutes: base - DAY_MINUTES * 5,
        actor,
        action: 'SALES_ORDER_CREATED',
        entityType: 'SalesOrder',
        entityId: seededUuid(42_000 + rootIndex, 0xc0c, rng),
        entityLabel: `SO-2026-${String(300 + rootIndex).padStart(4, '0')}`,
        sourceApp: 'TRADE',
        correlationId: correlation(8),
        linkToRoot: true,
        payload: created({ status: 'CONFIRMED', total: '96000.00000000' }),
      });
      push({
        root,
        ageMinutes: base - DAY_MINUTES * 6,
        actor: peer,
        action: 'INVOICE_ISSUED',
        entityType: 'Invoice',
        entityId: seededUuid(43_000 + rootIndex, 0xd0d, rng),
        entityLabel: `INV-2026-${String(1200 + rootIndex).padStart(4, '0')}`,
        sourceApp: 'ACCOUNTING',
        correlationId: correlation(9),
        linkToRoot: true,
        payload: changed({ status: 'DRAFT' }, { status: 'ISSUED' }),
      });
    }
  });

  return events;
}

function sortNewestFirst(events: AuditEvent[]): AuditEvent[] {
  return events.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

let seedEvents: AuditEvent[] = createSeedEvents();
let crmSeeded: Promise<void> | null = null;
let seedGeneration = 0;

/** Adds the CRM record events once per seed (lazy: lead snapshots come through the async leads fake). */
function ensureCrmSeed(): Promise<void> {
  const generation = seedGeneration;
  crmSeeded ??= loadCrmLeadRoots().then((leadRoots) => {
    if (generation !== seedGeneration) return;
    crmRootLinks = new Map();
    crmLeadContactPartyIds = new Map(leadRoots.map((lead) => [lead.entityId, lead.contacts.map((c) => c.partyId)]));
    const roots = [...leadRoots, ...crmCustomerRoots(), ...crmOpportunityRoots()];
    seedEvents = sortNewestFirst([...seedEvents, ...buildCrmEvents(roots)]);
  });
  return crmSeeded;
}

export function resetAuditFake(): void {
  seedGeneration++;
  seedEvents = createSeedEvents();
  crmSeeded = null;
  crmRootLinks = new Map();
}

async function fakeDelay(ms = 220): Promise<void> {
  await Promise.all([new Promise((resolve) => setTimeout(resolve, ms)), ensureCrmSeed()]);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

interface VisibilityScope {
  all: boolean;
  allBranches: boolean;
  allowedBranches: Set<string>;
  canOwn: boolean;
  userId: string;
}

function resolveVisibility(me: Me): VisibilityScope {
  const all = me.isTenantOwner || Boolean(me.permissionScopes['audit.read']?.tenantWide);
  const branchScope = me.permissionScopes['audit.read.branch'];
  const allBranches = Boolean(branchScope?.tenantWide);
  const allowedBranches = new Set<string>(branchScope?.branchIds ?? []);
  const ownScope = me.permissionScopes['audit.read.own'];
  const canOwn =
    Boolean(
      ownScope &&
        (ownScope.tenantWide || ownScope.companyIds.length > 0 || ownScope.branchIds.length > 0),
    ) || me.permissions.includes('audit.read.own');

  if (!all && !allBranches && allowedBranches.size === 0 && !canOwn) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }

  return {
    all,
    allBranches,
    allowedBranches,
    canOwn,
    userId: me.id,
  };
}

function canSeeEvent(event: AuditEvent, scope: VisibilityScope): boolean {
  if (scope.all) return true;
  if (scope.allBranches && event.branchId !== null) return true;
  if (event.branchId !== null && scope.allowedBranches.has(event.branchId)) return true;
  if (scope.canOwn && (event.actorUserId === scope.userId || event.subjectOwnerUserId === scope.userId)) {
    return true;
  }
  return false;
}

interface CursorToken {
  createdAt: string;
  id: string;
}

function encodeCursor(token: CursorToken): string {
  const json = JSON.stringify(token);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(raw: string): CursorToken {
  if (!raw || raw.length > AUDIT_LIMITS.cursor) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CursorToken>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !parsed.id ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error('bad cursor');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
}

function validateCommonQuery(q: AuditQuery): {
  limit: number;
  cursor: CursorToken | null;
  fromMs: number | null;
  toMs: number | null;
} {
  const limit = q.limit ?? AUDIT_LIMITS.defaultLimit;
  if (!Number.isInteger(limit) || limit < AUDIT_LIMITS.minLimit || limit > AUDIT_LIMITS.maxLimit) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.entityType !== undefined && q.entityType.length > AUDIT_LIMITS.entityType) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.entityId !== undefined && q.entityId.length > AUDIT_LIMITS.entityId) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.action !== undefined && q.action.length > AUDIT_LIMITS.action) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.sourceApp !== undefined && !APP_SET.has(q.sourceApp)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.sourceKind !== undefined && !KIND_SET.has(q.sourceKind)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.outcome !== undefined && !OUTCOME_SET.has(q.outcome)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (q.sensitivity !== undefined && !SENSITIVITY_SET.has(q.sensitivity)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }

  let fromMs: number | null = null;
  if (q.from !== undefined) {
    fromMs = Date.parse(q.from);
    if (Number.isNaN(fromMs)) {
      throw new ApiError(400, 'AUDIT_QUERY_INVALID');
    }
  }
  let toMs: number | null = null;
  if (q.to !== undefined) {
    toMs = Date.parse(q.to);
    if (Number.isNaN(toMs)) {
      throw new ApiError(400, 'AUDIT_QUERY_INVALID');
    }
  }

  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  return { limit, cursor, fromMs, toMs };
}

interface FixedEntity {
  entityType: string;
  entityId: string;
}

/** Mirrors `TenantAuditService.query`: Lead / Opportunity / CustomerProfile also match the `<Type>Entity` spelling. */
function matchesEntityType(eventType: string, wanted: string): boolean {
  const canonical = wanted.endsWith('Entity') ? wanted.slice(0, -6) : wanted;
  if (['Lead', 'Opportunity', 'CustomerProfile'].includes(canonical)) {
    return eventType === canonical || eventType === `${canonical}Entity`;
  }
  return eventType === wanted;
}

function filterEvents(q: AuditQuery, routeDeletedOnly: boolean, fixedEntity?: FixedEntity): {
  rows: AuditEvent[];
  limit: number;
} {
  const scope = resolveVisibility(buildActorMeSync());
  const deletedOnly = routeDeletedOnly || q.deletedOnly === true;
  // Backend trims `q`, then rejects any `q` (even empty) unless deletedOnly is true.
  const labelQuery = q.q === undefined ? undefined : q.q.trim();
  if (labelQuery !== undefined && !deletedOnly) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  if (labelQuery !== undefined && labelQuery.length > AUDIT_LIMITS.deletedQueryPrefix) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }

  const { limit, cursor, fromMs, toMs } = validateCommonQuery(q);
  // Stored label `LIKE 'prefix%'`: literal and case-sensitive.
  const labelPrefix = deletedOnly && labelQuery ? labelQuery : '';
  const entityType = fixedEntity?.entityType.trim() || q.entityType?.trim() || undefined;
  const entityId = fixedEntity?.entityId.trim() || q.entityId?.trim() || undefined;
  const action = q.action?.trim() || undefined;

  const rows = seedEvents.filter((event) => {
    if (!canSeeEvent(event, scope)) return false;

    if (deletedOnly) {
      if (event.action !== 'SOFT_DELETE' && event.action !== 'DELETE') return false;
      if (labelPrefix && !(event.entityLabel ?? '').startsWith(labelPrefix)) {
        return false;
      }
    }

    if (q.sourceKind) {
      if (event.sourceKind !== q.sourceKind) return false;
    } else if (event.sourceKind === 'HTTP_COMMAND') {
      return false;
    }

    if (entityType && !matchesEntityType(event.entityType, entityType)) return false;
    if (entityId && event.entityId !== entityId) return false;
    if (action && event.action !== action) return false;
    if (q.actorUserId && event.actorUserId !== q.actorUserId) return false;
    if (q.correlationId && event.correlationId !== q.correlationId) return false;
    if (q.branchId && event.branchId !== q.branchId) return false;
    if (q.ownerUserId && event.subjectOwnerUserId !== q.ownerUserId) return false;
    if (q.sourceApp && event.sourceApp !== q.sourceApp) return false;
    if (q.outcome && event.outcome !== q.outcome) return false;
    if (q.sensitivity && event.sensitivity !== q.sensitivity) return false;

    if (fromMs !== null || toMs !== null) {
      const eventMs = Date.parse(event.createdAt);
      if (fromMs !== null && eventMs < fromMs) return false;
      if (toMs !== null && eventMs >= toMs) return false;
    }

    if (cursor) {
      if (event.createdAt > cursor.createdAt) return false;
      if (event.createdAt === cursor.createdAt && event.id >= cursor.id) return false;
    }

    return true;
  });

  return { rows, limit };
}

function cursorPage<T extends { createdAt: string; id: string }>(
  rows: readonly T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const slice = rows.slice(0, limit);
  const last = slice.at(-1);
  return {
    items: clone(slice),
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}

function executeList(q: AuditQuery, routeDeletedOnly: boolean, fixedEntity?: FixedEntity): AuditPage {
  const { rows, limit } = filterEvents(q, routeDeletedOnly, fixedEntity);
  return cursorPage(rows, limit);
}

/** `GET tenant/audit` (honours `deletedOnly` and `q`). */
export async function fakeListAuditEvents(q: AuditQuery = {}): Promise<AuditPage> {
  await fakeDelay();
  return executeList(q, false);
}

/** `GET tenant/audit/deleted` (the controller forces `deletedOnly: true`). */
export async function fakeListDeletedRecords(q: AuditDeletedQuery = {}): Promise<AuditPage> {
  await fakeDelay();
  return executeList(q, true);
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * FAKE-ONLY id patterns of the CRM fakes: `lead-001`, `party-12`, `party-c-1-2`, `party-co-delta-trading`.
 * The real backend requires UUIDv7 for `relatedPartyIds` and a UUID for the record `targetId`; the fakes also
 * accept these, the way other fakes accept `b<n>` branch ids. Remove with the fake (Phase 5).
 */
const FAKE_LEAD_ID = /^lead-[0-9a-z]+(?:-[0-9a-z]+)*$/i;
const FAKE_PARTY_ID = /^party-[0-9a-z]+(?:-[0-9a-z]+)*$/i;

function isRelatedPartyId(id: string): boolean {
  return UUID_V7.test(id) || FAKE_PARTY_ID.test(id);
}

function isLeadTargetId(id: string): boolean {
  return UUID_ANY.test(id) || FAKE_LEAD_ID.test(id);
}
const HISTORY_CATEGORY_SET = new Set<string>(AUDIT_HISTORY_CATEGORIES);
const HISTORY_TECHNICAL_FIELDS = new Set(['id', 'tenantId', 'createdAt', 'updatedAt', 'version']);
const PARTY_ENTITY_TYPES = new Set(['Party', 'PartyContactMethod', 'PartyAddress', 'PartyRelationship']);

function subjectKindOf(entityType: string): AuditHistorySubjectKind {
  const canonical = entityType.endsWith('Entity') ? entityType.slice(0, -6) : entityType;
  // `related-history-priority.ts` CRM_ROOT_TYPES: every CRM root record is grouped as subject kind `lead`.
  if (canonical === 'Lead' || canonical === 'CustomerProfile' || canonical === 'Opportunity') return 'lead';
  if (PARTY_ENTITY_TYPES.has(canonical)) return 'contact';
  if (canonical === 'Quotation') return 'quotation';
  if (canonical === 'SalesOrder') return 'salesOrder';
  if (canonical === 'Invoice') return 'invoice';
  if (canonical === 'Activity') return 'activity';
  if (canonical === 'CrmNote' || canonical === 'Note') return 'note';
  if (canonical === 'Attachment') return 'attachment';
  return 'record';
}

/** One request (correlation) becomes one group, as in `relatedHistoryView`. */
function groupHistory(events: readonly AuditEvent[]): AuditHistoryGroup[] {
  const byRequest = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const key = event.correlationId ?? event.id;
    const bucket = byRequest.get(key);
    if (bucket) bucket.push(event);
    else byRequest.set(key, [event]);
  }
  return [...byRequest.values()].map((group) => {
    const primary = group[0];
    const failure = group.find((event) => event.outcome === 'FAILURE');
    const diff: AuditHistoryChange[] = [];
    for (const event of group) {
      for (const change of computeEventDiff(event)) {
        if (HISTORY_TECHNICAL_FIELDS.has(change.field)) continue;
        diff.push({
          field: change.field,
          before: change.before,
          after: change.after,
          ...(event.entityId ? { subjectId: event.entityId } : {}),
          ...(event.entityLabel ? { subjectLabel: event.entityLabel } : {}),
        });
      }
    }
    return {
      id: primary.id,
      action: primary.action,
      subjectKind: subjectKindOf(primary.entityType),
      subjectId: primary.entityId,
      referenceLabel: primary.entityLabel,
      createdAt: primary.createdAt,
      actorLabel: primary.actorLabel,
      actorType: primary.actorType,
      outcome: failure ? 'FAILURE' : 'SUCCESS',
      reason: failure?.reason ?? null,
      diff,
    };
  });
}

function validateHistoryCategory(category: string | undefined): void {
  if (category !== undefined && !HISTORY_CATEGORY_SET.has(category)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
}

function groupedPage(
  events: readonly AuditEvent[],
  cursorRaw: string | undefined,
  limit: number,
  category: AuditHistoryCategory | undefined,
): AuditHistoryPage {
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  const groups = groupHistory(events).filter((group) => {
    if (category && group.subjectKind !== category) return false;
    if (cursor) {
      if (group.createdAt > cursor.createdAt) return false;
      if (group.createdAt === cursor.createdAt && group.id >= cursor.id) return false;
    }
    return true;
  });
  return cursorPage(groups, limit);
}

function validateEntityParams(entityType: string, entityId: string): void {
  const type = entityType.trim();
  const id = entityId.trim();
  if (!type || type.length > AUDIT_LIMITS.entityType || !id || id.length > AUDIT_LIMITS.entityId) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
}

/** `GET tenant/audit/entities/:entityType/:entityId` without `relatedPartyIds`: flat event page. */
export async function fakeListEntityAuditEvents(
  entityType: string,
  entityId: string,
  q: AuditQuery = {},
): Promise<AuditPage> {
  await fakeDelay();
  validateEntityParams(entityType, entityId);
  return executeList(q, false, { entityType, entityId });
}

/** The record itself, its related parties, and (seeded CRM events) the activities / documents linked to it. */
function isRelatedEvent(event: AuditEvent, entityType: string, entityId: string, partyIds: ReadonlySet<string>): boolean {
  if (matchesEntityType(event.entityType, entityType) && event.entityId === entityId) return true;
  if (PARTY_ENTITY_TYPES.has(event.entityType) && event.entityId !== null && partyIds.has(event.entityId)) return true;
  return crmRootLinks.get(event.id) === rootKey(entityType, entityId);
}

/** `GET tenant/audit/entities/:entityType/:entityId?relatedPartyIds=…`: grouped related history. */
export async function fakeListRelatedEntityHistory(
  entityType: string,
  entityId: string,
  q: AuditRelatedHistoryQuery,
): Promise<AuditHistoryPage> {
  await fakeDelay();
  validateEntityParams(entityType, entityId);
  const ids = q.relatedPartyIds;
  if (
    ids.length < 1 ||
    ids.length > AUDIT_LIMITS.maxRelatedPartyIds ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !isRelatedPartyId(id))
  ) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  validateHistoryCategory(q.historyCategory);
  const { cursor, relatedPartyIds: _relatedPartyIds, historyCategory, ...filters } = q;
  const { rows, limit } = filterEvents({ ...filters, entityType: undefined, entityId: undefined }, false);
  const related = rows.filter((event) => isRelatedEvent(event, entityType.trim(), entityId.trim(), new Set(ids)));
  return groupedPage(related, cursor, limit, historyCategory);
}

/** Party ids of a lead in the leads fake: its own party plus the seeded lead's contacts. */
function fakeLeadPartyIds(leadId: string): string[] {
  const own = fakeLeadPartyId(leadId);
  const seeded = crmLeadContactPartyIds.get(leadId) ?? [];
  return [...(own ? [own] : []), ...seeded];
}

const LEAD_READ_PERMISSIONS = ['crm.leads.read.own', 'crm.leads.read.team', 'crm.leads.read.all'] as const;

/** `GET tenant/audit/records/:targetApp/:targetType/:targetId/history` (CRM leads only). */
export async function fakeListRecordHistory(
  target: RecordHistoryTarget,
  q: RecordHistoryQuery = {},
): Promise<AuditHistoryPage> {
  await fakeDelay();
  const me = buildActorMeSync();
  if (!me.isTenantOwner && !LEAD_READ_PERMISSIONS.some((key) => me.permissions.includes(key))) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  if (target.targetApp !== 'CRM' || target.targetType !== 'LEAD' || !isLeadTargetId(target.targetId)) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  const limit = q.limit ?? AUDIT_LIMITS.defaultLimit;
  if (!Number.isInteger(limit) || limit < AUDIT_LIMITS.minLimit || limit > AUDIT_LIMITS.maxLimit) {
    throw new ApiError(400, 'AUDIT_QUERY_INVALID');
  }
  validateHistoryCategory(q.historyCategory);
  // Related parties come from CRM projections (here: the leads fake), never from the client.
  const leadPartyIds = new Set(fakeLeadPartyIds(target.targetId));
  const leadEvents = seedEvents.filter((event) => isRelatedEvent(event, 'Lead', target.targetId, leadPartyIds));
  // Unknown lead: no audit rows and not in the leads fake (a lead with no audit rows yet is an empty page).
  if (leadEvents.length === 0 && fakeLeadPartyId(target.targetId) === null) {
    throw new ApiError(404, 'ACTIVITY_NOT_FOUND');
  }
  return groupedPage(leadEvents, q.cursor, limit, q.historyCategory);
}

export async function fakeGetAuditEvent(id: string): Promise<AuditEvent> {
  await fakeDelay(160);
  const scope = resolveVisibility(buildActorMeSync());
  const event = seedEvents.find((item) => item.id === id);
  if (!event || !canSeeEvent(event, scope)) {
    throw new ApiError(404, 'AUDIT_EVENT_NOT_FOUND');
  }
  return clone(event);
}
