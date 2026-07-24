"use client";

import { 
  PieChart, TrendingUp, Users, Target, Radar, CalendarDays, 
  ArrowDownUp, Activity, CreditCard, Ticket, LayoutGrid 
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardViewMode } from "./DashboardHeader";
import { toneToColorClass } from "../utils/formatters";

// Existing charts
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";

// New charts
import { SubscriptionChurnComposedChart } from "./charts/SubscriptionChurnComposedChart";
import { SubscriptionMRRStackChart } from "./charts/SubscriptionMRRStackChart";
import { SubscriptionTargetGauge } from "./charts/SubscriptionTargetGauge";
import { SubscriptionCLTVRadarChart } from "./charts/SubscriptionCLTVRadarChart";
import { SubscriptionRenewalsBarChart } from "./charts/SubscriptionRenewalsBarChart";
import { SubscriptionMigrationWaterfallChart } from "./charts/SubscriptionMigrationWaterfallChart";
import { SubscriptionARPUSplineChart } from "./charts/SubscriptionARPUSplineChart";
import { SubscriptionPaymentPieChart } from "./charts/SubscriptionPaymentPieChart";
import { SubscriptionPromoImpactScatter } from "./charts/SubscriptionPromoImpactScatter";
import { SubscriptionRetentionGrid } from "./charts/SubscriptionRetentionGrid";

interface SubscriptionsTabProps {
  subscriptionStatus?: {
    items?: Array<{
      key: string; label: string; value: number; description: string; tone: any;
    }>;
  };
  billingGrowth?: any;
  churnData?: any[];
  mrrStackData?: any[];
  cltvData?: any[];
  renewalsData?: any[];
  waterfallData?: any[];
  arpuData?: any[];
  promoData?: any[];
  cohortData?: any[];
  paymentHealth?: { success: number; failed: number; recovered: number };
  arrTarget?: { actualARR: number; targetARR: number };
}

