import { ApiError, fakeDelay } from '../shared/settings-api';
import { CrmStaticData, L, Opt } from './static-data.model';

export let FAKE_FAIL_NEXT = false;

export function setFakeStaticDataFailNext(fail: boolean): void {
  FAKE_FAIL_NEXT = fail;
}

function opt(value: string, en: string, ar: string): Opt {
  return { value, label: { en, ar } };
}

const ENUM_OPTIONS: Record<string, Opt[]> = {
  profileTypes: [
    opt('INDIVIDUAL', 'Individual', 'فرد'),
    opt('CORPORATE', 'Corporate', 'شركة / مؤسسة'),
  ],
  customerStatuses: [
    opt('PROSPECT', 'Prospect', 'عميل محتمل'),
    opt('ACTIVE_CUSTOMER', 'Active customer', 'عميل نشط'),
    opt('INACTIVE', 'Inactive', 'غير نشط'),
    opt('BLACKLISTED', 'Blacklisted', 'محظور'),
  ],
  leadStatuses: [
    opt('OPEN', 'Open', 'مفتوح'),
    opt('CONVERTED', 'Converted', 'تم التحويل'),
    opt('DISQUALIFIED', 'Disqualified', 'غير مؤهل'),
    opt('ON_HOLD', 'On hold', 'معلق'),
  ],
  leadStageFlags: [
    opt('NEW', 'New', 'جديد'),
    opt('CONTACTED', 'Contacted', 'تم التواصل'),
    opt('QUALIFYING', 'Qualifying', 'تحت التأهيل'),
    opt('QUALIFIED', 'Qualified', 'مؤهل'),
    opt('DISQUALIFIED', 'Disqualified', 'غير مؤهل'),
    opt('CONVERTED', 'Converted', 'تم التحويل'),
    opt('NURTURING', 'Nurturing', 'متابعة لاحقة'),
    opt('ON_HOLD', 'On hold', 'معلق'),
  ],
  opportunityStatuses: [
    opt('IN_PROGRESS', 'In progress', 'قيد التنفيذ'),
    opt('ON_HOLD', 'On hold', 'معلق'),
    opt('WON', 'Won', 'تم الفوز'),
    opt('LOST', 'Lost', 'خسارة'),
  ],
  opportunityStageFlags: [
    opt('NEW', 'New', 'جديد'),
    opt('DISCOVERY', 'Discovery', 'استكشاف'),
    opt('QUALIFICATION', 'Qualification', 'تأهيل'),
    opt('PROPOSAL', 'Proposal', 'عرض'),
    opt('NEGOTIATION', 'Negotiation', 'تفاوض'),
    opt('CONTRACTING', 'Contracting', 'تعاقد'),
    opt('ON_HOLD', 'On hold', 'معلق'),
    opt('WON', 'Won', 'تم الفوز'),
    opt('LOST', 'Lost', 'خسارة'),
  ],
  customFieldOwnerTypes: [
    opt('PARTY', 'Party', 'طرف'),
    opt('LEAD', 'Lead', 'عميل محتمل'),
    opt('LEAD_AND_PARTY', 'Lead and party', 'عميل محتمل وطرف'),
    opt('CUSTOMER_PROFILE', 'Customer profile', 'ملف العميل'),
    opt('OPPORTUNITY', 'Opportunity', 'فرصة'),
  ],
  customFieldTypes: [
    opt('TEXT', 'Text', 'نص'),
    opt('TEXTAREA', 'Long text', 'نص طويل'),
    opt('NUMBER', 'Number', 'رقم'),
    opt('DATE', 'Date', 'تاريخ'),
    opt('DATETIME', 'Date and time', 'تاريخ ووقت'),
    opt('BOOLEAN', 'Yes / No', 'نعم / لا'),
    opt('SELECT', 'Single select', 'اختيار واحد'),
    opt('MULTI_SELECT', 'Multi select', 'اختيارات متعددة'),
    opt('URL', 'URL', 'رابط'),
    opt('EMAIL', 'Email', 'بريد إلكتروني'),
    opt('PHONE', 'Phone', 'هاتف'),
  ],
  fieldRequirementOperations: [
    opt('CREATE', 'Create', 'إنشاء'),
    opt('UPDATE', 'Update', 'تحديث'),
    opt('CONVERT', 'Convert', 'تحويل'),
  ],
  activityTypes: [
    opt('CALL', 'Call', 'مكالمة'),
    opt('MEETING', 'Meeting', 'اجتماع'),
    opt('EMAIL', 'Email', 'بريد إلكتروني'),
    opt('VISIT', 'Visit', 'زيارة'),
    opt('NOTE', 'Note', 'ملاحظة'),
    opt('FOLLOW_UP', 'Follow up', 'متابعة'),
    opt('OTHER', 'Other', 'أخرى'),
  ],
  activityStatuses: [
    opt('OPEN', 'Open', 'مفتوح'),
    opt('DONE', 'Done', 'تم'),
  ],
};

