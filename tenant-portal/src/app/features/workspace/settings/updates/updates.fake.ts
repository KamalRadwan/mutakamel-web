import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import { isSha256, isUuidV7, isValidComponentKey } from './updates.logic';
import {
  ApplyUpdatesBody,
  ApplyUpdatesResponse,
  ComponentRisk,
  MAX_SELECTIONS,
  OperationStatus,
  OperationStep,
  PAGE_SIZE,
  TenantAvailableUpdate,
  TenantOperationDetail,
  UpdateSelection,
  UpdatesPageResult,
  UpdatesQuery,
} from './updates.model';

export const FAKE_UPDATES_FAIL_NEXT: {
  code: string | null;
  status: number;
  on: 'list' | 'apply' | 'operation';
} = {
  code: null,
  status: 500,
  on: 'apply',
};

export const FAKE_UPDATES_OPERATION_OUTCOME: { status: OperationStatus } = {
  status: 'SUCCEEDED',
};

export const FAKE_UPDATES_STATE: { blocked: boolean; tenantActive: boolean } = {
  blocked: false,
  tenantActive: true,
};

interface StoredOperation {
  id: string;
  type: 'UPDATE';
  requestedAt: string;
  hasHighRisk: boolean;
  affectedComponentKeys: string[];
  steps: OperationStep[];
  settledStatus: OperationStatus | null;
  completedAt: string | null;
  updatedAt: string;
  rowsClearedOnSuccess: boolean;
}

interface IdempotencyEntry {
  fingerprint: string;
  operationId: string;
  replayedCount: number;
}

interface UpdatesFakeStore {
  rows: TenantAvailableUpdate[];
  operations: Map<string, StoredOperation>;
  idempotency: Map<string, IdempotencyEntry>;
}

function seedUuidV7(group: number, seq: number): string {
  const g = group.toString(16).padStart(8, '0');
  const s = seq.toString(16).padStart(12, '0');
  return `${g}-0000-7000-8000-${s}`;
}

function seedSha256(tag: string): string {
  let out = '';
  let acc = 0x5a17;
  for (let i = 0; i < 64; i++) {
    const ch = tag.charCodeAt(i % tag.length);
    acc = (acc * 33 + ch + i) & 0xffff;
    out += (acc % 16).toString(16);
  }
  return out;
}

interface SeedSpec {
  key: string;
  currentVersion: string;
  availableVersion: string;
  risk: ComponentRisk;
  selfService?: boolean;
  backup?: boolean;
  maintenance?: boolean;
  nullCurrentChecksum?: boolean;
  planned?: boolean;
  daysAgo: number;
}

