"use client";

import { Ban } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { FenceScreen } from "../components/FenceScreen";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

/**
 * Where a `403 ACCESS_POLICY_BLOCKED` from `SubscriptionEnforcementGuard` lands.
 *
 * The mode itself is not client-readable for a non-owner today — `/auth/me`
 * carries no `accessMode` and `/billing/summary` is owner-only, recorded as Q16
 * in OPEN-QUESTIONS.md — so `useAccessMode()` resolves to null for most users
 * and this screen says what the server refused rather than claiming to know
 * which of the four modes the tenant is in. When the field lands on `/auth/me`,
 * the resolved branch below starts rendering with no other change here.
 */
export default function EntitlementBlockedPage() {
  const { t } = useI18n();
  const { mode, isResolved } = useAccessMode();
  const copy = t.coreIdentity.entitlementBlocked;

  return (
    <FenceScreen
      icon={Ban}
      tone="negative"
      title={copy.title}
      description={copy.description}
      detail={
        <p className="text-xs text-muted-foreground">
          {isResolved && mode ? copy.modes[mode] : copy.modeUnknown}
        </p>
      }
      primaryAction={{ label: copy.reviewPlan, href: TENANT_ROUTES.coreSettings }}
      secondaryAction={{ label: copy.backToWorkspace, href: TENANT_ROUTES.home }}
    />
  );
}
