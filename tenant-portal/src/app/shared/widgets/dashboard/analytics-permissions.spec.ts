import { computed, signal } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { bindAnalyticsPermissions, can, scopeLevels } from './analytics-permissions';

afterEach(() => bindAnalyticsPermissions(() => []));

describe('analytics permissions', () => {
  it('denies permissions and exposes no scopes before binding', () => {
    expect(can('crm.dashboards.read')).toBe(false);
    expect(scopeLevels()).toEqual([]);
  });

  it('reads scoped and bare permissions from the bound source', () => {
    bindAnalyticsPermissions(() => ['crm.dashboards.read.team', 'crm.widgets.read']);

    expect(can('crm.dashboards.read')).toBe(true);
    expect(can('crm.widgets.read')).toBe(true);
    expect(can('crm.widgets.create')).toBe(false);
    expect(scopeLevels()).toEqual(['own', 'team']);
  });

  it.each([
    ['own', ['own']],
    ['team', ['own', 'team']],
    ['all', ['own', 'team', 'all']],
  ])('exposes inherited levels for %s', (scope, levels) => {
    bindAnalyticsPermissions(() => [`crm.dashboards.read.${scope}`]);
    expect(scopeLevels()).toEqual(levels);
  });

  it('does not derive dashboard scopes from unrelated or bare keys', () => {
    bindAnalyticsPermissions(() => ['crm.targets.read.all', 'crm.dashboards.read']);
    expect(scopeLevels()).toEqual([]);
  });

  it('updates computed permissions and scopes when the bound signal changes', () => {
    const permissions = signal<readonly string[]>(['crm.dashboards.read.own']);
    bindAnalyticsPermissions(permissions);
    const levels = computed(() => scopeLevels());
    const allowed = computed(() => can('crm.dashboards.read'));

    expect(levels()).toEqual(['own']);
    expect(allowed()).toBe(true);
    permissions.set(['crm.dashboards.read.all']);
    expect(levels()).toEqual(['own', 'team', 'all']);
    permissions.set([]);
    expect(levels()).toEqual([]);
    expect(allowed()).toBe(false);
  });
});
