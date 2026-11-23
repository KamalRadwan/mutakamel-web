import { ApiError } from '../../../../core/api/api-errors';
import { fakeActorMe } from '../shared/fake-actor';
import {
  DIRECTORY_SETTINGS_LIMITS,
  DUPLICATE_SCOPES,
  DirectorySettings,
  DirectorySettingsPatch,
  DuplicateScope,
} from './directory-settings.model';

const SINGLETON_ID = '018f0000-0000-7000-8300-000000000001';
const SEED_TIMESTAMP = '2026-01-10T09:00:00.000Z';

function createInitialSettings(): DirectorySettings {
  return {
    id: SINGLETON_ID,
    version: 1,
    duplicateScope: 'TENANT',
    preventDuplicateEmail: true,
    preventDuplicatePhone: true,
    preventDuplicateWhatsapp: true,
    maxContactMethodsPerParty: 20,
    maxAddressesPerParty: 20,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

let state: DirectorySettings = createInitialSettings();

function fakeDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SETTINGS_PERMISSION = 'directory.settings.manage';
const PATCH_FIELDS: readonly string[] = [
  'duplicateScope',
  'preventDuplicateEmail',
  'preventDuplicatePhone',
  'preventDuplicateWhatsapp',
  'maxContactMethodsPerParty',
  'maxAddressesPerParty',
];

/**
 * Core order: the global PermissionsGuard (no grant at any scope:
 * MISSING_REQUIRED_PERMISSIONS), then the ValidationPipe, then
 * DirectoryService.assertBranchWritePermission(null) (a branch-only grant:
 * TENANT_WIDE_PERMISSION_REQUIRED).
 */
function requirePermissionGuard(): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  if (!me.permissions.includes(SETTINGS_PERMISSION) && !me.permissionScopes[SETTINGS_PERMISSION]) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { permissions: [SETTINGS_PERMISSION] });
  }
}

function assertTenantWideManage(): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  if (!me.permissionScopes[SETTINGS_PERMISSION]?.tenantWide) {
    throw new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
  }
}

function validationFailed(field: string, constraints: string[]): ApiError {
  return new ApiError(400, 'CORE_VALIDATION_FAILED', { [field]: constraints });
}

function isDuplicateScope(value: unknown): value is DuplicateScope {
  return typeof value === 'string' && (DUPLICATE_SCOPES as readonly string[]).includes(value);
}

function validateBooleanField(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw validationFailed(field, ['is_boolean']);
  }
  return value;
}

/** @IsInt() @Min(1) @Max(200) */
function validateLimitField(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw validationFailed(field, ['is_int']);
  }
  if (value < DIRECTORY_SETTINGS_LIMITS.min) throw validationFailed(field, ['min']);
  if (value > DIRECTORY_SETTINGS_LIMITS.max) throw validationFailed(field, ['max']);
  return value;
}

/** The live singleton, read by the party-directory fake for its duplicate and limit rules. */
export function peekDirectorySettings(): DirectorySettings {
  return { ...state };
}

export async function fakeGetDirectorySettings(): Promise<DirectorySettings> {
  await fakeDelay();
  requirePermissionGuard();
  assertTenantWideManage();
  return { ...state };
}

export async function fakeUpdateDirectorySettings(
  patch: Partial<DirectorySettingsPatch>,
  ifMatch: string,
): Promise<DirectorySettings> {
  await fakeDelay();
  requirePermissionGuard();
  // forbidNonWhitelisted: unknown body keys fail before the service runs.
  for (const key of Object.keys(patch)) {
    if (!PATCH_FIELDS.includes(key)) throw validationFailed(key, ['whitelist_validation']);
  }

  const next: DirectorySettings = { ...state };

  if (patch.duplicateScope !== undefined) {
    if (!isDuplicateScope(patch.duplicateScope)) {
      throw validationFailed('duplicateScope', ['is_enum']);
    }
    next.duplicateScope = patch.duplicateScope;
  }

  if (patch.preventDuplicateEmail !== undefined) {
    next.preventDuplicateEmail = validateBooleanField(patch.preventDuplicateEmail, 'preventDuplicateEmail');
  }

  if (patch.preventDuplicatePhone !== undefined) {
    next.preventDuplicatePhone = validateBooleanField(patch.preventDuplicatePhone, 'preventDuplicatePhone');
  }

  if (patch.preventDuplicateWhatsapp !== undefined) {
    next.preventDuplicateWhatsapp = validateBooleanField(
      patch.preventDuplicateWhatsapp,
      'preventDuplicateWhatsapp',
    );
  }

  if (patch.maxContactMethodsPerParty !== undefined) {
    next.maxContactMethodsPerParty = validateLimitField(
      patch.maxContactMethodsPerParty,
      'maxContactMethodsPerParty',
    );
  }

  if (patch.maxAddressesPerParty !== undefined) {
    next.maxAddressesPerParty = validateLimitField(patch.maxAddressesPerParty, 'maxAddressesPerParty');
  }

  assertTenantWideManage();

  if (!ifMatch) throw new ApiError(428, 'DIRECTORY_SETTINGS_VERSION_REQUIRED');
  if (ifMatch !== `"${state.version}"`) {
    throw new ApiError(409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT');
  }

  next.version++;
  next.updatedAt = new Date().toISOString();
  state = next;
  return { ...state };
}

export function resetDirectorySettingsFake(): void {
  state = createInitialSettings();
}
