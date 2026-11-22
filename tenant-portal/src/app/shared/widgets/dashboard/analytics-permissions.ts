export const FAKE_PERMISSIONS = new Set<string>([
  'crm.dashboards.read.all',
  'crm.dashboards.create',
  'crm.dashboards.update',
  'crm.dashboards.delete',
  'crm.dashboards.share',
  'crm.widgets.read',
  'crm.widgets.create',
  'crm.widgets.update',
  'crm.widgets.publish',
  'crm.widgets.delete',
  'crm.widgets.share',
  'crm.widgets.transfer_ownership',
  'crm.targets.read.all',
  'core.activities.read.all',
  'crm.targets.manage',
  'crm.targets.approve',
  'crm.sla.manage',
  'crm.settings.read',
  'crm.settings.manage',
  'crm.alerts.manage',
  'crm.subscriptions.manage',
  'crm.exports.create',
  'crm.analytics.readiness.view',
]);

export function can(key: string): boolean {
  return (
    FAKE_PERMISSIONS.has(key) ||
    FAKE_PERMISSIONS.has(`${key}.own`) ||
    FAKE_PERMISSIONS.has(`${key}.team`) ||
    FAKE_PERMISSIONS.has(`${key}.all`)
  );
}

export function scopeLevels(): ('own' | 'team' | 'all')[] {
  if (FAKE_PERMISSIONS.has('crm.dashboards.read.all')) return ['own', 'team', 'all'];
  if (FAKE_PERMISSIONS.has('crm.dashboards.read.team')) return ['own', 'team'];
  if (FAKE_PERMISSIONS.has('crm.dashboards.read.own')) return ['own'];
  return [];
}
