import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './automation-fake-actors';
import * as api from './extensions.api';
import { getProfile, getProfileCounts, getTargets, getVersion, listProfiles, listVersions } from './extensions.api';
import { setFakeExtensionContext } from './extensions.fake';
import type { CreateExtensionProfileInput, ExtensionFieldInput } from './extensions.model';
import { EXTENSION_COLLECTION_SCHEMA, EXTENSION_OBJECT_SCHEMA, toFieldInput } from './extensions.registry';

/** The profile version for If-Match when a test does not pin one (1 when the profile cannot be read). */
async function versionOf(id: string, ifMatch?: number): Promise<number> {
  return ifMatch ?? (await getProfile(id).then((p) => p.version, () => 1));
}

// Write wrappers: each call is a new user action (fresh UUIDv7 key) unless a test passes its own key.
const createProfile = (input: CreateExtensionProfileInput, key = newIdempotencyKey()) => api.createProfile(input, key);
const updateFields = async (id: string, fields: ExtensionFieldInput[], ifMatch?: number, key = newIdempotencyKey()) =>
  api.updateFields(id, fields, await versionOf(id, ifMatch), key);
const validate = async (id: string, ifMatch?: number, key = newIdempotencyKey()) =>
  api.validate(id, await versionOf(id, ifMatch), key);
const publish = async (id: string, ifMatch?: number, key = newIdempotencyKey()) =>
  api.publish(id, await versionOf(id, ifMatch), key);
const discardDraft = async (id: string, ifMatch?: number) => api.discardDraft(id, await versionOf(id, ifMatch), newIdempotencyKey());
const retire = async (id: string, ifMatch?: number) => api.retire(id, await versionOf(id, ifMatch), newIdempotencyKey());

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
let seq = 0;

function textField(fieldKey = 'spec.note', extra: Partial<ExtensionFieldInput> = {}): ExtensionFieldInput {
  return { fieldKey, valueKind: 'SCALAR', scalarType: 'STRING', visibilityCode: 'USER', ...extra };
}

type Target = 'CATALOG_ITEM' | 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER';

async function newProfile(fields: ExtensionFieldInput[] = [textField()], targetCode: Target = 'QUOTATION'): Promise<string> {
  seq += 1;
  return (await settle(createProfile({ code: `SPEC_EXT_${seq}`, targetCode, scopeTarget: 'COMPANY', fields }))).id;
}

async function currentVersion(id: string): Promise<number> {
  return (await settle(getProfile(id))).version;
}

async function publishNew(id: string): Promise<void> {
  await settle(validate(id, await currentVersion(id)));
  await settle(publish(id, await currentVersion(id)));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
  setFakeExtensionContext({ target: 'COMPANY', companyId: 'c1' });
});

afterEach(() => {
  setFakeActor(FAKE_ME);
  setFakeExtensionContext({ target: 'COMPANY', companyId: 'c1' });
  vi.useRealTimers();
});

