"use client";

import { Clock3, FileText } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

/**
 * `headerSaved` is a partial-create receipt only (header created, items not yet saved).
 * `existingDraft` marks an already-persisted draft being edited and never shows that receipt.
 */
export function QuotationDraftNote({ headerSaved, existingDraft = false }: { headerSaved: boolean; existingDraft?: boolean }) {
  const { t } = useI18n();
  const partialCreate = headerSaved && !existingDraft;
  return <section aria-label={t.quotationFlow.draftNoteTitle} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:px-5">
    <div className="flex flex-wrap items-center gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" aria-hidden="true" />{t.quotationFlow.draftNoteTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.quotationFlow.draftNote}</p></div>
    <Badge tone={existingDraft ? "neutral" : "caution"}><Clock3 className="me-1.5 size-3.5" aria-hidden="true" />{existingDraft ? t.quotationExperience.draftSaved : partialCreate ? t.quotationExperience.headerSaved : t.quotationExperience.unsaved}</Badge>
  </section>;
}
