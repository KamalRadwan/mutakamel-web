"use client";

import { useState } from "react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export type LeadFieldGuideTone =
  | "indigo"
  | "emerald"
  | "violet"
  | "sky"
  | "amber"
  | "teal"
  | "rose";

export interface LeadFieldGuideEntry {
  title: string;
  dtoKey: string;
  description: string;
  rule?: string;
  example?: string;
  tone?: LeadFieldGuideTone;
}

export type LeadFieldGuideKey =
  | "branchId"
  | "ownerUserId"
  | "companyId"
  | "leadProfileType"
  | "stageId"
  | "acquisitionSourceId"
  | "tagIds"
  | "honorificTitle"
  | "firstName"
  | "lastName"
  | "phones"
  | "email"
  | "existingCompanyPartyId"
  | "companyName"
  | "legalName"
  | "taxNumber"
  | "commercialRegistrationNumber"
  | "companyPhones"
  | "companyEmail"
  | "companyWebsite"
  | "contacts"
  | "contactPartyId"
  | "contactFirstName"
  | "contactLastName"
  | "contactJobTitle"
  | "contactPhones"
  | "contactEmail"
  | "contactPrimary"
  | "country"
  | "state"
  | "city"
  | "street1"
  | "street2"
  | "buildingNo"
  | "floor"
  | "apartment"
  | "landmark"
  | "postalCode"
  | "interestSummary"
  | "expectedNeed"
  | "description"
  | "customFields";

