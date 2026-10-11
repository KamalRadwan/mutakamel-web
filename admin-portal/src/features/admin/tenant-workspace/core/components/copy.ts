export type TenantWorkspaceLocale = "ar" | "en";

const copy = {
  en: {
    title: "Tenant control",
    loading: "Loading tenant…",
    forbidden: "You do not have permission to view this tenant.",
    destroyed: "The tenant was permanently destroyed.",
    retry: "Retry",
    profile: "Profile",
    save: "Save profile",
    reload: "Reload server version",
    stale: "This profile changed on the server. Review or reload before saving again.",
    lifecycle: "Lifecycle & provisioning",
    suspend: "Suspend",
    activate: "Activate",
    reprovision: "Retry provisioning",
    cancelProvisioning: "Cancel provisioning",
    softDelete: "Soft delete",
    restore: "Restore tenant",
    restoreHint:
      "Restoring returns the tenant as SUSPENDED with its domains re-attached. Its cancelled subscription stays cancelled.",
    destroy: "Destroy permanently",
    destroyHint:
      "This stops provisioning, then permanently drops the tenant database. Financial and audit history is retained. Once the database drop starts it cannot be undone.",
    destroyPhases: {
      STOPPING_PROVISIONING: "Stopping provisioning…",
      DROPPING_DATABASE: "Deleting the database…",
      FINALIZING: "Finalizing tenant destruction…",
      SUCCEEDED: "Tenant destroyed.",
      BLOCKED: "Destruction is blocked",
      ABANDONED: "Destruction was abandoned",
    },
    destroyPhaseHints: {
      STOPPING_PROVISIONING:
        "Provisioning is being stopped before the database is dropped. Restore and a new destruction request stay unavailable unless this request is abandoned.",
      DROPPING_DATABASE:
        "The database drop is authorized, so this request can only finish. It continues in the background if you leave this page.",
      FINALIZING:
        "The database was dropped. The tenant's identity and capacity are being released; this continues in the background.",
      SUCCEEDED: "The tenant database was dropped and its identity released.",
      BLOCKED:
        "Provisioning could not be stopped, so the database was not dropped and automatic attempts have ended. Abandon the request to restore the tenant or request destruction again.",
      ABANDONED:
        "The database was kept. The tenant stays soft-deleted and can be restored or destroyed again.",
    },
    /** A BLOCKED request that halted after the drop was authorized. */
    destroyHaltedPhases: {
      DROPPING_DATABASE: "Destruction halted while deleting the database",
      FINALIZING: "Destruction halted while finalizing",
    },
    destroyHaltedHints: {
      DROPPING_DATABASE:
        "Deleting the database kept failing, so automatic attempts have ended. The drop was already authorized and the database may already be gone, so this request cannot be abandoned and the tenant cannot be restored. Fix the reason below, then resume destruction.",
      FINALIZING:
        "The database was dropped, but releasing the tenant's identity and capacity kept failing, so automatic attempts have ended. This request cannot be abandoned and the tenant cannot be restored. Fix the reason below, then resume destruction.",
    },
    destroyReason: "Reason",
    destroyBlockedBy: "Blocked by",
    destroyLatestAttempt: "Latest attempt",
    destroyBlockingOperation: "Provisioning operation",
    destroyAttempts: "Attempts in this phase",
    destroyNextAttempt: "Next attempt",
    destroyBlockedAt: "Blocked",
    destroyAbandonedAt: "Abandoned",
    destroyRequestedAt: "Requested",
    destroyUpdatedAt: "Last update",
    destroyRequest: "Request",
    destroyAutoRefresh: "Status refreshes automatically.",
    destroyRefresh: "Refresh status",
    destroyLoadFailed: "Destruction status could not be loaded.",
    destroyRefreshFailed:
      "The latest status refresh failed; the last known status is shown.",
    destroyNotAbandonable:
      "This request can no longer be abandoned: the database drop was already authorized and the database may already be gone. It can only finish, or be resumed if it halted. Its status was refreshed.",
    /** Core refusals of a destruction command, shown in the workspace alert. */
    destroyCommandErrors: {
      TENANT_DESTROY_NOT_ABANDONABLE:
        "This destruction request can no longer be abandoned: the database drop was already authorized and the database may already be gone. It can only finish, or be resumed if it halted.",
    },
    /** Any `WORKER.TENANT_DESTROY.DATABASE.<class>` code; the class stays in the code. */
    destroyDatabaseReason:
      "The worker could not use the tenant's Database Server.",
    destroyReasons: {
      TENANT_DESTROY_OPEN_PROVISIONING_OPERATION:
        "An open provisioning operation has not stopped.",
      TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS:
        "More than one provisioning operation is open and needs reconciliation.",
      TENANT_PROVISIONING_CANCEL_NOT_ALLOWED:
        "The open provisioning operation cannot be cancelled.",
      TENANT_DESTROY_CANCELLATION_REFUSED:
        "Cancellation of the open provisioning operation was refused.",
      "WORKER.TENANT_DESTROY.CORE_TIMEOUT":
        "The worker timed out waiting for the control plane.",
      "WORKER.TENANT_DESTROY.CORE_UNREACHABLE":
        "The worker could not reach the control plane.",
      "WORKER.TENANT_DESTROY.CORE_UNAVAILABLE":
        "The control plane was unavailable to the worker.",
      "WORKER.TENANT_DESTROY.CORE_REJECTED":
        "The control plane rejected the worker's request.",
      "WORKER.TENANT_DESTROY.RESPONSE_INVALID":
        "The worker received an invalid response from the control plane.",
      "WORKER.TENANT_DESTROY.PROVISIONING_AMBIGUOUS":
        "The worker found more than one open provisioning operation.",
      "WORKER.TENANT_DESTROY.PROGRESS_AMBIGUOUS":
        "The worker found ambiguous provisioning progress evidence.",
      "WORKER.TENANT_DESTROY.PROGRESS_IDENTITY_INVALID":
        "Provisioning progress evidence did not match its operation.",
      "WORKER.TENANT_DESTROY.PROVISIONING_NOT_STOPPED":
        "Provisioning was still running when the drop was checked.",
      "WORKER.TENANT_DESTROY.AUTHORITY_CHANGED":
        "The tenant's database placement changed before the drop.",
      "WORKER.TENANT_DESTROY.UNEXPECTED_FAILURE":
        "The worker hit an unexpected failure.",
      "WORKER.TENANT.DATABASE_TEARDOWN_FAILED":
        "The database was still present after the drop.",
      "WORKER.TENANT_CLAIM.HELD":
        "Another database operation holds the tenant's database.",
    },
    abandonDestroy: "Abandon destruction",
    abandoning: "Abandoning…",
    abandonConfirmTitle: (name: string) =>
      `Abandon the destruction of ${name}?`,
    abandonConfirmDescription: (name: string) =>
      `Destruction of ${name} stops before its database is dropped. The database is kept and the tenant stays soft-deleted, so it can be restored or destroyed again later.\nA cancellation already requested for its provisioning operation stays requested. The abandoned request is kept as evidence.`,
    resumeDestroy: "Resume destruction",
    resuming: "Resuming…",
    resumeConfirmTitle: (name: string) =>
      `Resume the destruction of ${name}?`,
    resumeConfirmDescription: (name: string) =>
      `Destruction of ${name} continues in the phase where it halted, with a new budget of automatic attempts. Fix the reason it halted first, or it halts again once those attempts are spent.\nResuming is safe whether or not the database still exists: the drop only removes a database that is still present, then checks that it is gone. The request still cannot be abandoned.`,
    confirm: "Confirm",
    cancel: "Keep tenant",
    polling: "Provisioning is running. Status refreshes automatically.",
    pollExhausted: "Automatic status checks paused. Refresh to continue.",
    domains: "Domains",
    domainPlaceholder: "crm.example.com",
    validate: "Validate",
    addDomain: "Attach domain",
    primary: "Primary",
    secondary: "Secondary",
    remove: "Remove",
    promote: "Set primary",
    pendingDns: "The domain may be attached as pending while DNS is prepared.",
    clearAddress: "Clear address",
    noDomains: "No domain evidence is available.",
    domainsReleased:
      "Domains were released when this tenant was deleted. They stay reserved for it and come back if it is restored.",
    correlation: "Correlation ID",
    domainFieldLabel: "Domain",
    reloadDomains: "Reload domains",
    loadingDomains: "Loading domains…",
    confirmRemoveDomain: "Confirm removal of this domain?",
    address: "Address",
    confirmAction: (label: string) => `Confirm action: ${label}`,
  },
  ar: {
    title: "إدارة المستأجر",
    loading: "جارٍ تحميل المستأجر…",
    forbidden: "لا تملك صلاحية عرض هذا المستأجر.",
    destroyed: "تم حذف المستأجر نهائيًا.",
    retry: "إعادة المحاولة",
    profile: "الملف التعريفي",
    save: "حفظ الملف",
    reload: "تحميل نسخة الخادم",
    stale: "تغيّر الملف على الخادم. راجع التغييرات أو أعد التحميل قبل الحفظ.",
    lifecycle: "دورة الحياة والتجهيز",
    suspend: "تعليق",
    activate: "تفعيل",
    reprovision: "إعادة محاولة التجهيز",
    cancelProvisioning: "إلغاء التجهيز",
    softDelete: "حذف قابل للاسترداد",
    restore: "استعادة المستأجر",
    restoreHint:
      "تعيد الاستعادة المستأجر بحالة SUSPENDED مع إعادة ربط نطاقاته. ويظل اشتراكه الملغى ملغيًا.",
    destroy: "حذف نهائي",
    destroyHint:
      "يوقف هذا التجهيز ثم يحذف قاعدة بيانات المستأجر نهائيًا مع الاحتفاظ بالسجلات المالية وسجل التدقيق. لا يمكن التراجع بعد بدء حذف قاعدة البيانات.",
    destroyPhases: {
      STOPPING_PROVISIONING: "جارٍ إيقاف التجهيز…",
      DROPPING_DATABASE: "جارٍ حذف قاعدة البيانات…",
      FINALIZING: "جارٍ إتمام الحذف النهائي…",
      SUCCEEDED: "تم حذف المستأجر.",
      BLOCKED: "الحذف النهائي متوقف",
      ABANDONED: "تم التخلي عن الحذف النهائي",
    },
    destroyPhaseHints: {
      STOPPING_PROVISIONING:
        "يجري إيقاف التجهيز قبل حذف قاعدة البيانات. تظل الاستعادة وطلب حذف نهائي جديد غير متاحين ما لم يتم التخلي عن هذا الطلب.",
      DROPPING_DATABASE:
        "تم اعتماد حذف قاعدة البيانات، لذا لا يمكن إلا إكمال هذا الطلب. وتستمر العملية في الخلفية حتى بعد مغادرة الصفحة.",
      FINALIZING:
        "تم حذف قاعدة البيانات. ويجري تحرير هوية المستأجر وسعته، وتستمر العملية في الخلفية.",
      SUCCEEDED: "تم حذف قاعدة بيانات المستأجر وتحرير هويته.",
      BLOCKED:
        "تعذّر إيقاف التجهيز، لذا لم تُحذف قاعدة البيانات وتوقفت المحاولات التلقائية. تخلَّ عن الطلب لاستعادة المستأجر أو لطلب الحذف النهائي من جديد.",
      ABANDONED:
        "تم الإبقاء على قاعدة البيانات. ويبقى المستأجر محذوفًا حذفًا قابلًا للاسترداد، ويمكن استعادته أو حذفه نهائيًا من جديد.",
    },
    destroyHaltedPhases: {
      DROPPING_DATABASE: "توقف الحذف النهائي أثناء حذف قاعدة البيانات",
      FINALIZING: "توقف الحذف النهائي أثناء الإتمام",
    },
    destroyHaltedHints: {
      DROPPING_DATABASE:
        "تكرر فشل حذف قاعدة البيانات فتوقفت المحاولات التلقائية. وقد سبق اعتماد الحذف وربما حُذفت قاعدة البيانات بالفعل، لذا لا يمكن التخلي عن هذا الطلب ولا استعادة المستأجر. عالج السبب الموضح أدناه ثم استأنف الحذف النهائي.",
      FINALIZING:
        "حُذفت قاعدة البيانات، لكن تكرر فشل تحرير هوية المستأجر وسعته فتوقفت المحاولات التلقائية. لا يمكن التخلي عن هذا الطلب ولا استعادة المستأجر. عالج السبب الموضح أدناه ثم استأنف الحذف النهائي.",
    },
    destroyReason: "السبب",
    destroyBlockedBy: "سبب التوقف",
    destroyLatestAttempt: "آخر محاولة",
    destroyBlockingOperation: "عملية التجهيز",
    destroyAttempts: "المحاولات في هذه المرحلة",
    destroyNextAttempt: "المحاولة التالية",
    destroyBlockedAt: "وقت التوقف",
    destroyAbandonedAt: "وقت التخلي",
    destroyRequestedAt: "وقت الطلب",
    destroyUpdatedAt: "آخر تحديث",
    destroyRequest: "الطلب",
    destroyAutoRefresh: "يتم تحديث الحالة تلقائيًا.",
    destroyRefresh: "تحديث الحالة",
    destroyLoadFailed: "تعذّر تحميل حالة الحذف النهائي.",
    destroyRefreshFailed: "تعذّر آخر تحديث للحالة؛ تُعرض آخر حالة معروفة.",
    destroyNotAbandonable:
      "لم يعد ممكنًا التخلي عن هذا الطلب: فقد اعتُمد حذف قاعدة البيانات بالفعل وربما حُذفت. لا يمكن إلا إكماله، أو استئنافه إن توقف. وتم تحديث حالته.",
    destroyCommandErrors: {
      TENANT_DESTROY_NOT_ABANDONABLE:
        "لم يعد ممكنًا التخلي عن طلب الحذف النهائي هذا: فقد اعتُمد حذف قاعدة البيانات بالفعل وربما حُذفت. لا يمكن إلا إكماله، أو استئنافه إن توقف.",
    },
    destroyDatabaseReason:
      "تعذّر على العامل استخدام خادم قاعدة بيانات المستأجر.",
    destroyReasons: {
      TENANT_DESTROY_OPEN_PROVISIONING_OPERATION:
        "توجد عملية تجهيز مفتوحة لم تتوقف بعد.",
      TENANT_DESTROY_MULTIPLE_OPEN_OPERATIONS:
        "توجد أكثر من عملية تجهيز مفتوحة وتحتاج إلى تسوية.",
      TENANT_PROVISIONING_CANCEL_NOT_ALLOWED:
        "لا يمكن إلغاء عملية التجهيز المفتوحة.",
      TENANT_DESTROY_CANCELLATION_REFUSED:
        "رُفض إلغاء عملية التجهيز المفتوحة.",
      "WORKER.TENANT_DESTROY.CORE_TIMEOUT":
        "انتهت مهلة انتظار العامل لاستجابة مستوى التحكم.",
      "WORKER.TENANT_DESTROY.CORE_UNREACHABLE":
        "تعذّر على العامل الوصول إلى مستوى التحكم.",
      "WORKER.TENANT_DESTROY.CORE_UNAVAILABLE":
        "كان مستوى التحكم غير متاح للعامل.",
      "WORKER.TENANT_DESTROY.CORE_REJECTED":
        "رفض مستوى التحكم طلب العامل.",
      "WORKER.TENANT_DESTROY.RESPONSE_INVALID":
        "تلقى العامل استجابة غير صالحة من مستوى التحكم.",
      "WORKER.TENANT_DESTROY.PROVISIONING_AMBIGUOUS":
        "وجد العامل أكثر من عملية تجهيز مفتوحة.",
      "WORKER.TENANT_DESTROY.PROGRESS_AMBIGUOUS":
        "وجد العامل أدلة تقدّم تجهيز ملتبسة.",
      "WORKER.TENANT_DESTROY.PROGRESS_IDENTITY_INVALID":
        "لم تطابق أدلة تقدّم التجهيز عمليتها.",
      "WORKER.TENANT_DESTROY.PROVISIONING_NOT_STOPPED":
        "كان التجهيز لا يزال قيد التشغيل عند التحقق قبل الحذف.",
      "WORKER.TENANT_DESTROY.AUTHORITY_CHANGED":
        "تغيّر موضع قاعدة بيانات المستأجر قبل الحذف.",
      "WORKER.TENANT_DESTROY.UNEXPECTED_FAILURE":
        "واجه العامل خطأً غير متوقع.",
      "WORKER.TENANT.DATABASE_TEARDOWN_FAILED":
        "ظلت قاعدة البيانات موجودة بعد محاولة الحذف.",
      "WORKER.TENANT_CLAIM.HELD":
        "عملية أخرى على قاعدة البيانات تحتجز قاعدة بيانات المستأجر.",
    },
    abandonDestroy: "التخلي عن الحذف النهائي",
    abandoning: "جارٍ التخلي…",
    abandonConfirmTitle: (name: string) =>
      `التخلي عن الحذف النهائي للمستأجر ${name}؟`,
    abandonConfirmDescription: (name: string) =>
      `يتوقف الحذف النهائي للمستأجر ${name} قبل حذف قاعدة بياناته. تُحفظ قاعدة البيانات ويبقى المستأجر محذوفًا حذفًا قابلًا للاسترداد، فيمكن استعادته أو حذفه نهائيًا لاحقًا.\nيبقى طلب إلغاء عملية التجهيز الخاصة به قائمًا إن كان قد قُدِّم، ويُحتفظ بالطلب المتخلّى عنه كدليل.`,
    resumeDestroy: "استئناف الحذف النهائي",
    resuming: "جارٍ الاستئناف…",
    resumeConfirmTitle: (name: string) =>
      `استئناف الحذف النهائي للمستأجر ${name}؟`,
    resumeConfirmDescription: (name: string) =>
      `يُستأنف الحذف النهائي للمستأجر ${name} من المرحلة التي توقف عندها، مع رصيد جديد من المحاولات التلقائية. عالج سبب التوقف أولًا، وإلا سيتوقف مجددًا بعد استنفاد هذه المحاولات.\nالاستئناف آمن سواء بقيت قاعدة البيانات أم لا: فالحذف لا يزيل إلا قاعدة بيانات ما زالت موجودة ثم يتحقق من زوالها. ويظل التخلي عن الطلب غير ممكن.`,
    confirm: "تأكيد",
    cancel: "الإبقاء على المستأجر",
    polling: "التجهيز قيد التنفيذ. يتم تحديث الحالة تلقائيًا.",
    pollExhausted: "توقفت فحوص الحالة التلقائية. حدّث للمتابعة.",
    domains: "النطاقات",
    domainPlaceholder: "crm.example.com",
    validate: "فحص",
    addDomain: "إرفاق النطاق",
    primary: "أساسي",
    secondary: "ثانوي",
    remove: "إزالة",
    promote: "تعيين كأساسي",
    pendingDns: "يمكن إرفاق النطاق بحالة معلّقة أثناء إعداد DNS.",
    clearAddress: "مسح العنوان",
    noDomains: "لا تتوفر بيانات نطاقات.",
    domainsReleased:
      "تم تحرير النطاقات عند حذف هذا المستأجر. وتبقى محجوزة له وتعود إليه عند استعادته.",
    correlation: "معرّف الارتباط",
    domainFieldLabel: "النطاق",
    reloadDomains: "إعادة تحميل النطاقات",
    loadingDomains: "جارٍ تحميل النطاقات…",
    confirmRemoveDomain: "تأكيد إزالة هذا النطاق؟",
    address: "العنوان",
    confirmAction: (label: string) => `تأكيد الإجراء: ${label}`,
  },
} as const;

