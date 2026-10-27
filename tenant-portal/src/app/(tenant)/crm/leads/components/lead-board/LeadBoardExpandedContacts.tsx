"use client";

import { Building2, UserRound } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadItem } from "../../lead-list-contract";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";
import type { useLeadBoardExpandedCard } from "./useLeadBoardExpandedCard";

export function LeadBoardExpandedContacts({ lead, details }: {
  lead: LeadItem; details: ReturnType<typeof useLeadBoardExpandedCard>;
}) {
  const { t } = useI18n();
  const { isCompany, title, contactName, individualPhones, companyPhones,
    hasMultipleCorporateContacts, corporateContacts, singleCorporateContact,
    singleCorporateContactPhones } = details;
  return <>
    {!isCompany ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t.crmLeads.executive.phoneNumbers}
        </span>
        {individualPhones.length > 0 ? (
          individualPhones.map((ph, idx) => (
            <LeadPhoneActionsRow
              key={`ind-ph-${idx}-${ph}`}
              phone={ph}
              country={lead.country}
            />
          ))
        ) : (
          <LeadPhoneActionsRow phone="" country={lead.country} />
        )}
      </div>
    ) : (
      <>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3 shrink-0 text-primary" aria-hidden="true" />
            <span>{t.crmLeads.executive.companyPhone}</span>
          </span>
          {companyPhones.length > 0 ? (
            companyPhones.map((ph, idx) => (
              <LeadPhoneActionsRow
                key={`corp-company-ph-${idx}-${ph}`}
                phone={ph}
                country={lead.country}
              />
            ))
          ) : (
            <LeadPhoneActionsRow phone="" country={lead.country} />
          )}
        </div>

        {hasMultipleCorporateContacts ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t.crmLeads.executive.contactsRange(Math.min(corporateContacts.length, 3), corporateContacts.length)}
            </span>
            {corporateContacts.slice(0, 3).map((contact, idx) => {
              const firstPhone = contact.phones[0] ?? "";
              return (
                <div
                  key={contact.partyId || `corp-contact-${idx}`}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-2"
                >
                  <div className="flex items-center justify-between gap-1.5 text-xs">
                    <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                      <UserRound className="size-3 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{contact.displayName}</span>
                      {contact.jobTitle && (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          · {contact.jobTitle}
                        </span>
                      )}
                    </span>
                    {contact.isPrimary && (
                      <span className="shrink-0 rounded-xs bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {t.crmLeads.executive.primary}
                      </span>
                    )}
                  </div>
                  <LeadPhoneActionsRow phone={firstPhone} country={lead.country} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                <UserRound className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">
                  {singleCorporateContact?.displayName ||
                    contactName ||
                    lead.primaryContact?.displayName ||
                    title}
                </span>
                {(singleCorporateContact?.jobTitle || lead.primaryContact?.jobTitle) && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    · {singleCorporateContact?.jobTitle || lead.primaryContact?.jobTitle}
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded-xs bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {t.crmLeads.executive.primary}
              </span>
            </div>
            {singleCorporateContactPhones.length > 0 ? (
              singleCorporateContactPhones.map((ph, idx) => (
                <LeadPhoneActionsRow
                  key={`corp-single-ph-${idx}-${ph}`}
                  phone={ph}
                  country={lead.country}
                />
              ))
            ) : (
              <LeadPhoneActionsRow phone="" country={lead.country} />
            )}
          </div>
        )}
      </>
    )}

  </>;
}
