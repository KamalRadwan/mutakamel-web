"use client";

import { 
  DollarSign, PieChart, TrendingUp, AlertTriangle, 
  Wallet, ShieldAlert, CreditCard, Activity, ArrowDownUp 
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardViewMode } from "./DashboardHeader";
import { KpiCard } from "./KpiCard"; // Need to import this so we can render cards

// Existing Charts
import { CollectionGaugeChart } from "./charts/CollectionGaugeChart";
import { TargetVsActualBulletChart } from "./charts/TargetVsActualBulletChart";

// New Charts
import { BillingInvoiceStatusPieChart } from "./charts/BillingInvoiceStatusPieChart";
import { BillingAgingReportBarChart } from "./charts/BillingAgingReportBarChart";
import { BillingDSOAreaChart } from "./charts/BillingDSOAreaChart";
import { BillingCashFlowComposedChart } from "./charts/BillingCashFlowComposedChart";
import { BillingRevenueByProductRadar } from "./charts/BillingRevenueByProductRadar";
import { BillingForecastSplineChart } from "./charts/BillingForecastSplineChart";
import { BillingGatewaySplitDonut } from "./charts/BillingGatewaySplitDonut";
import { BillingFailureReasonsBarChart } from "./charts/BillingFailureReasonsBarChart";
import { BillingChargebackTrendLine } from "./charts/BillingChargebackTrendLine";
import { BillingUsageOverageScatter } from "./charts/BillingUsageOverageScatter";
import { BillingCostBreakdownTreemap } from "./charts/BillingCostBreakdownTreemap";
import { BillingDiscountImpactWaterfall } from "./charts/BillingDiscountImpactWaterfall";
import { BillingTaxDistributionPie } from "./charts/BillingTaxDistributionPie";

interface BillingTabProps {
  extraCards?: any[];
  summary: {
    totalIssued: number;
    totalCollected: number;
    totalAmount: number;
    collectedRatio: number; // 0..1
    items: any[];
  };
  agingData?: any[];
  dsoData?: any[];
  cashFlowData?: any[];
  revenueRadarData?: any[];
  forecastData?: any[];
  gatewayData?: any[];
  failureData?: any[];
  chargebackData?: any[];
  overageData?: any[];
  costBreakdownData?: any[];
  discountWaterfallData?: any[];
  taxData?: any[];
  invoiceStatusData?: { paid: number; outstanding: number; overdue: number };
}

