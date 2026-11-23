import { Language } from '../../../../../core/i18n/language';
import { CatalogueEntry, I18n, Permission } from '../../shared/staff.model';

export type PermissionRecordScope = 'OWN' | 'TEAM' | 'ALL';
export type PermissionTreeMode = 'BRANCH' | 'GLOBAL';
export type CheckState = 'none' | 'partial' | 'all';

export interface TreeEntry {
  id: string;
  key: string;
  label: I18n;
  module: I18n;
  moduleId: string;
  area: I18n;
  resource: I18n;
  resourceKey?: string;
  scope: 'BRANCH' | 'TENANT';
  recordScope: PermissionRecordScope | null;
}

export interface ActionNode {
  baseKey: string;
  label: I18n;
  variants: TreeEntry[];
  availableScopes: PermissionRecordScope[];
  broadestEntry: TreeEntry;
  hasScopes: boolean;
}

export interface ResourceNode {
  id: string;
  key?: string;
  label: I18n;
  actions: ActionNode[];
}

export interface AreaNode {
  id: string;
  label: I18n;
  resources: ResourceNode[];
}

export interface ModuleNode {
  id: string;
  label: I18n;
  areas: AreaNode[];
}

export interface PermissionHierarchy {
  modules: ModuleNode[];
  tenantModules: ModuleNode[];
  actionsByBase: Map<string, ActionNode>;
  actionById: Map<string, ActionNode>;
  entryById: Map<string, TreeEntry>;
  totalSelectableActions: number;
  totalTenantActions: number;
}

export interface ResolvedActionSelection {
  checked: boolean;
  activeEntry: TreeEntry;
  activeScope: PermissionRecordScope | null;
  matchedIds: string[];
  hasMultiScope: boolean;
}

export interface ProfileChipLabels {
  full: (moduleName: string) => string;
  viewOnly: string;
  none: string;
  custom: string;
}

const SCOPE_ORDER: readonly PermissionRecordScope[] = ['OWN', 'TEAM', 'ALL'];
const BROADEST_FIRST: readonly PermissionRecordScope[] = ['ALL', 'TEAM', 'OWN'];
const SCOPE_SUFFIX_RE = /\.(own|team|all)$/;

const MODULE_LABELS: Readonly<Record<string, { id: string; label: I18n }>> = {
  crm: { id: 'crm', label: { en: 'CRM', ar: 'إدارة العملاء' } },
  trade: { id: 'trade', label: { en: 'Trade', ar: 'التجارة' } },
  accounting: { id: 'accounting', label: { en: 'Accounting', ar: 'المحاسبة' } },
  workspace: { id: 'workspace', label: { en: 'Workspace', ar: 'مساحة العمل' } },
};

const ACTION_VERBS = new Set([
  'read',
  'create',
  'update',
  'delete',
  'manage',
  'list',
  'view',
  'assign',
  'export',
  'import',
  'publish',
  'archive',
  'restore',
  'preview',
  'render',
  'complete',
  'cancel',
  'convert',
  'approve',
  'submit',
  'issue',
  'adjust',
  'hold',
  'send',
]);

