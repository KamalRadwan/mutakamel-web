import { hasScopedPermission } from '../../../core/auth/scoped-permission';

let readPermissions: () => readonly string[] = () => [];

export function bindAnalyticsPermissions(read: () => readonly string[]): void {
  readPermissions = read;
}

export function can(key: string): boolean {
  return hasScopedPermission(readPermissions(), key);
}

export function scopeLevels(): ('own' | 'team' | 'all')[] {
  const permissions = readPermissions();
  if (permissions.includes('crm.dashboards.read.all')) return ['own', 'team', 'all'];
  if (permissions.includes('crm.dashboards.read.team')) return ['own', 'team'];
  if (permissions.includes('crm.dashboards.read.own')) return ['own'];
  return [];
}
