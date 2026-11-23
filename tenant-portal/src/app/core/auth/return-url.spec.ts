import { describe, expect, it } from 'vitest';
import { DEFAULT_SIGNED_IN_URL, safeReturnUrl } from './return-url';

describe('return URL', () => {
  it('defaults signed-in navigation to Workspace Home', () => {
    expect(DEFAULT_SIGNED_IN_URL).toBe('/workspace/home');
  });

  it.each(['/crm/../leads', '/crm/%2e%2e/leads', '/crm/./leads', '/crm/leads\u0000', '/crm/%0aleads'])(
    'rejects traversal or control characters in %s',
    (url) => expect(safeReturnUrl(url)).toBeNull(),
  );

  it('safeReturnUrl rejects external, protocol-relative, backslash, and auth paths', () => {
    expect(safeReturnUrl('/crm/leads?tab=1')).toBe('/crm/leads?tab=1');
    expect(safeReturnUrl('//evil.com')).toBeNull();
    expect(safeReturnUrl('https://evil.com')).toBeNull();
    expect(safeReturnUrl('/\\evil')).toBeNull();
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl('/verify')).toBeNull();
    expect(safeReturnUrl('/reset-password')).toBeNull();
    expect(safeReturnUrl('/tenant/reset-password')).toBeNull();
    expect(safeReturnUrl('/tenant/accept-invite')).toBeNull();
  });
});