const ENUMS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ENUM_OPTIONS).map(([key, options]) => [key, options.map((entry) => entry.value)]),
);

const STATIC_PERMISSIONS = [
  'crm.customer_profiles.export',
  'crm.customer_profiles.status.manage',
  'crm.leads.export',
  'crm.opportunities.export',
  'crm.settings.read',
  'crm.settings.manage',
  'crm.lead_stages.read',
  'crm.lead_stages.manage',
  'crm.acquisition_sources.read',
  'crm.acquisition_sources.manage',
  'crm.tags.read',
  'crm.tags.manage',
  'crm.pipelines.read',
  'crm.pipelines.manage',
  'crm.custom_fields.read',
  'crm.custom_fields.manage',
  'crm.dashboards.create',
  'crm.dashboards.update',
  'crm.dashboards.delete',
  'crm.dashboards.share',
  'crm.targets.manage',
  'crm.targets.approve',
  'crm.sla.manage',
  'crm.alerts.manage',
  'crm.subscriptions.manage',
  'crm.exports.create',
  'crm.analytics.readiness.view',
  'crm.inquiry_identities.manage',
  'crm.inquiry_identities.classification.read',
  'crm.widgets.read',
  'crm.widgets.create',
  'crm.widgets.update',
  'crm.widgets.publish',
  'crm.widgets.delete',
  'crm.widgets.share',
  'crm.widgets.transfer_ownership',
] as const;

const SCOPED_PERMISSION_BASES = [
  'crm.customer_profiles.read',
  'crm.customer_profiles.create',
  'crm.customer_profiles.update',
  'crm.customer_profiles.delete',
  'crm.leads.read',
  'crm.leads.create',
  'crm.leads.update',
  'crm.leads.convert',
  'crm.leads.delete',
  'crm.opportunities.read',
  'crm.opportunities.create',
  'crm.opportunities.update',
  'crm.opportunities.delete',
  'crm.activities.read',
  'crm.activities.create',
  'crm.activities.update',
  'crm.activities.delete',
  'crm.notes.read',
  'crm.notes.create',
  'crm.notes.update',
  'crm.notes.delete',
  'crm.attachments.read',
  'crm.attachments.create',
  'crm.attachments.delete',
  'crm.dashboards.read',
  'crm.targets.read',
  'crm.email.send',
] as const;

const SCOPES = ['own', 'team', 'all'] as const;

const VERB_LABELS: Readonly<Record<string, L>> = {
  read: { en: 'Read', ar: 'عرض' },
  create: { en: 'Create', ar: 'إنشاء' },
  update: { en: 'Update', ar: 'تعديل' },
  delete: { en: 'Delete', ar: 'حذف' },
  manage: { en: 'Manage', ar: 'إدارة' },
  export: { en: 'Export', ar: 'تصدير' },
  convert: { en: 'Convert', ar: 'تحويل' },
  share: { en: 'Share', ar: 'مشاركة' },
  send: { en: 'Send', ar: 'إرسال' },
  approve: { en: 'Approve', ar: 'اعتماد' },
  publish: { en: 'Publish', ar: 'نشر' },
};

