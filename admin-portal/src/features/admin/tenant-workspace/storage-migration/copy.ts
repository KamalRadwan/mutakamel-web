/**
 * Screen copy for the storage migration wizard, feature-local for the same
 * reason as the relocation wizard's: one route uses it, and navigation never
 * does.
 */
export const storageMigrationCopy = {
  en: {
    back: "Back to tenant",
    pageTitle: "Move tenant storage",
    pageDescription:
      "Copy this tenant's object storage namespace to another Storage Server and commit its placement, fenced on the current placement revision.",
    loading: "Loading storage migration preflight…",
    preflightFailed: "Storage migration preflight is unavailable.",
    refresh: "Refresh",

    currentPlacement: "Current placement",
    currentServer: "Storage Server",
    placementRevision: "Placement revision",
    tenantStatus: "Tenant status",
    unnamedServer: "Unnamed server",

    destination: "Destination Storage Server",
    destinationPlaceholder: "Select a destination",
    destinationHint:
      "Only ACTIVE Storage Servers with free tenant capacity are listed. Byte headroom and the last connection test are shown so a full or unreachable target is visible before you commit.",
    noTargetsTitle: "No destination is eligible",
    noTargetsDescription:
      "No other Storage Server is currently ACTIVE with free tenant capacity. Register or activate one, then reload this page.",
    targetSummary: "Destination details",
    region: "Region",
    assignedTenants: "Assigned tenants",
    byteCeiling: "Byte ceiling",
    reservedBytes: "Reserved",
    committedBytes: "Committed",
    remainingBytes: "Unreserved headroom",
    lastConnectionTest: "Last connection test",
    noCeiling: "No declared ceiling",
    unlimitedTenants: "No tenant ceiling",

    evidenceTitle: "Recovery evidence",
    evidenceDescription:
      "Core refuses a migration that is not bound to current Worker backup and restore evidence for this tenant. Pick the exact artifact and restore run this move should be recorded against.",
    backupArtifact: "Backup artifact",
    backupArtifactPlaceholder: "Select a backup artifact",
    restoreRun: "Restore run",
    restoreRunPlaceholder: "Select a restore run",
    evidenceLoading: "Loading backup evidence…",
    evidenceForbidden:
      "Loading backup artifacts and restore runs requires admin.backups.read. Without it this migration cannot be composed here.",
    evidenceUnavailable:
      "Backup evidence could not be loaded. Retry before composing the migration.",
    noArtifacts:
      "This tenant has no backup artifacts. Take a backup before migrating its storage.",
    noRestores:
      "This tenant has no restore runs. Run a restore test before migrating its storage.",
    started: "Started",
    finished: "Finished",
    verified: "Verification recorded",
    notVerified: "No verification recorded",

    maxBytes: "Reserve up to",
    maxBytesHint:
      "Whole bytes, 1 to 16 digits. Reserved on the destination before any write, so it must fit the destination's unreserved headroom.",
    maxBytesInvalid: "Enter a whole number of bytes with no leading zero (1–16 digits).",
    maxBytesExceedsHeadroom:
      "This exceeds the destination's unreserved headroom.",

    retentionTitle: "The old copy",
    retentionLabel: "Keep the old copy until I confirm removal",
    retentionOnHint:
      "Recommended. After the tenant is moved, its old storage namespace is kept exactly as it was. The tenant runs normally on the destination the whole time — nothing is fenced and nothing is degraded. You then delete the old copy yourself, once you are satisfied the move is good.",
    retentionOffHint:
      "The old storage namespace is deleted in the same call, as soon as placement commits. Nothing is kept to compare against or fall back to if the copy turns out to be subtly wrong.",

    blockersTitle: "This tenant's storage cannot be moved right now",
    blockersDescription:
      "The service refuses a migration while any of the following holds. The page stays open so you can see exactly what to clear.",

    openMigrationTitle: "A migration is already open for this tenant",
    openMigrationDescription:
      "The preflight reported an open migration. Its progress is shown below; a new migration cannot start until it settles.",

    submit: "Start storage migration",
    submitting: "Starting…",
    confirmTitle: "Confirm tenant storage migration",
    confirmDescription:
      "This fences every storage route for the tenant, copies its namespace to the destination, and commits one placement authority. Type the tenant id to confirm.",
    confirmAction: "Start migration",
    missingPermissions: "Starting a storage migration requires:",
    destinationRequired: "Select a destination server first.",
    artifactRequired: "Select the backup artifact this migration is bound to.",
    restoreRequired: "Select the restore run this migration is bound to.",

    monitorTitle: "Migration progress",
    monitorDescription:
      "Core reports one status. Everything before it has completed; everything after it is pending.",
    autoRefreshing: "Refreshing automatically",
    refreshPaused: "Automatic refresh is paused",
    migrationId: "Migration id",
    sourceServer: "Source Storage Server",
    targetServer: "Destination Storage Server",
    expectedRevision: "Fenced on revision",
    resultingRevision: "Resulting revision",
    objectsCopied: "Objects copied",
    bytesCopied: "Bytes copied",
    namespaceDigest: "Namespace digest",
    failureCode: "Failure code",

    finishTitle: "Migration outcome",
    outcomeCompleted:
      "The tenant's storage now lives on the destination Storage Server and the fence has been lifted.",
    outcomeRolledBack:
      "The migration was rolled back. The tenant still runs on its original Storage Server and nothing was committed.",
    startAnother: "Start another migration",

    awaitingReleaseTitle: "Old copy kept",
    awaitingReleaseBody:
      "The tenant now runs on the destination Storage Server and is unaffected. Its old copy is still there, so this move is still reversible by hand. Delete it once you are satisfied.",
    releaseTitle: "Delete the old copy",
    releaseDescription:
      "Deleting the retained source namespace is irreversible and leaves this migration with no rollback: if the destination copy turns out to be subtly wrong, there is nothing left to compare it against.",
    releaseButton: "Delete the old copy",
    releaseDone: "The old copy has been deleted.",
    releaseNotRetained:
      "This migration removed its source in the same call, so there is no old copy left to delete.",
    releaseConfirmTitle: "Delete the retained source namespace",
    releaseConfirmDescription:
      "This permanently deletes the tenant's old storage namespace. It cannot be undone and this migration will have no rollback afterwards. Type the tenant id to confirm.",
    releaseConfirmAction: "Delete permanently",
    ambiguousRelease:
      "The deletion command's outcome could not be confirmed. Core is forward-only here: retry with the same idempotency key, or re-read the migration. It never rolls the placement back.",

    ambiguousStart:
      "The migration command's outcome could not be confirmed. Retry with the same idempotency key, or reload the preflight to see whether a migration is already open.",
    pendingIntentChanged:
      "An earlier migration command for this tenant was never resolved, and these values differ from it. Check what actually exists before sending another command.",
    pendingIntentResolve: "Check for an existing migration",
    correlation: "Correlation ID",
  },
  ar: {
    back: "العودة إلى المستأجر",
    pageTitle: "نقل تخزين المستأجر",
    pageDescription:
      "انسخ مساحة أسماء التخزين الكائني لهذا المستأجر إلى خادم تخزين آخر واعتمد توزيعه، مع تثبيت مراجعة التوزيع الحالية.",
    loading: "جارٍ تحميل فحص ما قبل ترحيل التخزين…",
    preflightFailed: "فحص ما قبل ترحيل التخزين غير متاح.",
    refresh: "تحديث",

    currentPlacement: "التوزيع الحالي",
    currentServer: "خادم التخزين",
    placementRevision: "مراجعة التوزيع",
    tenantStatus: "حالة المستأجر",
    unnamedServer: "خادم بلا اسم",

    destination: "خادم التخزين الوجهة",
    destinationPlaceholder: "اختر وجهة",
    destinationHint:
      "تُعرض فقط خوادم التخزين النشطة التي لديها سعة مستأجرين متاحة. تظهر المساحة المتاحة وآخر اختبار اتصال حتى ترى الخادم الممتلئ أو غير المتاح قبل الالتزام.",
    noTargetsTitle: "لا توجد وجهة مؤهلة",
    noTargetsDescription:
      "لا يوجد حالياً خادم تخزين آخر نشط لديه سعة مستأجرين متاحة. سجِّل خادماً أو فعِّله ثم أعد تحميل هذه الصفحة.",
    targetSummary: "تفاصيل الوجهة",
    region: "المنطقة",
    assignedTenants: "المستأجرون المخصَّصون",
    byteCeiling: "الحد الأقصى للبايتات",
    reservedBytes: "محجوز",
    committedBytes: "مستخدَم",
    remainingBytes: "المساحة غير المحجوزة",
    lastConnectionTest: "آخر اختبار اتصال",
    noCeiling: "لا يوجد حد أقصى معلن",
    unlimitedTenants: "لا يوجد حد لعدد المستأجرين",

    evidenceTitle: "أدلة الاستعادة",
    evidenceDescription:
      "ترفض الخدمة أي ترحيل غير مرتبط بأدلة نسخ احتياطي واستعادة حديثة لهذا المستأجر. اختر النسخة الاحتياطية وتشغيل الاستعادة اللذين سيُسجَّل هذا النقل بهما.",
    backupArtifact: "النسخة الاحتياطية",
    backupArtifactPlaceholder: "اختر نسخة احتياطية",
    restoreRun: "تشغيل الاستعادة",
    restoreRunPlaceholder: "اختر تشغيل استعادة",
    evidenceLoading: "جارٍ تحميل أدلة النسخ الاحتياطي…",
    evidenceForbidden:
      "يتطلب تحميل النسخ الاحتياطية وعمليات الاستعادة صلاحية admin.backups.read. بدونها لا يمكن تكوين هذا الترحيل هنا.",
    evidenceUnavailable:
      "تعذر تحميل أدلة النسخ الاحتياطي. أعد المحاولة قبل تكوين الترحيل.",
    noArtifacts:
      "لا توجد نسخ احتياطية لهذا المستأجر. خذ نسخة احتياطية قبل ترحيل تخزينه.",
    noRestores:
      "لا توجد عمليات استعادة لهذا المستأجر. نفِّذ اختبار استعادة قبل ترحيل تخزينه.",
    started: "بدأ في",
    finished: "انتهى في",
    verified: "تم تسجيل التحقق",
    notVerified: "لم يُسجَّل تحقق",

    maxBytes: "احجز حتى",
    maxBytesHint:
      "بايتات صحيحة من ١ إلى ١٦ رقماً. تُحجز على الوجهة قبل أي كتابة، لذا يجب أن تتسع لها المساحة غير المحجوزة في الوجهة.",
    maxBytesInvalid: "أدخل عدد بايتات صحيحاً بلا صفر بادئ (من ١ إلى ١٦ رقماً).",
    maxBytesExceedsHeadroom: "يتجاوز هذا المساحة غير المحجوزة في الوجهة.",

    retentionTitle: "النسخة القديمة",
    retentionLabel: "احتفظ بالنسخة القديمة حتى أؤكد حذفها",
    retentionOnHint:
      "موصى به. بعد نقل المستأجر، يُحتفظ بمساحة أسماء التخزين القديمة كما هي تماماً. يعمل المستأجر بشكل طبيعي على الوجهة طوال هذه المدة، فلا تسييج ولا تدهور في الخدمة. ثم تحذف النسخة القديمة بنفسك بعد أن تطمئن إلى سلامة النقل.",
    retentionOffHint:
      "تُحذف مساحة أسماء التخزين القديمة في الاستدعاء نفسه بمجرد اعتماد التوزيع. لن يبقى شيء للمقارنة أو للرجوع إليه إذا تبيّن أن النسخة بها خلل دقيق.",

    blockersTitle: "لا يمكن نقل تخزين هذا المستأجر الآن",
    blockersDescription:
      "ترفض الخدمة الترحيل طالما ينطبق أي مما يلي. تبقى الصفحة مفتوحة لترى بالضبط ما يجب معالجته.",

    openMigrationTitle: "يوجد ترحيل مفتوح لهذا المستأجر بالفعل",
    openMigrationDescription:
      "أبلغ فحص ما قبل الترحيل عن ترحيل مفتوح. يظهر تقدمه بالأسفل، ولا يمكن بدء ترحيل جديد قبل أن يستقر.",

    submit: "بدء ترحيل التخزين",
    submitting: "جارٍ البدء…",
    confirmTitle: "تأكيد ترحيل تخزين المستأجر",
    confirmDescription:
      "سيؤدي هذا إلى تسييج كل مسارات تخزين المستأجر ونسخ مساحة أسمائه إلى الوجهة واعتماد مرجع توزيع واحد. اكتب معرّف المستأجر للتأكيد.",
    confirmAction: "بدء الترحيل",
    missingPermissions: "يتطلب بدء ترحيل التخزين:",
    destinationRequired: "اختر خادم الوجهة أولاً.",
    artifactRequired: "اختر النسخة الاحتياطية المرتبط بها هذا الترحيل.",
    restoreRequired: "اختر تشغيل الاستعادة المرتبط به هذا الترحيل.",

    monitorTitle: "تقدم الترحيل",
    monitorDescription:
      "تُبلغ الخدمة عن حالة واحدة. كل ما قبلها اكتمل، وكل ما بعدها قيد الانتظار.",
    autoRefreshing: "تحديث تلقائي",
    refreshPaused: "التحديث التلقائي متوقف مؤقتاً",
    migrationId: "معرّف الترحيل",
    sourceServer: "خادم التخزين المصدر",
    targetServer: "خادم التخزين الوجهة",
    expectedRevision: "مثبَّت على المراجعة",
    resultingRevision: "المراجعة الناتجة",
    objectsCopied: "الكائنات المنسوخة",
    bytesCopied: "البايتات المنسوخة",
    namespaceDigest: "بصمة مساحة الأسماء",
    failureCode: "رمز الفشل",

    finishTitle: "نتيجة الترحيل",
    outcomeCompleted:
      "أصبح تخزين المستأجر الآن على خادم التخزين الوجهة ورُفع السياج.",
    outcomeRolledBack:
      "تم التراجع عن الترحيل. لا يزال المستأجر يعمل على خادم التخزين الأصلي ولم يُعتمد أي تغيير.",
    startAnother: "بدء ترحيل آخر",

    awaitingReleaseTitle: "تم الاحتفاظ بالنسخة القديمة",
    awaitingReleaseBody:
      "يعمل المستأجر الآن على خادم التخزين الوجهة دون أي تأثير عليه. ولا تزال نسخته القديمة موجودة، لذلك ما زال بالإمكان التراجع عن هذا النقل يدوياً. احذفها بعد أن تطمئن.",
    releaseTitle: "حذف النسخة القديمة",
    releaseDescription:
      "حذف مساحة الأسماء المصدر المحتفظ بها إجراء لا رجعة فيه ويترك هذا الترحيل بلا أي تراجع: إذا تبيّن لاحقاً أن نسخة الوجهة بها خلل دقيق فلن يبقى شيء لمقارنتها به.",
    releaseButton: "حذف النسخة القديمة",
    releaseDone: "تم حذف النسخة القديمة.",
    releaseNotRetained:
      "أزال هذا الترحيل مصدره في الاستدعاء نفسه، لذلك لا توجد نسخة قديمة لحذفها.",
    releaseConfirmTitle: "حذف مساحة الأسماء المصدر المحتفظ بها",
    releaseConfirmDescription:
      "سيحذف هذا مساحة تخزين المستأجر القديمة نهائياً. لا يمكن التراجع عنه ولن يبقى لهذا الترحيل أي تراجع بعده. اكتب معرّف المستأجر للتأكيد.",
    releaseConfirmAction: "حذف نهائي",
    ambiguousRelease:
      "تعذر تأكيد نتيجة أمر الحذف. تعمل الخدمة هنا في اتجاه واحد فقط: أعد المحاولة بنفس مفتاح المعالجة أو أعد قراءة الترحيل. لا يُعاد التوزيع إلى الوراء أبداً.",

    ambiguousStart:
      "تعذر تأكيد نتيجة أمر الترحيل. أعد المحاولة بنفس مفتاح المعالجة، أو أعد تحميل فحص ما قبل الترحيل لمعرفة ما إذا كان هناك ترحيل مفتوح بالفعل.",
    pendingIntentChanged:
      "أمر ترحيل سابق لهذا المستأجر لم يُحسم، وهذه القيم تختلف عنه. تحقق مما هو موجود فعلاً قبل إرسال أمر آخر.",
    pendingIntentResolve: "تحقق من وجود عملية ترحيل",
    correlation: "معرّف الارتباط",
  },
} as const;

export type StorageMigrationCopy = (typeof storageMigrationCopy)["en"];
