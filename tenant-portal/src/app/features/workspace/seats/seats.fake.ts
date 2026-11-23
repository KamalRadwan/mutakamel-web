import { ApiError } from '../../../core/api/api-errors';
import { toCorePage } from '../../../core/api/core-page';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { fakeDelay } from '../../../core/fake/fake-utils';
import {
  SUBSCRIBED_MODULE_CONFIGS,
  StaffSeatChangeInput,
  StaffSeatHolderSnapshot,
  buildActorMeSync,
  computeStaffSeatPreviewDeltas,
  fakeListBranches,
  fakeListCompanies,
  getStaffSeatSource,
  isStaffOverCapacity,
  registerSeatsOverlay,
  releaseUserSeatsInStaffFake,
  removeUserModuleRolesInStaffFake,
} from '../staff/shared/staff.fake';
import {
  FreeUpPreview,
  ModuleUsage,
  MySeatState,
  CorePage,
  SeatAccessState,
  SeatChange,
  SeatHolder,
  SeatHolderScope,
  SeatMode,
  SeatPreview,
  SeatPreviewModule,
  SeatUsage,
} from './seats.model';

export let FAKE_MODE: SeatMode = 'DERIVED';
export let FAKE_OVER_CAPACITY = false;
export let FAKE_GRACE = false;
export let FAKE_MIGRATION_SHORT = false;

export function setFakeSeatMode(mode: SeatMode): void {
  FAKE_MODE = mode;
}

