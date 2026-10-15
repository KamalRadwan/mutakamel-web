"use client";

import { Badge, resolveStatusRole, type BadgeProps } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadStage } from "../../hooks/useLeads";

// Only an outcome takes a hue; every open stage stays neutral.
const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

function leadStageTone(stage: LeadStage | undefined): NonNullable<BadgeProps["tone"]> {
  const role = stage && resolveStatusRole("LeadStageFlag", stage.flag);
  return (role && ROLE_TONE[role]) || "neutral";
}

/** The lead's stage name, toned by the stage's outcome flag. */
export function LeadStageBadge({ stage }: { stage: LeadStage | undefined }) {
  const { t, lang } = useI18n();
  return (
    <Badge tone={leadStageTone(stage)} className="whitespace-nowrap">
      {localizedName(stage, lang) || t.crmLeads.unavailable}
    </Badge>
  );
}
