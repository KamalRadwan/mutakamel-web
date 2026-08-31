"use client";

import { UserX } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { FenceScreen } from "../components/FenceScreen";

/**
 * `SESSION_IDENTITY_INACTIVE`, and the DEACTIVATED user behind it.
 *
 * Distinct from `/session-expired` because signing in again cannot help: the
 * account itself is SUSPENDED or DEACTIVATED, and only an administrator's
 * `POST /users/:id/activate` re-admits a suspended one. Deactivation is a
 * fourth status with no self-service path at all.
 */
export default function AccountSuspendedPage() {
  const { t } = useI18n();
  const copy = t.coreIdentity.accountSuspended;

  return (
    <FenceScreen
      icon={UserX}
      tone="negative"
      title={copy.title}
      description={copy.description}
      detail={<p className="text-xs text-muted-foreground">{copy.contactAdmin}</p>}
      primaryAction={{ label: copy.backToSignIn, href: "/login" }}
    />
  );
}