export function SubscriptionsTab({ 
  subscriptionStatus, 
  billingGrowth,
  churnData = [
    { month: "Jan", newAcquisitions: 120, churned: 30 },
    { month: "Feb", newAcquisitions: 140, churned: 35 },
    { month: "Mar", newAcquisitions: 180, churned: 40 },
    { month: "Apr", newAcquisitions: 220, churned: 45 },
    { month: "May", newAcquisitions: 300, churned: 50 },
    { month: "Jun", newAcquisitions: 350, churned: 60 },
  ],
  mrrStackData = [
    { month: "Jan", basic: 5000, pro: 8000, enterprise: 12000 },
    { month: "Feb", basic: 5500, pro: 9000, enterprise: 15000 },
    { month: "Mar", basic: 6000, pro: 10500, enterprise: 18000 },
    { month: "Apr", basic: 6500, pro: 12000, enterprise: 22000 },
  ],
  cltvData = [
    { segment: "SME", cltv: 1200, cac: 300 },
    { segment: "Mid-Market", cltv: 4500, cac: 1000 },
    { segment: "Enterprise", cltv: 15000, cac: 3500 },
    { segment: "Gov", cltv: 22000, cac: 4000 },
    { segment: "Edu", cltv: 8000, cac: 1500 },
  ],
  renewalsData = [
    { month: "July", renewals: 45 },
    { month: "August", renewals: 62 },
    { month: "September", renewals: 38 },
    { month: "October", renewals: 85 },
  ],
  waterfallData = [
    { name: "Starting MRR", start: 0, end: 50000, value: 50000, isTotal: true },
    { name: "New Biz", start: 50000, end: 55000, value: 5000 },
    { name: "Expansions", start: 55000, end: 58000, value: 3000 },
    { name: "Contractions", start: 56500, end: 58000, value: -1500 },
    { name: "Churn", start: 54000, end: 56500, value: -2500 },
    { name: "Ending MRR", start: 0, end: 54000, value: 54000, isTotal: true },
  ],
  arpuData = [
    { month: "Jan", arpu: 45 },
    { month: "Feb", arpu: 48 },
    { month: "Mar", arpu: 52 },
    { month: "Apr", arpu: 55 },
    { month: "May", arpu: 58 },
    { month: "Jun", arpu: 65 },
  ],
  promoData = [
    { discountPercent: 0, retentionMonths: 18, subscribers: 350 },
    { discountPercent: 10, retentionMonths: 14, subscribers: 210 },
    { discountPercent: 20, retentionMonths: 10, subscribers: 180 },
    { discountPercent: 30, retentionMonths: 6, subscribers: 120 },
    { discountPercent: 50, retentionMonths: 3, subscribers: 90 },
  ],
  cohortData = [
    { cohortMonth: "Jan 2026", users: 120, retentionRates: [100, 95, 88, 80, 75, 71] },
    { cohortMonth: "Feb 2026", users: 145, retentionRates: [100, 92, 85, 79, 74] },
    { cohortMonth: "Mar 2026", users: 180, retentionRates: [100, 94, 87, 82] },
    { cohortMonth: "Apr 2026", users: 210, retentionRates: [100, 96, 90] },
    { cohortMonth: "May 2026", users: 250, retentionRates: [100, 97] },
    { cohortMonth: "Jun 2026", users: 310, retentionRates: [100] },
  ],
  paymentHealth = { success: 8540, failed: 420, recovered: 315 },
  arrTarget = { actualARR: 2450000, targetARR: 3000000 }
}: SubscriptionsTabProps) {
  const { lang } = useI18n();

  if (!subscriptionStatus || !subscriptionStatus.items) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Row 1: Core Lifecycle & MRR (3 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard 
          title={lang === "ar" ? "دورة حياة الاشتراك" : "Subscription Lifecycle"}
          subtitle="Plan tier distribution"
          icon={<PieChart className="w-4 h-4 text-blue-500" />}
        >
          <TenantStatusDonutChart
            items={subscriptionStatus.items.map((it: any) => ({
              key: it.key, label: it.label, count: it.value, ratio: 0.25, tone: it.tone || "blue", description: it.description || "",
            }))}
            total={subscriptionStatus.items.reduce((acc: number, it: any) => acc + (it.value || 0), 0)}
            height={220}
          />
        </ChartCard>

        <ChartCard 
          title="MRR by Tier"
          subtitle="Revenue distribution across plans"
          icon={<Activity className="w-4 h-4 text-indigo-500" />}
          className="lg:col-span-2"
        >
          <SubscriptionMRRStackChart data={mrrStackData} height={220} />
        </ChartCard>
      </div>

      {/* Row 2: ARR Target, ARPU, Payment Health (3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard title="ARR Target Pace" subtitle="Annual recurring revenue target" icon={<Target className="w-4 h-4 text-emerald-500" />}>
          <SubscriptionTargetGauge actualARR={arrTarget.actualARR} targetARR={arrTarget.targetARR} height={220} />
        </ChartCard>
        
        <ChartCard title="ARPU Trend" subtitle="Average Revenue Per User" icon={<TrendingUp className="w-4 h-4 text-purple-500" />}>
          <SubscriptionARPUSplineChart data={arpuData} height={220} />
        </ChartCard>

        <ChartCard title="Payment Health" subtitle="Success vs failure rates" icon={<CreditCard className="w-4 h-4 text-amber-500" />}>
          <SubscriptionPaymentPieChart success={paymentHealth.success} failed={paymentHealth.failed} recovered={paymentHealth.recovered} height={220} />
        </ChartCard>
      </div>

      {/* Row 3: Churn & Renewals (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Churn vs Acquisitions" subtitle="Monthly subscribers flux" icon={<Users className="w-4 h-4 text-rose-500" />}>
          <SubscriptionChurnComposedChart data={churnData} height={280} />
        </ChartCard>

        <ChartCard title="Upcoming Renewals" subtitle="90-day renewal timeline" icon={<CalendarDays className="w-4 h-4 text-blue-500" />}>
          <SubscriptionRenewalsBarChart data={renewalsData} height={280} />
        </ChartCard>
      </div>

      {/* Row 4: Waterfall & Radar (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue Flow (Waterfall)" subtitle="MRR Expansions and Contractions" icon={<ArrowDownUp className="w-4 h-4 text-emerald-500" />}>
          <SubscriptionMigrationWaterfallChart data={waterfallData} height={280} />
        </ChartCard>

        <ChartCard title="CLTV vs CAC by Segment" subtitle="Customer Lifetime Value Radar" icon={<Radar className="w-4 h-4 text-purple-500" />}>
          <SubscriptionCLTVRadarChart data={cltvData} height={280} />
        </ChartCard>
      </div>

      {/* Row 5: Cohort Retention & Promo Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Discount Impact" subtitle="Promo vs Retention length" icon={<Ticket className="w-4 h-4 text-amber-500" />}>
          <SubscriptionPromoImpactScatter data={promoData} height={280} />
        </ChartCard>

        <ChartCard title="Cohort Retention Heatmap" subtitle="MoM retention by signup cohort" icon={<LayoutGrid className="w-4 h-4 text-indigo-500" />} className="lg:col-span-2">
          <SubscriptionRetentionGrid data={cohortData} height={280} />
        </ChartCard>
      </div>

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
