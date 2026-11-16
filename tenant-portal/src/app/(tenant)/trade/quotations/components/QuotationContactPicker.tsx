"use client";

import { UserRound } from "lucide-react";
import { Button, Combobox, Field } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { QuotationContactsState } from "../hooks/useQuotationContacts";
import type { QuotationContactOption } from "../quotation-contact-contract";

const NO_CONTACT = "__none__";

export function QuotationContactPicker({ contacts, selectedContact, selectedId, onSelect, disabled = false, compact = false, error }: {
  contacts: QuotationContactsState; selectedContact: QuotationContactOption | null;
  selectedId?: string; onSelect: (id: string | undefined) => void; disabled?: boolean; compact?: boolean; error?: string;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  if (contacts.partyType === "PERSON") return null;
  const id = selectedId || selectedContact?.partyId;
  const roles = { CONTACT_PERSON: copy.contactPersonRole, BILLING_CONTACT: copy.contactBillingRole, LEGAL_CONTACT: copy.contactLegalRole };
  const options = contacts.options.map((contact) => ({ value: contact.partyId, label: contact.displayName,
    description: [contact.relationshipLabel || roles[contact.relationshipType], contact.isPrimary ? copy.contactPrimary : null,
      contact.email, contact.mobile || contact.phone].filter(Boolean).join(" · ") }));
  const unavailable = contacts.error?.status === 403 ? copy.contactsDenied
    : tradeDocumentMessage(contacts.error?.code, t.tradeDocuments.errors) ?? copy.contactsUnavailable;
  const emptyLabel = contacts.search.trim() ? copy.contactsNoResults : copy.contactsEmpty;
  const selectedLabel = selectedContact?.displayName ?? (contacts.isLoading ? copy.contactsLoading
    : id || contacts.error ? copy.contactUnavailable : copy.contactNone);

  return <div className="min-w-0 space-y-2">
    <Field label={copy.contactLabel} hint={copy.contactHint} error={error} showLabel>
      <Combobox size={compact ? "sm" : "md"} textSize={compact ? "compact" : undefined}
        value={id ?? NO_CONTACT} selectedLabel={selectedLabel}
        selectedDescription={!compact && selectedContact ? [selectedContact.email, selectedContact.mobile || selectedContact.phone].filter(Boolean).join(" · ") : undefined}
        options={id || options.length ? [{ value: NO_CONTACT, label: copy.contactNone }, ...options] : []} onSearch={contacts.setSearch}
        onValueChange={(value) => onSelect(value === NO_CONTACT ? undefined : value)} loading={contacts.isLoading} disabled={disabled}
        placeholder={copy.contactPlaceholder} searchPlaceholder={copy.contactSearch} loadingLabel={copy.contactsLoading}
        emptyLabel={emptyLabel} clearLabel={id ? copy.contactClear : undefined}
        leadingSlot={<UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />} wrapLabels
        popoverClassName="min-w-52"
        errorContent={contacts.error ? <div className="space-y-2 p-2 text-xs"><p>{unavailable}</p>
          {id ? <Button variant="outline" size="xs" disabled={disabled} onClick={() => onSelect(undefined)}>{copy.contactNone}</Button> : null}</div> : undefined}
        footer={contacts.hasMore ? <Button variant="ghost" size="sm" loading={contacts.isLoading} onClick={contacts.loadMore}>{copy.contactMore}</Button> : undefined} />
    </Field>
    {contacts.error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-kpi-rated-line bg-kpi-rated-surface p-3 text-sm text-kpi-rated-text">
      <p>{unavailable}</p>{contacts.error.status !== 403 ? <Button variant="outline" size="sm" loading={contacts.isLoading} onClick={contacts.retry}>{t.common.retry}</Button> : null}
    </div> : contacts.enabled && !contacts.isLoading && contacts.options.length === 0 ? <p role="status" className="text-xs text-muted-foreground">{emptyLabel}</p> : null}
  </div>;
}
