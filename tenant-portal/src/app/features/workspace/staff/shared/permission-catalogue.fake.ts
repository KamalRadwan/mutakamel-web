import { CatalogueEntry, I18n, Permission } from './staff.model';

export let FAKE_CATALOGUE_CHANGED = false;

export function setFakeCatalogueChanged(changed: boolean): void {
  FAKE_CATALOGUE_CHANGED = changed;
}

export function getCatalogueRevision(): string {
  return FAKE_CATALOGUE_CHANGED
    ? 'sha256:b2c4e8f019d3478a91c56d23456789abcdef0123456789abcdef012345678902'
    : 'sha256:a1b3c7d908e2367f80b45c123456789abcdef0123456789abcdef012345678901';
}

interface RawSpec {
  readonly key: string;
  readonly en: string;
  readonly ar: string;
  readonly module: { id: string; nameI18n: I18n };
  readonly area: { id: string; nameI18n: I18n };
  readonly resource: { id: string; nameI18n: I18n };
  readonly scope: 'BRANCH' | 'TENANT';
  readonly recordScope: 'OWN' | 'TEAM' | 'ALL' | null;
  readonly groupKey: string;
  readonly groupI18n: I18n;
  readonly missingFromBranchCatalogue?: boolean;
  readonly permEn?: string;
  readonly permAr?: string;
  readonly descriptionI18n?: I18n;
}

const MOD_CORE: { id: string; nameI18n: I18n } = {
  id: 'core',
  nameI18n: { en: 'Workspace', ar: 'مساحة العمل' },
};

const MOD_CRM: { id: string; nameI18n: I18n } = {
  id: 'crm',
  nameI18n: { en: 'Customer relationship management', ar: 'إدارة علاقات العملاء' },
};

const MOD_TRADE: { id: string; nameI18n: I18n } = {
  id: 'trade',
  nameI18n: { en: 'Trade', ar: 'التجارة' },
};

const MOD_CORE_SETTINGS_FALLBACK: { id: string; nameI18n: I18n } = {
  id: 'core-settings',
  nameI18n: { en: 'Workspace settings', ar: 'إعدادات مساحة العمل' },
};

const FALLBACK_GROUPS: [{ id: string; nameI18n: I18n }, { id: string; nameI18n: I18n }] = [
  { id: 'core-workspace-channels', nameI18n: { en: 'Workspace channels', ar: 'قنوات مساحة العمل' } },
  { id: 'core-general-governance', nameI18n: { en: 'General governance', ar: 'الحوكمة العامة' } },
];

const FALLBACK_NAME: I18n = {
  en: 'Workspace permission',
  ar: 'صلاحية على مستوى مساحة العمل',
};

function area(id: string, en: string, ar: string) {
  return { id, nameI18n: { en, ar } };
}

function res(id: string, en: string, ar: string) {
  return { id, nameI18n: { en, ar } };
}

function core(
  key: string,
  en: string,
  ar: string,
  areaInfo: { id: string; nameI18n: I18n },
  resInfo: { id: string; nameI18n: I18n },
  scope: 'BRANCH' | 'TENANT',
  recordScope: 'OWN' | 'TEAM' | 'ALL' | null = null,
): RawSpec {
  return {
    key,
    en,
    ar,
    module: MOD_CORE,
    area: areaInfo,
    resource: resInfo,
    scope,
    recordScope,
    groupKey: areaInfo.id,
    groupI18n: areaInfo.nameI18n,
  };
}

function crm(
  key: string,
  en: string,
  ar: string,
  areaInfo: { id: string; nameI18n: I18n },
  resInfo: { id: string; nameI18n: I18n },
  scope: 'BRANCH' | 'TENANT',
  recordScope: 'OWN' | 'TEAM' | 'ALL' | null = null,
): RawSpec {
  return {
    key,
    en,
    ar,
    module: MOD_CRM,
    area: areaInfo,
    resource: resInfo,
    scope,
    recordScope,
    groupKey: `crm.${resInfo.id}`,
    groupI18n: resInfo.nameI18n,
  };
}

function crmTriad(
  baseKey: string,
  enVerbThing: string,
  arVerbThing: string,
  areaInfo: { id: string; nameI18n: I18n },
  resInfo: { id: string; nameI18n: I18n },
  scope: 'BRANCH' | 'TENANT' = 'BRANCH',
): RawSpec[] {
  return [
    crm(`${baseKey}.own`, `${enVerbThing} — own records`, `${arVerbThing} — سجلاتي فقط`, areaInfo, resInfo, scope, 'OWN'),
    crm(`${baseKey}.team`, `${enVerbThing} — team records`, `${arVerbThing} — سجلات فريقي`, areaInfo, resInfo, scope, 'TEAM'),
    crm(`${baseKey}.all`, `${enVerbThing} — all branch records`, `${arVerbThing} — كل سجلات الفرع`, areaInfo, resInfo, scope, 'ALL'),
  ];
}

function crmMissing(
  key: string,
  resId: string,
  resEn: string,
  resAr: string,
  descriptionEn?: string,
): RawSpec {
  const humanized = key.replace(/^crm\./, '').replace(/[._]/g, ' ');
  return {
    key,
    en: FALLBACK_NAME.en,
    ar: FALLBACK_NAME.ar,
    module: MOD_CORE_SETTINGS_FALLBACK,
    area: FALLBACK_GROUPS[0],
    resource: FALLBACK_GROUPS[1],
    scope: 'TENANT',
    recordScope: null,
    groupKey: `crm.${resId}`,
    groupI18n: { en: resEn, ar: resAr },
    missingFromBranchCatalogue: true,
    permEn: descriptionEn ?? humanized,
    permAr: FALLBACK_NAME.ar,
    descriptionI18n: descriptionEn ? { en: descriptionEn, ar: FALLBACK_NAME.ar } : undefined,
  };
}

