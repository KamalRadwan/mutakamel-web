"use client";

import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { QuotationContactPicker } from "./QuotationContactPicker";

export function QuotationContactSelect({ composer, disabled = false }: { composer: QuotationComposerState; disabled?: boolean }) {
  if (composer.selected?.partyType !== "ORGANIZATION") return null;
  return <QuotationContactPicker compact contacts={composer.contacts} selectedContact={composer.selectedContact}
    selectedId={composer.contactPartyId} onSelect={composer.selectContact} error={composer.contactPartyError}
    disabled={disabled || composer.partialHeader !== null || composer.mode === "saved" || composer.write.isBlocked || composer.savingStep !== "idle"} />;
}
