"use client";

import Link from "next/link";
import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { Button } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useTemplateFeedbackCopy } from "./feedback/useTemplateFeedbackCopy";
import { useTemplateFeedbackFocus } from "./feedback/useTemplateFeedbackFocus";

export default function TemplatesSegmentError({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const c = useTemplateFeedbackCopy();
  const target = useTemplateFeedbackFocus(true);
  return <div ref={target} tabIndex={-1} role="region" aria-label={c.region}
    className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <SegmentErrorScreen description={c.errorDescription} digest={error.digest} onRetry={unstable_retry} />
    <div className="flex justify-center p-4">
      <Button asChild variant="outline"><Link href={TENANT_ROUTES.coreTemplates}>{c.back}</Link></Button>
    </div>
  </div>;
}
