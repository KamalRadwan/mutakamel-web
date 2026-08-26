import { AlertTriangle, Inbox, Loader2, LockKeyhole } from "lucide-react";

type BackupStateKind = "loading" | "error" | "empty" | "forbidden";

interface BackupStatePanelProps {
  kind: BackupStateKind;
  title: string;
  description: string;
  correlationId?: string;
  action?: React.ReactNode;
}

const icons = {
  loading: Loader2,
  error: AlertTriangle,
  empty: Inbox,
  forbidden: LockKeyhole,
};

export function BackupStatePanel({
  kind,
  title,
  description,
  correlationId,
  action,
}: BackupStatePanelProps) {
  const Icon = icons[kind];
  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950"
    >
      <Icon
        className={`mx-auto size-7 text-slate-400 ${kind === "loading" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        {description}
      </p>
      {correlationId ? (
        <p className="mt-3 text-xs text-slate-500">
          Correlation ID: <code className="font-mono">{correlationId}</code>
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

