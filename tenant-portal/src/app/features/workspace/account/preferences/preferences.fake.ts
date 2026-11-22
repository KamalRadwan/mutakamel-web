import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  AccountMe,
  NAME_MAX,
  OwnNamePatch,
  OwnNameUser,
  PROFILE_EXTENSIONS_MAX_BYTES,
  THEME_KEY_MAX,
  TenantProfile,
  TenantProfilePatch,
} from './preferences.model';

export let FAKE_PREFS_FAIL_NEXT = false;

export function setFakePrefsFailNext(fail: boolean): void {
  FAKE_PREFS_FAIL_NEXT = fail;
}

interface PreferencesStore {
  me: AccountMe;
  profile: TenantProfile;
  avatar: Blob | null;
}

function createSeedStore(): PreferencesStore {
  const meId = fakeId();
  return {
    me: {
      id: meId,
      email: 'owner@mutakamel.io',
      firstName: 'Kamal',
      lastName: 'Radwan',
      hasAvatar: false,
      isTenantOwner: true,
    },
    profile: {
      id: fakeId(),
      tenantUserId: meId,
      themeKey: 'light',
      language: 'en',
      extensions: {},
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: '2026-11-01T09:00:00.000Z',
    },
    avatar: null,
  };
}

let store: PreferencesStore = createSeedStore();

export function resetPreferencesFake(): void {
  store = createSeedStore();
  FAKE_PREFS_FAIL_NEXT = false;
}

// Core ValidationPipe: 400 CORE_VALIDATION_FAILED, details keyed by DTO property (string arrays).
function validationFailed(details: Record<string, string[]>): ApiError {
  return new ApiError(400, 'CORE_VALIDATION_FAILED', details);
}

const AVATAR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

function avatarExtensionMatches(file: File): boolean {
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return AVATAR_EXTENSIONS[file.type.toLowerCase()]?.includes(extension) ?? false;
}

async function enterCall(): Promise<void> {
  await fakeDelay();
  if (FAKE_PREFS_FAIL_NEXT) {
    FAKE_PREFS_FAIL_NEXT = false;
    throw new ApiError(500, 'INTERNAL_ERROR');
  }
}

export async function fakeGetMe(): Promise<AccountMe> {
  await enterCall();
  return structuredClone(store.me);
}

export async function fakeUpdateMyName(patch: OwnNamePatch): Promise<OwnNameUser> {
  await enterCall();

  const details: Record<string, string[]> = {};
  const nextFirst = patch.firstName?.trim();
  const nextLast = patch.lastName?.trim();
  if (nextFirst !== undefined && (!nextFirst || nextFirst.length > NAME_MAX)) {
    details['firstName'] = [nextFirst ? 'max_length' : 'is_not_empty'];
  }
  if (nextLast !== undefined && (!nextLast || nextLast.length > NAME_MAX)) {
    details['lastName'] = [nextLast ? 'max_length' : 'is_not_empty'];
  }
  if (Object.keys(details).length > 0) throw validationFailed(details);

  if (nextFirst !== undefined) store.me.firstName = nextFirst;
  if (nextLast !== undefined) store.me.lastName = nextLast;

  const { id, email, firstName, lastName, isTenantOwner } = store.me;
  return { id, email, firstName, lastName, isTenantOwner, status: 'ACTIVE' };
}

export async function fakeGetMyProfile(): Promise<TenantProfile> {
  await enterCall();
  return structuredClone(store.profile);
}

export async function fakeUpdateMyProfile(patch: TenantProfilePatch): Promise<TenantProfile> {
  await enterCall();

  const details: Record<string, string[]> = {};
  if (patch.language !== undefined && patch.language !== 'en' && patch.language !== 'ar') {
    details['language'] = ['is_in'];
  }
  if (patch.themeKey !== undefined && patch.themeKey.length > THEME_KEY_MAX) {
    details['themeKey'] = ['max_length'];
  }
  if (Object.keys(details).length > 0) throw validationFailed(details);

  const mergedExtensions =
    patch.extensions !== undefined
      ? { ...store.profile.extensions, ...patch.extensions }
      : store.profile.extensions;

  const byteLength = new TextEncoder().encode(JSON.stringify(mergedExtensions)).byteLength;
  if (byteLength > PROFILE_EXTENSIONS_MAX_BYTES) {
    throw new ApiError(422, 'PROFILE_EXTENSIONS_TOO_LARGE');
  }

  let changed = false;
  if (patch.themeKey !== undefined && patch.themeKey !== store.profile.themeKey) {
    store.profile.themeKey = patch.themeKey;
    changed = true;
  }
  if (patch.language !== undefined && patch.language !== store.profile.language) {
    store.profile.language = patch.language;
    changed = true;
  }
  if (patch.extensions !== undefined && JSON.stringify(mergedExtensions) !== JSON.stringify(store.profile.extensions)) {
    store.profile.extensions = structuredClone(mergedExtensions);
    changed = true;
  }
  // The backend saves (and moves updatedAt) only when something changed.
  if (changed) store.profile.updatedAt = new Date().toISOString();

  return structuredClone(store.profile);
}

export async function fakeUploadAvatar(file: File): Promise<void> {
  await enterCall();

  if (!(AVATAR_TYPES as readonly string[]).includes(file.type.toLowerCase()) || file.size <= 0) {
    throw new ApiError(415, 'PARTY_IMAGE_INVALID');
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new ApiError(413, 'PARTY_IMAGE_TOO_LARGE');
  }

  if (!avatarExtensionMatches(file)) {
    throw new ApiError(415, 'PARTY_IMAGE_INVALID');
  }

  store.avatar = file.slice(0, file.size, file.type);
  store.me.hasAvatar = true;
}

export async function fakeGetAvatar(): Promise<Blob> {
  await enterCall();

  if (!store.avatar || !store.me.hasAvatar) {
    throw new ApiError(404, 'PARTY_IMAGE_NOT_FOUND');
  }

  return store.avatar.slice(0, store.avatar.size, store.avatar.type);
}

export async function fakeDeleteAvatar(): Promise<void> {
  await enterCall();

  if (!store.avatar || !store.me.hasAvatar) {
    throw new ApiError(404, 'PARTY_IMAGE_NOT_FOUND');
  }

  store.avatar = null;
  store.me.hasAvatar = false;
}
