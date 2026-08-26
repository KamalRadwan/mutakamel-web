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

export function BackupStatePanel({ kind, title, description, correlationId, action }: BackupStatePanelProps) {
  const Icon = icons[kind];
  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center"
    >
      <Icon className={`mx-auto size-7 text-muted-foreground ${kind === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {correlationId && (
        <p className="mt-3 text-xs text-muted-foreground">
          Correlation ID: <code className="font-mono">{correlationId}</code>
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
