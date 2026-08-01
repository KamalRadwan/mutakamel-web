"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Plus, LayoutDashboard, Search, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import Link from "next/link";
import { DashboardFormDialog } from "@/features/crm/dashboards/components/dashboard-form-dialog";

// Mock Data
const mockDashboards = [
  {
    id: "mega-crm-dashboard",
    name: "I18N_FALLBACK",
    description: "I18N_FALLBACK",
    favorite: true,
    widgets: 22,
    isMega: true,
  },
  {
    id: "sales-overview",
    name: "I18N_FALLBACK",
    description: "I18N_FALLBACK",
    favorite: true,
    widgets: 12,
  },
  {
    id: "marketing-campaigns",
    name: "I18N_FALLBACK",
    description: "I18N_FALLBACK",
    favorite: false,
    widgets: 8,
  },
  {
    id: "support-tickets",
    name: "I18N_FALLBACK",
    description: "I18N_FALLBACK",
    favorite: true,
    widgets: 5,
  },
];

export default function DashboardsIndexPage() {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [search, setSearch] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);

  const filtered = mockDashboards.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-8 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {isRtl ? "I18N_FALLBACK" : "CRM Dashboards"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isRtl ? "I18N_FALLBACK" : "Manage and customize your analytics dashboards."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
            <input
              type="text"
              placeholder={isRtl ? "I18N_FALLBACK" : "Search dashboards..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <Button onClick={() => setIsNewOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            {isRtl ? "I18N_FALLBACK" : "New Dashboard"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((dash) => (
          <Link key={dash.id} href={dash.id === "mega-crm-dashboard" ? "/crm/dashboard" : `/crm/dashboards/${dash.id}`}>
            <div
              className={`group relative bg-white dark:bg-gray-900 border ${
                dash.isMega ? "border-blue-500/60 ring-1 ring-blue-500/20" : "dark:border-gray-800 border-gray-200"
              } rounded-xl p-5 hover:shadow-lg hover:border-blue-500 transition-all cursor-pointer flex flex-col h-52`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`w-10 h-10 rounded-lg ${dash.isMega ? "bg-blue-600 text-white" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"} flex items-center justify-center`}>
                  {dash.isMega ? <Sparkles className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                </div>
                <div className="flex items-center gap-2">
                  {dash.isMega && (
                    <span className="text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {isRtl ? "I18N_FALLBACK" : "Mega"}
                    </span>
                  )}
                  {dash.favorite && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {dash.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
                {dash.description}
              </p>

              <div className="mt-4 pt-3 border-t dark:border-gray-800 flex justify-between items-center text-xs text-gray-500">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {dash.widgets} {isRtl ? "I18N_FALLBACK" : "widgets"}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                  {isRtl ? "I18N_FALLBACK" : "View Dashboard →"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <DashboardFormDialog
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        onSubmit={async (v) => console.log(v)}
      />
    </div>
  );
}
