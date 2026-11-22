import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/settings-api';
import { createCustomField, listCustomFields, setRequirement, updateCustomField } from './custom-fields.api';
import { CustomField, mergeRequirementRow } from './custom-fields.model';

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

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error.code : undefined;
  }
}

describe('custom fields contract (backend custom-fields.service.ts)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('create returns the definition without requirements', async () => {
    const created = await settle(
      createCustomField({ ownerType: 'LEAD', fieldKey: 'contract_spec_key', nameAr: 'مفتاح', nameEn: 'Key', type: 'TEXT' }),
    );
    expect('requirements' in created).toBe(false);
    expect(created.fieldKey).toBe('contract_spec_key');
  });

  it('update returns the definition without requirements', async () => {
    const [first] = await settle(listCustomFields());
    const updated = await settle(updateCustomField(first.id, { nameEn: `${first.nameEn} x` }));
    expect('requirements' in updated).toBe(false);
  });

  it('setRequirement returns only the saved requirement row, with a stable id', async () => {
    const fields = await settle(listCustomFields());
    const target = fields.find((field) => field.isActive && field.ownerType !== 'OPPORTUNITY')!;
    const row = await settle(setRequirement(target.id, { operation: 'UPDATE', entityScope: null, isRequired: true }));
    expect(row).toMatchObject({ fieldDefinitionId: target.id, operation: 'UPDATE', entityScope: null, isRequired: true });
    expect(typeof row.id).toBe('string');
    expect('nameEn' in row).toBe(false);

    const again = await settle(setRequirement(target.id, { operation: 'UPDATE', entityScope: null, isRequired: false }));
    expect(again.id).toBe(row.id);
    expect(again.isRequired).toBe(false);
  });

  it('uses backend error codes', async () => {
    expect(await codeOf(updateCustomField('missing-id', { nameEn: 'x' }))).toBe('CUSTOM_FIELD_NOT_FOUND');
    expect(await codeOf(setRequirement('missing-id', { operation: 'CREATE', isRequired: true }))).toBe(
      'CUSTOM_FIELD_NOT_FOUND',
    );
    const [first] = await settle(listCustomFields());
    expect(await codeOf(updateCustomField(first.id, { nameEn: '   ' }))).toBe('CRM_VALIDATION_FAILED');
  });
});

describe('mergeRequirementRow', () => {
  const base = {
    id: 'f1',
    requirements: [{ operation: 'CREATE', entityScope: null, isRequired: true }],
  } as unknown as CustomField;
  const row = (operation: 'CREATE' | 'UPDATE', isRequired: boolean) => ({
    id: 'r1',
    fieldDefinitionId: 'f1',
    operation,
    entityScope: null,
    isRequired,
    createdAt: '',
    updatedAt: '',
  });

  it('replaces the matching requirement', () => {
    expect(mergeRequirementRow(base, row('CREATE', false)).requirements).toEqual([
      { operation: 'CREATE', entityScope: null, isRequired: false },
    ]);
  });

  it('appends a new requirement and keeps the rest of the field', () => {
    const merged = mergeRequirementRow(base, row('UPDATE', true));
    expect(merged.id).toBe('f1');
    expect(merged.requirements).toHaveLength(2);
    expect(base.requirements).toHaveLength(1);
  });
});
