export const STAFF_PATH = '/workspace/staff';

export const STAFF_PAGES = [
  { id: 'organization', permission: 'org.company.read', icon: 'tablerHierarchy2', color: 'text-icon-blue' },
  { id: 'companies', permission: 'org.company.read', icon: 'tablerBuildingSkyscraper', color: 'text-icon-navy' },
  { id: 'branches', permission: 'org.branch.read', icon: 'tablerBuildingStore', color: 'text-icon-teal' },
  { id: 'departments', permission: 'org.department.read', icon: 'tablerSitemap', color: 'text-icon-orange' },
  { id: 'teams', permission: 'org.team.read', icon: 'tablerUsersGroup', color: 'text-icon-green' },
  { id: 'users', permission: 'users.user.read', icon: 'tablerUser', color: 'text-icon-blue' },
  { id: 'roles', permission: 'roles.role.read', icon: 'tablerShieldLock', color: 'text-icon-violet' },
] as const;

export type StaffPage = (typeof STAFF_PAGES)[number];
