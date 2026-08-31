import { History, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Badge, Card, EmptyState, ErrorState } from "@/design-system";
import type { DatabaseServerHistoryView } from "../../types";

interface DatabaseServerHistoryTabProps {
  history: DatabaseServerHistoryView[];
  isHistoryLoading: boolean;
  historyError: string | null;
  fetchHistory: () => Promise<void>;
}

export function DatabaseServerHistoryTab({
  history,
  isHistoryLoading,
  historyError,
  fetchHistory,
}: DatabaseServerHistoryTabProps) {
  const { lang, t } = useI18n();
  const d = t.databaseServerDetail.history;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between border-b border-border bg-muted p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground rtl:normal-case rtl:tracking-normal">
            <span className="rounded-lg bg-info-subtle p-1.5 text-info-subtle-foreground">
              <History className="size-4" aria-hidden="true" />
            </span>
            {d.title}
          </h2>
          <Badge tone="neutral" className="font-mono">
            {d.totalEntries.replace("{{count}}", String(history.length))}
          </Badge>
        </div>

        <div className="p-6">
          {isHistoryLoading ? (
            <div role="status" className="py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="me-2 inline size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {d.loading}
            </div>
          ) : historyError ? (
            <ErrorState title={historyError} onRetry={() => void fetchHistory()} />
          ) : history.length === 0 ? (
            <EmptyState icon={History} title={d.empty} />
          ) : (
            <div className="space-y-4">
              {history.map((log) => (
                <div key={log.id} className="border-b border-border pb-4 text-xs last:border-0 last:pb-0">
                  <div className="mb-1.5 flex items-center justify-between font-mono">
                    <span dir="ltr" className="font-semibold uppercase tracking-wide text-info-subtle-foreground">
                      {log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted p-3">
                      {log.changes.map((c, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                          <span className="font-semibold text-muted-foreground">{c.label || c.field}:</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                            {String(c.previousValue ?? "null")}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="rounded bg-info-subtle px-1.5 py-0.5 font-semibold text-info-subtle-foreground">
                            {String(c.newValue ?? "null")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
