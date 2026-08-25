"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import {
  type CustomerProfileStatus,
  type CustomerProfileType,
  useCustomerProfile,
} from "../hooks/useCustomerProfiles";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function statusVariant(
  status: CustomerProfileStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE_CUSTOMER") return "success";
  if (status === "PROSPECT") return "warning";
  if (status === "BLACKLISTED") return "danger";
  return "neutral";
}

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useI18n();
  const { item, isLoading, error, reload } = useCustomerProfile(id);

  const copy =
    lang === "ar"
      ? {
          title: "ملف العميل",
          subtitle: "عرض للبيانات المثبتة في CRM دون تعديل محلي.",
          back: "العودة إلى العملاء",
          reload: "إعادة المحاولة",
          loading: "جارٍ تحميل ملف العميل...",
          name: "الاسم",
          company: "اسم الشركة",
          type: "نوع الملف",
          status: "الحالة",
          phone: "الهاتف",
          email: "البريد الإلكتروني",
          branch: "معرّف الفرع",
          profileId: "معرّف الملف",
          unavailable: "غير متوفر",
        }
      : {
          title: "Customer profile",
          subtitle: "Verified CRM data displayed without local editing.",
          back: "Back to customers",
          reload: "Try again",
          loading: "Loading customer profile...",
          name: "Name",
          company: "Company name",
          type: "Profile type",
          status: "Status",
          phone: "Phone",
          email: "Email",
          branch: "Branch ID",
          profileId: "Profile ID",
          unavailable: "Not available",
        };

  const typeLabels: Record<CustomerProfileType, string> =
    lang === "ar"
      ? { INDIVIDUAL: "فرد", CORPORATE: "شركة" }
      : { INDIVIDUAL: "Individual", CORPORATE: "Corporate" };
  const statusLabels: Record<CustomerProfileStatus, string> =
    lang === "ar"
      ? {
          PROSPECT: "محتمل",
          ACTIVE_CUSTOMER: "نشط",
          INACTIVE: "غير نشط",
          BLACKLISTED: "محظور",
        }
      : {
          PROSPECT: "Prospect",
          ACTIVE_CUSTOMER: "Active customer",
          INACTIVE: "Inactive",
          BLACKLISTED: "Blacklisted",
        };

  return (
    <div className="space-y-6">
      <PageHeader title={item?.displayName ?? copy.title} subtitle={copy.subtitle}>
        <Link
          href="/crm/customer-profiles"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {copy.back}
        </Link>
      </PageHeader>

      {isLoading && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          {copy.loading}
        </p>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{error}</span>
          <Button type="button" variant="secondary" size="sm" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {copy.reload}
          </Button>
        </div>
      )}

      {!isLoading && !error && item && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                {item.displayName}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="info">{typeLabels[item.profileType]}</Badge>
                <Badge variant={statusVariant(item.status)}>
                  {statusLabels[item.status]}
                </Badge>
              </div>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label={copy.name} value={item.displayName} />
            <DetailField
              label={copy.company}
              value={item.companyName ?? copy.unavailable}
            />
            <DetailField
              label={copy.type}
              value={typeLabels[item.profileType]}
            />
            <DetailField
              label={copy.status}
              value={statusLabels[item.status]}
            />
            <DetailField
              label={copy.phone}
              value={item.phone ?? copy.unavailable}
            />
            <DetailField
              label={copy.email}
              value={item.email ?? copy.unavailable}
            />
            <DetailField label={copy.branch} value={item.branchId} />
            <DetailField label={copy.profileId} value={item.id} />
          </dl>
        </section>
      )}
    </div>
  );
}
