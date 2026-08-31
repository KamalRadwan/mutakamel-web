"use client";

import { Badge, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { Party } from "../directory-contract";

/** The table view's column set. Sortable ids match `PARTY_SORT_FIELDS`. */
export function useDirectoryColumns(): ColumnDef<Party>[] {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.directory;

  return [
    {
      id: "displayName",
      header: copy.columnName,
      sortable: true,
      cell: (party) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{party.displayName}</span>
          {party.legalName ? (
            <span className="text-xs text-muted-foreground">{party.legalName}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "partyType",
      header: copy.columnType,
      cell: (party) => copy.partyTypes[party.partyType],
    },
    {
      id: "roles",
      header: copy.columnRoles,
      cell: (party) =>
        party.roles.length === 0 ? (
          "—"
        ) : (
          <span className="flex flex-wrap gap-1">
            {party.roles.map((role) => (
              <Badge key={role.id} tone="neutral">
                {copy.roleTypes[role.roleType]}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: "contact",
      header: copy.columnContact,
      cell: (party) => {
        const primary =
          party.contactMethods.find((method) => method.isPrimary) ?? party.contactMethods[0];
        return primary ? <span dir="ltr">{primary.value}</span> : "—";
      },
    },
    {
      id: "status",
      header: t.common.status,
      cell: (party) => (
        <Badge tone={party.status === "ACTIVE" ? "positive" : "neutral"}>
          {copy.partyStatuses[party.status]}
        </Badge>
      ),
    },
    {
      id: "updatedAt",
      header: copy.columnUpdated,
      sortable: true,
      cell: (party) => formatDateTime(party.updatedAt, lang),
    },
  ];
}
