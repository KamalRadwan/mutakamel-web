import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { ErrorState } from "@/design-system";

export function BackupErrorBanner({ error }: { error: NormalizedApiError }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <ErrorState error={error} />
    </div>
  );
}
