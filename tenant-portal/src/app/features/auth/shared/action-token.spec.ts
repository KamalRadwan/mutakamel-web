import { describe, expect, it } from 'vitest';
import { ACTION_TOKEN_MAX, ACTION_TOKEN_MIN, readActionToken } from './action-token';

describe('readActionToken', () => {
  it('decodes + as space via URLSearchParams and accepts optional # prefix', () => {
    expect(readActionToken('token=raw+token+12345678')).toBe('raw token 12345678');
    expect(readActionToken('#token=raw+token+12345678&extra=1')).toBe('raw token 12345678');
  });

  it('rejects missing tokens and lengths outside 16..512', () => {
    expect(readActionToken(null)).toBeNull();
    expect(readActionToken('')).toBeNull();
    expect(readActionToken('other=1234567890123456')).toBeNull();
    expect(readActionToken(`token=${'a'.repeat(ACTION_TOKEN_MIN - 1)}`)).toBeNull();
    expect(readActionToken(`token=${'a'.repeat(ACTION_TOKEN_MIN)}`)).toBe('a'.repeat(ACTION_TOKEN_MIN));
    expect(readActionToken(`token=${'a'.repeat(ACTION_TOKEN_MAX)}`)).toBe('a'.repeat(ACTION_TOKEN_MAX));
    expect(readActionToken(`token=${'a'.repeat(ACTION_TOKEN_MAX + 1)}`)).toBeNull();
  });
});
