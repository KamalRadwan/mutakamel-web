// Fakes follow core-app tenant/application-access (company-addon-activation.*, branch-addon-override.*,
// company-application-activation.*, application-access-read/list, activation-continuation status) and the
// api-gateway-app rows in core-addon-activation-write.route-contracts.ts (WRITE_SENSITIVE + idempotent, owner replay).
// Order of checks on a write: gateway key (GW.IDEM.*), permission guard (MISSING_REQUIRED_PERMISSIONS), closed body
// (400 CORE_VALIDATION_FAILED, no details), exact-scope authority (403 ACCESS_POLICY_BLOCKED), receipt replay
// (422 IDEMPOTENCY_BODY_MISMATCH for another request under the same key), then the domain rules (409).
import { FAKE_ADDON_CATALOGUE, FAKE_ADDON_HOMES, FAKE_ADDON_WHATSAPP } from '../../billing/shared/addon-catalogue.fake';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { getBranch } from '../../staff/shared/staff.api';
import { fakeActorMe } from '../shared/fake-actor';
import { Me } from '../../staff/shared/staff.model';
import {
  ACTIVATION_REASON_MAX,
  ACTIVATION_REASON_MIN,
  ACTIVATION_REVISION_PATTERN,
  ActivationListItem,
  ActivationListResponse,
  ActivationOperationKind,
  ActivationSingleton,
  ActivationWriteReceipt,
  AddonActivationResource,
  AddonCommandRejectionReason,
  AddonCommandStatusResponse,
  ApplicationActivationResource,
  ApplicationReadSourceFacts,
  BindingState,
  BranchOverrideMode,
  BranchOverrideResource,
  CONTROL_CHAR_PATTERN,
  SetBranchOverrideBody,
  SetCompanyAddonBody,
  SetCompanyAddonResponse,
  SetCompanyApplicationBody,
} from './activation.model';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAKE_CMD_STORAGE_PREFIX = 'ws-activation-fake-cmd:';
const MANAGE_PERMISSION = 'applications.activation.manage';
const READ_PERMISSIONS = ['applications.activation.read', MANAGE_PERMISSION] as const;
/** Company Addon enable answers 202 PENDING above this many active inheriting Branch overrides. */
const SYNC_BRANCH_LIMIT = 100;
/** Branches validated per worker page in the fake. */
const BRANCHES_PER_PAGE = 100;

const APP_IDS: Readonly<Record<string, string>> = {
  accounting: '01950000-0000-7000-8000-000000000001',
  crm: '01950000-0000-7000-8000-000000000002',
  trade: '01950000-0000-7000-8000-000000000003',
};

const ADDON_IDS: Readonly<Record<string, string>> = Object.fromEntries(FAKE_ADDON_CATALOGUE.map((addon) => [addon.key, addon.id]));

const DEF_HOMES = FAKE_ADDON_HOMES.definitionVersionId;
const DEF_WHATSAPP = FAKE_ADDON_WHATSAPP.definitionVersionId;
const CFG_HOMES = '01950000-0000-7000-8000-000000002001';
const CFG_WHATSAPP = '01950000-0000-7000-8000-000000002002';

const KNOWN_BRANCH_COMPANY: Readonly<Record<string, string>> = {
  'br-cai': 'co-eg',
  'br-alx': 'co-eg',
  'br-mns': 'co-eg',
  'br-ruh': 'co-sa',
  'br-jed': 'co-sa',
};

interface StoredAppActivation {
  companyId: string;
  applicationId: string;
  applicationKey: string;
  state: BindingState;
  id: string | null;
  revision: string;
  enabled: boolean | null;
  allowanceReady: boolean;
  observedAt: string;
}

interface StoredAddonActivation {
  companyId: string;
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  state: BindingState;
  id: string | null;
  revision: string;
  enabled: boolean | null;
  definitionVersionId: string | null;
  selectedDefinitionVersionId: string | null;
  configVersionId: string | null;
  allowanceReady: boolean;
  simulatedLargeBranchCount: number;
  observedAt: string;
}

/** tenant_branch_addon_overrides: only stored rows; an absent row reads as NOT_CREATED, revision 0. */
interface StoredBranchOverride {
  branchId: string;
  companyId: string;
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  id: string;
  revision: string;
  mode: BranchOverrideMode;
  definitionVersionId: string;
  configVersionId: string | null;
}