const RESOURCE_I18N: Readonly<Record<string, I18n>> = {
  lead: { en: 'Leads', ar: 'العملاء المحتملون' },
  leads: { en: 'Leads', ar: 'العملاء المحتملون' },
  customer: { en: 'Customers', ar: 'العملاء' },
  customers: { en: 'Customers', ar: 'العملاء' },
  customer_profile: { en: 'Customer profiles', ar: 'ملفات العملاء' },
  customer_profiles: { en: 'Customer profiles', ar: 'ملفات العملاء' },
  opportunity: { en: 'Opportunities', ar: 'الفرص البيعية' },
  opportunities: { en: 'Opportunities', ar: 'الفرص البيعية' },
  activity: { en: 'Activities', ar: 'الأنشطة' },
  activities: { en: 'Activities', ar: 'الأنشطة' },
  note: { en: 'Notes', ar: 'الملاحظات' },
  notes: { en: 'Notes', ar: 'الملاحظات' },
  attachment: { en: 'Attachments', ar: 'المرفقات' },
  attachments: { en: 'Attachments', ar: 'المرفقات' },
  email: { en: 'Outbound email', ar: 'البريد الإلكتروني الصادر' },
  pipeline: { en: 'Pipelines', ar: 'مسارات المبيعات' },
  pipelines: { en: 'Pipelines', ar: 'مسارات المبيعات' },
  stage: { en: 'Stages', ar: 'المراحل' },
  stages: { en: 'Stages', ar: 'المراحل' },
  lead_stage: { en: 'Lead stages', ar: 'مراحل العملاء المحتملين' },
  lead_stages: { en: 'Lead stages', ar: 'مراحل العملاء المحتملين' },
  source: { en: 'Acquisition sources', ar: 'مصادر الاستقطاب' },
  sources: { en: 'Acquisition sources', ar: 'مصادر الاستقطاب' },
  acquisition_source: { en: 'Acquisition sources', ar: 'مصادر الاستقطاب' },
  acquisition_sources: { en: 'Acquisition sources', ar: 'مصادر الاستقطاب' },
  tag: { en: 'Tags', ar: 'الوسوم' },
  tags: { en: 'Tags', ar: 'الوسوم' },
  custom_field: { en: 'Custom fields', ar: 'الحقول المخصصة' },
  custom_fields: { en: 'Custom fields', ar: 'الحقول المخصصة' },
  dashboard: { en: 'Dashboards', ar: 'لوحات المتابعة' },
  dashboards: { en: 'Dashboards', ar: 'لوحات المتابعة' },
  widget: { en: 'Widgets', ar: 'عناصر لوحات المتابعة' },
  widgets: { en: 'Widgets', ar: 'عناصر لوحات المتابعة' },
  target: { en: 'Sales targets', ar: 'أهداف المبيعات' },
  targets: { en: 'Sales targets', ar: 'أهداف المبيعات' },
  sla: { en: 'SLA policies', ar: 'سياسات مستوى الخدمة' },
  alert: { en: 'Metric alerts', ar: 'تنبيهات المؤشرات' },
  alerts: { en: 'Metric alerts', ar: 'تنبيهات المؤشرات' },
  subscription: { en: 'Subscriptions', ar: 'الاشتراكات' },
  subscriptions: { en: 'Subscriptions', ar: 'الاشتراكات' },
  export: { en: 'Exports', ar: 'التصديرات' },
  exports: { en: 'Exports', ar: 'التصديرات' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  inquiry_identity: { en: 'Inquiry identities', ar: 'هويات الاستفسارات' },
  inquiry_identities: { en: 'Inquiry identities', ar: 'هويات الاستفسارات' },
  report: { en: 'Reports', ar: 'التقارير' },
  reports: { en: 'Reports', ar: 'التقارير' },
  setting: { en: 'Settings', ar: 'الإعدادات' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  user: { en: 'Users', ar: 'المستخدمون' },
  users: { en: 'Users', ar: 'المستخدمون' },
  role: { en: 'Roles', ar: 'الأدوار' },
  roles: { en: 'Roles', ar: 'الأدوار' },
  company: { en: 'Companies', ar: 'الشركات' },
  companies: { en: 'Companies', ar: 'الشركات' },
  branch: { en: 'Branches', ar: 'الفروع' },
  branches: { en: 'Branches', ar: 'الفروع' },
  department: { en: 'Departments', ar: 'الإدارات' },
  departments: { en: 'Departments', ar: 'الإدارات' },
  team: { en: 'Teams', ar: 'الفرق' },
  teams: { en: 'Teams', ar: 'الفرق' },
  organization: { en: 'Organization', ar: 'الهيكل التنظيمي' },
  permission: { en: 'Permissions', ar: 'الصلاحيات' },
  permissions: { en: 'Permissions', ar: 'الصلاحيات' },
  currency: { en: 'Currencies', ar: 'العملات' },
  currencies: { en: 'Currencies', ar: 'العملات' },
  branding: { en: 'Branding', ar: 'الهوية البصرية' },
  geo: { en: 'Geography', ar: 'المناطق الجغرافية' },
  places: { en: 'Places', ar: 'الأماكن' },
  zones: { en: 'Zones', ar: 'المناطق' },
  numbering: { en: 'Numbering', ar: 'الترقيم' },
  tax: { en: 'Taxes', ar: 'الضرائب' },
  taxes: { en: 'Taxes', ar: 'الضرائب' },
  party: { en: 'Parties', ar: 'الأطراف' },
  contact: { en: 'Contacts', ar: 'جهات الاتصال' },
  address: { en: 'Addresses', ar: 'العناوين' },
  relationship: { en: 'Relationships', ar: 'العلاقات' },
  notification: { en: 'Notifications', ar: 'الإشعارات' },
  notifications: { en: 'Notifications', ar: 'الإشعارات' },
  preference: { en: 'Preferences', ar: 'التفضيلات' },
  workspace: { en: 'Workspace', ar: 'مساحة العمل' },
  billing: { en: 'Billing', ar: 'الفوترة' },
  audit: { en: 'Audit', ar: 'التدقيق' },
  templates: { en: 'Templates', ar: 'القوالب' },
  assets: { en: 'Assets', ar: 'الأصول' },
  assignments: { en: 'Assignments', ar: 'التعيينات' },
  functions: { en: 'Functions', ar: 'الدوال' },
  business_letters: { en: 'Business letters', ar: 'الخطابات التجارية' },
  webphone: { en: 'WebPhone', ar: 'الهاتف الشبكي' },
  extensions: { en: 'Extensions', ar: 'التحويلات' },
  addon_seats: { en: 'Add-on seats', ar: 'مقاعد الإضافات' },
  activation: { en: 'Activation', ar: 'التفعيل' },
  configuration: { en: 'Configuration', ar: 'الإعدادات' },
  addon_definitions: { en: 'Add-on definitions', ar: 'تعريفات الإضافات' },
  catalog_master: { en: 'Catalog master', ar: 'الكتالوج الرئيسي' },
  item: { en: 'Items', ar: 'الأصناف' },
  items: { en: 'Items', ar: 'الأصناف' },
  commercial_account: { en: 'Commercial accounts', ar: 'الحسابات التجارية' },
  commercial_accounts: { en: 'Commercial accounts', ar: 'الحسابات التجارية' },
  credit: { en: 'Credit', ar: 'الائتمان' },
  pricing: { en: 'Pricing', ar: 'التسعير' },
  policy: { en: 'Policies', ar: 'السياسات' },
  document_profiles: { en: 'Document profiles', ar: 'ملفات المستندات' },
  webhooks: { en: 'Webhooks', ar: 'خطافات الويب' },
  quotations: { en: 'Sales quotations', ar: 'عروض الأسعار البيعية' },
  product: { en: 'Products', ar: 'المنتجات' },
  products: { en: 'Products', ar: 'المنتجات' },
  quote: { en: 'Quotes', ar: 'عروض الأسعار' },
  quotes: { en: 'Quotes', ar: 'عروض الأسعار' },
  order: { en: 'Orders', ar: 'الطلبات' },
  orders: { en: 'Orders', ar: 'الطلبات' },
  sales_orders: { en: 'Sales orders', ar: 'أوامر البيع' },
  purchase_quotations: { en: 'Purchase quotations', ar: 'عروض أسعار الشراء' },
  purchase_orders: { en: 'Purchase orders', ar: 'أوامر الشراء' },
  invoice: { en: 'Invoices', ar: 'الفواتير' },
  invoices: { en: 'Invoices', ar: 'الفواتير' },
  contracts: { en: 'Contracts', ar: 'العقود' },
  inventory: { en: 'Inventory', ar: 'المخزون' },
  control_tower: { en: 'Control tower', ar: 'برج المراقبة' },
  account: { en: 'Accounts', ar: 'الحسابات' },
  accounts: { en: 'Accounts', ar: 'الحسابات' },
  bank_account: { en: 'Bank accounts', ar: 'الحسابات البنكية' },
  journal: { en: 'Journal', ar: 'القيود اليومية' },
  journal_draft: { en: 'Journal drafts', ar: 'مسودات القيود' },
  journal_entry: { en: 'Journal entries', ar: 'قيود اليومية' },
  payment_run: { en: 'Payment runs', ar: 'دفعات السداد' },
  period: { en: 'Periods', ar: 'الفترات المالية' },
  tax_return: { en: 'Tax returns', ar: 'الإقرارات الضريبية' },
};

export function pickI18n(value: I18n, language: Language): string {
  return language === 'ar' ? value.ar || value.en : value.en || value.ar;
}

export function baseKeyOf(key: string): string {
  return key.replace(SCOPE_SUFFIX_RE, '');
}

export function stripScopeLabel(label: I18n): I18n {
  return {
    en: label.en.split(' — ')[0].trim(),
    ar: label.ar.split(' — ')[0].trim(),
  };
}

export function fromCatalogue(entries: CatalogueEntry[]): TreeEntry[] {
  const allKeys = new Set(entries.map((entry) => entry.key));
  return entries.map((entry) => {
    const inferredScope = inferRecordScope(entry.key, entry.recordScope, allKeys);
    return {
      id: entry.id,
      key: entry.key,
      label: entry.nameI18n,
      module: entry.module.nameI18n,
      moduleId: entry.module.id,
      area: entry.groups[0].nameI18n,
      resource: entry.groups[1].nameI18n,
      resourceKey: entry.groups[1].id,
      scope: entry.scope,
      recordScope: inferredScope,
    };
  });
}

export function fromPermissions(perms: Permission[]): TreeEntry[] {
  const allKeys = new Set(perms.map((perm) => perm.key));
  return perms.map((perm) => {
    const baseSegments = baseKeyOf(perm.key).split('.');
    const prefix = (baseSegments[0] ?? '').toLowerCase();
    const moduleMeta = MODULE_LABELS[prefix] ?? MODULE_LABELS['workspace'];
    const rawResource =
      baseSegments.length >= 3 && !ACTION_VERBS.has((baseSegments[1] ?? '').toLowerCase())
        ? baseSegments[1]
        : baseSegments[0] ?? perm.group;
    const resourceKey = rawResource.toLowerCase();
    const resource = resourceI18n(resourceKey);

    return {
      id: perm.id,
      key: perm.key,
      label: perm.descriptionI18n ?? { en: perm.nameEn, ar: perm.nameAr },
      module: moduleMeta.label,
      moduleId: moduleMeta.id,
      area: perm.groupI18n,
      resource,
      resourceKey,
      scope: 'TENANT',
      recordScope: inferRecordScope(perm.key, null, allKeys),
    };
  });
}

export function buildPermissionHierarchy(entries: TreeEntry[], mode: PermissionTreeMode): PermissionHierarchy {
  const normalizedEntries = normalizeEntryRecordScopes(entries);
  const selectable = mode === 'GLOBAL' ? normalizedEntries : normalizedEntries.filter((e) => e.scope === 'BRANCH');
  const tenantOnly = mode === 'BRANCH' ? normalizedEntries.filter((e) => e.scope === 'TENANT') : [];

  const actionsByBase = new Map<string, ActionNode>();
  const actionById = new Map<string, ActionNode>();
  const entryById = new Map<string, TreeEntry>();

  for (const entry of normalizedEntries) {
    entryById.set(entry.id, entry);
  }

  const modules = groupEntriesIntoModules(selectable, actionsByBase, actionById);
  const tenantModules = groupEntriesIntoModules(tenantOnly);

  let totalSelectableActions = 0;
  for (const mod of modules) {
    for (const area of mod.areas) {
      for (const res of area.resources) {
        totalSelectableActions += res.actions.length;
      }
    }
  }

  let totalTenantActions = 0;
  for (const mod of tenantModules) {
    for (const area of mod.areas) {
      for (const res of area.resources) {
        totalTenantActions += res.actions.length;
      }
    }
  }

  return {
    modules,
    tenantModules,
    actionsByBase,
    actionById,
    entryById,
    totalSelectableActions,
    totalTenantActions,
  };
}

export function resolveActionSelection(
  action: ActionNode,
  selectedIds: ReadonlySet<string>,
): ResolvedActionSelection {
  const matched = action.variants.filter((variant) => selectedIds.has(variant.id));
  if (matched.length === 0) {
    return {
      checked: false,
      activeEntry: action.broadestEntry,
      activeScope: action.broadestEntry.recordScope,
      matchedIds: [],
      hasMultiScope: false,
    };
  }

  const activeEntry = pickBroadestEntry(matched);
  return {
    checked: true,
    activeEntry,
    activeScope: activeEntry.recordScope,
    matchedIds: matched.map((v) => v.id),
    hasMultiScope: matched.length > 1,
  };
}

export function normalizeBranchPermissionIds(
  entries: TreeEntry[],
  rawIds: Iterable<string>,
  mode: PermissionTreeMode = 'BRANCH',
): string[] {
  const hierarchy = buildPermissionHierarchy(entries, mode);
  const rawSet = new Set(rawIds);
  const normalized: string[] = [];

  for (const mod of hierarchy.modules) {
    for (const area of mod.areas) {
      for (const res of area.resources) {
        for (const action of res.actions) {
          const resolved = resolveActionSelection(action, rawSet);
          if (resolved.checked) {
            normalized.push(resolved.activeEntry.id);
          }
        }
      }
    }
  }

  return normalized;
}

export function countEffectivePermissions(
  hierarchy: PermissionHierarchy,
  selectedIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const action of hierarchy.actionsByBase.values()) {
    if (action.variants.some((variant) => selectedIds.has(variant.id))) {
      count += 1;
    }
  }
  return count;
}

export function computeCheckState(selectedCount: number, totalCount: number): CheckState {
  if (totalCount === 0 || selectedCount <= 0) return 'none';
  if (selectedCount >= totalCount) return 'all';
  return 'partial';
}

export function isReadLikeKey(key: string): boolean {
  const base = baseKeyOf(key).toLowerCase();
  const segments = base.split('.');
  return segments.includes('read') || segments.includes('view') || segments.includes('list');
}

export function computeProfileChip(
  entries: TreeEntry[],
  selectedIds: ReadonlySet<string>,
  language: Language,
  labels: ProfileChipLabels,
): string {
  const hierarchy = buildPermissionHierarchy(entries, 'BRANCH');
  const selectedTotal = countEffectivePermissions(hierarchy, selectedIds);
  if (selectedTotal === 0) return labels.none;

  const moduleChips: string[] = [];
  let hasNonFullCustom = false;
  let allModulesViewOnly = true;

  for (const mod of hierarchy.modules) {
    const actions = mod.areas.flatMap((area) => area.resources.flatMap((res) => res.actions));
    if (actions.length === 0) continue;

    let selectedInModule = 0;
    let allBroadestInModule = true;
    let moduleViewOnly = true;

    for (const action of actions) {
      const resolved = resolveActionSelection(action, selectedIds);
      if (!resolved.checked) {
        allBroadestInModule = false;
        continue;
      }
      selectedInModule += 1;
      if (resolved.activeEntry.id !== action.broadestEntry.id) {
        allBroadestInModule = false;
      }
      if (!isReadLikeKey(resolved.activeEntry.key)) {
        moduleViewOnly = false;
      }
    }

    if (selectedInModule === 0) continue;

    if (selectedInModule === actions.length && allBroadestInModule) {
      moduleChips.push(labels.full(pickI18n(mod.label, language)));
      allModulesViewOnly = false;
    } else {
      hasNonFullCustom = true;
      if (!moduleViewOnly) {
        allModulesViewOnly = false;
      }
    }
  }

  if (hasNonFullCustom) {
    if (moduleChips.length === 0) {
      return allModulesViewOnly ? labels.viewOnly : labels.custom;
    }
    moduleChips.push(allModulesViewOnly ? labels.viewOnly : labels.custom);
  }

  return moduleChips.length > 0 ? moduleChips.join(' · ') : labels.none;
}

function inferRecordScope(
  key: string,
  explicit: PermissionRecordScope | null,
  allKeys: ReadonlySet<string>,
): PermissionRecordScope | null {
  if (explicit) return explicit;
  if (key.endsWith('.all')) return 'ALL';
  if (key.endsWith('.team')) return 'TEAM';
  if (key.endsWith('.own')) return 'OWN';
  if (allKeys.has(`${key}.all`) || allKeys.has(`${key}.team`) || allKeys.has(`${key}.own`)) {
    return 'OWN';
  }
  return null;
}

function normalizeEntryRecordScopes(entries: TreeEntry[]): TreeEntry[] {
  const allKeys = new Set(entries.map((entry) => entry.key));
  return entries.map((entry) => {
    const inferred = inferRecordScope(entry.key, entry.recordScope, allKeys);
    return inferred === entry.recordScope ? entry : { ...entry, recordScope: inferred };
  });
}

function groupEntriesIntoModules(
  entries: TreeEntry[],
  actionsByBase?: Map<string, ActionNode>,
  actionById?: Map<string, ActionNode>,
): ModuleNode[] {
  const modules: ModuleNode[] = [];
  const modMap = new Map<
    string,
    {
      node: ModuleNode;
      areas: Map<
        string,
        {
          node: AreaNode;
          resources: Map<string, { node: ResourceNode; actions: Map<string, TreeEntry[]> }>;
        }
      >;
    }
  >();

  for (const entry of entries) {
    let modBucket = modMap.get(entry.moduleId);
    if (!modBucket) {
      const modNode: ModuleNode = { id: entry.moduleId, label: entry.module, areas: [] };
      modBucket = { node: modNode, areas: new Map() };
      modMap.set(entry.moduleId, modBucket);
      modules.push(modNode);
    }

    const areaKey = `${entry.moduleId}::${entry.area.en}::${entry.area.ar}`;
    let areaBucket = modBucket.areas.get(areaKey);
    if (!areaBucket) {
      const areaNode: AreaNode = { id: areaKey, label: entry.area, resources: [] };
      areaBucket = { node: areaNode, resources: new Map() };
      modBucket.areas.set(areaKey, areaBucket);
      modBucket.node.areas.push(areaNode);
    }

    const resKey = `${areaKey}::${entry.resource.en}::${entry.resource.ar}`;
    let resBucket = areaBucket.resources.get(resKey);
    if (!resBucket) {
      const resNode: ResourceNode = {
        id: resKey,
        key: entry.resourceKey,
        label: entry.resource,
        actions: [],
      };
      resBucket = { node: resNode, actions: new Map() };
      areaBucket.resources.set(resKey, resBucket);
      areaBucket.node.resources.push(resNode);
    }

    const baseKey = baseKeyOf(entry.key);
    let list = resBucket.actions.get(baseKey);
    if (!list) {
      list = [];
      resBucket.actions.set(baseKey, list);
    }
    list.push(entry);
  }

  for (const modBucket of modMap.values()) {
    for (const areaBucket of modBucket.areas.values()) {
      for (const resBucket of areaBucket.resources.values()) {
        for (const [baseKey, variants] of resBucket.actions.entries()) {
          const actionNode = buildActionNode(baseKey, variants);
          resBucket.node.actions.push(actionNode);
          if (actionsByBase) {
            actionsByBase.set(baseKey, actionNode);
          }
          if (actionById) {
            for (const v of actionNode.variants) {
              actionById.set(v.id, actionNode);
            }
          }
        }
      }
    }
  }

  return modules;
}

function buildActionNode(baseKey: string, variants: TreeEntry[]): ActionNode {
  const sorted = variants.slice().sort((a, b) => scopeRank(a.recordScope) - scopeRank(b.recordScope));
  const allVariant = sorted.find((v) => v.recordScope === 'ALL');
  const labelSource = allVariant ?? sorted[0];
  const label = stripScopeLabel(labelSource.label);
  const availableScopes = SCOPE_ORDER.filter((scope) => sorted.some((v) => v.recordScope === scope));
  const hasScopes = availableScopes.length > 0;
  const broadestEntry = pickBroadestEntry(sorted);

  return {
    baseKey,
    label,
    variants: sorted,
    availableScopes,
    broadestEntry,
    hasScopes,
  };
}

function scopeRank(scope: PermissionRecordScope | null): number {
  if (scope === 'OWN') return 0;
  if (scope === 'TEAM') return 1;
  if (scope === 'ALL') return 2;
  return 3;
}

function pickBroadestEntry(entries: TreeEntry[]): TreeEntry {
  for (const scope of BROADEST_FIRST) {
    const match = entries.find((entry) => entry.recordScope === scope);
    if (match) return match;
  }
  return entries[0];
}

function resourceI18n(segment: string): I18n {
  const key = segment.toLowerCase();
  const known = RESOURCE_I18N[key];
  if (known) return known;
  const cleaned = segment.replace(/[_-]+/g, ' ').trim();
  const humanized = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : segment;
  return { en: humanized, ar: humanized };
}