const OBJECT_LABELS: Readonly<Record<string, L>> = {
  customer_profiles: { en: 'customer profiles', ar: 'ملفات العملاء' },
  'customer_profiles.status': { en: 'customer status', ar: 'حالة العميل' },
  leads: { en: 'leads', ar: 'العملاء المحتملين' },
  opportunities: { en: 'opportunities', ar: 'الفرص' },
  activities: { en: 'activities', ar: 'الأنشطة' },
  notes: { en: 'notes', ar: 'الملاحظات' },
  attachments: { en: 'attachments', ar: 'المرفقات' },
  settings: { en: 'CRM settings', ar: 'إعدادات إدارة العملاء' },
  lead_stages: { en: 'lead stages', ar: 'مراحل العملاء المحتملين' },
  acquisition_sources: { en: 'lead sources', ar: 'مصادر العملاء' },
  tags: { en: 'tags', ar: 'الوسوم' },
  pipelines: { en: 'pipelines', ar: 'مسارات البيع' },
  custom_fields: { en: 'custom fields', ar: 'الحقول المخصصة' },
  dashboards: { en: 'dashboards', ar: 'لوحات المعلومات' },
  widgets: { en: 'dashboard widgets', ar: 'عناصر لوحات المعلومات' },
  email: { en: 'CRM email', ar: 'بريد إدارة العملاء' },
};

const SCOPE_LABELS: Readonly<Record<(typeof SCOPES)[number], L>> = {
  own: { en: 'own', ar: 'الخاصة بي' },
  team: { en: 'team', ar: 'الفريق' },
  all: { en: 'all', ar: 'الكل' },
};

const UNTRANSLATED_PERMISSION_KEYS = new Set<string>([
  'crm.targets.manage',
  'crm.targets.approve',
  'crm.sla.manage',
  'crm.alerts.manage',
  'crm.subscriptions.manage',
  'crm.exports.create',
  'crm.analytics.readiness.view',
  'crm.inquiry_identities.manage',
  'crm.inquiry_identities.classification.read',
  'crm.widgets.publish',
  'crm.widgets.transfer_ownership',
  'crm.targets.read.own',
  'crm.targets.read.team',
  'crm.targets.read.all',
]);

function permissionLabelFor(key: string): L {
  if (UNTRANSLATED_PERMISSION_KEYS.has(key)) {
    const words = key.replace(/[._]/g, ' ');
    return { en: words, ar: words };
  }

  const parts = key.split('.');
  const last = parts[parts.length - 1];
  const scope = (SCOPES as readonly string[]).includes(last) ? (last as (typeof SCOPES)[number]) : null;
  const baseParts = scope ? parts.slice(1, -1) : parts.slice(1);
  const verb = baseParts[baseParts.length - 1];
  const objectKey = baseParts.slice(0, -1).join('.');

  const verbLabel = VERB_LABELS[verb];
  const objectLabel = OBJECT_LABELS[objectKey];
  if (!verbLabel || !objectLabel) {
    const words = key.replace(/[._]/g, ' ');
    return { en: words, ar: words };
  }

  const baseEn = `${verbLabel.en} ${objectLabel.en}`;
  const baseAr = `${verbLabel.ar} ${objectLabel.ar}`;
  if (!scope) {
    return { en: baseEn, ar: baseAr };
  }
  const scopeLabel = SCOPE_LABELS[scope];
  return {
    en: `${baseEn} (${scopeLabel.en})`,
    ar: `${baseAr} (${scopeLabel.ar})`,
  };
}

const PERMISSIONS: string[] = [
  ...STATIC_PERMISSIONS,
  ...SCOPED_PERMISSION_BASES.flatMap((base) => SCOPES.map((scope) => `${base}.${scope}`)),
];

const PERMISSION_OPTIONS: Opt[] = PERMISSIONS.map((value) => ({
  value,
  label: permissionLabelFor(value),
}));