/** tenant_company_addon_activation_commands: the id is the original x-idempotency-key. */
interface StoredCommand {
  commandId: string;
  fingerprint: string;
  actorId: string;
  companyId: string;
  applicationKey: string;
  addonKey: string;
  totalBranches: number;
  pageNumber: number;
  state: 'PENDING' | 'REJECTED' | 'COMMITTED';
  reason: AddonCommandRejectionReason | null;
  receipt: ActivationWriteReceipt | null;
}

/** tenant_addon_operation_receipts: one row per intent (key) across every activation route. */
interface StoredReceipt {
  fingerprint: string;
  receipt: ActivationWriteReceipt;
}

interface ActivationStore {
  apps: StoredAppActivation[];
  addons: StoredAddonActivation[];
  branchOverrides: StoredBranchOverride[];
  commands: Map<string, StoredCommand>;
  receipts: Map<string, StoredReceipt>;
}

let fakeRejection: AddonCommandRejectionReason | null = null;

function createSeedStore(): ActivationStore {
  const observedAt = '2026-11-20T09:00:00.000Z';
  return {
    apps: [
      {
        companyId: 'co-eg',
        applicationId: APP_IDS['accounting'],
        applicationKey: 'accounting',
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000010001',
        revision: '2',
        enabled: true,
        allowanceReady: true,
        observedAt,
      },
      {
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000010002',
        revision: '3',
        enabled: true,
        allowanceReady: true,
        observedAt,
      },
      {
        companyId: 'co-eg',
        applicationId: APP_IDS['trade'],
        applicationKey: 'trade',
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000010003',
        revision: '1',
        enabled: false,
        allowanceReady: false,
        observedAt,
      },
      {
        companyId: 'co-sa',
        applicationId: APP_IDS['accounting'],
        applicationKey: 'accounting',
        state: 'NOT_CREATED',
        id: null,
        revision: '0',
        enabled: null,
        allowanceReady: true,
        observedAt,
      },
      {
        companyId: 'co-sa',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000020002',
        revision: '2',
        enabled: true,
        allowanceReady: true,
        observedAt,
      },
      {
        companyId: 'co-sa',
        applicationId: APP_IDS['trade'],
        applicationKey: 'trade',
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000020003',
        revision: '2',
        enabled: true,
        allowanceReady: true,
        observedAt,
      },
    ],
    addons: [
      {
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_HOMES.key],
        addonKey: FAKE_ADDON_HOMES.key,
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000010101',
        revision: '2',
        enabled: true,
        definitionVersionId: DEF_HOMES,
        selectedDefinitionVersionId: DEF_HOMES,
        configVersionId: CFG_HOMES,
        allowanceReady: true,
        simulatedLargeBranchCount: 3,
        observedAt,
      },
      {
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000010102',
        revision: '4',
        enabled: false,
        definitionVersionId: DEF_WHATSAPP,
        selectedDefinitionVersionId: DEF_WHATSAPP,
        configVersionId: CFG_WHATSAPP,
        allowanceReady: true,
        simulatedLargeBranchCount: 142,
        observedAt,
      },
      {
        companyId: 'co-sa',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_HOMES.key],
        addonKey: FAKE_ADDON_HOMES.key,
        state: 'NOT_CREATED',
        id: null,
        revision: '0',
        enabled: null,
        definitionVersionId: null,
        selectedDefinitionVersionId: DEF_HOMES,
        configVersionId: null,
        allowanceReady: true,
        simulatedLargeBranchCount: 2,
        observedAt,
      },
      {
        companyId: 'co-sa',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        state: 'STORED',
        id: '01950000-0000-7000-8000-000000020102',
        revision: '1',
        enabled: true,
        definitionVersionId: DEF_WHATSAPP,
        selectedDefinitionVersionId: DEF_WHATSAPP,
        configVersionId: CFG_WHATSAPP,
        allowanceReady: true,
        simulatedLargeBranchCount: 2,
        observedAt,
      },
    ],
    branchOverrides: [
      {
        branchId: 'br-alx',
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_HOMES.key],
        addonKey: FAKE_ADDON_HOMES.key,
        id: '01950000-0000-7000-8000-000000030001',
        revision: '2',
        mode: 'DISABLED',
        definitionVersionId: DEF_HOMES,
        configVersionId: null,
      },
      {
        branchId: 'br-mns',
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_HOMES.key],
        addonKey: FAKE_ADDON_HOMES.key,
        id: '01950000-0000-7000-8000-000000030002',
        revision: '1',
        mode: 'INHERIT',
        definitionVersionId: DEF_HOMES,
        configVersionId: null,
      },
      {
        branchId: 'br-cai',
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        id: '01950000-0000-7000-8000-000000030003',
        revision: '1',
        mode: 'INHERIT',
        definitionVersionId: DEF_WHATSAPP,
        configVersionId: null,
      },
      {
        branchId: 'br-alx',
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        id: '01950000-0000-7000-8000-000000030004',
        revision: '1',
        mode: 'INHERIT',
        definitionVersionId: DEF_WHATSAPP,
        configVersionId: null,
      },
      {
        branchId: 'br-mns',
        companyId: 'co-eg',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        id: '01950000-0000-7000-8000-000000030005',
        revision: '1',
        mode: 'DISABLED',
        definitionVersionId: DEF_WHATSAPP,
        configVersionId: null,
      },
      {
        branchId: 'br-ruh',
        companyId: 'co-sa',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        id: '01950000-0000-7000-8000-000000040001',
        revision: '1',
        mode: 'INHERIT',
        definitionVersionId: DEF_WHATSAPP,
        configVersionId: null,
      },
      {
        branchId: 'br-jed',
        companyId: 'co-sa',
        applicationId: APP_IDS['crm'],
        applicationKey: 'crm',
        addonId: ADDON_IDS[FAKE_ADDON_WHATSAPP.key],
        addonKey: FAKE_ADDON_WHATSAPP.key,
        id: '01950000-0000-7000-8000-000000040002',
        revision: '1',
        mode: 'DISABLED',
        definitionVersionId: DEF_WHATSAPP,
        configVersionId: null,
      },
    ],
    commands: new Map<string, StoredCommand>(),
    receipts: new Map<string, StoredReceipt>(),
  };
}

