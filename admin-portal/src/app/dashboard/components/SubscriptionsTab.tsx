"use client";

import { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  CreditCard,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardResponse } from "@/types/dashboard";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { SubscriptionARPUSplineChart } from "./charts/SubscriptionARPUSplineChart";
import { SubscriptionChurnComposedChart } from "./charts/SubscriptionChurnComposedChart";
import { SubscriptionRenewalsBarChart } from "./charts/SubscriptionRenewalsBarChart";
import {
  EmptyDashboardPanel,
  UnavailableDashboardPanel,
} from "./DashboardDataState";

interface SubscriptionsTabProps {
  subscriptionStatus: DashboardResponse["overview"]["subscriptionStatus"];
  analytics: DashboardResponse["analytics"]["subscriptions"];
}

export function SubscriptionsTab({
  subscriptionStatus,
  analytics,
}: SubscriptionsTabProps) {
  const { lang } = useI18n();
  const recurringRevenue = analytics.recurringRevenue.available
    ? analytics.recurringRevenue.data
    : undefined;
  const averageRevenue = analytics.averageCollectedRevenue.available
    ? analytics.averageCollectedRevenue.data.points
    : [];
  const paymentHealth = analytics.paymentHealth.available
    ? analytics.paymentHealth.data
    : [];
  const churn = analytics.churnAndAcquisition.available
    ? analytics.churnAndAcquisition.data.points
    : [];
  const renewals = analytics.upcomingRenewals.available
    ? analytics.upcomingRenewals.data.points
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ValueCard
          label={lang === "ar" ? "الإيراد الشهري المتكرر" : "USD MRR"}
          value={formatUsd(recurringRevenue?.monthlyRecurringRevenue ?? 0)}
          description={
            lang === "ar"
              ? "الاشتراكات النشطة والمتأخرة بالدولار"
              : "Active and past-due USD subscriptions"
          }
        />
        <ValueCard
          label={lang === "ar" ? "الإيراد السنوي المتكرر" : "USD ARR"}
          value={formatUsd(recurringRevenue?.annualRecurringRevenue ?? 0)}
          description={
            lang === "ar"
              ? "القيمة السنوية المحسوبة من MRR الحالي"
              : "Annualized from the current USD MRR"
          }
        />
        {analytics.arrTarget.available ? (
          <ValueCard
            label={lang === "ar" ? "هدف ARR" : "ARR Target"}
            value={`${formatUsd(analytics.arrTarget.data.actual)} / ${formatUsd(
              analytics.arrTarget.data.target,
            )}`}
            description={lang === "ar" ? "الحالي مقابل المستهدف" : "Actual vs target"}
          />
        ) : (
          <UnavailableDashboardPanel
            title={lang === "ar" ? "هدف ARR" : "ARR Target"}
            dataset={analytics.arrTarget}
            className="min-h-36"
          />
        )}
        <ValueCard
          label={lang === "ar" ? "تجديدات 90 يومًا" : "90-day Renewals"}
          value={new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(
            renewals.reduce((sum, point) => sum + point.value, 0),
          )}
          description={
            lang === "ar"
              ? "اشتراكات تنتهي فترتها الحالية"
              : "Subscriptions reaching their period end"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title={lang === "ar" ? "دورة حياة الاشتراك" : "Subscription Lifecycle"}
          subtitle={
            lang === "ar" ? "الحالة الحالية للاشتراكات" : "Current subscription status"
          }
          icon={<PieChart className="size-4 text-blue-500" />}
        >
          <TenantStatusDonutChart
            items={subscriptionStatus.items.map((item) => ({
              key: item.key,
              label: item.label,
              count: item.value,
              ratio: item.ratio,
              tone: item.tone,
              description: item.description ?? "",
            }))}
            total={subscriptionStatus.total}
            height={220}
          />
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "MRR حسب دورة الفوترة" : "MRR by Billing Cycle"}
          subtitle={
            lang === "ar"
              ? "القيمة الشهرية المكافئة بالدولار"
              : "Monthly-equivalent USD value"
          }
          icon={<Activity className="size-4 text-indigo-500" />}
        >
          {recurringRevenue?.byBillingCycle.length ? (
            <NamedValueBars
              items={recurringRevenue.byBillingCycle}
              valueFormatter={formatUsd}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "صحة عمليات الدفع" : "Payment Health"}
          subtitle={
            lang === "ar" ? "العمليات حسب الحالة" : "Transactions by status"
          }
          icon={<CreditCard className="size-4 text-amber-500" />}
        >
          {paymentHealth.length ? (
            <NamedValueBars items={paymentHealth} />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title={lang === "ar" ? "الإلغاء مقابل الاكتساب" : "Churn vs Acquisitions"}
          subtitle={
            lang === "ar"
              ? "بدأت الاشتراكات مقابل تواريخ الإلغاء"
              : "Subscription starts vs cancellation dates"
          }
          icon={<Users className="size-4 text-rose-500" />}
        >
          {churn.length ? (
            <SubscriptionChurnComposedChart
              data={churn.map((point) => ({
                month: point.label,
                newAcquisitions: point.primary,
                churned: point.secondary,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "التجديدات القادمة" : "Upcoming Renewals"}
          subtitle={lang === "ar" ? "نافذة 90 يومًا" : "90-day window"}
          icon={<CalendarDays className="size-4 text-blue-500" />}
        >
          {renewals.length ? (
            <SubscriptionRenewalsBarChart
              data={renewals.map((point) => ({
                month: point.label,
                renewals: point.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={
            lang === "ar"
              ? "متوسط التحصيل لكل مستأجر دافع"
              : "Average Collected Revenue"
          }
          subtitle={
            lang === "ar"
              ? "إجمالي الفواتير المدفوعة ÷ المستأجرين الدافعين"
              : "Paid invoice total per paying tenant"
          }
          icon={<TrendingUp className="size-4 text-purple-500" />}
        >
          {averageRevenue.length ? (
            <SubscriptionARPUSplineChart
              data={averageRevenue.map((point) => ({
                month: point.label,
                arpu: point.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <UnavailableDashboardPanel
          title={lang === "ar" ? "تدفق MRR" : "MRR Revenue Flow"}
          dataset={analytics.revenueFlow}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "CLTV مقابل CAC" : "CLTV vs CAC"}
          dataset={analytics.lifetimeValue}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "أثر الخصومات" : "Promotion Impact"}
          dataset={analytics.promotionImpact}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "الاحتفاظ حسب المجموعة" : "Cohort Retention"}
          dataset={analytics.cohortRetention}
        />
      </div>
    </div>
  );
}

function ValueCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          {icon}
          <span>{title}</span>
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function NamedValueBars({
  items,
  valueFormatter = (value) => new Intl.NumberFormat("en-US").format(value),
}: {
  items: Array<{ key: string; label: string; value: number }>;
  valueFormatter?: (value: number) => string;
}) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4 pt-2">
      {items.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-600 dark:text-slate-300">
              {item.label}
            </span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {valueFormatter(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${
                  item.value > 0
                    ? Math.max((item.value / maximum) * 100, 2)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyInline() {
  return (
    <EmptyDashboardPanel
      title="No data"
      className="min-h-40 border-0 bg-transparent p-0 shadow-none"
    />
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
