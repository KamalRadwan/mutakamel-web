"use client";

import { Check, CircleAlert, Clock } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OutboundEmailStatus } from "../outbound-email-contract";

export function EmailStatusBadge({ status }: { status: OutboundEmailStatus }) {
  const { t } = useI18n();
  const Icon = status === "SENT" ? Check : status === "FAILED" ? CircleAlert : Clock;
  return <Badge tone={status === "SENT" ? "positive" : status === "FAILED" ? "negative" : "caution"}>
    <Icon className="size-3.5" aria-hidden="true" />{t.crmOutboundEmails.statusValues[status]}
  </Badge>;
}