let store: ActivationStore = createSeedStore();

let fakeError: ApiError | null = null;

export function setActivationFakeError(error: ApiError | null): void {
  fakeError = error;
}

function assertAvailable(): void {
  if (fakeError) throw fakeError;
}

export function resetActivationFake(): void {
  store = createSeedStore();
  fakeError = null;
  fakeRejection = null;
  clearStoredFakeCommands();
}

export function setFakeAddonCommandRejection(reason: AddonCommandRejectionReason | null): void {
  fakeRejection = reason;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---- errors, in the shapes the backend sends ----

/** Gateway `gateway-idempotency.service.ts`: the key is checked before the request reaches Core. */
function assertIdempotencyKey(key: string): void {
  if (!key) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7_PATTERN.test(key)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
}

/** Core PermissionsGuard, `@RequirePermissions`: the permission held at any scope. */
function requirePermission(me: Me, permission: string): void {
  if (me.isTenantOwner || me.permissions.includes(permission) || me.permissionScopes[permission]) return;
  throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { permissions: [permission] });
}

/** Core PermissionsGuard, `@RequireAnyPermissions`. */
function requireAnyPermission(me: Me, permissions: readonly string[]): void {
  if (me.isTenantOwner || permissions.some((key) => me.permissions.includes(key) || me.permissionScopes[key])) return;
  throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { anyPermissions: [...permissions] });
}

/** `invalidAccessCommand()`: the access command codec sends no field details. */
function invalid(): never {
  throw new ApiError(400, 'CORE_VALIDATION_FAILED');
}

/** `accessDenied()`: no exact-scope authority, or an unknown/inactive Company or Branch. */
function denied(): never {
  throw new ApiError(403, 'ACCESS_POLICY_BLOCKED');
}

/** `scopedAddonNotReady()` / `notReady()`. */
function notReady(): never {
  throw new ApiError(409, 'APPLICATION_ALLOWANCE_NOT_READY');
}

// ---- exact-scope authority (ApplicationAccessManagementContext.authorize) ----

function holdsAt(me: Me, permission: string, companyId: string, branchId: string | null): boolean {
  const scope = me.permissionScopes[permission];
  if (!scope) return false;
  return scope.tenantWide || scope.companyIds.includes(companyId) || (branchId !== null && scope.branchIds.includes(branchId));
}

function canRead(me: Me, companyId: string, branchId: string | null = null): boolean {
  return me.isTenantOwner || READ_PERMISSIONS.some((perm) => holdsAt(me, perm, companyId, branchId));
}

function canManage(me: Me, companyId: string, branchId: string | null = null): boolean {
  return me.isTenantOwner || holdsAt(me, MANAGE_PERMISSION, companyId, branchId);
}

async function branchCompanyId(branchId: string): Promise<string> {
  const known = KNOWN_BRANCH_COMPANY[branchId];
  if (known) return known;
  try {
    return (await getBranch(branchId)).companyId;
  } catch {
    return denied();
  }
}