const SEED_SPECS: readonly SeedSpec[] = [
  { key: 'crm.core', currentVersion: '2.14.0', availableVersion: '2.15.0', risk: 'MEDIUM', daysAgo: 0.2 },
  { key: 'crm.leads', currentVersion: '2.9.1', availableVersion: '2.10.0', risk: 'LOW', planned: true, daysAgo: 0.4 },
  { key: 'crm.opportunities', currentVersion: '2.7.0', availableVersion: '2.8.0', risk: 'HIGH', daysAgo: 0.6 },
  { key: 'trade.core', currentVersion: '3.4.0', availableVersion: '3.5.0', risk: 'HIGH', selfService: false, daysAgo: 0.8 },
  { key: 'accounting.ledger', currentVersion: '4.1.2', availableVersion: '4.2.0', risk: 'MEDIUM', backup: true, daysAgo: 1.0 },
  { key: 'workspace.identity', currentVersion: '1.18.0', availableVersion: '1.19.0', risk: 'LOW', nullCurrentChecksum: true, daysAgo: 1.2 },
  { key: 'trade.quotes', currentVersion: '3.1.4', availableVersion: '3.2.0', risk: 'LOW', daysAgo: 1.4 },
  { key: 'accounting.tax', currentVersion: '4.0.5', availableVersion: '4.1.0', risk: 'HIGH', selfService: false, maintenance: true, daysAgo: 1.6 },
  { key: 'crm.activities', currentVersion: '2.6.0', availableVersion: '2.6.2', risk: 'LOW', daysAgo: 1.8 },
  { key: 'trade.inventory', currentVersion: '3.3.1', availableVersion: '3.4.0', risk: 'MEDIUM', maintenance: true, daysAgo: 2.0 },
  { key: 'workspace.notifications', currentVersion: '1.12.0', availableVersion: '1.13.0', risk: 'LOW', daysAgo: 2.2 },
  { key: 'accounting.banking', currentVersion: '4.2.0', availableVersion: '4.3.0', risk: 'MEDIUM', backup: true, maintenance: true, daysAgo: 2.4 },
  { key: 'crm.reports', currentVersion: '2.5.3', availableVersion: '2.6.0', risk: 'LOW', daysAgo: 2.6 },
  { key: 'trade.orders', currentVersion: '3.2.0', availableVersion: '3.3.0', risk: 'HIGH', daysAgo: 2.8 },
  { key: 'workspace.templates', currentVersion: '1.9.4', availableVersion: '1.10.0', risk: 'LOW', daysAgo: 3.0 },
  { key: 'accounting.receivables', currentVersion: '4.1.0', availableVersion: '4.1.3', risk: 'LOW', daysAgo: 3.2 },
  { key: 'accounting.payables', currentVersion: '4.1.0', availableVersion: '4.1.3', risk: 'LOW', daysAgo: 3.4 },
  { key: 'trade.pricing', currentVersion: '3.0.8', availableVersion: '3.1.0', risk: 'MEDIUM', daysAgo: 3.6 },
  { key: 'crm.extras-01', currentVersion: '1.0.0', availableVersion: '1.1.0', risk: 'LOW', daysAgo: 3.8 },
  { key: 'crm.extras-02', currentVersion: '1.0.1', availableVersion: '1.1.0', risk: 'LOW', daysAgo: 4.0 },
  { key: 'crm.extras-03', currentVersion: '1.0.2', availableVersion: '1.1.0', risk: 'MEDIUM', daysAgo: 4.2 },
  { key: 'crm.extras-04', currentVersion: '1.1.0', availableVersion: '1.2.0', risk: 'LOW', daysAgo: 4.4 },
  { key: 'crm.extras-05', currentVersion: '1.1.1', availableVersion: '1.2.0', risk: 'LOW', daysAgo: 4.6 },
  { key: 'crm.extras-06', currentVersion: '1.2.0', availableVersion: '1.3.0', risk: 'MEDIUM', daysAgo: 4.8 },
  { key: 'workspace.audit', currentVersion: '1.7.0', availableVersion: '1.8.0', risk: 'LOW', daysAgo: 5.0 },
  // Page 2 (rows 26..32)
  { key: 'crm.extras-07', currentVersion: '1.2.1', availableVersion: '1.3.0', risk: 'LOW', daysAgo: 6.0 },
  { key: 'crm.extras-08', currentVersion: '1.3.0', availableVersion: '1.4.0', risk: 'LOW', daysAgo: 7.0 },
  { key: 'crm.extras-09', currentVersion: '1.3.2', availableVersion: '1.4.0', risk: 'MEDIUM', daysAgo: 8.0 },
  { key: 'trade.fulfilment', currentVersion: '3.1.0', availableVersion: '3.2.0', risk: 'MEDIUM', daysAgo: 9.0 },
  { key: 'accounting.assets', currentVersion: '4.0.1', availableVersion: '4.1.0', risk: 'LOW', daysAgo: 10.0 },
  { key: 'workspace.contacts', currentVersion: '1.14.0', availableVersion: '1.15.0', risk: 'LOW', daysAgo: 11.0 },
  { key: 'crm.extras-10', currentVersion: '1.4.0', availableVersion: '1.5.0', risk: 'HIGH', daysAgo: 12.0 },
];

const SEEDED_OPERATION_ID = seedUuidV7(0x00000900, 1);

