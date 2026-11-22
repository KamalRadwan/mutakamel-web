import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  fakeDeleteAvatar,
  fakeGetAvatar,
  fakeGetMe,
  fakeGetMyProfile,
  fakeUpdateMyName,
  fakeUpdateMyProfile,
  fakeUploadAvatar,
} from './preferences.fake';
import { AccountMe, OwnNamePatch, OwnNameUser, TenantProfile, TenantProfilePatch } from './preferences.model';

// Real browser base: /api/tenant/core/v1 (envelope { data }). Self-service: no permission key.

export function getMe(): Promise<AccountMe> {
  // GET /api/tenant/core/v1/auth/me (private, no-store)
  return fakeGetMe();
}

export function updateMyName(patch: OwnNamePatch, _idempotencyKey: string = newIdempotencyKey()): Promise<OwnNameUser> {
  // PATCH /api/tenant/core/v1/users/me -> TenantUserView (only changed name fields; 1..80, trimmed;
  // 400 CORE_VALIDATION_FAILED). Header x-idempotency-key UUIDv7, required by the gateway (WRITE_SENSITIVE route).
  return fakeUpdateMyName(patch);
}

export function getMyProfile(): Promise<TenantProfile> {
  // GET /api/tenant/core/v1/users/me/profile (creates defaults on first read)
  return fakeGetMyProfile();
}

export function updateMyProfile(
  patch: TenantProfilePatch,
  _idempotencyKey: string = newIdempotencyKey(),
): Promise<TenantProfile> {
  // PUT /api/tenant/core/v1/users/me/profile (extensions merged; > 16 KB -> 422 PROFILE_EXTENSIONS_TOO_LARGE;
  // themeKey <= 64, language en|ar -> else 400 CORE_VALIDATION_FAILED). Header x-idempotency-key UUIDv7,
  // required by the gateway (WRITE_SENSITIVE route).
  return fakeUpdateMyProfile(patch);
}

export function uploadAvatar(file: File): Promise<void> {
  // PUT /api/tenant/core/v1/profile/avatar multipart 'file' (PNG/JPEG/WebP, <= 2 MB) -> 204;
  // 415 PARTY_IMAGE_INVALID, 413 PARTY_IMAGE_TOO_LARGE, 400 PARTY_IMAGE_REQUIRED, 404 PARTY_NOT_FOUND
  return fakeUploadAvatar(file);
}

export function getAvatar(): Promise<Blob> {
  // GET /api/tenant/core/v1/profile/avatar -> image bytes, 404 PARTY_IMAGE_NOT_FOUND when none
  return fakeGetAvatar();
}

export function deleteAvatar(): Promise<void> {
  // DELETE /api/tenant/core/v1/profile/avatar -> 204, 404 PARTY_IMAGE_NOT_FOUND when none
  return fakeDeleteAvatar();
}