function humanizeSegment(seg: string): string {
  const spaced = seg.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function trade(
  key: string,
  en: string,
  ar: string,
  areaInfo: { id: string; nameI18n: I18n },
  resInfo: { id: string; nameI18n: I18n },
  scope: 'BRANCH' | 'TENANT' = 'BRANCH',
): RawSpec {
  return {
    key,
    en,
    ar,
    module: MOD_TRADE,
    area: areaInfo,
    resource: resInfo,
    scope,
    recordScope: null,
    groupKey: `trade.${resInfo.id}`,
    groupI18n: resInfo.nameI18n,
  };
}

// --- Core Areas ---
const A_ORG = area('org', 'Organization', 'الهيكل التنظيمي');
const A_USERS = area('users', 'Users', 'المستخدمون');
const A_ROLES = area('roles', 'Roles & Permissions', 'الأدوار والصلاحيات');
const A_BRANDING = area('branding', 'Branding', 'الهوية البصرية');
const A_GEO = area('geo', 'Geography', 'المناطق الجغرافية');
const A_CURRENCIES = area('currencies', 'Currencies', 'العملات');
const A_NUMBERING = area('numbering', 'Numbering', 'تسلسلات الترقيم');
const A_TAXES = area('taxes', 'Taxes', 'الضرائب');
const A_DIRECTORY = area('directory', 'Directory', 'دليل الأطراف');
const A_NOTIFICATIONS = area('notifications', 'Notifications', 'الإشعارات');
const A_WORKSPACE = area('workspace', 'Settings', 'إعدادات مساحة العمل');
const A_AUDIT = area('audit', 'Audit', 'التدقيق');
const A_TEMPLATES = area('templates', 'Templates', 'القوالب');
const A_ACTIVITIES = area('activities', 'Activities', 'الأنشطة');
const A_LETTERS = area('business_letters', 'Business Letters', 'الخطابات التجارية');
const A_WEBPHONE = area('webphone', 'WebPhone', 'الهاتف الشبكي');
const A_APPS = area('applications', 'Applications', 'التطبيقات');

// --- Core Resources ---
const R_COMPANY = res('company', 'Companies', 'الشركات');
const R_BRANCH = res('branch', 'Branches', 'الفروع');
const R_DEPT = res('department', 'Departments', 'الإدارات');
const R_TEAM = res('team', 'Teams', 'الفرق');
const R_USER = res('user', 'Users', 'المستخدمون');
const R_ROLE = res('role', 'Roles', 'الأدوار');
const R_PERM = res('permission', 'Permissions', 'الصلاحيات');
const R_BRANDING = res('branding', 'Branding', 'الهوية البصرية');
const R_GEO = res('geo', 'Geography', 'المناطق الجغرافية');
const R_CURRENCY = res('currency', 'Currencies', 'العملات');
const R_NUMBERING = res('numbering', 'Numbering', 'الترقيم');
const R_TAX = res('tax', 'Taxes', 'الضرائب');
const R_PARTY = res('party', 'Parties', 'الأطراف');
const R_DIR_OTHER = res('directory', 'Party details & settings', 'تفاصيل الأطراف وإعداداتها');
const R_NOTIF = res('notifications', 'Notifications & preferences', 'الإشعارات والتفضيلات');
const R_WS = res('workspace', 'Workspace & email settings', 'إعدادات المساحة والبريد');
const R_AUDIT = res('audit', 'Audit log', 'سجل التدقيق');
const R_TPL = res('templates', 'Templates & functions', 'القوالب والدوال');
const R_ACT = res('activities', 'Activities', 'الأنشطة');
const R_LETTER = res('business_letters', 'Business letters', 'الخطابات التجارية');
const R_WEBPHONE = res('webphone', 'WebPhone', 'الهاتف الشبكي');
const R_APPS = res('applications', 'Applications & add-ons', 'التطبيقات والإضافات');

const CORE_SPECS: RawSpec[] = [
  // Organization (8)
  core('org.company.read', 'View companies', 'عرض الشركات', A_ORG, R_COMPANY, 'BRANCH'),
  core('org.company.manage', 'Create, update & delete companies', 'إنشاء الشركات وتحديثها وحذفها', A_ORG, R_COMPANY, 'TENANT'),
  core('org.branch.read', 'View branches', 'عرض الفروع', A_ORG, R_BRANCH, 'BRANCH'),
  core('org.branch.manage', 'Create, update & delete branches', 'إنشاء الفروع وتحديثها وحذفها', A_ORG, R_BRANCH, 'BRANCH'),
  core('org.department.read', 'View departments', 'عرض الإدارات', A_ORG, R_DEPT, 'BRANCH'),
  core('org.department.manage', 'Create, update & delete departments', 'إنشاء الإدارات وتحديثها وحذفها', A_ORG, R_DEPT, 'BRANCH'),
  core('org.team.read', 'View teams', 'عرض الفرق', A_ORG, R_TEAM, 'BRANCH'),
  core('org.team.manage', 'Create, update & delete teams', 'إنشاء الفرق وتحديثها وحذفها', A_ORG, R_TEAM, 'BRANCH'),

  // Users (8)
  core('users.user.read', 'View workspace users', 'عرض مستخدمي مساحة العمل', A_USERS, R_USER, 'BRANCH'),
  core('users.user.invite', 'Invite a workspace user', 'دعوة مستخدم لمساحة العمل', A_USERS, R_USER, 'BRANCH'),
  core('users.user.update', 'Update a workspace user', 'تحديث مستخدم مساحة العمل', A_USERS, R_USER, 'BRANCH'),
  core('users.user.manage_modules', 'Manage user module seats', 'إدارة مقاعد التطبيقات للمستخدم', A_USERS, R_USER, 'TENANT'),
  core('users.user.assign_roles', 'Assign branch-scoped roles to a user', 'تعيين أدوار مرتبطة بالفروع لمستخدم', A_USERS, R_USER, 'BRANCH'),
  core('users.user.manage_memberships', 'Manage team memberships for a user', 'إدارة عضويات الفرق لمستخدم', A_USERS, R_USER, 'BRANCH'),
  core('users.user.deactivate', 'Deactivate or reactivate a user', 'تعطيل أو إعادة تفعيل مستخدم', A_USERS, R_USER, 'BRANCH'),
  core('users.user.delete', 'Delete a workspace user', 'حذف مستخدم مساحة العمل', A_USERS, R_USER, 'BRANCH'),

  // Roles & Permissions (5)
  core('roles.role.read', 'View roles', 'عرض الأدوار', A_ROLES, R_ROLE, 'TENANT'),
  core('roles.role.create', 'Create a role', 'إنشاء دور', A_ROLES, R_ROLE, 'TENANT'),
  core('roles.role.update', 'Update a role', 'تحديث دور', A_ROLES, R_ROLE, 'TENANT'),
  core('roles.role.delete', 'Delete a role', 'حذف دور', A_ROLES, R_ROLE, 'TENANT'),
  core('roles.permission.read', 'View the permission catalogue', 'عرض كتالوج الصلاحيات', A_ROLES, R_PERM, 'TENANT'),

  // Branding (2)
  core('branding.read', 'View branding settings', 'عرض إعدادات الهوية البصرية', A_BRANDING, R_BRANDING, 'TENANT'),
  core('branding.manage', 'Update branding & theming', 'تحديث الهوية البصرية والثيم', A_BRANDING, R_BRANDING, 'TENANT'),

  // Geography (2)
  core('geo.places.manage', 'Manage cities and districts', 'إدارة المدن والأحياء', A_GEO, R_GEO, 'TENANT'),
  core('geo.zones.manage', 'Manage zones', 'إدارة مناطق التغطية', A_GEO, R_GEO, 'TENANT'),

  // Currencies (2)
  core('currencies.currency.read', 'View enabled currencies', 'عرض العملات المفعلة', A_CURRENCIES, R_CURRENCY, 'TENANT'),
  core('currencies.currency.manage', 'Enable, disable & configure currencies', 'تفعيل العملات وتعطيلها وإعدادها', A_CURRENCIES, R_CURRENCY, 'TENANT'),

  // Numbering (2)
  core('numbering.read', 'View numbering sequences', 'عرض تسلسلات الترقيم', A_NUMBERING, R_NUMBERING, 'TENANT'),
  core('numbering.manage', 'Create & update numbering sequences', 'إنشاء وتحديث تسلسلات الترقيم', A_NUMBERING, R_NUMBERING, 'TENANT'),

  // Taxes (2)
  core('taxes.tax.read', 'View taxes', 'عرض الضرائب', A_TAXES, R_TAX, 'TENANT'),
  core('taxes.tax.manage', 'Create, update & delete taxes', 'إنشاء الضرائب وتحديثها وحذفها', A_TAXES, R_TAX, 'TENANT'),

  // Directory (7)
  core('directory.party.read', 'View people and organizations', 'عرض الأشخاص والشركات', A_DIRECTORY, R_PARTY, 'BRANCH'),
  core('directory.party.manage', 'Create, update & delete people and organizations', 'إنشاء الأشخاص والشركات وتحديثها وحذفها', A_DIRECTORY, R_PARTY, 'BRANCH'),
  core('directory.contact.manage', 'Manage party contact methods', 'إدارة وسائل تواصل الأطراف', A_DIRECTORY, R_DIR_OTHER, 'BRANCH'),
  core('directory.address.manage', 'Manage party addresses', 'إدارة عناوين الأطراف', A_DIRECTORY, R_DIR_OTHER, 'BRANCH'),
  core('directory.role.manage', 'Manage party business roles', 'إدارة أدوار الأطراف التجارية', A_DIRECTORY, R_DIR_OTHER, 'BRANCH'),
  core('directory.relationship.manage', 'Manage party relationships', 'إدارة علاقات الأطراف', A_DIRECTORY, R_DIR_OTHER, 'BRANCH'),
  core('directory.settings.manage', 'Manage directory validation settings', 'إدارة إعدادات تحقق دليل الأطراف', A_DIRECTORY, R_DIR_OTHER, 'TENANT'),

  // Notifications (3)
  core('notifications.notification.read', 'View workspace notifications', 'عرض إشعارات مساحة العمل', A_NOTIFICATIONS, R_NOTIF, 'TENANT'),
  core('notifications.preference.read', 'View notification preferences', 'عرض تفضيلات الإشعارات', A_NOTIFICATIONS, R_NOTIF, 'TENANT'),
  core('notifications.preference.manage', 'Manage notification preferences', 'إدارة تفضيلات الإشعارات', A_NOTIFICATIONS, R_NOTIF, 'TENANT'),

  // Settings / Workspace (4)
  core('workspace.read', 'View workspace settings', 'عرض إعدادات مساحة العمل', A_WORKSPACE, R_WS, 'TENANT'),
  core('workspace.manage', 'Update workspace settings', 'تحديث إعدادات مساحة العمل', A_WORKSPACE, R_WS, 'TENANT'),
  core('workspace.email.read', 'View tenant email configuration', 'عرض إعدادات البريد الإلكتروني للمستأجر', A_WORKSPACE, R_WS, 'TENANT'),
  core('workspace.email.manage', 'Manage and verify tenant email configuration', 'إدارة إعدادات البريد الإلكتروني للمستأجر والتحقق منها', A_WORKSPACE, R_WS, 'TENANT'),

  // Audit (3)
  core('audit.read', 'View workspace audit log', 'عرض سجل تدقيق مساحة العمل', A_AUDIT, R_AUDIT, 'TENANT'),
  core('audit.read.branch', 'View audit log in authorized branches', 'عرض سجل التدقيق للفروع المصرح بها', A_AUDIT, R_AUDIT, 'BRANCH'),
  core('audit.read.own', 'View own audit log', 'عرض سجل التدقيق الخاص بالمستخدم', A_AUDIT, R_AUDIT, 'BRANCH', 'OWN'),

  // Templates (13)
  core('templates.read', 'View templates and version history', 'عرض القوالب وسجل الإصدارات', A_TEMPLATES, R_TPL, 'BRANCH'),
  core('templates.create', 'Create and duplicate templates', 'إنشاء القوالب ونسخها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.update', 'Edit and validate template drafts', 'تحرير مسودات القوالب والتحقق منها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.archive', 'Archive and restore templates', 'أرشفة القوالب واستعادتها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.assets.manage', 'Manage template assets', 'إدارة أصول القوالب', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.publish', 'Publish and retire template versions', 'نشر إصدارات القوالب وإيقافها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.restore', 'Restore historical template content', 'استعادة محتوى القوالب التاريخي', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.assignments.manage', 'Manage template assignments', 'إدارة تعيينات القوالب', A_TEMPLATES, R_TPL, 'BRANCH'),
  core('templates.preview', 'Preview templates safely', 'معاينة القوالب بأمان', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.render', 'Render governed production templates', 'تشغيل قوالب الإنتاج المحكومة', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.functions.read', 'View template functions', 'عرض دوال القوالب وإصداراتها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.functions.manage', 'Manage template functions', 'إدارة دوال القوالب والتحقق منها', A_TEMPLATES, R_TPL, 'TENANT'),
  core('templates.functions.publish', 'Publish template functions', 'نشر إصدارات دوال القوالب', A_TEMPLATES, R_TPL, 'TENANT'),

  // Activities (10)
  core('activities.read', 'View activities assigned to or created by the user', 'عرض الأنشطة المسندة إلى المستخدم أو التي أنشأها', A_ACTIVITIES, R_ACT, 'BRANCH', 'OWN'),
  core('activities.read.all', 'View all activities in an authorized branch', 'عرض جميع الأنشطة في فرع مصرح به', A_ACTIVITIES, R_ACT, 'BRANCH', 'ALL'),
  core('activities.create', 'Create activities', 'إنشاء الأنشطة', A_ACTIVITIES, R_ACT, 'BRANCH'),
  core('activities.update', 'Update own or assigned activities', 'تحديث الأنشطة الخاصة أو المسندة إلى المستخدم', A_ACTIVITIES, R_ACT, 'BRANCH', 'OWN'),
  core('activities.update.all', 'Update all activities in an authorized branch', 'تحديث جميع الأنشطة في فرع مصرح به', A_ACTIVITIES, R_ACT, 'BRANCH', 'ALL'),
  core('activities.complete', 'Complete own or assigned activities', 'إكمال الأنشطة الخاصة أو المسندة إلى المستخدم', A_ACTIVITIES, R_ACT, 'BRANCH', 'OWN'),
  core('activities.complete.all', 'Complete all activities in an authorized branch', 'إكمال جميع الأنشطة في فرع مصرح به', A_ACTIVITIES, R_ACT, 'BRANCH', 'ALL'),
  core('activities.cancel', 'Cancel own or assigned activities', 'إلغاء الأنشطة الخاصة أو المسندة إلى المستخدم', A_ACTIVITIES, R_ACT, 'BRANCH', 'OWN'),
  core('activities.cancel.all', 'Cancel all activities in an authorized branch', 'إلغاء جميع الأنشطة في فرع مصرح به', A_ACTIVITIES, R_ACT, 'BRANCH', 'ALL'),
  core('activities.assign', 'Assign activities to another eligible user', 'إسناد الأنشطة إلى مستخدم آخر مؤهل', A_ACTIVITIES, R_ACT, 'BRANCH'),

  // Business Letters (5)
  core('business_letters.read', 'View business letters', 'عرض الخطابات التجارية', A_LETTERS, R_LETTER, 'TENANT'),
  core('business_letters.create', 'Create business letters', 'إنشاء الخطابات التجارية', A_LETTERS, R_LETTER, 'TENANT'),
  core('business_letters.update', 'Update business letters', 'تحديث الخطابات التجارية', A_LETTERS, R_LETTER, 'TENANT'),
  core('business_letters.issue', 'Issue business letters', 'إصدار الخطابات التجارية', A_LETTERS, R_LETTER, 'TENANT'),
  core('business_letters.render', 'Render business letters', 'إخراج الخطابات التجارية', A_LETTERS, R_LETTER, 'TENANT'),

  // WebPhone (5)
  core('webphone.settings.read', 'View WebPhone settings', 'عرض إعدادات الهاتف الشبكي', A_WEBPHONE, R_WEBPHONE, 'TENANT'),
  core('webphone.settings.update', 'Update WebPhone settings', 'تحديث إعدادات الهاتف الشبكي', A_WEBPHONE, R_WEBPHONE, 'TENANT'),
  core('webphone.extensions.read', 'View WebPhone extensions', 'عرض تحويلات الهاتف الشبكي', A_WEBPHONE, R_WEBPHONE, 'TENANT'),
  core('webphone.extensions.manage', 'Manage WebPhone extensions', 'إدارة تحويلات الهاتف الشبكي', A_WEBPHONE, R_WEBPHONE, 'TENANT'),
  core('webphone.call_logs.read', "View users' call logs", 'عرض سجلات مكالمات المستخدمين', A_WEBPHONE, R_WEBPHONE, 'TENANT'),

  // Applications (7)
  core('applications.addon_seats.read', 'View addon seat allocation', 'عرض تخصيص مقاعد الإضافات', A_APPS, R_APPS, 'TENANT'),
  core('applications.addon_seats.manage', 'Manage addon seat allocation', 'إدارة تخصيص مقاعد الإضافات', A_APPS, R_APPS, 'TENANT'),
  core('applications.activation.read', 'View application activation', 'عرض تفعيل التطبيقات', A_APPS, R_APPS, 'BRANCH'),
  core('applications.activation.manage', 'Manage application activation', 'إدارة تفعيل التطبيقات', A_APPS, R_APPS, 'BRANCH'),
  core('applications.configuration.read', 'View addon configuration', 'عرض إعدادات الإضافات', A_APPS, R_APPS, 'BRANCH'),
  core('applications.configuration.manage', 'Manage addon configuration', 'إدارة إعدادات الإضافات', A_APPS, R_APPS, 'BRANCH'),
  core('applications.addon_definitions.adopt', 'Adopt an addon definition version', 'اعتماد إصدار تعريف الإضافة', A_APPS, R_APPS, 'TENANT'),
];

// --- CRM Areas & Resources ---
const A_CRM_RECORDS = area('crm_records', 'Pipeline & records', 'المسار البيعي والسجلات');
const A_CRM_SETTINGS = area('crm_settings', 'Settings & configuration', 'الإعدادات والتهيئة');
const A_CRM_DASH = area('crm_analytics', 'Dashboards & analytics', 'لوحات المتابعة والتحليلات');
const A_CRM_ENGAGE = area('crm_engagement', 'Engagement', 'التواصل والمتابعة');

const R_CRM_CUSTOMERS = res('customer_profiles', 'Customer profiles', 'ملفات العملاء');
const R_CRM_LEADS = res('leads', 'Leads', 'العملاء المحتملون');
const R_CRM_OPPS = res('opportunities', 'Opportunities', 'الفرص البيعية');
const R_CRM_SETTINGS = res('settings', 'Settings', 'الإعدادات');
const R_CRM_LEAD_STAGES = res('lead_stages', 'Lead stages', 'مراحل العملاء المحتملين');
const R_CRM_SOURCES = res('acquisition_sources', 'Acquisition sources', 'مصادر الاستقطاب');
const R_CRM_TAGS = res('tags', 'Tags', 'الوسوم');
const R_CRM_PIPELINES = res('pipelines', 'Pipelines', 'مسارات الفرص البيعية');
const R_CRM_CUSTOM_FIELDS = res('custom_fields', 'Custom fields', 'الحقول المخصصة');
const R_CRM_DASH = res('dashboards', 'Dashboards', 'لوحات المتابعة');
const R_CRM_WIDGETS = res('widgets', 'Widgets', 'عناصر لوحات المتابعة');
const R_CRM_ACT = res('activities', 'Activities', 'الأنشطة');
const R_CRM_NOTES = res('notes', 'Notes', 'الملاحظات');
const R_CRM_ATTACH = res('attachments', 'Attachments', 'المرفقات');
const R_CRM_EMAIL = res('email', 'Outbound email', 'البريد الإلكتروني الصادر');

const CRM_SPECS: RawSpec[] = [
  // Customer profiles (14)
  crm('crm.customer_profiles.export', 'Export customer profiles', 'تصدير ملفات العملاء', A_CRM_RECORDS, R_CRM_CUSTOMERS, 'TENANT'),
  crm('crm.customer_profiles.status.manage', 'Manage customer profile status & restrictions', 'إدارة حالة ملف العميل والقيود', A_CRM_RECORDS, R_CRM_CUSTOMERS, 'BRANCH'),
  ...crmTriad('crm.customer_profiles.read', 'View customer profiles', 'عرض ملفات العملاء', A_CRM_RECORDS, R_CRM_CUSTOMERS),
  ...crmTriad('crm.customer_profiles.create', 'Create customer profiles', 'إضافة ملفات العملاء', A_CRM_RECORDS, R_CRM_CUSTOMERS),
  ...crmTriad('crm.customer_profiles.update', 'Update customer profiles', 'تعديل ملفات العملاء', A_CRM_RECORDS, R_CRM_CUSTOMERS),
  ...crmTriad('crm.customer_profiles.delete', 'Delete customer profiles', 'حذف ملفات العملاء', A_CRM_RECORDS, R_CRM_CUSTOMERS),

  // Leads (16)
  crm('crm.leads.export', 'Export leads', 'تصدير العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS, 'TENANT'),
  ...crmTriad('crm.leads.read', 'View leads', 'عرض العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS),
  ...crmTriad('crm.leads.create', 'Create leads', 'إضافة العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS),
  ...crmTriad('crm.leads.update', 'Update leads', 'تعديل العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS),
  ...crmTriad('crm.leads.convert', 'Convert leads', 'تحويل العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS),
  ...crmTriad('crm.leads.delete', 'Delete leads', 'حذف العملاء المحتملين', A_CRM_RECORDS, R_CRM_LEADS),

  // Opportunities (13)
  crm('crm.opportunities.export', 'Export opportunities', 'تصدير الفرص البيعية', A_CRM_RECORDS, R_CRM_OPPS, 'TENANT'),
  ...crmTriad('crm.opportunities.read', 'View opportunities', 'عرض الفرص البيعية', A_CRM_RECORDS, R_CRM_OPPS),
  ...crmTriad('crm.opportunities.create', 'Create opportunities', 'إضافة الفرص البيعية', A_CRM_RECORDS, R_CRM_OPPS),
  ...crmTriad('crm.opportunities.update', 'Update opportunities', 'تعديل الفرص البيعية', A_CRM_RECORDS, R_CRM_OPPS),
  ...crmTriad('crm.opportunities.delete', 'Delete opportunities', 'حذف الفرص البيعية', A_CRM_RECORDS, R_CRM_OPPS),

  // Settings & configuration (12)
  crm('crm.settings.read', 'View CRM workspace settings', 'عرض إعدادات إدارة العملاء', A_CRM_SETTINGS, R_CRM_SETTINGS, 'TENANT'),
  crm('crm.settings.manage', 'Manage CRM workspace settings', 'إدارة إعدادات إدارة العملاء', A_CRM_SETTINGS, R_CRM_SETTINGS, 'TENANT'),
  crm('crm.lead_stages.read', 'View lead stages', 'عرض مراحل العملاء المحتملين', A_CRM_SETTINGS, R_CRM_LEAD_STAGES, 'TENANT'),
  crm('crm.lead_stages.manage', 'Manage lead stages', 'إدارة مراحل العملاء المحتملين', A_CRM_SETTINGS, R_CRM_LEAD_STAGES, 'TENANT'),
  crm('crm.acquisition_sources.read', 'View acquisition sources', 'عرض مصادر الاستقطاب', A_CRM_SETTINGS, R_CRM_SOURCES, 'BRANCH'),
  crm('crm.acquisition_sources.manage', 'Manage acquisition sources', 'إدارة مصادر الاستقطاب', A_CRM_SETTINGS, R_CRM_SOURCES, 'TENANT'),
  crm('crm.tags.read', 'View CRM tags', 'عرض وسوم إدارة العملاء', A_CRM_SETTINGS, R_CRM_TAGS, 'TENANT'),
  crm('crm.tags.manage', 'Manage CRM tags', 'إدارة وسوم إدارة العملاء', A_CRM_SETTINGS, R_CRM_TAGS, 'TENANT'),
  crm('crm.pipelines.read', 'View opportunity pipelines', 'عرض مسارات الفرص البيعية', A_CRM_SETTINGS, R_CRM_PIPELINES, 'TENANT'),
  crm('crm.pipelines.manage', 'Manage opportunity pipelines', 'إدارة مسارات الفرص البيعية', A_CRM_SETTINGS, R_CRM_PIPELINES, 'TENANT'),
  crm('crm.custom_fields.read', 'View CRM custom fields & values', 'عرض الحقول المخصصة وقيمها', A_CRM_SETTINGS, R_CRM_CUSTOM_FIELDS, 'BRANCH'),
  crm('crm.custom_fields.manage', 'Manage CRM custom field values', 'إدارة قيم الحقول المخصصة', A_CRM_SETTINGS, R_CRM_CUSTOM_FIELDS, 'BRANCH'),

  // Dashboards & analytics (7 + 7 + 5 + 5 + 2 = 26)
  crm('crm.dashboards.create', 'Create CRM dashboards', 'إنشاء لوحات متابعة إدارة العملاء', A_CRM_DASH, R_CRM_DASH, 'TENANT'),
  crm('crm.dashboards.update', 'Update CRM dashboards', 'تعديل لوحات متابعة إدارة العملاء', A_CRM_DASH, R_CRM_DASH, 'TENANT'),
  crm('crm.dashboards.delete', 'Delete CRM dashboards', 'حذف لوحات متابعة إدارة العملاء', A_CRM_DASH, R_CRM_DASH, 'TENANT'),
  crm('crm.dashboards.share', 'Share CRM dashboards', 'مشاركة لوحات متابعة إدارة العملاء', A_CRM_DASH, R_CRM_DASH, 'TENANT'),
  ...crmTriad('crm.dashboards.read', 'View CRM dashboards', 'عرض لوحات متابعة إدارة العملاء', A_CRM_DASH, R_CRM_DASH, 'TENANT'),

  crm('crm.widgets.read', 'View CRM dashboard widgets', 'عرض عناصر لوحات المتابعة', A_CRM_DASH, R_CRM_WIDGETS, 'TENANT'),
  crm('crm.widgets.create', 'Create CRM dashboard widgets', 'إنشاء عناصر لوحات المتابعة', A_CRM_DASH, R_CRM_WIDGETS, 'TENANT'),
  crm('crm.widgets.update', 'Update CRM dashboard widgets', 'تعديل عناصر لوحات المتابعة', A_CRM_DASH, R_CRM_WIDGETS, 'TENANT'),
  crmMissing('crm.widgets.publish', 'widgets', 'Widgets', 'عناصر لوحات المتابعة'),
  crm('crm.widgets.delete', 'Delete CRM dashboard widgets', 'حذف عناصر لوحات المتابعة', A_CRM_DASH, R_CRM_WIDGETS, 'TENANT'),
  crm('crm.widgets.share', 'Share CRM dashboard widgets', 'مشاركة عناصر لوحات المتابعة', A_CRM_DASH, R_CRM_WIDGETS, 'TENANT'),
  crmMissing('crm.widgets.transfer_ownership', 'widgets', 'Widgets', 'عناصر لوحات المتابعة'),

  crmMissing('crm.targets.manage', 'targets', 'Sales targets', 'أهداف المبيعات', 'Manage CRM sales targets'),
  crmMissing('crm.targets.approve', 'targets', 'Sales targets', 'أهداف المبيعات', 'Approve or reject submitted CRM sales targets'),
  crmMissing('crm.targets.read.own', 'targets', 'Sales targets', 'أهداف المبيعات', 'Read own CRM sales targets'),
  crmMissing('crm.targets.read.team', 'targets', 'Sales targets', 'أهداف المبيعات', 'Read team CRM sales targets'),
  crmMissing('crm.targets.read.all', 'targets', 'Sales targets', 'أهداف المبيعات', 'Read all CRM sales targets'),

  crmMissing('crm.sla.manage', 'sla', 'SLA policies', 'سياسات مستوى الخدمة', 'Manage CRM SLA policies and working calendars'),
  crmMissing('crm.alerts.manage', 'alerts', 'Metric alerts', 'تنبيهات المؤشرات', 'Manage CRM metric alert rules'),
  crmMissing('crm.subscriptions.manage', 'subscriptions', 'Report subscriptions', 'اشتراكات التقارير', 'Manage CRM report subscriptions'),
  crmMissing('crm.exports.create', 'exports', 'Analytics exports', 'تصديرات التحليلات', 'Create CRM report and dashboard exports'),
  crmMissing('crm.analytics.readiness.view', 'analytics', 'Analytics readiness', 'جاهزية التحليلات', 'View CRM analytics source readiness'),

  crmMissing('crm.inquiry_identities.manage', 'inquiry_identities', 'Inquiry identities', 'هويات الاستفسارات', 'Review tenant-wide canonical inquiry identities with complete lead read and update coverage'),
  crmMissing('crm.inquiry_identities.classification.read', 'inquiry_identities', 'Inquiry identities', 'هويات الاستفسارات', 'Read aggregate observed inquiry classification for leads within the assigned branch and lead scope'),

  // Engagement (12 + 12 + 9 + 3 = 36)
  ...crmTriad('crm.activities.read', 'View CRM activities', 'عرض أنشطة إدارة العملاء', A_CRM_ENGAGE, R_CRM_ACT),
  ...crmTriad('crm.activities.create', 'Create CRM activities', 'إضافة أنشطة إدارة العملاء', A_CRM_ENGAGE, R_CRM_ACT),
  ...crmTriad('crm.activities.update', 'Update CRM activities', 'تعديل أنشطة إدارة العملاء', A_CRM_ENGAGE, R_CRM_ACT),
  ...crmTriad('crm.activities.delete', 'Delete CRM activities', 'حذف أنشطة إدارة العملاء', A_CRM_ENGAGE, R_CRM_ACT),

  ...crmTriad('crm.notes.read', 'View CRM notes', 'عرض الملاحظات', A_CRM_ENGAGE, R_CRM_NOTES),
  ...crmTriad('crm.notes.create', 'Create CRM notes', 'إضافة الملاحظات', A_CRM_ENGAGE, R_CRM_NOTES),
  ...crmTriad('crm.notes.update', 'Update CRM notes', 'تعديل الملاحظات', A_CRM_ENGAGE, R_CRM_NOTES),
  ...crmTriad('crm.notes.delete', 'Delete CRM notes', 'حذف الملاحظات', A_CRM_ENGAGE, R_CRM_NOTES),

  ...crmTriad('crm.attachments.read', 'View CRM attachments', 'عرض المرفقات', A_CRM_ENGAGE, R_CRM_ATTACH),
  ...crmTriad('crm.attachments.create', 'Upload CRM attachments', 'رفع المرفقات', A_CRM_ENGAGE, R_CRM_ATTACH),
  ...crmTriad('crm.attachments.delete', 'Delete CRM attachments', 'حذف المرفقات', A_CRM_ENGAGE, R_CRM_ATTACH),

  ...crmTriad('crm.email.send', 'Send outbound CRM email', 'إرسال البريد الإلكتروني الصادر', A_CRM_ENGAGE, R_CRM_EMAIL),
];

// --- Trade Areas & Resources (2-3 example keys per listed resource + all 5 TENANT keys) ---
const A_TR_SETUP = area('trade_setup', 'Setup & catalog', 'الإعداد والكتالوج');
const A_TR_POLICY = area('trade_policies', 'Policies & extensibility', 'السياسات والتوسعة');
const A_TR_SALES = area('trade_sales', 'Sales', 'المبيعات');
const A_TR_PURCH = area('trade_purchasing', 'Purchasing', 'المشتريات');
const A_TR_INV = area('trade_inventory', 'Inventory', 'المخزون');
const A_TR_MON = area('trade_monitoring', 'Monitoring & dashboards', 'المراقبة ولوحات المتابعة');

const TRADE_SPECS: RawSpec[] = [
  // Setup & catalog
  trade('trade.configuration.read', 'View trade configuration', 'عرض إعدادات التجارة', A_TR_SETUP, res('configuration', 'Configuration', 'الإعدادات')),
  trade('trade.configuration.manage', 'Manage trade configuration', 'إدارة إعدادات التجارة', A_TR_SETUP, res('configuration', 'Configuration', 'الإعدادات')),
  trade('trade.catalog_master.manage', 'Manage catalog master', 'إدارة الكتالوج الرئيسي', A_TR_SETUP, res('catalog_master', 'Catalog master', 'الكتالوج الرئيسي'), 'TENANT'),
  trade('trade.items.read', 'View catalog items', 'عرض أصناف الكتالوج', A_TR_SETUP, res('items', 'Items', 'الأصناف')),
  trade('trade.items.manage', 'Manage catalog items', 'إدارة أصناف الكتالوج', A_TR_SETUP, res('items', 'Items', 'الأصناف')),
  trade('trade.commercial_accounts.read', 'View commercial accounts', 'عرض الحسابات التجارية', A_TR_SETUP, res('commercial_accounts', 'Commercial accounts', 'الحسابات التجارية')),
  trade('trade.commercial_accounts.manage', 'Manage commercial accounts', 'إدارة الحسابات التجارية', A_TR_SETUP, res('commercial_accounts', 'Commercial accounts', 'الحسابات التجارية')),
  trade('trade.credit.view', 'View commercial credit limits', 'عرض الحدود الائتمانية', A_TR_SETUP, res('credit', 'Credit', 'الائتمان')),
  trade('trade.pricing.read', 'View price books', 'عرض قوائم الأسعار', A_TR_SETUP, res('pricing', 'Pricing', 'التسعير')),
  trade('trade.pricing.manage', 'Manage price books', 'إدارة قوائم الأسعار', A_TR_SETUP, res('pricing', 'Pricing', 'التسعير'), 'TENANT'),
  trade('trade.pricing.view_cost', 'View item costs and margins', 'عرض تكاليف الأصناف وهوامشها', A_TR_SETUP, res('pricing', 'Pricing', 'التسعير'), 'TENANT'),

  // Policies & extensibility
  trade('trade.policy.read', 'View trade policies', 'عرض سياسات التجارة', A_TR_POLICY, res('policy', 'Policies', 'السياسات')),
  trade('trade.policy.approve', 'Approve trade policy overrides', 'اعتماد استثناءات السياسات التجارية', A_TR_POLICY, res('policy', 'Policies', 'السياسات')),
  trade('trade.document_profiles.read', 'View document profiles', 'عرض ملفات المستندات', A_TR_POLICY, res('document_profiles', 'Document profiles', 'ملفات المستندات')),
  trade('trade.document_profiles.publish', 'Publish document profiles', 'نشر ملفات المستندات', A_TR_POLICY, res('document_profiles', 'Document profiles', 'ملفات المستندات')),
  trade('trade.extensions.read', 'View extension profiles', 'عرض ملفات التوسعة', A_TR_POLICY, res('extensions', 'Extensions', 'التوسعات')),
  trade('trade.extensions.manage', 'Manage extension profiles', 'إدارة ملفات التوسعة', A_TR_POLICY, res('extensions', 'Extensions', 'التوسعات')),
  trade('trade.import.read', 'View trade import runs', 'عرض عمليات استيراد التجارة', A_TR_POLICY, res('import', 'Imports', 'الاستيراد')),
  trade('trade.import.run', 'Run trade imports', 'تشغيل عمليات استيراد التجارة', A_TR_POLICY, res('import', 'Imports', 'الاستيراد')),
  trade('trade.webhooks.read', 'View trade webhooks', 'عرض خطافات التجارة', A_TR_POLICY, res('webhooks', 'Webhooks', 'خطافات الويب')),
  trade('trade.webhooks.replay', 'Replay trade webhook deliveries', 'إعادة إرسال خطافات التجارة', A_TR_POLICY, res('webhooks', 'Webhooks', 'خطافات الويب')),

  // Sales
  trade('trade.quotations.read', 'View sales quotations', 'عرض عروض الأسعار البيعية', A_TR_SALES, res('quotations', 'Sales quotations', 'عروض الأسعار البيعية')),
  trade('trade.quotations.create', 'Create sales quotations', 'إنشاء عروض الأسعار البيعية', A_TR_SALES, res('quotations', 'Sales quotations', 'عروض الأسعار البيعية')),
  trade('trade.quotations.discount.manage', 'Manage sales quotation discounts', 'إدارة خصومات عروض الأسعار', A_TR_SALES, res('quotations', 'Sales quotations', 'عروض الأسعار البيعية')),
  trade('trade.sales_orders.read', 'View sales orders', 'عرض أوامر البيع', A_TR_SALES, res('sales_orders', 'Sales orders', 'أوامر البيع')),
  trade('trade.sales_orders.create', 'Create sales orders', 'إنشاء أوامر البيع', A_TR_SALES, res('sales_orders', 'Sales orders', 'أوامر البيع')),
  trade('trade.sales_orders.hold', 'Place or release sales order holds', 'إيقاف أو إتاحة أوامر البيع', A_TR_SALES, res('sales_orders', 'Sales orders', 'أوامر البيع')),
  trade('trade.invoices.read', 'View sales invoices', 'عرض فواتير المبيعات', A_TR_SALES, res('invoices', 'Invoices', 'الفواتير')),
  trade('trade.invoices.issue', 'Issue sales invoices', 'إصدار فواتير المبيعات', A_TR_SALES, res('invoices', 'Invoices', 'الفواتير')),
  trade('trade.contracts.read', 'View commercial contracts', 'عرض العقود التجارية', A_TR_SALES, res('contracts', 'Contracts', 'العقود')),
  trade('trade.contracts.manage', 'Manage commercial contracts', 'إدارة العقود التجارية', A_TR_SALES, res('contracts', 'Contracts', 'العقود')),

  // Purchasing
  trade('trade.purchase_quotations.read', 'View purchase quotations', 'عرض عروض أسعار الشراء', A_TR_PURCH, res('purchase_quotations', 'Purchase quotations', 'عروض أسعار الشراء')),
  trade('trade.purchase_quotations.issue', 'Issue purchase quotations', 'إصدار عروض أسعار الشراء', A_TR_PURCH, res('purchase_quotations', 'Purchase quotations', 'عروض أسعار الشراء')),
  trade('trade.purchase_orders.read', 'View purchase orders', 'عرض أوامر الشراء', A_TR_PURCH, res('purchase_orders', 'Purchase orders', 'أوامر الشراء')),
  trade('trade.purchase_orders.submit', 'Submit purchase orders', 'إرسال أوامر الشراء للاعتماد', A_TR_PURCH, res('purchase_orders', 'Purchase orders', 'أوامر الشراء')),
  trade('trade.purchase_orders.approve', 'Approve purchase orders', 'اعتماد أوامر الشراء', A_TR_PURCH, res('purchase_orders', 'Purchase orders', 'أوامر الشراء')),

  // Inventory
  trade('trade.inventory.read', 'View inventory availability', 'عرض توفر المخزون', A_TR_INV, res('inventory', 'Inventory', 'المخزون')),
  trade('trade.inventory.adjust', 'Adjust inventory balances', 'تعديل أرصدة المخزون', A_TR_INV, res('inventory', 'Inventory', 'المخزون')),
  trade('trade.inventory.nodes.manage', 'Manage fulfilment nodes', 'إدارة مراكز التنفيذ المخزنية', A_TR_INV, res('inventory', 'Inventory', 'المخزون'), 'TENANT'),
  trade('trade.inventory.governance.manage', 'Manage inventory governance rules', 'إدارة قواعد حوكمة المخزون', A_TR_INV, res('inventory', 'Inventory', 'المخزون'), 'TENANT'),

  // Monitoring & dashboards
  trade('trade.control_tower.read', 'View control tower', 'عرض برج المراقبة', A_TR_MON, res('control_tower', 'Control tower', 'برج المراقبة')),
  trade('trade.control_tower.view_sensitive', 'View sensitive control tower alerts', 'عرض التنبيهات الحساسة في برج المراقبة', A_TR_MON, res('control_tower', 'Control tower', 'برج المراقبة')),
  trade('trade.dashboards.read', 'View trade dashboards', 'عرض لوحات متابعة التجارة', A_TR_MON, res('dashboards', 'Dashboards', 'لوحات المتابعة')),
  trade('trade.dashboards.share', 'Share trade dashboards', 'مشاركة لوحات متابعة التجارة', A_TR_MON, res('dashboards', 'Dashboards', 'لوحات المتابعة')),
  trade('trade.widgets.read', 'View trade dashboard widgets', 'عرض عناصر لوحات التجارة', A_TR_MON, res('widgets', 'Widgets', 'عناصر لوحات المتابعة')),
  trade('trade.widgets.create', 'Create trade dashboard widgets', 'إنشاء عناصر لوحات التجارة', A_TR_MON, res('widgets', 'Widgets', 'عناصر لوحات المتابعة')),
];

// --- Accounting (10 example keys with no curated en/ar labels, TENANT scope) ---
const ACCOUNTING_KEYS: readonly string[] = [
  'accounting.account.assign_role',
  'accounting.account.read',
  'accounting.account.view_sensitive',
  'accounting.attachment.legal_hold',
  'accounting.bank_account.view_sensitive',
  'accounting.journal_draft.post',
  'accounting.journal_entry.override_fx',
  'accounting.payment_run.approve',
  'accounting.period.override',
  'accounting.tax_return.file',
];

const ACCOUNTING_SPECS: RawSpec[] = ACCOUNTING_KEYS.map((key) => {
  const [, resource = 'accounting', action = 'read'] = key.split('.');
  const fallbackDesc = `${resource} ${action}`.replace(/_/g, ' ');
  return {
    key,
    en: FALLBACK_NAME.en,
    ar: FALLBACK_NAME.ar,
    module: MOD_CORE_SETTINGS_FALLBACK,
    area: FALLBACK_GROUPS[0],
    resource: FALLBACK_GROUPS[1],
    scope: 'TENANT',
    recordScope: null,
    groupKey: 'accounting',
    groupI18n: { en: 'Accounting', ar: 'المحاسبة' },
    permEn: humanizeSegment(fallbackDesc),
    permAr: fallbackDesc,
    descriptionI18n: { en: fallbackDesc, ar: fallbackDesc },
  };
});

const ALL_SPECS: readonly RawSpec[] = [
  ...CORE_SPECS,
  ...CRM_SPECS,
  ...TRADE_SPECS,
  ...ACCOUNTING_SPECS,
];

export const CORE_KEYS: readonly string[] = CORE_SPECS.map((s) => s.key);
export const CRM_KEYS: readonly string[] = CRM_SPECS.map((s) => s.key);
export const TRADE_KEYS: readonly string[] = TRADE_SPECS.map((s) => s.key);

export const CATALOGUE_ENTRIES: readonly CatalogueEntry[] = ALL_SPECS.map((s) => ({
  id: s.key,
  key: s.key,
  nameI18n: { en: s.en, ar: s.ar },
  module: { id: s.module.id, nameI18n: { ...s.module.nameI18n } },
  groups: [
    { id: s.area.id, nameI18n: { ...s.area.nameI18n } },
    { id: s.resource.id, nameI18n: { ...s.resource.nameI18n } },
  ],
  scope: s.scope,
  recordScope: s.recordScope,
}));

export const PERMISSIONS_LIST: readonly Permission[] = ALL_SPECS.map((s) => ({
  id: s.key,
  key: s.key,
  nameEn: s.permEn ?? s.en,
  nameAr: s.permAr ?? s.ar,
  group: s.groupKey,
  groupI18n: { ...s.groupI18n },
  ...(s.descriptionI18n ? { descriptionI18n: { ...s.descriptionI18n } } : {}),
}));

export const CATALOGUE_BY_KEY: ReadonlyMap<string, CatalogueEntry> = new Map(
  CATALOGUE_ENTRIES.map((e) => [e.key, e]),
);

export function getCatalogueEntries(): CatalogueEntry[] {
  return CATALOGUE_ENTRIES.map((e) => ({
    ...e,
    nameI18n: { ...e.nameI18n },
    module: { id: e.module.id, nameI18n: { ...e.module.nameI18n } },
    groups: [
      { id: e.groups[0].id, nameI18n: { ...e.groups[0].nameI18n } },
      { id: e.groups[1].id, nameI18n: { ...e.groups[1].nameI18n } },
    ],
  }));
}

export function getPermissionsList(): Permission[] {
  return PERMISSIONS_LIST.map((p) => ({
    ...p,
    groupI18n: { ...p.groupI18n },
    ...(p.descriptionI18n ? { descriptionI18n: { ...p.descriptionI18n } } : {}),
  }));
}