const GUIDE_EN: Record<LeadFieldGuideKey, LeadFieldGuideEntry> = {
  branchId: {
    title: "Target Branch Scope",
    dtoKey: "branchId (UUIDv7 · Required)",
    description:
      "Determines which operational branch owns this lead record, its stage pipeline, and directory party visibility.",
    rule: "Must be one of your permitted session branches.",
    example: "Riyadh HQ Branch",
    tone: "indigo",
  },
  ownerUserId: {
    title: "Assigned Salesperson",
    dtoKey: "ownerUserId (UUIDv7 · Optional)",
    description:
      "Assigns the lead to an active salesperson in the selected branch. Defaults to the current user if left unassigned.",
    rule: "Must be an ACTIVE user in the selected branch.",
    example: "Sarah Al-Mansoor",
    tone: "indigo",
  },
  companyId: {
    title: "Parent Organization",
    dtoKey: "X-Organization-Id (UUIDv7)",
    description:
      "Selects the tenant organization entity when your account spans multiple companies.",
    rule: "Required when multiple companies exist in session.",
    tone: "indigo",
  },
  leadProfileType: {
    title: "Lead Profile Type",
    dtoKey: "leadProfileType ('INDIVIDUAL' | 'CORPORATE')",
    description:
      "Determines the lead structure: Individual (B2C single person) or Corporate (B2B organization with up to 20 contact persons).",
    rule: "Switching clears incompatible corporate-only fields automatically.",
    example: "INDIVIDUAL or CORPORATE",
    tone: "indigo",
  },
  stageId: {
    title: "Pipeline Stage",
    dtoKey: "stageId (UUIDv7 · Optional)",
    description:
      "Places the lead into a specific non-converted pipeline stage. If left on Default Stage, the server assigns the branch entry stage.",
    rule: "Terminal CONVERTED stages are excluded during creation.",
    example: "New / Qualification",
    tone: "indigo",
  },
  acquisitionSourceId: {
    title: "Acquisition Source",
    dtoKey: "acquisitionSourceId (UUIDv7 · Required)",
    description:
      "Tracks the marketing channel or referral origin that generated this lead for attribution and ROI reporting.",
    rule: "Required on lead creation.",
    example: "Website, LinkedIn Ads, Referral",
    tone: "indigo",
  },
  tagIds: {
    title: "Lead Classification Tags",
    dtoKey: "tagIds (string[] · Max 50)",
    description:
      "Attach up to 50 color-coded tags to segment, filter, and prioritize leads on the board and table views.",
    rule: "Up to 50 tags. Users with crm.tags.manage can create tags inline.",
    example: "VIP, Q4 Campaign, Enterprise",
    tone: "indigo",
  },
  honorificTitle: {
    title: "Honorific Title",
    dtoKey: "honorificTitle (Max 40 chars)",
    description:
      "Formal salutation prefix stored on the person party and used in outbound email templates.",
    rule: "Optional · Max 40 characters.",
    example: "Mr., Ms., Dr., Eng.",
    tone: "emerald",
  },
  firstName: {
    title: "First Name",
    dtoKey: "firstName (Required · Max 80 chars)",
    description:
      "The person's given name. Combined with Last Name by the server to compose the full display name.",
    rule: "Required on Individual leads · Max 80 characters.",
    example: "Tariq",
    tone: "emerald",
  },
  lastName: {
    title: "Last Name",
    dtoKey: "lastName (Max 80 chars)",
    description:
      "The person's family name or surname used for directory matching and formal communications.",
    rule: "Optional · Max 80 characters.",
    example: "Al-Ghamdi",
    tone: "emerald",
  },
  phones: {
    title: "Phone / Mobile Numbers",
    dtoKey: "phones[] (E.164 · Max 10 numbers)",
    description:
      "Primary and secondary contact numbers with international calling code selector. Checked live against duplicate records.",
    rule: "Required (at least 1 number) · Max 10 numbers, 32 chars each, no duplicates.",
    example: "+966 50 123 4567",
    tone: "emerald",
  },
  email: {
    title: "Email Address",
    dtoKey: "email (Max 180 chars)",
    description:
      "Direct email address for the individual lead. Used for outbound emails and duplicate detection.",
    rule: "Optional · Valid email format, max 180 characters.",
    example: "tariq@example.sa",
    tone: "emerald",
  },
  existingCompanyPartyId: {
    title: "Existing Directory Company",
    dtoKey: "existingCompanyPartyId (UUIDv7 · Optional)",
    description:
      "Links this lead to an existing Organization Party in the Core Directory instead of creating a duplicate company record.",
    rule: "When linked, organization identity fields become read-only.",
    example: "Acme Trading LLC",
    tone: "violet",
  },
  companyName: {
    title: "Company Trade Name",
    dtoKey: "companyName (Required · Max 160 chars)",
    description:
      "The commercial or brand name of the corporate lead shown on board cards, lists, and search.",
    rule: "Required for new corporate leads · Max 160 characters.",
    example: "Al-Futtaim Logistics",
    tone: "violet",
  },
  legalName: {
    title: "Official Legal Name",
    dtoKey: "legalName (Max 200 chars)",
    description:
      "Full registered legal name of the company as stated on official contracts and tax certificates.",
    rule: "Optional · Max 200 characters.",
    example: "Al-Futtaim Logistics & Supply Chain Co. LLC",
    tone: "violet",
  },
  taxNumber: {
    title: "Tax / VAT Registration Number",
    dtoKey: "taxNumber (Max 60 chars)",
    description:
      "Government tax identification or VAT number. Checked by Duplicate Radar to prevent duplicate corporate filings.",
    rule: "Optional · Max 60 characters.",
    example: "300123456700003",
    tone: "violet",
  },
  commercialRegistrationNumber: {
    title: "Commercial Registration (CR)",
    dtoKey: "commercialRegistrationNumber (Max 60 chars)",
    description:
      "Ministry of Commerce registration number identifying the legal corporate entity.",
    rule: "Optional · Max 60 characters.",
    example: "1010987654",
    tone: "violet",
  },
  companyPhones: {
    title: "Company Switchboard / Phones",
    dtoKey: "companyPhones[] (Max 10 numbers)",
    description:
      "Main corporate switchboard or reception phone numbers belonging to the organization party.",
    rule: "Optional · Up to 10 numbers, 32 characters each, unique.",
    example: "+966 11 200 3000",
    tone: "violet",
  },
  companyEmail: {
    title: "Company Official Email",
    dtoKey: "companyEmail (Max 180 chars)",
    description:
      "General corporate email address (e.g. info@ or procurement@) stored on the organization party.",
    rule: "Optional · Valid email format, max 180 characters.",
    example: "info@alfuttaim-logistics.sa",
    tone: "violet",
  },
  companyWebsite: {
    title: "Company Website URL",
    dtoKey: "companyWebsite (Max 255 chars)",
    description:
      "Official corporate website domain or URL for research and enrichment.",
    rule: "Optional · Max 255 characters.",
    example: "https://www.alfuttaim-logistics.sa",
    tone: "violet",
  },
  contacts: {
    title: "Corporate Contact Persons",
    dtoKey: "contacts[] (1..20 items · Required)",
    description:
      "Key stakeholders and decision-makers at the company. Exactly one contact is designated as Primary.",
    rule: "At least 1 contact required on Corporate leads · Max 20 contacts.",
    example: "Primary Contact: VP of Procurement",
    tone: "sky",
  },
  contactPartyId: {
    title: "Directory Contact Person",
    dtoKey: "contacts[].contactPartyId (UUIDv7)",
    description:
      "Reuses an existing contact person already linked to the selected directory company.",
    rule: "Locks name/phone/email to the directory record; Job Title remains editable.",
    tone: "sky",
  },
  contactFirstName: {
    title: "Contact First Name",
    dtoKey: "contacts[].firstName (Required · Max 80 chars)",
    description:
      "Given name of the contact person at this company.",
    rule: "Required for each new contact · Max 80 characters.",
    example: "Noura",
    tone: "sky",
  },
  contactLastName: {
    title: "Contact Last Name",
    dtoKey: "contacts[].lastName (Max 80 chars)",
    description:
      "Surname of the contact person at this company.",
    rule: "Optional · Max 80 characters.",
    example: "Al-Qahtani",
    tone: "sky",
  },
  contactJobTitle: {
    title: "Contact Job Title",
    dtoKey: "contacts[].jobTitle (Max 120 chars)",
    description:
      "Role or position at the company. Search 100+ standard executive & operational titles or type a custom title.",
    rule: "Optional · Max 120 characters.",
    example: "Procurement Director",
    tone: "sky",
  },
  contactPhones: {
    title: "Contact Direct Phones",
    dtoKey: "contacts[].phones[] (Required · Max 10)",
    description:
      "Direct mobile or extension numbers for reaching this contact person.",
    rule: "At least 1 phone required on primary contact · Max 10 numbers.",
    example: "+966 55 987 6543",
    tone: "sky",
  },
  contactEmail: {
    title: "Contact Work Email",
    dtoKey: "contacts[].email (Max 180 chars)",
    description:
      "Direct business email for this stakeholder.",
    rule: "Optional · Valid email format, max 180 characters.",
    example: "noura.q@company.sa",
    tone: "sky",
  },
  contactPrimary: {
    title: "Primary Contact Designation",
    dtoKey: "contacts[].isPrimary (boolean)",
    description:
      "Marks the main point of contact displayed on kanban cards, table rows, and quick actions.",
    rule: "Exactly one contact is primary.",
    tone: "sky",
  },
  country: {
    title: "Country",
    dtoKey: "address.country (Max 120 chars)",
    description:
      "Selects the country from the ISO catalogue and unlocks cascading State/Region and City lookup.",
    rule: "Optional · Changing country resets State and City.",
    example: "Saudi Arabia",
    tone: "amber",
  },
  state: {
    title: "State / Region / Province",
    dtoKey: "address.state (Max 120 chars)",
    description:
      "Cascading administrative region within the selected country, or custom text.",
    rule: "Optional · Max 120 characters.",
    example: "Riyadh Province",
    tone: "amber",
  },
  city: {
    title: "City",
    dtoKey: "address.city (Max 120 chars)",
    description:
      "Cascading city within the selected state/country, or custom text.",
    rule: "Optional · Max 120 characters.",
    example: "Riyadh",
    tone: "amber",
  },
  street1: {
    title: "Street Line 1",
    dtoKey: "address.street1 (Max 160 chars)",
    description:
      "Primary street name, district, or commercial avenue.",
    rule: "Optional · Max 160 characters.",
    example: "King Fahd Road, Al Olaya",
    tone: "amber",
  },
  street2: {
    title: "Street Line 2",
    dtoKey: "address.street2 (Max 160 chars)",
    description:
      "Secondary address line, industrial zone, or complex name.",
    rule: "Optional · Max 160 characters.",
    example: "Olaya Towers, Tower B",
    tone: "amber",
  },
  buildingNo: {
    title: "Building Number",
    dtoKey: "address.buildingNo (Max 40 chars)",
    description:
      "National address building number or plot identifier.",
    rule: "Optional · Max 40 characters.",
    example: "7421",
    tone: "amber",
  },
  floor: {
    title: "Floor",
    dtoKey: "address.floor (Max 40 chars)",
    description:
      "Floor level within the building.",
    rule: "Optional · Max 40 characters.",
    example: "Floor 14",
    tone: "amber",
  },
  apartment: {
    title: "Suite / Office / Apartment",
    dtoKey: "address.apartment (Max 40 chars)",
    description:
      "Office suite, unit, or apartment number.",
    rule: "Optional · Max 40 characters.",
    example: "Suite 1402",
    tone: "amber",
  },
  landmark: {
    title: "Nearby Landmark",
    dtoKey: "address.landmark (Max 160 chars)",
    description:
      "Prominent nearby landmark to assist field visits and deliveries.",
    rule: "Optional · Max 160 characters.",
    example: "Opposite Kingdom Centre",
    tone: "amber",
  },
  postalCode: {
    title: "Postal / ZIP Code",
    dtoKey: "address.postalCode (Max 24 chars)",
    description:
      "National postal code for the address.",
    rule: "Optional · Max 24 characters.",
    example: "12214",
    tone: "amber",
  },
  interestSummary: {
    title: "Interest Summary",
    dtoKey: "interestSummary (Max 4000 chars)",
    description:
      "Captures which products, services, or solutions the lead expressed interest in.",
    rule: "Optional · Up to 4,000 characters.",
    example: "Interested in ERP & CRM cloud deployment for 120 users.",
    tone: "violet",
  },
  expectedNeed: {
    title: "Expected Business Need",
    dtoKey: "expectedNeed (Max 4000 chars)",
    description:
      "Documents the prospect's timeline, pain points, budget scope, and decision criteria.",
    rule: "Optional · Up to 4,000 characters.",
    example: "Needs multi-branch inventory sync before Q1 launch.",
    tone: "violet",
  },
  description: {
    title: "Internal Qualification Notes",
    dtoKey: "description (Max 2000 chars)",
    description:
      "Background context and handover notes for sales reps during qualification.",
    rule: "Optional · Up to 2,000 characters.",
    example: "Met at LEAP conference; requested demo next Tuesday.",
    tone: "violet",
  },
  customFields: {
    title: "Tenant Custom Field",
    dtoKey: "customFields.<fieldKey>",
    description:
      "Dynamic field configured by your workspace administrator for Lead records.",
    rule: "Validated against the tenant's custom field schema on create.",
    tone: "teal",
  },
};

