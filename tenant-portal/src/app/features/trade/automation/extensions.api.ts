import type { Page } from '../shared/trade-foundation.model';
import {
  fakeCreateProfile,
  fakeDiscardDraft,
  fakeGetExtVersion,
  fakeGetExtensionTargets,
  fakeGetProfile,
  fakeGetProfileCounts,
  fakeListExtVersions,
  fakeListProfiles,
  fakePublishProfile,
  fakeRetireProfile,
  fakeUpdateProfile,
  fakeValidateProfile,
} from './extensions.fake';
import type {
  CreateExtensionProfileInput,
  ExtensionDraftDiscardResult,
  ExtValidateResult,
  ExtVersion,
  ExtensionFieldInput,
  ExtensionProfile,
  ExtensionProfileCounts,
  ExtensionProfileDraftResult,
  ExtensionProfileEntity,
  ExtensionProfileFilters,
  ExtensionProfilePublishResult,
  ListExtVersionsQuery,
  ListExtensionProfilesQuery,
} from './extensions.model';
import type { ExtensionTargetsResponse } from './extensions.registry';

export const EXTENSIONS_QUERY_KEYS = {
  all: ['trade', 'automation', 'extensions'] as const,
  targets: () => ['trade', 'automation', 'extensions', 'targets'] as const,
  counts: (q?: ExtensionProfileFilters) =>
    ['trade', 'automation', 'extensions', 'counts', q ?? {}] as const,
  list: (q?: ListExtensionProfilesQuery) =>
    ['trade', 'automation', 'extensions', 'list', q ?? {}] as const,
  detail: (id: string) => ['trade', 'automation', 'extensions', 'detail', id] as const,
  versions: (id: string, q?: ListExtVersionsQuery) =>
    ['trade', 'automation', 'extensions', 'versions', id, q ?? {}] as const,
  version: (id: string, versionId: string) =>
    ['trade', 'automation', 'extensions', 'version', id, versionId] as const,
};

// GET /api/tenant/trade/v1/extensions/profiles/counts?targetCode&status
export function getProfileCounts(q: ExtensionProfileFilters = {}): Promise<ExtensionProfileCounts> {
  return fakeGetProfileCounts(q);
}

// GET /api/tenant/trade/v1/extensions/targets
export function getTargets(): Promise<ExtensionTargetsResponse> {
  return fakeGetExtensionTargets();
}

// GET /api/tenant/trade/v1/extensions/profiles?targetCode&status&page&limit
export function listProfiles(q: ListExtensionProfilesQuery = {}): Promise<Page<ExtensionProfile>> {
  return fakeListProfiles(q);
}

// GET /api/tenant/trade/v1/extensions/profiles/:id
export function getProfile(id: string): Promise<ExtensionProfile> {
  return fakeGetProfile(id);
}

// GET /api/tenant/trade/v1/extensions/profiles/:id/versions?status&page&limit
export function listVersions(id: string, q: ListExtVersionsQuery = {}): Promise<Page<ExtVersion>> {
  return fakeListExtVersions(id, q);
}

// GET /api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId
export function getVersion(id: string, versionId: string): Promise<ExtVersion> {
  return fakeGetExtVersion(id, versionId);
}

// POST /api/tenant/trade/v1/extensions/profiles (X-Idempotency-Key) -> 201
export function createProfile(
  input: CreateExtensionProfileInput,
  idempotencyKey: string,
): Promise<ExtensionProfileDraftResult> {
  return fakeCreateProfile(input, idempotencyKey);
}

// PATCH /api/tenant/trade/v1/extensions/profiles/:id body {fields} (X-Idempotency-Key, If-Match)
export function updateFields(
  id: string,
  fields: ExtensionFieldInput[],
  ifMatch: number,
  idempotencyKey: string,
): Promise<ExtensionProfileDraftResult> {
  return fakeUpdateProfile(id, fields, { ifMatch, idempotencyKey });
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/validate (X-Idempotency-Key, If-Match)
export function validate(id: string, ifMatch: number, idempotencyKey: string): Promise<ExtValidateResult> {
  return fakeValidateProfile(id, { ifMatch, idempotencyKey });
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/publish (X-Idempotency-Key, If-Match)
export function publish(id: string, ifMatch: number, idempotencyKey: string): Promise<ExtensionProfilePublishResult> {
  return fakePublishProfile(id, { ifMatch, idempotencyKey });
}

// DELETE /api/tenant/trade/v1/extensions/profiles/:id/draft (X-Idempotency-Key, If-Match)
export function discardDraft(id: string, ifMatch: number, idempotencyKey: string): Promise<ExtensionDraftDiscardResult> {
  return fakeDiscardDraft(id, { ifMatch, idempotencyKey });
}

// POST /api/tenant/trade/v1/extensions/profiles/:id/retire (X-Idempotency-Key, If-Match)
export function retire(id: string, ifMatch: number, idempotencyKey: string): Promise<ExtensionProfileEntity> {
  return fakeRetireProfile(id, { ifMatch, idempotencyKey });
}