function createSeedStore(): UpdatesFakeStore {
  const now = Date.now();
  const operations = new Map<string, StoredOperation>();

  const rows: TenantAvailableUpdate[] = SEED_SPECS.map((spec, index) => {
    const num = index + 1;
    const ownerApp = spec.key.split('.')[0];
    const currentReleaseId = seedUuidV7(0x00000100, num);
    const availableReleaseId = seedUuidV7(0x00000200, num);
    const publishedMs = now - Math.round(spec.daysAgo * 86_400_000);

    if (spec.planned) {
      const requestedAt = new Date(now - 20_000).toISOString();
      operations.set(SEEDED_OPERATION_ID, {
        id: SEEDED_OPERATION_ID,
        type: 'UPDATE',
        requestedAt,
        hasHighRisk: spec.risk === 'HIGH',
        affectedComponentKeys: [spec.key],
        steps: [
          {
            id: seedUuidV7(0x00000910, 1),
            componentKey: spec.key,
            stepKey: `apply:${spec.key}`,
            status: 'RUNNING',
            fromVersion: spec.currentVersion,
            targetVersion: spec.availableVersion,
            safeError: null,
          },
        ],
        settledStatus: null,
        completedAt: null,
        updatedAt: new Date(now - 2_000).toISOString(),
        rowsClearedOnSuccess: false,
      });
    }

    return {
      lastOperationId: spec.planned ? SEEDED_OPERATION_ID : null,
      componentId: seedUuidV7(0x00000300, num),
      componentKey: spec.key,
      ownerApp,
      installationState: 'OUTDATED',
      current: {
        releaseId: currentReleaseId,
        releaseVersion: spec.currentVersion,
        schemaVersion: `schema.${spec.currentVersion}`,
        manifestChecksum: spec.nullCurrentChecksum ? null : seedSha256(`cur:${spec.key}:${spec.currentVersion}`),
      },
      desiredReleaseId: spec.planned ? availableReleaseId : null,
      updateAlreadyPlanned: Boolean(spec.planned),
      availableRelease: {
        id: availableReleaseId,
        releaseVersion: spec.availableVersion,
        manifestVersion: num + 10,
        schemaTarget: `schema.${spec.availableVersion}`,
        manifestChecksum: seedSha256(`avail:${spec.key}:${spec.availableVersion}`),
        riskLevel: spec.risk,
        selfServiceAllowed: spec.selfService ?? true,
        requiresBackup: spec.backup ?? false,
        requiresMaintenance: spec.maintenance ?? false,
        publishedAt: new Date(publishedMs).toISOString(),
        schemaChecksum: seedSha256(`schema:${spec.key}:${spec.availableVersion}`),
        compatibilityContractVersion: 1,
      },
    };
  });

  return {
    rows,
    operations,
    idempotency: new Map<string, IdempotencyEntry>(),
  };
}

let store: UpdatesFakeStore = createSeedStore();