const GUIDE_AR: Record<LeadFieldGuideKey, LeadFieldGuideEntry> = {
  branchId: {
    title: "نطاق الفرع المستهدف",
    dtoKey: "branchId (UUIDv7 · إلزامي)",
    description:
      "يحدد الفرع التشغيلي المالك لهذا العميل المحتمل ومراحل المبيعات ودليل الجهات المرتبط به.",
    rule: "يجب أن يكون ضمن الفروع المصرح لك بها.",
    example: "فرع الرياض الرئيسي",
    tone: "indigo",
  },
  ownerUserId: {
    title: "مسؤول المبيعات المعين",
    dtoKey: "ownerUserId (UUIDv7 · اختياري)",
    description:
      "يسند العميل المحتمل إلى موظف مبيعات نشط في الفرع المحدد، أو للمستخدم الحالي تلقائياً عند تركه فارغاً.",
    rule: "مستخدم نشط في نفس الفرع.",
    example: "سارة المنصور",
    tone: "indigo",
  },
  companyId: {
    title: "الشركة الأم",
    dtoKey: "X-Organization-Id (UUIDv7)",
    description:
      "تحديد المنشأة الأم عندما يرتبط حسابك بأكثر من شركة داخل المنصة.",
    rule: "إلزامي عند تعدد الشركات.",
    tone: "indigo",
  },
  leadProfileType: {
    title: "نوع ملف العميل المحتمل",
    dtoKey: "leadProfileType ('INDIVIDUAL' | 'CORPORATE')",
    description:
      "يحدد هيكل السجل: فرد (B2C لشخص واحد) أو شركة (B2B لمنشأة مع حتى 20 جهة اتصال).",
    rule: "التبديل ينظف الحقول غير المتوافقة تلقائياً.",
    example: "فرد أو شركة",
    tone: "indigo",
  },
  stageId: {
    title: "مرحلة المسار البيعي",
    dtoKey: "stageId (UUIDv7 · اختياري)",
    description:
      "يضع العميل المحتمل في مرحلة محددة على لوحة المبيعات، أو المرحلة الافتراضية للفرع عند عدم التحديد.",
    rule: "تُستبعد مراحل التحويل النهائية عند الإنشاء.",
    example: "جديد / تأهيل أولي",
    tone: "indigo",
  },
  acquisitionSourceId: {
    title: "مصدر الاستقطاب",
    dtoKey: "acquisitionSourceId (UUIDv7 · إلزامي)",
    description:
      "يوثق القناة التسويقية أو مصدر الإحالة الذي جاء منه العميل المحتمل لقياس العائد.",
    rule: "حقل إلزامي عند إنشاء العميل المحتمل.",
    example: "الموقع الإلكتروني، إعلانات لينكدإن، توصية",
    tone: "indigo",
  },
  tagIds: {
    title: "وسوم التصنيف",
    dtoKey: "tagIds (string[] · حتى 50 وسماً)",
    description:
      "إرفاق حتى 50 وسماً ملوناً لتصنيف وفلترة العملاء المحتملين في اللوحة والجدول.",
    rule: "بحد أقصى 50 وسماً مع إمكانية الإنشاء الفوري.",
    example: "عميل مهم، حملة الربع الرابع",
    tone: "indigo",
  },
  honorificTitle: {
    title: "اللقب",
    dtoKey: "honorificTitle (حتى 40 حرفاً)",
    description:
      "بادئة اللقب الرسمي المحفوظة في سجل الشخص والمستخدمة في قوالب البريد.",
    rule: "اختياري · بحد أقصى 40 حرفاً.",
    example: "السيد، السيدة، د.، م.",
    tone: "emerald",
  },
  firstName: {
    title: "الاسم الأول",
    dtoKey: "firstName (إلزامي · حتى 80 حرفاً)",
    description:
      "الاسم الأول للشخص، يُدمج مع اسم العائلة لتكوين الاسم الكامل تلقائياً.",
    rule: "إلزامي للعميل الفرد · حتى 80 حرفاً.",
    example: "طارق",
    tone: "emerald",
  },
  lastName: {
    title: "اسم العائلة",
    dtoKey: "lastName (حتى 80 حرفاً)",
    description:
      "اللقب العائلي للشخص للمطابقة في الدليل والمراسلات الرسمية.",
    rule: "اختياري · حتى 80 حرفاً.",
    example: "الغامدي",
    tone: "emerald",
  },
  phones: {
    title: "أرقام الهاتف / الجوال",
    dtoKey: "phones[] (E.164 · حتى 10 أرقام)",
    description:
      "أرقام التواصل مع مفتاح الدولة الدولي وفحص فوري لمنع تكرار السجلات.",
    rule: "إلزامي (رقم واحد على الأقل) · حتى 10 أرقام بدون تكرار.",
    example: "+966 50 123 4567",
    tone: "emerald",
  },
  email: {
    title: "البريد الإلكتروني",
    dtoKey: "email (حتى 180 حرفاً)",
    description:
      "عنوان البريد الإلكتروني المباشر للعميل المحتمل الفرد.",
    rule: "اختياري · صيغة بريد صحيحة حتى 180 حرفاً.",
    example: "tariq@example.sa",
    tone: "emerald",
  },
  existingCompanyPartyId: {
    title: "ربط بشركة مسجلة في الدليل",
    dtoKey: "existingCompanyPartyId (UUIDv7 · اختياري)",
    description:
      "يربط العميل المحتمل بمنشأة موجودة مسبقاً في الدليل العام بدلاً من إنشاء سجل شركة مكرر.",
    rule: "عند الربط تُقفل حقول تعريف الشركة للقراءة فقط.",
    example: "شركة أكمي للتجارة",
    tone: "violet",
  },
  companyName: {
    title: "الاسم التجاري للشركة",
    dtoKey: "companyName (إلزامي · حتى 160 حرفاً)",
    description:
      "الاسم التجاري أو العلامة التجارية للشركة التي تظهر في البطاقات والبحث.",
    rule: "إلزامي للشركة الجديدة · حتى 160 حرفاً.",
    example: "الفطيم للخدمات اللوجستية",
    tone: "violet",
  },
  legalName: {
    title: "الاسم القانوني الرسمي",
    dtoKey: "legalName (حتى 200 حرف)",
    description:
      "الاسم القانوني المسجل في السجل التجاري والعقود والفواتير الضريبية.",
    rule: "اختياري · حتى 200 حرف.",
    example: "شركة الفطيم للخدمات اللوجستية وسلاسل الإمداد ذ.م.م",
    tone: "violet",
  },
  taxNumber: {
    title: "الرقم الضريبي (VAT)",
    dtoKey: "taxNumber (حتى 60 حرفاً)",
    description:
      "الرقم الضريبي للمنشأة ويُفحص تلقائياً بواسطة رادار التكرار.",
    rule: "اختياري · حتى 60 حرفاً.",
    example: "300123456700003",
    tone: "violet",
  },
  commercialRegistrationNumber: {
    title: "رقم السجل التجاري (CR)",
    dtoKey: "commercialRegistrationNumber (حتى 60 حرفاً)",
    description:
      "رقم السجل التجاري الرسمي الصادر للمنشأة.",
    rule: "اختياري · حتى 60 حرفاً.",
    example: "1010987654",
    tone: "violet",
  },
  companyPhones: {
    title: "هواتف الشركة / السنترال",
    dtoKey: "companyPhones[] (حتى 10 أرقام)",
    description:
      "أرقام الهواتف الرئيسية أو السنترال الخاص بالمنشأة.",
    rule: "اختياري · حتى 10 أرقام بدون تكرار.",
    example: "+966 11 200 3000",
    tone: "violet",
  },
  companyEmail: {
    title: "البريد الرسمي للشركة",
    dtoKey: "companyEmail (حتى 180 حرفاً)",
    description:
      "البريد الإلكتروني العام للشركة مثل info@ أو المشتريات.",
    rule: "اختياري · صيغة بريد صحيحة حتى 180 حرفاً.",
    example: "info@alfuttaim-logistics.sa",
    tone: "violet",
  },
  companyWebsite: {
    title: "الموقع الإلكتروني للشركة",
    dtoKey: "companyWebsite (حتى 255 حرفاً)",
    description:
      "رابط الموقع الرسمي للشركة على الإنترنت.",
    rule: "اختياري · حتى 255 حرفاً.",
    example: "https://www.alfuttaim-logistics.sa",
    tone: "violet",
  },
  contacts: {
    title: "جهات الاتصال في الشركة",
    dtoKey: "contacts[] (1..20 شخصاً · إلزامي)",
    description:
      "الأشخاص المعنيون وصناع القرار داخل الشركة مع تحديد جهة اتصال رئيسية واحدة.",
    rule: "يلزم إضافة جهة اتصال واحدة على الأقل · بحد أقصى 20.",
    example: "جهة الاتصال الرئيسية: مدير المشتريات",
    tone: "sky",
  },
  contactPartyId: {
    title: "اختيار شخص من دليل الشركة",
    dtoKey: "contacts[].contactPartyId (UUIDv7)",
    description:
      "إعادة استخدام شخص مسجل مسبقاً ومرتبط بالشركة المختارة من الدليل.",
    rule: "يحتفظ بالاسم والهاتف من الدليل مع إتاحة تعديل المسمى الوظيفي.",
    tone: "sky",
  },
  contactFirstName: {
    title: "الاسم الأول لجهة الاتصال",
    dtoKey: "contacts[].firstName (إلزامي · حتى 80 حرفاً)",
    description: "الاسم الأول للشخص المسؤول داخل الشركة.",
    rule: "إلزامي لكل جهة اتصال جديدة · حتى 80 حرفاً.",
    example: "نورة",
    tone: "sky",
  },
  contactLastName: {
    title: "اسم العائلة لجهة الاتصال",
    dtoKey: "contacts[].lastName (حتى 80 حرفاً)",
    description: "اسم العائلة للشخص المسؤول داخل الشركة.",
    rule: "اختياري · حتى 80 حرفاً.",
    example: "القحطاني",
    tone: "sky",
  },
  contactJobTitle: {
    title: "المسمى الوظيفي",
    dtoKey: "contacts[].jobTitle (حتى 120 حرفاً)",
    description:
      "المنصب الوظيفي داخل الشركة مع بحث فوري في أكثر من 100 مسمى قياسي أو كتابة مسمى مخصص.",
    rule: "اختياري · حتى 120 حرفاً.",
    example: "مدير المشتريات",
    tone: "sky",
  },
  contactPhones: {
    title: "هواتف جهة الاتصال",
    dtoKey: "contacts[].phones[] (إلزامي · حتى 10)",
    description: "أرقام الجوال أو التحويلة المباشرة للتواصل مع هذا الشخص.",
    rule: "يلزم رقم واحد على الأقل لجهة الاتصال الرئيسية · حتى 10 أرقام.",
    example: "+966 55 987 6543",
    tone: "sky",
  },
  contactEmail: {
    title: "البريد الإلكتروني لجهة الاتصال",
    dtoKey: "contacts[].email (حتى 180 حرفاً)",
    description: "البريد الإلكتروني المباشر لجهة الاتصال في الشركة.",
    rule: "اختياري · صيغة بريد صحيحة حتى 180 حرفاً.",
    example: "noura.q@company.sa",
    tone: "sky",
  },
  contactPrimary: {
    title: "تعيين كجهة اتصال رئيسية",
    dtoKey: "contacts[].isPrimary (boolean)",
    description:
      "يحدد الشخص الرئيسي الذي يظهر اسمه ورقمه في بطاقات اللوحة والجدول.",
    rule: "جهة اتصال رئيسية واحدة فقط.",
    tone: "sky",
  },
  country: {
    title: "الدولة",
    dtoKey: "address.country (حتى 120 حرفاً)",
    description:
      "اختيار الدولة من الدليل العالمي لتفعيل البحث المتسلسل للمنطقة والمدينة.",
    rule: "اختياري · تغيير الدولة يعيد ضبط المنطقة والمدينة.",
    example: "المملكة العربية السعودية",
    tone: "amber",
  },
  state: {
    title: "المنطقة / المحافظة / الولاية",
    dtoKey: "address.state (حتى 120 حرفاً)",
    description: "المنطقة الإدارية التابعة للدولة المختارة أو إدخال نصي حر.",
    rule: "اختياري · حتى 120 حرفاً.",
    example: "منطقة الرياض",
    tone: "amber",
  },
  city: {
    title: "المدينة",
    dtoKey: "address.city (حتى 120 حرفاً)",
    description: "المدينة التابعة للمنطقة والدولة المختارة أو إدخال نصي حر.",
    rule: "اختياري · حتى 120 حرفاً.",
    example: "الرياض",
    tone: "amber",
  },
  street1: {
    title: "العنوان - السطر الأول",
    dtoKey: "address.street1 (حتى 160 حرفاً)",
    description: "اسم الشارع الرئيسي أو الحي أو المنطقة التجارية.",
    rule: "اختياري · حتى 160 حرفاً.",
    example: "طريق الملك فهد، حي العليا",
    tone: "amber",
  },
  street2: {
    title: "العنوان - السطر الثاني",
    dtoKey: "address.street2 (حتى 160 حرفاً)",
    description: "تفاصيل إضافية للعنوان مثل اسم المجمع أو البرج التجاري.",
    rule: "اختياري · حتى 160 حرفاً.",
    example: "أبراج العليا، برج ب",
    tone: "amber",
  },
  buildingNo: {
    title: "رقم المبنى",
    dtoKey: "address.buildingNo (حتى 40 حرفاً)",
    description: "رقم المبنى في العنوان الوطني أو رقم العقار.",
    rule: "اختياري · حتى 40 حرفاً.",
    example: "7421",
    tone: "amber",
  },
  floor: {
    title: "الطابق / الدور",
    dtoKey: "address.floor (حتى 40 حرفاً)",
    description: "رقم الطابق داخل المبنى.",
    rule: "اختياري · حتى 40 حرفاً.",
    example: "الطابق 14",
    tone: "amber",
  },
  apartment: {
    title: "المكتب / الوحدة / الشقة",
    dtoKey: "address.apartment (حتى 40 حرفاً)",
    description: "رقم المكتب أو الجناح أو الوحدة الفرعية.",
    rule: "اختياري · حتى 40 حرفاً.",
    example: "مكتب 1402",
    tone: "amber",
  },
  landmark: {
    title: "معلم قريب مميز",
    dtoKey: "address.landmark (حتى 160 حرفاً)",
    description: "معلم معروف بالقرب من الموقع لتسهيل الوصول والزيارات الميدانية.",
    rule: "اختياري · حتى 160 حرفاً.",
    example: "مقابل برج المملكة",
    tone: "amber",
  },
  postalCode: {
    title: "الرمز البريدي",
    dtoKey: "address.postalCode (حتى 24 حرفاً)",
    description: "الرمز البريدي الوطني للموقع.",
    rule: "اختياري · حتى 24 حرفاً.",
    example: "12214",
    tone: "amber",
  },
  interestSummary: {
    title: "ملخص الاهتمامات",
    dtoKey: "interestSummary (حتى 4000 حرف)",
    description: "المنتجات أو الحلول أو الخدمات التي أبدى العميل المحتمل اهتمامه بها.",
    rule: "اختياري · حتى 4,000 حرف.",
    example: "مهتم بنظام تخطيط الموارد والمبيعات السحابي لـ 120 مستخدماً.",
    tone: "violet",
  },
  expectedNeed: {
    title: "الاحتياج المتوقع",
    dtoKey: "expectedNeed (حتى 4000 حرف)",
    description: "توصيف احتياجات العميل والجدول الزمني والميزانية المتوقعة.",
    rule: "اختياري · حتى 4,000 حرف.",
    example: "يحتاج ربط المخزون بين الفروع قبل بداية الربع الأول.",
    tone: "violet",
  },
  description: {
    title: "ملاحظات التأهيل الداخلية",
    dtoKey: "description (حتى 2000 حرف)",
    description: "ملاحظات داخلية لفريق المبيعات حول خلفية العميل المحتمل ومتابعته.",
    rule: "اختياري · حتى 2,000 حرف.",
    example: "تم اللقاء في مؤتمر LEAP وطلب عرضاً توضيحياً الأسبوع القادم.",
    tone: "violet",
  },
  customFields: {
    title: "حقل مخصص للمنشأة",
    dtoKey: "customFields.<fieldKey>",
    description: "حقل ديناميكي تم تعريفه بواسطة مدير النظام لسجلات العملاء المحتملين.",
    rule: "يخضع لقواعد التحقق الخاصة بالحقول المخصصة عند الإنشاء.",
    tone: "teal",
  },
};

