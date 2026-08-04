"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
import { 
  Users, 
  TrendingUp, 
  ShoppingCart, 
  CreditCard, 
  ArrowUpRight, 
  Activity,
  CheckCircle2,
  Clock
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

const chartData = [
  { name: "يناير", sales: 4000, leads: 2400 },
  { name: "فبراير", sales: 3000, leads: 1398 },
  { name: "مارس", sales: 2000, leads: 9800 },
  { name: "أبريل", sales: 2780, leads: 3908 },
  { name: "مايو", sales: 1890, leads: 4800 },
  { name: "يونيو", sales: 2390, leads: 3800 },
];

export default function DashboardPage() {
  const { t } = useI18n();

  const stats = [
    { title: "إجمالي العمليات المشتركة", value: "1,248", change: "+12.5%", icon: TrendingUp, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50" },
    { title: "العملاء الجدد", value: "342", change: "+8.2%", icon: Users, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
    { title: "المبيعات والصفقات", value: "$45,210", change: "+15.3%", icon: ShoppingCart, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50" },
    { title: "الرصيد المتاح", value: "$12,850", change: "+4.1%", icon: CreditCard, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16]">
      <Navbar />

      <main className="flex-1 w-full p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {t.nav.dashboard}
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                مرحباً بك في لوحة تحكم المستأجر الرئيسية. ملخص الأداء والإحصائيات الحية.
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${stat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      {stat.change}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{stat.title}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">نظرة عامة على المبيعات</h3>
                <span className="text-xs font-semibold text-slate-400">2026</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="sales" stroke="#2563eb" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">العملاء والفرص</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </main>
    </div>
  );
}
