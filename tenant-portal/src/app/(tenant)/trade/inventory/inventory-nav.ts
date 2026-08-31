import { Boxes, CalendarRange, Gavel, Ruler, ScanBarcode, Truck, Warehouse } from "lucide-react";
import type { NavItem } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  INVENTORY_GOVERNANCE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  INVENTORY_RESERVE_PERMISSION,
} from "./inventory-contract";

// The seven inventory screens' second-level bar.
//
// Built here rather than in `nav-config.ts` because only the sidebar's
// top-level Trade entries belong in the shared file; `SubNav` takes any
// NavItem[]. `hasAccess` mirrors the controller's @RequireTradeAccess
// permission for each screen's read route — a screen the sidebar hides must
// not stay linked here (SubNav.tsx).
export const TRADE_INVENTORY_NAV_ITEMS: NavItem[] = [
  {
    id: "tradeInventoryAvailability",
    labelKey: "tradeInventoryAvailability",
    href: TENANT_ROUTES.tradeInventory,
    icon: Boxes,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
  {
    id: "tradeInventoryNodes",
    labelKey: "tradeInventoryNodes",
    href: TENANT_ROUTES.tradeInventoryNodes,
    icon: Warehouse,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
  {
    id: "tradeInventoryPeriods",
    labelKey: "tradeInventoryPeriods",
    href: TENANT_ROUTES.tradeInventoryPeriods,
    icon: CalendarRange,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
  {
    id: "tradeInventoryUomConversions",
    labelKey: "tradeInventoryUomConversions",
    href: TENANT_ROUTES.tradeInventoryUomConversions,
    icon: Ruler,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
  {
    id: "tradeInventoryMovements",
    labelKey: "tradeInventoryMovements",
    href: TENANT_ROUTES.tradeInventoryMovements,
    icon: Truck,
    // Movements have no read route at all (Q37) — the screen is write-only, so
    // its admission is a write grant, never `trade.inventory.read`.
    hasAccess: (permissions) =>
      permissions.includes(INVENTORY_RESERVE_PERMISSION) ||
      permissions.includes(INVENTORY_GOVERNANCE_PERMISSION),
  },
  {
    id: "tradeInventorySerials",
    labelKey: "tradeInventorySerials",
    href: TENANT_ROUTES.tradeInventorySerials,
    icon: ScanBarcode,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
  {
    id: "tradeInventoryDecisions",
    labelKey: "tradeInventoryDecisions",
    href: TENANT_ROUTES.tradeInventoryDecisions,
    icon: Gavel,
    hasAccess: (permissions) => permissions.includes(INVENTORY_READ_PERMISSION),
  },
];