const TONE_BADGE_STYLES: Record<LeadFieldGuideTone, string> = {
  indigo:
    "border-indigo-500/35 bg-indigo-500/12 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white",
  emerald:
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500 dark:hover:text-white",
  violet:
    "border-violet-500/35 bg-violet-500/12 text-violet-600 hover:bg-violet-600 hover:text-white dark:border-violet-400/40 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500 dark:hover:text-white",
  sky: "border-sky-500/35 bg-sky-500/12 text-sky-600 hover:bg-sky-600 hover:text-white dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-white",
  amber:
    "border-amber-500/35 bg-amber-500/12 text-amber-600 hover:bg-amber-600 hover:text-white dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white",
  teal: "border-teal-500/35 bg-teal-500/12 text-teal-600 hover:bg-teal-600 hover:text-white dark:border-teal-400/40 dark:bg-teal-500/20 dark:text-teal-300 dark:hover:bg-teal-500 dark:hover:text-white",
  rose: "border-rose-500/35 bg-rose-500/12 text-rose-600 hover:bg-rose-600 hover:text-white dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500 dark:hover:text-white",
};

export interface LeadFieldGuideProps {
  field: LeadFieldGuideKey;
  customEntry?: Partial<LeadFieldGuideEntry>;
  align?: "start" | "end";
  className?: string;
}

