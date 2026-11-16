"use client";

import { Building2, UserRound } from "lucide-react";
import { Button, Combobox, DossierFormCard, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityFormCardsProps } from "./opportunity-form-types";

const NO_SELECTION = "__none__";

export function OpportunityPeopleFields(props: OpportunityFormCardsProps) {
  const { t } = useI18n();
  const copy = t.crmOpportunityDetail.form;
  const { form, lookups, onFieldChange, onBlur, disabled, customers } = props;
  const selectedCustomer = customers?.items.find(({ id }) => id === form.customerProfileId)
    ?? (lookups.customer.item?.id === form.customerProfileId ? lookups.customer.item : null);
  const selectedDescription = selectedCustomer ? [
    selectedCustomer.profileType ? t.crmCustomerProfiles.profileTypes[selectedCustomer.profileType] : null,
    selectedCustomer.companyName !== selectedCustomer.displayName ? selectedCustomer.companyName : null,
  ].filter(Boolean).join(" · ") : undefined;
  return (
    <DossierFormCard title={copy.customerPeople} icon={Building2} tone="indigo">
      {props.mode === "edit" ? props.readonlyCustomer : customers && (
        <Field showLabel label={t.crmOpportunities.customer} error={props.errors.customerProfileId} required>
          <Combobox value={form.customerProfileId || undefined} selectedLabel={customers.selectedLabel || selectedCustomer?.displayName} selectedDescription={selectedDescription}
            options={customers.items.map((customer) => ({ value: customer.id, label: customer.displayName, description: customer.companyName ?? undefined }))}
            onSearch={customers.onSearch} onValueChange={(value) => {
              const selected = customers.items.find(({ id }) => id === value);
              customers.onSelect(value ?? "", selected?.displayName ?? ""); onBlur("customerProfileId");
            }} loading={customers.isLoading} disabled={disabled} className="[&>button]:min-h-12 [&>button]:py-2"
            leadingSlot={<span className="dossier-icon-pill dossier-ip-indigo"><Building2 className="size-4" aria-hidden="true" /></span>}
            placeholder={t.crmOpportunityDetail.selectCustomer} searchPlaceholder={t.crmCustomerProfiles.search}
            loadingLabel={t.common.loading} emptyLabel={t.crmOpportunityDetail.noCustomers}
            errorContent={customers.error && <div className="flex flex-col gap-2 p-2 text-sm text-destructive" role="alert">
              {copy.customersUnavailable}<Button variant="outline" size="sm" onClick={customers.reload}>{t.common.retry}</Button>
            </div>}
            footer={customers.hasMore && <Button variant="ghost" size="sm" className="w-full" disabled={customers.isLoading} onClick={customers.loadMore}>{copy.loadMore}</Button>}
          />
        </Field>
      )}
      {props.peopleContext}
      {props.view === "full" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field showLabel label={copy.contactPerson} error={props.errors.contactPartyId}>
          <Select value={form.contactPartyId || NO_SELECTION} disabled={disabled || !form.customerProfileId || lookups.customer.isLoading || (Boolean(lookups.customer.error) && !form.contactPartyId)}
            onValueChange={(value) => { onFieldChange("contactPartyId", value === NO_SELECTION ? "" : value); onBlur("contactPartyId"); }}>
            <SelectTrigger size="sm"><SelectValue placeholder={copy.selectContact}>{props.selectedContactLabel}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value={NO_SELECTION}>{copy.selectContact}</SelectItem>
              {lookups.customer.contacts.map((contact) => <SelectItem key={contact.partyId} value={contact.partyId} disabled={contact.disabled}>{contact.displayName}{contact.jobTitle ? ` · ${contact.jobTitle}` : ""}</SelectItem>)}
              {form.customerProfileId && !lookups.customer.isLoading && !lookups.customer.error && lookups.customer.contacts.length === 0 && <SelectItem value="__no_contacts__" disabled>{copy.noContacts}</SelectItem>}
            </SelectContent>
          </Select>
        </Field>
        {props.mode === "edit" ? props.readonlyLead : <Field showLabel label={copy.sourceLead} error={props.errors.leadId}>
          <Select value={form.leadId || NO_SELECTION} disabled={disabled || !form.customerProfileId || lookups.customer.isLoading || lookups.customer.leadLoading || (Boolean(lookups.customer.error || lookups.customer.leadError) && !form.leadId)}
            onValueChange={(value) => { onFieldChange("leadId", value === NO_SELECTION ? "" : value); onBlur("leadId"); }}>
            <SelectTrigger size="sm"><SelectValue placeholder={copy.selectLead} /></SelectTrigger>
            <SelectContent><SelectItem value={NO_SELECTION}>{copy.selectLead}</SelectItem>
              {lookups.customer.sourceLeads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.displayName}{lead.summary ? ` · ${lead.summary}` : ""}</SelectItem>)}
              {form.customerProfileId && !lookups.customer.isLoading && !lookups.customer.leadLoading && !lookups.customer.error && !lookups.customer.leadError && lookups.customer.sourceLeads.length === 0 && <SelectItem value="__no_leads__" disabled>{copy.noLeads}</SelectItem>}
            </SelectContent>
          </Select>
        </Field>}
      </div>}
      {props.view === "full" && form.customerProfileId && (lookups.customer.isLoading || lookups.customer.leadLoading) && <p className="text-xs text-muted-foreground" role="status">{t.common.loading}</p>}
      {props.view === "full" && (lookups.customer.error || lookups.customer.leadError) && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">{lookups.customer.error ? copy.customerDetailsUnavailable : copy.sourceLeadUnavailable}<Button size="xs" variant="outline" onClick={lookups.customer.reload}>{t.common.retry}</Button></div>}
      <Field showLabel label={t.crmOpportunities.salesperson} error={props.errors.ownerUserId}>
        <Select value={form.ownerUserId || props.defaultOwnerId || undefined} disabled={disabled || lookups.owners.isLoading || Boolean(lookups.owners.error)}
          onValueChange={(value) => { onFieldChange("ownerUserId", value); onBlur("ownerUserId"); }}>
          <SelectTrigger size="sm"><span className="flex! min-w-0 flex-1 items-center gap-2 text-start"><UserRound className="size-4 shrink-0 text-info" aria-hidden="true" /><span className="min-w-0 truncate"><SelectValue placeholder={copy.selectSalesperson} /></span></span></SelectTrigger>
          <SelectContent>
            {lookups.owners.items.map((owner) => <SelectItem key={owner.id} value={owner.id} disabled={owner.disabled}>{owner.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {lookups.owners.isLoading && <p className="text-xs text-muted-foreground" role="status">{t.common.loading}</p>}
      {lookups.owners.error && <div role="alert" className="flex items-center justify-between gap-2 text-xs text-destructive">{copy.ownersUnavailable}<Button size="xs" variant="outline" onClick={lookups.owners.reload}>{t.common.retry}</Button></div>}
    </DossierFormCard>
  );
}
