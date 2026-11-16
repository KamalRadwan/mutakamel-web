"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeftRight,
  Barcode,
  Boxes,
  CalendarRange,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

type InventoryModuleKey =
  | "availability"
  | "nodes"
  | "periods"
  | "uomConversions"
  | "movements"
  | "serials"
  | "decisions";

interface InventoryModuleSubnavProps {
  active: InventoryModuleKey;
}

const MODULE_ITEMS: Array<{
  key: InventoryModuleKey;
  href: string;
  Icon: typeof Boxes;
  labelKey:
    | "availabilityTitle"
    | "nodesTitle"
    | "periodsTitle"
    | "conversionsTitle"
    | "movementsTitle"
    | "serialsTitle"
    | "decisionsTitle";
}> = [
  {
    key: "availability",
    href: "/trade/inventory",
    Icon: Boxes,
    labelKey: "availabilityTitle",
  },
  {
    key: "nodes",
    href: "/trade/inventory/nodes",
    Icon: Warehouse,
    labelKey: "nodesTitle",
  },
  {
    key: "periods",
    href: "/trade/inventory/periods",
    Icon: CalendarRange,
    labelKey: "periodsTitle",
  },
  {
    key: "uomConversions",
    href: "/trade/inventory/uom-conversions",
    Icon: ArrowLeftRight,
    labelKey: "conversionsTitle",
  },
  {
    key: "movements",
    href: "/trade/inventory/movements",
    Icon: Activity,
    labelKey: "movementsTitle",
  },
  {
    key: "serials",
    href: "/trade/inventory/serials",
    Icon: Barcode,
    labelKey: "serialsTitle",
  },
  {
    key: "decisions",
    href: "/trade/inventory/decisions",
    Icon: ShieldCheck,
    labelKey: "decisionsTitle",
  },
];

export function InventoryModuleSubnav({ active }: InventoryModuleSubnavProps) {
  const { t } = useI18n();
  const inv = t.tradeInventory;

  return (
    <nav
      aria-label={t.nav.inventory}
      className="overflow-x-auto border-b border-border bg-card"
    >
      <div className="flex min-w-max items-center gap-1 px-2">
        {MODULE_ITEMS.map(({ key, href, Icon, labelKey }) => {
          const isCurrent = key === active;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isCurrent
                  ? "border-primary bg-info-subtle/30 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{inv[labelKey]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
