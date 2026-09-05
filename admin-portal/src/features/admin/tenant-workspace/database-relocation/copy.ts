/**
 * Screen copy for the database relocation wizard.
 *
 * Feature-local, matching `TenantWorkspaceScreen.tsx` and the neighbouring
 * tenant-workspace panels rather than the shared dictionaries: these strings
 * are used by exactly one route each and never by navigation or the command
 * palette.
 */
export const relocationCopy = {
  en: {
    breadcrumbTenant: "Tenant workspace",
    back: "Back to tenant",
    pageTitle: "Move tenant database",
    pageDescription:
      "Copy this tenant's database to another Database Server, move its placement, and keep the source until you release it.",
    loading: "Loading relocation preflight…",
    preflightFailed: "Relocation preflight is unavailable.",
    retry: "Retry",
    refresh: "Refresh",

    currentPlacement: "Current placement",
    currentServer: "Database Server",
    currentDatabase: "Database name",
    placementRevision: "Placement revision",
    tenantStatus: "Tenant status",
    unnamedServer: "Unnamed server",

    destination: "Destination Database Server",
    destinationPlaceholder: "Select a destination",
    destinationHint:
      "Only servers that are ACTIVE, have free tenant capacity, and can serve every application this tenant runs are listed.",
    noTargetsTitle: "No destination is eligible",
    noTargetsDescription:
      "No other Database Server is currently ACTIVE with free capacity and ready for every application this tenant runs. Register or activate one, then reload this page.",
    capacity: "tenants",

    reason: "Reason",
    reasonHint: "1–500 characters. Recorded on the relocation ledger.",
    reasonRequired: "A reason is required.",
    reasonTooLong: "The reason may not exceed 500 characters.",

    retentionDays: "Keep the source database for",
    retentionUnit: "days",
    retentionHint: "The source stays available for rollback for this long after the move.",
    retentionOutOfRange: "Choose a whole number of days within the stated range.",

    blockersTitle: "This tenant cannot be moved right now",
    blockersDescription:
      "The service refuses a move while any of the following holds. The page stays open so you can see exactly what to clear.",

    submit: "Start relocation",
    submitting: "Starting…",
    confirmTitle: "Confirm tenant database relocation",
    confirmDescription:
      "This copies the tenant database to the destination, freezes writes, and moves the tenant's placement. Type the tenant id to confirm.",
    confirmAction: "Start relocation",
    missingPermissions: "Starting a relocation requires:",
    noDestinationSelected: "Select a destination server first.",

    monitorTitle: "Relocation progress",
    monitorDescription:
      "Ten steps, in order. A step with no entry has not run yet; the ledger records only settled steps.",
    autoRefreshing: "Refreshing automatically",
    refreshPaused: "Automatic refresh is paused",
    relocationId: "Relocation id",
    runId: "Run id",
    startedAt: "Started",
    movingFrom: "From",
    movingTo: "To",

    finishTitle: "Relocation outcome",
    outcomeRelocated: "The tenant now runs on the destination server.",
    outcomeAbandoned: "The relocation was abandoned.",
    failedStep: "Failed step",
    rollbackTitle: "Rollback that applies",
    retainUntil: "Source retained until",
    sourceDestroyedAt: "Source released at",
    startAnother: "Start another move",

    releaseTitle: "Release the retained source",
    releaseDescription:
      "Dropping the retained source database is irreversible and leaves this relocation with no rollback. It stays disabled until the retention window closes.",
    releaseButton: "Release retained source",
    releaseLocked: "Available once the retention window closes.",
    releaseDone: "The retained source has already been released.",
    releaseConfirmTitle: "Release the retained source database",
    releaseConfirmDescription:
      "This permanently drops the source database. It cannot be undone and this relocation will have no rollback afterwards. Type the tenant id to confirm.",
    releaseConfirmAction: "Release permanently",

    ambiguousStart:
      "The relocation command's outcome could not be confirmed. Retry with the same key, or check whether a relocation is already running.",
    ambiguousRelease:
      "The release command's outcome could not be confirmed. Retry with the same key, or re-read the relocation record.",
    pendingIntentChanged:
      "An earlier relocation command for this tenant was never resolved, and these values differ from it. Check what actually exists before sending another command.",
    pendingIntentResolve: "Check for an existing relocation",
    backupRuntimeUnavailable:
      "Database backups are not configured on this deployment, so a relocation cannot start. The move copies the tenant through a backup, and refusing here is what stops it copying a database it could not restore. Nothing was changed.",
    correlation: "Correlation ID",
  },
  ar: {
    breadcrumbTenant: "مساحة عمل المستأجر",
    back: "العودة إلى المستأجر",
    pageTitle: "نقل قاعدة بيانات المستأجر",
    pageDescription:
      "انسخ قاعدة بيانات هذا المستأجر إلى خادم قواعد بيانات آخر، وانقل توزيعه، واحتفظ بالمصدر حتى تحرِّره.",
    loading: "جارٍ تحميل فحص ما قبل النقل…",
    preflightFailed: "فحص ما قبل النقل غير متاح.",
    retry: "إعادة المحاولة",
    refresh: "تحديث",

    currentPlacement: "التوزيع الحالي",
    currentServer: "خادم قواعد البيانات",
    currentDatabase: "اسم قاعدة البيانات",
    placementRevision: "مراجعة التوزيع",
    tenantStatus: "حالة المستأجر",
    unnamedServer: "خادم بلا اسم",

    destination: "خادم قواعد البيانات الوجهة",
    destinationPlaceholder: "اختر وجهة",
    destinationHint:
      "تُعرض فقط الخوادم النشطة التي لديها سعة مستأجرين متاحة والقادرة على خدمة كل تطبيقات هذا المستأجر.",
    noTargetsTitle: "لا توجد وجهة مؤهلة",
    noTargetsDescription:
      "لا يوجد حالياً خادم قواعد بيانات آخر نشط لديه سعة متاحة وجاهز لكل تطبيقات هذا المستأجر. سجِّل خادماً أو فعِّله ثم أعد تحميل هذه الصفحة.",
    capacity: "مستأجر",

    reason: "السبب",
    reasonHint: "من ١ إلى ٥٠٠ حرف. يُسجَّل في سجل النقل.",
    reasonRequired: "السبب مطلوب.",
    reasonTooLong: "لا يجوز أن يتجاوز السبب ٥٠٠ حرف.",

    retentionDays: "الاحتفاظ بقاعدة البيانات المصدر لمدة",
    retentionUnit: "يوم",
    retentionHint: "يظل المصدر متاحاً للتراجع طوال هذه المدة بعد النقل.",
    retentionOutOfRange: "اختر عدد أيام صحيحاً ضمن المدى المذكور.",

    blockersTitle: "لا يمكن نقل هذا المستأجر الآن",
    blockersDescription:
      "ترفض الخدمة النقل طالما ينطبق أي مما يلي. تبقى الصفحة مفتوحة لترى بالضبط ما يجب معالجته.",

    submit: "بدء النقل",
    submitting: "جارٍ البدء…",
    confirmTitle: "تأكيد نقل قاعدة بيانات المستأجر",
    confirmDescription:
      "سيؤدي هذا إلى نسخ قاعدة بيانات المستأجر إلى الوجهة وتجميد الكتابة ونقل توزيع المستأجر. اكتب معرّف المستأجر للتأكيد.",
    confirmAction: "بدء النقل",
    missingPermissions: "يتطلب بدء النقل:",
    noDestinationSelected: "اختر خادم الوجهة أولاً.",

    monitorTitle: "تقدم النقل",
    monitorDescription:
      "عشر خطوات بالترتيب. الخطوة التي لا يوجد لها سجل لم تُنفَّذ بعد؛ لا يسجل السجل إلا الخطوات المنتهية.",
    autoRefreshing: "تحديث تلقائي",
    refreshPaused: "التحديث التلقائي متوقف مؤقتاً",
    relocationId: "معرّف النقل",
    runId: "معرّف التشغيل",
    startedAt: "بدأ في",
    movingFrom: "من",
    movingTo: "إلى",

    finishTitle: "نتيجة النقل",
    outcomeRelocated: "يعمل المستأجر الآن على الخادم الوجهة.",
    outcomeAbandoned: "تم التخلي عن عملية النقل.",
    failedStep: "الخطوة التي فشلت",
    rollbackTitle: "التراجع المنطبق",
    retainUntil: "يُحتفظ بالمصدر حتى",
    sourceDestroyedAt: "تم تحرير المصدر في",
    startAnother: "بدء نقل آخر",

    releaseTitle: "تحرير المصدر المحتفظ به",
    releaseDescription:
      "حذف قاعدة البيانات المصدر المحتفظ بها إجراء لا رجعة فيه ويترك هذا النقل بلا أي تراجع. يظل معطّلاً حتى تنتهي فترة الاحتفاظ.",
    releaseButton: "تحرير المصدر المحتفظ به",
    releaseLocked: "يتاح بعد انتهاء فترة الاحتفاظ.",
    releaseDone: "تم تحرير المصدر المحتفظ به بالفعل.",
    releaseConfirmTitle: "تحرير قاعدة البيانات المصدر المحتفظ بها",
    releaseConfirmDescription:
      "سيحذف هذا قاعدة البيانات المصدر نهائياً. لا يمكن التراجع عنه ولن يبقى لهذا النقل أي تراجع بعده. اكتب معرّف المستأجر للتأكيد.",
    releaseConfirmAction: "تحرير نهائي",

    ambiguousStart:
      "تعذر تأكيد نتيجة أمر النقل. أعد المحاولة بنفس المفتاح أو تحقق مما إذا كان هناك نقل قيد التنفيذ بالفعل.",
    ambiguousRelease:
      "تعذر تأكيد نتيجة أمر التحرير. أعد المحاولة بنفس المفتاح أو أعد قراءة سجل النقل.",
    pendingIntentChanged:
      "أمر نقل سابق لهذا المستأجر لم يُحسم، وهذه القيم تختلف عنه. تحقق مما هو موجود فعلاً قبل إرسال أمر آخر.",
    pendingIntentResolve: "تحقق من وجود عملية نقل",
    backupRuntimeUnavailable:
      "النسخ الاحتياطي لقواعد البيانات غير مُهيّأ في هذا النظام، لذلك لا يمكن بدء النقل. العملية تنسخ المستأجر عبر نسخة احتياطية، والرفض هنا هو ما يمنع نسخ قاعدة بيانات لا يمكن استعادتها. لم يتغير شيء.",
    correlation: "معرّف الارتباط",
  },
} as const;

export type RelocationCopy = (typeof relocationCopy)["en"];
