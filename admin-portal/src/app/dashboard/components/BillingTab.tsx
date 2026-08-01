"use client";

import { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Landmark,
  PieChart,
  ReceiptText,
  RefreshCcw,
  Timer,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardMetric, DashboardResponse } from "@/types/dashboard";
import { KpiCard } from "./KpiCard";
import { BillingInvoiceStatusPieChart } from "./charts/BillingInvoiceStatusPieChart";
import { BillingAgingReportBarChart } from "./charts/BillingAgingReportBarChart";
import { BillingDSOAreaChart } from "./charts/BillingDSOAreaChart";
import { BillingCashFlowComposedChart } from "./charts/BillingCashFlowComposedChart";
import { BillingRevenueByProductRadar } from "./charts/BillingRevenueByProductRadar";
import { BillingForecastSplineChart } from "./charts/BillingForecastSplineChart";
import { BillingGatewaySplitDonut } from "./charts/BillingGatewaySplitDonut";
import { BillingFailureReasonsBarChart } from "./charts/BillingFailureReasonsBarChart";
import { BillingTaxDistributionPie } from "./charts/BillingTaxDistributionPie";
import {
  EmptyDashboardPanel,
  UnavailableDashboardPanel,
} from "./DashboardDataState";

interface BillingTabProps {
  extraCards: DashboardMetric[];
  summary: DashboardResponse["overview"]["billingSummary"];
  analytics: DashboardResponse["analytics"]["billing"];
}

const chartColors = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
];

