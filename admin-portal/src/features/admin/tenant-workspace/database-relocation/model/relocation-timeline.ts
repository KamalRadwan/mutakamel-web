import type { Language } from "@/i18n/I18nContext";
import type { OperationTimelineStep } from "@/design-system";
import {
  RELOCATION_STEPS,
  type RelocationRecord,
  type RelocationRollback,
  type RelocationStep,
  type TenantRelocationSummary,
} from "../types";

export type RelocationTimelineState = "done" | "active" | "failed" | "pending";

const STEP_LABELS: Record<RelocationStep, Record<Language, string>> = {
  CLAIM: { en: "Claim", ar: "المطالبة" },
  QUIESCE: { en: "Quiesce", ar: "التهدئة" },
  BACKUP: { en: "Backup", ar: "النسخ الاحتياطي" },
  PROVISION: { en: "Provision", ar: "التهيئة" },
  RESTORE: { en: "Restore", ar: "الاستعادة" },
  VERIFY: { en: "Verify", ar: "التحقق" },
  REPOINT: { en: "Repoint", ar: "إعادة التوجيه" },
  LIFT: { en: "Lift", ar: "رفع التجميد" },
  RETAIN: { en: "Retain source", ar: "الاحتفاظ بالمصدر" },
  DESTROY: { en: "Destroy source", ar: "حذف المصدر" },
};

const STEP_DESCRIPTIONS: Record<RelocationStep, Record<Language, string>> = {
  CLAIM: {
    en: "Take the exclusive tenant claim so no second move can start.",
    ar: "أخذ مطالبة حصرية للمستأجر حتى لا يبدأ نقل ثانٍ.",
  },
  QUIESCE: {
    en: "Stop writes to the source database.",
    ar: "إيقاف الكتابة على قاعدة البيانات المصدر.",
  },
  BACKUP: {
    en: "Take the relocation's own backup of the source.",
    ar: "أخذ نسخة احتياطية خاصة بالنقل من المصدر.",
  },
  PROVISION: {
    en: "Create the tenant database on the destination server.",
    ar: "إنشاء قاعدة بيانات المستأجر على الخادم الوجهة.",
  },
  RESTORE: {
    en: "Restore the backup into the destination database.",
    ar: "استعادة النسخة الاحتياطية داخل قاعدة البيانات الوجهة.",
  },
  VERIFY: {
    en: "Compare schema checksum and sampled row counts.",
    ar: "مقارنة بصمة المخطط وعينات أعداد الصفوف.",
  },
  REPOINT: {
    en: "Move the tenant's placement to the destination.",
    ar: "نقل توزيع المستأجر إلى الوجهة.",
  },
  LIFT: {
    en: "Lift the write freeze on the tenant.",
    ar: "رفع تجميد الكتابة عن المستأجر.",
  },
  RETAIN: {
    en: "Keep the source database for the retention window.",
    ar: "الاحتفاظ بقاعدة البيانات المصدر طوال فترة الاحتفاظ.",
  },
  DESTROY: {
    en: "Drop the retained source. Separate, confirmed, irreversible.",
    ar: "حذف المصدر المحتفظ به. أمر منفصل ومؤكَّد ولا رجعة فيه.",
  },
};

const ROLLBACK_COPY: Record<RelocationRollback, Record<Language, string>> = {
  SOURCE_AUTHORITATIVE: {
    en: "The source database never stopped being authoritative. The destination copy was abandoned and the tenant still runs where it did before.",
    ar: "ظلت قاعدة البيانات المصدر هي المرجع طوال الوقت. تم التخلي عن نسخة الوجهة ولا يزال المستأجر يعمل في مكانه السابق.",
  },
  REPOINT_TO_RETAINED_SOURCE: {
    en: "Placement had already moved, so recovery means repointing the tenant back at the retained source database. Do not release that source.",
    ar: "كان التوزيع قد انتقل بالفعل، لذلك تتم الاستعادة بإعادة توجيه المستأجر إلى قاعدة البيانات المصدر المحتفظ بها. لا تحرِّر ذلك المصدر.",
  },
  NONE: {
    en: "The source database is already gone, so this relocation has no rollback left. Recover from a backup artifact instead.",
    ar: "قاعدة البيانات المصدر لم تعد موجودة، لذلك لم يعد لهذا النقل أي تراجع. استعد من نسخة احتياطية بدلاً من ذلك.",
  },
};

