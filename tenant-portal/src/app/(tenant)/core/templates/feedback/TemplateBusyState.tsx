"use client";

import { cn, Skeleton } from "@/design-system";
import { useTemplateFeedbackCopy } from "./useTemplateFeedbackCopy";

const skeletonHeight = { summary: "h-32", editor: "h-[600px]" };

export function TemplateBusyState({ surface = "summary" }: { surface?: keyof typeof skeletonHeight }) {
  const c = useTemplateFeedbackCopy();
  return <div className="min-w-0 space-y-2">
    <p role="status" aria-atomic="true" className="text-sm text-muted-foreground">{c.loading}</p>
    <div aria-busy="true" aria-label={c.loading}>
      <Skeleton className={cn(skeletonHeight[surface], "w-full motion-reduce:[&_*]:animate-none")} aria-hidden="true" />
    </div>
  </div>;
}
