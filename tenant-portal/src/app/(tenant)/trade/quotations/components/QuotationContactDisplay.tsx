"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useQuotationContactDisplay } from "../hooks/useQuotationContactDisplay";

/** Read-only contact identity; unresolved associations never expose a raw UUID. */
export function QuotationContactDisplay({ partyId, contactPartyId, headers }: {
  partyId: string; contactPartyId: string | null; headers: Record<string, string>;
}) {
  const { t } = useI18n();
  const { contact, isLoading } = useQuotationContactDisplay(partyId, contactPartyId, headers);
  if (!contactPartyId) return <span className="text-muted-foreground">{t.tradeDocuments.notRecorded}</span>;
  if (contact) return <span>{contact.displayName}</span>;
  return <span className="text-muted-foreground">{isLoading ? t.common.loading : t.quotationExperience.contactUnavailable}</span>;
}
