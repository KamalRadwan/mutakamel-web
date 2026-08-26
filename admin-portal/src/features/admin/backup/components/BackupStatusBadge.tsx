interface BackupStatusBadgeProps {
  status: string;
}

const positiveStatuses = new Set(["COMPLETED", "VERIFIED", "PROMOTED", "READY"]);
const activeStatuses = new Set(["PENDING", "RUNNING", "ROTATING"]);
const warningStatuses = new Set(["COMPLETED_WITH_ERRORS", "DEFERRED", "DUE"]);
const negativeStatuses = new Set(["FAILED", "CANCELLED", "EXPIRED", "BLOCKED"]);

export function BackupStatusBadge({ status }: BackupStatusBadgeProps) {
  const normalized = status.toUpperCase();
  const tone = positiveStatuses.has(normalized)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
    : activeStatuses.has(normalized)
      ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300"
      : warningStatuses.has(normalized)
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
        : negativeStatuses.has(normalized)
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
          : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

