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
import { Badge, cn, SWATCH_SURFACE_PALETTES, type SwatchHue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export type InventoryModuleKey =
  | "availability"
  | "nodes"
  | "periods"
  | "uomConversions"
  | "movements"
  | "serials"
  | "decisions";

interface InventoryModuleSubnavProps {
  active: InventoryModuleKey;
  scopeBadge?: string;
}

const MODULE_ITEMS: Array<{
  key: InventoryModuleKey;
  href: string;
  hue: SwatchHue;
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
    hue: "indigo",
    Icon: Boxes,
    labelKey: "availabilityTitle",
  },
  {
    key: "nodes",
    href: "/trade/inventory/nodes",
    hue: "teal",
    Icon: Warehouse,
    labelKey: "nodesTitle",
  },
  {
    key: "periods",
    href: "/trade/inventory/periods",
    hue: "green",
    Icon: CalendarRange,
    labelKey: "periodsTitle",
  },
  {
    key: "uomConversions",
    href: "/trade/inventory/uom-conversions",
    hue: "amber",
    Icon: ArrowLeftRight,
    labelKey: "conversionsTitle",
  },
  {
    key: "movements",
    href: "/trade/inventory/movements",
    hue: "purple",
    Icon: Activity,
    labelKey: "movementsTitle",
  },
  {
    key: "serials",
    href: "/trade/inventory/serials",
    hue: "blue",
    Icon: Barcode,
    labelKey: "serialsTitle",
  },
  {
    key: "decisions",
    href: "/trade/inventory/decisions",
    hue: "orange",
    Icon: ShieldCheck,
    labelKey: "decisionsTitle",
  },
];

export function InventoryModuleSubnav({ active, scopeBadge }: InventoryModuleSubnavProps) {
  const { t } = useI18n();
  const inv = t.tradeInventory;

  return (
    <nav
      aria-label={t.nav.inventory}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-2xs"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {MODULE_ITEMS.map(({ key, href, hue, Icon, labelKey }) => {
          const isCurrent = key === active;
          const palette = SWATCH_SURFACE_PALETTES[hue];
          return (
            <Link
              key={key}
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                isCurrent
                  ? palette.pillActive
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-md border",
                  isCurrent ? palette.iconBoxActive : palette.iconBoxIdle,
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
              </span>
              <span>{inv[labelKey]}</span>
            </Link>
          );
        })}
      </div>
      {scopeBadge ? (
        <Badge tone="brand" className="font-mono text-2xs">
          {scopeBadge}
        </Badge>
      ) : null}
    </nav>
  );
}
