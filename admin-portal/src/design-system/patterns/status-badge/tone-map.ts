// Status vocabularies are keyed by their documented API enum. A wire label
// such as ACTIVE or PENDING has no universal outcome meaning across domains.
export type StatusEnumType =
  | "tenant"
  | "user"
  | "subscription"
  | "invoice"
  | "operation"
  | "db-server"
  | "application"
  | "backup-artifact";

export type StatusTone = "success" | "progress" | "warning" | "danger" | "neutral";

export interface ToneStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  labelEn: string;
  labelAr: string;
  known: boolean;
  rawStatus: string;
}

const TONE_STYLES: Record<StatusTone, Pick<ToneStyle, "bg" | "text" | "border" | "dot">> = {
  success: { bg: "bg-success-subtle", text: "text-success-subtle-foreground", border: "border-success/30", dot: "bg-success-vivid" },
  progress: { bg: "bg-info-subtle", text: "text-info-subtle-foreground", border: "border-dashed border-info/30", dot: "bg-info-vivid animate-pulse motion-reduce:animate-none" },
  warning: { bg: "bg-warning-subtle", text: "text-warning-subtle-foreground", border: "border-warning/30", dot: "bg-warning-vivid" },
  danger: { bg: "bg-destructive-subtle", text: "text-destructive-subtle-foreground", border: "border-destructive/30", dot: "bg-destructive-vivid" },
  neutral: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", dot: "bg-muted-foreground" },
};

type StatusEntry = readonly [StatusTone, string, string];
type StatusMap = Readonly<Record<string, StatusEntry>>;

const TENANT_STATUSES: StatusMap = {
  PROVISIONING: ["progress", "Provisioning", "جاري التجهيز"],
  PROVISIONING_FAILED: ["danger", "Provisioning failed", "فشل التجهيز"],
  ACTIVE: ["success", "Active", "نشط"],
  SUSPENDED: ["warning", "Suspended", "معلق"],
  DELETED: ["danger", "Deleted", "محذوف"],
};

const USER_STATUSES: StatusMap = {
  INVITED: ["progress", "Invited", "تمت دعوته"],
  ACTIVE: ["success", "Active", "نشط"],
  SUSPENDED: ["warning", "Suspended", "معلق"],
  DEACTIVATED: ["danger", "Deactivated", "غير مفعّل"],
};

const SUBSCRIPTION_STATUSES: StatusMap = {
  TRIAL: ["progress", "Trial", "تجريبي"],
  PENDING_ACTIVATION: ["progress", "Pending activation", "بانتظار التفعيل"],
  ACTIVE: ["success", "Active", "نشط"],
  PAST_DUE: ["warning", "Past due", "متأخر السداد"],
  CANCELLED: ["warning", "Cancelled", "ملغى"],
};

const INVOICE_STATUSES: StatusMap = {
  DRAFT: ["neutral", "Draft", "مسودة"],
  ISSUED: ["warning", "Issued", "صادر"],
  PARTIALLY_PAID: ["progress", "Partially paid", "مدفوع جزئياً"],
  PAID: ["success", "Paid", "مدفوع"],
  OVERDUE: ["danger", "Overdue", "متأخر"],
  VOID: ["warning", "Void", "لاغٍ"],
};

const OPERATION_STATUSES: StatusMap = {
  REQUESTED: ["progress", "Requested", "مطلوبة"],
  PLANNING: ["progress", "Planning", "قيد التخطيط"],
  QUEUED: ["progress", "Queued", "في قائمة الانتظار"],
  RUNNING: ["progress", "Running", "قيد التشغيل"],
  WAITING_RETRY: ["warning", "Waiting to retry", "بانتظار إعادة المحاولة"],
  CANCEL_REQUESTED: ["warning", "Cancellation requested", "طُلب الإلغاء"],
  SUCCEEDED: ["success", "Succeeded", "نجح"],
  FAILED_RETRYABLE: ["warning", "Failed; retry available", "فشل؛ يمكن إعادة المحاولة"],
  MANUAL_RECOVERY_REQUIRED: ["danger", "Manual recovery required", "يتطلب استرداداً يدوياً"],
  CANCELLED: ["warning", "Cancelled", "ملغاة"],
};

