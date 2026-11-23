import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CustomFieldSubmission, createCustomField, listCustomFields, setRequirement, updateCustomField } from './custom-fields.api';
import { CustomField, CreateCustomFieldInput, mergeRequirementRow } from './custom-fields.model';

const createInput = (): CreateCustomFieldInput => ({
  ownerType: 'PARTY', fieldKey: 'contract_key', nameAr: 'مفتاح', nameEn: 'Key', type: 'TEXT',
});
const uuid7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('custom fields contract (backend custom-fields.service.ts)', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new CrmHttpStub(); dispose = bindCrmHttpForTest(stub); });
  afterEach(() => { dispose(); vi.restoreAllMocks(); });

  it('reads the bare definitions with the settings query key', async () => {
    const read = vi.spyOn(stub, 'read').mockResolvedValue([]);
    expect(await listCustomFields()).toEqual([]);
    expect(read).toHaveBeenCalledExactlyOnceWith('/custom-fields');
    expect(crmQueries().getQueryData(['crm-settings', 'custom-fields'])).toEqual([]);
  });

  it('create returns the definition without requirements', async () => {
    const created = await createCustomField(createInput());
    expect('requirements' in created).toBe(false);
    expect(created.fieldKey).toBe('contract_key');
  });

  it('update returns the definition without requirements', async () => {
    const updated = await updateCustomField('field-1', { nameEn: 'New name' });
    expect('requirements' in updated).toBe(false);
    expect(updated.nameEn).toBe('New name');
  });

  it('setRequirement returns only the saved requirement row, with a stable id', async () => {
    const row = { id: 'r1', fieldDefinitionId: 'f1', operation: 'UPDATE', entityScope: null, isRequired: true };
    const write = vi.spyOn(stub, 'write').mockResolvedValue({ status: 201, data: row, etag: null, location: null });
    expect(await setRequirement('f1', { operation: 'UPDATE', isRequired: true })).toEqual(row);
    write.mockResolvedValue({ status: 201, data: { ...row, isRequired: false }, etag: null, location: null });
    expect((await setRequirement('f1', { operation: 'UPDATE', isRequired: false })).id).toBe(row.id);
  });

  it('uses backend error codes', async () => {
    const error = new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['Must not be blank'] });
    vi.spyOn(stub, 'write').mockRejectedValue(error);
    await expect(updateCustomField('f1', { nameEn: '' })).rejects.toBe(error);
    await expect(setRequirement('missing-id', { operation: 'CREATE', isRequired: true })).rejects.toBe(error);
  });

  const actions: { name: string; path: string; method: string; body: () => object; send: (body: object) => Promise<unknown> }[] = [
    { name: 'create', path: '/custom-fields', method: 'POST', body: createInput,
      send: (body: object) => createCustomField(body as CreateCustomFieldInput) },
    { name: 'patch', path: '/custom-fields/f1', method: 'PATCH', body: () => ({ nameEn: 'Changed' }),
      send: (body: object) => updateCustomField('f1', body) },
    { name: 'requirement', path: '/custom-fields/f1/requirements', method: 'POST', body: () => ({ operation: 'CREATE' as const, isRequired: true }),
      send: (body: object) => setRequirement('f1', body as { operation: 'CREATE'; isRequired: boolean }) },
  ];
  describe.each(actions)('$name writes', ({ path, method, body, send }) => {
    it('sends a UUID v7 key without scope and invalidates after success', async () => {
      const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      await send(body());
      expect(stub.recordedWrites()).toHaveLength(1);
      expect(stub.recordedWrites()[0]).toMatchObject({ path, method, body: body(), options: { key: expect.stringMatching(uuid7) } });
      expect(stub.recordedWrites()[0].options.scope).toBeUndefined();
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'custom-fields'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'custom-fields'] });
    });

    it.each([0, 503, 401, 409])('keeps the key and body after uncertain status %s', async status => {
      const error = new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK_ERROR');
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(error);
      const submission = new CustomFieldSubmission();
      await expect(submission.run(body(), send)).rejects.toBe(error);
      expect(write).toHaveBeenCalledTimes(1);
      await submission.run(body(), send);
      expect(write.mock.calls[1]).toEqual(write.mock.calls[0]);
    });

    it('uses a new key for a changed body after a failed write', async () => {
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR'));
      const submission = new CustomFieldSubmission();
      await expect(submission.run(body(), send)).rejects.toBeInstanceOf(ApiError);
      const changed = { ...body(), ...('isRequired' in body() ? { isRequired: false } : { nameEn: 'Other' }) };
      await submission.run(changed, send);
      expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
      expect(write.mock.calls[1][2]).toEqual(changed);
    });

    it('never retries a 4xx automatically and starts a fresh action after it', async () => {
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(422, 'CUSTOM_FIELD_INACTIVE'));
      const input = body();
      await expect(send(input)).rejects.toBeInstanceOf(ApiError);
      expect(write).toHaveBeenCalledTimes(1);
      await send(input);
      expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
    });
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
