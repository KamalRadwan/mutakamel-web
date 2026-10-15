"use client";

import { Check, Pencil, X } from "lucide-react";
import { Button, Input, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { LeadInlinePhone } from "../../hooks/useLeadInlinePhone";
import type { LeadItem } from "../../hooks/useLeads";
import { leadEditablePrimaryPhone } from "../../lead-phone-patch";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";

export interface LeadPhoneCellProps {
  lead: LeadItem;
  canEdit: boolean;
  editor: LeadInlinePhone;
}

/** The lead's primary number with its call actions, edited in place. */
export function LeadPhoneCell({ lead, canEdit, editor }: LeadPhoneCellProps) {
  const { t } = useI18n();
  const name = { name: lead.leadName };

  if (editor.editingLeadId === lead.id) {
    return (
      <span className="flex min-w-48 items-center gap-1">
        <Input
          size="xs"
          dir="ltr"
          type="tel"
          autoFocus
          value={editor.draft}
          aria-label={formatTemplate(t.crmLeadViews.phoneInput, name)}
          onChange={(event) => editor.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") editor.commit(lead);
            if (event.key === "Escape") editor.cancel();
          }}
          className="w-36"
        />
        <Button variant="ghost" size="xs" className="w-7 px-0" aria-label={t.common.save} onClick={() => editor.commit(lead)}>
          <Check className={iconSize({ size: "sm" })} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="xs" className="w-7 px-0" aria-label={t.common.cancel} onClick={editor.cancel}>
          <X className={iconSize({ size: "sm" })} aria-hidden="true" />
        </Button>
      </span>
    );
  }

  const phone = leadEditablePrimaryPhone(lead) || lead.phone || lead.phones[0];

  return (
    <span className="flex min-w-48 items-center gap-1 whitespace-nowrap">
      {phone && <LeadPhoneActionsRow phone={phone} country={lead.country} />}
      {!phone && <span className="text-muted-foreground">{t.crmLeads.unavailable}</span>}
      {canEdit && (
        <Button
          variant="ghost"
          size="xs"
          className="ms-auto w-7 shrink-0 px-0"
          aria-label={formatTemplate(t.crmLeadViews.editPhone, name)}
          title={formatTemplate(t.crmLeadViews.editPhone, name)}
          onClick={() => editor.start(lead)}
        >
          <Pencil className={iconSize({ size: "sm" })} aria-hidden="true" />
        </Button>
      )}
    </span>
  );
}
