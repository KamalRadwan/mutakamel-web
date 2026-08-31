"use client";

import { Building2, Mail, Phone, User } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ContactMethodType } from "../directory-children-contract";
import type { Party } from "../directory-contract";

/** The first primary value of a type, else the first of that type at all. */
function preferredContact(party: Party, type: ContactMethodType) {
  const matching = party.contactMethods.filter((method) => method.methodType === type);
  return matching.find((method) => method.isPrimary) ?? matching[0];
}

export function PartyCard({ party }: { party: Party }) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const email = preferredContact(party, "EMAIL");
  const phone = preferredContact(party, "MOBILE") ?? preferredContact(party, "PHONE");
  const Icon = party.partyType === "ORGANIZATION" ? Building2 : User;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{party.displayName}</span>
        </span>
        <Badge tone={party.status === "ACTIVE" ? "positive" : "neutral"}>
          {copy.partyStatuses[party.status]}
        </Badge>
      </div>

      {party.legalName ? (
        <span className="text-xs text-muted-foreground">{party.legalName}</span>
      ) : null}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {email ? (
          <span className="flex items-center gap-1.5">
            <Mail className="size-3.5" aria-hidden="true" />
            <span dir="ltr">{email.value}</span>
          </span>
        ) : null}
        {phone ? (
          <span className="flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden="true" />
            <span dir="ltr">{phone.value}</span>
          </span>
        ) : null}
      </div>

      {party.roles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {party.roles.slice(0, 3).map((role) => (
            <Badge key={role.id} tone="neutral">
              {copy.roleTypes[role.roleType]}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
