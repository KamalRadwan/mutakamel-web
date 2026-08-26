import { History, RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Card, Button } from "@/design-system";
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
  const { t } = useI18n();
  const d = t.databaseServerDetail.history;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between border-b border-border bg-muted p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <span className="rounded-lg bg-brand-500/10 p-1.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              <History className="size-4" aria-hidden="true" />
            </span>
            {d.title}
          </h2>
          <span className="rounded-lg bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
            {d.totalEntries.replace("{{count}}", String(history.length))}
          </span>
        </div>

        <div className="p-6">
          {isHistoryLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Loader2 className="me-2 inline size-4 animate-spin" aria-hidden="true" />
              {d.loading}
            </div>
          ) : historyError ? (
            <div className="py-10 text-center text-xs text-danger-600 dark:text-danger-400">
              <p>{historyError}</p>
              <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={() => void fetchHistory()}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {d.retry}
              </Button>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs font-semibold text-muted-foreground">{d.empty}</div>
          ) : (
            <div className="space-y-4">
              {history.map((log) => (
                <div key={log.id} className="border-b border-border pb-4 text-xs last:border-0 last:pb-0">
                  <div className="mb-1.5 flex items-center justify-between font-mono">
                    <span className="font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                      {log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted p-3">
                      {log.changes.map((c, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                          <span className="font-semibold text-muted-foreground">{c.label || c.field}:</span>
                          <span className="rounded bg-danger-500/10 px-1.5 py-0.5 text-danger-600 line-through dark:bg-danger-500/15 dark:text-danger-400">
                            {String(c.previousValue ?? "null")}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="rounded bg-brand-500/10 px-1.5 py-0.5 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
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
