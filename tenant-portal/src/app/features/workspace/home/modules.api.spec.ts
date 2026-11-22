import { afterEach, describe, expect, it } from 'vitest';
import type { Me } from '../staff/shared/staff.model';
import { appIcon, FALLBACK_ICON } from './app-presentation';
import { getAppsOverview, listModules } from './modules.api';
import { CatalogueEntry, fakeGetAppsOverview, setFakeCatalogue } from './modules.fake';
import { AppsOverviewItem, groupAppsOverview } from './modules.model';

const ITEM_KEYS = ['group', 'iconKey', 'isAddon', 'moduleKey', 'myAccessState', 'nameI18n', 'seats'];

const NON_ADMIN: Me = {
  id: 'u-agent',
  firstName: 'Sara',
  lastName: 'Adel',
  isTenantOwner: false,
  permissions: ['crm.lead.read'],
  permissionScopes: { 'crm.lead.read': { tenantWide: true, companyIds: [], branchIds: [] } },
};

const ADMIN: Me = {
  ...NON_ADMIN,
  id: 'u-admin',
  permissions: ['users.user.read'],
  permissionScopes: { 'users.user.read': { tenantWide: true, companyIds: [], branchIds: [] } },
};

function item(moduleKey: string, group: AppsOverviewItem['group']): AppsOverviewItem {
  return {
    moduleKey,
    nameI18n: { en: moduleKey, ar: moduleKey },
    iconKey: null,
    group,
    isAddon: false,
    myAccessState: null,
    seats: null,
  };
}

describe('apps overview fake (GET /api/tenant/core/v1/apps/overview)', () => {
  it('returns { items } with exactly the agreed item shape', async () => {
    const response = await getAppsOverview();
    expect(Object.keys(response)).toEqual(['items']);
    expect(response.items.length).toBeGreaterThan(0);
    for (const app of response.items) {
      expect(Object.keys(app).sort()).toEqual(ITEM_KEYS);
      expect(typeof app.moduleKey).toBe('string');
      expect(Object.keys(app.nameI18n).sort()).toEqual(['ar', 'en']);
      expect(app.iconKey === null || typeof app.iconKey === 'string').toBe(true);
      expect(['SUBSCRIBED', 'AVAILABLE', 'FUTURE']).toContain(app.group);
      expect(typeof app.isAddon).toBe('boolean');
      expect([null, 'ACTIVE', 'OVER_CAPACITY']).toContain(app.myAccessState);
      if (app.seats !== null) {
        expect(Object.keys(app.seats).sort()).toEqual(['total', 'used']);
      }
    }
  });

  it('seeds the apps the home page shows, with an over-capacity app and iconKey null everywhere', async () => {
    const { items } = await getAppsOverview();
    const keys = items.map((app) => app.moduleKey);
    expect(keys.slice(0, 3)).toEqual(['crm', 'trade', 'accounting']);
    expect(items.some((app) => app.myAccessState === 'OVER_CAPACITY')).toBe(true);
    expect(items.every((app) => app.iconKey === null)).toBe(true);
  });

  it('gives seats to a users.user.read caller on SUBSCRIBED, non-add-on items only', async () => {
    const { items } = await fakeGetAppsOverview(ADMIN);
    for (const app of items) {
      if (app.group === 'SUBSCRIBED' && !app.isAddon) {
        expect(app.seats).not.toBeNull();
      } else {
        expect(app.seats).toBeNull();
      }
    }
  });

  it('gives seats to the owner even without users.user.read', async () => {
    const { items } = await fakeGetAppsOverview({ ...NON_ADMIN, isTenantOwner: true });
    expect(items.find((app) => app.moduleKey === 'crm')?.seats).toEqual({ used: 12, total: 20 });
  });

  it('returns seats null on every item for a caller without users.user.read', async () => {
    const { items } = await fakeGetAppsOverview(NON_ADMIN);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((app) => app.seats === null)).toBe(true);
  });

  it('keeps the route guard view (id + lower-case group) in step with the overview', async () => {
    const modules = await listModules();
    expect(modules.find((m) => m.id === 'crm')?.group).toBe('subscribed');
    expect(modules.find((m) => m.id === 'pos')?.group).toBe('available');
  });
});

describe('apps overview fake rules on a custom catalogue', () => {
  afterEach(() => setFakeCatalogue(null));

  function entry(moduleKey: string, rank: number, extra: Partial<CatalogueEntry> = {}): CatalogueEntry {
    return { ...item(moduleKey, 'SUBSCRIBED'), rank, ...extra };
  }

  it('orders by catalogue rank, then moduleKey', async () => {
    setFakeCatalogue([entry('zeta', 20), entry('beta', 10), entry('alpha', 20), entry('gamma', 5)]);
    const { items } = await fakeGetAppsOverview(ADMIN);
    expect(items.map((app) => app.moduleKey)).toEqual(['gamma', 'beta', 'alpha', 'zeta']);
  });

  it('keeps seats null for add-ons and for apps without a seat module', async () => {
    setFakeCatalogue([
      entry('seated', 1, { seats: { used: 2, total: 5 } }),
      entry('addon', 2, { isAddon: true, seats: { used: 1, total: 3 } }),
      entry('no-seat-module', 3, { seats: null }),
    ]);
    const { items } = await fakeGetAppsOverview(ADMIN);
    expect(items.map((app) => app.seats)).toEqual([{ used: 2, total: 5 }, null, null]);
  });

  it('can return an empty FUTURE group', async () => {
    setFakeCatalogue([entry('crm', 1), { ...item('pos', 'AVAILABLE'), rank: 2 }]);
    const { items } = await fakeGetAppsOverview(ADMIN);
    expect(groupAppsOverview(items).FUTURE).toEqual([]);
  });
});

describe('groupAppsOverview', () => {
  it('splits by group and keeps catalogue order inside each group', () => {
    const groups = groupAppsOverview([
      item('a', 'FUTURE'),
      item('b', 'SUBSCRIBED'),
      item('c', 'AVAILABLE'),
      item('d', 'SUBSCRIBED'),
      item('e', 'FUTURE'),
    ]);
    expect(groups.SUBSCRIBED.map((app) => app.moduleKey)).toEqual(['b', 'd']);
    expect(groups.AVAILABLE.map((app) => app.moduleKey)).toEqual(['c']);
    expect(groups.FUTURE.map((app) => app.moduleKey)).toEqual(['a', 'e']);
  });

  it('returns an empty FUTURE group when the catalogue has none', () => {
    const groups = groupAppsOverview([item('a', 'SUBSCRIBED'), item('b', 'AVAILABLE')]);
    expect(groups.FUTURE).toEqual([]);
  });
});

describe('appIcon', () => {
  it('maps icons by moduleKey, because iconKey is always null today', () => {
    expect(appIcon('crm')).toBe('tablerUsers');
  });

  it('falls back to the generic app icon for an unknown moduleKey', () => {
    expect(appIcon('somethingNew')).toBe(FALLBACK_ICON);
  });
});
