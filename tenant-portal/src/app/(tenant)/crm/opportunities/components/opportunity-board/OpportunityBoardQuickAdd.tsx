"use client";

import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { Button, Combobox, Field, Input, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useOpportunityBoardQuickAdd } from "./hooks/useOpportunityBoardQuickAdd";
import { OpportunityBoardQuickAddFields } from "./OpportunityBoardQuickAddFields";
import type { OpportunityBoardQuickAddProps } from "./opportunity-board-types";

export function OpportunityBoardQuickAdd(props: OpportunityBoardQuickAddProps) {
  const { t } = useI18n();
  const form = useOpportunityBoardQuickAdd(props);
  if (form.isForbidden) return <PermissionGate require="crm.opportunities.create" scoped denied>{null}</PermissionGate>;
  return (
    <form onSubmit={form.submit} className="space-y-2.5 rounded-card border border-line-card bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />{t.crmOpportunities.quickAdd}
        </span>
        <Button type="button" variant="ghost" size="xs" onClick={props.onClose} disabled={form.isSaving}
          aria-label={t.common.cancel} className="size-[26px] rounded-md p-0 text-muted-foreground">
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {form.errorMsg && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-subtle px-2.5 py-1.5 text-caption text-destructive-subtle-foreground">{form.errorMsg}</div>}
      <Field label={t.crmOpportunities.customer} required>
        <Combobox options={form.customerOptions} value={form.customerProfileId || undefined}
          onValueChange={(next) => form.setCustomerProfileId(next ?? "")} onSearch={form.customers.search}
          loading={form.customers.isLoading} placeholder={t.crmOpportunityDetail.selectCustomer}
          searchPlaceholder={t.crmCustomerProfiles.search} loadingLabel={t.common.loading}
          emptyLabel={t.crmOpportunityDetail.noCustomers} disabled={form.isSaving} />
      </Field>
      <Field label={t.crmOpportunities.title} required>
        {/* Match backend mutakamel-apps/crm-app/src/crm/opportunities/dto/opportunity.dto.ts so quick add cannot accept an oversized title. */}
        <Input value={form.title} onChange={(event) => form.setTitle(event.target.value)}
          placeholder={t.crmOpportunities.titleExample} disabled={form.isSaving} maxLength={180} />
      </Field>
      <OpportunityBoardQuickAddFields form={form} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-card pt-2">
        <Button type="button" variant="ghost" size="xs" disabled={form.isSaving} onClick={form.openFullForm}
          className="h-auto gap-1 p-0 text-caption text-primary hover:bg-transparent hover:underline">
          {t.crmOpportunities.fullForm}<ExternalLink className="size-3" aria-hidden="true" />
        </Button>
        <div className="ms-auto flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={props.onClose} disabled={form.isSaving}>{t.common.cancel}</Button>
          <Button type="submit" variant="secondary" size="xs" disabled={form.isSaving} aria-label={t.common.create}>
            {form.isSaving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : t.common.create}
          </Button>
        </div>
      </div>
    </form>
  );
}
