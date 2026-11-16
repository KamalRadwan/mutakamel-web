"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, PageActions } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export function QuotationBackAction() {
  const { t } = useI18n();
  return (
    <PageActions slot="crumb">
      <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5" data-page-location-override>
        <Link href={TENANT_ROUTES.tradeQuotations}>
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
          {t.tradeDocuments.quotations.back}
        </Link>
      </Button>
    </PageActions>
  );
}