const SEED_STATIC_DATA: CrmStaticData = {
  pagination: { pageSizes: [20, 50, 100], defaultPageSize: 20, maxPageSize: 100 },
  enums: ENUMS,
  enumOptions: ENUM_OPTIONS,
  attachmentPolicy: {
    maxSizeBytes: 26214400,
    allowedMimeTypes: {
      pdf: ['application/pdf'],
      images: ['image/png', 'image/jpeg', 'image/webp'],
      word: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      text: ['text/csv', 'text/plain'],
    },
    allowedExtensions: {
      pdf: ['.pdf'],
      images: ['.png', '.jpeg', '.jpg', '.webp'],
      word: ['.docx'],
      excel: ['.xlsx'],
      text: ['.csv', '.txt'],
    },
    rejectedFamilies: ['executables', 'scripts', 'archives', 'html', 'unknown_binary'],
    familyLabels: [
      opt('pdf', 'PDF', 'PDF'),
      opt('images', 'Images', 'صور'),
      opt('word', 'Word documents', 'مستندات Word'),
      opt('excel', 'Excel spreadsheets', 'جداول Excel'),
      opt('text', 'Text files', 'ملفات نصية'),
    ],
    rejectedFamilyLabels: [
      opt('executables', 'Executables', 'ملفات تشغيلية'),
      opt('scripts', 'Scripts', 'سكريبتات'),
      opt('archives', 'Archives', 'ملفات مضغوطة'),
      opt('html', 'HTML files', 'ملفات HTML'),
      opt('unknown_binary', 'Unknown binary files', 'ملفات ثنائية غير معروفة'),
    ],
  },
  permissions: PERMISSIONS,
  permissionOptions: PERMISSION_OPTIONS,
  ownerTypeOptions: [
    opt('LEAD', 'Lead', 'عميل محتمل'),
    opt('CUSTOMER_PROFILE', 'Customer profile', 'ملف العميل'),
    opt('PARTY', 'Party', 'طرف'),
    opt('OPPORTUNITY', 'Opportunity', 'فرصة'),
    opt('ACTIVITY', 'Activity', 'نشاط'),
    opt('NOTE', 'Note', 'ملاحظة'),
  ],
  eventOptions: [
    opt('crm.lead.created', 'Lead created', 'تم إنشاء العميل المحتمل'),
    opt('crm.lead.stage_changed', 'Lead stage changed', 'تم تغيير مرحلة العميل المحتمل'),
    opt('crm.lead.converted', 'Lead converted', 'تم تحويل العميل المحتمل'),
    opt('crm.lead.changed', 'Lead changed', 'تم تغيير العميل المحتمل'),
    opt('crm.lead.deleted', 'Lead deleted', 'تم حذف العميل المحتمل'),
    opt('crm.leads.changed.v1', 'Lead board changed', 'تم تغيير لوحة العملاء المحتملين'),
    opt('crm.customer_profile.created', 'Customer profile created', 'تم إنشاء ملف العميل'),
    opt('crm.customer_profile.changed', 'Customer profile changed', 'تم تغيير ملف العميل'),
    opt('crm.customer_profile.deleted', 'Customer profile deleted', 'تم حذف ملف العميل'),
    opt('crm.opportunity.created', 'Opportunity created', 'تم إنشاء الفرصة'),
    opt('crm.opportunity.stage_changed', 'Opportunity stage changed', 'تم تغيير مرحلة الفرصة'),
    opt('crm.opportunity.won', 'Opportunity won', 'تم الفوز بالفرصة'),
    opt('crm.opportunity.lost', 'Opportunity lost', 'تم خسارة الفرصة'),
    opt('crm.opportunity.reopened', 'Opportunity reopened', 'تم إعادة فتح الفرصة'),
    opt('crm.opportunity.changed', 'Opportunity changed', 'تم تغيير الفرصة'),
    opt('crm.notification.requested.v1', 'Notification requested', 'تم طلب إشعار'),
    opt('crm.email.send.v1', 'CRM email queued', 'تمت إضافة رسالة CRM إلى قائمة الإرسال'),
    // crm-app common/i18n/locales en.ts / ar.ts: crm.label.event.crm.analytics.export.pdf_render_requested.v1
    opt('crm.analytics.export.pdf_render_requested.v1', 'Analytics PDF export requested', 'طُلب تصدير التحليلات بصيغة PDF'),
  ],
  derivedRules: {
    opportunityStatusByStageFlag: {
      WON: 'WON',
      LOST: 'LOST',
      ON_HOLD: 'ON_HOLD',
      default: 'IN_PROGRESS',
    },
    leadConversionCopiesCustomFieldOwnerType: 'LEAD_AND_PARTY',
  },
};

/** Fake GET /api/tenant/crm/v1/static-data */
export async function fakeGetCrmStaticData(): Promise<CrmStaticData> {
  await fakeDelay();
  if (FAKE_FAIL_NEXT) {
    FAKE_FAIL_NEXT = false;
    throw new ApiError(503, 'ENTITLEMENT_UNAVAILABLE');
  }
  return structuredClone(SEED_STATIC_DATA);
}
