"use client";

import Link from "next/link";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Server, 
  ArrowUpRight,
  ExternalLink,
  TrendingUp 
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DashboardMetric } from "@/types/dashboard";
import { formatDashboardMetric, toneToColorClass } from "../utils/formatters";
import { SparklineChart } from "./charts/SparklineChart";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { SubscriptionRevenueStackChart } from "./charts/SubscriptionRevenueStackChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { SaaSHealthIndexGauge } from "./charts/SaaSHealthIndexGauge";

interface OverviewTabProps {
  data: {
    kpis: DashboardMetric[];
    recentTenants: Array<{
      id: string;
      name: string;
      status: string;
      plan: string;
      createdAt: string;
    }>;
    billingGrowth?: {
      currencyCode: string;
      points: Array<{ month: string; tenants: number; collected: number }>;
    };
    subscriptionStatus?: {
      total: number;
      items: Array<{
        key: string;
        label: string;
        value: number;
        ratio: number;
        tone: any;
        description?: string;
      }>;
    };
  };
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { t, lang } = useI18n();
  const currency = data.billingGrowth?.currencyCode || "USD";

  const getLocalizedKpi = (kpi: DashboardMetric) => {
    if (lang !== "ar") return { label: kpi.label, description: kpi.description };

    const keyLower = (kpi.key || "").toLowerCase();
    const labelLower = (kpi.label || "").toLowerCase();

    if (keyLower.includes("tenant") || labelLower.includes("tenant")) {
      return { label: "الشركات النشطة", description: "المستأجرين الفاعلين حالياً" };
    }
    if (keyLower.includes("subscrip") || labelLower.includes("subscrip")) {
      return { label: "الاشتراكات الفعالة", description: "الاشتراكات النشطة بالفترة" };
    }
    if (keyLower.includes("collect") || labelLower.includes("collect")) {
      return { label: "الإيرادات المحصلة", description: "الفواتير المدفوعة بالفترة المحددة" };
    }
    if (keyLower.includes("outstanding") || keyLower.includes("pastdue") || labelLower.includes("outstanding") || labelLower.includes("past due")) {
      return { label: "الفواتير المستحقة", description: "تتطلب متابعة التحصيل والفوترة" };
    }
    if (keyLower.includes("capacity") || labelLower.includes("capacity")) {
      return { label: "سعة قواعد البيانات", description: "من إجمالي السعة المتاحة للمنصة" };
    }
    if (keyLower.includes("alert") || labelLower.includes("alert")) {
      return { label: "التنبيهات المفتوحة", description: "لا توجد تنبيهات حرجية حالياً" };
    }
    return { label: kpi.label, description: kpi.description };
  };

  const mockSparklineData: Record<string, Array<{ value: number }>> = {
    "total-tenants": [{ value: 30 }, { value: 32 }, { value: 35 }, { value: 38 }, { value: 40 }, { value: 42 }],
    "admin-staff": [{ value: 14 }, { value: 15 }, { value: 15 }, { value: 16 }, { value: 17 }, { value: 18 }],
    "pending-invoices": [{ value: 800 }, { value: 950 }, { value: 1100 }, { value: 1050 }, { value: 1200 }, { value: 1299 }],
    "db-utilization": [{ value: 50 }, { value: 55 }, { value: 60 }, { value: 62 }, { value: 65 }, { value: 68 }],
  };

  const sparklineColors: Record<string, string> = {
    "total-tenants": "#3b82f6",
    "admin-staff": "#10b981",
    "pending-invoices": "#f59e0b",
    "db-utilization": "#8b5cf6",
  };

