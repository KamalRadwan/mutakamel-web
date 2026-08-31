"use client";

import Link from "next/link";
import { Building2, Eye, UserRound } from "lucide-react";
import { Badge, Button, StatusBadge, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";

// The table's column set. Headers arrive translated — DataTable never touches
// the dictionary. See docs/design/patterns.md#datatable.
export function useCustomerProfileColumns(): ColumnDef<CustomerProfileItem>[] {
  const { t } = useI18n();

  return [
    {
      id: "name",
      header: t.crmCustomerProfiles.name,
      cell: (item) => {
        const ProfileIcon = item.profileType === "CORPORATE" ? Building2 : UserRound;
        return (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
              <ProfileIcon className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">{item.displayName}</p>
              {item.companyName && item.companyName !== item.displayName && (
                <p className="text-2xs text-muted-foreground">{item.companyName}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "type",
      header: t.crmCustomerProfiles.type,
      cell: (item) => (
        <Badge tone="neutral">{t.crmCustomerProfiles.profileTypes[item.profileType] ?? item.profileType}</Badge>
      ),
    },
    {
      id: "contact",
      header: t.crmCustomerProfiles.contact,
      cell: (item) => (
        <div dir="ltr">
          <p>{item.email ?? t.crmCustomerProfiles.unavailable}</p>
          {item.phone && <p className="text-2xs text-muted-foreground">{item.phone}</p>}
        </div>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (item) => <StatusBadge value={item.status} kind="CustomerStatus" />,
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) => (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
            aria-label={`${t.common.actions}: ${item.displayName}`}
          >
            <Eye className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ),
    },
  ];
}
