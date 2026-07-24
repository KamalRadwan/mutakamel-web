"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Package, 
  Search, 
  Plus, 
  Sparkles, 
  Award, 
  ChevronRight, 
  ChevronLeft, 
  SlidersHorizontal, 
  ArrowUp, 
  ArrowDown, 
  GripVertical, 
  ExternalLink 
} from "lucide-react";
import { useModules } from "./hooks/useModules";
import { ModuleSummary } from "./components/ModuleSummary";
import { useI18n } from "@/i18n/I18nContext";

export default function ModulesPage() {
  const {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    isCreateOpen,
    setIsCreateOpen,
    newKey,
    setNewKey,
    newName,
    setNewName,
    newDesc,
    setNewDesc,
    modules,
    summaryMetrics,
    moveRankUp,
    moveRankDown,
    handleCreateSubmit,
  } = useModules();
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Page Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {t.modules.pageTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.modules.pageSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.modules.registerModule}</span>
          </button>
        </div>

        {/* KPI Metrics Summary Bar */}
        <ModuleSummary metrics={summaryMetrics} />

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.modules.searchPlaceholder}
              className="w-full ps-9 pe-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
              <span>الحالة:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">{t.modules.allStatuses}</option>
              <option value="ACTIVE">ACTIVE (نشط)</option>
              <option value="BETA">BETA (تجريبي)</option>
              <option value="DEPRECATED">DEPRECATED (مهجور)</option>
            </select>
          </div>
        </div>

        {/* Modules High-Density Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === "ar" ? "جدول كتالوج الموديولات وإعادة الترتيب (Drag & Rank Reorder)" : "Modules Directory Table & Rank Reordering"}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{modules.length} modules</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                  <th className="pb-3 text-start w-24">{lang === "ar" ? "الترتيب (Rank)" : "Rank"}</th>
                  <th className="pb-3 text-start">{t.modules.moduleName}</th>
                  <th className="pb-3 text-start">{t.modules.description}</th>
                  <th className="pb-3 text-start">{t.modules.tiersCount}</th>
                  <th className="pb-3 text-start">{t.modules.featuresCount}</th>
                  <th className="pb-3 text-start">{t.modules.status}</th>
                  <th className="pb-3 text-end">{t.modules.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {modules.map((mod, idx) => (
                  <tr key={mod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 h-14 transition-colors">
                    {/* Rank Reordering Column */}
                    <td className="py-2.5 font-mono">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-slate-100 w-5 text-center">#{mod.rank}</span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveRankUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                            title="ترتيب للأعلى"
                          >
                            <ArrowUp className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRankDown(idx)}
                            disabled={idx === modules.length - 1}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                            title="ترتيب لأسفل"
                          >
                            <ArrowDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Module Key & Name */}
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-1 text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                          {mod.moduleKey}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{mod.moduleName}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-2.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {mod.description}
                    </td>

                    {/* Tiers Count */}
                    <td className="py-2.5 font-mono">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200/50 dark:border-emerald-800/50">
                        <Award className="w-3 h-3" />
                        <span>{mod.tiersCount} Tiers</span>
                      </span>
                    </td>

                    {/* Features Count */}
                    <td className="py-2.5 font-mono">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold border border-amber-200/50 dark:border-amber-800/50">
                        <Sparkles className="w-3 h-3" />
                        <span>{mod.featuresCount} Flags</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5">
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-full font-mono ${
                          mod.status === "ACTIVE"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                            : mod.status === "BETA"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {mod.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 text-end">
                      <Link
                        href={`/modules/${mod.moduleKey}`}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{lang === "ar" ? "فتح الموديول (5 أقسام)" : "Open Module"}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Module Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.modules.createTitle}
              </h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.modules.moduleKey}
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. analytics"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.modules.moduleNameInput}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. الذكاء الاصطناعي والتحليلات (Analytics)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.modules.description}
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="أدخل الوصف الوظيفي للموديول..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  {t.modules.saveModule}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
