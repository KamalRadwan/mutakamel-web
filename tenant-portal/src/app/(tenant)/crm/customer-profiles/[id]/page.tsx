"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, PageHeader, Skeleton, StatusBadge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCustomerProfile } from "../hooks/useCustomerProfiles";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

// Restyled onto the design system per docs/design/detail-screens.md's layout
// (PageHeader + two-column Card grid). The full spec also calls for a
// capabilities-gated action cluster (Add contact / Edit / Change status /
// Delete) and a custom-fields rail card — deliberately not built here: each
// needs its own DTO verification and mutation flow, and this session's
// scope stopped at the three-view workspace. Logged as Q12 in
// docs/build/OPEN-QUESTIONS.md rather than shipped as a disabled or fake
// affordance.
export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const { item, isLoading, error, reload } = useCustomerProfile(id);
  const sourceName = item ? (lang === "ar" ? item.acquisitionSourceNameAr : item.acquisitionSourceNameEn) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={item?.displayName ?? t.crmCustomerProfiles.detailTitle}
        description={t.crmCustomerProfiles.detailSubtitle}
        secondaryActions={
          <Button variant="outline" asChild>
            <Link href="/crm/customer-profiles">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              {t.crmCustomerProfiles.back}
            </Link>
          </Button>
        }
      />

      {isLoading && (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-48 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      )}

      {!isLoading && error && <ErrorState title={error} onRetry={reload} retryLabel={t.common.retry} />}

      {!isLoading && !error && item && (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          {/* MAIN */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardHeader className="flex-row items-center gap-3 border-b border-border">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted">
                  {item.profileType === "CORPORATE" ? (
                    <Building2 className="size-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  ) : (
                    <UserRound className="size-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <CardTitle>{item.displayName}</CardTitle>
                  <StatusBadge value={item.status} kind="CustomerStatus" className="mt-1" />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                <DetailRow label={t.crmCustomerProfiles.name} value={item.displayName} />
                <DetailRow label={t.crmCustomerProfiles.company} value={item.companyName ?? t.crmCustomerProfiles.unavailable} />
                <DetailRow
                  label={t.crmCustomerProfiles.type}
                  value={t.crmCustomerProfiles.profileTypes[item.profileType] ?? item.profileType}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.crmCustomerProfiles.contact}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2" dir="ltr">
                <DetailRow label={t.crmCustomerProfiles.email} value={item.email ?? t.crmCustomerProfiles.unavailable} />
                <DetailRow label={t.crmCustomerProfiles.phone} value={item.phone ?? t.crmCustomerProfiles.unavailable} />
              </CardContent>
            </Card>
          </div>

          {/* RAIL */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardHeader>
                <CardTitle>{t.common.history}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 pt-0">
                <DetailRow label={t.crmCustomerProfiles.source} value={sourceName ?? t.crmCustomerProfiles.unavailable} />
                <DetailRow label={t.crmCustomerProfiles.branch} value={item.branchId} />
                <DetailRow label={t.crmCustomerProfiles.profileId} value={item.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
