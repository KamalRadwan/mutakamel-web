export interface ProvisioningGovernanceCopy {
  title: string;
  subtitle: string;
  catalogue: string;
  discovery: string;
  fleet: string;
  releaseGovernance: string;
  publisherKeys: string;
  openWorkspace: string;
  readOnly: string;
  search: string;
  componentKey: string;
  ownerApp: string;
  kind: string;
  allKinds: string;
  apply: string;
  reset: string;
  refresh: string;
  loading: string;
  emptyComponents: string;
  emptyReleases: string;
  emptyRuns: string;
  forbiddenCatalogue: string;
  forbiddenDiscovery: string;
  unavailable: string;
  error: string;
  retry: string;
  releases: string;
  inspectReleases: string;
  close: string;
  latestRelease: string;
  noRelease: string;
  mandatory: string;
  optional: string;
  contract: string;
  updated: string;
  risk: string;
  allRisks: string;
  selfService: string;
  backup: string;
  maintenance: string;
  any: string;
  yes: string;
  no: string;
  version: string;
  schema: string;
  published: string;
  seedPacks: string;
  compatibility: string;
  manifestUnavailable: string;
  page: string;
  pageSize: string;
  sortBy: string;
  sortDirection: string;
  ascending: string;
  descending: string;
  createdAt: string;
  of: string;
  previous: string;
  next: string;
  correlation: string;
  responseAt: string;
  startDiscovery: string;
  mode: string;
  dryRun: string;
  manual: string;
  cutoff: string;
  maxTenants: string;
  validate: string;
  confirmationTitle: string;
  confirmationText: string;
  confirmationToken: string;
  run: string;
  running: string;
  created: string;
  exactRetry: string;
  validationCutoff: string;
  validationMax: string;
  validationComponentKey: string;
  validationOwnerApp: string;
  permissionRun: string;
  status: string;
  scheduled: string;
  scanned: string;
  eligible: string;
  remaining: string;
  drifted: string;
  incompatible: string;
  complete: string;
  inspect: string;
  results: string;
  tenant: string;
  component: string;
  observed: string;
  safeCode: string;
  truncated: string;
  errorCode: string;
}

