"use client";

import { useEffect, useRef } from "react";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { ErrorState } from "@/design-system";

export function BackupErrorBanner({ error }: { error: NormalizedApiError }) {
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    summaryRef.current?.focus();
  }, [error]);

  return (
    <div ref={summaryRef} tabIndex={-1} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ErrorState error={error} className="border border-destructive/30 bg-destructive-subtle" />
    </div>
  );
}
