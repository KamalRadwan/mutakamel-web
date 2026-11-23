import type { CorePage } from '../../../core/api/core-page';
import { ApiError } from '../../../core/api/api-errors';

export type { CorePage };

export type SeatMode = 'MANUAL' | 'DERIVED';
export type SeatAccessState = 'ACTIVE' | 'OVER_CAPACITY';
export type SeatHolderStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface MySeatState {
  moduleKey: string;
  accessState: SeatAccessState;
}


export type SeatModuleKind = 'ROLE_DERIVED' | 'ENABLED_FLAG';

export interface ModuleUsage {
  moduleKey: string;
  kind: SeatModuleKind;
  nameI18n: { en: string; ar: string };
  capacity: number;
  used: number;
  overCapacity: number;
  graceUntil: string | null;
  overCapacitySince: string | null;
  pendingCapacity: number | null;
}

export interface SeatUsage {
  mode: SeatMode;
  revision: number;
  modules: ModuleUsage[];
}

export interface SeatHolderScope {
  target: 'TENANT' | 'COMPANY' | 'BRANCH';
  companyId: string | null;
  branchId: string | null;
}

export interface SeatHolderRole {
  roleId: string;
  roleName: string;
  scope: SeatHolderScope;
}

export interface SeatHolder {
  userId: string;
  name: string;
  email: string;
  status: SeatHolderStatus;
  grantedAt: string;
  accessState: SeatAccessState;
  cause: string | null;
  roles: SeatHolderRole[];
  extension?: string;
  enabledAt?: string | null;
}

/** Standard holders and Webphone holders are different Core service results. */
export interface CoreSeatHolder extends Omit<SeatHolder, 'status' | 'accessState'> {
  status: string;
  accessState: string;
}

export interface SeatHolderUser { email: string; status: string }

export interface WebphoneSeatHolder {
  userId: string;
  name: string;
  extension: string;
  enabledAt: string | null;
  accessState: string;
}

export interface WebphoneSeatHoldersPage {
  data: WebphoneSeatHolder[];
  meta: { page: number; limit: number; total: number };
}

function isSeatAccessState(value: unknown): value is SeatAccessState {
  return value === 'ACTIVE' || value === 'OVER_CAPACITY';
}

function isSeatHolderStatus(value: unknown): value is SeatHolderStatus {
  return value === 'INVITED' || value === 'ACTIVE' || value === 'SUSPENDED' || value === 'DEACTIVATED';
}

export function seatHolderFromCore(row: CoreSeatHolder): SeatHolder {
  if (!row || !isSeatAccessState(row.accessState) || !isSeatHolderStatus(row.status) || !Array.isArray(row.roles) ||
      row.roles.some(role => !role || typeof role.roleId !== 'string' || typeof role.roleName !== 'string' ||
        !role.scope || !['TENANT', 'COMPANY', 'BRANCH'].includes(role.scope.target))) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return { ...row, status: row.status, accessState: row.accessState };
}

export function webphoneSeatHolder(row: WebphoneSeatHolder, user: SeatHolderUser): SeatHolder {
  if (!row || !user || typeof user.email !== 'string' || !isSeatHolderStatus(user.status) ||
      !isSeatAccessState(row.accessState) || (row.enabledAt !== null && typeof row.enabledAt !== 'string')) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return { userId: row.userId, name: row.name, email: user.email, status: user.status,
    grantedAt: row.enabledAt ?? '', accessState: row.accessState, cause: null, roles: [],
    extension: row.extension, enabledAt: row.enabledAt };
}

export function webphoneSeatHoldersPage(page: WebphoneSeatHoldersPage, holders: SeatHolder[]): CorePage<SeatHolder> {
  const meta = page?.meta;
  if (!meta || !Number.isSafeInteger(meta.page) || meta.page < 1 || !Number.isSafeInteger(meta.limit) || meta.limit < 1 ||
      !Number.isSafeInteger(meta.total) || meta.total < 0) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  const totalPages = Math.ceil(meta.total / meta.limit);
  return { data: holders, meta: { ...meta, totalPages, hasNext: meta.page < totalPages, hasPrev: meta.page > 1 } };
}

export function mySeatStatesFromMe(me: { seats: MySeatState[] }): MySeatState[] {
  if (!me || !Array.isArray(me.seats) || me.seats.some(row => !row || typeof row.moduleKey !== 'string' || !isSeatAccessState(row.accessState))) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return me.seats.map(({ moduleKey, accessState }) => ({ moduleKey, accessState }));
}

