"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import {
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Save,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CheckCircle2,
  Lock,
  Search,
  Info,
  ShieldCheck,
  Check,
  Zap,
  Sparkles
} from "lucide-react";
import { useRoleDetail } from "../hooks/useRoleDetail";
import { getPermissionName } from "@/lib/auth/rbac";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    lang,
    router,
    name,
    setName,
    description,
    setDescription,
    isSystem,
    isSuperAdmin,
    search,
    setSearch,
    groupedPermissions,
    assignedPermissions,
    catalogueLength,
    isSaving,
    isLoading,
    handleMetadataBlur,
    togglePermission,
    toggleGroup,
  } = useRoleDetail(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
        <Navbar />
        <main className="flex-1 p-4 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500 animate-pulse">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-spin" />
            <span>{lang === "ar" ? "جاري تحميل تفاصيل الدور..." : "Loading role details..."}</span>
          </div>
        </main>
      </div>
    );
  }

  const isReadOnly = isSystem || isSuperAdmin;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Header Title with Save Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/roles")}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {name || (lang === "ar" ? "دور بدون اسم" : "Unnamed Role")}
                </h1>
                {isSuperAdmin ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full shadow-2xs">
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    {lang === "ar" ? "سوبر أدمن (شامل)" : "Super Admin (Full)"}
                  </span>
                ) : isSystem ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <Lock className="w-3 h-3" />
                    {lang === "ar" ? "نظام (للقراءة فقط)" : "System (Read-only)"}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                    {lang === "ar" ? "دور مخصص" : "Custom Role"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                ID: {id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <Save className="w-4 h-4 animate-pulse" />
                {lang === "ar" ? "جاري الحفظ تلقائياً..." : "Saving automatically..."}
              </span>
            ) : null}
          </div>
        </div>

        {/* Super Admin Full Permissions Banner */}
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-purple-500/15 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 shrink-0">
                <Zap className="w-6 h-6 fill-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{lang === "ar" ? "صلاحيات المدير الفائق المطلقة (Super Admin)" : "Full Super Admin Privileges Granted"}</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {lang === "ar"
                    ? "يمتلك دور السوبر أدمن الوصول الكامل لكافة وظائف وصلاحيات النظام تلقائياً دون الحاجة لتحديد الصلاحيات يدوياً."
                    : "Super Admin roles automatically inherit full unrestricted access to all permissions across the entire platform."}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              {catalogueLength} / {catalogueLength} {lang === "ar" ? "صلاحية ممررة" : "Granted"}
            </span>
          </div>
        )}

        {/* System Role Info Banner */}
        {isSystem && !isSuperAdmin && (
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 flex gap-3 text-blue-900 dark:text-blue-300 shadow-2xs">
            <Info className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold mb-1">
                {lang === "ar" ? "دور مدمج بالنظام (System Role)" : "Protected System Role"}
              </h4>
              <p className="opacity-80 leading-relaxed">
                {lang === "ar"
                  ? "أدوار النظام الأساسية محمية ضد التعديل أو الحذف لضمان استقرار العمليات المركزية."
                  : "System roles are protected baseline roles and cannot be manually modified or deleted."}
              </p>
            </div>
          </div>
        )}

        {/* REQUIREMENT 1: Wide Top Card for General Information */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-slate-800/40 dark:via-indigo-950/20 dark:to-purple-950/10">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-500" />
              <span>{lang === "ar" ? "المعلومات الأساسية للدور" : "Role General Information"}</span>
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "ar" ? "اسم الدور" : "Role Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleMetadataBlur}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "ar" ? "الوصف" : "Description"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleMetadataBlur}
                  disabled={isReadOnly}
                  rows={2}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors resize-none disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* REQUIREMENT 1 & 3: Full-width Permissions Matrix with Vibrant Colorful Design */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>{lang === "ar" ? "مصفوفة الصلاحيات المطلقة" : "Permissions Matrix"}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isReadOnly
                  ? (lang === "ar" ? "العرض فقط — الصلاحيات المحددة ثابتة لهذا الدور." : "Read-only mode — permissions are fixed for this role.")
                  : (lang === "ar" ? "يتم حفظ تغييرات التحديد تلقائياً." : "Selections are saved automatically.")}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={lang === "ar" ? "ابحث عن الصلاحية..." : "Search permissions..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full ps-9 pe-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                {assignedPermissions.size} {lang === "ar" ? "محددة" : "selected"}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(groupedPermissions).map(([groupName, perms]) => {
              const checkedCount = perms.filter(p => assignedPermissions.has(p.id)).length;
              const isAllChecked = perms.length > 0 && checkedCount === perms.length;

              return (
                <div key={groupName} className="p-5 space-y-4">
                  <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {groupName}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {checkedCount} / {perms.length}
                      </span>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => toggleGroup(groupName, !isAllChecked)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {isAllChecked
                          ? (lang === "ar" ? "إلغاء تحديد الكل" : "Deselect All")
                          : (lang === "ar" ? "تحديد الكل" : "Select All")}
                      </button>
                    )}
                  </div>

                  {/* REQUIREMENT 1: Full-width grid for Permissions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map((p) => {
                      const isChecked = assignedPermissions.has(p.id) || isSuperAdmin;
                      const isCritical = p.key.includes(".critical");

                      return (
                        <label
                          key={p.id}
                          className={`flex items-start justify-between p-3.5 rounded-xl border transition-all ${
                            isChecked
                              ? "bg-indigo-50/60 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-800/80 shadow-2xs"
                              : "bg-slate-50/40 border-slate-200/80 dark:bg-slate-800/20 dark:border-slate-800"
                          } ${!isReadOnly ? "cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600" : "opacity-90"}`}
                        >
                          <div className="space-y-1 me-2">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                              {/* REQUIREMENT 2: Display localized name only, hide p.key */}
                              <span>{getPermissionName(p, lang as "ar" | "en")}</span>
                              {isCritical && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  {lang === "ar" ? "حرج" : "CRITICAL"}
                                </span>
                              )}
                            </div>
                            {/* REQUIREMENT 2: p.key is completely hidden here */}
                          </div>

                          {/* REQUIREMENT 3: Colorful switch element */}
                          <div className="relative shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(p.id)}
                              disabled={isReadOnly}
                              className="sr-only"
                            />
                            <div className={`block w-9 h-5 rounded-full transition-colors ${
                              isChecked
                                ? (isSuperAdmin ? "bg-amber-500" : "bg-indigo-600")
                                : "bg-slate-300 dark:bg-slate-700"
                            }`}></div>
                            <div className={`absolute start-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform flex items-center justify-center ${
                              isChecked ? "translate-x-4 rtl:-translate-x-4" : ""
                            }`}>
                              {isChecked && (
                                <Check className={`w-2.5 h-2.5 stroke-[3] ${isSuperAdmin ? "text-amber-600" : "text-indigo-600"}`} />
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