/**
 * Interactive `!` badge that displays a rich glassmorphic field guide card on
 * hover or focus, detailing the field's purpose, DTO contract key, validation
 * rules, and example value without polluting static DOM queries when closed.
 */
export function LeadFieldGuide({
  field,
  customEntry,
  align = "end",
  className,
}: LeadFieldGuideProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);

  const dictionary = lang === "ar" ? GUIDE_AR : GUIDE_EN;
  const base = dictionary[field];
  const entry: LeadFieldGuideEntry = {
    ...base,
    ...customEntry,
  };
  const tone = entry.tone ?? "indigo";

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="note"
        tabIndex={0}
        data-field-guide={field}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn(
          "inline-flex size-4 cursor-help select-none items-center justify-center rounded-full border text-[10px] font-extrabold leading-none shadow-2xs transition-all duration-150",
          TONE_BADGE_STYLES[tone],
        )}
      >
        !
      </span>

      {open && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-[calc(100%+8px)] z-50 w-72 rounded-xl border border-slate-700/90 bg-slate-900/95 p-3 text-start text-xs text-slate-100 shadow-2xl backdrop-blur-md",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className="font-bold text-white">{entry.title}</span>
            <span
              dir="ltr"
              className="shrink-0 rounded border border-indigo-400/30 bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-200"
            >
              {entry.dtoKey}
            </span>
          </div>
          <p className="leading-relaxed text-slate-300">{entry.description}</p>
          {entry.rule && (
            <div className="mt-2 border-t border-slate-700/80 pt-1.5 text-[11px] font-medium text-emerald-300">
              {entry.rule}
            </div>
          )}
          {entry.example && (
            <div className="mt-1 text-[11px] text-sky-300">
              <span className="font-semibold text-slate-400">
                {lang === "ar" ? "مثال: " : "Example: "}
              </span>
              <span dir="auto">{entry.example}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