export function tenantWorkspaceCopy(locale: TenantWorkspaceLocale) {
  return copy[locale];
}

/** Worker's codes for a Database Server failure, one per failure class. */
const DESTROY_DATABASE_REASON_PREFIX = "WORKER.TENANT_DESTROY.DATABASE.";

/**
 * The localized label for a safe destruction code, or `null` when it has none
 * so the caller shows the code verbatim. Codes come from Core and Worker and
 * are not an enum this browser can exhaust; Worker's Database Server failures
 * share one label, and the code beside it keeps the failure class.
 */
export function tenantDestroyReasonLabel(
  locale: TenantWorkspaceLocale,
  code: string,
): string | null {
  const labels: Readonly<Record<string, string>> = copy[locale].destroyReasons;
  if (Object.prototype.hasOwnProperty.call(labels, code)) return labels[code];
  return code.startsWith(DESTROY_DATABASE_REASON_PREFIX) &&
    code.length > DESTROY_DATABASE_REASON_PREFIX.length
    ? copy[locale].destroyDatabaseReason
    : null;
}

/**
 * The localized text for Core's refusal of a destruction command, or `null`
 * when the code is not one of them (Core's own message is English-only).
 */
export function tenantDestroyCommandErrorText(
  locale: TenantWorkspaceLocale,
  code: string | null | undefined,
): string | null {
  const texts: Readonly<Record<string, string>> =
    copy[locale].destroyCommandErrors;
  return code && Object.prototype.hasOwnProperty.call(texts, code)
    ? texts[code]
    : null;
}
