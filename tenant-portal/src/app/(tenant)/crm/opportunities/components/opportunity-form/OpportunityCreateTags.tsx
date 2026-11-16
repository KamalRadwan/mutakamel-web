"use client";

import { Plus } from "lucide-react";
import { Button, TagChip, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useOpportunityCreatePresentation } from "../../hooks/useOpportunityCreatePresentation";
import type { useCreateOpportunity } from "../../hooks/useCreateOpportunity";

export function OpportunityCreateTags({ create, presentation }: {
  create: ReturnType<typeof useCreateOpportunity>;
  presentation: ReturnType<typeof useOpportunityCreatePresentation>;
}) {
  const { t } = useI18n();
  const { tags, canAttachTags } = presentation;
  return <div className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-foreground">{t.crmLeads.create.tags}</span>
    {!canAttachTags ? <p className="text-xs text-muted-foreground" role="note">{t.crmOpportunityDetail.create.tagsRequireUpdate}</p> : <>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.items.map((tag) => <Button key={tag.id} variant="ghost" size="xs" type="button"
          disabled={create.isSubmitting || presentation.blocked || tags.degraded} aria-pressed={(create.form.tagIds ?? []).includes(tag.id)}
          onClick={() => create.toggleTag(tag.id)} className={cn("h-auto rounded-full border p-0.5", (create.form.tagIds ?? []).includes(tag.id) ? "border-primary ring-1 ring-ring" : "border-transparent")}>
          <TagChip label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
        </Button>)}
        {tags.canManage && <Button type="button" variant="outline" size="xs" disabled={create.isSubmitting || presentation.blocked}
          onClick={() => presentation.setTagDraftName("")}><Plus className="size-3.5" aria-hidden="true" />{t.crmTags.add}</Button>}
      </div>
      {tags.isLoading && <p role="status" className="text-xs text-muted-foreground">{t.common.loading}</p>}
      {tags.degraded && <p role="status" className="text-xs text-muted-foreground">{t.crmLeads.create.tagsUnavailable}</p>}
      {!tags.isLoading && !tags.degraded && tags.items.length === 0 && <p className="text-xs text-muted-foreground">{t.crmLeadDetail.noTags}</p>}
    </>}
  </div>;
}