export const COPY: Record<"ar" | "en", ProvisioningGovernanceCopy> = {
  en: {
    title: "Provisioning governance",
    subtitle:
      "Inspect the active component catalogue and run bounded fleet discovery without exposing manifests, credentials, or tenant secrets.",
    catalogue: "Component catalogue",
    discovery: "Discovery runs",
    fleet: "Fleet rollouts",
    releaseGovernance: "Release governance",
    publisherKeys: "Publisher keys",
    openWorkspace: "Open workspace",
    readOnly: "Secret-free evidence",
    search: "Search key, owner, release, or schema",
    componentKey: "Exact component key",
    ownerApp: "Owner application",
    kind: "Component kind",
    allKinds: "All kinds",
    apply: "Apply filters",
    reset: "Reset",
    refresh: "Refresh",
    loading: "Loading governance evidence…",
    emptyComponents: "No active components match these filters.",
    emptyReleases: "No published releases match these filters.",
    emptyRuns: "No provisioning discovery runs are recorded.",
    forbiddenCatalogue: "You cannot read the provisioning catalogue.",
    forbiddenDiscovery: "You cannot read provisioning discovery runs.",
    unavailable: "Provisioning governance is temporarily unavailable.",
    error: "Governance evidence could not be loaded.",
    retry: "Retry",
    releases: "Published releases",
    inspectReleases: "Inspect releases",
    close: "Close",
    latestRelease: "Latest release",
    noRelease: "No published release",
    mandatory: "Mandatory",
    optional: "Optional",
    contract: "Contract version",
    updated: "Updated",
    risk: "Risk",
    allRisks: "All risk levels",
    selfService: "Self service",
    backup: "Requires backup",
    maintenance: "Requires maintenance",
    any: "Any",
    yes: "Yes",
    no: "No",
    version: "Version",
    schema: "Schema target",
    published: "Published",
    seedPacks: "Seed packs",
    compatibility: "Required components",
    manifestUnavailable: "Manifest summary unavailable",
    page: "Page",
    pageSize: "Rows per page",
    sortBy: "Sort field",
    sortDirection: "Sort direction",
    ascending: "Ascending",
    descending: "Descending",
    createdAt: "Created",
    of: "of",
    previous: "Previous",
    next: "Next",
    correlation: "Correlation ID",
    responseAt: "Response received",
    startDiscovery: "Start bounded discovery",
    mode: "Mode",
    dryRun: "Dry run",
    manual: "Manual scan",
    cutoff: "Evidence cutoff (UTC)",
    maxTenants: "Maximum tenants (1–10,000)",
    validate: "Review command",
    confirmationTitle: "Start this provisioning discovery run?",
    confirmationText:
      "This scans bounded, secret-free installation evidence. Type RUN to submit the exact command.",
    confirmationToken: "Type RUN",
    run: "Start discovery",
    running: "Starting…",
    created: "Discovery run accepted.",
    exactRetry: "Retry exact command",
    validationCutoff: "Choose a valid UTC time that is not in the future.",
    validationMax: "Enter an integer from 1 through 10,000.",
    validationComponentKey:
      "Use a lowercase component key such as core.identity or module.crm_v2.",
    validationOwnerApp:
      "Use a lowercase application key (letters, digits, underscores, or hyphens; maximum 32 characters).",
    permissionRun:
      "Starting a run requires admin.provisioning.discovery.run and admin.provisioning.critical.",
    status: "Status",
    scheduled: "Scheduled",
    scanned: "Scanned",
    eligible: "Eligible",
    remaining: "Remaining",
    drifted: "Drifted",
    incompatible: "Incompatible",
    complete: "Sweep complete",
    inspect: "Inspect results",
    results: "Discovery results",
    tenant: "Tenant",
    component: "Component",
    observed: "Observed",
    safeCode: "Safe code",
    truncated: "Only the first 1,000 results are shown.",
    errorCode: "Error code",
  },
  ar: {
    title: "حوكمة التجهيز",
    subtitle:
      "افحص كتالوج المكوّنات النشط وشغّل اكتشافًا محدودًا للأسطول دون كشف البيانات السرية أو الاعتمادات أو أسرار المستأجرين.",
    catalogue: "كتالوج المكوّنات",
    discovery: "عمليات الاكتشاف",
    fleet: "عمليات إطلاق الأسطول",
    releaseGovernance: "حوكمة الإصدارات",
    publisherKeys: "مفاتيح الناشرين",
    openWorkspace: "فتح مساحة العمل",
    readOnly: "أدلة خالية من الأسرار",
    search: "البحث في المفتاح أو المالك أو الإصدار أو المخطط",
    componentKey: "مفتاح المكوّن الدقيق",
    ownerApp: "التطبيق المالك",
    kind: "نوع المكوّن",
    allKinds: "كل الأنواع",
    apply: "تطبيق المرشحات",
    reset: "إعادة الضبط",
    refresh: "تحديث",
    loading: "جارٍ تحميل أدلة الحوكمة…",
    emptyComponents: "لا توجد مكوّنات نشطة تطابق هذه المرشحات.",
    emptyReleases: "لا توجد إصدارات منشورة تطابق هذه المرشحات.",
    emptyRuns: "لا توجد عمليات اكتشاف تجهيز مسجلة.",
    forbiddenCatalogue: "لا تملك صلاحية قراءة كتالوج التجهيز.",
    forbiddenDiscovery: "لا تملك صلاحية قراءة عمليات اكتشاف التجهيز.",
    unavailable: "حوكمة التجهيز غير متاحة مؤقتًا.",
    error: "تعذر تحميل أدلة الحوكمة.",
    retry: "إعادة المحاولة",
    releases: "الإصدارات المنشورة",
    inspectReleases: "فحص الإصدارات",
    close: "إغلاق",
    latestRelease: "أحدث إصدار",
    noRelease: "لا يوجد إصدار منشور",
    mandatory: "إلزامي",
    optional: "اختياري",
    contract: "إصدار العقد",
    updated: "آخر تحديث",
    risk: "المخاطر",
    allRisks: "كل مستويات المخاطر",
    selfService: "الخدمة الذاتية",
    backup: "يتطلب نسخة احتياطية",
    maintenance: "يتطلب صيانة",
    any: "الكل",
    yes: "نعم",
    no: "لا",
    version: "الإصدار",
    schema: "المخطط المستهدف",
    published: "تاريخ النشر",
    seedPacks: "حزم البذور",
    compatibility: "المكوّنات المطلوبة",
    manifestUnavailable: "ملخص البيان غير متاح",
    page: "الصفحة",
    pageSize: "عدد الصفوف في الصفحة",
    sortBy: "حقل الترتيب",
    sortDirection: "اتجاه الترتيب",
    ascending: "تصاعدي",
    descending: "تنازلي",
    createdAt: "تاريخ الإنشاء",
    of: "من",
    previous: "السابق",
    next: "التالي",
    correlation: "معرّف الارتباط",
    responseAt: "وقت استلام الاستجابة",
    startDiscovery: "بدء اكتشاف محدود",
    mode: "الوضع",
    dryRun: "تشغيل تجريبي",
    manual: "فحص يدوي",
    cutoff: "حد الأدلة الزمني (UTC)",
    maxTenants: "الحد الأقصى للمستأجرين (1–10,000)",
    validate: "مراجعة الأمر",
    confirmationTitle: "بدء عملية اكتشاف التجهيز؟",
    confirmationText:
      "يفحص هذا الأمر أدلة تثبيت محدودة وخالية من الأسرار. اكتب RUN لإرسال الأمر الدقيق.",
    confirmationToken: "اكتب RUN",
    run: "بدء الاكتشاف",
    running: "جارٍ البدء…",
    created: "تم قبول عملية الاكتشاف.",
    exactRetry: "إعادة محاولة الأمر نفسه",
    validationCutoff: "اختر وقت UTC صالحًا لا يقع في المستقبل.",
    validationMax: "أدخل عددًا صحيحًا من 1 إلى 10,000.",
    validationComponentKey:
      "استخدم مفتاح مكوّن بأحرف إنجليزية صغيرة مثل core.identity أو module.crm_v2.",
    validationOwnerApp:
      "استخدم مفتاح تطبيق بأحرف إنجليزية صغيرة وأرقام وشرطة سفلية أو واصلة، وبحد أقصى 32 حرفًا.",
    permissionRun:
      "يتطلب بدء العملية صلاحيتي admin.provisioning.discovery.run وadmin.provisioning.critical.",
    status: "الحالة",
    scheduled: "الموعد",
    scanned: "تم فحصه",
    eligible: "المؤهل",
    remaining: "المتبقي",
    drifted: "المنحرف",
    incompatible: "غير المتوافق",
    complete: "اكتمل المسح",
    inspect: "فحص النتائج",
    results: "نتائج الاكتشاف",
    tenant: "المستأجر",
    component: "المكوّن",
    observed: "وقت الرصد",
    safeCode: "الرمز الآمن",
    truncated: "تظهر أول 1,000 نتيجة فقط.",
    errorCode: "رمز الخطأ",
  },
};
