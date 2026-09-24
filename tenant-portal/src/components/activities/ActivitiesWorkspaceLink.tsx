"use client";

import { ListChecks } from "lucide-react";
import { WorkspaceLink } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES, canAccessCrmRoute } from "@/lib/navigation/tenant-routes";
import { activitiesWorkspaceTypeHref } from "./workspace/activity-workspace-url";

type RecordListType = "LEAD" | "CUSTOMER_PROFILE" | "OPPORTUNITY";

/**
 * A record list's jump to the Activities workspace, narrowed to that list's own
 * record type — placed after the list's view switcher.
 *
 * Admitted by the same rule as the CRM nav's Activities item, so the icon is
 * absent rather than a link to a refusal. `ListChecks` is the Activities glyph
 * the nav already uses: one glyph per concept (docs/design/icons.md).
 */
export function ActivitiesWorkspaceLink({ type }: { type: RecordListType }) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  if (!canAccessCrmRoute(user?.permissions ?? [], TENANT_ROUTES.crmActivities)) return null;
  return (
    <WorkspaceLink
      href={activitiesWorkspaceTypeHref("CRM", { app: "CRM", type })}
      label={t.activities.workspaceLinks[type]}
      icon={ListChecks}
    />
  );
}