// ---- closed body codec (application-access-command.contract.ts) ----

function closedBody(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const record = value as Record<string, unknown>;
  const present = Object.keys(record);
  if (present.length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) invalid();
  return record;
}

function zeroOrRevision(value: unknown): value is string {
  return typeof value === 'string' && ACTIVATION_REVISION_PATTERN.test(value);
}

/** `reason()`: 3..500 UTF-16 units, no surrounding spaces, no control characters. */
function isValidReason(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= ACTIVATION_REASON_MIN &&
    value.length <= ACTIVATION_REASON_MAX &&
    value.trim() === value &&
    !CONTROL_CHAR_PATTERN.test(value)
  );
}

// ---- receipts and idempotency (application-access-command.receipts.ts) ----

function fingerprintOf(kind: ActivationOperationKind, me: Me, target: object, body: unknown): string {
  return JSON.stringify({ kind, actorId: me.id, target, body });
}

/** The same key with another request (route, target, actor or body) is a mismatch, also against a 202 command. */
function replayed(key: string, fingerprint: string): ActivationWriteReceipt | null {
  const command = readCommand(key);
  if (command && command.fingerprint !== fingerprint) throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
  const stored = store.receipts.get(key);
  if (!stored) return null;
  if (stored.fingerprint !== fingerprint) throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
  return clone(stored.receipt);
}

function commitReceipt(
  key: string,
  fingerprint: string,
  operationKind: ActivationOperationKind,
  result: { changed: boolean; resourceId: string; resourceRevision: string },
): ActivationWriteReceipt {
  const receipt: ActivationWriteReceipt = {
    operationId: newIdempotencyKey(),
    operationRevision: '1',
    state: 'COMMITTED',
    operationKind,
    ...result,
    completedAt: new Date().toISOString(),
  };
  store.receipts.set(key, { fingerprint, receipt });
  return clone(receipt);
}

function nextRevision(current: string): string {
  return String(BigInt(current) + 1n);
}

// ---- 202 activation commands (activation-continuation) ----

function saveCommand(command: StoredCommand): void {
  store.commands.set(command.commandId, command);
  try {
    sessionStorage.setItem(`${FAKE_CMD_STORAGE_PREFIX}${command.commandId}`, JSON.stringify(command));
  } catch {
    // Storage unavailable: the in-memory copy still serves this page.
  }
}

