"use client";

import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, DegradedBanner, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, Input, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { QuotationCustomerOption } from "../quotation-contract";
import type { QuotationCustomersState } from "../hooks/useQuotationCustomers";
import { useQuotationCustomerPicker } from "../hooks/useQuotationDialogs";
import { quotationPartyInitials } from "../quotation-editor-values";

export interface QuotationCustomerSelectProps {
  customers: QuotationCustomersState; selected: QuotationCustomerOption | null;
  onSelect: (partyId: string | undefined) => void; disabled?: boolean;
}

export function QuotationCustomerSelect({ customers, selected, onSelect, disabled = false }: QuotationCustomerSelectProps) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const picker = useQuotationCustomerPicker();
  return <div className="space-y-2">
    <span className="text-sm font-medium text-muted-foreground">{t.tradeDocuments.customer} <span className="text-destructive">*</span></span>
    <Button variant="ghost" size="lg" className="h-auto min-h-14 w-full justify-between gap-3 whitespace-normal px-0 py-1 text-start disabled:opacity-100"
      aria-label={selected ? `${t.tradeDocuments.customer}: ${selected.displayName}` : copy.chooseCustomer} aria-haspopup="dialog" disabled={disabled} onClick={() => picker.setOpen(true)}>
      <span className="flex min-w-0 items-center gap-3"><Avatar className="size-12"><AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">{selected ? quotationPartyInitials(selected.displayName) : <UserRound className="size-5" aria-hidden="true" />}</AvatarFallback></Avatar>
        <span className="min-w-0 space-y-1"><span className="block truncate text-base font-semibold">{selected?.displayName ?? copy.chooseCustomer}</span>
          {selected ? <span className="block text-sm font-normal text-muted-foreground">{selected.eligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT" ? copy.activeAccount : copy.crmProspect}</span> : null}</span></span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
    <Dialog open={picker.open} onOpenChange={picker.setOpen}>
      <DialogContent size="2xl" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{copy.customerPickerTitle}</DialogTitle><DialogDescription>{copy.customerPickerDescription}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label={copy.customerSearch}><div className="relative"><Search className="pointer-events-none absolute start-3 top-2 size-4 text-muted-foreground" aria-hidden="true" /><Input size="md" className="ps-9" value={customers.search} maxLength={160} onChange={(event) => customers.setSearch(event.target.value)} /></div></Field>
          {customers.error?.status === 403 ? <PermissionGate require="trade.quotations.create" denied>{null}</PermissionGate>
            : customers.error ? <div role="alert" className="space-y-2"><DegradedBanner message={tradeDocumentMessage(customers.error.code, t.tradeDocuments.errors) ?? copy.customerUnavailable} /><Button variant="outline" onClick={customers.retry}>{t.common.retry}</Button></div> : null}
          {customers.isLoading ? <p role="status" className="p-4 text-sm text-muted-foreground">{t.common.loading}</p> : null}
          <div className="divide-y divide-border rounded-lg border border-border">
            {!customers.error ? customers.options.map((option) => <Button key={option.partyId} variant="ghost" size="sm"
              disabled={!option.quotationSelectable} className="h-auto w-full justify-between gap-3 rounded-none p-3 text-start"
              aria-pressed={selected?.partyId === option.partyId}
              onClick={() => { onSelect(option.partyId); picker.setOpen(false); }}>
              <span className="min-w-0 space-y-1"><span className="block truncate text-sm font-medium">{option.displayName}</span>
                <span className="block text-xs text-muted-foreground">{!option.quotationSelectable ? copy.accountBlocked : option.eligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT" ? copy.activeAccount : copy.crmProspect}</span></span>
              {selected?.partyId === option.partyId ? <Check className="size-4 text-primary" aria-hidden="true" /> : !option.quotationSelectable ? <Badge tone="caution" size="sm">{copy.accountBlocked}</Badge> : null}
            </Button>) : null}
            {!customers.error && !customers.isLoading && customers.options.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{copy.customerNoResults}</p> : null}
          </div>
          {!customers.error && customers.hasMore ? <Button variant="outline" loading={customers.isLoading} onClick={customers.loadMore}>{t.tradeDocuments.quotations.customerMore}</Button> : null}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
