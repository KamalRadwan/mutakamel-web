"use client";

import type { ReactNode } from "react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { useLeadBoardCardDetail } from "../../hooks/useLeadBoardCardDetail";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";
import {
  CONTACTS_SHOWN,
  companyPhones,
  corporateContacts,
  individualPhones,
} from "./lead-board-contacts";

function PhoneList({ label, phones, country }: { label: string; phones: string[]; country: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-medium text-muted-foreground">{label}</span>
      {phones.map((phone) => (
        <LeadPhoneActionsRow key={phone} phone={phone} country={country} />
      ))}
      {phones.length === 0 && <span className="text-xs text-muted-foreground">{t.crmLeads.unavailable}</span>}
    </div>
  );
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-2xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 text-xs text-foreground">{children}</dd>
    </div>
  );
}

/** The expanded card's body: the numbers to reach the lead on, who owns it, where it came from. */
export function LeadBoardCardDetails({ lead }: { lead: LeadItem }) {
  const { t, lang } = useI18n();
  const board = t.crmLeadBoard;
  const detail = useLeadBoardCardDetail(lead.id);
  const contacts = corporateContacts(lead, detail);
  const source = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang);
  const owner = [lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {lead.leadProfileType === "INDIVIDUAL" && (
        <PhoneList label={board.phones} phones={individualPhones(lead, detail)} country={lead.country} />
      )}
      {lead.leadProfileType === "CORPORATE" && (
        <>
          <PhoneList
            label={t.crmLeadDetail.companyPhone}
            phones={companyPhones(lead, detail)}
            country={lead.country}
          />
          {contacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs font-medium text-muted-foreground">
                {formatTemplate(board.contacts, {
                  shown: Math.min(contacts.length, CONTACTS_SHOWN),
                  total: contacts.length,
                })}
              </span>
              {contacts.slice(0, CONTACTS_SHOWN).map((contact) => (
                <div key={contact.partyId} className="flex flex-col gap-0.5 rounded-sm bg-muted p-1.5">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="truncate font-medium text-foreground">{contact.displayName}</span>
                    {contact.jobTitle && (
                      <span className="truncate text-muted-foreground">{contact.jobTitle}</span>
                    )}
                    {contact.isPrimary && (
                      <Badge tone="neutral" className="ms-auto shrink-0">
                        {t.crmLeads.card.primary}
                      </Badge>
                    )}
                  </div>
                  {contact.phones.map((phone) => (
                    <LeadPhoneActionsRow key={phone} phone={phone} country={lead.country} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <dl className="grid grid-cols-2 gap-2">
        <DetailValue label={t.crmLeads.salesperson}>
          <span className="truncate">{owner || t.crmLeads.unavailable}</span>
        </DetailValue>
        <DetailValue label={t.crmLeads.source}>
          {source && <AcquisitionSourceIcon source={{ iconUrl: lead.sourceIconUrl }} />}
          <span className="truncate">{source || t.crmLeads.unavailable}</span>
        </DetailValue>
      </dl>
    </div>
  );
}
