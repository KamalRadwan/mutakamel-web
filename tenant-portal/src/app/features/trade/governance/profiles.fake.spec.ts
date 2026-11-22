import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import {
  createProfile,
  createVersion,
  deleteVersion,
  getProfile,
  getProfileCounts,
  getVersion,
  listProfiles,
  publishVersion,
  validateVersion,
} from './profiles.api';
import { resetFakeProfileStore, setFakeProfileScopeTarget } from './profiles.fake';
import type { ProfileContent, ProfileRequiredCaseInput } from './profiles.model';
import { PROFILE_REGISTRY, type DocumentType } from './profiles.registry';

/** Behaviour of trade-app document-profile.service.ts and document-profile-activation.service.ts. */

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const NOW = '2026-11-21T12:00:00.000Z';
const PAST = '2026-11-01T00:00:00.000Z';
const FUTURE = '2026-12-01T00:00:00.000Z';
let seq = 0;

function defaultContent(type: DocumentType): ProfileContent {
  const family = PROFILE_REGISTRY.families[type];
  return {
    fields: family.fields.map((f) => ({ code: f.code, visible: f.defaultVisible || f.familyRequired, required: f.defaultRequired })),
    components: family.components.map((c) => ({ code: c.code, order: c.defaultOrder, visible: c.defaultVisible })),
    modes: Object.fromEntries(family.modes.map((m) => [m.key, m.defaultValue])),
    evidence: family.evidence.map((e) => ({ code: e.code, include: e.defaultInclude, required: e.defaultRequired })),
  };
}

async function newProfile(type: DocumentType = 'QUOTATION'): Promise<string> {
  seq += 1;
  return (await settle(createProfile({ code: `SPEC_PROFILE_${seq}`, documentType: type, scopeTarget: 'COMPANY' }))).id;
}

async function newVersion(
  profileId: string,
  effectiveFrom = FUTURE,
  extra: { content?: ProfileContent; cases?: ProfileRequiredCaseInput[]; effectiveTo?: string | null; type?: DocumentType } = {},
): Promise<string> {
  const created = await settle(
    createVersion(profileId, {
      content: extra.content ?? defaultContent(extra.type ?? 'QUOTATION'),
      requiredCases: extra.cases ?? [],
      effectiveFrom,
      effectiveTo: extra.effectiveTo ?? null,
    }),
  );
  return created.id;
}

/** Draft (author) -> validated -> published by a colleague against the current pointer version. */
async function publishNew(profileId: string, effectiveFrom: string, effectiveTo: string | null = null): Promise<string> {
  setFakeActor(FAKE_ME);
  const id = await newVersion(profileId, effectiveFrom, { effectiveTo });
  await settle(validateVersion(id));
  const profile = await settle(getProfile(profileId));
  setFakeActor(FAKE_COLLEAGUE);
  await settle(publishVersion(id, profile.pointerVersion));
  setFakeActor(FAKE_ME);
  return id;
}

beforeEach(() => {
  resetFakeProfileStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
});

afterEach(() => {
  setFakeActor(FAKE_ME);
  vi.useRealTimers();
});

