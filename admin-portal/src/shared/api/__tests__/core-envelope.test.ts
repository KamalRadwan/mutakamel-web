import { describe, it, expect } from 'vitest';
import { extractCoreData, extractCoreMeta } from '../core-envelope';

describe('core-envelope', () => {
  it('extracts data correctly from success envelope', () => {
    const payload = {
      data: {
        success: true as const,
        data: { id: 1 },
        correlationId: 'test-id',
        timestamp: '2026-08-02'
      }
    };
    expect(extractCoreData(payload)).toEqual({ id: 1 });
  });

  it('extracts meta correctly if it exists', () => {
    const payload = {
      data: {
        success: true as const,
        data: [],
        meta: { page: 1, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrev: false },
        correlationId: 'test-id',
        timestamp: '2026-08-02'
      }
    };
    expect(extractCoreMeta(payload)).toEqual({
      page: 1, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrev: false
    });
  });

  it('returns undefined for meta if it does not exist', () => {
    const payload = {
      data: {
        success: true as const,
        data: { id: 1 },
        correlationId: 'test-id',
        timestamp: '2026-08-02'
      }
    };
    expect(extractCoreMeta(payload)).toBeUndefined();
  });
});
