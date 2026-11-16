"use client";

import Link from "next/link";
import { Calendar, Check, ChevronRight, MapPin, RotateCcw, Save, Trash2, TrendingUp } from "lucide-react";
import { Badge, Button, DateTime, ErrorState, NotFoundState, PageActions, Skeleton, StatusBadge, cn, iconSize, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { OpportunityFormCards } from "../../components/opportunity-form/OpportunityFormCards";
import { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";
import { OpportunityRelatedNav } from "./OpportunityRelatedNav";
import { OpportunitySavedCardColor } from "./OpportunitySavedCardColor";
import { OpportunitySavedDialogs } from "./OpportunitySavedDialogs";
import { OpportunitySavedFeedback } from "./OpportunitySavedFeedback";
import { OpportunitySavedPanels } from "./OpportunitySavedPanels";
import { OpportunitySavedPipeline } from "./OpportunitySavedPipeline";
import { OpportunitySavedCustomer, OpportunitySavedLead, OpportunitySavedPeopleContext } from "./OpportunitySavedRelations";
import { OpportunitySavedTags } from "./OpportunitySavedTags";

export function OpportunityDetailWorkspace({ opportunityId }: { opportunityId: string }) {
  return <OpportunityDetailContent key={opportunityId} opportunityId={opportunityId} />;
}

function OpportunityDetailContent({ opportunityId }: { opportunityId: string }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const workspace = useOpportunitySavedWorkspace(opportunityId);
  const { detail, item, edit, canUpdate, canDelete, locked, commands, requestCommand, lookups, formLookups, branchLabel } = workspace;
  const form = edit.form;
  const copy = t.crmOpportunityDetail.form;
  if (detail.isLoading && !item) return <div className="grid gap-3"><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div>;
  if (detail.isForbidden) return <CrmScopeGate />;
  if (detail.isNotFound) return <NotFoundState title={t.crmOpportunityDetail.notFoundTitle} description={t.crmOpportunityDetail.notFoundDescription} backLabel={t.crmOpportunityDetail.backToOpportunities} backHref="/crm/opportunities" />;
  if (detail.error || !item) return <ErrorState title={t.crmOpportunities.loadFailed} description={describeError(detail.error) ?? undefined} onRetry={detail.reload} retryLabel={t.common.retry} />;
  return <div className="grid min-w-0 content-start gap-3 pb-6">
    <PageActions slot="crumb"><ChevronRight className={cn(iconSize({ size: "xs" }), mirrorInRtl, "text-muted-foreground")} aria-hidden="true" /><span className="max-w-xs truncate font-semibold text-foreground" title={item.title} aria-current="page">{item.title}</span></PageActions>
    <PageActions slot="actions">
      <Badge tone={edit.isDirty ? "caution" : "positive"}>{edit.isDirty ? copy.unsavedChanges : copy.saved}</Badge>
      <Button size="sm" variant="outline" disabled={!edit.isDirty || locked} onClick={() => requestCommand(edit.revert)}><RotateCcw className="size-3.5" aria-hidden="true" />{copy.revertChanges}</Button>
      {canDelete && <Button variant="ghost" size="sm" disabled={locked} aria-label={t.common.delete} onClick={() => requestCommand(() => commands.setDeleteOpen(true))}><Trash2 className="size-3.5 text-destructive" aria-hidden="true" /></Button>}
      {canUpdate && <Button type="submit" form="opportunity-saved-form" variant="primary" size="sm" loading={edit.isSubmitting} disabled={!edit.isDirty || locked}><Save className="size-3.5" aria-hidden="true" />{copy.saveChanges}</Button>}
    </PageActions>
    <div className="dossier-hero px-4! py-3!">
      <div className="flex min-w-0 flex-wrap items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-logo text-white shadow-sm"><TrendingUp className="size-6" aria-hidden="true" /></span><h1 className="min-w-0 break-words text-xl font-semibold">{item.title}</h1><StatusBadge value={item.status} kind="OpportunityStatus" />{branchLabel && <span className="inline-flex items-center gap-1 text-xs font-medium"><MapPin className="size-3.5" aria-hidden="true" />{branchLabel}</span>}</div>
      <Link className="text-xs text-primary hover:underline" href="/crm/opportunities">{t.crmOpportunityDetail.backToOpportunities}</Link>
    </div>
    <OpportunityRelatedNav item={item} />
    <OpportunitySavedFeedback workspace={workspace} />
    {form ? <form id="opportunity-saved-form" noValidate onSubmit={(event) => { event.preventDefault(); if (canUpdate && !locked) void edit.submit(); }} className="grid min-w-0 content-start gap-3 [&_input]:bg-surface-subtle [&_textarea]:bg-surface-subtle [&_[role=combobox]]:bg-surface-subtle">
      <OpportunityFormCards form={form} errors={edit.errors} onFieldChange={edit.setField} onBlur={edit.touch} disabled={!canUpdate || locked} view="full" mode="edit" lookups={formLookups}
        selectedContactLabel={item.primaryContact && item.primaryContact.partyId === form.contactPartyId ? item.primaryContact.displayName : undefined}
        customFields={{ definitions: edit.definitions, requiredFieldKeys: edit.requiredFieldKeys, loading: edit.customFieldsLoading, degraded: Boolean(edit.customFieldsError) }}
        currencyOptions={workspace.currencyOptions} readonlyCustomer={<OpportunitySavedCustomer item={item} profileType={lookups.customer.item?.profileType} />} readonlyLead={<OpportunitySavedLead item={item} lookups={lookups} />}
        peopleContext={<OpportunitySavedPeopleContext item={item} form={form} lookups={lookups} branchLabel={branchLabel} />}
        pipelineSlot={<OpportunitySavedPipeline workspace={workspace} />} tagsSlot={<OpportunitySavedTags workspace={workspace} />}
        cardColorSlot={<OpportunitySavedCardColor value={form.cardColor ?? null} disabled={!canUpdate || locked} onChange={(value) => edit.setField("cardColor", value)} />} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-divider pt-2"><p className="text-xs text-muted-foreground">{copy.ordinarySaveHint}</p><span role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground">{!edit.isDirty && <Check className="size-3.5 text-positive-600" aria-hidden="true" />}{edit.isDirty ? copy.unsavedChanges : copy.saved}</span></div>
    </form> : <Skeleton className="h-64 rounded-lg" />}
    <OpportunitySavedPanels workspace={workspace} />
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="size-3.5" aria-hidden="true" />{t.crmLeadDetail.createdAt}: <DateTime value={item.createdAt} /></span><span>{t.crmLeadDetail.updatedAt}: <DateTime value={item.updatedAt} precision="datetime" /></span></div>
    <OpportunitySavedDialogs workspace={workspace} />
  </div>;
}
