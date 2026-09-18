"use client";

import { useId } from "react";
import { BriefcaseBusiness, Mail, Plus, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type {
  CustomerProfileContact,
  CustomerProfileDetail,
} from "../../customer-profile-contract";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";

export interface CustomerContactsCardProps {
  profile: CustomerProfileDetail;
  canEdit: boolean;
  onAddContact?: () => void;
}

export function CustomerContactsCard({
  profile,
  canEdit,
  onAddContact,
}: CustomerContactsCardProps) {
  const { t } = useI18n();
  const headingId = useId();
  const isCorporate = profile.profileType === "CORPORATE";

  return (
    <Card role="region" aria-labelledby={headingId} className="w-full min-w-0">
      <CardHeader className="flex-row items-center justify-between gap-2 p-2">
        <h2
          id={headingId}
          className="text-sm font-semibold leading-none text-card-foreground"
        >
          {t.crmLeads.create.sections.contacts}
        </h2>
        {isCorporate && canEdit && onAddContact && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-primary"
            onClick={onAddContact}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>{t.crmCustomerProfileActions.addContact}</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 items-start gap-2 p-2 sm:grid-cols-2">
        {isCorporate ? (
          profile.contacts.length > 0 ? (
            profile.contacts.map((contact) => (
              <ContactCard
                key={contact.partyId}
                contact={contact}
                country={profile.address?.country ?? undefined}
              />
            ))
          ) : (
            <p className="col-span-full text-xs text-muted-foreground">
              {t.crmLeadDetail.contactsEmpty}
            </p>
          )
        ) : (
          <IndividualContact profile={profile} />
        )}
      </CardContent>
    </Card>
  );
}

function ContactCard({
  contact,
  country,
}: {
  contact: CustomerProfileContact;
  country?: string;
}) {
  const { t } = useI18n();
  return (
    <Card className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-1.5 p-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserRound
            className={cn(
              iconSize({ size: "sm" }),
              "shrink-0 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {contact.displayName}
          </span>
          {contact.isPrimary && (
            <Badge tone="brand">{t.crmLeadDetail.primaryContact}</Badge>
          )}
        </div>

        {contact.jobTitle && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <BriefcaseBusiness
              className={cn(iconSize({ size: "sm" }), "shrink-0")}
              aria-hidden="true"
            />
            <span className="truncate">{contact.jobTitle}</span>
          </div>
        )}

        {contact.email && (
          <a
            href={"mailto:" + contact.email}
            className="flex min-w-0 items-center gap-1.5 rounded-xs text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            dir="ltr"
          >
            <Mail
              className={cn(iconSize({ size: "sm" }), "shrink-0")}
              aria-hidden="true"
            />
            <span className="truncate">{contact.email}</span>
          </a>
        )}

        {contact.phones.map((phone) => (
          <CustomerPhoneActionsRow
            key={phone}
            phone={phone}
            country={country}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function IndividualContact({ profile }: { profile: CustomerProfileDetail }) {
  const { t } = useI18n();
  const phones = [profile.primaryMobile, ...profile.phones].filter(
    (phone, index, values): phone is string =>
      Boolean(phone) && values.indexOf(phone) === index,
  );
  const individual: CustomerProfileContact = {
    partyId: profile.partyId,
    relationshipId: null,
    displayName: profile.displayName,
    firstName: null,
    lastName: null,
    honorificTitle: null,
    jobTitle: null,
    isPrimary: true,
    email: profile.email,
    phones,
  };

  return (
    <div className="col-span-full">
      <ContactCard
        contact={individual}
        country={profile.address?.country ?? undefined}
      />
      {phones.length === 0 && !profile.email && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t.detail.notRecorded}
        </p>
      )}
    </div>
  );
}
