"use client";

import { use, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Package, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Loader2, 
  Award, 
  Sparkles, 
  ShieldCheck, 
  DollarSign, 
  Plus, 
  Check, 
  X, 
  Palette, 
  Edit, 
  Trash2, 
  GripVertical, 
  ArrowUp, 
  ArrowDown, 
  Upload, 
  Download, 
  FileJson, 
  Filter,
  History,
  Search
} from "lucide-react";
import { useModuleDetail } from "./hooks/useModuleDetail";
import { useI18n } from "@/i18n/I18nContext";
import { TierView } from "@/types/module";

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    t,
    moduleData,
    setModuleData,
    activeTab,
    setActiveTab,
    tiers,
    features,
    grants,
    priceBrackets,
    pricingTierFilter,
    setPricingTierFilter,
    pricingCycleFilter,
    setPricingCycleFilter,
    pricingValidationError,
    isSubmitting,
    isSaved,
    saveTabMessage,
    isLoading,
    error,
    editingTier,
    setEditingTier,
    newTierKey,
    setNewTierKey,
    newTierName,
    setNewTierName,
    newTierColor,
    setNewTierColor,
    newTierIsActive,
    setNewTierIsActive,
    // Tier Modal States & Functions
    isAddTierOpen,
    setIsAddTierOpen,

    // Feature Modal States & Import/Export Functions
    isAddFeatureOpen,
    setIsAddFeatureOpen,
    isImportFeaturesOpen,
    setIsImportFeaturesOpen,
    importJsonText,
    setImportJsonText,
    editingFeature,
    setEditingFeature,
    newFeatureKey,
    setNewFeatureKey,
    newFeatureName,
    setNewFeatureName,
    newFeatureType,
    setNewFeatureType,
    newFeatureDefault,
    setNewFeatureDefault,
    newFeatureDesc,
    setNewFeatureDesc,
    handleImportFeatures,
    handleExportFeatures,

    // Price Bracket States
    isAddPriceBracketOpen,
    setIsAddPriceBracketOpen,
    editingPriceBracket,
    setEditingPriceBracket,
    newBracketTierId,
    setNewBracketTierId,
    newBracketMinUsers,
    setNewBracketMinUsers,
    newBracketMaxUsers,
    setNewBracketMaxUsers,
    newBracketIsInfinity,
    setNewBracketIsInfinity,
    newBracketUnitPrice,
    setNewBracketUnitPrice,
    newBracketCycle,
    setNewBracketCycle,

    // Audit Log States
    auditLogs,
    auditFilter,
    setAuditFilter,
    auditSearch,
    setAuditSearch,

    // Handlers
    toggleGrant,
    handleCreateTier,
    handleUpdateTier,
    handleDeleteTier,
    handleCreateFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    openAddPriceBracketModal,
    handleCreatePriceBracket,
    handleUpdatePriceBracket,
    handleDeletePriceBracket,
    handleSaveTabChanges,
    onBack,
  } = useModuleDetail(id);
  const { lang } = useI18n();

  const [deletingTierTarget, setDeletingTierTarget] = useState<TierView | null>(null);
  const [deleteTierConfirmKeyInput, setDeleteTierConfirmKeyInput] = useState<string>("");

  if (isLoading && !moduleData) {
    return (
      <div className="flex flex-col flex-1 h-screen bg-slate-50 dark:bg-slate-950 items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">جاري تحميل بيانات الموديول...</p>
      </div>
    );
  }

  if (error || !moduleData) {
    return (
      <div className="flex flex-col flex-1 h-screen bg-slate-50 dark:bg-slate-950 items-center justify-center">
        <div className="text-rose-500 mb-4 font-bold">{error || "Module Not Found"}</div>
        <button onClick={onBack} className="text-blue-600 underline">العودة للكتالوج</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/90 dark:bg-[#090d16]" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6 pb-16 overflow-y-auto">
        {/* Header Title with Back Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {moduleData.name}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 font-mono font-bold text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                  {moduleData.key}
                </span>
              </div>
            </div>
          </div>

          <span className={`px-3 py-1 text-xs font-bold font-mono rounded-full self-start md:self-auto ${
            moduleData.isActive 
              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
          }`}>
            STATUS: {(moduleData.isActive ? "ACTIVE" : "INACTIVE")}
          </span>
        </div>



        {/* Section Navigation Tabs with Vibrant Color-Coded Themes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {/* 1. Preview */}
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "preview"
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Package className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{t.modules.sections.preview}</span>
            </button>

            {/* 2. Tiers */}
            <button
              onClick={() => setActiveTab("tiers")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "tiers"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Award className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t.modules.sections.tiers}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                activeTab === "tiers"
                  ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                ({tiers.length})
              </span>
            </button>

            {/* 3. Features */}
            <button
              onClick={() => setActiveTab("features")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "features"
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t.modules.sections.features}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                activeTab === "features"
                  ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                ({features.length})
              </span>
            </button>

            {/* 4. Grants */}
            <button
              onClick={() => setActiveTab("grants")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "grants"
                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
              <span>{t.modules.sections.grants}</span>
            </button>

            {/* 5. Pricing */}
            <button
              onClick={() => setActiveTab("price")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "price"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t.modules.sections.price}</span>
            </button>

            {/* 6. Changes History */}
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                activeTab === "history"
                  ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 shadow-2xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <History className="w-4 h-4 text-cyan-500 shrink-0" />
              <span>{t.modules.sections.history}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                activeTab === "history"
                  ? "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                ({auditLogs.length})
              </span>
            </button>
          </div>
        </div>

        {/* Section 1: Preview */}
        {activeTab === "preview" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{lang === "ar" ? "بيانات الموديول ومعاينة النواة الأساسية" : "Module Identity & Preview Metadata"}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز الموديول (moduleKey)</label>
                  <input
                    type="text"
                    value={moduleData.key}
                    disabled
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium opacity-90 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الموديول</label>
                  <input
                    type="text"
                    value={moduleData.name}
                    onChange={(e) => setModuleData({ ...moduleData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الوصف الوظيفي المباشر</label>
                <textarea
                  value={moduleData.description || ""}
                  onChange={(e) => setModuleData({ ...moduleData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* MANDATORY SAVE BUTTON IN PREVIEW */}
            <div className="flex justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSaveTabChanges("Preview")}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{lang === "ar" ? "حفظ تعديلات المعاينة (Save Preview)" : "Save Preview Changes"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 2: Tiers (Rank Column Removed - Drag & Drop Reorder Handles Enabled) */}
        {activeTab === "tiers" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{lang === "ar" ? "مستويات الموديول وإعادة الترتيب (Drag & Rank Reorder Tiers)" : "Module Tier Packages & Rank Reorder"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddTierOpen(true)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === "ar" ? "+ إضافة مستوى جديد (Add Tier)" : "+ Add New Tier"}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                      <th className="pb-3 text-center w-20">{lang === "ar" ? "الترتيب" : "Rank"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "اللون" : "Color"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "رمز المستوى" : "Tier Key"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "اسم المستوى" : "Tier Name"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                      <th className="pb-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {tiers.map((tr, idx) => (
                      <tr key={tr.id} className="h-14 font-sans hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {/* Rank Display (No Reorder) */}
                        <td className="py-2.5 font-mono text-slate-500 text-center">
                          {tr.rank}
                        </td>

                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-full border shadow-2xs shrink-0"
                              style={{ backgroundColor: tr.color }}
                            />
                            <span className="text-slate-500 font-mono text-[11px]">{tr.color}</span>
                          </div>
                        </td>
                        <td className="py-2.5 font-bold font-mono text-blue-600">{tr.key}</td>
                        <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">{tr.name}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full font-mono ${
                              tr.isActive
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}
                          >
                            {tr.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="py-2.5 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingTier({ ...tr })}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "تعديل" : "Edit"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingTierTarget(tr);
                                setDeleteTierConfirmKeyInput("");
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              title={lang === "ar" ? "حذف المستوى" : "Delete Tier"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "حذف" : "Delete"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANDATORY SAVE BUTTON IN TIERS */}
            <div className="flex justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSaveTabChanges("Tiers")}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{lang === "ar" ? "حفظ تعديلات المستويات (Save Tiers)" : "Save Tiers Changes"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 3: Features */}
        {activeTab === "features" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{lang === "ar" ? "دليل الميزات والقدرات المضمنة (Feature Flags Catalogue)" : "Module Feature Flags Catalogue"}</span>
                </h3>

                {/* Import & Export Action Buttons toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportFeatures}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    <span>{lang === "ar" ? "تصدير الميزات (Export)" : "Export JSON"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImportFeaturesOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-purple-200 dark:border-purple-800"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "استيراد ميزات (Import)" : "Import JSON"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddFeatureOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "+ إضافة ميزة جديدة" : "+ Add Feature"}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                      <th className="pb-3 text-start">{lang === "ar" ? "رمز الميزة" : "Feature Key"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "اسم الميزة والوصف" : "Name & Description"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "رمز القيمة" : "Type Code"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "القيمة الافتراضية" : "Default Value"}</th>
                      <th className="pb-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {features.map((f) => (
                      <tr key={f.id} className="h-12 font-sans">
                        <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100">{f.key}</td>
                        <td className="py-2.5">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{f.name}</div>
                          <div className="text-[11px] text-slate-400">{f.description}</div>
                        </td>
                        <td className="py-2.5 font-mono">
                          <span className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded font-bold text-purple-600">
                            {f.key}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-600">{f.key}</td>
                        <td className="py-2.5 text-end">
                          <button
                            type="button"
                            onClick={() => setEditingFeature({ ...f })}
                            className="px-2.5 py-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 me-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANDATORY SAVE BUTTON IN FEATURES */}
            <div className="flex justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSaveTabChanges("Features")}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{lang === "ar" ? "حفظ تعديلات الميزات (Save Features)" : "Save Features Changes"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 4: Grants */}
        {activeTab === "grants" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{lang === "ar" ? "مصفوفة تفعيل أذونات الميزات للمستويات (SetTierFeaturesDto Matrix)" : "Tier-to-Feature Permission Grants Matrix"}</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                      <th className="pb-3 text-start">{lang === "ar" ? "الميزة" : "Feature"}</th>
                      {tiers.map((tr) => (
                        <th key={tr.id} className="pb-3 text-center font-bold text-blue-600">
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.color }} />
                            <span>{tr.key}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {features.map((f) => (
                      <tr key={f.id} className="h-12">
                        <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100">{f.key}</td>
                        {tiers.map((tr) => {
                          const g = grants.find((gr) => gr.tierId === tr.id && gr.featureId === f.id);
                          const isGranted = g?.isEnabled ?? false;
                          return (
                            <td key={tr.id} className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleGrant(tr.id, f.id)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  isGranted
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 border-emerald-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                {isGranted ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANDATORY SAVE BUTTON IN GRANTS */}
            <div className="flex justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSaveTabChanges("Grants Matrix")}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{lang === "ar" ? "حفظ مصفوفة الأذونات (Save Grants)" : "Save Grants Matrix"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 5: Price Brackets (Dual Filters: 1: Cycle MONTHLY/YEARLY, 2: Tier) */}
        {activeTab === "price" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === "ar" ? "سلّم الأسعار التدرجي للمقاعد (Graduated Price Brackets: PriceBracketDto)" : "Graduated Volume Price Brackets"}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {lang === "ar" ? "قاعدة التحقق: الفئة الأولى تبدأ من 1، والفئة الأخيرة تكون مفتوحة السقف ∞" : "Validation rule: first minUsers = 1, final maxUsers = Infinity ∞"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openAddPriceBracketModal()}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === "ar" ? "+ إضافة فئة سعرية" : "+ Add Price Bracket"}</span>
                </button>
              </div>

              {/* DUAL FILTERS TOOLBAR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  <Filter className="w-3.5 h-3.5 text-blue-500" />
                  <span>{lang === "ar" ? "فلترة الفئات السعرية:" : "Pricing Filters:"}</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Filter 1: Billing Cycle (MONTHLY / ANNUAL) */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">{lang === "ar" ? "1. الفوترة:" : "1. Cycle:"}</span>
                    <select
                      value={pricingCycleFilter}
                      onChange={(e) => setPricingCycleFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-purple-600"
                    >
                      <option value="ALL">{lang === "ar" ? "جميع الدورات (ALL)" : "ALL Cycles"}</option>
                      <option value="MONTHLY">{lang === "ar" ? "MONTHLY (شهري)" : "MONTHLY"}</option>
                      <option value="YEARLY">{lang === "ar" ? "ANNUAL (سنوي)" : "ANNUAL"}</option>
                    </select>
                  </div>

                  {/* Filter 2: Tier Package */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">{lang === "ar" ? "2. المستوى:" : "2. Tier:"}</span>
                    <select
                      value={pricingTierFilter}
                      onChange={(e) => setPricingTierFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-blue-600"
                    >
                      <option value="ALL">{lang === "ar" ? "جميع المستويات (ALL)" : "ALL Tiers"}</option>
                      {tiers.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.name} ({tr.key})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Price Brackets Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                      <th className="pb-3 text-start">{lang === "ar" ? "المستوى" : "Tier"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "دورة الفوترة" : "Billing Cycle"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "من مقعد" : "Min Seats"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "إلى مقعد" : "Max Seats"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "سعر المقعد (USD)" : "Unit Price (USD)"}</th>
                      <th className="pb-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {priceBrackets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                          {lang === "ar"
                            ? "لا توجد فئات سعرية مطابقة للفلاتر المحددة."
                            : "No matching price brackets found for selected filters."}
                        </td>
                      </tr>
                    ) : (
                      priceBrackets.map((p) => {
                        const matchedTier = tiers.find((t) => t.id === p.tierId);

                        // Only allow delete for the LAST bracket in the sequence for tier & cycle
                        const tierCycleBrackets = priceBrackets
                          .filter((b) => b.tierId === p.tierId && b.billingCycle === p.billingCycle)
                          .sort((a, b) => a.minUsers - b.minUsers);
                        const isLastBracket = tierCycleBrackets.length > 0 && tierCycleBrackets[tierCycleBrackets.length - 1].id === p.id;

                        return (
                          <tr key={p.id} className="h-14 font-sans hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 font-bold font-mono text-blue-600">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchedTier?.color || "#0b6ff4" }} />
                                <span>{matchedTier?.key || p.tierId}</span>
                              </div>
                            </td>
                            <td className="py-2.5 font-bold font-mono text-purple-600">{p.billingCycle}</td>
                            <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{p.minUsers} users</td>
                            <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {p.maxUsers === null ? <span className="text-blue-600 font-bold">∞ (مفتوح Infinity)</span> : `${p.maxUsers} users`}
                            </td>
                            <td className="py-2.5 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">${p.unitPriceUsd} USD / user</td>
                            <td className="py-2.5 text-end">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingPriceBracket({ ...p })}
                                  className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title={lang === "ar" ? "تعديل الفئة السعرية" : "Edit Price Bracket"}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>{lang === "ar" ? "تعديل" : "Edit"}</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={!isLastBracket}
                                  onClick={() => handleDeletePriceBracket(p.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isLastBracket
                                      ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                                      : "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40"
                                  }`}
                                  title={
                                    isLastBracket
                                      ? (lang === "ar" ? "حذف الفئة السعرية" : "Delete Price Bracket")
                                      : (lang === "ar" ? "يسمح فقط بحذف الفئة الأخيرة في التسلسل" : "Only the last bracket can be deleted")
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANDATORY SAVE BUTTON IN PRICE */}
            <div className="flex justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSaveTabChanges("Price Brackets")}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{lang === "ar" ? "حفظ الفئات السعرية (Save Price Brackets)" : "Save Price Brackets"}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Add Price Bracket Modal with Live Red Validation Highlights & Rules 1-4 */}
      {isAddPriceBracketOpen && (() => {
        const existingForTierAndCycle = priceBrackets
          .filter((p) => p.tierId === newBracketTierId && p.billingCycle === newBracketCycle)
          .sort((a, b) => a.minUsers - b.minUsers);

        const lastBracket = existingForTierAndCycle.length > 0 ? existingForTierAndCycle[existingForTierAndCycle.length - 1] : null;

        // Rule 4: Infinity found -> Block adding new bracket
        const hasInfinityPrevious = lastBracket !== null && lastBracket.maxUsers === null;

        // Rule 1 & Rule 3: Expected Min Users calculation
        const expectedMin = existingForTierAndCycle.length === 0 ? 1 : (lastBracket ? lastBracket.maxUsers! + 1 : 1);

        const isMinValid = !hasInfinityPrevious && newBracketMinUsers === expectedMin;
        const isMaxValid = newBracketIsInfinity || (newBracketMaxUsers !== null && newBracketMaxUsers > newBracketMinUsers);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {lang === "ar" ? "إضافة فئة سعرية جديدة" : "Add New Price Bracket"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === "ar" ? "تطبيق قواعد التسلسل والتحقق للمقاعد" : "Enforces seat ladder sequence & limits"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPriceBracketOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePriceBracket} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "المستوى" : "Tier Package"}
                    </label>
                    <select
                      value={newBracketTierId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setNewBracketTierId(targetId);
                        const existing = priceBrackets.filter((p) => p.tierId === targetId && p.billingCycle === newBracketCycle).sort((a, b) => a.minUsers - b.minUsers);
                        if (existing.length === 0) {
                          setNewBracketMinUsers(1);
                          setNewBracketMaxUsers(10);
                          setNewBracketIsInfinity(false);
                        } else {
                          const last = existing[existing.length - 1];
                          if (last.maxUsers !== null) {
                            setNewBracketMinUsers(last.maxUsers + 1);
                            setNewBracketMaxUsers(last.maxUsers + 10);
                            setNewBracketIsInfinity(false);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    >
                      {tiers.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.name} ({tr.key})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "دورة الفوترة" : "Billing Cycle"}
                    </label>
                    <select
                      value={newBracketCycle}
                      onChange={(e) => {
                        const targetCycle = e.target.value as "MONTHLY" | "ANNUAL";
                        setNewBracketCycle(targetCycle);
                        const existing = priceBrackets.filter((p) => p.tierId === newBracketTierId && p.billingCycle === targetCycle).sort((a, b) => a.minUsers - b.minUsers);
                        if (existing.length === 0) {
                          setNewBracketMinUsers(1);
                          setNewBracketMaxUsers(10);
                          setNewBracketIsInfinity(false);
                        } else {
                          const last = existing[existing.length - 1];
                          if (last.maxUsers !== null) {
                            setNewBracketMinUsers(last.maxUsers + 1);
                            setNewBracketMaxUsers(last.maxUsers + 10);
                            setNewBracketIsInfinity(false);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="MONTHLY">{lang === "ar" ? "MONTHLY (شهري)" : "MONTHLY"}</option>
                      <option value="ANNUAL">{lang === "ar" ? "ANNUAL (سنوي)" : "ANNUAL"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "من مقعد *" : "Min Seats *"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newBracketMinUsers}
                      onChange={(e) => setNewBracketMinUsers(Number(e.target.value))}
                      className={`w-full px-3 py-2 text-xs font-mono rounded-xl border transition-colors ${
                        !isMinValid
                          ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-100 ring-2 ring-rose-500/50 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      }`}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "إلى مقعد" : "Max Seats"}
                    </label>
                    <input
                      type="number"
                      disabled={newBracketIsInfinity}
                      value={newBracketIsInfinity || newBracketMaxUsers === null ? "" : newBracketMaxUsers}
                      onChange={(e) => setNewBracketMaxUsers(e.target.value === "" ? null : Number(e.target.value))}
                      placeholder={newBracketIsInfinity ? "∞ Infinity" : "e.g. 50"}
                      className={`w-full px-3 py-2 text-xs font-mono rounded-xl border transition-colors disabled:opacity-40 ${
                        !isMaxValid
                          ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-100 ring-2 ring-rose-500/50 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 select-none">
                    <input
                      type="checkbox"
                      checked={newBracketIsInfinity}
                      onChange={(e) => {
                        setNewBracketIsInfinity(e.target.checked);
                        if (e.target.checked) setNewBracketMaxUsers(null);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{lang === "ar" ? "فئة غير محدودة المقاعد (∞ Infinity)" : "Unlimited / Open-ended Seats (∞ Infinity)"}</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === "ar" ? "سعر المقعد (USD) *" : "Seat Unit Price (USD) *"}
                  </label>
                  <input
                    type="text"
                    value={newBracketUnitPrice}
                    onChange={(e) => setNewBracketUnitPrice(e.target.value)}
                    placeholder="e.g. 15.0000"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddPriceBracketOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={hasInfinityPrevious || !isMinValid || !isMaxValid}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {lang === "ar" ? "إضافة الفئة السعرية" : "Add Price Bracket"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Section 6: Audit Log (Changes History) */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{lang === "ar" ? "سجل التغييرات وعمليات التدقيق (Audit Log History)" : "Module Audit Log & Changes History"}</span>
              </h3>

              {/* Filter and Search controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={lang === "ar" ? "بحث بالسجل..." : "Search history..."}
                    className="pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>

                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="ALL">{lang === "ar" ? "جميع الأحداث" : "All Categories"}</option>
                  <option value="MODULE">MODULE</option>
                  <option value="TIER">TIER</option>
                  <option value="FEATURE">FEATURE</option>
                  <option value="GRANT">GRANT</option>
                  <option value="PRICE">PRICE</option>
                </select>
              </div>
            </div>

            {/* Timeline View */}
            {(() => {
              const filteredLogs = auditLogs.filter((log) => {
                const matchesCat = auditFilter === "ALL" || log.entityType === auditFilter;
                const matchesQuery = !auditSearch || 
                  log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                  (log.actorLabel && log.actorLabel.toLowerCase().includes(auditSearch.toLowerCase()));
                return matchesCat && matchesQuery;
              });

              if (filteredLogs.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400">
                    {lang === "ar" ? "لا توجد سجلات تدقيق مطابقة." : "No matching audit log entries found."}
                  </div>
                );
              }

              return (
                <div className="relative pl-6 rtl:pl-0 rtl:pr-6 border-l-2 rtl:border-l-0 rtl:border-r-2 border-slate-200 dark:border-slate-800 space-y-6 my-2">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="relative group">
                      {/* Timeline Bullet Dot */}
                      <div className={`absolute -left-[31px] rtl:-left-auto rtl:-right-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${
                        log.entityType === "MODULE" || log.entityType === "MODULE_ORDER" ? "border-blue-500 text-blue-500" :
                        log.entityType === "TIER" ? "border-emerald-500 text-emerald-500" :
                        log.entityType === "FEATURE" ? "border-purple-500 text-purple-500" :
                        log.entityType === "PRICE_LADDER" ? "border-amber-500 text-amber-500" :
                        "border-cyan-500 text-cyan-500"
                      }`} />

                      <div className="bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 transition-all space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold font-mono rounded-md ${
                              log.entityType === "MODULE" || log.entityType === "MODULE_ORDER" ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400" :
                              log.entityType === "TIER" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" :
                              log.entityType === "FEATURE" ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400" :
                              log.entityType === "PRICE_LADDER" ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400" :
                              "bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400"
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {log.actorLabel || "System"}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <span>{new Date(log.occurredAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {log.diff && log.diff.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {log.diff.map((c, idx) => {
                              const beforeStr = typeof c.before === 'object' ? JSON.stringify(c.before) : String(c.before ?? "null");
                              const afterStr = typeof c.after === 'object' ? JSON.stringify(c.after) : String(c.after ?? "null");
                              return (
                                <span key={idx} className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-mono">
                                  {c.field}: <span className="line-through text-slate-400 me-1">{beforeStr}</span> &rarr; <span className="font-semibold text-slate-900 dark:text-slate-200">{afterStr}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-800/40 mt-2">
                          {log.sourceType && <span>Source: {log.sourceType}</span>}
                          {log.correlationId && <span>Correlation: {log.correlationId}</span>}
                          {log.operationId && <span>Operation: {log.operationId}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Import Features Modal */}
      {isImportFeaturesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <FileJson className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "استيراد كتلة ميزات برمجيّة (Bulk Import Features)" : "Bulk Import Feature Flags"}
              </h3>
            </div>

            <form onSubmit={handleImportFeatures} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الصق نص الـ JSON الخاص بالميزات</label>
                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[\n  { "key": "${id}.custom_1", "name": "Feature Name", "key": "BOOLEAN", "key": "true" }\n]`}
                  rows={8}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportFeaturesOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md"
                >
                  استيراد الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tier Modal */}
      {isAddTierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Award className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "إضافة مستوى موديول جديد (CreateTierDto)" : "Register New Tier Package"}
              </h3>
            </div>

            <form onSubmit={handleCreateTier} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز المستوى (key) *</label>
                  <input
                    type="text"
                    value={newTierKey}
                    onChange={(e) => setNewTierKey(e.target.value)}
                    placeholder="e.g. enterprise_plus"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-purple-500" />
                    <span>اللون</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={newTierColor}
                      onChange={(e) => setNewTierColor(e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={newTierColor}
                      onChange={(e) => setNewTierColor(e.target.value)}
                      className="w-full px-2 py-1 text-[11px] font-mono bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستوى (name) *</label>
                <input
                  type="text"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  placeholder="e.g. حزمة المؤسسات الاحترافية"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newTierIsActive}
                    onChange={(e) => setNewTierIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span>مستوى نشط (isActive)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTierOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
                >
                  حفظ المستوى
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tier Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-600" />
                <span>تعديل بيانات المستوى ({editingTier.key})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDeletingTierTarget(editingTier);
                  setDeleteTierConfirmKeyInput("");
                  setEditingTier(null);
                }}
                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                title="حذف المستوى"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTier} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستوى (name)</label>
                <input
                  type="text"
                  value={editingTier.name}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-purple-500" />
                  <span>اللون (color Hex)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editingTier.color}
                    onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                    className="w-9 h-9 rounded border cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={editingTier.color}
                    onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingTier.isActive}
                    onChange={(e) => setEditingTier({ ...editingTier, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>مستوى نشط (isActive)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  تأكيد الحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Feature Modal Drawer */}
      {isAddFeatureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "إضافة ميزة جديدة (CreateFeatureDto)" : "Register New Feature Flag"}
              </h3>
            </div>

            <form onSubmit={handleCreateFeature} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز الميزة (key - dot scoped) *</label>
                <input
                  type="text"
                  value={newFeatureKey}
                  onChange={(e) => setNewFeatureKey(e.target.value)}
                  placeholder="e.g. crm.leads.export"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الميزة *</label>
                <input
                  type="text"
                  value={newFeatureName}
                  onChange={(e) => setNewFeatureName(e.target.value)}
                  placeholder="e.g. تصدير بيانات العملاء"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع القيمة</label>
                  <select
                    value={newFeatureType}
                    onChange={(e) => setNewFeatureType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="NUMERIC_LIMIT">NUMERIC_LIMIT</option>
                    <option value="TEXT_SET">TEXT_SET</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">القيمة الافتراضية</label>
                  <input
                    type="text"
                    value={newFeatureDefault}
                    onChange={(e) => setNewFeatureDefault(e.target.value)}
                    placeholder="e.g. true / 50"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">وصف الميزة</label>
                <textarea
                  value={newFeatureDesc}
                  onChange={(e) => setNewFeatureDesc(e.target.value)}
                  placeholder="أدخل الوصف الوظيفي للميزة..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFeatureOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md"
                >
                  حفظ الميزة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Feature Modal */}
      {editingFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-600" />
                <span>تعديل الميزة ({editingFeature.key})</span>
              </h3>
              <button
                type="button"
                onClick={() => handleDeleteFeature(editingFeature.id)}
                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                title="حذف الميزة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateFeature} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الميزة (name)</label>
                <input
                  type="text"
                  value={editingFeature.name}
                  onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الوصف</label>
                <textarea
                  value={editingFeature.description || ""}
                  onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFeature(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md"
                >
                  تأكيد الحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Tier Confirmation Modal (Confirm by key) */}
      {deletingTierTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === "ar"
                    ? `تأكيد حذف المستوى (${deletingTierTarget.key})`
                    : `Confirm Delete Tier (${deletingTierTarget.key})`}
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                  {lang === "ar"
                    ? "إجراء حساس: سيتم إزالة هذا المستوى نهائياً."
                    : "Sensitive action: This tier will be deleted permanently."}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {lang === "ar"
                  ? `لتأكيد عملية الحذف، يرجى كتابة رمز المستوى البرمجي`
                  : `To confirm deletion, please type the exact tier key`}{" "}
                <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                  {deletingTierTarget.key}
                </span>{" "}
                {lang === "ar" ? "أدناه:" : "below:"}
              </p>

              <input
                type="text"
                value={deleteTierConfirmKeyInput}
                onChange={(e) => setDeleteTierConfirmKeyInput(e.target.value)}
                placeholder={deletingTierTarget.key}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTierTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {lang === "ar" ? "إلغاء الإجراء" : "Cancel"}
              </button>

              <button
                type="button"
                disabled={deleteTierConfirmKeyInput !== deletingTierTarget.key}
                onClick={async () => {
                  await handleDeleteTier(deletingTierTarget.id);
                  setDeletingTierTarget(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md cursor-pointer transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === "ar" ? "حذف المستوى الآن" : "Delete Tier Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Price Bracket Modal */}
      {editingPriceBracket && (() => {
        const otherBrackets = priceBrackets
          .filter((p) => p.id !== editingPriceBracket.id && p.tierId === editingPriceBracket.tierId && p.billingCycle === editingPriceBracket.billingCycle)
          .sort((a, b) => a.minUsers - b.minUsers);

        const isMinValid = editingPriceBracket.minUsers >= 1;
        const isMaxValid = editingPriceBracket.maxUsers === null || editingPriceBracket.maxUsers > editingPriceBracket.minUsers;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-emerald-600" />
                  <span>{lang === "ar" ? "تعديل الفئة السعرية" : "Edit Price Bracket"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPriceBracket(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdatePriceBracket} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "المستوى" : "Tier Package"}
                    </label>
                    <select
                      value={editingPriceBracket.tierId}
                      onChange={(e) => setEditingPriceBracket({ ...editingPriceBracket, tierId: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    >
                      {tiers.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.name} ({tr.key})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "دورة الفوترة" : "Billing Cycle"}
                    </label>
                    <select
                      value={editingPriceBracket.billingCycle}
                      onChange={(e) => setEditingPriceBracket({ ...editingPriceBracket, billingCycle: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="MONTHLY">{lang === "ar" ? "MONTHLY (شهري)" : "MONTHLY"}</option>
                      <option value="ANNUAL">{lang === "ar" ? "ANNUAL (سنوي)" : "ANNUAL"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "من مقعد *" : "Min Seats *"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editingPriceBracket.minUsers}
                      onChange={(e) => setEditingPriceBracket({ ...editingPriceBracket, minUsers: Number(e.target.value) })}
                      className={`w-full px-3 py-2 text-xs font-mono rounded-xl border transition-colors ${
                        !isMinValid
                          ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-100 ring-2 ring-rose-500/50 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      }`}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "إلى مقعد" : "Max Seats"}
                    </label>
                    <input
                      type="number"
                      disabled={editingPriceBracket.maxUsers === null}
                      value={editingPriceBracket.maxUsers === null ? "" : editingPriceBracket.maxUsers}
                      onChange={(e) =>
                        setEditingPriceBracket({
                          ...editingPriceBracket,
                          maxUsers: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="∞ Infinity"
                      className={`w-full px-3 py-2 text-xs font-mono rounded-xl border transition-colors disabled:opacity-40 ${
                        !isMaxValid
                          ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-100 ring-2 ring-rose-500/50 font-extrabold"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 select-none">
                    <input
                      type="checkbox"
                      checked={editingPriceBracket.maxUsers === null}
                      onChange={(e) =>
                        setEditingPriceBracket({
                          ...editingPriceBracket,
                          maxUsers: e.target.checked ? null : editingPriceBracket.minUsers + 9,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{lang === "ar" ? "فئة غير محدودة المقاعد (∞ Infinity)" : "Unlimited / Open-ended Seats (∞ Infinity)"}</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === "ar" ? "سعر المقعد (USD) *" : "Seat Unit Price (USD) *"}
                  </label>
                  <input
                    type="text"
                    value={editingPriceBracket.unitPriceUsd ?? ""}
                    onChange={(e) => setEditingPriceBracket({ ...editingPriceBracket, unitPriceUsd: e.target.value })}
                    placeholder="e.g. 15.0000"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingPriceBracket(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={!isMinValid || !isMaxValid}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
