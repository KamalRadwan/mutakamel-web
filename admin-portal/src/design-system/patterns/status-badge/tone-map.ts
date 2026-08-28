// Status vocabulary as data (docs/components/status-badge.md), not a
// switch statement — makes the full enum matrix reviewable in one place.
// Collapsed from the old component's 5 hues to 4 roles + a "progress"
// treatment: "in progress" is neutral + a pulsing dot + a dashed border,
// not a 5th hue (docs/design-system/tokens.md's no-fifth-hue rule) —
// motion survives colorblindness and this badge always renders a text
// label anyway, so hue was never the only signal.
type StatusTone = "success" | "progress" | "warning" | "danger" | "neutral";

interface ToneStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  labelEn: string;
  labelAr: string;
}

const TONE_STYLES: Record<StatusTone, Omit<ToneStyle, "labelEn" | "labelAr">> = {
  success: {
    bg: "bg-brand-500/10 dark:bg-brand-500/15",
    text: "text-brand-700 dark:text-brand-300",
    border: "border-brand-500/30",
    dot: "bg-brand-500",
  },
  progress: {
    bg: "bg-ink-100 dark:bg-ink-800",
    text: "text-ink-700 dark:text-ink-300",
    border: "border-dashed border-ink-300 dark:border-ink-600",
    dot: "bg-ink-500 animate-pulse motion-reduce:animate-none",
  },
  warning: {
    bg: "bg-warn-500/10 dark:bg-warn-500/15",
    text: "text-warn-800 dark:text-warn-300",
    border: "border-warn-500/30",
    dot: "bg-warn-500",
  },
  danger: {
    bg: "bg-danger-500/10 dark:bg-danger-500/15",
    text: "text-danger-700 dark:text-danger-300",
    border: "border-danger-500/30",
    dot: "bg-danger-500",
  },
  neutral: {
    bg: "bg-ink-100 dark:bg-ink-800",
    text: "text-ink-600 dark:text-ink-400",
    border: "border-ink-200 dark:border-ink-700",
    dot: "bg-ink-400",
  },
};

// key = status.toUpperCase(); value = [tone, labelEn, labelAr]. Extend
// this table rather than adding a branch elsewhere in the app.
const STATUS_ENTRIES: Record<string, [StatusTone, string, string]> = {
  ACTIVE: ["success", "Active", "نشط"],
  PAID: ["success", "Paid", "مدفوع"],
  SUCCEEDED: ["success", "Succeeded", "نجح"],
  // Control-plane audit event outcomes — distinct wire values from the
  // SUCCEEDED/FAILED operation-status pair above, same tones.
  SUCCESS: ["success", "Success", "نجاح"],

  PROVISIONING: ["progress", "Provisioning", "جاري التجهيز"],
  RUNNING: ["progress", "Running", "قيد التشغيل"],
  TRIAL: ["progress", "Trial", "تجريبي"],
  PARTIALLY_PAID: ["progress", "Partially Paid", "مدفوع جزئياً"],
  PENDING_ACTIVATION: ["progress", "Pending Activation", "بانتظار التفعيل"],
  // Storage credential rotation (STAGED/ACTIVATED) and tenant storage
  // migration (ACCEPTED/COPYING/COPIED/PLACEMENT_COMMITTED) — every
  // non-terminal step of both flows is "progress" until their respective
  // terminal state (REVOKED, COMPLETED).
  STAGED: ["progress", "Staged", "مُعد"],
  ACTIVATED: ["progress", "Activated", "مُفعّل"],
  ACCEPTED: ["progress", "Accepted", "مقبول"],
  COPYING: ["progress", "Copying", "جارٍ النسخ"],
  COPIED: ["progress", "Copied", "تم النسخ"],
  PLACEMENT_COMMITTED: ["progress", "Placement Committed", "تم اعتماد التوزيع"],
  // Backup encryption-key rotation actively swapping the active key —
  // non-terminal, same "progress" treatment as the storage-credential
  // rotation steps above.
  ROTATING: ["progress", "Rotating", "قيد التدوير"],

  SUSPENDED: ["warning", "Suspended", "معلق"],
  ISSUED: ["warning", "Issued", "صادر"],
  DRAINING: ["warning", "Draining", "قيد الإفراغ"],
  PENDING: ["warning", "Pending", "قيد الانتظار"],
  PAST_DUE: ["warning", "Past Due", "متأخر السداد"],
  // A migration actively unwinding after a failure — not yet the terminal
  // ROLLED_BACK state, so it reads as an active caution, not a hard danger.
  ROLLING_BACK: ["warning", "Rolling Back", "جارٍ التراجع"],
  // Backup job finished but recorded errors along the way — worse than a
  // clean COMPLETED, not yet a hard FAILED.
  COMPLETED_WITH_ERRORS: ["warning", "Completed with Errors", "مكتمل مع أخطاء"],
  DEFERRED: ["warning", "Deferred", "مؤجل"],
  DUE: ["warning", "Due", "مستحق"],

  FAILED: ["danger", "Failed", "فشل"],
  FAILURE: ["danger", "Failure", "فشل"],
  PROVISIONING_FAILED: ["danger", "Provisioning Failed", "فشل التجهيز"],
  OVERDUE: ["danger", "Overdue", "متأخر"],
  OFFLINE: ["danger", "Offline", "غير متصل"],
  ROLLED_BACK: ["danger", "Rolled Back", "تم التراجع"],
  EXPIRED: ["danger", "Expired", "منتهي الصلاحية"],
  BLOCKED: ["danger", "Blocked", "محظور"],

  COMPLETED: ["success", "Completed", "مكتمل"],
  // Terminal state of a credential rotation: the previous key is proven
  // rejected. Distinct from VOID/CANCELLED below — REVOKED is the
  // successful end of a rotation, not an abandoned one.
  REVOKED: ["success", "Revoked", "مُبطل"],
  // Backup evidence states: a verified restore point, or a snapshot
  // promoted to become the new primary/active copy.
  VERIFIED: ["success", "Verified", "تم التحقق"],
  PROMOTED: ["success", "Promoted", "تمت الترقية"],
  READY: ["success", "Ready", "جاهز"],

  DELETED: ["neutral", "Deleted", "محذوف"],
  CANCELLED: ["neutral", "Cancelled", "ملغى"],
  VOID: ["neutral", "Void", "لاغٍ"],
  OFF: ["neutral", "Off", "متوقف"],
  // Invoice lifecycle: an unissued manual draft, editable and not yet
  // transmitted — same neutral tone as VOID/CANCELLED (not yet "real"),
  // but a distinct label so operators don't confuse the two.
  DRAFT: ["neutral", "Draft", "مسودة"],
};

export function resolveStatusTone(status: string): ToneStyle {
  const entry = STATUS_ENTRIES[status?.toUpperCase()];
  const [tone, labelEn, labelAr] = entry ?? (["neutral", status, status] as const);
  return { ...TONE_STYLES[tone], labelEn, labelAr };
}