  const getKpiIcon = (key: string) => {
    switch (key) {
      case "total-tenants":
        return <Building2 className="w-4 h-4" />;
      case "admin-staff":
        return <Users className="w-4 h-4" />;
      case "pending-invoices":
        return <CreditCard className="w-4 h-4" />;
      case "db-utilization":
        return <Server className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 6 Top KPI Cards Grid (balanced responsive layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {data.kpis.map((kpi) => {
          const formattedValue = formatDashboardMetric(kpi, currency);
          const toneColor = toneToColorClass(kpi.tone);
          const localized = getLocalizedKpi(kpi);
          const sparkData = mockSparklineData[kpi.key] || [
            { value: 10 }, { value: 20 }, { value: 15 }, { value: 25 }, { value: 30 }
          ];
          const sparkColor = sparklineColors[kpi.key] || "#3b82f6";

          return (
            <div
              key={kpi.key}
              className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 flex flex-col justify-between overflow-hidden relative"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-semibold truncate max-w-[120px]" title={localized.label}>
                    {localized.label}
                  </span>
                  <div className={`p-1.5 sm:p-2 rounded-xl ${toneColor.split(" ")[1]}`}>
                    <div className={toneColor.split(" ")[0]}>
                      {getKpiIcon(kpi.key)}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    {formattedValue}
                  </span>
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {localized.description}
                </p>
              </div>

              <div className="pt-2 -mb-2 -mx-2">
                <SparklineChart data={sparkData} color={sparkColor} height={32} />
              </div>
            </div>
          );
        })}
      </div>


      {/* Main Growth & Health Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Growth & Revenue Interactive Composed Chart (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.dashboard.overviewTab.growthTitle}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.dashboard.overviewTab.growthSubtext}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60 self-start sm:self-auto">
              {t.dashboard.overviewTab.liveSync}
            </span>
          </div>
          <div className="pt-2">
            <TenantGrowthRevenueChart
              points={data.billingGrowth?.points || []}
              currencyCode={currency}
              height={320}
            />
          </div>
        </div>

        {/* SaaS Platform Aggregate Health Score Gauge Box (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              مؤشر صحة المنصة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تقييم تشغيلي شامل للأداء والاستقرار
            </p>
          </div>

          <div className="py-2">
            <SaaSHealthIndexGauge score={94} height={180} />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex justify-between font-semibold">
              <span>نسبة توفر الخدمات:</span>
              <span className="text-emerald-600 font-bold font-mono">99.9%</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>استقرار التشغيل:</span>
              <span className="text-blue-600 font-bold">ممتاز</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid for Recent Tenants + Subscription Tier Stack Chart / Numbers Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tenants Table (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.dashboard.overviewTab.recentTenantsTitle}
            </h3>
            <Link
              href="/admin/tenants"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>{t.dashboard.overviewTab.viewAllTenants}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-3 text-start">{t.dashboard.overviewTab.tenantName}</th>
                  <th className="pb-3 text-start">{t.dashboard.overviewTab.status}</th>
                  <th className="pb-3 text-start">{t.dashboard.overviewTab.plan}</th>
                  <th className="pb-3 text-start">{t.dashboard.overviewTab.createdAt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data.recentTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div>{tenant.name}</div>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={tenant.status as any} enumType="tenant" size="sm" />
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 font-medium">
                      {tenant.plan}
                    </td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Subscription Status Breakdown Box (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              {t.dashboard.billingTab.subscriptionLifecycleTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              توزيع وتصنيف اشتراكات المستأجرين النشطة
            </p>
          </div>

          <div className="py-2">
            <TenantStatusDonutChart
              items={(data.subscriptionStatus?.items || []).map((it) => ({
                key: it.key,
                label: it.label,
                count: it.value,
                description: it.description || "",
                ratio: it.ratio,
                tone: it.tone,
              }))}
              total={data.subscriptionStatus?.total || 0}
              height={220}
            />
          </div>

          <Link
            href="/admin/reports"
            className="w-full py-2.5 px-3 text-xs font-semibold text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors inline-flex items-center justify-center gap-1"
          >
            <span>{t.dashboard.overviewTab.viewDetailedFinancials}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}


