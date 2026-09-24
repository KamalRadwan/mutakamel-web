"use client";

import { IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Activity } from "../activity-contract";

/**
 * Who an activity is assigned to: "Me" for the viewer, the name Core joined in,
 * and otherwise the honest identifier — never a name made up from the id
 * (docs/design/patterns.md#when-the-api-gives-you-an-id-and-no-name).
 */
export function ActivityAssigneeName({ activity, actorId }: { activity: Activity; actorId: string | null }) {
  const { t } = useI18n();
  if (activity.assigneeUserId === actorId) return <span>{t.activities.form.assigneeMe}</span>;
  if (activity.assigneeName) return <bdi className="truncate">{activity.assigneeName}</bdi>;
  return <IdentifierText>{activity.assigneeUserId}</IdentifierText>;
}
