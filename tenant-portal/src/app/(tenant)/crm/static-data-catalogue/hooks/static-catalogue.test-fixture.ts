const option = (value: string, en: string, ar: string) => ({ value, label: { en, ar } });

export const catalogueFixture = {
  enumOptions: {
    profileTypes: [option("INDIVIDUAL", "Individual", "فرد"), option("CORPORATE", "Corporate", "شركة")],
    customerStatuses: [option("ACTIVE_CUSTOMER", "Active customer", "عميل نشط")],
    leadStatuses: [option("OPEN", "Open", "مفتوح")],
    leadStageFlags: [option("NEW", "New", "جديد")],
    opportunityStatuses: [option("WON", "Won", "فوز"), option("LOST", "Lost", "خسارة"),
      option("ON_HOLD", "On hold", "معلق"), option("IN_PROGRESS", "In progress", "قيد التنفيذ")],
    opportunityStageFlags: [option("WON", "Won stage", "مرحلة الفوز"), option("LOST", "Lost stage", "مرحلة الخسارة"),
      option("ON_HOLD", "On hold stage", "مرحلة التعليق")],
    customFieldOwnerTypes: [option("LEAD_AND_PARTY", "Lead and party", "العميل المحتمل والطرف")],
    customFieldTypes: [option("TEXT", "Text", "نص"), option("TEXTAREA", "Textarea", "نص طويل"),
      option("NUMBER", "Number", "رقم"), option("DATE", "Date", "تاريخ"), option("DATETIME", "Date and time", "تاريخ ووقت"),
      option("BOOLEAN", "Boolean", "منطقي"), option("SELECT", "Select", "اختيار")],
    fieldRequirementOperations: [option("CREATE", "Create", "إنشاء")],
    activityTypes: [option("CALL", "Call", "مكالمة")],
    activityStatuses: [option("OPEN", "Open", "مفتوح"), option("DONE", "Done", "مكتمل")],
  },
  attachmentPolicy: {
    maxSizeBytes: 26_214_400,
    familyLabels: [option("pdf", "PDF", "PDF"), option("images", "Images", "صور"),
      option("word", "Word", "Word"), option("excel", "Excel", "Excel"), option("text", "Text", "نصوص")],
    rejectedFamilyLabels: [option("executables", "Executables", "ملفات تنفيذية"), option("scripts", "Scripts", "نصوص برمجية")],
  },
  permissionOptions: [option("crm.settings.read", "Read CRM settings", "قراءة إعدادات CRM"),
    option("crm.leads.read.own", "Read own leads", "Read own leads")],
  ownerTypeOptions: [option("LEAD", "Lead", "عميل محتمل")],
  eventOptions: [option("crm.lead.created", "Lead created", "إنشاء عميل محتمل")],
  derivedRules: {
    opportunityStatusByStageFlag: { WON: "WON", LOST: "LOST", ON_HOLD: "ON_HOLD", default: "IN_PROGRESS" },
    leadConversionCopiesCustomFieldOwnerType: "LEAD_AND_PARTY",
  },
};