export type SeatChange =
  | { kind: 'ADD_BRANCH_ROLES'; userId: string; items: { branchId: string; roleId: string }[] }
  | { kind: 'REMOVE_BRANCH_ROLE'; userId: string; assignmentId: string }
  | { kind: 'SET_SCOPE_ROLES'; userId: string; assignments: unknown[] }
  | { kind: 'SET_ROLE_PERMISSIONS'; roleId: string; permissionIds: string[] }
  | { kind: 'SET_ROLE_BRANCH_PROFILES'; roleId: string; profiles: { branchId: string; permissionIds: string[] }[] }
  | { kind: 'DELETE_ROLE'; roleId: string }
  | { kind: 'USER_STATUS'; userId: string; status: string }
  | { kind: 'ORG_STATUS'; branchId?: string; companyId?: string; status: 'ACTIVE' | 'INACTIVE' }
  | {
      kind: 'BULK_ROLE';
      roleId: string;
      scope: { target: 'TENANT' | 'COMPANY' | 'BRANCH'; companyId?: string; branchId?: string };
      userIds: string[];
    }
  | { kind: 'IMPORT'; rows: unknown[] };

export interface SeatPreviewModule {
  moduleKey: string;
  nameI18n: { en: string; ar: string };
  capacity: number;
  used: number;
  usedAfter: number;
  needed: number;
  free: number;
  gaining: { userId: string; name: string }[];
  losing: { userId: string; name: string }[];
  addonsRemoved: { userId: string; name: string; addonKey: string }[];
}

export interface SeatPreview {
  mode: SeatMode;
  ok: boolean;
  modules: SeatPreviewModule[];
}

export interface ImportRowResult {
  index: number;
  status: 'CREATED' | 'WOULD_CREATE' | 'ROLES_SKIPPED' | 'ERROR';
  code?: string;
  skippedRoles?: { roleId: string; branchId: string }[];
}

export interface ImportResult {
  results: ImportRowResult[];
  seats: SeatPreview;
}

export type BulkRoleResult = SeatPreview;

export function importOk(result: ImportResult): boolean {
  return result.seats.ok && !result.results.some((r) => r.status === 'ERROR');
}

export interface FreeUpPreview {
  fits: boolean;
  removals: {
    userId: string;
    name: string;
    roleAssignments: { roleName: string; scope: string }[];
    alsoLoses: { moduleKey: string; nameI18n: { en: string; ar: string } }[];
    addonsRemoved: string[];
  }[];
}

export interface CascadeAddonItem {
  userId: string;
  userName: string;
  addonKey: string;
  addonName: string;
}

export interface HolderRoleLookups {
  companies?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  branches?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  scopeLabels?: {
    TENANT: string;
    COMPANY: string;
    BRANCH: string;
  };
}

const DEFAULT_SCOPE_LABELS: Record<SeatHolderScope['target'], string> = {
  TENANT: 'Whole workspace',
  COMPANY: 'Company',
  BRANCH: 'Branch',
};

function lookupName(
  map: ReadonlyMap<string, string> | Readonly<Record<string, string>> | undefined,
  id: string | null | undefined,
): string | null {
  if (!map || !id) return null;
  const value = map instanceof Map ? map.get(id) : (map as Readonly<Record<string, string>>)[id];
  return value?.trim() || null;
}

export function holderScopeLabel(scope: SeatHolderScope, lookups?: HolderRoleLookups): string {
  const labels = lookups?.scopeLabels ?? DEFAULT_SCOPE_LABELS;
  if (scope.target === 'TENANT') return labels.TENANT;
  if (scope.target === 'COMPANY') return lookupName(lookups?.companies, scope.companyId) ?? labels.COMPANY;
  return lookupName(lookups?.branches, scope.branchId) ?? labels.BRANCH;
}

export function holderRoleLabel(
  role: Pick<SeatHolderRole, 'roleName' | 'scope'>,
  lookups?: HolderRoleLookups,
): string {
  const scopeText = holderScopeLabel(role.scope, lookups);
  return scopeText ? `${role.roleName} · ${scopeText}` : role.roleName;
}

export function parseScopeString(raw: string): SeatHolderScope | null {
  if (raw === 'TENANT') return { target: 'TENANT', companyId: null, branchId: null };
  if (raw.startsWith('COMPANY:')) {
    const id = raw.slice('COMPANY:'.length).trim();
    return { target: 'COMPANY', companyId: id || null, branchId: null };
  }
  if (raw.startsWith('BRANCH:')) {
    const id = raw.slice('BRANCH:'.length).trim();
    return { target: 'BRANCH', companyId: null, branchId: id || null };
  }
  return null;
}

export interface ModuleTileLook {
  tile: string;
  icon: string;
}

const MODULE_TILES: Readonly<Record<string, ModuleTileLook>> = {
  crm: { tile: 'bg-icon-blue', icon: 'tablerUsers' },
  trade: { tile: 'bg-icon-orange', icon: 'tablerShoppingCart' },
  accounting: { tile: 'bg-icon-green', icon: 'tablerCalculator' },
};

const DEFAULT_MODULE_TILE: ModuleTileLook = {
  tile: 'bg-icon-gray',
  icon: 'tablerApps',
};

export function moduleTileOf(moduleKey: string): ModuleTileLook {
  return MODULE_TILES[moduleKey] ?? DEFAULT_MODULE_TILE;
}

export function moduleNameIn(nameI18n: { en: string; ar: string }, language: string): string {
  return language === 'ar' ? nameI18n.ar : nameI18n.en;
}

export function seatInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