describe('document profiles', () => {
  it('creates a profile in the operating scope with a zero pointer', async () => {
    seq += 1;
    const created = await settle(
      createProfile({ code: `SPEC_NEW_${seq}`, documentType: 'SALES_ORDER', scopeTarget: 'COMPANY' }),
    );

    expect(created.code).toBe(`SPEC_NEW_${seq}`);
    expect(created.scopeTarget).toBe('COMPANY');
    expect(created.pointerVersion).toBe(0);
    expect(created.currentPublishedVersionId).toBeNull();
  });

  it('rejects a lower-case code with 400 (DTO pattern)', async () => {
    const error = await rejection(createProfile({ code: 'spec_lower', documentType: 'QUOTATION', scopeTarget: 'COMPANY' }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects a scopeTarget other than the operating scope with 422 SCOPE_NOT_ALLOWED', async () => {
    const error = await rejection(createProfile({ code: 'SPEC_BRANCH', documentType: 'QUOTATION', scopeTarget: 'BRANCH' }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED');
  });

  it('rejects every profile call from a branch context with 422 SCOPE_NOT_ALLOWED', async () => {
    setFakeProfileScopeTarget('BRANCH');

    const error = await rejection(listProfiles());

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.SCOPE_NOT_ALLOWED');
  });

  it('hides a profile of another scope with 404', async () => {
    const id = await newProfile();
    setFakeProfileScopeTarget('TENANT');

    const error = await rejection(getProfile(id));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.NOT_FOUND');
  });

  it('rejects a duplicate document type, code and scope with 409', async () => {
    const id = await newProfile('QUOTATION');
    const existing = await settle(getProfile(id));

    const error = await rejection(createProfile({ code: existing.code, documentType: 'QUOTATION', scopeTarget: 'COMPANY' }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.IDENTITY_TAKEN');
  });

  it('allows the same code under a different document type', async () => {
    const id = await newProfile('QUOTATION');
    const existing = await settle(getProfile(id));

    const other = await settle(createProfile({ code: existing.code, documentType: 'PURCHASE_ORDER', scopeTarget: 'COMPANY' }));

    expect(other.documentType).toBe('PURCHASE_ORDER');
  });

  it('lists { items, total, page, limit } filtered by document type and q', async () => {
    const id = await newProfile('PURCHASE_ORDER');
    const created = await settle(getProfile(id));

    const hits = await settle(listProfiles({ documentType: 'PURCHASE_ORDER', q: created.code.toLowerCase() }));
    const misses = await settle(listProfiles({ documentType: 'QUOTATION', q: created.code.toLowerCase() }));

    expect(hits.items.map((p) => p.id)).toEqual([id]);
    expect(hits.total).toBe(1);
    expect(hits.page).toBe(1);
    expect(hits.limit).toBe(25);
    expect(misses.items).toEqual([]);
  });

  it('counts profiles by document type, every family a key', async () => {
    await newProfile('SALES_ORDER');

    const counts = await settle(getProfileCounts());

    expect(Object.keys(counts.byDocumentType)).toContain('POS_SALE');
    expect(counts.total).toBe(Object.values(counts.byDocumentType).reduce((sum, n) => sum + n, 0));
    expect(counts.byDocumentType['SALES_ORDER']).toBe(2);
  });

  it('omits draft content from list rows unless include=content', async () => {
    const profileId = await newProfile();
    await newVersion(profileId);

    const plain = await settle(listProfiles({ q: 'SPEC_PROFILE' }));
    const withContent = await settle(listProfiles({ q: 'SPEC_PROFILE', include: 'content' }));

    expect(plain.items[0].versions[0].content).toBeUndefined();
    expect(withContent.items[0].versions[0].content).toBeDefined();
  });
});

describe('document profile version lifecycle', () => {
  it('creates a DRAFT version numbered from 1 and does not bump the profile version', async () => {
    const profileId = await newProfile();
    const before = await settle(getProfile(profileId));

    const first = await settle(getVersion(await newVersion(profileId)));
    const second = await settle(getVersion(await newVersion(profileId)));
    const after = await settle(getProfile(profileId));

    expect(first.status).toBe('DRAFT');
    expect(first.profileVersion).toBe(1);
    expect(second.profileVersion).toBe(2);
    expect(first.profile.id).toBe(profileId);
    expect(after.version).toBe(before.version);
  });

  it('moves a draft to TESTED when the validation run passes', async () => {
    const id = await newVersion(await newProfile());

    const run = await settle(validateVersion(id));
    const detail = await settle(getVersion(id));

    expect(run.passed).toBe(true);
    expect(run.status).toBe('TESTED');
    expect(detail.status).toBe('TESTED');
    expect(detail.latestValidationRun?.id).toBe(run.validationRunId);
    expect(detail.version).toBe(run.version);
  });

  it('stores the four server cases before the author cases', async () => {
    const id = await newVersion(await newProfile(), FUTURE, {
      cases: [{ code: 'AUTHOR_CASE', input: {}, expectedValid: false }],
    });

    const run = await settle(validateVersion(id));
    const detail = await settle(getVersion(id));

    expect(run.results.map((r) => r.code)).toEqual([
      'MINIMAL_VALID',
      'MISSING_REQUIRED_REJECTED',
      'SERVER_OWNED_REJECTED',
      'QUOTATION_REGISTRY_COMPATIBLE',
      'AUTHOR_CASE',
    ]);
    expect(detail.requiredCases.every((c) => typeof c.id === 'string' && typeof c.expectedHash === 'string')).toBe(true);
  });

  it('keeps the version in DRAFT and its row version when a required case fails', async () => {
    const id = await newVersion(await newProfile(), FUTURE, {
      cases: [{ code: 'NO_FIELDS_IS_VALID', input: {}, expectedValid: true }],
    });

    const run = await settle(validateVersion(id));
    const detail = await settle(getVersion(id));

    expect(run.passed).toBe(false);
    expect(run.results.find((r) => r.code === 'NO_FIELDS_IS_VALID')?.passed).toBe(false);
    expect(detail.status).toBe('DRAFT');
    expect(detail.version).toBe(1);
    expect(detail.latestValidationRun?.diagnostics).toEqual([{ caseCode: 'NO_FIELDS_IS_VALID', code: 'OUTCOME_HASH_MISMATCH' }]);
  });

  it('passes a required case that expects an incomplete input to be invalid', async () => {
    const id = await newVersion(await newProfile(), FUTURE, {
      cases: [{ code: 'EMPTY_REJECTED', input: {}, expectedValid: false }],
    });

    const run = await settle(validateVersion(id));

    expect(run.results.find((r) => r.code === 'EMPTY_REJECTED')?.passed).toBe(true);
  });

  it('refuses to validate a version that is no longer a draft (not_draft)', async () => {
    const id = await newVersion(await newProfile());
    const first = await settle(validateVersion(id));

    const error = await rejection(validateVersion(id, first.version));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY');
    expect(error.details?.['reason']).toEqual(['not_draft']);
  });

  it('refuses to publish a draft that was never validated (not_tested)', async () => {
    const profileId = await newProfile();
    const id = await newVersion(profileId);
    setFakeActor(FAKE_COLLEAGUE);

    const error = await rejection(publishVersion(id, 0));

    expect(error.status).toBe(409);
    expect(error.details?.['reason']).toEqual(['not_tested']);
  });

  it('refuses the author publishing their own version (self_publish)', async () => {
    const profileId = await newProfile();
    const id = await newVersion(profileId);
    await settle(validateVersion(id));

    const error = await rejection(publishVersion(id, 0));

    expect(error.status).toBe(409);
    expect(error.details?.['reason']).toEqual(['self_publish']);
  });

  it('checks the pointer before the row version (STALE_VERSION wins)', async () => {
    const profileId = await newProfile();
    const id = await newVersion(profileId);
    setFakeActor(FAKE_COLLEAGUE);

    // Neither tested nor fresh: the stale pointer is reported first.
    const error = await rejection(publishVersion(id, 7, 99));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });

  it('publishes an immediate version, moves the pointer and returns the publish result', async () => {
    const profileId = await newProfile();
    setFakeActor(FAKE_ME);
    const id = await newVersion(profileId, PAST);
    await settle(validateVersion(id));
    setFakeActor(FAKE_COLLEAGUE);

    const result = await settle(publishVersion(id, 0));
    const profile = await settle(getProfile(profileId));

    expect(result.status).toBe('PUBLISHED');
    expect(result.active).toBe(true);
    expect(result.activePointerVersion).toBe(1);
    expect(result.publishedBy).toBe(FAKE_COLLEAGUE);
    expect(profile.currentPublishedVersionId).toBe(id);
    expect(profile.pointerVersion).toBe(1);
  });

  it('schedules a future-dated version without moving the pointer', async () => {
    const profileId = await newProfile();
    setFakeActor(FAKE_ME);
    const id = await newVersion(profileId, FUTURE);
    await settle(validateVersion(id));
    setFakeActor(FAKE_COLLEAGUE);

    const result = await settle(publishVersion(id, 0));
    const profile = await settle(getProfile(profileId));

    expect(result.status).toBe('SCHEDULED');
    expect(result.active).toBe(false);
    expect(result.scheduledExpectedPointerVersion).toBe(0);
    expect(profile.currentPublishedVersionId).toBeNull();
    expect(profile.pointerVersion).toBe(0);
  });

  it('activates a scheduled version and moves the pointer once its start has passed', async () => {
    const profileId = await newProfile();
    const id = await publishNew(profileId, FUTURE);

    vi.setSystemTime(new Date('2026-12-01T00:00:01.000Z'));
    const detail = await settle(getVersion(id));
    const profile = await settle(getProfile(profileId));

    expect(detail.status).toBe('PUBLISHED');
    expect(profile.currentPublishedVersionId).toBe(id);
    expect(profile.pointerVersion).toBe(1);
  });

  it('leaves a scheduled version SCHEDULED when the pointer moved since it was scheduled', async () => {
    const profileId = await newProfile();
    const scheduled = await publishNew(profileId, '2027-01-01T00:00:00.000Z');
    await publishNew(profileId, PAST, '2026-12-01T00:00:00.000Z');

    vi.setSystemTime(new Date('2027-01-02T00:00:00.000Z'));
    const detail = await settle(getVersion(scheduled));

    expect(detail.status).toBe('SCHEDULED');
  });

  describe('predecessor of a publish', () => {
    it('immediate: cuts the live version at now and marks it SUPERSEDED', async () => {
      const profileId = await newProfile();
      const oldId = await publishNew(profileId, PAST);

      const newId = await publishNew(profileId, '2026-11-10T00:00:00.000Z');
      const old = await settle(getVersion(oldId));
      const profile = await settle(getProfile(profileId));

      expect(old.status).toBe('SUPERSEDED');
      // Cut at the publish moment (now, after the fake delays), not at the successor start.
      expect(Date.parse(old.supersededAt!)).toBeGreaterThanOrEqual(Date.parse(NOW));
      expect(Date.parse(old.supersededAt!)).toBeLessThanOrEqual(Date.now());
      expect(old.supersededByVersionId).toBe(newId);
      expect(old.effectiveTo).toBeNull();
      expect(profile.currentPublishedVersionId).toBe(newId);
      expect(profile.pointerVersion).toBe(2);
    });

    it('immediate across a gap: leaves both supersession fields null', async () => {
      const profileId = await newProfile();
      const oldId = await publishNew(profileId, PAST, '2026-11-05T00:00:00.000Z');

      await publishNew(profileId, '2026-11-10T00:00:00.000Z');
      const old = await settle(getVersion(oldId));

      expect(old.status).toBe('SUPERSEDED');
      expect(old.supersededAt).toBeNull();
      expect(old.supersededByVersionId).toBeNull();
      expect(old.effectiveTo).toBe('2026-11-05T00:00:00.000Z');
    });

    it('scheduled: reserves the cut at the successor start and keeps the live version PUBLISHED', async () => {
      const profileId = await newProfile();
      const oldId = await publishNew(profileId, PAST);

      const newId = await publishNew(profileId, FUTURE);
      const old = await settle(getVersion(oldId));
      const profile = await settle(getProfile(profileId));

      expect(old.status).toBe('PUBLISHED');
      expect(old.supersededAt).toBe(FUTURE);
      expect(old.supersededByVersionId).toBe(newId);
      expect(old.effectiveTo).toBeNull();
      expect(profile.currentPublishedVersionId).toBe(oldId);
      expect(profile.pointerVersion).toBe(1);
    });

    it('scheduled: marks the live version SUPERSEDED once the successor activates', async () => {
      const profileId = await newProfile();
      const oldId = await publishNew(profileId, PAST);
      await publishNew(profileId, FUTURE);

      vi.setSystemTime(new Date('2026-12-01T00:00:01.000Z'));
      const old = await settle(getVersion(oldId));

      expect(old.status).toBe('SUPERSEDED');
      expect(old.supersededAt).toBe(FUTURE);
    });

    it('scheduled: leaves a live version that ends before the successor untouched', async () => {
      const profileId = await newProfile();
      const oldId = await publishNew(profileId, PAST, '2026-11-30T00:00:00.000Z');

      await publishNew(profileId, FUTURE);
      const old = await settle(getVersion(oldId));

      expect(old.status).toBe('PUBLISHED');
      expect(old.supersededAt).toBeNull();
      expect(old.supersededByVersionId).toBeNull();
    });
  });

  it('rejects a publish whose window overlaps another scheduled version (effective_overlap)', async () => {
    const profileId = await newProfile();
    await publishNew(profileId, FUTURE);

    setFakeActor(FAKE_ME);
    const second = await newVersion(profileId, '2026-12-15T00:00:00.000Z');
    await settle(validateVersion(second));
    const profile = await settle(getProfile(profileId));
    setFakeActor(FAKE_COLLEAGUE);
    const error = await rejection(publishVersion(second, profile.pointerVersion));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY');
    expect(error.details?.['reason']).toEqual(['effective_overlap']);
  });

  it('does not change the live version when the publish is rejected', async () => {
    const profileId = await newProfile();
    const liveId = await publishNew(profileId, PAST);
    await publishNew(profileId, '2027-03-01T00:00:00.000Z');

    setFakeActor(FAKE_ME);
    const clash = await newVersion(profileId, '2027-02-01T00:00:00.000Z', { effectiveTo: '2027-04-01T00:00:00.000Z' });
    await settle(validateVersion(clash));
    const profile = await settle(getProfile(profileId));
    setFakeActor(FAKE_COLLEAGUE);
    await rejection(publishVersion(clash, profile.pointerVersion));
    const live = await settle(getVersion(liveId));

    expect(live.status).toBe('PUBLISHED');
    expect(live.effectiveTo).toBeNull();
    expect(live.supersededAt).toBe('2027-03-01T00:00:00.000Z');
  });

  it('deletes a draft but refuses to delete a validated version (not_deletable)', async () => {
    const profileId = await newProfile();
    const draft = await newVersion(profileId);
    const tested = await newVersion(profileId);
    await settle(validateVersion(tested));

    const deleted = await settle(deleteVersion(draft, 1));
    const error = await rejection(deleteVersion(tested));
    const profile = await settle(getProfile(profileId));

    expect(deleted.id).toBe(draft);
    expect(deleted.deleted).toBe(true);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.PUBLISH_NOT_READY');
    expect(error.details?.['reason']).toEqual(['not_deletable']);
    expect(profile.versions.map((v) => v.id)).toEqual([tested]);
  });
});

describe('document profile content validation', () => {
  it('rejects content whose field list does not cover the registry with 422 SCHEMA_INVALID', async () => {
    const profileId = await newProfile();
    const content = defaultContent('QUOTATION');
    content.fields = content.fields.slice(1);

    const error = await rejection(createVersion(profileId, { content, effectiveFrom: FUTURE }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  });

  it('rejects hiding a family-required field with 422 COMPATIBILITY_FAILED', async () => {
    const profileId = await newProfile();
    const content = defaultContent('QUOTATION');
    const required = PROFILE_REGISTRY.families.QUOTATION.fields.find((f) => f.familyRequired)!;
    content.fields = content.fields.map((f) => (f.code === required.code ? { ...f, visible: false } : f));

    const error = await rejection(createVersion(profileId, { content, effectiveFrom: FUTURE }));

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
  });

  it('rejects marking a server-owned field as required', async () => {
    const profileId = await newProfile();
    const content = defaultContent('QUOTATION');
    const serverOwned = PROFILE_REGISTRY.families.QUOTATION.fields.find((f) => f.serverOwned)!;
    content.fields = content.fields.map((f) => (f.code === serverOwned.code ? { ...f, visible: true, required: true } : f));

    const error = await rejection(createVersion(profileId, { content, effectiveFrom: FUTURE }));

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
  });

  it('rejects hiding a mandatory component', async () => {
    const profileId = await newProfile();
    const content = defaultContent('QUOTATION');
    content.components = content.components.map((c) => (c.code === 'LINE_ITEMS' ? { ...c, visible: false } : c));

    const error = await rejection(createVersion(profileId, { content, effectiveFrom: FUTURE }));

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
  });

  it('rejects a locked mode that was changed', async () => {
    const profileId = await newProfile();
    const content = defaultContent('QUOTATION');
    content.modes = { ...content.modes, acceptanceMode: 'SOMETHING_ELSE' };

    const error = await rejection(createVersion(profileId, { content, effectiveFrom: FUTURE }));

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.COMPATIBILITY_FAILED');
  });

  it('rejects more than 20 required cases with VALIDATION_LIMIT_EXCEEDED', async () => {
    const profileId = await newProfile();
    const cases = Array.from({ length: 21 }, (_, i) => ({ code: `CASE_${i}`, input: {}, expectedValid: false }));

    const error = await rejection(
      createVersion(profileId, { content: defaultContent('QUOTATION'), requiredCases: cases, effectiveFrom: FUTURE }),
    );

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.VALIDATION_LIMIT_EXCEEDED');
  });

  it('rejects an author case reusing a server case code with REQUIRED_CASES_FAILED', async () => {
    const profileId = await newProfile();

    const error = await rejection(
      createVersion(profileId, {
        content: defaultContent('QUOTATION'),
        requiredCases: [{ code: 'MINIMAL_VALID', input: {}, expectedValid: true }],
        effectiveFrom: FUTURE,
      }),
    );

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.REQUIRED_CASES_FAILED');
  });

  it('rejects a window whose end is not after its start', async () => {
    const profileId = await newProfile();

    const error = await rejection(
      createVersion(profileId, { content: defaultContent('QUOTATION'), effectiveFrom: FUTURE, effectiveTo: FUTURE }),
    );

    expect(error.code).toBe('TRADE.DOCUMENT_PROFILE.SCHEMA_INVALID');
  });

  it('rejects a stale profile If-Match when creating a version', async () => {
    const profileId = await newProfile();
    const profile = await settle(getProfile(profileId));

    const error = await rejection(
      createVersion(profileId, { content: defaultContent('QUOTATION'), effectiveFrom: FUTURE }, profile.version + 3),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });
});
