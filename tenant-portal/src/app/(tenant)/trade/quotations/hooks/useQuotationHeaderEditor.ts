"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import { TRADE_ACTION_RESPONSE_BYTES, TRADE_DRAFT_REFERENCE_MAX_LENGTH, tradeDocumentPath } from "../../documents/trade-document-contract";
import { tradeIfMatch, tradePatch } from "../../trade-api";
import { QUOTATIONS_PATH, buildUpdateQuotationHeader, type QuotationDetail } from "../quotation-contract";
import type { QuotationContactOption } from "../quotation-contact-contract";
import { useQuotationContacts } from "./useQuotationContacts";

export interface QuotationHeaderEditorOptions {
  open: boolean; onOpenChange: (open: boolean) => void; quotation: QuotationDetail;
  headers: Record<string, string>; onSaved: () => Promise<void>;
}

/** Existing header changes pin version/scope and never resend an unchanged contact. */
export function useQuotationHeaderEditor({ open, onOpenChange, quotation, headers, onSaved }: QuotationHeaderEditorOptions) {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [draftReference, setReference] = useState(quotation.draftReference ?? "");
  const [contactPartyId, setContactId] = useState(quotation.contactPartyId ?? "");
  const [chosenContact, setChosenContact] = useState<QuotationContactOption | null>(null);
  const contacts = useQuotationContacts({ headers, partyId: quotation.partyId, partyType: null, enabled: open });
  const originalContact = quotation.contactPartyId ?? "";
  const referenceChanged = draftReference.trim() !== (quotation.draftReference ?? "").trim();
  const contactChanged = contactPartyId !== originalContact;
  const selectedContact = chosenContact?.partyId === contactPartyId ? chosenContact
    : contacts.options.find((option) => option.partyId === contactPartyId) ?? null;
  const contactValid = !contactChanged || contactPartyId === "" || (contacts.partyType === "ORGANIZATION" && selectedContact !== null);
  const isDirty = referenceChanged || contactChanged;
  const canSubmit = isDirty && contactValid && draftReference.trim().length <= TRADE_DRAFT_REFERENCE_MAX_LENGTH && !write.isBlocked;

  return { t, write, contacts, draftReference, contactPartyId, selectedContact, isDirty, canSubmit, contactValid,
    changeOpen: (next: boolean) => { if (!write.isBlocked) onOpenChange(next); },
    setDraftReference: (value: string) => { if (!write.isBlocked) setReference(value); },
    selectContact: (id: string | undefined) => {
      if (write.isBlocked) return;
      const selected = id ? contacts.options.find((option) => option.partyId === id) : null;
      if (id && id !== originalContact && (contacts.partyType !== "ORGANIZATION" || !selected)) return;
      setContactId(id ?? ""); setChosenContact(selected ?? null);
    },
    submit: async () => {
      if (!canSubmit) return;
      const payload = buildUpdateQuotationHeader({
        ...(referenceChanged ? { draftReference } : {}), ...(contactChanged ? { contactPartyId } : {}),
      });
      const scope = { ...headers };
      await write.runWrite({
        operation: t.tradeDocuments.quotations.editHeaderModalTitle,
        send: (idempotency) => tradePatch(tradeDocumentPath(QUOTATIONS_PATH, quotation.id), payload, {
          headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(quotation.version) }, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        }),
        onSuccess: async () => { onOpenChange(false); await onSaved(); },
      });
    },
  };
}
