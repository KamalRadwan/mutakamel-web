"use client";

import { Button, DegradedBanner } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export interface DashboardRecoveryProps {
  blocked: boolean; ready: boolean; busy?: boolean; onReload: () => void; onAcknowledge: () => void;
}
export function DashboardRecoveryNotice({ blocked, ready, busy, onReload, onAcknowledge }: DashboardRecoveryProps) {
  const { t } = useI18n();
  if (!blocked) return null;
  return <div className="flex flex-col items-start gap-2">
    <DegradedBanner message={ready ? t.crmDashboards.review.ready : t.crmDashboards.review.uncertain} />
    <Button variant="outline" disabled={busy} onClick={ready ? onAcknowledge : onReload}>
      {ready ? t.crmDashboards.review.acknowledge : t.crmDashboards.review.checkLatest}
    </Button>
  </div>;
}