describe('extension targets', () => {
  it('returns the registry object the backend returns, not a bare list', async () => {
    const targets = await settle(getTargets());
    expect(targets.registryVersion).toBe(1);
    expect(targets.targets.map((t) => t.code)).toEqual(['CATALOG_ITEM', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER']);
    expect(targets.targets[0]).toEqual({
      code: 'CATALOG_ITEM',
      schemaCode: 'trade.catalog-item.extensions',
      schemaVersion: 1,
      searchable: true,
    });
    expect(targets.valueSchemas.object.code).toBe(EXTENSION_OBJECT_SCHEMA);
    expect(targets.defaultStrategies).toEqual(['NONE', 'LITERAL']);
    expect(targets.limits).toEqual({ fieldsPerProfile: 100, valueBytes: 16384 });
  });
});

describe('extension profiles', () => {
  it('creates a DRAFT company profile and returns the entity with its draft version and fields', async () => {
    seq += 1;
    const created = await settle(
      createProfile({ code: `SPEC_EXT_${seq}`, targetCode: 'QUOTATION', scopeTarget: 'COMPANY', fields: [textField()] }),
    );

    expect(created.status).toBe('DRAFT');
    expect(created.companyId).toBe('c1');
    expect(created.createdBy).toBe(FAKE_ME);
    expect(created.draftVersion.status).toBe('DRAFT');
    expect(created.draftVersion.targetSchemaCode).toBe('trade.quotation.extensions');
    expect(created.fields).toHaveLength(1);
    expect(created.fields[0]).toMatchObject({
      ordinal: 1,
      visibilityCode: 'USER',
      constraintPayload: {},
      profileVersionId: created.draftVersion.id,
    });

    const detail = await settle(getProfile(created.id));
    expect(detail.currentPublishedVersion).toBeNull();
    expect(detail.editableDraftVersion?.fields?.[0]?.fieldKey).toBe('spec.note');
    expect(detail.editableDraftVersion).not.toHaveProperty('createdBy');
  });

  it('rejects a lower-case code with 400 (the DTO pattern runs before the service)', async () => {
    const err = await rejection(
      createProfile({ code: 'lower_code', targetCode: 'QUOTATION', scopeTarget: 'COMPANY', fields: [textField()] }),
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects fields that carry id or ordinal (forbidNonWhitelisted)', async () => {
    const field = { ...textField(), id: 'x', ordinal: 1 } as ExtensionFieldInput;
    const err = await rejection(
      createProfile({ code: 'SPEC_EXTRA_KEYS', targetCode: 'QUOTATION', scopeTarget: 'COMPANY', fields: [field] }),
    );
    expect(err.status).toBe(400);
  });

  it('denies a COMPANY profile outside a company context with 403 TARGET_DENIED', async () => {
    setFakeExtensionContext({ target: 'BRANCH', companyId: 'c1' });
    const err = await rejection(
      createProfile({ code: 'SPEC_BRANCH', targetCode: 'QUOTATION', scopeTarget: 'COMPANY', fields: [textField()] }),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe('TRADE.AUTH.TARGET_DENIED');
  });

  it('rejects a TENANT profile outside the tenant context with 422 DEFINITION_INVALID', async () => {
    const err = await rejection(
      createProfile({ code: 'SPEC_TENANT', targetCode: 'QUOTATION', scopeTarget: 'TENANT', fields: [textField()] }),
    );
    expect(err.status).toBe(422);
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('creates a TENANT profile in the tenant context and hides it from the company scope', async () => {
    setFakeExtensionContext({ target: 'TENANT', companyId: null });
    const created = await settle(
      createProfile({ code: 'SPEC_TENANT_OK', targetCode: 'QUOTATION', scopeTarget: 'TENANT', fields: [textField()] }),
    );
    expect(created.companyId).toBeNull();
    setFakeExtensionContext({ target: 'COMPANY', companyId: 'c1' });
    const err = await rejection(getProfile(created.id));
    expect(err.status).toBe(404);
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_NOT_FOUND');
  });

  it('rejects a duplicate code for the same target and company with 409', async () => {
    seq += 1;
    const body = {
      code: `SPEC_DUP_${seq}`,
      targetCode: 'QUOTATION' as const,
      scopeTarget: 'COMPANY' as const,
      fields: [textField()],
    };
    await settle(createProfile(body));
    const err = await rejection(createProfile(body));
    expect(err.status).toBe(409);
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_CONFLICT');
  });

  it('rejects a profile created without any field with 400', async () => {
    const err = await rejection(
      createProfile({ code: 'SPEC_EMPTY', targetCode: 'QUOTATION', scopeTarget: 'COMPANY', fields: [] }),
    );
    expect(err.status).toBe(400);
  });

  it('filters the list by target and status and carries a profile-level field count', async () => {
    const page = await settle(listProfiles({ targetCode: 'CATALOG_ITEM', status: 'ACTIVE' }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const row of page.items) {
      expect(row.targetCode).toBe('CATALOG_ITEM');
      expect(row.status).toBe('ACTIVE');
      expect(typeof row.fieldCount).toBe('number');
      expect(row.editableDraftVersion?.fields).toBeUndefined();
    }
    expect(page.items.find((row) => row.code === 'ITEM_EXTRA')?.fieldCount).toBe(4);
  });

  it('pages the list with total, page and limit', async () => {
    const page = await settle(listProfiles({ page: 1, limit: 1 }));
    expect(page.items).toHaveLength(1);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(1);
    expect(page.total).toBeGreaterThan(1);
  });

  it('rejects page 0 and a limit above 100 with 400', async () => {
    expect((await rejection(listProfiles({ page: 0 }))).status).toBe(400);
    expect((await rejection(listProfiles({ limit: 101 }))).status).toBe(400);
  });

  it('returns 404 DEFINITION_NOT_FOUND for an unknown profile', async () => {
    const err = await rejection(getProfile('missing'));
    expect(err.status).toBe(404);
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_NOT_FOUND');
  });
});

describe('extension profile counts', () => {
  it('reports totals that equal the sum of the per-target and per-status counts', async () => {
    const counts = await settle(getProfileCounts());
    expect(Object.values(counts.byTarget).reduce((a, b) => a + b, 0)).toBe(counts.total);
    expect(Object.values(counts.byStatus).reduce((a, b) => a + b, 0)).toBe(counts.total);
  });

  it('applies the status filter like the list', async () => {
    const counts = await settle(getProfileCounts({ status: 'ACTIVE' }));
    const list = await settle(listProfiles({ status: 'ACTIVE', limit: 100 }));
    expect(counts.total).toBe(list.total);
    expect(counts.byStatus.DRAFT).toBe(0);
  });

  it('moves a profile from the DRAFT count to the ACTIVE count when it is published', async () => {
    const before = await settle(getProfileCounts());
    const id = await newProfile();
    expect((await settle(getProfileCounts())).byStatus.DRAFT).toBe(before.byStatus.DRAFT + 1);
    await publishNew(id);
    const after = await settle(getProfileCounts());
    expect(after.byStatus.ACTIVE).toBe(before.byStatus.ACTIVE + 1);
    expect(after.byStatus.DRAFT).toBe(before.byStatus.DRAFT);
  });
});

describe('extension version lifecycle', () => {
  it('moves a draft to TESTED and returns the backend validate shape', async () => {
    const id = await newProfile();
    const res = await settle(validate(id, await currentVersion(id)));
    expect(res).toMatchObject({ profileId: id, passed: true, fieldCount: 1, diagnostics: [] });
    expect(typeof res.checkedAt).toBe('string');
    const detail = await settle(getProfile(id));
    expect(res.versionId).toBe(detail.editableDraftVersion?.id);
    expect(res.version).toBe(detail.version);
    expect(detail.editableDraftVersion?.status).toBe('TESTED');
    expect(detail.editableDraftVersion?.compatibilitySummary).toMatchObject({ passed: true, fieldCount: 1 });
  });

  it('keeps the draft in DRAFT and reports a diagnostic for a required field without a default', async () => {
    const id = await newProfile([textField('spec.must', { isRequired: true })]);
    const res = await settle(validate(id));
    expect(res.passed).toBe(false);
    expect(res.diagnostics).toEqual([{ fieldKey: 'spec.must', code: 'REQUIRED_FIELD_NEEDS_MIGRATION_OR_DEFAULT' }]);
    expect((await settle(getProfile(id))).editableDraftVersion?.status).toBe('DRAFT');
  });

  it('refuses to publish a draft that was not validated with 422 PROFILE_INCOMPATIBLE', async () => {
    const id = await newProfile();
    const err = await rejection(publish(id));
    expect(err.status).toBe(422);
    expect(err.code).toBe('TRADE.EXTENSION.PROFILE_INCOMPATIBLE');
  });

  it('answers 409 PROFILE_CONFLICT when there is no draft to validate or publish', async () => {
    const id = await newProfile();
    await publishNew(id);
    expect((await rejection(validate(id))).code).toBe('TRADE.EXTENSION.PROFILE_CONFLICT');
    const err = await rejection(publish(id));
    expect(err.status).toBe(409);
    expect(err.code).toBe('TRADE.EXTENSION.PROFILE_CONFLICT');
  });

  it('publishes a tested draft and returns the profile entity with the published version', async () => {
    const id = await newProfile();
    await settle(validate(id));
    const res = await settle(publish(id));
    expect(res.status).toBe('ACTIVE');
    expect(res.publishedVersion.status).toBe('PUBLISHED');
    expect(res.currentPublishedVersionId).toBe(res.publishedVersion.id);
    const detail = await settle(getProfile(id));
    expect(detail.editableDraftVersion).toBeNull();
    expect(detail.currentPublishedVersion?.fields).toHaveLength(1);
  });

  it('requires a second person when the publisher created the draft and it has a required field', async () => {
    const id = await newProfile([
      textField('spec.must', { isRequired: true, defaultStrategy: 'LITERAL', defaultValue: 'x' }),
    ]);
    await settle(validate(id));
    const err = await rejection(publish(id));
    expect(err.status).toBe(409);
    expect(err.code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
    setFakeActor(FAKE_COLLEAGUE);
    expect((await settle(publish(id))).status).toBe('ACTIVE');
  });

  it('treats the person who last saved the fields as a maker too', async () => {
    setFakeActor(FAKE_COLLEAGUE);
    const id = await newProfile([
      textField('spec.must', { isRequired: true, defaultStrategy: 'LITERAL', defaultValue: 'x' }),
    ]);
    setFakeActor(FAKE_ME);
    await settle(
      updateFields(id, [textField('spec.must', { isRequired: true, defaultStrategy: 'LITERAL', defaultValue: 'y' })]),
    );
    await settle(validate(id));
    expect((await rejection(publish(id))).code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  });

  it('opens a new draft when the fields are edited after publishing and returns the draft result', async () => {
    const id = await newProfile();
    await publishNew(id);
    const res = await settle(updateFields(id, [textField(), textField('spec.extra')], await currentVersion(id)));
    expect(res.draftVersion.versionNumber).toBe(2);
    expect(res.fields.map((f) => f.ordinal)).toEqual([1, 2]);
    expect((await settle(getProfile(id))).editableDraftVersion?.fields).toHaveLength(2);
  });

  it('supersedes the previous published version when the next one is published', async () => {
    const id = await newProfile();
    await publishNew(id);
    await settle(updateFields(id, [textField('spec.other')]));
    await publishNew(id);
    const versions = await settle(listVersions(id));
    expect(versions.items.map((v) => v.status)).toEqual(['PUBLISHED', 'SUPERSEDED']);
    expect((await settle(listVersions(id, { status: 'SUPERSEDED' }))).total).toBe(1);
  });

  it('resets a tested draft to DRAFT when its fields change', async () => {
    const id = await newProfile();
    await settle(validate(id));
    await settle(updateFields(id, [textField('spec.changed')]));
    expect((await settle(getProfile(id))).editableDraftVersion?.status).toBe('DRAFT');
  });

  it('lists versions newest first without fields and returns fields on the version detail', async () => {
    const page = await settle(listVersions('extp-item-extra', { page: 1, limit: 2 }));
    expect(page.total).toBe(3);
    expect(page.items.map((v) => v.versionNumber)).toEqual([3, 2]);
    expect(page.items[0]?.fields).toBeUndefined();
    expect(page.items[0]).not.toHaveProperty('fieldCount');
    expect((await settle(getVersion('extp-item-extra', 'extv-item-1'))).fields).toHaveLength(2);
  });

  it('returns 404 for a version that belongs to another profile', async () => {
    const err = await rejection(getVersion('extp-quote-terms', 'extv-item-1'));
    expect(err.status).toBe(404);
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_NOT_FOUND');
  });

  it('rejects a stale If-Match on publish with 409', async () => {
    const id = await newProfile();
    await settle(validate(id));
    const err = await rejection(publish(id, 1));
    expect(err.status).toBe(409);
    expect(err.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });

  it('replays the same idempotency key on update without a second version bump', async () => {
    const id = await newProfile();
    const v = await currentVersion(id);
    const key = newIdempotencyKey();
    const first = await settle(updateFields(id, [textField('spec.a')], v, key));
    const second = await settle(updateFields(id, [textField('spec.a')], v, key));
    expect(second.version).toBe(first.version);
  });

  it('denies writes from a branch context with 403', async () => {
    const id = await newProfile();
    setFakeExtensionContext({ target: 'BRANCH', companyId: 'c1' });
    expect((await rejection(updateFields(id, [textField()]))).code).toBe('TRADE.AUTH.TARGET_DENIED');
    expect((await rejection(validate(id))).status).toBe(403);
  });

  it('discards the editable draft and returns the discarded version id', async () => {
    const id = await newProfile();
    await publishNew(id);
    await settle(updateFields(id, [textField('spec.x')]));
    const draftId = (await settle(getProfile(id))).editableDraftVersion?.id;
    const res = await settle(discardDraft(id));
    expect(res).toEqual({ id, version: await currentVersion(id), discardedVersionId: draftId });
    expect((await settle(getProfile(id))).editableDraftVersion).toBeNull();
  });

  it('blocks changes to a retired profile with 422 PROFILE_INCOMPATIBLE and reason profile_retired', async () => {
    const id = await newProfile();
    expect((await settle(retire(id))).status).toBe('RETIRED');
    const err = await rejection(updateFields(id, [textField()]));
    expect(err.status).toBe(422);
    expect(err.code).toBe('TRADE.EXTENSION.PROFILE_INCOMPATIBLE');
    expect(err.details).toEqual({ reason: ['profile_retired'] });
  });
});

describe('extension field validation', () => {
  it('rejects a reserved field segment with 422 RESERVED_FIELD and no details', async () => {
    const err = await rejection(newProfile([textField('spec.unit_price')]));
    expect(err.status).toBe(422);
    expect(err.code).toBe('TRADE.EXTENSION.RESERVED_FIELD');
    expect(err.details).toBeUndefined();
  });

  it('allows segments the backend does not reserve, such as code', async () => {
    await expect(newProfile([textField('spec.code')])).resolves.toBeTypeOf('string');
  });

  it('rejects a field key that is not namespaced with 400', async () => {
    expect((await rejection(newProfile([textField('note')]))).status).toBe(400);
  });

  it('rejects two fields with the same key with 422', async () => {
    const err = await rejection(newProfile([textField('spec.a'), textField('spec.a')]));
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('rejects a searchable field on a target that is not searchable', async () => {
    const err = await rejection(newProfile([textField('spec.s', { isSearchable: true })], 'QUOTATION'));
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('accepts a searchable field on the catalog item target', async () => {
    await expect(newProfile([textField('spec.s', { isSearchable: true })], 'CATALOG_ITEM')).resolves.toBeTypeOf(
      'string',
    );
  });

  it('requires the collection schema code, version and maxItems on a collection', async () => {
    const bare = textField('spec.list', { valueKind: 'COLLECTION', maxItems: 5 });
    expect((await rejection(newProfile([bare]))).code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
    await expect(
      newProfile([{ ...bare, schemaCode: EXTENSION_COLLECTION_SCHEMA, schemaVersion: 1 }]),
    ).resolves.toBeTypeOf('string');
  });

  it('stores object properties in constraintPayload.properties sorted by key with normalized decimals', async () => {
    const id = await newProfile([
      {
        fieldKey: 'spec.group',
        valueKind: 'OBJECT',
        schemaCode: EXTENSION_OBJECT_SCHEMA,
        schemaVersion: 1,
        visibilityCode: 'USER',
        constraintPayload: {
          properties: [
            {
              key: 'zeta',
              scalarType: 'STRING',
              isRequired: false,
              maxLength: 10,
              decimalScale: null,
              minimumDecimal: null,
              maximumDecimal: null,
              allowedValues: null,
            },
            {
              key: 'alpha',
              scalarType: 'DECIMAL',
              isRequired: true,
              maxLength: null,
              decimalScale: 2,
              minimumDecimal: '1.50',
              maximumDecimal: null,
              allowedValues: null,
            },
          ],
        },
      },
    ]);
    const field = (await settle(getProfile(id))).editableDraftVersion?.fields?.[0];
    expect(field?.constraintPayload.properties?.map((p) => p.key)).toEqual(['alpha', 'zeta']);
    expect(field?.constraintPayload.properties?.[0]?.minimumDecimal).toBe('1.5');
  });

  it('rejects an object field without properties', async () => {
    const err = await rejection(
      newProfile([
        { fieldKey: 'spec.group', valueKind: 'OBJECT', schemaCode: EXTENSION_OBJECT_SCHEMA, schemaVersion: 1, visibilityCode: 'USER' },
      ]),
    );
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('sorts ENUM choices and defaults DECIMAL scale to 8', async () => {
    const id = await newProfile([
      textField('spec.choice', { scalarType: 'ENUM', constraintPayload: { allowedValues: ['B', 'A'] } }),
      textField('spec.amount', { scalarType: 'DECIMAL', defaultStrategy: 'LITERAL', defaultValue: '1.50' }),
    ]);
    const [choice, amount] = (await settle(getProfile(id))).editableDraftVersion?.fields ?? [];
    expect(choice?.constraintPayload.allowedValues).toEqual(['A', 'B']);
    expect(amount?.decimalScale).toBe(8);
    expect(amount?.defaultValue).toBe('1.5');
  });

  it('rejects a numeric DECIMAL default (the backend takes decimal strings only)', async () => {
    const err = await rejection(
      newProfile([textField('spec.n', { scalarType: 'DECIMAL', defaultStrategy: 'LITERAL', defaultValue: 3 })]),
    );
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('rejects OWNER_DERIVED and a default value when the strategy is NONE', async () => {
    expect((await rejection(newProfile([textField('spec.o', { defaultStrategy: 'OWNER_DERIVED' })]))).status).toBe(422);
    expect((await rejection(newProfile([textField('spec.d', { defaultValue: 'x' })]))).code).toBe(
      'TRADE.EXTENSION.DEFINITION_INVALID',
    );
  });

  it('rejects a maxLength on a boolean field', async () => {
    const err = await rejection(newProfile([textField('spec.b', { scalarType: 'BOOLEAN', maxLength: 5 })]));
    expect(err.code).toBe('TRADE.EXTENSION.DEFINITION_INVALID');
  });

  it('round-trips a stored field through toFieldInput without id or ordinal', async () => {
    const field = (await settle(getProfile('extp-item-extra'))).editableDraftVersion?.fields?.[1];
    const input = toFieldInput(field!);
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('ordinal');
    const id = await newProfile([input], 'CATALOG_ITEM');
    expect((await settle(getProfile(id))).editableDraftVersion?.fields?.[0]?.constraintPayload).toEqual(
      field?.constraintPayload,
    );
  });
});

describe('extension write headers (X-Idempotency-Key, If-Match)', () => {
  it('rejects a missing key with 400 KEY_MISSING and a non-UUIDv7 key with 422 KEY_REQUIRED', async () => {
    const id = await newProfile();
    const v = await currentVersion(id);
    const missing = await rejection(api.validate(id, v, ''));
    expect([missing.status, missing.code]).toEqual([400, 'TRADE.IDEMPOTENCY.KEY_MISSING']);
    const bad = await rejection(api.validate(id, v, 'key-1'));
    expect([bad.status, bad.code]).toEqual([422, 'TRADE.IDEMPOTENCY.KEY_REQUIRED']);
  });

  it('rejects a missing If-Match with 400 IF_MATCH_REQUIRED on every versioned write', async () => {
    const id = await newProfile();
    const noVersion = undefined as unknown as number;
    for (const call of [
      () => api.updateFields(id, [textField()], noVersion, newIdempotencyKey()),
      () => api.validate(id, noVersion, newIdempotencyKey()),
      () => api.publish(id, noVersion, newIdempotencyKey()),
      () => api.discardDraft(id, noVersion, newIdempotencyKey()),
      () => api.retire(id, noVersion, newIdempotencyKey()),
    ]) {
      const err = await rejection(call());
      expect([err.status, err.code]).toEqual([400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED']);
    }
  });

  it('rejects the same key with a different body with 422 MISMATCH', async () => {
    const id = await newProfile();
    const v = await currentVersion(id);
    const key = newIdempotencyKey();
    await settle(api.updateFields(id, [textField('spec.a')], v, key));
    const err = await rejection(api.updateFields(id, [textField('spec.b')], v, key));
    expect([err.status, err.code]).toEqual([422, 'TRADE.IDEMPOTENCY.MISMATCH']);
  });
});
