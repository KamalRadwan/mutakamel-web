import { ApiError } from '../../../../core/api/api-errors';
import { toCorePage, type CorePage } from '../../../../core/api/core-page';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import type { TenantResourceScope } from '../../../../core/scope/tenant-scope';
import {
  CATALOGUE_BY_KEY,
  CORE_KEYS,
  CRM_KEYS,
  TRADE_KEYS,
  getCatalogueEntries,
  getCatalogueRevision,
  getPermissionsList,
} from './permission-catalogue.fake';
import {
  ReportingScopes,
  AssignmentOptions,
  Branch,
  BranchRoleAssignment,
  CODE_PATTERN,
  Company,
  ConfirmAddonCascadeOptions,
  Currency,
  Department,
  EMPLOYEE_CODE_PATTERN,
  ListQuery,
  Me,
  MembershipRole,
  ModuleAssignment,
  OrgTreeNode,
  Permission,
  Role,
  RoleBranchPermissions,
  RoleBranchProfile,
  RoleDetail,
  STAFF_LIMITS,
  ScopeRoleAssignment,
  ScopeTarget,
  SeatImpact,
  Team,
  TeamMembership,
  TenantUser,
} from './staff.model';

export type FakeActor = 'owner' | 'tenantAdmin' | 'branchAdmin';

export let FAKE_ACTOR: FakeActor = 'owner';
export let FAKE_TREE_TOO_LARGE = false;
export let FAKE_SEAT_IMPACT = false;
export let FAKE_SEAT_CASCADE = false;
export let FAKE_OVER_CAPACITY = false;
export const FAKE_SEATS: Record<string, number> = { crm: 4, trade: 2 };

export function setFakeActor(actor: FakeActor): void {
  FAKE_ACTOR = actor;
}

export function setFakeTreeTooLarge(value: boolean): void {
  FAKE_TREE_TOO_LARGE = value;
}

export function setFakeSeatImpact(value: boolean): void {
  FAKE_SEAT_IMPACT = value;
}

export function setFakeSeatCascade(value: boolean): void {
  FAKE_SEAT_CASCADE = value;
}

