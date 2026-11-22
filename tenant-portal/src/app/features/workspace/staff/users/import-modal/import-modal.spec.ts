import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { importUsers } from '../../../seats/seats.api';
import { importRowIndex } from './import-modal';

describe('importRowIndex', () => {
  it('reads the 0-based row from the decimal string array details.index', () => {
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['0'] }))).toBe(0);
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['12'] }))).toBe(12);
  });

  it('is null without a string-array index', () => {
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN'))).toBeNull();
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: 0 }))).toBeNull();
    expect(importRowIndex(new ApiError(409, 'TENANT_EMAIL_TAKEN', { index: ['x'] }))).toBeNull();
  });

  it('the fake ALL_OR_NOTHING import rethrows the taken email with its row index', async () => {
    const error = await importUsers(
      {
        rows: [{ email: 'fresh.user@example.com', firstName: 'Fresh' }, { email: 'taken@bad.example.com', firstName: 'Taken' }],
        mode: 'ALL_OR_NOTHING',
        dryRun: true,
      },
      '019a7c20-0002-7000-8000-000000000123',
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: 'TENANT_EMAIL_TAKEN', details: { index: ['1'] } });
    expect(importRowIndex(error)).toBe(1);
  });
});
