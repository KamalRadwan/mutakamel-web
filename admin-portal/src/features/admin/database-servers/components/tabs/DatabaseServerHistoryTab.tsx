import { History, RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
            <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
              <History className="w-4 h-4" />
            </div>
            <span>{d.title}</span>
          </h2>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {d.totalEntries.replace("{{count}}", String(history.length))}
          </span>
        </div>

        <div className="p-6">
          {isHistoryLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
              {d.loading}
            </div>
          ) : historyError ? (
            <div className="py-10 text-center text-rose-600 text-xs">
              <p>{historyError}</p>
              <button
                type="button"
                onClick={() => void fetchHistory()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {d.retry}
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              {d.empty}
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((log) => (
                <div
                  key={log.id}
                  className="border-b border-slate-100 dark:border-slate-800/80 pb-4 text-xs last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between font-mono mb-1.5">
                    <span className="font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="space-y-1.5 mt-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {log.changes.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 font-mono text-xs flex-wrap">
                          <span className="text-slate-500 font-semibold">{c.label || c.field}:</span>
                          <span className="text-rose-500 line-through bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                            {String(c.previousValue ?? "null")}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
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
      </div>
    </div>
  );
}