export function setFakeMigrationShort(value: boolean): void {
  FAKE_MIGRATION_SHORT = value;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PREVIEW_CHANGES = 100;

interface FakeModuleConfig {
  readonly moduleKey: string;
  readonly nameI18n: { readonly en: string; readonly ar: string };
  readonly capacity: number;
}

interface FakeHolderRecord extends StaffSeatHolderSnapshot {
  overCapacityOverride?: boolean;
  activeOverride?: boolean;
  cause: string | null;
}

interface FakeAddonRecord {
  userId: string;
  moduleKey: string;
  addonKey: string;
  addonName: string;
}

let revision = 1;
const idempotencyStore = new Map<string, { fingerprint: string; result: unknown }>();
const swapOverrides = new Map<
  string,
  { overCapacityOverride?: boolean; activeOverride?: boolean; cause?: string | null }
>();

const MODULE_CONFIGS: readonly FakeModuleConfig[] = SUBSCRIBED_MODULE_CONFIGS;

let addons: FakeAddonRecord[] = [
  {
    userId: 'u-nada',
    moduleKey: 'crm',
    addonKey: 'crm.outbound_email',
    addonName: 'Outbound email',
  },
];

const companyIdByName = new Map<string, string>([
  ['Mutakamel Egypt', 'co-eg'],
  ['Mutakamel KSA', 'co-sa'],
  ['Legacy Trading', 'co-old'],
]);

const branchLookupByName = new Map<string, { id: string; companyId: string }>([
  ['Cairo HQ', { id: 'br-cai', companyId: 'co-eg' }],
  ['Alexandria', { id: 'br-alx', companyId: 'co-eg' }],
  ['Mansoura', { id: 'br-mns', companyId: 'co-eg' }],
  ['Riyadh HQ', { id: 'br-ruh', companyId: 'co-sa' }],
  ['Jeddah', { id: 'br-jed', companyId: 'co-sa' }],
]);

export function resetSeatsFake(): void {
  FAKE_MODE = 'DERIVED';
  FAKE_OVER_CAPACITY = false;
  FAKE_GRACE = false;
  FAKE_MIGRATION_SHORT = false;
  revision = 1;
  idempotencyStore.clear();
  swapOverrides.clear();
  addons = [
    {
      userId: 'u-nada',
      moduleKey: 'crm',
      addonKey: 'crm.outbound_email',
      addonName: 'Outbound email',
    },
  ];
  companyIdByName.clear();
  companyIdByName.set('Mutakamel Egypt', 'co-eg');
  companyIdByName.set('Mutakamel KSA', 'co-sa');
  companyIdByName.set('Legacy Trading', 'co-old');
  branchLookupByName.clear();
  branchLookupByName.set('Cairo HQ', { id: 'br-cai', companyId: 'co-eg' });
  branchLookupByName.set('Alexandria', { id: 'br-alx', companyId: 'co-eg' });
  branchLookupByName.set('Mansoura', { id: 'br-mns', companyId: 'co-eg' });
  branchLookupByName.set('Riyadh HQ', { id: 'br-ruh', companyId: 'co-sa' });
  branchLookupByName.set('Jeddah', { id: 'br-jed', companyId: 'co-sa' });
}

function resolveScopeObject(rawScope: string): SeatHolderScope {
  if (!rawScope || rawScope === 'Workspace' || rawScope === 'TENANT') {
    return { target: 'TENANT', companyId: null, branchId: null };
  }
  if (rawScope.startsWith('COMPANY:')) {
    return { target: 'COMPANY', companyId: rawScope.slice('COMPANY:'.length) || null, branchId: null };
  }
  if (rawScope.startsWith('BRANCH:')) {
    const branchId = rawScope.slice('BRANCH:'.length) || null;
    const matched = Array.from(branchLookupByName.values()).find((b) => b.id === branchId);
    return { target: 'BRANCH', companyId: matched?.companyId ?? null, branchId };
  }
  const branch = branchLookupByName.get(rawScope);
  if (branch) {
    return { target: 'BRANCH', companyId: branch.companyId, branchId: branch.id };
  }
  const companyId = companyIdByName.get(rawScope);
  if (companyId) {
    return { target: 'COMPANY', companyId, branchId: null };
  }
  if (rawScope.startsWith('co-')) {
    return { target: 'COMPANY', companyId: rawScope, branchId: null };
  }
  return { target: 'BRANCH', companyId: null, branchId: rawScope };
}

function formatFreeUpScope(scope: SeatHolderScope): string {
  if (scope.target === 'TENANT') return 'TENANT';
  if (scope.target === 'COMPANY') return scope.companyId ? `COMPANY:${scope.companyId}` : 'COMPANY';
  return scope.branchId ? `BRANCH:${scope.branchId}` : 'BRANCH';
}

async function ensureScopeLookupsFor(holders: readonly FakeHolderRecord[]): Promise<void> {
  const needsRefresh = holders.some((h) =>
    h.roles.some(
      (r) =>
        r.scope &&
        r.scope !== 'Workspace' &&
        r.scope !== 'TENANT' &&
        !r.scope.startsWith('COMPANY:') &&
        !r.scope.startsWith('BRANCH:') &&
        !branchLookupByName.has(r.scope) &&
        !companyIdByName.has(r.scope),
    ),
  );
  if (!needsRefresh) return;
  const [companiesRes, branchesRes] = await Promise.allSettled([
    fakeListCompanies({ limit: 100 }),
    fakeListBranches({ limit: 100 }),
  ]);
  if (companiesRes.status === 'fulfilled') {
    for (const c of companiesRes.value.data) {
      companyIdByName.set(c.name, c.id);
    }
  }
  if (branchesRes.status === 'fulfilled') {
    for (const b of branchesRes.value.data) {
      branchLookupByName.set(b.name, { id: b.id, companyId: b.companyId });
    }
  }
}

function buildCascadeError(
  items: readonly { userId: string; userName: string; addonKey: string; addonName: string }[],
): ApiError {
  return new ApiError(409, 'SEAT_ADDON_CASCADE_REQUIRED', {
    userIds: items.map((item) => item.userId),
    userNames: items.map((item) => item.userName),
    addonKeys: items.map((item) => item.addonKey),
    addonNames: items.map((item) => item.addonName),
  });
}

/**
 * seat-reconciler assertCapacity: module arrays (moduleKey, needed, free, capacity) share an index; the gaining
 * users form a separate parallel set (userModuleKey, userIds, userNames). Numbers are decimal strings.
 */
function buildCapacityError(modules: readonly SeatPreviewModule[]): ApiError {
  const users = modules.flatMap((m) => m.gaining.map((user) => ({ ...user, moduleKey: m.moduleKey })));
  return new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT', {
    moduleKey: modules.map((m) => m.moduleKey),
    needed: modules.map((m) => String(m.needed)),
    free: modules.map((m) => String(m.free)),
    capacity: modules.map((m) => String(m.capacity)),
    userModuleKey: users.map((user) => user.moduleKey),
    userIds: users.map((user) => user.userId),
    userNames: users.map((user) => user.name),
  });
}

