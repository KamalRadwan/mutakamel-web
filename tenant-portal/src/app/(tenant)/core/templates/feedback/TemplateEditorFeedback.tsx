"use client";

import { cn } from "@/design-system";
import { useTemplateFeedbackCopy } from "./useTemplateFeedbackCopy";

export interface TemplateEditorFeedbackProps {
  busy?: "loading" | "saving" | "previewing";
  readOnly?: boolean;
  /** Already localized by the command owner; never a raw transport error. */
  error?: string | null;
  /** Only actual layout diagnostics, localized by their owning adapter. */
  overflowWarnings?: readonly { id: string; message: string }[];
}

/** Keep mounted across state transitions so live regions exist before updates. */
export function TemplateEditorFeedback({ busy, readOnly = false, error, overflowWarnings = [] }: TemplateEditorFeedbackProps) {
  const c = useTemplateFeedbackCopy();
  return <section aria-label={c.region} className={cn("min-w-0 space-y-2 text-sm",
    !busy && !readOnly && !error && overflowWarnings.length === 0 && "sr-only")}>
    <div role="status" aria-atomic="true" className="space-y-1 text-muted-foreground">
      {busy && <p>{c[busy]}</p>}
      {readOnly && <p className="text-foreground">{c.readOnly}</p>}
    </div>
    <div role="alert" aria-atomic="true" className="break-words text-destructive">{error}</div>
    <div role="status" aria-atomic="true" className="space-y-1">
      {overflowWarnings.length > 0 && <>
        <p className="font-medium text-foreground">{c.overflow}</p>
        <ul className="list-disc space-y-1 ps-5 text-foreground">
          {overflowWarnings.map(warning => <li key={warning.id} className="break-words">{warning.message}</li>)}
        </ul>
      </>}
    </div>
  </section>;
}