export function fakeResetUpdates(): void {
  store = createSeedStore();
  FAKE_UPDATES_FAIL_NEXT.code = null;
  FAKE_UPDATES_FAIL_NEXT.status = 500;
  FAKE_UPDATES_FAIL_NEXT.on = 'apply';
  FAKE_UPDATES_OPERATION_OUTCOME.status = 'SUCCEEDED';
  FAKE_UPDATES_STATE.blocked = false;
  FAKE_UPDATES_STATE.tenantActive = true;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consumeFailure(target: 'list' | 'apply' | 'operation'): { code: string; status: number } | null {
  if (!FAKE_UPDATES_FAIL_NEXT.code || FAKE_UPDATES_FAIL_NEXT.on !== target) {
    return null;
  }
  const code = FAKE_UPDATES_FAIL_NEXT.code;
  const status = FAKE_UPDATES_FAIL_NEXT.status;
  FAKE_UPDATES_FAIL_NEXT.code = null;
  FAKE_UPDATES_FAIL_NEXT.status = 500;
  return { code, status };
}

function throwConfiguredFailure(code: string, status: number): never {
  if (code === 'NETWORK') {
    throw new ApiError(0, 'NETWORK');
  }
  if (code === 'FORBIDDEN') {
    throw new ApiError(403, 'FORBIDDEN');
  }
  if (code === 'SERVER_ERROR') {
    throw new ApiError(500, 'SERVER_ERROR');
  }
  if (code === 'API_RESPONSE_INVALID') {
    throw new ApiError(200, 'API_RESPONSE_INVALID');
  }
  throw new ApiError(status, code);
}

function riskRank(risk: ComponentRisk): number {
  switch (risk) {
    case 'LOW':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'HIGH':
      return 3;
  }
}

function computeOperationView(op: StoredOperation): TenantOperationDetail {
  const now = Date.now();
  const requestedMs = Date.parse(op.requestedAt);
  const elapsed = Number.isFinite(requestedMs) ? Math.max(0, now - requestedMs) : 0;

  let status: OperationStatus;
  let currentPhase: string | null = null;
  let safeError: { code: string; message: string } | null = null;
  let completedAt = op.completedAt;
  let updatedAt = op.updatedAt;
  const totalSteps = op.steps.length;
  let completedSteps = 0;
  let failedSteps = 0;
  let percent = 0;
  let steps: OperationStep[];

  if (op.settledStatus) {
    status = op.settledStatus;
    if (status === 'SUCCEEDED') {
      completedSteps = totalSteps;
      percent = 100;
      steps = op.steps.map((s) => ({ ...s, status: 'SUCCEEDED', safeError: null }));
    } else if (status === 'FAILED_RETRYABLE' || status === 'MANUAL_RECOVERY_REQUIRED') {
      failedSteps = totalSteps > 0 ? 1 : 0;
      completedSteps = Math.max(0, totalSteps - failedSteps);
      percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      safeError = { code: 'STEP_FAILED', message: 'Simulated internal error (hidden from UI)' };
      steps = op.steps.map((s, idx) =>
        idx === totalSteps - 1
          ? { ...s, status: 'FAILED', safeError: { code: 'STEP_FAILED', message: 'Simulated internal error' } }
          : { ...s, status: 'SUCCEEDED', safeError: null },
      );
    } else {
      percent = 0;
      steps = op.steps.map((s) => ({ ...s, status: 'CANCELLED', safeError: null }));
    }
  } else if (elapsed < 3_000) {
    status = 'QUEUED';
    currentPhase = op.hasHighRisk ? 'AWAITING_PREREQUISITES' : null;
    percent = 0;
    updatedAt = op.requestedAt;
    steps = op.steps.map((s) => ({ ...s, status: 'PENDING', safeError: null }));
  } else if (elapsed < 6_000) {
    status = 'PLANNING';
    percent = 5;
    updatedAt = new Date(requestedMs + 3_000).toISOString();
    steps = op.steps.map((s) => ({ ...s, status: 'PENDING', safeError: null }));
  } else if (elapsed < 18_000) {
    status = 'RUNNING';
    const ratio = (elapsed - 6_000) / 12_000;
    percent = Math.min(90, Math.max(10, Math.round(10 + ratio * 80)));
    completedSteps = Math.min(totalSteps - 1, Math.floor(ratio * totalSteps));
    updatedAt = new Date(now - 500).toISOString();
    steps = op.steps.map((s, idx) => ({
      ...s,
      status: idx < completedSteps ? 'SUCCEEDED' : idx === completedSteps ? 'RUNNING' : 'PENDING',
      safeError: null,
    }));
  } else {
    const target = FAKE_UPDATES_OPERATION_OUTCOME.status;
    if (target === 'WAITING_RETRY') {
      status = 'WAITING_RETRY';
      completedSteps = Math.max(0, Math.floor(totalSteps / 2));
      percent = totalSteps > 0 ? Math.max(25, Math.round((completedSteps / totalSteps) * 100)) : 25;
      updatedAt = new Date(now - 500).toISOString();
      steps = op.steps.map((s, idx) => ({
        ...s,
        status: idx < completedSteps ? 'SUCCEEDED' : 'WAITING_RETRY',
        safeError: null,
      }));
    } else {
      status = target;
      op.settledStatus = target;
      completedAt = new Date().toISOString();
      op.completedAt = completedAt;
      updatedAt = completedAt;
      op.updatedAt = updatedAt;

      if (target === 'SUCCEEDED') {
        completedSteps = totalSteps;
        percent = 100;
        steps = op.steps.map((s) => ({ ...s, status: 'SUCCEEDED', safeError: null }));
      } else if (target === 'FAILED_RETRYABLE' || target === 'MANUAL_RECOVERY_REQUIRED') {
        failedSteps = totalSteps > 0 ? 1 : 0;
        completedSteps = Math.max(0, totalSteps - failedSteps);
        percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        safeError = { code: 'STEP_FAILED', message: 'Simulated internal error (hidden from UI)' };
        steps = op.steps.map((s, idx) =>
          idx === totalSteps - 1
            ? { ...s, status: 'FAILED', safeError: { code: 'STEP_FAILED', message: 'Simulated internal error' } }
            : { ...s, status: 'SUCCEEDED', safeError: null },
        );
        unplanRowsForOperation(op);
      } else {
        // CANCELLED or non-terminal override treated as terminal cancelled if configured
        percent = 0;
        steps = op.steps.map((s) => ({ ...s, status: 'CANCELLED', safeError: null }));
        unplanRowsForOperation(op);
      }
    }
  }

  op.steps = steps;
  return {
    id: op.id,
    type: op.type,
    status,
    currentPhase,
    requestedAt: op.requestedAt,
    completedAt,
    updatedAt,
    safeError,
    progress: {
      totalSteps,
      completedSteps,
      failedSteps,
      percent,
    },
    steps: clone(steps),
  };
}

function unplanRowsForOperation(op: StoredOperation): void {
  const keys = new Set(op.affectedComponentKeys);
  for (const row of store.rows) {
    if (keys.has(row.componentKey) && row.lastOperationId === op.id) {
      row.updateAlreadyPlanned = false;
      row.desiredReleaseId = null;
    }
  }
}

function isSelectionShapeValid(sel: UpdateSelection): boolean {
  if (!sel || typeof sel !== 'object') return false;
  return (
    isValidComponentKey(sel.componentKey) &&
    isUuidV7(sel.targetReleaseId) &&
    typeof sel.targetReleaseVersion === 'string' &&
    sel.targetReleaseVersion.length >= 1 &&
    sel.targetReleaseVersion.length <= 120 &&
    isSha256(sel.targetManifestChecksum) &&
    isUuidV7(sel.currentAppliedReleaseId) &&
    isSha256(sel.currentAppliedManifestChecksum)
  );
}

function canonicalApplyFingerprint(body: ApplyUpdatesBody): string {
  const normalized = body.selections.map((s) => ({
    componentKey: s.componentKey,
    targetReleaseId: s.targetReleaseId,
    targetReleaseVersion: s.targetReleaseVersion,
    targetManifestChecksum: s.targetManifestChecksum,
    currentAppliedReleaseId: s.currentAppliedReleaseId,
    currentAppliedManifestChecksum: s.currentAppliedManifestChecksum,
  }));
  return JSON.stringify({ selections: normalized });
}

export async function fakeListUpdates(query: UpdatesQuery): Promise<UpdatesPageResult> {
  await fakeDelay();
  const fail = consumeFailure('list');
  if (fail) {
    throwConfiguredFailure(fail.code, fail.status);
  }

  const limit = query.limit > 0 ? query.limit : PAGE_SIZE;
  if (FAKE_UPDATES_STATE.blocked) {
    return {
      data: [],
      meta: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    };
  }

  let filtered = store.rows.slice();

  const componentFilter = (query.componentKey ?? '').trim().toLowerCase();
  if (componentFilter) {
    filtered = filtered.filter((row) => row.componentKey.toLowerCase().includes(componentFilter));
  }

  const searchFilter = (query.search ?? '').trim().toLowerCase();
  if (searchFilter) {
    filtered = filtered.filter(
      (row) =>
        row.componentKey.toLowerCase().includes(searchFilter) ||
        row.ownerApp.toLowerCase().includes(searchFilter),
    );
  }

  if (query.riskLevel) {
    filtered = filtered.filter((row) => row.availableRelease.riskLevel === query.riskLevel);
  }
  if (query.requiresBackup !== undefined) {
    filtered = filtered.filter((row) => row.availableRelease.requiresBackup === query.requiresBackup);
  }
  if (query.requiresMaintenance !== undefined) {
    filtered = filtered.filter((row) => row.availableRelease.requiresMaintenance === query.requiresMaintenance);
  }

  const dir = query.sortDir === 'ASC' ? 1 : -1;
  filtered.sort((a, b) => {
    let cmp = 0;
    if (query.sortBy === 'componentKey') {
      cmp = a.componentKey.localeCompare(b.componentKey);
    } else if (query.sortBy === 'riskLevel') {
      cmp = riskRank(a.availableRelease.riskLevel) - riskRank(b.availableRelease.riskLevel);
    } else {
      cmp =
        new Date(a.availableRelease.publishedAt).getTime() -
        new Date(b.availableRelease.publishedAt).getTime();
    }
    if (cmp !== 0) return cmp * dir;
    return a.componentKey.localeCompare(b.componentKey);
  });

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const page = totalPages === 0 ? 1 : Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * limit;
  const data = clone(filtered.slice(start, start + limit));

  return {
    data,
    meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}

export async function fakeApplyUpdates(
  body: ApplyUpdatesBody,
  key: string,
): Promise<ApplyUpdatesResponse> {
  await fakeDelay();

  const fail = consumeFailure('apply');
  let postCommitFailure: 'NETWORK_AFTER_COMMIT' | 'RESPONSE_UNREADABLE' | null = null;
  if (fail) {
    if (fail.code === 'NETWORK_AFTER_COMMIT' || fail.code === 'RESPONSE_UNREADABLE') {
      postCommitFailure = fail.code;
    } else {
      throwConfiguredFailure(fail.code, fail.status);
    }
  }

  // 1. Key presence
  const trimmedKey = typeof key === 'string' ? key.trim() : '';
  if (!trimmedKey) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  // 2. UUIDv7 format
  if (!isUuidV7(trimmedKey)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY');
  }

  // 3. Body & selections validity
  if (
    !body ||
    !Array.isArray(body.selections) ||
    body.selections.length === 0 ||
    body.selections.length > MAX_SELECTIONS
  ) {
    throw new ApiError(400, 'TENANT_PROVISIONING_UPDATE_SELECTION_INVALID');
  }
  const seenKeys = new Set<string>();
  for (const sel of body.selections) {
    if (!isSelectionShapeValid(sel) || seenKeys.has(sel.componentKey)) {
      throw new ApiError(400, 'TENANT_PROVISIONING_UPDATE_SELECTION_INVALID');
    }
    seenKeys.add(sel.componentKey);
  }

  // 4. Idempotency check
  const fingerprint = canonicalApplyFingerprint(body);
  const idem = store.idempotency.get(trimmedKey);
  if (idem) {
    if (idem.fingerprint !== fingerprint) {
      throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
    }
    const existingOp = store.operations.get(idem.operationId);
    if (!existingOp) {
      throw new ApiError(404, 'TENANT_OPERATION_NOT_FOUND');
    }
    idem.replayedCount += 1;
    const view = computeOperationView(existingOp);
    if (postCommitFailure === 'NETWORK_AFTER_COMMIT') {
      throw new ApiError(0, 'NETWORK');
    }
    if (postCommitFailure === 'RESPONSE_UNREADABLE') {
      throw new ApiError(202, 'RESPONSE_UNREADABLE');
    }
    return {
      replayed: true,
      operation: clone(view),
    };
  }

  // 5. Tenant active & no active running/non-terminal operation
  if (!FAKE_UPDATES_STATE.tenantActive) {
    throw new ApiError(409, 'TENANT_PROVISIONING_OPERATION_STATE_INVALID');
  }
  for (const op of store.operations.values()) {
    const view = computeOperationView(op);
    if (
      view.status !== 'SUCCEEDED' &&
      view.status !== 'FAILED_RETRYABLE' &&
      view.status !== 'MANUAL_RECOVERY_REQUIRED' &&
      view.status !== 'CANCELLED'
    ) {
      throw new ApiError(409, 'TENANT_PROVISIONING_OPERATION_STATE_INVALID');
    }
  }

  // 6. Verify all 6 pins against live rows
  const liveByKey = new Map<string, TenantAvailableUpdate>(
    store.rows.map((row) => [row.componentKey, row]),
  );
  const matchedRows: TenantAvailableUpdate[] = [];
  for (const sel of body.selections) {
    const live = liveByKey.get(sel.componentKey);
    if (
      !live ||
      live.availableRelease.id !== sel.targetReleaseId ||
      live.availableRelease.releaseVersion !== sel.targetReleaseVersion ||
      live.availableRelease.manifestChecksum !== sel.targetManifestChecksum ||
      live.current.releaseId !== sel.currentAppliedReleaseId ||
      live.current.manifestChecksum !== sel.currentAppliedManifestChecksum
    ) {
      throw new ApiError(409, 'TENANT_PROVISIONING_UPDATE_SELECTION_STALE');
    }
    matchedRows.push(live);
  }

  // 7. Self-service eligibility rules on backend
  for (const row of matchedRows) {
    if (
      !row.availableRelease.selfServiceAllowed ||
      row.availableRelease.requiresBackup ||
      row.availableRelease.requiresMaintenance ||
      row.updateAlreadyPlanned
    ) {
      throw new ApiError(422, 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES');
    }
  }

  // Commit operation
  const now = Date.now();
  const opId = fakeId();
  const requestedAt = new Date(now).toISOString();
  const steps: OperationStep[] = matchedRows.map((row) => ({
    id: fakeId(),
    componentKey: row.componentKey,
    stepKey: `apply:${row.componentKey}`,
    status: 'PENDING',
    fromVersion: row.current.releaseVersion,
    targetVersion: row.availableRelease.releaseVersion,
    safeError: null,
  }));

  if (matchedRows.length >= 3) {
    steps.push({
      id: fakeId(),
      componentKey: 'platform.runtime-bridge',
      stepKey: 'dependency:platform.runtime-bridge',
      status: 'PENDING',
      fromVersion: '2.4.0',
      targetVersion: '2.5.0',
      safeError: null,
    });
  }

  const storedOp: StoredOperation = {
    id: opId,
    type: 'UPDATE',
    requestedAt,
    hasHighRisk: matchedRows.some((r) => r.availableRelease.riskLevel === 'HIGH'),
    affectedComponentKeys: matchedRows.map((r) => r.componentKey),
    steps,
    settledStatus: null,
    completedAt: null,
    updatedAt: requestedAt,
    rowsClearedOnSuccess: false,
  };

  store.operations.set(opId, storedOp);
  store.idempotency.set(trimmedKey, {
    fingerprint,
    operationId: opId,
    replayedCount: 0,
  });

  for (const row of matchedRows) {
    row.updateAlreadyPlanned = true;
    row.desiredReleaseId = row.availableRelease.id;
    row.lastOperationId = opId;
  }

  const operation = computeOperationView(storedOp);

  if (postCommitFailure === 'NETWORK_AFTER_COMMIT') {
    throw new ApiError(0, 'NETWORK');
  }
  if (postCommitFailure === 'RESPONSE_UNREADABLE') {
    throw new ApiError(202, 'RESPONSE_UNREADABLE');
  }

  return {
    replayed: false,
    operation: clone(operation),
  };
}

export async function fakeGetOperation(id: string): Promise<TenantOperationDetail> {
  await fakeDelay();

  const fail = consumeFailure('operation');
  if (fail) {
    if (fail.code === 'OPERATION_ID_MISMATCH') {
      const existing = store.operations.get(id);
      if (existing) {
        const view = computeOperationView(existing);
        return { ...clone(view), id: fakeId() };
      }
      const fallbackOp = store.operations.values().next().value;
      if (fallbackOp) {
        return { ...clone(computeOperationView(fallbackOp)), id: fakeId() };
      }
    }
    throwConfiguredFailure(fail.code, fail.status);
  }

  const op = store.operations.get(id);
  if (!op) {
    throw new ApiError(404, 'TENANT_OPERATION_NOT_FOUND');
  }

  const view = computeOperationView(op);
  if (view.status === 'SUCCEEDED' && !op.rowsClearedOnSuccess) {
    op.rowsClearedOnSuccess = true;
    const keys = new Set(op.affectedComponentKeys);
    store.rows = store.rows.filter((row) => !(keys.has(row.componentKey) && row.lastOperationId === op.id));
  }

  return clone(view);
}
