"use client";

import { Wrench } from "lucide-react";
import { useConnectivity } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { FenceScreen } from "../components/FenceScreen";

/**
 * The maintenance fence, driven by the realtime layer's own two signals.
 *
 * `useConnectivity` is the single subscriber to `server-draining` and
 * `permanent-stop` (`TenantRealtimeProvider` dispatches both on `window`), so
 * this screen reads the live state rather than a flag someone has to remember
 * to set. `stopReason` is a wire value with no client-side mapping — it renders
 * verbatim in monospace, the same way an unmapped enum does, so a reason nobody
 * has seen before is visible instead of swallowed.
 */
export default function MaintenancePage() {
  const { t } = useI18n();
  const { status, stopReason } = useConnectivity();
  const copy = t.coreIdentity.maintenance;

  const description =
    status === "stopped"
      ? copy.stoppedDescription
      : status === "draining"
        ? copy.drainingDescription
        : copy.description;

  return (
    <FenceScreen
      icon={Wrench}
      tone="caution"
      title={copy.title}
      description={description}
      detail={
        stopReason ? (
          <p className="text-xs text-muted-foreground">
            {copy.reasonLabel}: <span className="font-mono">{stopReason}</span>
          </p>
        ) : null
      }
      primaryAction={{ label: copy.backToWorkspace, href: "/" }}
      secondaryAction={{ label: t.hostState.goToLogin, href: "/login" }}
    />
  );
}
