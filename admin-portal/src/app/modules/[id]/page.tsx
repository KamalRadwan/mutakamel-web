"use client";

import { use } from "react";
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
  Filter 
} from "lucide-react";
import { useModuleDetail } from "./hooks/useModuleDetail";
import { useI18n } from "@/i18n/I18nContext";

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

    // Tier Modal States & Functions
    isAddTierOpen,
    setIsAddTierOpen,
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
    moveTierUp,
    moveTierDown,

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

    // Handlers
    toggleGrant,
    handleCreateTier,
    handleUpdateTier,
    handleDeleteTier,
    handleCreateFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    handleCreatePriceBracket,
    handleDeletePriceBracket,
    handleSaveTabChanges,
    onBack,
  } = useModuleDetail(id);
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
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
                  {moduleData.moduleName}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 font-mono font-bold text-blue-600">
                  {moduleData.moduleKey}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Category: {moduleData.category}
              </p>
            </div>
          </div>

          <span className="px-3 py-1 text-xs font-bold font-mono rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 self-start md:self-auto">
            STATUS: {moduleData.status}
          </span>
        </div>

        {/* Saved Toast Notification */}
        {isSaved && (
          <div className="p-3 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {lang === "ar"
                ? `تم حفظ تعديلات قسم (${saveTabMessage}) بنجاح!`
                : `Changes for tab (${saveTabMessage}) saved successfully!`}
            </span>
          </div>
        )}

        {/* Pricing Validation Error Alert */}
        {pricingValidationError && (
          <div className="p-3 text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pricingValidationError}</span>
          </div>
        )}

        {/* 5 Mandatory Section Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "preview"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.modules.sections.preview}
            </button>

            <button
              onClick={() => setActiveTab("tiers")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "tiers"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.modules.sections.tiers} ({tiers.length})
            </button>

            <button
              onClick={() => setActiveTab("features")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "features"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.modules.sections.features} ({features.length})
            </button>

            <button
              onClick={() => setActiveTab("grants")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "grants"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.modules.sections.grants}
            </button>

            <button
              onClick={() => setActiveTab("price")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "price"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.modules.sections.price}
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
                    value={moduleData.moduleKey}
                    disabled
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 border rounded-xl text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الموديول</label>
                  <input
                    type="text"
                    value={moduleData.moduleName}
                    onChange={(e) => setModuleData({ ...moduleData, moduleName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الوصف الوظيفي المباشر</label>
                <textarea
                  value={moduleData.description}
                  onChange={(e) => setModuleData({ ...moduleData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border rounded-xl"
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
                      <th className="pb-3 text-start w-20">{lang === "ar" ? "الترتيب" : "Reorder"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "اللون (Hex Color)" : "Color"}</th>
                      <th className="pb-3 text-start">رمز المستوى (key)</th>
                      <th className="pb-3 text-start">اسم المستوى (name)</th>
                      <th className="pb-3 text-start">الحالة (isActive)</th>
                      <th className="pb-3 text-end">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {tiers.map((tr, idx) => (
                      <tr key={tr.id} className="h-14 font-sans hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {/* Drag & Reorder Control */}
                        <td className="py-2.5 font-mono">
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveTierUp(idx)}
                                disabled={idx === 0}
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                                title="ترتيب للأعلى"
                              >
                                <ArrowUp className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTierDown(idx)}
                                disabled={idx === tiers.length - 1}
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                                title="ترتيب لأسفل"
                              >
                                <ArrowDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                              </button>
                            </div>
                          </div>
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
                        <td className="py-2.5 font-bold font-mono text-blue-600">{tr.tierKey}</td>
                        <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">{tr.tierName}</td>
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
                          <button
                            type="button"
                            onClick={() => setEditingTier({ ...tr })}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 me-1"
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
                      <th className="pb-3 text-start">رمز الميزة (key)</th>
                      <th className="pb-3 text-start">اسم الميزة والوصف</th>
                      <th className="pb-3 text-start">نوع القيمة (valueType)</th>
                      <th className="pb-3 text-start">القيمة الافتراضية</th>
                      <th className="pb-3 text-end">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {features.map((f) => (
                      <tr key={f.id} className="h-12 font-sans">
                        <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100">{f.featureKey}</td>
                        <td className="py-2.5">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{f.featureName}</div>
                          <div className="text-[11px] text-slate-400">{f.description}</div>
                        </td>
                        <td className="py-2.5 font-mono">
                          <span className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded font-bold text-purple-600">
                            {f.valueType}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-600">{f.defaultValue}</td>
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
                      <th className="pb-3 text-start">الميزة (Feature)</th>
                      {tiers.map((tr) => (
                        <th key={tr.id} className="pb-3 text-center font-bold text-blue-600">
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.color }} />
                            <span>{tr.tierKey}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {features.map((f) => (
                      <tr key={f.id} className="h-12">
                        <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100">{f.featureKey}</td>
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
                  onClick={() => setIsAddPriceBracketOpen(true)}
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
                  <span>{lang === "ar" ? "فلترة الفئات السعرية (Dual Filters):" : "Pricing Filters:"}</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Filter 1: Billing Cycle (MONTHLY / YEARLY) */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">1. الفوترة:</span>
                    <select
                      value={pricingCycleFilter}
                      onChange={(e) => setPricingCycleFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-purple-600"
                    >
                      <option value="ALL">جميع الدورات (ALL)</option>
                      <option value="MONTHLY">MONTHLY (شهري)</option>
                      <option value="YEARLY">YEARLY (سنوي)</option>
                    </select>
                  </div>

                  {/* Filter 2: Tier Package */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">2. المستوى:</span>
                    <select
                      value={pricingTierFilter}
                      onChange={(e) => setPricingTierFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-blue-600"
                    >
                      <option value="ALL">جميع المستويات (ALL)</option>
                      {tiers.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.tierName} ({tr.tierKey})</option>
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
                      <th className="pb-3 text-start">المستوى (Tier)</th>
                      <th className="pb-3 text-start">دورة الفوترة (billingCycle)</th>
                      <th className="pb-3 text-start">من مستخدم (minUsers)</th>
                      <th className="pb-3 text-start">إلى مستخدم (maxUsers)</th>
                      <th className="pb-3 text-start">سعر المقعد (unitPrice USD)</th>
                      <th className="pb-3 text-end">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {priceBrackets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                          لا توجد فئات سعرية مطابقة للفلاتر المحددة (سجل فئة جديدة وابدأ من مقعد 1).
                        </td>
                      </tr>
                    ) : (
                      priceBrackets.map((p) => {
                        const matchedTier = tiers.find((t) => t.id === p.tierId);
                        return (
                          <tr key={p.id} className="h-14 font-sans hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 font-bold font-mono text-blue-600">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchedTier?.color || "#0b6ff4" }} />
                                <span>{matchedTier?.tierKey || p.tierId}</span>
                              </div>
                            </td>
                            <td className="py-2.5 font-bold font-mono text-purple-600">{p.billingCycle}</td>
                            <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{p.minUsers} users</td>
                            <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {p.maxUsers === null ? <span className="text-blue-600 font-bold">∞ (مفتوح Infinity)</span> : `${p.maxUsers} users`}
                            </td>
                            <td className="py-2.5 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">${p.unitPriceUsd} USD / user</td>
                            <td className="py-2.5 text-end">
                              <button
                                type="button"
                                onClick={() => handleDeletePriceBracket(p.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="حذف الفئة السعرية"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      {/* Add Price Bracket Modal with NestJS Validations */}
      {isAddPriceBracketOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === "ar" ? "إضافة فئة سعرية للمقاعد (PriceBracketDto)" : "Add Price Bracket"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "ar" ? "قاعدة التحقق: الفئة الأولى تبدأ من 1، والفئة الأخيرة تكون ∞" : "Rule: First minUsers = 1, Final maxUsers = Infinity ∞"}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePriceBracket} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المستوى (Tier)</label>
                  <select
                    value={newBracketTierId}
                    onChange={(e) => setNewBracketTierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    {tiers.map((tr) => (
                      <option key={tr.id} value={tr.id}>{tr.tierName} ({tr.tierKey})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">دورة الفوترة (billingCycle)</label>
                  <select
                    value={newBracketCycle}
                    onChange={(e) => setNewBracketCycle(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    <option value="MONTHLY">MONTHLY (شهري)</option>
                    <option value="YEARLY">YEARLY (سنوي)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">من مستخدم (minUsers) *</label>
                  <input
                    type="number"
                    min={1}
                    value={newBracketMinUsers}
                    onChange={(e) => setNewBracketMinUsers(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">إلى مستخدم (maxUsers)</label>
                  <input
                    type="number"
                    disabled={newBracketIsInfinity}
                    value={newBracketIsInfinity || newBracketMaxUsers === null ? "" : newBracketMaxUsers}
                    onChange={(e) => setNewBracketMaxUsers(e.target.value === "" ? null : Number(e.target.value))}
                    placeholder={newBracketIsInfinity ? "مفتوح ∞" : "e.g. 50"}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newBracketIsInfinity}
                    onChange={(e) => {
                      setNewBracketIsInfinity(e.target.checked);
                      if (e.target.checked) setNewBracketMaxUsers(null);
                    }}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>فئة مفتوحة السقف المالانهاية (maxUsers = Infinity ∞ / null)</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">سعر المستخدم الفردي ($ USD / unitPrice) *</label>
                <input
                  type="text"
                  value={newBracketUnitPrice}
                  onChange={(e) => setNewBracketUnitPrice(e.target.value)}
                  placeholder="e.g. 12.50"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPriceBracketOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
                >
                  حفظ الفئة السعرية
                </button>
              </div>
            </form>
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
                  placeholder={`[\n  { "key": "${id}.custom_1", "name": "Feature Name", "valueType": "BOOLEAN", "defaultValue": "true" }\n]`}
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
                <span>تعديل بيانات المستوى ({editingTier.tierKey})</span>
              </h3>
              <button
                type="button"
                onClick={() => handleDeleteTier(editingTier.id)}
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
                  value={editingTier.tierName}
                  onChange={(e) => setEditingTier({ ...editingTier, tierName: e.target.value })}
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
                <span>تعديل الميزة ({editingFeature.featureKey})</span>
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
                  value={editingFeature.featureName}
                  onChange={(e) => setEditingFeature({ ...editingFeature, featureName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الوصف</label>
                <textarea
                  value={editingFeature.description}
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
    </div>
  );
}
