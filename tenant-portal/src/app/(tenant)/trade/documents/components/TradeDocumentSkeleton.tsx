"use client";

import { Skeleton } from "@/design-system";

/**
 * The loading state of a document detail screen.
 *
 * Shaped like the content it replaces — a header line, a status chip, then two
 * field cards — rather than a spinner over a blank page. A spinner says
 * "something is happening"; this says "a document is arriving", which is what
 * the reader is waiting for.
 */
export function TradeDocumentSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-36 w-full rounded-sm" />
      <Skeleton className="h-36 w-full rounded-sm" />
    </div>
  );
}