export function relocationRollbackExplanation(
  rollback: RelocationRollback | undefined,
  lang: Language,
): string | null {
  if (!rollback) return null;
  return ROLLBACK_COPY[rollback]?.[lang] ?? null;
}

/**
 * Maps the Worker ledger onto the ten documented steps.
 *
 * The record holds settled entries only, so "running" is inferred: the first
 * step with no entry, while the outcome is still `RUNNING`, is the one in
 * flight. Once the outcome settles, an entry-less step is simply pending —
 * an abandoned relocation must not show a step spinning forever.
 */
export function relocationTimelineStates(
  record: RelocationRecord,
): Array<{ step: RelocationStep; state: RelocationTimelineState; detail?: string; at?: string }> {
  const entries = new Map(record.steps.map((entry) => [entry.step, entry]));
  let activeAssigned = record.outcome !== "RUNNING";

  return RELOCATION_STEPS.map((step) => {
    const entry = entries.get(step);
    if (entry) {
      return {
        step,
        state: entry.state === "FAILED" ? ("failed" as const) : ("done" as const),
        ...(entry.detail ? { detail: entry.detail } : {}),
        at: entry.at,
      };
    }
    if (!activeAssigned) {
      activeAssigned = true;
      return { step, state: "active" as const };
    }
    return { step, state: "pending" as const };
  });
}

export function relocationTimelineSteps(
  record: RelocationRecord,
  lang: Language,
): OperationTimelineStep[] {
  return relocationTimelineStates(record).map(({ step, state, detail, at }) => ({
    label: STEP_LABELS[step][lang],
    state,
    detail: stepDetail(step, state, lang, detail, at),
  }));
}

function stepDetail(
  step: RelocationStep,
  state: RelocationTimelineState,
  lang: Language,
  detail: string | undefined,
  at: string | undefined,
): string {
  if (state === "failed") {
    const prefix = lang === "ar" ? "فشل" : "Failed";
    return detail ? `${prefix}: ${detail}` : prefix;
  }
  if (state === "done") {
    const description = STEP_DESCRIPTIONS[step][lang];
    const stamp = at ? formatRelocationInstant(at, lang) : null;
    return stamp ? `${description} · ${stamp}` : description;
  }
  if (state === "active") {
    const running = lang === "ar" ? "قيد التنفيذ الآن" : "Running now";
    return `${STEP_DESCRIPTIONS[step][lang]} · ${running}`;
  }
  return STEP_DESCRIPTIONS[step][lang];
}

/**
 * Locale-explicit so the same record renders the same way on every machine —
 * `undefined` would resolve to the runtime default (docs/design-system/
 * typography.md's numeral policy). UTC because these are server instants.
 */
export function formatRelocationInstant(
  value: string | null | undefined,
  lang: Language,
): string {
  const fallback = lang === "ar" ? "غير متاح" : "Not available";
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

/**
 * Which relocation this page should reopen after a reload.
 *
 * A running move wins: it is the one that still needs watching. Failing that,
 * a completed move whose source is still retained is adopted so the release
 * command stays reachable — the retention window is measured in days, far
 * longer than any tab stays open, so without this the last step would be
 * unreachable in practice.
 */
export function recoverRelocationRun(
  summaries: readonly TenantRelocationSummary[],
): TenantRelocationSummary | null {
  const running = summaries.find(
    (summary) => summary.record.outcome === "RUNNING",
  );
  if (running) return running;
  return (
    summaries.find(
      (summary) =>
        summary.record.outcome === "RELOCATED" &&
        Boolean(summary.record.retainUntil) &&
        !summary.record.sourceDestroyedAt,
    ) ?? null
  );
}