export function BillingTab({
  summary,
  extraCards,
  analytics,
}: BillingTabProps) {
  const { lang } = useI18n();
  const statusValue = (key: string) =>
    summary.items.find((item) => item.key === key)?.value ?? 0;
  const aging = analytics.aging.available ? analytics.aging.data.items : [];
  const dso = analytics.daysSalesOutstanding.available
    ? analytics.daysSalesOutstanding.data.points
    : [];
  const cashFlow = analytics.cashFlow.available
    ? analytics.cashFlow.data.points
    : [];
  const revenueByPurpose = analytics.revenueByPurpose.available
    ? analytics.revenueByPurpose.data.items
    : [];
  const providers = analytics.paymentProviders.available
    ? analytics.paymentProviders.data
    : [];
  const failures = analytics.paymentFailureReasons.available
    ? analytics.paymentFailureReasons.data
    : [];
  const refunds = analytics.refunds.available
    ? analytics.refunds.data.points
    : [];
  const taxByCountry = analytics.taxByCountry.available
    ? analytics.taxByCountry.data.items
    : [];
  const renewalForecast = analytics.renewalForecast.available
    ? analytics.renewalForecast.data.points
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {extraCards.map((card) => (
          <KpiCard key={card.key} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title={lang === "ar" ? "حالات الفواتير" : "Invoice Status"}
          subtitle={lang === "ar" ? "ضمن الفترة المحددة" : "Selected period"}
          icon={<PieChart className="size-4 text-blue-500" />}
        >
          <BillingInvoiceStatusPieChart
            paid={statusValue("paid-invoices")}
            outstanding={
              statusValue("issued-invoices") +
              statusValue("partially-paid-invoices")
            }
            overdue={statusValue("overdue-invoices")}
            height={240}
          />
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "أعمار الديون" : "Receivables Aging"}
          subtitle={
            lang === "ar"
              ? "الرصيد المتبقي بالدولار حسب تاريخ الاستحقاق"
              : "Remaining USD balance by due date"
          }
          icon={<CalendarClock className="size-4 text-amber-500" />}
        >
          {aging.length ? (
            <BillingAgingReportBarChart
              data={aging.map((item) => ({
                bucket: item.label,
                amount: item.value,
              }))}
              height={240}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "متوسط أيام التحصيل" : "Days Sales Outstanding"}
          subtitle={
            lang === "ar"
              ? "من إصدار الفاتورة حتى الدفع"
              : "Invoice issue to payment"
          }
          icon={<Timer className="size-4 text-orange-500" />}
        >
          {dso.length ? (
            <BillingDSOAreaChart
              data={dso.map((point) => ({
                month: point.label,
                dso: point.value,
              }))}
              height={240}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title={lang === "ar" ? "التدفق النقدي" : "Cash Flow"}
          subtitle={
            lang === "ar"
              ? "المستحق حسب due_at مقابل المحصل حسب paid_at"
              : "Due-at expected vs paid-at actual"
          }
          icon={<Wallet className="size-4 text-emerald-500" />}
        >
          {cashFlow.length ? (
            <BillingCashFlowComposedChart
              data={cashFlow.map((point) => ({
                month: point.label,
                expected: point.primary,
                actual: point.secondary,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "الإيراد حسب غرض الفاتورة" : "Revenue by Invoice Purpose"}
          subtitle={
            lang === "ar"
              ? "الفواتير المدفوعة بالدولار"
              : "Paid invoices in USD"
          }
          icon={<ReceiptText className="size-4 text-indigo-500" />}
        >
          {revenueByPurpose.length ? (
            <BillingRevenueByProductRadar
              data={revenueByPurpose.map((item) => ({
                product: item.label,
                revenue: item.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "توقع التجديدات" : "Renewal Forecast"}
          subtitle={
            lang === "ar"
              ? "قيمة التجديدات الحالية بالدولار خلال 90 يومًا"
              : "Current USD renewal value over 90 days"
          }
          icon={<Landmark className="size-4 text-cyan-500" />}
        >
          {renewalForecast.length ? (
            <BillingForecastSplineChart
              data={renewalForecast.map((point) => ({
                month: point.label,
                forecast: point.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "بوابات الدفع" : "Payment Providers"}
          subtitle={
            lang === "ar"
              ? "عدد العمليات الناجحة حسب المزود"
              : "Successful transaction count by provider"
          }
          icon={<CreditCard className="size-4 text-blue-500" />}
        >
          {providers.length ? (
            <BillingGatewaySplitDonut
              data={providers.map((item, index) => ({
                gateway: item.label,
                volume: item.value,
                color: chartColors[index % chartColors.length],
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "أسباب فشل الدفع" : "Payment Failure Reasons"}
          subtitle={
            lang === "ar"
              ? "رمز الفشل أو الحالة النهائية"
              : "Failure code or terminal status"
          }
          icon={<AlertTriangle className="size-4 text-rose-500" />}
        >
          {failures.length ? (
            <BillingFailureReasonsBarChart
              data={failures.map((item) => ({
                reason: item.label,
                count: item.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "المبالغ المستردة" : "Refunds"}
          subtitle={
            lang === "ar"
              ? "refund_amount_usd حسب تاريخ الاسترداد"
              : "Refunded USD by refund date"
          }
          icon={<RefreshCcw className="size-4 text-red-500" />}
        >
          {refunds.length ? (
            <BillingForecastSplineChart
              data={refunds.map((point) => ({
                month: point.label,
                actual: point.value,
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "الضرائب حسب الدولة" : "Tax by Tenant Country"}
          subtitle={
            lang === "ar"
              ? "ضريبة الفواتير المدفوعة بالدولار"
              : "Paid-invoice tax in USD"
          }
          icon={<ReceiptText className="size-4 text-violet-500" />}
        >
          {taxByCountry.length ? (
            <BillingTaxDistributionPie
              data={taxByCountry.map((item, index) => ({
                region: item.label,
                amount: item.value,
                color: chartColors[index % chartColors.length],
              }))}
              height={280}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <UnavailableDashboardPanel
          title={lang === "ar" ? "الاستخدام الزائد" : "Usage Overage"}
          dataset={analytics.usageOverage}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "توزيع التكلفة" : "Cost Breakdown"}
          dataset={analytics.costBreakdown}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "أثر الخصومات" : "Discount Impact"}
          dataset={analytics.discountImpact}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "الاعتراضات المالية" : "Chargebacks"}
          dataset={analytics.chargebacks}
        />
      </div>
    </div>
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
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
        {icon}
        <span>{title}</span>
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
      <div className="mt-4 flex-1">{children}</div>
    </section>
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
