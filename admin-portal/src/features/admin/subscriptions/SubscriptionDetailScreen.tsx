"use client";

import Link from "next/link";
import { Button, PageHeader, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TenantBillingPanel } from "../tenant-workspace/billing/components/TenantBillingPanel";
import { useTenantBillingWorkspace } from "../tenant-workspace/billing/hooks/useTenantBillingWorkspace";
import { SUBSCRIPTIONS_COPY } from "./copy";

export function SubscriptionDetailScreen({ tenantId }: { tenantId: string }) {
  const { lang } = useI18n();
  const copy = SUBSCRIPTIONS_COPY[lang];

  return (
    <div className="space-y-3" dir={lang === "ar" ? "rtl" : "ltr"}>
      <PageHeader title={copy.detailTitle} />
      <Button asChild variant="link" size="xs" className="px-0">
        <Link href="/subscriptions">{copy.backToSubscriptions}</Link>
      </Button>
      <PermissionGate permission="admin.subscriptions.read">
        <SubscriptionBillingWorkspace key={tenantId} tenantId={tenantId} />
      </PermissionGate>
    </div>
  );
}

function SubscriptionBillingWorkspace({ tenantId }: { tenantId: string }) {
  const { lang } = useI18n();
  // Billing owns its authorized reads; the tenant-management workspace and
  // its broad tenant detail projection must never mount on this route.
  const workspace = useTenantBillingWorkspace(tenantId);
  return <TenantBillingPanel workspace={workspace} lang={lang} />;
}