/** Survives a page reload in the fake, like the retained command row. */
function readCommand(commandId: string): StoredCommand | null {
  const inMemory = store.commands.get(commandId);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(`${FAKE_CMD_STORAGE_PREFIX}${commandId}`);
    const parsed = raw ? (JSON.parse(raw) as StoredCommand) : null;
    if (parsed?.commandId !== commandId) return null;
    store.commands.set(commandId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function clearStoredFakeCommands(): void {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i));
    for (const key of keys) {
      if (key?.startsWith(FAKE_CMD_STORAGE_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable
  }
}

/** `companyAddonActivationStatus()`: revision = page + 1 while pending, page + 2 once terminal. */
function commandStatus(command: StoredCommand): AddonCommandStatusResponse {
  if (command.state === 'COMMITTED' && command.receipt) return clone(command.receipt);
  const identity = {
    commandId: command.commandId,
    revision: String(command.pageNumber + (command.state === 'REJECTED' ? 2 : 1)),
    operationKind: 'SET_ADDON_ACTIVATION' as const,
    operationalUse: 'NOT_EVALUATED' as const,
  };
  if (command.state === 'REJECTED' && command.reason) {
    return { ...identity, state: 'REJECTED', reason: command.reason };
  }
  return {
    ...identity,
    state: 'PENDING',
    progress: {
      pageNumber: String(command.pageNumber),
      validatedBranchCount: String(Math.min(command.totalBranches, command.pageNumber * BRANCHES_PER_PAGE)),
    },
  };
}

/** One worker step per poll: validate one page of Branches, then finalize. */
function advanceCommand(command: StoredCommand): void {
  if (command.state !== 'PENDING') return;
  if (command.pageNumber * BRANCHES_PER_PAGE < command.totalBranches) {
    command.pageNumber += 1;
  } else if (fakeRejection !== null) {
    command.state = 'REJECTED';
    command.reason = fakeRejection;
  } else {
    const entry = findAddon(command.companyId, command.applicationKey, command.addonKey);
    if (!entry?.id) {
      command.state = 'REJECTED';
      command.reason = 'SOURCE_CHANGED';
    } else {
      entry.enabled = true;
      entry.revision = nextRevision(entry.revision);
      command.state = 'COMMITTED';
      command.receipt = commitReceipt(command.commandId, command.fingerprint, 'SET_ADDON_ACTIVATION', {
        changed: true,
        resourceId: entry.id,
        resourceRevision: entry.revision,
      });
    }
  }
  saveCommand(command);
}

// ---- lookups and read projections ----

function findApp(companyId: string, appKey: string): StoredAppActivation | undefined {
  return store.apps.find((item) => item.companyId === companyId && item.applicationKey === appKey);
}

function findAddon(companyId: string, appKey: string, addonKey: string): StoredAddonActivation | undefined {
  return store.addons.find(
    (item) => item.companyId === companyId && item.applicationKey === appKey && item.addonKey === addonKey,
  );
}

function findBranchOverride(branchId: string, appKey: string, addonKey: string): StoredBranchOverride | undefined {
  return store.branchOverrides.find(
    (item) => item.branchId === branchId && item.applicationKey === appKey && item.addonKey === addonKey,
  );
}

function isOn(binding: { state: BindingState; enabled: boolean | null } | undefined): boolean {
  return binding?.state === 'STORED' && binding.enabled === true;
}

function toAppListItem(entry: StoredAppActivation): ActivationListItem<ApplicationActivationResource> {
  return {
    scope: { kind: 'COMPANY', companyId: entry.companyId, branchId: null },
    target: { applicationId: entry.applicationId, applicationKey: entry.applicationKey, addonId: null, addonKey: null },
    resourceScope: 'COMPANY',
    resource: {
      kind: 'APPLICATION_ACTIVATION',
      state: entry.state,
      id: entry.id,
      revision: entry.revision,
      enabled: entry.enabled,
    },
    observation: 'LOCAL_PROJECTION',
    operationalUse: 'NOT_EVALUATED',
  };
}

function toAddonListItem(entry: StoredAddonActivation): ActivationListItem<AddonActivationResource> {
  return {
    scope: { kind: 'COMPANY', companyId: entry.companyId, branchId: null },
    target: {
      applicationId: entry.applicationId,
      applicationKey: entry.applicationKey,
      addonId: entry.addonId,
      addonKey: entry.addonKey,
    },
    resourceScope: 'COMPANY',
    resource: {
      kind: 'ADDON_ACTIVATION',
      state: entry.state,
      id: entry.id,
      revision: entry.revision,
      enabled: entry.enabled,
      definitionVersionId: entry.definitionVersionId,
      configVersionId: entry.configVersionId,
    },
    observation: 'LOCAL_PROJECTION',
    operationalUse: 'NOT_EVALUATED',
  };
}

function sourceFactsForApp(entry: StoredAppActivation): ApplicationReadSourceFacts {
  return {
    selectionState: 'SELECTED',
    applicationLifecycleStatus: 'ACTIVE',
    addonLifecycleStatus: null,
    definitionState: 'NOT_APPLICABLE',
    localSourceState: 'MATCHED',
    adoptionPending: false,
    observedAt: entry.observedAt,
    selectedDefinitionVersionId: null,
  };
}

function sourceFactsForAddon(entry: StoredAddonActivation): ApplicationReadSourceFacts {
  const selected = entry.selectedDefinitionVersionId;
  return {
    selectionState: selected ? 'SELECTED' : 'NOT_SELECTED',
    applicationLifecycleStatus: 'ACTIVE',
    addonLifecycleStatus: 'ACTIVE',
    definitionState: selected ? 'PUBLISHED' : 'UNAVAILABLE',
    localSourceState: selected ? 'MATCHED' : 'MISSING',
    adoptionPending: false,
    observedAt: entry.observedAt,
    selectedDefinitionVersionId: selected,
  };
}

/** application-access-read.local.ts: the Branch row's own pins; the Company flags come from its bindings. */
function branchOverrideResource(
  row: StoredBranchOverride | undefined,
  app: StoredAppActivation | undefined,
  addon: StoredAddonActivation,
): BranchOverrideResource {
  return {
    kind: 'BRANCH_OVERRIDE',
    state: row ? 'STORED' : 'NOT_CREATED',
    id: row?.id ?? null,
    revision: row?.revision ?? '0',
    mode: row?.mode ?? null,
    definitionVersionId: row?.definitionVersionId ?? null,
    configVersionId: row?.configVersionId ?? null,
    companyApplicationEnabled: isOn(app),
    companyAddonEnabled: isOn(addon),
  };
}

// ---- reads ----

/** GET companies/:companyId/application-activations (ANY read/manage; page 1..1000000, limit 1..100). */
export async function fakeListCompanyActivations(companyId: string, page = 1, limit = 20): Promise<ActivationListResponse> {
  assertAvailable();
  const me = fakeActorMe();
  requireAnyPermission(me, READ_PERMISSIONS);
  if (!Number.isInteger(page) || page < 1 || page > 1_000_000) invalid();
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
  if (!canRead(me, companyId)) denied();

  const combined: ActivationListItem[] = [
    ...store.apps.filter((item) => item.companyId === companyId).map(toAppListItem),
    ...store.addons.filter((item) => item.companyId === companyId).map(toAddonListItem),
  ].sort((a, b) => {
    const appCmp = a.target.applicationKey.localeCompare(b.target.applicationKey, 'en');
    if (appCmp !== 0) return appCmp;
    if (a.target.addonKey === null) return b.target.addonKey === null ? 0 : -1;
    if (b.target.addonKey === null) return 1;
    return a.target.addonKey.localeCompare(b.target.addonKey, 'en');
  });

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return clone({
    data: combined.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
}

/** GET companies/:companyId/application-activations/:applicationKey */
export async function fakeGetCompanyApplication(
  companyId: string,
  appKey: string,
): Promise<ActivationSingleton<ApplicationActivationResource>> {
  assertAvailable();
  const me = fakeActorMe();
  requireAnyPermission(me, READ_PERMISSIONS);
  if (!canRead(me, companyId)) denied();
  const entry = findApp(companyId, appKey);
  if (!entry) throw new ApiError(404, 'APPLICATION_NOT_FOUND');
  const item = toAppListItem(entry);
  return clone({
    scope: item.scope,
    target: item.target,
    resource: item.resource,
    source: sourceFactsForApp(entry),
    operationalUse: 'NOT_EVALUATED',
  });
}

/** GET companies/:companyId/application-activations/:applicationKey/addons/:addonKey */
export async function fakeGetCompanyAddon(
  companyId: string,
  appKey: string,
  addonKey: string,
): Promise<ActivationSingleton<AddonActivationResource>> {
  assertAvailable();
  const me = fakeActorMe();
  requireAnyPermission(me, READ_PERMISSIONS);
  if (!canRead(me, companyId)) denied();
  if (!APP_IDS[appKey]) throw new ApiError(404, 'APPLICATION_NOT_FOUND');
  const entry = findAddon(companyId, appKey, addonKey);
  if (!entry) throw new ApiError(404, 'ADDON_NOT_FOUND');
  const item = toAddonListItem(entry);
  return clone({
    scope: item.scope,
    target: item.target,
    resource: item.resource,
    source: sourceFactsForAddon(entry),
    operationalUse: 'NOT_EVALUATED',
  });
}

/** GET branches/:branchId/application-activations/:applicationKey/addons/:addonKey */
export async function fakeGetBranchAddon(
  branchId: string,
  appKey: string,
  addonKey: string,
): Promise<ActivationSingleton<BranchOverrideResource>> {
  assertAvailable();
  const me = fakeActorMe();
  requireAnyPermission(me, READ_PERMISSIONS);
  const companyId = await branchCompanyId(branchId);
  if (!canRead(me, companyId, branchId)) denied();
  if (!APP_IDS[appKey]) throw new ApiError(404, 'APPLICATION_NOT_FOUND');
  const addon = findAddon(companyId, appKey, addonKey);
  if (!addon) throw new ApiError(404, 'ADDON_NOT_FOUND');
  return clone({
    scope: { kind: 'BRANCH', companyId, branchId },
    target: { applicationId: addon.applicationId, applicationKey: appKey, addonId: addon.addonId, addonKey },
    resource: branchOverrideResource(findBranchOverride(branchId, appKey, addonKey), findApp(companyId, appKey), addon),
    source: sourceFactsForAddon(addon),
    operationalUse: 'NOT_EVALUATED',
  });
}

// ---- writes ----

/** PATCH companies/:companyId/application-activations/:applicationKey (company-application-activation.service.ts) */
export async function fakeSetCompanyApplication(
  companyId: string,
  appKey: string,
  body: SetCompanyApplicationBody,
  key: string,
): Promise<ActivationWriteReceipt> {
  assertAvailable();
  assertIdempotencyKey(key);
  const me = fakeActorMe();
  requirePermission(me, MANAGE_PERMISSION);
  const row = closedBody(body, ['expectedActivationRevision', 'enabled', 'reason']);
  if (!zeroOrRevision(row['expectedActivationRevision']) || typeof row['enabled'] !== 'boolean' || !isValidReason(row['reason'])) {
    invalid();
  }
  if (!canManage(me, companyId)) denied();
  const fingerprint = fingerprintOf('SET_APPLICATION_ACTIVATION', me, { companyId, appKey }, body);
  const replay = replayed(key, fingerprint);
  if (replay) return replay;

  const entry = findApp(companyId, appKey);
  if (!entry) notReady();
  if (entry.revision !== body.expectedActivationRevision) {
    throw new ApiError(409, 'APPLICATION_ACTIVATION_REVISION_STALE');
  }
  if (entry.state === 'STORED' && entry.id && entry.enabled === body.enabled) {
    return commitReceipt(key, fingerprint, 'SET_APPLICATION_ACTIVATION', {
      changed: false,
      resourceId: entry.id,
      resourceRevision: entry.revision,
    });
  }
  if (body.enabled && !entry.allowanceReady) notReady();

  entry.state = 'STORED';
  entry.id ??= newIdempotencyKey();
  entry.enabled = body.enabled;
  entry.revision = nextRevision(entry.revision);
  return commitReceipt(key, fingerprint, 'SET_APPLICATION_ACTIVATION', {
    changed: true,
    resourceId: entry.id,
    resourceRevision: entry.revision,
  });
}

/**
 * PATCH companies/:companyId/application-activations/:applicationKey/addons/:addonKey
 * (company-addon-activation.service.ts). 200 receipt, or 202 PENDING whose commandId is the idempotency key.
 */
export async function fakeSetCompanyAddon(
  companyId: string,
  appKey: string,
  addonKey: string,
  body: SetCompanyAddonBody,
  key: string,
): Promise<SetCompanyAddonResponse> {
  assertAvailable();
  assertIdempotencyKey(key);
  const me = fakeActorMe();
  requirePermission(me, MANAGE_PERMISSION);
  const row = closedBody(body, ['expectedActivationRevision', 'enabled', 'reason', 'definitionVersionId']);
  if (
    !zeroOrRevision(row['expectedActivationRevision']) ||
    typeof row['enabled'] !== 'boolean' ||
    !isValidReason(row['reason']) ||
    typeof row['definitionVersionId'] !== 'string' ||
    !UUID_PATTERN.test(row['definitionVersionId'])
  ) {
    invalid();
  }
  if (!canManage(me, companyId)) denied();
  const fingerprint = fingerprintOf('SET_ADDON_ACTIVATION', me, { companyId, appKey, addonKey }, body);
  const replay = replayed(key, fingerprint);
  if (replay) return replay;
  const retained = readCommand(key);
  if (retained) {
    if (retained.state === 'REJECTED') throw new ApiError(409, 'ADDON_REVISION_STALE');
    return commandStatus(retained) as SetCompanyAddonResponse;
  }

  const entry = findAddon(companyId, appKey, addonKey);
  if (!entry) notReady();
  const bound = entry.state === 'STORED' && entry.id !== null;
  if (entry.revision !== body.expectedActivationRevision || (bound && entry.definitionVersionId !== body.definitionVersionId)) {
    throw new ApiError(409, 'ADDON_REVISION_STALE');
  }
  if (!body.enabled && !bound) notReady();

  if (body.enabled) {
    if (!isOn(findApp(companyId, appKey)) || entry.selectedDefinitionVersionId !== body.definitionVersionId) notReady();
    if (bound && entry.simulatedLargeBranchCount > SYNC_BRANCH_LIMIT) {
      if (entry.enabled) notReady();
      const command: StoredCommand = {
        commandId: key,
        fingerprint,
        actorId: me.id,
        companyId,
        applicationKey: appKey,
        addonKey,
        totalBranches: entry.simulatedLargeBranchCount,
        pageNumber: 0,
        state: 'PENDING',
        reason: null,
        receipt: null,
      };
      saveCommand(command);
      return commandStatus(command) as SetCompanyAddonResponse;
    }
    // A declared configuration schema needs its configured value; activation never invents one.
    if (!entry.allowanceReady || !entry.configVersionId) notReady();
  }

  if (bound && entry.id && entry.enabled === body.enabled) {
    return commitReceipt(key, fingerprint, 'SET_ADDON_ACTIVATION', {
      changed: false,
      resourceId: entry.id,
      resourceRevision: entry.revision,
    });
  }

  entry.state = 'STORED';
  entry.id ??= newIdempotencyKey();
  entry.enabled = body.enabled;
  entry.definitionVersionId = body.definitionVersionId;
  entry.revision = nextRevision(entry.revision);
  return commitReceipt(key, fingerprint, 'SET_ADDON_ACTIVATION', {
    changed: true,
    resourceId: entry.id,
    resourceRevision: entry.revision,
  });
}

/**
 * GET companies/:companyId/application-activations/:applicationKey/addons/:addonKey/activation-commands/:commandId
 * Only the original actor at the exact target; anything else is 403 ACCESS_POLICY_BLOCKED (never 404).
 */
export async function fakeGetAddonCommand(
  companyId: string,
  appKey: string,
  addonKey: string,
  commandId: string,
): Promise<AddonCommandStatusResponse> {
  assertAvailable();
  const me = fakeActorMe();
  requireAnyPermission(me, READ_PERMISSIONS);
  if (!UUID_V7_PATTERN.test(commandId)) invalid();
  if (!canRead(me, companyId)) denied();
  const command = readCommand(commandId);
  if (
    !command ||
    command.actorId !== me.id ||
    command.companyId !== companyId ||
    command.applicationKey !== appKey ||
    command.addonKey !== addonKey
  ) {
    denied();
  }
  advanceCommand(command);
  return commandStatus(command);
}

/**
 * PATCH branches/:branchId/application-activations/:applicationKey/addons/:addonKey
 * DISABLED: branch-addon-restriction.service.ts. INHERIT: branch-addon-inheritance.service.ts.
 */
export async function fakeSetBranchOverride(
  branchId: string,
  appKey: string,
  addonKey: string,
  body: SetBranchOverrideBody,
  key: string,
): Promise<ActivationWriteReceipt> {
  assertAvailable();
  assertIdempotencyKey(key);
  const me = fakeActorMe();
  requirePermission(me, MANAGE_PERMISSION);
  const row = closedBody(body, ['expectedOverrideRevision', 'mode', 'reason']);
  if (
    !zeroOrRevision(row['expectedOverrideRevision']) ||
    (row['mode'] !== 'INHERIT' && row['mode'] !== 'DISABLED') ||
    !isValidReason(row['reason'])
  ) {
    invalid();
  }
  const companyId = await branchCompanyId(branchId);
  if (!canManage(me, companyId, branchId)) denied();
  const fingerprint = fingerprintOf('SET_BRANCH_OVERRIDE', me, { branchId, appKey, addonKey }, body);
  const replay = replayed(key, fingerprint);
  if (replay) return replay;

  const app = findApp(companyId, appKey);
  const addon = findAddon(companyId, appKey, addonKey);
  if (!addon || app?.state !== 'STORED') notReady();
  const existing = findBranchOverride(branchId, appKey, addonKey);
  const stale = (existing?.revision ?? '0') !== body.expectedOverrideRevision;

  let definitionVersionId: string;
  if (body.mode === 'DISABLED') {
    if (addon.state !== 'STORED' || !addon.definitionVersionId) notReady();
    if (stale) throw new ApiError(409, 'ADDON_REVISION_STALE');
    definitionVersionId = existing?.definitionVersionId ?? addon.definitionVersionId;
  } else {
    if (stale) throw new ApiError(409, 'ADDON_REVISION_STALE');
    if (!isOn(app) || !isOn(addon) || !addon.allowanceReady || !addon.selectedDefinitionVersionId) notReady();
    definitionVersionId = addon.selectedDefinitionVersionId;
  }

  if (existing?.mode === body.mode && existing.definitionVersionId === definitionVersionId) {
    return commitReceipt(key, fingerprint, 'SET_BRANCH_OVERRIDE', {
      changed: false,
      resourceId: existing.id,
      resourceRevision: existing.revision,
    });
  }

  const saved: StoredBranchOverride = existing ?? {
    branchId,
    companyId,
    applicationId: addon.applicationId,
    applicationKey: appKey,
    addonId: addon.addonId,
    addonKey,
    id: newIdempotencyKey(),
    revision: '0',
    mode: body.mode,
    definitionVersionId,
    configVersionId: null,
  };
  if (!existing) store.branchOverrides.push(saved);
  saved.mode = body.mode;
  saved.definitionVersionId = definitionVersionId;
  saved.revision = nextRevision(saved.revision);
  return commitReceipt(key, fingerprint, 'SET_BRANCH_OVERRIDE', {
    changed: true,
    resourceId: saved.id,
    resourceRevision: saved.revision,
  });
}