function assertActorNotOverCapacity(moduleKeys: readonly string[]): void {
  const actor = buildActorMeSync();
  if (actor.isTenantOwner || moduleKeys.length === 0) return;
  for (const moduleKey of moduleKeys) {
    if (computeHolderStates(moduleKey).get(actor.id) === 'OVER_CAPACITY') {
      throw new ApiError(403, 'SEAT_OVER_CAPACITY_READ_ONLY');
    }
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertIdempotencyKey(key: string): void {
  if (!key || !UUID_RE.test(key)) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
}

function replayIdempotent<T>(key: string, fingerprint: string): T | null {
  assertIdempotencyKey(key);
  const existing = idempotencyStore.get(key);
  if (!existing) return null;
  if (existing.fingerprint !== fingerprint) {
    throw new ApiError(409, 'IDEMPOTENCY_CONFLICT');
  }
  return cloneJson(existing.result as T);
}

function saveIdempotent<T>(key: string, fingerprint: string, result: T): T {
  idempotencyStore.set(key, { fingerprint, result: cloneJson(result) });
  return result;
}

function currentOverCapacity(): boolean {
  return FAKE_OVER_CAPACITY || isStaffOverCapacity();
}

function effectiveCapacity(mod: FakeModuleConfig): number {
  if (mod.moduleKey === 'crm' && (currentOverCapacity() || FAKE_GRACE)) {
    return 3;
  }
  return mod.capacity;
}

function graceUntilFor(mod: FakeModuleConfig): string | null {
  if (mod.moduleKey !== 'crm') return null;
  if (currentOverCapacity()) {
    return new Date(Date.now() - 2 * DAY_MS).toISOString();
  }
  if (FAKE_GRACE) {
    return new Date(Date.now() + 10 * DAY_MS).toISOString();
  }
  return null;
}

function currentHolders(moduleKey?: string): FakeHolderRecord[] {
  const source = getStaffSeatSource().holders;
  return source
    .filter((h) => !moduleKey || h.moduleKey === moduleKey)
    .map((h) => {
      const ov = swapOverrides.get(`${h.moduleKey}:${h.userId}`);
      return {
        ...h,
        overCapacityOverride: ov?.overCapacityOverride,
        activeOverride: ov?.activeOverride,
        cause: ov?.cause ?? null,
      };
    });
}

function computeHolderStates(moduleKey: string): Map<string, SeatAccessState> {
  const mod = MODULE_CONFIGS.find((item) => item.moduleKey === moduleKey);
  const capacity = mod ? effectiveCapacity(mod) : 0;
  const modHolders = currentHolders(moduleKey);
  const states = new Map<string, SeatAccessState>();

  if (modHolders.length <= capacity) {
    for (const h of modHolders) {
      states.set(h.userId, 'ACTIVE');
    }
    return states;
  }

  const grace = mod ? graceUntilFor(mod) : null;
  const inGrace = grace !== null && new Date(grace).getTime() > Date.now();
  if (inGrace) {
    for (const h of modHolders) {
      states.set(h.userId, 'ACTIVE');
    }
    return states;
  }

  // Sort explicitly kept/active first, explicitly overCapacity last, then earliest grant first.
  const ordered = modHolders.slice().sort((a, b) => {
    const aRank = a.overCapacityOverride ? 2 : a.activeOverride ? 0 : 1;
    const bRank = b.overCapacityOverride ? 2 : b.activeOverride ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.grantedAt.localeCompare(b.grantedAt);
  });

  ordered.forEach((holder, index) => {
    states.set(holder.userId, index < capacity ? 'ACTIVE' : 'OVER_CAPACITY');
  });
  return states;
}

function buildModuleUsage(mod: FakeModuleConfig): ModuleUsage {
  const modHolders = currentHolders(mod.moduleKey);
  const states = computeHolderStates(mod.moduleKey);
  const overCapacity = Array.from(states.values()).filter((state) => state === 'OVER_CAPACITY').length;
  const capacity = effectiveCapacity(mod);
  const graceUntil = modHolders.length > capacity ? graceUntilFor(mod) : null;

  return {
    moduleKey: mod.moduleKey,
    kind: 'ROLE_DERIVED',
    nameI18n: { ...mod.nameI18n },
    capacity,
    used: modHolders.length,
    overCapacity,
    graceUntil,
    overCapacitySince:
      overCapacity > 0 && graceUntil ? graceUntil : null,
    pendingCapacity: null,
  };
}

function buildSeatUsage(): SeatUsage {
  return {
    mode: FAKE_MODE,
    revision,
    modules: MODULE_CONFIGS.map(buildModuleUsage),
  };
}

function findUser(idOrName: string): { userId: string; name: string; status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' } | null {
  const trimmed = idOrName.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const match = getStaffSeatSource().users.find(
    (u) => u.userId === trimmed || u.name.toLowerCase() === lower,
  );
  return match ? { userId: match.userId, name: match.name, status: match.status } : null;
}

function computePreview(changes: readonly SeatChange[]): SeatPreview {
  if (FAKE_MODE === 'MANUAL') {
    return { mode: 'MANUAL', ok: true, modules: [] };
  }

  const drafts = computeStaffSeatPreviewDeltas(changes as unknown as StaffSeatChangeInput[]);
  const modules: SeatPreviewModule[] = [];

  for (const config of MODULE_CONFIGS) {
    const draft = drafts.get(config.moduleKey);
    if (!draft) continue;

    const gaining = Array.from(draft.gaining.entries()).map(([userId, name]) => ({ userId, name }));
    const losing = Array.from(draft.losing.entries()).map(([userId, name]) => ({ userId, name }));
    const losingIds = new Set(losing.map((item) => item.userId));
    const addonsRemoved = addons
      .filter((a) => a.moduleKey === config.moduleKey && losingIds.has(a.userId))
      .map((a) => ({
        userId: a.userId,
        name: findUser(a.userId)?.name ?? a.userId,
        addonKey: a.addonKey,
      }));

    if (gaining.length === 0 && losing.length === 0 && addonsRemoved.length === 0) continue;

    const capacity = effectiveCapacity(config);
    const used = currentHolders(config.moduleKey).length;
    const usedAfter = Math.max(0, used + gaining.length - losing.length);
    const free = Math.max(0, capacity - used);
    const needed =
      usedAfter > capacity
        ? Math.max(gaining.length, usedAfter - capacity)
        : gaining.length;

    modules.push({
      moduleKey: config.moduleKey,
      nameI18n: { ...config.nameI18n },
      capacity,
      used,
      usedAfter,
      needed,
      free,
      gaining,
      losing,
      addonsRemoved,
    });
  }

  return {
    mode: FAKE_MODE,
    ok: modules.every((mod) => mod.usedAfter <= mod.capacity),
    modules,
  };
}

function buildSeatHolders(moduleKey: string): SeatHolder[] {
  const states = computeHolderStates(moduleKey);
  return currentHolders(moduleKey).map((h): SeatHolder => {
    const accessState = states.get(h.userId) ?? 'ACTIVE';
    return {
      userId: h.userId,
      name: h.name,
      email: h.email,
      status: h.status,
      grantedAt: h.grantedAt,
      accessState,
      cause: accessState === 'OVER_CAPACITY' ? (h.cause ?? 'GRACE_EXPIRED') : h.cause,
      roles: h.roles.map((r) => ({
        roleId: r.roleId,
        roleName: r.roleName,
        scope: resolveScopeObject(r.scope),
      })),
    };
  });
}

function computeFreeUpPreview(body: {
  moduleKey: string;
  targetSeats: number;
  keepUserIds: string[];
}): FreeUpPreview {
  const keepSet = new Set(body.keepUserIds);
  const modHolders = currentHolders(body.moduleKey);
  const allHolders = currentHolders();
  const removals = modHolders
    .filter((h) => !keepSet.has(h.userId))
    .map((h) => {
      const primaryModuleRoles = h.roles;
      const primaryRoleIds = new Set(primaryModuleRoles.map((r) => r.roleId));

      const alsoLoses = MODULE_CONFIGS.filter((cfg) => {
        if (cfg.moduleKey === body.moduleKey) return false;
        const other = allHolders.find(
          (item) => item.userId === h.userId && item.moduleKey === cfg.moduleKey,
        );
        if (!other || other.roles.length === 0) return false;
        return other.roles.every((r) => primaryRoleIds.has(r.roleId));
      }).map((cfg) => ({
        moduleKey: cfg.moduleKey,
        nameI18n: { ...cfg.nameI18n },
      }));

      const addonsRemoved = addons
        .filter((a) => a.userId === h.userId && a.moduleKey === body.moduleKey)
        .map((a) => a.addonName);

      return {
        userId: h.userId,
        name: h.name,
        roleAssignments: primaryModuleRoles.map((r) => ({
          roleName: r.roleName,
          scope: formatFreeUpScope(resolveScopeObject(r.scope)),
        })),
        alsoLoses,
        addonsRemoved,
      };
    });

  const keptCount = modHolders.length - removals.length;
  return {
    fits: body.keepUserIds.length <= body.targetSeats && keptCount <= body.targetSeats,
    removals,
  };
}

/** GET /api/tenant/core/v1/seats/usage */
export async function fakeGetSeatUsage(): Promise<SeatUsage> {
  await fakeDelay();
  return cloneJson(buildSeatUsage());
}

/** GET /api/tenant/core/v1/seats/usage/:moduleKey/holders */
export async function fakeListSeatHolders(
  moduleKey: string,
  q: { page: number; limit: number; search?: string },
): Promise<CorePage<SeatHolder>> {
  await fakeDelay();
  await ensureScopeLookupsFor(currentHolders(moduleKey));
  const term = (q.search ?? '').slice(0, 120).trim().toLowerCase();
  const filtered = buildSeatHolders(moduleKey).filter(
    (holder) =>
      !term ||
      holder.name.toLowerCase().includes(term) ||
      holder.email.toLowerCase().includes(term) ||
      holder.roles.some((r) => r.roleName.toLowerCase().includes(term)),
  );
  const limit = Math.min(100, Math.max(1, q.limit || 20));
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const page = Math.min(Math.max(1, q.page || 1), totalPages);
  return cloneJson(toCorePage(filtered, page, limit));
}

/** POST /api/tenant/core/v1/seats/preview */
export async function fakePreviewSeats(changes: SeatChange[]): Promise<SeatPreview> {
  await fakeDelay();
  if (changes.length > MAX_PREVIEW_CHANGES) {
    throw new ApiError(422, 'SEAT_PREVIEW_TOO_LARGE');
  }
  return cloneJson(computePreview(changes));
}

/** POST /api/tenant/core/v1/users/:id/release-seats */
export async function fakeReleaseSeats(
  userId: string,
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatPreview> {
  await fakeDelay();
  const fingerprint = JSON.stringify(['releaseSeats', userId, Boolean(opts.confirmAddonCascade)]);
  const replayed = replayIdempotent<SeatPreview>(key, fingerprint);
  if (replayed !== null) return replayed;

  const user = findUser(userId);
  if (!user || user.status !== 'SUSPENDED') {
    throw new ApiError(409, 'SEAT_RELEASE_NOT_ALLOWED');
  }

  const plan = computePreview([{ kind: 'USER_STATUS', userId: user.userId, status: 'RELEASED' }]);
  assertActorNotOverCapacity(plan.modules.map((m) => m.moduleKey));

  const userAddons = addons
    .filter((a) => a.userId === user.userId)
    .map((a) => ({
      userId: user.userId,
      userName: user.name,
      addonKey: a.addonKey,
      addonName: a.addonName,
    }));

  if (userAddons.length > 0 && !opts.confirmAddonCascade) {
    throw buildCascadeError(userAddons);
  }

  releaseUserSeatsInStaffFake(user.userId);
  addons = addons.filter((a) => a.userId !== user.userId);
  revision += 1;
  return cloneJson(saveIdempotent(key, fingerprint, plan));
}

/** POST /api/tenant/core/v1/seats/free-up/preview */
export async function fakeFreeUpPreview(body: {
  moduleKey: string;
  targetSeats: number;
  keepUserIds: string[];
}): Promise<FreeUpPreview> {
  await fakeDelay();
  return cloneJson(computeFreeUpPreview(body));
}

/** POST /api/tenant/core/v1/seats/free-up */
export async function fakeFreeUp(
  body: {
    moduleKey: string;
    targetSeats: number;
    keepUserIds: string[];
    expectedUsageRevision: number;
    confirmAddonCascade?: boolean;
  },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  await fakeDelay();
  const fingerprint = JSON.stringify(['freeUp', body]);
  const replayed = replayIdempotent<SeatUsage>(key, fingerprint);
  if (replayed) return replayed;

  if (FAKE_MODE === 'MANUAL') {
    throw new ApiError(409, 'SEAT_MIGRATION_NOT_READY');
  }

  if (body.expectedUsageRevision !== revision) {
    throw new ApiError(409, 'SEAT_USAGE_STALE');
  }

  if (body.keepUserIds.length > body.targetSeats) {
    throw new ApiError(422, 'SEAT_KEEP_LIST_TOO_LARGE');
  }

  const preview = computeFreeUpPreview(body);
  assertActorNotOverCapacity([
    body.moduleKey,
    ...preview.removals.flatMap((removal) => removal.alsoLoses.map((item) => item.moduleKey)),
  ]);

  const removedNames = new Map(preview.removals.map((removal) => [removal.userId, removal.name]));
  const cascadeAddons = addons
    .filter((a) => a.moduleKey === body.moduleKey && removedNames.has(a.userId))
    .map((a) => ({
      userId: a.userId,
      userName: removedNames.get(a.userId) ?? a.userId,
      addonKey: a.addonKey,
      addonName: a.addonName,
    }));

  if (cascadeAddons.length > 0 && !body.confirmAddonCascade) {
    throw buildCascadeError(cascadeAddons);
  }

  for (const removal of preview.removals) {
    const lostModules = new Set<string>([
      body.moduleKey,
      ...removal.alsoLoses.map((item) => item.moduleKey),
    ]);
    for (const modKey of lostModules) {
      removeUserModuleRolesInStaffFake(removal.userId, modKey);
      swapOverrides.delete(`${modKey}:${removal.userId}`);
    }
    addons = addons.filter(
      (a) => !(a.userId === removal.userId && a.moduleKey === body.moduleKey),
    );
  }

  for (const h of currentHolders(body.moduleKey)) {
    swapOverrides.set(`${body.moduleKey}:${h.userId}`, {
      overCapacityOverride: false,
      activeOverride: true,
      cause: null,
    });
  }

  revision += 1;
  return cloneJson(saveIdempotent(key, fingerprint, buildSeatUsage()));
}

/** POST /api/tenant/core/v1/seats/:moduleKey/swap */
export async function fakeSwapSeat(
  moduleKey: string,
  body: { keepUserId: string; releaseUserId: string },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  await fakeDelay();
  const fingerprint = JSON.stringify(['swapSeat', moduleKey, body]);
  const replayed = replayIdempotent<SeatUsage>(key, fingerprint);
  if (replayed) return replayed;

  assertActorNotOverCapacity([moduleKey]);

  if (body.keepUserId === body.releaseUserId) {
    throw new ApiError(422, 'SEAT_SWAP_INVALID');
  }

  const states = computeHolderStates(moduleKey);
  if (
    states.get(body.keepUserId) !== 'OVER_CAPACITY' ||
    states.get(body.releaseUserId) !== 'ACTIVE'
  ) {
    throw new ApiError(422, 'SEAT_SWAP_INVALID');
  }

  const modHolders = currentHolders(moduleKey);
  if (
    !modHolders.some((h) => h.userId === body.keepUserId) ||
    !modHolders.some((h) => h.userId === body.releaseUserId)
  ) {
    throw new ApiError(422, 'SEAT_SWAP_INVALID');
  }

  swapOverrides.set(`${moduleKey}:${body.keepUserId}`, {
    overCapacityOverride: false,
    activeOverride: true,
    cause: 'SEAT_SWAPPED',
  });
  swapOverrides.set(`${moduleKey}:${body.releaseUserId}`, {
    activeOverride: false,
    overCapacityOverride: true,
    cause: 'SEAT_SWAPPED',
  });
  revision += 1;

  return cloneJson(saveIdempotent(key, fingerprint, buildSeatUsage()));
}

/** POST /api/tenant/core/v1/seats/switch-to-derived */
export async function fakeSwitchToDerived(
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  await fakeDelay();
  const fingerprint = JSON.stringify(['switchToDerived', Boolean(opts.confirmAddonCascade)]);
  const replayed = replayIdempotent<SeatUsage>(key, fingerprint);
  if (replayed) return replayed;

  assertActorNotOverCapacity(MODULE_CONFIGS.map((m) => m.moduleKey));

  if (FAKE_MODE === 'DERIVED') {
    return cloneJson(saveIdempotent(key, fingerprint, buildSeatUsage()));
  }

  if (FAKE_MIGRATION_SHORT) {
    const shortModules = MODULE_CONFIGS.map((cfg) => {
      const used = currentHolders(cfg.moduleKey).length;
      const cap = effectiveCapacity(cfg);
      return {
        moduleKey: cfg.moduleKey,
        needed: Math.max(0, used - cap),
        free: Math.max(0, cap - used),
        capacity: cap,
        used,
      };
    }).filter((m) => m.needed > 0);
    const fallbackMod = buildModuleUsage(MODULE_CONFIGS[0]);
    const list =
      shortModules.length > 0
        ? shortModules
        : [
            {
              moduleKey: fallbackMod.moduleKey,
              needed: Math.max(1, fallbackMod.used - fallbackMod.capacity),
              free: Math.max(0, fallbackMod.capacity - fallbackMod.used),
              capacity: fallbackMod.capacity,
              used: fallbackMod.used,
            },
          ];

    // assertCapacity(plan, migration = true): the capacity shape plus used, usedAfter and shortfall aligned to the
    // module arrays. The fake has no gaining users here (holders already hold their seats), so the user set is empty.
    throw new ApiError(409, 'SEAT_MIGRATION_NOT_READY', {
      moduleKey: list.map((m) => m.moduleKey),
      needed: list.map((m) => String(m.needed)),
      free: list.map((m) => String(m.free)),
      capacity: list.map((m) => String(m.capacity)),
      userModuleKey: [],
      userIds: [],
      userNames: [],
      used: list.map((m) => String(m.used)),
      usedAfter: list.map((m) => String(Math.max(m.used, m.capacity + m.needed))),
      shortfall: list.map((m) => String(Math.max(m.used, m.capacity + m.needed) - m.capacity)),
    });
  }

  const holdersByModule = new Map(
    MODULE_CONFIGS.map((cfg) => [
      cfg.moduleKey,
      new Set(currentHolders(cfg.moduleKey).map((h) => h.userId)),
    ]),
  );
  const lostAddons = addons.filter(
    (a) => !(holdersByModule.get(a.moduleKey)?.has(a.userId) ?? false),
  );
  if (lostAddons.length > 0 && !opts.confirmAddonCascade) {
    throw buildCascadeError(
      lostAddons.map((a) => ({
        userId: a.userId,
        userName: findUser(a.userId)?.name ?? a.userId,
        addonKey: a.addonKey,
        addonName: a.addonName,
      })),
    );
  }
  if (lostAddons.length > 0) {
    const lostSet = new Set(lostAddons);
    addons = addons.filter((a) => !lostSet.has(a));
  }

  FAKE_MODE = 'DERIVED';
  revision += 1;
  return cloneJson(saveIdempotent(key, fingerprint, buildSeatUsage()));
}

/** GET /api/tenant/core/v1/auth/me → seats (derived from actor + seat usage in the fake). */
export async function fakeGetMySeatStates(): Promise<MySeatState[]> {
  await fakeDelay();
  const me = buildActorMeSync();
  if (me.isTenantOwner) {
    return MODULE_CONFIGS.map((cfg) => ({
      moduleKey: cfg.moduleKey,
      accessState: 'ACTIVE' as const,
    }));
  }
  const result: MySeatState[] = [];
  for (const cfg of MODULE_CONFIGS) {
    const states = computeHolderStates(cfg.moduleKey);
    const accessState = states.get(me.id);
    if (accessState) {
      result.push({ moduleKey: cfg.moduleKey, accessState });
    }
  }
  return result;
}

registerSeatsOverlay({
  isOverCapacity: currentOverCapacity,
  isDerivedMode: () => FAKE_MODE === 'DERIVED',
  getUserSeats: (userId: string) => {
    const result: {
      moduleKey: string;
      accessState: SeatAccessState;
      grantedAt: string;
      cause: string | null;
      roles: { roleId: string; roleName: string; scope: string }[];
    }[] = [];
    for (const cfg of MODULE_CONFIGS) {
      const modHolders = currentHolders(cfg.moduleKey);
      const holder = modHolders.find((h) => h.userId === userId);
      if (!holder) continue;
      const states = computeHolderStates(cfg.moduleKey);
      const accessState = states.get(userId) ?? 'ACTIVE';
      result.push({
        moduleKey: cfg.moduleKey,
        accessState,
        grantedAt: holder.grantedAt,
        cause: accessState === 'OVER_CAPACITY' ? (holder.cause ?? 'GRACE_EXPIRED') : holder.cause,
        roles: holder.roles.map((r) => ({ ...r })),
      });
    }
    return result;
  },
});
