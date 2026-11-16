"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import { EmptyState, PageHeader, PermissionGate, useCan } from "@/design-system";
import { useDictionary } from "@/i18n/useLanguage";
import { EmailConfigWorkspace } from "./components/email-workspace";
import { EmailSuppressionSection } from "./components/EmailSuppressionSection";

export default function EmailConfigPage() {
  const { user } = useTenantAuth();
  const t = useDictionary();
  const canManageSuppression = useCan("workspace.email.manage", { tenantWide: true });
  const canReadConfig = Boolean(user?.permissions?.includes("workspace.email.read"));
  const isOutboundEntitled = user?.featureEntitlements?.["crm.outbound_email"] === true;
  const [suppressionOverlayOpen, setSuppressionOverlayOpen] = useState(false);

  if (!isOutboundEntitled && !canManageSuppression) {
    return (
      <PermissionGate require="workspace.email.read">
        <PageHeader className="sr-only" title={t.coreSettings.emailTitle} />
        <EmptyState
          icon={Mail}
          title={t.coreSettings.emailNotEntitledTitle}
          description={t.coreSettings.emailNotEntitledDescription}
        />
      </PermissionGate>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {isOutboundEntitled ? (
        canManageSuppression && !canReadConfig ? (
          <PageHeader className="sr-only" title={t.coreSettings.emailTitle} />
        ) : (
          <EmailConfigWorkspace hasExternalOverlay={suppressionOverlayOpen} />
        )
      ) : (
        <>
          <PageHeader className="sr-only" title={t.coreSettings.emailTitle} />
          {canReadConfig ? (
            <EmptyState
              icon={Mail}
              title={t.coreSettings.emailNotEntitledTitle}
              description={t.coreSettings.emailNotEntitledDescription}
            />
          ) : null}
        </>
      )}
      <EmailSuppressionSection onOverlayChange={setSuppressionOverlayOpen} />
    </div>
  );
}
