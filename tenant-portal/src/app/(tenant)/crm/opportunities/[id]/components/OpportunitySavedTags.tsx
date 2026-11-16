"use client";

import { Check, Plus, X } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger, TagChip } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";

export function OpportunitySavedTags({ workspace }: { workspace: ReturnType<typeof useOpportunitySavedWorkspace> }) {
  const { t } = useI18n();
  const { item, commands, canUpdate, locked, requestCommand } = workspace;
  if (!item) return null;
  const selected = new Set(item.tags.map(({ id }) => id));
  return <div className="flex flex-col gap-1.5"><span className="text-xs font-medium">{t.crmLeads.create.tags}</span><div className="flex flex-wrap items-center gap-1.5">
    {item.tags.map((tag) => <TagChip key={tag.id} label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor}>
      {canUpdate && <Button size="xs" variant="ghost" disabled={locked} aria-label={`${t.common.delete} ${tag.name}`} className="size-4 p-0" onClick={() => requestCommand(() => { void commands.toggleTag(tag.id, true); })}><X className="size-3" aria-hidden="true" /></Button>}
    </TagChip>)}
    {canUpdate && commands.tags.canRead && <Popover open={commands.tagMenuOpen} onOpenChange={commands.setTagMenuOpen}><PopoverTrigger asChild><Button variant="outline" size="xs" disabled={locked}><Plus className="size-3.5" aria-hidden="true" />{t.crmLeads.create.tagsPlaceholder}</Button></PopoverTrigger><PopoverContent className="flex max-h-64 flex-col gap-1 overflow-y-auto p-2" align="start">
      {commands.tags.isLoading && <p role="status" className="p-2 text-xs text-muted-foreground">{t.common.loading}</p>}
      {commands.tags.degraded && <p role="alert" className="p-2 text-xs text-destructive">{t.crmLeads.create.tagsUnavailable}</p>}
      {commands.tags.items.map((tag) => <Button key={tag.id} variant="ghost" size="sm" className="justify-start" disabled={locked} onClick={() => requestCommand(() => { void commands.toggleTag(tag.id, selected.has(tag.id)); })}>{selected.has(tag.id) && <Check className="size-3.5" aria-hidden="true" />}{tag.name}</Button>)}
      {commands.tags.canManage && <Button size="sm" variant="outline" disabled={locked} onClick={() => requestCommand(() => { commands.setTagMenuOpen(false); commands.setCreateTagOpen(true); })}><Plus className="size-3.5" aria-hidden="true" />{t.crmOpportunities.createTag}</Button>}
    </PopoverContent></Popover>}
    {item.tags.length === 0 && !canUpdate && <span className="text-xs text-muted-foreground">{t.detail.notRecorded}</span>}
  </div></div>;
}
