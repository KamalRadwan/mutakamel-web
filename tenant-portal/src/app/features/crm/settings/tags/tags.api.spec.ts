import { describe, expect, it } from 'vitest';
import { ApiError } from '../shared/settings-api';
import { detachLimitCount } from './tags.api';
import { MAX_DETACH_LEADS } from './tags.model';

describe('detachLimitCount', () => {
  it('reads the decimal string array details.count', () => {
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED', { count: ['101'] }))).toBe(101);
  });

  it('falls back to the detach limit when count is missing or not a string array', () => {
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED', { count: 101 }))).toBe(MAX_DETACH_LEADS);
    expect(detachLimitCount(new ApiError(422, 'CRM_TAG_DETACH_LIMIT_EXCEEDED'))).toBe(MAX_DETACH_LEADS);
    expect(detachLimitCount(new Error('net'))).toBe(MAX_DETACH_LEADS);
  });
});
