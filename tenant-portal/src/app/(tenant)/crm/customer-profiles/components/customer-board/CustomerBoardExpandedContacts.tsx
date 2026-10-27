"use client";

import { Building2, UserRound } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmPhoneActionsRow } from "../../../shared/components/CrmPhoneActionsRow";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import type { useCustomerBoardDetail } from "./useCustomerBoardDetail";
export function CustomerBoardExpandedContacts({ item, detail }: {
  item: CustomerProfileItem; detail: ReturnType<typeof useCustomerBoardDetail>;
}) {
  const { t } = useI18n();
  const { isCompany, title, contactName, individualPhones, companyPhones, corporateContacts,
    hasMultipleCorporateContacts, singleCorporateContact, singleCorporateContactPhones } = detail;
  return (<>
      {!isCompany ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t.crmCustomerProfiles.ui.board.phone_numbers_up_to_2}
          </span>
          {individualPhones.length > 0 ? (
            individualPhones.map((ph, idx) => (
              <CrmPhoneActionsRow compact
                key={`ind-ph-${idx}-${ph}`}
                phone={ph}
                country={item.country}
              />
            ))
          ) : (
            <CrmPhoneActionsRow compact phone="" country={item.country} />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Building2
                className="size-3 shrink-0 text-entity-company-fg"
                aria-hidden="true"
              />
              <span>{t.crmCustomerProfiles.ui.board.company_phone}</span>
            </span>
            {companyPhones.length > 0 ? (
              companyPhones.map((ph, idx) => (
                <CrmPhoneActionsRow compact
                  key={`corp-company-ph-${idx}-${ph}`}
                  phone={ph}
                  country={item.country}
                />
              ))
            ) : (
              <CrmPhoneActionsRow compact phone="" country={item.country} />
            )}
          </div>
          {hasMultipleCorporateContacts ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {formatTemplate(
                  t.crmCustomerProfiles.ui.board.contact_count,
                  {
                    Math_min_corporateContacts_length_3: Math.min(
                      corporateContacts.length,
                      3,
                    ),
                    corporateContacts_length: corporateContacts.length,
                  },
                )}
              </span>
              {corporateContacts.slice(0, 3).map((contact, idx) => {
                const firstPhone = contact.phones[0] ?? "";
                return (
                  <div
                    key={contact.partyId || `corp-contact-${idx}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                        <UserRound
                          className="size-3 shrink-0 text-entity-company-fg"
                          aria-hidden="true"
                        />
                        <span className="truncate">{contact.displayName}</span>
                        {contact.jobTitle && (
                          <span className="truncate text-xs font-normal text-muted-foreground">
                            · {contact.jobTitle}
                          </span>
                        )}
                      </span>
                      {contact.isPrimary && (
                        <span className="shrink-0 rounded-xs bg-count-active-surface px-1.5 py-0.5 text-xs font-semibold text-count-active-fg">
                          {t.crmCustomerProfiles.ui.board.primary}
                        </span>
                      )}
                    </div>
                    <CrmPhoneActionsRow compact
                      phone={firstPhone}
                      country={item.country}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-foreground">
                  <UserRound
                    className="size-3 shrink-0 text-entity-company-fg"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {singleCorporateContact?.displayName ||
                      contactName ||
                      item.primaryContact?.displayName ||
                      item.primaryContactName ||
                      title}
                  </span>
                  {(singleCorporateContact?.jobTitle ||
                    item.primaryContact?.jobTitle) && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      ·{" "}
                      {singleCorporateContact?.jobTitle ||
                        item.primaryContact?.jobTitle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-xs bg-count-active-surface px-1.5 py-0.5 text-xs font-semibold text-count-active-fg">
                  {t.crmCustomerProfiles.ui.board.primary}
                </span>
              </div>
              {singleCorporateContactPhones.length > 0 ? (
                singleCorporateContactPhones.map((ph, idx) => (
                  <CrmPhoneActionsRow compact
                    key={`corp-single-ph-${idx}-${ph}`}
                    phone={ph}
                    country={item.country}
                  />
                ))
              ) : (
                <CrmPhoneActionsRow compact phone="" country={item.country} />
              )}
            </div>
          )}
        </>
      )}
  </>);
}
