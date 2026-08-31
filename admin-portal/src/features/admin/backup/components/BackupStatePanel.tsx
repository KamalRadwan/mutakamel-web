import { AlertTriangle, Inbox, Loader2, LockKeyhole } from "lucide-react";
import { CodeRef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

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
  const { lang } = useI18n();
  const Icon = icons[kind];
  const iconTone = kind === "error"
    ? "text-destructive"
    : kind === "forbidden"
      ? "text-warning"
      : kind === "loading"
        ? "text-info"
        : "text-muted-foreground";
  return (
    <section
      role={kind === "loading" ? "status" : kind === "error" || kind === "forbidden" ? "alert" : undefined}
      className="rounded-lg border border-border bg-card px-6 py-12 text-center"
    >
      <Icon className={`mx-auto size-7 ${iconTone} ${kind === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {correlationId && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>{lang === "ar" ? "معرّف الارتباط:" : "Correlation ID:"}</span>
          <CodeRef value={correlationId} />
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