export function BillingTab({ 
  summary, 
  extraCards = [], 
  agingData = [
    { bucket: "0-30 Days", amount: 125000 },
    { bucket: "31-60 Days", amount: 45000 },
    { bucket: "61-90 Days", amount: 15000 },
    { bucket: "90+ Days", amount: 8000 },
  ],
  dsoData = [
    { month: "Jan", dso: 32 }, { month: "Feb", dso: 35 },
    { month: "Mar", dso: 33 }, { month: "Apr", dso: 30 },
    { month: "May", dso: 28 }, { month: "Jun", dso: 25 },
  ],
  cashFlowData = [
    { month: "Jan", expected: 150000, actual: 145000 },
    { month: "Feb", expected: 160000, actual: 158000 },
    { month: "Mar", expected: 175000, actual: 160000 },
    { month: "Apr", expected: 180000, actual: 178000 },
    { month: "May", expected: 195000, actual: 185000 },
    { month: "Jun", expected: 210000, actual: 205000 },
  ],
  revenueRadarData = [
    { product: "Compute", revenue: 85000 },
    { product: "Database", revenue: 65000 },
    { product: "Storage", revenue: 45000 },
    { product: "Networking", revenue: 30000 },
    { product: "Support", revenue: 25000 },
  ],
  forecastData = [
    { month: "Apr", actual: 178000 },
    { month: "May", actual: 185000 },
    { month: "Jun", actual: 205000 },
    { month: "Jul", forecast: 220000 },
    { month: "Aug", forecast: 235000 },
    { month: "Sep", forecast: 255000 },
  ],
  gatewayData = [
    { gateway: "Stripe", volume: 450000, color: "#6366f1" },
    { gateway: "PayPal", volume: 150000, color: "#0284c7" },
    { gateway: "Bank Transfer", volume: 250000, color: "#10b981" },
    { gateway: "Crypto", volume: 50000, color: "#f59e0b" },
  ],
  failureData = [
    { reason: "Insufficient Funds", count: 145 },
    { reason: "Card Expired", count: 82 },
    { reason: "Do Not Honor", count: 54 },
    { reason: "Suspected Fraud", count: 21 },
    { reason: "Network Error", count: 12 },
  ],
  chargebackData = [
    { month: "Jan", chargebacks: 500, refunds: 1200 },
    { month: "Feb", chargebacks: 800, refunds: 1500 },
    { month: "Mar", chargebacks: 400, refunds: 1100 },
    { month: "Apr", chargebacks: 600, refunds: 1300 },
    { month: "May", chargebacks: 300, refunds: 900 },
    { month: "Jun", chargebacks: 250, refunds: 800 },
  ],
  overageData = [
    { computeUsage: 120, overageFee: 45, tenants: 12 },
    { computeUsage: 250, overageFee: 150, tenants: 45 },
    { computeUsage: 500, overageFee: 400, tenants: 80 },
    { computeUsage: 800, overageFee: 750, tenants: 30 },
    { computeUsage: 1200, overageFee: 1200, tenants: 15 },
    { computeUsage: 2000, overageFee: 2500, tenants: 5 },
  ],
  costBreakdownData = [
    { name: "EC2 Instances", size: 45000, fill: "#3b82f6" },
    { name: "RDS Databases", size: 35000, fill: "#10b981" },
    { name: "S3 Storage", size: 15000, fill: "#f59e0b" },
    { name: "Egress Bandwidth", size: 12000, fill: "#8b5cf6" },
    { name: "Load Balancers", size: 8000, fill: "#ec4899" },
    { name: "WAF & Shield", size: 5000, fill: "#64748b" },
  ],
  discountWaterfallData = [
    { name: "Gross Revenue", start: 0, end: 500000, value: 500000, isTotal: true },
    { name: "Volume Discounts", start: 450000, end: 500000, value: -50000 },
    { name: "Startup Promos", start: 420000, end: 450000, value: -30000 },
    { name: "Gateway Fees", start: 405000, end: 420000, value: -15000 },
    { name: "Net Revenue", start: 0, end: 405000, value: 405000, isTotal: true },
  ],
  taxData = [
    { region: "US Sales Tax", amount: 25000, color: "#3b82f6" },
    { region: "EU VAT", amount: 45000, color: "#10b981" },
    { region: "UK VAT", amount: 15000, color: "#f59e0b" },
    { region: "Rest of World", amount: 5000, color: "#8b5cf6" },
  ],
  invoiceStatusData = { paid: 250000, outstanding: 125000, overdue: 35000 }
}: BillingTabProps) {
  const { lang, t } = useI18n();
  const renderCards = (startIndex: number, count: number) => {
    const slice = extraCards.slice(startIndex, startIndex + count);
    if (!slice.length) return null;
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(4, slice.length)} gap-4 my-6`}>
        {slice.map((card) => (
          <KpiCard key={card.key} card={card} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-150">

      {/* ========================================================= */}
      {/* SECTION 1: INVOICING & AR */}
      {/* ========================================================= */}
      <section>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-blue-500" />
          {lang === "ar" ? "الفواتير والذمم المدينة" : "Invoicing & Accounts Receivable"}
        </h2>
        
        {/* KPI Cards (0 to 3) */}
        {renderCards(0, 3)}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Invoice Status" subtitle="Paid vs Outstanding vs Overdue" icon={<PieChart className="w-4 h-4 text-emerald-500" />}>
            <BillingInvoiceStatusPieChart paid={invoiceStatusData.paid} outstanding={invoiceStatusData.outstanding} overdue={invoiceStatusData.overdue} height={220} />
          </ChartCard>

          <ChartCard title="Aging Report" subtitle="Overdue invoice buckets" icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}>
            <BillingAgingReportBarChart data={agingData} height={220} />
          </ChartCard>

          <ChartCard title="Days Sales Outstanding" subtitle="Average days to get paid" icon={<TrendingUp className="w-4 h-4 text-amber-500" />}>
            <BillingDSOAreaChart data={dsoData} height={220} />
          </ChartCard>
        </div>
      </section>

      <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />


      {/* ========================================================= */}
      {/* SECTION 2: REVENUE & CASH FLOW */}
      {/* ========================================================= */}
      <section>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          {lang === "ar" ? "الإيرادات والتدفق النقدي" : "Revenue & Cash Flow"}
        </h2>

        {/* KPI Cards (3 to 6) */}
        {renderCards(3, 3)}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <ChartCard title="Collection Ratio" subtitle="Cash collected vs Invoiced" icon={<Activity className="w-4 h-4 text-emerald-500" />} className="lg:col-span-1">
            <div className="space-y-4">
              <CollectionGaugeChart collectedRatio={summary.collectedRatio || 0.85} height={130} />
              <TargetVsActualBulletChart actual={summary.totalCollected || summary.totalAmount * (summary.collectedRatio || 0.85)} target={summary.totalAmount || 10000} />
            </div>
          </ChartCard>

          <ChartCard title="Cash Flow" subtitle="Expected vs Actual Collected" icon={<DollarSign className="w-4 h-4 text-blue-500" />} className="lg:col-span-2">
            <BillingCashFlowComposedChart data={cashFlowData} height={220} />
          </ChartCard>

          <ChartCard title="Revenue Radar" subtitle="Revenue by Product Line" icon={<PieChart className="w-4 h-4 text-purple-500" />} className="lg:col-span-1">
            <BillingRevenueByProductRadar data={revenueRadarData} height={220} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 mt-6">
          <ChartCard title="Revenue Forecast" subtitle="3-Month Pipeline Projection" icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}>
            <BillingForecastSplineChart data={forecastData} height={260} />
          </ChartCard>
        </div>
      </section>

      <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />


      {/* ========================================================= */}
      {/* SECTION 3: GATEWAYS & FAILURES */}
      {/* ========================================================= */}
      <section>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-indigo-500" />
          {lang === "ar" ? "بوابات الدفع والأخطاء" : "Gateways & Failures"}
        </h2>

        {/* KPI Cards (6 to 9) */}
        {renderCards(6, 3)}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Gateway Split" subtitle="Volume by provider" icon={<PieChart className="w-4 h-4 text-indigo-500" />}>
            <BillingGatewaySplitDonut data={gatewayData} height={220} />
          </ChartCard>

          <ChartCard title="Failure Reasons" subtitle="Top declines this month" icon={<ShieldAlert className="w-4 h-4 text-rose-500" />}>
            <BillingFailureReasonsBarChart data={failureData} height={220} />
          </ChartCard>

          <ChartCard title="Chargebacks & Refunds" subtitle="Disputed and refunded volume" icon={<TrendingUp className="w-4 h-4 text-amber-500" />}>
            <BillingChargebackTrendLine data={chargebackData} height={220} />
          </ChartCard>
        </div>
      </section>

      <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />


      {/* ========================================================= */}
      {/* SECTION 4: METERED BILLING & TAXES */}
      {/* ========================================================= */}
      <section>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-purple-500" />
          {lang === "ar" ? "الفوترة حسب الاستهلاك والضرائب" : "Metered Billing & Taxes"}
        </h2>

        {/* KPI Cards (9 onwards) */}
        {renderCards(9, 10)}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Usage vs Overages" subtitle="Compute limit vs generated fees" icon={<Activity className="w-4 h-4 text-purple-500" />}>
            <BillingUsageOverageScatter data={overageData} height={280} />
          </ChartCard>

          <ChartCard title="COGS Breakdown" subtitle="Infrastructure costs passed to billing" icon={<PieChart className="w-4 h-4 text-blue-500" />}>
            <BillingCostBreakdownTreemap data={costBreakdownData} height={280} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Net Revenue Waterfall" gross subtitle="Gross Revenue to Net deductions" icon={<ArrowDownUp className="w-4 h-4 text-emerald-500" />} className="lg:col-span-2">
            <BillingDiscountImpactWaterfall data={discountWaterfallData} height={260} />
          </ChartCard>

          <ChartCard title="Tax Collected" subtitle="Distribution by geographic region" icon={<PieChart className="w-4 h-4 text-amber-500" />} className="lg:col-span-1">
            <BillingTaxDistributionPie data={taxData} height={260} />
          </ChartCard>
        </div>
      </section>

    </div>
  );
}

function ChartCard({ title, subtitle, icon, children, className = "" }: any) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {icon}
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="py-2 flex-1">
        {children}
      </div>
    </div>
  );
}
