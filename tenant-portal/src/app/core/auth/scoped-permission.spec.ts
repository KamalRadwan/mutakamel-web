import { describe, expect, it } from 'vitest';
import { hasScopedPermission } from './scoped-permission';

describe('hasScopedPermission', () => {
  const key = 'crm.customer_profiles.read';

  it('grants the bare key', () => {
    expect(hasScopedPermission([key], key)).toBe(true);
  });

  it.each(['own', 'team', 'all'])('grants the base with the %s scope', (scope) => {
    expect(hasScopedPermission([`${key}.${scope}`], key)).toBe(true);
  });

  it('denies a different base with the same prefix', () => {
    expect(hasScopedPermission(['crm.customer_profiles.status.manage.all'], key)).toBe(false);
  });

  it('denies an empty list', () => {
    expect(hasScopedPermission([], key)).toBe(false);
  });
});
