import { Radio, ScrollText } from "lucide-react";
import type { NavItem } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { WEBHOOK_MANAGE_PERMISSION } from "./webhook-contract";

// Both webhook screens sit behind the same grant: ten of the eleven routes,
// the delivery log included, declare `trade.webhooks.manage`. There is no
// read-only webhook permission to gate the log on separately.
export const TRADE_WEBHOOK_NAV_ITEMS: NavItem[] = [
  {
    id: "tradeWebhookSubscriptions",
    labelKey: "tradeWebhookSubscriptions",
    href: TENANT_ROUTES.tradeWebhooks,
    icon: Radio,
    hasAccess: (permissions) => permissions.includes(WEBHOOK_MANAGE_PERMISSION),
  },
  {
    id: "tradeWebhookDeliveries",
    labelKey: "tradeWebhookDeliveries",
    href: TENANT_ROUTES.tradeWebhookDeliveries,
    icon: ScrollText,
    hasAccess: (permissions) => permissions.includes(WEBHOOK_MANAGE_PERMISSION),
  },
];