const DATABASE_SERVER_STATUSES: StatusMap = {
  DRAFT: ["neutral", "Draft", "مسودة"],
  ACTIVE: ["success", "Active", "نشط"],
  DRAINING: ["warning", "Draining", "قيد الإفراغ"],
  OFFLINE: ["danger", "Offline", "غير متصل"],
  PENDING: ["progress", "Pending", "قيد الانتظار"],
  PROVISIONING: ["progress", "Provisioning", "جاري التجهيز"],
  READY: ["success", "Ready", "جاهز"],
  ROTATING: ["progress", "Rotating", "قيد التدوير"],
  DEFERRED: ["warning", "Deferred", "مؤجل"],
  RECONCILING: ["progress", "Reconciling", "قيد المطابقة"],
  DEGRADED: ["warning", "Degraded", "متدهور"],
  DISABLED: ["danger", "Disabled", "معطّل"],
  DELETED: ["danger", "Deleted", "محذوف"],
};

const APPLICATION_STATUSES: StatusMap = {
  DRAFT: ["neutral", "Draft", "مسودة"],
  ACTIVE: ["success", "Active", "نشط"],
  DEPRECATED: ["warning", "Deprecated", "متقادم"],
  DISABLED: ["danger", "Disabled", "معطّل"],
};

const BACKUP_ARTIFACT_STATUSES: StatusMap = {
  PENDING: ["progress", "Pending", "قيد الانتظار"],
  RUNNING: ["progress", "Running", "قيد التشغيل"],
  COMPLETED: ["success", "Completed", "مكتمل"],
  FAILED: ["danger", "Failed", "فشل"],
  SKIPPED: ["neutral", "Skipped", "تم التخطي"],
  EXPIRED: ["danger", "Expired", "منتهي الصلاحية"],
};

const DOMAIN_STATUS_MAPS: Record<StatusEnumType, StatusMap> = {
  tenant: TENANT_STATUSES,
  user: USER_STATUSES,
  subscription: SUBSCRIPTION_STATUSES,
  invoice: INVOICE_STATUSES,
  operation: OPERATION_STATUSES,
  "db-server": DATABASE_SERVER_STATUSES,
  application: APPLICATION_STATUSES,
  "backup-artifact": BACKUP_ARTIFACT_STATUSES,
};

// Compatibility vocabulary for call sites whose backend status family has not
// yet been added to enumType. Ambiguous lifecycle labels stay neutral here.
const GENERIC_STATUSES: StatusMap = {
  ...TENANT_STATUSES,
  ...USER_STATUSES,
  ...SUBSCRIPTION_STATUSES,
  ...INVOICE_STATUSES,
  ...OPERATION_STATUSES,
  ...DATABASE_SERVER_STATUSES,
  ACTIVE: ["success", "Active", "نشط"],
  PENDING: ["warning", "Pending", "قيد الانتظار"],
  DUE: ["warning", "Due", "مستحق"],
  STAGED: ["progress", "Staged", "مُعد"],
  ACTIVATED: ["progress", "Activated", "مُفعّل"],
  SUCCESS: ["success", "Success", "نجاح"],
  FAILURE: ["danger", "Failure", "فشل"],
  FAILED: ["danger", "Failed", "فشل"],
  COMPLETED: ["success", "Completed", "مكتمل"],
  COMPLETED_WITH_ERRORS: ["warning", "Completed with errors", "مكتمل مع أخطاء"],
  REVOKED: ["success", "Revoked", "مُبطل"],
  VERIFIED: ["success", "Verified", "تم التحقق"],
  PROMOTED: ["success", "Promoted", "تمت الترقية"],
  ACCEPTED: ["progress", "Accepted", "مقبول"],
  COPYING: ["progress", "Copying", "جارٍ النسخ"],
  COPIED: ["progress", "Copied", "تم النسخ"],
  PLACEMENT_COMMITTED: ["progress", "Placement committed", "تم اعتماد التوزيع"],
  ROLLING_BACK: ["warning", "Rolling back", "جارٍ التراجع"],
  ROLLED_BACK: ["danger", "Rolled back", "تم التراجع"],
  EXPIRED: ["danger", "Expired", "منتهي الصلاحية"],
  BLOCKED: ["danger", "Blocked", "محظور"],
  OFF: ["danger", "Off", "متوقف"],
};

export function resolveStatusTone(status: string, enumType?: StatusEnumType): ToneStyle {
  const rawStatus = status?.trim() ?? "";
  const normalized = rawStatus.toUpperCase();
  const entry = enumType ? DOMAIN_STATUS_MAPS[enumType][normalized] : GENERIC_STATUSES[normalized];

  if (!entry) {
    return {
      ...TONE_STYLES.neutral,
      labelEn: "Unknown status",
      labelAr: "حالة غير معروفة",
      known: false,
      rawStatus: rawStatus || "—",
    };
  }

  const [tone, labelEn, labelAr] = entry;
  return { ...TONE_STYLES[tone], labelEn, labelAr, known: true, rawStatus };
}
