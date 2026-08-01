"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Package, 
  Search, 
  Plus, 
  SlidersHorizontal, 
  GripVertical, 
  ExternalLink 
} from "lucide-react";
import { useModules } from "./hooks/useModules";
import { ModuleSummary } from "./components/ModuleSummary";
import { useI18n } from "@/i18n/I18nContext";

export default function ModulesPage() {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{
    sourceIndex: number;
    targetIndex: number;
    name: string;
    oldRank: number;
    newRank: number;
  } | null>(null);

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
    isLoading,
    error,
    isSubmitting,
    reorderModules,
    handleCreateSubmit,
  } = useModules();
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-100/90 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Page Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t.modules.pageTitle}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.modules.pageSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.modules.searchPlaceholder}
              className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-2 rtl:mr-2 rtl:ml-0" />
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {t.modules.allStatuses}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === "ACTIVE"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {lang === "ar" ? "النشطة فقط" : "Active Only"}
              </button>
            </div>
          </div>
        </div>

        {/* Modules Directory List Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === "ar" ? "جدول كتالوج الموديولات (سحب وإفلات لإعادة الترتيب)" : "Modules Directory Table (Drag & Drop to Reorder)"}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {isLoading ? "..." : modules.length} modules
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                  <th className="pb-3 text-center w-12"></th>
                  <th className="pb-3 text-start">{t.modules.moduleName}</th>
                  <th className="pb-3 text-start">{t.modules.description}</th>
                  <th className="pb-3 text-start">{t.modules.status}</th>
                  <th className="pb-3 text-end">{t.modules.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>{lang === "ar" ? "جاري تحميل الموديولات..." : "Loading modules..."}</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-rose-500 font-bold">
                      {error}
                    </td>
                  </tr>
                ) : modules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {lang === "ar" ? "لا توجد موديولات لعرضها." : "No modules to display."}
                    </td>
                  </tr>
                ) : (
                  modules.map((mod, idx) => (
                  <tr 
                    key={mod.id} 
                    draggable
                    onDragStart={(e) => {
                      setDraggedIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `${idx}`);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverIdx !== idx) {
                        setDragOverIdx(idx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) {
                        setDragOverIdx(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== idx) {
                        const sourceMod = modules[draggedIdx];
                        const targetMod = modules[idx];
                        setPendingReorder({
                          sourceIndex: draggedIdx,
                          targetIndex: idx,
                          name: sourceMod.moduleName,
                          oldRank: sourceMod.rank,
                          newRank: targetMod.rank,
                        });
                      }
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`h-14 transition-colors ${
                      draggedIdx === idx ? "opacity-40 bg-blue-50/30 dark:bg-blue-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    } ${
                      dragOverIdx === idx ? "border-t-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/40" : ""
                    }`}
                  >
                    {/* Drag Handle Column */}
                    <td className="py-2.5 w-12 text-center">
                      <div 
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors"
                        title={lang === "ar" ? "سحب وإفلات لإعادة الترتيب" : "Drag to reorder"}
                      >
                        <GripVertical className="w-4 h-4 shrink-0" />
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

                    {/* Status Column */}
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
                        href={`/modules/${mod.id}`}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{lang === "ar" ? "فتح الموديول (5 أقسام)" : "Open Module"}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )))}
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
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md"
                >
                  {isSubmitting ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : t.modules.saveModule}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reorder Confirmation Modal */}
      {pendingReorder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
                <GripVertical className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "تأكيد إعادة الترتيب" : "Confirm Reorder"}
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === "ar" ? (
                <>
                  هل أنت تأكد من نقل <strong className="text-slate-900 dark:text-slate-100">{pendingReorder.name}</strong> من الترتيب <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{pendingReorder.oldRank}</span> إلى الترتيب <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{pendingReorder.newRank}</span>؟
                </>
              ) : (
                <>
                  Are you sure you want to move <strong className="text-slate-900 dark:text-slate-100">{pendingReorder.name}</strong> from Rank <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{pendingReorder.oldRank}</span> to Rank <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{pendingReorder.newRank}</span>?
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingReorder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { sourceIndex, targetIndex } = pendingReorder;
                  setPendingReorder(null);
                  await reorderModules(sourceIndex, targetIndex);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                {lang === "ar" ? "تأكيد النقل" : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
