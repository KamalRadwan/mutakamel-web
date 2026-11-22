import { describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/trade-api';
import { staleKindOf } from './categories.model';

describe('staleKindOf', () => {
  it('returns TREE for lowercase and uppercase tree', () => {
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['tree'] }))).toBe('TREE');
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['TREE'] }))).toBe('TREE');
  });

  it('returns NODE for lowercase and uppercase node', () => {
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['node'] }))).toBe('NODE');
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['NODE'] }))).toBe('NODE');
  });

  it('prefers TREE when both node and tree are stale', () => {
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['node', 'tree'] }))).toBe('TREE');
  });

  it('ignores non-string values in details.stale', () => {
    const details = { stale: [null, 42, 'node'] } as unknown as Record<string, string[]>;
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', details))).toBe('NODE');

    const nonStringsOnly = { stale: [null, 42, {}] } as unknown as Record<string, string[]>;
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', nonStringsOnly))).toBeNull();
  });

  it('returns null for unrecognized values', () => {
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', { stale: ['Invalid value'] }))).toBeNull();
  });

  it('returns null when stale is missing or not an array', () => {
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'))).toBeNull();
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', {}))).toBeNull();
    const nonArray = { stale: 'tree' } as unknown as Record<string, string[]>;
    expect(staleKindOf(new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION', nonArray))).toBeNull();
  });

  it('returns null for a non-ApiError', () => {
    expect(staleKindOf(new Error('boom'))).toBeNull();
    expect(staleKindOf(null)).toBeNull();
    expect(staleKindOf({ details: { stale: ['tree'] } })).toBeNull();
  });
});
