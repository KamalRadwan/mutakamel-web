import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX, PASSWORD_MIN, allChecksPass, passwordChecks } from './password-policy';

describe('password-policy', () => {
  it('enforces min 12 and max 128 length', () => {
    expect(PASSWORD_MIN).toBe(12);
    expect(PASSWORD_MAX).toBe(128);
    expect(passwordChecks('Aa1!aaaaaaa').length).toBe(false);
    expect(passwordChecks('Aa1!aaaaaaaa').length).toBe(true);
    expect(passwordChecks(`Aa1!${'a'.repeat(124)}`).length).toBe(true);
    expect(passwordChecks(`Aa1!${'a'.repeat(125)}`).length).toBe(false);
  });

  it('checks lower, upper, digit, and non-alphanumeric symbol classes', () => {
    expect(passwordChecks('UPPER123!AAAA').lower).toBe(false);
    expect(passwordChecks('lower123!aaaa').upper).toBe(false);
    expect(passwordChecks('LowerUpper!aa').digit).toBe(false);
    expect(passwordChecks('LowerUpper123').symbol).toBe(false);
    expect(passwordChecks('LowerUpper12 ').symbol).toBe(true);

    const valid = passwordChecks('Valid#Pass2026');
    expect(allChecksPass(valid)).toBe(true);
  });
});