export function setFakeOverCapacity(value: boolean): void {
  FAKE_OVER_CAPACITY = value;
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBSCRIBED_MODULES = new Set(['crm', 'trade']);

export const SUBSCRIBED_MODULE_CONFIGS = [
  { moduleKey: 'crm', nameI18n: { en: 'CRM', ar: 'إدارة العملاء' }, capacity: 4 },
  { moduleKey: 'trade', nameI18n: { en: 'Trade', ar: 'التجارة' }, capacity: 2 },
] as const;

export interface SeatsOverlay {
  isOverCapacity: () => boolean;
  isDerivedMode: () => boolean;
  getUserSeats: (userId: string) => {
    moduleKey: string;
    accessState: 'ACTIVE' | 'OVER_CAPACITY';
    grantedAt: string;
    cause: string | null;
    roles: { roleId: string; roleName: string; scope: string }[];
  }[];
}

let seatsOverlay: SeatsOverlay | null = null;

export function registerSeatsOverlay(overlay: SeatsOverlay): void {
  seatsOverlay = overlay;
}

export function isStaffOverCapacity(): boolean {
  return FAKE_OVER_CAPACITY;
}

interface StoredRole extends Role {
  permissionIds: string[];
  branchRevision: number;
  profiles: { branchId: string; permissionIds: string[] }[];
}

interface StoredMembership extends TeamMembership {
  explicitBranchIds: string[];
}

interface IdempotencyRecord {
  op: string;
  bodyHash: string;
  result: unknown;
}

interface StoreState {
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  teams: Team[];
  users: TenantUser[];
  deletedUserIds: Set<string>;
  releasedUserIds: Set<string>;
  neverAcceptedUserIds: Set<string>;
  memberships: StoredMembership[];
  modules: ModuleAssignment[];
  roles: StoredRole[];
  branchRoles: BranchRoleAssignment[];
  scopeRoles: ScopeRoleAssignment[];
  currencies: Currency[];
  resendTimestamps: Map<string, number[]>;
  idempotency: Map<string, IdempotencyRecord>;
}

const T0 = '2026-01-10T09:00:00.000Z';
const T1 = '2026-03-15T11:30:00.000Z';

function createSeedState(): StoreState {
  const allSubscribedPerms = [...CORE_KEYS, ...CRM_KEYS, ...TRADE_KEYS];
  const salesManagerCai = CRM_KEYS.filter(
    (k) =>
      (k.startsWith('crm.leads.') || k.startsWith('crm.opportunities.') || k.startsWith('crm.customer_profiles.')) &&
      k.endsWith('.all'),
  );
  const salesManagerAlx = ['crm.leads.read.all', 'crm.opportunities.read.all', 'crm.customer_profiles.read.all'];
  const salesRepPerms = [
    'crm.leads.read.own',
    'crm.leads.create.own',
    'crm.leads.update.own',
    'crm.activities.read.own',
    'crm.activities.create.own',
    'crm.activities.update.own',
    'crm.activities.delete.own',
  ];
  const hrViewerPerms = ['users.user.read', 'org.company.read', 'org.branch.read', 'org.department.read', 'org.team.read'];

  return {
    companies: [
      {
        id: 'co-eg',
        code: 'MUTAKAMEL-EG',
        name: 'Mutakamel Egypt',
        legalName: 'Mutakamel Egypt S.A.E.',
        taxNumber: '123-456-789',
        countryCode: 'EG',
        currencyCode: 'EGP',
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'co-sa',
        code: 'MUTAKAMEL-SA',
        name: 'Mutakamel KSA',
        legalName: 'Mutakamel Arabia LLC',
        taxNumber: null,
        countryCode: 'SA',
        currencyCode: 'SAR',
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'co-old',
        code: 'LEGACY',
        name: 'Legacy Trading',
        legalName: null,
        taxNumber: null,
        countryCode: null,
        currencyCode: null,
        status: 'INACTIVE',
        createdAt: T0,
        updatedAt: T0,
      },
    ],
    branches: [
      {
        id: 'br-cai',
        companyId: 'co-eg',
        code: 'CAI',
        name: 'Cairo HQ',
        address: 'Nasr City, Cairo',
        phone: '+20225550100',
        isHeadquarters: true,
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'br-alx',
        companyId: 'co-eg',
        code: 'ALX',
        name: 'Alexandria',
        address: null,
        phone: null,
        isHeadquarters: false,
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'br-mns',
        companyId: 'co-eg',
        code: 'MNS',
        name: 'Mansoura',
        address: null,
        phone: null,
        isHeadquarters: false,
        status: 'INACTIVE',
        createdAt: T0,
        updatedAt: T0,
      },
      {
        id: 'br-ruh',
        companyId: 'co-sa',
        code: 'RUH',
        name: 'Riyadh HQ',
        address: null,
        phone: null,
        isHeadquarters: true,
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'br-jed',
        companyId: 'co-sa',
        code: 'JED',
        name: 'Jeddah',
        address: null,
        phone: null,
        isHeadquarters: false,
        status: 'ACTIVE',
        createdAt: T0,
        updatedAt: T1,
      },
    ],
    departments: [
      { id: 'dp-sales-cai', branchId: 'br-cai', code: 'SALES', name: 'Sales', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'dp-ops-cai', branchId: 'br-cai', code: 'OPS', name: 'Operations', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'dp-fin-cai', branchId: 'br-cai', code: 'FIN', name: 'Finance', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'dp-sales-alx', branchId: 'br-alx', code: 'SALES', name: 'Sales', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'dp-sales-ruh', branchId: 'br-ruh', code: 'SALES', name: 'Sales', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'dp-hr-ruh', branchId: 'br-ruh', code: 'HR', name: 'Human resources', status: 'INACTIVE', createdAt: T0, updatedAt: T0 },
    ],
    teams: [
      { id: 'tm-ent', departmentId: 'dp-sales-cai', code: 'ENT', name: 'Enterprise sales', leadUserId: 'u-mona', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'tm-smb', departmentId: 'dp-sales-cai', code: 'SMB', name: 'SMB sales', leadUserId: 'u-omar', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'tm-alx', departmentId: 'dp-sales-alx', code: 'ALX-SALES', name: 'Alexandria sales', leadUserId: null, status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'tm-ruh', departmentId: 'dp-sales-ruh', code: 'RUH-SALES', name: 'Riyadh sales', leadUserId: 'u-faisal', status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
      { id: 'tm-support', departmentId: 'dp-ops-cai', code: 'SUPPORT', name: 'Support', leadUserId: null, status: 'ACTIVE', createdAt: T0, updatedAt: T1 },
    ],
    users: [
      {
        id: 'u-owner',
        email: 'kamal.radwan@example.com',
        firstName: 'Kamal',
        lastName: 'Radwan',
        employeeCode: 'EMP-0001',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: null,
        managerId: null,
        jobTitle: null,
        status: 'ACTIVE',
        isTenantOwner: true,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-mona',
        email: 'mona.elsayed@example.com',
        firstName: 'Mona',
        lastName: 'El-Sayed',
        employeeCode: 'EMP-0002',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: 'tm-ent',
        managerId: null,
        jobTitle: 'Sales manager',
        status: 'ACTIVE',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-omar',
        email: 'omar.fathy@example.com',
        firstName: 'Omar',
        lastName: 'Fathy',
        employeeCode: 'EMP-0003',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: 'tm-smb',
        managerId: 'u-mona',
        jobTitle: 'Account executive',
        status: 'ACTIVE',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-nada',
        email: 'nada.ibrahim@example.com',
        firstName: 'Nada',
        lastName: 'Ibrahim',
        employeeCode: 'EMP-0004',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-ops-cai',
        teamId: 'tm-support',
        managerId: null,
        jobTitle: null,
        status: 'ACTIVE',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-youssef',
        email: 'youssef.adel@example.com',
        firstName: 'Youssef',
        lastName: 'Adel',
        employeeCode: 'EMP-0005',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-fin-cai',
        teamId: null,
        managerId: null,
        jobTitle: 'Accountant',
        status: 'SUSPENDED',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-noura',
        email: 'noura.alotaibi@example.com',
        firstName: 'Noura',
        lastName: 'Al-Otaibi',
        employeeCode: 'EMP-0006',
        companyId: 'co-sa',
        branchId: 'br-ruh',
        departmentId: 'dp-sales-ruh',
        teamId: null,
        managerId: null,
        jobTitle: 'HR specialist',
        status: 'INVITED',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-faisal',
        email: 'faisal.aldosari@example.com',
        firstName: 'Faisal',
        lastName: 'Al-Dosari',
        employeeCode: 'EMP-0007',
        companyId: 'co-sa',
        branchId: 'br-ruh',
        departmentId: 'dp-sales-ruh',
        teamId: 'tm-ruh',
        managerId: null,
        jobTitle: null,
        status: 'ACTIVE',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'u-hany',
        email: 'hany.nabil@example.com',
        firstName: 'Hany',
        lastName: 'Nabil',
        employeeCode: 'EMP-0008',
        companyId: 'co-eg',
        branchId: 'br-alx',
        departmentId: 'dp-sales-alx',
        teamId: 'tm-alx',
        managerId: null,
        jobTitle: null,
        status: 'ACTIVE',
        isTenantOwner: false,
        seats: [],
        createdAt: T0,
        updatedAt: T1,
      },
    ],
    deletedUserIds: new Set<string>(),
    releasedUserIds: new Set<string>(),
    neverAcceptedUserIds: new Set<string>(['u-noura']),
    memberships: [
      {
        id: 'mem-mona-ent',
        tenantUserId: 'u-mona',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: 'tm-ent',
        role: 'LEAD',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'mem-mona-smb',
        tenantUserId: 'u-mona',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: 'tm-smb',
        role: 'MANAGER',
        isPrimary: false,
        reportingScopeRevision: 1,
        explicitBranchIds: ['br-alx'],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'mem-omar-smb',
        tenantUserId: 'u-omar',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-sales-cai',
        teamId: 'tm-smb',
        role: 'LEAD',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'mem-nada-support',
        tenantUserId: 'u-nada',
        companyId: 'co-eg',
        branchId: 'br-cai',
        departmentId: 'dp-ops-cai',
        teamId: 'tm-support',
        role: 'MEMBER',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'mem-faisal-ruh',
        tenantUserId: 'u-faisal',
        companyId: 'co-sa',
        branchId: 'br-ruh',
        departmentId: 'dp-sales-ruh',
        teamId: 'tm-ruh',
        role: 'LEAD',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'mem-hany-alx',
        tenantUserId: 'u-hany',
        companyId: 'co-eg',
        branchId: 'br-alx',
        departmentId: 'dp-sales-alx',
        teamId: 'tm-alx',
        role: 'MEMBER',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: T0,
        updatedAt: T1,
      },
    ],
    modules: [
      { id: 'mod-mona-crm', userId: 'u-mona', moduleKey: 'crm', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: T1 },
      { id: 'mod-omar-crm', userId: 'u-omar', moduleKey: 'crm', createdAt: '2026-10-05T09:00:00.000Z', updatedAt: T1 },
      { id: 'mod-hany-crm', userId: 'u-hany', moduleKey: 'crm', createdAt: '2026-10-20T09:00:00.000Z', updatedAt: T1 },
      { id: 'mod-nada-crm', userId: 'u-nada', moduleKey: 'crm', createdAt: '2026-11-02T09:00:00.000Z', updatedAt: T1 },
      { id: 'mod-nada-trade', userId: 'u-nada', moduleKey: 'trade', createdAt: '2026-11-02T09:00:00.000Z', updatedAt: T1 },
    ],
    roles: [
      {
        id: 'role-super-admin',
        name: 'Tenant Super Admin',
        nameI18n: { en: 'Tenant Super Admin', ar: 'المشرف العام للمساحة' },
        description: 'Full access to workspace and tenant administration.',
        descriptionI18n: { en: 'Full access to workspace and tenant administration.', ar: 'وصول كامل لإدارة مساحة العمل والمستأجر.' },
        isSystem: true,
        permissionMode: 'GLOBAL',
        branchProfileCount: 0,
        permissionCount: allSubscribedPerms.length,
        permissionIds: [...allSubscribedPerms],
        branchRevision: 1,
        profiles: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'role-admin',
        name: 'admin',
        nameI18n: { en: 'admin', ar: 'مدير النظام' },
        description: 'Built-in administrator role.',
        descriptionI18n: { en: 'Built-in administrator role.', ar: 'دور مدير النظام المدمج.' },
        isSystem: true,
        permissionMode: 'GLOBAL',
        branchProfileCount: 0,
        permissionCount: allSubscribedPerms.length,
        permissionIds: [...allSubscribedPerms],
        branchRevision: 1,
        profiles: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'role-sales-manager',
        name: 'Sales manager',
        nameI18n: { en: 'Sales manager', ar: 'مدير مبيعات' },
        description: 'Branch-level sales management across leads, opportunities, and customer profiles.',
        descriptionI18n: {
          en: 'Branch-level sales management across leads, opportunities, and customer profiles.',
          ar: 'إدارة المبيعات على مستوى الفرع للعملاء المحتملين والفرص وملفات العملاء.',
        },
        isSystem: false,
        permissionMode: 'BRANCH',
        branchProfileCount: 2,
        permissionCount: salesManagerCai.length + salesManagerAlx.length,
        permissionIds: [],
        branchRevision: 1,
        profiles: [
          { branchId: 'br-cai', permissionIds: [...salesManagerCai] },
          { branchId: 'br-alx', permissionIds: [...salesManagerAlx] },
        ],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'role-sales-rep',
        name: 'Sales rep',
        nameI18n: { en: 'Sales rep', ar: 'مندوب مبيعات' },
        description: 'Own-record CRM lead and activity access.',
        descriptionI18n: { en: 'Own-record CRM lead and activity access.', ar: 'صلاحيات إدارة العملاء والأنشطة للسجلات الخاصة.' },
        isSystem: false,
        permissionMode: 'GLOBAL',
        branchProfileCount: 0,
        permissionCount: salesRepPerms.length,
        permissionIds: [...salesRepPerms],
        branchRevision: 1,
        profiles: [],
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: 'role-hr-viewer',
        name: 'HR viewer',
        nameI18n: { en: 'HR viewer', ar: 'مطلع موارد بشرية' },
        description: 'Read-only access to organization structure and workspace users.',
        descriptionI18n: {
          en: 'Read-only access to organization structure and workspace users.',
          ar: 'صلاحية عرض فقط للهيكل التنظيمي ومستخدمي مساحة العمل.',
        },
        isSystem: false,
        permissionMode: 'GLOBAL',
        branchProfileCount: 0,
        permissionCount: hrViewerPerms.length,
        permissionIds: [...hrViewerPerms],
        branchRevision: 1,
        profiles: [],
        createdAt: T0,
        updatedAt: T1,
      },
    ],
    branchRoles: [
      { id: 'bra-omar-cai', tenantUserId: 'u-omar', branchId: 'br-cai', roleId: 'role-sales-rep', createdAt: '2026-10-05T09:00:00.000Z', updatedAt: T1 },
      { id: 'bra-hany-alx', tenantUserId: 'u-hany', branchId: 'br-alx', roleId: 'role-sales-rep', createdAt: '2026-10-20T09:00:00.000Z', updatedAt: T1 },
      { id: 'bra-mona-cai', tenantUserId: 'u-mona', branchId: 'br-cai', roleId: 'role-sales-manager', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: T1 },
      { id: 'bra-mona-alx', tenantUserId: 'u-mona', branchId: 'br-alx', roleId: 'role-sales-manager', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: T1 },
    ],
    scopeRoles: [
      {
        id: 'sra-nada-tenant',
        tenantUserId: 'u-nada',
        roleId: 'role-admin',
        scopeTarget: 'TENANT',
        companyId: null,
        branchId: null,
        scopeActive: true,
        createdAt: '2026-11-02T09:00:00.000Z',
      },
      {
        id: 'sra-nada-old',
        tenantUserId: 'u-nada',
        roleId: 'role-sales-rep',
        scopeTarget: 'COMPANY',
        companyId: 'co-old',
        branchId: null,
        scopeActive: false,
        createdAt: T0,
      },
    ],
    currencies: [
      { code: 'EGP', name: 'Egyptian Pound', isDefault: true, status: 'ACTIVE' },
      { code: 'USD', name: 'US Dollar', isDefault: false, status: 'ACTIVE' },
      { code: 'SAR', name: 'Saudi Riyal', isDefault: false, status: 'ACTIVE' },
      { code: 'AED', name: 'UAE Dirham', isDefault: false, status: 'INACTIVE' },
    ],
    resendTimestamps: new Map<string, number[]>(),
    idempotency: new Map<string, IdempotencyRecord>(),
  };
}

let store: StoreState = createSeedState();

export function resetStaffFake(): void {
  store = createSeedState();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function checkSeatCascade(opts?: ConfirmAddonCascadeOptions): void {
  if (FAKE_SEAT_CASCADE && !opts?.confirmAddonCascade) {
    throw new ApiError(409, 'SEAT_ADDON_CASCADE_REQUIRED', {
      addons: [{ userId: 'u-nada', name: 'Nada Ibrahim', addonKey: 'crm.outbound_email' }],
    });
  }
}

export function modulesForPermissionKeys(permissionIds: readonly string[]): string[] {
  const result = new Set<string>();
  for (const key of permissionIds) {
    const lower = key.toLowerCase();
    if (lower.startsWith('crm.')) result.add('crm');
    else if (lower.startsWith('trade.') || lower.startsWith('sales.')) result.add('trade');
    else if (lower.startsWith('accounting.')) result.add('accounting');
  }
  return Array.from(result).filter((m) => SUBSCRIBED_MODULES.has(m));
}

function isAdminRoleRecord(role: Pick<StoredRole, 'id' | 'name'>): boolean {
  return role.id === 'role-admin' || role.name.toLowerCase() === 'admin';
}

function modulesForRoleOnBranch(role: StoredRole, branchId?: string | null): string[] {
  if (isAdminRoleRecord(role)) return Array.from(SUBSCRIBED_MODULES);
  if (role.permissionMode === 'GLOBAL') return modulesForPermissionKeys(role.permissionIds);
  if (branchId) {
    const profile = role.profiles.find((p) => p.branchId === branchId);
    return profile ? modulesForPermissionKeys(profile.permissionIds) : [];
  }
  const all = new Set<string>();
  for (const profile of role.profiles) {
    for (const mod of modulesForPermissionKeys(profile.permissionIds)) all.add(mod);
  }
  return Array.from(all);
}

function modulesForRoleOnScope(
  role: StoredRole,
  scope: { scopeTarget: ScopeTarget; companyId?: string | null; branchId?: string | null },
  branches: readonly Branch[] = store.branches,
  companies: readonly Company[] = store.companies,
): string[] {
  if (isAdminRoleRecord(role)) return Array.from(SUBSCRIBED_MODULES);
  if (role.permissionMode === 'GLOBAL') return modulesForPermissionKeys(role.permissionIds);
  const activeBranchSet = new Set(
    branches
      .filter((b) => b.status === 'ACTIVE' && companies.some((c) => c.id === b.companyId && c.status === 'ACTIVE'))
      .map((b) => b.id),
  );
  const all = new Set<string>();
  for (const profile of role.profiles) {
    if (!activeBranchSet.has(profile.branchId)) continue;
    const branch = branches.find((b) => b.id === profile.branchId);
    if (!branch) continue;
    const matches =
      scope.scopeTarget === 'TENANT' ||
      (scope.scopeTarget === 'COMPANY' && branch.companyId === scope.companyId) ||
      (scope.scopeTarget === 'BRANCH' && branch.id === scope.branchId);
    if (!matches) continue;
    for (const mod of modulesForPermissionKeys(profile.permissionIds)) all.add(mod);
  }
  return Array.from(all);
}

function computeUserModuleGrants(
  userId: string,
  state: {
    users: readonly TenantUser[];
    roles: readonly StoredRole[];
    branchRoles: readonly BranchRoleAssignment[];
    scopeRoles: readonly ScopeRoleAssignment[];
    companies: readonly Company[];
    branches: readonly Branch[];
    releasedUserIds?: ReadonlySet<string>;
  } = store,
): Map<string, { grantedAt: string; roles: { roleId: string; roleName: string; scope: string }[] }> {
  const result = new Map<string, { grantedAt: string; roles: { roleId: string; roleName: string; scope: string }[] }>();
  const user = state.users.find((u) => u.id === userId);
  const released = state.releasedUserIds ?? store.releasedUserIds;
  if (!user || user.isTenantOwner || user.status === 'DEACTIVATED' || released.has(userId)) {
    return result;
  }
  const activeCompanyMap = new Map(state.companies.filter((c) => c.status === 'ACTIVE').map((c) => [c.id, c]));
  const activeBranchMap = new Map(
    state.branches.filter((b) => b.status === 'ACTIVE' && activeCompanyMap.has(b.companyId)).map((b) => [b.id, b]),
  );
  const roleMap = new Map(state.roles.map((r) => [r.id, r]));

  const addGrant = (moduleKey: string, grantedAt: string, role: StoredRole, scopeLabel: string) => {
    if (!SUBSCRIBED_MODULES.has(moduleKey)) return;
    let entry = result.get(moduleKey);
    if (!entry) {
      entry = { grantedAt, roles: [] };
      result.set(moduleKey, entry);
    } else if (grantedAt.localeCompare(entry.grantedAt) < 0) {
      entry.grantedAt = grantedAt;
    }
    if (!entry.roles.some((r) => r.roleId === role.id && r.scope === scopeLabel)) {
      entry.roles.push({ roleId: role.id, roleName: role.name, scope: scopeLabel });
    }
  };

  for (const bra of state.branchRoles) {
    if (bra.tenantUserId !== userId) continue;
    const branch = activeBranchMap.get(bra.branchId);
    const role = roleMap.get(bra.roleId);
    if (!branch || !role) continue;
    for (const mod of modulesForRoleOnBranch(role, branch.id)) {
      addGrant(mod, bra.createdAt, role, branch.name);
    }
  }

  for (const sra of state.scopeRoles) {
    if (sra.tenantUserId !== userId) continue;
    const role = roleMap.get(sra.roleId);
    if (!role) continue;
    let scopeLabel = 'Workspace';
    let scopeActive = false;
    if (sra.scopeTarget === 'TENANT') {
      scopeActive = true;
    } else if (sra.scopeTarget === 'COMPANY' && sra.companyId) {
      const comp = activeCompanyMap.get(sra.companyId);
      scopeActive = Boolean(comp);
      scopeLabel = comp?.name ?? sra.companyId;
    } else if (sra.scopeTarget === 'BRANCH' && sra.branchId) {
      const br = activeBranchMap.get(sra.branchId);
      scopeActive = Boolean(br);
      scopeLabel = br?.name ?? sra.branchId;
    }
    if (!scopeActive) continue;
    for (const mod of modulesForRoleOnScope(role, sra, state.branches, state.companies)) {
      addGrant(mod, sra.createdAt, role, scopeLabel);
    }
  }

  return result;
}

export interface StaffSeatHolderSnapshot {
  userId: string;
  name: string;
  email: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  moduleKey: string;
  grantedAt: string;
  roles: { roleId: string; roleName: string; scope: string }[];
}

export interface StaffSeatSourceSnapshot {
  users: {
    userId: string;
    name: string;
    email: string;
    status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
    isTenantOwner: boolean;
  }[];
  holders: StaffSeatHolderSnapshot[];
}

export function getStaffSeatSource(): StaffSeatSourceSnapshot {
  const users: StaffSeatSourceSnapshot['users'] = [];
  const holders: StaffSeatHolderSnapshot[] = [];
  for (const user of liveUsers()) {
    const status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' =
      user.status === 'INVITED' || user.status === 'SUSPENDED' ? user.status : 'ACTIVE';
    const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
    users.push({
      userId: user.id,
      name,
      email: user.email,
      status,
      isTenantOwner: user.isTenantOwner,
    });
    const grants = computeUserModuleGrants(user.id);
    for (const [moduleKey, info] of grants.entries()) {
      holders.push({
        userId: user.id,
        name,
        email: user.email,
        status,
        moduleKey,
        grantedAt: info.grantedAt,
        roles: info.roles,
      });
    }
  }
  return { users, holders };
}

export function releaseUserSeatsInStaffFake(userId: string): void {
  store.releasedUserIds.add(userId);
  store.modules = store.modules.filter((m) => m.userId !== userId);
  store.branchRoles = store.branchRoles.filter((bra) => {
    if (bra.tenantUserId !== userId) return true;
    const role = store.roles.find((r) => r.id === bra.roleId);
    return !role || modulesForRoleOnBranch(role, bra.branchId).length === 0;
  });
  store.scopeRoles = store.scopeRoles.filter((sra) => {
    if (sra.tenantUserId !== userId) return true;
    const role = store.roles.find((r) => r.id === sra.roleId);
    return !role || modulesForRoleOnScope(role, sra).length === 0;
  });
}

export function removeUserModuleRolesInStaffFake(userId: string, moduleKey: string): void {
  store.modules = store.modules.filter((m) => !(m.userId === userId && m.moduleKey === moduleKey));
  store.branchRoles = store.branchRoles.filter((bra) => {
    if (bra.tenantUserId !== userId) return true;
    const role = store.roles.find((r) => r.id === bra.roleId);
    return !role || !modulesForRoleOnBranch(role, bra.branchId).includes(moduleKey);
  });
  store.scopeRoles = store.scopeRoles.filter((sra) => {
    if (sra.tenantUserId !== userId) return true;
    const role = store.roles.find((r) => r.id === sra.roleId);
    return !role || !modulesForRoleOnScope(role, sra).includes(moduleKey);
  });
}

export function applyBulkRoleInStaffFake(body: {
  roleId: string;
  scope: { target: ScopeTarget; companyId?: string; branchId?: string };
  userIds: string[];
}): void {
  const now = nowIso();
  for (const userId of body.userIds) {
    const user = liveUsers().find((u) => u.id === userId);
    if (!user || user.isTenantOwner || user.status !== 'ACTIVE') continue;
    store.releasedUserIds.delete(userId);
    if (body.scope.target === 'BRANCH' && body.scope.branchId) {
      const exists = store.branchRoles.some(
        (b) => b.tenantUserId === userId && b.branchId === body.scope.branchId && b.roleId === body.roleId,
      );
      if (!exists) {
        store.branchRoles.push({
          id: `bra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          branchId: body.scope.branchId,
          roleId: body.roleId,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      const compId = body.scope.target === 'COMPANY' ? (body.scope.companyId ?? null) : null;
      const exists = store.scopeRoles.some(
        (s) =>
          s.tenantUserId === userId &&
          s.scopeTarget === body.scope.target &&
          s.companyId === compId &&
          s.branchId === null &&
          s.roleId === body.roleId,
      );
      if (!exists) {
        store.scopeRoles.push({
          id: `sra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          roleId: body.roleId,
          scopeTarget: body.scope.target,
          companyId: compId,
          branchId: null,
          scopeActive: true,
          createdAt: now,
        });
      }
    }
  }
  syncScopeRolesActiveState();
}

export function resolveStaffRoleRef(roleRef: string): { id: string; name: string; modules: string[] } | null {
  const norm = roleRef.trim().toLowerCase();
  const role = store.roles.find(
    (r) =>
      r.id.toLowerCase() === norm ||
      r.name.toLowerCase() === norm ||
      r.nameI18n.en.toLowerCase() === norm ||
      r.nameI18n.ar.toLowerCase() === norm,
  );
  if (!role) return null;
  return { id: role.id, name: role.name, modules: modulesForRoleOnBranch(role) };
}

export function applyImportUsersInStaffFake(
  entries: readonly {
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    roleRefs?: readonly string[];
    roleAssignments?: readonly { branchId: string; roleId: string }[];
  }[],
): void {
  const activeCompany = store.companies.find((c) => c.status === 'ACTIVE');
  const activeBranch =
    store.branches.find((b) => b.status === 'ACTIVE' && b.companyId === activeCompany?.id) ??
    store.branches.find((b) => b.status === 'ACTIVE');
  const activeDept = store.departments.find(
    (d) => d.status === 'ACTIVE' && d.branchId === (activeBranch?.id ?? ''),
  );
  if (!activeCompany || !activeBranch || !activeDept) return;

  const now = nowIso();
  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase();
    if (!email || liveUsers().some((u) => u.email.toLowerCase() === email)) continue;
    const rawName = (entry.name ?? '').trim();
    const parts = rawName ? rawName.split(/\s+/) : [];
    const firstName = (entry.firstName ?? parts[0] ?? email.split('@')[0] ?? 'User').trim() || 'User';
    const lastName = (entry.lastName ?? (parts.slice(1).join(' ') || 'Member')).trim() || 'Member';
    const userId = `u-${fakeId().slice(-8)}`;
    store.users.push({
      id: userId,
      email,
      firstName,
      lastName,
      employeeCode: null,
      companyId: activeCompany.id,
      branchId: activeBranch.id,
      departmentId: activeDept.id,
      teamId: null,
      managerId: null,
      jobTitle: null,
      status: 'INVITED',
      isTenantOwner: false,
      seats: [],
      createdAt: now,
      updatedAt: now,
    });
    store.neverAcceptedUserIds.add(userId);

    for (const ra of entry.roleAssignments ?? []) {
      const role = store.roles.find((r) => r.id === ra.roleId);
      const branch = store.branches.find((b) => b.id === ra.branchId && b.status === 'ACTIVE');
      if (!role || !branch || role.name === 'Tenant Super Admin') continue;
      if (!store.branchRoles.some((b) => b.tenantUserId === userId && b.branchId === branch.id && b.roleId === role.id)) {
        store.branchRoles.push({
          id: `bra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          branchId: branch.id,
          roleId: role.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const ref of entry.roleRefs ?? []) {
      const resolved = resolveStaffRoleRef(ref);
      const role = resolved ? store.roles.find((r) => r.id === resolved.id) : undefined;
      if (!role || role.name === 'Tenant Super Admin') continue;
      const targetBranch =
        role.permissionMode === 'BRANCH'
          ? store.branches.find(
              (b) => b.status === 'ACTIVE' && role.profiles.some((p) => p.branchId === b.id),
            )
          : activeBranch;
      if (!targetBranch) continue;
      if (
        !store.branchRoles.some(
          (b) => b.tenantUserId === userId && b.branchId === targetBranch.id && b.roleId === role.id,
        )
      ) {
        store.branchRoles.push({
          id: `bra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          branchId: targetBranch.id,
          roleId: role.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
}

export type StaffSeatChangeInput =
  | { kind: 'ADD_BRANCH_ROLES'; userId: string; items: { branchId: string; roleId: string }[] }
  | { kind: 'REMOVE_BRANCH_ROLE'; userId: string; assignmentId: string }
  | { kind: 'SET_SCOPE_ROLES'; userId: string; assignments: unknown[] }
  | { kind: 'SET_ROLE_PERMISSIONS'; roleId: string; permissionIds: string[] }
  | { kind: 'SET_ROLE_BRANCH_PROFILES'; roleId: string; profiles: { branchId: string; permissionIds: string[] }[] }
  | { kind: 'DELETE_ROLE'; roleId: string }
  | { kind: 'USER_STATUS'; userId: string; status: string }
  | { kind: 'ORG_STATUS'; branchId?: string; companyId?: string; status: 'ACTIVE' | 'INACTIVE' }
  | {
      kind: 'BULK_ROLE';
      roleId: string;
      scope: { target: 'TENANT' | 'COMPANY' | 'BRANCH'; companyId?: string; branchId?: string };
      userIds: string[];
    }
  | { kind: 'IMPORT'; rows: unknown[] };

export function computeStaffSeatPreviewDeltas(
  changes: readonly StaffSeatChangeInput[],
): Map<string, { gaining: Map<string, string>; losing: Map<string, string> }> {
  const drafts = new Map<string, { gaining: Map<string, string>; losing: Map<string, string> }>();
  const ensure = (moduleKey: string) => {
    let entry = drafts.get(moduleKey);
    if (!entry) {
      entry = { gaining: new Map<string, string>(), losing: new Map<string, string>() };
      drafts.set(moduleKey, entry);
    }
    return entry;
  };

  const currentUsers = liveUsers();
  const baseGrantsByUser = new Map<string, Set<string>>();
  for (const user of currentUsers) {
    baseGrantsByUser.set(user.id, new Set(computeUserModuleGrants(user.id).keys()));
  }

  const simUsers = clone(currentUsers);
  const simRoles = clone(store.roles);
  let simBranchRoles = clone(store.branchRoles);
  let simScopeRoles = clone(store.scopeRoles);
  const simCompanies = clone(store.companies);
  const simBranches = clone(store.branches);
  const simReleased = new Set(store.releasedUserIds);

  const syntheticGains: { moduleKey: string; userId: string; name: string }[] = [];

  for (const change of changes) {
    switch (change.kind) {
      case 'ADD_BRANCH_ROLES': {
        for (const item of change.items) {
          const exists = simBranchRoles.some(
            (b) => b.tenantUserId === change.userId && b.branchId === item.branchId && b.roleId === item.roleId,
          );
          if (!exists) {
            simBranchRoles.push({
              id: `sim-bra-${item.branchId}-${item.roleId}`,
              tenantUserId: change.userId,
              branchId: item.branchId,
              roleId: item.roleId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            });
          }
        }
        if (!simUsers.some((u) => u.id === change.userId)) {
          for (const item of change.items) {
            const role = simRoles.find((r) => r.id === item.roleId);
            if (!role) continue;
            for (const mod of modulesForRoleOnBranch(role, item.branchId)) {
              syntheticGains.push({ moduleKey: mod, userId: change.userId, name: change.userId });
            }
          }
        }
        break;
      }
      case 'REMOVE_BRANCH_ROLE': {
        simBranchRoles = simBranchRoles.filter(
          (b) => !(b.tenantUserId === change.userId && (b.id === change.assignmentId || b.roleId === change.assignmentId)),
        );
        break;
      }
      case 'SET_SCOPE_ROLES': {
        const nextForUser: ScopeRoleAssignment[] = [];
        for (const raw of change.assignments) {
          if (!raw || typeof raw !== 'object') continue;
          const rec = raw as Record<string, unknown>;
          const scopeTarget = rec['scopeTarget'];
          const roleId = typeof rec['roleId'] === 'string' ? rec['roleId'] : '';
          if (
            (scopeTarget === 'TENANT' || scopeTarget === 'COMPANY' || scopeTarget === 'BRANCH') &&
            roleId
          ) {
            nextForUser.push({
              id: `sim-sra-${roleId}`,
              tenantUserId: change.userId,
              roleId,
              scopeTarget,
              companyId: typeof rec['companyId'] === 'string' ? rec['companyId'] : null,
              branchId: typeof rec['branchId'] === 'string' ? rec['branchId'] : null,
              scopeActive: true,
              createdAt: nowIso(),
            });
          }
        }
        simScopeRoles = [...simScopeRoles.filter((s) => s.tenantUserId !== change.userId), ...nextForUser];
        break;
      }
      case 'SET_ROLE_PERMISSIONS': {
        const role = simRoles.find((r) => r.id === change.roleId);
        if (role) {
          role.permissionMode = 'GLOBAL';
          role.permissionIds = [...change.permissionIds];
        }
        break;
      }
      case 'SET_ROLE_BRANCH_PROFILES': {
        const role = simRoles.find((r) => r.id === change.roleId);
        if (role) {
          role.permissionMode = 'BRANCH';
          role.permissionIds = [];
          role.profiles = change.profiles.map((p) => ({
            branchId: p.branchId,
            permissionIds: [...p.permissionIds],
          }));
        }
        break;
      }
      case 'DELETE_ROLE': {
        simBranchRoles = simBranchRoles.filter((b) => b.roleId !== change.roleId);
        simScopeRoles = simScopeRoles.filter((s) => s.roleId !== change.roleId);
        break;
      }
      case 'USER_STATUS': {
        const user = simUsers.find((u) => u.id === change.userId);
        if (user) {
          if (change.status === 'RELEASED') {
            simReleased.add(user.id);
          } else if (change.status === 'DEACTIVATED' || change.status === 'INACTIVE') {
            user.status = 'DEACTIVATED';
          } else if (change.status === 'ACTIVE' || change.status === 'SUSPENDED' || change.status === 'INVITED') {
            simReleased.delete(user.id);
            user.status = change.status;
          }
        }
        break;
      }
      case 'ORG_STATUS': {
        if (change.branchId) {
          const br = simBranches.find((b) => b.id === change.branchId);
          if (br) br.status = change.status;
        } else if (change.companyId) {
          const comp = simCompanies.find((c) => c.id === change.companyId);
          if (comp) comp.status = change.status;
        }
        break;
      }
      case 'BULK_ROLE': {
        const role = simRoles.find((r) => r.id === change.roleId);
        if (!role) break;
        for (const uid of change.userIds) {
          const targetUser = simUsers.find((u) => u.id === uid);
          if (!targetUser || targetUser.isTenantOwner) continue;
          if (change.scope.target === 'BRANCH' && change.scope.branchId) {
            if (!simBranchRoles.some((b) => b.tenantUserId === uid && b.branchId === change.scope.branchId && b.roleId === role.id)) {
              simBranchRoles.push({
                id: `sim-bulk-${uid}`,
                tenantUserId: uid,
                branchId: change.scope.branchId,
                roleId: role.id,
                createdAt: nowIso(),
                updatedAt: nowIso(),
              });
            }
          } else {
            simScopeRoles.push({
              id: `sim-bulk-${uid}`,
              tenantUserId: uid,
              roleId: role.id,
              scopeTarget: change.scope.target,
              companyId: change.scope.target === 'COMPANY' ? (change.scope.companyId ?? null) : null,
              branchId: null,
              scopeActive: true,
              createdAt: nowIso(),
            });
          }
        }
        break;
      }
      case 'IMPORT': {
        change.rows.forEach((rawRow, idx) => {
          const row = (rawRow && typeof rawRow === 'object' ? rawRow : {}) as Record<string, unknown>;
          const email = typeof row['email'] === 'string' ? row['email'].trim() : '';
          if (email.toLowerCase().endsWith('@bad.example.com')) return;
          const rowName = (typeof row['name'] === 'string' && row['name'].trim()) || email || `Row ${idx + 1}`;
          const rowId = (typeof row['userId'] === 'string' && row['userId'].trim()) || `import-${idx + 1}`;
          const roleAssignments = Array.isArray(row['roleAssignments']) ? row['roleAssignments'] : [];
          for (const ra of roleAssignments) {
            if (!ra || typeof ra !== 'object') continue;
            const rec = ra as Record<string, unknown>;
            const roleId = typeof rec['roleId'] === 'string' ? rec['roleId'] : '';
            const branchId = typeof rec['branchId'] === 'string' ? rec['branchId'] : '';
            const role = simRoles.find((r) => r.id === roleId);
            if (!role) continue;
            for (const mod of modulesForRoleOnBranch(role, branchId || null)) {
              syntheticGains.push({ moduleKey: mod, userId: rowId, name: rowName });
            }
          }
          if (roleAssignments.length === 0) {
            const roleName = typeof row['roleName'] === 'string' ? row['roleName'] : '';
            const resolved = roleName ? resolveStaffRoleRef(roleName) : null;
            if (resolved) {
              for (const mod of resolved.modules) {
                syntheticGains.push({ moduleKey: mod, userId: rowId, name: rowName });
              }
            }
          }
        });
        break;
      }
    }
  }

  for (const user of simUsers) {
    const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
    const before = baseGrantsByUser.get(user.id) ?? new Set<string>();
    const after = new Set(
      computeUserModuleGrants(user.id, {
        users: simUsers,
        roles: simRoles,
        branchRoles: simBranchRoles,
        scopeRoles: simScopeRoles,
        companies: simCompanies,
        branches: simBranches,
        releasedUserIds: simReleased,
      }).keys(),
    );
    for (const mod of after) {
      if (!before.has(mod)) {
        ensure(mod).gaining.set(user.id, name);
      }
    }
    for (const mod of before) {
      if (!after.has(mod)) {
        ensure(mod).losing.set(user.id, name);
      }
    }
  }

  for (const gain of syntheticGains) {
    if (gain.userId === 'u-owner' || !SUBSCRIBED_MODULES.has(gain.moduleKey)) continue;
    ensure(gain.moduleKey).gaining.set(gain.userId, gain.name);
  }

  return drafts;
}

function deriveUserSeats(userId: string): { moduleKey: string; accessState: 'ACTIVE' | 'OVER_CAPACITY' }[] {
  if (seatsOverlay?.isDerivedMode()) {
    return seatsOverlay.getUserSeats(userId).map((s) => ({
      moduleKey: s.moduleKey,
      accessState: s.accessState,
    }));
  }
  const overCapacity = FAKE_OVER_CAPACITY || Boolean(seatsOverlay?.isOverCapacity());
  if (seatsOverlay) {
    return seatsOverlay.getUserSeats(userId).map((s) => ({
      moduleKey: s.moduleKey,
      accessState: s.accessState,
    }));
  }
  const grants = computeUserModuleGrants(userId);
  const seats = Array.from(grants.keys()).map((moduleKey) => ({
    moduleKey,
    accessState: (overCapacity && userId === 'u-nada' && moduleKey === 'crm'
      ? 'OVER_CAPACITY'
      : 'ACTIVE') as 'ACTIVE' | 'OVER_CAPACITY',
  }));
  return seats;
}

function hydrateUser(user: TenantUser): TenantUser {
  return {
    ...user,
    seats: deriveUserSeats(user.id),
  };
}

export function fakeClearUserModulesSync(userId: string): void {
  releaseUserSeatsInStaffFake(userId);
}

function liveUsers(): TenantUser[] {
  return store.users.filter((u) => !store.deletedUserIds.has(u.id));
}

function buildBranchScopeForActor(keys: readonly string[], companyIds: string[], branchIds: string[]) {
  const scopes: Me['permissionScopes'] = {};
  for (const k of keys) {
    scopes[k] = { tenantWide: false, companyIds: [...companyIds], branchIds: [...branchIds] };
  }
  return scopes;
}

export function buildActorMeSync(actor: FakeActor = FAKE_ACTOR): Me {
  if (actor === 'owner') {
    const permissions = [...CORE_KEYS, ...CRM_KEYS];
    const permissionScopes: Me['permissionScopes'] = {};
    for (const key of permissions) {
      permissionScopes[key] = { tenantWide: true, companyIds: [], branchIds: [] };
    }
    return {
      id: 'u-owner',
      firstName: 'Kamal',
      lastName: 'Radwan',
      isTenantOwner: true,
      permissions,
      permissionScopes,
    };
  }

  if (actor === 'tenantAdmin') {
    const permissions = [...CORE_KEYS];
    const permissionScopes: Me['permissionScopes'] = {};
    for (const key of permissions) {
      permissionScopes[key] = { tenantWide: true, companyIds: [], branchIds: [] };
    }
    return {
      id: 'u-nada',
      firstName: 'Nada',
      lastName: 'Ibrahim',
      isTenantOwner: false,
      permissions,
      permissionScopes,
    };
  }

  const branchKeys = [
    'org.company.read',
    'org.branch.read',
    'org.department.read',
    'org.team.read',
    'org.branch.manage',
    'org.department.manage',
    'org.team.manage',
    ...CORE_KEYS.filter((k) => k.startsWith('users.user.') && k !== 'users.user.manage_modules'),
    'roles.role.read',
    'roles.permission.read',
  ];
  const permissionScopes = buildBranchScopeForActor(branchKeys, ['co-eg'], ['br-cai', 'br-alx']);
  permissionScopes['roles.role.read'] = { tenantWide: false, companyIds: [], branchIds: ['br-cai', 'br-alx'] };
  permissionScopes['roles.permission.read'] = { tenantWide: false, companyIds: [], branchIds: ['br-cai', 'br-alx'] };

  return {
    id: 'u-mona',
    firstName: 'Mona',
    lastName: 'El-Sayed',
    isTenantOwner: false,
    permissions: branchKeys,
    permissionScopes,
  };
}

export type StaffFixtureReadScope = (scope: TenantResourceScope) => boolean;

function actorCan(permission: string, scope?: TenantResourceScope): boolean {
  const me = buildActorMeSync();
  if (me.isTenantOwner) return true;
  const entry = me.permissionScopes[permission];
  if (!entry) return false;
  if (entry.tenantWide) return true;
  if (!scope || (!scope.branchId && !scope.companyId)) {
    return entry.branchIds.length > 0 || entry.companyIds.length > 0 || me.permissions.includes(permission);
  }
  if (scope.branchId) {
    return entry.branchIds.includes(scope.branchId);
  }
  if (scope.companyId) {
    return entry.companyIds.includes(scope.companyId);
  }
  return false;
}

function actorIsTenantWide(permission: string): boolean {
  const me = buildActorMeSync();
  if (me.isTenantOwner) return true;
  return Boolean(me.permissionScopes[permission]?.tenantWide);
}

function requireTenantWide(permission: string): void {
  if (!actorIsTenantWide(permission)) {
    throw new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED');
  }
}

function requireCompanyPermission(permission: string, companyId: string): void {
  if (actorIsTenantWide(permission)) return;
  const me = buildActorMeSync();
  const entry = me.permissionScopes[permission];
  if (!entry || !entry.companyIds.includes(companyId)) {
    throw new ApiError(403, 'COMPANY_PERMISSION_DENIED');
  }
}

function requireBranchPermission(permission: string, branchId: string, code: 'BRANCH_PERMISSION_DENIED' | 'BRANCH_ACCESS_DENIED' = 'BRANCH_PERMISSION_DENIED'): void {
  if (actorIsTenantWide(permission)) return;
  const me = buildActorMeSync();
  const entry = me.permissionScopes[permission];
  if (!entry || !entry.branchIds.includes(branchId)) {
    throw new ApiError(403, code);
  }
}

function checkIdempotency<T>(op: string, key: string, body: unknown, execute: () => T): T {
  if (!key) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7_PATTERN.test(key)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  const cacheKey = `${op}:${key}`;
  const bodyHash = JSON.stringify(body ?? null);
  const existing = store.idempotency.get(cacheKey);
  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result) as T;
  }
  const result = execute();
  store.idempotency.set(cacheKey, { op, bodyHash, result: clone(result) });
  return clone(result);
}

function paginate<T>(items: T[], q: ListQuery = {}): CorePage<T> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(STAFF_LIMITS.pageSize, Math.max(1, q.limit ?? 20));
  return clone(toCorePage(items, page, limit));
}

function sortItems<T>(items: T[], sortBy: string | undefined, sortDir: 'ASC' | 'DESC' | undefined, getters: Record<string, (item: T) => string>): T[] {
  if (!sortBy || !getters[sortBy]) return [...items];
  const getter = getters[sortBy];
  const dir = sortDir === 'DESC' ? -1 : 1;
  return [...items].sort((a, b) => getter(a).localeCompare(getter(b), 'en', { sensitivity: 'base' }) * dir);
}

function findBranchCompanyId(branchId: string): string | null {
  return store.branches.find((b) => b.id === branchId)?.companyId ?? null;
}

function findDepartmentBranchId(departmentId: string): string | null {
  return store.departments.find((d) => d.id === departmentId)?.branchId ?? null;
}

function actorHeldPermissionsOnBranch(branchId: string): Set<string> | null {
  const me = buildActorMeSync();
  if (me.isTenantOwner) return null; // null = unrestricted (all permissions)
  const held = new Set<string>();
  const companyId = findBranchCompanyId(branchId);
  for (const [key, scope] of Object.entries(me.permissionScopes)) {
    if (
      scope.tenantWide ||
      scope.branchIds.includes(branchId) ||
      (companyId !== null && scope.companyIds.includes(companyId))
    ) {
      held.add(key);
    }
  }
  for (const bra of store.branchRoles) {
    if (bra.tenantUserId === me.id && bra.branchId === branchId) {
      const role = store.roles.find((r) => r.id === bra.roleId);
      if (!role) continue;
      if (role.permissionMode === 'GLOBAL') {
        role.permissionIds.forEach((id) => held.add(id));
      } else {
        const profile = role.profiles.find((p) => p.branchId === branchId);
        profile?.permissionIds.forEach((id) => held.add(id));
      }
    }
  }
  for (const sra of store.scopeRoles) {
    if (sra.tenantUserId !== me.id || !sra.scopeActive) continue;
    const applies =
      sra.scopeTarget === 'TENANT' ||
      (sra.scopeTarget === 'COMPANY' && sra.companyId === companyId) ||
      (sra.scopeTarget === 'BRANCH' && sra.branchId === branchId);
    if (!applies) continue;
    const role = store.roles.find((r) => r.id === sra.roleId);
    if (!role) continue;
    if (role.permissionMode === 'GLOBAL') {
      role.permissionIds.forEach((id) => held.add(id));
    } else {
      const profile = role.profiles.find((p) => p.branchId === branchId);
      profile?.permissionIds.forEach((id) => held.add(id));
    }
  }
  return held;
}

function checkBranchPrivilegeEscalation(role: StoredRole, branchId: string): void {
  const held = actorHeldPermissionsOnBranch(branchId);
  if (held === null) return;
  const requiredIds =
    role.permissionMode === 'GLOBAL'
      ? role.permissionIds
      : (role.profiles.find((p) => p.branchId === branchId)?.permissionIds ?? []);
  for (const pid of requiredIds) {
    if (!held.has(pid)) {
      throw new ApiError(403, 'ROLE_PRIVILEGE_ESCALATION');
    }
  }
}

function roleDetailFromStored(r: StoredRole): RoleDetail {
  return {
    id: r.id,
    name: r.name,
    nameI18n: { ...r.nameI18n },
    description: r.description,
    ...(r.descriptionI18n ? { descriptionI18n: { ...r.descriptionI18n } } : {}),
    isSystem: r.isSystem,
    permissionMode: r.permissionMode,
    branchProfileCount: r.branchProfileCount,
    permissionCount: r.permissionCount,
    permissionIds: r.permissionMode === 'GLOBAL' ? [...r.permissionIds] : [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function roleSummaryFromStored(r: StoredRole): Role {
  return {
    id: r.id,
    name: r.name,
    nameI18n: { ...r.nameI18n },
    description: r.description,
    ...(r.descriptionI18n ? { descriptionI18n: { ...r.descriptionI18n } } : {}),
    isSystem: r.isSystem,
    permissionMode: r.permissionMode,
    branchProfileCount: r.branchProfileCount,
    permissionCount: r.permissionCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function computeHoldersCount(roleId: string): number {
  const liveSet = new Set(liveUsers().map((u) => u.id));
  const holders = new Set<string>();
  for (const bra of store.branchRoles) {
    if (bra.roleId === roleId && liveSet.has(bra.tenantUserId)) {
      holders.add(bra.tenantUserId);
    }
  }
  for (const sra of store.scopeRoles) {
    if (sra.roleId === roleId && liveSet.has(sra.tenantUserId)) {
      holders.add(sra.tenantUserId);
    }
  }
  return holders.size;
}

function syncScopeRolesActiveState(): void {
  for (const sra of store.scopeRoles) {
    if (sra.scopeTarget === 'TENANT') {
      sra.scopeActive = true;
    } else if (sra.scopeTarget === 'COMPANY') {
      const comp = store.companies.find((c) => c.id === sra.companyId);
      sra.scopeActive = comp?.status === 'ACTIVE';
    } else if (sra.scopeTarget === 'BRANCH') {
      const br = store.branches.find((b) => b.id === sra.branchId);
      const comp = br ? store.companies.find((c) => c.id === br.companyId) : undefined;
      sra.scopeActive = br?.status === 'ACTIVE' && comp?.status === 'ACTIVE';
    }
  }
}

function computeCrmSeatPreview(roleHolders: Set<string>, grantsCrm: boolean): SeatImpact[] {
  if (!FAKE_SEAT_IMPACT || !grantsCrm) return [];
  const crmAssigned = new Set(store.modules.filter((m) => m.moduleKey === 'crm').map((m) => m.userId));
  let seatsNeeded = 0;
  for (const uid of roleHolders) {
    if (!crmAssigned.has(uid)) seatsNeeded++;
  }
  const seatsFree = Math.max(0, (FAKE_SEATS['crm'] ?? 0) - crmAssigned.size);
  return [
    {
      moduleKey: 'crm',
      moduleName: { en: 'CRM', ar: 'إدارة العملاء' },
      holdersAffected: roleHolders.size,
      seatsNeeded,
      seatsFree,
    },
  ];
}

// =========================================================================
// AUTH / ME
// =========================================================================

export async function fakeGetMe(): Promise<Me> {
  await fakeDelay();
  return clone(buildActorMeSync());
}

// =========================================================================
// ORG TREE
// =========================================================================

export async function fakeGetOrgTree(): Promise<OrgTreeNode[]> {
  await fakeDelay();
  if (FAKE_TREE_TOO_LARGE) {
    // organization.service bounds: { nodeKind: [companies | branches | ...], limit: [decimal string] }.
    throw new ApiError(422, 'ORG_TREE_TOO_LARGE', { nodeKind: ['companies'], limit: ['5000'] });
  }
  const companies = store.companies.filter((c) => actorCan('org.company.read', { companyId: c.id }));
  const tree: OrgTreeNode[] = companies.map((c) => {
    const canReadBranches = actorCan('org.branch.read', { companyId: c.id });
    const branches = canReadBranches
      ? store.branches.filter((b) => b.companyId === c.id && actorCan('org.branch.read', { companyId: c.id, branchId: b.id }))
      : [];
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      children: branches.map((b) => {
        const canReadDepts = actorCan('org.department.read', { branchId: b.id });
        const depts = canReadDepts ? store.departments.filter((d) => d.branchId === b.id) : [];
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          status: b.status,
          children: depts.map((d) => {
            const canReadTeams = actorCan('org.team.read', { branchId: b.id });
            const teams = canReadTeams ? store.teams.filter((t) => t.departmentId === d.id) : [];
            return {
              id: d.id,
              code: d.code,
              name: d.name,
              status: d.status,
              children: teams.map((t) => ({
                id: t.id,
                code: t.code,
                name: t.name,
                status: t.status,
                children: [],
              })),
            };
          }),
        };
      }),
    };
  });
  return clone(tree);
}

// =========================================================================
// COMPANIES
// =========================================================================

export async function fakeListCompanies(
  q: ListQuery = {},
  canRead: StaffFixtureReadScope = (scope) => actorCan('org.company.read', scope),
): Promise<CorePage<Company>> {
  await fakeDelay();
  let items = store.companies.filter((c) => canRead({ companyId: c.id }));
  if (q.status) {
    items = items.filter((c) => c.status === q.status);
  }
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.legalName?.toLowerCase().includes(term) ?? false),
    );
  }
  items = sortItems(items, q.sortBy ?? 'name', q.sortDir ?? 'ASC', {
    name: (c) => c.name,
    code: (c) => c.code,
    createdAt: (c) => c.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetCompany(id: string): Promise<Company> {
  await fakeDelay();
  const comp = store.companies.find((c) => c.id === id);
  if (!comp) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  if (!actorCan('org.company.read', { companyId: comp.id })) {
    throw new ApiError(403, 'COMPANY_PERMISSION_DENIED');
  }
  return clone(comp);
}

export async function fakeCreateCompany(
  b: { code: string; name: string; legalName?: string | null; taxNumber?: string | null; currencyCode?: string | null },
  key: string,
): Promise<Company> {
  await fakeDelay();
  requireTenantWide('org.company.manage');
  return checkIdempotency('createCompany', key, b, () => {
    const code = b.code.trim().toUpperCase();
    const name = b.name.trim();
    if (!CODE_PATTERN.test(code) || !name) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (store.companies.some((c) => c.code.toUpperCase() === code)) {
      throw new ApiError(409, 'ORG_CODE_TAKEN');
    }
    if (b.currencyCode) {
      const cur = store.currencies.find((c) => c.code === b.currencyCode);
      if (!cur || cur.status !== 'ACTIVE') {
        throw new ApiError(422, 'CURRENCY_NOT_ENABLED');
      }
    }
    const now = nowIso();
    const created: Company = {
      id: `co-${fakeId().slice(-8)}`,
      code,
      name,
      legalName: b.legalName?.trim() || null,
      taxNumber: b.taxNumber?.trim() || null,
      countryCode: null,
      currencyCode: b.currencyCode || null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    store.companies.push(created);
    return created;
  });
}

export async function fakeUpdateCompany(
  id: string,
  patch: Partial<Pick<Company, 'name' | 'legalName' | 'taxNumber' | 'currencyCode' | 'status'>>,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<Company> {
  await fakeDelay();
  requireTenantWide('org.company.manage');
  return checkIdempotency(`updateCompany:${id}`, key, patch, () => {
    const comp = store.companies.find((c) => c.id === id);
    if (!comp) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');

    if (patch.currencyCode !== undefined && patch.currencyCode !== null) {
      const cur = store.currencies.find((c) => c.code === patch.currencyCode);
      if (!cur || cur.status !== 'ACTIVE') {
        throw new ApiError(422, 'CURRENCY_NOT_ENABLED');
      }
    }

    if (patch.status === 'INACTIVE' && comp.status === 'ACTIVE') {
      const blockers: string[] = [];
      if (store.branches.some((b) => b.companyId === id && b.status === 'ACTIVE')) {
        blockers.push('company has active branches');
      }
      if (liveUsers().some((u) => u.companyId === id)) {
        blockers.push('company has placed users');
      }
      if (store.memberships.some((m) => m.companyId === id)) {
        blockers.push('company has team memberships');
      }
      if (blockers.length > 0) {
        throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
      }
    }

    checkSeatCascade(opts);

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      comp.name = trimmed;
    }
    if (patch.legalName !== undefined) comp.legalName = patch.legalName?.trim() || null;
    if (patch.taxNumber !== undefined) comp.taxNumber = patch.taxNumber?.trim() || null;
    if (patch.currencyCode !== undefined) comp.currencyCode = patch.currencyCode || null;
    if (patch.status !== undefined) comp.status = patch.status;
    comp.updatedAt = nowIso();
    syncScopeRolesActiveState();
    return comp;
  });
}

export async function fakeDeleteCompany(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  await fakeDelay();
  requireTenantWide('org.company.manage');
  checkIdempotency(`deleteCompany:${id}`, key, { id }, () => {
    const idx = store.companies.findIndex((c) => c.id === id);
    if (idx === -1) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');

    const blockers: string[] = [];
    if (store.branches.some((b) => b.companyId === id)) {
      blockers.push('company has branches');
    }
    if (liveUsers().some((u) => u.companyId === id)) {
      blockers.push('company has placed users');
    }
    if (store.memberships.some((m) => m.companyId === id)) {
      blockers.push('company has team memberships');
    }
    if (blockers.length > 0) {
      throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
    }
    checkSeatCascade(opts);
    store.companies.splice(idx, 1);
    syncScopeRolesActiveState();
  });
}

// =========================================================================
// BRANCHES
// =========================================================================

export async function fakeListBranches(
  q: ListQuery = {},
  canRead: StaffFixtureReadScope = (scope) => actorCan('org.branch.read', scope),
): Promise<CorePage<Branch>> {
  await fakeDelay();
  let items = store.branches.filter((b) => canRead({ companyId: b.companyId, branchId: b.id }));
  if (q.companyId) items = items.filter((b) => b.companyId === q.companyId);
  if (q.status) items = items.filter((b) => b.status === q.status);
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter((b) => b.name.toLowerCase().includes(term) || b.code.toLowerCase().includes(term));
  }
  items = sortItems(items, q.sortBy ?? 'name', q.sortDir ?? 'ASC', {
    name: (b) => b.name,
    code: (b) => b.code,
    createdAt: (b) => b.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetBranch(id: string): Promise<Branch> {
  await fakeDelay();
  const branch = store.branches.find((b) => b.id === id);
  if (!branch) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  if (!actorCan('org.branch.read', { companyId: branch.companyId, branchId: branch.id })) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
  return clone(branch);
}

export async function fakeCreateBranch(
  b: { companyId: string; code: string; name: string; address?: string | null; phone?: string | null; isHeadquarters?: boolean },
  key: string,
): Promise<Branch> {
  await fakeDelay();
  const company = store.companies.find((c) => c.id === b.companyId);
  if (!company) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireCompanyPermission('org.branch.manage', b.companyId);

  return checkIdempotency('createBranch', key, b, () => {
    if (company.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    const code = b.code.trim().toUpperCase();
    const name = b.name.trim();
    if (!CODE_PATTERN.test(code) || !name) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (store.branches.some((br) => br.companyId === b.companyId && br.code.toUpperCase() === code)) {
      throw new ApiError(409, 'ORG_CODE_TAKEN');
    }
    const wantsHq = Boolean(b.isHeadquarters);
    if (wantsHq && store.branches.some((br) => br.companyId === b.companyId && br.isHeadquarters)) {
      throw new ApiError(409, 'ORG_HQ_EXISTS');
    }
    const now = nowIso();
    const created: Branch = {
      id: `br-${fakeId().slice(-8)}`,
      companyId: b.companyId,
      code,
      name,
      address: b.address?.trim() || null,
      phone: b.phone?.trim() || null,
      isHeadquarters: wantsHq,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    store.branches.push(created);
    return created;
  });
}

export async function fakeUpdateBranch(
  id: string,
  patch: Partial<Pick<Branch, 'name' | 'address' | 'phone' | 'isHeadquarters' | 'status'>>,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<Branch> {
  await fakeDelay();
  const branch = store.branches.find((b) => b.id === id);
  if (!branch) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.branch.manage', id);
  if (patch.isHeadquarters !== undefined && patch.isHeadquarters !== branch.isHeadquarters) {
    requireCompanyPermission('org.branch.manage', branch.companyId);
  }

  return checkIdempotency(`updateBranch:${id}`, key, patch, () => {
    const company = store.companies.find((c) => c.id === branch.companyId);
    if (patch.status === 'ACTIVE' && branch.status !== 'ACTIVE' && company?.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    if (patch.isHeadquarters === false && branch.isHeadquarters) {
      throw new ApiError(409, 'ORG_HQ_TRANSFER_REQUIRED');
    }
    if (patch.status === 'INACTIVE' && branch.status === 'ACTIVE') {
      if (branch.isHeadquarters) {
        throw new ApiError(409, 'ORG_HQ_TRANSFER_REQUIRED');
      }
      const blockers: string[] = [];
      if (store.departments.some((d) => d.branchId === id && d.status === 'ACTIVE')) {
        blockers.push('branch has active departments');
      }
      if (liveUsers().some((u) => u.branchId === id)) {
        blockers.push('branch has placed users');
      }
      if (store.memberships.some((m) => m.branchId === id || m.explicitBranchIds.includes(id))) {
        blockers.push('branch has team memberships');
      }
      if (blockers.length > 0) {
        throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
      }
    }

    if (patch.isHeadquarters === true && !branch.isHeadquarters) {
      if (branch.status !== 'ACTIVE' || patch.status === 'INACTIVE') {
        throw new ApiError(409, 'ORG_HQ_TRANSFER_REQUIRED');
      }
      checkSeatCascade(opts);
      for (const other of store.branches) {
        if (other.companyId === branch.companyId && other.id !== branch.id && other.isHeadquarters) {
          other.isHeadquarters = false;
          other.updatedAt = nowIso();
        }
      }
      branch.isHeadquarters = true;
    } else {
      checkSeatCascade(opts);
    }

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      branch.name = trimmed;
    }
    if (patch.address !== undefined) branch.address = patch.address?.trim() || null;
    if (patch.phone !== undefined) branch.phone = patch.phone?.trim() || null;
    if (patch.status !== undefined) branch.status = patch.status;
    branch.updatedAt = nowIso();
    syncScopeRolesActiveState();
    return branch;
  });
}

export async function fakeDeleteBranch(id: string, key: string, opts?: ConfirmAddonCascadeOptions): Promise<void> {
  await fakeDelay();
  const idx = store.branches.findIndex((b) => b.id === id);
  if (idx === -1) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.branch.manage', id);

  checkIdempotency(`deleteBranch:${id}`, key, { id }, () => {
    const branch = store.branches[idx];
    if (branch.isHeadquarters) {
      throw new ApiError(409, 'ORG_HQ_TRANSFER_REQUIRED');
    }
    const blockers: string[] = [];
    if (store.departments.some((d) => d.branchId === id)) {
      blockers.push('branch has departments');
    }
    if (liveUsers().some((u) => u.branchId === id)) {
      blockers.push('branch has placed users');
    }
    if (store.memberships.some((m) => m.branchId === id || m.explicitBranchIds.includes(id))) {
      blockers.push('branch has team memberships');
    }
    if (id === 'br-cai') {
      blockers.push('branch has references; deactivate the branch instead');
    }
    if (blockers.length > 0) {
      throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
    }
    checkSeatCascade(opts);
    store.branches.splice(idx, 1);
    syncScopeRolesActiveState();
  });
}

// =========================================================================
// DEPARTMENTS
// =========================================================================

export async function fakeListDepartments(
  q: ListQuery = {},
  canRead: StaffFixtureReadScope = (scope) => actorCan('org.department.read', scope),
): Promise<CorePage<Department>> {
  await fakeDelay();
  let items = store.departments.filter((d) => {
    const companyId = findBranchCompanyId(d.branchId);
    return canRead({ companyId, branchId: d.branchId });
  });
  if (q.companyId) {
    const branchIds = new Set(store.branches.filter((b) => b.companyId === q.companyId).map((b) => b.id));
    items = items.filter((d) => branchIds.has(d.branchId));
  }
  if (q.branchId) items = items.filter((d) => d.branchId === q.branchId);
  if (q.status) items = items.filter((d) => d.status === q.status);
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter((d) => d.name.toLowerCase().includes(term) || d.code.toLowerCase().includes(term));
  }
  items = sortItems(items, q.sortBy ?? 'name', q.sortDir ?? 'ASC', {
    name: (d) => d.name,
    code: (d) => d.code,
    createdAt: (d) => d.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetDepartment(id: string): Promise<Department> {
  await fakeDelay();
  const dept = store.departments.find((d) => d.id === id);
  if (!dept) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  if (!actorCan('org.department.read', { branchId: dept.branchId })) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
  return clone(dept);
}

export async function fakeCreateDepartment(
  b: { branchId: string; code: string; name: string },
  key: string,
): Promise<Department> {
  await fakeDelay();
  const branch = store.branches.find((br) => br.id === b.branchId);
  if (!branch) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.department.manage', b.branchId);

  return checkIdempotency('createDepartment', key, b, () => {
    if (branch.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    const code = b.code.trim().toUpperCase();
    const name = b.name.trim();
    if (!CODE_PATTERN.test(code) || !name) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (store.departments.some((d) => d.branchId === b.branchId && d.code.toUpperCase() === code)) {
      throw new ApiError(409, 'ORG_CODE_TAKEN');
    }
    const now = nowIso();
    const created: Department = {
      id: `dp-${fakeId().slice(-8)}`,
      branchId: b.branchId,
      code,
      name,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    store.departments.push(created);
    return created;
  });
}

export async function fakeUpdateDepartment(
  id: string,
  patch: Partial<Pick<Department, 'name' | 'status'>>,
  key: string,
): Promise<Department> {
  await fakeDelay();
  const dept = store.departments.find((d) => d.id === id);
  if (!dept) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.department.manage', dept.branchId);

  return checkIdempotency(`updateDepartment:${id}`, key, patch, () => {
    const branch = store.branches.find((b) => b.id === dept.branchId);
    if (patch.status === 'ACTIVE' && dept.status !== 'ACTIVE' && branch?.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    if (patch.status === 'INACTIVE' && dept.status === 'ACTIVE') {
      const blockers: string[] = [];
      if (store.teams.some((t) => t.departmentId === id && t.status === 'ACTIVE')) {
        blockers.push('department has active teams');
      }
      if (liveUsers().some((u) => u.departmentId === id)) {
        blockers.push('department has placed users');
      }
      if (store.memberships.some((m) => m.departmentId === id)) {
        blockers.push('department has team memberships');
      }
      if (blockers.length > 0) {
        throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
      }
    }
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      dept.name = trimmed;
    }
    if (patch.status !== undefined) dept.status = patch.status;
    dept.updatedAt = nowIso();
    return dept;
  });
}

export async function fakeDeleteDepartment(id: string, key: string): Promise<void> {
  await fakeDelay();
  const idx = store.departments.findIndex((d) => d.id === id);
  if (idx === -1) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.department.manage', store.departments[idx].branchId);

  checkIdempotency(`deleteDepartment:${id}`, key, { id }, () => {
    const blockers: string[] = [];
    if (store.teams.some((t) => t.departmentId === id)) {
      blockers.push('department has teams');
    }
    if (liveUsers().some((u) => u.departmentId === id)) {
      blockers.push('department has placed users');
    }
    if (store.memberships.some((m) => m.departmentId === id)) {
      blockers.push('department has team memberships');
    }
    if (blockers.length > 0) {
      throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
    }
    store.departments.splice(idx, 1);
  });
}

// =========================================================================
// TEAMS
// =========================================================================

export async function fakeListTeams(
  q: ListQuery = {},
  canRead: StaffFixtureReadScope = (scope) => actorCan('org.team.read', scope),
): Promise<CorePage<Team>> {
  await fakeDelay();
  let items = store.teams.filter((t) => {
    const branchId = findDepartmentBranchId(t.departmentId);
    return branchId ? canRead({ branchId }) : false;
  });
  if (q.companyId) {
    const branchIds = new Set(store.branches.filter((b) => b.companyId === q.companyId).map((b) => b.id));
    const deptIds = new Set(store.departments.filter((d) => branchIds.has(d.branchId)).map((d) => d.id));
    items = items.filter((t) => deptIds.has(t.departmentId));
  }
  if (q.branchId) {
    const deptIds = new Set(store.departments.filter((d) => d.branchId === q.branchId).map((d) => d.id));
    items = items.filter((t) => deptIds.has(t.departmentId));
  }
  if (q.departmentId) items = items.filter((t) => t.departmentId === q.departmentId);
  if (q.status) items = items.filter((t) => t.status === q.status);
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter((t) => t.name.toLowerCase().includes(term) || t.code.toLowerCase().includes(term));
  }
  items = sortItems(items, q.sortBy ?? 'name', q.sortDir ?? 'ASC', {
    name: (t) => t.name,
    code: (t) => t.code,
    createdAt: (t) => t.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetTeam(id: string): Promise<Team> {
  await fakeDelay();
  const team = store.teams.find((t) => t.id === id);
  if (!team) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  const branchId = findDepartmentBranchId(team.departmentId);
  if (!branchId || !actorCan('org.team.read', { branchId })) {
    throw new ApiError(403, 'BRANCH_PERMISSION_DENIED');
  }
  return clone(team);
}

function validateTeamLead(leadUserId: string | null | undefined, branchId: string): void {
  if (!leadUserId) return;
  const user = liveUsers().find((u) => u.id === leadUserId);
  if (!user || user.status !== 'ACTIVE') {
    throw new ApiError(404, 'ORG_LEAD_USER_NOT_FOUND');
  }
  const placedInBranch = user.branchId === branchId;
  const hasGrant =
    store.branchRoles.some((bra) => bra.tenantUserId === user.id && bra.branchId === branchId) ||
    store.scopeRoles.some(
      (sra) =>
        sra.tenantUserId === user.id &&
        sra.scopeActive &&
        (sra.scopeTarget === 'TENANT' ||
          (sra.scopeTarget === 'COMPANY' && sra.companyId === findBranchCompanyId(branchId)) ||
          (sra.scopeTarget === 'BRANCH' && sra.branchId === branchId)),
    );
  if (!placedInBranch && !hasGrant) {
    throw new ApiError(422, 'ORG_LEAD_BRANCH_REQUIRED');
  }
}

export async function fakeCreateTeam(
  b: { departmentId: string; code: string; name: string; leadUserId?: string | null },
  key: string,
): Promise<Team> {
  await fakeDelay();
  const dept = store.departments.find((d) => d.id === b.departmentId);
  if (!dept) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.team.manage', dept.branchId);

  return checkIdempotency('createTeam', key, b, () => {
    if (dept.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    const code = b.code.trim().toUpperCase();
    const name = b.name.trim();
    if (!CODE_PATTERN.test(code) || !name) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (store.teams.some((t) => t.departmentId === b.departmentId && t.code.toUpperCase() === code)) {
      throw new ApiError(409, 'ORG_CODE_TAKEN');
    }
    validateTeamLead(b.leadUserId, dept.branchId);
    const now = nowIso();
    const created: Team = {
      id: `tm-${fakeId().slice(-8)}`,
      departmentId: b.departmentId,
      code,
      name,
      leadUserId: b.leadUserId || null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    store.teams.push(created);
    return created;
  });
}

export async function fakeUpdateTeam(
  id: string,
  patch: Partial<Pick<Team, 'name' | 'leadUserId' | 'status'>>,
  key: string,
): Promise<Team> {
  await fakeDelay();
  const team = store.teams.find((t) => t.id === id);
  if (!team) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  const dept = store.departments.find((d) => d.id === team.departmentId);
  if (!dept) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.team.manage', dept.branchId);

  return checkIdempotency(`updateTeam:${id}`, key, patch, () => {
    if (patch.status === 'ACTIVE' && team.status !== 'ACTIVE' && dept.status !== 'ACTIVE') {
      throw new ApiError(409, 'ORG_PARENT_INACTIVE');
    }
    if (patch.status === 'INACTIVE' && team.status === 'ACTIVE') {
      const blockers: string[] = [];
      if (liveUsers().some((u) => u.teamId === id)) {
        blockers.push('team has placed users');
      }
      if (store.memberships.some((m) => m.teamId === id)) {
        blockers.push('team has memberships');
      }
      if (blockers.length > 0) {
        throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
      }
    }
    if (patch.leadUserId !== undefined) {
      validateTeamLead(patch.leadUserId, dept.branchId);
      team.leadUserId = patch.leadUserId || null;
    }
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      team.name = trimmed;
    }
    if (patch.status !== undefined) team.status = patch.status;
    team.updatedAt = nowIso();
    return team;
  });
}

export async function fakeDeleteTeam(id: string, key: string): Promise<void> {
  await fakeDelay();
  const idx = store.teams.findIndex((t) => t.id === id);
  if (idx === -1) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  const branchId = findDepartmentBranchId(store.teams[idx].departmentId);
  if (!branchId) throw new ApiError(404, 'ORG_NODE_NOT_FOUND');
  requireBranchPermission('org.team.manage', branchId);

  checkIdempotency(`deleteTeam:${id}`, key, { id }, () => {
    const blockers: string[] = [];
    if (liveUsers().some((u) => u.teamId === id)) {
      blockers.push('team has placed users');
    }
    if (store.memberships.some((m) => m.teamId === id)) {
      blockers.push('team has memberships');
    }
    if (blockers.length > 0) {
      throw new ApiError(409, 'ORG_NODE_NOT_EMPTY', { blockers });
    }
    store.teams.splice(idx, 1);
  });
}

// =========================================================================
// USERS
// =========================================================================

export async function fakeListUsers(
  q: ListQuery = {},
  canRead: StaffFixtureReadScope = (scope) => actorCan('users.user.read', scope),
): Promise<CorePage<TenantUser>> {
  await fakeDelay();
  let items = liveUsers()
    .filter((u) => canRead({ companyId: u.companyId, branchId: u.branchId }))
    .map(hydrateUser);
  if (q.status) items = items.filter((u) => u.status === q.status);
  if (q.companyId) items = items.filter((u) => u.companyId === q.companyId);
  if (q.branchId) items = items.filter((u) => u.branchId === q.branchId);
  if (q.departmentId) items = items.filter((u) => u.departmentId === q.departmentId);
  if (q.teamId) {
    const memberIds = new Set(store.memberships.filter((m) => m.teamId === q.teamId).map((m) => m.tenantUserId));
    items = items.filter((u) => u.teamId === q.teamId || memberIds.has(u.id));
  }
  if (q.seatModuleKey && q.seatState) {
    items = items.filter((u) =>
      u.seats.some((s) => s.moduleKey === q.seatModuleKey && s.accessState === q.seatState),
    );
  } else if (q.seatModuleKey) {
    items = items.filter((u) => u.seats.some((s) => s.moduleKey === q.seatModuleKey));
  } else if (q.seatState) {
    items = items.filter((u) => u.seats.some((s) => s.accessState === q.seatState));
  }
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        u.firstName.toLowerCase().includes(term) ||
        u.lastName.toLowerCase().includes(term) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(term) ||
        (u.employeeCode?.toLowerCase().includes(term) ?? false) ||
        (u.jobTitle?.toLowerCase().includes(term) ?? false),
    );
  }
  items = sortItems(items, q.sortBy ?? 'createdAt', q.sortDir ?? 'DESC', {
    email: (u) => u.email,
    firstName: (u) => u.firstName,
    lastName: (u) => u.lastName,
    employeeCode: (u) => u.employeeCode ?? '',
    createdAt: (u) => u.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetUser(id: string): Promise<TenantUser> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  if (!actorCan('users.user.read', { companyId: user.companyId, branchId: user.branchId })) {
    throw new ApiError(403, 'BRANCH_ACCESS_DENIED');
  }
  return clone(hydrateUser(user));
}

function validatePlacementChain(companyId: string, branchId: string, departmentId: string, teamId?: string | null): void {
  const company = store.companies.find((c) => c.id === companyId);
  const branch = store.branches.find((b) => b.id === branchId);
  const dept = store.departments.find((d) => d.id === departmentId);
  if (!company || !branch || !dept || company.status !== 'ACTIVE' || branch.status !== 'ACTIVE' || dept.status !== 'ACTIVE') {
    throw new ApiError(422, 'PLACEMENT_INCONSISTENT');
  }
  if (branch.companyId !== company.id || dept.branchId !== branch.id) {
    throw new ApiError(422, 'PLACEMENT_INCONSISTENT');
  }
  if (teamId) {
    const team = store.teams.find((t) => t.id === teamId);
    if (!team || team.status !== 'ACTIVE' || team.departmentId !== dept.id) {
      throw new ApiError(422, 'PLACEMENT_INCONSISTENT');
    }
  }
}

export async function fakeInviteUser(
  b: {
    email: string;
    firstName: string;
    lastName: string;
    employeeCode?: string | null;
    companyId: string;
    branchId: string;
    departmentId: string;
    teamId?: string | null;
    managerId?: string | null;
    jobTitle?: string | null;
    roleAssignments?: { branchId: string; roleId: string }[];
    teamMemberships?: { teamId: string; role?: MembershipRole }[];
  },
  key: string,
): Promise<TenantUser> {
  await fakeDelay();
  requireBranchPermission('users.user.invite', b.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency('inviteUser', key, b, () => {
    const email = b.email.trim().toLowerCase();
    const firstName = b.firstName.trim();
    const lastName = b.lastName.trim();
    const employeeCode = b.employeeCode?.trim() || null;
    if (!email || !firstName || !lastName) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (employeeCode && !EMPLOYEE_CODE_PATTERN.test(employeeCode)) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    if (email === 'bounce@example.com') {
      throw new ApiError(422, 'INVITE_EMAIL_UNDELIVERABLE');
    }
    if (liveUsers().some((u) => u.email.toLowerCase() === email)) {
      throw new ApiError(409, 'TENANT_EMAIL_TAKEN');
    }
    if (employeeCode && liveUsers().some((u) => u.employeeCode?.toLowerCase() === employeeCode.toLowerCase())) {
      throw new ApiError(409, 'EMPLOYEE_CODE_TAKEN');
    }
    validatePlacementChain(b.companyId, b.branchId, b.departmentId, b.teamId);

    if (b.managerId) {
      const mgr = liveUsers().find((u) => u.id === b.managerId);
      if (!mgr) throw new ApiError(404, 'MANAGER_NOT_FOUND');
    }

    // Validate roleAssignments before committing
    const roleAssignments = b.roleAssignments ?? [];
    for (const ra of roleAssignments) {
      requireBranchPermission('users.user.assign_roles', ra.branchId, 'BRANCH_ACCESS_DENIED');
      const role = store.roles.find((r) => r.id === ra.roleId);
      if (!role) throw new ApiError(422, 'BRANCH_OR_ROLE_INVALID');
      if (role.name === 'Tenant Super Admin') throw new ApiError(409, 'ROLE_RESERVED_FOR_OWNER');
      if (role.permissionMode === 'BRANCH' && !role.profiles.some((p) => p.branchId === ra.branchId)) {
        throw new ApiError(422, 'ROLE_BRANCH_SCOPE_INVALID');
      }
      checkBranchPrivilegeEscalation(role, ra.branchId);
    }

    const now = nowIso();
    const userId = `u-${fakeId().slice(-8)}`;
    const created: TenantUser = {
      id: userId,
      email,
      firstName,
      lastName,
      employeeCode,
      companyId: b.companyId,
      branchId: b.branchId,
      departmentId: b.departmentId,
      teamId: b.teamId || null,
      managerId: b.managerId || null,
      jobTitle: b.jobTitle?.trim() || null,
      status: 'INVITED',
      isTenantOwner: false,
      seats: [],
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(created);
    store.neverAcceptedUserIds.add(userId);

    if (created.teamId) {
      store.memberships.push({
        id: `mem-${fakeId().slice(-8)}`,
        tenantUserId: userId,
        companyId: created.companyId,
        branchId: created.branchId,
        departmentId: created.departmentId,
        teamId: created.teamId,
        role: 'MEMBER',
        isPrimary: true,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const tm of b.teamMemberships ?? []) {
      const team = store.teams.find((t) => t.id === tm.teamId);
      if (!team) continue;
      if (store.memberships.some((m) => m.tenantUserId === userId && m.teamId === tm.teamId)) continue;
      const dept = store.departments.find((d) => d.id === team.departmentId);
      const branch = dept ? store.branches.find((br) => br.id === dept.branchId) : undefined;
      if (!dept || !branch) continue;
      store.memberships.push({
        id: `mem-${fakeId().slice(-8)}`,
        tenantUserId: userId,
        companyId: branch.companyId,
        branchId: branch.id,
        departmentId: dept.id,
        teamId: team.id,
        role: tm.role ?? 'MEMBER',
        isPrimary: false,
        reportingScopeRevision: 1,
        explicitBranchIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const ra of roleAssignments) {
      if (store.branchRoles.some((x) => x.tenantUserId === userId && x.branchId === ra.branchId && x.roleId === ra.roleId)) {
        continue;
      }
      store.branchRoles.push({
        id: `bra-${fakeId().slice(-8)}`,
        tenantUserId: userId,
        branchId: ra.branchId,
        roleId: ra.roleId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return hydrateUser(created);
  });
}

function checkSelfOrOwner(target: TenantUser): void {
  const me = buildActorMeSync();
  if (target.id === me.id) {
    throw new ApiError(403, 'USER_SELF_FORBIDDEN');
  }
  if (target.isTenantOwner) {
    throw new ApiError(409, 'TENANT_OWNER_PROTECTED');
  }
}

function createsManagerCycle(userId: string, candidateManagerId: string): boolean {
  let cursor: string | null = candidateManagerId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === userId) return true;
    if (visited.has(cursor)) break;
    visited.add(cursor);
    cursor = liveUsers().find((u) => u.id === cursor)?.managerId ?? null;
  }
  return false;
}

export async function fakeUpdateUser(
  id: string,
  patch: Partial<
    Pick<
      TenantUser,
      'firstName' | 'lastName' | 'employeeCode' | 'companyId' | 'branchId' | 'departmentId' | 'teamId' | 'managerId' | 'jobTitle'
    >
  >,
  key: string,
): Promise<TenantUser> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.update', user.branchId, 'BRANCH_ACCESS_DENIED');
  if (patch.branchId && patch.branchId !== user.branchId) {
    requireBranchPermission('users.user.update', patch.branchId, 'BRANCH_ACCESS_DENIED');
  }

  return checkIdempotency(`updateUser:${id}`, key, patch, () => {
    if (patch.employeeCode !== undefined) {
      const code = patch.employeeCode?.trim() || null;
      if (code && !EMPLOYEE_CODE_PATTERN.test(code)) {
        throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      }
      if (code && liveUsers().some((u) => u.id !== id && u.employeeCode?.toLowerCase() === code.toLowerCase())) {
        throw new ApiError(409, 'EMPLOYEE_CODE_TAKEN');
      }
    }
    const nextCompany = patch.companyId ?? user.companyId;
    const nextBranch = patch.branchId ?? user.branchId;
    const nextDept = patch.departmentId ?? user.departmentId;
    const nextTeam = patch.teamId !== undefined ? patch.teamId : user.teamId;
    if (
      patch.companyId !== undefined ||
      patch.branchId !== undefined ||
      patch.departmentId !== undefined ||
      patch.teamId !== undefined
    ) {
      validatePlacementChain(nextCompany, nextBranch, nextDept, nextTeam);
    }

    if (patch.managerId !== undefined && patch.managerId !== null) {
      const mgr = liveUsers().find((u) => u.id === patch.managerId);
      if (!mgr) throw new ApiError(404, 'MANAGER_NOT_FOUND');
      if (createsManagerCycle(id, patch.managerId)) {
        throw new ApiError(422, 'MANAGER_CYCLE');
      }
    }

    if (patch.firstName !== undefined) {
      const v = patch.firstName.trim();
      if (!v) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      user.firstName = v;
    }
    if (patch.lastName !== undefined) {
      const v = patch.lastName.trim();
      if (!v) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      user.lastName = v;
    }
    if (patch.employeeCode !== undefined) user.employeeCode = patch.employeeCode?.trim() || null;
    if (patch.jobTitle !== undefined) user.jobTitle = patch.jobTitle?.trim() || null;
    if (patch.managerId !== undefined) user.managerId = patch.managerId || null;

    const prevTeam = user.teamId;
    user.companyId = nextCompany;
    user.branchId = nextBranch;
    user.departmentId = nextDept;
    user.teamId = nextTeam || null;
    user.updatedAt = nowIso();

    if (prevTeam !== user.teamId) {
      const oldPrimary = store.memberships.find((m) => m.tenantUserId === id && m.isPrimary);
      if (oldPrimary) {
        oldPrimary.isPrimary = false;
      }
      if (user.teamId) {
        const existing = store.memberships.find((m) => m.tenantUserId === id && m.teamId === user.teamId);
        if (existing) {
          existing.isPrimary = true;
          existing.updatedAt = user.updatedAt;
        } else {
          store.memberships.push({
            id: `mem-${fakeId().slice(-8)}`,
            tenantUserId: id,
            companyId: user.companyId,
            branchId: user.branchId,
            departmentId: user.departmentId,
            teamId: user.teamId,
            role: 'MEMBER',
            isPrimary: true,
            reportingScopeRevision: 1,
            explicitBranchIds: [],
            createdAt: user.updatedAt,
            updatedAt: user.updatedAt,
          });
        }
      }
    }

    return hydrateUser(user);
  });
}

export async function fakeDeleteUser(
  id: string,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<void> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.delete', user.branchId, 'BRANCH_ACCESS_DENIED');

  checkIdempotency(`deleteUser:${id}`, key, { id }, () => {
    checkSeatCascade(opts);
    user.status = 'DEACTIVATED';
    user.updatedAt = nowIso();
    store.deletedUserIds.add(id);
    store.modules = store.modules.filter((m) => m.userId !== id);
    store.memberships = store.memberships.filter((m) => m.tenantUserId !== id);
    store.branchRoles = store.branchRoles.filter((b) => b.tenantUserId !== id);
    store.scopeRoles = store.scopeRoles.filter((s) => s.tenantUserId !== id);
  });
}

export async function fakeResendInvite(id: string, key: string): Promise<{ deliveryStatus: 'QUEUED' }> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.invite', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`resendInvite:${id}`, key, { id }, () => {
    if (user.status !== 'INVITED') {
      throw new ApiError(409, 'INVALID_STATUS_TRANSITION');
    }
    const now = Date.now();
    const recent = (store.resendTimestamps.get(id) ?? []).filter((ts) => now - ts < 60_000);
    if (recent.length >= 5) {
      throw new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED');
    }
    recent.push(now);
    store.resendTimestamps.set(id, recent);
    return { deliveryStatus: 'QUEUED' };
  });
}

export async function fakeSuspendUser(id: string, key: string): Promise<TenantUser> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.deactivate', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`suspendUser:${id}`, key, { id }, () => {
    user.status = 'SUSPENDED';
    user.updatedAt = nowIso();
    return hydrateUser(user);
  });
}

export async function fakeActivateUser(id: string, key: string): Promise<TenantUser> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.deactivate', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`activateUser:${id}`, key, { id }, () => {
    if (user.status !== 'SUSPENDED') {
      throw new ApiError(409, 'INVALID_STATUS_TRANSITION');
    }
    user.status = store.neverAcceptedUserIds.has(id) ? 'INVITED' : 'ACTIVE';
    store.releasedUserIds.delete(id);
    user.updatedAt = nowIso();
    return hydrateUser(user);
  });
}

export async function fakeRevokeSessions(id: string, key: string): Promise<TenantUser> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.deactivate', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`revokeSessions:${id}`, key, { id }, () => {
    user.updatedAt = nowIso();
    return hydrateUser(user);
  });
}

// =========================================================================
// MEMBERSHIPS & REPORTING SCOPES
// =========================================================================

function hydrateMembership(m: StoredMembership): TeamMembership {
  const team = store.teams.find((t) => t.id === m.teamId);
  return {
    id: m.id,
    tenantUserId: m.tenantUserId,
    companyId: m.companyId,
    branchId: m.branchId,
    departmentId: m.departmentId,
    teamId: m.teamId,
    role: m.role,
    isPrimary: m.isPrimary,
    reportingScopeRevision: m.reportingScopeRevision,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    ...(team ? { team: clone(team) } : {}),
  };
}

export async function fakeListMemberships(userId: string): Promise<TeamMembership[]> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  if (!actorCan('users.user.read', { companyId: user.companyId, branchId: user.branchId })) {
    throw new ApiError(403, 'BRANCH_ACCESS_DENIED');
  }
  return store.memberships.filter((m) => m.tenantUserId === userId).map(hydrateMembership);
}

export async function fakeSetMemberships(
  userId: string,
  memberships: { teamId: string; role: MembershipRole; isPrimary?: boolean }[],
  key: string,
): Promise<TeamMembership[]> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.manage_memberships', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`setMemberships:${userId}`, key, memberships, () => {
    if (memberships.length > STAFF_LIMITS.memberships) {
      throw new ApiError(422, 'TEAM_MEMBERSHIP_LIMIT_EXCEEDED');
    }
    const seenTeams = new Set<string>();
    let primaryCount = 0;
    const nextList: StoredMembership[] = [];
    const now = nowIso();

    for (const item of memberships) {
      if (seenTeams.has(item.teamId)) {
        throw new ApiError(409, 'TEAM_MEMBERSHIP_ALREADY_EXISTS');
      }
      seenTeams.add(item.teamId);
      if (item.isPrimary) primaryCount++;
      if (primaryCount > 1) {
        throw new ApiError(422, 'TEAM_MEMBERSHIP_PRIMARY_CONFLICT');
      }
      const team = store.teams.find((t) => t.id === item.teamId);
      const dept = team ? store.departments.find((d) => d.id === team.departmentId) : undefined;
      const branch = dept ? store.branches.find((b) => b.id === dept.branchId) : undefined;
      if (!team || !dept || !branch || team.status !== 'ACTIVE' || dept.status !== 'ACTIVE' || branch.status !== 'ACTIVE') {
        throw new ApiError(422, 'PLACEMENT_INCONSISTENT');
      }
      requireBranchPermission('users.user.manage_memberships', branch.id, 'BRANCH_ACCESS_DENIED');

      const existing = store.memberships.find((m) => m.tenantUserId === userId && m.teamId === item.teamId);
      const isPrimary = item.isPrimary ?? (user.teamId === item.teamId);
      nextList.push({
        id: existing?.id ?? `mem-${fakeId().slice(-8)}`,
        tenantUserId: userId,
        companyId: branch.companyId,
        branchId: branch.id,
        departmentId: dept.id,
        teamId: team.id,
        role: item.role,
        isPrimary,
        reportingScopeRevision: existing?.reportingScopeRevision ?? 1,
        explicitBranchIds: existing ? [...existing.explicitBranchIds] : [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }

    const oldPrimary = store.memberships.find((m) => m.tenantUserId === userId && m.isPrimary);
    if (oldPrimary && !nextList.some((m) => m.teamId === oldPrimary.teamId && m.isPrimary)) {
      throw new ApiError(409, 'PRIMARY_TEAM_MEMBERSHIP_PROTECTED');
    }

    store.memberships = [...store.memberships.filter((m) => m.tenantUserId !== userId), ...nextList];
    return nextList.map(hydrateMembership);
  });
}

export async function fakeAddMembership(
  userId: string,
  m: { teamId: string; role: MembershipRole; isPrimary?: boolean },
  key: string,
): Promise<TeamMembership[]> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.manage_memberships', user.branchId, 'BRANCH_ACCESS_DENIED');

  return checkIdempotency(`addMembership:${userId}`, key, m, () => {
    const current = store.memberships.filter((x) => x.tenantUserId === userId);
    if (current.length >= STAFF_LIMITS.memberships) {
      throw new ApiError(422, 'TEAM_MEMBERSHIP_LIMIT_EXCEEDED');
    }
    if (current.some((x) => x.teamId === m.teamId)) {
      throw new ApiError(409, 'TEAM_MEMBERSHIP_ALREADY_EXISTS');
    }
    if (m.isPrimary && current.some((x) => x.isPrimary)) {
      throw new ApiError(422, 'TEAM_MEMBERSHIP_PRIMARY_CONFLICT');
    }
    const team = store.teams.find((t) => t.id === m.teamId);
    const dept = team ? store.departments.find((d) => d.id === team.departmentId) : undefined;
    const branch = dept ? store.branches.find((b) => b.id === dept.branchId) : undefined;
    if (!team || !dept || !branch || team.status !== 'ACTIVE' || dept.status !== 'ACTIVE' || branch.status !== 'ACTIVE') {
      throw new ApiError(422, 'PLACEMENT_INCONSISTENT');
    }
    requireBranchPermission('users.user.manage_memberships', branch.id, 'BRANCH_ACCESS_DENIED');

    const now = nowIso();
    const created: StoredMembership = {
      id: `mem-${fakeId().slice(-8)}`,
      tenantUserId: userId,
      companyId: branch.companyId,
      branchId: branch.id,
      departmentId: dept.id,
      teamId: team.id,
      role: m.role,
      isPrimary: Boolean(m.isPrimary),
      reportingScopeRevision: 1,
      explicitBranchIds: [],
      createdAt: now,
      updatedAt: now,
    };
    store.memberships.push(created);
    return [...current, created].map(hydrateMembership);
  });
}

export async function fakeRemoveMembership(userId: string, membershipId: string, key: string): Promise<void> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  requireBranchPermission('users.user.manage_memberships', user.branchId, 'BRANCH_ACCESS_DENIED');

  checkIdempotency(`removeMembership:${userId}:${membershipId}`, key, { userId, membershipId }, () => {
    const idx = store.memberships.findIndex((m) => m.id === membershipId && m.tenantUserId === userId);
    if (idx === -1) throw new ApiError(404, 'TEAM_MEMBERSHIP_NOT_FOUND');
    const membership = store.memberships[idx];
    if (membership.isPrimary) {
      throw new ApiError(409, 'PRIMARY_TEAM_MEMBERSHIP_PROTECTED');
    }
    store.memberships.splice(idx, 1);
  });
}

export async function fakeGetReportingScopes(userId: string, membershipId: string): Promise<ReportingScopes> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  if (!actorCan('users.user.read', { companyId: user.companyId, branchId: user.branchId })) {
    throw new ApiError(403, 'BRANCH_ACCESS_DENIED');
  }
  const membership = store.memberships.find((m) => m.id === membershipId && m.tenantUserId === userId);
  if (!membership) throw new ApiError(404, 'TEAM_MEMBERSHIP_NOT_FOUND');

  const canManage =
    !user.isTenantOwner &&
    user.id !== buildActorMeSync().id &&
    actorCan('users.user.manage_memberships', { branchId: membership.branchId });

  const items: ReportingScopes['items'] = [
    {
      id: `rs-home-${membership.id}`,
      companyId: membership.companyId,
      branchId: membership.branchId,
      origin: 'HOME',
      revision: membership.reportingScopeRevision,
      capabilities: { canRemove: false },
    },
    ...membership.explicitBranchIds.map((branchId) => ({
      id: `rs-exp-${membership.id}-${branchId}`,
      companyId: membership.companyId,
      branchId,
      origin: 'EXPLICIT' as const,
      revision: membership.reportingScopeRevision,
      capabilities: { canRemove: canManage },
    })),
  ];

  return clone({
    membershipId: membership.id,
    revision: membership.reportingScopeRevision,
    items,
    capabilities: { canManage },
  });
}

export async function fakePatchReportingScopes(
  userId: string,
  membershipId: string,
  body: { expectedRevision: number; addBranchIds?: string[]; removeBranchIds?: string[] },
  key: string,
): Promise<{ membershipId: string; revision: number; outcome: 'APPLIED' | 'NO_CHANGE'; replayed: boolean }> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  checkSelfOrOwner(user);
  const membership = store.memberships.find((m) => m.id === membershipId && m.tenantUserId === userId);
  if (!membership) throw new ApiError(404, 'TEAM_MEMBERSHIP_NOT_FOUND');
  requireBranchPermission('users.user.manage_memberships', membership.branchId, 'BRANCH_ACCESS_DENIED');

  if (!key) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7_PATTERN.test(key)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');

  const cacheKey = `patchReportingScopes:${userId}:${membershipId}:${key}`;
  const bodyHash = JSON.stringify(body);
  const cached = store.idempotency.get(cacheKey);
  if (cached) {
    if (cached.bodyHash !== bodyHash) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    const replayedResult = clone(cached.result) as {
      membershipId: string;
      revision: number;
      outcome: 'APPLIED' | 'NO_CHANGE';
      replayed: boolean;
    };
    return { ...replayedResult, replayed: true };
  }

  if (body.expectedRevision !== membership.reportingScopeRevision) {
    throw new ApiError(409, 'TEAM_REPORTING_SCOPE_REVISION_CONFLICT');
  }

  const removeIds = body.removeBranchIds ?? [];
  const addIds = body.addBranchIds ?? [];

  if (removeIds.includes(membership.branchId)) {
    throw new ApiError(409, 'TEAM_REPORTING_HOME_SCOPE_PROTECTED');
  }

  for (const branchId of addIds) {
    const branch = store.branches.find((b) => b.id === branchId);
    if (!branch || branch.companyId !== membership.companyId) {
      throw new ApiError(422, 'TEAM_REPORTING_SCOPE_COMPANY_MISMATCH');
    }
  }

  const nextExplicit = new Set(membership.explicitBranchIds);
  for (const rid of removeIds) nextExplicit.delete(rid);
  for (const aid of addIds) {
    if (aid !== membership.branchId) nextExplicit.add(aid);
  }

  // HOME + explicit count must not exceed 20
  if (1 + nextExplicit.size > STAFF_LIMITS.reportingBranches) {
    throw new ApiError(422, 'TEAM_REPORTING_SCOPE_LIMIT_EXCEEDED');
  }

  const prevSet = new Set(membership.explicitBranchIds);
  const changed =
    nextExplicit.size !== prevSet.size || [...nextExplicit].some((bid) => !prevSet.has(bid));

  if (!changed) {
    const res = {
      membershipId: membership.id,
      revision: membership.reportingScopeRevision,
      outcome: 'NO_CHANGE' as const,
      replayed: false,
    };
    store.idempotency.set(cacheKey, { op: 'patchReportingScopes', bodyHash, result: clone(res) });
    return res;
  }

  membership.explicitBranchIds = [...nextExplicit];
  membership.reportingScopeRevision += 1;
  membership.updatedAt = nowIso();

  const res = {
    membershipId: membership.id,
    revision: membership.reportingScopeRevision,
    outcome: 'APPLIED' as const,
    replayed: false,
  };
  store.idempotency.set(cacheKey, { op: 'patchReportingScopes', bodyHash, result: clone(res) });
  return res;
}

// =========================================================================
// MODULES (SEATS)
// =========================================================================

export async function fakeListModules(userId: string): Promise<ModuleAssignment[]> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  if (!actorCan('users.user.read', { companyId: user.companyId, branchId: user.branchId })) {
    throw new ApiError(403, 'BRANCH_ACCESS_DENIED');
  }
  if (seatsOverlay?.isDerivedMode()) {
    return clone(
      seatsOverlay.getUserSeats(userId).map((s) => ({
        id: `mod-derived-${userId}-${s.moduleKey}`,
        userId,
        moduleKey: s.moduleKey,
        source: 'ROLE' as const,
        grantedAt: s.grantedAt,
        accessState: s.accessState,
        cause: s.cause,
        createdAt: s.grantedAt,
        updatedAt: s.grantedAt,
      })),
    );
  }
  return clone(
    store.modules
      .filter((m) => m.userId === userId)
      .map((m) => ({
        ...m,
        source: 'MANUAL' as const,
        grantedAt: m.createdAt,
        accessState: 'ACTIVE' as const,
        cause: null,
      })),
  );
}

export async function fakeAssignModule(userId: string, moduleKey: string, key: string): Promise<ModuleAssignment> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  const me = buildActorMeSync();
  if (user.id === me.id) {
    throw new ApiError(403, 'USER_SELF_FORBIDDEN');
  }
  requireTenantWide('users.user.manage_modules');

  return checkIdempotency(`assignModule:${userId}`, key, { moduleKey }, () => {
    if (!SUBSCRIBED_MODULES.has(moduleKey)) {
      throw new ApiError(422, 'MODULE_NOT_SUBSCRIBED');
    }
    if (user.status !== 'ACTIVE') {
      throw new ApiError(409, 'APPLICATION_ALLOWANCE_NOT_READY');
    }
    const existing = store.modules.find((m) => m.userId === userId && m.moduleKey === moduleKey);
    if (existing) {
      return existing;
    }
    const used = store.modules.filter((m) => m.moduleKey === moduleKey).length;
    const cap = FAKE_SEATS[moduleKey] ?? 0;
    if (used >= cap) {
      throw new ApiError(422, 'SEAT_LIMIT_REACHED', { module: moduleKey });
    }
    const now = nowIso();
    const created: ModuleAssignment = {
      id: `mod-${fakeId().slice(-8)}`,
      userId,
      moduleKey,
      createdAt: now,
      updatedAt: now,
    };
    store.modules.push(created);
    return created;
  });
}

export async function fakeUnassignModule(userId: string, moduleKey: string, key: string): Promise<void> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  const me = buildActorMeSync();
  if (user.id === me.id) {
    throw new ApiError(403, 'USER_SELF_FORBIDDEN');
  }
  requireTenantWide('users.user.manage_modules');

  checkIdempotency(`unassignModule:${userId}:${moduleKey}`, key, { moduleKey }, () => {
    const idx = store.modules.findIndex((m) => m.userId === userId && m.moduleKey === moduleKey);
    if (idx === -1) {
      throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND');
    }
    store.modules.splice(idx, 1);
  });
}

// =========================================================================
// PERMISSIONS & ROLES
// =========================================================================

export async function fakeListPermissions(q: ListQuery = {}): Promise<CorePage<Permission>> {
  await fakeDelay();
  if (!actorCan('roles.permission.read')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  let items = getPermissionsList();
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter(
      (p) =>
        p.key.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.nameAr.toLowerCase().includes(term),
    );
  }
  items = sortItems(items, q.sortBy ?? 'group', q.sortDir ?? 'ASC', {
    group: (p) => p.group,
    key: (p) => p.key,
  });
  return paginate(items, q);
}

export async function fakeListRoles(q: ListQuery & { isSystem?: boolean } = {}): Promise<CorePage<Role>> {
  await fakeDelay();
  if (!actorCan('roles.role.read')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  let items = store.roles.map(roleSummaryFromStored);
  if (q.isSystem !== undefined) {
    items = items.filter((r) => r.isSystem === q.isSystem);
  }
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    items = items.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.nameI18n.en.toLowerCase().includes(term) ||
        r.nameI18n.ar.toLowerCase().includes(term),
    );
  }
  items = sortItems(items, q.sortBy ?? 'name', q.sortDir ?? 'ASC', {
    name: (r) => r.name,
    createdAt: (r) => r.createdAt,
  });
  return paginate(items, q);
}

export async function fakeGetRole(id: string): Promise<RoleDetail> {
  await fakeDelay();
  if (!actorCan('roles.role.read')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  const role = store.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND');
  return clone(roleDetailFromStored(role));
}

function validateRoleName(raw: string, excludeId?: string): string {
  const name = raw.trim();
  if (!name || name.length > STAFF_LIMITS.roleName) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  const lower = name.toLowerCase();
  if (lower === 'admin' || lower === 'tenant super admin') {
    throw new ApiError(409, 'ROLE_NAME_RESERVED');
  }
  if (store.roles.some((r) => r.id !== excludeId && r.name === name)) {
    throw new ApiError(409, 'ROLE_NAME_TAKEN');
  }
  return name;
}

function validatePermissionIds(permissionIds: string[]): string[] {
  const unique = Array.from(new Set(permissionIds));
  if (unique.length > STAFF_LIMITS.rolePermissions) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  const me = buildActorMeSync();
  for (const pid of unique) {
    if (!CATALOGUE_BY_KEY.has(pid)) {
      throw new ApiError(422, 'PERMISSION_UNKNOWN');
    }
    if (!me.isTenantOwner && !me.permissionScopes[pid]?.tenantWide) {
      throw new ApiError(403, 'ROLE_PERMISSION_GRANT_DENIED');
    }
  }
  return unique;
}

export async function fakeCreateRole(
  b: { name: string; description?: string; permissionIds?: string[] },
  key: string,
): Promise<RoleDetail> {
  await fakeDelay();
  requireTenantWide('roles.role.create');

  return checkIdempotency('createRole', key, b, () => {
    const name = validateRoleName(b.name);
    const desc = b.description?.trim() || undefined;
    if (desc && desc.length > STAFF_LIMITS.roleDescription) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    const permissionIds = validatePermissionIds(b.permissionIds ?? []);
    const now = nowIso();
    const created: StoredRole = {
      id: `role-${fakeId().slice(-8)}`,
      name,
      nameI18n: { en: name, ar: name },
      ...(desc ? { description: desc, descriptionI18n: { en: desc, ar: desc } } : {}),
      isSystem: false,
      permissionMode: 'GLOBAL',
      branchProfileCount: 0,
      permissionCount: permissionIds.length,
      permissionIds,
      branchRevision: 1,
      profiles: [],
      createdAt: now,
      updatedAt: now,
    };
    store.roles.push(created);
    return roleDetailFromStored(created);
  });
}

export async function fakeUpdateRole(
  id: string,
  patch: { name?: string; description?: string | null },
  key: string,
): Promise<RoleDetail> {
  await fakeDelay();
  requireTenantWide('roles.role.update');

  return checkIdempotency(`updateRole:${id}`, key, patch, () => {
    const role = store.roles.find((r) => r.id === id);
    if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND');
    if (role.isSystem) throw new ApiError(409, 'ROLE_IS_SYSTEM');

    if (patch.name !== undefined) {
      const name = validateRoleName(patch.name, id);
      role.name = name;
      role.nameI18n = { en: name, ar: name };
    }
    if (patch.description !== undefined) {
      const desc = patch.description?.trim() || undefined;
      if (desc && desc.length > STAFF_LIMITS.roleDescription) {
        throw new ApiError(400, 'CORE_VALIDATION_FAILED');
      }
      role.description = desc;
      role.descriptionI18n = desc ? { en: desc, ar: desc } : undefined;
    }
    role.updatedAt = nowIso();
    return roleDetailFromStored(role);
  });
}

export async function fakeSetRolePermissions(
  id: string,
  permissionIds: string[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<RoleDetail> {
  await fakeDelay();
  requireTenantWide('roles.role.update');

  return checkIdempotency(`setRolePermissions:${id}`, key, { permissionIds }, () => {
    const role = store.roles.find((r) => r.id === id);
    if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND');
    if (role.isSystem) throw new ApiError(409, 'ROLE_IS_SYSTEM');
    if (role.permissionMode === 'BRANCH') throw new ApiError(409, 'ROLE_BRANCH_MODE_REQUIRED');

    const valid = validatePermissionIds(permissionIds);
    checkSeatCascade(opts);
    role.permissionIds = valid;
    role.permissionCount = valid.length;
    role.updatedAt = nowIso();
    return roleDetailFromStored(role);
  });
}

export async function fakeDeleteRole(
  id: string,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<void> {
  await fakeDelay();
  requireTenantWide('roles.role.delete');

  checkIdempotency(`deleteRole:${id}`, key, { id }, () => {
    const idx = store.roles.findIndex((r) => r.id === id);
    if (idx === -1) throw new ApiError(404, 'ROLE_NOT_FOUND');
    const role = store.roles[idx];
    if (role.isSystem) throw new ApiError(409, 'ROLE_IS_SYSTEM');
    if (computeHoldersCount(id) > 0) {
      throw new ApiError(409, 'ROLE_IN_USE', { holders: computeHoldersCount(id) });
    }
    checkSeatCascade(opts);
    store.roles.splice(idx, 1);
  });
}

function hydrateBranchPermissions(role: StoredRole): RoleBranchPermissions {
  const companyMap = new Map(store.companies.map((c) => [c.id, c]));
  const profiles: RoleBranchProfile[] = role.profiles.map((p) => {
    const branch = store.branches.find((b) => b.id === p.branchId);
    const company = branch ? companyMap.get(branch.companyId) : undefined;
    return {
      branchId: p.branchId,
      companyId: branch?.companyId ?? '',
      branchName: branch?.name ?? p.branchId,
      companyName: company?.name ?? '',
      isActive: branch?.status === 'ACTIVE' && company?.status === 'ACTIVE',
      permissionIds: [...p.permissionIds],
    };
  });

  return {
    roleId: role.id,
    roleName: role.name,
    isSystem: role.isSystem,
    permissionMode: role.permissionMode,
    revision: String(role.branchRevision),
    catalogueRevision: getCatalogueRevision(),
    globalPermissionIds: role.permissionMode === 'GLOBAL' ? [...role.permissionIds] : [],
    profiles,
    catalogue: getCatalogueEntries(),
    limits: {
      branches: STAFF_LIMITS.branchProfiles,
      permissionsPerBranch: STAFF_LIMITS.profilePermissions,
    },
  };
}

export async function fakeGetRoleBranchPermissions(id: string): Promise<RoleBranchPermissions> {
  await fakeDelay();
  if (!buildActorMeSync().isTenantOwner) {
    throw new ApiError(403, 'ROLE_BRANCH_OWNER_REQUIRED');
  }
  const role = store.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND');
  return clone(hydrateBranchPermissions(role));
}

export async function fakeSetRoleBranchPermissions(
  id: string,
  body: { expectedRevision: string; catalogueRevision: string; profiles: { branchId: string; permissionIds: string[] }[] },
  opts?: ConfirmAddonCascadeOptions,
): Promise<RoleBranchPermissions> {
  await fakeDelay();
  if (!buildActorMeSync().isTenantOwner) {
    throw new ApiError(403, 'ROLE_BRANCH_OWNER_REQUIRED');
  }
  const role = store.roles.find((r) => r.id === id);
  if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND');
  if (role.isSystem) throw new ApiError(409, 'ROLE_IS_SYSTEM');

  if (body.expectedRevision !== String(role.branchRevision)) {
    throw new ApiError(409, 'ROLE_BRANCH_REVISION_CONFLICT');
  }
  if (body.catalogueRevision !== getCatalogueRevision()) {
    throw new ApiError(409, 'ROLE_BRANCH_CATALOGUE_CHANGED');
  }
  if (body.profiles.length > STAFF_LIMITS.branchProfiles) {
    throw new ApiError(422, 'ROLE_BRANCH_LIMIT_EXCEEDED');
  }

  const normalizedProfiles: { branchId: string; permissionIds: string[] }[] = [];
  const seenBranches = new Set<string>();

  for (const prof of body.profiles) {
    if (seenBranches.has(prof.branchId)) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    seenBranches.add(prof.branchId);

    const branch = store.branches.find((b) => b.id === prof.branchId);
    const company = branch ? store.companies.find((c) => c.id === branch.companyId) : undefined;
    if (!branch || branch.status !== 'ACTIVE' || company?.status !== 'ACTIVE') {
      throw new ApiError(422, 'ROLE_BRANCH_SCOPE_INVALID');
    }

    const uniquePerms = Array.from(new Set(prof.permissionIds));
    if (uniquePerms.length > STAFF_LIMITS.profilePermissions) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED');
    }
    for (const pid of uniquePerms) {
      const entry = CATALOGUE_BY_KEY.get(pid);
      if (!entry || entry.scope === 'TENANT') {
        throw new ApiError(422, 'ROLE_BRANCH_PERMISSION_INVALID');
      }
    }
    normalizedProfiles.push({ branchId: prof.branchId, permissionIds: uniquePerms });
  }

  checkSeatCascade(opts);

  role.permissionMode = 'BRANCH';
  role.permissionIds = [];
  role.profiles = normalizedProfiles;
  role.branchProfileCount = normalizedProfiles.length;
  role.permissionCount = normalizedProfiles.reduce((sum, p) => sum + p.permissionIds.length, 0);
  role.branchRevision += 1;
  role.updatedAt = nowIso();

  return clone(hydrateBranchPermissions(role));
}

// =========================================================================
// ROLE ASSIGNMENTS
// =========================================================================

export async function fakeListAssignmentOptions(userId: string, q: ListQuery = {}): Promise<AssignmentOptions> {
  await fakeDelay();
  const me = buildActorMeSync();
  if (userId === me.id) {
    throw new ApiError(403, 'ROLE_SELF_ASSIGNMENT_FORBIDDEN');
  }
  if (!actorCan('users.user.assign_roles')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');

  const activeBranches = store.branches.filter((b) => {
    const comp = store.companies.find((c) => c.id === b.companyId);
    return b.status === 'ACTIVE' && comp?.status === 'ACTIVE' && actorCan('users.user.assign_roles', { branchId: b.id });
  });
  const eligibleRoles = store.roles.filter((r) => r.name !== 'Tenant Super Admin');

  const allChoices: AssignmentOptions['choices'] = [];
  if (!user.isTenantOwner && user.status === 'ACTIVE') {
    for (const branch of activeBranches) {
      const held = actorHeldPermissionsOnBranch(branch.id);
      for (const role of eligibleRoles) {
        if (role.permissionMode === 'BRANCH' && !role.profiles.some((p) => p.branchId === branch.id)) {
          continue;
        }
        if (held !== null) {
          const reqIds =
            role.permissionMode === 'GLOBAL'
              ? role.permissionIds
              : (role.profiles.find((p) => p.branchId === branch.id)?.permissionIds ?? []);
          if (reqIds.some((pid) => !held.has(pid))) continue;
        }
        allChoices.push({
          branchId: branch.id,
          branchName: branch.name,
          roleId: role.id,
          roleName: role.name,
          roleNameI18n: { ...role.nameI18n },
        });
      }
    }
  }

  let filtered = allChoices;
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.branchName.toLowerCase().includes(term) ||
        c.roleName.toLowerCase().includes(term) ||
        c.roleNameI18n.en.toLowerCase().includes(term) ||
        c.roleNameI18n.ar.toLowerCase().includes(term),
    );
  }

  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(STAFF_LIMITS.pageSize, Math.max(1, q.limit ?? 25));
  const start = (page - 1) * limit;
  const choices = filtered.slice(start, start + limit);
  const hasMore = start + choices.length < filtered.length;

  const labels: AssignmentOptions['labels'] = [
    ...store.companies.map((c) => ({ kind: 'company' as const, id: c.id, name: c.name })),
    ...store.branches.map((b) => ({ kind: 'branch' as const, id: b.id, name: b.name })),
    ...store.roles.map((r) => ({ kind: 'role' as const, id: r.id, name: r.name, nameI18n: { ...r.nameI18n } })),
  ];

  return clone({ choices, hasMore, labels });
}

export async function fakeListBranchRoles(userId: string): Promise<BranchRoleAssignment[]> {
  await fakeDelay();
  const me = buildActorMeSync();
  if (userId === me.id) {
    throw new ApiError(403, 'ROLE_SELF_ASSIGNMENT_FORBIDDEN');
  }
  if (!actorCan('users.user.assign_roles')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  return clone(
    store.branchRoles.filter(
      (b) =>
        b.tenantUserId === userId &&
        actorCan('users.user.assign_roles', {
          companyId: findBranchCompanyId(b.branchId),
          branchId: b.branchId,
        }),
    ),
  );
}

function validateBranchRoleAssignment(user: TenantUser, branchId: string, roleId: string): { branch: Branch; role: StoredRole } {
  const me = buildActorMeSync();
  if (user.id === me.id) throw new ApiError(403, 'ROLE_SELF_ASSIGNMENT_FORBIDDEN');
  if (user.isTenantOwner) throw new ApiError(409, 'TENANT_OWNER_PROTECTED');
  if (user.status !== 'ACTIVE') throw new ApiError(404, 'TENANT_USER_NOT_FOUND');

  requireBranchPermission('users.user.assign_roles', branchId, 'BRANCH_ACCESS_DENIED');

  const branch = store.branches.find((b) => b.id === branchId);
  const role = store.roles.find((r) => r.id === roleId);
  if (!branch || !role) {
    throw new ApiError(422, 'BRANCH_OR_ROLE_INVALID');
  }
  if (role.name === 'Tenant Super Admin') {
    throw new ApiError(409, 'ROLE_RESERVED_FOR_OWNER');
  }
  if (role.permissionMode === 'BRANCH' && !role.profiles.some((p) => p.branchId === branchId)) {
    throw new ApiError(422, 'ROLE_BRANCH_SCOPE_INVALID');
  }
  checkBranchPrivilegeEscalation(role, branchId);
  return { branch, role };
}

export async function fakeSetBranchRoles(
  userId: string,
  assignments: { branchId: string; roleId: string }[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<BranchRoleAssignment[]> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');

  return checkIdempotency(`setBranchRoles:${userId}`, key, assignments, () => {
    if (assignments.length > STAFF_LIMITS.assignments) {
      throw new ApiError(422, 'TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED');
    }
    const seen = new Set<string>();
    const now = nowIso();
    const nextList: BranchRoleAssignment[] = [];

    for (const item of assignments) {
      validateBranchRoleAssignment(user, item.branchId, item.roleId);
      const pairKey = `${item.branchId}:${item.roleId}`;
      if (seen.has(pairKey)) throw new ApiError(409, 'ASSIGNMENT_EXISTS');
      seen.add(pairKey);
      const existing = store.branchRoles.find(
        (b) => b.tenantUserId === userId && b.branchId === item.branchId && b.roleId === item.roleId,
      );
      nextList.push(
        existing ?? {
          id: `bra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          branchId: item.branchId,
          roleId: item.roleId,
          createdAt: now,
          updatedAt: now,
        },
      );
    }

    checkSeatCascade(opts);
    store.branchRoles = [...store.branchRoles.filter((b) => b.tenantUserId !== userId), ...nextList];
    return nextList;
  });
}

export async function fakeAddBranchRole(
  userId: string,
  b: { branchId: string; roleId: string },
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<BranchRoleAssignment> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');

  return checkIdempotency(`addBranchRole:${userId}`, key, b, () => {
    validateBranchRoleAssignment(user, b.branchId, b.roleId);
    const current = store.branchRoles.filter((x) => x.tenantUserId === userId);
    if (current.length >= STAFF_LIMITS.assignments) {
      throw new ApiError(422, 'TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED');
    }
    if (current.some((x) => x.branchId === b.branchId && x.roleId === b.roleId)) {
      throw new ApiError(409, 'ASSIGNMENT_EXISTS');
    }
    checkSeatCascade(opts);
    const now = nowIso();
    const created: BranchRoleAssignment = {
      id: `bra-${fakeId().slice(-8)}`,
      tenantUserId: userId,
      branchId: b.branchId,
      roleId: b.roleId,
      createdAt: now,
      updatedAt: now,
    };
    store.branchRoles.push(created);
    return created;
  });
}

export async function fakeRemoveBranchRole(
  userId: string,
  assignmentId: string,
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<void> {
  await fakeDelay();
  const user = liveUsers().find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  const me = buildActorMeSync();
  if (user.id === me.id) throw new ApiError(403, 'ROLE_SELF_ASSIGNMENT_FORBIDDEN');
  if (user.isTenantOwner) throw new ApiError(409, 'TENANT_OWNER_PROTECTED');
  if (user.status !== 'ACTIVE') throw new ApiError(404, 'TENANT_USER_NOT_FOUND');

  checkIdempotency(`removeBranchRole:${userId}:${assignmentId}`, key, { userId, assignmentId }, () => {
    const idx = store.branchRoles.findIndex((x) => x.id === assignmentId && x.tenantUserId === userId);
    if (idx === -1) throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND');
    requireBranchPermission('users.user.assign_roles', store.branchRoles[idx].branchId, 'BRANCH_ACCESS_DENIED');
    checkSeatCascade(opts);
    store.branchRoles.splice(idx, 1);
  });
}

export async function fakeListScopeRoles(userId: string): Promise<ScopeRoleAssignment[]> {
  await fakeDelay();
  if (!buildActorMeSync().isTenantOwner) {
    throw new ApiError(403, 'SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED');
  }
  const user = liveUsers().find((u) => u.id === userId);
  if (!user || user.status !== 'ACTIVE') throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  syncScopeRolesActiveState();
  return clone(store.scopeRoles.filter((s) => s.tenantUserId === userId));
}

export async function fakeSetScopeRoles(
  userId: string,
  assignments: { scopeTarget: ScopeTarget; roleId: string; companyId?: string | null; branchId?: string | null }[],
  key: string,
  opts?: ConfirmAddonCascadeOptions,
): Promise<ScopeRoleAssignment[]> {
  await fakeDelay();
  const me = buildActorMeSync();
  if (userId === me.id) throw new ApiError(403, 'ROLE_SELF_ASSIGNMENT_FORBIDDEN');
  if (!me.isTenantOwner) {
    throw new ApiError(403, 'SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED');
  }
  const user = liveUsers().find((u) => u.id === userId);
  if (!user || user.status !== 'ACTIVE') throw new ApiError(404, 'TENANT_USER_NOT_FOUND');
  if (user.isTenantOwner) throw new ApiError(409, 'TENANT_OWNER_PROTECTED');

  return checkIdempotency(`setScopeRoles:${userId}`, key, assignments, () => {
    if (assignments.length > STAFF_LIMITS.assignments) {
      throw new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_LIMIT_EXCEEDED');
    }
    const invalidIndexes: number[] = [];
    const seen = new Set<string>();
    const existingKeys = new Set(
      store.scopeRoles
        .filter((s) => s.tenantUserId === userId)
        .map((s) => `${s.scopeTarget}:${s.companyId ?? ''}:${s.branchId ?? ''}:${s.roleId}`),
    );
    const now = nowIso();
    const nextList: ScopeRoleAssignment[] = [];

    assignments.forEach((item, index) => {
      const role = store.roles.find((r) => r.id === item.roleId);
      if (!role) {
        invalidIndexes.push(index);
        return;
      }
      if (role.name === 'Tenant Super Admin') {
        throw new ApiError(409, 'ROLE_RESERVED_FOR_OWNER');
      }

      const compId = item.companyId ?? null;
      const brId = item.branchId ?? null;
      const rowKey = `${item.scopeTarget}:${compId ?? ''}:${brId ?? ''}:${item.roleId}`;
      const wasExisting = existingKeys.has(rowKey);

      if (item.scopeTarget === 'TENANT') {
        if (compId || brId) {
          invalidIndexes.push(index);
          return;
        }
      } else if (item.scopeTarget === 'COMPANY') {
        const comp = store.companies.find((c) => c.id === compId);
        if (!compId || brId || !comp || (!wasExisting && comp.status !== 'ACTIVE')) {
          invalidIndexes.push(index);
          return;
        }
      } else if (item.scopeTarget === 'BRANCH') {
        const br = store.branches.find((b) => b.id === brId);
        const comp = br ? store.companies.find((c) => c.id === br.companyId) : undefined;
        if (!brId || (compId && br?.companyId !== compId) || !br || (!wasExisting && (br.status !== 'ACTIVE' || comp?.status !== 'ACTIVE'))) {
          invalidIndexes.push(index);
          return;
        }
      }

      if (seen.has(rowKey)) {
        throw new ApiError(409, 'SCOPE_ROLE_ASSIGNMENT_CONFLICT');
      }
      seen.add(rowKey);

      const existing = store.scopeRoles.find(
        (s) =>
          s.tenantUserId === userId &&
          s.scopeTarget === item.scopeTarget &&
          s.companyId === compId &&
          s.branchId === brId &&
          s.roleId === item.roleId,
      );
      nextList.push(
        existing ?? {
          id: `sra-${fakeId().slice(-8)}`,
          tenantUserId: userId,
          roleId: item.roleId,
          scopeTarget: item.scopeTarget,
          companyId: compId,
          branchId: brId,
          scopeActive: true,
          createdAt: now,
        },
      );
    });

    if (invalidIndexes.length > 0) {
      throw new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID', { indexes: invalidIndexes.map(String) });
    }

    checkSeatCascade(opts);
    store.scopeRoles = [...store.scopeRoles.filter((s) => s.tenantUserId !== userId), ...nextList];
    syncScopeRolesActiveState();
    return store.scopeRoles.filter((s) => s.tenantUserId === userId);
  });
}

// =========================================================================
// HELPERS & CURRENCIES
// =========================================================================

// FAKE-ONLY helper (no backend route): counts live holders across both assignment tables
export async function fakeRoleHolderCount(roleId: string): Promise<number> {
  await fakeDelay();
  return computeHoldersCount(roleId);
}

export async function fakeListCurrencies(q: ListQuery = {}): Promise<CorePage<Currency>> {
  await fakeDelay();
  if (!actorCan('currencies.currency.read')) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  return paginate(clone(store.currencies), q);
}

// FAKE-ONLY placeholder until the owner settles the seat rules; returns [] unless FAKE_SEAT_IMPACT is true
export async function fakePreviewSeatImpact(change: {
  roleId?: string;
  userId?: string;
  profiles?: { branchId: string; permissionIds: string[] }[];
  permissionIds?: string[];
  addBranchRoles?: { branchId: string; roleId: string }[];
}): Promise<SeatImpact[]> {
  await fakeDelay();
  if (!FAKE_SEAT_IMPACT) return [];

  const affectedHolders = new Set<string>();
  let grantsCrm = false;

  if (change.permissionIds?.some((k) => k.startsWith('crm.'))) {
    grantsCrm = true;
  }
  if (change.profiles?.some((p) => p.permissionIds.some((k) => k.startsWith('crm.')))) {
    grantsCrm = true;
  }
  if (change.roleId) {
    const liveIds = new Set(liveUsers().map((u) => u.id));
    for (const bra of store.branchRoles) {
      if (bra.roleId === change.roleId && liveIds.has(bra.tenantUserId)) affectedHolders.add(bra.tenantUserId);
    }
    for (const sra of store.scopeRoles) {
      if (sra.roleId === change.roleId && liveIds.has(sra.tenantUserId)) affectedHolders.add(sra.tenantUserId);
    }
    if (!change.permissionIds && !change.profiles) {
      const role = store.roles.find((r) => r.id === change.roleId);
      if (role?.permissionIds.some((k) => k.startsWith('crm.')) || role?.profiles.some((p) => p.permissionIds.some((k) => k.startsWith('crm.')))) {
        grantsCrm = true;
      }
    }
  }
  if (change.userId && change.addBranchRoles?.length) {
    for (const add of change.addBranchRoles) {
      const role = store.roles.find((r) => r.id === add.roleId);
      if (!role) continue;
      const roleHasCrm =
        role.permissionMode === 'GLOBAL'
          ? role.permissionIds.some((k) => k.startsWith('crm.'))
          : (role.profiles.find((p) => p.branchId === add.branchId)?.permissionIds.some((k) => k.startsWith('crm.')) ?? false);
      if (roleHasCrm) {
        grantsCrm = true;
        affectedHolders.add(change.userId);
      }
    }
  }

  return computeCrmSeatPreview(affectedHolders, grantsCrm);
}
