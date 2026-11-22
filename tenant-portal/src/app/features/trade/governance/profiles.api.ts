import type { WriteOptions } from './governance-fake-actors';
import {
  fakeCreateProfile,
  fakeCreateProfileVersion,
  fakeDeleteProfileVersion,
  fakeGetProfile,
  fakeGetProfileCounts,
  fakeGetProfileRegistry,
  fakeGetProfileVersion,
  fakeListProfiles,
  fakePublishProfileVersion,
  fakeValidateProfileVersion,
} from './profiles.fake';
import type {
  CreateProfileInput,
  CreateProfileVersionInput,
  DocumentProfile,
  DocumentProfileRecord,
  ListProfilesQuery,
  ProfileCounts,
  ProfileDeleteResult,
  ProfileFilterQuery,
  ProfileList,
  ProfilePublishResult,
  ProfileValidateResult,
  ProfileVersionCreated,
  ProfileVersionDetail,
} from './profiles.model';
import type { ProfileRegistry } from './profiles.registry';

export const PROFILES_QUERY_KEYS = {
  registry: () => ['trade', 'profiles', 'registry'] as const,
  counts: (q?: ProfileFilterQuery) => ['trade', 'profiles', 'counts', q ?? {}] as const,
  list: (q?: ListProfilesQuery) => ['trade', 'profiles', 'list', q ?? {}] as const,
  profile: (id: string) => ['trade', 'profiles', 'detail', id] as const,
  version: (id: string) => ['trade', 'profiles', 'version', id] as const,
};

// Writes send x-idempotency-key; version writes send If-Match.

// GET /api/tenant/trade/v1/document-profiles/registry
export function getRegistry(): Promise<ProfileRegistry> {
  return fakeGetProfileRegistry();
}

// GET /api/tenant/trade/v1/document-profiles/counts?documentType&versionStatus&q
export function getProfileCounts(q: ProfileFilterQuery = {}): Promise<ProfileCounts> {
  return fakeGetProfileCounts(q);
}

// GET /api/tenant/trade/v1/document-profiles?documentType&versionStatus&q&page&limit&include
export function listProfiles(q: ListProfilesQuery = {}): Promise<ProfileList> {
  return fakeListProfiles(q);
}

// GET /api/tenant/trade/v1/document-profiles/:id
export function getProfile(id: string): Promise<DocumentProfile> {
  return fakeGetProfile(id);
}

// POST /api/tenant/trade/v1/document-profiles { code, documentType, scopeTarget }
export function createProfile(input: CreateProfileInput, opts?: WriteOptions | string): Promise<DocumentProfileRecord> {
  return fakeCreateProfile(input, opts);
}

// POST /api/tenant/trade/v1/document-profiles/:id/versions; If-Match = profile version
export function createVersion(
  profileId: string,
  input: CreateProfileVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileVersionCreated> {
  return fakeCreateProfileVersion(profileId, input, ifMatchOrOpts, idempotencyKey);
}

// GET /api/tenant/trade/v1/document-profile-versions/:id
export function getVersion(id: string): Promise<ProfileVersionDetail> {
  return fakeGetProfileVersion(id);
}

// DELETE /api/tenant/trade/v1/document-profile-versions/:id
export function deleteVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileDeleteResult> {
  return fakeDeleteProfileVersion(id, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/document-profile-versions/:id/validate
export function validateVersion(
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfileValidateResult> {
  return fakeValidateProfileVersion(id, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/document-profile-versions/:id/publish { expectedActivePointerVersion }
export function publishVersion(
  id: string,
  expectedActivePointerVersion: number,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<ProfilePublishResult> {
  return fakePublishProfileVersion(id, expectedActivePointerVersion, ifMatchOrOpts, idempotencyKey);
}
