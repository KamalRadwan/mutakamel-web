import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export function BackupErrorBanner({ error }: { error: NormalizedApiError }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="font-bold">{error.message}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
        <span>{error.errorCode}</span>
        {error.correlationId ? (
          <span>Correlation ID: <code className="font-mono">{error.correlationId}</code></span>
        ) : null}
      </div>
    </div>
  );
}

